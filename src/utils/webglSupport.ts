export type WebGLSupport = 'supported' | 'unsupported'

const contextAttributes: WebGLContextAttributes = {
  alpha: false,
  antialias: false,
  desynchronized: false,
  failIfMajorPerformanceCaveat: false,
  powerPreference: 'high-performance',
  preserveDrawingBuffer: false
}

// Cache the detection result to avoid creating multiple contexts
let cachedSupport: WebGLSupport | null = null

/**
 * Detects whether the current browser session can provide a usable WebGL context.
 * We try WebGL2 first, then fall back to WebGL1 and the legacy experimental context.
 * Result is cached after first call to avoid creating multiple test contexts.
 */
export const detectWebGLSupport = (): WebGLSupport => {
  // Return cached result if available
  if (cachedSupport !== null) {
    return cachedSupport
  }

  if (typeof window === 'undefined' || typeof document === 'undefined') {
    cachedSupport = 'unsupported'
    return cachedSupport
  }

  const canvas = document.createElement('canvas')
  let context: WebGL2RenderingContext | null = null
  try {
    context = canvas.getContext('webgl2', contextAttributes) as WebGL2RenderingContext | null
  } catch {
    context = null
  }

  if (!context) {
    cachedSupport = 'unsupported'
    return cachedSupport
  }

  try {
    const maxTextureSize = context.getParameter(context.MAX_TEXTURE_SIZE)
    const maxUniforms = context.getParameter(context.MAX_VERTEX_UNIFORM_VECTORS)

    if (
      typeof maxTextureSize === 'number' && maxTextureSize > 0 && Number.isFinite(maxTextureSize) &&
      typeof maxUniforms === 'number' && maxUniforms > 0 && Number.isFinite(maxUniforms)
    ) {
      cachedSupport = 'supported'
    } else {
      cachedSupport = 'unsupported'
    }
  } catch {
    cachedSupport = 'unsupported'
  }

  // Clean up: Lose the context immediately after detection
  const loseContextExt = context.getExtension('WEBGL_lose_context')
  if (loseContextExt) {
    loseContextExt.loseContext()
  }

  return cachedSupport
}
