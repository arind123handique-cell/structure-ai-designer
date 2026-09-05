import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useProjectStore } from '@/features/projects/projectStore';
import { EtabsMenuBar } from './components/EtabsMenuBar';
import { EtabsToolbar, StoreyElevationItem } from './components/EtabsToolbar';
import { EtabsToolPalette, EtabsDrawTool } from './components/EtabsToolPalette';
import { EtabsModelExplorer } from './components/EtabsModelExplorer';
import { EtabsPlanCanvas } from './components/EtabsPlanCanvas';
import {
  BuildingWizardModal,
  SaveProjectModal,
  RunAnalysisModal,
  ConcreteDesignModal,
  FrameSectionsModal,
  LoadsAndDiaphragmsModal,
  AssignFrameLoadsModal,
  AssignFrameSectionModal,
  AssignJointRestraintsModal,
  ReplicateStoreyModal,
  AutoSeismicModal,
  TributaryLoadsModal,
} from './components/EtabsModals';
import { EtabsPropertyInspector } from './components/EtabsPropertyInspector';
import { FloorPlanEngine } from '@/features/drawings/floorPlanEngine';
import { TributaryLoadEngine } from '@/features/calculations/tributaryLoadEngine';
import { exportToCsv } from '@/utils/exportUtils';
import { openRegisteredWindow } from '@/components/window/WindowRegistry';
import {
  Layers,
  Sparkles,
  Box,
} from 'lucide-react';

export const EtabsStudioView: React.FC = () => {
  const {
    activeModel,
    activeProject,
    runFemAnalysis,
    runSeismicAnalysis,
    runAllDesignChecks,
    generateBuildingGrid,
    addStructuralNode,
    addStructuralMember,
    addStructuralPlate,
    deleteStructuralElements,
    assignFrameLoads,
    deleteMemberLoads,
    assignMemberSection,
    assignSupportRestraint,
    replicateStory,
    selectedMemberId,
    selectedNodeId,
    setActiveView,
    updateProjectMetadata,
    setNewProjectModalOpen,
    selectMember,
    selectNode,
    updateLoadPatterns,
    updateLoadCombinations,
  } = useProjectStore();

  const [activeTool, setActiveTool] = useState<EtabsDrawTool>('SELECT');
  const [storeyScope, setStoreyScope] = useState<'ONE_STORY' | 'ALL_STORIES'>('ONE_STORY');

  // Modal Window States
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [isSaveOpen, setIsSaveOpen] = useState(false);
  const [isAnalysisOpen, setIsAnalysisOpen] = useState(false);
  const [isDesignOpen, setIsDesignOpen] = useState(false);
  const [isSectionsOpen, setIsSectionsOpen] = useState(false);
  const [isLoadsOpen, setIsLoadsOpen] = useState(false);
  const [isAssignLoadsOpen, setIsAssignLoadsOpen] = useState(false);
  const [isAssignSectionOpen, setIsAssignSectionOpen] = useState(false);
  const [isAssignRestraintsOpen, setIsAssignRestraintsOpen] = useState(false);
  const [isReplicateOpen, setIsReplicateOpen] = useState(false);
  const [isAutoSeismicOpen, setIsAutoSeismicOpen] = useState(false);
  const [isTributaryOpen, setIsTributaryOpen] = useState(false);
  const [diagramType, setDiagramType] = useState<'NONE' | 'BMD' | 'SFD'>('NONE');

  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Pending auto-analysis debounce guard: while the user is rapidly adding members
  // (column/beam/slab clicks) we must NOT re-run the full 3D FEM solve synchronously
  // on the main thread after every single click — that is the primary cause of UI freezes.
  const autoAnalyzeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoAnalyzeSeqRef = useRef(0);

  // Return immediately — debounce schedules the actual solve so awaiting handlers
  // (add column/beam/plate) never stall the main thread while the user is drawing.
  const scheduleAutoAnalyze = async (): Promise<void> => {
    if (autoAnalyzeTimerRef.current) clearTimeout(autoAnalyzeTimerRef.current);
    const seq = ++autoAnalyzeSeqRef.current;
    autoAnalyzeTimerRef.current = setTimeout(async () => {
      if (seq !== autoAnalyzeSeqRef.current) return;
      setIsAnalyzing(true);
      try {
        await runFemAnalysis();
      } finally {
        if (seq === autoAnalyzeSeqRef.current) setIsAnalyzing(false);
      }
    }, 400);
  };

  // Run 3D FEM Analysis Handler — debounced for automatic calls, instant/final for the
  // explicit "Run Analysis" button in the modal.
  const handleExecuteAnalysis = async (flush = false) => {
    if (flush) {
      if (autoAnalyzeTimerRef.current) clearTimeout(autoAnalyzeTimerRef.current);
      autoAnalyzeSeqRef.current++;
      setIsAnalyzing(true);
      try {
        await runFemAnalysis();
      } finally {
        setIsAnalyzing(false);
      }
      return;
    }
    await scheduleAutoAnalyze();
  };

  // Primary "Run Analysis" action: open the full loading-screen + Analysis Complete +
  // Analysis Output flow in a windowed dialog (singleton).
  const handleRunAnalysis = () => {
    setIsAnalysisOpen(false);
    openRegisteredWindow('runAnalysis');
  };

  // Extract structured floor plans from the model using FloorPlanEngine (memoized)
  const floorPlans = useMemo(() => {
    return FloorPlanEngine.extractAllFloorPlans(activeModel);
  }, [activeModel]);

  // Available Storey elevation items
  const availableElevations: StoreyElevationItem[] = useMemo(() => {
    if (!floorPlans || floorPlans.length === 0) {
      return [
        { label: 'Base / Plinth', elevationY: 0.0 },
        { label: '1st Floor', elevationY: 3.2 },
        { label: '2nd Floor', elevationY: 6.4 },
        { label: '3rd Floor', elevationY: 9.6 },
      ];
    }
    return floorPlans.map((fp) => ({
      label: fp.levelName.split('PLAN')[0].trim() || `Level ${fp.levelIndex}`,
      elevationY: fp.elevationY,
    }));
  }, [floorPlans]);

  const [selectedStoreyElevation, setSelectedStoreyElevation] = useState<number>(() => {
    return availableElevations.length > 1 ? availableElevations[1].elevationY : 3.2;
  });

  // Ensure selectedStoreyElevation is updated if floorPlans change
  useEffect(() => {
    if (availableElevations.length > 0) {
      const match = availableElevations.find((e) => Math.abs(e.elevationY - selectedStoreyElevation) < 0.2);
      if (!match) {
        setSelectedStoreyElevation(availableElevations.length > 1 ? availableElevations[1].elevationY : availableElevations[0].elevationY);
      }
    }
  }, [availableElevations]);

  // Keyboard shortcuts for tool selection and delete
  // Delete Selection
  const handleDeleteSelected = async () => {
    if (selectedMemberId) {
      await deleteStructuralElements([], [selectedMemberId]);
    } else if (selectedNodeId) {
      await deleteStructuralElements([selectedNodeId], []);
    }
  };

  useEffect(() => {
    const toolKeyMap: Record<string, EtabsDrawTool> = {
      c: 'QUICK_COLUMN',
      b: 'DRAW_BEAM',
      q: 'QUICK_BEAM',
      s: 'DRAW_SLAB',
      w: 'DRAW_WALL',
      t: 'DRAW_STAIRCASE',
      l: 'ASSIGN_LOAD',
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore when typing in input/textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const key = e.key.toLowerCase();
      if (key === 'escape') {
        setActiveTool('SELECT');
        selectMember(null);
        selectNode(null);
        return;
      }
      if (key === 'delete' || key === 'backspace') {
        handleDeleteSelected();
        return;
      }
      const tool = toolKeyMap[key];
      if (tool) setActiveTool(tool);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleDeleteSelected]);

  // Add Column at 2D coordinate across active floor or all continuous floors
  const handleAddColumn = async (x: number, z: number) => {
    if (!activeModel) return;

    if (storeyScope === 'ALL_STORIES') {
      // Gather all distinct storey elevations sorted ascending
      const rawElevs = availableElevations.map((e) => e.elevationY);
      const uniqueElevs = Array.from(new Set(rawElevs)).sort((a, b) => a - b);
      const elevs = uniqueElevs.length >= 2 ? uniqueElevs : [0, selectedStoreyElevation || 3.2];

      const nodeIds: number[] = [];
      for (let i = 0; i < elevs.length; i++) {
        const y = elevs[i];
        const isSupport = i === 0;
        const nodeId = await addStructuralNode(x, y, z, isSupport);
        nodeIds.push(nodeId);
      }

      // Connect successive floor levels with vertical columns
      for (let i = 0; i < nodeIds.length - 1; i++) {
        await addStructuralMember(
          nodeIds[i],
          nodeIds[i + 1],
          { yd: 0.45, zd: 0.45, name: 'C450x450' },
          'COLUMN'
        );
      }
    } else {
      // ONE_STORY mode: column placed between floor below and selectedStoreyElevation
      const sortedElevs = availableElevations.map((e) => e.elevationY).sort((a, b) => a - b);
      const idx = sortedElevs.findIndex((e) => Math.abs(e - selectedStoreyElevation) < 0.1);
      const botElev = idx > 0 ? sortedElevs[idx - 1] : 0;
      const isGround = botElev === 0 || idx <= 0;

      const baseNodeId = await addStructuralNode(x, botElev, z, isGround);
      const topNodeId = await addStructuralNode(x, selectedStoreyElevation, z, false);

      await addStructuralMember(
        baseNodeId,
        topNodeId,
        { yd: 0.45, zd: 0.45, name: 'C450x450' },
        'COLUMN'
      );
    }
    await handleExecuteAnalysis();
  };

  // Add Beam between 2 joints
  const handleAddBeam = async (startNodeId: number, endNodeId: number) => {
    await addStructuralMember(startNodeId, endNodeId, { yd: 0.45, zd: 0.3, name: 'B300x450' }, 'BEAM');
    await handleExecuteAnalysis();
  };

  // Add Beam between 2 coordinates (creating joints automatically if needed)
  const handleAddBeamAtCoords = async (
    x1: number,
    z1: number,
    x2: number,
    z2: number,
    startNodeId?: number,
    endNodeId?: number
  ) => {
    if (!activeModel) return;

    if (storeyScope === 'ALL_STORIES') {
      // Replicate beam across all framing floor levels (elevations > 0)
      const rawElevs = availableElevations.map((e) => e.elevationY);
      const uniqueElevs = Array.from(new Set(rawElevs)).sort((a, b) => a - b);
      const framingElevs = uniqueElevs.filter((y) => y > 0.1);
      const targetElevs = framingElevs.length > 0 ? framingElevs : [selectedStoreyElevation];

      for (const y of targetElevs) {
        const n1 = await addStructuralNode(x1, y, z1, false);
        const n2 = await addStructuralNode(x2, y, z2, false);
        if (n1 !== n2) {
          await addStructuralMember(n1, n2, { yd: 0.45, zd: 0.3, name: 'B300x450' }, 'BEAM');
        }
      }
    } else {
      const sId = startNodeId ?? (await addStructuralNode(x1, selectedStoreyElevation, z1, false));
      const eId = endNodeId ?? (await addStructuralNode(x2, selectedStoreyElevation, z2, false));
      if (sId !== eId) {
        await addStructuralMember(sId, eId, { yd: 0.45, zd: 0.3, name: 'B300x450' }, 'BEAM');
      }
    }
    await handleExecuteAnalysis();
  };

  // Draw Floor Slab panel from a set of nodes
  const handleAddPlate = async (nodeIds: number[], classification: 'SLAB' | 'WALL' = 'SLAB') => {
    if (nodeIds.length < 3) return;
    await addStructuralPlate(nodeIds, classification);
    await handleExecuteAnalysis();
  };

  // Quick Beam: pick the two nearest columns on the same row/column to join with a beam
  const handleQuickBeam = async (nodeId: number) => {
    // Reuse the standard draw-beam interaction by selecting through node clicks.
    // This is handled in the canvas via the DRAW_BEAM-like node-click flow.
    await handleAddBeamFromNode(nodeId);
  };

  const beamStartRef = useRef<number | null>(null);
  const handleAddBeamFromNode = async (nodeId: number) => {
    if (!activeModel) return;
    if (beamStartRef.current !== null) {
      const start = beamStartRef.current;
      beamStartRef.current = null;
      if (start !== nodeId) {
        await addStructuralMember(start, nodeId, { yd: 0.45, zd: 0.3, name: 'B300x450' }, 'BEAM');
        await handleExecuteAnalysis();
      }
    } else {
      beamStartRef.current = nodeId;
    }
  };

  // Save Project Name
  const handleSaveProjectMetadata = async (name: string, engineer: string, client: string) => {
    if (activeProject) {
      await updateProjectMetadata({
        name,
        engineer,
        client,
      });
    }
  };

  // Export JSON
  const handleExportJson = () => {
    if (!activeProject) return;
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(activeProject, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `${activeProject.metadata.name.replace(/\s+/g, '_')}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Export CSV
  const handleExportCsv = () => {
    if (!activeModel) return;
    const records = Array.from(activeModel.members.values()).map((m) => ({
      'Member ID': m.id,
      Type: m.classification,
      Length: m.length,
      Section: `${m.section.zd || 0.3}x${m.section.yd || 0.45}m`,
      Material: m.materialName,
    }));
    exportToCsv(records, `ETABS_Model_Members_${activeProject?.metadata.name || 'Project'}.csv`);
  };

  // Check if model exists
  const hasModel = activeModel && activeModel.members.size > 0;

  return (
    <div className="flex flex-col h-full w-full bg-slate-950 text-slate-100 overflow-hidden select-none font-sans">
      {/* Top Menu Bar */}
      <EtabsMenuBar
        onNewModel={() => setNewProjectModalOpen(true)}
        onOpenWizard={() => setIsWizardOpen(true)}
        onRunAnalysis={handleRunAnalysis}
        onRunDesign={() => setIsDesignOpen(true)}
        onSave={() => setIsSaveOpen(true)}
        onExportCsv={handleExportCsv}
        onToggle3D={() => {}}
        onTogglePlan={() => {}}
        onToggleSplit={() => {}}
        onOpenSectionsModal={() => setIsSectionsOpen(true)}
        onOpenLoadsModal={() => setIsLoadsOpen(true)}
        onOpenDiaphragmsModal={() => setIsLoadsOpen(true)}
        onOpenAssignLoads={() => setIsAssignLoadsOpen(true)}
        onOpenAssignSection={() => setIsAssignSectionOpen(true)}
        onOpenAssignRestraints={() => setIsAssignRestraintsOpen(true)}
        onOpenReplicateModal={() => setIsReplicateOpen(true)}
        onOpenAutoSeismic={() => setIsAutoSeismicOpen(true)}
        onOpenTributaryLoads={() => setIsTributaryOpen(true)}
        onOpenWindow={openRegisteredWindow}
        isAnalyzing={isAnalyzing}
      />

      {/* Top Action Toolbar (Clean 2D Floor Framing Studio) */}
      <EtabsToolbar
        selectedStoreyElevation={selectedStoreyElevation}
        availableElevations={availableElevations}
        onChangeStoreyElevation={setSelectedStoreyElevation}
        storeyScope={storeyScope}
        onChangeStoreyScope={setStoreyScope}
        onOpenGridSystem={() => openRegisteredWindow('gridSystem')}
        onOpenStoryData={() => openRegisteredWindow('storyData')}
        onNewProject={() => setNewProjectModalOpen(true)}
        onRunAnalysis={handleRunAnalysis}
        onRunDesign={() => setIsDesignOpen(true)}
        onOpenWizard={() => setIsWizardOpen(true)}
        onSave={() => setIsSaveOpen(true)}
        isAnalyzing={isAnalyzing}
      />

      {/* Main Workspace Area (Tool Palette + Model Explorer + 2D Floor Plan Canvas + Inspector) */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Leftmost Tool Palette */}
        <EtabsToolPalette
          activeTool={activeTool}
          onSelectTool={setActiveTool}
          onDeleteSelected={handleDeleteSelected}
          hasSelection={selectedMemberId !== null || selectedNodeId !== null}
        />

        {/* Dockable Model Explorer Tree */}
        <EtabsModelExplorer
          model={activeModel}
          selectedStoreyElevation={selectedStoreyElevation}
          onSelectStoreyElevation={setSelectedStoreyElevation}
          onOpenWizard={() => setIsWizardOpen(true)}
          onRunAnalysis={handleRunAnalysis}
        />

        {/* High-Speed 2D Framing Viewport Area */}
        <div className="flex-1 flex overflow-hidden relative bg-black">
          {!hasModel ? (
            /* Blank Model Initial State with Wizard CTA */
            <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center space-y-4 font-mono">
              <div className="p-4 bg-indigo-900/30 border border-indigo-500/40 rounded-2xl text-indigo-400">
                <Layers className="w-12 h-12" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">ETABS Framing &amp; Structural Design Studio</h2>
                <p className="text-xs text-slate-400 max-w-md mt-1">
                  Draft columns and beams floor-by-floor, assign cross sections, and solve 3D finite element structural frames.
                </p>
              </div>
              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={() => setIsWizardOpen(true)}
                  className="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-bold text-xs shadow-lg transition-all flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Launch Building Wizard</span>
                </button>
                <button
                  onClick={() => generateBuildingGrid(3, 2, 4.5, 4.0, 3, 3.2)}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold text-xs shadow-lg transition-all flex items-center gap-2"
                >
                  <Box className="w-4 h-4" />
                  <span>Create Standard G+2 Building</span>
                </button>
              </div>
            </div>
          ) : (
            /* Full-Width Smooth 2D Story Plan Canvas */
            <div className="w-full h-full relative">
              <EtabsPlanCanvas
                model={activeModel}
                selectedStoreyElevation={selectedStoreyElevation}
                activeTool={activeTool}
                onAddColumn={handleAddColumn}
                onAddBeam={handleAddBeam}
                onAddBeamAtCoords={handleAddBeamAtCoords}
                onQuickBeam={handleAddBeamFromNode}
                onAddPlate={handleAddPlate}
                onAssignLoadToMember={(memberId) => {
                  selectMember(memberId);
                  setIsAssignLoadsOpen(true);
                }}
                selectedMemberId={selectedMemberId}
                onSelectMember={(id) => selectMember(id)}
                selectedNodeId={selectedNodeId}
                onSelectNode={(id) => selectNode(id)}
                diagramType={diagramType}
                onSetDiagramType={setDiagramType}
              />
            </div>
          )}
        </div>

        {/* Right Dockable Property & Forces Inspector */}
        {(selectedMemberId !== null || selectedNodeId !== null) && (
          <EtabsPropertyInspector
            model={activeModel}
            selectedMemberId={selectedMemberId}
            selectedNodeId={selectedNodeId}
            onClose={() => { selectMember(null); selectNode(null); }}
            onOpenAssignLoads={() => setIsAssignLoadsOpen(true)}
            onOpenAssignSection={() => setIsAssignSectionOpen(true)}
            onDeleteSelected={handleDeleteSelected}
          />
        )}
      </div>

      {/* Bottom Status Bar */}
      <div className="bg-slate-900 border-t border-slate-800 px-3 py-1 text-[10px] font-mono text-slate-400 flex items-center justify-between z-20">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>SOLVER: <strong>DIRECT STIFFNESS 3D FEM (6-DOF)</strong></span>
          </span>
          <span>•</span>
          <span>STOREY: <strong className="text-indigo-300">EL. +{selectedStoreyElevation.toFixed(2)}m</strong></span>
          <span>•</span>
          <span>TOTAL MEMBERS: <strong className="text-white">{activeModel?.members.size || 0}</strong></span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-slate-500">Snap: Grid (0.5m), Joint, Center</span>
          <span className="text-slate-500">|</span>
          <span className="text-emerald-400 font-bold">IS 456 / IS 13920 / IS 1893 READY</span>
        </div>
      </div>

      {/* 1. Building Grid Wizard Window Modal */}
      <BuildingWizardModal
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        onGenerate={(baysX, baysZ, widthX, widthZ, stories, storyH) => {
          generateBuildingGrid(baysX, baysZ, widthX, widthZ, stories, storyH);
        }}
      />

      {/* 2. Save Project Window Modal */}
      <SaveProjectModal
        isOpen={isSaveOpen}
        onClose={() => setIsSaveOpen(false)}
        activeProject={activeProject}
        onSaveProjectName={handleSaveProjectMetadata}
        onExportJson={handleExportJson}
        onExportCsv={handleExportCsv}
      />

      {/* 3. 3D FEM Analysis Window Modal */}
      <RunAnalysisModal
        isOpen={isAnalysisOpen}
        onClose={() => setIsAnalysisOpen(false)}
        isAnalyzing={isAnalyzing}
        onExecuteAnalysis={() => handleExecuteAnalysis(true)}
        model={activeModel}
        onViewDiagrams={() => setDiagramType('BMD')}
      />

      {/* 4. Concrete Design Window Modal */}
      <ConcreteDesignModal
        isOpen={isDesignOpen}
        onClose={() => setIsDesignOpen(false)}
        model={activeModel}
        isLoading={isAnalyzing}
        onNavigateToFullDesign={() => {
          setIsDesignOpen(false);
          setActiveView('columns-design');
        }}
        onApplyDesign={async () => {
          setIsAnalyzing(true);
          try {
            await runAllDesignChecks();
            await runFemAnalysis();
          } finally {
            setIsAnalyzing(false);
          }
        }}
      />

      {/* 5. Frame Sections Window Modal */}
      <FrameSectionsModal
        isOpen={isSectionsOpen}
        onClose={() => setIsSectionsOpen(false)}
        model={activeModel}
        selectedMemberId={selectedMemberId}
        onAssignSection={async (section) => {
          if (selectedMemberId !== null) {
            await assignMemberSection([selectedMemberId], section);
            await handleExecuteAnalysis();
          }
        }}
      />

      {/* 6. Loads & Diaphragms Window Modal */}
      <LoadsAndDiaphragmsModal
        isOpen={isLoadsOpen}
        onClose={() => setIsLoadsOpen(false)}
        model={activeModel}
        memberLoadPatterns={
          activeModel?.memberLoads
            ? Array.from(activeModel.memberLoads.entries())
                .flatMap(([, loads]) => loads)
                .map((l) => l.loadPattern)
            : []
        }
      />

      {/* 7. Assign Frame Loads Modal */}
      <AssignFrameLoadsModal
        isOpen={isAssignLoadsOpen}
        onClose={() => setIsAssignLoadsOpen(false)}
        selectedMemberIds={selectedMemberId ? [selectedMemberId] : []}
        onAssignLoads={async (memberIds, load) => {
          await assignFrameLoads(memberIds, load);
          await handleExecuteAnalysis();
        }}
        onDeleteLoads={async (memberIds) => {
          await deleteMemberLoads(memberIds);
          await handleExecuteAnalysis();
        }}
      />

      {/* 8. Assign Frame Section Modal */}
      <AssignFrameSectionModal
        isOpen={isAssignSectionOpen}
        onClose={() => setIsAssignSectionOpen(false)}
        selectedMemberIds={selectedMemberId ? [selectedMemberId] : []}
        onAssignSection={async (memberIds, section) => {
          await assignMemberSection(memberIds, section);
          await handleExecuteAnalysis();
        }}
      />

      {/* 9. Assign Joint Restraints Modal */}
      <AssignJointRestraintsModal
        isOpen={isAssignRestraintsOpen}
        onClose={() => setIsAssignRestraintsOpen(false)}
        selectedNodeIds={selectedNodeId ? [selectedNodeId] : []}
        onAssignRestraint={async (nodeIds, type) => {
          await assignSupportRestraint(nodeIds, type);
          await handleExecuteAnalysis();
        }}
      />

      {/* 10. Replicate Story Modal */}
      <ReplicateStoreyModal
        isOpen={isReplicateOpen}
        onClose={() => setIsReplicateOpen(false)}
        availableElevations={availableElevations}
        currentElevationY={selectedStoreyElevation}
        onReplicate={async (sourceY, targetYs) => {
          await replicateStory(sourceY, targetYs);
        }}
      />

      {/* 11. Auto Seismic Modal (IS 1893:2016) */}
      <AutoSeismicModal
        isOpen={isAutoSeismicOpen}
        onClose={() => setIsAutoSeismicOpen(false)}
        model={activeModel}
        onApplySeismic={async (params) => {
          // Compute IS 1893:2016 parameters, distribute EQX/EQZ lateral loads to
          // the frame, and rerun the FEM analysis with the seismic inputs applied.
          setIsAnalyzing(true);
          try {
            await runSeismicAnalysis({
              seismicZone: (params as any)?.zone,
              soilType: (params as any)?.soil,
              responseReductionFactorR: (params as any)?.R,
              importanceFactorI: (params as any)?.I,
            });
          } finally {
            setIsAnalyzing(false);
          }
        }}
      />

      {/* 12. 45-Degree Tributary Slab Loads Modal */}
      <TributaryLoadsModal
        isOpen={isTributaryOpen}
        onClose={() => setIsTributaryOpen(false)}
        model={activeModel}
        selectedStoreyElevation={selectedStoreyElevation}
        onApplyTributaryLoads={async (floorFinish, liveLoad) => {
          const result = TributaryLoadEngine.computeTributaryLoads(activeModel, undefined, floorFinish, liveLoad);
          if (result.assignedLoads.length > 0) {
            for (const l of result.assignedLoads) {
              await assignFrameLoads([l.memberId], l);
            }
            await handleExecuteAnalysis();
          }
        }}
      />
    </div>
  );
};
