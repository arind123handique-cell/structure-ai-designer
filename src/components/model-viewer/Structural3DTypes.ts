export type RenderMode = 'SOLID' | 'WIREFRAME' | 'ANALYTICAL' | 'XRAY' | 'CLAY';

export type ConceptColorMode =
  | 'TYPE'
  | 'SECTION'
  | 'STORY'
  | 'MATERIAL'
  | 'UTILIZATION'
  | 'CYBERPUNK';

export interface SectionLegendItem {
  key: string;
  name: string;
  colorHex: string;
  colorInt: number;
  count: number;
}

export interface StoryLegendItem {
  elevationY: number;
  label: string;
  colorHex: string;
  colorInt: number;
  memberCount: number;
}

export interface MaterialLegendItem {
  materialName: string;
  colorHex: string;
  colorInt: number;
  count: number;
}
