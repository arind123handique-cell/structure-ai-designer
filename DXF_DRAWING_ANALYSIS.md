# DXF Drawing Analysis — Beam / Slab Detailing Sheets

Engineering analysis of the three AutoCAD DXF drawings at the repo root, and what the web app
must generate per floor to reproduce them.

Files analysed:

| File | ACADVER | Entities in `ENTITIES` | Anonymous blocks | Sheet extent (model units) |
|---|---|---|---|---|
| `beam 1st floor plan.dxf` | AC1015 (2000) | 397 | 9 dim blocks | X −4100…16000, Y −2500…21798 |
| `beam 1st floor cross section.dxf` | AC1015 (2000) | 7,040 | 540 dim blocks | X −2000…143800, Y −765100…3300 |
| `SLAB.dxf` | AC1032 (2018) | 310 | 37 dim blocks | X 0…48280, Y −3780…4318 |

All three are flat entity lists: **there is not a single `INSERT`** — every symbol is exploded into
lines, polylines, text, solids and hatch. Geometry that looks like a table or a title block is
just plain entities on schedule layers.

---

## 1. Units, scale and annotation conventions

| Header var | Plan / Cross-section | SLAB | Meaning |
|---|---|---|---|
| `$INSUNITS` | 1 | 1 | Nominal *inches* — **wrong**, ignore it |
| `$MEASUREMENT` | 0 | 0 | Imperial flag — also ignore |
| `$LTSCALE` | 1000 | 1 | Linetype scale |
| `$DIMSCALE` | 1 | 1 | Dim scale |

Model units are **millimetres at 1:1** and the standard plot is **1:100**, so all text heights are
`paper_mm × 100`:

| Text height | Where used | Paper size at 1:100 |
|---|---|---|
| 200 | Beam / column marks in plan; dim text | 2.0 mm |
| 225 | Rebar callouts, scale notes, bar-length dims | 2.25 mm |
| 250 | Grid refs, support labels | 2.5 mm |
| 300 | Grid bubbles in plan | 3.0 mm |
| 325 | Beam size labels (`B1:230x450`), section notes | 3.25 mm |

### Scale per detail type (verified against dimension text vs. measured extents)

| Detail | Drawn at | Effective plot scale | Evidence |
|---|---|---|---|
| Cross-sections | **×4 true size** | 1:25 | dim text `230` measured 920 units; `450` measured 1800 units |
| Beam elevation / zone strips | **×2 true size** | 1:50 | dim text `1000` measured 2000; `1030` → 2060; `1180` → 2360; `880` → 1760 |
| Plan + slab sheets | ×1 (true size) | 1:100 | grid spacing and columns measure true mm |

Each section carries a literal note `(SCALE 1:25)` and each strip/support detail a
`(SCALE: H = 1:50  / V = 1:50)` note — so the scale is stated on the sheet, not implied by a viewport.

### Text formatting quirks

* `%%u` prefix = underline toggle → beam/column marks and size labels are underlined.
* `\A1;` prefix on `TEXT`/`MTEXT` = BricsCAD alignment code — strip it when reading, and emit it
  (or plain text) when writing.
* `\X` inside `MTEXT` = line break. Stirrup zone callouts are two lines:
  `"12-2L-T8\X@95 C/C"`.
* `\P` = paragraph break.

---

## 2. Layer specification (colour, all linetypes `Continuous`)

### 2a. `beam 1st floor plan.dxf` — framing plan

| Layer | Colour | Content |
|---|---|---|
| `Grid Line` | 8 | Grid lines + bubble circles + refs `1…8`, `A…G` |
| `Beam` | 3 | Beam outline lines (208 `LINE`) |
| `Beam Nos` | 7 | `B1`…`B62`, h=200, underlined |
| `Column` | 2 | Column outlines (24 `LWPOLYLINE` + 24 `HATCH`) |
| `Column Nos` | 7 | `C1`…`C23`, h=200 |
| `Grid Line` (also holds all dims) | 8 | 9 `DIMENSION` sit on this layer |
| `Label` | 4 | Single `%%u` underline stub |

Carried over but **empty** in this file (template leftovers from a bigger slab/pile-cap sheet):
`Slab`, `Slab Mark`, `Slab Nos`, `Footing`, `Footing Nos`, `Lateral Column`, `Gravity Column`,
`Middle Strip`, `Column Strip`, `Drop Pannel`, `Cut out`, `Staircase`, `MS nos`, `CS nos`,
`DP nos`, `Plan Reinforcement`, `Sxn Reinforcement`, `PCC`, `Hatch`, `ColumnLine`, `Links`,
`IgnoreElementLayer`, `Plan Pile`, `Pile Mark`, `Plan Pilecap`, `Pilecap Mark`, `FlangeMark`,
`Center Line`, `Surface 1`, `Surface 2`, `Section Mark`.

### 2b. `beam 1st floor cross section.dxf` — beam section sheet

| Layer | Colour | Content |
|---|---|---|
| `Concrete Line` | 2 | Section/outline geometry (191 `LINE`, 278 `LWPOLYLINE`, 92 `POLYLINE`) |
| `Reinforcement` | 4 | Bars — 649 closed 2-vertex `POLYLINE`s (straight bars) + 159 `LWPOLYLINE`s with 2–10 vertices and bulges (bent bars, hooks) |
| `Link` | 225 | Stirrup/link rectangles |
| `Spacer` | 4 | Spacer bars (37 `POLYLINE`) |
| `Grid` | 8 | Section grid refs (`A`–`E`) + bubble circles |
| `Labels` | 4 | `B<n>:<b>x<D>` size labels (h=325) |
| `Labels_Support` | 4 | Support beam marks, h=250 (44 unique) |
| `Text` | 31 | Rebar callouts + `(SCALE 1:25)`, h=225 |
| `Text_Scale` | 31 | `(SCALE: H = 1:50  / V = 1:50)`, h=225 |
| `Dimension` | 31 | 538 `DIMENSION` + 444 `LEADER` |
| `Schedule Border` | 60 | 93 closed `POLYLINE` rectangles = strip/table cells |
| `Schedule Line` / `Schedule Header` | 60 / 4 | Table rules and headers |
| `Cut Line` | 31 | 100 `LWPOLYLINE` cut-break symbols |
| `Coupling` | 4 | Couplers (present, unused) |
| `Section Mark` | 5 | Section callouts |
| `Solid` / `Center Line` / `DEFPOINTS` | 25 / 1 / 7 | Hatch/centre-line/defpoint |

All 540 `BLOCK` definitions are anonymous `*D…` dimension blocks — the reusable content lives in
`ENTITIES`, the blocks only hold dimension arrows/text.

### 2c. `SLAB.dxf` — slab detailing sheet

| Layer | Colour | Content |
|---|---|---|
| `Concrete Line` | 2 | 1 `POLYLINE` (41 vertices) = the whole multi-panel slab outline |
| `Reinforcement` | 4 | 49 `POLYLINE` / 106 `VERTEX` = straight bar segments |
| `Solid` | 25 | 1 `HATCH` for the slab section fill |
| `Labels` | 4 | Slab + section + column marks |
| `Text` | 31 | Bar callouts, slab type notes |
| `Dimension` | 31 | 35 `DIMENSION` + 4 `LEADER` |
| `Grid` | 8 | Grid refs |
| `Section Mark` | 5 | Section callout |
| `Schedule *` | 60 / 4 | Table rules/headers |

---

## 3. Annotation vocabulary (exact strings — reproduce verbatim)

### Beam marks and sizes (cross-section sheet)
```
%%uB1:230x450          %%uB4:250x500          %%uB9:300x450
```
62 beams, `B1` … `B62`, five distinct sections:

| Section | Count | Beams |
|---|---|---|
| `230x450` | 33 | most interior/secondary beams |
| `250x500` | 22 | primarily-loaded beams |
| `300x500` | 4 | B48–B51 |
| `230x400` | 2 | B26, B27 |
| `300x450` | 1 | B9 |

### Reinforcement zones (`Labels` layer)
One entry per design zone along the beam, `<mark> (LOC: <start> TO <end>)` in mm from the
beam start node:
```
%%uB8 (LOC: 0 TO 1030)
%%uB8 (LOC: 1030 TO 1055)
%%uB8 (LOC: 1055 TO 3070)
%%uB8 (LOC: 3070 To 4100)
```
17 beams are multi-zone (B2, B3, B4, B8, B10, B15, B16, B23, B24, B26, B27, B30, B32,
B35, B36, B37, B52 — up to 4 zones each); the remaining 45 are single-zone (uniform
reinforcement over the full span).
Note the source tool emits inconsistent casing (`TO` / `To`) — normalise if you regenerate.

### Bar callouts (`Text` layer)
| Callout | Count | Meaning |
|---|---|---|
| `3-T16` | 179 | 3 nos. T16 longitudinal |
| `2-T16` | 133 | 2 nos. T16 longitudinal |
| `4-T16` | 4 | 4 nos. T16 |
| `ST  2L-T8` | 82 | stirrups, 2-legged, T8 (two spaces after `ST`) |
| `ST  2L-T10` | 9 | stirrups, 2-legged, T10 |
| `ST  2L-T12` | 1 | stirrups, 2-legged, T12 |
| `SFR 1-T10EF` | 36 | side-face reinforcement, 1-T10 each face |
| `1-T10EF` | 23 | side-face bar on `Dimension` layer |
| `(SCALE 1:25)` | 92 | per-detail scale note |
| `(SCALE: H = 1:50  / V = 1:50)` | 62 | per-strip scale note |

### Stirrup zone dimensions (on the strips, `Dimension` layer, `\X` line break)
```
8-2L-T8\X@150 C/C        12-2L-T8\X@95 C/C        13-2L-T8\X@200 C/C
11-2L-T10\X@140 C/C      9-2L-T8\X@165 C/C       16-2L-T8\X@130 C/C
```
Format: `<n>-2L-T<dia>` (n = **number of stirrups in that zone** computed from the zone length)
+ `@<spacing> C/C`. Spacings observed: 85, 90, 95, 130, 135, 140, 150, 165, 180, 195, 200 mm.
Bar-length dims on the same strips are plain numbers: `1000`, `1030`, `1180`, `880`.

### Slab annotations
```
%%USLAB S1   %%USLAB S2   %%USLAB S3   %%USLAB S4      (panel marks)
%%USECTION X1-X1                                        (section callout)
C1 C2 C3 C4                                             (support column marks)
(ONE WAY) (150 THK)     (TWO WAY) (150 THK)
T8@150 C/C                                              (×28)
ALT. REINF. BENT U                                      (alternate bars bent up)
```
Dimension values on the slab sheet: `175 220 255 325 400 585 710 875 1020 1065 1300 3500 4250` mm.

### Grid references
Plan: `1 2 3 4 5 6 7 8` (X) × `A B C D E F G` (Y) — 15 lines, each `LINE` + `CIRCLE` bubble + `TEXT`.
Cross-section sheet: `A B C D E` — 78 occurrences (one set per support detail).

---

## 4. Sheet layout rules (cross-section sheet)

* **32 rows, 62 section details.** Rows are packed 1–5 details wide.
* **Row pitch ≈ 25,000 units** (varies 24,700–26,000 with strip height), stacked downward: `B1` is the top row (y ≈ −4,539) and `B62` the
  bottom row (y ≈ −761,939). Y decreases as the mark number increases.
* **Detail column pitch = 8,950 units** for a 4-zone strip (B59–B62 at x = 3,379.3 / 12,329.3 /
  21,479.3 / 30,629.3); narrower strips pack tighter (down to ≈1,875 units), so cell width follows
  the width of the zone strip under the detail.
* Each row contains, bottom-to-top:
  1. beam size label `B<n>:<b>x<D>` (h=325)
  2. `(SCALE: H = 1:50  / V = 1:50)` note
  3. cross-section detail at ×4 (outline, stirrup, longitudinal bars, side-face bars, bar dims)
  4. bar-length dim strip (zone cut-off lengths)
  5. stirrup strip: one `n-2L-Td @s C/C` cell per zone, bordered on `Schedule Border`
  6. `(LOC: a TO b)` zone labels for multi-zone beams
* Grid refs `A…E` and 44 support labels (`Labels_Support`) sit alongside the support details.
* The strip tables extend far to the right (X up to 143,800), which is what makes the sheet
  extent 145,800 × 768,400 units — this is **one model-space sheet set**, not a single A-size sheet.

---

## 5. Mapping to what the app already has

| DXF content | Existing source in the app |
|---|---|
| Beam marks, sizes per floor | `FloorPlanEngine.extractAllFloorPlans()` → `level.beams[]` (`label`, `sectionName`, `startNodeId`, `endNodeId`) |
| Beam design (`2-T16` / `3-T16`, stirrups, side face) | `BeamDesignEngine.design()` → `topRebar` / `bottomRebar` (`barCount`, `mainDiameter`, `callout`), `shear` (`stirrupDiameter`, `stirrupSpacing`, `legs`) |
| Curtailment / zone cut-off lengths (`LOC: a TO b`, `1000`) | `BeamDesignEngine.design()` → `curtailment` (`extraTopSupport.cutoffLength`, `extraBottomMidspan.startOffset/length`, `throughTop/Bottom`) |
| Ductile confinement zones, `SFR` side-face steel | `BeamDuctileResult`, `BeamDrawingSvg` already draws confinement zones |
| Slab thickness / `T8@150 C/C` / one-way vs two-way | `SlabDesignEngine.design()` → `thickness`, bar diameters, `calculateBarSpacing()`, boundary condition (`SlabBoundaryCondition`) — engine exists, **no slab drawing SVG yet** |
| Grid, column marks, bay dims | `FloorPlanLevel` (`bounds`, `columns[].label/x/z`, grid) |

So no new structural data is required: every string on these sheets is derivable from the design
engines the app already runs. The DXF files are **drawing output**, not a data model to import.

---

## 6. Implementation implications

### Delivered code

| File | Purpose |
|---|---|
| `src/features/drawings/sheet/drawingSheet.ts` | Sheet primitive model (`line` / `poly` / `circle` / `solid` / `text`) in mm model units, the DXF layer list with ACI colours, scale constants, and the `SheetBuilder` (with dimension, arrowhead and leader helpers). This is the one source of truth shared by the SVG renderer and a future DXF writer. |
| `src/features/drawings/sheet/DrawingSheetSvg.tsx` | Theme-aware SVG renderer (blueprint dark / AutoCAD white) with a `maxHeight` fit option. |
| `src/features/drawings/sheet/beamSectionSheetEngine.ts` | Per-floor beam reinforcement cross-sections + stirrup zone schedule. Reads `savedBeamDesigns` when present, otherwise runs `BeamDesignEngine` with the same demand estimates as `BbsEngine` so sheets and BBS agree. Emits the exact source vocabulary (`B1:230x450`, `3-T16`, `ST  2L-T8`, `SFR 1-T10EF`, `B8 (LOC: 0 TO 1030)`, `12-2L-T8` / `@95 C/C`). |
| `src/features/drawings/sheet/slabDetailSheetEngine.ts` | Per-floor slab reinforcement plan: panel outlines at true size, `SLAB S1` marks, `(ONE WAY|TWO WAY) (150 THK)`, `T8@150 C/C` callouts, `ALT. REINF. BENT U`, `SECTION X1-X1` cut line and a 1:25 thickness section. Reads `savedSlabDesigns`. |
| `src/features/drawings/FloorPlanViewer.tsx` | The **2D Structural GA Plans** window gains a sheet selector: `GA Framing Plan` (existing), `Beam Sections`, `Slab Details`. |

Layout notes for the generated beam sheet: row pitch stays at the measured 25,200 units, but the
column count is chosen so the finished sheet has a landscape A-series proportion, and each row is
packed with a cursor using that detail's own cell width (strip + margins) — the same variable-width
packing the source drawing uses.

### Still to build

1. **DXF writer** (`src/features/drawings/dxf/dxfWriter.ts`): ASCII DXF with sections `HEADER`
   (`$ACADVER AC1015`, `$INSBASE 0,0,0`, `$EXTMIN`/`$EXTMAX`, `$LTSCALE`, `$INSUNITS 4` for mm),
   `TABLES` (only the layers listed above, colours preserved), `BLOCKS` (empty model/paper space),
   `ENTITIES`, `EOF`. Entity writers needed: `LINE`, `LWPOLYLINE` (with bulge), `POLYLINE`+`VERTEX`
   (2-vertex closed bars, as the source does), `CIRCLE`, `SOLID` (dimension arrowheads), `TEXT`,
   `MTEXT`. Every line is a `code\r\nvalue\r\n` pair.
2. **Emit flat geometry, not dimensions.** The source spends 540 anonymous blocks on real
   `DIMENSION` entities; generating `LINE` + `SOLID` arrowheads + `TEXT` is far simpler and renders
   identically in AutoCAD, LibreCAD, and any in-app viewer.
3. **Three generators**, one per sheet type, mirroring this doc's layout rules:
   `beamPlanSheet.ts` (grid + beams + column hatches + marks + dims, ×1),
   `beamSectionSheet.ts` (rows of ×4 sections + ×2 strips, row pitch 25,000, pitch 8,950),
   `slabSheet.ts` (panel outline + bar segments + `T1@150 C/C` callouts + section mark).
4. **Per-floor iteration:** one DXF per floor per sheet type
   (`STR-101-F1-BeamPlan.dxf`, `STR-201-F1-BeamSections.dxf`, …), driven by
   `FloorPlanEngine.extractAllFloorPlans()` levels and the saved design outputs, matching the
   existing `PdfExportService` naming.
5. **Units gotcha:** the source sets `$INSUNITS 1` (inches) while the geometry is millimetres.
   Emit `$INSUNITS 4` (mm) and `$MEASUREMENT 1` so the files insert at the correct size.
