export interface MarginBucket {
  max: number | null; // null means open-ended
  label: string;
  demColor: string;
  repColor: string;
}

// Ordered margin buckets (percentage points)
export const MARGIN_BUCKETS: MarginBucket[] = [
  { max: 1, label: '0–1%', demColor: '#c6ddf7', repColor: '#f8c9c9' },
  { max: 5, label: '1–5%', demColor: '#94c2ee', repColor: '#f19d9d' },
  { max: 10, label: '5–10%', demColor: '#5fa3e0', repColor: '#e46f6f' },
  { max: 20, label: '10–20%', demColor: '#2f82ce', repColor: '#d14242' },
  { max: 30, label: '20–30%', demColor: '#115fa8', repColor: '#b62020' },
  { max: null, label: '30%+', demColor: '#063a6e', repColor: '#7d1212' }
];

export function getMarginBucket(marginPct: number): MarginBucket {
  for (const b of MARGIN_BUCKETS) {
    if (b.max === null || marginPct < b.max) return b;
  }
  return MARGIN_BUCKETS[MARGIN_BUCKETS.length - 1];
}

export function getMarginColor(marginPct: number, winner: 'DEM' | 'GOP' | null): string {
  if (!winner || isNaN(marginPct)) return '#666666';
  const bucket = getMarginBucket(Math.abs(marginPct));
  return winner === 'DEM' ? bucket.demColor : bucket.repColor;
}

export function describeMargin(marginPct: number, winner: 'DEM' | 'GOP' | null): string {
  if (!winner) return 'No data';
  const bucket = getMarginBucket(Math.abs(marginPct));
  const side = winner === 'DEM' ? 'D' : 'R';
  return `${side}+${marginPct.toFixed(1)} (${bucket.label})`;
}
