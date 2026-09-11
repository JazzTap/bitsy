// GIF recording / screen-capture utilities.
import { rgbToHex } from "./util.js"
import { width, scale } from "./system/system.js"
import { gif } from "./gif.js"

import { getPal, palette, room, animationTime } from "./engine/bitsy.js"

import { iconUtils } from "./editor_state.js"

import { roomTool, browserFeatures, makeURL } from "./editor.js"

var gifencoder = new gif();
var gifFrameData = [];

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

var gifCaptureCanvas;
var gifCaptureCtx;
var gifCaptureWidescreenSize = {
	width : 726, // height * 1.26
	height : 576
};

// called once from editor.js's start() once the DOM is ready
export function initGifCapture() {
	gifCaptureCanvas = document.createElement("canvas");
	gifCaptureCanvas.width = width * scale;
	gifCaptureCanvas.height = width * scale;
	gifCaptureCtx = gifCaptureCanvas.getContext("2d");
}

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
