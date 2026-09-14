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
      const prisIdx = tokens.findIndex((t) => /^(PRIS|PRISMATIC|RECT|RECTANGULAR)/i.test(t));
      const circIdx = tokens.findIndex((t) => /^(CIRC|CIRCULAR)/i.test(t));

      const keywordIdx = prisIdx !== -1 ? prisIdx : circIdx;

      if (keywordIdx > 0) {
        const idTokens = tokens.slice(0, keywordIdx);
        const memberIds = ANLTokenizer.expandIdList(idTokens);

        let yd: number | undefined = undefined;
        let zd: number | undefined = undefined;

        for (let i = keywordIdx; i < tokens.length; i++) {
          const key = tokens[i].toUpperCase();
          if (key === 'YD' && tokens[i + 1]) {
            yd = parseFloat(tokens[i + 1]);
          } else if (key === 'ZD' && tokens[i + 1]) {
            zd = parseFloat(tokens[i + 1]);
          }
        }

        const isCircular = circIdx !== -1;
        const depth = yd !== undefined && !isNaN(yd) ? yd : 0.45;
        const width = zd !== undefined && !isNaN(zd) ? zd : (isCircular ? depth : 0.3);

        for (const mid of memberIds) {
          const member = members.get(mid);
          if (member) {
            member.section = {
              type: isCircular ? 'CIRCULAR' : 'RECTANGULAR',
              yd: depth,
              zd: width,
              name: isCircular
                ? `Dia ${Math.round(depth * 1000)} mm`
                : `${Math.round(width * 1000)}x${Math.round(depth * 1000)} mm`,
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
      const thickIdx = tokens.findIndex((t) => /^(THICK|THICKNESS)/i.test(t));

      if (thickIdx > 0 && tokens[thickIdx + 1]) {
        const idTokens = tokens.slice(0, thickIdx);
        const plateIds = ANLTokenizer.expandIdList(idTokens);
        const thickness = parseFloat(tokens[thickIdx + 1]);

        if (!isNaN(thickness) && thickness > 0) {
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
   * Format: <node_list> PINNED | FIXED | FIXED BUT ... | ROLLER
   * Example: "1 TO 6 8 9 12 13 16 17 20 TO 23 30 TO 32 PINNED"
   */
  public static parseSupports(lines: TokenizedLine[]): Map<number, Support3D> {
    const supports = new Map<number, Support3D>();

    for (const line of lines) {
      const tokens = line.tokens;
      const pinnedIdx = tokens.findIndex((t) => t.toUpperCase() === 'PINNED');
      const fixedIdx = tokens.findIndex((t) => t.toUpperCase() === 'FIXED');
      const rollerIdx = tokens.findIndex((t) => t.toUpperCase() === 'ROLLER');

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
        const afterFixed = tokens.slice(fixedIdx + 1).map((t) => t.toUpperCase());
        const isFixedBut = afterFixed[0] === 'BUT';

        for (const nid of nodeIds) {
          supports.set(nid, {
            nodeId: nid,
            type: 'FIXED',
            releases: {
              fx: isFixedBut && afterFixed.includes('FX'),
              fy: isFixedBut && afterFixed.includes('FY'),
              fz: isFixedBut && afterFixed.includes('FZ'),
              mx: isFixedBut && (afterFixed.includes('MX') || afterFixed.includes('ROTX')),
              my: isFixedBut && (afterFixed.includes('MY') || afterFixed.includes('ROTY')),
              mz: isFixedBut && (afterFixed.includes('MZ') || afterFixed.includes('ROTZ')),
            },
          });
        }
      } else if (rollerIdx !== -1) {
        const nodeIds = ANLTokenizer.expandIdList(tokens.slice(0, rollerIdx));
        for (const nid of nodeIds) {
          supports.set(nid, {
            nodeId: nid,
            type: 'ROLLER',
            releases: { fx: true, fy: false, fz: true, mx: true, my: true, mz: true },
          });
        }
      }
    }

    return supports;
  }
}
