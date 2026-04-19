import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { YearResult } from '../../types';
import { IRMAA } from '../../engine/tables';

type Props = { results: YearResult[]; status: 'single' | 'mfj' };

const fmt = (v: number) => `$${Math.round(v / 1000)}k`;

export function NetWorthChart({ results }: Props) {
  const data = results.map((r) => ({ year: r.year, netWorth: Math.round(r.netWorthEoy) }));
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2a2f3a" />
        <XAxis dataKey="year" stroke="#9aa3b2" />
        <YAxis tickFormatter={fmt} stroke="#9aa3b2" />
        <Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} contentStyle={{ background: '#171a21', border: '1px solid #2a2f3a' }} />
        <Line type="monotone" dataKey="netWorth" stroke="#5eead4" dot={false} strokeWidth={2} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function IncomeStackChart({ results }: Props) {
  const data = results.map((r) => ({
    year: r.year,
    Wages: Math.round(r.wages),
    Pension: Math.round(r.pension),
    SocialSecurity: Math.round(r.socialSecurity),
    Rental: Math.round(r.rentalOther),
    RMD: Math.round(r.rmdTaken),
    Conversions: Math.round(r.rothConversion),
    Withdrawals: Math.round(r.withdrawalsTraditional + r.withdrawalsRoth + r.withdrawalsTaxable),
  }));
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2a2f3a" />
        <XAxis dataKey="year" stroke="#9aa3b2" />
        <YAxis tickFormatter={fmt} stroke="#9aa3b2" />
        <Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} contentStyle={{ background: '#171a21', border: '1px solid #2a2f3a' }} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Area dataKey="Wages" stackId="a" stroke="#60a5fa" fill="#60a5fa" fillOpacity={0.6} />
        <Area dataKey="Pension" stackId="a" stroke="#a78bfa" fill="#a78bfa" fillOpacity={0.6} />
        <Area dataKey="SocialSecurity" stackId="a" stroke="#5eead4" fill="#5eead4" fillOpacity={0.6} />
        <Area dataKey="Rental" stackId="a" stroke="#fbbf24" fill="#fbbf24" fillOpacity={0.6} />
        <Area dataKey="RMD" stackId="a" stroke="#f87171" fill="#f87171" fillOpacity={0.6} />
        <Area dataKey="Conversions" stackId="a" stroke="#fb923c" fill="#fb923c" fillOpacity={0.6} />
        <Area dataKey="Withdrawals" stackId="a" stroke="#4ade80" fill="#4ade80" fillOpacity={0.6} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function TaxStackChart({ results }: Props) {
  const data = results.map((r) => ({
    year: r.year,
    Federal: Math.round(r.federalTax),
    State: Math.round(r.stateTax),
    NIIT: Math.round(r.niitTax),
    IRMAA: Math.round(r.irmaaAnnual),
  }));
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2a2f3a" />
        <XAxis dataKey="year" stroke="#9aa3b2" />
        <YAxis tickFormatter={fmt} stroke="#9aa3b2" />
        <Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} contentStyle={{ background: '#171a21', border: '1px solid #2a2f3a' }} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="Federal" stackId="b" fill="#60a5fa" />
        <Bar dataKey="State" stackId="b" fill="#a78bfa" />
        <Bar dataKey="NIIT" stackId="b" fill="#f87171" />
        <Bar dataKey="IRMAA" stackId="b" fill="#fbbf24" />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function MagiVsIrmaaChart({ results, status }: Props) {
  const tiers = IRMAA.tiers[status]
    .map((t) => t.magiMax)
    .filter((v): v is number => v != null);
  const data = results.map((r) => {
    const row: Record<string, number> = { year: r.year, MAGI: Math.round(r.magiIrmaa) };
    tiers.forEach((t, i) => (row[`Tier${i + 1}`] = t));
    return row;
  });
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2a2f3a" />
        <XAxis dataKey="year" stroke="#9aa3b2" />
        <YAxis tickFormatter={fmt} stroke="#9aa3b2" />
        <Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} contentStyle={{ background: '#171a21', border: '1px solid #2a2f3a' }} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Line type="monotone" dataKey="MAGI" stroke="#5eead4" strokeWidth={2} dot={false} />
        {tiers.map((_, i) => (
          <Line
            key={i}
            type="monotone"
            dataKey={`Tier${i + 1}`}
            stroke="#fbbf24"
            strokeDasharray="4 4"
            strokeWidth={1}
            dot={false}
            legendType={i === 0 ? 'line' : 'none'}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
