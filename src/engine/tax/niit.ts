import { FEDERAL, StatusKey } from '../tables';

/**
 * Net Investment Income Tax: 3.8% on the lesser of net investment income or MAGI above the threshold.
 * Net investment income here includes LTCG, qualified dividends, interest, rental income (simplified).
 */
export function computeNiit(params: {
  status: StatusKey;
  magi: number;
  netInvestmentIncome: number;
}): number {
  const { status, magi, netInvestmentIncome } = params;
  const threshold = FEDERAL.niit.threshold[status];
  const excess = Math.max(0, magi - threshold);
  const base = Math.max(0, Math.min(excess, netInvestmentIncome));
  return base * FEDERAL.niit.rate;
}
