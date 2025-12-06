# Results Summary Dashboard Enhancement Plan

## What We Already Have ✅

### Working Chart Types
- **Gauge**: WinProbabilityGauge.tsx, ScenarioIntelligencePanel
- **Pie**: VoteShareChart.tsx, Results3DPanel
- **Line**: ScenarioIntelligencePanel (margin timeline)
- **Scatter**: ScenarioIntelligencePanel
- **Bar3D**: Results3DPanel, Metrics3DPanel
- **Scatter3D**: Results3DPanel, Metrics3DPanel

### Infrastructure & Patterns
- **ECharts 5.6.0 + echarts-gl 2.0.9**: Already installed, no wrapper library needed
- **Chart Pattern**: Init once on mount, update options on data change, dispose on unmount
- **Optimization**: React.memo with custom comparators, separated init/update effects
- **Example**: WinProbabilityGauge shows the proven pattern (direct instance management)

### Existing Components
- **HeroStrip**: Top-level summary with leader, margin, turnout
- **MetricRail**: Horizontal row of key metrics (margin %, turnout, reporting %)
- **VoteShareChart**: Pie chart showing Dem/GOP/Other vote distribution
- **StateLeaderboard**: Table showing per-state results
- **WinProbabilityGauge**: ECharts gauge showing win probability (0-100%)
- **Reporting Status Card**: County reporting breakdown (complete/in-progress/not started)
- **Race Metrics Card**: Outstanding votes, margin, ETA, velocity

---

## What We Need to Build 🔨

### Chart Types to Add (11+ net-new types)
> **Note**: Focusing only on chart types not already implemented

**Net-New ECharts Types:**
1. **Area** (stacked area, area with confidence bands)
2. **Treemap** (hierarchical county/state views)
3. **Bar** (horizontal/vertical, waterfall, stacked)
4. **Heatmap** (state performance matrices)
5. **Radar** (multi-dimensional county comparisons)
6. **Sunburst** (hierarchical vote composition)
7. **Sankey** (vote flow analysis)
8. **Funnel** (voter progression funnels)
9. **Graph** (network/relationship diagrams)
10. **Boxplot** (statistical distributions)
11. **Candlestick** (margin volatility ranges)

---

## Enhancement Components

### Tier 1: Essential Professional Components (High Value, Low Gimmick)

#### 1. **Margin Timeline Chart** (Area + MarkLine + MarkArea)
**Purpose:** Show how the margin has evolved throughout the simulation
**Type:** **Line + Area** (ECharts)
**ECharts Series:** `line` with `areaStyle`, `markLine` for events, `markArea` for confidence bands
**Data:** Time series of margin percentage with key milestones
**Location:** Main content area, replaces or augments VoteShareChart
**Design:**
- X-axis: Elapsed time or reporting %
- Y-axis: Margin percentage (GOP vs DEM)
- **Area fill** showing margin evolution with gradient
- Mark lines for major county reports
- Mark areas for projection zones (confidence bands)
- Smooth curve with gradient fill

**Value:** Provides historical context, shows momentum, reveals patterns

#### 2. **County Reporting Matrix** (**Treemap**)
**Purpose:** Show which counties are reporting and their relative importance
**Type:** **Treemap** (ECharts)
**ECharts Series:** `treemap` with custom visuals
**Data:** Hierarchical data: State → County with size = vote volume
**Location:** Main content area
**Design:**
- Each rectangle = a county
- Size = total vote volume
- Color = reporting % (gradient from gray → yellow → green)
- Nested by state (collapsible)
- Hover shows county details
- Breadcrumb navigation

**Value:** Shows where votes are concentrated, identifies reporting bottlenecks visually

#### 3. **Key Counties Radar Chart** (**Radar**)
**Purpose:** Multi-dimensional view of decisive counties
**Type:** **Radar/Spider Chart** (ECharts)
**ECharts Series:** `radar` with multiple series
**Data:** Key counties plotted on multiple dimensions
**Location:** Sidebar or main content
**Design:**
- Axes: Turnout, Margin Shift, Vote Volume, Reporting Speed, Performance vs Baseline
- Normalized scales (0-100)

**Value:** Compares counties across multiple metrics simultaneously

#### 4. **Outstanding Votes Waterfall Chart** (**Bar** - Stacked Horizontal)
**Purpose:** Show where remaining votes are and how they impact margin
**Type:** **Bar chart (horizontal stacked)** (ECharts)
**ECharts Series:** `bar` with stacking and custom coloring
**Data:** Remaining votes by state/region, stacked by expected lean
**Location:** Main content area
**Design:**
- Horizontal bars showing outstanding votes
- Stacked by Dem/Swing/GOP expected lean
- Sorted by volume or impact
- Annotations showing potential margin swing
- Color gradient based on competitiveness

**Value:** Shows which regions will determine outcome and their likely impact

### Tier 2: Advanced Analytics (Medium Value, Professional)

#### 5. **Reporting Velocity Stacked Area Chart** (**Stacked Area**)
**Purpose:** Show pace and composition of vote counting over time
**Type:** **Stacked Area Chart** (ECharts)
**ECharts Series:** `line` with `stack` and `areaStyle`
**Data:** Cumulative votes reported over time by party
**Location:** Below Margin Timeline
**Design:**
- X-axis: Time intervals
- Y-axis: Cumulative votes
- Three stacked areas: Dem (blue), GOP (red), Other (gray)
- Smooth curves
- Gradient fills with transparency
- Mark lines for reporting spikes
- Projected completion overlay

**Value:** Shows counting momentum and party-specific reporting patterns

#### 6. **State Performance Heatmap Matrix** (**Heatmap**)
**Purpose:** Show multi-metric state performance at a glance
**Type:** **Heatmap** (ECharts)
**ECharts Series:** `heatmap` with custom color scales
**Data:** States (rows) × Metrics (columns) grid
**Location:** Expandable section or secondary tab
**Design:**
- Rows: States (sorted by competitiveness)
- Columns: Margin, Turnout, Reporting %, Velocity, vs Baseline
- Color intensity shows values
- Diverging color scale for margin (blue-white-red)
- Sequential scale for other metrics
- Cell annotations with values

**Value:** Dense comparison across states and metrics

#### 7. **Vote Composition Sunburst Chart** (**Sunburst**)
**Purpose:** Hierarchical breakdown of vote composition
**Type:** **Sunburst** (ECharts)
**ECharts Series:** `sunburst` with multiple levels
**Data:** Total votes → By State → By County → By Candidate
**Location:** Alternative to pie chart
**Design:**
- Center: Total votes
- Ring 1: States (sized by vote share)
- Ring 2: Counties within states
- Ring 3: Candidate breakdown
- Click to zoom into segments
- Gradient colors by margin

**Value:** Shows hierarchical vote structure in single visualization

#### 10. **County Margin Distribution (Histogram)**
**Purpose:** Show distribution of margins across all counties
**Type:** **Bar chart (histogram)** (ECharts)
**ECharts Series:** `bar` with grouped data
**Data:** Counties grouped by margin buckets
**Location:** Secondary panel
**Design:**
- X-axis: Margin buckets (D+20, D+10, D+5, Tie, R+5, R+10, R+20, etc.)
- Y-axis: Number of counties
- Bars colored by lean
- Overlay showing vote-weighted distribution
- Normal distribution curve overlay

**Value:** Shows polarization vs competitiveness of race

### Tier 3: Advanced ECharts Capabilities

**Value:** Visual hierarchy shows where votes come from

### Tier 3: Specialized Analytics (Lower Priority, Still Professional)

#### 8. **Parallel Coordinates Chart** (**Parallel**)
**Purpose:** Multi-dimensional analysis of counties
**Type:** **Parallel** (ECharts)
**ECharts Series:** `parallel`
**Data:** Counties with multiple continuous variables
**Design:**
- Each axis: Different metric (Turnout, Margin, Size, Speed, etc.)
- Each line: A county
- Brushing to filter
- Color by margin or state

**Value:** Explore complex relationships between variables

#### 9. **Sankey Diagram (Vote Flow)** (**Sankey**)
**Purpose:** Show how vote distribution flows from geography to candidates
**Type:** **Sankey** (ECharts)
**ECharts Series:** `sankey`
**Data:** States → Counties → Candidates flow
**Design:**
- Left nodes: States/Regions
- Right nodes: Candidates
- Flow width: Vote volume
- Color by destination

**Value:** Visual representation of vote distribution paths

#### 10. **Boxplot (State Margin Distributions)** (**Boxplot**)
**Purpose:** Show margin distribution and outliers within states
**Type:** **Boxplot** (ECharts)
**ECharts Series:** `boxplot` with `scatter` for outliers
**Data:** County margins grouped by state
**Design:**
- Each box: State's county margin distribution
- Box shows quartiles
- Whiskers show range
- Outlier counties as dots

**Value:** Shows intra-state variation and unusual counties

#### 11. **Candlestick-Style Margin Evolution** (**Candlestick**)
**Purpose:** Show margin changes like stock prices
**Type:** **Candlestick** (ECharts)
**ECharts Series:** `candlestick`
**Data:** Margin open/close/high/low for time intervals
**Design:**
- Each candlestick: Reporting period
- Body: Opening vs closing margin
- Wicks: Max/min margin during period
- Color: Margin direction (widening/narrowing)

**Value:** Shows volatility and direction of margin changes

#### 12. **Graph/Network (County Relationships)** (**Graph**)
**Purpose:** Show counties with similar voting patterns
**Type:** **Graph** (ECharts)
**ECharts Series:** `graph` with force layout
**Data:** Counties as nodes, similarity as edges
**Design:**
- Nodes: Counties (size by vote volume)
- Edges: Similar voting patterns
- Color: Margin
- Force-directed layout clusters similar counties
- Interactive drag/zoom

**Value:** Identifies county clusters and patterns

#### 13. **Funnel Chart (Vote Stages)** (**Funnel**)
**Purpose:** Show vote processing stages
**Type:** **Funnel** (ECharts)
**ECharts Series:** `funnel`
**Data:** Expected → Cast → Processed → Reported
**Design:**
- Each stage as funnel segment
- Width shows volume
- Labels with percentages

**Value:** Shows vote processing pipeline

## Recommended Implementation Priority

### Phase 1 (Immediate - Highest Impact)
**Goal:** Add temporal and geographic context

1. **MarginTimelineChart.tsx** 
   - Type: Line with markLine + areaStyle
   - Props: `{ history: HistoricalSnapshot[]; events?: NewsroomEvent[] }`
   - Shows: Race evolution over time with event markers
   - Pattern: Pure component, builds option from props
   
2. **CountyReportingTreemap.tsx**
   - Type: Treemap (hierarchical)
   - Props: `{ counties: CountyData[]; groupBy: 'state' | 'size' }`
   - Shows: Visual hierarchy of county reporting status
   - Pattern: Nest data by state, size = vote volume, color = reporting %
   
**Value:** Shows conversion rates and drop-off points

---

## Implementation Roadmap

### Phase 1: Essential Components (Priority: Highest)
**Goal:** Add temporal context and geographic insights

1. **MarginTimelineChart.tsx** (Area + MarkLine)
   - Type: Line with area fill, mark lines for events, mark areas for confidence
   - Props: `{ snapshots: HistoricalSnapshot[]; events?: MarginEvent[] }`
   - Shows: How margin evolved over time
   - Pattern: Area gradient, smooth curve, milestone annotations

2. **CountyReportingTreemap.tsx** (Treemap)
   - Type: Treemap hierarchical
   - Props: `{ counties: CountyData[] }`
   - Shows: Counties by size (votes) and reporting status
   - Pattern: Size = vote volume, color = reporting %, nested by state

3. **OutstandingVotesChart.tsx** (Horizontal Bar - Stacked)
   - Type: Horizontal bar with stacking
   - Props: `{ byState: OutstandingVotesByState[] }`
   - Shows: Where remaining votes are + expected lean
   - Pattern: Stacked bars (Dem/Swing/GOP lean), sorted by impact

### Phase 2: Analytics Depth (Priority: High)
**Goal:** Add comparative and predictive views

4. **ReportingVelocityChart.tsx** (Stacked Area)
   - Type: Stacked area
   - Props: `{ intervals: { time: number; demVotes: number; gopVotes: number; otherVotes: number }[] }`
   - Shows: Vote counting pace over time by party
   - Pattern: Cumulative stacked areas with smooth curves + gradient fills

5. **StatePerformanceHeatmap.tsx** (Heatmap)
   - Type: Heatmap matrix
   - Props: `{ states: string[]; metrics: string[]; values: [stateIdx, metricIdx, value][] }`
   - Shows: Multi-metric state comparison at a glance
   - Pattern: Rows = states, columns = metrics, color intensity = value

### Phase 3: Multi-Dimensional Analysis (Priority: Medium)
**Goal:** Add advanced analytical views

6. **KeyCountiesRadar.tsx** (Radar)
   - Type: Radar/spider chart
   - Props: `{ counties: KeyCounty[]; dimensions: string[] }`
   - Shows: Multi-metric county comparison
   - Pattern: Each county = polygon, normalized scales (0-100)

7. **VoteCompositionSunburst.tsx** (Sunburst)
   - Type: Sunburst hierarchical
   - Props: `{ data: HierarchicalVoteData }`
   - Shows: Hierarchical vote breakdown (States → Counties → Candidates)
   - Pattern: Nested rings, click to zoom, gradient coloring

### Phase 4: Specialized Analytics (Priority: Lower)
**Goal:** Add power-user exploration tools

8. **ParallelCoordinatesChart.tsx** (Parallel)
   - Type: Parallel coordinates
   - Props: `{ counties: CountyMetrics[]; axes: string[] }`
   - Shows: Multi-dimensional county relationships
   - Pattern: Each axis = metric, each line = county, brushing enabled

9. **VoteFlowSankey.tsx** (Sankey)
   - Type: Sankey diagram
   - Props: `{ nodes: string[]; links: { source: string; target: string; value: number }[] }`
   - Shows: Vote distribution flow (States → Counties → Candidates)
   - Pattern: Flow width = vote volume, color by destination

10. **MarginDistributionBoxplot.tsx** (Boxplot)
    - Type: Boxplot
    - Props: `{ stateMargins: { state: string; countyMargins: number[] }[] }`
    - Shows: County margin distributions within states
    - Pattern: Box = quartiles, whiskers = range, outliers as scatter points

11. **MarginVolatilityCandlestick.tsx** (Candlestick)
    - Type: Candlestick
    - Props: `{ intervals: { time: number; open: number; close: number; high: number; low: number }[] }`
    - Shows: Margin volatility over reporting periods
    - Pattern: Body = open/close margin, wicks = high/low range

12. **CountyRelationshipGraph.tsx** (Graph)
    - Type: Force-directed graph
    - Props: `{ counties: CountyNode[]; similarities: CountyEdge[] }`
    - Shows: Counties with similar voting patterns
    - Pattern: Nodes = counties (size by votes), edges = similarity, force layout

13. **VoteProcessingFunnel.tsx** (Funnel)
    - Type: Funnel chart
    - Props: `{ stages: { name: string; value: number }[] }`
    - Shows: Vote processing pipeline (Expected → Cast → Processed → Reported)
    - Pattern: Each stage as funnel segment, width = volume

---

## Implementation Details

### Shared Infrastructure to Build

#### 1. chartTheme.ts
Centralized theme configuration for consistent styling:
```typescript
export const chartTheme = {
  partyColors: {
    republican: '#dc2626',  // red-600
    democratic: '#3b82f6',  // blue-500
    other: '#94a3b8',       // slate-400
  },
  
  axisStyle: {
    axisLine: { lineStyle: { color: '#e2e8f0' } },
    axisTick: { lineStyle: { color: '#e2e8f0' } },
    axisLabel: { color: '#64748b', fontSize: 11 },
    splitLine: { lineStyle: { color: '#f1f5f9', type: 'dashed' } },
  },
  
  gridStyle: {
    left: '5%',
    right: '5%',
    top: '15%',
    bottom: '10%',
    containLabel: true,
  },
  
  legendStyle: {
    textStyle: { color: '#64748b', fontSize: 11 },
    icon: 'circle',
    itemWidth: 10,
    itemHeight: 10,
  },
  
  tooltipStyle: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderColor: '#e2e8f0',
    borderWidth: 1,
    textStyle: { color: '#1e293b', fontSize: 12 },
    padding: [8, 12],
  },
  
  animationConfig: {
    animation: true,
    animationDuration: 750,
    animationEasing: 'cubicOut',
  },
}
```

#### 2. Extended Types (results-summary/types.ts)
```typescript
export interface HistoricalSnapshot {
  timestamp: number
  elapsedMinutes: number
  reportingPercent: number
  demVotes: number
  gopVotes: number
  otherVotes: number
  margin: number
  marginPercent: number
  leader: string
}

export interface MarginEvent {
  timestamp: number
  label: string
  description: string
}

export interface OutstandingVotesByState {
  state: string
  stateCode: string
  outstanding: number
  demLean: number    // estimated votes for Dem
  gopLean: number    // estimated votes for GOP
  uncertain: number  // swing/uncertain votes
  potentialSwing: number  // max margin change
}

export interface KeyCounty {
  name: string
  state: string
  turnout: number          // normalized 0-100
  marginShift: number      // normalized 0-100
  voteVolume: number       // normalized 0-100
  reportingSpeed: number   // normalized 0-100
  vsBaseline: number       // normalized 0-100
}

export interface CountyMetrics {
  name: string
  state: string
  turnout: number
  margin: number
  votes: number
  reportingSpeed: number
  vsExpected: number
  // ... additional dimensions
}
```

#### 3. Enhanced Data Hook (useResultsSummaryData.ts)

10. **ParallelCountiesChart.tsx**
    - Type: Parallel coordinates
    - Props: `{ counties: any[]; dimensions: { name: string; min: number; max: number }[] }`
    - Shows: Multi-variate county patterns
    - Pattern: Each axis = dimension, each line = county, brushing enabled
    
11. **VoteFlowSankey.tsx**
    - Type: Sankey
    - Props: `{ nodes: { name: string }[]; links: { source: string; target: string; value: number }[] }`
    - Shows: Geographic to candidate vote flow
    - Pattern: States/regions → candidates with flow widths
    
12. **CountyNetworkGraph.tsx**
    - Type: Graph with force layout
    - Props: `{ counties: any[]; similarity: (a, b) => number }`
    - Shows: Counties with similar patterns
    - Pattern: Force-directed, nodes = counties, edges = similarity
    
13. **MarginCandlestick.tsx**
    - Type: Candlestick
    - Props: `{ intervals: { open: number; close: number; high: number; low: number }[] }`
    - Shows: Margin volatility over intervals
    - Pattern: Each candle = reporting period, body = change, wicks = range

## Design Principles

### What Makes it Professional (Not Gimmicky)
✅ **Data-dense but clear** - Show more information, not more decoration
✅ **Purposeful visuals** - Every chart answers a specific question
✅ **Subdued styling** - Let data stand out, not borders/shadows
✅ **Consistent patterns** - Reuse color schemes, typography, spacing
✅ **Fast updates** - Throttle, don't recreate charts
✅ **Accessible** - Labels, hover states, clear legends

### What to Avoid
❌ Animated counters or spinning numbers
❌ Excessive gradients or glassmorphism
❌ "Live" pulse animations
❌ Overly rounded corners or heavy shadows
❌ Novelty chart types (3D pie, etc.)
❌ Unnecessary icons or emojis
❌ Auto-playing sounds or alerts

## Layout Proposal

```
┌─────────────────────────────────────────────────────────────┐
│ HeroStrip                                    [3D View Button] │
├─────────────────────────────────────────────────────────────┤
│ MetricRail (Margin • Turnout • Reporting)                    │
├──────────────────────────────────┬──────────────────────────┤
│ ┌──────────────────────────────┐ │ ┌──────────────────────┐ │
│ │ Margin Timeline Chart        │ │ │ State Leaderboard    │ │
│ │ (Line chart over time)       │ │ │                      │ │
│ └──────────────────────────────┘ │ └──────────────────────┘ │
│ ┌──────────────────────────────┐ │ ┌──────────────────────┐ │
│ │ Outstanding Votes by State   │ │ │ Win Probability      │ │
│ │ (Horizontal bar chart)       │ │ │ (Gauge)              │ │
│ └──────────────────────────────┘ │ └──────────────────────┘ │
│ ┌────────────┬─────────────────┐ │ ┌──────────────────────┐ │
│ │ Reporting  │ Race Metrics    │ │ │ Margin Sensitivity   │ │
│ │ Status     │                 │ │ │ (Range widget)       │ │
│ └────────────┴─────────────────┘ │ └──────────────────────┘ │
│ ┌──────────────────────────────┐ │ ┌──────────────────────┐ │
│ │ Key Counties Tracker         │ │ │ Reporting Velocity   │ │
│ │ (Table of decisive counties) │ │ │ (Small area chart)   │ │
│ └──────────────────────────────┘ │ └──────────────────────┘ │
└──────────────────────────────────┴──────────────────────────┘
```

## Technical Implementation Notes

### What We Already Have ✅
- ✅ `echarts` (5.6.0) and `echarts-gl` (2.0.9) installed
- ✅ Chart wrapper pattern (direct ECharts instance management)
- ✅ React.memo with custom comparators
- ✅ Throttled updates (Results3DPanel pattern)
- ✅ HeroStrip, MetricRail, StateLeaderboard, VoteShareChart, WinProbabilityGauge
- ✅ useResultsSummaryData hook with aggregates computation

### What We Need to Build 🔨

#### 1. Shared Infrastructure (First)
```
components/sandbox/results-summary/
  ├── chartTheme.ts (NEW - shared styles/colors)
  └── types.ts (EXTEND - add historical snapshot types)
```

#### 2. New Chart Components (Phase 1-4)
```
components/sandbox/results-summary/
  ├── MarginTimelineChart.tsx (NEW)
  ├── CountyReportingTreemap.tsx (NEW)
  ├── OutstandingVotesChart.tsx (NEW)
  ├── TurnoutScatterChart.tsx (NEW)
  ├── ReportingVelocityChart.tsx (NEW)
  ├── StatePerformanceHeatmap.tsx (NEW)
  ├── KeyCountiesRadar.tsx (NEW)
  ├── MarginHistogram.tsx (NEW)
  └── [additional charts as needed]
```

#### 3. Data Hook Extension
```
useResultsSummaryData.ts (EXTEND)
  - Add history tracking: HistoricalSnapshot[]
  - Add outstanding votes by state calculation
  - Add key counties identification
  - Add turnout comparison data
```

### Implementation Pattern (Reuse Existing Approach)

All new charts follow our existing pattern from WinProbabilityGauge.tsx:

{% raw %}
```tsx
// Example: MarginTimelineChart.tsx
import React, { useEffect, useRef, memo } from 'react'
import * as echarts from 'echarts'

interface MarginTimelineChartProps {
  history: HistoricalSnapshot[]
  height?: number
}

const MarginTimelineChartComponent: React.FC<MarginTimelineChartProps> = ({ history, height = 240 }) => {
  const chartRef = useRef<HTMLDivElement | null>(null)
  const chartInstance = useRef<echarts.ECharts | null>(null)

  // Initialize once
  useEffect(() => {
    if (!chartRef.current || chartInstance.current) return
    chartInstance.current = echarts.init(chartRef.current, 'dark')
    
    const handleResize = () => chartInstance.current?.resize()
    window.addEventListener('resize', handleResize)
    
    return () => {
      window.removeEventListener('resize', handleResize)
      chartInstance.current?.dispose()
      chartInstance.current = null
    }
  }, [])

  // Update when data changes
  useEffect(() => {
    if (!chartInstance.current || !history.length) return

    const option: echarts.EChartsOption = {
      // ... build option from history
    }

    chartInstance.current.setOption(option)
  }, [history])

  return <div ref={chartRef} style={{ height: `${height}px`, width: '100%' }} />
}

// Custom comparison
const areEqual = (prev: MarginTimelineChartProps, next: MarginTimelineChartProps) => {
  return prev.history.length === next.history.length && 
         prev.height === next.height
}

export const MarginTimelineChart = memo(MarginTimelineChartComponent, areEqual)
```
{% endraw %}

### Data Requirements

#### Extended useResultsSummaryData Hook
Need to add historical tracking:
```ts
interface HistoricalSnapshot {
  timestamp: number;
  elapsedSeconds: number;
  reportingPercent: number;
  margin: number;
  marginAbsolute: number;
  demVotes: number;
  gopVotes: number;
  otherVotes: number;
  totalVotes: number;
  votesRemaining: number;
  countiesReporting: number;
}

interface OutstandingVotesByState {
  state: string;
  remaining: number;
  expectedLean: 'DEM' | 'GOP' | 'SWING';
  marginImpact: number; // potential swing if all break one way
}

interface KeyCounty {
  fips: string;
  name: string;
  state: string;
  totalVotes: number;
  margin: number;
  reportingPercent: number;
  outstandingVotes: number;
  performanceVsBaseline: number;
}
```

### Component Structure (Following Handbook Patterns)
```
components/sandbox/results-summary/
  ├── Chart.tsx (base wrapper - memo'd)
  ├── chartTheme.ts (shared styles)
  ├── formatters.ts (existing)
  ├── types.ts (extend with historical types)
  ├── useResultsSummaryData.ts (extend with history tracking)
  │
  ├── HeroStrip.tsx (existing)
  ├── MetricRail.tsx (existing)
  ├── StateLeaderboard.tsx (existing)
  │
  ├── MarginTimelineChart.tsx (NEW - Line + markLine + areaStyle)
  ├── CountyReportingTreemap.tsx (NEW - Treemap)
  ├── OutstandingVotesChart.tsx (NEW - Horizontal Bar with stacking)
  ├── TurnoutScatterChart.tsx (NEW - Scatter with regression)
  ├── ReportingVelocityChart.tsx (NEW - Stacked Area)
  ├── StatePerformanceHeatmap.tsx (NEW - Heatmap)
  ├── KeyCountiesRadar.tsx (NEW - Radar)
  ├── MarginHistogram.tsx (NEW - Bar histogram)
  ├── MarginSensitivityGauge.tsx (NEW - Gauge with ranges)
  ├── ParallelCountiesChart.tsx (NEW - Parallel coordinates)
  ├── VoteFlowSankey.tsx (NEW - Sankey)
  ├── CountyNetworkGraph.tsx (NEW - Graph)
  └── MarginCandlestick.tsx (NEW - Candlestick)
```

### Performance Considerations
- **Memoization**: All chart components use `React.memo` with custom comparators
- **Throttling**: Historical snapshots captured max every 200ms
- **Lazy updates**: Charts use `lazyUpdate={true}` for smoother updates
- **Data preparation**: Expensive transformations in `useMemo`
- **Virtualization**: If county lists exceed 100 items, use virtual scrolling
- **Chart pooling**: Reuse chart instances, never dispose unless unmounting

## Next Steps

1. **Confirm priorities** - Which components to build first?
2. **Review data availability** - Do we have the data for these visualizations?
3. **Design approval** - Any layout or styling preferences?
4. **Implementation order** - Phase 1, then 2, then 3?

Let me know which components you want to prioritize and I'll start building them.
