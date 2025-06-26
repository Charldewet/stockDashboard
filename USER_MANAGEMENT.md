# User Management

This document explains how to manage users in the WebDashboardv3 application.

## Current Users

The application currently has the following users configured:

1. **Charl** - Admin user
   - Username: `Charl`
   - Password: `Koeberg7#`
   - Access: All pharmacies (reitz, roos, tugela, villiers, winterton)

2. **Elani** - Regular user
   - Username: `Elani`
   - Password: `Elani123`
   - Access: Villiers pharmacy only

3. **user** - Test user
   - Username: `user`
   - Password: `password`
   - Access: Test pharmacies (DUMMY1, DUMMY2)

4. **newuser** - Additional user
   - Username: `newuser`
   - Password: `securepassword123`
   - Access: All pharmacies (reitz, roos, tugela, villiers, winterton)

## Adding New Users

To add a new user, you need to edit the `USERS` dictionary in `app/app.py`:

1. Open `app/app.py`
2. Find the `USERS` dictionary (around line 61)
3. Add a new user entry following this format:

```python
USERS = {
    "Charl": {
        "password": "Koeberg7#",
        "pharmacies": ["reitz", "roos", "tugela", "villiers", "winterton"]
    },
    "NewUsername": {
        "password": "NewPassword123",
        "pharmacies": ["reitz", "roos", "tugela", "villiers", "winterton"]
    }
}
```

## Available Pharmacy Codes

- `reitz` - Reitz Pharmacy
- `roos` - Roos Pharmacy  
- `tugela` - Tugela Pharmacy
- `villiers` - Villiers Pharmacy
- `winterton` - Winterton Pharmacy

## Security Notes

- Passwords are stored in plain text (not recommended for production)
- Users are stored in memory (will be lost on server restart)
- Consider implementing proper password hashing and database storage for production use

## Deployment

After adding a new user:

1. Commit your changes to git
2. Deploy to Render (the changes will be automatically deployed)
3. The new user will be able to log in immediately

## Testing

You can test user login by:
1. Going to the login page
2. Entering the username and password
3. Verifying the user can access the intended pharmacies 