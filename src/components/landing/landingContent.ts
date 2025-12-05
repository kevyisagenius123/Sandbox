export const heroHighlights = [
  {
    title: 'Deterministic simulation pipeline',
    description:
      'Seeded runs and immutable manifests ensure any scenario can be reproduced for standards and practices review.'
  },
  {
    title: 'DeckGL visualization at scale',
    description:
      'Frame orchestration and topic channels keep every on-air surface synchronized across map, timeline, and newsroom feeds.'
  },
  {
    title: 'Analyst-centered workflow',
    description:
      'Templates, approvals, and narrative briefs align decision desks, editorial, and streaming teams in one control surface.'
  },
  {
    title: 'Transparent governance',
    description:
      'Role-based controls, audit trails, and data retention policies are built in rather than bolted on.'
  }
]

export const principles = [
  {
    title: 'Operational discipline',
    description:
      'Designed with the same change-management rigor as broadcast control rooms and cloud newsroom stacks.',
    bullets: [
      'Rolling rehearsals with scripted fallbacks',
      'Blue/green release strategy with automated smoke tests',
      'Observability dashboards aligned to newsroom SLAs'
    ]
  },
  {
    title: 'Trusted data lifecycle',
    description:
      'Every dataset, transformation, and simulation artifact is catalogued with provenance metadata and retention schedules.',
    bullets: [
      'Schema validation for CSV and GeoJSON assets',
      'Versioned storage with differential diffs for reviews',
      'Granular RBAC compatible with enterprise SSO'
    ]
  },
  {
    title: 'Audience-ready storytelling',
    description:
      'High fidelity map and text layers adapt to fast-moving editorial guidance without sacrificing performance.',
    bullets: [
      'Responsively tuned deck.gl shaders for 4K and OTT',
      'Narrative overlays with newsroom editorial hooks',
      'API surface for companion apps and second-screen formats'
    ]
  }
]

export const architecture = [
  {
    name: 'Data onboarding',
    summary:
      'Pipeline validates geography and historical datasets before packaging them into reusable scenario manifests suitable for audit.',
    note: 'Schema enforcement, deterministic seeding, and anomaly detection with human-in-the-loop sign-off.'
  },
  {
    name: 'Simulation services',
    summary:
      'Spring Boot services coordinate frame generation, resilience patterns, and cache warming to support real-time playback.',
    note: 'Horizontally scalable microservices with Redis-backed queues and workload-aware throttling.'
  },
  {
    name: 'Experience layer',
    summary:
      'React and DeckGL clients deliver synchronized visuals, newsroom cues, and telemetry to every stakeholder surface.',
    note: 'STOMP/WebSocket streaming with reconciliation logic to keep analysts and viewers aligned.'
  }
]

export const governancePoints = [
  'Access policies and retention schedules documented for newsroom compliance and legal teams.',
  'Incident playbooks include tabletop rehearsal outputs and accountable owners across engineering and editorial.',
  'Security roadmap tracks SOC 2 alignment, regional data residency considerations, and newsroom-specific requirements.'
]

export const callouts = [
  'Product roadmap reviews available under mutual NDA.',
  'Integration kits cover CMS, control room, and broadcast graphics pipelines.',
  'Reference deployments demonstrate end-to-end rehearsal workflows for national and regional election cycles.'
]
