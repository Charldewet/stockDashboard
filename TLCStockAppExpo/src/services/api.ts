import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_CONFIG, getHeadersWithAuth } from '../config/api';

// API Configuration - Updated for new pharmacy API service
const API_BASE_URL = API_CONFIG.BASE_URL;
const STOCK_API_BASE_URL = API_CONFIG.BASE_URL; // Using same base URL for stock endpoints

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_CONFIG.TIMEOUT,
  headers: getHeadersWithAuth(),
});

// Create stock API instance (now using same base URL)
const stockApi = axios.create({
  baseURL: STOCK_API_BASE_URL,
  timeout: API_CONFIG.TIMEOUT,
  headers: getHeadersWithAuth(),
});

// Request interceptor to add auth token and pharmacy header
const addAuthInterceptor = (apiInstance: typeof api) => {
  apiInstance.interceptors.request.use(
    async (config) => {
      try {
        const token = await AsyncStorage.getItem('authToken');
        // Preserve existing Authorization header (API key) unless none is set
        if (token && !config.headers.Authorization) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        
        // Add pharmacy header for all requests (will be overridden by specific endpoints)
        const user = await AsyncStorage.getItem('user');
        if (user) {
          const userData = JSON.parse(user);
          if (userData.selectedPharmacy) {
            config.headers['X-Pharmacy'] = userData.selectedPharmacy;
          }
        }
      } catch (error) {
        console.error('Error getting auth token or user data:', error);
      }
      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );
};

// Response interceptor to handle auth errors
const addResponseInterceptor = (apiInstance: typeof api) => {
  apiInstance.interceptors.response.use(
    (response) => response,
    async (error) => {
      if (error.response?.status === 401) {
        try {
          await AsyncStorage.removeItem('authToken');
          await AsyncStorage.removeItem('user');
        } catch (storageError) {
          console.error('Error clearing storage:', storageError);
        }
      }
      return Promise.reject(error);
    }
  );
};

// Apply interceptors to both API instances
addAuthInterceptor(api);
addAuthInterceptor(stockApi);
addResponseInterceptor(api);
addResponseInterceptor(stockApi);

// Authentication API - Backend-driven; app uses API key and username for access lists
export const authAPI = {
  login: async (username: string, _password: string) => {
    try {
      // Validate user by fetching their pharmacy access; API key auth only
      const res = await api.get(`/users/${encodeURIComponent(username)}/pharmacies`);
      const data = res.data || {};
      const pharmacies = Array.isArray(data?.pharmacies) ? data.pharmacies : (Array.isArray(res.data) ? res.data : (data?.items || []));

      const formattedPharmacies = (pharmacies as Array<any>).map((p: any) => ({
        code: String(p.pharmacy_id),
        name: p.pharmacy_name || p.name || String(p.pharmacy_id),
        can_read: Boolean(p.can_read ?? true),
        can_write: Boolean(p.can_write ?? false),
      }));

      return {
        token: null as any, // No session token; API access is via API key
        user: {
          username,
          name: username,
          role: 'user',
          allowedPharmacies: (formattedPharmacies as Array<{ code: string }>).map((p: { code: string }) => p.code),
        },
      };
    } catch (error: any) {
      const status = error?.response?.status;
      if (status === 401 || status === 403) {
        const err: any = new Error('API_KEY_INVALID');
        err.code = 'API_KEY_INVALID';
        throw err;
      }
      if (status === 404) {
        const err: any = new Error('INVALID_CREDENTIALS');
        err.code = 'INVALID_CREDENTIALS';
        throw err;
      }
      const err: any = new Error(error?.message || 'LOGIN_FAILED');
      err.code = error?.code || 'LOGIN_FAILED';
      throw err;
    }
  },
  
  getPharmacies: async (username?: string) => {
    // New backend-backed pharmacies: if username supplied, get allowed pharmacies for that user
    try {
      if (username) {
        // GET /users/{username}/pharmacies → [{ pharmacy_id, pharmacy_name, can_read, can_write }]
        const res = await api.get(`/users/${encodeURIComponent(username)}/pharmacies`);
        const items = Array.isArray(res.data?.pharmacies) ? res.data.pharmacies : (Array.isArray(res.data) ? res.data : (res.data?.items || []));
        return items.map((p: any) => ({
          code: String(p.pharmacy_id),
          name: p.pharmacy_name || p.name || String(p.pharmacy_id),
        }));
      }
      // Fallback: GET /pharmacies → [{ pharmacy_id, name }]
      const res = await api.get('/pharmacies');
      const items = Array.isArray(res.data) ? res.data : (res.data?.items || []);
      return items.map((p: any) => ({
        code: String(p.pharmacy_id),
        name: p.name || p.pharmacy_name || String(p.pharmacy_id),
      }));
    } catch (error) {
      // As a fallback, return static config if backend is unavailable
      return API_CONFIG.PHARMACIES.map(p => ({ code: String(p.id) || p.code, name: p.name }));
    }
  }
};

// Turnover API - Updated for new endpoints
export const turnoverAPI = {
  getTurnover: async (pharmacy: string, date?: string) => {
    const params: any = { pharmacy };
    if (date) params.date = date;
    const response = await api.get('/turnover', { 
      params,
      headers: { 'X-Pharmacy': pharmacy }
    });
    return response.data;
  },

  getTurnoverForRange: async (pharmacy: string, startDate: string, endDate: string) => {
    const response = await api.get(`/turnover_for_range/${startDate}/${endDate}`, {
      headers: { 'X-Pharmacy': pharmacy }
    });
    return response.data;
  },

  getDailyTurnoverForRange: async (pharmacy: string, startDate: string, endDate: string) => {
    const response = await api.get(`/daily_turnover_for_range/${startDate}/${endDate}`, {
      headers: { 'X-Pharmacy': pharmacy }
    });
    return response.data;
  },

  getLatestDateWithData: async (pharmacy: string) => {
    const response = await api.get(`/latest_date_with_data/${pharmacy}`, {
      headers: { 'X-Pharmacy': pharmacy }
    });
    return response.data;
  }
};

// Financial API - Updated for new endpoints
export const financialAPI = {
  getGPForRange: async (pharmacy: string, startDate: string, endDate: string) => {
    const response = await api.get(`/gp_for_range/${startDate}/${endDate}`, {
      headers: { 'X-Pharmacy': pharmacy }
    });
    return response.data;
  },

  getDailyGPPercentForRange: async (pharmacy: string, startDate: string, endDate: string) => {
    const response = await api.get(`/daily_gp_percent_for_range/${startDate}/${endDate}`, {
      headers: { 'X-Pharmacy': pharmacy }
    });
    return response.data;
  },

  getMonthlyGPForRange: async (pharmacy: string, startDate: string, endDate: string) => {
    const response = await api.get(`/monthly_gp_for_range/${startDate}/${endDate}`, {
      headers: { 'X-Pharmacy': pharmacy }
    });
    return response.data;
  },

  getYearlyGPForRange: async (pharmacy: string, startDate: string, endDate: string) => {
    const response = await api.get(`/yearly_gp_for_range/${startDate}/${endDate}`, {
      headers: { 'X-Pharmacy': pharmacy }
    });
    return response.data;
  }
};

// Sales/Stock APIs follow...

// Sales API - Updated for new endpoints
export const salesAPI = {
  getBasketMetricsForRange: async (pharmacy: string, startDate: string, endDate: string) => {
    const response = await api.get(`/basket_metrics_for_range/${startDate}/${endDate}`, {
      headers: { 'X-Pharmacy': pharmacy }
    });
    return response.data;
  },

  getScriptsForRange: async (pharmacy: string, startDate: string, endDate: string) => {
    const response = await api.get(`/scripts_for_range/${startDate}/${endDate}`, {
      headers: { 'X-Pharmacy': pharmacy }
    });
    return response.data;
  },

  getDailyScriptsForRange: async (pharmacy: string, startDate: string, endDate: string) => {
    const response = await api.get(`/daily_scripts_for_range/${startDate}/${endDate}`, {
      headers: { 'X-Pharmacy': pharmacy }
    });
    return response.data;
  },

  getDailyScriptsDispensedForRange: async (pharmacy: string, startDate: string, endDate: string) => {
    const response = await api.get(`/daily_scripts_dispensed_for_range/${startDate}/${endDate}`, {
      headers: { 'X-Pharmacy': pharmacy }
    });
    return response.data;
  },

  getMonthlyScriptsForRange: async (pharmacy: string, startDate: string, endDate: string) => {
    const response = await api.get(`/monthly_scripts_for_range/${startDate}/${endDate}`, {
      headers: { 'X-Pharmacy': pharmacy }
    });
    return response.data;
  },

  getDailyCashSalesForRange: async (pharmacy: string, startDate: string, endDate: string) => {
    const response = await api.get(`/daily_cash_sales_for_range/${startDate}/${endDate}`, {
      headers: { 'X-Pharmacy': pharmacy }
    });
    return response.data;
  },

  getDailyAccountSalesForRange: async (pharmacy: string, startDate: string, endDate: string) => {
    const response = await api.get(`/daily_account_sales_for_range/${startDate}/${endDate}`, {
      headers: { 'X-Pharmacy': pharmacy }
    });
    return response.data;
  },

  getDailyDispensaryPercentForRange: async (pharmacy: string, startDate: string, endDate: string) => {
    const response = await api.get(`/daily_dispensary_percent_for_range/${startDate}/${endDate}`, {
      headers: { 'X-Pharmacy': pharmacy }
    });
    return response.data;
  },

  getDailyDispensaryTurnoverForRange: async (pharmacy: string, startDate: string, endDate: string) => {
    const response = await api.get(`/daily_dispensary_turnover_for_range/${startDate}/${endDate}`, {
      headers: { 'X-Pharmacy': pharmacy }
    });
    return response.data;
  }
};

// Add KPIs Summary API
export const kpisAPI = {
  getSummary: async (pharmacy: string, asOf: string) => {
    const response = await api.get(`/kpis/summary`, {
      params: { as_of: asOf },
      headers: { 'X-Pharmacy': pharmacy }
    });
    return response.data;
  }
};

// Stock API - Updated for new endpoints
export const stockAPI = {
  getDailySummary: async (pharmacy: string, date: string) => {
    const response = await stockApi.get(`/daily_summary/${pharmacy}/${date}`, {
      headers: { 'X-Pharmacy': pharmacy }
    });
    return response.data;
  },

  getTopMoving: async (pharmacy: string, date: string) => {
    const response = await stockApi.get(`/top_moving/${pharmacy}/${date}`, {
      headers: { 'X-Pharmacy': pharmacy }
    });
    return response.data;
  },

  getLowStockAlerts: async (pharmacy: string, date: string) => {
    const response = await stockApi.get(`/low_stock_alerts/${pharmacy}/${date}`, {
      headers: { 'X-Pharmacy': pharmacy }
    });
    return response.data;
  },

  getMovements: async (pharmacy: string, startDate: string, endDate: string) => {
    const response = await stockApi.get(`/movements/${pharmacy}/${startDate}/${endDate}`, {
      headers: { 'X-Pharmacy': pharmacy }
    });
    return response.data;
  },

  getRecommendations: async (pharmacy: string) => {
    const response = await stockApi.get(`/recommendations/${pharmacy}`, {
      headers: { 'X-Pharmacy': pharmacy }
    });
    return response.data;
  },

  getHealth: async () => {
    const response = await stockApi.get('/health');
    return response.data;
  },

  // Updated stock endpoints for new database
  getClosingStockForRange: async (pharmacy: string, startDate: string, endDate: string) => {
    const response = await api.get(`/closing_stock_for_range/${startDate}/${endDate}`, {
      headers: { 'X-Pharmacy': pharmacy }
    });
    return response.data;
  },

  getOpeningStockForRange: async (pharmacy: string, startDate: string, endDate: string) => {
    const response = await api.get(`/opening_stock_for_range/${startDate}/${endDate}`, {
      headers: { 'X-Pharmacy': pharmacy }
    });
    return response.data;
  },

  getStockAdjustmentsForRange: async (pharmacy: string, startDate: string, endDate: string) => {
    const response = await api.get(`/stock_adjustments_for_range/${startDate}/${endDate}`, {
      headers: { 'X-Pharmacy': pharmacy }
    });
    return response.data;
  },

  getTurnoverRatioForRange: async (pharmacy: string, startDate: string, endDate: string) => {
    const response = await api.get(`/turnover_ratio_for_range/${startDate}/${endDate}`, {
      headers: { 'X-Pharmacy': pharmacy }
    });
    return response.data;
  },

  getDaysOfInventoryForRange: async (pharmacy: string, startDate: string, endDate: string) => {
    const response = await api.get(`/days_of_inventory_for_range/${startDate}/${endDate}`, {
      headers: { 'X-Pharmacy': pharmacy }
    });
    return response.data;
  }
};

// Daily Stock API - Updated for new endpoints
export const dailyStockAPI = {
  getDailyStock: async (pharmacy: string, date: string) => {
    const response = await stockApi.get(`/daily_summary/${pharmacy}/${date}`, {
      headers: { 'X-Pharmacy': pharmacy }
    });
    return response.data;
  },

  getTopMovingProducts: async (pharmacy: string, date: string, limit: number = 20) => {
    const response = await stockApi.get(`/top_moving/${pharmacy}/${date}`, {
      params: { limit },
      headers: { 'X-Pharmacy': pharmacy }
    });
    return response.data;
  },

  getTopMovingProductsRange: async (pharmacy: string, startDate: string, endDate: string, limit: number = 20) => {
    const response = await stockApi.get(`/top_moving_range/${pharmacy}/${startDate}/${endDate}`, {
      params: { limit },
      headers: { 'X-Pharmacy': pharmacy }
    });
    return response.data;
  },

  getLowGPProducts: async (pharmacy: string, date: string, threshold: number = 20, excludePDST: boolean = false) => {
    const response = await stockApi.get(`/low_gp_products/${pharmacy}/${date}`, {
      params: { threshold, exclude_pdst: excludePDST },
      headers: { 'X-Pharmacy': pharmacy }
    });
    return response.data;
  },

  getBestSellers: async (pharmacy: string, limit: number = 20) => {
    const response = await stockApi.get(`/best_sellers/${pharmacy}`, {
      params: { limit },
      headers: { 'X-Pharmacy': pharmacy }
    });
    return response.data;
  },

  getDormantStockWithValue: async (pharmacy: string, limit: number = 20, daysThreshold: number = 30) => {
    const response = await stockApi.get(`/dormant_stock_with_value/${pharmacy}`, {
      params: { limit, days_threshold: daysThreshold },
      headers: { 'X-Pharmacy': pharmacy }
    });
    return response.data;
  },

  getStockLevelsWithDays: async (pharmacy: string, minDaysThreshold: number = 7) => {
    const response = await stockApi.get(`/stock_levels/${pharmacy}`, {
      params: { min_days: minDaysThreshold },
      headers: { 'X-Pharmacy': pharmacy }
    });
    return response.data;
  },

  checkDataAvailable: async (pharmacy: string, date: string) => {
    try {
      const response = await stockApi.get(`/daily_summary/${pharmacy}/${date}`, {
        headers: { 'X-Pharmacy': pharmacy }
      });
      return response.data && Object.keys(response.data).length > 0;
    } catch (error) {
      return false;
    }
  }
};

// New Pharmacy API Service - Using the new endpoints from API_ENDPOINTS.md
export const newPharmacyAPI = {
  // Get daily sales data for a specific date range
  getDailySales: async (pharmacyId: number, fromDate: string, toDate: string) => {
    try {
      const response = await api.get(`/pharmacies/${pharmacyId}/days?from=${fromDate}&to=${toDate}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching daily sales data:', error);
      throw error;
    }
  },

  // Get daily turnover for a specific date
  getDailyTurnover: async (pharmacyId: number, date: string) => {
    try {
      const response = await api.get(`/pharmacies/${pharmacyId}/days?from=${date}&to=${date}`);
      const data = response.data;
      
      // Return the first (and only) day's data
      if (data && Array.isArray(data) && data.length > 0) {
        return data[0];
      }
      
      return null;
    } catch (error) {
      console.error('Error fetching daily turnover data:', error);
      throw error;
    }
  },

  // Get MTD aggregates for a month, optional through-date cutoff
  getMTD: async (pharmacyId: number, monthYYYYMM: string, throughDate?: string) => {
    try {
      const throughParam = throughDate ? `&through=${throughDate}` : '';
      const response = await api.get(`/pharmacies/${pharmacyId}/mtd?month=${monthYYYYMM}${throughParam}`);
      const data = response.data;

      // If backend returns a valid non-empty object with any non-zero metric, use it
      const hasAnyValue = data && typeof data === 'object' && (
        Number(data.turnover) > 0 ||
        Number(data.gp_value) > 0 ||
        Number(data.dispensary_turnover) > 0 ||
        Number(data.transaction_count) > 0 ||
        Number(data.scripts_qty) > 0 ||
        Number(data.purchases) > 0 ||
        Number(data.cost_of_sales) > 0
      );
      if (hasAnyValue) return data;

      // Fallback: aggregate from daily range if MTD returns empty/zeros
      const month = monthYYYYMM;
      const [yearStr, monthStr] = month.split('-');
      const year = Number(yearStr);
      const mon = Number(monthStr) - 1; // JS month

      const fromDate = new Date(year, mon, 1);
      const toCutoff = throughDate ? new Date(throughDate) : new Date(year, mon + 1, 0);

      const fromStr = `${fromDate.getFullYear()}-${String(fromDate.getMonth() + 1).padStart(2, '0')}-${String(fromDate.getDate()).padStart(2, '0')}`;
      const toStr = `${toCutoff.getFullYear()}-${String(toCutoff.getMonth() + 1).padStart(2, '0')}-${String(toCutoff.getDate()).padStart(2, '0')}`;

      const daysRes = await api.get(`/pharmacies/${pharmacyId}/days?from=${fromStr}&to=${toStr}`);
      const arr = Array.isArray(daysRes.data) ? daysRes.data : [];

      const totals = arr.reduce((acc: any, d: any) => {
        acc.turnover += Number(d.turnover) || 0;
        acc.purchases += Number(d.purchases) || 0;
        acc.cost_of_sales += Number(d.cost_of_sales) || 0;
        acc.type_r_sales += Number(d.type_r_sales) || 0;
        acc.dispensary_turnover += Number(d.dispensary_turnover) || 0;
        acc.scripts_qty += Number(d.scripts_qty) || 0;
        acc.transaction_count += Number(d.transaction_count) || 0;
        acc.frontshop_turnover += Number(d.frontshop_turnover) || 0;
        acc.gp_value += Number(d.gp_value) || 0;
        return acc;
      }, {
        month_start: `${yearStr}-${monthStr}-01`,
        turnover: 0,
        purchases: 0,
        cost_of_sales: 0,
        type_r_sales: 0,
        dispensary_turnover: 0,
        scripts_qty: 0,
        transaction_count: 0,
        frontshop_turnover: 0,
        gp_value: 0,
      });

      return totals;
    } catch (error) {
      console.error('Error fetching MTD aggregates:', error);
      throw error;
    }
  },

  // Get YTD aggregates for a year, optional through-date cutoff
  getYTD: async (pharmacyId: number, yearYYYY: string, throughDate?: string) => {
    try {
      const throughParam = throughDate ? `&through=${throughDate}` : '';
      const response = await api.get(`/pharmacies/${pharmacyId}/ytd?year=${yearYYYY}${throughParam}`);
      const data = response.data; // expect object with turnover, dispensary_turnover, gp_value, etc.

      const hasAnyValue = data && typeof data === 'object' && (
        Number(data.turnover) > 0 ||
        Number(data.gp_value) > 0 ||
        Number(data.dispensary_turnover) > 0 ||
        Number(data.transaction_count) > 0 ||
        Number(data.scripts_qty) > 0 ||
        Number(data.purchases) > 0 ||
        Number(data.cost_of_sales) > 0
      );
      if (hasAnyValue) return data;

      // Fallback: aggregate from daily range if YTD returns empty/zeros
      const year = Number(yearYYYY);
      const fromDate = new Date(year, 0, 1); // Jan 1
      const toCutoff = throughDate ? new Date(throughDate) : new Date(year, 11, 31); // Dec 31

      const fromStr = `${fromDate.getFullYear()}-${String(fromDate.getMonth() + 1).padStart(2, '0')}-${String(fromDate.getDate()).padStart(2, '0')}`;
      const toStr = `${toCutoff.getFullYear()}-${String(toCutoff.getMonth() + 1).padStart(2, '0')}-${String(toCutoff.getDate()).padStart(2, '0')}`;

      const daysRes = await api.get(`/pharmacies/${pharmacyId}/days?from=${fromStr}&to=${toStr}`);
      const arr = Array.isArray(daysRes.data) ? daysRes.data : [];

      const totals = arr.reduce((acc: any, d: any) => {
        acc.turnover += Number(d.turnover) || 0;
        acc.purchases += Number(d.purchases) || 0;
        acc.cost_of_sales += Number(d.cost_of_sales) || 0;
        acc.type_r_sales += Number(d.type_r_sales) || 0;
        acc.dispensary_turnover += Number(d.dispensary_turnover) || 0;
        acc.scripts_qty += Number(d.scripts_qty) || 0;
        acc.transaction_count += Number(d.transaction_count) || 0;
        acc.frontshop_turnover += Number(d.frontshop_turnover) || 0;
        acc.gp_value += Number(d.gp_value) || 0;
        return acc;
      }, {
        year_start: `${yearYYYY}-01-01`,
        turnover: 0,
        purchases: 0,
        cost_of_sales: 0,
        type_r_sales: 0,
        dispensary_turnover: 0,
        scripts_qty: 0,
        transaction_count: 0,
        frontshop_turnover: 0,
        gp_value: 0,
      });

      return totals;
    } catch (error) {
      console.error('Error fetching YTD aggregates:', error);
      throw error;
    }
  }
};

export default api;
