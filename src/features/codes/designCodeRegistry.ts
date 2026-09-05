/**
 * Modular Structural Design Code Registry (Architecture Section 22)
 * Decouples design code algorithms (IS 456, IS 800, IS 1893, ACI 318, AISC, Eurocode)
 * from structural element definitions and model objects.
 */

export type CodeMaterialType = 'CONCRETE' | 'STEEL' | 'TIMBER' | 'COMPOSITE';

export interface IDesignCode {
  readonly codeId: string;
  readonly codeName: string;
  readonly materialType: CodeMaterialType;
  readonly edition: string;
  readonly country: string;
  readonly supportedMembers: ('BEAM' | 'COLUMN' | 'SLAB' | 'WALL' | 'TRUSS' | 'BRACE' | 'FOOTING')[];
}

export class DesignCodeRegistry {
  private static codes: Map<string, IDesignCode> = new Map();

  static {
    // Register standard international and Indian standard codes
    this.register({
      codeId: 'IS456_2000',
      codeName: 'IS 456:2000 - Plain and Reinforced Concrete',
      materialType: 'CONCRETE',
      edition: '2000 (Reaffirmed 2021)',
      country: 'India',
      supportedMembers: ['BEAM', 'COLUMN', 'SLAB', 'FOOTING'],
    });

    this.register({
      codeId: 'IS13920_2016',
      codeName: 'IS 13920:2016 - Ductile Detailing of RC Structures',
      materialType: 'CONCRETE',
      edition: '2016',
      country: 'India',
      supportedMembers: ['BEAM', 'COLUMN', 'WALL'],
    });

    this.register({
      codeId: 'IS800_2007',
      codeName: 'IS 800:2007 - General Construction in Steel (LSM)',
      materialType: 'STEEL',
      edition: '2007 (Reaffirmed 2022)',
      country: 'India',
      supportedMembers: ['BEAM', 'COLUMN', 'TRUSS', 'BRACE'],
    });

    this.register({
      codeId: 'IS1893_2016',
      codeName: 'IS 1893 (Part 1):2016 - Criteria for Earthquake Resistant Design',
      materialType: 'CONCRETE',
      edition: '2016',
      country: 'India',
      supportedMembers: ['BEAM', 'COLUMN', 'WALL'],
    });

    this.register({
      codeId: 'ACI318_19',
      codeName: 'ACI 318-19 - Building Code Requirements for Structural Concrete',
      materialType: 'CONCRETE',
      edition: '2019',
      country: 'USA',
      supportedMembers: ['BEAM', 'COLUMN', 'SLAB'],
    });

    this.register({
      codeId: 'AISC360_16',
      codeName: 'AISC 360-16 - Specification for Structural Steel Buildings',
      materialType: 'STEEL',
      edition: '2016',
      country: 'USA',
      supportedMembers: ['BEAM', 'COLUMN', 'TRUSS', 'BRACE'],
    });
  }

  public static register(code: IDesignCode): void {
    this.codes.set(code.codeId, code);
  }

  public static getCode(codeId: string): IDesignCode | undefined {
    return this.codes.get(codeId);
  }

  public static getAllCodes(): IDesignCode[] {
    return Array.from(this.codes.values());
  }

  public static getCodesByMaterial(material: CodeMaterialType): IDesignCode[] {
    return Array.from(this.codes.values()).filter((c) => c.materialType === material);
  }
}
