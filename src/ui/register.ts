// The register the site loads: the one file, register.json (design 3.1).
import type { Config } from '../engine/config.ts';
import type { Register } from '../engine/types.ts';

export type UiRegister = Omit<Register, 'config'> & { config: Config };

/** A light check of the parts the UI reads. It is not a schema validator. */
export function isRegister(value: unknown): value is UiRegister {
  if (typeof value !== 'object' || value === null) return false;
  const r = value as Partial<UiRegister>;
  const c = r.config as Partial<Config> | undefined;
  return (
    r.schema === 1 &&
    typeof r.sample === 'boolean' &&
    Array.isArray(r.records) &&
    typeof r.snapshot?.set === 'string' &&
    typeof r.census === 'object' &&
    r.census !== null &&
    typeof c === 'object' &&
    c !== null &&
    typeof c.protectedZoneKm === 'number' &&
    typeof c.thresholdLowKm === 'number' &&
    typeof c.thresholdHighKm === 'number'
  );
}
