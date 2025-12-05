import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { SandboxThemeDefinition, SandboxThemeId, SandboxThemeSummary } from './sandboxThemes'
import { DEFAULT_SANDBOX_THEME_ID, SANDBOX_THEME_SUMMARY, SANDBOX_THEMES } from './sandboxThemes'

type SandboxThemeContextValue = {
  themeId: SandboxThemeId
  theme: SandboxThemeDefinition
  setThemeId: (id: SandboxThemeId) => void
  availableThemes: SandboxThemeSummary[]
}

const SandboxThemeContext = createContext<SandboxThemeContextValue | undefined>(undefined)

export type SandboxThemeProviderProps = {
  initialThemeId?: SandboxThemeId
  children: React.ReactNode
}

export const SandboxThemeProvider: React.FC<SandboxThemeProviderProps> = ({ initialThemeId, children }) => {
  const [themeId, setThemeId] = useState<SandboxThemeId>(initialThemeId ?? DEFAULT_SANDBOX_THEME_ID)
  const theme = SANDBOX_THEMES[themeId] ?? SANDBOX_THEMES[DEFAULT_SANDBOX_THEME_ID]

  useEffect(() => {
    const root = document.documentElement
    root.setAttribute('data-sandbox-theme', theme.id)
    root.style.setProperty('--sandbox-app-font', theme.typography.family)
    root.style.setProperty('--sandbox-numeric-font', theme.typography.numeric)

    return () => {
      root.removeAttribute('data-sandbox-theme')
      root.style.removeProperty('--sandbox-app-font')
      root.style.removeProperty('--sandbox-numeric-font')
    }
  }, [theme])

  const contextValue = useMemo(() => ({
    themeId,
    theme,
    setThemeId,
    availableThemes: SANDBOX_THEME_SUMMARY
  }), [themeId, theme])

  return (
    <SandboxThemeContext.Provider value={contextValue}>
      {children}
    </SandboxThemeContext.Provider>
  )
}

export function useSandboxTheme(): SandboxThemeContextValue {
  const context = useContext(SandboxThemeContext)
  if (!context) {
    throw new Error('useSandboxTheme must be used within a SandboxThemeProvider')
  }

  return context
}

export function useSandboxThemeOrDefault(): SandboxThemeDefinition {
  const context = useContext(SandboxThemeContext)
  return context?.theme ?? SANDBOX_THEMES[DEFAULT_SANDBOX_THEME_ID]
}
