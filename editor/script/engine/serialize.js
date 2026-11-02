import {
    flags, room, tile, sprite, item, dialog, end, palette, variable, tune, blip,
    fontName, textDirection, renderer,
    getTitle, getPal, isExitValid,
} from "./bitsy.js";
import {
    version, defaultFontName, TextDirection, titleDialogId, getEngineVersion,
    maxTuneLength, barLength, Octave, Solfa, Note, Tempo, SquareWave, ArpeggioPattern,
} from "./world.js";
import { fontManager } from "../editor_state.js";


//TODO this is in progress and doesn't support all features
export function serializeWorld(skipFonts) {
    if (skipFonts === undefined || skipFonts === null) {
        skipFonts = false;
    }

    // update version flags
    flags.VER_MAJ = version.major;
    flags.VER_MIN = version.minor;

    var worldStr = "";
    /* TITLE */
    worldStr += getTitle() + "\n";
    worldStr += "\n";
    /* VERSION */
    worldStr += "# BITSY VERSION " + getEngineVersion() + "\n"; // add version as a comment for debugging purposes
    if (version.devBuildPhase != "RELEASE") {
        worldStr += "# DEVELOPMENT BUILD -- " + version.devBuildPhase;
    }
    worldStr += "\n";
    /* FLAGS */
    for (let f in flags) {
        worldStr += "! " + f + " " + flags[f] + "\n";
    }
    worldStr += "\n"
    /* FONT */
    if (fontName != defaultFontName) {
        worldStr += "DEFAULT_FONT " + fontName + "\n";
        worldStr += "\n"
    }
    if (textDirection != TextDirection.LeftToRight) {
        worldStr += "TEXT_DIRECTION " + textDirection + "\n";
        worldStr += "\n"
    }
    /* PALETTE */
    for (let id in palette) {
        if (id != "default") {
            worldStr += "PAL " + id + "\n";
            for (let i in getPal(id)) {
                for (let j in getPal(id)[i]) {
                    worldStr += getPal(id)[i][j];
                    if (j < 2) worldStr += ",";
                }
                worldStr += "\n";
            }
            if (palette[id].name != null) {
                worldStr += "NAME " + palette[id].name + "\n";
            }
            worldStr += "\n";
        }
    }
    /* ROOM */
    for (let id in room) {
        worldStr += "ROOM " + id + "\n";
        if ( flags.ROOM_FORMAT == 0 ) {
            // old non-comma separated format
            for (i in room[id].tilemap) {
                for (j in room[id].tilemap[i]) {
                    worldStr += room[id].tilemap[i][j];	
                }
                worldStr += "\n";
            }
        }
        else if ( flags.ROOM_FORMAT == 1 ) {
            // new comma separated format
            for (let i in room[id].tilemap) {
                for (let j in room[id].tilemap[i]) {
                    worldStr += room[id].tilemap[i][j];
                    if (j < room[id].tilemap[i].length-1) worldStr += ","
                }
                worldStr += "\n";
            }
        }
        if (room[id].name != null) {
            /* NAME */
            worldStr += "NAME " + room[id].name + "\n";
        }
        if (room[id].walls.length > 0) {
            /* WALLS */
            worldStr += "WAL ";
            for (let j in room[id].walls) {
                worldStr += room[id].walls[j];
                if (j < room[id].walls.length-1) {
                    worldStr += ",";
                }
            }
            worldStr += "\n";
        }
        if (room[id].items.length > 0) {
            /* ITEMS */
            for (let j in room[id].items) {
                var itm = room[id].items[j];
                worldStr += "ITM " + itm.id + " " + itm.x + "," + itm.y;
                worldStr += "\n";
            }
        }
        if (room[id].exits.length > 0) {
            /* EXITS */
            for (let j in room[id].exits) {
                var e = room[id].exits[j];
                if ( isExitValid(e) ) {
                    worldStr += "EXT " + e.x + "," + e.y + " " + e.dest.room + " " + e.dest.x + "," + e.dest.y;
                    if (e.transition_effect != undefined && e.transition_effect != null) {
                        worldStr += " FX " + e.transition_effect;
                    }
                    if (e.dlg != undefined && e.dlg != null) {
                        worldStr += " DLG " + e.dlg;
                    }
                    worldStr += "\n";
                }
            }
        }
        if (room[id].endings.length > 0) {
            /* ENDINGS */
            for (let j in room[id].endings) {
                var e = room[id].endings[j];
                // todo isEndingValid
                worldStr += "END " + e.id + " " + e.x + "," + e.y;
                worldStr += "\n";
            }
        }
        if (room[id].pal != null && room[id].pal != "default") {
            /* PALETTE */
            worldStr += "PAL " + room[id].pal + "\n";
        }
        if (room[id].ava != null) {
            /* AVATAR SPRITE */
            worldStr += "AVA " + room[id].ava + "\n";
        }
        if (room[id].tune != null && room[id].tune != "0") {
            /* TUNE */
            worldStr += "TUNE " + room[id].tune + "\n";
        }
        worldStr += "\n";
    }
    /* TILES */
    worldStr += serializeTiles();
    /* SPRITES */
    worldStr += serializeSprites();
    /* ITEMS */
    worldStr += serializeItems();
    /* DIALOG */
    for (let id in dialog) {
        if (id != titleDialogId) {
            worldStr += "DLG " + id + "\n";
            worldStr += dialog[id].src + "\n";
            if (dialog[id].name != null) {
                worldStr += "NAME " + dialog[id].name + "\n";
            }
            worldStr += "\n";
        }
    }
    /* ENDINGS (for backwards compability only) */
    for (let id in end) {
        worldStr += "END " + id + "\n";
        worldStr += end[id].src + "\n";
        worldStr += "\n";
    }
    /* VARIABLES */
    for (let id in variable) {
        worldStr += "VAR " + id + "\n";
        worldStr += variable[id] + "\n";
        worldStr += "\n";
    }
    /* TUNES */
    worldStr += serializeTunes();
    /* BLIP */
    for (let id in blip) {
        if (id === "0") {
            continue;
        }

        worldStr += "BLIP " + id + "\n";
        // pitches
        if (blip[id].pitchA.beats > 0) {
            worldStr += serializeNote(blip[id].pitchA.note);
            if (blip[id].pitchA.octave != Octave[4]) {
                worldStr += serializeOctave(blip[id].pitchA.octave);
            }
        }
        else {
            worldStr += blip[id].pitchA.beats;
        }
        worldStr += ",";
        if (blip[id].pitchB.beats > 0) {
            worldStr += serializeNote(blip[id].pitchB.note);
            if (blip[id].pitchB.octave != Octave[4]) {
                worldStr += serializeOctave(blip[id].pitchB.octave);
            }
        }
        else {
            worldStr += blip[id].pitchB.beats;
        }
        worldStr += ",";
        if (blip[id].pitchC.beats > 0) {
            worldStr += serializeNote(blip[id].pitchC.note);
            if (blip[id].pitchC.octave != Octave[4]) {
                worldStr += serializeOctave(blip[id].pitchC.octave);
            }
        }
        else {
            worldStr += blip[id].pitchC.beats;
        }
        worldStr += "\n";
        if (blip[id].name != null) {
            /* NAME */
            worldStr += "NAME " + blip[id].name + "\n";
        }
        // envelope
        worldStr += "ENV " + blip[id].envelope.attack
            + " " + blip[id].envelope.decay
            + " " + blip[id].envelope.sustain
            + " " + blip[id].envelope.length
            + " " + blip[id].envelope.release + "\n";
        // beat
        worldStr += "BEAT " + blip[id].beat.time
            + " " + blip[id].beat.delay + "\n";
        // instrument (square wave type)
        worldStr += "SQR ";
        switch (blip[id].instrument) {
            case SquareWave.P8:
                worldStr += "P8";
                break;
            case SquareWave.P4:
                worldStr += "P4";
                break;
            case SquareWave.P2:
                worldStr += "P2";
                break;
        }
        worldStr += "\n";
        // other parameters
        if (blip[id].doRepeat === true) {
            worldStr += "RPT 1\n";
        }
        // TODO : consider for future update
        // if (blip[id].doSlide === true) {
        // 	worldStr += "SLD 1\n";
        // }
        worldStr += "\n";
    }
    /* FONT */
    // TODO : support multiple fonts
    if (fontManager && fontName != defaultFontName && !skipFonts) {
        worldStr += fontManager.GetData(fontName);
    }

    return worldStr;
}

export function serializeTiles() {
    var worldStr = "";
    for (let id in tile) {
        worldStr += "TIL " + id + "\n";
        worldStr += serializeDrawing( "TIL_" + id );
        if (tile[id].name != null && tile[id].name != undefined) {
            /* NAME */
            worldStr += "NAME " + tile[id].name + "\n";
        }
        if (tile[id].isWall != null && tile[id].isWall != undefined) {
            /* WALL */
            worldStr += "WAL " + tile[id].isWall + "\n";
        }
        if (tile[id].col != null && tile[id].col != undefined && tile[id].col != 1) {
            /* COLOR OVERRIDE */
            worldStr += "COL " + tile[id].col + "\n";
        }
        if (tile[id].bgc != null && tile[id].bgc != undefined && tile[id].bgc != 0) {
            /* BACKGROUND COLOR OVERRIDE */
            if (tile[id].bgc < 0) {
                // transparent background
                worldStr += "BGC *\n";
            }
            else {
                worldStr += "BGC " + tile[id].bgc + "\n";
            }
        }
        worldStr += "\n";
    }
    return worldStr;
}

export function serializeSprites() {
    var worldStr = "";
    for (let id in sprite) {
        worldStr += "SPR " + id + "\n";
        worldStr += serializeDrawing( "SPR_" + id );
        if (sprite[id].name != null && sprite[id].name != undefined) {
            /* NAME */
            worldStr += "NAME " + sprite[id].name + "\n";
        }
        if (sprite[id].dlg != null) {
            worldStr += "DLG " + sprite[id].dlg + "\n";
        }
        if (sprite[id].room != null) {
            /* SPRITE POSITION */
            worldStr += "POS " + sprite[id].room + " " + sprite[id].x + "," + sprite[id].y + "\n";
        }
        if (sprite[id].inventory != null) {
            for(let itemId in sprite[id].inventory) {
                worldStr += "ITM " + itemId + " " + sprite[id].inventory[itemId] + "\n";
            }
        }
        if (sprite[id].col != null && sprite[id].col != undefined && sprite[id].col != 2) {
            /* COLOR OVERRIDE */
            worldStr += "COL " + sprite[id].col + "\n";
        }
        if (sprite[id].bgc != null && sprite[id].bgc != undefined && sprite[id].bgc != 0) {
            /* BACKGROUND COLOR OVERRIDE */
            if (sprite[id].bgc < 0) {
                // transparent background
                worldStr += "BGC *\n";
            }
            else {
                worldStr += "BGC " + sprite[id].bgc + "\n";
            }
        }
        if (sprite[id].blip != null && sprite[id].blip != undefined) {
            /* BLIP */
            worldStr += "BLIP " + sprite[id].blip + "\n";
        }
        worldStr += "\n";
    }
    return worldStr;
}

export function serializeItems() {
    var worldStr = "";
    for (let id in item) {
        worldStr += "ITM " + id + "\n";
        worldStr += serializeDrawing( "ITM_" + id );
        if (item[id].name != null && item[id].name != undefined) {
            /* NAME */
            worldStr += "NAME " + item[id].name + "\n";
        }
        if (item[id].dlg != null) {
            worldStr += "DLG " + item[id].dlg + "\n";
        }
        if (item[id].col != null && item[id].col != undefined && item[id].col != 2) {
            /* COLOR OVERRIDE */
            worldStr += "COL " + item[id].col + "\n";
        }
        if (item[id].bgc != null && item[id].bgc != undefined && item[id].bgc != 0) {
            /* BACKGROUND COLOR OVERRIDE */
            if (item[id].bgc < 0) {
                // transparent background
                worldStr += "BGC *\n";
            }
            else {
                worldStr += "BGC " + item[id].bgc + "\n";
            }
        }
        if (item[id].blip != null && item[id].blip != undefined) {
            /* BLIP */
            worldStr += "BLIP " + item[id].blip + "\n";
        }
        worldStr += "\n";
    }
    return worldStr;
}

export function serializeTunes() {
    var worldStr = "";
    for (let id in tune) {
        if (id === "0") {
            continue;
        }

        worldStr += "TUNE " + id + "\n";
        for (var i = 0; i < maxTuneLength && i < tune[id].melody.length; i++) {
            // MELODY
            for (var j = 0; j < barLength; j++) {
                var noteStr = serializeNote(tune[id].melody[i][j].note, tune[id].key);
                if (noteStr === null) {
                    tune[id].melody[i][j].beats = 0;
                }
                if (tune[id].melody[i][j].beats != 1) {
                    worldStr += tune[id].melody[i][j].beats;
                }
                if (tune[id].melody[i][j].beats > 0) {
                    worldStr += noteStr;
                }
                if (tune[id].melody[i][j].beats > 0 && tune[id].melody[i][j].octave != Octave[4]) {
                    worldStr += serializeOctave(tune[id].melody[i][j].octave);
                }
                if (tune[id].melody[i][j].beats > 0 && tune[id].melody[i][j].blip != undefined) {
                    // todo : create constant for the blip separator?
                    worldStr += "~" + tune[id].melody[i][j].blip;
                }
                if (j < 15) {
                    worldStr += ",";
                }
            }
            worldStr += "\n";

            // HARMONY
            // todo : lots of copy-pasting - I could probably make some helper functions to simplify this
            for (var j = 0; j < barLength; j++) {
                var noteStr = serializeNote(tune[id].harmony[i][j].note, tune[id].key);
                if (noteStr === null) {
                    tune[id].harmony[i][j].beats = 0;
                }
                if (tune[id].harmony[i][j].beats != 1) {
                    worldStr += tune[id].harmony[i][j].beats;
                }
                if (tune[id].harmony[i][j].beats > 0) {
                    worldStr += noteStr;
                }
                if (tune[id].harmony[i][j].beats > 0 && tune[id].harmony[i][j].octave != Octave[4]) {
                    worldStr += serializeOctave(tune[id].harmony[i][j].octave);
                }
                if (tune[id].harmony[i][j].beats > 0 && tune[id].harmony[i][j].blip != undefined) {
                    worldStr += "~" + tune[id].harmony[i][j].blip;
                }
                if (j < 15) {
                    worldStr += ",";
                }
            }
            worldStr += "\n";

            if (i < (tune[id].melody.length - 1)) {
                worldStr += ">";
                worldStr += "\n";
            }
        }
        if (tune[id].name != null) {
            /* NAME */
            worldStr += "NAME " + tune[id].name + "\n";
        }
        if (tune[id].key != undefined && tune[id].key != null) {
            worldStr += "KEY ";
            for (var i = 0; i < Solfa.COUNT; i++) {
                worldStr += serializeNote(tune[id].key.notes[i]);
                if (i < Solfa.COUNT - 1) {
                    worldStr += ",";
                }
            }
            worldStr += " ";
            for (var i = 0; i < tune[id].key.scale.length; i++) {
                worldStr += serializeNote(tune[id].key.scale[i], tune[id].key);
                if (i < tune[id].key.scale.length - 1) {
                    worldStr += ",";
                }
            }
            worldStr += "\n";
        }
        worldStr += "TMP ";
        switch (tune[id].tempo) {
            case Tempo.SLW:
                worldStr += "SLW";
                break;
            case Tempo.MED:
                worldStr += "MED";
                break;
            case Tempo.FST:
                worldStr += "FST";
                break;
            case Tempo.XFST:
                worldStr += "XFST";
                break;
        }
        worldStr += "\n";
        worldStr += "SQR ";
        switch (tune[id].instrumentA) {
            case SquareWave.P8:
                worldStr += "P8";
                break;
            case SquareWave.P4:
                worldStr += "P4";
                break;
            case SquareWave.P2:
                worldStr += "P2";
                break;
        }
        worldStr += " ";
        switch (tune[id].instrumentB) {
            case SquareWave.P8:
                worldStr += "P8";
                break;
            case SquareWave.P4:
                worldStr += "P4";
                break;
            case SquareWave.P2:
                worldStr += "P2";
                break;
        }
        worldStr += "\n";
        if (tune[id].key != undefined && tune[id].key != null && tune[id].arpeggioPattern != ArpeggioPattern.OFF) {
            switch (tune[id].arpeggioPattern) {
                case ArpeggioPattern.UP:
                    worldStr += "ARP UP\n";
                    break;
                case ArpeggioPattern.DWN:
                    worldStr += "ARP DWN\n";
                    break;
                case ArpeggioPattern.INT5:
                    worldStr += "ARP INT5\n";
                    break;
                case ArpeggioPattern.INT8:
                    worldStr += "ARP INT8\n";
                    break;
            }
        }
        worldStr += "\n";
    }
    return worldStr;
}

export function serializeNote(note, key, useFriendlyName) {
    var isSolfa = (key != undefined && key != null);
    var noteType = (isSolfa === true) ? Solfa : Note;

    if (isSolfa && key.scale.indexOf(note) === -1) {
        // no matching note in key
        return null;
    }

    if (isSolfa && useFriendlyName != true) {
        for (var name in Solfa) {
            if (Solfa[name] === note) {
                return name.toLowerCase();
            }
        }

        // no solfa note found
        return null;
    }

    // for a solfa note's "friendly name" convert to the chromatic equivalent
    if (isSolfa && useFriendlyName === true) {
        note = key.notes[note];
    }

    // from this point on, we know the note we're looking for is chromatic
    for (var name in Note) {
        if (Note[name] === note) {
            name = name.replace("_SHARP", "#");
            if (useFriendlyName === true && name === "H") {
                name = "C";
            }
            return name;
        }
    }

    // no note found
    return symbol;
}

export function serializeOctave(octave) {
    for (var symbol in Octave) {
        if (Octave[symbol] === octave) {
            return symbol;
        }
    }

    // default to middle octave
    return "4";
}

export function serializeDrawing(drwId) {
    if (!renderer) {
        return "";
    }

    var drawingData = renderer.GetDrawingSource(drwId);
    var drwStr = "";
    for (let f in drawingData) {
        for (let y in drawingData[f]) {
            var rowStr = "";
            for (let x in drawingData[f][y]) {
                rowStr += drawingData[f][y][x];
            }
            drwStr += rowStr + "\n";
        }
        if (f < (drawingData.length-1)) drwStr += ">\n";
    }
    return drwStr;
}