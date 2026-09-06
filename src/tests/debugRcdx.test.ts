import { it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { readRCDC } from '@/features/rcdx/rcdxReader';
import { rcdcToModel } from '@/features/rcdx/rcdxToModel';

const ROOT = path.resolve(__dirname, '../..');
const FILES = {
  beamShort: path.join(ROOT, 'STR no cantFINAL-Beam-1-3.2 m.rcdx'),
  beamLong: path.join(ROOT, 'STR no cantFINAL-Beam-1-6.4 m.rcdx'),
  column: path.join(ROOT, 'STR no cantFINAL-Column-1.R1.rcdx'),
  slab: path.join(ROOT, 'STR no cantFINAL-Slab-1-3.2 m.rcdx'),
};
const readBytes = (p: string) => new Uint8Array(fs.readFileSync(p).buffer.slice(0));

it('debug dump', async () => {
  for (const [key, p] of Object.entries(FILES)) {
    if (key !== 'column') continue;
    try {
      const doc = await readRCDC(readBytes(p), `${key}.rcdx`);
      const col = doc.columns[0];
      console.log('C1 coords', JSON.stringify(col.barCoords));
      console.log('C1 main', JSON.stringify(col.mainBars));
      console.log('C1 ws', col.widthMm, col.depthMm);
    } catch (e) {
      console.log('====', key, 'ERROR', (e as Error).message);
    }
  }
}, 300000);