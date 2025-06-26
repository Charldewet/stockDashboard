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

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [pharmacies, setPharmacies] = useState([])
  const [selectedPharmacy, setSelectedPharmacy] = useState(null)
  const [loading, setLoading] = useState(true)

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
      setPharmacies(pharmacyList)
      
      // Always set first pharmacy as default if we have pharmacies
      if (pharmacyList.length > 0) {
        setSelectedPharmacy(pharmacyList[0])
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