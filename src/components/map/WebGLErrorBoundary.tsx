import React, { Component, ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
}

interface State {
  hasError: boolean
  error: Error | null
}

/**
 * Error boundary specifically for WebGL-related failures.
 * Catches context loss, initialization failures, and ResizeObserver errors.
 */
export class WebGLErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    // Check if this is a WebGL-related error
    const isWebGLError = 
      error.message?.includes('WebGL') ||
      error.message?.includes('maxTextureDimension') ||
      error.message?.includes('Context Lost') ||
      error.message?.includes('getContext') ||
      error.stack?.includes('luma.gl') ||
      error.stack?.includes('deck.gl')

    if (isWebGLError) {
      console.warn('[WebGLErrorBoundary] Caught WebGL error:', error.message)
      return { hasError: true, error }
    }

    // Re-throw non-WebGL errors so parent boundaries can handle them
    throw error
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[WebGLErrorBoundary] Component error details:', errorInfo)
    this.props.onError?.(error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/90">
          <div className="max-w-md space-y-3 rounded-xl border border-red-500/30 bg-slate-900/95 px-6 py-5 text-center shadow-xl">
            <div className="text-red-400 text-sm font-semibold">WebGL Initialization Failed</div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Your browser or hardware doesn't support the required WebGL features for 3D rendering.
            </p>
            <p className="text-xs text-slate-400">
              Try switching to 2D mode or updating your graphics drivers.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-2 rounded-lg bg-slate-700/60 px-4 py-2 text-xs font-medium text-slate-200 transition hover:bg-slate-700"
            >
              Reload Page
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
