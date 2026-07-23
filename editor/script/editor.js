import { TileType, labelElementFactory, rgbToHex } from "./util.js"
import { bitsy, processes, initSystem, bitsyLog, tilesize, scale, width,
		setBitsy, attachCanvas, loadGame, quitGame } from "./system/system.js"
import { Resources } from "./generated/resources.js"

import { clearGameData, soundPlayer,
	sprite, tile, room, item, renderer, state, dialog, palette, flags, fontName,
	setInventoryCallback, setVariableCallback, setGameResetCallback, setInitRoomCallback, textDirection,
	loadWorldFromGameData, serializeWorld, resetAllAnimations } from "./engine/bitsy.js"
import { titleDialogId, version, defaultFontName } from "./engine/world.js"

import { Exporter } from "./exporter.js"
import { ThumbnailRendererBase } from "./thumbnail.js"
import { Store }  from "./store.js"
import { updateInventoryUI } from "./inventory.js"

import { bindToolDialogs, testShim } from "../index.js"

import { FindTool } from "./find.js"
import { DialogTool } from "./dialog_editor.js"
import { PaintTool } from "./paint.js"
import { ColorPicker } from "./color_picker.js"
import { RoomMarkerTool } from "./room_markers.js"
import { PaletteTool } from "./palette.js"

import { makeRoomTool } from "./tools/room.js"
import { makeGameTool } from "./tools/game.js"
import { makeTuneTool } from "./tools/tune.js"
import { makeBlipTool } from "./tools/blip.js"

import { initAbout } from "./tools/about.js"
import { localization, readUrlParameters, iconUtils, fontManager, defaultFonts,
	events, getPanelPrefs, showPanel, togglePanel, togglePanelCore } from "./editor_state.js"

import { attachServer, updateText, userId } from "./system/multiplayer.js"

import * as PaintTools from "./tile_animation.js"
import * as DialogTools from "./dialog_tool_utils.js"
import * as GifRecorder from "./gif_recorder.js"
import { sortedTileIdList, sortedItemIdList, sortedSpriteIdList,
	sortedRoomIdList, sortedDialogIdList } from "./id_utils.js"

export * from "./tile_animation.js"
export * from "./dialog_tool_utils.js"
export * from "./gif_recorder.js"
export * from "./id_utils.js"

export * from "./room_thumbnails.js"
export * from "./palette_thumbnails.js"
export * from "./panel_dragging.js"

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

// todo : rename function
export function getDrawingImageSource(drawing) {
	return renderer.GetDrawingSource(drawing.drw);
}

export function getDrawingFrameData(drawing, frameIndex) {
	var imageSource = getDrawingImageSource(drawing);
	return imageSource[frameIndex];
}

/* EVENTS */
export function on_change_title(e) {
	setTitle(e.target.value);
	refreshGameData('title');

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

/* DIALOG UI 
- hacky to make this all global
- some of this should be folded into paint tool later
*/
export let dialogTool = null; // initialization moved to start\0

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
export let mutex = {}

export async function refreshGameDataCore(component = 'none') {
	if (isPlayMode) {
		return; //never store game data while in playmode (TODO: wouldn't be necessary if the game data was decoupled from editor data)
	}
	flags.ROOM_FORMAT = 1; // always save out comma separated format, even if the old format is read in

	console.log("refreshGameData: " + component)

	var gameDataNoFonts = serializeWorld(true);
	server.handle.change((doc) => {
		updateText(doc, ["bitsy"], gameDataNoFonts);
		doc.mutex[userId] = component; 
	});
	// change listener triggers autosave, don't need to repeat
	// Store.set("game_data", gameDataNoFonts);

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
// josh w comeau https://stackoverflow.com/a/75988895
const debounce = (callback, wait) => {
  let timeoutId = null;
  return (...args) => {
    window.clearTimeout(timeoutId);
    timeoutId = window.setTimeout(() => {
      callback(...args);
    }, wait);
  };
}
export const refreshGameData = debounce((component) => refreshGameDataCore(component), 250)

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
const editorWindow = document.querySelector("#editorWindow")
let instanceTextInput

/* MULTIPLAYER */
export let server
export let copresenceContext
export const peerCursors = {}

/* TOOL CONTROLLERS */
export let roomTool;
export let paintTool;

/* CUR DRAWING */
export let drawing;

export var tileIndex = 0;
export var spriteIndex = 0;
export var itemIndex = 0;
export function setTileIndex(idx) { tileIndex = idx; }
export function setSpriteIndex(idx) { spriteIndex = idx; }
export function setItemIndex(idx) { itemIndex = idx; }

/* ROOM */
var roomIndex = 0;

/* BROWSER COMPATIBILITY */
export var browserFeatures = {
	colorPicker : false,
	fileDownload : false,
	blobURL : false
};

/* EXPORT HTML */
export var makeURL = null;
export var exporter = new Exporter();

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

export async function start() {
	initSystem();

	// TODO : I need to get rid of this event system... it's too hard to debug
	events.Listen("game_data_change", function(event) {
		// TODO : refactor "openDialogTool" to split out the actual opening from reloading
		// force re-load the dialog tool
		// openDialogTool(titleDialogId, null, false); // titleDialogId, insertNextToId, showIfHidden
	});
	detectBrowserFeatures();

	resizeCanvasOverlay()
	copresenceContext = document.getElementById('pointerOverlay').getContext('2d');

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
	if (gamedataStorage !== "") {
		// FIXME: remote maybe not available immediately
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
		var gamedataChanged = handle.doc().bitsy;
        Store.set("game_data", gamedataChanged)

		mutex = handle.doc().mutex
		console.log('sync crdt: update from ' + Object.entries(mutex))

		// on_game_data_change_core()
		reload_game_data();
    })
	
	// share my cursor
	document.addEventListener("mousemove", cursorOverlay)
	document.addEventListener("mousedown", cursorDownOverlay)

	// render shared cursors
	const cursorIcon = bakeCursor()
    handle.on("ephemeral-message", ({handle, senderId, message}) => {
		let ctx = copresenceContext

		// HACK: initialize peers on connection, not in the mousemove handler
		let u = peerCursors[senderId]
		if (u === undefined) {
			let randomColor = '#000'
			console.log('saw peer with color ' + handle[senderId])
			if (!handle[senderId])
				handle[senderId] = randomColor
			peerCursors[senderId] = {color: handle[senderId]};
		}

		// update this peer's cursor ghost
		if (message.type == "mousemove") {
			u.mouseX = message.mouseX;
			u.mouseY = message.mouseY;
			u.age = 0;
		}

		// clear out timed-out peers
		for (let i in peerCursors) {
			if (peerCursors[i].age > 500)
				delete peerCursors[i]
		}

		// redraw cursors
		ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
		ctx.fillStyle = '#fff'

		if (message.type == "mousedown") {
			ctx.save()
			ctx.fillStyle = '#ffa7'
			ctx.translate(u.mouseX - editorWindow.scrollLeft,
							u.mouseY - editorWindow.scrollTop);
			ctx.beginPath()
			ctx.arc(0, 0, 10, 0, 2*Math.PI)
			ctx.fill()
			ctx.restore()
		}

		for (let i in peerCursors) {
			let msg = peerCursors[i]
			++msg.age;
			ctx.strokeStyle = msg.color; // always black

			ctx.save();
			ctx.translate(msg.mouseX - editorWindow.scrollLeft,
							msg.mouseY - editorWindow.scrollTop);
			ctx.fill(cursorIcon);
			ctx.stroke(cursorIcon);
			ctx.restore();
		}
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
	paintTool.onReloadTile = function(){ PaintTools.reloadTile() };
	paintTool.onReloadSprite = function(){ PaintTools.reloadSprite() };
	paintTool.onReloadItem = function(){ PaintTools.reloadItem() };

	markerTool = new RoomMarkerTool(document.getElementById("markerCanvas1"), document.getElementById("markerCanvas2") );
	bitsyLog("MARKER TOOL " + markerTool, "editor");

	roomIndex = sortedRoomIdList().indexOf(state.room);

 	// expose these windows to console debugging
	window.roomTool = roomTool;
	window.paintTool = paintTool;
	window.markerTool = markerTool;
	window.state = state;
	window.bitsy = bitsy; // expose the main process (defined in `system.js`)
	window.processes = processes;

	//draw everything
	PaintTools.on_paint_avatar();
	paintTool.updateCanvas();
	markerTool.Refresh();

	document.getElementById("inventoryOptionItem").checked = true; // a bit hacky
	updateInventoryUI(localization);

	// init color picker
	colorPicker = new ColorPicker('colorPickerWheel', 'colorPickerSelect', 'colorPickerSliderThumb', 'colorPickerSliderBg', 'colorPickerHexText');
	document.getElementById("colorPaletteOptionBackground").checked = true;
	paletteTool = new PaletteTool(colorPicker,["colorPaletteLabelBackground", "colorPaletteLabelTile", "colorPaletteLabelSprite"],"paletteName");
	events.Listen("palette_change", function(event) {
		refreshGameData('palette');
	});
	events.Listen("palette_list_change", function(event) {
		refreshGameData('palette');
	});

	if (!browserFeatures.fileDownload) {
		document.getElementById("downloadHelp").style.display = "block";
	}

	// gif recording init
	GifRecorder.initGifCapture();

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
	let titleTextWidgets = document.getElementsByClassName("titleWidgetContainer");
	for (var i = 0; i < titleTextWidgets.length; i++) {
		var widget = dialogTool.CreateTitleWidget();
		titleTextWidgets[i].appendChild(widget.GetElement());
	}
	
	let instanceNameWidget = document.getElementsByClassName("instanceNameContainer")[0];
	instanceTextInput = document.createElement("input");
	instanceTextInput.classList.add("textInputField");
	instanceTextInput.style.width = "calc(100% - 15px)"
	instanceTextInput.type = "text";
	instanceTextInput.readOnly = true;
	instanceTextInput.value = Store.get("instance_name")
	instanceNameWidget.appendChild(instanceTextInput);

	// prepare dialog tool
	DialogTools.openDialogTool(titleDialogId, undefined, false); // start with the title open
	DialogTools.setAlwaysShowDrawingDialog(document.getElementById("dialogAlwaysShowDrawingCheck").checked);

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
	// restore workspace
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
	// about tool
	initAbout();

	// debug helper
	testShim(gameTool);
	// onclick handlers
	bindToolDialogs();
}

function bakeCursor(scale = 1) {
  const p = new Path2D();
  p.moveTo(0, 0);           // tip (hotspot)
  p.lineTo(0, 16 * scale);  // left edge bottom
  p.lineTo(4 * scale, 12 * scale);  // inner notch
  p.lineTo(7 * scale, 18 * scale);  // stylus tip
  p.lineTo(9 * scale, 17 * scale);  // stylus right
  p.lineTo(6 * scale, 11 * scale);  // back to body
  p.lineTo(11 * scale, 11 * scale); // right shoulder
  p.closePath();
  return p;
}

function resizeCanvasOverlay() {
	let canvas = document.getElementById('pointerOverlay')
	canvas.width = window.innerWidth;
	canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvasOverlay, false)

export function copyInstanceURL() {
    navigator.clipboard.writeText(`${location.origin}${location.pathname}?instance=${Store.get("instance_name")}`)
    instanceTextInput.value = "Copied instance URL!"
	this.readOnly = true
	setTimeout(() => {
		instanceTextInput.value = Store.get("instance_name")
		this.readOnly = false
	}, 1000);
}

export function on_palette_name_change(event) {
	paletteTool.ChangeSelectedPaletteName(event.target.value);
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
	setBitsy(processes[0].system);
	renderer.ClearCache();
	roomTool.renderer.ClearCache();

	// todo : I feel like I need to take a look at the font manager and simplify things there
	loadGame(roomTool.canvasElement, serializeWorld(), fontManager.GetData(defaultFontName));
}

export function on_edit_mode() {
	isPlayMode = false;

	document.getElementById("appRoot").classList.remove("bitsy-playmode");

	// reset `bitsy` to main system so that the game cleans up correctly
	setBitsy(processes[0].system);
	quitGame();

	// reparse world to reset any changes from gameplay
	var gamedataStorage = Store.get("game_data");
	loadWorldFromGameData(gamedataStorage);
	
	// clear render cache
	renderer.ClearCache();
	roomTool.renderer.ClearCache();

	state.room = sortedRoomIdList()[roomIndex]; //restore current room to pre-play state

	markerTool.RefreshKeepSelection();

	DialogTools.reloadDialogUI();

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

/* PALETTE STUFF */
export let colorPicker = null;
export let paletteTool = null;

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

export function on_change_adv_dialog() {
	on_change_dialog();
}

export function reload_game_data() {
	// FIXME: why does palette revert?
	// console.log(roomTool?.selectedId, getRoomPal(roomTool?.selectedId))

	// same as core, but doesn't reset editor state
	var gamedataStorage = Store.get("game_data");
	bitsyLog(gamedataStorage, "editor");
	
	clearGameData();
	loadWorldFromGameData(gamedataStorage);

	// reset animations
	resetAllAnimations();
	renderer.ClearCache(); // reset the renderer after loading the world to avoid nondeterminism

	events.Raise("game_data_change"); // redraw dialog editor, find tool, palette
}

export function on_game_data_change() {
	on_game_data_change_core();

	// reset find tool (a bit heavy handed?)
	resetFindTool();
}

export function on_game_data_change_core() {
	var gamedataStorage = Store.get("game_data");
	bitsyLog(gamedataStorage, "editor");
	console.log("on_game_data_change_core")
	console.log('which tool?: ' + mutex[userId])

	// FIXME: don't clobber the tool we're holding
	let roomId = roomTool?.getSelectedId() || 0,  
		tuneId = tuneTool?.getSelectedId() || 0,
		blipId = blipTool?.getSelectedId() || 0,
		tileId = sortedTileIdList()[tileIndex],
		itemId = sortedItemIdList()[itemIndex],
		spriteId = sortedSpriteIdList().filter(function (id) { return id != "A"; })[spriteIndex];
		
	clearGameData();
	renderer.ClearCache();
	loadWorldFromGameData(gamedataStorage); // reparse world if user directly manipulates game data

	/*
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

	var curPaintMode = TileType.Avatar;
	if (drawing) {
		curPaintMode = drawing.type;
	}
	*/
 
	//fallback if there are no tiles, sprites, map
	// TODO : switch to using stored default file data (requires separated parser / game data code)
	if (Object.keys(sprite).length == 0) {
		PaintTools.makeSprite("A");
		sprite["A"].room = null;
		sprite["A"].x = -1;
		sprite["A"].y = -1;
	}
	if (Object.keys(tile).length == 0) {
		PaintTools.makeTile("a");
	}
	if (Object.keys(room).length == 0) {
		// TODO : ?
	}
	if (Object.keys(item).length == 0) {
		PaintTools.makeItem("0");
	}

	// try not to clobber editor state
	// roomIndex = 0;

	/*
	var curPaintMode = TileType.Avatar;
	if (drawing) {
		curPaintMode = drawing.type;
	}
	if (curPaintMode === TileType.Tile) {
		drawing = tile[tileId] || tile[sortedTileIdList()[0]];
	}
	else if (curPaintMode === TileType.Item) {
		drawing = item[itemId] || item[sortedItemIdList()[0]];
	}
	else if (curPaintMode === TileType.Avatar) {
		drawing = sprite["A"];
	}
	else if (curPaintMode === TileType.Sprite) {
		let ids = sortedSpriteIdList().filter(function (id) { return id != "A"; })
		drawing = sprite[spriteId] || sprite[ids[0]];
	}

	// paintTool.reloadDrawing(); // this reloads the dialog UI
	updateInventoryUI(localization);
	*/

	// FIXME: catch undefined fontName on startup
	// if user pasted in a custom font into game data - update the stored custom font
	if (defaultFonts.indexOf(fontName + fontManager.GetExtension()) == -1) {
		var fontStorage = {
			name : fontName,
			fontdata : fontManager.GetData(fontName)
		};
		Store.set('custom_font', fontStorage);
	}

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

export function selectRoom(roomId) {
	roomTool.select(roomId);
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

// sort of a hack to avoid accidentally activating backpage and nextpage while scrolling through editor panels 
export function blockScrollBackpage(e) {
	var el = document.getElementById("editorWindow");
	var maxX = el.scrollWidth - el.offsetWidth;

	// if ( el.scrollLeft + e.deltaX < 0 || el.scrollLeft + e.deltaX > maxX )
	// {
	// 	e.preventDefault();
	// 	el.scrollLeft = Math.max(0, Math.min(maxX, el.scrollLeft + event.deltaX));
	// }
}

// show other peoples' cursors in multiplayer
export function cursorOverlay(e) {	
	server.handle.broadcast({
		type: "mousemove",
		mouseX: e.pageX + editorWindow.scrollLeft,
		mouseY: e.pageY + editorWindow.scrollTop
	})
}
export function cursorDownOverlay(e) {
	server.handle.broadcast({
		type: "mousedown",
		target: e.target
	})
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
		if (DialogTools.curDialogEditor != null) {
			isPreviewDialogMode = true;

			if (document.getElementById("roomPanel").style.display === "none") {
				showPanel("roomPanel");
			}

			on_play_mode();
		
			startPreviewDialog(
				DialogTools.curDialogEditor.GetNode(), 
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
export function updateEditorLanguageStyle(newCode) {
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
		if (objectStore[id]?.name) {
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