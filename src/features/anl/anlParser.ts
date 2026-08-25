import { ANLTokenizer, TokenizedLine } from './tokenizer/anlTokenizer';
import { JointParser } from './sections/jointParser';
import { MemberParser } from './sections/memberParser';
import { PropertyParser } from './sections/propertyParser';
import { LoadParser } from './sections/loadParser';
import { ReactionParser } from './sections/reactionParser';
import { StoryDriftParser } from './sections/storyDriftParser';
import { ForceParser } from './sections/forceParser';
import { ANLValidator } from './validation/anlValidator';
import { ModelNormalizer } from '../model/modelNormalizer';
import { NormalizedStructuralModel, Member3D, Plate3D } from '../model/types';
import { EngineeringWarning } from '../warnings/types';

export interface ANLParseResult {
  model: NormalizedStructuralModel;
  warnings: EngineeringWarning[];
  staadVersion?: string;
  engineer?: string;
  date?: string;
}

export class ANLParser {
  /**
   * Parses full content of a STAAD .ANL or .STD file.
   */
  public static parse(content: string): ANLParseResult {
    const rawLines = content.split(/\r?\n/);
    const tokenizedLines = ANLTokenizer.cleanAndExtractLines(content);

    // 1. Extract STAAD metadata from header
    let staadVersion = 'STAAD.Pro 2024';
    let engineer = 'Structural Engineer';
    let date = new Date().toISOString().split('T')[0];

    for (let i = 0; i < Math.min(rawLines.length, 50); i++) {
      const line = rawLines[i];
      if (/STAAD\.Pro/i.test(line) || /Version/i.test(line)) {
        staadVersion = line.replace(/[\*\|\s]+/g, ' ').trim();
      }
      const engMatch = line.match(/ENGINEER\s+DATE\s+([A-Za-z0-9-]+)/i);
      if (engMatch) {
        date = engMatch[1];
      }
    }

    // 2. Identify Section Blocks from tokenized lines
    const jointLines: TokenizedLine[] = [];
    const memberIncLines: TokenizedLine[] = [];
    const elementIncLines: TokenizedLine[] = [];
    const memberPropLines: TokenizedLine[] = [];
    const elementPropLines: TokenizedLine[] = [];
    const supportLines: TokenizedLine[] = [];
    const loadLines: TokenizedLine[] = [];

    let currentSection = '';

    for (const line of tokenizedLines) {
      const upper = line.text.toUpperCase();

      if (upper.startsWith('JOINT COORDINATES')) {
        currentSection = 'JOINTS';
        continue;
      } else if (upper.startsWith('MEMBER INCIDENCES')) {
        currentSection = 'MEMBER_INC';
        continue;
      } else if (upper.startsWith('ELEMENT INCIDENCES SHELL') || upper.startsWith('ELEMENT INCIDENCES')) {
        currentSection = 'ELEMENT_INC';
        continue;
      } else if (upper.startsWith('MEMBER PROPERTY')) {
        currentSection = 'MEMBER_PROP';
        continue;
      } else if (upper.startsWith('ELEMENT PROPERTY')) {
        currentSection = 'ELEMENT_PROP';
        continue;
      } else if (upper.startsWith('SUPPORTS')) {
        currentSection = 'SUPPORTS';
        continue;
      } else if (upper.startsWith('LOAD ') || upper.startsWith('LOAD COMB') || upper.startsWith('DEFINE IS1893') || upper.startsWith('DEFINE REFERENCE LOADS')) {
        currentSection = 'LOADS';
        loadLines.push(line);
        continue;
      } else if (upper.startsWith('PERFORM ANALYSIS') || upper.startsWith('START CONCRETE DESIGN') || upper.startsWith('PRINT ')) {
        currentSection = 'ANALYSIS_CMDS';
      }

      switch (currentSection) {
        case 'JOINTS':
          jointLines.push(line);
          break;
        case 'MEMBER_INC':
          memberIncLines.push(line);
          break;
        case 'ELEMENT_INC':
          elementIncLines.push(line);
          break;
        case 'MEMBER_PROP':
          memberPropLines.push(line);
          break;
        case 'ELEMENT_PROP':
          elementPropLines.push(line);
          break;
        case 'SUPPORTS':
          supportLines.push(line);
          break;
        case 'LOADS':
          loadLines.push(line);
          break;
      }
    }

    // 3. Execute Section Parsers
    const nodes = JointParser.parse(jointLines);
    const rawMembers = MemberParser.parseMemberIncidences(memberIncLines, nodes);
    const plates = MemberParser.parseElementIncidences(elementIncLines, nodes);

    PropertyParser.parseMemberProperties(memberPropLines, rawMembers);
    PropertyParser.parseElementProperties(elementPropLines, plates);
    const supports = PropertyParser.parseSupports(supportLines);

    const { loadCases, loadCombinations } = LoadParser.parse(loadLines);
    const reactions = ReactionParser.parse(rawLines);
    const storyDrifts = StoryDriftParser.parse(rawLines);
    const { forces, designSummaries, warnings: rawWarnings } = ForceParser.parse(rawLines);

    // 4. Validate Structural Model
    // First convert rawMembers to temporary Member3D map for validation
    const tempMembers = new Map<number, Member3D>();
    for (const [id, raw] of rawMembers.entries()) {
      tempMembers.set(id, {
        id,
        startNodeId: raw.startNodeId || 0,
        endNodeId: raw.endNodeId || 0,
        length: raw.length || 0,
        classification: 'BEAM',
        isAutoClassified: true,
        section: raw.section || { type: 'RECTANGULAR', yd: 0.45, zd: 0.3 },
        materialName: 'CONCRETE',
        designStatus: 'NOT_DESIGNED',
      });
    }

    const validationWarnings = ANLValidator.validate(nodes, tempMembers, plates, supports, reactions);

    // 5. Convert raw parser warnings to EngineeringWarning objects (deduplicated)
    const allWarnings: EngineeringWarning[] = [...validationWarnings];
    const seenWarningKeys = new Set<string>();

    for (const rw of rawWarnings) {
      const key = `${rw.memberId || 'global'}_${rw.message.trim()}`;
      if (seenWarningKeys.has(key)) continue;
      seenWarningKeys.add(key);

      allWarnings.push({
        id: `warn_raw_${Math.random().toString(36).substring(2, 9)}`,
        severity: 'WARNING',
        category: 'ANALYSIS',
        elementRef: rw.memberId ? `Member #${rw.memberId}` : undefined,
        message: rw.message,
        source: 'STAAD Design Output',
        action: 'Review member loading in STAAD model.',
      });
    }

    // 6. Normalize Model
    const normalizedModel = ModelNormalizer.normalize(
      nodes,
      rawMembers,
      plates,
      supports,
      loadCases,
      loadCombinations,
      reactions,
      forces,
      storyDrifts,
      designSummaries
    );

    return {
      model: normalizedModel,
      warnings: allWarnings,
      staadVersion,
      engineer,
      date,
    };
  }
}
