# Results Summary Panel Upgrade Plan

## 1. Objective
Elevate the `ResultsSummary` experience (2D analytics + 3D scenes) to a production-grade, broadcast-quality dashboard rivaling FAANG-level news/political analytics. The end state should deliver:
- Immediate situational awareness for campaign analysts and anchors.
- High-fidelity data storytelling across vote totals, margin dynamics, geographic hotspots, and reporting cadence.
- Seamless integration between 2D analytical views and immersive 3D scenes.
- Production resiliency (performance, error handling, observability, test coverage, accessibility, theming consistency).

## 2. Current Assessment (as of 2025-11-09)
### Data & State Management
- Aggregations performed inline inside `ResultsSummary.tsx`; no dedicated selector layer or memoized data models shared with other panels.
- County/state snapshots recomputed per render from raw maps; no caching against simulation ticks.
- Lacks explicit typing for derived models (e.g., `StateRollup`, `CountySnapshot`).

### UI/UX & Information Architecture
- Layout improved recently but still dense and card-driven; hero area lacks contextual metadata (turnout vs prior cycle, timeline delta, etc.).
- Mobile/tablet experience unverified; large grids overflow on small viewports.
- Visual hierarchy inconsistent (multiple card styles, mixed typography scales, limited negative space).
- Accessibility gaps: color-only encoding for party, no ARIA/alt text on critical charts.

### Charting (2D)
- ECharts options assembled inline; no shared styling utilities or theme integration.
- Tooltips formatted with raw HTML strings (difficult to localize/test and vulnerable to injection if data ever dynamic).
- Gauge and pie charts driven by derived percentages but lack trend storytelling (no deltas, no time context).
- No skeleton/loading states for charts during data refreshes.

### 3D Components
- `Results3DPanel` lazy-loaded but shares no state contract with summary (duplicate calculations).
- No synchronization between 2D metrics and 3D camera/filters; toggling to 3D is binary rather than contextual (e.g., auto-focus on hotspot counties).
- Lack of fallback UI for devices without WebGL even after detection improvements.

### Performance & Resilience
- TypeScript build currently failing (see §6) preventing deploy confidence.
- Chart instances created/destroyed manually; needs centralized hook to avoid memory growth on repeated toggles.
- No suspense/skeleton for heavy data loads, leading to layout jumps.

### Observability & Product Analytics
- No instrumentation (user interactions, chart toggles, view durations).
- No logging around data anomalies (e.g., negative counts, missing totals).

### Testing
- Absence of dedicated unit/visual/regression tests for summary panel.
- No storybook coverage for individual sections or states (loading, error, partial data, tie scenarios).

## 3. Key Gaps vs "FAANG-grade" Bar
1. **Experience Cohesion** – need unified hero zone, timeline narrativization, responsive layout, and accessible palette.
2. **Data Contract & Reuse** – centralize derived metrics, share with 2D/3D/other panels, enforce typing.
3. **Charting System** – abstract common theming, interactions, and skeleton states; introduce advanced views (trendlines, comparison overlays, timeline scrub).
4. **3D Integration** – context-aware camera presets, synchronized filters, fallback experiences.
5. **Performance/Resilience** – optimized memoization, virtualization for lists, skeletons, proper cleanup of ECharts/deck.gl contexts.
6. **Tooling & Quality** – TypeScript clean build, automated tests, storybook/regression pipeline, telemetry instrumentation.

## 4. Recommended Workstreams
| Workstream | Focus | Representative Tasks | Deliverables |
| --- | --- | --- | --- |
| A. Data Architecture | Build reusable data layer | Create selectors for national/state/county metrics, define `ResultSnapshot` interfaces, cache per simulation tick, central error handling | `src/domain/results/*` modules, unit tests |
| B. Experience & Layout | Redesign hero + grid | Partner with design on wireframes, implement responsive CSS grid, add candidate avatars, incorporate turnout vs last cycle, add reporting timeline ribbon | Figma spec, updated JSX with responsive breakpoints, accessibility audit |
| C. Charting System | Componentize ECharts usage | Create `useEchart` hook with lifecycle mgmt, move configs to typed builders, add sparkline/horizon charts, add empty/error states, replace raw HTML tooltips with React portals | `src/components/charts/*`, documentation |
| D. 3D Cohesion | Align 2D/3D insights | Define shared context for selected geo, build camera presets, add overlays (e.g., turnout heat), provide fallback 2.5D view for unsupported devices | Updated `Results3DPanel`, interop API |
| E. Performance & Observability | Production hardening | Profiling (React Profiler, WebGL), add suspense skeletons, add logging + analytics events, integrate Sentry breadcrumbs, enforce build-time lint/ts rules | Performance report, telemetry pipeline |
| F. Quality & Tooling | Automation + docs | Resolve TypeScript errors project-wide, create Storybook stories (loading/success/anomaly), add vitest unit tests & Playwright visual tests, document runbooks | Passing CI, QA checklist |

## 5. Implementation Roadmap
1. **Phase 0 – Audit & Foundations (Week 1)**
   - Resolve TypeScript build blockers.
   - Capture design brief and success metrics with stakeholders.
   - Set up Storybook + regression screenshot harness.

2. **Phase 1 – Data & Architecture (Weeks 2-3)**
   - Extract selectors/data services.
   - Add context providers for shared metrics.
   - Introduce error boundaries and loading surface for summary panel.

3. **Phase 2 – UI/UX Refresh (Weeks 3-5)**
   - Implement hero section, responsive grid, refined typography.
   - Build new chart components (vote trend, turnout vs expectations, reporting velocity timeline).
   - Add accessibility enhancements and skeleton states.

4. **Phase 3 – 3D Integration & Advanced Analytics (Weeks 5-7)**
   - Synchronize 2D filters with 3D panel, add hotspot presets.
   - Implement county drill-down (click -> highlight in 3D + detail card).
   - Add scenario playback controls integrated with summary metrics.

5. **Phase 4 – Hardening & Launch Prep (Weeks 7-8)**
   - Performance profiling, memory + WebGL leak verification.
   - Add analytics events, finalize documentation, run usability review.
   - Freeze UI, execute regression + cross-browser/device matrix.

## 6. Build Health & Prerequisites
- **Current status:** `npm run build` fails with 55 TypeScript errors across multiple files (unused variables, missing modules, incorrect typings, outdated tests).
- **Required action:** Prioritize cleanup or suppression strategy before tackling redesign to maintain green CI.
- Ensure design resources available to produce high-fidelity comps matching broadcast standard.
- Secure time from data/backend team to validate aggregation accuracy and provide future additional metrics (turnout history, absentee vs election-day splits, projected outstanding ballots, etc.).

## 7. Open Questions
1. What datastreams are available for comparative baselines (previous election, internal polls)?
2. Is 3D panel intended for production or exploratory? Do we support non-WebGL devices with alternative experiences?
3. Do we need multi-language/localization support in 2026 cycle?
4. What analytics/telemetry stack should capture user engagement (Amplitude, GA, internal)?
5. What SLA do campaign stakeholders expect for data latency and accuracy alerts?

---
Prepared by: GitHub Copilot (AI assistant)
Date: 2025-11-09
