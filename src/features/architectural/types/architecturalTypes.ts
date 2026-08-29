/**
 * Architectural BIM Data Model Types for StructureAI Designer
 * Parametric 2D Floor Plan -> 3D Building Information Model
 */

export type WallType = 'EXTERNAL' | 'INTERNAL' | 'CUSTOM';
export type WallReferenceLine = 'CENTERLINE' | 'INSIDE_FACE' | 'OUTSIDE_FACE';
export type DoorType =
  | 'SINGLE'
  | 'DOUBLE'
  | 'SLIDING'
  | 'SINGLE_SWING'
  | 'DOUBLE_DOOR'
  | 'FOLDING'
  | 'CUSTOM';
export type DoorSwingDirection = 'LEFT' | 'RIGHT';
export type WindowType =
  | 'SINGLE'
  | 'DOUBLE'
  | 'SLIDING'
  | 'FIXED'
  | 'CASEMENT'
  | 'LOUVER'
  | 'CUSTOM';
export type OpeningType = 'PASSAGE' | 'SHAFT' | 'MEP' | 'ARCHWAY' | 'DUCT_MEP' | 'CUSTOM';
export type DimensionType = 'ALIGNED' | 'HORIZONTAL' | 'VERTICAL';
export type ActivePlanTool =
  | 'SELECT'
  | 'PAN'
  | 'WALL'
  | 'DOOR'
  | 'WINDOW'
  | 'OPENING'
  | 'STAIRCASE'
  | 'ROOM'
  | 'DIMENSION'
  | 'MEASURE'
  | 'SPLIT'
  | 'SPLIT_WALL'
  | 'TRIM'
  | 'EXTEND'
  | 'OFFSET'
  | 'OFFSET_WALL';

export interface Point2D {
  x: number; // in meters (World X)
  y: number; // in meters (World Z)
}

export interface ArchitecturalWall {
  id: string; // e.g. "W-001"
  floorId: string; // e.g. "floor_0", "floor_1"
  start: Point2D;
  end: Point2D;
  thickness: number; // in meters (e.g. 0.23, 0.115, 0.112, 0.15, 0.30)
  height: number; // in meters (e.g. 3.2)
  baseElevation: number; // in meters (World Y)
  topElevation: number; // in meters (World Y)
  wallType: WallType;
  referenceLine?: WallReferenceLine;
  material?: string; // e.g. "Standard Brickwork", "AAC Block"
  finishInside?: string;
  finishOutside?: string;
  locked?: boolean;
  color?: string;
}

export interface ArchitecturalDoor {
  id: string; // e.g. "D-001"
  floorId: string;
  hostWallId: string; // must be hosted by a valid wall
  position: number; // distance in meters along wall from start to center of door
  width: number; // in meters (e.g. 0.90, 1.00, 1.20)
  height: number; // in meters (e.g. 2.10)
  sillHeight: number; // in meters (usually 0)
  swingDirection: DoorSwingDirection;
  swingAngle?: number; // e.g. 90
  doorType: DoorType;
  name?: string;
}

export interface ArchitecturalWindow {
  id: string; // e.g. "WIN-001"
  floorId: string;
  hostWallId: string; // must be hosted by a valid wall
  position: number; // distance in meters along wall from start to center of window
  width: number; // in meters (e.g. 1.50, 1.20, 1.80)
  height: number; // in meters (e.g. 1.20, 1.50)
  sillHeight: number; // in meters (e.g. 0.90)
  windowType: WindowType;
  name?: string;
}

export interface ArchitecturalOpening {
  id: string; // e.g. "O-001"
  floorId: string;
  hostWallId: string; // must be hosted by a valid wall
  position: number; // distance in meters along wall from start to center
  width: number; // in meters
  height: number; // in meters
  sillHeight: number; // in meters
  openingType: OpeningType;
  name?: string;
}

export interface ArchitecturalStaircase {
  id: string; // e.g. "STAIR-001"
  floorId: string; // e.g. "floor_0"
  name: string; // e.g. "Main Dog-Legged Staircase"
  position: Point2D; // in meters (insertion point World X, World Z)
  rotation: number; // in degrees (0, 90, 180, 270)
  staircaseType: 'DOG_LEGGED' | 'OPEN_WELL' | 'STRAIGHT';
  roomLength: number; // Length L in meters (e.g. 4.80)
  roomWidth: number; // Width B in meters (e.g. 2.40)
  flightWidth: number; // Width of each flight in meters (e.g. 1.10)
  wellGap: number; // Central well gap in meters (e.g. 0.20)
  landingDepth: number; // Depth of landings in meters (e.g. 1.20)
  treadMm: number; // Step tread in mm (e.g. 275)
  riserMm: number; // Step riser in mm (e.g. 160)
  riserCount: number; // Number of risers per flight (e.g. 10)
  treadCount: number; // Number of treads per flight (e.g. 9)
  waistThicknessMm: number; // Waist slab thickness in mm (e.g. 160)
  wallThicknessMm: number; // Outer enclosure wall thickness in mm (e.g. 230)
  hasEnclosureWalls: boolean; // Whether to render full enclosure walls around staircase
  hasLeftDoor: boolean; // Left-side landing entry door
  leftDoorWidth: number; // Left door width in meters (e.g. 1.0)
  hasRightDoor: boolean; // Right-side landing entry door
  rightDoorWidth: number; // Right door width in meters (e.g. 1.0)
  hasFrontDoor: boolean; // Front main corridor entry door
  frontDoorWidth: number; // Front door width in meters (e.g. 1.2)
  direction: 'UP' | 'DOWN';
  startElevation: number; // Base floor elevation Y in meters
  endElevation: number; // Next diaphragm floor elevation Y in meters
  locked?: boolean;
  color?: string;
}

export interface ArchitecturalRoom {
  id: string; // e.g. "R-001"
  floorId: string;
  name: string; // e.g. "BEDROOM 01", "LIVING ROOM", "KITCHEN", "TOILET"
  roomType: string;
  boundary: Point2D[]; // closed loop of 2D vertices in meters
  area: number; // in m²
  perimeter: number; // in meters
  labelPosition?: Point2D;
  floorFinish?: string;
  ceilingHeight?: number;
  color?: string;
}

export interface ArchitecturalDimension {
  id: string; // e.g. "DIM-001"
  floorId: string;
  start: Point2D;
  end: Point2D;
  offset: number; // perpendicular distance in meters for dimension line offset
  type?: DimensionType;
  measuredDistance?: number; // in meters
  text?: string;
  textOverride?: string;
}

export interface SnapSettings {
  enabled: boolean;
  endpoint: boolean;
  midpoint: boolean;
  intersection: boolean;
  center: boolean;
  perpendicular: boolean;
  parallel: boolean;
  nearest: boolean;
  columnCenter: boolean;
  columnFace: boolean;
  beamCenterline: boolean;
  grid: boolean;
  tolerance: number; // in meters (e.g. 0.20m = 200mm screen snap radius)
}

export interface GridSettings {
  enabled: boolean;
  spacing: number; // in meters (e.g. 0.50, 1.00)
  majorInterval?: number; // default 4
  adaptive?: boolean;
}

export interface ArchitecturalSettings {
  standardInternalWallThickness: number; // in mm (e.g. 115)
  standardExternalWallThickness: number; // in mm (e.g. 230)
  standardStoryHeight: number; // in meters (e.g. 3.20)
  wallReferenceLine: WallReferenceLine;
  snapSettings: SnapSettings;
  gridSettings: GridSettings;
  showDimensions: boolean;
  showRoomLabels: boolean;
  showStructuralUnderlay: boolean;
  showPreviousFloorUnderlay: boolean;
  previousFloorOpacity: number; // 0.0 to 1.0
}

export interface WallTakeoffItem {
  wallId: string;
  floorId: string;
  wallType: WallType;
  length: number; // meters
  thickness: number; // meters
  height: number; // meters
  grossVolume: number; // m³ = L * T * H
  doorDeductions: { doorId: string; width: number; height: number; volume: number }[];
  windowDeductions: { windowId: string; width: number; height: number; volume: number }[];
  openingDeductions: { openingId: string; width: number; height: number; volume: number }[];
  totalOpeningVolume: number; // m³
  netMasonryVolume: number; // m³ = Gross - Total Deductions
  internalPlasterArea: number; // m²
  externalPlasterArea: number; // m²
}

export interface DoorTakeoffItem {
  doorId: string;
  floorId: string;
  type: DoorType;
  width: number; // mm
  height: number; // mm
  area: number; // m²
  quantity: number;
}

export interface WindowTakeoffItem {
  windowId: string;
  floorId: string;
  type: WindowType;
  width: number; // mm
  height: number; // mm
  sillHeight: number; // mm
  area: number; // m²
  quantity: number;
}

export interface OpeningTakeoffItem {
  openingId: string;
  floorId: string;
  type: OpeningType;
  width: number; // mm
  height: number; // mm
  area: number; // m²
  quantity: number;
}

export interface FloorTakeoffSummary {
  floorId: string;
  floorName: string;
  elevationY: number;
  walls: WallTakeoffItem[];
  doors: DoorTakeoffItem[];
  windows: WindowTakeoffItem[];
  openings: OpeningTakeoffItem[];
  rooms: ArchitecturalRoom[];
  totalGrossMasonryM3: number;
  totalNetMasonryM3: number;
  totalInternalPlasterM2: number;
  totalExternalPlasterM2: number;
  totalDoorCount: number;
  totalWindowCount: number;
  totalOpeningCount: number;
  totalFloorAreaM2: number;
}

export interface BuildingArchitecturalTakeoff {
  floorSummaries: FloorTakeoffSummary[];
  grandTotalNetMasonryM3: number;
  grandTotalGrossMasonryM3: number;
  grandTotalInternalPlasterM2: number;
  grandTotalExternalPlasterM2: number;
  grandTotalDoors: number;
  grandTotalWindows: number;
  grandTotalOpenings: number;
  grandTotalFloorAreaM2: number;
}

export interface ArchitecturalModelData {
  walls: Record<string, ArchitecturalWall>;
  doors: Record<string, ArchitecturalDoor>;
  windows: Record<string, ArchitecturalWindow>;
  openings: Record<string, ArchitecturalOpening>;
  rooms: Record<string, ArchitecturalRoom>;
  dimensions: Record<string, ArchitecturalDimension>;
  settings: ArchitecturalSettings;
}

export interface SnapResult {
  point: Point2D;
  type:
    | 'ENDPOINT'
    | 'MIDPOINT'
    | 'INTERSECTION'
    | 'CENTER'
    | 'PERPENDICULAR'
    | 'PARALLEL'
    | 'NEAREST'
    | 'WALL_CENTERLINE'
    | 'WALL_FACE'
    | 'COLUMN_CENTER'
    | 'COLUMN_FACE'
    | 'BEAM_CENTERLINE'
    | 'GRID'
    | 'NONE';
  targetId?: string | number;
  targetElementId?: string;
  description?: string;
}
