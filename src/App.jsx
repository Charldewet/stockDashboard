import { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Navbar from './components/Navbar'
import Login from './pages/Login'
import Daily from './pages/Daily'
import Monthly from './pages/Monthly'
import Yearly from './pages/Yearly'
import Stock from './pages/Stock'

function AppContent() {
  const [selectedDate, setSelectedDate] = useState(() => {
    // Start with yesterday's date as a reasonable default
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    return yesterday
  })
  const { selectedPharmacy, getLatestDateWithData } = useAuth()

  // Update the selected date when pharmacy changes to get the latest date with data
  useEffect(() => {
    const updateDateForPharmacy = async () => {
      if (selectedPharmacy) {
        try {
          const latestDate = await getLatestDateWithData(selectedPharmacy)
          setSelectedDate(latestDate)
        } catch (error) {
          console.error('Error updating date for pharmacy:', error)
          // Keep current date if there's an error
        }
      }
    }

    updateDateForPharmacy()
  }, [selectedPharmacy, getLatestDateWithData])

  return (
    <div className="min-h-screen bg-gradient-to-br from-bg-gradient-from to-bg-gradient-to">
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<Login />} />
        
        {/* Protected Routes */}
        <Route path="/" element={
          <ProtectedRoute>
            <>
              <Navbar selectedDate={selectedDate} setSelectedDate={setSelectedDate} />
              <main className="pt-16">
                <Daily selectedDate={selectedDate} />
              </main>
            </>
          </ProtectedRoute>
        } />
        
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