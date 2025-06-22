import {Store} from "./store.js"
import {IconUtils} from "./icons.js"

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


// This is the panel arrangement you get if you are new or your editor settings are out-of-date
let defaultPanelPrefs = {
    workspace : [
        { id:"aboutPanel", 			visible:true, 	position:0  },
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