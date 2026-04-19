import { describe, it, expect } from 'vitest';
import { computeIrmaaTier, irmaaTierCeilings } from '../engine/tax/irmaa';

describe('computeIrmaaTier (MFJ)', () => {
  it('tier 0 (base) at MAGI=$200,000', () => {
    const r = computeIrmaaTier(200000, 'mfj');
    expect(r.tier).toBe(0);
    expect(r.partBPremium).toBe(185.0);
    expect(r.partDSurcharge).toBe(0);
  });
  it('tier 1 at MAGI=$220,000', () => {
    const r = computeIrmaaTier(220000, 'mfj');
    expect(r.tier).toBe(1);
    expect(r.partBPremium).toBe(259.0);
  });
  it('tier 2 at MAGI=$300,000', () => {
    const r = computeIrmaaTier(300000, 'mfj');
    expect(r.tier).toBe(2);
    expect(r.partBPremium).toBe(370.0);
  });
  it('top tier at MAGI=$1,000,000', () => {
    const r = computeIrmaaTier(1000000, 'mfj');
    expect(r.tier).toBe(5);
    expect(r.partBPremium).toBe(628.9);
  });
});

describe('computeIrmaaTier (Single)', () => {
  it('tier 0 at MAGI=$100,000', () => {
    expect(computeIrmaaTier(100000, 'single').tier).toBe(0);
  });
  it('tier 1 at MAGI=$120,000', () => {
    expect(computeIrmaaTier(120000, 'single').tier).toBe(1);
  });
  it('top tier at MAGI=$600,000', () => {
    expect(computeIrmaaTier(600000, 'single').tier).toBe(5);
  });
});

describe('irmaaTierCeilings', () => {
  it('returns MFJ ceilings (5 finite tiers)', () => {
    const ceilings = irmaaTierCeilings('mfj');
    expect(ceilings.length).toBe(5);
    expect(ceilings[0]).toBe(212000);
  });
});
