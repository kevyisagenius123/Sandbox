import React from 'react'

type SidebarSectionProps = {
  title: string
  description?: string
  children: React.ReactNode
}

export const SidebarSection: React.FC<SidebarSectionProps> = ({ title, description, children }) => (
  <section className="space-y-4 rounded-2xl border border-gray-800 bg-gray-900/60 p-5 shadow-lg">
    <header>
      <h3 className="text-sm font-semibold uppercase tracking-wide text-white">{title}</h3>
      {description && <p className="mt-1 text-xs leading-relaxed text-gray-400">{description}</p>}
    </header>
    <div className="space-y-4 text-sm text-gray-200">{children}</div>
  </section>
)
