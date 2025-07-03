import { Link, useLocation } from 'react-router-dom'
import { Calendar as CalendarIcon, BarChart3, TrendingUp, Package } from 'lucide-react'

const BottomNavbar = () => {
  const location = useLocation()

  const navItems = [
    { path: '/daily', label: 'Daily', icon: CalendarIcon },
    { path: '/monthly', label: 'Monthly', icon: BarChart3 },
    { path: '/yearly', label: 'Yearly', icon: TrendingUp },
    { path: '/stock', label: 'Stock', icon: Package }
  ]

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-surface-primary border-t border-border shadow-lg"
    style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="flex items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = location.pathname === item.path
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center py-3 px-2 flex-1 transition-all duration-200 ease-out ${
                isActive
                  ? 'text-accent-primary'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <Icon size={20} className="mb-1" />
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

export default BottomNavbar 