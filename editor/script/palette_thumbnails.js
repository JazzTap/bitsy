// Palette tool and color helper utilities.

import { rgbToHex, rgbToHsl } from "./util.js"
import { tilesize, scale } from "./system/system.js"

import { getPal, palette, curDefaultPal } from "./engine/bitsy.js"

import { ThumbnailRendererBase } from "./thumbnail.js"

import { paletteTool } from "./editor.js"

/* COLOR HELPERS */
export function getContrastingColor(palId) {
	if (isColorDark(palId)) {
		return "#fff";
	}
	else {
		return "#000";
	}
}

export function isColorDark(palId) {
	if (!palId) {
		palId = curDefaultPal();
	}

	var hsl = rgbToHsl(getPal(palId)[0][0], getPal(palId)[0][1], getPal(palId)[0][2]);
	var lightness = hsl[2];

	return lightness <= 0.5;
}

export function getComplimentingColor(palId) {
	if (!palId) palId = curDefaultPal();
	var hsl = rgbToHsl( getPal(palId)[0][0], getPal(palId)[0][1], getPal(palId)[0][2] );
	// bitsyLog(hsl, "editor");
	var lightness = hsl[2];
	if (lightness > 0.5) {
		return "#fff";
	}
	else {
		return "#000";
	}
}

/* PALETTE NAVIGATION */
export function changeColorPickerIndex(index) {
	paletteTool.changeColorPickerIndex(index);
}

export function prevPalette() {
	paletteTool.SelectPrev();
}

export function nextPalette() {
	paletteTool.SelectNext();
}

export function newPalette() {
	paletteTool.AddNew();
}

export function duplicatePalette() {
	paletteTool.AddDuplicate();
}

export function deletePalette() {
	paletteTool.DeleteSelected();
}

/* THUMBNAIL */
export function createPaletteThumbnailRenderer() {
	var getRenderable = function(id) {
		return palette[id];
	}

	var getHexPaletteBase = function(pal) {
		var hexPalette = [];

		if (pal.id in palette) {
			var palId = pal.id;
			var colors = getPal(palId);

			for (let i in colors) {
				var hexStr = rgbToHex(colors[i][0], colors[i][1], colors[i][2]).slice(1);
				hexPalette.push(hexStr);
			}
		}

		return hexPalette;
	}

	// always include black for border, but not in palette itself
	var getHexPalette = function(pal) {
		return getHexPaletteBase(pal).concat('000000');
	}

	var onRender = function(pal, ctx, options) {
		var padding = 0.125;
		var fillSize = 1 - padding*2;
		if (pal.id in palette) {
			var hexPalette = getHexPaletteBase(pal);
			var bar = (1 / hexPalette.length) * fillSize;

			ctx.fillStyle = "black";
			ctx.fillRect(0, 0, tilesize * scale, tilesize * scale);

			for (let i in hexPalette) {
				ctx.fillStyle = "#" + hexPalette[i];
				ctx.fillRect(tilesize * scale * padding, tilesize * scale * (padding + i * bar), tilesize * scale * fillSize, tilesize * scale * bar);
			}
		}

		return [ctx.getImageData(0, 0, tilesize * scale, tilesize * scale).data];
	}

	return new ThumbnailRendererBase(getRenderable, getHexPalette, onRender);
}
