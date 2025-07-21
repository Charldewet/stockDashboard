import { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Navbar from './components/Navbar'
import BottomNavbar from './components/BottomNavbar'
import Login from './pages/Login'
import Daily from './pages/Daily'
import Monthly from './pages/Monthly'
import Yearly from './pages/Yearly'
import Stock from './pages/Stock'

function AppContent({ selectedDate, setSelectedDate }) {
  const { selectedPharmacy } = useAuth();

  return (
    <div className="min-h-screen min-h-dvh bg-gradient-to-br from-bg-gradient-from to-bg-gradient-to">
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<Login />} />
        
        {/* Protected Routes */}
        <Route path="/daily" element={
          <ProtectedRoute>
            <>
              <Navbar selectedDate={selectedDate} setSelectedDate={setSelectedDate} />
              <main className="pt-16 pb-20 md:pb-0" style={{ paddingTop: 'calc(4rem + env(safe-area-inset-top))' }}>
                <Daily selectedDate={selectedDate} />
              </main>
              <BottomNavbar />
            </>
          </ProtectedRoute>
        } />
        
        <Route path="/monthly" element={
          <ProtectedRoute>
            <>
              <Navbar selectedDate={selectedDate} setSelectedDate={setSelectedDate} />
              <main className="pt-16 pb-20 md:pb-0" style={{ paddingTop: 'calc(4rem + env(safe-area-inset-top))' }}>
                <Monthly selectedDate={selectedDate} />
              </main>
              <BottomNavbar />
            </>
          </ProtectedRoute>
        } />
        
        <Route path="/yearly" element={
          <ProtectedRoute>
            <>
              <Navbar selectedDate={selectedDate} setSelectedDate={setSelectedDate} />
              <main className="pt-16 pb-20 md:pb-0" style={{ paddingTop: 'calc(4rem + env(safe-area-inset-top))' }}>
                <Yearly selectedDate={selectedDate} />
              </main>
              <BottomNavbar />
            </>
          </ProtectedRoute>
        } />
        
        <Route path="/stock" element={
          <ProtectedRoute>
            <>
              <Navbar selectedDate={selectedDate} setSelectedDate={setSelectedDate} />
              <main className="pt-16 pb-20 md:pb-0" style={{ paddingTop: 'calc(4rem + env(safe-area-inset-top))' }}>
                <Stock selectedDate={selectedDate} />
              </main>
              <BottomNavbar />
            </>
          </ProtectedRoute>
        } />
        {/* Redirect root to /daily */}
        <Route path="/" element={<Navigate to="/daily" replace />} />
      </Routes>
    </div>
  )
}

function App() {
  // Initialize selectedDate from localStorage if available, else use yesterday
  const getInitialDate = () => {
    const stored = localStorage.getItem('selectedDate');
    if (stored) {
      const d = new Date(stored);
      if (!isNaN(d)) return d;
    }
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday;
  };
  const [selectedDate, _setSelectedDate] = useState(getInitialDate);
  // Custom setter to update both state and localStorage
  const setSelectedDate = (date) => {
    _setSelectedDate(date);
    if (date instanceof Date && !isNaN(date)) {
      localStorage.setItem('selectedDate', date.toISOString());
    }
  };

  // Handle SPA routing for Render platform
  useEffect(() => {
    const redirectPath = sessionStorage.getItem('redirectPath');
    if (redirectPath && redirectPath !== '/') {
      sessionStorage.removeItem('redirectPath');
      // Navigate to the stored path
      if (redirectPath === '/stock' || redirectPath === '/daily' || redirectPath === '/monthly' || redirectPath === '/yearly') {
        window.history.replaceState(null, '', redirectPath);
      }
    }
  }, []);

  return (
    <AuthProvider setSelectedDate={setSelectedDate}>
      <Router>
        <AppContent selectedDate={selectedDate} setSelectedDate={setSelectedDate} />
      </Router>
    </AuthProvider>
  )
}

export default App 