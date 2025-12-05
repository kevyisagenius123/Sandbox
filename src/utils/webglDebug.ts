// WebGL Context Leak Detector
// Instruments canvas.getContext to track WebGL context creation and help identify leaks

interface ContextInfo {
  id: number
  canvas: HTMLCanvasElement
  stack: string
  timestamp: number
  destroyed: boolean
}

class WebGLDebugger {
  private contexts: Map<WebGLRenderingContext | WebGL2RenderingContext, ContextInfo> = new Map()
  private nextId = 1
  private originalGetContext: typeof HTMLCanvasElement.prototype.getContext | null = null

  install() {
    if (this.originalGetContext) {
      console.warn('[WebGLDebugger] Already installed')
      return
    }

    this.originalGetContext = HTMLCanvasElement.prototype.getContext
    const self = this

    HTMLCanvasElement.prototype.getContext = function(
      this: HTMLCanvasElement,
      contextType: string,
      ...args: any[]
    ): any {
      const context = (self.originalGetContext!.call as any)(this, contextType, ...args)

      if (contextType === 'webgl' || contextType === 'webgl2') {
        if (context && !self.contexts.has(context)) {
          const info: ContextInfo = {
            id: self.nextId++,
            canvas: this,
            stack: new Error().stack || 'No stack trace',
            timestamp: Date.now(),
            destroyed: false
          }
          self.contexts.set(context, info)
          
          console.log(
            `[WebGLDebugger] 🆕 Context #${info.id} created (${contextType})`,
            `\nTotal active: ${self.getActiveCount()}`,
            `\nCanvas:`, this,
            `\nStack trace:`, info.stack.split('\n').slice(2, 6).join('\n')
          )
        }
      }

      return context
    }

    // Intercept canvas removal to detect context destruction
    const originalRemoveChild = Node.prototype.removeChild
    Node.prototype.removeChild = function(child: any): any {
      if (child instanceof HTMLCanvasElement) {
        self.markCanvasRemoved(child)
      }
      return originalRemoveChild.call(this, child)
    }

    console.log('[WebGLDebugger] ✅ Installed - tracking WebGL context creation')
  }

  uninstall() {
    if (this.originalGetContext) {
      HTMLCanvasElement.prototype.getContext = this.originalGetContext
      this.originalGetContext = null
      console.log('[WebGLDebugger] ❌ Uninstalled')
    }
  }

  private markCanvasRemoved(canvas: HTMLCanvasElement) {
    for (const [, info] of this.contexts) {
      if (info.canvas === canvas && !info.destroyed) {
        info.destroyed = true
        console.log(
          `[WebGLDebugger] 🗑️ Context #${info.id} canvas removed`,
          `\nActive contexts: ${this.getActiveCount()}`
        )
      }
    }
  }

  getActiveCount(): number {
    return Array.from(this.contexts.values()).filter(info => !info.destroyed).length
  }

  getAllContexts(): ContextInfo[] {
    return Array.from(this.contexts.values())
  }

  printReport() {
    const all = this.getAllContexts()
    const active = all.filter(info => !info.destroyed)
    const destroyed = all.filter(info => info.destroyed)

    console.group('[WebGLDebugger] 📊 Context Report')
    console.log(`Total contexts created: ${all.length}`)
    console.log(`Active contexts: ${active.length}`)
    console.log(`Destroyed contexts: ${destroyed.length}`)
    
    if (active.length > 0) {
      console.group('Active Contexts:')
      active.forEach(info => {
        const age = ((Date.now() - info.timestamp) / 1000).toFixed(1)
        console.log(
          `Context #${info.id} (${age}s old)`,
          `\nCanvas:`, info.canvas,
          `\nCreated at:`, info.stack.split('\n').slice(2, 6).join('\n')
        )
      })
      console.groupEnd()
    }
    
    console.groupEnd()
  }

  reset() {
    this.contexts.clear()
    this.nextId = 1
    console.log('[WebGLDebugger] 🔄 Reset - cleared all tracked contexts')
  }
}

export const webglDebugger = new WebGLDebugger()

// Auto-install in development
if (typeof window !== 'undefined') {
  webglDebugger.install()
  
  // Expose to window for manual debugging
  ;(window as any).webglDebug = {
    report: () => webglDebugger.printReport(),
    active: () => webglDebugger.getActiveCount(),
    reset: () => webglDebugger.reset(),
    uninstall: () => webglDebugger.uninstall()
  }
  
  console.log('[WebGLDebugger] 🔍 Available commands:')
  console.log('  webglDebug.report()  - Print detailed report')
  console.log('  webglDebug.active()  - Get active context count')
  console.log('  webglDebug.reset()   - Clear tracking data')
}
