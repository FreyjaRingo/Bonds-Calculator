/**
 * Matches product codes from an uploaded price sheet (e.g. "FR0103") against
 * bond names in our database (e.g. "FR103") which sometimes use a different
 * zero-padding convention for the numeric part of the code.
 */
export function normalizeBondCode(code: string): string {
  const trimmed = code.trim().toUpperCase();
  const match = trimmed.match(/^([A-Z]+)(\d+)(.*)$/);
  if (!match) return trimmed;
  const [, prefix, digits, suffix] = match;
  const strippedDigits = digits.replace(/^0+(?=\d)/, "");
  return `${prefix}${strippedDigits}${suffix}`;
}

export interface MatchableBond {
  id: string;
  name: string;
}

/** Returns the matching bond id for a price-sheet product code, or null if none/ambiguous. */
export function matchBondByCode<T extends MatchableBond>(code: string, bonds: T[]): T | null {
  const normalized = normalizeBondCode(code);
  const exact = bonds.find((b) => b.name.trim().toUpperCase() === code.trim().toUpperCase());
  if (exact) return exact;
  const byNormalized = bonds.filter((b) => normalizeBondCode(b.name) === normalized);
  return byNormalized.length === 1 ? byNormalized[0] : null;
}
