// Utility functions for the paint tool (tiles, sprites, items, drawings, animation)
// Extracted from editor.js to separate paint-tool concerns from editor setup/update-loop code.

import { TileType, rgbToHex } from "./util.js"
import { bitsyLog, tilesize, scale } from "./system/system.js"
import { updatePaintGridCheck } from "./paint.js"

import { getPal, getRoomPal, sprite, tile, room, item, renderer, state, dialog,
	resetAllAnimations, updateNamesFromCurData } from "./engine/bitsy.js"
import { createDrawingData } from "./engine/world.js"

import { ThumbnailRenderer, ThumbnailRendererBase, renderTileToCanvas } from "./thumbnail.js"

import { localization, iconUtils, events } from "./editor_state.js"

import {
	drawing, setDrawing,
	tileIndex, spriteIndex, itemIndex,
	setTileIndex, setSpriteIndex, setItemIndex,
	paintTool, roomTool,
	refreshGameData,
	reloadDialogUI,
	sortedTileIdList, sortedSpriteIdList, sortedItemIdList,
} from "./editor.js"

/* ID / TYPE HELPERS */
export function tileTypeToString(type) {
	if (type == TileType.Tile) {
		return "tile";
	}
	else if (type == TileType.Sprite) {
		return "sprite";
	}
	else if (type == TileType.Avatar) {
		return "avatar";
	}
	else if (type == TileType.Item) {
		return "item";
	}
}

export function tileTypeToIdPrefix(type) {
	if (type == TileType.Tile) {
		return "TIL_";
	}
	else if (type == TileType.Sprite || type == TileType.Avatar) {
		return "SPR_";
	}
	else if (type == TileType.Item) {
		return "ITM_";
	}
}

/* MAKE DRAWING OBJECTS */
export function makeTile(id, imageData) {
	tile[id] = makeDrawing("TIL", id, imageData);
}

export function makeSprite(id, imageData) {
	sprite[id] = makeDrawing("SPR", id, imageData);
}

export function makeItem(id, imageData) {
	item[id] = makeDrawing("ITM", id, imageData);
}

export function makeDrawing(type, id, imageData) {
	// initialize drawing data
	var drawingData = createDrawingData(type, id);
	drawingData.animation.frameCount = (!imageData) ? 1 : (imageData.length);
	drawingData.animation.isAnimated = drawingData.animation.frameCount > 1;

	// initialize renderer cache
	if (!imageData) {
		// if there's no image data, initialize with one empty frame
		imageData = [
			[
				[0,0,0,0,0,0,0,0],
				[0,0,0,0,0,0,0,0],
				[0,0,0,0,0,0,0,0],
				[0,0,0,0,0,0,0,0],
				[0,0,0,0,0,0,0,0],
				[0,0,0,0,0,0,0,0],
				[0,0,0,0,0,0,0,0],
				[0,0,0,0,0,0,0,0],
			],
		];
	}

	renderer.SetDrawingSource(drawingData.drw, imageData);

	return drawingData;
}

export function findAndReplaceTileInAllRooms( findTile, replaceTile ) {
	for (let roomId in room) {
		for (let y in room[roomId].tilemap) {
			for (let x in room[roomId].tilemap[y]) {
				if (room[roomId].tilemap[y][x] === findTile) {
					room[roomId].tilemap[y][x] = replaceTile;
				}
			}
		}
	}
}

export function removeAllItems( id ) {
	function getFirstItemIndex(roomId, itemId) {
		for(var i = 0; i < room[roomId].items.length; i++) {
			if(room[roomId].items[i].id === itemId)
				return i;
		}
		return -1;
	}

	for(roomId in room) {
		var i = getFirstItemIndex(roomId, id );
		while(i > -1) {
			room[roomId].items.splice(i,1);
			i = getFirstItemIndex(roomId, id );
		}
	}
}

/* DRAWING NAVIGATION */
export function newDrawing() {
	paintTool.newDrawing();
}

export function nextTile() {
	var ids = sortedTileIdList();
	var newIndex = (tileIndex + 1) % ids.length;
	setTileIndex(newIndex);

	var tileId = ids[newIndex];
	setDrawing(tile[tileId]);

	paintTool.curDrawingFrameIndex = 0;
	paintTool.reloadDrawing();
}

export function prevTile() {
	var ids = sortedTileIdList();

	var newIndex = (tileIndex - 1) % ids.length;
	if (newIndex < 0) {
		newIndex = (ids.length - 1);
	}
	setTileIndex(newIndex);

	var tileId = ids[newIndex];
	setDrawing(tile[tileId]);

	paintTool.curDrawingFrameIndex = 0;
	paintTool.reloadDrawing();
}

export function nextItem() {
	var ids = sortedItemIdList();
	var newIndex = (itemIndex + 1) % ids.length;
	setItemIndex(newIndex);

	var itemId = ids[newIndex];
	setDrawing(item[itemId]);

	paintTool.curDrawingFrameIndex = 0;
	paintTool.reloadDrawing();
}

export function prevItem() {
	var ids = sortedItemIdList();

	var newIndex = (itemIndex - 1) % ids.length;
	if (newIndex < 0) {
		newIndex = (ids.length - 1); // loop
	}
	setItemIndex(newIndex);

	var itemId = ids[newIndex];
	setDrawing(item[itemId]);

	paintTool.curDrawingFrameIndex = 0;
	paintTool.reloadDrawing();
}

export function nextSprite() {
	var ids = sortedSpriteIdList();

	var newIndex = (spriteIndex + 1) % ids.length;
	if (newIndex === 0) {
		newIndex = 1; //skip avatar
	}
	setSpriteIndex(newIndex);

	var spriteId = ids[newIndex];
	setDrawing(sprite[spriteId]);

	paintTool.curDrawingFrameIndex = 0;
	paintTool.reloadDrawing();
}

export function prevSprite() {
	var ids = sortedSpriteIdList();

	var newIndex = (spriteIndex - 1) % ids.length;
	if (newIndex <= 0) {
		newIndex = (ids.length - 1); //loop and skip avatar
	}
	setSpriteIndex(newIndex);

	var spriteId = ids[newIndex];
	setDrawing(sprite[spriteId]);

	paintTool.curDrawingFrameIndex = 0;
	paintTool.reloadDrawing();
}

export function next() {
	if (drawing.type == TileType.Tile) {
		nextTile();
	}
	else if( drawing.type == TileType.Avatar || drawing.type == TileType.Sprite ) {
		nextSprite();
	}
	else if( drawing.type == TileType.Item ) {
		nextItem();
	}

	events.Raise("select_drawing", { id: drawing.id, type: drawing.type });
}

export function prev() {
	if (drawing.type == TileType.Tile) {
		prevTile();
	}
	else if( drawing.type == TileType.Avatar || drawing.type == TileType.Sprite ) {
		prevSprite();
	}
	else if( drawing.type == TileType.Item ) {
		prevItem();
	}

	events.Raise("select_drawing", { id: drawing.id, type: drawing.type });
}

export function copyDrawingData(sourceDrawingData) {
    var copiedDrawingData = [];

    for (let frame in sourceDrawingData) {
        copiedDrawingData.push([]);
        for (let y in sourceDrawingData[frame]) {
            copiedDrawingData[frame].push([]);
            for (let x in sourceDrawingData[frame][y]) {
                copiedDrawingData[frame][y].push(sourceDrawingData[frame][y][x]);
            }
        }
    }

    return copiedDrawingData;
}

export function duplicateDrawing() {
    paintTool.duplicateDrawing();
}

export function deleteDrawing() {
	paintTool.deleteDrawing();
	events.Raise("select_drawing", { id: drawing.id, type: drawing.type });
}

export function on_drawing_name_change() {
	var str = document.getElementById("drawingName").value;
	var obj = paintTool.getCurObject();
	var oldName = obj.name;
	if(str.length > 0)
		obj.name = str;
	else
		obj.name = null;

	bitsyLog("NEW NAME!", "editor");
	bitsyLog(obj, "editor");

	updateNamesFromCurData()

	// update display name for thumbnail
	var displayName = obj.name ? obj.name : getCurPaintModeStr() + " " + drawing.id;

	// make sure items referenced in scripts update their names
	if(drawing.type === TileType.Item) {
		// bitsyLog("SWAP ITEM NAMES", "editor");

		var ItemNameSwapVisitor = function() {
			var didSwap = false;
			this.DidSwap = function() { return didSwap; };

			this.Visit = function(node) {
				// bitsyLog("VISIT!", "editor");
				// bitsyLog(node, "editor");

				if( node.type != "function" || node.name != "item" )
					return; // not the right type of node

				if( node.arguments.length <= 0 || node.arguments[0].type != "literal" )
					return; // no argument available

				if( node.arguments[0].value === oldName ) { // do swap
					node.arguments[0].value = newName;
					didSwap = true;
				}
			};
		};

		var newName = obj.name;
		if(newName === null || newName === undefined) newName = drawing.id;
		if(oldName === null || oldName === undefined) oldName = drawing.id;

		// bitsyLog(oldName + " <-> " + newName, "editor");

		if(newName != oldName) {
			for(dlgId in dialog) {
				// bitsyLog("DLG " + dlgId, "editor");
				var dialogScript = scriptInterpreter.Parse(dialog[dlgId].src);
				var visitor = new ItemNameSwapVisitor();
				dialogScript.VisitAll(visitor);
				if (visitor.DidSwap()) {
					var newDialog = dialogScript.Serialize();
					if (newDialog.indexOf("\n") > -1) {
						newDialog = '"""\n' + newDialog + '\n"""';
					}
					dialog[dlgId].src = newDialog;
				}
			}
		}

		updateInventoryItemUI();

		// renderPaintThumbnail( drawing.id ); // hacky way to update name
	}

	refreshGameData('drawing name');
	bitsyLog(newName, "editor");
}

/* RELOAD / UI SYNC */
export function updateWallCheckboxOnCurrentTile() {
	var isCurTileWall = false;

	if( tile[ drawing.id ].isWall == undefined || tile[ drawing.id ].isWall == null ) {
		if (room[state.room]) {
			isCurTileWall = (room[state.room].walls.indexOf(drawing.id) != -1);
		}
	}
	else {
		isCurTileWall = tile[ drawing.id ].isWall;
	}

	if (isCurTileWall) {
		document.getElementById("wallCheckbox").checked = true;
		iconUtils.LoadIcon(document.getElementById("wallCheckboxIcon"), "wall_on");
	}
	else {
		document.getElementById("wallCheckbox").checked = false;
		iconUtils.LoadIcon(document.getElementById("wallCheckboxIcon"), "wall_off");
	}
}

export function reloadTile() {
	// animation UI
	if ( tile[drawing.id] && tile[drawing.id].animation.isAnimated ) {
		paintTool.isCurDrawingAnimated = true;
		document.getElementById("animatedCheckbox").checked = true;

		if( paintTool.curDrawingFrameIndex == 0)
		{
			document.getElementById("animationKeyframe1").className = "bitsy-thumbnail bitsy-thumbnail-selected";
			document.getElementById("animationKeyframe2").className = "bitsy-thumbnail";
		}
		else if( paintTool.curDrawingFrameIndex == 1 )
		{
			document.getElementById("animationKeyframe1").className = "bitsy-thumbnail";
			document.getElementById("animationKeyframe2").className = "bitsy-thumbnail bitsy-thumbnail-selected";
		}

		document.getElementById("animation").setAttribute("style","display:block;");
		iconUtils.LoadIcon(document.getElementById("animatedCheckboxIcon"), "expand_more");
		renderAnimationPreview(drawing);
	}
	else {
		paintTool.isCurDrawingAnimated = false;
		document.getElementById("animatedCheckbox").checked = false;
		document.getElementById("animation").setAttribute("style","display:none;");
		iconUtils.LoadIcon(document.getElementById("animatedCheckboxIcon"), "expand_less");
	}

	// wall UI
	updateWallCheckboxOnCurrentTile();

	updateDrawingNameUI(true);

	paintTool.updateCanvas();
}

export function reloadSprite() {
	// animation UI
	if ( sprite[drawing.id] && sprite[drawing.id].animation.isAnimated ) {
		paintTool.isCurDrawingAnimated = true;
		document.getElementById("animatedCheckbox").checked = true;

		if( paintTool.curDrawingFrameIndex == 0)
		{
			document.getElementById("animationKeyframe1").className = "bitsy-thumbnail bitsy-thumbnail-selected";
			document.getElementById("animationKeyframe2").className = "bitsy-thumbnail";
		}
		else if( paintTool.curDrawingFrameIndex == 1 )
		{
			document.getElementById("animationKeyframe1").className = "bitsy-thumbnail";
			document.getElementById("animationKeyframe2").className = "bitsy-thumbnail bitsy-thumbnail-selected";
		}

		document.getElementById("animation").setAttribute("style","display:block;");
		iconUtils.LoadIcon(document.getElementById("animatedCheckboxIcon"), "expand_more");
		renderAnimationPreview(drawing);
	}
	else {
		paintTool.isCurDrawingAnimated = false;
		document.getElementById("animatedCheckbox").checked = false;
		document.getElementById("animation").setAttribute("style","display:none;");
		iconUtils.LoadIcon(document.getElementById("animatedCheckboxIcon"), "expand_less");
	}

	// dialog UI
	reloadDialogUI()

	updateDrawingNameUI( drawing.id != "A" );

	// update paint canvas
	paintTool.updateCanvas();

}

// TODO consolidate these drawing related methods
export function reloadItem() {
	// animation UI
	if ( item[drawing.id] && item[drawing.id].animation.isAnimated ) {
		paintTool.isCurDrawingAnimated = true;
		document.getElementById("animatedCheckbox").checked = true;

		if( paintTool.curDrawingFrameIndex == 0)
		{
			document.getElementById("animationKeyframe1").className = "bitsy-thumbnail bitsy-thumbnail-selected";
			document.getElementById("animationKeyframe2").className = "bitsy-thumbnail";
		}
		else if( paintTool.curDrawingFrameIndex == 1 )
		{
			document.getElementById("animationKeyframe1").className = "bitsy-thumbnail";
			document.getElementById("animationKeyframe2").className = "bitsy-thumbnail bitsy-thumbnail-selected";
		}

		document.getElementById("animation").setAttribute("style","display:block;");
		iconUtils.LoadIcon(document.getElementById("animatedCheckboxIcon"), "expand_more");
		renderAnimationPreview(drawing);
	}
	else {
		paintTool.isCurDrawingAnimated = false;
		document.getElementById("animatedCheckbox").checked = false;
		document.getElementById("animation").setAttribute("style","display:none;");
		iconUtils.LoadIcon(document.getElementById("animatedCheckboxIcon"), "expand_less");
	}

	// dialog UI
	reloadDialogUI()

	updateDrawingNameUI(true);

	// update paint canvas
	paintTool.updateCanvas();

}

export function updateAnimationUI() {
	//todo
}

export function updateDrawingNameUI() {
	var obj = paintTool.getCurObject();

	if (drawing?.type == TileType.Avatar) { // hacky
		document.getElementById("drawingName").value = "avatar"; // TODO: localize
	}
	else if (obj?.name != null) {
		document.getElementById("drawingName").value = obj.name;
	}
	else {
		document.getElementById("drawingName").value = "";
	}

	document.getElementById("drawingName").placeholder = getCurPaintModeStr() + " " + drawing?.id;

	document.getElementById("drawingName").readOnly = (drawing?.type == TileType.Avatar);
}

export function getCurPaintModeStr() {
	if(drawing?.type == TileType.Sprite || drawing?.type == TileType.Avatar) {
		return localization.GetStringOrFallback("sprite_label", "sprite");
	}
	else if(drawing?.type == TileType.Item) {
		return localization.GetStringOrFallback("item_label", "item");
	}
	else if(drawing?.type == TileType.Tile) {
		return localization.GetStringOrFallback("tile_label", "tile");
	}
}

/* PAINT MODE SWITCHING */
export function on_paint_avatar() {
	setSpriteIndex(0);
	setDrawing(sprite["A"]);

	paintTool.reloadDrawing();
	on_paint_avatar_ui_update();

	events.Raise("select_drawing", { id: drawing.id, type: drawing.type });
}

export function on_paint_avatar_ui_update() {
	document.getElementById("dialog").setAttribute("style","display:none;");
	document.getElementById("wall").setAttribute("style","display:none;");
	// TODO : make navigation commands un-clickable
	document.getElementById("animationOuter").setAttribute("style","display:block;");
	updateDrawingNameUI(false);
	document.getElementById("paintOptionAvatar").checked = true;
	document.getElementById("showInventoryButton").setAttribute("style","display:none;");

	var disableForAvatarElements = document.getElementsByClassName("disableForAvatar");
	for (var i = 0; i < disableForAvatarElements.length; i++) {
		disableForAvatarElements[i].disabled = true;
	}
}

export function on_paint_tile() {
	setTileIndex(0);
	var tileId = sortedTileIdList()[0];
	setDrawing(tile[tileId]);

	paintTool.reloadDrawing();
	on_paint_tile_ui_update();

	events.Raise("select_drawing", { id: drawing.id, type: drawing.type });
}

export function on_paint_tile_ui_update() {
	document.getElementById("dialog").setAttribute("style","display:none;");
	document.getElementById("wall").setAttribute("style","display:block;");
	document.getElementById("animationOuter").setAttribute("style","display:block;");
	updateDrawingNameUI(true);
	//document.getElementById("animation").setAttribute("style","display:block;");
	document.getElementById("paintOptionTile").checked = true;
	document.getElementById("showInventoryButton").setAttribute("style","display:none;");

	var disableForAvatarElements = document.getElementsByClassName("disableForAvatar");
	for (var i = 0; i < disableForAvatarElements.length; i++) {
		disableForAvatarElements[i].disabled = false;
	}
}

export function on_paint_sprite() { // navigate to sprites through the paint dialog
	var newIndex;
	if (sortedSpriteIdList().length > 1)
	{
		newIndex = 1;
	}
	else {
		newIndex = 0; //fall back to avatar if no other sprites exist
	}
	setSpriteIndex(newIndex);

	var spriteId = sortedSpriteIdList()[newIndex];
	setDrawing(sprite[spriteId]);

	paintTool.curDrawingFrameIndex = 0;
	paintTool.reloadDrawing();
	on_paint_sprite_ui_update();

	events.Raise("select_drawing", { id: drawing.id, type: drawing.type });
}

export function on_paint_sprite_ui_update() {
	console.log(spriteIndex, sortedSpriteIdList()[spriteIndex], drawing.id)

	document.getElementById("dialog").setAttribute("style","display:block;");
	document.getElementById("wall").setAttribute("style","display:none;");
	document.getElementById("animationOuter").setAttribute("style","display:block;");
	updateDrawingNameUI(true);
	//document.getElementById("animation").setAttribute("style","display:block;");
	document.getElementById("paintOptionSprite").checked = true;
	document.getElementById("showInventoryButton").setAttribute("style","display:none;");

	var disableForAvatarElements = document.getElementsByClassName("disableForAvatar");
	for (var i = 0; i < disableForAvatarElements.length; i++) {
		disableForAvatarElements[i].disabled = false;
	}
}

export function on_paint_item() {
	setItemIndex(0);
	var itemId = sortedItemIdList()[0];
	setDrawing(item[itemId]);

	paintTool.curDrawingFrameIndex = 0;
	paintTool.reloadDrawing();
	on_paint_item_ui_update();

	events.Raise("select_drawing", { id: drawing.id, type: drawing.type });
}

export function on_paint_item_ui_update() {
	document.getElementById("dialog").setAttribute("style","display:block;");
	document.getElementById("wall").setAttribute("style","display:none;");
	document.getElementById("animationOuter").setAttribute("style","display:block;");
	updateDrawingNameUI(true);
	//document.getElementById("animation").setAttribute("style","display:block;");
	document.getElementById("paintOptionItem").checked = true;
	document.getElementById("showInventoryButton").setAttribute("style","display:inline-block;");

	var disableForAvatarElements = document.getElementsByClassName("disableForAvatar");
	for (var i = 0; i < disableForAvatarElements.length; i++) {
		disableForAvatarElements[i].disabled = false;
	}
}

/* THUMBNAILS */
function createDrawingThumbnailRenderer(source) {
	var getRenderable = function(id) {
		return source[id];
	}

	var getHexPalette = function(drawing) {
		var palId = roomTool ? getRoomPal(roomTool.getSelected()) : getRoomPal(state.room);

		var hexPalette = [];
		var roomColors = getPal(palId);
		for (let i in roomColors) {
			var hexStr = rgbToHex(roomColors[i][0], roomColors[i][1], roomColors[i][2]).slice(1);
			hexPalette.push(hexStr);
		}

		return hexPalette;
	}

	var onRender = function(drawing, ctx, options) {
		var palId = getRoomPal(state.room);
		var renderFrames = [];

		if (drawing && drawing.id in source) {
			for (var i = 0; i < drawing.animation.frameCount; i++) {
				if (options.isAnimated || options.frameIndex === i) {
					var renderedImg = renderTileToCanvas(drawing, i);
					if (renderedImg) {
						ctx.drawImage(renderedImg, 0, 0, tilesize * scale, tilesize * scale);
						renderFrames.push(ctx.getImageData(0, 0, tilesize * scale, tilesize * scale).data);
					}
					else {
						bitsyLog("oh no! image render for thumbnail failed", "editor");
					}
				}
			}
		}

		return renderFrames;
	}

	return new ThumbnailRendererBase(getRenderable, getHexPalette, onRender);
}

export function createSpriteThumbnailRenderer() {
	return createDrawingThumbnailRenderer(sprite);
}

export function createTileThumbnailRenderer() {
	return createDrawingThumbnailRenderer(tile);
}

export function createItemThumbnailRenderer() {
	return createDrawingThumbnailRenderer(item);
}

var animationThumbnailRenderer = new ThumbnailRenderer(sprite);
function renderAnimationThumbnail(imgId, drawing, frameIndex) {
	animationThumbnailRenderer.Render(imgId, drawing, frameIndex);
}

export function renderAnimationPreview(drawing) {
	renderAnimationThumbnail("animationThumbnailPreview", drawing);
	renderAnimationThumbnail("animationThumbnailFrame1", drawing, 0);
	renderAnimationThumbnail("animationThumbnailFrame2", drawing, 1);
}

export function renderPaintThumbnail(drawing) {
	renderAnimationThumbnail("animationThumbnailPreview", drawing);
}

/* WALL / GRID TOGGLES */
export function togglePaintGrid(e) {
	paintTool.drawPaintGrid = e.target.checked;
	updatePaintGridCheck(paintTool.drawPaintGrid);
	paintTool.updateCanvas();
	setPanelSetting("paintPanel", "grid", paintTool.drawPaintGrid);
}

export function on_toggle_wall(e) {
	paintTool.toggleWall( e.target.checked );
}

export function toggleWallUI(checked) {
	iconUtils.LoadIcon(document.getElementById("wallCheckboxIcon"), checked ? "wall_on" : "wall_off");
}

/* ANIMATION EDITING */
export function on_toggle_animated() {
	bitsyLog("ON TOGGLE ANIMATED", "editor");
	bitsyLog(document.getElementById("animatedCheckbox").checked, "editor");
	bitsyLog(drawing.type, "editor");
	bitsyLog("~~~~~", "editor");
	if ( document.getElementById("animatedCheckbox").checked ) {
		if ( drawing.type === TileType.Sprite || drawing.type === TileType.Avatar ) {
			addSpriteAnimation();
		}
		else if ( drawing.type === TileType.Tile ) {
			addTileAnimation();
		}
		else if ( drawing.type === TileType.Item ) {
			addItemAnimation();
		}
		document.getElementById("animation").setAttribute("style","display:block;");
		iconUtils.LoadIcon(document.getElementById("animatedCheckboxIcon"), "expand_more");
		bitsyLog(drawing.id, "editor");
		renderAnimationPreview(drawing);
	}
	else {
		if ( drawing.type === TileType.Sprite || drawing.type === TileType.Avatar ) {
			removeSpriteAnimation();
		}
		else if ( drawing.type === TileType.Tile ) {
			removeTileAnimation();
		}
		else if ( drawing.type === TileType.Item ) {
			bitsyLog("REMOVE ITEM ANIMATION", "editor");
			removeItemAnimation();
		}
		document.getElementById("animation").setAttribute("style","display:none;");
		iconUtils.LoadIcon(document.getElementById("animatedCheckboxIcon"), "expand_less");
	}
}

export function addSpriteAnimation() {
	//set editor mode
	paintTool.isCurDrawingAnimated = true;
	paintTool.curDrawingFrameIndex = 0;

	//mark sprite as animated
	sprite[drawing.id].animation.isAnimated = true;
	sprite[drawing.id].animation.frameIndex = 0;
	sprite[drawing.id].animation.frameCount = 2;

	//add blank frame to sprite (or restore removed animation)
	var spriteImageId = "SPR_" + drawing.id;

	if (sprite[drawing.id].cachedAnimation && sprite[drawing.id].cachedAnimation.length >= 1) {
		addDrawingAnimation(spriteImageId, sprite[drawing.id].cachedAnimation[0]);
	}
	else {
		addDrawingAnimation(spriteImageId);
	}

	// refresh images
	renderer.ClearCache();

	//refresh data model
	refreshGameData('paint sprite');
	paintTool.reloadDrawing();

	// reset animations
	resetAllAnimations();
}

export function removeSpriteAnimation() {
	//set editor mode
	paintTool.isCurDrawingAnimated = false;

	//mark sprite as non-animated
	sprite[drawing.id].animation.isAnimated = false;
	sprite[drawing.id].animation.frameIndex = 0;
	sprite[drawing.id].animation.frameCount = 0;

	//remove all but the first frame of the sprite
	var spriteImageId = "SPR_" + drawing.id;
	cacheDrawingAnimation( sprite[drawing.id], spriteImageId );
	removeDrawingAnimation( spriteImageId );

	// refresh images
	renderer.ClearCache();

	//refresh data model
	refreshGameData('paint sprite');
	paintTool.reloadDrawing();

	// reset animations
	resetAllAnimations();
}

export function addTileAnimation() {
	//set editor mode
	paintTool.isCurDrawingAnimated = true;
	paintTool.curDrawingFrameIndex = 0;

	//mark tile as animated
	tile[drawing.id].animation.isAnimated = true;
	tile[drawing.id].animation.frameIndex = 0;
	tile[drawing.id].animation.frameCount = 2;

	//add blank frame to tile (or restore removed animation)
	var tileImageId = "TIL_" + drawing.id;
	if (tile[drawing.id].cachedAnimation && tile[drawing.id].cachedAnimation.length >= 1) {
		addDrawingAnimation(tileImageId, tile[drawing.id].cachedAnimation[0]);
	}
	else {
		addDrawingAnimation(tileImageId);
	}

	// refresh images
	renderer.ClearCache();

	//refresh data model
	refreshGameData('paint tile');
	paintTool.reloadDrawing();

	// reset animations
	resetAllAnimations();
}

export function removeTileAnimation() {
	//set editor mode
	paintTool.isCurDrawingAnimated = false;

	//mark tile as non-animated
	tile[drawing.id].animation.isAnimated = false;
	tile[drawing.id].animation.frameIndex = 0;
	tile[drawing.id].animation.frameCount = 0;

	//remove all but the first frame of the tile
	var tileImageId = "TIL_" + drawing.id;
	cacheDrawingAnimation( tile[drawing.id], tileImageId );
	removeDrawingAnimation( tileImageId );

	// refresh images
	renderer.ClearCache();

	//refresh data model
	refreshGameData('paint tile');
	paintTool.reloadDrawing();

	// reset animations
	resetAllAnimations();
}

// TODO : so much duplication it makes me sad :(
function addItemAnimation() {
	//set editor mode
	paintTool.isCurDrawingAnimated = true;
	paintTool.curDrawingFrameIndex = 0;

	//mark item as animated
	item[drawing.id].animation.isAnimated = true;
	item[drawing.id].animation.frameIndex = 0;
	item[drawing.id].animation.frameCount = 2;

	//add blank frame to item (or restore removed animation)
	var itemImageId = "ITM_" + drawing.id;
	if (item[drawing.id].cachedAnimation && item[drawing.id].cachedAnimation.length >= 1) {
		addDrawingAnimation(itemImageId, item[drawing.id].cachedAnimation[0]);
	}
	else {
		addDrawingAnimation(itemImageId);
	}

	// refresh images
	renderer.ClearCache();

	//refresh data model
	refreshGameData('paint item');
	paintTool.reloadDrawing();

	// reset animations
	resetAllAnimations();
}

export function removeItemAnimation() {
	//set editor mode
	paintTool.isCurDrawingAnimated = false;

	//mark item as non-animated
	item[drawing.id].animation.isAnimated = false;
	item[drawing.id].animation.frameIndex = 0;
	item[drawing.id].animation.frameCount = 0;

	//remove all but the first frame of the item
	var itemImageId = "ITM_" + drawing.id;
	cacheDrawingAnimation( item[drawing.id], itemImageId );
	removeDrawingAnimation( itemImageId );

	// refresh images
	renderer.ClearCache();

	//refresh data model (TODO : these should really be a shared method)
	refreshGameData('paint item');
	paintTool.reloadDrawing();

	// reset animations
	resetAllAnimations();
}

export function addDrawingAnimation(drwId, frameData) {
	var drawingSource = renderer.GetDrawingSource(drwId);

	if (!frameData) {
		var firstFrame = drawingSource[0];

		// copy first frame data into second frame
		frameData = [];
		for (var y = 0; y < tilesize; y++) {
			frameData.push([]);
			for (var x = 0; x < tilesize; x++) {
				frameData[y].push(firstFrame[y][x]);
			}
		}
	}

	drawingSource[1] = frameData;

	renderer.SetDrawingSource(drwId, drawingSource);
}

export function removeDrawingAnimation(drwId) {
	var drawingData = renderer.GetDrawingSource(drwId);
	var oldDrawingData = drawingData.slice(0);
	renderer.SetDrawingSource(drwId, [oldDrawingData[0]]);
}

// let's us restore the animation during the session if the user wants it back
function cacheDrawingAnimation(drawing, sourceId) {
	var drawingData = renderer.GetDrawingSource(sourceId);
	var oldDrawingData = drawingData.slice(0);
	drawing.cachedAnimation = [oldDrawingData[1]]; // ah the joys of javascript
}

export function on_paint_frame1() {
	paintTool.curDrawingFrameIndex = 0;
	paintTool.reloadDrawing();
}

export function on_paint_frame2() {
	paintTool.curDrawingFrameIndex = 1;
	paintTool.reloadDrawing();
}
