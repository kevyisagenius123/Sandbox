import React, { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { isAuthenticated, logout } from '../utils/auth'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import USStatesMap3D from '../components/landing/USStatesMap3D'

gsap.registerPlugin(ScrollTrigger)

const heroHighlights = [
  {
    title: 'Deterministic simulation pipeline',
    description: 'Seeded runs and immutable manifests ensure any scenario can be reproduced for standards and practices review.'
  },
  {
    title: 'DeckGL visualization at scale',
    description: 'Frame orchestration and topic channels keep every on-air surface synchronized across map, timeline, and newsroom feeds.'
  },
  {
    title: 'Analyst-centered workflow',
    description: 'Templates, approvals, and narrative briefs align decision desks, editorial, and streaming teams in one control surface.'
  },
  {
    title: 'Transparent governance',
    description: 'Role-based controls, audit trails, and data retention policies are built in rather than bolted on.'
  }
]

const principles = [
  {
    title: 'Operational discipline',
    description: 'Designed with the same change-management rigor as broadcast control rooms and cloud newsroom stacks.',
    bullets: ['Rolling rehearsals with scripted fallbacks', 'Blue/green release strategy with automated smoke tests', 'Observability dashboards aligned to newsroom SLAs']
  },
  {
    title: 'Trusted data lifecycle',
    description: 'Every dataset, transformation, and simulation artifact is catalogued with provenance metadata and retention schedules.',
    bullets: ['Schema validation for CSV and GeoJSON assets', 'Versioned storage with differential diffs for reviews', 'Granular RBAC compatible with enterprise SSO']
  },
  {
    title: 'Audience-ready storytelling',
    description: 'High fidelity map and text layers adapt to fast-moving editorial guidance without sacrificing performance.',
    bullets: ['Responsively tuned deck.gl shaders for 4K and OTT', 'Narrative overlays with newsroom editorial hooks', 'API surface for companion apps and second-screen formats']
  }
]

const architecture = [
  {
    name: 'Data onboarding',
    summary: 'Pipeline validates geography and historical datasets before packaging them into reusable scenario manifests suitable for audit.',
    note: 'Schema enforcement, deterministic seeding, and anomaly detection with human-in-the-loop sign-off.'
  },
  {
    name: 'Simulation services',
    summary: 'Spring Boot services coordinate frame generation, resilience patterns, and cache warming to support real-time playback.',
    note: 'Horizontally scalable microservices with Redis-backed queues and workload-aware throttling.'
  },
  {
    name: 'Experience layer',
    summary: 'React and DeckGL clients deliver synchronized visuals, newsroom cues, and telemetry to every stakeholder surface.',
    note: 'STOMP/WebSocket streaming with reconciliation logic to keep analysts and viewers aligned.'
  }
]

const governancePoints = [
  'Access policies and retention schedules documented for newsroom compliance and legal teams.',
  'Incident playbooks include tabletop rehearsal outputs and accountable owners across engineering and editorial.',
  'Security roadmap tracks SOC 2 alignment, regional data residency considerations, and newsroom-specific requirements.'
]

const callouts = [
  'Product roadmap reviews available under mutual NDA.',
  'Integration kits cover CMS, control room, and broadcast graphics pipelines.',
  'Reference deployments demonstrate end-to-end rehearsal workflows for national and regional election cycles.'
]

const SandboxLandingPage: React.FC = () => {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const studioHref = isAuthenticated() ? '/studio' : '/login'

  useEffect(() => {
    const ctx = gsap.context(() => {
      const heroTimeline = gsap.timeline({ defaults: { ease: 'power2.out' } })
      heroTimeline
        .from('.hero-heading', { y: 32, opacity: 0, duration: 0.9 })
        .from('.hero-copy', { y: 24, opacity: 0, duration: 0.7 }, '-=0.5')
        .from('.hero-cta', { y: 20, opacity: 0, duration: 0.6, stagger: 0.1 }, '-=0.4')

      gsap.utils.toArray<HTMLElement>('.fade-section').forEach((section) => {
        const targets = section.querySelectorAll('.fade-item')
        if (!targets.length) return

        gsap.from(targets, {
          y: 28,
          opacity: 0,
          duration: 0.8,
          stagger: 0.1,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: section,
            start: 'top 80%',
            toggleActions: 'play none none reverse'
          }
        })
      })
    }, rootRef)

    return () => ctx.revert()
  }, [])

  return (
    <div ref={rootRef} className="min-h-screen bg-slate-950 text-slate-100">
      <nav className="border-b border-slate-800 bg-slate-950/70 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center space-x-10">
              <Link to="/" className="text-lg font-semibold tracking-tight text-white">
                Election Analytics Sandbox
              </Link>
              <div className="hidden md:flex items-center space-x-6 text-sm text-slate-300">
                <a href="#product" className="hover:text-white transition-colors">Product</a>
                <a href="#platform" className="hover:text-white transition-colors">Platform</a>
                <a href="#governance" className="hover:text-white transition-colors">Governance</a>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              {isAuthenticated() ? (
                <>
                  <button
                    onClick={() => {
                      logout()
                      window.location.reload()
                    }}
                    className="hidden md:inline-block rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition-colors hover:border-slate-500"
                  >
                    Sign Out
                  </button>
                  <Link
                    to="/studio"
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-500"
                  >
                    Open Studio
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="hidden md:inline-block rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition-colors hover:border-slate-500"
                  >
                    Sign In
                  </Link>
                  <Link
                    to="/studio"
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-500"
                  >
                    Open Studio
                  </Link>
                </>
              )}
              <a
                href="mailto:invest@electionanalytics.com"
                className="hidden md:inline-block rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition-colors hover:border-slate-500"
              >
                Investor Brief
              </a>
            </div>
          </div>
        </div>
      </nav>

      <header className="border-b border-slate-900 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 relative overflow-hidden">
        {/* Interactive 3D Map Background */}
        <div className="absolute inset-0 flex items-end" style={{ pointerEvents: 'none' }}>
          <div className="relative w-full h-[70%]" style={{ pointerEvents: 'auto' }}>
            <USStatesMap3D height={600} />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/65 to-transparent" />
          </div>
        </div>

        <div className="relative z-10 max-w-6xl mx-auto px-4 py-20 sm:px-6 lg:px-8" style={{ pointerEvents: 'auto' }}>
          <div className="max-w-3xl space-y-6">
            <p className="text-sm uppercase tracking-[0.35em] text-blue-400">Election operations platform</p>
            <h1 className="hero-heading text-4xl font-semibold leading-tight text-white md:text-[3rem]">
              Model, rehearse, and broadcast election night narratives with the control your newsroom expects.
            </h1>
            <p className="hero-copy text-lg text-slate-300 md:text-xl">
              The sandbox brings analysts, editorial leaders, operations, and digital teams into one shared environment with reproducible simulations, governed data, and ready-for-air visuals.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                to={studioHref}
                className="hero-cta inline-flex items-center justify-center rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-500"
              >
                Launch Simulation Studio
              </Link>
              <a
                href="#platform"
                className="hero-cta inline-flex items-center justify-center rounded-lg border border-slate-700 px-6 py-3 text-sm font-semibold text-slate-200 transition-colors hover:border-slate-500"
              >
                Review Platform Architecture
              </a>
            </div>
          </div>

          <div className="fade-section mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {heroHighlights.map((item) => (
              <div key={item.title} className="fade-item rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm p-5">
                <h3 className="text-base font-semibold text-white">{item.title}</h3>
                <p className="mt-3 text-sm text-slate-300">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </header>

      <section id="product" className="fade-section border-b border-slate-900 bg-slate-950">
        <div className="max-w-6xl mx-auto grid grid-cols-1 gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[2fr_3fr] lg:px-8">
          <div className="space-y-6">
            <h2 className="fade-item text-3xl font-semibold text-white">Purpose-built for decision desks</h2>
            <p className="fade-item text-slate-300">
              Analysts, producers, and anchors work from a single source of truth. Scenario templates, approval workflows, and narrative briefs keep every stakeholder aligned from rehearsal through election night.
            </p>
            <div className="fade-item rounded-lg border border-slate-800 bg-slate-900/60 p-6">
              <p className="text-xs uppercase tracking-wide text-blue-400">Analyst workflow</p>
              <ol className="mt-3 list-decimal space-y-2 pl-4 text-sm text-slate-300">
                <li>Onboard geography and historical priors with automated validation.</li>
                <li>Compose simulations with reproducible seeds and documented assumptions.</li>
                <li>Publish scenarios to production control with contextual briefs and guardrails.</li>
              </ol>
            </div>
            <p className="fade-item text-xs text-slate-500">
              Detailed benchmarks, reference architectures, and customer case studies are available in the investor brief.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {principles.map((principle) => (
              <div key={principle.title} className="fade-item flex flex-col rounded-xl border border-slate-800 bg-slate-900/70 p-6">
                <h3 className="text-lg font-semibold text-white">{principle.title}</h3>
                <p className="mt-3 text-sm text-slate-300">{principle.description}</p>
                <ul className="mt-4 space-y-2 text-sm text-slate-400">
                  {principle.bullets.map((bullet) => (
                    <li key={bullet} className="flex gap-2">
                      <span className="mt-[6px] h-1.5 w-1.5 rounded-full bg-slate-500"></span>
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="platform" className="fade-section border-b border-slate-900 bg-slate-900">
        <div className="max-w-6xl mx-auto px-4 py-20 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="fade-item text-sm uppercase tracking-[0.3em] text-blue-400">Platform architecture</p>
              <h2 className="fade-item mt-3 text-3xl font-semibold text-white">Resilient pipeline from ingestion to on-air experience</h2>
            </div>
            <Link
              to="/studio/design"
              className="fade-item inline-flex items-center justify-center rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 transition-colors hover:border-slate-500"
            >
              Preview Studio Experience
            </Link>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
            {architecture.map((stage) => (
              <div key={stage.name} className="fade-item flex h-full flex-col rounded-xl border border-slate-800 bg-slate-900/60 p-6">
                <h3 className="text-lg font-semibold text-white">{stage.name}</h3>
                <p className="mt-3 text-sm text-slate-300">{stage.summary}</p>
                <p className="mt-4 text-xs text-slate-500">{stage.note}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="governance" className="fade-section border-b border-slate-900 bg-slate-950">
        <div className="max-w-5xl mx-auto px-4 py-20 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="fade-item text-sm uppercase tracking-[0.3em] text-blue-400">Risk & governance</p>
            <h2 className="fade-item mt-4 text-3xl font-semibold text-white">Governance modeled on newsroom, legal, and operations standards</h2>
            <p className="fade-item mt-4 text-base text-slate-300">
              The platform aligns with existing broadcast and digital compliance processes. Documentation, access policies, and audit support are available to partners and investors under NDA.
            </p>
          </div>
          <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
            {governancePoints.map((point) => (
              <div key={point} className="fade-item rounded-xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-300">
                {point}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="fade-section bg-slate-900">
        <div className="max-w-6xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
          <div className="fade-item rounded-2xl border border-slate-800 bg-slate-900/70 p-10 text-center">
            <h2 className="text-3xl font-semibold text-white">Partner with us for upcoming cycles</h2>
            <p className="mt-4 text-base text-slate-300">
              We collaborate with newsrooms, network operations, and investors to expand the platform responsibly. Materials include rehearsal run books, product roadmap milestones, and integration guides.
            </p>
            <ul className="mt-6 space-y-2 text-sm text-slate-400">
              {callouts.map((callout) => (
                <li key={callout}>{callout}</li>
              ))}
            </ul>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <a
                href="mailto:invest@electionanalytics.com"
                className="hero-cta rounded-lg border border-slate-700 px-6 py-3 text-sm font-semibold text-slate-200 transition-colors hover:border-slate-500"
              >
                Request Investor Materials
              </a>
              <Link
                to={studioHref}
                className="hero-cta rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-500"
              >
                Explore the Studio
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-900 bg-slate-950">
        <div className="max-w-6xl mx-auto flex flex-col gap-6 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div className="text-sm text-slate-500">
            © {new Date().getFullYear()} Election Analytics Sandbox. All rights reserved.
          </div>
          <div className="flex flex-wrap gap-6 text-sm text-slate-400">
            <Link to="/studio/design" className="hover:text-white transition-colors">Product Demo</Link>
            <a href="https://github.com/kevyisagenius123/electionanalytics" className="hover:text-white transition-colors" target="_blank" rel="noopener noreferrer">
              GitHub
            </a>
            <a href="mailto:invest@electionanalytics.com" className="hover:text-white transition-colors">
              Contact Investor Relations
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default SandboxLandingPage
