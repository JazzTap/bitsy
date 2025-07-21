import {start, 
    toggleDialogCode, toggleToolBar, togglePlayMode, togglePanelAnimated, showAbout,
    prevMarker, nextMarker, startAddMarker, duplicateMarker, deleteMarker, newExit, newExitOneWay, newEnding, cancelAddMarker,
    changeExitDirection, selectMarkerRoom1, toggleMoveMarker1, selectMarkerRoom2, toggleMoveMarker2,
    on_paint_avatar, on_paint_tile, on_paint_sprite, on_paint_item, prev, next, newDrawing, duplicateDrawing, deleteDrawing,
    openFindToolWithCurrentPaintCategory, togglePaintGrid, on_paint_frame1, on_paint_frame2, prevPalette, nextPalette, newPalette,
    duplicatePalette, deletePalette, changeColorPickerIndex, prevDialog, nextDialog, addNewDialog, duplicateDialog, deleteDialog, openFindTool,
    toggleAlwaysShowDrawingDialog, showInventoryItem, showInventoryVariable, startRecordingGif, stopRecordingGif, takeSnapshotGif, toggleSnapshotMode,
    toggleExitOptions, grabCard, onDialogNameChange, onChangeExitTransitionEffect,
    on_drawing_name_change, on_toggle_wall, on_toggle_animated, on_palette_name_change 
} from "./script/editor.js"
import {aboutOpenTab} from "./script/tools/about.js"
import {showPanel, hidePanel} from "./script/editor_state.js"

start()

export function testShim (gameTool) {
    // console.log(gameTool)
    // gameTool.show('') // navigate game tool to data tab
}

export function bindToolDialogs () { 
    // I get called during editor initialization by start()
    
    document.querySelectorAll(".bitsy-card-title").forEach(u => u.addEventListener("onmousedown", grabCard))

    document.querySelector("#dialogShowCodeCheck").addEventListener("click", toggleDialogCode)
    document.querySelector("#toolsCheck").addEventListener("click", toggleToolBar)
    document.querySelector("#playModeCheck").addEventListener("click", togglePlayMode)
    document.querySelector("#aboutCheck").addEventListener("click", togglePanelAnimated)
    document.querySelector("#exitsCheck").addEventListener("click", togglePanelAnimated)
    document.querySelector("#paintCheck").addEventListener("click", togglePanelAnimated)
    document.querySelector("#colorsCheck").addEventListener("click", togglePanelAnimated)
    document.querySelector("#dialogCheck").addEventListener("click", togglePanelAnimated)
    document.querySelector("#findCheck").addEventListener("click", togglePanelAnimated)
    document.querySelector("#inventoryCheck").addEventListener("click", togglePanelAnimated)
    document.querySelector("#gifCheck").addEventListener("click", togglePanelAnimated)
    document.querySelector("#aboutOpenNewTab").addEventListener("click", aboutOpenTab)

    document.querySelector("#exitsPrevMarker").addEventListener("click", prevMarker)
    document.querySelector("#exitsNextMarker").addEventListener("click", nextMarker)
    document.querySelector("#exitsAddMarker").addEventListener("click", startAddMarker)
    document.querySelector("#exitsDuplicateMarker").addEventListener("click", duplicateMarker)
    document.querySelector("#exitsDeleteMarker").addEventListener("click", deleteMarker)
    document.querySelector("#exitsNewExit").addEventListener("click", newExit)
    document.querySelector("#exitsNewOneWay").addEventListener("click", newExitOneWay)
    document.querySelector("#exitsNewEnding").addEventListener("click", newEnding)
    document.querySelector("#exitsCancel").addEventListener("click", cancelAddMarker)
    document.querySelector("#exitChangeDirection").addEventListener("click", changeExitDirection)
    document.querySelector("#markerCanvas1").addEventListener("click", selectMarkerRoom1)
    document.querySelector("#toggleMoveMarker1").addEventListener("click", toggleMoveMarker1)
    document.querySelector("#markerCanvas2").addEventListener("click", selectMarkerRoom2)
    document.querySelector("#toggleMoveMarker2").addEventListener("click", toggleMoveMarker2)
    document.querySelector("#paintOptionAvatar").addEventListener("click", on_paint_avatar)
    document.querySelector("#paintOptionTile").addEventListener("click", on_paint_tile)
    document.querySelector("#paintOptionSprite").addEventListener("click", on_paint_sprite)
    document.querySelector("#paintOptionItem").addEventListener("click", on_paint_item)

    document.querySelector("#drawingPrev").addEventListener("click", prev)
    document.querySelector("#drawingNext").addEventListener("click", next)
    document.querySelector("#drawingNew").addEventListener("click", newDrawing)
    document.querySelector("#drawingDuplicate").addEventListener("click", duplicateDrawing)
    document.querySelector("#drawingDelete").addEventListener("click", deleteDrawing)
    document.querySelector("#drawingFind").addEventListener("click", openFindToolWithCurrentPaintCategory)
    document.querySelector("#paintGridCheck").addEventListener("click", togglePaintGrid)
    document.querySelector("#animationKeyframe1").addEventListener("click", on_paint_frame1)
    document.querySelector("#animationKeyframe2").addEventListener("click", on_paint_frame2)
    document.querySelector("#palettePrev").addEventListener("click", prevPalette)
    document.querySelector("#paletteNext").addEventListener("click", nextPalette)
    document.querySelector("#paletteNew").addEventListener("click", newPalette)
    document.querySelector("#paletteDuplicate").addEventListener("click", duplicatePalette)
    document.querySelector("#paletteDelete").addEventListener("click", deletePalette)
    document.querySelector("#colorPaletteOptionBackground").addEventListener("click", () => changeColorPickerIndex(0))
    document.querySelector("#colorPaletteOptionTile").addEventListener("click", () => changeColorPickerIndex(1))
    document.querySelector("#colorPaletteOptionSprite").addEventListener("click", () => changeColorPickerIndex(2))

    document.querySelector("#dialogPrev").addEventListener("click", prevDialog)
    document.querySelector("#dialogNext").addEventListener("click", nextDialog)
    document.querySelector("#dialogNew").addEventListener("click", addNewDialog)
    document.querySelector("#dialogDuplicate").addEventListener("click", duplicateDialog)
    document.querySelector("#deleteDialogButton").addEventListener("click", deleteDialog)
    document.querySelector("#dialogFind").addEventListener("click", openFindTool("DLG", "dialogPanel")) // VERIFY
    document.querySelector("#dialogAlwaysShowDrawingCheck").addEventListener("click", toggleAlwaysShowDrawingDialog)
    document.querySelector("#inventoryOptionItem").addEventListener("click", showInventoryItem)
    document.querySelector("#inventoryOptionVariable").addEventListener("click", showInventoryVariable)
    document.querySelector("#gifStartButton").addEventListener("click", startRecordingGif)
    document.querySelector("#gifStopButton").addEventListener("click", stopRecordingGif)
    document.querySelector("#gifSnapshotButton").addEventListener("click", takeSnapshotGif)
    document.querySelector("#gifSnapshotModeButton").addEventListener("click", toggleSnapshotMode)
    document.querySelector("#exitOptionsToggleCheck1").addEventListener("click", (event) => toggleExitOptions(0, event.target.checked))
    document.querySelector("#exitOptionsToggleCheck2").addEventListener("click", (event) => toggleExitOptions(1, event.target.checked))
    document.querySelector("#exitOptionsToggleCheck1_alt").addEventListener("click", (event) => toggleExitOptions(0, event.target.checked))

    document.querySelector("#hideAbout").addEventListener("click", hidePanel("aboutPanel"))
    document.querySelector("#hideExits").addEventListener("click", hidePanel("exitsPanel"))
    document.querySelector("#hidePaint").addEventListener("click", hidePanel("paintPanel"))
    document.querySelector("#showInventoryButton").addEventListener("click", showPanel("inventoryPanel", "paintPanel"))
    document.querySelector("#hideFind").addEventListener("click", hidePanel("findPanel"))
    document.querySelector("#hideColors").addEventListener("click", hidePanel("colorsPanel"))
    document.querySelector("#showFindColors").addEventListener("click", openFindTool("PAL", "colorsPanel"))
    document.querySelector("#hideDialog").addEventListener("click", hidePanel("dialogPanel"))
    document.querySelector("#hideInventory").addEventListener("click", hidePanel("inventoryPanel"))
    document.querySelector("#hideGif").addEventListener("click", hidePanel("gifPanel"))

    document.querySelector("#showAboutExits").addEventListener("click", showAbout("./tools/exitsandendings", "exitsPanel"))
    document.querySelector("#showAboutPaint").addEventListener("click", showAbout("./tools/paint", "paintPanel"))
    document.querySelector("#showAboutFind").addEventListener("click", showAbout("./tools/find", "findPanel"))
    document.querySelector("#showAboutColors").addEventListener("click", showAbout("./tools/color", "colorsPanel"))
    document.querySelector("#showAboutDialog").addEventListener("click", showAbout("./tools/dialog", "dialogPanel"))
    document.querySelector("#showAboutInventory").addEventListener("click", showAbout("./tools/inventory", "inventoryPanel"))
    document.querySelector("#showAboutGif").addEventListener("click", showAbout("./tools/recordgif", "gifPanel"))

    document.querySelector("#dialogName").addEventListener("change", onDialogNameChange)
    document.querySelector("#exitTransitionEffectSelect").addEventListener("change", (event) => onChangeExitTransitionEffect(event.target.value, 0))
    document.querySelector("#returnExitTransitionEffectSelect").addEventListener("change", (event) => onChangeExitTransitionEffect(event.target.value, 1))
    document.querySelector("#drawingName").addEventListener("change", on_drawing_name_change)
    document.querySelector("#wallCheckbox").addEventListener("change", on_toggle_wall)
    document.querySelector("#animatedCheckbox").addEventListener("change", on_toggle_animated)
    document.querySelector("#paletteName").addEventListener("change", on_palette_name_change)
}