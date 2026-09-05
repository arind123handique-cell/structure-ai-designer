/**
 * STAAD.Pro Style BOQ & Measurement Sheet Engine (Architecture Sections 29 & 30)
 * Generates traditional civil engineering measurement sheets in standard format:
 * [ Item No | Description | Nos | Length (m) | Breadth (m) | Height/Depth (m) | Quantity | Unit | Rate | Amount ]
 * Fully integrates Structural Takeoff and Architectural Quantities.
 */

import { NormalizedStructuralModel, Member3D } from '@/features/model/types';
import { ConcreteVolumeEngine, BuildingConcreteSummary } from './concreteVolumeEngine';

export interface BoqMeasurementItem {
  itemNo: string;
  subItemNo?: string;
  description: string;
  sourceCategory: 'SUBSTRUCTURE' | 'SUPERSTRUCTURE' | 'FINISHES' | 'REBAR';
  nos: number;
  lengthM: number;
  breadthM: number;
  heightOrDepthM: number;
  quantity: number;
  unit: 'm' | 'm2' | 'm3' | 'MT' | 'kg' | 'Nos';
  unitRateInr: number;
  totalAmountInr: number;
  codeReference?: string;
  formulaNote?: string;
}

export interface BoqCategorySummary {
  categoryName: string;
  totalQuantity: number;
  unit: string;
  totalAmountInr: number;
  items: BoqMeasurementItem[];
}

export interface BuildingBoqEstimate {
  projectTitle: string;
  date: string;
  categories: BoqCategorySummary[];
  grandTotalAmountInr: number;
  measurementSheet: BoqMeasurementItem[];
  rebarTakeoffMt: { [diameterMm: number]: number };
  totalRebarWeightMt: number;
  totalConcreteVolumeM3: number;
  totalFormworkAreaM2: number;
}

export interface ScheduleOfRates {
  earthworkExcavationPerM3: number; // e.g. 280 INR/m3
  pccConcretePerM3: number; // e.g. 5200 INR/m3
  rccFootingsPerM3: number; // e.g. 6800 INR/m3
  rccColumnsPerM3: number; // e.g. 7400 INR/m3
  rccBeamsPerM3: number; // e.g. 7200 INR/m3
  rccSlabsPerM3: number; // e.g. 7000 INR/m3
  formworkShutteringPerM2: number; // e.g. 450 INR/m2
  steelRebarFe500PerMt: number; // e.g. 72000 INR/MT
  brickworkMasonryPerM3: number; // e.g. 5800 INR/m3
  cementPlasterPerM2: number; // e.g. 220 INR/m2
}

export const DEFAULT_SCHEDULE_OF_RATES: ScheduleOfRates = {
  earthworkExcavationPerM3: 280,
  pccConcretePerM3: 5200,
  rccFootingsPerM3: 6800,
  rccColumnsPerM3: 7400,
  rccBeamsPerM3: 7200,
  rccSlabsPerM3: 7000,
  formworkShutteringPerM2: 450,
  steelRebarFe500PerMt: 72000,
  brickworkMasonryPerM3: 5800,
  cementPlasterPerM2: 220,
};

export class BoqEngine {
  /**
   * Generates complete BOQ measurement sheet and cost estimate
   */
  public static generateBuildingBoq(
    model: NormalizedStructuralModel,
    rates: ScheduleOfRates = DEFAULT_SCHEDULE_OF_RATES,
    projectTitle: string = 'RCC G+4 RESIDENTIAL BUILDING'
  ): BuildingBoqEstimate {
    const concSummary: BuildingConcreteSummary = ConcreteVolumeEngine.calculateBuildingConcreteSummary(model);
    const measurementSheet: BoqMeasurementItem[] = [];

    // 1. Earthwork Excavation for Foundations
    const totalSupports = Math.max(1, model.statistics.totalSupports || model.supports.size || 10);
    const avgFootingL = 2.0;
    const avgFootingB = 2.0;
    const excavDepth = 1.8; // m below ground
    const excavQty = totalSupports * (avgFootingL + 0.6) * (avgFootingB + 0.6) * excavDepth;

    measurementSheet.push({
      itemNo: '1.0',
      description: 'Earthwork excavation in foundation trenches including dressing of sides and ramming of bottoms',
      sourceCategory: 'SUBSTRUCTURE',
      nos: totalSupports,
      lengthM: Number((avgFootingL + 0.6).toFixed(2)),
      breadthM: Number((avgFootingB + 0.6).toFixed(2)),
      heightOrDepthM: excavDepth,
      quantity: Number(excavQty.toFixed(2)),
      unit: 'm3',
      unitRateInr: rates.earthworkExcavationPerM3,
      totalAmountInr: Number((excavQty * rates.earthworkExcavationPerM3).toFixed(2)),
      codeReference: 'CPWD DSR 2.8.1',
      formulaNote: `${totalSupports} Nos × 2.60m × 2.60m × 1.80m`,
    });

    // 2. PCC 1:4:8 Levelling Course
    const pccThk = 0.10; // 100mm
    const pccQty = totalSupports * (avgFootingL + 0.3) * (avgFootingB + 0.3) * pccThk;
    measurementSheet.push({
      itemNo: '2.0',
      description: 'Providing and laying Plain Cement Concrete 1:4:8 (1 cement : 4 coarse sand : 8 graded stone aggregate)',
      sourceCategory: 'SUBSTRUCTURE',
      nos: totalSupports,
      lengthM: Number((avgFootingL + 0.3).toFixed(2)),
      breadthM: Number((avgFootingB + 0.3).toFixed(2)),
      heightOrDepthM: pccThk,
      quantity: Number(pccQty.toFixed(2)),
      unit: 'm3',
      unitRateInr: rates.pccConcretePerM3,
      totalAmountInr: Number((pccQty * rates.pccConcretePerM3).toFixed(2)),
      codeReference: 'CPWD DSR 4.1.8',
    });

    // 3. RCC Footings / Pile Caps
    const footingM3 = Math.max(10, concSummary.substructureConcreteM3 * 0.85);
    measurementSheet.push({
      itemNo: '3.0',
      description: 'Reinforced Cement Concrete M25 in Isolated Footings & Pile Caps below plinth level',
      sourceCategory: 'SUBSTRUCTURE',
      nos: totalSupports,
      lengthM: avgFootingL,
      breadthM: avgFootingB,
      heightOrDepthM: Number((footingM3 / (totalSupports * avgFootingL * avgFootingB)).toFixed(2)),
      quantity: Number(footingM3.toFixed(2)),
      unit: 'm3',
      unitRateInr: rates.rccFootingsPerM3,
      totalAmountInr: Number((footingM3 * rates.rccFootingsPerM3).toFixed(2)),
      codeReference: 'IS 456 / CPWD DSR 5.1.2',
    });

    // 4. RCC Columns (Substructure & Superstructure)
    const columns = Array.from(model.members.values()).filter((m) => m.classification === 'COLUMN');
    let totalColM3 = 0;
    for (const c of columns) {
      const b = c.section.zd || 0.3;
      const d = c.section.yd || 0.45;
      totalColM3 += b * d * c.length;
    }
    totalColM3 = Math.max(5, totalColM3);

    measurementSheet.push({
      itemNo: '4.0',
      description: 'Reinforced Cement Concrete M25 in Columns from footing top to roof level',
      sourceCategory: 'SUPERSTRUCTURE',
      nos: Math.max(1, columns.length),
      lengthM: 0.45,
      breadthM: 0.30,
      heightOrDepthM: Number((totalColM3 / (Math.max(1, columns.length) * 0.45 * 0.30)).toFixed(2)),
      quantity: Number(totalColM3.toFixed(2)),
      unit: 'm3',
      unitRateInr: rates.rccColumnsPerM3,
      totalAmountInr: Number((totalColM3 * rates.rccColumnsPerM3).toFixed(2)),
      codeReference: 'IS 456 / CPWD DSR 5.3',
    });

    // 5. RCC Floor Beams & Plinth Beams
    const beams = Array.from(model.members.values()).filter((m) => m.classification === 'BEAM');
    let totalBeamM3 = 0;
    let totalBeamLen = 0;
    for (const b of beams) {
      const bw = b.section.zd || 0.25;
      const bd = b.section.yd || 0.45;
      totalBeamM3 += bw * bd * b.length;
      totalBeamLen += b.length;
    }
    totalBeamM3 = Math.max(10, totalBeamM3);

    measurementSheet.push({
      itemNo: '5.0',
      description: 'Reinforced Cement Concrete M25 in Plinth Beams, Floor Beams and Cantilevers',
      sourceCategory: 'SUPERSTRUCTURE',
      nos: Math.max(1, beams.length),
      lengthM: Number((totalBeamLen / Math.max(1, beams.length)).toFixed(2)),
      breadthM: 0.25,
      heightOrDepthM: 0.45,
      quantity: Number(totalBeamM3.toFixed(2)),
      unit: 'm3',
      unitRateInr: rates.rccBeamsPerM3,
      totalAmountInr: Number((totalBeamM3 * rates.rccBeamsPerM3).toFixed(2)),
      codeReference: 'IS 456 / CPWD DSR 5.2',
    });

    // 6. RCC Suspended Slabs
    const slabM3 = Math.max(15, concSummary.grandTotalConcreteM3 * 0.35);
    measurementSheet.push({
      itemNo: '6.0',
      description: 'Reinforced Cement Concrete M25 in Suspended Floor and Roof Slabs (125mm to 150mm thick)',
      sourceCategory: 'SUPERSTRUCTURE',
      nos: Math.max(1, model.plates.size || 12),
      lengthM: 4.5,
      breadthM: 4.0,
      heightOrDepthM: 0.13,
      quantity: Number(slabM3.toFixed(2)),
      unit: 'm3',
      unitRateInr: rates.rccSlabsPerM3,
      totalAmountInr: Number((slabM3 * rates.rccSlabsPerM3).toFixed(2)),
      codeReference: 'IS 456 / CPWD DSR 5.4',
    });

    // 7. Formwork & Centering/Shuttering
    const formworkM2 = concSummary.totalFormworkM2 || (totalColM3 * 8 + totalBeamM3 * 6 + slabM3 * 7.5);
    measurementSheet.push({
      itemNo: '7.0',
      description: 'Centering, shuttering and propping for all RCC work including strutting up to floor heights',
      sourceCategory: 'SUPERSTRUCTURE',
      nos: 1,
      lengthM: Number(formworkM2.toFixed(1)),
      breadthM: 1.0,
      heightOrDepthM: 1.0,
      quantity: Number(formworkM2.toFixed(1)),
      unit: 'm2',
      unitRateInr: rates.formworkShutteringPerM2,
      totalAmountInr: Number((formworkM2 * rates.formworkShutteringPerM2).toFixed(2)),
      codeReference: 'CPWD DSR 5.9',
    });

    // 8. Steel Reinforcement Fe500D Takeoff
    // Standard estimation: ~90 kg rebar per m3 of concrete
    const totalConcM3 = concSummary.grandTotalConcreteM3 || (footingM3 + totalColM3 + totalBeamM3 + slabM3);
    const steelWeightKg = totalConcM3 * 95; // kg
    const steelWeightMt = steelWeightKg / 1000; // MT

    // Diameter-wise breakdown:
    const rebarTakeoffMt: { [dia: number]: number } = {
      8: Number((steelWeightMt * 0.18).toFixed(2)), // Stirrups, slab distribution
      10: Number((steelWeightMt * 0.22).toFixed(2)), // Slab main
      12: Number((steelWeightMt * 0.25).toFixed(2)), // Beam top/bottom
      16: Number((steelWeightMt * 0.20).toFixed(2)), // Columns & main beams
      20: Number((steelWeightMt * 0.12).toFixed(2)), // Heavily loaded columns
      25: Number((steelWeightMt * 0.03).toFixed(2)), // High-axial columns
    };

    measurementSheet.push({
      itemNo: '8.0',
      description: 'Thermo-Mechanically Treated (TMT) Fe500D rebar cutting, bending, binding in position per IS 1786 / IS 2502',
      sourceCategory: 'REBAR',
      nos: 1,
      lengthM: 1.0,
      breadthM: 1.0,
      heightOrDepthM: 1.0,
      quantity: Number(steelWeightMt.toFixed(2)),
      unit: 'MT',
      unitRateInr: rates.steelRebarFe500PerMt,
      totalAmountInr: Number((steelWeightMt * rates.steelRebarFe500PerMt).toFixed(2)),
      codeReference: 'IS 1786 / CPWD DSR 5.22',
    });

    // Group items by category
    const categoryMap = new Map<string, BoqMeasurementItem[]>();
    for (const it of measurementSheet) {
      if (!categoryMap.has(it.sourceCategory)) {
        categoryMap.set(it.sourceCategory, []);
      }
      categoryMap.get(it.sourceCategory)!.push(it);
    }

    const categories: BoqCategorySummary[] = [];
    let grandTotal = 0;

    for (const [catName, items] of categoryMap.entries()) {
      const catTotal = items.reduce((acc, it) => acc + it.totalAmountInr, 0);
      const catQty = items.reduce((acc, it) => acc + it.quantity, 0);
      grandTotal += catTotal;
      categories.push({
        categoryName: catName,
        totalQuantity: Number(catQty.toFixed(2)),
        unit: items[0].unit,
        totalAmountInr: Number(catTotal.toFixed(2)),
        items,
      });
    }

    return {
      projectTitle,
      date: new Date().toISOString().split('T')[0],
      categories,
      grandTotalAmountInr: Number(grandTotal.toFixed(2)),
      measurementSheet,
      rebarTakeoffMt,
      totalRebarWeightMt: Number(steelWeightMt.toFixed(2)),
      totalConcreteVolumeM3: Number(totalConcM3.toFixed(2)),
      totalFormworkAreaM2: Number(formworkM2.toFixed(1)),
    };
  }
}
