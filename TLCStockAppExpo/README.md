# TLC Stock App - React Native

A mobile-first pharmacy management dashboard built with React Native and Expo, providing real-time analytics and insights for TLC (The Local Chemist) pharmacies.

## 🚀 Features

### ✅ Implemented
- **Authentication**: JWT-based login with secure token storage
- **Daily Dashboard**: Real-time daily metrics with year-over-year comparisons
- **Navigation**: Bottom tab navigation with 4 main sections
- **API Integration**: Full integration with existing Flask backends
- **Responsive Design**: Optimized for mobile devices
- **Pull-to-Refresh**: Refresh data with pull gesture
- **Error Handling**: Comprehensive error handling and user feedback

### 🚧 Coming Soon
- **Monthly Analytics**: Monthly trends and performance insights
- **Yearly Analysis**: Annual growth tracking and forecasting
- **Stock Management**: Real-time inventory levels and alerts
- **Charts & Visualizations**: Interactive charts with Victory Native
- **Push Notifications**: Real-time alerts for important metrics
- **Offline Support**: Critical data caching for offline use
- **Biometric Auth**: Face ID/Touch ID authentication

## 📱 Screenshots

*Screenshots will be added once the app is fully developed*

## 🛠️ Technology Stack

- **React Native**: 0.79.5
- **Expo**: ~53.0.20
- **TypeScript**: For type safety
- **React Navigation**: Bottom tabs and stack navigation
- **Lucide React Native**: Beautiful, customizable icons
- **AsyncStorage**: Secure local data storage
- **Axios**: HTTP client for API calls

## 🏗️ Architecture

```
TLCStockAppExpo/
├── src/
│   ├── components/          # Reusable UI components
│   ├── contexts/           # React contexts (Auth, etc.)
│   ├── navigation/         # Navigation configuration
│   ├── screens/           # Screen components
│   │   ├── auth/          # Authentication screens
│   │   └── dashboard/     # Main dashboard screens
│   ├── services/          # API service layer
│   ├── types/             # TypeScript type definitions
│   └── utils/             # Utility functions
├── assets/                # Images, fonts, etc.
├── App.tsx               # Main app component
└── package.json          # Dependencies and scripts
```

## 🚀 Getting Started

### Prerequisites
- Node.js (14+)
- npm or yarn
- Expo CLI
- iOS Simulator (macOS) or Android emulator

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd TLCStockAppExpo
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the development server**
   ```bash
   npm start
   ```

4. **Run on device/emulator**
   - **iOS**: Press `i` in the terminal or scan QR code with Camera app
   - **Android**: Press `a` in the terminal or scan QR code with Expo Go app
   - **Web**: Press `w` in the terminal

### Test Credentials

**Admin Access (All Pharmacies):**
```
Username: admin
Password: admin123
```

**Reitz Pharmacy Only:**
```
Username: reitz
Password: reitz2024
```

**TLC Winterton Only:**
```
Username: winterton
Password: winterton2024
```

**General User (All Pharmacies):**
```
Username: user
Password: password
```

## 📊 API Integration

The app connects to a unified Render PostgreSQL database:

### Pharmacy Reports API
- **Base URL**: `https://your-render-service-url.onrender.com/api`
- **Database**: `pharmacy_reports` (PostgreSQL on Render)
- **Endpoints**: All pharmacy data including turnover, financial, sales, stock, and performance metrics

### Available Pharmacies
- **REITZ** (Pharmacy ID: 1)
- **TLC WINTERTON** (Pharmacy ID: 2)

### Authentication
- Uses `X-Pharmacy` header to specify which pharmacy data to retrieve
- JWT token-based authentication

## 🔧 Development

### Code Structure

#### API Services (`src/services/api.ts`)
```typescript
// Authentication
export const authAPI = {
  login: (username, password) => Promise<AuthResponse>
  getPharmacies: () => Promise<Pharmacy[]>
}

// Turnover data
export const turnoverAPI = {
  getTurnover: (pharmacy, date) => Promise<TurnoverData>
  getTurnoverForRange: (pharmacy, start, end) => Promise<TurnoverData[]>
}
```

#### Authentication Context (`src/contexts/AuthContext.tsx`)
```typescript
interface AuthContextType {
  user: User | null
  pharmacies: Pharmacy[]
  selectedPharmacy: string | null
  login: (username, password) => Promise<void>
  logout: () => Promise<void>
  isAuthenticated: boolean
}
```

#### Utility Functions
- **Date Utils**: `formatDateLocal()`, `getYesterday()`, `getPreviousYearSameDayOfWeek()`
- **Format Utils**: `formatCurrency()`, `formatPercentage()`, `calculatePercentageChange()`

### Adding New Features

1. **Create new screen component** in `src/screens/`
2. **Add navigation route** in `src/navigation/AppNavigator.tsx`
3. **Create API functions** in `src/services/api.ts`
4. **Add utility functions** in `src/utils/`

## 📈 Roadmap

### Phase 1 (Current) - Core Foundation ✅
- [x] Authentication system
- [x] Navigation structure  
- [x] Daily dashboard with metrics
- [x] API integration
- [x] Basic error handling

### Phase 2 - Enhanced Dashboard
- [ ] Chart integration with Victory Native
- [ ] Monthly and yearly analytics
- [ ] Advanced filtering and date selection
- [ ] Performance optimizations

### Phase 3 - Stock Management
- [ ] Real-time inventory tracking
- [ ] Stock movement analytics
- [ ] Reorder recommendations
- [ ] Barcode scanning capability

### Phase 4 - Advanced Features
- [ ] Push notifications
- [ ] Offline data sync
- [ ] Biometric authentication
- [ ] PDF report generation
- [ ] Advanced data visualization

## 🔒 Security

- **JWT Authentication**: Secure token-based authentication
- **AsyncStorage**: Secure local storage for sensitive data
- **HTTPS**: All API calls use HTTPS encryption
- **Token Refresh**: Automatic token refresh on 401 errors

## 📱 Platform Support

- **iOS**: Full support (iOS 11+)
- **Android**: Full support (Android 5.0+)
- **Web**: Development support via Expo Web

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Contact the development team
- Check the web app documentation for API details

## 🔗 Related Projects

- **Web Dashboard**: React.js web version of the app
- **Backend API**: Flask API serving pharmacy data
- **Stock Service**: Separate microservice for inventory management 