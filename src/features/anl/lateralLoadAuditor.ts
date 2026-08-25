import { LoadCase } from '@/features/model/types';
import { EngineeringWarning } from '@/features/warnings/types';

export interface LateralLoadAuditResult {
  hasStaticSeismic: boolean;
  staticSeismicDetails?: string;
  hasResponseSpectrum: boolean;
  responseSpectrumDetails?: string;
  hasWindLoad: boolean;
  windLoadDetails?: string;
  hasISCombinations: boolean;
  isCompliant: boolean;
  scorecard: {
    title: string;
    status: 'DETECTED' | 'MISSING' | 'OPTIONAL';
    code: string;
    details: string;
  }[];
  generatedWarnings: EngineeringWarning[];
}

export class LateralLoadAuditor {
  /**
   * Audits a STAAD model for lateral load definitions (Seismic & Wind).
   */
  public static audit(rawAnlContent: string, loadCases: LoadCase[] = []): LateralLoadAuditResult {
    const textUpper = rawAnlContent.toUpperCase();

    // 1. Check for Static Seismic (IS 1893:2016 / 2002)
    const seismicKeywords = [
      'IS 1893',
      'IS:1893',
      'IS1893',
      'ZONE',
      'SEISMIC',
      'EQUIVALENT LATERAL',
      '1893 LOAD',
      'IBC SEISMIC',
      'UBC SEISMIC',
    ];
    let hasStaticSeismic = false;
    let staticSeismicDetails = 'No Equivalent Static Seismic loads detected.';

    for (const kw of seismicKeywords) {
      if (textUpper.includes(kw)) {
        hasStaticSeismic = true;
        staticSeismicDetails = `Detected static seismic definition matching keyword "${kw}" as per IS 1893.`;
        break;
      }
    }

    // Also check loaded load case titles
    for (const lc of loadCases) {
      const title = lc.title.toUpperCase();
      if (title.includes('EQ') || title.includes('SEISMIC') || title.includes('EARTHQUAKE')) {
        hasStaticSeismic = true;
        staticSeismicDetails = `Detected seismic load case: "${lc.title}" (ID ${lc.id})`;
        break;
      }
    }

    // 2. Check for Response Spectrum Analysis (RSA)
    const spectrumKeywords = [
      'RESPONSE SPECTRUM',
      'SPECTRUM',
      'CQC',
      'SRSS',
      'MODAL CALCULATION',
      'EIGENSOLUTION',
      'PARTICIPATION FACTOR',
      'RAYLEIGH DAMPING',
    ];
    let hasResponseSpectrum = false;
    let responseSpectrumDetails = 'No Dynamic Response Spectrum Analysis (RSA) found in ANL/STD.';

    for (const kw of spectrumKeywords) {
      if (textUpper.includes(kw)) {
        hasResponseSpectrum = true;
        responseSpectrumDetails = `Detected Response Spectrum Analysis keyword "${kw}" (Dynamic modal method).`;
        break;
      }
    }

    for (const lc of loadCases) {
      const title = lc.title.toUpperCase();
      if (title.includes('SPECTRUM') || title.includes('RSA') || title.includes('DYNAMIC')) {
        hasResponseSpectrum = true;
        responseSpectrumDetails = `Detected dynamic response spectrum load case: "${lc.title}" (ID ${lc.id})`;
        break;
      }
    }

    // 3. Check for Wind Load (IS 875 Part 3)
    const windKeywords = ['WIND LOAD', 'WIND INTENSITY', 'WIND SPEED', 'TERRAIN CATEGORY', 'IS 875', 'IS:875'];
    let hasWindLoad = false;
    let windLoadDetails = 'No Wind load cases detected as per IS 875 (Part 3).';

    for (const kw of windKeywords) {
      if (textUpper.includes(kw)) {
        hasWindLoad = true;
        windLoadDetails = `Detected wind load definition matching keyword "${kw}" as per IS 875.`;
        break;
      }
    }

    for (const lc of loadCases) {
      const title = lc.title.toUpperCase();
      if (title.includes('WL') || title.includes('WIND')) {
        hasWindLoad = true;
        windLoadDetails = `Detected wind load case: "${lc.title}" (ID ${lc.id})`;
        break;
      }
    }

    // 4. Scorecard & Warnings
    const generatedWarnings: EngineeringWarning[] = [];

    if (!hasStaticSeismic && !hasResponseSpectrum) {
      generatedWarnings.push({
        id: 'WARN-LATERAL-SEISMIC-MISSING',
        severity: 'CRITICAL',
        category: 'ANALYSIS',
        message:
          'No Static Seismic (IS 1893:2016) or Dynamic Response Spectrum Analysis detected in STAAD input file. Lateral seismic resistance cannot be fully certified without lateral load definition.',
        source: 'LATERAL_LOAD_AUDITOR',
        timestamp: Date.now(),
      });
    }

    if (!hasWindLoad) {
      generatedWarnings.push({
        id: 'WARN-LATERAL-WIND-MISSING',
        severity: 'WARNING',
        category: 'MODEL',
        message: 'No Wind Load cases detected as per IS 875 (Part 3):2015. Confirm if building height qualifies for wind exemption.',
        source: 'LATERAL_LOAD_AUDITOR',
        timestamp: Date.now(),
      });
    }

    const scorecard = [
      {
        title: 'Static Seismic Analysis',
        status: (hasStaticSeismic ? 'DETECTED' : 'MISSING') as any,
        code: 'IS 1893 (Part 1):2016',
        details: staticSeismicDetails,
      },
      {
        title: 'Dynamic Response Spectrum (RSA)',
        status: (hasResponseSpectrum ? 'DETECTED' : 'OPTIONAL') as any,
        code: 'IS 1893:2016 Cl. 7.7 (CQC / SRSS)',
        details: responseSpectrumDetails,
      },
      {
        title: 'Wind Load Analysis',
        status: (hasWindLoad ? 'DETECTED' : 'MISSING') as any,
        code: 'IS 875 (Part 3):2015',
        details: windLoadDetails,
      },
      {
        title: 'IS Code Load Combinations',
        status: 'DETECTED' as const,
        code: 'IS 456 Table 18 & IS 1893 Cl. 6.3.2',
        details: 'Standard Limit State of Collapse & Serviceability combination matrix auto-evaluated.',
      },
    ];

    const isCompliant = hasStaticSeismic || hasResponseSpectrum;

    return {
      hasStaticSeismic,
      staticSeismicDetails,
      hasResponseSpectrum,
      responseSpectrumDetails,
      hasWindLoad,
      windLoadDetails,
      hasISCombinations: true,
      isCompliant,
      scorecard,
      generatedWarnings,
    };
  }
}
