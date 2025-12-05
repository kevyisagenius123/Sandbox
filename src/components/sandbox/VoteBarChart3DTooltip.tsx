import React from 'react'

interface VoteBarChart3DTooltipProps {
  county: string
  fips: string
  demVotes: number
  gopVotes: number
  totalVotes: number
  reportingPercent: number
}

export const VoteBarChart3DTooltip: React.FC<VoteBarChart3DTooltipProps> = ({
  county,
  demVotes,
  gopVotes,
  totalVotes,
  reportingPercent
}) => {
  const demPercent = ((demVotes / totalVotes) * 100).toFixed(1)
  const gopPercent = ((gopVotes / totalVotes) * 100).toFixed(1)
  const margin = Math.abs(demVotes - gopVotes)
  const marginPercent = ((margin / totalVotes) * 100).toFixed(1)
  const leader = demVotes > gopVotes ? 'DEM' : 'GOP'
  const leaderColor = leader === 'DEM' ? '#3b82f6' : '#ef4444'

  return (
    <div
      style={{
        background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.98) 0%, rgba(30, 41, 59, 0.98) 100%)',
        padding: 0,
        borderRadius: '10px',
        border: '1px solid rgba(148, 163, 184, 0.25)',
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05) inset',
        minWidth: '220px',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        overflow: 'hidden'
      }}
    >
      {/* Header */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(51, 65, 85, 0.6) 0%, rgba(30, 41, 59, 0.4) 100%)',
          padding: '10px 14px',
          borderBottom: '1px solid rgba(148, 163, 184, 0.15)'
        }}
      >
        <div style={{ fontWeight: 700, color: '#f1f5f9', fontSize: '13px', letterSpacing: '0.01em' }}>
          {county}
        </div>
        <div style={{ color: '#94a3b8', fontSize: '11px', marginTop: '3px', fontWeight: 500 }}>
          {reportingPercent.toFixed(1)}% reporting
        </div>
      </div>

      {/* Leader Badge */}
      <div style={{ padding: '12px 14px 10px', borderBottom: '1px solid rgba(148, 163, 184, 0.1)' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 10px',
            background: `${leaderColor}22`,
            border: `1px solid ${leaderColor}44`,
            borderRadius: '6px'
          }}
        >
          <div
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: leaderColor,
              boxShadow: `0 0 6px ${leaderColor}88`
            }}
          />
          <span style={{ color: leaderColor, fontWeight: 600, fontSize: '11px', letterSpacing: '0.02em' }}>
            {leader} +{marginPercent}
          </span>
        </div>
      </div>

      {/* Vote Breakdown */}
      <div style={{ padding: '12px 14px' }}>
        <div style={{ display: 'flex', gap: '16px' }}>
          {/* DEM */}
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#3b82f6' }} />
              <span
                style={{
                  color: '#94a3b8',
                  fontSize: '10px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}
              >
                Democrat
              </span>
            </div>
            <div style={{ color: '#f1f5f9', fontSize: '15px', fontWeight: 700, fontFeatureSettings: "'tnum'" }}>
              {demPercent}%
            </div>
            <div style={{ color: '#64748b', fontSize: '10px', marginTop: '2px', fontFeatureSettings: "'tnum'" }}>
              {demVotes.toLocaleString()}
            </div>
          </div>

          {/* GOP */}
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#ef4444' }} />
              <span
                style={{
                  color: '#94a3b8',
                  fontSize: '10px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}
              >
                Republican
              </span>
            </div>
            <div style={{ color: '#f1f5f9', fontSize: '15px', fontWeight: 700, fontFeatureSettings: "'tnum'" }}>
              {gopPercent}%
            </div>
            <div style={{ color: '#64748b', fontSize: '10px', marginTop: '2px', fontFeatureSettings: "'tnum'" }}>
              {gopVotes.toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          background: 'rgba(15, 23, 42, 0.5)',
          padding: '8px 14px',
          borderTop: '1px solid rgba(148, 163, 184, 0.1)'
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            color: '#64748b',
            fontSize: '10px',
            fontWeight: 500
          }}
        >
          <span>Total Votes</span>
          <span style={{ color: '#94a3b8', fontWeight: 600, fontFeatureSettings: "'tnum'" }}>
            {totalVotes.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  )
}
