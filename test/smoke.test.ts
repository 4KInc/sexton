import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/engine/config.ts';

describe('smoke', () => {
  it('imports the config', () => {
    expect(CONFIG.geoAltitudeKm).toBe(35786);
  });
});
