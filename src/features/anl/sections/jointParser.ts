import { Node3D } from '@/features/model/types';
import { TokenizedLine } from '../tokenizer/anlTokenizer';

export class JointParser {
  /**
   * Parses JOINT COORDINATES lines into Node3D map.
   * Format in STAAD: <jointId> <x> <y> <z>
   * Example: "1 0 0 0", "2 5.40001 0 0", "56 -1.25 3.20001 0"
   */
  public static parse(lines: TokenizedLine[]): Map<number, Node3D> {
    const nodes = new Map<number, Node3D>();

    for (const line of lines) {
      const tokens = line.tokens;
      if (tokens.length < 4) continue;

      // Some lines may have multiple joint definitions without semicolons, e.g. "1 0 0 0 2 5.4 0 0"
      for (let i = 0; i + 3 < tokens.length; i += 4) {
        const id = parseInt(tokens[i], 10);
        const x = parseFloat(tokens[i + 1]);
        const y = parseFloat(tokens[i + 2]);
        const z = parseFloat(tokens[i + 3]);

        if (!isNaN(id) && !isNaN(x) && !isNaN(y) && !isNaN(z)) {
          nodes.set(id, { id, x, y, z });
        }
      }
    }

    return nodes;
  }
}
