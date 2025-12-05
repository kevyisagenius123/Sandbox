import React from 'react'

interface KeyboardShortcutsHelpProps {
  isOpen: boolean
  onClose: () => void
}

export function KeyboardShortcutsHelp({ isOpen, onClose }: KeyboardShortcutsHelpProps) {
  if (!isOpen) return null

  const shortcuts = [
    { category: 'Playback', items: [
      { keys: ['Space'], description: 'Play / Pause simulation' },
      { keys: ['R'], description: 'Reset to start' },
    ]},
    { category: 'Speed Control', items: [
      { keys: ['1', '2', '3', '4', '5'], description: 'Set speed (1x, 2x, 5x, 10x, 20x)' },
    ]},
    { category: 'Views', items: [
      { keys: ['A'], description: 'Toggle analytics panel' },
      { keys: ['Esc'], description: 'Close panels / modals' },
    ]},
    { category: 'General', items: [
      { keys: ['?'], description: 'Show this help' },
    ]},
  ]

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div 
        className="bg-gray-900 rounded-lg shadow-2xl w-full max-w-2xl border border-gray-700"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gray-800 px-6 py-4 rounded-t-lg border-b border-gray-700">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-white flex items-center gap-2">
              ⌨️ Keyboard Shortcuts
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors text-2xl leading-none"
            >
              ×
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {shortcuts.map((section) => (
            <div key={section.category}>
              <h3 className="text-lg font-semibold text-blue-400 mb-3">
                {section.category}
              </h3>
              <div className="space-y-2">
                {section.items.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between py-2 px-3 bg-gray-800/50 rounded">
                    <span className="text-gray-300">{item.description}</span>
                    <div className="flex items-center gap-2">
                      {item.keys.map((key, kidx) => (
                        <React.Fragment key={kidx}>
                          {kidx > 0 && <span className="text-gray-600">or</span>}
                          <kbd className="px-3 py-1 bg-gray-700 border border-gray-600 rounded text-sm font-mono text-white shadow-sm">
                            {key}
                          </kbd>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="bg-gray-800 px-6 py-3 rounded-b-lg border-t border-gray-700 text-center">
          <p className="text-sm text-gray-400">
            Press <kbd className="px-2 py-0.5 bg-gray-700 rounded border border-gray-600 text-xs">Esc</kbd> or click outside to close
          </p>
        </div>
      </div>
    </div>
  )
}
