import { describe, it, expect } from 'vitest';
import { ANLTokenizer } from '@/features/anl/tokenizer/anlTokenizer';

describe('ANLTokenizer', () => {
  it('should clean page breaks and page headers', () => {
    const raw = `
    STAAD SPACE                                              -- PAGE NO.    2
    1. STAAD SPACE
    2. JOINT COORDINATES
    `;
    const lines = ANLTokenizer.cleanAndExtractLines(raw);
    expect(lines.some((l) => l.text.includes('PAGE NO.'))).toBe(false);
    expect(lines.length).toBeGreaterThan(0);
  });

  it('should join continuation lines ending with dash (-)', () => {
    const raw = `
    53 TO 58 60 TO 69 73 TO 75 170 TO 175 -
    177 TO 186 PRIS YD 0.55 ZD 0.45
    `;
    const lines = ANLTokenizer.cleanAndExtractLines(raw);
    expect(lines.length).toBe(1);
    expect(lines[0].text).toContain('PRIS YD 0.55 ZD 0.45');
  });

  it('should split statements separated by semicolons', () => {
    const raw = `1 0 0 0; 2 5.4 0 0; 3 8.1 0 0;`;
    const lines = ANLTokenizer.cleanAndExtractLines(raw);
    expect(lines.length).toBe(3);
    expect(lines[0].text).toBe('1 0 0 0');
    expect(lines[1].text).toBe('2 5.4 0 0');
    expect(lines[2].text).toBe('3 8.1 0 0');
  });

  it('should expand TO range token sequences', () => {
    const tokens = ['1', 'TO', '4', '6', '8', 'TO', '10'];
    const expanded = ANLTokenizer.expandIdList(tokens);
    expect(expanded).toEqual([1, 2, 3, 4, 6, 8, 9, 10]);
  });
});
