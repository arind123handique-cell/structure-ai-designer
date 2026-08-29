/**
 * Unified Architectural BIM Plan Workspace View
 * Combines 2D Floor Plan Canvas, 3D BIM Viewer Split Mode, Properties Inspector, and Material Takeoff.
 */

import React, { useState, useMemo } from 'react';
import { useProjectStore } from '@/features/projects/projectStore';
import { FloorPlanEngine, FloorPlanLevel } from '@/features/drawings/floorPlanEngine';
import { RoomEngine } from '../engines/roomEngine';
import { StaircasePlacementEngine } from '../engines/staircasePlacementEngine';
import { FloorSelector } from './FloorSelector';
import { FloorPlanToolbar } from './FloorPlanToolbar';
import { FloorPlanCanvas } from './FloorPlanCanvas';
import { PlanPropertiesPanel } from './PlanPropertiesPanel';
import { ArchitecturalTakeoffPanel } from './ArchitecturalTakeoffPanel';
import { Structural3DViewer } from '@/components/model-viewer/Structural3DViewer';
import {
  Layout,
  Columns2,
  Calculator,
  Box,
  Layers,
  Sparkles,
} from 'lucide-react';

export const ArchitecturalPlanView: React.FC = () => {
  const {
    activeModel,
    activeFloorIndex,
    setActiveFloorIndex,
    activePlanTool,
    setActivePlanTool,
    setActiveView,
    selectedArchitecturalId,
    selectedArchitecturalType,
    selectArchitecturalElement,
    architecturalWalls,
    architecturalDoors,
    architecturalWindows,
    architecturalOpenings,
    architecturalRooms,
    architecturalStaircases,
    architecturalDimensions,
    architecturalSettings,
    customStaircaseGeometry,
    customStaircaseLandingEntry,
    addWall,
    updateWall,
    deleteWall,
    addDoor,
    updateDoor,
    deleteDoor,
    addWindow,
    updateWindow,
    deleteWindow,
    addOpening,
    updateOpening,
    deleteOpening,
    addRoom,
    updateRoom,
    deleteRoom,
    addStaircase,
    updateStaircase,
    deleteStaircase,
    setRoomsForFloor,
    addDimension,
    deleteDimension,
    updateArchitecturalSettings,
    copyFloorPlan,
    undoArchitecturalAction,
    redoArchitecturalAction,
  } = useProjectStore();

  const [workspaceMode, setWorkspaceMode] = useState<'2D_PLAN' | 'SPLIT_2D_3D' | 'TAKEOFF'>('2D_PLAN');
  const [wallThicknessPreset, setWallThicknessPreset] = useState<number>(0.23); // 230mm default
  const [doorWidthPreset, setDoorWidthPreset] = useState<number>(0.9); // 900mm default
  const [windowWidthPreset, setWindowWidthPreset] = useState<number>(1.2); // 1200mm default

  // Extract Floor Levels from structural model
  const floorPlans: FloorPlanLevel[] = useMemo(() => {
    const createFallbackLevel = (index: number, name: string, elevation: number): FloorPlanLevel => ({
      levelIndex: index,
      levelName: name,
      sheetNumber: `ARCH-${100 + index}`,
      elevationY: elevation,
      isFoundationLevel: index === 0,
      beams: [],
      columns: [],
      gradeBeams: [],
      slabs: [],
      gridLinesX: [],
      gridLinesZ: [],
      combinedPileCaps: [],
      absorbedCombinedCapNodeIds: new Set<number>(),
      bounds: { minX: 0, maxX: 20, minZ: 0, maxZ: 20, width: 20, height: 20 },
      metrics: { totalBeams: 0, totalColumns: 0, totalSlabs: 0, totalConcreteM3: 0, totalSteelKg: 0, totalFloorAreaM2: 0 },
    });

    if (!activeModel) {
      return [
        createFallbackLevel(0, 'Ground Floor', 0),
        createFallbackLevel(1, '1st Floor', 3.2),
      ];
    }
    const extracted = FloorPlanEngine.extractFloorPlans(activeModel);
    return extracted.length > 0
      ? extracted
      : [
          createFallbackLevel(0, 'Ground Floor', 0),
        ];
  }, [activeModel]);

  // Auto-Detect Enclosed Rooms for active floor
  const handleAutoDetectRooms = () => {
    const activeFloorId = `floor_${activeFloorIndex}`;
    const floorWallList = Object.values(architecturalWalls).filter((w) => w.floorId === activeFloorId);
    const existingRoomIds = Object.keys(architecturalRooms);
    const detected = RoomEngine.detectRoomsFromWalls(floorWallList, activeFloorId, existingRoomIds);
    setRoomsForFloor(activeFloorId, detected);
  };

  // Place Designed Staircase at Center of Active Floor
  const handlePlaceDesignedStaircase = () => {
    const activeFloorId = `floor_${activeFloorIndex}`;
    const currentFloor = floorPlans[activeFloorIndex];
    const geom = customStaircaseGeometry || {};
    const entry = customStaircaseLandingEntry || {};
    const detectedCore = StaircasePlacementEngine.detectBuildingStaircaseCore(activeModel);
    const roomW = geom.roomWidth || detectedCore?.roomWidth || 2.4;
    const roomL = geom.roomLength || detectedCore?.roomLength || 4.3;

    // Compute center insertion point
    let centerX = 5.0;
    let centerY = 5.0;
    if (detectedCore) {
      centerX = detectedCore.position.x;
      centerY = detectedCore.position.y;
    } else if (currentFloor && currentFloor.bounds) {
      centerX = (currentFloor.bounds.minX + currentFloor.bounds.maxX) / 2 - roomW / 2;
      centerY = (currentFloor.bounds.minZ + currentFloor.bounds.maxZ) / 2 - roomL / 2;
    } else {
      const activeWalls = Object.values(architecturalWalls).filter((w) => w.floorId === activeFloorId);
      if (activeWalls.length > 0) {
        const xs = activeWalls.flatMap((w) => [w.start.x, w.end.x]);
        const ys = activeWalls.flatMap((w) => [w.start.y, w.end.y]);
        centerX = (Math.min(...xs) + Math.max(...xs)) / 2 - roomW / 2;
        centerY = (Math.min(...ys) + Math.max(...ys)) / 2 - roomL / 2;
      }
    }

    const currentStairList = Object.values(architecturalStaircases || {});

    const newStaircase = StaircasePlacementEngine.createDefaultStaircase(
      activeFloorId,
      { x: Math.round(centerX * 10) / 10, y: Math.round(centerY * 10) / 10 },
      {
        id: `STAIR-${(currentStairList.length + 1).toString().padStart(3, '0')}`,
        name: `Staircase FL-${activeFloorIndex + 1}`,
        roomLength: roomL,
        roomWidth: roomW,
        flightWidth: geom.flightWidth || 1.1,
        wellGap: geom.wellGap || 0.2,
        landingDepth: geom.landingDepth || 1.2,
        treadMm: geom.treadMm || 275,
        riserMm: geom.riserMm || 160,
        riserCount: geom.riserCount || 10,
        treadCount: geom.treadCount || 9,
        waistThicknessMm: geom.waistThicknessMm || 160,
        wallThicknessMm: geom.wallThicknessMm || 230,
        hasLeftDoor: entry.hasLeftDoor !== undefined ? entry.hasLeftDoor : true,
        leftDoorWidth: entry.leftDoorWidth || 1.0,
        hasRightDoor: entry.hasRightDoor !== undefined ? entry.hasRightDoor : true,
        rightDoorWidth: entry.rightDoorWidth || 1.0,
        hasFrontDoor: entry.hasFrontDoor !== undefined ? entry.hasFrontDoor : true,
        frontDoorWidth: entry.frontDoorWidth || 1.2,
        startElevation: currentFloor ? currentFloor.elevationY : activeFloorIndex * 3.2,
        endElevation: currentFloor ? currentFloor.elevationY + 3.2 : (activeFloorIndex + 1) * 3.2,
      }
    );

    addStaircase(newStaircase);
    selectArchitecturalElement(newStaircase.id, 'STAIRCASE');
  };

  // Delete Selected Element handler
  const handleDeleteSelected = () => {
    if (!selectedArchitecturalId) return;
    if (selectedArchitecturalType === 'WALL') {
      deleteWall(selectedArchitecturalId);
    } else if (selectedArchitecturalType === 'DOOR') {
      deleteDoor(selectedArchitecturalId);
    } else if (selectedArchitecturalType === 'WINDOW') {
      deleteWindow(selectedArchitecturalId);
    } else if (selectedArchitecturalType === 'OPENING') {
      deleteOpening(selectedArchitecturalId);
    } else if (selectedArchitecturalType === 'ROOM') {
      deleteRoom(selectedArchitecturalId);
    } else if (selectedArchitecturalType === 'STAIRCASE') {
      deleteStaircase(selectedArchitecturalId);
    } else if (selectedArchitecturalType === 'DIMENSION') {
      deleteDimension(selectedArchitecturalId);
    } else {
      // Check which map contains it
      if (architecturalWalls[selectedArchitecturalId]) deleteWall(selectedArchitecturalId);
      else if (architecturalDoors[selectedArchitecturalId]) deleteDoor(selectedArchitecturalId);
      else if (architecturalWindows[selectedArchitecturalId]) deleteWindow(selectedArchitecturalId);
      else if (architecturalOpenings[selectedArchitecturalId]) deleteOpening(selectedArchitecturalId);
      else if (architecturalRooms[selectedArchitecturalId]) deleteRoom(selectedArchitecturalId);
      else if (architecturalStaircases && architecturalStaircases[selectedArchitecturalId]) deleteStaircase(selectedArchitecturalId);
      else if (architecturalDimensions[selectedArchitecturalId]) deleteDimension(selectedArchitecturalId);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 overflow-hidden font-mono text-xs select-none">
      {/* Top Application Sub-Header */}
      <header className="h-12 bg-slate-900 border-b border-slate-800 px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <FloorSelector
            floorPlans={floorPlans}
            activeFloorIndex={activeFloorIndex}
            onSelectFloor={setActiveFloorIndex}
            showStructuralUnderlay={architecturalSettings.showStructuralUnderlay}
            onToggleStructuralUnderlay={() =>
              updateArchitecturalSettings({
                showStructuralUnderlay: !architecturalSettings.showStructuralUnderlay,
              })
            }
            showPreviousFloorUnderlay={architecturalSettings.showPreviousFloorUnderlay}
            onTogglePreviousFloorUnderlay={() =>
              updateArchitecturalSettings({
                showPreviousFloorUnderlay: !architecturalSettings.showPreviousFloorUnderlay,
              })
            }
            previousFloorOpacity={architecturalSettings.previousFloorOpacity || 0.35}
            onChangePreviousFloorOpacity={(op) => updateArchitecturalSettings({ previousFloorOpacity: op })}
            onCopyFloorPlan={copyFloorPlan}
          />
        </div>

        {/* View Layout Mode Buttons */}
        <div className="flex items-center gap-1.5 bg-slate-800/80 p-1 rounded-lg border border-slate-700">
          <button
            onClick={() => setWorkspaceMode('2D_PLAN')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs transition-colors font-bold ${
              workspaceMode === '2D_PLAN'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layout className="w-3.5 h-3.5" />
            <span>2D Plan</span>
          </button>
          <button
            onClick={() => setWorkspaceMode('SPLIT_2D_3D')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs transition-colors font-bold ${
              workspaceMode === 'SPLIT_2D_3D'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Columns2 className="w-3.5 h-3.5" />
            <span>2D / 3D Split</span>
          </button>
          <button
            onClick={() => setWorkspaceMode('TAKEOFF')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs transition-colors font-bold ${
              workspaceMode === 'TAKEOFF'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Calculator className="w-3.5 h-3.5" />
            <span>Takeoff & Schedules</span>
          </button>
        </div>
      </header>

      {/* Main Workspace Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Toolbar (Shown in 2D and Split Modes) */}
        {workspaceMode !== 'TAKEOFF' && (
          <FloorPlanToolbar
            activeTool={activePlanTool}
            onSelectTool={setActivePlanTool}
            settings={architecturalSettings}
            onUpdateSettings={updateArchitecturalSettings}
            onAutoDetectRooms={handleAutoDetectRooms}
            onUndo={undoArchitecturalAction}
            onRedo={redoArchitecturalAction}
            onFitView={() => {
              // triggers fitView via floor index re-eval
              setActiveFloorIndex(activeFloorIndex);
            }}
            wallThickness={wallThicknessPreset}
            onChangeWallThickness={setWallThicknessPreset}
            doorWidth={doorWidthPreset}
            onChangeDoorWidth={setDoorWidthPreset}
            windowWidth={windowWidthPreset}
            onChangeWindowWidth={setWindowWidthPreset}
            onPlaceDesignedStaircase={handlePlaceDesignedStaircase}
          />
        )}

        {/* Center Workspace Canvas */}
        <div className="flex-1 flex h-full relative overflow-hidden bg-slate-950">
          {workspaceMode === '2D_PLAN' && (
            <FloorPlanCanvas
              activeFloorIndex={activeFloorIndex}
              floorPlans={floorPlans}
              structuralModel={activeModel}
              activeTool={activePlanTool}
              selectedId={selectedArchitecturalId}
              selectedType={selectedArchitecturalType}
              walls={architecturalWalls}
              doors={architecturalDoors}
              windows={architecturalWindows}
              openings={architecturalOpenings}
              rooms={architecturalRooms}
              staircases={architecturalStaircases}
              dimensions={architecturalDimensions}
              settings={architecturalSettings}
              wallThickness={wallThicknessPreset}
              doorWidth={doorWidthPreset}
              windowWidth={windowWidthPreset}
              onSelectElement={selectArchitecturalElement}
              onAddWall={addWall}
              onUpdateWall={updateWall}
              onAddDoor={addDoor}
              onAddWindow={addWindow}
              onAddOpening={addOpening}
              onAddStaircase={addStaircase}
              onUpdateStaircase={updateStaircase}
              onAddDimension={addDimension}
              onAutoDetectRooms={handleAutoDetectRooms}
              onDeleteSelected={handleDeleteSelected}
              onUndo={undoArchitecturalAction}
              onRedo={redoArchitecturalAction}
            />
          )}

          {workspaceMode === 'SPLIT_2D_3D' && (
            <div className="flex-1 flex h-full w-full">
              <div className="w-1/2 h-full border-r border-slate-800 relative">
                <FloorPlanCanvas
                  activeFloorIndex={activeFloorIndex}
                  floorPlans={floorPlans}
                  structuralModel={activeModel}
                  activeTool={activePlanTool}
                  selectedId={selectedArchitecturalId}
                  selectedType={selectedArchitecturalType}
                  walls={architecturalWalls}
                  doors={architecturalDoors}
                  windows={architecturalWindows}
                  openings={architecturalOpenings}
                  rooms={architecturalRooms}
                  staircases={architecturalStaircases}
                  dimensions={architecturalDimensions}
                  settings={architecturalSettings}
                  wallThickness={wallThicknessPreset}
                  doorWidth={doorWidthPreset}
                  windowWidth={windowWidthPreset}
                  onSelectElement={selectArchitecturalElement}
                  onAddWall={addWall}
                  onUpdateWall={updateWall}
                  onAddDoor={addDoor}
                  onAddWindow={addWindow}
                  onAddOpening={addOpening}
                  onAddStaircase={addStaircase}
                  onUpdateStaircase={updateStaircase}
                  onAddDimension={addDimension}
                  onAutoDetectRooms={handleAutoDetectRooms}
                  onDeleteSelected={handleDeleteSelected}
                  onUndo={undoArchitecturalAction}
                  onRedo={redoArchitecturalAction}
                />
              </div>
              <div className="w-1/2 h-full relative">
                <Structural3DViewer />
              </div>
            </div>
          )}

          {workspaceMode === 'TAKEOFF' && (
            <ArchitecturalTakeoffPanel
              walls={architecturalWalls}
              doors={architecturalDoors}
              windows={architecturalWindows}
              openings={architecturalOpenings}
              rooms={architecturalRooms}
              floorPlans={floorPlans}
              activeFloorIndex={activeFloorIndex}
            />
          )}
        </div>

        {/* Right Properties Panel (Shown in 2D and Split Modes) */}
        {workspaceMode !== 'TAKEOFF' && (
          <PlanPropertiesPanel
            selectedId={selectedArchitecturalId}
            selectedType={selectedArchitecturalType}
            walls={architecturalWalls}
            doors={architecturalDoors}
            windows={architecturalWindows}
            openings={architecturalOpenings}
            rooms={architecturalRooms}
            staircases={architecturalStaircases}
            dimensions={architecturalDimensions}
            onUpdateWall={updateWall}
            onDeleteWall={deleteWall}
            onUpdateDoor={updateDoor}
            onDeleteDoor={deleteDoor}
            onUpdateWindow={updateWindow}
            onDeleteWindow={deleteWindow}
            onUpdateOpening={updateOpening}
            onDeleteOpening={deleteOpening}
            onUpdateRoom={updateRoom}
            onDeleteRoom={deleteRoom}
            onUpdateStaircase={updateStaircase}
            onDeleteStaircase={deleteStaircase}
            onDeleteDimension={deleteDimension}
            onOpenStaircaseDesigner={() => setActiveView('staircase-design')}
            onDeselect={() => selectArchitecturalElement(null)}
          />
        )}
      </div>
    </div>
  );
};

export default ArchitecturalPlanView;
