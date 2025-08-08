import { TileType, labelElementFactory, rgbToHex, rgbToHsl, getDrawingNameOrDescription } from "./util.js"
import { initSystem, bitsyLog, tilesize, scale, mapsize, width, attachCanvas, loadGame, quitGame } from "./system/system.js"
import { Resources } from "./generated/resources.js"

import { clearGameData, getPal, getRoomPal, animationTime, initRoom,
	curDefaultPal, sprite, tile, room, item, renderer, state, dialog, palette, flags,
	setInventoryCallback, setVariableCallback, setGameResetCallback, setInitRoomCallback, textDirection,
	loadWorldFromGameData, serializeWorld, updateNamesFromCurData } from "./engine/bitsy.js"
import { titleDialogId, version, defaultFontName,
	createDrawingData, createExitData, createEndingData} from "./engine/world.js"

import { gif } from "./gif.js"
import { Exporter } from "./exporter.js"
import { ThumbnailRenderer, ThumbnailRendererBase, renderTileToCanvas } from "./thumbnail.js"
import { Store }  from "./store.js"
import { updateInventoryUI } from "./inventory.js"

import { bindToolDialogs, testShim } from "../index.js"

import { FindTool } from "./find.js"
import { DialogTool } from "./dialog_editor.js"
import { PaintTool, updatePaintGridCheck } from "./paint.js"
import { ColorPicker } from "./color_picker.js"
import { RoomMarkerTool } from "./room_markers.js"
import { PaletteTool } from "./palette.js"

import { makeRoomTool } from "./tools/room.js"
import { makeGameTool } from "./tools/game.js"
import { makeTuneTool } from "./tools/tune.js"
import { makeBlipTool } from "./tools/blip.js"

import { setAboutPage, initAbout } from "./tools/about.js" // FIXME
import { localization, readUrlParameters, iconUtils, fontManager,
	events, getPanelPrefs, showPanel, updatePanelPrefs, togglePanel, togglePanelCore } from "./editor_state.js"

import { attachServer, updateText } from "./system/multiplayer.js" // FIXME

/* MODES */
var EditMode = {
	Edit : 0,
	Play : 1
};
var EditorInputMode = {
	Mouse : 0,
	Touch : 1
};
export var curEditorInputMode = EditorInputMode.Mouse;

export function showAbout(pagePath, insertNextToId) {
	setAboutPage(pagePath);
	showPanel("aboutPanel", insertNextToId);
}

// todo : rename function
export function getDrawingImageSource(drawing) {
	return renderer.GetDrawingSource(drawing.drw);
}

export function getDrawingFrameData(drawing, frameIndex) {
	var imageSource = getDrawingImageSource(drawing);
	return imageSource[frameIndex];
}

/* UNIQUE ID METHODS */
// TODO - lots of duplicated code around stuff (ex: all these things with IDs)
export function nextTileId() {
	return nextObjectId( sortedTileIdList() );
}

export function nextSpriteId() {
	return nextObjectId( sortedSpriteIdList() );
}

export function nextItemId() {
	return nextObjectId( sortedItemIdList() );
}

export function nextRoomId() {
	return nextObjectId( sortedRoomIdList() );
}

export function nextPaletteId() {
	return nextObjectId( sortedPaletteIdList() );
}

export function nextObjectId(idList) {
	if (idList.length <= 0) {
		return "0";
	}

	var lastId = idList[ idList.length - 1 ];
	var idInt = parseInt( lastId, 36 );
	idInt++;
	return idInt.toString(36);
}

export function sortedTileIdList() {
	return sortedBase36IdList( tile );
}

export function sortedSpriteIdList() {
	return sortedBase36IdList( sprite );
}

export function sortedItemIdList() {
	return sortedBase36IdList( item );
}

export function sortedRoomIdList() {
	return sortedBase36IdList( room );
}

export function sortedDialogIdList() {
	var keyList = Object.keys(dialog);
	keyList.splice(keyList.indexOf("title"), 1);
	var keyObj = {};
	for (var i = 0; i < keyList.length; i++) {
		keyObj[keyList[i]] = {};
	}

	return sortedBase36IdList(keyObj);
}

export function sortedPaletteIdList() {
	var keyList = Object.keys(palette);
	keyList.splice(keyList.indexOf("default"), 1);
	var keyObj = {};
	for (var i = 0; i < keyList.length; i++) {
		keyObj[keyList[i]] = {};
	}

	return sortedBase36IdList(keyObj);
}

export function sortedBase36IdList( objHolder ) {
	return Object.keys( objHolder ).sort( function(a,b) { return parseInt(a,36) - parseInt(b,36); } );
}

export function nextAvailableDialogId(prefix) {
	return nextObjectId(sortedDialogIdList());
}

export function nextObjectHexId(idList) {
	if (idList.length <= 0) {
		return "0";
	}

	var lastId = idList[ idList.length - 1 ];
	var idInt = safeParseHex(lastId);
	idInt++;
	return idInt.toString(16);
}

export function sortedHexIdList(objHolder) {
	var objectKeys = Object.keys(objHolder);

	var hexSortFunc = function(key1,key2) {
		return safeParseHex(key1,16) - safeParseHex(key2,16);
	};
	var hexSortedIds = objectKeys.sort(hexSortFunc);

	return hexSortedIds;
}

export function safeParseHex(str) {
	var hexInt = parseInt(str,16);
	if (hexInt == undefined || hexInt == null || isNaN(hexInt)) {
		return -1;
	}
	else {
		return hexInt;
	}
}

/* UTILS */
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

/* EVENTS */
export function on_change_title(e) {
	setTitle(e.target.value);
	refreshGameData();

	// make sure all editors with a title know to update
	events.Raise("dialog_update", { dialogId:titleDialogId, editorId:null });
}

/* MOBILE */
export function mobileOffsetCorrection(off,e,innerSize) {
	var bounds = e.target.getBoundingClientRect();

	// var width = bounds.width * containerRatio;
	// var height = bounds.height * containerRatio;

	// correction for square canvas contained in rect
	if( bounds.width > bounds.height ) {
		off.x -= (bounds.width - bounds.height) / 2;
	}
	else if( bounds.height > bounds.width ) {
		off.y -= (bounds.height - bounds.width) / 2;
	}

	// bitsyLog(off, "editor");

	// convert container size to internal canvas size
	var containerRatio = innerSize / Math.min( bounds.width, bounds.height );

	// bitsyLog(containerRatio, "editor");

	off.x *= containerRatio;
	off.y *= containerRatio;

	// bitsyLog(off, "editor");

	return off;
}

// todo : seems like this could be used several places...
// todo : localize
function tileTypeToString(type) {
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

/* DIALOG UI 
- hacky to make this all global
- some of this should be folded into paint tool later
*/
export let dialogTool = null; // initialization moved to start\0
export let curDialogEditorId = null; // can I wrap this all up somewhere? -- feels a bit hacky to have all these globals
export let curDialogEditor = null;
export let curPlaintextDialogEditor = null; // the duplication is a bit weird, but better than recreating editors all the time?

export function openDialogTool(dialogId, insertNextToId, showIfHidden) { // todo : rename since it doesn't always "open" it?
	// console.log(new Error("who opened the dialog tool?"))

	if (showIfHidden === undefined || showIfHidden === null) {
		showIfHidden = true;
	}

	document.getElementById("deleteDialogButton").disabled = dialogId === titleDialogId;

	var showCode = document.getElementById("dialogShowCodeCheck").checked;

	// clean up any existing editors -- is there a more "automagical" way to do this???
	if (curDialogEditor) {
		curDialogEditor.OnDestroy();
		curDialogEditor = null;
	}

	if (curPlaintextDialogEditor) {
		curPlaintextDialogEditor.OnDestroy();
		curPlaintextDialogEditor = null;
	}
	

	curDialogEditorId = dialogId;
	curDialogEditor = dialogTool.CreateEditor(dialogId);
	curPlaintextDialogEditor = dialogTool.CreatePlaintextEditor(dialogId, "largeDialogPlaintextArea");

	var dialogEditorViewport = document.getElementById("dialogEditor");
	dialogEditorViewport.innerHTML = "";

	if (showCode) {
		dialogEditorViewport.appendChild(curPlaintextDialogEditor.GetElement());
	}
	else {
		dialogEditorViewport.appendChild(curDialogEditor.GetElement());
	}

	document.getElementById("dialogName").placeholder = "dialog " + dialogId;
	if (dialogId === titleDialogId) {
		document.getElementById("dialogName").readOnly = true;
		document.getElementById("dialogName").value = titleDialogId;
	}
	else {
		document.getElementById("dialogName").readOnly = false;
		if (dialog[dialogId].name != null) {
			document.getElementById("dialogName").value = dialog[dialogId].name;
		}
		else {
			document.getElementById("dialogName").value = "";
		}
	}

	var isHiddenOrShouldMove = (document.getElementById("dialogPanel").style.display === "none") ||
		(insertNextToId != undefined && insertNextToId != null);

	if (isHiddenOrShouldMove && showIfHidden) {
		bitsyLog("insert next to : " + insertNextToId, "editor");
		showPanel("dialogPanel", insertNextToId);
	}

	events.Raise("select_dialog", { id: curDialogEditorId });
}

// TODO : probably this should be incorporated into the dialog editor main code somehow
export function onDialogNameChange(event) {
	if (event.target.value != null && event.target.value.length > 0) {
		dialog[curDialogEditorId].name = event.target.value;
	}
	else {
		dialog[curDialogEditorId].name = null;
	}
	refreshGameData();
}

export function nextDialog() {
	var id = titleDialogId; // the title is safe as a default choice

	if (curDialogEditorId != null) {
		var dialogIdList = sortedDialogIdList();
		var dialogIndex = dialogIdList.indexOf(curDialogEditorId);

		// pick the index of the next dialog to open
		dialogIndex++;
		if (dialogIndex >= dialogIdList.length) {
			dialogIndex = -1; // hacky: I'm using -1 to denote the title
		}

		// turn the index into an ID
		if (dialogIndex < 0) {
			id = titleDialogId;
		}
		else {
			id = dialogIdList[dialogIndex];
		}
	}

	openDialogTool(id);

	alwaysShowDrawingDialog = document.getElementById("dialogAlwaysShowDrawingCheck").checked = false;
}

export function prevDialog() {
	var id = titleDialogId; // the title is safe as a default choice

	if (curDialogEditorId != null) {
		var dialogIdList = sortedDialogIdList();
		var dialogIndex = dialogIdList.indexOf(curDialogEditorId);

		// pick the index of the next dialog to open
		if (dialogIndex === -1) {
			dialogIndex = dialogIdList.length - 1;
		}
		else {
			dialogIndex--;
		}

		// turn the index into an ID
		if (dialogIndex < 0) {
			id = titleDialogId;
		}
		else {
			id = dialogIdList[dialogIndex];
		}
	}

	bitsyLog("PREV DIALOG " + id, "editor");

	openDialogTool(id);

	alwaysShowDrawingDialog = document.getElementById("dialogAlwaysShowDrawingCheck").checked = false;
}

export function addNewDialog() {
	var id = nextAvailableDialogId();

	dialog[id] = { src:" ", name:null };
	refreshGameData();

	openDialogTool(id);

	events.Raise("new_dialog", { id:id });

	alwaysShowDrawingDialog = document.getElementById("dialogAlwaysShowDrawingCheck").checked = false;
}

export function duplicateDialog() {
	if (curDialogEditorId != null) {
		var id = nextAvailableDialogId();
		dialog[id] = { src: dialog[curDialogEditorId].src.slice(), name: null, id: id, };
		refreshGameData();

		openDialogTool(id);

		alwaysShowDrawingDialog = document.getElementById("dialogAlwaysShowDrawingCheck").checked = false;
	}
}

export function deleteDialog() {
	var shouldDelete = confirm("Are you sure you want to delete this dialog?");

	if (shouldDelete && curDialogEditorId != null && curDialogEditorId != titleDialogId) {
		var tempDialogId = curDialogEditorId;

		nextDialog();

		// delete all references to deleted dialog (TODO : should this go in a wrapper function somewhere?)
		for (let id in sprite) {
			if (sprite[id].dlg === tempDialogId) {
				sprite[id].dlg = null;
			}
		}

		for (let id in item) {
			if (item[id].dlg === tempDialogId) {
				item[id].dlg = null;
			}
		}

		for (let id in room) {
			for (var i = 0; i < room[id].exits.length; i++) {
				var exit = room[id].exits[i];
				if (exit.dlg === tempDialogId) {
					exit.dlg = null;
				}
			}

			for (var i = 0; i < room[id].endings.length; i++) {
				var end = room[id].endings[i];
				if (end.id === tempDialogId) {
					room[id].endings.splice(i, 1);
					i--;
				}
			}
		}

		delete dialog[tempDialogId];
		refreshGameData();

		alwaysShowDrawingDialog = document.getElementById("dialogAlwaysShowDrawingCheck").checked = false;

		events.Raise("dialog_delete", { dialogId:tempDialogId, editorId:null });
	}
}

// TODO : move into the paint tool
var paintDialogWidget = null;
function reloadDialogUI() {
	var dialogContent = document.getElementById("dialog");
	dialogContent.innerHTML = "";

	var obj = drawing;

	// clean up previous widget
	if (paintDialogWidget) {
		paintDialogWidget.OnDestroy();
		paintDialogWidget = null;
	}

	paintDialogWidget = dialogTool.CreateWidget(
		localization.GetStringOrFallback("dialog_tool_name", "dialog"),
		"paintPanel",
		obj.dlg,
		true,
		function(id) {
			obj.dlg = id;
		},
		{
			CreateFromEmptyTextBox: true,
			OnCreateNewDialog: function(id) {
				obj.dlg = id;
				refreshGameData();
			},
			GetDefaultName: function() {
				var desc = getDrawingNameOrDescription(drawing);
				return CreateDefaultName(desc + " dialog", dialog, true); // todo : localize
			}, // todo : localize
		});
	dialogContent.appendChild(paintDialogWidget.GetElement());

	if (alwaysShowDrawingDialog && dialog[obj.dlg]) {
		openDialogTool(obj.dlg, null, false);
	}
}

// hacky - assumes global paintTool object
export function getCurDialogId() {
	return getDrawingDialogId(drawing);
}

export function setDefaultGameState() {
	// initialize game with default data
	var defaultData = Resources["defaultGameData.bitsy"];
	Store.set("game_data", defaultData);

	// reset game state
	clearGameData();

	// load the game
	var gamedataStorage = Store.get("game_data");
	loadWorldFromGameData(gamedataStorage); // load game

	// refresh images
	renderer.ClearCache();
}

export let isPlayMode = false;
export async function refreshGameData() {
	if (isPlayMode) {
		return; //never store game data while in playmode (TODO: wouldn't be necessary if the game data was decoupled from editor data)
	}

	flags.ROOM_FORMAT = 1; // always save out comma separated format, even if the old format is read in

	var gameDataNoFonts = serializeWorld(true);
	server.handle.change((doc) => { updateText(doc, ["bitsy"], gameDataNoFonts) });
	// Store.set("game_data", gameDataNoFonts); // autosave triggered by change listener

	// make sure to update the game tool!
	// this ensures the game data text is up-to-date
	// TODO : this is kind of a hack and it undoes any scrolling the game data textarea
	// I should look into a better solution soon (some kind of file-watching-like concept?)
	if (gameTool) {
		gameTool.menu.update();
	}
}

/* TIMER */
function Timer() {
	var start = Date.now();

	this.Seconds = function() {
		return Math.floor( (Date.now() - start) / 1000 );
	}

	this.Milliseconds = function() {
		return Date.now() - start;
	}
}

var editMode = EditMode.Edit; // TODO : move to core.js?

/* TOOL CONTROLLERS */
export let roomTool;
export let paintTool;

/* CUR DRAWING */
export let drawing;

var tileIndex = 0;
var spriteIndex = 0;
var itemIndex = 0;
export function setTileIndex(idx) { tileIndex = idx; }
export function setSpriteIndex(idx) { spriteIndex = idx; }
export function setItemIndex(idx) { itemIndex = idx; }

/* ROOM */
var roomIndex = 0;

/* BROWSER COMPATIBILITY */
var browserFeatures = {
	colorPicker : false,
	fileDownload : false,
	blobURL : false
};

/* SCREEN CAPTURE */
var gifencoder = new gif();
var gifFrameData = [];

/* EXPORT HTML */
var makeURL = null;
var exporter = new Exporter();

function detectBrowserFeatures() {
	bitsyLog("BROWSER FEATURES", "editor");
	//test feature support
	try {
		var input = document.createElement("input");
		input.type = "color";
		document.body.appendChild(input);

		if (input.type === "color") {
			bitsyLog("color picker supported!", "editor");
			browserFeatures.colorPicker = true;
		} else {
			browserFeatures.colorPicker = false;
		}

		if(input.offsetWidth <= 10 && input.offsetHeight <= 10) {
			// bitsyLog(input.clientWidth, "editor");
			bitsyLog("WEIRD SAFARI COLOR PICKER IS BAD!", "editor");
			browserFeatures.colorPicker = false;
			document.getElementById("pageColor").type = "text";
		}
		
		document.body.removeChild(input);
	} catch(e) {
		browserFeatures.colorPicker = false;
	}

	var a = document.createElement('a');
	if (typeof a.download != "undefined") {
		bitsyLog("downloads supported!", "editor");
		browserFeatures.fileDownload = true;
	}
	else {
		browserFeatures.fileDownload = false;
	}

	browserFeatures.blobURL = (!!new Blob) && (URL != undefined || webkitURL != undefined);
	if( browserFeatures.blobURL ) {
		bitsyLog("blob supported!", "editor");
		makeURL = URL || webkitURL;
	}
}

export function isPortraitOrientation() {
	var isPortrait = false;

	if (window.screen.orientation != undefined) {
		// most browsers
		isPortrait = window.screen.orientation.type.includes("portrait");
	}
	else if (window.orientation != undefined) {
		// iOS safari
		isPortrait = window.orientation == 0 || window.orientation == 180;
	}

	return isPortrait;
}

export let findTool
export function resetFindTool() {
	findTool = new FindTool(iconUtils, {
		mainElement : document.getElementById("findPanelMain"),
	});
}

export let server
export async function start() {
	initSystem();

	// TODO : I need to get rid of this event system... it's too hard to debug
	events.Listen("game_data_change", function(event) {
		// TODO : refactor "openDialogTool" to split out the actual opening from reloading
		// force re-load the dialog tool
		openDialogTool(titleDialogId, /*insertNextToId*/ null, /*showIfHidden*/ false);
	});
	detectBrowserFeatures();

	// enable multiplayer editing
	server = await attachServer(true)
	let handle = server.handle

	readUrlParameters();

	// localization = new Localization(urlParameters["lang"]); // FIXME: no longer have to do this upstream in editor_state b/c find tool depends on it
	dialogTool = new DialogTool(localization, sortedDialogIdList)

	Store.init(function () {
		// TODO: localize
		window.alert('A storage error occurred: The editor will continue to work, but data may not be saved/loaded. Make sure to export a local copy after making changes, or your gamedata may be lost!');
	});

	// load custom font
	var fontStorage = Store.get('custom_font');
	if (fontStorage) {
		fontManager.AddResource(fontStorage.name + ".bitsyfont", fontStorage.fontdata);
	}

	//load last auto-save
	var gamedataStorage = handle.doc().bitsy;
	if (gamedataStorage !== null) {
		Store.set("game_data", gamedataStorage)
		on_game_data_change_core();
	}
	else if (Store.get("game_data"))  {
		on_game_data_change_core();
	}
	else {
		setDefaultGameState();
		drawing = sprite["A"]; // will this break?
	}
	
    // listen to multiplayer server
    handle.on("change", () => {
		console.log('sync crdt')

		var gamedataChanged = handle.doc().bitsy;
        Store.set("game_data", gamedataChanged)

		on_game_data_change_core()
		// reload_game_data(); // causes flicker
    })

	// now world data like `sprite` and `tile` is loaded
	// let's make the find tool so that tool cards can use it
	resetFindTool();

	// ROOM TOOL
	roomTool = makeRoomTool(localization, showPanel);
	roomTool.rootElement.classList.add("bitsy-playmode-enable");
	roomTool.titlebarElement.classList.add("bitsy-playmode-reverse-color");
	roomTool.nav.element.classList.add("bitsy-playmode-hide");
	var curRoomLocationDiv = document.createElement("div");
	curRoomLocationDiv.id = "curRoomLocation";
	curRoomLocationDiv.classList.add("bitsy-playmode-show");
	curRoomLocationDiv.classList.add("bitsy-playmode-room-location");
	roomTool.mainElement.insertBefore(curRoomLocationDiv, roomTool.canvasElement);

	paintTool = new PaintTool(document.getElementById("paint"), document.getElementById("newPaintMenu"));
	bitsyLog("PAINT TOOL " + paintTool, "editor")
	paintTool.onReloadTile = function(){ reloadTile() };
	paintTool.onReloadSprite = function(){ reloadSprite() };
	paintTool.onReloadItem = function(){ reloadItem() };
	window.paintTool = paintTool

	markerTool = new RoomMarkerTool(document.getElementById("markerCanvas1"), document.getElementById("markerCanvas2") );
	bitsyLog("MARKER TOOL " + markerTool, "editor");
	window.markerTool = markerTool

	roomIndex = sortedRoomIdList().indexOf(state.room);

	//draw everything
	on_paint_avatar();
	paintTool.updateCanvas();
	markerTool.Refresh();

	document.getElementById("inventoryOptionItem").checked = true; // a bit hacky
	updateInventoryUI(localization);

	// init color picker
	colorPicker = new ColorPicker('colorPickerWheel', 'colorPickerSelect', 'colorPickerSliderThumb', 'colorPickerSliderBg', 'colorPickerHexText');
	document.getElementById("colorPaletteOptionBackground").checked = true;
	paletteTool = new PaletteTool(colorPicker,["colorPaletteLabelBackground", "colorPaletteLabelTile", "colorPaletteLabelSprite"],"paletteName");
	events.Listen("palette_change", function(event) {
		refreshGameData();
	});
	events.Listen("palette_list_change", function(event) {
		refreshGameData();
	});

	if (!browserFeatures.fileDownload) {
		document.getElementById("downloadHelp").style.display = "block";
	}

	// gif recording init (should this go in its own file?)
	gifCaptureCanvas = document.createElement("canvas");
	gifCaptureCanvas.width = width * scale;
	gifCaptureCanvas.height = width * scale;
	gifCaptureCtx = gifCaptureCanvas.getContext("2d");

	setInventoryCallback(function(id) {
		updateInventoryUI(localization);
	
		// animate to draw attention to change
		document.getElementById("inventoryItem_" + id).classList.add("flash");
		setTimeout(
			function() {
				// reset animations
				document.getElementById("inventoryItem_" + id).classList.remove("flash");
			},
			400
		);
	});

	setVariableCallback(function(id) {
		updateInventoryUI(localization);
	
		// animate to draw attention to change
		document.getElementById("inventoryVariable_" + id).classList.add("flash");
		setTimeout(
			function() {
				// reset animations
				document.getElementById("inventoryVariable_" + id).classList.remove("flash");
			},
			400
		);
	});

	setGameResetCallback(function() {
		updateInventoryUI(localization);
	});

	setInitRoomCallback(function(id) {
		var name = "";

		// basically copied from find tool
		if (room[id].name) {
			name = room[id].name;
		}
		else {
			name = localization.GetStringOrFallback("room_label", "room") + " " + id;
		}

		if (roomTool && isPlayMode) {
			var curRoomLocationDiv = document.getElementById("curRoomLocation");
			curRoomLocationDiv.innerHTML = "";
			curRoomLocationDiv.appendChild(labelElementFactory(iconUtils)({
				icon: "set_exit_location",
				text: name
			}));
		}
	});

	// save latest version used by editor (for compatibility)
	Store.set('engine_version', version);

	// create title widgets
	var titleTextWidgets = document.getElementsByClassName("titleWidgetContainer");
	for (var i = 0; i < titleTextWidgets.length; i++) {
		var widget = dialogTool.CreateTitleWidget();
		titleTextWidgets[i].appendChild(widget.GetElement());
	}

	// prepare dialog tool
	openDialogTool(titleDialogId, undefined, false); // start with the title open
	alwaysShowDrawingDialog = document.getElementById("dialogAlwaysShowDrawingCheck").checked;

	// hack: reload drawing after find tool is created, so the blip dropdown is up-to-date
	paintTool.reloadDrawing();

	// attach engine to room tool canvas for play mode
	attachCanvas(roomTool.canvasElement);

	// sound tools
	tuneTool = makeTuneTool();
	blipTool = makeBlipTool();

	// load panel preferences
	var prefs = getPanelPrefs();
	Store.set('panel_prefs', prefs); // save loaded prefs
	var sortedWorkspace = prefs.workspace.sort( function(a,b) { return a.position - b.position; } );
	var editorContent = document.getElementById("editorContent");
	for(i in sortedWorkspace) {
		var panelSettings = sortedWorkspace[i];
		var panelElement = document.getElementById(panelSettings.id);
		if (panelElement != undefined && panelElement != null) {
			togglePanelCore( panelSettings.id, panelSettings.visible, false /*doUpdatePrefs*/ );
			editorContent.insertBefore( panelElement, null ); //insert on the left
		}
	}

	// game tool
	gameTool = makeGameTool(localization);
	// debug helper
	testShim(gameTool);

	// onclick handlers
	bindToolDialogs();
	// about tool
	initAbout();
}

export function newDrawing() {
	paintTool.newDrawing();
}

export function nextTile() {
	var ids = sortedTileIdList();
	tileIndex = (tileIndex + 1) % ids.length;

	var tileId = ids[tileIndex];
	drawing = tile[tileId];

	paintTool.curDrawingFrameIndex = 0;
	paintTool.reloadDrawing();
}

export function prevTile() {
	var ids = sortedTileIdList();

	tileIndex = (tileIndex - 1) % ids.length;
	if (tileIndex < 0) {
		tileIndex = (ids.length - 1);
	}

	var tileId = ids[tileIndex];
	drawing = tile[tileId];

	paintTool.curDrawingFrameIndex = 0;
	paintTool.reloadDrawing();
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

	refreshGameData();
	bitsyLog(names, "editor");
}

export function on_palette_name_change(event) {
	paletteTool.ChangeSelectedPaletteName(event.target.value);
}

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

export function nextItem() {
	var ids = sortedItemIdList();
	itemIndex = (itemIndex + 1) % ids.length;

	var itemId = ids[itemIndex];
	drawing = item[itemId];

	paintTool.curDrawingFrameIndex = 0;
	paintTool.reloadDrawing();
}

export function prevItem() {
	var ids = sortedItemIdList();

	itemIndex = (itemIndex - 1) % ids.length;
	if (itemIndex < 0) {
		itemIndex = (ids.length - 1); // loop
	}

	var itemId = ids[itemIndex];
	drawing = item[itemId];

	paintTool.curDrawingFrameIndex = 0;
	paintTool.reloadDrawing();
}

export function nextSprite() {
	var ids = sortedSpriteIdList();

	spriteIndex = (spriteIndex + 1) % ids.length;
	if (spriteIndex === 0) {
		spriteIndex = 1; //skip avatar
	}

	var spriteId = ids[spriteIndex];
	drawing = sprite[spriteId];

	paintTool.curDrawingFrameIndex = 0;
	paintTool.reloadDrawing();
}

export function prevSprite() {
	var ids = sortedSpriteIdList();

	spriteIndex = (spriteIndex - 1) % ids.length;
	if (spriteIndex <= 0) {
		spriteIndex = (ids.length - 1); //loop and skip avatar
	}

	var spriteId = ids[spriteIndex];
	drawing = sprite[spriteId];

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

export function updateAnimationUI() {
	//todo
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
function reloadItem() {
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

export function deleteDrawing() {
	paintTool.deleteDrawing();
	events.Raise("select_drawing", { id: drawing.id, type: drawing.type });
}

export function toggleToolBar(e) {
	if (e.target.checked) {
		document.getElementById("toolsPanel").style.display = "flex";
		document.getElementById("appRoot").classList.add("bitsy-toolbar-open");
	}
	else {
		document.getElementById("toolsPanel").style.display = "none";
		document.getElementById("appRoot").classList.remove("bitsy-toolbar-open");
	}
}

export function toggleDownloadOptions(e) {
	if( e.target.checked ) {
		document.getElementById("downloadOptions").style.display = "block";
		iconUtils.LoadIcon(document.getElementById("downloadOptionsCheckIcon"), "expand_more");
	}
	else {
		document.getElementById("downloadOptions").style.display = "none";
		iconUtils.LoadIcon(document.getElementById("downloadOptionsCheckIcon"), "expand_less");
	}
}

export function togglePlayMode(e) {
	if (e.target.checked) {
		on_play_mode();
	}
	else {
		on_edit_mode();
	}

	updatePlayModeButton();
}

export function on_play_mode() {
	isPlayMode = true;

	if (document.getElementById("roomPanel").style.display === "none") {
		showPanel("roomPanel");
	}
	else {
		document.getElementById("roomPanel").scrollIntoView();
	}

	roomTool.setTitlebar("play", "playing...");
	roomTool.system._active = false;
	roomTool.menu.update();

	document.getElementById("appRoot").classList.add("bitsy-playmode");

	// clear render cache(s)
	renderer.ClearCache();
	roomTool.renderer.ClearCache();

	// todo : I feel like I need to take a look at the font manager and simplify things there
	loadGame(roomTool.canvasElement, serializeWorld(), fontManager.GetData(defaultFontName));
}

export function on_edit_mode() {
	isPlayMode = false;

	document.getElementById("appRoot").classList.remove("bitsy-playmode");

	quitGame();

	// reparse world to reset any changes from gameplay
	var gamedataStorage = Store.get("game_data");
	loadWorldFromGameData(gamedataStorage);
	
	// clear render cache
	renderer.ClearCache();
	roomTool.renderer.ClearCache();

	state.room = sortedRoomIdList()[roomIndex]; //restore current room to pre-play state

	markerTool.RefreshKeepSelection();

	reloadDialogUI();

	updateInventoryUI(localization);

	if(isPreviewDialogMode) {
		isPreviewDialogMode = false;
		updatePreviewDialogButton();

		// TODO : rework dialog highlighting
		// for(var i = 0; i < advDialogUIComponents.length; i++) {
		// 	advDialogUIComponents[i].GetEl().classList.remove("highlighted");
		// }
	}

	// make sure global drawing object is from the current world data
	if (drawing.type === TileType.Tile) {
		drawing = tile[drawing.id];
	}
	else if (drawing.type === TileType.Avatar || drawing.type === TileType.Sprite) {
		drawing = sprite[drawing.id];
	}
	else if (drawing.type === TileType.Item) {
		drawing = item[drawing.id];
	}
	paintTool.reloadDrawing();

	roomTool.resetTitlebar();
	roomTool.system._active = true;
	roomTool.menu.update();

	events.Raise("on_edit_mode");
}

export function updatePlayModeButton() {
	document.getElementById("playModeCheck").checked = isPlayMode;
	iconUtils.LoadIcon(document.getElementById("playModeIcon"), isPlayMode ? "stop" : "play");

	var stopText = localization.GetStringOrFallback("stop_game", "stop");
	var playText = localization.GetStringOrFallback("play_game", "play");
	document.getElementById("playModeText").innerHTML = isPlayMode ? stopText : playText;
}

export function updatePreviewDialogButton() {
	// todo : remove?
}

export function togglePaintGrid(e) {
	paintTool.drawPaintGrid = e.target.checked;
	updatePaintGridCheck(paintTool.drawPaintGrid);
	paintTool.updateCanvas();
	setPanelSetting("paintPanel", "grid", paintTool.drawPaintGrid);
}

/* PALETTE STUFF */
export let colorPicker = null;
export let paletteTool = null;

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

export function roomPaletteChange(event) {
	var palId = event.target.value;
	room[state.room].pal = palId;

	// hacky?
	initRoom(state.room);

	refreshGameData();

	paintTool.updateCanvas();
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

export function on_paint_avatar() {
	spriteIndex = 0;
	drawing = sprite["A"];

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
	tileIndex = 0;
	var tileId = sortedTileIdList()[tileIndex];
	drawing = tile[tileId];

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

export function on_paint_sprite() {
	if (sortedSpriteIdList().length > 1)
	{
		spriteIndex = 1;
	}
	else {
		spriteIndex = 0; //fall back to avatar if no other sprites exist
	}

	var spriteId = sortedSpriteIdList()[spriteIndex];
	drawing = sprite[spriteId];

	paintTool.curDrawingFrameIndex = 0;
	paintTool.reloadDrawing();
	on_paint_sprite_ui_update();

	events.Raise("select_drawing", { id: drawing.id, type: drawing.type });
}

export function on_paint_sprite_ui_update() {
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
	itemIndex = 0;
	var itemId = sortedItemIdList()[itemIndex];
	drawing = item[itemId];

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

// todo : make better blip thumbnail renderer
export function createBlipThumbnailRenderer() {
	var getRenderable = function(id) {
		return blip[id];
	}

	var getHexPalette = function(blipObj) {
		var hexPalette = [];

		if (roomTool) {
			var colors = roomTool.world.palette["0"].colors;
			for (let i in colors) {
				var hexStr = rgbToHex(colors[i][0], colors[i][1], colors[i][2]).slice(1);
				hexPalette.push(hexStr);
			}
		}

		return hexPalette;
	}

	var onRender = function(blipObj, ctx, options) {
		var hexPalette = getHexPalette(blipObj);

		ctx.fillStyle = "#" + hexPalette[2];
		ctx.fillRect(0, 0, tilesize * scale, tilesize * scale);

		if (soundPlayer) {
			ctx.fillStyle = "#" + hexPalette[0];

			// draw waveform (copied from makeBlipTile())
			var blipSamples = soundPlayer.sampleBlip(blipObj, 8);
			for (var i = 0; i < blipSamples.frequencies.length; i++) {
				var freq = 1 + Math.floor(blipSamples.frequencies[i] * 4);
				for (var j = 0; j < freq; j++) {
					ctx.fillRect(i * scale, (3 - j) * scale, scale, scale);
					ctx.fillRect(i * scale, (4 + j) * scale, scale, scale);
				}
			}
		}

		return [ctx.getImageData(0, 0, tilesize * scale, tilesize * scale).data];
	}

	return new ThumbnailRendererBase(getRenderable, getHexPalette, onRender);
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

export function on_change_adv_dialog() {
	on_change_dialog();
}

export function reload_game_data() {
	// FIXME: why does palette revert?
	console.log(roomTool?.selectedId, getRoomPal(roomTool?.selectedId))

	// same as core, but doesn't reset editor state
	var gamedataStorage = Store.get("game_data");
	bitsyLog(gamedataStorage, "editor");
	
	clearGameData();
	loadWorldFromGameData(gamedataStorage);

	events.Raise("game_data_change");
	// refreshGameData();
}

export function on_game_data_change() {
	on_game_data_change_core();
	// refreshGameData();

	// reset find tool (a bit heavy handed?)
	resetFindTool();
}

export function on_game_data_change_core() {
	var gamedataStorage = Store.get("game_data");
	bitsyLog(gamedataStorage, "editor");

	let roomId = roomTool?.getSelectedId() || 0,  
		tuneId = tuneTool?.getSelectedId() || 0,
		blipId = blipTool?.getSelectedId() || 0
	clearGameData();

	// reparse world if user directly manipulates game data
	loadWorldFromGameData(gamedataStorage);

	if (roomTool) {
		roomTool.selectAtIndex(roomId);
	}
	if (tuneTool) {
		tuneTool.selectAtIndex(tuneId);
	}
	if (blipTool) {
		blipTool.selectAtIndex(blipId);
	}
	

	if (gameTool) {
		gameTool.menu.update();
	}
	if (markerTool) {
		markerTool.Refresh();
	}

	// FIXME: update the dialog tool (etc) without reloading DOM
	var curPaintMode = TileType.Avatar;
	if (drawing) {
		curPaintMode = drawing.type;
	}
 
	//fallback if there are no tiles, sprites, map
	// TODO : switch to using stored default file data (requires separated parser / game data code)
	if (Object.keys(sprite).length == 0) {
		makeSprite("A");
		sprite["A"].room = null;
		sprite["A"].x = -1;
		sprite["A"].y = -1;
	}
	if (Object.keys(tile).length == 0) {
		makeTile("a");
	}
	if (Object.keys(room).length == 0) {
		// TODO : ?
	}
	if (Object.keys(item).length == 0) {
		makeItem("0");
	}

	// refresh images
	renderer.ClearCache();

	// try not to clobber editor state
	// roomIndex = 0;

	if (curPaintMode === TileType.Tile) {
		drawing = tile[sortedTileIdList()[0]];
	}
	else if (curPaintMode === TileType.Item) {
		drawing = item[sortedItemIdList()[0]];
	}
	else if (curPaintMode === TileType.Avatar) {
		drawing = sprite["A"];
	}
	else if (curPaintMode === TileType.Sprite) {
		drawing = sprite[sortedSpriteIdList().filter(function (id) { return id != "A"; })[0]];
	}

	// paintTool.reloadDrawing(); // this reloads the dialog UI

	// FIXME: catch undefined fontName on startup
	// if user pasted in a custom font into game data - update the stored custom font
	/* if (defaultFonts.indexOf(fontName + fontManager.GetExtension()) == -1) {
		var fontStorage = {
			name : fontName,
			fontdata : fontManager.GetData(fontName)
		};
		Store.set('custom_font', fontStorage);
	} */

	updateInventoryUI(localization);

	// TODO -- start using this for more things
	// events.Raise("game_data_change"); // this event reloads all the panels, which we don't want
}

export function setDrawing(newDrawing) {
	drawing = newDrawing;
}

export function updateFontDescriptionUI() {
	for (var i in fontSelect.options) {
		var fontOption = fontSelect.options[i];
		var fontDescriptionId = fontOption.value + "_description";
		// bitsyLog(fontDescriptionId, "editor");
		var fontDescription = document.getElementById(fontDescriptionId);
		if (fontDescription != null) {
			fontDescription.style.display = fontOption.selected ? "block" : "none";
		}
	}
}

export function on_toggle_wall(e) {
	paintTool.toggleWall( e.target.checked );
}

export function toggleWallUI(checked) {
	iconUtils.LoadIcon(document.getElementById("wallCheckboxIcon"), checked ? "wall_on" : "wall_off");
}

export function hideAbout() {
	document.getElementById("aboutPanel").setAttribute("style","display:none;");
}

export function toggleInstructions(e) {
	var div = document.getElementById("instructions");
	if (e.target.checked) {
		div.style.display = "block";
	}
	else {
		div.style.display = "none";
	}
	iconUtils.LoadIcon(document.getElementById("instructionsCheckIcon"), e.target.checked ? "expand_more" : "expand_less");
}

//todo abstract this function into toggleDiv
function toggleVersionNotes(e) {
	var div = document.getElementById("versionNotes");
	if (e.target.checked) {
		div.style.display = "block";
	}
	else {
		div.style.display = "none";
	}
	iconUtils.LoadIcon(document.getElementById("versionNotesCheckIcon"), e.target.checked ? "expand_more" : "expand_less");
}

/* MARKERS (exits & endings) */
export let markerTool;

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

// TODO : put helper method somewhere more.. helpful
function setElementClass(elementId, classId, addClass) {
	var el = document.getElementById(elementId);
	if (addClass) {
		el.classList.add(classId);
	}
	else {
		el.classList.remove(classId);
	}
	bitsyLog(el.classList, "editor");
}

export function togglePanelAnimated(e) {
	var panel = document.getElementById(e.target.value);
	if (e.target.checked) {
		togglePanel(e);
		panel.classList.add("drop");
		setTimeout( function() { panel.classList.remove("drop"); }, 300 );
	}
	else {
		panel.classList.add("close");
		setTimeout(
			function() {
				togglePanel(e);
				panel.classList.remove("close");
			},
			400
		);
	}
}

var gifRecordingInterval = null;
export function startRecordingGif() {
	gifFrameData = [];

	document.getElementById("gifStartButton").style.display="none";
	document.getElementById("gifSnapshotButton").style.display="none";
	document.getElementById("gifSnapshotModeButton").style.display="none";
	document.getElementById("gifStopButton").style.display="inline";
	document.getElementById("gifRecordingText").style.display="inline";
	document.getElementById("gifPreview").style.display="none";
	document.getElementById("gifPlaceholder").style.display="block";

	gifRecordingInterval = setInterval( function() {
		gifFrameData.push( ctx.getImageData(0,0,512,512).data );
	}, 100 );
}

var gifCaptureCanvas; // initialized in start\0 -- should be in own module?
var gifCaptureCtx;
var gifCaptureWidescreenSize = {
	width : 726, // height * 1.26
	height : 576
};

export let isGifSnapshotLandscape = false;
export function toggleSnapshotMode() {
	isGifSnapshotLandscape = !isGifSnapshotLandscape;

	var modeDesc = isGifSnapshotLandscape ? "snapshot mode: landscape" : "snapshot mode: square";
	document.getElementById("gifSnapshotModeButton").title = modeDesc;

	var iconName = isGifSnapshotLandscape ? "pagesize_landscape" : "pagesize_full";
	iconUtils.LoadIcon(document.getElementById("gifSnapshotModeIcon"), iconName);
}

export let isSnapshotInProgress = false;
export function takeSnapshotGif(e) {
	isSnapshotInProgress = true;

	var gif = {
		frames: [],
		width: 512,
		height: 512,
		loops: 0,
		delay: animationTime / 10
	};

	gifCaptureCanvas.width = 512; // stop hardcoding 512?
	gifCaptureCanvas.height = 512;

	var frame0;
	var frame1;

	var snapshotInterval;
	var snapshotCount = 0;

	snapshotInterval = setInterval(function() {
		if (snapshotCount === 0) {
			gifCaptureCtx.drawImage(canvas, 0, 0, 512, 512);
			frame0 = gifCaptureCtx.getImageData(0, 0, 512, 512);
		}
		else if (snapshotCount === 1) {
			gifCaptureCtx.drawImage(canvas, 0, 0, 512, 512);
			frame1 = gifCaptureCtx.getImageData(0, 0, 512, 512);
		}
		else if (snapshotCount === 2) {
			if (isGifSnapshotLandscape) {
				/* widescreen */
				gif.width = gifCaptureWidescreenSize.width;
				gif.height = gifCaptureWidescreenSize.height;
				gifCaptureCanvas.width = gifCaptureWidescreenSize.width;
				gifCaptureCanvas.height = gifCaptureWidescreenSize.height;

				var widescreenX = (gifCaptureWidescreenSize.width / 2) - (512 / 2);
				var widescreenY = (gifCaptureWidescreenSize.height / 2) - (512 / 2);

				var roomPal = getPal(room[roomTool.getSelected()].pal);
				gifCaptureCtx.fillStyle = "rgb(" + roomPal[0][0] + "," + roomPal[0][1] + "," + roomPal[0][2] + ")";
				gifCaptureCtx.fillRect(0, 0, gifCaptureWidescreenSize.width, gifCaptureWidescreenSize.height);

				gifCaptureCtx.putImageData(frame0,widescreenX,widescreenY);
				frame0 = gifCaptureCtx.getImageData(0, 0, gifCaptureWidescreenSize.width, gifCaptureWidescreenSize.height);

				gifCaptureCtx.putImageData(frame1,widescreenX,widescreenY);
				frame1 = gifCaptureCtx.getImageData(0, 0, gifCaptureWidescreenSize.width, gifCaptureWidescreenSize.height);
			}

			gif.frames.push(frame0.data);
			gif.frames.push(frame1.data);

			finishRecordingGif(gif);

			clearInterval(snapshotInterval);
			isSnapshotInProgress = false;
		}

		snapshotCount++;
	}, animationTime);
}

export function stopRecordingGif() {
	var gif = {
		frames: gifFrameData,
		width: 512,
		height: 512,
		loops: 0,
		delay: 10
	};

	finishRecordingGif(gif);
}

// TODO - palette for rainbow text
function finishRecordingGif(gif) {
	if(gifRecordingInterval != null) {
		clearInterval( gifRecordingInterval );
		gifRecordingInterval = null;
	}

	document.getElementById("gifStartButton").style.display="none";
	document.getElementById("gifSnapshotButton").style.display="none";
	document.getElementById("gifSnapshotModeButton").style.display="none";
	document.getElementById("gifStopButton").style.display="none";
	document.getElementById("gifRecordingText").style.display="none";
	document.getElementById("gifEncodingText").style.display="inline";
	document.getElementById("gifEncodingProgress").innerText = "0";

	if(gif.frames.length <= 0) {
		document.getElementById("gifEncodingText").style.display="none";
		document.getElementById("gifStartButton").style.display="inline";
		return; // nothing recorded, nothing to encode
	}

	setTimeout( function() {
		var hexPalette = [];

		// add black & white
		hexPalette.push( rgbToHex(0,0,0).slice(1) ); // need to slice off leading # (should that safeguard go in gif.js?)
		hexPalette.push( rgbToHex(255,255,255).slice(1) );

		// add rainbow colors (for rainbow text effect)
		hexPalette.push( hslToHex(0.0,1,0.5).slice(1) );
		hexPalette.push( hslToHex(0.1,1,0.5).slice(1) );
		hexPalette.push( hslToHex(0.2,1,0.5).slice(1) );
		hexPalette.push( hslToHex(0.3,1,0.5).slice(1) );
		hexPalette.push( hslToHex(0.4,1,0.5).slice(1) );
		hexPalette.push( hslToHex(0.5,1,0.5).slice(1) );
		hexPalette.push( hslToHex(0.6,1,0.5).slice(1) );
		hexPalette.push( hslToHex(0.7,1,0.5).slice(1) );
		hexPalette.push( hslToHex(0.8,1,0.5).slice(1) );
		hexPalette.push( hslToHex(0.9,1,0.5).slice(1) );

		// add all user defined palette colors
		for (let id in palette) {
			for (let i in getPal(id)){
				var hexStr = rgbToHex( getPal(id)[i][0], getPal(id)[i][1], getPal(id)[i][2] ).slice(1);

				// gif palettes max out at 256 colors
				// this avoids totally breaking the gif if a game has more colors than that
				// TODO : make this smarter by keeping track palettes of visited rooms
				if (hexPalette.length < 256) {
					hexPalette.push( hexStr );
				}
			}
		}

		gif.palette = hexPalette; // hacky

		gifencoder.encode( gif, 
			function(uri, blob) {
				document.getElementById("gifEncodingText").style.display="none";
				document.getElementById("gifStartButton").style.display="inline";
				document.getElementById("gifPreview").src = uri;
				document.getElementById("gifPreview").style.display="block";
				document.getElementById("gifPlaceholder").style.display="none";
				document.getElementById("gifSnapshotButton").style.display="inline";
				document.getElementById("gifSnapshotModeButton").style.display="inline";

				if( browserFeatures.blobURL ) {
					document.getElementById("gifDownload").href = makeURL.createObjectURL( blob );
				}
				else {
					var downloadData = uri.replace("data:;", "data:attachment/file;"); // for safari
					document.getElementById("gifDownload").href = downloadData;
				}
			},
			function(curFrame, maxFrame) {
				document.getElementById("gifEncodingProgress").innerText = Math.floor( (curFrame / maxFrame) * 100 );
			}
		);
	}, 10);
}

/* ANIMATION EDITING*/
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
	refreshGameData();
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
	refreshGameData();
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
	refreshGameData();
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
	refreshGameData();
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
	refreshGameData();
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
	refreshGameData();
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

/* MOVEABLE PANESL */
var grabbedPanel = {
	card: null,
	size: 0,
	cursorOffset: {x:0,y:0},
	shadow: null
};

export function grabCard(e) {
	// can't grab cards in vertical mode right now
	if (window.innerHeight > window.innerWidth) { // TODO : change to portrait orientation check??
		return;
	}

	// e.preventDefault();

	bitsyLog("--- GRAB START", "editor");
	bitsyLog(grabbedPanel.card, "editor");

	if (grabbedPanel.card != null) return;

	grabbedPanel.card = e.target;
	while(!grabbedPanel.card.classList.contains("bitsy-workbench-item") && !(grabbedPanel.card == null)) {
		grabbedPanel.card = grabbedPanel.card.parentElement;
	}

	if(grabbedPanel.card == null) return; // couldn't find a panel above the handle - abort!

	bitsyLog(grabbedPanel.card, "editor");
	bitsyLog("--", "editor")

	grabbedPanel.size = getElementSize( grabbedPanel.card );
	var pos = getElementPosition( grabbedPanel.card );
	
	grabbedPanel.shadow = document.createElement("div");
	grabbedPanel.shadow.className = "panelShadow";
	grabbedPanel.shadow.style.width = grabbedPanel.size.x + "px";
	grabbedPanel.shadow.style.height = grabbedPanel.size.y + "px";

	bitsyLog( document.getElementById("editorContent") , "editor");
	bitsyLog( grabbedPanel.shadow , "editor");
	bitsyLog( grabbedPanel.card , "editor");

	document.getElementById("editorContent").insertBefore( grabbedPanel.shadow, grabbedPanel.card );
	grabbedPanel.cursorOffset.x = e.clientX - pos.x;
	grabbedPanel.cursorOffset.y = e.clientY - pos.y;
	bitsyLog("client " + e.clientX, "editor");
	bitsyLog("card " + pos.x, "editor");
	bitsyLog("offset " + grabbedPanel.cursorOffset.x, "editor");
	// bitsyLog("screen " + e.screenX, "editor");
	grabbedPanel.card.style.position = "absolute";
	grabbedPanel.card.style.left = e.clientX - grabbedPanel.cursorOffset.x + "px";
	grabbedPanel.card.style.top = e.clientY - grabbedPanel.cursorOffset.y + "px";
	grabbedPanel.card.style.zIndex = 1000;
}

export function panel_onMouseMove(e) {
	if (grabbedPanel.card == null) return;

	bitsyLog("-- PANEL MOVE", "editor");
	bitsyLog(grabbedPanel.card, "editor");

	grabbedPanel.card.style.left = e.clientX - grabbedPanel.cursorOffset.x + "px";
	grabbedPanel.card.style.top = e.clientY - grabbedPanel.cursorOffset.y + "px";

	var cardPos = getElementPosition( grabbedPanel.card );
	var cardSize = grabbedPanel.size;
	var cardCenter = { x:cardPos.x+cardSize.x/2, y:cardPos.y+cardSize.y/2 };

	bitsyLog(cardCenter, "editor");

	var editorContent = document.getElementById("editorContent");
	var editorContentWidth = editorContent.getBoundingClientRect().width;
	var otherCards = editorContent.getElementsByClassName("bitsy-workbench-item");

	for(var j = 0; j < otherCards.length; j++) {
		var other = otherCards[j];
		// bitsyLog(other, "editor");
		var otherPos = getElementPosition( other );
		var otherSize = getElementSize( other );
		var otherCenter = { x:otherPos.x+otherSize.x/2, y:otherPos.y+otherSize.y/2 };

		// bitsyLog(otherCenter, "editor");

		if ( cardCenter.x < otherCenter.x ) {
			bitsyLog("INSERT " + cardCenter.x + " " + otherCenter.x, "editor");
			bitsyLog(other, "editor");

			editorContent.insertBefore( grabbedPanel.shadow, other );
			break;
		}
		else if (j == otherCards.length - 1 && cardCenter.x > otherCenter.x) {
			editorContent.appendChild( grabbedPanel.shadow );
			break;
		}
	}

	bitsyLog("********", "editor")
}
document.addEventListener("mousemove",panel_onMouseMove);

export function panel_onMouseUp(e) {
	if (grabbedPanel.card == null) return;

	var editorContent = document.getElementById("editorContent");
	editorContent.insertBefore( grabbedPanel.card, grabbedPanel.shadow );
	editorContent.removeChild( grabbedPanel.shadow );
	grabbedPanel.card.style.position = "relative";
	grabbedPanel.card.style.top = null;
	grabbedPanel.card.style.left = null;
	grabbedPanel.card.style.zIndex = null;

	// drop card anim
	var cardTmp = grabbedPanel.card;
	cardTmp.classList.add("drop");
	setTimeout( function() { cardTmp.classList.remove("drop"); }, 300 );

	grabbedPanel.card = null;

	updatePanelPrefs();
}
document.addEventListener("mouseup",panel_onMouseUp);

// TODO consolidate these into one function?
export function getElementPosition(e) { /* gets absolute position on page */
	if (!e.getBoundingClientRect) {
		bitsyLog("NOOO BOUNDING RECT!!!", "editor");
		return {x:0,y:0};
	}

	var rect = e.getBoundingClientRect();
	var pos = {x:rect.left,y:rect.top};
	// bitsyLog(pos, "editor");
	return pos;
}

export function getElementSize(e) { /* gets visible size */
	return {
		x: e.clientWidth,
		y: e.clientHeight
	};
}

// sort of a hack to avoid accidentally activating backpage and nextpage while scrolling through editor panels 
function blockScrollBackpage(e) {
	var el = document.getElementById("editorWindow");
	var maxX = el.scrollWidth - el.offsetWidth;

	// if ( el.scrollLeft + e.deltaX < 0 || el.scrollLeft + e.deltaX > maxX )
	// {
	// 	e.preventDefault();
	// 	el.scrollLeft = Math.max(0, Math.min(maxX, el.scrollLeft + event.deltaX));
	// }
}


export function toggleDialogCode(e) {
	console.log('toggling dialogue code')
	var showCode = e.target.checked;

	// toggle button text
	document.getElementById("dialogToggleCodeShowText").style.display = showCode ? "none" : "inline";
	document.getElementById("dialogToggleCodeHideText").style.display = showCode ? "inline" : "none";

	// update editor
	var dialogEditorViewport = document.getElementById("dialogEditor");
	dialogEditorViewport.innerHTML = "";
	if (showCode) {
		dialogEditorViewport.appendChild(curPlaintextDialogEditor.GetElement());
	}
	else {
		dialogEditorViewport.appendChild(curDialogEditor.GetElement());
	}
}

var alwaysShowDrawingDialog = true;
export function toggleAlwaysShowDrawingDialog(e) {
	alwaysShowDrawingDialog = e.target.checked;

	if (alwaysShowDrawingDialog) {
		var dlg = getCurDialogId();
		if (dialog[dlg]) {
			openDialogTool(dlg);
		}
	}
}

export function showInventoryItem() {
	document.getElementById("inventoryItem").style.display = "block";
	document.getElementById("inventoryVariable").style.display = "none";
}

export function showInventoryVariable() {
	document.getElementById("inventoryItem").style.display = "none";
	document.getElementById("inventoryVariable").style.display = "block";
}

var isPreviewDialogMode = false;
function togglePreviewDialog(event) {
	if (event.target.checked) {
		if (curDialogEditor != null) {
			isPreviewDialogMode = true;

			if (document.getElementById("roomPanel").style.display === "none") {
				showPanel("roomPanel");
			}

			on_play_mode();
		
			startPreviewDialog(
				curDialogEditor.GetNode(), 
				function() {
					togglePreviewDialog({ target : { checked : false } });
				});
		}
	}
	else {
		on_edit_mode();
		isPreviewDialogMode = false;
	}

	updatePlayModeButton();
	updatePreviewDialogButton();
}

var isFixedSize = false;
export function chooseExportSizeFull() {
	isFixedSize = false;
	document.getElementById("exportSizeFixedInputSpan").style.display = "none";
}

export function chooseExportSizeFixed() {
	isFixedSize = true;
	document.getElementById("exportSizeFixedInputSpan").style.display = "inline-block";
}

// LOCALIZATION
// TODO : create a system for placeholder text like I have for innerText
export function hackUpdatePlaceholderText() {
	var titlePlaceholder = localization.GetStringOrFallback("title_placeholder", "Title");
	var titleTextBoxes = document.getElementsByClassName("titleTextBox");
	for (var i = 0; i < titleTextBoxes.length; i++) {
		titleTextBoxes[i].placeholder = titlePlaceholder;
	}
}

export function hackUpdateEditorToolMenusOnLanguageChange() {
	// hack : manually update tool menus & titles
	if (roomTool) {
		roomTool.resetTitlebar();
		roomTool.menu.update();
		document.getElementById(roomTool.id + "CheckLabelText").innerText = roomTool.name();
	}

	if (blipTool) {
		blipTool.resetTitlebar();
		blipTool.menu.update();
		document.getElementById(blipTool.id + "CheckLabelText").innerText = blipTool.name();
	}

	if (tuneTool) {
		tuneTool.resetTitlebar();
		tuneTool.menu.update();
		document.getElementById(tuneTool.id + "CheckLabelText").innerText = tuneTool.name();
	}

	if (gameTool) {
		gameTool.resetTitlebar();
		gameTool.menu.update();
		document.getElementById(gameTool.id + "CheckLabelText").innerText = gameTool.name();
	}

	// do this in case the the current sprite dialog changed
	if (paintTool) {
		paintTool.reloadDrawing();
	}

	// TODO : test - is this necessary still? we already call "reloadDialogUI" in the settings tool
	// make sure all editors with a title know to update
	events.Raise("dialog_update", { dialogId:titleDialogId, editorId:null });
}

var curEditorLanguageCode = "en";
function updateEditorLanguageStyle(newCode) {
	document.body.classList.remove("lang_" + curEditorLanguageCode);
	curEditorLanguageCode = newCode;
	document.body.classList.add("lang_" + curEditorLanguageCode);
}

export function updateEditorTextDirection(newTextDirection) {
	var prevTextDirection = textDirection;

	bitsyLog("TEXT BOX TEXT DIR " + newTextDirection, "editor");

	if (prevTextDirection != null) {
		document.body.classList.remove("dir_" + prevTextDirection.toLowerCase());
	}
	document.body.classList.add("dir_" + newTextDirection.toLowerCase());
}

/* UTILS (todo : move into utils.js after merge) */
export function CreateDefaultName(defaultNamePrefix, objectStore, ignoreNumberIfFirstName) {
	if (ignoreNumberIfFirstName === undefined || ignoreNumberIfFirstName === null) {
		ignoreNumberIfFirstName = false;
	}

	var nameCount = ignoreNumberIfFirstName ? -1 : 0; // hacky :(
	for (let id in objectStore) {
		if (objectStore[id].name) {
			if (objectStore[id].name.indexOf(defaultNamePrefix) === 0) {
				var nameCountStr = objectStore[id].name.slice(defaultNamePrefix.length);

				var nameCountInt = 0;
				if (nameCountStr.length > 0) {
					nameCountInt = parseInt(nameCountStr);
				}

				if (!isNaN(nameCountInt) && nameCountInt > nameCount) {
					nameCount = nameCountInt;
				}
			}
		}
	}

	if (ignoreNumberIfFirstName && nameCount < 0) {
		return defaultNamePrefix;
	}

	return defaultNamePrefix + " " + (nameCount + 1);
}

/* DOCS */
export function toggleDialogDocs(e) {
	bitsyLog("SHOW DOCS", "editor");
	bitsyLog(e.target.checked, "editor");
	if (e.target.checked) {
		document.getElementById("dialogDocs").style.display = "block";
		document.getElementById("dialogToggleDocsShowText").style.display = "none";
		document.getElementById("dialogToggleDocsHideText").style.display = "inline";
	}
	else {
		document.getElementById("dialogDocs").style.display = "none";
		document.getElementById("dialogToggleDocsShowText").style.display = "inline";
		document.getElementById("dialogToggleDocsHideText").style.display = "none";
	}
}

export function openFindTool(categoryId, insertNextToId) {
	if (findTool) {
		findTool.SelectCategory(categoryId);
	}

	showPanel("findPanel", insertNextToId);
}

export function openFindToolWithCurrentPaintCategory() {
	var categoryId = "AVA";

	if (drawing) {
		if (drawing.type === TileType.Tile) {
			categoryId = "TIL";
		}
		else if (drawing.type === TileType.Sprite) {
			categoryId = "SPR";
		}
		else if (drawing.type === TileType.Item) {
			categoryId = "ITM";
		}
	}

	openFindTool(categoryId, "paintPanel");
}

/* GAME TOOL */
export let gameTool;

/* SOUND TOOLS */
export let tuneTool;
export let blipTool;