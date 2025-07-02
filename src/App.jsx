import { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Navbar from './components/Navbar'
import Login from './pages/Login'
import Daily from './pages/Daily'
import Monthly from './pages/Monthly'
import Yearly from './pages/Yearly'
import Stock from './pages/Stock'

function AppContent() {
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
  const { selectedPharmacy } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-bg-gradient-from to-bg-gradient-to">
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<Login />} />
        
        {/* Protected Routes */}
        <Route path="/daily" element={
          <ProtectedRoute>
            <>
              <Navbar selectedDate={selectedDate} setSelectedDate={setSelectedDate} />
              <main className="pt-16">
                <Daily selectedDate={selectedDate} />
              </main>
            </>
          </ProtectedRoute>
        } />
        
        <Route path="/monthly" element={
          <ProtectedRoute>
            <>
              <Navbar selectedDate={selectedDate} setSelectedDate={setSelectedDate} />
              <main className="pt-16">
                <Monthly selectedDate={selectedDate} />
              </main>
            </>
          </ProtectedRoute>
        } />
        
        <Route path="/yearly" element={
          <ProtectedRoute>
            <>
              <Navbar selectedDate={selectedDate} setSelectedDate={setSelectedDate} />
              <main className="pt-16">
                <Yearly selectedDate={selectedDate} />
              </main>
            </>
          </ProtectedRoute>
        } />
        
        <Route path="/stock" element={
          <ProtectedRoute>
            <>
              <Navbar selectedDate={selectedDate} setSelectedDate={setSelectedDate} />
              <main className="pt-16">
                <Stock />
              </main>
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
  return (
    <AuthProvider>
      <Router>
        <AppContent />
      </Router>
    </AuthProvider>
  )
}

export default App 