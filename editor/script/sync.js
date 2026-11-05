/*
 * PERSISTENCE LAYER
 * -----------------
 * Owns the connection to the shared Automerge document (multiplayer sync)
 * and the local autosave (Store). This module is responsible for:
 *   - snapshotting/restoring world data to/from the shared doc
 *   - sending local edits out (`synchronize` -> `handle.change`)
 *   - receiving remote edits (`handle.on("change" | "ephemeral-message")`)
 *
 * (drawing, paintTool, roomTool, gameTool, isPlayMode) are live bindings,
 * used to build/apply a world snapshot and to trigger UI refresh. 
 */

import { updateText } from "./system/multiplayer.js"
import * as jsondiffpatch from "https://esm.sh/jsondiffpatch"

import { attachServer, userId } from "./system/multiplayer.js"
import { Store } from "./store.js"

import {
	palette, room, tile, sprite, item, dialog, flags, variable, fontName,
	textDirection, tune, blip, names, renderer, serializeWorld, resetAllAnimations
} from "./engine/bitsy.js"
import {
	createWorldData, parseTile, parseSprite, parseItem, parseTune, placeSprites, getType
} from "./engine/world.js"
import {
	serializeTiles, serializeSprites, serializeItems, serializeTunes
} from "./engine/serialize.js"

// live editor state this module needs to read/mutate as part of building
// and applying world snapshots
import {
	drawing, paintTool, roomTool, gameTool,
	getDrawingImageSource, reload_game_data
} from "./editor.js"

/* CONNECTION */
export let server = null;
let serverReady = null; // promise that resolves once `server` is set

/* MULTIPLAYER SYNC STATE */
// TODO: Other tools should flip this off/on around
// operations that must not be interrupted by a remote reload
export let safe_to_update = true;
export function setSafeToUpdate(val) {
	safe_to_update = val;
}

const TEXT_FIELDS = new Set(["tile", "sprite", "item", "tune"]);

// set when a remote change arrives while !safe_to_update, so we know to
// catch up once it's safe again
let pending_remote_update = false;

// the Automerge heads corresponding to the last document state we actually
// parsed into the editor, and the world-data snapshot that corresponds to it
let checked_out_heads = null;
let current_checkout = null;

// mirrors doc.mutex; kept around for debug logging of who last wrote a change
export let mutex = {};

function headsEqual(a, b) {
	if (!a || !b || a.length !== b.length) {
		return false;
	}
	for (let i = 0; i < a.length; i++) {
		if (a[i] !== b[i]) {
			return false;
		}
	}
	return true;
}

const SECTION_PARSERS = { TIL: parseTile, SPR: parseSprite, ITM: parseItem, TUNE: parseTune };

// same dispatch loop as parseWorld, restricted to the four synced record types
function parseSections(text) {
	var parsed = createWorldData();
	var parseState = { lines: text.split("\n"), index: 0, spriteStartLocations: {} };

	while (parseState.index < parseState.lines.length) {
		var i = parseState.index;
		var line = parseState.lines[i];
		var parseFn = (line.length > 0 && line.charAt(0) !== "#")
			? SECTION_PARSERS[getType(line)]
			: undefined;

		if (parseFn) {
			i = parseFn(parseState, parsed);
			if (i <= parseState.index) i = parseState.index + 1; // never stall on a bad record
		} else {
			i++; // blank line, comment, or unknown line
		}
		parseState.index = i;
	}

	placeSprites(parseState, parsed);
	return parsed;
}

function adopt(live, incoming) {
	for (const k of Object.keys(live)) delete live[k];
	if (incoming && typeof incoming === "object") Object.assign(live, incoming);
}

function snapshotWorld() {
	var world = {};
	world.palette = structuredClone(palette);
	world.room = structuredClone(room);
	world.tile = serializeTiles();
	world.sprite = serializeSprites();
	world.item = serializeItems();
	world.dialog = structuredClone(dialog);
	// world.end = end;

	world.variable = structuredClone(variable);
	world.fontName = fontName;
	world.textDirection = textDirection;
	world.tune = serializeTunes();
	world.blip = structuredClone(blip);
	world.flags = structuredClone(flags);
	world.names = structuredClone(names);

	// VERIFY: syncing the active drawing simplifies paintTool reload? check w/ different visible drawings
	world.activeDrawing = drawing ? {
		id: drawing.drw,
		data: structuredClone(getDrawingImageSource(drawing))
	} : {};
	return world;
}

function overwrite(live, incoming) {
	if (live instanceof Map) {
		live.clear();
		if (incoming instanceof Map) {
			for (const [k, v] of incoming) live.set(k, v);
		} else if (incoming && typeof incoming === "object") {
			for (const k of Object.keys(incoming)) live.set(k, incoming[k]);
		}
	} else if (Array.isArray(live)) {
		live.length = 0;
		if (Array.isArray(incoming)) live.push(...incoming);
	} else if (live && typeof live === "object") {
		for (const k of Object.keys(live)) delete live[k];
		if (incoming && typeof incoming === "object") Object.assign(live, incoming);
	}
}

function applyRemoteWorld(remoteWorld) {
	overwrite(palette, remoteWorld.palette);
	overwrite(room, remoteWorld.room);
	overwrite(dialog, remoteWorld.dialog);
	overwrite(flags, remoteWorld.flags);
	overwrite(variable, remoteWorld.variable);
	overwrite(blip, remoteWorld.blip);
	overwrite(names, remoteWorld.names);

	var fields = [
		["tile", tile], ["sprite", sprite], ["item", item], ["tune", tune]
	];
	var text = fields
		.map(([key]) => remoteWorld[key])
		.filter((v) => typeof v === "string")
		.join("\n\n");
	var parsed = text ? parseSections(text) : createWorldData();

	// the parsers put frames in parsed.drawings; the renderer is what serializeDrawing reads
	for (const drwId in parsed.drawings) {
		renderer.SetDrawingSource(drwId, parsed.drawings[drwId]);
	}

	var tune0 = tune["0"]; // serializeTunes skips "0"
	for (const [key, live] of fields) {
		var incoming = remoteWorld[key];
		if (typeof incoming === "string") {
			adopt(live, parsed[key]);
		} else if (incoming && typeof incoming === "object") {
			adopt(live, incoming); // legacy doc: same behavior as the old overwrite
		}
		// undefined: field absent in doc, leave local state alone
	}
	if (typeof remoteWorld.tune === "string" && tune0 !== undefined && !("0" in tune)) {
		tune["0"] = tune0;
	}

	// TODO: fontName / textDirection aren't synced

	if (remoteWorld.activeDrawing && remoteWorld.activeDrawing.id != null) {
		var localSource = renderer.GetDrawingSource(remoteWorld.activeDrawing.id);
		if (localSource) {
			overwrite(localSource, remoteWorld.activeDrawing.data);
		}
		renderer.SetDrawingSource(remoteWorld.activeDrawing.id, localSource || remoteWorld.activeDrawing.data);

		if (paintTool && drawing && drawing.drw === remoteWorld.activeDrawing.id) {
			paintTool.reloadDrawing();
		}
	}
	if (roomTool && roomTool.renderer) {
		roomTool.renderer.ClearCache();
		let roomId = roomTool?.getSelectedId() || 0;
		roomTool.selectAtIndex(roomId);
	}
}

/* SENDER */
export function synchronize(component = 'none') {
	sendLocalChanges(component);
	applyPendingRemoteIfSafe();
}
function sendLocalChanges(component = 'none') {
	var world = snapshotWorld();
	var diff = jsondiffpatch.diff(current_checkout, world);

	if (diff) {
		console.log("send patch:", diff)
		var wasSafe = safe_to_update;
		setSafeToUpdate(false);

		server.handle.change((doc) => {
			writeWorld(doc, world);
			doc.bitsy = Store.get("game_data"); // now, save the rendering cache
			// doc.mutex[userId] = component;
		});
		setSafeToUpdate(wasSafe);
	} else {
		console.log("no patch")
	}
}

function writeWorld(doc, world) {
	if (!doc.world) {
		doc.world = world;
		return;
	}
	for (const [k, v] of Object.entries(world)) {
		// skip untouched fields so we don't rewrite (and clobber) them
		if (current_checkout && !jsondiffpatch.diff(current_checkout[k], v)) continue;

		if (TEXT_FIELDS.has(k) && typeof v === "string" && typeof doc.world[k] === "string") {
			try {
				updateText(doc, ["world", k], v);
				continue;
			} catch (e) {
				// existing value is a scalar string, not a Text object: fall through
			}
		}
		doc.world[k] = v; // legacy object format, first write, or non-text field
	}
}

function applyPendingRemoteIfSafe() {
	if (!safe_to_update) {
		pending_remote_update = true;
		return;
	}

	if (pending_remote_update || !headsEqual(checked_out_heads, server.handle.heads())) {
		flags.ROOM_FORMAT = 1; // always save out comma separated format, even if the old format is read in

		var remoteWorld = server.handle.doc().world;
		console.log("sync crdt: remote world diff", jsondiffpatch.diff(current_checkout, remoteWorld))

		var gamedataStorage;
		if (remoteWorld) {
			applyRemoteWorld(remoteWorld);
			gamedataStorage = serializeWorld();
		}
		Store.set("game_data", gamedataStorage);
		reload_game_data();
		current_checkout = snapshotWorld();

		checked_out_heads = server.handle.heads();
		pending_remote_update = false;
	}
	else {
		var gamedataStorage = serializeWorld();
		Store.set("game_data", gamedataStorage);
		// we already reloaded! just persist the change.
	}

	resetAllAnimations();
	renderer.ClearCache(true);
	roomTool.renderer.ClearCache(true);

	// make sure to update the game tool!
	// this ensures the game data text is up-to-date
	// TODO : this is kind of a hack and it undoes any scrolling the game data textarea
	// I should look into a better solution soon (some kind of file-watching-like concept?)
	if (gameTool) {
		gameTool.menu.update();
	}
}

/* RECEIVER
 * Opens the shared connection and starts listening for remote changes.
 * Call once during startup. */
export async function connectPersistence() {
	serverReady = attachServer(true).then((s) => {
		server = s;
		return s;
	});
	await serverReady;
	const handle = server.handle;

	checked_out_heads = handle.heads();

	handle.on("change", () => {
		// mutex = handle.doc().mutex
		// console.log('sync crdt: update from ' + Object.entries(mutex))
        
		if (safe_to_update) {
			applyPendingRemoteIfSafe();
		} else {
			console.log("deferring remote update until safe_to_update is true")
			pending_remote_update = true;
		}
	})

	return server;
}


/* RECEIVER
 * Registers a callback for ephemeral (non-persisted) broadcast messages,
 * e.g. peer cursor updates. */
export function onEphemeralMessage(callback) {
	server.handle.on("ephemeral-message", callback);
}

/* SENDER
 * Broadcasts an ephemeral (non-persisted) message to peers. */
export function broadcastEphemeral(message) {
	server.handle.broadcast(message);
}

/* Returns the initial shared doc, used once at startup to seed local
 * autosave from whatever the shared doc already has. */
export async function getInitialDoc() {
	if (!server) {
		if (!serverReady) {
			throw new Error("getInitialDoc called before connectPersistence was invoked");
		}
		await serverReady;
	}
	return server.handle.doc();
}