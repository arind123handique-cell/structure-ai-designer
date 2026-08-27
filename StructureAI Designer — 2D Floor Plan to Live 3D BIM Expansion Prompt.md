# STRUCTUREAI DESIGNER — 2D FLOOR PLAN → LIVE 3D BIM EXPANSION

## MASTER IMPLEMENTATION PROMPT

---

# 0. ROLE

You are an expert **Principal Structural Engineer, BIM Architect, Revit-style Parametric Modeling Engineer, Senior React/TypeScript Developer, Three.js Engineer, Quantity Surveying Engineer, and UI/UX Architect**.

You are working on the existing **StructureAI Designer V2.4 Enterprise** application.

The existing application is already a working structural engineering application.

**DO NOT rebuild the application.**

**DO NOT replace the existing 3D viewer.**

**DO NOT replace the existing structural model.**

Your task is to add a new **Architectural 2D Floor Plan Modeling System** that behaves conceptually like a lightweight Revit floor-plan editor.

The primary workflow must become:

```text
2D Floor Plan Sketching
        ↓
Parametric Architectural Model
        ↓
Automatic Live 3D Update
        ↓
Automatic Quantity Takeoff
        ↓
Estimation / Reports / IFC-ready data
```

The 2D plan is NOT just a drawing.

Every wall, door, window, opening and room must be a real parametric model element.

---

# 1. EXISTING APPLICATION CONTEXT

The existing StructureAI Designer application already contains:

- STAAD.Pro `.ANL` parser
- STAAD model normalization
- Structural nodes
- Structural members
- Columns
- Beams
- Slabs
- Footings
- Pile caps
- Shear walls
- Structural design engines
- BBS generation
- PDF reports
- Excel reports
- Quantity estimation
- Three.js 3D structural viewer
- Zustand state management
- IndexedDB persistence
- React 18
- TypeScript strict mode
- Vite
- TailwindCSS
- Lucide React
- Vitest tests

The current architecture uses the structural model as the source for the 3D viewer and estimation system.

The new architectural module must integrate with this existing architecture.

---

# 2. ABSOLUTE RULE — DO NOT BREAK EXISTING FEATURES

Before modifying anything:

1. Inspect the complete repository.
2. Understand the existing architecture.
3. Understand the existing state management.
4. Understand the existing structural model.
5. Understand the existing coordinate system.
6. Understand the existing floor system.
7. Understand the existing Three.js viewer.
8. Understand the existing quantity takeoff engine.
9. Understand the existing project persistence.
10. Understand existing tests.

Run the existing test suite before making modifications.

Do not remove existing functionality.

Do not rewrite existing structural design engines.

Do not replace existing Three.js rendering.

Do not create a second structural model.

Do not break existing STAAD `.ANL` import.

Do not change existing structural design calculations unless absolutely required for integration.

---

# 3. CORE PRODUCT VISION

The final application should behave like this:

```text
                    STRUCTUREAI DESIGNER
                           │
             ┌─────────────┴─────────────┐
             │                           │
       STRUCTURAL MODEL            ARCHITECTURAL MODEL
             │                           │
       Columns                      Walls
       Beams                        Doors
       Slabs                        Windows
       Footings                     Openings
       Pile Caps                    Rooms
       Shear Walls                  Finishes
             │                           │
             └─────────────┬─────────────┘
                           │
                     UNIFIED MODEL
                           │
              ┌────────────┼────────────┐
              │            │            │
              ▼            ▼            ▼
          2D FLOOR       3D MODEL    TAKEOFF
             PLAN
              │            │            │
              └────────────┴────────────┘
                           │
                   ESTIMATION / REPORTS
```

The user should be able to draw the building architecturally in 2D and immediately see the result in 3D.

---

# 4. NEW MAIN MODULE

Create a new application section:

```text
Architectural Plan
```

Suggested route:

```text
/architectural-plan
```

or integrate into the existing routing architecture.

Use the existing application navigation and design system.

Do not create a separate standalone application.

---

# 5. MODULE STRUCTURE

Create an architecture similar to:

```text
src/features/architectural/

├── floor-plan/
│   ├── FloorPlanEditor.tsx
│   ├── FloorPlanCanvas.tsx
│   ├── FloorPlanToolbar.tsx
│   ├── FloorSelector.tsx
│   ├── PlanPropertiesPanel.tsx
│   ├── PlanRenderer.ts
│   ├── SelectionEngine.ts
│   ├── SnapEngine.ts
│   ├── DimensionEngine.ts
│   ├── GeometryEngine.ts
│   ├── WallTool.ts
│   ├── DoorTool.ts
│   ├── WindowTool.ts
│   ├── OpeningTool.ts
│   ├── RoomTool.ts
│   └── ArchitecturalPlanView.tsx
│
├── engines/
│   ├── wallEngine.ts
│   ├── doorEngine.ts
│   ├── windowEngine.ts
│   ├── openingEngine.ts
│   ├── roomEngine.ts
│   ├── architecturalGeometryEngine.ts
│   └── architecturalTakeoffEngine.ts
│
├── types/
│   └── architecturalTypes.ts
│
└── utils/
    ├── coordinateTransform.ts
    ├── measurementUtils.ts
    └── geometryUtils.ts
```

Adapt this to the existing repository.

If equivalent modules already exist, extend them rather than creating duplicates.

---

# 6. UNIFIED BUILDING MODEL

This is one of the most important requirements.

DO NOT create a completely separate architectural model.

Extend the existing building/project model.

The unified model should conceptually contain:

```text
BuildingModel
│
├── Structural Elements
│   ├── Nodes
│   ├── Members
│   ├── Columns
│   ├── Beams
│   ├── Slabs
│   ├── Footings
│   ├── Pile Caps
│   └── Shear Walls
│
└── Architectural Elements
    ├── Walls
    ├── Doors
    ├── Windows
    ├── Openings
    ├── Rooms
    ├── Floor Finishes
    └── Future Architectural Elements
```

The same model must drive:

```text
2D Plan
3D Model
Takeoff
Estimation
Reports
Future IFC
```

---

# 7. PARAMETRIC WALL MODEL

Create a real wall object.

Example:

```typescript
interface ArchitecturalWall {
    id: string;

    floorId: string;

    start: {
        x: number;
        y: number;
    };

    end: {
        x: number;
        y: number;
    };

    thickness: number;

    height: number;

    baseElevation: number;

    topElevation: number;

    wallType: "EXTERNAL" | "INTERNAL" | "CUSTOM";

    material?: string;

    finishInside?: string;

    finishOutside?: string;

    locked?: boolean;
}
```

Adapt this to the existing project types.

Do not blindly duplicate the type if the repository already has an appropriate geometry model.

---

# 8. WALL TYPES

Provide quick presets.

## External Wall

```text
230 mm
```

## Internal Wall

```text
112 mm / 115 mm
```

The user must be able to choose whether the application uses 112 or 115 mm as the project standard.

## Custom Wall

Allow:

```text
75 mm
100 mm
112 mm
115 mm
150 mm
200 mm
230 mm
300 mm
Custom
```

All dimensions must be editable.

---

# 9. WALL CREATION

Workflow:

```text
Click WALL
      ↓
Select Wall Type
      ↓
Click Start Point
      ↓
Move Mouse
      ↓
Show Live Length / Angle
      ↓
Click End Point
      ↓
Create Wall
      ↓
Update Unified Model
      ↓
Update 3D
      ↓
Update Takeoff
```

The wall must be created from actual geometric coordinates.

Do not use screenshots or raster drawings.

---

# 10. WALL DRAWING EXPERIENCE

During wall drawing show:

```text
Length: 4200 mm
Angle: 90°
Thickness: 230 mm
```

Support direct numerical entry.

Example:

```text
Length = 4200
Angle = 90
```

The resulting geometry must be exactly 4200 mm.

---

# 11. WALL CENTERLINE

Each wall must maintain a meaningful centerline.

Support:

```text
Centerline
Inside Face
Outside Face
```

The user should be able to choose which reference is used for dimensions/snapping.

---

# 12. WALL INTERSECTIONS

Automatically clean wall intersections.

Support:

```text
L Junction
T Junction
Cross Junction
Wall End
Wall-to-Wall
```

Avoid visible overlapping wall geometry.

The geometry engine should resolve wall connections cleanly.

---

# 13. WALL EDITING

Support:

```text
Move
Copy
Delete
Trim
Extend
Split
Join
Offset
Rotate
Mirror
Align
Lock
```

Minimum required:

```text
Move
Copy
Delete
Trim
Extend
Split
Offset
```

---

# 14. WALL OFFSET

Implement CAD-style offset.

Example:

```text
Original:

────────────────────────

Offset 230 mm:

────────────────────────
────────────────────────
```

The new wall must be a real parametric wall.

---

# 15. SNAP ENGINE

Implement professional CAD/BIM-style snapping.

Required snap modes:

```text
Endpoint
Midpoint
Center
Intersection
Perpendicular
Parallel
Nearest
Wall Centerline
Wall Face
Column Center
Beam Centerline
Grid Intersection
```

Add:

```text
SNAP ON/OFF
```

Show a visual snap indicator.

---

# 16. GRID

Implement optional plan grid.

Features:

```text
Grid ON/OFF
Grid spacing
Major grid
Minor grid
Snap to grid
Adaptive grid
```

Possible spacing presets:

```text
100 mm
250 mm
500 mm
1000 mm
```

Do not hard-code the grid if project settings can support it.

---

# 17. STRUCTURAL ELEMENTS IN 2D

Existing structural elements must appear in the architectural plan.

Show:

```text
Columns
Beams
Structural walls
Slab boundaries
```

Columns should show their actual designed size.

Example:

```text
┌────────────┐
│     C1     │
│ 450 × 600  │
└────────────┘
```

Beams should show their actual geometry.

Do not create duplicate architectural copies of structural members.

---

# 18. FLOOR SYSTEM

Reuse the application's existing floor/elevation system.

The current project can contain floor levels such as:

```text
0.0 m
Ground Plinth

3.2 m
First Floor

6.4 m
Second Floor

9.6 m
Third Floor

12.8 m
Fourth Floor

16.0 m
Roof
```

Do not hard-code these if the existing project stores floor levels dynamically.

Use the actual project floor data.

---

# 19. FLOOR PLAN SELECTOR

Create a floor selector:

```text
┌─────────────────────────┐
│ FLOOR PLAN              │
│                         │
│ Roof                    │
│ Fourth Floor            │
│ Third Floor             │
│ Second Floor            │
│ First Floor     ACTIVE  │
│ Ground                  │
└─────────────────────────┘
```

Each floor must have independent architectural elements.

---

# 20. COPY FLOOR PLAN

Support:

```text
Copy First Floor → Second Floor
Copy Second Floor → Third Floor
```

When copying:

- Generate new IDs.
- Preserve geometry.
- Preserve relationships.
- Preserve wall-hosted doors/windows.
- Do not duplicate IDs.
- Do not corrupt existing structural data.

---

# 21. PREVIOUS FLOOR UNDERLAY

Add:

```text
Show Previous Floor
```

Previous floor should appear with reduced opacity.

Example:

```text
CURRENT FLOOR
████████████████████

PREVIOUS FLOOR
░░░░░░░░░░░░░░░░░░░░
```

This allows alignment of walls between floors.

---

# 22. DOOR SYSTEM

Create parametric doors.

Conceptual model:

```typescript
interface ArchitecturalDoor {
    id: string;

    floorId: string;

    hostWallId: string;

    position: number;

    width: number;

    height: number;

    sillHeight: number;

    swingDirection: "LEFT" | "RIGHT";

    swingAngle: number;

    doorType: "SINGLE" | "DOUBLE" | "SLIDING";
}
```

Adapt to existing architecture.

---

# 23. DOOR HOSTING

A door MUST be hosted by a wall.

Workflow:

```text
Select Door
↓
Hover Wall
↓
Wall Highlights
↓
Click Location
↓
Door Created
```

Store:

```text
hostWallId
```

Do not allow a normal door to exist independently in empty space.

---

# 24. DOOR 2D SYMBOL

Display a recognizable architectural door symbol.

Example:

```text
───────────────┐
               │
               │╲
               │ ╲
               │  ╲
───────────────┘
```

Support:

```text
Flip Swing
Reverse Hinge
Change Width
Change Height
Change Door Type
```

---

# 25. DOOR PARAMETERS

Default example:

```text
Width = 900 mm
Height = 2100 mm
Sill = 0 mm
```

Allow user modification.

Do not force these values if project defaults already exist.

---

# 26. WINDOW SYSTEM

Create parametric windows.

Conceptual model:

```typescript
interface ArchitecturalWindow {
    id: string;

    floorId: string;

    hostWallId: string;

    position: number;

    width: number;

    height: number;

    sillHeight: number;

    windowType:
        | "SINGLE"
        | "DOUBLE"
        | "SLIDING"
        | "FIXED";
}
```

---

# 27. WINDOW HOSTING

Windows must be hosted by walls.

Workflow:

```text
Select Window
↓
Hover Wall
↓
Wall Highlights
↓
Click Location
↓
Window Created
```

Store:

```text
hostWallId
```

If the wall moves, the window must move with it.

---

# 28. WINDOW PARAMETERS

Example:

```text
Width = 1500 mm
Height = 1200 mm
Sill = 900 mm
```

All values must be editable.

---

# 29. OPENING SYSTEM

Support openings independent of doors/windows.

Parameters:

```text
Opening Width
Opening Height
Sill Height
```

Examples:

```text
Service Opening
Passage
Shaft
Large Opening
MEP Opening
```

---

# 30. WALL-HOST RELATIONSHIP

This is critical.

For every hosted object:

```text
Door → hostWallId
Window → hostWallId
Opening → hostWallId
```

When wall moves:

```text
Wall moves
   ↓
Door moves
Window moves
Opening moves
```

When wall is deleted:

Show:

```text
This wall contains:

2 Doors
3 Windows
1 Opening

Delete wall and hosted elements?
```

Options:

```text
Cancel
Delete Wall Only
Delete Wall + Hosted Elements
```

---

# 31. ROOM SYSTEM

Automatically detect enclosed room boundaries.

Example:

```text
┌──────────────────────────┐
│                          │
│        BEDROOM           │
│                          │
├─────────────┬────────────┤
│             │            │
│   TOILET    │   ROOM     │
│             │            │
└─────────────┴────────────┘
```

Store:

```text
Room ID
Floor ID
Boundary
Area
Perimeter
Name
Type
```

---

# 32. ROOM DETECTION

After walls are drawn:

1. Find wall intersections.
2. Build closed loops.
3. Detect enclosed regions.
4. Calculate area.
5. Calculate perimeter.
6. Allow user to create/confirm room.

Do not create incorrect rooms from ambiguous geometry.

Allow manual room creation.

---

# 33. ROOM LABEL

Display:

```text
BEDROOM 01
14.82 m²
```

Allow:

```text
Rename
Move Label
Hide Label
Show Label
```

---

# 34. DIMENSION ENGINE

Implement:

```text
Horizontal Dimension
Vertical Dimension
Aligned Dimension
Wall-to-Wall
Opening-to-Opening
Column-to-Column
Grid-to-Grid
```

Dimensions must be derived from actual geometry.

Example:

```text
        4200
<──────────────────>

┌──────────────────┐
│                  │
│                  │
└──────────────────┘
```

Do not store fake dimension values.

---

# 35. MEASUREMENT TOOL

Add a measurement tool:

```text
MEASURE
```

Click two points:

```text
Distance:
4200 mm

Angle:
90°
```

Useful for inspection without creating permanent dimensions.

---

# 36. PROPERTY PANEL

When nothing is selected:

Show:

```text
Floor
Grid
Snap
View settings
```

When wall selected:

```text
Element ID
Wall Type
Thickness
Length
Height
Base Level
Top Level
Material
```

When door selected:

```text
Door ID
Host Wall
Width
Height
Sill
Type
Swing
```

When window selected:

```text
Window ID
Host Wall
Width
Height
Sill
Type
```

When room selected:

```text
Room ID
Room Name
Area
Perimeter
Floor
```

Changes must update the model immediately.

---

# 37. 2D FLOOR PLAN UI

Create a professional engineering UI.

Recommended structure:

```text
┌──────────────────────────────────────────────────────────────┐
│ Architectural Plan     Floor: First Floor      2D / 3D     │
├────────────┬─────────────────────────────────────┬───────────┤
│            │                                     │           │
│ TOOLS      │            FLOOR PLAN               │ PROPERTIES│
│            │                                     │           │
│ Select     │                                     │ Element   │
│ Wall       │                                     │ ID        │
│ Door       │                                     │           │
│ Window     │                                     │ Thickness │
│ Opening    │                                     │ Length    │
│ Room       │                                     │ Height    │
│ Dimension  │                                     │           │
│ Measure    │                                     │           │
│            │                                     │           │
├────────────┴─────────────────────────────────────┴───────────┤
│ Status / Snap / Coordinates / Measurements                   │
└──────────────────────────────────────────────────────────────┘
```

Reuse existing application styling.

---

# 38. PLAN TOOLBAR

Create:

```text
SELECT
WALL
DOOR
WINDOW
OPENING
ROOM
DIMENSION
MEASURE
```

Additional:

```text
UNDO
REDO
SNAP
GRID
UNDERLAY
FIT
ZOOM+
ZOOM-
```

---

# 39. KEYBOARD SHORTCUTS

Support:

```text
ESC       Cancel current operation
DELETE    Delete
CTRL+Z    Undo
CTRL+Y    Redo
CTRL+C    Copy
CTRL+V    Paste
CTRL+A    Select all
M         Move
L         Wall
D         Door
W         Window
O         Opening
R         Room
I         Dimension
```

Avoid conflicts with existing shortcuts.

---

# 40. 2D CANVAS

Use the most appropriate rendering technology based on the existing project.

Preferred:

```text
Canvas
```

or:

```text
SVG
```

Choose based on performance.

Do not create hundreds of unnecessary DOM nodes.

The 2D renderer must support:

```text
Zoom
Pan
Selection
Multi-selection
Box selection
Grid
Snapping
Dimensions
Labels
```

---

# 41. COORDINATE SYSTEM

The architectural 2D coordinate system MUST map directly to the existing structural world coordinates.

For example, if existing 3D uses:

```text
World X
World Y = elevation
World Z
```

then plan can use:

```text
Plan X = World X
Plan Y = World Z
Floor elevation = World Y
```

OR whatever mapping the existing application already uses.

Do not invent an incompatible coordinate system.

Create utilities:

```text
worldToPlan()
planToWorld()
```

All engineering dimensions must use actual world coordinates.

---

# 42. LIVE 3D SYNCHRONIZATION

This is the most important feature.

When a wall is created:

```text
2D WALL CREATED
       ↓
Unified Model Updated
       ↓
3D Architectural Wall Generated
```

No manual "Generate 3D" operation should be required.

The same applies to:

```text
Door
Window
Opening
Room
```

---

# 43. EXISTING THREE.JS VIEWER

The existing `Structural3DViewer.tsx` must remain the primary 3D viewer.

Extend it.

Do not replace it.

Add architectural rendering layers:

```text
Structural Layer
Architectural Wall Layer
Door Layer
Window Layer
Opening Layer
Room/Annotation Layer
```

---

# 44. 3D WALL GEOMETRY

For each wall:

```text
Length
×
Thickness
×
Height
```

Generate real Three.js geometry.

Wall must appear at:

```text
baseElevation → topElevation
```

with correct:

```text
X
Y
Z
```

orientation.

---

# 45. 3D WALL OPENINGS

Do not necessarily use expensive CSG for every wall.

Prefer:

```text
Segmented wall geometry
```

when appropriate.

Example:

```text
Left wall section
Door opening
Right wall section
Wall above opening
```

This is likely more performant for large buildings.

Only use CSG if profiling shows acceptable performance.

---

# 46. 3D DOORS

Represent doors in 3D with:

```text
Frame
Leaf
Opening
Swing
```

The minimum requirement is a correct opening and recognizable door geometry.

---

# 47. 3D WINDOWS

Represent windows in 3D with:

```text
Opening
Frame
Glass representation
Sill
```

The minimum requirement is a correct opening and recognizable window geometry.

---

# 48. ARCHITECTURAL 3D VISIBILITY

Add controls:

```text
☑ Structural Model
☑ Architectural Walls
☑ Doors
☑ Windows
☑ Openings
☑ Room Labels
☑ Dimensions
```

These must coexist with existing viewer controls.

---

# 49. 2D ↔ 3D SELECTION

If wall selected in 2D:

```text
2D Wall
   ↓
3D Wall Highlight
```

If selected in 3D:

```text
3D Wall
   ↓
2D Wall Highlight
```

Both must reference the same element ID.

Example:

```text
W-001
```

must represent the same wall everywhere.

---

# 50. 2D / 3D SPLIT MODE

Implement optional split view:

```text
┌────────────────────────┬────────────────────────┐
│                        │                        │
│       2D PLAN          │       3D MODEL        │
│                        │                        │
│                        │                        │
└────────────────────────┴────────────────────────┘
```

Selection must synchronize.

The user should be able to work in 2D while seeing the 3D result.

---

# 51. ARCHITECTURAL TAKEOFF

Integrate architectural geometry with the existing estimation system.

For each wall calculate:

```text
Length
Thickness
Height
Gross Volume
Opening Volume
Net Volume
```

---

# 52. MASONRY TAKEOFF

Formula:

```text
Gross Wall Volume
=
Wall Length × Wall Thickness × Wall Height
```

Then:

```text
Net Masonry
=
Gross Wall Volume
-
Door Opening Volume
-
Window Opening Volume
-
Other Opening Volume
```

Example:

```text
L = 4.20 m
B = 0.23 m
H = 3.20 m

Gross:
4.20 × 0.23 × 3.20
= 3.0912 m³
```

Do not hard-code this example.

Calculate from actual model geometry.

---

# 53. PLASTER TAKEOFF

Calculate:

```text
Internal Plaster Area
External Plaster Area
```

Account for:

```text
Door Openings
Window Openings
Other Openings
```

Provide:

```text
m²
```

for each floor.

---

# 54. DOOR TAKEOFF

Return:

```text
Door ID
Floor
Type
Width
Height
Quantity
Area
```

Example:

```text
D-001
First Floor
Single
900 × 2100
1 No.
1.89 m²
```

---

# 55. WINDOW TAKEOFF

Return:

```text
Window ID
Floor
Type
Width
Height
Quantity
Area
```

---

# 56. FLOOR-WISE ESTIMATION

Provide:

```text
Ground Floor
First Floor
Second Floor
Third Floor
Fourth Floor
Roof
```

For every floor:

```text
Wall Masonry
Internal Plaster
External Plaster
Doors
Windows
Openings
Rooms
```

---

# 57. L × B × H TAKEOFF

Every applicable quantity item must expose:

```text
L
B
H
Quantity
Unit
```

Example:

```text
Wall W-001

L = 4.20 m
B = 0.23 m
H = 3.20 m

Quantity = 3.0912 m³
```

For plaster:

```text
L × H
```

or the actual geometric surface calculation.

Do not artificially force L×B×H where it does not mathematically apply.

---

# 58. ESTIMATION PANEL

Extend the existing estimation UI.

Example:

```text
ARCHITECTURAL QUANTITIES

Item                  Quantity    Unit

Brickwork              84.52       m³
Internal Plaster      512.30       m²
External Plaster      238.40       m²
Doors                    18        Nos
Windows                  26        Nos
Openings                 12        Nos
```

Keep existing structural quantities.

Do not replace them.

---

# 59. FUTURE FINISHES

Design the model to support future:

```text
Flooring
Skirting
Dado
Ceiling
Paint
Waterproofing
```

Do not implement all of these unless needed now.

Make the architecture extensible.

---

# 60. IFC COMPATIBILITY

Prepare architectural objects for future IFC export.

Mappings:

```text
ArchitecturalWall → IFCWALL
Door              → IFCDOOR
Window            → IFCWINDOW
Room              → IFCSPACE
Floor             → IFCBUILDINGSTOREY
```

Do not implement a complete IFC exporter in this task unless required.

The data model must remain IFC-compatible.

---

# 61. PERSISTENCE

Use the existing IndexedDB/project persistence system.

Save:

```text
Architectural Walls
Doors
Windows
Openings
Rooms
Dimensions
Architectural settings
Floor associations
```

Reloading the project must restore the same model.

---

# 62. BACKWARD COMPATIBILITY

Existing projects may have:

```text
No architectural elements
```

They must continue to work.

When loaded:

```text
architecturalElements = []
```

or equivalent safe defaults.

Do not break old projects.

---

# 63. UNDO / REDO

Implement efficient command-based undo/redo.

Commands:

```text
Create Wall
Delete Wall
Move Wall
Resize Wall
Create Door
Move Door
Delete Door
Create Window
Move Window
Delete Window
Create Opening
Create Room
```

Do NOT store a full building-model clone on every mouse movement.

---

# 64. PERFORMANCE

The feature must remain efficient with large projects.

Target support:

```text
100+ Walls
200+ Doors/Windows
1000+ Structural Members
```

Use:

```text
Memoization
Batched rendering
Instanced meshes where useful
Efficient event handling
Lazy calculations
Debounced persistence
Selective geometry updates
```

When one wall changes:

```text
DO NOT
rebuild entire 3D scene
```

Instead:

```text
Update only affected architectural geometry.
```

---

# 65. MEMORY MANAGEMENT

Pay particular attention to:

```text
Three.js Geometry disposal
Three.js Material disposal
Event listeners
Canvas listeners
Mouse handlers
Resize observers
IndexedDB subscriptions
Zustand subscriptions
```

Avoid memory leaks.

This application should remain usable with large models.

---

# 66. VALIDATION

Show warnings for:

```text
Zero-length wall
Invalid thickness
Invalid wall height
Door outside wall
Window outside wall
Opening outside wall
Door overlapping another opening
Window overlapping another opening
Room not closed
Invalid floor
Invalid elevation
```

Use the existing warning infrastructure if possible.

---

# 67. ARCHITECTURAL ELEMENT IDs

Use stable IDs:

```text
W-001
W-002

D-001
D-002

WIN-001
WIN-002

O-001
O-002

R-001
R-002
```

IDs must remain stable through edits.

When copying elements:

```text
W-001 → W-025
```

not the same ID.

---

# 68. ROOM GEOMETRY

Room area must be calculated from actual closed boundary geometry.

For example:

```text
Room Area
=
Polygon Area
```

Do not estimate room area from wall length approximations.

---

# 69. PLAN ORIENTATION

Provide:

```text
North
```

indicator.

Allow:

```text
Rotate Plan
```

if supported by existing coordinate conventions.

The structural world coordinates must remain unchanged.

Plan rotation should be a view transformation, not corrupt model coordinates.

---

# 70. VIEW CONTROLS

Support:

```text
Zoom In
Zoom Out
Fit Plan
Pan
Reset View
Grid
Snap
Underlay
Dimensions
Labels
```

---

# 71. MULTI-SELECTION

Support selecting:

```text
Multiple Walls
Multiple Doors
Multiple Windows
Multiple Architectural Elements
```

Actions:

```text
Move
Delete
Copy
```

where valid.

---

# 72. BOX SELECTION

Allow drag selection:

```text
┌──────────────────────┐
│  SELECTED ELEMENTS   │
│                      │
└──────────────────────┘
```

Respect current selection mode.

---

# 73. WALL ALIGNMENT

Support alignment:

```text
Align Left
Align Right
Align Center
Align Top
Align Bottom
Align to Column
Align to Beam
```

At minimum implement practical wall alignment.

---

# 74. ROOM SELECTION

Click inside a closed room:

```text
Select Room
```

Show:

```text
Room Name
Area
Perimeter
Floor
```

Allow:

```text
Rename
Delete Room definition
```

The walls themselves must remain independent objects.

---

# 75. PLAN PRINT/EXPORT PREPARATION

Structure the plan renderer so it can later support:

```text
PDF
PNG
DXF
CAD
```

Do not implement all exports unless required now.

The underlying geometry must remain vector/parametric.

---

# 76. ENGINEERING UNITS

Use the application's existing internal units.

For display:

```text
mm
m
m²
m³
```

Use appropriate precision.

Examples:

```text
Wall thickness: 230 mm
Wall length: 4.20 m
Room area: 14.82 m²
Masonry: 3.091 m³
```

Never use pixel dimensions for engineering calculations.

---

# 77. RESPONSIVE DESIGN

The editor must work on desktop resolutions used by engineering workflows.

Prioritize:

```text
1366 × 768
1920 × 1080
2560 × 1440
```

Do not compromise the drawing canvas by unnecessarily large sidebars.

---

# 78. DARK/LIGHT THEME

Reuse existing application theme.

The 2D editor must work correctly in:

```text
Light Mode
Dark Mode
```

Use existing theme variables.

Do not hard-code incompatible colors.

---

# 79. ACCESSIBILITY

Provide:

```text
Tooltips
Keyboard shortcuts
Clear active-tool state
Readable labels
Accessible buttons
```

Do not sacrifice engineering functionality for excessive UI decoration.

---

# 80. TESTING

Add Vitest tests.

## WALL TESTS

Test:

```text
Wall creation
Wall length
Wall thickness
Wall height
Coordinate conversion
Wall intersections
Wall offset
Wall split
Wall movement
```

## DOOR TESTS

Test:

```text
Door creation
Wall hosting
Door position
Door movement
Door opening
Wall movement propagation
```

## WINDOW TESTS

Test:

```text
Window creation
Wall hosting
Window position
Window opening
Wall movement propagation
```

## OPENING TESTS

Test:

```text
Opening creation
Opening dimensions
Opening host
Opening movement
```

## ROOM TESTS

Test:

```text
Closed loop detection
Room area
Room perimeter
Room naming
```

## TAKEOFF TESTS

Test:

```text
Gross wall volume
Door deduction
Window deduction
Net masonry
Plaster area
Door quantity
Window quantity
```

## SYNCHRONIZATION TESTS

Test:

```text
2D Wall → 3D Wall
2D Door → 3D Door
2D Window → 3D Window
2D Opening → 3D Opening
Move Wall → Update 3D
Move Wall → Move Door
Move Wall → Move Window
Delete Wall → Update 3D
```

---

# 81. ACCEPTANCE WORKFLOW

The implementation must pass this real-world workflow:

```text
1. Open StructureAI Designer.

2. Import a STAAD `.ANL` model.

3. Existing structural 3D model appears exactly as before.

4. Open Architectural Plan.

5. Select First Floor.

6. Existing structural columns appear in 2D.

7. Existing beams appear in 2D.

8. Activate WALL.

9. Select 230 mm External Wall.

10. Draw wall between structural columns.

11. Enter exact length if required.

12. Wall appears in 2D.

13. Wall immediately appears in 3D.

14. Activate INTERNAL WALL.

15. Select 112/115 mm.

16. Draw room separation.

17. 3D updates.

18. Activate DOOR.

19. Click on wall.

20. Enter:
    Width = 900 mm
    Height = 2100 mm

21. Door opening appears in 3D.

22. Activate WINDOW.

23. Click wall.

24. Enter:
    Width = 1500 mm
    Height = 1200 mm
    Sill = 900 mm

25. Window opening appears in 3D.

26. Move wall.

27. Door moves with wall.

28. Window moves with wall.

29. Room boundary updates.

30. Room area updates.

31. Masonry quantity updates.

32. Plaster quantity updates.

33. Door quantity updates.

34. Window quantity updates.

35. Save project.

36. Close/reload project.

37. Architectural elements are restored.

38. Structural model remains intact.

39. Existing design calculations remain intact.

40. Existing tests remain passing.
```

---

# 82. EXAMPLE USER WORKFLOW

A typical engineer should be able to do this:

```text
SELECT FLOOR
      ↓
SEE STRUCTURAL COLUMNS/BEAMS
      ↓
DRAW 230mm EXTERNAL WALL
      ↓
DRAW 112/115mm INTERNAL WALL
      ↓
CREATE ROOMS
      ↓
PLACE DOORS
      ↓
PLACE WINDOWS
      ↓
ADD DIMENSIONS
      ↓
SEE LIVE 3D
      ↓
CHECK MODEL
      ↓
AUTOMATIC TAKEOFF
      ↓
ESTIMATION
```

This should feel natural and fast.

---

# 83. IMPORTANT UX PRINCIPLE

Do not make the user manually enter coordinates whenever possible.

The preferred interaction is:

```text
Click
Move
Snap
Click
Type dimension if needed
Enter
```

The software should automatically infer:

```text
Wall direction
Wall host
Door host
Window host
Room boundary
Column alignment
Beam alignment
```

while allowing manual override.

---

# 84. SMART WALL BEHAVIOUR

When drawing a wall near a column:

```text
Column
   ↓
┌──────┐
│ C1   │
└──────┘
──────────── Wall
```

automatically offer snap to:

```text
Column Center
Column Face
Beam Center
Beam Face
```

Show a visual snap indicator.

---

# 85. SMART DOOR/WINDOW BEHAVIOUR

When hovering over a wall:

```text
Wall highlights
```

When moving door:

```text
Distance from wall endpoint
Distance from wall center
```

may be shown.

Example:

```text
← 1200 mm → [ DOOR ] ← 2080 mm →
```

This helps accurate architectural planning.

---

# 86. REAL-TIME MODEL UPDATE

Do not wait for Save.

Every valid edit should update:

```text
2D Model
↓
Unified State
↓
3D
↓
Takeoff
```

Use efficient state updates.

---

# 87. STATE MANAGEMENT

Prefer the existing Zustand store.

Possible structure:

```text
architecturalElements
architecturalWalls
architecturalDoors
architecturalWindows
architecturalOpenings
architecturalRooms
architecturalDimensions
selectedArchitecturalElement
activeFloorId
activePlanTool
snapSettings
gridSettings
```

Do not duplicate state unnecessarily.

---

# 88. STATE NORMALIZATION

Prefer normalized state where appropriate:

```text
wallsById
doorsById
windowsById
openingsById
roomsById
```

and relationships:

```text
wall.hostedDoors
wall.hostedWindows
wall.hostedOpenings
```

or equivalent derived relationships.

Avoid deeply nested mutable structures that cause excessive rerenders.

---

# 89. GEOMETRY ENGINE

Create reusable geometry utilities.

Required operations:

```text
distance()
angle()
projectPointToLine()
nearestPoint()
lineIntersection()
offsetLine()
splitLine()
extendLine()
trimLine()
polygonArea()
polygonPerimeter()
```

Use robust numerical tolerances.

Avoid fragile floating-point equality.

---

# 90. ARCHITECTURAL TAKEOFF ENGINE

Create:

```text
architecturalTakeoffEngine.ts
```

It should consume the unified architectural model.

Return structured results such as:

```typescript
{
    floorId,
    walls: [],
    doors: [],
    windows: [],
    openings: [],
    rooms: [],
    masonryVolume,
    internalPlasterArea,
    externalPlasterArea
}
```

Adapt to the existing estimation architecture.

---

# 91. TAKEOFF TRANSPARENCY

The user must be able to inspect why a quantity was calculated.

For a wall:

```text
Wall W-001

Length       4.20 m
Thickness    0.23 m
Height       3.20 m

Gross Volume:
4.20 × 0.23 × 3.20
= 3.091 m³

Door deduction:
0.90 × 0.23 × 2.10
= 0.435 m³

Window deduction:
1.50 × 0.23 × 1.20
= 0.414 m³

Net masonry:
2.242 m³
```

Use actual model values.

This calculation must be traceable.

---

# 92. ARCHITECTURAL QUANTITY REPORT

Add a section to the existing report system:

```text
ARCHITECTURAL QUANTITIES
```

Include:

```text
Wall Masonry
Internal Plaster
External Plaster
Doors
Windows
Openings
Room Areas
```

Do not remove existing structural design reports.

---

# 93. FLOOR-WISE REPORT

Example:

```text
FIRST FLOOR

Brickwork:
24.52 m³

Internal Plaster:
145.80 m²

External Plaster:
62.40 m²

Doors:
6 Nos

Windows:
8 Nos
```

Then:

```text
SECOND FLOOR
...

TOTAL
...
```

---

# 94. MODEL VALIDATION

Before displaying final takeoff:

Validate:

```text
No invalid wall geometry
No orphan doors
No orphan windows
No orphan openings
No duplicate IDs
Valid floor references
Valid host references
```

If invalid:

```text
Do not silently generate wrong quantities.
```

Show a warning.

---

# 95. ERROR HANDLING

Never crash the whole application because one architectural object is invalid.

Use:

```text
Validation
Warnings
Error boundaries
Graceful fallback
```

Example:

```text
Unable to render wall W-021.
Geometry is invalid.
```

The remaining building must continue rendering.

---

# 96. 3D PERFORMANCE STRATEGY

The architectural model should be a separate rendering layer.

Suggested conceptual structure:

```text
Three.js Scene
│
├── StructuralGroup
│
├── ArchitecturalGroup
│   ├── Walls
│   ├── Doors
│   ├── Windows
│   └── Openings
│
└── AnnotationGroup
```

Do not recreate the entire scene on every state change.

Use element-level updates.

---

# 97. DISPOSAL

Whenever architectural geometry is removed or replaced:

Dispose old:

```text
Geometry
Material
Texture
```

where appropriate.

Avoid GPU memory leaks.

---

# 98. EXISTING 3D MODEL MUST REMAIN UNCHANGED

This requirement is absolute.

The existing:

```text
Columns
Beams
Slabs
Footings
Pile Caps
Shear Walls
```

must continue to render exactly as before.

The new architectural layer is additive.

---

# 99. EXISTING STRUCTURAL DATA MUST NOT BE ALTERED

Drawing a wall must NOT:

```text
Change beam forces
Change column forces
Change STAAD member forces
Change structural design results
Change structural dimensions
```

unless the user explicitly initiates a structural modification workflow.

The architectural system is initially a separate additive layer over the structural model.

---

# 100. FUTURE BIM EXTENSIBILITY

Design the architecture so future modules can be added:

```text
Furniture
MEP
Staircases
Railings
Ceilings
Flooring
Finishes
Room schedules
Material schedules
IFC export
DXF export
PDF floor plans
```

Do not implement unnecessary future features now.

---

# 101. IMPLEMENTATION PHASES

Implement in this order.

## PHASE 1 — REPOSITORY AUDIT

Inspect:

```text
projectStore.ts
types.ts
modelNormalizer.ts
Structural3DViewer.tsx
floorPlanEngine.ts
BuildingDetailsPanel.tsx
estimation engine
reports
IndexedDB
tests
```

Understand the actual implementation before coding.

---

## PHASE 2 — MODEL

Implement:

```text
ArchitecturalWall
ArchitecturalDoor
ArchitecturalWindow
ArchitecturalOpening
ArchitecturalRoom
ArchitecturalDimension
```

Integrate into existing project state.

---

## PHASE 3 — 2D ENGINE

Implement:

```text
Canvas/SVG
Zoom
Pan
Grid
Snap
Selection
Coordinate transformation
```

---

## PHASE 4 — WALL TOOL

Implement:

```text
Wall presets
Wall drawing
Wall editing
Wall intersection
Wall offset
Wall trimming
Wall extension
```

---

## PHASE 5 — DOORS/WINDOWS

Implement:

```text
Hosted doors
Hosted windows
Opening geometry
2D symbols
```

---

## PHASE 6 — ROOMS

Implement:

```text
Closed-loop detection
Room creation
Area
Perimeter
Labels
```

---

## PHASE 7 — 3D

Integrate:

```text
Walls
Doors
Windows
Openings
```

into existing Three.js viewer.

---

## PHASE 8 — 2D/3D LINKING

Implement:

```text
Selection synchronization
Property synchronization
Live updates
```

---

## PHASE 9 — TAKEOFF

Implement:

```text
Masonry
Plaster
Doors
Windows
Openings
Room areas
```

---

## PHASE 10 — PERSISTENCE

Implement IndexedDB persistence.

---

## PHASE 11 — TESTING

Add unit and integration tests.

---

## PHASE 12 — PERFORMANCE

Profile:

```text
2D rendering
3D rendering
State updates
Takeoff
Memory
```

Optimize only where required.

---

# 102. DEVELOPMENT RULE

Do not attempt to implement the entire feature blindly in one giant component.

Use modular architecture.

Avoid:

```text
FloorPlanEditor.tsx = 5000 lines
```

Prefer specialized modules.

---

# 103. CODE QUALITY

Use:

```text
TypeScript strict mode
Strong types
Pure geometry functions
Small reusable functions
Meaningful names
No unnecessary any
No duplicated logic
No dead code
```

Add comments only where engineering/geometric logic is non-obvious.

---

# 104. NO PLACEHOLDER IMPLEMENTATION

Do not deliver:

```text
TODO
Coming Soon
Mock wall
Fake room
Hard-coded 3D
Static example
```

The feature must actually work.

If a feature cannot be fully implemented because the existing repository lacks a necessary capability, identify the limitation explicitly and implement the best compatible foundation.

---

# 105. DO NOT INVENT EXISTING FILE STRUCTURE

Before coding, inspect the repository.

If the repository uses:

```text
src/features/design/
```

or a different structure, integrate into the actual architecture.

Do not blindly create duplicate stores or duplicate model systems.

---

# 106. FINAL VERIFICATION

Run:

```bash
npm run build
```

and:

```bash
npx vitest run
```

Fix all errors.

Check:

```text
TypeScript
ESLint
React warnings
Runtime errors
Memory leaks
Three.js errors
IndexedDB errors
```

---

# 107. FINAL ACCEPTANCE CRITERIA

The task is complete only when all of the following work:

```text
[ ] Architectural Plan module exists
[ ] Floor selector works
[ ] Existing structural model appears in 2D
[ ] Grid works
[ ] Snap works
[ ] 230 mm wall works
[ ] 112/115 mm wall works
[ ] Custom wall works
[ ] Wall dimensions work
[ ] Wall editing works
[ ] Wall offset works
[ ] Wall trim works
[ ] Wall extend works
[ ] Doors work
[ ] Doors are wall-hosted
[ ] Door openings appear in 3D
[ ] Windows work
[ ] Windows are wall-hosted
[ ] Window openings appear in 3D
[ ] Openings work
[ ] Rooms work
[ ] Room areas work
[ ] Dimensions work
[ ] 2D selection works
[ ] 3D selection works
[ ] 2D ↔ 3D selection synchronization works
[ ] Wall movement updates doors/windows
[ ] 3D updates automatically
[ ] Takeoff updates automatically
[ ] Masonry quantities work
[ ] Plaster quantities work
[ ] Door quantities work
[ ] Window quantities work
[ ] Floor-wise quantities work
[ ] Save/reload works
[ ] Undo/redo works
[ ] Existing structural model remains intact
[ ] Existing ANL workflow remains intact
[ ] Existing structural design remains intact
[ ] Existing tests pass
[ ] New tests pass
[ ] Production build passes
```

---

# 108. FINAL USER EXPERIENCE

The final experience should be:

```text
                 SELECT FLOOR
                      ↓
              SEE STRUCTURE
                      ↓
             DRAW 230mm WALL
                      ↓
            DRAW INTERNAL WALL
                      ↓
                 CREATE ROOMS
                      ↓
               PLACE DOORS
                      ↓
              PLACE WINDOWS
                      ↓
               ADD DIMENSIONS
                      ↓
                2D PLAN READY
                      ↓
                LIVE 3D MODEL
                      ↓
             AUTOMATIC TAKEOFF
                      ↓
                ESTIMATION
                      ↓
                 REPORTS
```

The fundamental concept is:

# DRAW ONCE → MODEL ONCE → VIEW EVERYWHERE

A wall drawn in 2D must become a real wall in the building model.

A door placed on that wall must become a real hosted door.

A window placed on that wall must become a real hosted window.

The same objects must appear in 3D.

The same objects must contribute to quantities.

The same objects must persist in the project.

The same objects must eventually be exportable to BIM/IFC.

---

# 109. MOST IMPORTANT ARCHITECTURAL PRINCIPLE

DO NOT BUILD:

```text
2D Drawing
+
Separate 3D Drawing
+
Separate Quantity Calculator
```

Build:

```text
                 SINGLE PARAMETRIC MODEL
                         │
            ┌────────────┼────────────┐
            ↓            ↓            ↓
          2D PLAN       3D VIEW      TAKEOFF
```

This is the foundation of the entire feature.

---

# 110. FINAL INSTRUCTION TO THE AI

Start by inspecting the existing repository.

Do not assume file names or data structures are exactly as described.

Map the existing implementation first.

Then implement the architectural floor-plan system incrementally.

Preserve all existing functionality.

Do not rebuild the existing 3D viewer.

Do not create a separate disconnected model.

Use the existing structural model and coordinate system.

Implement real parametric geometry.

Implement real 2D editing.

Implement real 2D → model → 3D synchronization.

Implement real quantity calculations.

Implement persistence.

Implement testing.

After completion, provide:

```text
1. Files created
2. Files modified
3. Existing architecture reused
4. New architecture
5. Data model
6. 2D rendering approach
7. Snap system
8. Wall/door/window hosting
9. 2D → 3D synchronization
10. Takeoff calculations
11. Persistence
12. Test results
13. Build result
14. Known limitations
15. Recommended next phase
```

Do not stop after creating UI.

The final result must be a **functional production-grade architectural floor-plan modeling system integrated into StructureAI Designer**.

# END OF MASTER PROMPT