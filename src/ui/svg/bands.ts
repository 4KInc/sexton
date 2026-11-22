// The five ground bands (design 5.4). Edges come from register.config, not from here.
import type { Config } from '../../engine/config.ts';
import { SCALE } from './scale.ts';

export type BandId = 'below' | 'road' | 'shallow' | 'wall' | 'consecrated';

export interface Band {
  id: BandId;
  fromKm: number;
  toKm: number;
}

export function bandsOf(config: Config): Band[] {
  const zone = config.protectedZoneKm;
  return [
    { id: 'below', fromKm: SCALE.minKm, toKm: -zone },
    { id: 'road', fromKm: -zone, toKm: zone },
    { id: 'shallow', fromKm: zone, toKm: config.thresholdLowKm },
    { id: 'wall', fromKm: config.thresholdLowKm, toKm: config.thresholdHighKm },
    { id: 'consecrated', fromKm: config.thresholdHighKm, toKm: SCALE.maxKm },
  ];
}
