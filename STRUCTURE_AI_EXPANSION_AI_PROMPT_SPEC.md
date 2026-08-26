# SYSTEM PROMPT & ARCHITECTURE SPECIFICATION FOR EXPANDING STRUCTUREAI DESIGNER (V2.4 ENTERPRISE)

> **Instructions for the AI Assistant:**
> You are an expert Principal Structural Engineer & Lead Full-Stack Software Architect specializing in structural design software (STAAD.Pro, ETABS, Revit, Tekla Structural Designer).
> Use this comprehensive context document to analyze the existing codebase of **StructureAI Designer**, generate feature specifications, write clean production-grade code, or design future module expansions.

---

## 1. PROJECT OVERVIEW & APPLICATION PURPOSE

**StructureAI Designer** is a web-based automated structural engineering, design, detail drawing, and quantity estimation application for Reinforced Concrete (RC) buildings designed according to Indian Standard Codes (**IS 456:2000**, **SP 34**, **IS 13920**, **IS 1893**, **IS 875**).

The application imports STAAD.Pro structural analysis models (`.ANL` text files) or user geometry inputs, performs automated design & optimization of all structural components, produces interactive 3D model visualizations, generates CAD Bar Bending Schedule (BBS) drawing sheets, outputs detailed PDF calculation reports, and generates floor-by-floor quantity estimation & centerline takeoff breakdowns.

---

## 2. TECHNICAL STACK & ARCHITECTURE

- **Frontend Core**: React 18, TypeScript (Strict Mode), Vite 6.
- **Styling & UI**: TailwindCSS, Vanilla CSS, Lucide React Icons.
- **3D Graphics & Viewport**: Three.js (`WebGLRenderer`), Custom Raycaster, OrbitControls, 3D Canvas Text Badges, `BoxGeometry` exact member rendering, `EdgesGeometry` sharp outline wireframes.
- **State Management & Storage**: Zustand state store (`projectStore.ts`), IndexedDB for local persistent project & design data storage.
- **PDF & Excel Generation**: `jspdf`, `jspdf-autotable`, `xlsx` / `exceljs`, `html2canvas`.
- **Testing**: Vitest (`npx vitest run`), 88+ automated unit tests.
- **Repository & Version Control**: Git, GitHub (`structure-ai-designer`).

---

## 3. EXISTING FEATURE MODULES & IMPLEMENTATION SUMMARY

### 1. STAAD.Pro `.ANL` Parser & Model Normalizer (`anlParser.ts`, `modelNormalizer.ts`)
- Parses STAAD syntax (`JOINT COORDINATES`, `MEMBER INCIDENCES`, `MEMBER PROPERTY`, `SUPPORTS`, `LOAD`, `MEMBER FORCES`, `ELEMENT FORCES`).
- Extracts 3D nodes, members (classified as `COLUMN`, `BEAM`, `BRACE`), plate elements, load cases, joint reactions, and member internal forces ($N, V_y, V_z, T, M_y, M_z$).

### 2. Interactive 3D Structural Viewer (`Structural3DViewer.tsx`)
- Renders 3D columns and beams using **exact designed rectangular cross-sections ($b \times D$)** rather than generic cylinders.
- Displays edge outline wireframes (`EdgesGeometry`) and dynamic badges (e.g. `C1 450×600mm`).
- Features interactive selection raycasting, layer visibility toggles, wall label toggles, and a dedicated **`Slab Numbers` ON/OFF toggle switch**.
- Real-time sync: Deleting or editing a slab panel in the Slab Design workspace instantly removes or updates its 3D plate geometry and label sprite in the 3D viewport.

### 3. Column Design Engine (`columnDesignEngine.ts`, `ColumnDesignView.tsx`)
- Implements IS 456 axial compression and biaxial bending interaction ($P_u, M_{ux}, M_{uy}$) using parabolic-rectangular concrete stress block and steel strain distribution.
- Performs batch standardization to unify column dimensions across floors ($300\times450\text{mm}, 450\times600\text{mm}$, etc.) and selects longitudinal rebar ($\phi 12 - \phi 32$) and shear ties.

### 4. Beam Design Engine (`beamDesignEngine.ts`, `BeamDesignView.tsx`)
- Flexural design for sagging (mid-span) and hogging (support) bending moments ($M_{u,pos}, M_{u,neg}$).
- Shear design according to IS 456 Clause 40 ($\tau_v, \tau_c, \tau_{c,max}$) and stirrup spacing calculation.
- Basic $L/d$ deflection verification with modification factors ($F_1$).

### 5. Slab Design Engine (`slabDesignEngine.ts`, `SlabDesignView.tsx`)
- One-way and two-way slab flexural moment calculations based on IS 456 Annex D coefficients ($M_{ux}, M_{uy}$).
- Rebar spacing capping: Enforces **maximum spacing of $150\text{mm c/c}$** as per design rules.
- Rebar selection matrix: Allows independent selection of $\phi 8\text{mm}$ top bent-up/cranked bars and $\phi 10\text{mm}$ bottom main mesh bars. Unselecting a diameter dynamically updates the rebar calculations.
- Floor Elevation Designations: Displays floor levels as `0.0m Ground Plinth Level`, `3.2m First Floor Level`, `6.4m Second Floor Level`, `9.6m Third Floor Level`, `12.8m Fourth Floor Level`, and `16.0m Roof Level`.

### 6. Footing & Pile Cap Engine (`footingDesignEngine.ts`, `pileCapDesignEngine.ts`, `combinedPileCapEngine.ts`)
- Isolated pad footing sizing, one-way shear, two-way punching shear, and flexural reinforcement.
- Single and multi-pile cap group auto-detection, pile load distribution, punching shear, and flexural design.

### 7. Shear Wall Design Engine (`shearWallEngine.ts`, `ShearWallDesignView.tsx`)
- Vertical and horizontal distribution steel design, boundary element axial load check, and shear strength verification.

### 8. CAD Drawing Sheets & BBS Engine (`bbsEngine.ts`, `DrawingsView.tsx`)
- Generates Bar Bending Schedule (BBS) tables with IS 2502 / SP 34 standard shape codes (Shape 01 straight, Shape 21 cranked bent-up, Shape 41 stirrups, Shape 51 L-bends).
- Auto-generates 4-layer corner torsion mesh ($T_8 @ 150\text{mm c/c}$ over $L_x/5$) for corner two-way restrained slabs.
- Diameter-wise reinforcement schedule ($\phi 8, \phi 10, \phi 12, \phi 16, \phi 20, \phi 25, \phi 32$) with total steel weights.

### 9. PDF & Excel Reports Generator (`pdfReportGenerator.ts`, `ReportsView.tsx`)
- Executive engineering summary, design code compliance checks, component breakdown tables, and complete steel takeoff matrices.

### 10. Building Details & Estimation Panel (`BuildingDetailsPanel.tsx`, `floorPlanEngine.ts`)
- Clusters building nodes into **6 main floor elevations**: $0.0\text{m}$ Ground Plinth, $3.2\text{m}$ 1st Floor, $6.4\text{m}$ 2nd Floor, $9.6\text{m}$ 3rd Floor, $12.8\text{m}$ 4th Floor, and $16.0\text{m}$ Roof Level.
- Computes **Centerline Length per floor** separately ($L_{beam}, L_{wall}, L_{grid\_perimeter}$).
- Quantity survey takeoff: Concrete volume ($m^3$), steel weight ($MT$), brickwork masonry ($m^3$), wall plastering ($m^2$), and shuttering formwork ($m^2$).
- Export & Copy: Features `[ Export Estimation CSV ]` and `[ Copy Summary ]`.

---

## 4. FUTURE EXPANSION PROMPT TEMPLATES FOR AI ENHANCEMENT

When requesting another AI model to expand this codebase, copy and paste the prompt templates below:

### Prompt 1: Requesting a New Module (e.g. Seismic IS 1893 Equivalent Lateral Force Analysis)
```text
Context: You are expanding StructureAI Designer (Vite + React + TypeScript). Read the application overview above.
Task: Create a new module `seismicAnalysisEngine.ts` and `SeismicAnalysisView.tsx` under `src/features/calculations/`.
Requirements:
1. Calculate Seismic Base Shear (V_b = A_h * W) as per IS 1893 (Part 1): 2016.
2. Inputs: Zone Factor Z (Zone II=0.10, III=0.16, IV=0.24, V=0.36), Importance Factor I (1.0, 1.2, 1.5), Response Reduction Factor R (OMRF=3, SMRF=5), Soil Type (I, II, III).
3. Compute Fundamental Natural Period T_a = 0.075 * h^0.75 (for RC frame) or 0.09 * h / sqrt(d).
4. Compute Spectral Acceleration Ratio (Sa/g).
5. Distribute lateral forces Q_i to each floor level (0.0m, 3.2m, 6.4m, 9.6m, 12.8m, 16.0m) using Q_i = V_b * (W_i * h_i^2) / Sum(W_j * h_j^2).
6. Provide an interactive UI component with key metrics cards, storey shear distribution table, and export buttons.
```

### Prompt 2: Requesting 3D Rebar Cage Visualization Expansion
```text
Context: StructureAI Designer has a Three.js 3D Viewer in `Structural3DViewer.tsx`.
Task: Add a 3D Reinforcement Steel Cage toggle to render actual 3D rebar cylinders inside designed columns and beams when selected.
Requirements:
1. Read `savedColumnDesigns` and `savedBeamDesigns` from `projectStore.ts`.
2. For selected column: Draw longitudinal corner/side bars (e.g. 4-16mm or 6-20mm) as vertical Three.js cylinders running along the column length.
3. Draw rectangular 3D tie stirrups (e.g. 8mm @ 150mm c/c) wrapped around the longitudinal bars with clear cover (40mm).
4. For selected beam: Draw top bars, bottom bars, cranked bent-up bars, and 2-leg stirrups in 3D.
5. Provide a toggle switch `3D Rebar Cage` in the 3D viewer toolbar.
```

### Prompt 3: Requesting BIM IFC File Export
```text
Context: StructureAI Designer models 3D columns, beams, slabs, footings, and walls.
Task: Implement an IFC (Industry Foundation Classes) file exporter `ifcExporter.ts`.
Requirements:
1. Convert `activeModel` members, plates, footings, and slab designs into IFC4 format text string (`IFCPROJECT`, `IFCSITE`, `IFCBUILDING`, `IFCBUILDINGSTOREY`, `IFCCOLUMN`, `IFCBEAM`, `IFCSLAB`, `IFCFOOTING`).
2. Map storeys to 0.0m Ground Plinth, 3.2m First Floor, 6.4m Second Floor, 9.6m Third Floor, 12.8m Fourth Floor, and Roof Level.
3. Export as `.ifc` file download in browser for import into Revit / Tekla / BIM Vision.
```

---

## 5. FILE & FOLDER STRUCTURE SUMMARY

```
D:\PROJECTS APP\DESIGNING STAAD\src
├── app/
│   └── layout/             # AppLayout, Sidebar, TopHeader
├── components/
│   ├── engineering/        # BuildingDetailsPanel, WarningViewer, MemberInspector
│   ├── model-viewer/       # Structural3DViewer (Three.js 3D Viewport)
│   └── tables/             # ElementsTable, MemberForcesTable, JointReactionsTable
├── features/
│   ├── anl/                # ANLImportModal, anlParser, anlTokenizer
│   ├── calculations/       # bbsEngine, calculationPdfService
│   ├── design/             # beam, column, footing, gradebeam, pile, pilecap, shearwall, slab design engines & views
│   ├── drawings/           # FloorPlanViewer, floorPlanEngine, DrawingsView
│   ├── model/              # types.ts, columnNumbering.ts, modelNormalizer.ts
│   ├── projects/           # projectStore.ts, ProjectDashboard, ProjectSettings
│   └── reports/            # pdfReportGenerator.ts, excelExport.ts, ReportsView
└── tests/                  # Vitest test files (88 passing unit tests)
```

---
*StructureAI Designer V2.4 Enterprise Architecture Specification • Indian Standard Structural Engineering Engine*
