// Draggable workbench panel ("card") logic.
// Extracted from editor.js. Fully self-contained - no editor/tool state dependency.

import { bitsyLog } from "./system/system.js"
import { updatePanelPrefs } from "./editor_state.js"

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
document.addEventListener("mousemove", panel_onMouseMove);

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
