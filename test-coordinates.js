// Test coordinate normalization to verify states and counties use same space
import { geoAlbersUsa, geoAlbers } from 'd3-geo';

const MAP_TARGET_WIDTH = 14;

// Simulate the prepareStateGeometry bounds calculation
const projection = geoAlbersUsa().scale(1350).translate([0, 0]);
const puertoRicoProjection = geoAlbers()
  .rotate([66, 0])
  .center([0, 18])
  .parallels([8, 18])
  .scale(1350 * 0.65)
  .translate([0, 0]);

// Sample coordinates for Michigan
const michiganStateCoord = [-84.5, 44.5]; // Central Michigan (approximate)
const ioniaCountyCoord = [-85.06, 42.98]; // Ionia County

// Calculate bounds (simplified - just using a few points)
let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

// Project some reference points to establish bounds
const testPoints = [
  [-125, 25], // West coast
  [-67, 45],  // East coast
  [-85, 45],  // Michigan area
];

testPoints.forEach(([lon, lat]) => {
  const projected = projection([lon, lat]);
  if (projected) {
    const [x, y] = projected;
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
});

console.log('Initial bounds (before Puerto Rico):');
console.log(`  X: [${minX.toFixed(2)}, ${maxX.toFixed(2)}]`);
console.log(`  Y: [${minY.toFixed(2)}, ${maxY.toFixed(2)}]`);

// Add Puerto Rico bounds
const puertoRicoBounds = [
  [-67.945404, 17.881984],
  [-65.220703, 18.520601]
];
const puertoRicoCorners = [
  [puertoRicoBounds[0][0], puertoRicoBounds[0][1]],
  [puertoRicoBounds[0][0], puertoRicoBounds[1][1]],
  [puertoRicoBounds[1][0], puertoRicoBounds[0][1]],
  [puertoRicoBounds[1][0], puertoRicoBounds[1][1]]
];

puertoRicoCorners.forEach(([lon, lat]) => {
  const projected = puertoRicoProjection([lon, lat]);
  if (projected) {
    const [x, y] = projected;
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
});

console.log('\nBounds after Puerto Rico:');
console.log(`  X: [${minX.toFixed(2)}, ${maxX.toFixed(2)}]`);
console.log(`  Y: [${minY.toFixed(2)}, ${maxY.toFixed(2)}]`);

// Calculate normalization parameters
const centerX = (minX + maxX) / 2;
const centerY = (minY + maxY) / 2;
const maxSpan = Math.max(maxX - minX, maxY - minY);
const scale = MAP_TARGET_WIDTH / maxSpan;

console.log('\nNormalization parameters:');
console.log(`  Center: (${centerX.toFixed(2)}, ${centerY.toFixed(2)})`);
console.log(`  Max span: ${maxSpan.toFixed(2)}`);
console.log(`  Scale: ${scale.toFixed(6)}`);

// Project and normalize Michigan state coordinate
const miStateProj = projection(michiganStateCoord);
if (miStateProj) {
  const [x, y] = miStateProj;
  const normX = (x - centerX) * scale;
  const normY = (y - centerY) * scale;
  console.log('\nMichigan state point:');
  console.log(`  Projected: (${x.toFixed(2)}, ${y.toFixed(2)})`);
  console.log(`  Normalized: (${normX.toFixed(4)}, ${normY.toFixed(4)})`);
}

// Project and normalize Ionia County coordinate
const ioniaProj = projection(ioniaCountyCoord);
if (ioniaProj) {
  const [x, y] = ioniaProj;
  const normX = (x - centerX) * scale;
  const normY = (y - centerY) * scale;
  console.log('\nIonia County point:');
  console.log(`  Projected: (${x.toFixed(2)}, ${y.toFixed(2)})`);
  console.log(`  Normalized: (${normX.toFixed(4)}, ${normY.toFixed(4)})`);
  console.log(`  (This should match the county coordinate from console: x: 3.09, y: -1.57)`);
}

// Check if they're in similar ranges
console.log('\n✓ If normalized values are in similar ranges (around 3.0 for x, around -1.5 to -2.5 for y),');
console.log('  then states and counties ARE using the same coordinate system.');
console.log('✓ The issue must be elsewhere (rotation, parenting, or mesh construction).');
