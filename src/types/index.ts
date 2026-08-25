export type UnitSystem = 'SI' | 'MKS' | 'METRIC';

export type DesignCode = 'IS456_2000' | 'IS13920_2016' | 'IS2911_2010' | 'IS1893_2016';

export type ConcreteGrade = 'M20' | 'M25' | 'M30' | 'M35' | 'M40' | 'M50';
export type SteelGrade = 'Fe415' | 'Fe500' | 'Fe500D' | 'Fe550' | 'Fe600';

export interface MaterialProperties {
  grade: ConcreteGrade;
  fck: number; // N/mm2
  rebarGrade: SteelGrade;
  fy: number; // N/mm2
  density: number; // kN/m3
  elasticModulus: number; // N/mm2
  poissonRatio: number;
}

export interface DesignParameters {
  code: DesignCode;
  concreteGrade: ConcreteGrade;
  steelGrade: SteelGrade;
  shearRebarGrade: SteelGrade;
  clearCoverBeam: number; // mm
  clearCoverColumn: number; // mm
  clearCoverFooting: number; // mm
  clearCoverSlab: number; // mm
  clearCoverPile: number; // mm
  maxAggregateSize: number; // mm
  seismicZone: 'II' | 'III' | 'IV' | 'V';
  responseReductionFactor: number; // R
  importanceFactor: number; // I
  soilType: 'I_ROCK' | 'II_MEDIUM' | 'III_SOFT';
  windSpeed: number; // m/s
  windTerrainCategory: 1 | 2 | 3 | 4;
}

export type ElementDesignStatus = 'PASS' | 'WARNING' | 'FAIL' | 'NOT_DESIGNED' | 'MISSING_DATA';
export type StructuralClassification = 'BEAM' | 'COLUMN' | 'WALL' | 'BRACE' | 'SLAB' | 'PILE' | 'UNKNOWN';

export interface ProjectMetadata {
  id: string;
  name: string;
  code: string;
  client: string;
  engineer: string;
  location: string;
  date: string;
  description: string;
  anlFileName?: string;
  anlFileSize?: number;
  staadVersion?: string;
  designSettings: DesignParameters;
  createdAt: string;
  updatedAt: string;
}
