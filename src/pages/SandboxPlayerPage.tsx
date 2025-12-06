import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { iowaMarginRgba, extrusionFromMarginIOWA, turnoutHeightFromVotesIOWA, clamp } from '../lib/election/swing'
import DeckGL from '@deck.gl/react'
import { GeoJsonLayer } from '@deck.gl/layers'
import { AmbientLight, LightingEffect, DirectionalLight } from '@deck.gl/core'
import type { FeatureCollection, Feature, Geometry } from 'geojson'
import { Client } from '@stomp/stompjs'
import SockJS from 'sockjs-client'
import { debugLog } from '../utils/debugLogger'

// --- Simulation Sandbox Player Page ---
// Dynamic election simulation with user-configured parameters

// Basic view state
interface ViewState { longitude: number; latitude: number; zoom: number; pitch?: number; bearing?: number }

// Candidate structure
interface Candidate {
  id: number
  name: string
  party: string
  color: string // RGB hex (e.g., "#ff283c")
}

// Backend frame county structure
interface CountySnapshot {
  fips: string
  name: string
  percentReported: number
  votes: { [candidateId: number]: number }
  totalVotes: number
  leadingCandidateIndex: number
  margin: number
}

interface FrameDTO {
  frameNumber: number
  timestamp: string
  percentReported: number
  counties: CountySnapshot[]
  stateTotals: {
    votes: { [candidateId: number]: number }
    totalVotes: number
    leadingCandidateIndex: number
    margin: number
    marginPercent: number
  }
}

interface SimulationMetadata {
  simulationId: string
  status: string
  createdAt: string
  framesGenerated: number
  duration: string
  geography: {
    type: string
    description: string
    countyCount: number
  }
  candidateCount: number
}

// Color function: dynamic based on candidate colors
// @ts-ignore - unused utility function
function sandboxColor(candidateVotes: {[id: number]: number}, candidates: Candidate[], reporting: number): [number,number,number,number] {
  if (reporting <= 0.005) return [140,155,175,160];
  
  // Get leading candidate
  let leadingId = 0;
  let maxVotes = 0;
  Object.entries(candidateVotes).forEach(([id, votes]) => {
    if (votes > maxVotes) {
      maxVotes = votes;
      leadingId = parseInt(id);
    }
  });
  
  const leading = candidates.find(c => c.id === leadingId);
  if (!leading) return [140,155,175,160];
  
  // Parse hex color
  const hex = leading.color.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  
  // Calculate margin percentage
  const total = Object.values(candidateVotes).reduce((sum, v) => sum + v, 0);
  const leadPct = total > 0 ? maxVotes / total : 0;
  
  // Fade to neutral color for close races
  const neutralR = 140;
  const neutralG = 155;
  const neutralB = 175;
  
  // leadPct ranges from 0.5 (50% tie) to 1.0 (100% landslide)
  // Map 0.5→0 (neutral), 1.0→1 (full color)
  const intensity = Math.max(0, (leadPct - 0.5) * 2);
  
  const finalR = Math.round(intensity * r + (1 - intensity) * neutralR);
  const finalG = Math.round(intensity * g + (1 - intensity) * neutralG);
  const finalB = Math.round(intensity * b + (1 - intensity) * neutralB);
  
  const a = Math.round(180 + 60 * Math.min(1, reporting));
  return [finalR, finalG, finalB, a];
}

function formatSimulationTime(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    const h = date.getHours();
    const m = date.getMinutes().toString().padStart(2, '0');
    const ampm = h >= 12 ? 'PM' : 'AM';
    const displayH = h % 12 || 12;
    return `${displayH}:${m} ${ampm}`;
  } catch {
    return timestamp;
  }
}

const SandboxPlayerPage: React.FC = () => {
  const { simulationId } = useParams<{ simulationId: string }>();
  
  // DeckGL camera - will be adjusted based on geography
  const [viewState, setViewState] = useState<ViewState>({
    longitude: -82.5,
    latitude: 28.0,
    zoom: 6.2,
    pitch: 45,
    bearing: 0
  });

  // GeoJSON refs for counties and state boundary
  const countiesRef = useRef<FeatureCollection | null>(null);
  const stateRef = useRef<Feature<Geometry, any> | null>(null);
  const deckRef = useRef<any>(null); // DeckGL instance ref for cleanup
  const mountedRef = useRef<boolean>(true); // Track component mount state

  // Simulation metadata
  const [metadata, setMetadata] = useState<SimulationMetadata | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  
  // Playback + frame state
  const [currentFrame, setCurrentFrame] = useState<FrameDTO | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1.0);
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const wsClientRef = useRef<Client | null>(null);

  // County results map
  const [countiesState, setCountiesState] = useState<Map<string, CountySnapshot>>(new Map());

  // UI / display
  const [hoveredCounty, setHoveredCounty] = useState<string|null>(null);
  const [mousePos, setMousePos] = useState({x:0,y:0});
  const [status, setStatus] = useState('Loading simulation...');
  const [heightScale, setHeightScale] = useState(1.0);
  const [fillAlpha, setFillAlpha] = useState(235);
  const [extrusionMode, setExtrusionMode] = useState<'margin'|'turnout'|'hybrid'>('hybrid');
  const [hybridWeight, setHybridWeight] = useState(60);
  const [showCounties, setShowCounties] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const updateViewport = () => {
      setIsMobile(window.innerWidth < 768);
    };
    updateViewport();
    window.addEventListener('resize', updateViewport);
    return () => window.removeEventListener('resize', updateViewport);
  }, []);

  useEffect(() => {
    if (!isMobile) {
      setMobilePanelOpen(false);
    }
  }, [isMobile]);

  // Load simulation metadata
  useEffect(() => {
    if (!simulationId) {
      setStatus('No simulation ID provided');
      return;
    }
    
    fetch(`http://localhost:8081/api/sandbox/${simulationId}/metadata`)
      .then(r => {
        if (!r.ok) {
          throw new Error(`HTTP ${r.status}: ${r.statusText}`);
        }
        return r.json();
      })
      .then(data => {
        setMetadata(data);
        setStatus(`Loaded: ${data.geography.description}`);
        
        // Extract candidates from config (stored in metadata)
        // For now, we'll use default candidates - you'll need to expose this in the backend
        setCandidates([
          { id: 0, name: 'Candidate A', party: 'Party A', color: '#1e50c8' },
          { id: 1, name: 'Candidate B', party: 'Party B', color: '#ff283c' }
        ]);
      })
      .catch(e => {
        console.error('Failed to load metadata:', e);
        setStatus(`Error: ${e.message}`);
      });
  }, [simulationId]);

  // Load geography based on simulation config
  useEffect(() => {
    if (!metadata) return;
    
    let active = true;
    (async () => {
      try {
        const [countiesData, stateData] = await Promise.all([
          fetch(`${import.meta.env.BASE_URL}gz_2010_us_050_00_500k.json`).then(r=>r.json()),
          fetch(`${import.meta.env.BASE_URL}gz_2010_us_040_00_500k.json`).then(r=>r.json())
        ]);
        if (!active) return;
        
        // Filter counties based on metadata geography
        // For now, assume single state - extract FIPS from description
        const stateCode = '12'; // Default Florida - should be extracted from metadata
        
        countiesRef.current = {
          ...countiesData,
          features: countiesData.features.filter((f: any) => {
            const code = f.properties?.GEO_ID?.slice(-5) || f.properties?.FIPS || f.properties?.GEOID;
            return code && code.startsWith(stateCode);
          })
        };
        
        stateRef.current = stateData.features.find((f: any) => 
          f.properties && f.properties.STATE === stateCode
        ) || null;
        
        setStatus(`Map ready - ${metadata.geography.description}`);
      } catch (e) {
        console.error(e);
        setStatus('Failed loading map');
      }
    })();
    return () => { active = false };
  }, [metadata]);

  // WebSocket connection for real-time updates
  useEffect(() => {
    mountedRef.current = true;
    
    if (!simulationId) return;
    
    // WebSocket setup code here...
    
    return () => {
      mountedRef.current = false;
      
      // Cleanup DeckGL instance
      if (deckRef.current) {
        try {
          if (typeof deckRef.current.deck?.finalize === 'function') {
            deckRef.current.deck.finalize();
          }
          deckRef.current = null;
        } catch (e) {
          console.error('Error disposing DeckGL:', e);
        }
      }
      
      // Clear GeoJSON refs
      countiesRef.current = null;
      stateRef.current = null;
      
      // Disconnect WebSocket if connected
      if (wsClientRef.current && isConnected) {
        try {
          wsClientRef.current.deactivate();
        } catch (e) {
          console.error('Error disconnecting WebSocket:', e);
        }
      }
    };
  }, [simulationId, isConnected]);

  // WebSocket connection for real-time updates (original)
  useEffect(() => {
    if (!simulationId) return;
    
    const client = new Client({
      webSocketFactory: () => new SockJS(`http://localhost:8081/sandbox-websocket`),
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
      onConnect: () => {
        debugLog('WebSocket connected to sandbox');
        setStatus('Connected to sandbox');
        setIsConnected(true);
        
        // Subscribe to frame updates for this simulation
        client.subscribe(`/topic/sandbox/${simulationId}/frames`, (message) => {
          try {
            const frame: FrameDTO = JSON.parse(message.body);
            const map = new Map<string, CountySnapshot>();
            
            (frame.counties||[]).forEach(c => {
              map.set(c.fips, c);
            });
            
            setCountiesState(map);
            setCurrentFrame(frame);
            setCurrentFrameIndex(frame.frameNumber);
            setStatus(`${formatSimulationTime(frame.timestamp)} • ${frame.stateTotals.totalVotes.toLocaleString()} votes`);
          } catch (e) {
            console.error('Failed to parse frame:', e);
          }
        });
      },
      onStompError: (frame) => {
        console.error('WebSocket error:', frame);
        setStatus('WebSocket error');
        setIsConnected(false);
      },
      onWebSocketClose: () => {
        debugLog('WebSocket closed');
        setStatus('Disconnected');
        setIsConnected(false);
      }
    });

    client.activate();
    wsClientRef.current = client;

    return () => {
      if (client.active) {
        client.deactivate();
      }
      setIsConnected(false);
    };
  }, [simulationId]);

  // Control functions
  const handlePlayPause = async () => {
    try {
      if (isPlaying) {
        debugLog('Pausing playback...');
        // Send pause via WebSocket
        if (wsClientRef.current?.connected) {
          wsClientRef.current.publish({
            destination: `/app/sandbox/${simulationId}/pause`,
            body: '{}'
          });
        }
        setIsPlaying(false);
      } else {
        debugLog('Starting playback...');
        if (wsClientRef.current?.connected) {
          wsClientRef.current.publish({
            destination: `/app/sandbox/${simulationId}/play`,
            body: JSON.stringify({ speed })
          });
        }
        setIsPlaying(true);
      }
    } catch (e) {
      console.error('Failed to toggle playback:', e);
    }
  };

  const handleReset = async () => {
    try {
      setIsPlaying(false);
      if (wsClientRef.current?.connected) {
        wsClientRef.current.publish({
          destination: `/app/sandbox/${simulationId}/reset`,
          body: '{}'
        });
      }
      setCurrentFrameIndex(0);
      setCountiesState(new Map());
    } catch (e) {
      console.error('Failed to reset:', e);
    }
  };

  const handleSpeedChange = (newSpeed: number) => {
    setSpeed(newSpeed);
    if (isPlaying && wsClientRef.current?.connected) {
      wsClientRef.current.publish({
        destination: `/app/sandbox/${simulationId}/play`,
        body: JSON.stringify({ speed: newSpeed })
      });
    }
  };

  // Helper function to create state layer
  const createStateLayer = () => {
    if (!stateRef.current || !currentFrame) return null;
    
    const totals = currentFrame.stateTotals;
    const marginPct = totals.marginPercent || 0;
    
    // @ts-ignore - calculated but not used
    const targetAlpha = showCounties ? 0 : clamp(Math.min(fillAlpha, 220), 30, 255);
    
    return new GeoJsonLayer<Feature<Geometry, any>>({
      id: 'state-layer',
      data: stateRef.current,
      stroked: true,
      filled: true,
      extruded: true,
      parameters: ({ depthTest: true } as any),
      getFillColor: () => {
        const alpha = showCounties ? 0 : clamp(fillAlpha, 30, 255);
        return iowaMarginRgba(marginPct, alpha);
      },
      getElevation: () => {
        return showCounties ? 0 : extrusionFromMarginIOWA(marginPct) * heightScale * 0.6;
      },
      getLineColor: () => {
        const alpha = showCounties ? 0 : 255;
        return [255, 255, 255, alpha] as [number, number, number, number];
      },
      lineWidthMinPixels: 1.6,
      pickable: true,
      onClick: () => {
        setShowCounties(!showCounties);
      },
      transitions: {
        getElevation: { duration: 800, easing: (t: number) => t * t * (3 - 2 * t) },
        getFillColor: { duration: 600 },
        getLineColor: { duration: 600 }
      },
      updateTriggers: { 
        getFillColor: [currentFrame, fillAlpha, showCounties], 
        getElevation: [currentFrame, heightScale, showCounties],
        getLineColor: [showCounties]
      }
    });
  };

  // State layer
  const stateLayer = useMemo(() => {
    return createStateLayer();
  }, [stateRef.current, currentFrame, fillAlpha, heightScale, showCounties]);

  // County layer
  const countyLayer = useMemo(() => {
    if (!countiesRef.current || !showCounties) return null;
    
    return new GeoJsonLayer<Feature<Geometry, any>>({
      id: 'county-layer',
      data: countiesRef.current,
      filled: true,
      extruded: true,
      wireframe: false,
      pickable: true,
      stroked: true,
      parameters: ({ depthTest: false } as any),
      getFillColor: (f: any) => {
        const code = f.properties?.GEO_ID?.slice(-5) || f.properties?.FIPS || f.properties?.GEOID;
        const c = countiesState.get(code);
        if (!c) return [100, 116, 139, 180];
        
        // Calculate margin using vote totals
        const votes = Object.values(c.votes);
        if (votes.length < 2) return [100, 116, 139, 180];
        
        const [v1, v2] = votes.sort((a, b) => b - a);
        const margin = (v1 + v2) > 0 ? ((v1 - v2) / (v1 + v2)) * 100 : 0;
        
        return iowaMarginRgba(margin, clamp(fillAlpha, 30, 255));
      },
      getElevation: (f: any) => {
        const code = f.properties?.GEO_ID?.slice(-5) || f.properties?.FIPS || f.properties?.GEOID;
        const c = countiesState.get(code);
        const base = 1000;
        if (!c) return base;
        
        const votes = Object.values(c.votes);
        if (votes.length < 2) return base;
        
        const [v1, v2] = votes.sort((a, b) => b - a);
        const margin = (v1 + v2) > 0 ? ((v1 - v2) / (v1 + v2)) * 100 : 0;
        const marginHeight = extrusionFromMarginIOWA(margin);
        const turnoutHeight = turnoutHeightFromVotesIOWA(c.totalVotes, 1, 1);
        
        let h = 0;
        if (extrusionMode === 'margin') h = marginHeight;
        else if (extrusionMode === 'turnout') h = turnoutHeight;
        else {
          const w = clamp(hybridWeight, 0, 100) / 100;
          h = w * marginHeight + (1 - w) * turnoutHeight;
        }
        
        const lift = 1.75;
        return h * clamp(heightScale, 0.1, 3) * lift;
      },
      getLineColor: [255,255,255,200],
      lineWidthMinPixels: 0.5,
      transitions: {
        getFillColor: { duration: 600 },
        getElevation: { duration: 1000, enter: () => 0 }
      },
      updateTriggers: { 
        getFillColor: [countiesState, fillAlpha], 
        getElevation: [countiesState, heightScale, extrusionMode, hybridWeight] 
      },
      onHover: (info: any) => {
        if (info.object) {
          const code = info.object.properties?.GEO_ID?.slice(-5) || info.object.properties?.FIPS || info.object.properties?.GEOID;
          setHoveredCounty(code);
          setMousePos({x: info.x, y: info.y});
        } else setHoveredCounty(null);
      }
    });
  }, [countiesRef.current, countiesState, heightScale, fillAlpha, extrusionMode, hybridWeight, showCounties]);

  // State border layer
  const stateBorderLayer = useMemo(() => {
    if (!showCounties || !stateRef.current) return null;
    
    return new GeoJsonLayer<Feature<Geometry, any>>({
      id: 'state-border',
      data: { type: 'FeatureCollection', features: [stateRef.current] } as FeatureCollection,
      stroked: true,
      filled: false,
      extruded: false,
      getLineColor: [255,255,255,255],
      lineWidthMinPixels: 1.6,
      pickable: true,
      onClick: () => {
        setShowCounties(false);
      }
    });
  }, [stateRef.current, showCounties]);

  const layers = useMemo(() => {
    const arr: any[] = [];
    if (stateLayer) arr.push(stateLayer);
    if (countyLayer) arr.push(countyLayer);
    if (stateBorderLayer) arr.push(stateBorderLayer);
    return arr;
  }, [stateLayer, countyLayer, stateBorderLayer]);

  const reportingPercent = currentFrame ? (currentFrame.percentReported * 100).toFixed(1) : null;
  const formattedTimestamp = currentFrame ? formatSimulationTime(currentFrame.timestamp) : null;

  return (
    <div className="relative min-h-[100svh] w-full bg-slate-950 text-slate-100">
      <div className="relative h-full min-h-[100svh] w-full overflow-hidden">
        <div className="absolute top-3 left-3 z-30 hidden items-center gap-3 md:flex">
          <Link
            to="/sandbox/config"
            className="rounded-md border border-slate-700 bg-slate-900/80 px-3 py-1.5 text-xs font-medium hover:border-slate-600"
          >
            ← New Simulation
          </Link>
          <span className="text-[11px] text-slate-300">{status}</span>
          {showCounties && (
            <button
              onClick={() => setShowCounties(false)}
              className="rounded border border-slate-700 bg-slate-800/70 px-2 py-1 text-[10px] hover:bg-slate-700"
            >
              ← Hide Counties
            </button>
          )}
        </div>

        <div className="absolute top-3 right-3 z-30 hidden gap-2 md:flex">
          <button
            onClick={handlePlayPause}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium hover:bg-blue-700"
          >
            {isPlaying ? 'Pause' : 'Play'}
          </button>
          <button
            onClick={handleReset}
            className="rounded-md border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs font-medium hover:border-slate-500"
          >
            Reset
          </button>
          <select
            value={speed}
            onChange={(e) => handleSpeedChange(parseFloat(e.target.value))}
            className="rounded border border-slate-600 bg-slate-800 px-2 text-xs"
          >
            <option value={0.5}>0.5x</option>
            <option value={1.0}>1x</option>
            <option value={2.0}>2x</option>
            <option value={5.0}>5x</option>
            <option value={10.0}>10x</option>
          </select>
          {formattedTimestamp && (
            <div className="rounded border border-slate-700 bg-slate-800/70 px-2 py-1 text-[10px] font-mono">
              {formattedTimestamp}
            </div>
          )}
          {metadata && (
            <div className="rounded border border-slate-700 bg-slate-800/70 px-2 py-1 text-[10px] font-mono">
              Frame {currentFrameIndex}/{metadata.framesGenerated}
            </div>
          )}
        </div>

        {isMobile && (
          <div className="absolute top-3 left-3 right-3 z-40 flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/90 px-3 py-2 shadow-lg">
            <div className="flex flex-col text-xs leading-tight text-slate-200">
              <span className="text-sm font-semibold">
                {metadata?.geography?.description ?? 'Simulation Sandbox'}
              </span>
              <span className="truncate text-[11px] text-slate-400">{status}</span>
            </div>
            <div className="flex items-center gap-2">
              <Link
                to="/sandbox/config"
                className="rounded-md border border-slate-700 bg-slate-800 px-3 py-1 text-xs font-medium text-slate-200"
              >
                New
              </Link>
              <button
                type="button"
                onClick={() => setMobilePanelOpen((open) => !open)}
                className="rounded-md bg-blue-600 px-3 py-1 text-xs font-semibold text-white"
              >
                {mobilePanelOpen ? 'Hide' : 'Controls'}
              </button>
            </div>
          </div>
        )}

        {currentFrame && (
          <div className="absolute top-16 left-3 z-30 hidden space-y-2 rounded-lg border border-slate-700 bg-slate-900/90 p-3 md:block">
            {candidates.map((candidate) => {
              const votes = currentFrame.stateTotals.votes[candidate.id] || 0;
              const pct =
                currentFrame.stateTotals.totalVotes > 0
                  ? ((votes / currentFrame.stateTotals.totalVotes) * 100).toFixed(1)
                  : '0.0';
              const isLeading = candidate.id === currentFrame.stateTotals.leadingCandidateIndex;

              return (
                <div key={candidate.id} className={`text-xs ${isLeading ? 'font-bold' : ''}`}>
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-sm" style={{ backgroundColor: candidate.color }} />
                    <span className="text-slate-200">{candidate.name}</span>
                  </div>
                  <div className="mt-1 ml-5 flex justify-between gap-4 font-mono text-[11px]">
                    <span className="text-slate-100">{votes.toLocaleString()}</span>
                    <span className="text-slate-400">{pct}%</span>
                  </div>
                </div>
              );
            })}
            <div className="border-t border-slate-700 pt-2 text-[10px] text-slate-400">
              {reportingPercent ?? '0.0'}% reporting
            </div>
          </div>
        )}

        {metadata && (
          <div className="absolute bottom-6 left-1/2 z-30 hidden w-[min(90vw,768px)] max-w-4xl -translate-x-1/2 transform rounded-lg border border-slate-700 bg-slate-900/90 p-4 md:block">
            <div className="flex items-center gap-4">
              <button
                onClick={handleReset}
                className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs hover:bg-slate-700"
              >
                ⏮
              </button>
              <button
                onClick={handlePlayPause}
                className="rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700"
              >
                {isPlaying ? '⏸' : '▶'}
              </button>
              <div className="flex-1">
                <input
                  type="range"
                  min="0"
                  max={Math.max(1, metadata.framesGenerated - 1)}
                  value={currentFrameIndex}
                  onChange={(e) => {
                    const frameNum = parseInt(e.target.value, 10);
                    setCurrentFrameIndex(frameNum);
                    if (wsClientRef.current?.connected) {
                      wsClientRef.current.publish({
                        destination: `/app/sandbox/${simulationId}/seek`,
                        body: JSON.stringify({ frameNumber: frameNum }),
                      });
                    }
                  }}
                  className="w-full"
                  style={{ accentColor: '#3b82f6' }}
                />
                <div className="mt-1 flex justify-between text-[10px] text-slate-400">
                  <span>Start</span>
                  <span>{reportingPercent ?? '0.0'}% reported</span>
                  <span>End</span>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="absolute top-16 right-3 z-30 hidden w-56 space-y-3 rounded-lg border border-slate-700 bg-slate-900/85 p-3 md:block">
          <div>
            <label className="mb-1 block text-[11px] text-slate-300">Height Scale</label>
            <input
              type="range"
              min="0.1"
              max="3"
              step="0.1"
              value={heightScale}
              onChange={(e) => setHeightScale(parseFloat(e.target.value))}
              className="w-full"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-slate-300">Opacity</label>
            <input
              type="range"
              min="120"
              max="255"
              step="5"
              value={fillAlpha}
              onChange={(e) => setFillAlpha(parseInt(e.target.value, 10))}
              className="w-full"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-slate-300">Extrusion Mode</label>
            <select
              value={extrusionMode}
              onChange={(e) => setExtrusionMode(e.target.value as any)}
              className="w-full rounded border border-slate-600 bg-slate-800 px-2 text-xs"
            >
              <option value="margin">Margin</option>
              <option value="turnout">Turnout</option>
              <option value="hybrid">Hybrid</option>
            </select>
          </div>
          {extrusionMode === 'hybrid' && (
            <div>
              <label className="mb-1 block text-[11px] text-slate-300">Hybrid: % Margin</label>
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={hybridWeight}
                onChange={(e) => setHybridWeight(parseInt(e.target.value, 10))}
                className="w-full"
              />
            </div>
          )}
        </div>

        {hoveredCounty &&
          (() => {
            const c = countiesState.get(hoveredCounty);
            if (!c) return null;

            const tooltipClass = `absolute z-40 pointer-events-none ${isMobile ? 'hidden' : ''}`;

            return (
              <div className={tooltipClass} style={{ left: mousePos.x + 14, top: mousePos.y + 14 }}>
                <div className="space-y-1 rounded border border-slate-600 bg-slate-900/95 px-3 py-2 text-[11px] shadow-2xl">
                  <div className="font-semibold text-slate-100">{c.name}</div>
                  <div className="text-slate-400">{(c.percentReported * 100).toFixed(0)}% reporting</div>
                  {candidates.map((candidate) => (
                    <div key={candidate.id} className="flex justify-between gap-3">
                      <span style={{ color: candidate.color }}>{candidate.name}</span>
                      <span className="font-mono">{(c.votes[candidate.id] || 0).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

        <DeckGL
          ref={deckRef}
          viewState={viewState}
          onViewStateChange={({ viewState }) => setViewState(viewState as ViewState)}
          controller={true}
          layers={layers}
          effects={[
            new LightingEffect({
              ambient: new AmbientLight({ color: [255, 255, 255], intensity: 1.4 }),
              directional: new DirectionalLight({ color: [255, 255, 255], intensity: 2.2, direction: [-1, -1, -2] }),
            }),
          ]}
          style={{ position: 'absolute', inset: '0' }}
        />
      </div>

      {isMobile && (
        <div
          className={`fixed inset-x-0 bottom-0 z-40 transition-transform duration-300 ease-out ${
            mobilePanelOpen ? 'translate-y-0' : 'translate-y-[calc(100%-64px)]'
          }`}
        >
          <div className="rounded-t-2xl border-t border-slate-800 bg-slate-900/95 px-4 pb-6 pt-3 backdrop-blur-md shadow-2xl">
            <button
              type="button"
              onClick={() => setMobilePanelOpen((open) => !open)}
              className="flex w-full items-center justify-between text-sm font-semibold text-slate-200"
            >
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`} />
                <span>{isConnected ? 'Live' : 'Offline'}</span>
                {reportingPercent && <span className="text-xs text-slate-400">{reportingPercent}% reported</span>}
              </div>
              <span className="text-xs text-slate-400">{mobilePanelOpen ? 'Hide' : 'Expand'}</span>
            </button>

            {mobilePanelOpen && (
              <div className="mt-4 space-y-4 text-xs text-slate-200">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={handlePlayPause}
                    className="col-span-2 rounded-lg bg-blue-600 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                  >
                    {isPlaying ? 'Pause Simulation' : 'Play Simulation'}
                  </button>
                  <button
                    onClick={handleReset}
                    className="rounded-lg border border-slate-600 bg-slate-800 py-2 text-sm hover:bg-slate-700"
                  >
                    Reset
                  </button>
                  <button
                    onClick={() => setShowCounties((prev) => !prev)}
                    className="rounded-lg border border-slate-600 bg-slate-800 py-2 text-sm hover:bg-slate-700"
                  >
                    {showCounties ? 'Hide Counties' : 'Show Counties'}
                  </button>
                </div>

                <div>
                  <label className="mb-1 block text-[11px] text-slate-300">Playback Speed</label>
                  <select
                    value={speed}
                    onChange={(e) => handleSpeedChange(parseFloat(e.target.value))}
                    className="w-full rounded border border-slate-600 bg-slate-800 px-2 py-2 text-sm"
                  >
                    <option value={0.5}>0.5x</option>
                    <option value={1.0}>1x</option>
                    <option value={2.0}>2x</option>
                    <option value={5.0}>5x</option>
                    <option value={10.0}>10x</option>
                  </select>
                </div>

                <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-3">
                  <div className="flex items-center justify-between text-[11px] text-slate-300">
                    <span>Status</span>
                    <span className="font-mono text-slate-100">{status}</span>
                  </div>
                  {formattedTimestamp && (
                    <div className="mt-2 flex items-center justify-between text-[11px] text-slate-300">
                      <span>Timestamp</span>
                      <span className="font-mono text-slate-100">{formattedTimestamp}</span>
                    </div>
                  )}
                  {metadata && (
                    <div className="mt-2 flex items-center justify-between text-[11px] text-slate-300">
                      <span>Frame</span>
                      <span className="font-mono text-slate-100">
                        {currentFrameIndex}/{metadata.framesGenerated}
                      </span>
                    </div>
                  )}
                  {metadata?.geography?.countyCount && (
                    <div className="mt-2 flex items-center justify-between text-[11px] text-slate-300">
                      <span>Counties</span>
                      <span className="font-mono text-slate-100">{metadata.geography.countyCount}</span>
                    </div>
                  )}
                </div>

                {metadata && (
                  <div>
                    <label className="mb-1 block text-[11px] text-slate-300">Timeline</label>
                    <input
                      type="range"
                      min="0"
                      max={Math.max(1, metadata.framesGenerated - 1)}
                      value={currentFrameIndex}
                      onChange={(e) => {
                        const frameNum = parseInt(e.target.value, 10);
                        setCurrentFrameIndex(frameNum);
                        if (wsClientRef.current?.connected) {
                          wsClientRef.current.publish({
                            destination: `/app/sandbox/${simulationId}/seek`,
                            body: JSON.stringify({ frameNumber: frameNum }),
                          });
                        }
                      }}
                      className="w-full"
                      style={{ accentColor: '#3b82f6' }}
                    />
                    <div className="mt-1 flex justify-between text-[10px] text-slate-400">
                      <span>Start</span>
                      <span>{reportingPercent ?? '0.0'}% reported</span>
                      <span>End</span>
                    </div>
                  </div>
                )}

                {currentFrame && (
                  <div>
                    <h4 className="text-xs font-semibold uppercase text-slate-300">Vote Totals</h4>
                    <div className="mt-2 space-y-2">
                      {candidates.map((candidate) => {
                        const votes = currentFrame.stateTotals.votes[candidate.id] || 0;
                        const pct =
                          currentFrame.stateTotals.totalVotes > 0
                            ? ((votes / currentFrame.stateTotals.totalVotes) * 100).toFixed(1)
                            : '0.0';
                        const isLeading = candidate.id === currentFrame.stateTotals.leadingCandidateIndex;

                        return (
                          <div
                            key={candidate.id}
                            className={`rounded border border-slate-800 bg-slate-900/70 px-3 py-2 ${
                              isLeading ? 'font-semibold text-white' : 'text-slate-300'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="flex items-center gap-2">
                                <span
                                  className="h-3 w-3 rounded-sm"
                                  style={{ backgroundColor: candidate.color }}
                                />
                                {candidate.name}
                              </span>
                              <span className="font-mono">{pct}%</span>
                            </div>
                            <div className="mt-1 text-[11px] text-slate-400">
                              {votes.toLocaleString()} votes
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <details className="rounded-lg border border-slate-800 bg-slate-900/80 p-3">
                  <summary className="cursor-pointer text-xs font-semibold text-slate-300">
                    Advanced visual controls
                  </summary>
                  <div className="mt-3 space-y-3">
                    <div>
                      <label className="mb-1 block text-[11px] text-slate-300">Height Scale</label>
                      <input
                        type="range"
                        min="0.1"
                        max="3"
                        step="0.1"
                        value={heightScale}
                        onChange={(e) => setHeightScale(parseFloat(e.target.value))}
                        className="w-full"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] text-slate-300">Opacity</label>
                      <input
                        type="range"
                        min="120"
                        max="255"
                        step="5"
                        value={fillAlpha}
                        onChange={(e) => setFillAlpha(parseInt(e.target.value, 10))}
                        className="w-full"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] text-slate-300">Extrusion Mode</label>
                      <select
                        value={extrusionMode}
                        onChange={(e) => setExtrusionMode(e.target.value as any)}
                        className="w-full rounded border border-slate-600 bg-slate-800 px-2 py-2 text-sm"
                      >
                        <option value="margin">Margin</option>
                        <option value="turnout">Turnout</option>
                        <option value="hybrid">Hybrid</option>
                      </select>
                    </div>
                    {extrusionMode === 'hybrid' && (
                      <div>
                        <label className="mb-1 block text-[11px] text-slate-300">Hybrid: % Margin</label>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          step="1"
                          value={hybridWeight}
                          onChange={(e) => setHybridWeight(parseInt(e.target.value, 10))}
                          className="w-full"
                        />
                      </div>
                    )}
                  </div>
                </details>

                <Link
                  to="/sandbox/config"
                  className="block rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2 text-center text-sm font-medium text-slate-200 hover:bg-slate-700"
                >
                  Configure new simulation
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default SandboxPlayerPage
