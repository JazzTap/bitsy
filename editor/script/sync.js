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

import * as jsondiffpatch from "https://esm.sh/jsondiffpatch"

import { attachServer, userId } from "./system/multiplayer.js"
import { Store } from "./store.js"

import {
	palette, room, tile, sprite, item, dialog, flags, variable, fontName,
	textDirection, tune, blip, names, renderer, serializeWorld, resetAllAnimations
} from "./engine/bitsy.js"

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

function snapshotWorld() {
	var world = {};
	world.palette = structuredClone(palette);
	world.room = structuredClone(room);
	world.tile = structuredClone(tile);
	world.sprite = structuredClone(sprite);
	world.item = structuredClone(item);
	world.dialog = structuredClone(dialog);
	// world.end = end;
	world.variable = structuredClone(variable);
	world.fontName = fontName;
	world.textDirection = textDirection;
	world.tune = structuredClone(tune);
	world.blip = structuredClone(blip);
	world.flags = structuredClone(flags);
	world.names = structuredClone(names);

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
	overwrite(tile, remoteWorld.tile);
	overwrite(sprite, remoteWorld.sprite);
	overwrite(item, remoteWorld.item);
	overwrite(dialog, remoteWorld.dialog);
	overwrite(flags, remoteWorld.flags);
	overwrite(variable, remoteWorld.variable);
	overwrite(tune, remoteWorld.tune);
	overwrite(blip, remoteWorld.blip);
	overwrite(names, remoteWorld.names);

	// TODO: fontName / textDirection aren't synced

	// we can't afford to sync the whole rendering cache, just the active drawing
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
		// roomTool.menu.update();

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
			doc.world = world;
			doc.bitsy = Store.get("game_data"); // seems like the rendering cache has to get saved
			// doc.mutex[userId] = component;
		});
		setSafeToUpdate(wasSafe);
	} else {
		console.log("no patch")
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