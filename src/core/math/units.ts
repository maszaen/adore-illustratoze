export type UnitType = 'px' | 'pt' | 'pc' | 'mm' | 'cm' | 'in';

/**
 * Standard Adobe Illustrator base coordinate space:
 * 1 inch = 72 points (pt) = 72 pixels (px at 72 ppi) = 25.4 mm = 2.54 cm = 6 picas (pc)
 */
const UNIT_TO_PT: Record<UnitType, number> = {
  pt: 1,
  px: 1,
  pc: 12,
  in: 72,
  mm: 72 / 25.4,
  cm: 72 / 2.54,
};

export const UNIT_LABELS: Record<UnitType, string> = {
  px: 'Pixels (px)',
  pt: 'Points (pt)',
  pc: 'Picas (pc)',
  mm: 'Millimeters (mm)',
  cm: 'Centimeters (cm)',
  in: 'Inches (in)',
};

export function toPoints(value: number, fromUnit: UnitType): number {
  if (!Number.isFinite(value)) return 0;
  return value * (UNIT_TO_PT[fromUnit] ?? 1);
}

export function fromPoints(points: number, toUnit: UnitType): number {
  if (!Number.isFinite(points)) return 0;
  return points / (UNIT_TO_PT[toUnit] ?? 1);
}

export function convertUnit(value: number, fromUnit: UnitType, toUnit: UnitType): number {
  if (fromUnit === toUnit) return value;
  return fromPoints(toPoints(value, fromUnit), toUnit);
}

export function formatUnitValue(points: number, unit: UnitType, decimals = 2): string {
  const val = fromPoints(points, unit);
  const factor = Math.pow(10, decimals);
  const rounded = Math.round(val * factor) / factor;
  return `${rounded}`;
}

/**
 * Evaluates numeric scrub input expressions supporting:
 * - Unit suffixes anywhere in expression: "50mm", "2in + 10pt", "100px * 1.5"
 * - Arithmetic operators: +, -, *, /, %, parentheses
 * - Relative percentages when currentPoints is provided
 * Returns result in document base points (pt/px) or null if invalid.
 */
export function evaluateNumericExpression(
  rawInput: string,
  documentUnit: UnitType,
  currentValueInPoints?: number
): number | null {
  const trimmed = rawInput.trim();
  if (!trimmed) return null;

  // Handle pure percentage relative to currentValueInPoints, e.g. "150%"
  if (/^[+-]?\d+(\.\d+)?%$/.test(trimmed) && currentValueInPoints !== undefined) {
    const pct = parseFloat(trimmed.slice(0, -1));
    return (currentValueInPoints * pct) / 100;
  }

  // Replace numbers with explicit unit suffix into target documentUnit values
  const unitRegex = /([+-]?\d*(?:\.\d+)?)\s*(px|pt|pc|mm|cm|in)\b/gi;
  let hasExplicitUnits = false;
  const normalized = trimmed.replace(unitRegex, (_match, numStr: string, unitStr: string) => {
    if (numStr === '' || numStr === '+' || numStr === '-') return _match;
    const val = parseFloat(numStr);
    const u = unitStr.toLowerCase() as UnitType;
    hasExplicitUnits = true;
    const inDocUnit = convertUnit(val, u, documentUnit);
    return `(${inDocUnit})`;
  });

  // Replace percentage tokens inside arithmetic expressions
  const withPercent = normalized.replace(/(\d+(?:\.\d+)?)%/g, (_m, n) => {
    const base = currentValueInPoints !== undefined ? fromPoints(currentValueInPoints, documentUnit) : 1;
    return `(${base} * ${parseFloat(n) / 100})`;
  });

  // Validate only safe math tokens remain
  if (!/^[0-9+\-*/().\s]+$/.test(withPercent)) {
    return null;
  }

  try {
    // Safe recursive descent math parser (no eval needed)
    const resultInDocUnit = parseMathExpression(withPercent);
    if (!Number.isFinite(resultInDocUnit)) return null;
    return toPoints(resultInDocUnit, documentUnit);
  } catch {
    return null;
  }
}

function parseMathExpression(expr: string): number {
  let pos = 0;
  const str = expr.replace(/\s+/g, '');

  function parseExpression(): number {
    let left = parseTerm();
    while (pos < str.length && (str[pos] === '+' || str[pos] === '-')) {
      const op = str[pos++];
      const right = parseTerm();
      left = op === '+' ? left + right : left - right;
    }
    return left;
  }

  function parseTerm(): number {
    let left = parseFactor();
    while (pos < str.length && (str[pos] === '*' || str[pos] === '/')) {
      const op = str[pos++];
      const right = parseFactor();
      if (op === '/' && right === 0) return NaN;
      left = op === '*' ? left * right : left / right;
    }
    return left;
  }

  function parseFactor(): number {
    if (str[pos] === '+') {
      pos++;
      return parseFactor();
    }
    if (str[pos] === '-') {
      pos++;
      return -parseFactor();
    }
    if (str[pos] === '(') {
      pos++;
      const val = parseExpression();
      if (str[pos] === ')') pos++;
      return val;
    }
    const start = pos;
    while (pos < str.length && ((str[pos] >= '0' && str[pos] <= '9') || str[pos] === '.')) {
      pos++;
    }
    if (start === pos) return NaN;
    return parseFloat(str.slice(start, pos));
  }

  const val = parseExpression();
  if (pos < str.length) return NaN;
  return val;
}
