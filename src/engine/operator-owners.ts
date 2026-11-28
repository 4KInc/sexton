// The one operator whose SATCAT owner code is known from a test, not from its name (R13 context fix).
// Nothing else is mapped. No source that was opened says that the owner code ITSO is the operator Intelsat;
// the mapping holds because every sourced Intelsat payload in the register carries owner ITSO (see test/operator-owners.test.ts).
/** Operator name (as in data/operators.json) to the SATCAT owner code that the register shows for that operator's payloads. */
export const OPERATOR_OWNER_CODE: Readonly<Record<string, string>> = { Intelsat: 'ITSO' };
/** The owner code mapped to an operator, or null. */
export const ownerCodeOf = (operator: string): string | null => Object.hasOwn(OPERATOR_OWNER_CODE, operator) ? OPERATOR_OWNER_CODE[operator]! : null;
/** The operator mapped to an owner code, or null. */
export const operatorOfOwner = (code: string): string | null => Object.entries(OPERATOR_OWNER_CODE).find(([, c]) => c === code)?.[0] ?? null;
