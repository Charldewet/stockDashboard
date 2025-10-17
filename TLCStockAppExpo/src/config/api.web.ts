// Web-specific API Configuration
// Supports both development (with CORS proxy) and production (direct API)
const resolveBaseUrl = () => {
  try {
    // In production, use the backend API directly
    if (typeof window !== 'undefined' && window.location) {
      const hostname = window.location.hostname;
      
      // Production: deployed on Render or custom domain
      if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
        return 'https://pharmacy-api-webservice.onrender.com';
      }
      
      // Development: use local CORS proxy
      return `http://${hostname}:3000/api`;
    }
    return 'http://localhost:3000/api';
  } catch {
    return 'http://localhost:3000/api';
  }
};

export const API_CONFIG = {
  // Automatically switches between dev proxy and production API
  BASE_URL: resolveBaseUrl(),
  
  // Available pharmacies for the new database
  PHARMACIES: [
    { code: 'REITZ', name: 'REITZ APTEEK', id: 1 },
    { code: 'TLC WINTERTON', name: 'TLC PHARMACY WINTERTON', id: 2 },
    { code: '3', name: 'ROOS Pharmacy', id: 3 },
    { code: '4', name: 'TLC VILLIERS PHARMACY', id: 4 },
    { code: '5', name: 'TLC TUGELA PHARMACY', id: 5 },
    { code: '100', name: 'TLC GROUP', id: 100 }
  ],
  
  // API timeout settings
  TIMEOUT: 10000,
  
  // API Key - Replace with your actual API key
  API_KEY: 'super-secret-long-random-string',

  // Auth endpoints (server-managed users)
  AUTH: {
    LOGIN_PATH: '/auth/login',
    ME_PATH: '/auth/me',
  },
  
  // Headers configuration
  HEADERS: {
    'Content-Type': 'application/json',
  }
};

// Helper function to get pharmacy by code
export const getPharmacyByCode = (code: string) => 
  API_CONFIG.PHARMACIES.find(p => p.code === code || String(p.id) === code);

// Helper function to get headers with auth
export const getHeadersWithAuth = () => ({
  ...API_CONFIG.HEADERS,
  'Authorization': `Bearer ${API_CONFIG.API_KEY}`,
});

