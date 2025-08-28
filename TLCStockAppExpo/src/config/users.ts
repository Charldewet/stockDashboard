// User Management Configuration for New Database
// This is a temporary solution until authentication endpoints are implemented

export interface User {
  username: string;
  password: string;
  name: string;
  role: 'admin' | 'manager' | 'user';
  allowedPharmacies: string[];
}

// Define users for the new database
export const USERS: User[] = [
  {
    username: 'admin',
    password: 'admin123',
    name: 'System Administrator',
    role: 'admin',
    allowedPharmacies: ['REITZ', 'TLC WINTERTON']
  },
  {
    username: 'reitz',
    password: 'reitz2024',
    name: 'Reitz Pharmacy Manager',
    role: 'manager',
    allowedPharmacies: ['REITZ']
  },
  {
    username: 'winterton',
    password: 'winterton2024',
    name: 'TLC Winterton Manager',
    role: 'manager',
    allowedPharmacies: ['TLC WINTERTON']
  },
  {
    username: 'user',
    password: 'password',
    name: 'General User',
    role: 'user',
    allowedPharmacies: ['REITZ', 'TLC WINTERTON', 'TLC ROOS', 'TLC VILLIERS', 'TLC TUGELA', 'TLC GROUP', '100']
  },
  {
    username: 'Charl',
    password: 'password',
    name: 'Charl',
    role: 'user',
    allowedPharmacies: ['TLC GROUP']
  }
];

// Helper functions
export const findUser = (username: string, password: string): User | null => {
  return USERS.find(user => 
    user.username === username && user.password === password
  ) || null;
};

export const getUserByUsername = (username: string): User | null => {
  return USERS.find(user => user.username === username) || null;
};

export const validateCredentials = (username: string, password: string): boolean => {
  return findUser(username, password) !== null;
};

export const getUserPharmacies = (username: string): string[] => {
  const user = getUserByUsername(username);
  return user ? user.allowedPharmacies : [];
}; 