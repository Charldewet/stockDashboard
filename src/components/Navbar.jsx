import { useState, useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Calendar as CalendarIcon, BarChart3, TrendingUp, Package, LogOut, ChevronDown } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import DateCalendar from './DateCalendar'

const Navbar = ({ selectedDate, setSelectedDate }) => {
  const [isScrolled, setIsScrolled] = useState(false)
  const [showPharmacyDropdown, setShowPharmacyDropdown] = useState(false)
  const [showMobilePharmacyDropdown, setShowMobilePharmacyDropdown] = useState(false)
  const [showCalendar, setShowCalendar] = useState(false)
  const [showMobileCalendar, setShowMobileCalendar] = useState(false)
  const location = useLocation()
  const { user, pharmacies, selectedPharmacy, setSelectedPharmacy, logout } = useAuth()
  const dropdownRef = useRef(null)
  const calendarRef = useRef(null)
  const mobileCalendarRef = useRef(null)
  const mobilePharmacyRef = useRef(null)

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 0)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowPharmacyDropdown(false)
      }
      if (mobilePharmacyRef.current && !mobilePharmacyRef.current.contains(event.target)) {
        setShowMobilePharmacyDropdown(false)
      }
      if (calendarRef.current && !calendarRef.current.contains(event.target)) {
        setShowCalendar(false)
      }
      if (mobileCalendarRef.current && !mobileCalendarRef.current.contains(event.target)) {
        setShowMobileCalendar(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Close mobile calendar on route change
  useEffect(() => {
    setShowMobileCalendar(false)
  }, [location.pathname])

  const navItems = [
    { path: '/daily', label: 'Daily', icon: CalendarIcon },
    { path: '/monthly', label: 'Monthly', icon: BarChart3 },
    { path: '/yearly', label: 'Yearly', icon: TrendingUp },
    { path: '/stock', label: 'Stock', icon: Package }
  ]

  const handleLogout = () => {
    logout()
  }

  function formatDateLocal(date) {
    if (!date) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  const formatDate = (date) => formatDateLocal(date)

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      isScrolled 
        ? 'bg-surface-secondary shadow-lg backdrop-blur-sm bg-opacity-95' 
        : 'bg-transparent'
    }`}
    style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo/Brand */}
          <div className="flex items-center">
            <Link to="/" className="flex items-center space-x-3">
              <img 
                src="/logo/logo_dark.png" 
                alt="Logo" 
                className="h-8 w-auto"
              />
            </Link>
          </div>

          {/* Navigation Links (Desktop) */}
          <div className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = location.pathname === item.path
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-all duration-200 ease-out ${
                    isActive
                      ? 'bg-accent-primary text-text-primary shadow-md'
                      : 'text-text-secondary hover:text-text-primary hover:bg-surface-primary'
                  }`}
                >
                  <Icon size={20} />
                  <span className="font-medium">{item.label}</span>
                </Link>
              )
            })}
          </div>

          {/* Right Side - Calendar, Pharmacy Selector & User Menu (Desktop) */}
          <div className="hidden md:flex items-center space-x-4">
            {/* Calendar Icon (Desktop only) */}
            <div className="relative" ref={calendarRef}>
              <button
                className={`flex items-center px-3 py-2 rounded-lg transition-all duration-200 ease-out ${showCalendar ? 'bg-surface-primary' : ''}`}
                onClick={() => setShowCalendar((open) => !open)}
                aria-label="Open calendar"
              >
                <CalendarIcon size={22} className="text-accent-primary" />
                <span className="ml-2 text-text-secondary text-sm font-semibold">
                  {formatDate(selectedDate)}
                </span>
              </button>
              {showCalendar && (
                <div className="absolute right-0 mt-2 z-50" style={{ minWidth: '320px' }}>
                  <div className="bg-surface-primary rounded-xl shadow-xl p-2">
                    <DateCalendar
                      date={selectedDate}
                      setDate={(d) => {
                        setSelectedDate(d)
                        setShowCalendar(false)
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Pharmacy Selector */}
            {pharmacies.length > 0 && (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setShowPharmacyDropdown(!showPharmacyDropdown)}
                  className="flex items-center space-x-2 px-3 py-2 bg-surface-primary rounded-lg text-text-secondary hover:text-text-primary transition-all duration-200 ease-out"
                >
                  <span className="font-medium capitalize">{pharmacies.find(p => p.code === selectedPharmacy)?.name || selectedPharmacy}</span>
                  <ChevronDown size={16} className={`transition-transform duration-200 ${showPharmacyDropdown ? 'rotate-180' : ''}`} />
                </button>
                {showPharmacyDropdown && (
                  <div className="absolute right-0 mt-2 w-48 bg-surface-primary rounded-lg shadow-lg border border-border py-1 z-50">
                    {pharmacies.map((pharmacy) => (
                      <button
                        key={pharmacy.code}
                        onClick={() => {
                          setSelectedPharmacy(pharmacy.code)
                          setShowPharmacyDropdown(false)
                        }}
                        className={`w-full text-left px-4 py-2 text-sm transition-colors duration-200 ease-out ${
                          selectedPharmacy === pharmacy.code
                            ? 'bg-accent-primary text-text-primary'
                            : 'text-text-secondary hover:text-text-primary hover:bg-surface-secondary'
                        }`}
                      >
                        <span className="capitalize">{pharmacy.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* User Menu */}
            {user && (
              <div className="flex items-center space-x-3">
                <span className="text-text-secondary text-sm hidden md:block">
                  Welcome, {user.username}
                </span>
                <button
                  onClick={handleLogout}
                  className="flex items-center space-x-2 px-3 py-2 text-text-secondary hover:text-text-primary hover:bg-surface-primary rounded-lg transition-all duration-200 ease-out"
                >
                  <LogOut size={16} />
                  <span className="hidden md:block text-sm">Logout</span>
                </button>
              </div>
            )}
          </div>

          {/* Mobile Right Side - Pharmacy Selector, Calendar, & Logout */}
          <div className="md:hidden flex items-center space-x-2">
            {/* Pharmacy Selector (Mobile) */}
            {pharmacies.length > 0 && (
              <div className="relative" ref={mobilePharmacyRef}>
                <button
                  onClick={() => setShowMobilePharmacyDropdown(!showMobilePharmacyDropdown)}
                  className="flex items-center space-x-1 px-2 py-1 bg-surface-primary rounded-lg text-text-secondary hover:text-text-primary transition-all duration-200 ease-out text-sm"
                >
                  <span className="font-medium capitalize truncate max-w-20">{pharmacies.find(p => p.code === selectedPharmacy)?.name || selectedPharmacy}</span>
                  <ChevronDown size={14} className={`transition-transform duration-200 ${showMobilePharmacyDropdown ? 'rotate-180' : ''}`} />
                </button>
                {showMobilePharmacyDropdown && (
                  <div className="absolute right-0 mt-2 w-40 bg-surface-primary rounded-lg shadow-lg border border-border py-1 z-50">
                    {pharmacies.map((pharmacy) => (
                      <button
                        key={pharmacy.code}
                        onClick={() => {
                          setSelectedPharmacy(pharmacy.code)
                          setShowMobilePharmacyDropdown(false)
                        }}
                        className={`w-full text-left px-3 py-2 text-sm transition-colors duration-200 ease-out ${
                          selectedPharmacy === pharmacy.code
                            ? 'bg-accent-primary text-text-primary'
                            : 'text-text-secondary hover:text-text-primary hover:bg-surface-secondary'
                        }`}
                      >
                        <span className="capitalize">{pharmacy.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Calendar Icon (Mobile) */}
            <div className="relative" ref={mobileCalendarRef}>
              <button
                className="text-text-secondary hover:text-text-primary p-2"
                onClick={() => setShowMobileCalendar((open) => !open)}
                aria-label="Open calendar"
              >
                <CalendarIcon size={20} />
              </button>
              {showMobileCalendar && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 md:hidden" onClick={() => setShowMobileCalendar(false)}>
                  <div className="bg-surface-primary rounded-xl shadow-xl p-4 max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}>
                    <DateCalendar
                      date={selectedDate}
                      setDate={(d) => {
                        setSelectedDate(d)
                        setShowMobileCalendar(false)
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Logout Button (Mobile) */}
            {user && (
              <button
                onClick={handleLogout}
                className="text-text-secondary hover:text-text-primary p-2"
                aria-label="Logout"
              >
                <LogOut size={20} />
              </button>
            )}
          </div>
        </div>
      </div>


    </nav>
  )
}

export default Navbar 