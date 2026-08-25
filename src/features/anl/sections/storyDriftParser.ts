import { StoryDriftRecord } from '@/features/model/types';

export class StoryDriftParser {
  public static parse(rawLines: string[]): StoryDriftRecord[] {
    const drifts: StoryDriftRecord[] = [];
    let inDriftSection = false;

    for (let i = 0; i < rawLines.length; i++) {
      const line = rawLines[i].trim();

      if (/STORY\s+DRIFT/i.test(line) || /PRINT\s+STORY\s+DRIFT/i.test(line)) {
        inDriftSection = true;
        continue;
      }

      if (!inDriftSection) continue;

      if (/^\s*\d+\.\s+[A-Z]/i.test(line) && !/STORY\s+DRIFT/i.test(line)) {
        inDriftSection = false;
        continue;
      }

      // Look for lines like: "STORY1   3.20      1         0.125                   0.125            0.00039     PASS"
      // or "1   3.20   5   0.45   0.12   0.0012   PASS"
      const tokens = line.split(/\s+/).filter(Boolean);
      if (tokens.length >= 6) {
        const lastToken = tokens[tokens.length - 1].toUpperCase();
        if (lastToken === 'PASS' || lastToken === 'FAIL' || lastToken === 'WARNING') {
          const storyName = tokens[0];
          const height = parseFloat(tokens[1]);
          const loadCaseId = parseInt(tokens[2], 10);
          const avgDispCm = parseFloat(tokens[3]);
          const driftCm = parseFloat(tokens[4]);
          const driftRatio = parseFloat(tokens[5]);

          if (!isNaN(height) && !isNaN(loadCaseId)) {
            drifts.push({
              storyName,
              height,
              loadCaseId,
              avgDispCm: isNaN(avgDispCm) ? 0 : avgDispCm,
              driftCm: isNaN(driftCm) ? 0 : driftCm,
              driftRatio: isNaN(driftRatio) ? 0 : driftRatio,
              allowableRatio: 0.004, // L/250 = 0.004
              status: lastToken as 'PASS' | 'FAIL' | 'WARNING',
            });
          }
        }
      }
    }

    return drifts;
  }
}
