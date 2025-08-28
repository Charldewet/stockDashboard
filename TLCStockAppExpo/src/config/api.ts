// API Configuration for New Pharmacy API Service
export const API_CONFIG = {
  // New pharmacy API service URL
  BASE_URL: 'https://pharmacy-api-webservice.onrender.com',
  
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
export const getPharmacyByCode = (code: string) => {
  return API_CONFIG.PHARMACIES.find(pharmacy => pharmacy.code === code || String(pharmacy.id) === code);
};

// Helper function to get pharmacy by ID
export const getPharmacyById = (id: number) => {
  return API_CONFIG.PHARMACIES.find(pharmacy => pharmacy.id === id);
};

// Helper function to validate pharmacy code
export const isValidPharmacyCode = (code: string) => {
  return API_CONFIG.PHARMACIES.some(pharmacy => pharmacy.code === code);
};

// Helper function to get headers with API key
export const getHeadersWithAuth = () => {
  return {
    ...API_CONFIG.HEADERS,
    ...(API_CONFIG.API_KEY !== 'YOUR_API_KEY_HERE' && {
      'Authorization': `Bearer ${API_CONFIG.API_KEY}`
    })
  };
}; 