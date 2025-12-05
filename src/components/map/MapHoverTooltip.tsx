import React, { useEffect, useRef } from 'react'
import * as echarts from 'echarts'

export interface MapHoverInfo {
  x: number
  y: number
  id?: string
  label: string
  subtitle?: string
  type: 'state' | 'county'
  stateFips?: string
  demVotes: number
  gopVotes: number
  otherVotes: number
  totalVotes: number
  reportingPercent?: number
  marginPct?: number
  isEdited?: boolean
}



const STATE_FLAG_URL: Record<string, string> = {
  '01': 'http://upload.wikimedia.org/wikipedia/commons/5/5c/Flag_of_Alabama.svg',
  '02': 'http://upload.wikimedia.org/wikipedia/commons/e/e6/Flag_of_Alaska.svg',
  '04': 'http://upload.wikimedia.org/wikipedia/commons/9/9d/Flag_of_Arizona.svg',
  '05': 'http://upload.wikimedia.org/wikipedia/commons/9/9d/Flag_of_Arkansas.svg',
  '06': 'http://upload.wikimedia.org/wikipedia/commons/0/01/Flag_of_California.svg',
  '08': 'http://upload.wikimedia.org/wikipedia/commons/4/46/Flag_of_Colorado.svg',
  '09': 'http://upload.wikimedia.org/wikipedia/commons/9/96/Flag_of_Connecticut.svg',
  '10': 'http://upload.wikimedia.org/wikipedia/commons/c/c6/Flag_of_Delaware.svg',
  '11': 'http://upload.wikimedia.org/wikipedia/commons/3/3e/Flag_of_Washington%2C_D.C..svg',
  '12': 'http://upload.wikimedia.org/wikipedia/commons/f/f7/Flag_of_Florida.svg',
  '13': 'http://upload.wikimedia.org/wikipedia/commons/0/0f/Flag_of_Georgia.svg',
  '15': 'http://upload.wikimedia.org/wikipedia/commons/e/ef/Flag_of_Hawaii.svg',
  '16': 'http://upload.wikimedia.org/wikipedia/commons/a/a4/Flag_of_Idaho.svg',
  '17': 'http://upload.wikimedia.org/wikipedia/commons/0/01/Flag_of_Illinois.svg',
  '18': 'http://upload.wikimedia.org/wikipedia/commons/a/ac/Flag_of_Indiana.svg',
  '19': 'http://upload.wikimedia.org/wikipedia/commons/a/aa/Flag_of_Iowa.svg',
  '20': 'http://upload.wikimedia.org/wikipedia/commons/d/da/Flag_of_Kansas.svg',
  '21': 'http://upload.wikimedia.org/wikipedia/commons/8/8d/Flag_of_Kentucky.svg',
  '22': 'http://upload.wikimedia.org/wikipedia/commons/e/e0/Flag_of_Louisiana.svg',
  '23': 'http://upload.wikimedia.org/wikipedia/commons/3/35/Flag_of_Maine.svg',
  '24': 'http://upload.wikimedia.org/wikipedia/commons/a/a0/Flag_of_Maryland.svg',
  '25': 'http://upload.wikimedia.org/wikipedia/commons/f/f2/Flag_of_Massachusetts.svg',
  '26': 'http://upload.wikimedia.org/wikipedia/commons/b/b5/Flag_of_Michigan.svg',
  '27': 'http://upload.wikimedia.org/wikipedia/commons/b/b9/Flag_of_Minnesota.svg',
  '28': 'http://upload.wikimedia.org/wikipedia/commons/4/42/Flag_of_Mississippi.svg',
  '29': 'http://upload.wikimedia.org/wikipedia/commons/5/5a/Flag_of_Missouri.svg',
  '30': 'http://upload.wikimedia.org/wikipedia/commons/c/cb/Flag_of_Montana.svg',
  '31': 'http://upload.wikimedia.org/wikipedia/commons/4/4d/Flag_of_Nebraska.svg',
  '32': 'http://upload.wikimedia.org/wikipedia/commons/f/f1/Flag_of_Nevada.svg',
  '33': 'http://upload.wikimedia.org/wikipedia/commons/2/28/Flag_of_New_Hampshire.svg',
  '34': 'http://upload.wikimedia.org/wikipedia/commons/9/92/Flag_of_New_Jersey.svg',
  '35': 'http://upload.wikimedia.org/wikipedia/commons/c/c3/Flag_of_New_Mexico.svg',
  '36': 'http://upload.wikimedia.org/wikipedia/commons/1/1a/Flag_of_New_York.svg',
  '37': 'http://upload.wikimedia.org/wikipedia/commons/b/bb/Flag_of_North_Carolina.svg',
  '38': 'http://upload.wikimedia.org/wikipedia/commons/e/ee/Flag_of_North_Dakota.svg',
  '39': 'http://upload.wikimedia.org/wikipedia/commons/4/4c/Flag_of_Ohio.svg',
  '40': 'http://upload.wikimedia.org/wikipedia/commons/6/6e/Flag_of_Oklahoma.svg',
  '41': 'http://upload.wikimedia.org/wikipedia/commons/b/b9/Flag_of_Oregon.svg',
  '42': 'http://upload.wikimedia.org/wikipedia/commons/f/f7/Flag_of_Pennsylvania.svg',
  '44': 'http://upload.wikimedia.org/wikipedia/commons/f/f3/Flag_of_Rhode_Island.svg',
  '45': 'http://upload.wikimedia.org/wikipedia/commons/6/69/Flag_of_South_Carolina.svg',
  '46': 'http://upload.wikimedia.org/wikipedia/commons/1/1a/Flag_of_South_Dakota.svg',
  '47': 'http://upload.wikimedia.org/wikipedia/commons/9/9e/Flag_of_Tennessee.svg',
  '48': 'http://upload.wikimedia.org/wikipedia/commons/f/f7/Flag_of_Texas.svg',
  '49': 'http://upload.wikimedia.org/wikipedia/commons/f/f6/Flag_of_Utah.svg',
  '50': 'http://upload.wikimedia.org/wikipedia/commons/4/49/Flag_of_Vermont.svg',
  '51': 'http://upload.wikimedia.org/wikipedia/commons/4/47/Flag_of_Virginia.svg',
  '53': 'http://upload.wikimedia.org/wikipedia/commons/5/54/Flag_of_Washington.svg',
  '54': 'http://upload.wikimedia.org/wikipedia/commons/2/22/Flag_of_West_Virginia.svg',
  '55': 'http://upload.wikimedia.org/wikipedia/commons/2/22/Flag_of_Wisconsin.svg',
  '56': 'http://upload.wikimedia.org/wikipedia/commons/b/bc/Flag_of_Wyoming.svg'
}

const formatPercent = (value: number, digits = 1) => {
  if (!Number.isFinite(value)) return '—'
  return `${value.toFixed(digits)}%`
}

const formatNumber = (value: number) => {
  if (!Number.isFinite(value)) return '—'
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`
  return value.toLocaleString('en-US')
}

const VoteSplitChart: React.FC<{
  demVotes: number
  gopVotes: number
  otherVotes: number
  totalVotes: number
}> = ({ demVotes, gopVotes, otherVotes, totalVotes }) => {
  const chartRef = useRef<HTMLDivElement | null>(null)
  const chartInstanceRef = useRef<echarts.ECharts | null>(null)

  useEffect(() => {
    return () => {
      chartInstanceRef.current?.dispose()
      chartInstanceRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!chartRef.current) return
    if (!chartInstanceRef.current) {
      chartInstanceRef.current = echarts.init(chartRef.current, undefined, { renderer: 'svg' })
    }

    const instance = chartInstanceRef.current
    const safeTotal = Math.max(totalVotes, demVotes + gopVotes + otherVotes, 1)
    
    const segments = [
      {
        name: 'Democrat',
        value: demVotes,
        color: '#3b82f6', // blue-500
        borderRadius: [4, otherVotes > 0 || gopVotes > 0 ? 0 : 4, otherVotes > 0 || gopVotes > 0 ? 0 : 4, 4]
      },
      {
        name: 'Other',
        value: otherVotes,
        color: '#71717a', // zinc-500
        borderRadius: [0, 0, 0, 0]
      },
      {
        name: 'Republican',
        value: gopVotes,
        color: '#ef4444', // red-500
        borderRadius: [gopVotes > 0 && otherVotes === 0 ? 4 : 0, 4, 4, gopVotes > 0 && otherVotes === 0 ? 4 : 0]
      }
    ].filter(segment => segment.value > 0)

    const option: echarts.EChartsOption = {
      animation: false,
      backgroundColor: 'transparent',
      grid: { left: 0, right: 0, top: 0, bottom: 0 },
      xAxis: {
        type: 'value',
        min: 0,
        max: safeTotal,
        show: false
      },
      yAxis: {
        type: 'category',
        data: ['votes'],
        show: false
      },
      series: segments.map(segment => ({
        type: 'bar',
        stack: 'votes',
        name: segment.name,
        barWidth: '100%',
        data: [segment.value],
        emphasis: { disabled: true },
        itemStyle: {
          borderRadius: segment.borderRadius,
          color: segment.color
        }
      }))
    }

    instance.setOption(option, true)
    instance.resize()
  }, [demVotes, gopVotes, otherVotes, totalVotes])

  useEffect(() => {
    const handleResize = () => chartInstanceRef.current?.resize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  if (totalVotes <= 0) {
    return null
  }

  return (
    <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/10">
      <div ref={chartRef} className="h-full w-full" />
    </div>
  )
}

export const MapHoverTooltip: React.FC<{ info: MapHoverInfo | null }> = ({ info }) => {
  if (!info) return null

  const { demVotes, gopVotes, otherVotes, totalVotes, reportingPercent, marginPct } = info
  const hasVotes = totalVotes > 0
  
  const demPercent = hasVotes ? (demVotes / totalVotes) * 100 : 0
  const gopPercent = hasVotes ? (gopVotes / totalVotes) * 100 : 0
  const otherPercent = hasVotes ? Math.max(0, 100 - demPercent - gopPercent) : 0
  
  const margin = marginPct ?? (gopPercent - demPercent)
  const marginLabel = hasVotes ? `+${Math.abs(margin).toFixed(1)}` : '—'
  const marginColor = margin > 0 ? 'text-red-400' : margin < 0 ? 'text-blue-400' : 'text-zinc-400'
  const leader = margin > 0 ? 'REP' : margin < 0 ? 'DEM' : 'TIED'

  const flagUrl = info.stateFips ? STATE_FLAG_URL[info.stateFips] : undefined
  const locationTag = info.type === 'state' ? 'STATE' : 'COUNTY'
  const marginDescriptor = margin > 0 ? 'Republican lead' : margin < 0 ? 'Democratic lead' : 'No leader yet'
  const totalLabel = hasVotes ? formatNumber(totalVotes) : '—'
  const reportingLabel = typeof reportingPercent === 'number' ? `${reportingPercent.toFixed(0)}% in` : 'Not reporting'
  const hasOtherVotes = otherVotes > 0

  return (
    <div
      className="pointer-events-none fixed z-50"
      style={{
        left: info.x + 18,
        top: info.y + 18
      }}
    >
      <div className="w-80 rounded-2xl border border-white/12 bg-slate-950/90 px-5 py-4 shadow-[0_25px_60px_rgba(2,6,23,0.65)] backdrop-blur-2xl ring-1 ring-white/5">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            {flagUrl ? (
              <img src={flagUrl} alt="State flag" className="h-9 w-9 rounded-full border border-white/10 object-cover shadow" />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[11px] font-semibold tracking-widest text-white/80">
                {locationTag.slice(0, 2)}
              </div>
            )}
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.35em] text-slate-400">{locationTag}</div>
              <div className="text-xl font-semibold leading-tight text-white">{info.label}</div>
              {info.subtitle && <p className="text-[12px] text-slate-400">{info.subtitle}</p>}
            </div>
          </div>
          <div className={`text-right ${hasVotes ? marginColor : 'text-slate-400'}`}>
            <div className="text-[10px] font-semibold uppercase tracking-wide opacity-80">{marginDescriptor}</div>
            <div className="text-2xl font-black leading-none">{hasVotes ? marginLabel : '—'}</div>
          </div>
        </div>

        {/* Body */}
        <div className="mt-4 rounded-xl border border-white/6 bg-white/[0.02] p-3">
          <VoteSplitChart demVotes={demVotes} gopVotes={gopVotes} otherVotes={otherVotes} totalVotes={totalVotes} />
          {hasVotes ? (
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm text-slate-50">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-blue-200/80">Democrat</div>
                <div className="mt-1 flex items-baseline justify-between">
                  <span className="text-lg font-bold">{formatPercent(demPercent)}</span>
                  <span className="text-[11px] text-blue-200/70">{formatNumber(demVotes)}</span>
                </div>
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-rose-200/80">Republican</div>
                <div className="mt-1 flex items-baseline justify-between">
                  <span className="text-lg font-bold">{formatPercent(gopPercent)}</span>
                  <span className="text-[11px] text-rose-200/70">{formatNumber(gopVotes)}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-4 text-center text-sm text-slate-400">No votes reported</div>
          )}

          {hasVotes && hasOtherVotes && (
            <div className="mt-3 flex items-center justify-between rounded-lg border border-white/5 px-3 py-2 text-[11px] text-slate-300">
              <span className="font-semibold uppercase tracking-wide">Other</span>
              <span>{formatPercent(otherPercent)} • {formatNumber(otherVotes)}</span>
            </div>
          )}

          <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-2 text-[12px] text-slate-300">
            <span>Total reported</span>
            <span className="font-semibold text-slate-50">{totalLabel}</span>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-3 flex items-center justify-between text-[12px] text-slate-400">
          <div className="flex items-center gap-2">
            <span className={`inline-flex h-2 w-2 rounded-full ${hasVotes ? 'bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.65)]' : 'bg-slate-600'}`} />
            <span>{hasVotes ? 'Live reporting' : 'Awaiting first report'}</span>
          </div>
          <span className="font-semibold text-slate-100">{reportingLabel}</span>
        </div>
      </div>
    </div>
  )
}

export default MapHoverTooltip
