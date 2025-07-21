import { bitsyLog } from "./system/system.js"
import {Localization} from "./localization.js"
import { FontManager } from "./engine/font.js"
import {Store} from "./store.js"
import {IconUtils} from "./icons.js"
import {EventManager} from "./event_manager.js"

export let isPlayerEmbeddedInEditor = true  // FIXME: flag for game player to make changes specific to editor

/* FONT MANAGER */
var defaultFonts = [
		"ascii_small.bitsyfont",
		"unicode_european_small.bitsyfont",
		"unicode_european_large.bitsyfont",
		"unicode_asian.bitsyfont",
		"arabic.bitsyfont",
	];
export let fontManager = new FontManager(defaultFonts); // FIXME: engine has its own fontManager, which we intend to clobber

let urlParameters = {};
export let localization;

export function readUrlParameters() {
	bitsyLog(" --- reading url parameters --- ", "editor");

	var urlSplit = window.location.href.split("?");

	if (urlSplit.length >= 2) {
		var queryString = urlSplit[1];
		var queryStringSplit = queryString.split("&");

		for (var i = 0; i < queryStringSplit.length; i++) {
			var parameterSplit = queryStringSplit[i].split("=");

			if (parameterSplit.length >= 2) {
				var parameterName = parameterSplit[0];
				var parameterValue = parameterSplit[1];

				bitsyLog("parameter " + parameterName + " = " + parameterValue, "editor");
				urlParameters[parameterName] = parameterValue; // VERIFY
			}
		}
	}
	localization = new Localization(urlParameters["lang"]); // VERIFY
}

/* ICONS */
export let iconUtils = new IconUtils()

// load icons and replace placeholder elements
var elements = document.getElementsByClassName("bitsy_icon");
for(var i = 0; i < elements.length; i++) {
	iconUtils.LoadIcon(elements[i]);
}

var elements = document.getElementsByClassName("bitsy_icon_anim");
for(var i = 0; i < elements.length; i++) {
	iconUtils.LoadIconAnimated(elements[i]);
}

/* EVENTS */
export let events = new EventManager();

// This is the panel arrangement you get if you are new or your editor settings are out-of-date
let defaultPanelPrefs = {
    workspace : [
        { id:"aboutPanel", 			visible:false, 	position:0  }, // VERIFY
        { id:"roomPanel", 			visible:true, 	position:1  },
        { id:"paintPanel", 			visible:true, 	position:2  },
        { id:"colorsPanel", 		visible:true, 	position:3  },
        { id:"gamePanel", 			visible:true, 	position:4  },
        { id:"gifPanel", 			visible:false, 	position:5  },
        { id:"exitsPanel", 			visible:false, 	position:6  },
        { id:"dialogPanel",			visible:false,	position:7 },
        { id:"findPanel",			visible:false,	position:8  },
        { id:"inventoryPanel",		visible:false,	position:9 },
        { id:"tunePanel",			visible:false,	position:10 },
        { id:"blipPanel",			visible:false,	position:11 },
    ]
};
// bitsyLog(defaultPanelPrefs, "editor");

/* PANEL MANAGEMENT */
export function togglePanel(e) {
	togglePanelCore( e.target.value, e.target.checked );
}

export function showPanel(id, insertNextToId) {
	togglePanelCore(id, true /*visible*/, true /*doUpdatePrefs*/, insertNextToId);
}

export function hidePanel(id) {
	// animate panel and tools button
	document.getElementById(id).classList.add("close");
	document.getElementById("toolsCheckLabel").classList.add("flash");

	setTimeout(
		function() {
			// close panel after animations
			togglePanelCore( id, false /*visible*/ );

			// reset animations
			document.getElementById(id).classList.remove("close");
			document.getElementById("toolsCheckLabel").classList.remove("flash");
		},
		400
	);
}

export function togglePanelCore(id, visible, doUpdatePrefs, insertNextToId) {
	if (doUpdatePrefs === undefined || doUpdatePrefs === null) {
		doUpdatePrefs = true;
	}

	//hide/show panel
	togglePanelUI(id, visible, insertNextToId);

	//save panel preferences
	// savePanelPref( id, visible );
	if (doUpdatePrefs) {
		updatePanelPrefs();
	}
}

export function togglePanelUI(id, visible, insertNextToId) {
	if (visible) {
		var editorContent = document.getElementById("editorContent");
		var cardElement = document.getElementById(id);

		if (insertNextToId === undefined || insertNextToId === null) {
			editorContent.appendChild(cardElement);
		}
		else {
			var insertNextToElement = document.getElementById(insertNextToId);
			editorContent.insertBefore(cardElement, insertNextToElement.nextSibling);

			// hack - activate animation if using insert next to?
			cardElement.classList.add("drop");
			setTimeout( function() { cardElement.classList.remove("drop"); }, 300 );
		}
	}

	document.getElementById(id).style.display = visible ? "inline-flex" : "none";

	if (visible) {
		cardElement.scrollIntoView();
	}

	// update checkbox
	if (id != "toolsPanel") {
		document.getElementById(id.replace("Panel","Check")).checked = visible;
	}
}

export function updatePanelPrefs() {
	// bitsyLog("UPDATE PREFS", "editor");

	var prefs = getPanelPrefs();
	// bitsyLog(prefs, "editor");

	var editorContent = document.getElementById("editorContent");
	var cards = editorContent.getElementsByClassName("bitsy-workbench-item");

	for(var i = 0; i < cards.length; i++) {
		var card = cards[i];
		var id = card.id;
		var visible = card.style.display != "none";

		for (var j = 0; j < prefs.workspace.length; j++ )
		{
			if (prefs.workspace[j].id === id) {
				prefs.workspace[j].position = i;
				prefs.workspace[j].visible = visible;
			}
		}
	}

	// bitsyLog(prefs, "editor");
	Store.set('panel_prefs', prefs);
	// bitsyLog(Store.get('panel_prefs'), "editor");
}

export function getPanelPrefs() {
	// (TODO: weird that engine version and editor version are the same??)
	var storedEngineVersion = Store.get('engine_version');
	var useDefaultPrefs = (!storedEngineVersion) ||
	                      (storedEngineVersion.major < 8) ||
	                      (storedEngineVersion.minor < 11);
	var prefs = useDefaultPrefs ? defaultPanelPrefs : Store.get('panel_prefs', defaultPanelPrefs);

	// add missing panel prefs (if any)
	// bitsyLog(defaultPanelPrefs, "editor");
	for( var i = 0; i < defaultPanelPrefs.workspace.length; i++ ) {
		var isMissing = true;
		var panelPref = defaultPanelPrefs.workspace[i];
		for( var j = 0; j < prefs.workspace.length; j++ )
		{
			if( prefs.workspace[j].id === panelPref.id ) {
				isMissing = false;
			}
		}

		if( isMissing ) {
			prefs.workspace.push( panelPref );
		}
	}

	return prefs;
}

export function getPanelSetting(panelId, settingId) {
	var settingValue = null;

	var prefs = getPanelPrefs();

	for (var i = 0; i < prefs.workspace.length; i++ ) {
		if (prefs.workspace[i].id === panelId) {
			if (prefs.workspace[i].setting != undefined && prefs.workspace[i].setting != null) {
				settingValue = prefs.workspace[i].setting[settingId];
			}
		}
	}

	return settingValue;
}

export function setPanelSetting(panelId, settingId, settingValue) {
	var prefs = getPanelPrefs();

	for (var i = 0; i < prefs.workspace.length; i++ ) {
		if (prefs.workspace[i].id === panelId) {
			if (prefs.workspace[i].setting === undefined || prefs.workspace[i].setting === null) {
				prefs.workspace[i].setting = {};
			}

			prefs.workspace[i].setting[settingId] = settingValue;
		}
	}

	Store.set('panel_prefs', prefs);
}