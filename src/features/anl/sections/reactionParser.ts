import { JointReaction } from '@/features/model/types';
import { TokenizedLine } from '../tokenizer/anlTokenizer';

export class ReactionParser {
  /**
   * Parses SUPPORT REACTIONS table from STAAD .ANL file.
   * Handles:
   * Joint header lines (8 tokens: Joint, Load, Fx, Fy, Fz, Mx, My, Mz)
   * Continuation load lines (7 tokens: Load, Fx, Fy, Fz, Mx, My, Mz)
   */
  public static parse(rawLines: string[]): JointReaction[] {
    const reactions: JointReaction[] = [];
    let inReactionSection = false;
    let currentJointId = 0;

    for (let i = 0; i < rawLines.length; i++) {
      const line = rawLines[i].trim();

      // Detect start of support reactions table
      if (/SUPPORT\s+REACTIONS\s+-UNIT/i.test(line) || /PRINT\s+SUPPORT\s+REACTION/i.test(line)) {
        inReactionSection = true;
        continue;
      }

      if (!inReactionSection) continue;

      // Detect end of support reactions table (e.g. next command like "PRINT STORY DRIFT", "PERFORM ANALYSIS", "DESIGN")
      if (/^\s*\d+\.\s+[A-Z]/i.test(line) && !/SUPPORT\s+REACTION/i.test(line)) {
        inReactionSection = false;
        continue;
      }

      // Skip header rows and separators
      if (/^JOINT\s+LOAD/i.test(line) || /^-+$/.test(line) || /^PAGE\s+NO/i.test(line) || /^STAAD\s+SPACE/i.test(line)) {
        continue;
      }

      const tokens = line.split(/\s+/).filter(Boolean);

      // Line with 8 tokens: New Joint + Load + 6 forces
      if (tokens.length === 8) {
        const joint = parseInt(tokens[0], 10);
        const load = parseInt(tokens[1], 10);
        const fx = parseFloat(tokens[2]);
        const fy = parseFloat(tokens[3]);
        const fz = parseFloat(tokens[4]);
        const mx = parseFloat(tokens[5]);
        const my = parseFloat(tokens[6]);
        const mz = parseFloat(tokens[7]);

        if (!isNaN(joint) && !isNaN(load) && !isNaN(fx) && !isNaN(fy)) {
          currentJointId = joint;
          reactions.push({
            nodeId: currentJointId,
            loadCaseId: load,
            fx,
            fy,
            fz,
            mx,
            my,
            mz,
          });
        }
      }
      // Line with 7 tokens: Continuation for currentJointId
      else if (tokens.length === 7 && currentJointId > 0) {
        const load = parseInt(tokens[0], 10);
        const fx = parseFloat(tokens[1]);
        const fy = parseFloat(tokens[2]);
        const fz = parseFloat(tokens[3]);
        const mx = parseFloat(tokens[4]);
        const my = parseFloat(tokens[5]);
        const mz = parseFloat(tokens[6]);

        if (!isNaN(load) && !isNaN(fx) && !isNaN(fy)) {
          reactions.push({
            nodeId: currentJointId,
            loadCaseId: load,
            fx,
            fy,
            fz,
            mx,
            my,
            mz,
          });
        }
      }
    }

    return reactions;
  }
}
