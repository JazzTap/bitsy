// Object ID generation and sorting utilities (tiles, sprites, items, rooms, dialogs, palettes).
// These only depend on the world data model, no editor/tool state.

import { sprite, tile, room, item, dialog, palette } from "./engine/bitsy.js"

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
