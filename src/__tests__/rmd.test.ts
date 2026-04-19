import { describe, it, expect } from 'vitest';
import { computeRmd, rmdApplicableAge, uniformLifetimeDivisor } from '../engine/rmd';

describe('rmdApplicableAge', () => {
  it('72 for those born before 1951', () => {
    expect(rmdApplicableAge(1950)).toBe(72);
  });
  it('73 for those born 1951-1959', () => {
    expect(rmdApplicableAge(1955)).toBe(73);
  });
  it('75 for those born 1960+', () => {
    expect(rmdApplicableAge(1960)).toBe(75);
    expect(rmdApplicableAge(1970)).toBe(75);
  });
});

describe('uniformLifetimeDivisor', () => {
  it('73: 26.5', () => expect(uniformLifetimeDivisor(73)).toBe(26.5));
  it('80: 20.2', () => expect(uniformLifetimeDivisor(80)).toBe(20.2));
  it('90: 12.2', () => expect(uniformLifetimeDivisor(90)).toBe(12.2));
});

describe('computeRmd', () => {
  it('returns 0 when below applicable age', () => {
    expect(
      computeRmd({ priorYearEndBalance: 500000, ownerAge: 70, ownerBirthYear: 1955 }),
    ).toBe(0);
  });
  it('$500k @ age 73 (born 1952) → 500000/26.5 ≈ 18867.92', () => {
    expect(
      computeRmd({ priorYearEndBalance: 500000, ownerAge: 73, ownerBirthYear: 1952 }),
    ).toBeCloseTo(500000 / 26.5, 2);
  });
  it('$1M @ age 80 → 1000000/20.2 ≈ 49504.95', () => {
    expect(
      computeRmd({ priorYearEndBalance: 1000000, ownerAge: 80, ownerBirthYear: 1945 }),
    ).toBeCloseTo(1000000 / 20.2, 2);
  });
});
