// Dialog tool / dialog editor panel utilities.
import { getDrawingDialogId, getDrawingNameOrDescription } from "./util.js"
import { bitsyLog } from "./system/system.js"

import { sprite, item, room, dialog } from "./engine/bitsy.js"
import { titleDialogId } from "./engine/world.js"

import { localization, events, showPanel } from "./editor_state.js"

import { sortedDialogIdList, nextAvailableDialogId } from "./id_utils.js"

import { dialogTool, drawing, refreshGameData, CreateDefaultName } from "./editor.js"

export let curDialogEditorId = null; // can I wrap this all up somewhere? -- feels a bit hacky to have all these globals
export let curDialogEditor = null;
export let curPlaintextDialogEditor = null; // the duplication is a bit weird, but better than recreating editors all the time?

export function openDialogTool(dialogId, insertNextToId, showIfHidden) { // todo : rename since it doesn't always "open" it?
	// console.log("dialog tool reload: " + new Error().stack)

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
	refreshGameData('dialog name');
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

	setAlwaysShowDrawingDialog(document.getElementById("dialogAlwaysShowDrawingCheck").checked = false);
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

	setAlwaysShowDrawingDialog(document.getElementById("dialogAlwaysShowDrawingCheck").checked = false);
}

export function addNewDialog() {
	var id = nextAvailableDialogId();

	dialog[id] = { src:" ", name:null };
	refreshGameData('dialog new');

	openDialogTool(id);

	events.Raise("new_dialog", { id:id });

	setAlwaysShowDrawingDialog(document.getElementById("dialogAlwaysShowDrawingCheck").checked = false);
}

export function duplicateDialog() {
	if (curDialogEditorId != null) {
		var id = nextAvailableDialogId();
		dialog[id] = { src: dialog[curDialogEditorId].src.slice(), name: null, id: id, };
		refreshGameData('dialog dupe');

		openDialogTool(id);

		setAlwaysShowDrawingDialog(document.getElementById("dialogAlwaysShowDrawingCheck").checked = false);
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
		refreshGameData('dialog delete');

		setAlwaysShowDrawingDialog(document.getElementById("dialogAlwaysShowDrawingCheck").checked = false);

		events.Raise("dialog_delete", { dialogId:tempDialogId, editorId:null });
	}
}

// TODO : move into the paint tool
var paintDialogWidget = null;
export function reloadDialogUI() {
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
				refreshGameData('dialog create');
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
export function setAlwaysShowDrawingDialog(val) {
	alwaysShowDrawingDialog = val;
}

export function toggleAlwaysShowDrawingDialog(e) {
	alwaysShowDrawingDialog = e.target.checked;

	if (alwaysShowDrawingDialog) {
		var dlg = getCurDialogId();
		if (dialog[dlg]) {
			openDialogTool(dlg);
		}
	}
}
