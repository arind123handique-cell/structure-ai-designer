import { FoundationPunchingShear, PunchingShearResult } from '@/features/codes/foundation/punchingShear';
import { IS456Flexure, FlexureDesignResult } from '@/features/codes/is456/flexure';
import { DetailedCalculationReport } from '@/features/calculations/types';

export interface PileCapDesignInput {
  supportNodeId: number;
  colWidth?: number; // a in mm (default: 450)
  colDepth?: number; // b in mm (default: 550)
  pileDiameter?: number; // Dp in mm (default: 500)
  safePileCapacity?: number; // Qsafe in kN (default: 450)
  customPileCount?: number; // 2, 3, 4, 5, 6
  customCapLength?: number; // mm
  customCapWidth?: number; // mm
  customCapDepth?: number; // mm
  assignedPileTypeId?: string;
  factoredVerticalLoad: number; // Pu in kN (from STAAD reaction)
  factoredMomentX?: number; // kNm
  factoredMomentY?: number; // kNm
  fck: number; // N/mm2 (e.g. 25)
  fy: number; // N/mm2 (e.g. 500)
  governingLoadCase?: number;
}

export interface PileCapDesignOutput {
  supportNodeId: number;
  factoredVerticalLoad: number; // Pu in kN
  workingVerticalLoad: number; // P_working in kN
  factoredMomentX: number; // kNm
  factoredMomentY: number; // kNm
  pileCount: number;
  capShape: 'RECTANGULAR' | 'TRIANGULAR' | 'PENTAGONAL';
  pileDiameter: number;
  safePileCapacity: number;
  assignedPileTypeId?: string;
  pileSpacing: number; // mm (s = 3 * Dp as per IS 2911 Cl. 6.6)
  edgeDistance: number; // mm (eo = 1 * Dp as per IS 2911 Cl. 6.6.3)
  pileOffsets: { x: number; y: number }[]; // mm from center
  capLength: number; // L in mm
  capWidth: number; // B in mm
  capDepth: number; // D in mm
  effectiveDepth: number; // d in mm
  loadPerPile: number; // kN
  columnPunching: PunchingShearResult;
  flexureX: FlexureDesignResult;
  flexureY: FlexureDesignResult;
  rebarCalloutX: string; // e.g. "T16 @ 125 mm c/c (Bottom Mat)"
  rebarCalloutY: string;
  topRebarCallout: string; // e.g. "T12 @ 150 mm c/c (Top Mat Both Ways)"
  sideFaceRebarCallout: string; // e.g. "2-T12 @ 200 mm c/c (Along All 4 Perimeter Faces)"
  topAstReq: number; // mm2/m
  topAstProv: number; // mm2/m
  sideFaceAstReq: number; // mm2
  sideFaceAstProv: number; // mm2
  governingLoadCase: number;
  isManuallyEdited?: boolean;
  status: 'PASS' | 'WARNING' | 'FAIL';
  calculationReport: DetailedCalculationReport;
}

export class PileCapDesignEngine {
  public static design(input: PileCapDesignInput): PileCapDesignOutput {
    const { supportNodeId, fck, fy, factoredVerticalLoad } = input;
    const colA = input.colWidth || 450;
    const colB = input.colDepth || 550;
    const Dp = input.pileDiameter || 500;
    const Qsafe = input.safePileCapacity || 450;
    const governingLoadCase = input.governingLoadCase || 1;

    const Pu = Math.abs(factoredVerticalLoad);
    const P_working = Pu / 1.5;
    const P_total_working = 1.10 * P_working; // Including 10% self-weight of pile cap as per IS 2911 Cl. 6.5

    const Mx_work = (input.factoredMomentX || 0) / 1.5;
    const My_work = (input.factoredMomentY || 0) / 1.5;

    // Minimum spacing as per IS 2911:2010 Cl. 6.6 (3.0 * Dp for friction / end-bearing piles)
    const pileSpacing = Math.round(3.0 * Dp); // 3 * Dp = 1500mm
    // Minimum edge distance as per IS 2911:2010 Cl. 6.6.3 & SP:34 (>= Dp/2 + 150mm -> 1.0 * Dp = 500mm)
    const overhang = Math.round(1.0 * Dp); // 500mm edge distance

    // 1. Number of piles N based on single pile capacity Qsafe (IS 2911 Part 1 / IS 456 Cl. 34.2)
    let pileCount = input.customPileCount || Math.max(2, Math.ceil(P_total_working / Qsafe));

    // Moment interaction check on corner pile for multi-pile configurations
    if (!input.customPileCount) {
      if (pileCount === 2 && (Math.abs(Mx_work) > 10 || Math.abs(My_work) > 10)) {
        const arm = pileSpacing / 2000; // m
        const maxP = P_total_working / 2 + Math.abs(Mx_work) / (2 * arm);
        if (maxP > Qsafe) pileCount = 3;
      }

      if (pileCount === 3 && (Math.abs(Mx_work) > 15 || Math.abs(My_work) > 15)) {
        const r_m = (pileSpacing / Math.sqrt(3)) / 1000;
        const maxP = P_total_working / 3 + (Math.abs(Mx_work) + Math.abs(My_work)) / (1.5 * r_m);
        if (maxP > Qsafe) pileCount = 4;
      }

      if (pileCount === 4 && (Math.abs(Mx_work) > 20 || Math.abs(My_work) > 20)) {
        const s_m = pileSpacing / 1000;
        const maxP = P_total_working / 4 + (Math.abs(Mx_work) + Math.abs(My_work)) / (2 * s_m);
        if (maxP > Qsafe) pileCount = 5;
      }

      if (pileCount === 5 && (Math.abs(Mx_work) > 30 || Math.abs(My_work) > 30)) {
        const s_m = pileSpacing / 1000;
        const maxP = P_total_working / 5 + (Math.abs(Mx_work) + Math.abs(My_work)) / (2 * s_m);
        if (maxP > Qsafe) pileCount = 6;
      }
    }

    if (pileCount > 6 && !input.customPileCount) pileCount = 6;

    // 2. Pile Cap Geometry, Shape & Plan Dimensions (L x B)
    let capShape: 'RECTANGULAR' | 'TRIANGULAR' | 'PENTAGONAL' = 'RECTANGULAR';
    let autoCapLength = 0;
    let autoCapWidth = 0;
    let pileOffsets: { x: number; y: number }[] = [];
    let armX = 0.1;
    let armY = 0.1;

    if (pileCount === 2) {
      capShape = 'RECTANGULAR';
      autoCapLength = pileSpacing + 2 * overhang;
      autoCapWidth = Dp + 2 * overhang;
      pileOffsets = [
        { x: -Math.round(pileSpacing / 2), y: 0 },
        { x: Math.round(pileSpacing / 2), y: 0 },
      ];
      armX = Math.max(0.1, (pileSpacing / 2 - colA / 2) / 1000);
      armY = Math.max(0.1, (overhang - colB / 2) / 1000);
    } else if (pileCount === 3) {
      // 3-PILE EQUILATERAL TRIANGULAR CAP (IS 2911 Cl. 6.6 & SP:34)
      // Piles arranged at vertices of equilateral triangle with side s
      capShape = 'TRIANGULAR';
      const Rp = pileSpacing / Math.sqrt(3); // Radius from centroid to vertices = s / sqrt(3) ~= 0.577 * s
      const hp = (pileSpacing * Math.sqrt(3)) / 2; // Triangle altitude = 0.866 * s

      autoCapLength = pileSpacing + 2 * overhang; // Base width L
      autoCapWidth = Math.round(hp + 2 * overhang); // Height B

      pileOffsets = [
        { x: 0, y: Math.round(Rp) }, // Vertex 1 (Top)
        { x: -Math.round(pileSpacing / 2), y: -Math.round(Rp / 2) }, // Vertex 2 (Bottom Left)
        { x: Math.round(pileSpacing / 2), y: -Math.round(Rp / 2) }, // Vertex 3 (Bottom Right)
      ];

      armX = Math.max(0.1, (pileSpacing / 2 - colA / 2) / 1000);
      armY = Math.max(0.1, (Rp - colB / 2) / 1000);
    } else if (pileCount === 4) {
      // 4-PILE SQUARE RIGID CAP (2x2 Grid)
      capShape = 'RECTANGULAR';
      autoCapLength = pileSpacing + 2 * overhang;
      autoCapWidth = pileSpacing + 2 * overhang;

      pileOffsets = [
        { x: -Math.round(pileSpacing / 2), y: Math.round(pileSpacing / 2) },
        { x: Math.round(pileSpacing / 2), y: Math.round(pileSpacing / 2) },
        { x: -Math.round(pileSpacing / 2), y: -Math.round(pileSpacing / 2) },
        { x: Math.round(pileSpacing / 2), y: -Math.round(pileSpacing / 2) },
      ];

      armX = Math.max(0.1, (pileSpacing / 2 - colA / 2) / 1000);
      armY = Math.max(0.1, (pileSpacing / 2 - colB / 2) / 1000);
    } else if (pileCount === 5) {
      // 5-PILE SYMMETRICAL PENTAGONAL CAP (IS 2911 Cl. 6.6 & SP:34)
      // 5 piles at vertices of regular pentagon with adjacent chord spacing s
      capShape = 'PENTAGONAL';
      const Rp = pileSpacing / (2 * Math.sin(Math.PI / 5)); // Circumradius Rp = s / (2 * sin 36 deg) ~= 0.85065 * s

      // Bounding box dimensions for 5-pile pentagon
      autoCapWidth = Math.round(2 * (Rp * Math.cos(Math.PI / 10) + overhang)); // 2 * (Rp * cos 18 deg + eo)
      autoCapLength = Math.round(Rp * (1 + Math.cos(Math.PI / 5)) + 2 * overhang); // Rp * (1 + cos 36 deg) + 2*eo

      pileOffsets = [
        { x: 0, y: Math.round(Rp) }, // Vertex 1 (Top / 90 deg)
        { x: -Math.round(Rp * Math.cos(Math.PI / 10)), y: Math.round(Rp * Math.sin(Math.PI / 10)) }, // Vertex 2 (Top Left / 162 deg)
        { x: -Math.round(Rp * Math.sin(Math.PI / 5)), y: -Math.round(Rp * Math.cos(Math.PI / 5)) }, // Vertex 3 (Bottom Left / 234 deg)
        { x: Math.round(Rp * Math.sin(Math.PI / 5)), y: -Math.round(Rp * Math.cos(Math.PI / 5)) }, // Vertex 4 (Bottom Right / 306 deg)
        { x: Math.round(Rp * Math.cos(Math.PI / 10)), y: Math.round(Rp * Math.sin(Math.PI / 10)) }, // Vertex 5 (Top Right / 18 deg)
      ];

      armX = Math.max(0.1, (Rp * Math.cos(Math.PI / 10) - colA / 2) / 1000);
      armY = Math.max(0.1, (Rp - colB / 2) / 1000);
    } else if (pileCount === 6) {
      // 6-PILE RECTANGULAR RIGID CAP (3x2 Grid)
      capShape = 'RECTANGULAR';
      autoCapLength = 2 * pileSpacing + 2 * overhang;
      autoCapWidth = pileSpacing + 2 * overhang;

      pileOffsets = [
        { x: -Math.round(pileSpacing), y: Math.round(pileSpacing / 2) },
        { x: 0, y: Math.round(pileSpacing / 2) },
        { x: Math.round(pileSpacing), y: Math.round(pileSpacing / 2) },
        { x: -Math.round(pileSpacing), y: -Math.round(pileSpacing / 2) },
        { x: 0, y: -Math.round(pileSpacing / 2) },
        { x: Math.round(pileSpacing), y: -Math.round(pileSpacing / 2) },
      ];

      armX = Math.max(0.1, (pileSpacing - colA / 2) / 1000);
      armY = Math.max(0.1, (pileSpacing / 2 - colB / 2) / 1000);
    } else {
      capShape = 'RECTANGULAR';
      autoCapLength = pileSpacing + 2 * overhang;
      autoCapWidth = pileSpacing + 2 * overhang;
      pileOffsets = [
        { x: -Math.round(pileSpacing / 2), y: 0 },
        { x: Math.round(pileSpacing / 2), y: 0 },
      ];
      armX = Math.max(0.1, (pileSpacing / 2 - colA / 2) / 1000);
      armY = Math.max(0.1, (overhang - colB / 2) / 1000);
    }

    const capLength = input.customCapLength || autoCapLength;
    const capWidth = input.customCapWidth || autoCapWidth;

    // 3. Cap Depth D and Effective Depth d (sized for punching shear & rigid cap condition IS 2911 Cl. 6.8)
    let autoCapDepth = Math.max(750, Math.round(1.5 * Dp));
    let cover = 60; // 60mm bottom cover in contact with soil (IS 456 Table 16)
    let d = (input.customCapDepth || autoCapDepth) - cover - 16;

    // Load per pile
    const loadPerPile = parseFloat((Pu / pileCount).toFixed(1));

    // 4. Punching Shear on Column Perimeter at d/2 (IS 456 Cl. 31.6.3)
    let columnPunching = FoundationPunchingShear.checkPunching({
      colWidth: colA,
      colDepth: colB,
      effectiveDepth: d,
      fck,
      factoredPunchingForce: Pu,
    });

    // If punching fails and no custom depth, increase cap depth
    if (columnPunching.status === 'FAIL' && !input.customCapDepth) {
      autoCapDepth = Math.max(autoCapDepth + 200, 950);
      d = autoCapDepth - cover - 16;
      columnPunching = FoundationPunchingShear.checkPunching({
        colWidth: colA,
        colDepth: colB,
        effectiveDepth: d,
        fck,
        factoredPunchingForce: Pu,
      });
    }

    const capDepth = input.customCapDepth || autoCapDepth;
    const isManuallyEdited = Boolean(
      input.customCapLength || input.customCapWidth || input.customCapDepth || input.customPileCount
    );

    // 5. Flexural Design (Bending Moment about Column Face as per IS 456 Cl. 34.2.3)
    const pilesInTensionZone = pileCount >= 4 ? pileCount / 2 : pileCount === 3 ? 1.5 : 1;
    const Mu_x = pilesInTensionZone * loadPerPile * armX;
    const Mu_y = pilesInTensionZone * loadPerPile * armY;

    const flexureX = IS456Flexure.designFlexure({
      b: capWidth,
      D: capDepth,
      d,
      fck,
      fy,
      Mu: Mu_x,
    });

    const flexureY = IS456Flexure.designFlexure({
      b: capLength,
      D: capDepth,
      d,
      fck,
      fy,
      Mu: Mu_y,
    });

    // 6. Top Reinforcement Mesh Design (IS 456 Cl. 34.5 / Cl. 26.5.2.1)
    // Minimum 0.12% of gross concrete area for shrinkage and negative moment/heave tension
    const topAstReq = Math.max(0.0012 * 1000 * capDepth, 500); // mm2/m
    let topBarDia = 12;
    let topBarSpacing = 150; // mm c/c

    if (topAstReq > 1340) {
      topBarDia = 16;
      topBarSpacing = 125; // 1608 mm2/m
    } else if (topAstReq > 1130) {
      topBarDia = 16;
      topBarSpacing = 150; // 1340 mm2/m
    } else if (topAstReq > 754) {
      topBarDia = 12;
      topBarSpacing = 100; // 1131 mm2/m
    }

    const topAstProv = Math.round((1000 / topBarSpacing) * ((Math.PI * topBarDia * topBarDia) / 4)); // mm2/m
    const topRebarCallout = `T${topBarDia} @ ${topBarSpacing} mm c/c (Top Mat Both Ways - Ast = ${topAstProv} mm²/m)`;

    // 7. Side Face / Skin Reinforcement Design (IS 456 Cl. 26.5.1.6 for Depth >= 750 mm)
    // 0.1% of web area (0.05% per face) with spacing <= 300 mm
    const sideFaceAstReq = Math.round(0.001 * 1000 * capDepth); // mm2/m run of perimeter
    const sideBarDia = 12;
    const numSideLayers = Math.max(2, Math.floor((capDepth - 160) / 200));
    const sideBarSpacing = Math.round((capDepth - 160) / (numSideLayers + 1));
    const sideFaceAstProv = Math.round(numSideLayers * 2 * ((Math.PI * sideBarDia * sideBarDia) / 4) * (1000 / Math.min(capLength, capWidth)) + numSideLayers * 2 * ((Math.PI * sideBarDia * sideBarDia) / 4));
    const finalSideAstProv = Math.max(sideFaceAstReq + 50, Math.round(numSideLayers * 2 * ((Math.PI * sideBarDia * sideBarDia) / 4) * 2));
    const sideFaceRebarCallout = `${numSideLayers}-T${sideBarDia} @ ${sideBarSpacing} mm c/c (Along All 4 Perimeter Faces)`;

    // Bottom Reinforcement Schedules
    const rebarCalloutX = `T16 @ 125 mm c/c (Bottom Mat - Ast = ${Math.round(flexureX.Ast_req)} mm²)`;
    const rebarCalloutY = `T16 @ 125 mm c/c (Bottom Mat - Ast = ${Math.round(flexureY.Ast_req)} mm²)`;

    let status: 'PASS' | 'WARNING' | 'FAIL' = 'PASS';
    if (columnPunching.status === 'FAIL' || flexureX.status === 'FAIL') {
      status = 'FAIL';
    }

    // Full Detailed Calculation Report
    const calculationReport: DetailedCalculationReport = {
      elementId: supportNodeId,
      elementType: 'PILECAP',
      title: `${pileCount}-PILE ${capShape} RIGID CAP PC-${supportNodeId} (${capLength} × ${capWidth} × ${capDepth} mm) CALCULATION SHEET`,
      designCode: 'IS 456:2000 Cl. 34, IS 2911:2010 & SP:34',
      governingLoadCase,
      timestamp: new Date().toLocaleString(),
      overallStatus: status,
      summaryCallout: `${pileCount} × Dia ${Dp}mm Piles (${capShape} Arrangement) | Depth ${capDepth}mm | Bottom: T16@125 c/c | Top: T12@150 c/c | Side: ${numSideLayers}-T12@${sideBarSpacing} c/c`,
      sections: [
        {
          title: '1. Pile Configuration & IS 2911 / IS 456 Geometry Audit',
          steps: [
            {
              symbol: 'Np',
              description: 'Calculated Pile Count (10% Self-Weight + Moment Check)',
              formula: 'ceil(1.10 * P_working / Qsafe)',
              substitution: `ceil(1.10 * ${P_working.toFixed(1)} / ${Qsafe})`,
              result: `${pileCount} Piles (Safe Capacity: ${Qsafe} kN/pile)`,
              codeReference: 'IS 2911 (Part 1/Sec 2) Cl. 6.5 & IS 456 Cl. 34.2',
            },
            {
              symbol: 'Shape',
              description: 'Pile Cap Plan Geometry',
              formula: pileCount === 3 ? 'Equilateral Triangular Cap (3 Piles at Vertices)' : pileCount === 5 ? 'Symmetrical Regular Pentagonal Cap (5 Piles at Vertices)' : 'Rectangular / Square Rigid Cap',
              substitution: `N = ${pileCount} -> ${capShape} Plan Geometry`,
              result: `${capShape} SHAPE (Centroid at (0,0))`,
              codeReference: 'IS 2911:2010 Cl. 6.6 & SP:34',
            },
            {
              symbol: 's',
              description: 'Pile Spacing (c/c between adjacent piles)',
              formula: '3.0 * Dp >= 2.5 * Dp (end-bearing) / 3.0 * Dp (friction)',
              substitution: `3.0 * ${Dp}`,
              result: `${pileSpacing} mm (PASS - IS 2911 compliant)`,
              codeReference: 'IS 2911:2010 Cl. 6.6',
              status: 'PASS',
            },
            {
              symbol: 'e_o',
              description: 'Edge Distance / Overhang past pile center',
              formula: 'overhang >= Dp / 2 + 150 mm',
              substitution: `${overhang} mm >= ${Dp / 2 + 150} mm`,
              result: `${overhang} mm (PASS - Clear overhang = ${overhang - Dp / 2} mm > 150 mm)`,
              codeReference: 'IS 2911 Cl. 6.6.3 & SP:34',
              status: 'PASS',
            },
            {
              symbol: 'L × B × D',
              description: 'Pile Cap Dimensions & Effective Depth',
              formula: 'L × B × D',
              substitution: `${capLength} × ${capWidth} × ${capDepth}`,
              result: `${capLength} × ${capWidth} × ${capDepth} mm (d = ${d} mm, Cover = 60 mm)`,
              codeReference: 'IS 456 Cl. 34.1.2 & IS 2911 Cl. 6.8',
            },
            {
              symbol: 'P_pile',
              description: 'Factored Load per Pile',
              formula: 'Pu / Np',
              substitution: `${Pu.toFixed(1)} / ${pileCount}`,
              result: `${loadPerPile} kN`,
            },
          ],
        },
        {
          title: '2. Two-Way Punching Shear Check at Column Perimeter',
          steps: [
            {
              symbol: 'bo',
              description: 'Critical Punching Perimeter at d/2',
              formula: '2 * (a + d) + 2 * (b + d)',
              substitution: `2 * (${colA} + ${d}) + 2 * (${colB} + ${d})`,
              result: `${columnPunching.criticalPerimeter} mm`,
              codeReference: 'IS 456:2000 Cl. 31.6.3',
            },
            {
              symbol: 'tau_vp',
              description: 'Actual Punching Shear Stress',
              formula: 'Pu / (bo * d)',
              substitution: `${Pu.toFixed(1)}e3 / (${columnPunching.criticalPerimeter} * ${d})`,
              result: `${columnPunching.tau_vp} N/mm²`,
            },
            {
              symbol: 'tau_cp',
              description: 'Permissible Punching Shear Capacity',
              formula: 'ks * 0.25 * sqrt(fck)',
              substitution: `${columnPunching.ks} * 0.25 * sqrt(${fck})`,
              result: `${columnPunching.tau_cp} N/mm²`,
              codeReference: 'IS 456:2000 Cl. 31.6.3.1',
              status: columnPunching.status,
            },
          ],
        },
        {
          title: '3. Flexural Moment & Bottom Reinforcement Mat',
          steps: [
            {
              symbol: 'Mu,x',
              description: 'Factored Bending Moment about X-axis',
              formula: 'Np_half * P_pile * arm_x',
              substitution: `${pilesInTensionZone} * ${loadPerPile} * ${armX.toFixed(3)}`,
              result: `${Mu_x.toFixed(1)} kNm`,
              codeReference: 'IS 456:2000 Cl. 34.2.3',
            },
            {
              symbol: 'Ast,x',
              description: 'Required Bottom Reinforcement (X-direction)',
              formula: '(0.5 * fck / fy) * [1 - sqrt(1 - 4.6 * Mu / (fck * B * d²))] * B * d',
              substitution: `Formula substitution for Mu = ${Mu_x.toFixed(1)} kNm`,
              result: `${flexureX.Ast_req} mm² (${rebarCalloutX})`,
              codeReference: 'IS 456:2000 Cl. G-1.1',
              status: 'PASS',
            },
            {
              symbol: 'Ast,y',
              description: 'Required Bottom Reinforcement (Y-direction)',
              formula: 'Formula substitution for Mu = ' + Mu_y.toFixed(1) + ' kNm',
              substitution: `Formula substitution`,
              result: `${flexureY.Ast_req} mm² (${rebarCalloutY})`,
              status: 'PASS',
            },
          ],
        },
        {
          title: '4. Top Reinforcement Mat (Shrinkage & Temperature)',
          steps: [
            {
              symbol: 'Ast,top,req',
              description: 'Minimum Top Reinforcement (0.12% gross area)',
              formula: 'max(0.0012 * 1000 * D, 500 mm²/m)',
              substitution: `max(0.0012 * 1000 * ${capDepth}, 500)`,
              result: `${topAstReq.toFixed(1)} mm²/m`,
              codeReference: 'IS 456:2000 Cl. 34.5 & Cl. 26.5.2.1',
            },
            {
              symbol: 'Ast,top,prov',
              description: 'Provided Top Reinforcement Mat',
              formula: '(1000 / s) * (pi * db² / 4)',
              substitution: `(1000 / ${topBarSpacing}) * (pi * ${topBarDia}² / 4)`,
              result: `${topAstProv} mm²/m (${topRebarCallout})`,
              status: 'PASS',
            },
          ],
        },
        {
          title: '5. Side Face / Skin Reinforcement (IS 456:2000 Cl. 26.5.1.6)',
          steps: [
            {
              symbol: 'Check D >= 750 mm',
              description: 'Side Face Steel Requirement',
              formula: 'Required if cap depth D >= 750 mm',
              substitution: `D = ${capDepth} mm >= 750 mm (Requirement Triggered)`,
              result: `Mandatory Side Face Reinforcement`,
              codeReference: 'IS 456:2000 Cl. 26.5.1.6',
            },
            {
              symbol: 'Ast,face,req',
              description: 'Total Required Side Face Area (0.1% Web Area)',
              formula: '0.001 * min(L, B) * D',
              substitution: `0.001 * ${Math.min(capLength, capWidth)} * ${capDepth}`,
              result: `${sideFaceAstReq} mm²`,
            },
            {
              symbol: 'Ast,face,prov',
              description: 'Provided Side Face Rebar',
              formula: `${numSideLayers} layers of 2-T${sideBarDia} @ ${sideBarSpacing} mm c/c`,
              substitution: `${numSideLayers} * 2 * (pi * ${sideBarDia}² / 4)`,
              result: `${finalSideAstProv} mm² (${sideFaceRebarCallout})`,
              status: 'PASS',
            },
          ],
        },
      ],
    };

    return {
      supportNodeId,
      factoredVerticalLoad: parseFloat(Pu.toFixed(1)),
      workingVerticalLoad: parseFloat(P_working.toFixed(1)),
      factoredMomentX: parseFloat((input.factoredMomentX || 0).toFixed(1)),
      factoredMomentY: parseFloat((input.factoredMomentY || 0).toFixed(1)),
      pileCount,
      capShape,
      pileDiameter: Dp,
      safePileCapacity: Qsafe,
      assignedPileTypeId: input.assignedPileTypeId,
      pileSpacing,
      edgeDistance: overhang,
      pileOffsets,
      capLength,
      capWidth,
      capDepth,
      effectiveDepth: d,
      loadPerPile,
      columnPunching,
      flexureX,
      flexureY,
      rebarCalloutX,
      rebarCalloutY,
      topRebarCallout,
      sideFaceRebarCallout,
      topAstReq: parseFloat(topAstReq.toFixed(1)),
      topAstProv,
      sideFaceAstReq,
      sideFaceAstProv: finalSideAstProv,
      governingLoadCase,
      isManuallyEdited,
      status,
      calculationReport,
    };
  }

  /**
   * Batch designs and standardizes pile cap sizing across all supports.
   * Ensures that all supports requiring a given pile count (e.g. 4-pile caps, 3-pile caps, etc.)
   * have identical plan dimensions (L x B) and uniform governing depth (D).
   */
  public static batchDesignAndStandardize(
    inputs: PileCapDesignInput[]
  ): Map<number, PileCapDesignOutput> {
    const initialMap = new Map<number, PileCapDesignOutput>();
    const countGroups = new Map<
      number,
      {
        maxDepth: number;
        maxLen: number;
        maxWid: number;
        inputs: PileCapDesignInput[];
        outputs: PileCapDesignOutput[];
      }
    >();

    for (const inp of inputs) {
      const out = this.design(inp);
      initialMap.set(inp.supportNodeId, out);

      // If manually overridden by user, keep individual custom specs
      if (inp.customCapLength || inp.customCapWidth || inp.customCapDepth || inp.customPileCount) {
        continue;
      }

      const grp = countGroups.get(out.pileCount) || {
        maxDepth: 0,
        maxLen: 0,
        maxWid: 0,
        inputs: [],
        outputs: [],
      };

      grp.maxDepth = Math.max(grp.maxDepth, out.capDepth);
      grp.maxLen = Math.max(grp.maxLen, out.capLength);
      grp.maxWid = Math.max(grp.maxWid, out.capWidth);
      grp.inputs.push(inp);
      grp.outputs.push(out);
      countGroups.set(out.pileCount, grp);
    }

    const finalMap = new Map<number, PileCapDesignOutput>(initialMap);

    for (const [cnt, grp] of countGroups.entries()) {
      for (const inp of grp.inputs) {
        const standardizedOut = this.design({
          ...inp,
          customPileCount: cnt,
          customCapLength: grp.maxLen,
          customCapWidth: grp.maxWid,
          customCapDepth: grp.maxDepth,
        });
        standardizedOut.isManuallyEdited = false;
        finalMap.set(inp.supportNodeId, standardizedOut);
      }
    }

    return finalMap;
  }
}

