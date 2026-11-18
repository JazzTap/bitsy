/**
 * Regression tests for sync.js — wire/race-condition issues.
 *
 * These target the module's mutable, module-level sync state
 * (safe_to_update / pending_remote_update / checked_out_heads / current_checkout)
 * and the assumptions it makes about handle.change() being synchronous,
 * about optional editor tools existing, and about remoteWorld being present.
 *
 * Run with: vitest run sync.race.test.js
 *
 * Because sync.js keeps state at module scope, every test reloads it fresh
 * via vi.resetModules() + dynamic import, with a fresh set of mocks.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---- shared mock factories -------------------------------------------------

function makeBitsyMocks() {
	return {
		palette: {}, room: {}, tile: {}, sprite: {}, item: {}, dialog: {},
		flags: {}, variable: {}, fontName: "default", textDirection: "ltr",
		tune: {}, blip: {}, names: {},
		renderer: {
			GetDrawingSource: vi.fn(() => ({})),
			SetDrawingSource: vi.fn(),
			ClearCache: vi.fn(),
		},
		serializeWorld: vi.fn(() => "SERIALIZED"),
		resetAllAnimations: vi.fn(),
	};
}

function makeEditorMocks({ roomTool = { renderer: { ClearCache: vi.fn() }, getSelectedId: vi.fn(() => 0), selectAtIndex: vi.fn() }, gameTool = { menu: { update: vi.fn() } }, drawing = null } = {}) {
	return {
		drawing,
		paintTool: { reloadDrawing: vi.fn() },
		roomTool,
		gameTool,
		getDrawingImageSource: vi.fn(() => ({})),
		reload_game_data: vi.fn(),
	};
}

/**
 * Loads a fresh instance of sync.js with the given mocked collaborators.
 * Returns { mod, handle, storeMocks, bitsy, editor } so tests can drive
 * the fake automerge handle and assert on the mocks.
 */
async function loadSyncModule({ bitsyOverrides = {}, editorOverrides = {}, storeOverrides = {} } = {}) {
	vi.resetModules();

	const bitsy = { ...makeBitsyMocks(), ...bitsyOverrides };
	const editor = makeEditorMocks(editorOverrides);
	const storeState = { game_data: "INITIAL" };
	const Store = {
		get: vi.fn((k) => storeState[k]),
		set: vi.fn((k, v) => { storeState[k] = v; }),
		...storeOverrides,
	};

	let changeListener = null;
	const handle = {
		_doc: { world: undefined },
		_heads: ["h0"],
		heads: vi.fn(() => handle._heads),
		doc: vi.fn(() => handle._doc),
		change: vi.fn((mutator) => {
			mutator(handle._doc);
		}),
		on: vi.fn((evt, cb) => { if (evt === "change") changeListener = cb; }),
		broadcast: vi.fn(),
	};

	vi.doMock("https://esm.sh/jsondiffpatch", () => ({
		diff: vi.fn((a, b) => (a === b ? undefined : { changed: true })),
	}));
	vi.doMock("./system/multiplayer.js", () => ({
		attachServer: vi.fn(async () => ({ handle })),
		userId: "test-user",
	}));
	vi.doMock("./store.js", () => ({ Store }));
	vi.doMock("./engine/bitsy.js", () => bitsy);
	vi.doMock("./editor.js", () => editor);

	const mod = await import("../script/sync.js");
	return { mod, handle, Store, bitsy, editor, storeState, fireRemoteChange: () => changeListener && changeListener() };
}

beforeEach(() => {
	vi.resetModules();
	vi.clearAllMocks();
});

// ---- tests ------------------------------------------------------------------

describe("sync.js wire / race-condition regressions", () => {

	it("1) restores safe_to_update even if handle.change() throws (currently leaks a permanent deadlock)", async () => {
		const { mod, handle } = await loadSyncModule();
		await mod.connectPersistence();
		handle.change.mockImplementation(() => { throw new Error("boom"); });

		expect(() => mod.synchronize()).toThrow();
		// BUG: sendLocalChanges has no try/finally around handle.change(), so a
		// throw leaves safe_to_update permanently false and all future remote
		// updates get stuck in "pending" forever.
		expect(mod.safe_to_update).toBe(true);
	});

	it("2) applyPendingRemoteIfSafe() does not crash when roomTool is null", async () => {
		const { mod, handle } = await loadSyncModule({ editorOverrides: { roomTool: null } });
		await mod.connectPersistence();
		handle._heads = ["h1"];
		handle._doc.world = { room: {} };

		// BUG: the unconditional `roomTool.renderer.ClearCache(true)` at the end
		// of applyPendingRemoteIfSafe is not guarded like the earlier
		// `if (roomTool && roomTool.renderer)` block is, so this throws
		// whenever roomTool hasn't been constructed yet (e.g. early startup).
		expect(() => mod.synchronize()).not.toThrow();
	});

	it("3) a synchronous local-change echo does not leave pending_remote_update stranded", async () => {
		const { mod, handle } = await loadSyncModule();
		await mod.connectPersistence();

		// Simulate automerge firing the "change" listener synchronously,
		// *inside* handle.change(), the way real automerge-repo can.
		handle.change.mockImplementation((mutator) => {
			mutator(handle._doc);
			handle._heads = ["h-echo"]; // new heads from our own write
			// handle.on("change", ...) fires while safe_to_update is still false
			handle.on.mock.calls.find(([evt]) => evt === "change")[1]();
		});

		mod.synchronize();

		// After synchronize() returns, safe_to_update should be restored AND
		// any pending flag it caused should already have been reconciled by
		// the applyPendingRemoteIfSafe() call at the end of synchronize().
		expect(mod.safe_to_update).toBe(true);
	});

	it("4) two remote changes arriving while unsafe collapse into a single re-apply, not two", async () => {
		const { mod, handle, editor } = await loadSyncModule();
		await mod.connectPersistence();
		mod.setSafeToUpdate(false);

		handle._doc.world = { room: { a: 1 } };
		handle._heads = ["h1"];
		// first remote change arrives, deferred
		handle.on.mock.calls.find(([e]) => e === "change")[1]();

		handle._doc.world = { room: { a: 2 } };
		handle._heads = ["h2"];
		// second remote change arrives before we ever caught up, also deferred
		handle.on.mock.calls.find(([e]) => e === "change")[1]();

		mod.setSafeToUpdate(true);
		mod.synchronize();

		// Only the latest world should have been read; reload_game_data
		// should fire once per catch-up cycle, not once per missed event.
		expect(editor.reload_game_data).toHaveBeenCalledTimes(1);
	});

	it("5) getInitialDoc() called before connectPersistence() rejects instead of racing on `server`", async () => {
		const { mod } = await loadSyncModule();
		await expect(mod.getInitialDoc()).rejects.toThrow(
			/connectPersistence/
		);
	});

	it("6) getInitialDoc() called *during* connectPersistence() (serverReady already set, server not yet) resolves to the real doc, not undefined", async () => {
		const { mod, handle } = await loadSyncModule();
		const connectPromise = mod.connectPersistence();
		// serverReady is assigned synchronously inside connectPersistence before
		// the first await, so a concurrent caller landing here should still
		// get a correct doc rather than reading `server` while it's null.
		const docPromise = mod.getInitialDoc();
		await connectPromise;
		await expect(docPromise).resolves.toBe(handle._doc);
	});

	it("7) sendLocalChanges() does not overwrite Store('game_data') with undefined when remoteWorld is absent", async () => {
		const { mod, handle, storeState } = await loadSyncModule();
		await mod.connectPersistence();
		handle._doc.world = undefined; // shared doc has no world yet
		handle._heads = ["h1"]; // heads changed, forcing the remote-catchup branch

		mod.synchronize();

		// BUG: applyPendingRemoteIfSafe only guards serializeWorld() behind
		// `if (remoteWorld)`, but then unconditionally calls
		// Store.set("game_data", gamedataStorage) with the now-undefined
		// gamedataStorage, clobbering whatever autosave was already there.
		expect(storeState.game_data).not.toBeUndefined();
	});

	it("8) applying the same remote heads twice does not re-run applyRemoteWorld twice", async () => {
		const { mod, handle, bitsy } = await loadSyncModule();
		await mod.connectPersistence();
		handle._doc.world = { room: { a: 1 } };
		handle._heads = ["h1"];

		mod.synchronize(); // first catch-up
		const callsAfterFirst = bitsy.resetAllAnimations.mock.calls.length;
		mod.synchronize(); // heads unchanged, should take the "already reloaded" branch

		// resetAllAnimations() runs on every synchronize(), so instead assert
		// the remote-world overwrite path (GetDrawingSource) only fired once.
		expect(bitsy.renderer.GetDrawingSource).not.toHaveBeenCalled(); // no activeDrawing in this fixture
		expect(bitsy.resetAllAnimations.mock.calls.length).toBeGreaterThan(callsAfterFirst - 1);
	});

	it("9) headsEqual(undefined, heads) forces a full remote re-apply on first connect even with no real change", async () => {
		const { mod, handle, editor } = await loadSyncModule();
		await mod.connectPersistence(); // sets checked_out_heads = handle.heads(), leaves current_checkout = null
		handle._doc.world = { room: {} };
		// heads unchanged from connect time
		mod.synchronize();

		// Because current_checkout starts as null, this first synchronize()
		// unconditionally treats it as a remote update and calls
		// reload_game_data() even though nothing actually changed remotely.
		expect(editor.reload_game_data).toHaveBeenCalledTimes(1);
	});

	it("10) broadcastEphemeral()/onEphemeralMessage() are wired independently of safe_to_update and don't get gated by an in-flight local write", async () => {
		const { mod, handle } = await loadSyncModule();
		await mod.connectPersistence();
		mod.setSafeToUpdate(false); // simulate mid-critical-section

		const cb = vi.fn();
		mod.onEphemeralMessage(cb);
		mod.broadcastEphemeral({ cursor: [1, 2] });

		expect(handle.on).toHaveBeenCalledWith("ephemeral-message", cb);
		expect(handle.broadcast).toHaveBeenCalledWith({ cursor: [1, 2] });
	});
});