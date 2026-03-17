import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

type DashboardLayoutProps = {
  title: string
  subtitle: string
  navItems: string[]
  children: ReactNode
}

export function DashboardLayout({ title, subtitle, navItems, children }: DashboardLayoutProps) {
  return (
    <div className="dashboard-page">
      <aside className="dashboard-sidebar">
        <Link to="/" className="brand brand--inverted">
          <span className="brand__dot" />
          Трамплин
        </Link>

        <nav>
          {navItems.map((item, index) => (
            <a key={item} href={`#section-${index}`}>
              {item}
            </a>
          ))}
        </nav>
      </aside>

      <div className="dashboard-content">
        <header className="dashboard-header card">
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </header>
        {children}
      </div>
    </div>
  )
}
