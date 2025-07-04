import { createContext, useContext, useState, useEffect } from 'react'
import { authAPI, turnoverAPI } from '../services/api'

const AuthContext = createContext()

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children, setSelectedDate }) => {
  const [user, setUser] = useState(null)
  const [pharmacies, setPharmacies] = useState([])
  const [selectedPharmacy, setSelectedPharmacy] = useState(null)
  const [loading, setLoading] = useState(true)
  const [hasSetInitialDate, setHasSetInitialDate] = useState(false)

  useEffect(() => {
    // Check if user is already logged in
    const token = localStorage.getItem('authToken')
    const savedUser = localStorage.getItem('user')
    
    if (token && savedUser) {
      try {
        setUser(JSON.parse(savedUser))
        fetchPharmacies()
      } catch (error) {
        console.error('Error parsing saved user:', error)
        logout()
      }
    } else {
      setLoading(false)
    }
  }, [])

  const fetchPharmacies = async () => {
    try {
      const pharmacyList = await authAPI.getPharmacies()
      
      // Handle both formats: array of strings and array of objects with code/name
      const formattedPharmacies = pharmacyList.map(pharmacy => {
        if (typeof pharmacy === 'string') {
          // Old format: array of strings
          return {
            code: pharmacy,
            name: `TLC ${pharmacy.charAt(0).toUpperCase() + pharmacy.slice(1)}`
          };
        } else if (pharmacy && typeof pharmacy === 'object' && pharmacy.code && pharmacy.name) {
          // New format: array of objects with code and name
          return {
            code: pharmacy.code,
            name: pharmacy.name
          };
        } else {
          // Fallback for unexpected format
          console.warn('Unexpected pharmacy format:', pharmacy);
          return {
            code: String(pharmacy),
            name: String(pharmacy)
          };
        }
      });
      
      setPharmacies(formattedPharmacies)
      
      // Always set first pharmacy as default if we have pharmacies
      if (formattedPharmacies.length > 0) {
        setSelectedPharmacy(formattedPharmacies[0].code)
        // Only set the initial date after login, not on pharmacy change
        if (!hasSetInitialDate && setSelectedDate) {
          getLatestDateWithData(formattedPharmacies[0].code).then((date) => {
            setSelectedDate(date)
            setHasSetInitialDate(true)
          })
        }
      }
    } catch (error) {
      console.error('Error fetching pharmacies:', error)
    } finally {
      setLoading(false)
    }
  }

  const getLatestDateWithData = async (pharmacy) => {
    try {
      const response = await turnoverAPI.getLatestDateWithData(pharmacy)
      if (response.has_data && response.latest_date) {
        return new Date(response.latest_date)
      }
      // If no data found, return yesterday's date
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      return yesterday
    } catch (error) {
      console.error('Error getting latest date with data:', error)
      // Fallback to yesterday's date
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      return yesterday
    }
  }

  const login = async (username, password) => {
    try {
      setLoading(true)
      setHasSetInitialDate(false)
      const response = await authAPI.login(username, password)
      
      const userData = {
        username,
        token: response.token
      }
      
      // Save to localStorage
      localStorage.setItem('authToken', response.token)
      localStorage.setItem('user', JSON.stringify(userData))
      
      setUser(userData)
      
      // Fetch pharmacies after successful login
      await fetchPharmacies()
      
      return { success: true }
    } catch (error) {
      console.error('Login error:', error)
      return { 
        success: false, 
        error: error.response?.data?.message || 'Login failed' 
      }
    } finally {
      setLoading(false)
    }
  }

  const logout = () => {
    localStorage.removeItem('authToken')
    localStorage.removeItem('user')
    setUser(null)
    setPharmacies([])
    setSelectedPharmacy(null)
    setHasSetInitialDate(false)
  }

  const isAuthenticated = () => {
    return !!user && !!localStorage.getItem('authToken')
  }

  const value = {
    user,
    pharmacies,
    selectedPharmacy,
    setSelectedPharmacy,
    loading,
    login,
    logout,
    isAuthenticated,
    getLatestDateWithData
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
} 