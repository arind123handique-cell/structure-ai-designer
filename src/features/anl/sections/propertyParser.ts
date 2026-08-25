import { Member3D, Plate3D, Support3D } from '@/features/model/types';
import { TokenizedLine, ANLTokenizer } from '../tokenizer/anlTokenizer';

export class PropertyParser {
  /**
   * Parses MEMBER PROPERTY sections.
   * Format: <id_list> PRIS YD <depth> ZD <width>
   * Example: "53 TO 58 PRIS YD 0.55 ZD 0.45"
   */
  public static parseMemberProperties(lines: TokenizedLine[], members: Map<number, Partial<Member3D>>): void {
    for (const line of lines) {
      const tokens = line.tokens;
      const prisIdx = tokens.findIndex((t) => t.toUpperCase() === 'PRIS');

      if (prisIdx > 0) {
        const idTokens = tokens.slice(0, prisIdx);
        const memberIds = ANLTokenizer.expandIdList(idTokens);

        let yd = 0.45; // default depth
        let zd = 0.3; // default width

        for (let i = prisIdx; i < tokens.length; i++) {
          const key = tokens[i].toUpperCase();
          if (key === 'YD' && tokens[i + 1]) {
            yd = parseFloat(tokens[i + 1]);
          } else if (key === 'ZD' && tokens[i + 1]) {
            zd = parseFloat(tokens[i + 1]);
          }
        }

        for (const mid of memberIds) {
          const member = members.get(mid);
          if (member) {
            member.section = {
              type: 'RECTANGULAR',
              yd,
              zd,
              name: `${Math.round(zd * 1000)}x${Math.round(yd * 1000)} mm`,
            };
          }
        }
      }
    }
  }

  /**
   * Parses ELEMENT PROPERTY sections.
   * Format: <id_list> THICKNESS <thickness>
   * Example: "89 TO 111 THICKNESS 0.12"
   */
  public static parseElementProperties(lines: TokenizedLine[], plates: Map<number, Plate3D>): void {
    for (const line of lines) {
      const tokens = line.tokens;
      const thickIdx = tokens.findIndex((t) => t.toUpperCase() === 'THICKNESS');

      if (thickIdx > 0 && tokens[thickIdx + 1]) {
        const idTokens = tokens.slice(0, thickIdx);
        const plateIds = ANLTokenizer.expandIdList(idTokens);
        const thickness = parseFloat(tokens[thickIdx + 1]);

        if (!isNaN(thickness)) {
          for (const pid of plateIds) {
            const plate = plates.get(pid);
            if (plate) {
              plate.thickness = thickness;
            }
          }
        }
      }
    }
  }

  /**
   * Parses SUPPORTS section.
   * Format: <node_list> PINNED | FIXED | FIXED BUT ...
   * Example: "1 TO 6 8 9 12 13 16 17 20 TO 23 30 TO 32 PINNED"
   */
  public static parseSupports(lines: TokenizedLine[]): Map<number, Support3D> {
    const supports = new Map<number, Support3D>();

    for (const line of lines) {
      const tokens = line.tokens;
      const pinnedIdx = tokens.findIndex((t) => t.toUpperCase() === 'PINNED');
      const fixedIdx = tokens.findIndex((t) => t.toUpperCase() === 'FIXED');

      if (pinnedIdx !== -1) {
        const nodeIds = ANLTokenizer.expandIdList(tokens.slice(0, pinnedIdx));
        for (const nid of nodeIds) {
          supports.set(nid, {
            nodeId: nid,
            type: 'PINNED',
            releases: { fx: false, fy: false, fz: false, mx: true, my: true, mz: true },
          });
        }
      } else if (fixedIdx !== -1) {
        const nodeIds = ANLTokenizer.expandIdList(tokens.slice(0, fixedIdx));
        for (const nid of nodeIds) {
          supports.set(nid, {
            nodeId: nid,
            type: 'FIXED',
            releases: { fx: false, fy: false, fz: false, mx: false, my: false, mz: false },
          });
        }
      }
    }

    return supports;
  }
}
