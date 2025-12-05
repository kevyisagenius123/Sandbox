// Election color buckets for map visualization
// Based on Iowa-style margin bins: 0-1, 1-5, 5-10, 10-20, 20-30, 30+

// GOP (Republican) color buckets from light to dark red
export const GOP_BUCKETS = ['#FF9999','#FF7070','#FF4444','#E03B2F','#B51400','#730900'];

// Democrat color buckets from light to dark blue  
export const DEM_BUCKETS = ['#9999FF','#7070FF','#4444FF','#2D6BFF','#0047D6','#001E5C'];

// Color bucket index based on margin percentage
export function getMarginBucketIndex(absMargin: number): number {
  const m = Math.abs(absMargin);
  return (m < 1) ? 0 : (m < 5) ? 1 : (m < 10) ? 2 : (m < 20) ? 3 : (m < 30) ? 4 : 5;
}

// Get color for a specific margin percentage
export function getMarginColor(marginPct: number): string {
  if (!isFinite(marginPct)) return '#64748B'; // neutral gray
  
  const idx = getMarginBucketIndex(Math.abs(marginPct));
  return marginPct >= 0 ? GOP_BUCKETS[idx] : DEM_BUCKETS[idx];
}

// Convert hex color to RGBA array for deck.gl
export function hexToRgba(hex: string, alpha: number = 255): [number, number, number, number] {
  try {
    const s = hex.replace('#', '');
    const n = parseInt(s.length === 3 ? s.split('').map(c => c + c).join('') : s, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, alpha];
  } catch {
    return [100, 116, 139, alpha]; // fallback gray
  }
}