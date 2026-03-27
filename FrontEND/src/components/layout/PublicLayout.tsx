import { Outlet } from 'react-router-dom'
import Footer from './Footer'
import { MainHeader } from './MainHeader'
import { TopServiceBar } from './TopServiceBar'

export function PublicLayout() {
  return (
    <div className="app-shell">
      <TopServiceBar />
      <MainHeader />
      <main>
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}

