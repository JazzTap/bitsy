// Utility functions for the room tool (room selection, room palette, exits/endings/markers)
// Extracted from editor.js to separate room-tool concerns from editor setup/update-loop code.

import { rgbToHex } from "./util.js"
import { bitsyLog, tilesize, scale, mapsize } from "./system/system.js"

import { getPal, getRoomPal, initRoom, sprite, tile, room, item, state } from "./engine/bitsy.js"
import { createExitData, createEndingData } from "./engine/world.js"

import { ThumbnailRendererBase } from "./thumbnail.js"

import { roomTool, markerTool, paintTool, refreshGameData } from "./editor.js"

/* ROOM NAVIGATION */
export function selectRoom(roomId) {
	roomTool.select(roomId);
}

export function copyExitData(exit) {
	return createExitData(
		exit.x,
		exit.y,
		exit.dest.room,
		exit.dest.x,
		exit.dest.y,
		exit.transition_effect,
		exit.dlg);
}

export function copyEndingData(ending) {
	return createEndingData(ending.id, ending.x, ending.y);
}

/* ROOM PALETTE */
export function roomPaletteChange(event) {
	var palId = event.target.value;
	room[state.room].pal = palId;

	// hacky?
	initRoom(state.room);

	refreshGameData('room');

	paintTool.updateCanvas();
}

/* THUMBNAIL */
export function createRoomThumbnailRenderer() {
	var getRenderable = function(id) {
		return room[id];
	}

	var getHexPalette = function(r) {
		var hexPalette = [];

		if (r.id in room) {
			var palId = getRoomPal(r.id);
			var colors = getPal(palId);

			for (let i in colors) {
				var hexStr = rgbToHex(colors[i][0], colors[i][1], colors[i][2]).slice(1);
				hexPalette.push(hexStr);
			}

			return hexPalette;
		}
	}

	function onRender(r, ctx, options) {
		var roomRenderSize = tilesize * scale;
		var tileRenderSize = roomRenderSize / mapsize;

		if (r.id in room) {
			var roomId = r.id;
			var hexPalette = getHexPalette(r);

			bitsyLog(hexPalette, "editor");

			ctx.fillStyle = "#" + hexPalette[0];
			ctx.fillRect(0, 0, roomRenderSize, roomRenderSize);

			// tiles
			for (var ry = 0; ry < mapsize; ry++) {
				for (var rx = 0; rx < mapsize; rx++) {
					var tileId = r.tilemap[ry][rx];

					if (tileId != "0" && (tileId in tile)) {
						ctx.fillStyle = "#" + hexPalette[parseInt(tile[tileId].col)];
						ctx.fillRect(rx * tileRenderSize, ry * tileRenderSize, tileRenderSize, tileRenderSize);
					}
				}
			}

			// items
			for (var i = 0; i < r.items.length; i++) {
				var itm = r.items[i];

				if (itm.id in item) {
					var rx = itm.x;
					var ry = itm.y;
					ctx.fillStyle = "#" + hexPalette[parseInt(item[itm.id].col)];
					ctx.fillRect(rx * tileRenderSize, ry * tileRenderSize, tileRenderSize, tileRenderSize);
				}
			}

			// sprites
			for (var id in sprite) {
				var spr = sprite[id];
				if (spr.room === r.id) {
					var rx = spr.x;
					var ry = spr.y;
					ctx.fillStyle = "#" + hexPalette[parseInt(spr.col)];
					ctx.fillRect(rx * tileRenderSize, ry * tileRenderSize, tileRenderSize, tileRenderSize);
				}
			}
		}

		return [ctx.getImageData(0, 0, roomRenderSize, roomRenderSize).data];
	}

	var renderer = new ThumbnailRendererBase(getRenderable, getHexPalette, onRender);
	renderer.renderToCtx = onRender;

	return renderer;
}

/* MARKERS (exits & endings) */
export function startAddMarker() {
	markerTool.StartAdd();
}

export function cancelAddMarker() {
	markerTool.CancelAdd();
}

export function newExit() {
	markerTool.AddExit(false);
}

export function newExitOneWay() {
	markerTool.AddExit(true);
}

export function newEnding() {
	markerTool.AddEnding();
}

export function duplicateMarker() {
	markerTool.DuplicateSelected();
}

export function deleteMarker() {
	markerTool.RemoveMarker();
}

export function prevMarker() {
	markerTool.NextMarker();
}

export function nextMarker() {
	markerTool.PrevMarker();
}

export function toggleMoveMarker1(e) {
	markerTool.TogglePlacingFirstMarker(e.target.checked);
}

export function selectMarkerRoom1() {
	markerTool.SelectMarkerRoom1();
}

export function toggleMoveMarker2(e) {
	markerTool.TogglePlacingSecondMarker(e.target.checked);
}

export function selectMarkerRoom2() {
	markerTool.SelectMarkerRoom2();
}

export function changeExitDirection() {
	markerTool.ChangeExitLink();
}

export function onEffectTextChange(event) {
	markerTool.ChangeEffectText(event.target.value);
}

export function onChangeExitTransitionEffect(effectId, exitIndex) {
	markerTool.ChangeExitTransitionEffect(effectId, exitIndex);
}

export function toggleExitOptions(exitIndex, visibility) {
	if (exitIndex == 0) {
		// hacky way to keep these in syncs!!!
		document.getElementById("exitOptionsToggleCheck1").checked = visibility;
		document.getElementById("exitOptionsToggleCheck1_alt").checked = visibility;
	}
	markerTool.ToggleExitOptions(exitIndex, visibility);
}
