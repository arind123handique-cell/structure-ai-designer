/**
 * Plot / Site Data Model — Stage 1 of the Building Design Pipeline
 *
 * Defines the land plot where the building will be placed: plot boundary,
 * statutory setbacks, building footprint placement and ground level.
 */

export type RoadSide = 'FRONT' | 'BACK' | 'LEFT' | 'RIGHT';

export interface PlotSite {
  /** Plot boundary length in meters (along World X) */
  plotLength: number;
  /** Plot boundary width in meters (along World Z) */
  plotWidth: number;
  /** Plot origin corner in meters (World X) */
  plotOriginX: number;
  /** Plot origin corner in meters (World Z) */
  plotOriginZ: number;
  /** Front setback in meters (side facing the road) */
  frontSetback: number;
  /** Rear setback in meters (opposite the road) */
  rearSetback: number;
  /** Left setback in meters */
  leftSetback: number;
  /** Right setback in meters */
  rightSetback: number;
  /** Building footprint length in meters (along World X) */
  buildingLength: number;
  /** Building footprint width in meters (along World Z) */
  buildingWidth: number;
  /** Building rotation in degrees: 0 | 90 | 180 | 270 */
  buildingRotation: 0 | 90 | 180 | 270;
  /** Building footprint offset in meters from plot origin (World X) */
  buildingOffsetX: number;
  /** Building footprint offset in meters from plot origin (World Z) */
  buildingOffsetZ: number;
  /** Ground / plinth level elevation in meters (World Y) */
  groundElevation: number;
  /** Which side of the plot faces the road */
  roadSide: RoadSide;
}

export const DEFAULT_PLOT_SITE: PlotSite = {
  plotLength: 18,
  plotWidth: 12,
  plotOriginX: 0,
  plotOriginZ: 0,
  frontSetback: 3,
  rearSetback: 2,
  leftSetback: 1.5,
  rightSetback: 1.5,
  buildingLength: 12,
  buildingWidth: 8,
  buildingRotation: 0,
  buildingOffsetX: 3,
  buildingOffsetZ: 3,
  groundElevation: 0,
  roadSide: 'FRONT',
};

export interface PlotValidation {
  valid: boolean;
  errors: string[];
}

/**
 * Validate the plot configuration:
 * - setbacks must not consume the full plot in either direction
 * - building footprint must fit within the plot after setbacks
 */
export function validatePlotSite(plot: PlotSite): PlotValidation {
  const errors: string[] = [];
  if (plot.plotLength <= 0 || plot.plotWidth <= 0) {
    errors.push('Plot dimensions must be greater than zero.');
  }
  if (plot.frontSetback < 0 || plot.rearSetback < 0 || plot.leftSetback < 0 || plot.rightSetback < 0) {
    errors.push('Setbacks cannot be negative.');
  }
  if (plot.frontSetback + plot.rearSetback >= plot.plotLength) {
    errors.push('Front + rear setbacks exceed the plot length.');
  }
  if (plot.leftSetback + plot.rightSetback >= plot.plotWidth) {
    errors.push('Left + right setbacks exceed the plot width.');
  }

  // Building footprint must fit within the buildable envelope
  const maxBuildingX = plot.plotLength - plot.frontSetback - plot.rearSetback;
  const maxBuildingZ = plot.plotWidth - plot.leftSetback - plot.rightSetback;
  if (plot.buildingLength > maxBuildingX + 1e-6) {
    errors.push(`Building length ${plot.buildingLength.toFixed(2)}m exceeds available envelope ${maxBuildingX.toFixed(2)}m.`);
  }
  if (plot.buildingWidth > maxBuildingZ + 1e-6) {
    errors.push(`Building width ${plot.buildingWidth.toFixed(2)}m exceeds available envelope ${maxBuildingZ.toFixed(2)}m.`);
  }

  // Building offset must keep the footprint inside the buildable envelope
  const maxOffsetX = plot.plotLength - plot.buildingLength;
  const maxOffsetZ = plot.plotWidth - plot.buildingWidth;
  if (plot.buildingOffsetX < 0 || plot.buildingOffsetX > maxOffsetX + 1e-6) {
    errors.push('Building X offset places the footprint outside the plot.');
  }
  if (plot.buildingOffsetZ < 0 || plot.buildingOffsetZ > maxOffsetZ + 1e-6) {
    errors.push('Building Z offset places the footprint outside the plot.');
  }

  return { valid: errors.length === 0, errors };
}

export interface PlotMetrics {
  plotArea: number; // m²
  buildableArea: number; // m² (after setbacks)
  buildingFootprintArea: number; // m²
  groundCoverageRatio: number; // 0..1 (footprint / plot)
  buildingSetbackX: number; // actual front setback of footprint
  buildingSetbackZ: number; // actual left setback of footprint
}

export function computePlotMetrics(plot: PlotSite): PlotMetrics {
  const plotArea = plot.plotLength * plot.plotWidth;
  const buildableArea = Math.max(0, plot.plotLength - plot.frontSetback - plot.rearSetback) *
    Math.max(0, plot.plotWidth - plot.leftSetback - plot.rightSetback);
  const buildingFootprintArea = plot.buildingLength * plot.buildingWidth;
  const groundCoverageRatio = plotArea > 0 ? buildingFootprintArea / plotArea : 0;
  return {
    plotArea,
    buildableArea,
    buildingFootprintArea,
    groundCoverageRatio,
    buildingSetbackX: plot.buildingOffsetX,
    buildingSetbackZ: plot.buildingOffsetZ,
  };
}

/** Footprint rectangle corners in world (X, Z) meters, used for drawing and 3D placement */
export function getBuildingFootprintCorners(plot: PlotSite): { x: number; z: number }[] {
  const { buildingOffsetX, buildingOffsetZ, buildingLength, buildingWidth, buildingRotation } = plot;
  const ox = plot.plotOriginX || 0;
  const oz = plot.plotOriginZ || 0;
  const cx = ox + buildingOffsetX + buildingLength / 2;
  const cz = oz + buildingOffsetZ + buildingWidth / 2;
  const rad = (buildingRotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const halfLen = buildingLength / 2;
  const halfWid = buildingWidth / 2;
  const corners = [
    { x: -halfLen, z: -halfWid },
    { x: halfLen, z: -halfWid },
    { x: halfLen, z: halfWid },
    { x: -halfLen, z: halfWid },
  ];
  return corners.map((c) => ({
    x: cx + c.x * cos - c.z * sin,
    z: cz + c.x * sin + c.z * cos,
  }));
}

export interface SetbackOptions {
  front?: number;
  rear?: number;
  left?: number;
  right?: number;
}

/**
 * Automatically fits a PlotSite envelope around a 3D structural model's bounding box
 * with specified or default statutory setbacks.
 */
export function fitPlotSiteToModel(
  bounds: { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number },
  setbacks?: SetbackOptions
): PlotSite {
  const front = setbacks?.front ?? 3.0;
  const rear = setbacks?.rear ?? 2.0;
  const left = setbacks?.left ?? 1.5;
  const right = setbacks?.right ?? 1.5;

  const bLen = Math.max(1, bounds.maxX - bounds.minX);
  const bWid = Math.max(1, bounds.maxZ - bounds.minZ);

  const plotOriginX = parseFloat((bounds.minX - front).toFixed(2));
  const plotOriginZ = parseFloat((bounds.minZ - left).toFixed(2));
  const plotLength = parseFloat((bLen + front + rear).toFixed(2));
  const plotWidth = parseFloat((bWid + left + right).toFixed(2));
  const buildingLength = parseFloat(bLen.toFixed(2));
  const buildingWidth = parseFloat(bWid.toFixed(2));
  const buildingOffsetX = front;
  const buildingOffsetZ = left;
  const groundElevation = parseFloat((bounds.minY || 0).toFixed(2));

  return {
    plotLength,
    plotWidth,
    plotOriginX,
    plotOriginZ,
    frontSetback: front,
    rearSetback: rear,
    leftSetback: left,
    rightSetback: right,
    buildingLength,
    buildingWidth,
    buildingRotation: 0,
    buildingOffsetX,
    buildingOffsetZ,
    groundElevation,
    roadSide: 'FRONT',
  };
}

/**
 * Checks whether a 3D structural model bounding box is completely inside the plot site boundary.
 */
export function isModelInsidePlotSite(
  bounds: { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number },
  plot: PlotSite,
  tolerance: number = 0.05
): { isInside: boolean; outsideReasons: string[] } {
  const reasons: string[] = [];
  const plotX0 = plot.plotOriginX || 0;
  const plotZ0 = plot.plotOriginZ || 0;
  const plotX1 = plotX0 + plot.plotLength;
  const plotZ1 = plotZ0 + plot.plotWidth;

  if (bounds.minX < plotX0 - tolerance) {
    reasons.push(`Model extends ${(plotX0 - bounds.minX).toFixed(2)}m past the front plot boundary`);
  }
  if (bounds.maxX > plotX1 + tolerance) {
    reasons.push(`Model extends ${(bounds.maxX - plotX1).toFixed(2)}m past the rear plot boundary`);
  }
  if (bounds.minZ < plotZ0 - tolerance) {
    reasons.push(`Model extends ${(plotZ0 - bounds.minZ).toFixed(2)}m past the left plot boundary`);
  }
  if (bounds.maxZ > plotZ1 + tolerance) {
    reasons.push(`Model extends ${(bounds.maxZ - plotZ1).toFixed(2)}m past the right plot boundary`);
  }

  return {
    isInside: reasons.length === 0,
    outsideReasons: reasons,
  };
}