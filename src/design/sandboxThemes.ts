import type { CSSProperties } from 'react'

export type SandboxThemeId = 'electionHq' | 'nightDesk' | 'sunriseBriefing'

export type SandboxThemeSummary = {
  id: SandboxThemeId
  name: string
  description: string
  swatch: string
}

type SurfaceStyle = {
  background: string
  borderColor: string
  boxShadow: string
  backdropFilter?: string
}

type TimelineContainerStyle = SurfaceStyle

export type SandboxThemeDefinition = {
  id: SandboxThemeId
  name: string
  description: string
  backgrounds: {
    app: string
    gradient: string
  }
  palette: {
    text: {
      primary: string
      secondary: string
      muted: string
    }
    accent: {
      primary: string
      secondary: string
      positive: string
      negative: string
      warning: string
      neutral: string
    }
  }
  surfaces: {
    header: SurfaceStyle
    sidebar: SurfaceStyle
    footer: SurfaceStyle
    main: SurfaceStyle
    mainFullscreen: SurfaceStyle
    map: SurfaceStyle
    mapFullscreen: SurfaceStyle
    dockShell: SurfaceStyle
    dockPanel: SurfaceStyle
  }
  typography: {
    family: string
    numeric: string
  }
  timeline: {
    track: string
    progressFrom: string
    progressTo: string
    indicator: string
    indicatorShadow: string
    label: string
    subLabel: string
    container: Record<'full' | 'panel' | 'dock', TimelineContainerStyle>
  }
  preview: {
    swatch: string
  }
  customStyles?: {
    root?: CSSProperties
  }
}

const baseMonospace = '"JetBrains Mono", "Roboto Mono", monospace'
const baseSans = '"Inter", "Segoe UI", sans-serif'

export const SANDBOX_THEMES: Record<SandboxThemeId, SandboxThemeDefinition> = {
  electionHq: {
    id: 'electionHq',
    name: 'Election HQ',
    description: 'Blue-red newsroom polish inspired by flagship 2024 coverage.',
    backgrounds: {
      app: '#040910',
      gradient: 'radial-gradient(circle at 20% 15%, rgba(37,99,235,0.25), transparent 55%), radial-gradient(circle at 78% 12%, rgba(220,38,38,0.22), transparent 60%), linear-gradient(135deg, #030711 0%, #050915 55%, #02040c 100%)'
    },
    palette: {
      text: {
        primary: '#F8FAFC',
        secondary: 'rgba(226,232,240,0.88)',
        muted: 'rgba(148,163,184,0.7)'
      },
      accent: {
        primary: '#2D8BFF',
        secondary: '#FB4F64',
        positive: '#22C55E',
        negative: '#EF4444',
        warning: '#FACC15',
        neutral: '#94A3B8'
      }
    },
    surfaces: {
      header: {
        background: 'rgba(6,12,28,0.88)',
        borderColor: 'rgba(45,139,255,0.45)',
        boxShadow: '0 18px 45px -28px rgba(10,20,45,0.9)'
      },
      sidebar: {
        background: 'rgba(6,11,24,0.82)',
        borderColor: 'rgba(59,130,246,0.28)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.02)',
        backdropFilter: 'blur(22px)'
      },
      footer: {
        background: 'rgba(5,10,22,0.9)',
        borderColor: 'rgba(45,139,255,0.28)',
        boxShadow: '0 -18px 40px -32px rgba(9,16,35,0.9)'
      },
      main: {
        background: 'rgba(4,10,20,0.55)',
        borderColor: 'rgba(59,130,246,0.18)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.02)'
      },
      mainFullscreen: {
        background: 'rgba(3,7,18,0.96)',
        borderColor: 'rgba(37,99,235,0.45)',
        boxShadow: '0 34px 120px -48px rgba(8,16,30,0.95)'
      },
      map: {
        background: 'linear-gradient(145deg, rgba(8,17,35,0.92) 0%, rgba(4,9,20,0.86) 100%)',
        borderColor: 'rgba(56,131,248,0.4)',
        boxShadow: '0 45px 110px -60px rgba(10,25,60,0.95)'
      },
      mapFullscreen: {
        background: 'linear-gradient(150deg, rgba(8,16,32,0.96) 0%, rgba(3,7,18,0.9) 100%)',
        borderColor: 'rgba(45,139,255,0.45)',
        boxShadow: '0 65px 140px -70px rgba(6,14,30,1)'
      },
      dockShell: {
        background: 'rgba(5,10,22,0.82)',
        borderColor: 'rgba(59,130,246,0.24)',
        boxShadow: '0 -4px 28px -16px rgba(8,16,32,0.8)'
      },
      dockPanel: {
        background: 'rgba(8,14,28,0.82)',
        borderColor: 'rgba(59,130,246,0.35)',
        boxShadow: '0 24px 54px -32px rgba(8,16,32,0.95)'
      }
    },
    typography: {
      family: baseSans,
      numeric: baseMonospace
    },
    timeline: {
      track: 'rgba(89,118,184,0.28)',
      progressFrom: '#2563EB',
      progressTo: '#38BDF8',
      indicator: '#F8FAFC',
      indicatorShadow: '0 0 18px rgba(56,189,248,0.52)',
      label: 'rgba(226,232,240,0.92)',
      subLabel: 'rgba(148,163,184,0.82)',
      container: {
        full: {
          background: 'rgba(6,12,26,0.92)',
          borderColor: 'rgba(45,139,255,0.35)',
          boxShadow: '0 22px 60px -36px rgba(8,16,32,0.95)',
          backdropFilter: 'blur(22px)'
        },
        panel: {
          background: 'rgba(8,15,30,0.85)',
          borderColor: 'rgba(59,130,246,0.32)',
          boxShadow: '0 12px 36px -24px rgba(8,16,32,0.85)',
          backdropFilter: 'blur(18px)'
        },
        dock: {
          background: 'rgba(4,9,20,0.92)',
          borderColor: 'rgba(45,139,255,0.38)',
          boxShadow: '0 18px 48px -24px rgba(5,12,25,0.9)',
          backdropFilter: 'blur(24px)'
        }
      }
    },
    preview: {
      swatch: 'linear-gradient(135deg, #2563EB 0%, #0EA5E9 50%, #FB4F64 100%)'
    }
  },
  nightDesk: {
    id: 'nightDesk',
    name: 'Night Desk',
    description: 'Moody midnight palette with magenta and cyan highlights.',
    backgrounds: {
      app: '#070314',
      gradient: 'radial-gradient(circle at 10% 20%, rgba(147,51,234,0.18), transparent 58%), radial-gradient(circle at 85% 12%, rgba(6,182,212,0.18), transparent 62%), linear-gradient(135deg, #050111 0%, #090316 60%, #05000C 100%)'
    },
    palette: {
      text: {
        primary: '#F5F3FF',
        secondary: 'rgba(232,228,255,0.82)',
        muted: 'rgba(196,181,253,0.68)'
      },
      accent: {
        primary: '#A855F7',
        secondary: '#22D3EE',
        positive: '#34D399',
        negative: '#F87171',
        warning: '#FBBF24',
        neutral: '#A1A1AA'
      }
    },
    surfaces: {
      header: {
        background: 'rgba(19,6,37,0.88)',
        borderColor: 'rgba(168,85,247,0.4)',
        boxShadow: '0 20px 48px -32px rgba(40,15,80,0.95)'
      },
      sidebar: {
        background: 'rgba(16,5,32,0.8)',
        borderColor: 'rgba(168,85,247,0.28)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
        backdropFilter: 'blur(24px)'
      },
      footer: {
        background: 'rgba(11,3,24,0.92)',
        borderColor: 'rgba(168,85,247,0.24)',
        boxShadow: '0 -20px 42px -32px rgba(30,12,60,0.9)'
      },
      main: {
        background: 'rgba(12,3,28,0.6)',
        borderColor: 'rgba(168,85,247,0.2)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)'
      },
      mainFullscreen: {
        background: 'rgba(6,2,18,0.98)',
        borderColor: 'rgba(168,85,247,0.4)',
        boxShadow: '0 60px 150px -70px rgba(40,10,85,1)'
      },
      map: {
        background: 'linear-gradient(160deg, rgba(21,6,42,0.94) 0%, rgba(12,2,28,0.82) 100%)',
        borderColor: 'rgba(168,85,247,0.36)',
        boxShadow: '0 48px 120px -60px rgba(35,10,75,0.95)'
      },
      mapFullscreen: {
        background: 'linear-gradient(160deg, rgba(27,8,54,0.96) 0%, rgba(10,2,24,0.92) 100%)',
        borderColor: 'rgba(168,85,247,0.45)',
        boxShadow: '0 70px 160px -80px rgba(36,12,72,1)'
      },
      dockShell: {
        background: 'rgba(13,3,33,0.88)',
        borderColor: 'rgba(168,85,247,0.28)',
        boxShadow: '0 -6px 32px -18px rgba(34,10,70,0.85)'
      },
      dockPanel: {
        background: 'rgba(18,5,40,0.86)',
        borderColor: 'rgba(168,85,247,0.35)',
        boxShadow: '0 26px 52px -30px rgba(30,10,65,0.95)'
      }
    },
    typography: {
      family: '"Space Grotesk", "Inter", sans-serif',
      numeric: baseMonospace
    },
    timeline: {
      track: 'rgba(139,92,246,0.28)',
      progressFrom: '#C084FC',
      progressTo: '#22D3EE',
      indicator: '#F5F3FF',
      indicatorShadow: '0 0 18px rgba(139,92,246,0.55)',
      label: 'rgba(232,228,255,0.9)',
      subLabel: 'rgba(196,181,253,0.76)',
      container: {
        full: {
          background: 'rgba(22,8,46,0.92)',
          borderColor: 'rgba(168,85,247,0.38)',
          boxShadow: '0 24px 62px -36px rgba(32,10,65,0.95)',
          backdropFilter: 'blur(24px)'
        },
        panel: {
          background: 'rgba(18,6,40,0.88)',
          borderColor: 'rgba(168,85,247,0.32)',
          boxShadow: '0 14px 38px -24px rgba(30,10,65,0.85)',
          backdropFilter: 'blur(20px)'
        },
        dock: {
          background: 'rgba(16,5,34,0.92)',
          borderColor: 'rgba(168,85,247,0.4)',
          boxShadow: '0 20px 52px -28px rgba(28,8,60,0.92)',
          backdropFilter: 'blur(26px)'
        }
      }
    },
    preview: {
      swatch: 'linear-gradient(135deg, #A855F7 0%, #3B82F6 50%, #22D3EE 100%)'
    }
  },
  sunriseBriefing: {
    id: 'sunriseBriefing',
    name: 'Sunrise Briefing',
    description: 'Warm dawn gradients with amber lower thirds and bold accents.',
    backgrounds: {
      app: '#120805',
      gradient: 'radial-gradient(circle at 18% 20%, rgba(249,115,22,0.24), transparent 58%), radial-gradient(circle at 82% 8%, rgba(244,63,94,0.18), transparent 62%), linear-gradient(140deg, #0B0302 0%, #1B0904 55%, #120603 100%)'
    },
    palette: {
      text: {
        primary: '#FFF7ED',
        secondary: 'rgba(254,243,199,0.9)',
        muted: 'rgba(253,230,138,0.7)'
      },
      accent: {
        primary: '#FB923C',
        secondary: '#F97316',
        positive: '#4ADE80',
        negative: '#F87171',
        warning: '#FACC15',
        neutral: '#FCD34D'
      }
    },
    surfaces: {
      header: {
        background: 'rgba(45,16,6,0.88)',
        borderColor: 'rgba(249,115,22,0.4)',
        boxShadow: '0 20px 50px -30px rgba(80,22,10,0.95)'
      },
      sidebar: {
        background: 'rgba(38,12,4,0.82)',
        borderColor: 'rgba(249,115,22,0.28)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
        backdropFilter: 'blur(20px)'
      },
      footer: {
        background: 'rgba(32,10,3,0.9)',
        borderColor: 'rgba(249,115,22,0.28)',
        boxShadow: '0 -20px 42px -28px rgba(70,20,8,0.9)'
      },
      main: {
        background: 'rgba(30,9,3,0.6)',
        borderColor: 'rgba(249,115,22,0.22)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)'
      },
      mainFullscreen: {
        background: 'rgba(22,7,3,0.97)',
        borderColor: 'rgba(249,115,22,0.42)',
        boxShadow: '0 60px 140px -70px rgba(90,25,10,1)'
      },
      map: {
        background: 'linear-gradient(150deg, rgba(45,14,6,0.95) 0%, rgba(22,6,2,0.88) 100%)',
        borderColor: 'rgba(249,115,22,0.4)',
        boxShadow: '0 48px 120px -58px rgba(80,20,10,0.95)'
      },
      mapFullscreen: {
        background: 'linear-gradient(150deg, rgba(55,17,8,0.96) 0%, rgba(18,5,2,0.92) 100%)',
        borderColor: 'rgba(249,115,22,0.46)',
        boxShadow: '0 70px 150px -72px rgba(85,22,10,1)'
      },
      dockShell: {
        background: 'rgba(28,8,3,0.88)',
        borderColor: 'rgba(249,115,22,0.28)',
        boxShadow: '0 -6px 32px -18px rgba(75,18,6,0.85)'
      },
      dockPanel: {
        background: 'rgba(38,12,4,0.86)',
        borderColor: 'rgba(249,115,22,0.34)',
        boxShadow: '0 28px 58px -30px rgba(80,22,8,0.95)'
      }
    },
    typography: {
      family: '"Roboto Condensed", "Inter", sans-serif',
      numeric: baseMonospace
    },
    timeline: {
      track: 'rgba(251,191,36,0.32)',
      progressFrom: '#FB923C',
      progressTo: '#F97316',
      indicator: '#FFF7ED',
      indicatorShadow: '0 0 18px rgba(251,146,60,0.55)',
      label: 'rgba(254,243,199,0.92)',
      subLabel: 'rgba(253,224,171,0.78)',
      container: {
        full: {
          background: 'rgba(45,14,6,0.9)',
          borderColor: 'rgba(249,115,22,0.4)',
          boxShadow: '0 24px 60px -38px rgba(70,20,8,0.95)',
          backdropFilter: 'blur(22px)'
        },
        panel: {
          background: 'rgba(38,12,4,0.86)',
          borderColor: 'rgba(249,115,22,0.32)',
          boxShadow: '0 16px 42px -26px rgba(70,20,8,0.88)',
          backdropFilter: 'blur(20px)'
        },
        dock: {
          background: 'rgba(30,9,3,0.9)',
          borderColor: 'rgba(249,115,22,0.35)',
          boxShadow: '0 20px 48px -28px rgba(65,18,6,0.9)',
          backdropFilter: 'blur(24px)'
        }
      }
    },
    preview: {
      swatch: 'linear-gradient(135deg, #FB923C 0%, #F97316 50%, #F43F5E 100%)'
    }
  }
}

export const DEFAULT_SANDBOX_THEME_ID: SandboxThemeId = 'electionHq'

export const SANDBOX_THEME_SUMMARY: SandboxThemeSummary[] = Object.values(SANDBOX_THEMES).map((theme) => ({
  id: theme.id,
  name: theme.name,
  description: theme.description,
  swatch: theme.preview.swatch
}))
