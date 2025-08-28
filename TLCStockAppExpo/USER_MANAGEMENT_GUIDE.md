# User Management Guide - New Database Setup

## 🔐 Authentication Overview

Since your new Render PostgreSQL database doesn't have authentication endpoints implemented yet, we've implemented a **simple client-side authentication system** as a temporary solution.

## 👥 Current User Accounts

### Admin Users
| Username | Password | Role | Access |
|----------|----------|------|--------|
| `admin` | `admin123` | Admin | All Pharmacies |
| `user` | `password` | User | All Pharmacies |

### Pharmacy-Specific Users
| Username | Password | Role | Access |
|----------|----------|------|--------|
| `reitz` | `reitz2024` | Manager | REITZ Only |
| `winterton` | `winterton2024` | Manager | TLC WINTERTON Only |

## 🔧 How to Add/Modify Users

### Step 1: Edit User Configuration
Open `src/config/users.ts` and modify the `USERS` array:

```typescript
export const USERS: User[] = [
  {
    username: 'newuser',
    password: 'newpassword123',
    name: 'New User Name',
    role: 'manager', // 'admin' | 'manager' | 'user'
    allowedPharmacies: ['REITZ'] // ['REITZ', 'TLC WINTERTON']
  },
  // ... existing users
];
```

### Step 2: User Roles Explained
- **`admin`**: Full access to all pharmacies and features
- **`manager`**: Access to specific pharmacy(ies) with management capabilities
- **`user`**: Basic access to assigned pharmacy(ies)

### Step 3: Pharmacy Access Control
- **`['REITZ']`**: User can only access REITZ pharmacy data
- **`['TLC WINTERTON']`**: User can only access TLC WINTERTON pharmacy data
- **`['REITZ', 'TLC WINTERTON']`**: User can access both pharmacies

## 🚀 Testing the Authentication

### 1. Test Login Flow
```bash
# Test admin login
Username: admin
Password: admin123

# Test pharmacy-specific login
Username: reitz
Password: reitz2024
```

### 2. Verify Pharmacy Access
- Login with `reitz` user → Should only see REITZ pharmacy
- Login with `winterton` user → Should only see TLC WINTERTON pharmacy
- Login with `admin` user → Should see both pharmacies

## 🔄 Migration from Old System

### Old Credentials (No Longer Work)
- ❌ `Username: Charl, Password: Koeberg7#`
- ❌ `Username: user, Password: password` (old system)

### New Credentials (Current System)
- ✅ `Username: admin, Password: admin123`
- ✅ `Username: reitz, Password: reitz2024`
- ✅ `Username: winterton, Password: winterton2024`
- ✅ `Username: user, Password: password` (new system)

## 🔒 Security Considerations

### Current Implementation (Temporary)
- ✅ Passwords stored in client-side configuration
- ✅ User permissions enforced at login
- ✅ Pharmacy access restricted by user role
- ⚠️ **Note**: This is a temporary solution until backend authentication is implemented

### Future Implementation (Recommended)
When you implement backend authentication:

1. **Database Users Table**:
   ```sql
   CREATE TABLE users (
     id SERIAL PRIMARY KEY,
     username VARCHAR(50) UNIQUE NOT NULL,
     password_hash VARCHAR(255) NOT NULL,
     name VARCHAR(100) NOT NULL,
     role VARCHAR(20) NOT NULL,
     created_at TIMESTAMP DEFAULT NOW()
   );
   ```

2. **User Pharmacy Access Table**:
   ```sql
   CREATE TABLE user_pharmacy_access (
     id SERIAL PRIMARY KEY,
     user_id INTEGER REFERENCES users(id),
     pharmacy_code VARCHAR(50) NOT NULL,
     created_at TIMESTAMP DEFAULT NOW()
   );
   ```

3. **Backend Authentication Endpoints**:
   - `POST /api/auth/login`
   - `POST /api/auth/logout`
   - `GET /api/auth/me`
   - `GET /api/auth/pharmacies`

## 📋 User Management Checklist

### Adding New Users
- [ ] Add user to `src/config/users.ts`
- [ ] Test login with new credentials
- [ ] Verify pharmacy access permissions
- [ ] Test data loading for assigned pharmacies

### Modifying Existing Users
- [ ] Update user details in `src/config/users.ts`
- [ ] Test login with updated credentials
- [ ] Verify pharmacy access changes
- [ ] Test data loading

### Removing Users
- [ ] Remove user from `src/config/users.ts`
- [ ] Test that removed user cannot login
- [ ] Verify other users still work correctly

## 🧪 Testing Scenarios

### Scenario 1: Admin User
```
Login: admin/admin123
Expected: Access to both REITZ and TLC WINTERTON
Test: Switch between pharmacies, view all data
```

### Scenario 2: Pharmacy-Specific User
```
Login: reitz/reitz2024
Expected: Access only to REITZ
Test: Should not see TLC WINTERTON in dropdown
```

### Scenario 3: Invalid Credentials
```
Login: invalid/invalid
Expected: Error message, no access
Test: Should show "Username or Password incorrect"
```

## 🔧 Troubleshooting

### Common Issues

1. **User cannot login**
   - Check username/password in `src/config/users.ts`
   - Verify no typos in credentials
   - Check console for error messages

2. **User cannot see expected pharmacies**
   - Verify `allowedPharmacies` array in user config
   - Check pharmacy codes match exactly: `'REITZ'` or `'TLC WINTERTON'`

3. **App crashes on login**
   - Check user object structure in `src/config/users.ts`
   - Verify all required fields are present
   - Check console for TypeScript errors

### Debug Steps

1. **Check User Configuration**:
   ```typescript
   // In src/config/users.ts
   console.log('Available users:', USERS);
   ```

2. **Test Authentication**:
   ```typescript
   // In browser console or app
   import { findUser } from './src/config/users';
   console.log('User found:', findUser('admin', 'admin123'));
   ```

3. **Check Pharmacy Access**:
   ```typescript
   // In browser console or app
   import { getUserPharmacies } from './src/config/users';
   console.log('User pharmacies:', getUserPharmacies('reitz'));
   ```

## 📞 Support

If you encounter issues with user management:

1. Check the troubleshooting section above
2. Verify user configuration in `src/config/users.ts`
3. Test with known working credentials
4. Check console logs for error messages
5. Contact the development team if needed

## 🔄 Next Steps

1. **Immediate**: Test all user accounts and pharmacy access
2. **Short-term**: Add any additional users needed
3. **Long-term**: Implement backend authentication system
4. **Future**: Migrate to database-based user management 