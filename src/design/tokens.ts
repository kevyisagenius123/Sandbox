// Central design tokens for election UI (corporate grade)
// Provides consistent styling primitives across the application

import type { CSSProperties } from 'react'

export const color = {
  bgPanel: 'rgba(8,10,14,0.82)',
  bgPanelAlt: 'rgba(14,17,23,0.78)',
  borderSubtle: 'rgba(120,130,150,0.25)',
  textPrimary: '#FFFFFF',
  textSecondary: 'rgba(220,230,240,0.75)',
  accentPositive: '#10B981',
  accentNegative: '#EF4444',
  accentNeutral: '#3B82F6',
  accentWarning: '#F59E0B',
  focusRing: '#34D399',
  elevationShadow: '0 4px 14px -2px rgba(0,0,0,0.55)',
  gradientHeader: 'linear-gradient(135deg,#0E1624,#142538)',
  // Extended color system for corporate use
  text: {
    primary: '#FFFFFF',
    secondary: 'rgba(220,230,240,0.75)',
    tertiary: 'rgba(156,163,175,0.6)',
    inverse: '#1F2937'
  },
  background: {
    primary: '#0D1117',
    surface: 'rgba(8,10,14,0.82)',
    surfaceAlt: 'rgba(14,17,23,0.78)',
    hover: 'rgba(55,65,81,0.3)',
    overlay: 'rgba(0,0,0,0.6)'
  },
  border: {
    subtle: 'rgba(120,130,150,0.25)',
    default: 'rgba(120,130,150,0.4)',
    focus: '#34D399'
  }
}

export const space = {
  xs: '4px',
  sm: '8px',
  md: '16px',
  lg: '24px',
  xl: '32px',
  '2xl': '48px'
}

export const radius = { sm: '4px', md: '6px', lg: '10px' }

export const typography = {
  size: {
    xs: '12px',
    sm: '14px',
    base: '16px',
    lg: '18px',
    xl: '20px',
    '2xl': '24px',
    '3xl': '30px'
  },
  weight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700'
  },
  family: {
    sans: 'ui-sans-serif, system-ui, sans-serif',
    mono: "'JetBrains Mono', monospace"
  }
}

export const font = { mono: "'JetBrains Mono',monospace" }

export const transition = { fast: '120ms ease', base: '200ms cubic-bezier(.4,.2,.2,1)' }

export function panelStyle(): CSSProperties {
  return {
    background: color.background.surface,
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    border: `1px solid ${color.border.subtle}`,
    boxShadow: color.elevationShadow,
    borderRadius: radius.lg
  }
}
