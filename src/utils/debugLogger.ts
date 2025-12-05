const debugLoggingEnabled = import.meta.env.DEV && import.meta.env.VITE_SANDBOX_DEBUG === 'true'

export const debugLog = (...args: unknown[]): void => {
  if (debugLoggingEnabled) {
    console.debug(...args)
  }
}

export const debugWarn = (...args: unknown[]): void => {
  if (debugLoggingEnabled) {
    console.warn(...args)
  }
}
