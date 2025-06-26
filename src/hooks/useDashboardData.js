import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { turnoverAPI, financialAPI, stockAPI, salesAPI } from '../services/api'

export const useDashboardData = () => {
  const { selectedPharmacy } = useAuth()
  const [data, setData] = useState({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetchData = async (dateRange = null) => {
    if (!selectedPharmacy) return

    setLoading(true)
    setError(null)

    try {
      // Default to today if no date range provided
      const endDate = dateRange?.endDate || new Date().toISOString().split('T')[0]
      const startDate = dateRange?.startDate || endDate

      const [
        turnoverData,
        dailyTurnoverData,
        gpData,
        transactionsData,
        openingStockData,
        closingStockData,
        cashSalesData,
        accountSalesData,
        codSalesData
      ] = await Promise.all([
        turnoverAPI.getTurnoverForRange(selectedPharmacy, startDate, endDate),
        turnoverAPI.getDailyTurnoverForRange(selectedPharmacy, startDate, endDate),
        financialAPI.getGPForRange(selectedPharmacy, startDate, endDate),
        financialAPI.getTransactionsForRange(selectedPharmacy, startDate, endDate),
        stockAPI.getOpeningStockForRange(selectedPharmacy, startDate, endDate),
        stockAPI.getClosingStockForRange(selectedPharmacy, startDate, endDate),
        salesAPI.getDailyCashSalesForRange(selectedPharmacy, startDate, endDate),
        salesAPI.getDailyAccountSalesForRange(selectedPharmacy, startDate, endDate),
        salesAPI.getDailyCODSalesForRange(selectedPharmacy, startDate, endDate)
      ])

      setData({
        turnover: turnoverData,
        dailyTurnover: dailyTurnoverData,
        grossProfit: gpData,
        transactions: transactionsData,
        openingStock: openingStockData,
        closingStock: closingStockData,
        cashSales: cashSalesData,
        accountSales: accountSalesData,
        codSales: codSalesData
      })
    } catch (err) {
      console.error('Error fetching dashboard data:', err)
      setError(err.response?.data?.message || 'Failed to fetch data')
    } finally {
      setLoading(false)
    }
  }

  // Fetch data when pharmacy changes
  useEffect(() => {
    if (selectedPharmacy) {
      fetchData()
    }
  }, [selectedPharmacy])

  return {
    data,
    loading,
    error,
    fetchData,
    selectedPharmacy
  }
}

export const useStockData = () => {
  const { selectedPharmacy } = useAuth()
  const [stockData, setStockData] = useState({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetchStockData = async (dateRange = null) => {
    if (!selectedPharmacy) return

    setLoading(true)
    setError(null)

    try {
      const endDate = dateRange?.endDate || new Date().toISOString().split('T')[0]
      const startDate = dateRange?.startDate || endDate

      const [
        openingStock,
        closingStock,
        adjustments,
        turnoverRatio,
        daysOfInventory
      ] = await Promise.all([
        stockAPI.getOpeningStockForRange(selectedPharmacy, startDate, endDate),
        stockAPI.getClosingStockForRange(selectedPharmacy, startDate, endDate),
        stockAPI.getStockAdjustmentsForRange(selectedPharmacy, startDate, endDate),
        stockAPI.getTurnoverRatioForRange(selectedPharmacy, startDate, endDate),
        stockAPI.getDaysOfInventoryForRange(selectedPharmacy, startDate, endDate)
      ])

      setStockData({
        openingStock,
        closingStock,
        adjustments,
        turnoverRatio,
        daysOfInventory
      })
    } catch (err) {
      console.error('Error fetching stock data:', err)
      setError(err.response?.data?.message || 'Failed to fetch stock data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (selectedPharmacy) {
      fetchStockData()
    }
  }, [selectedPharmacy])

  return {
    stockData,
    loading,
    error,
    fetchStockData,
    selectedPharmacy
  }
} 