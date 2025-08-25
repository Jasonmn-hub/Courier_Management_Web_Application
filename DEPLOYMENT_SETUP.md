# Courier Management System - Deployment Setup

## Quick Deploy Guide

This system is designed for **automatic deployment**. Follow these simple steps:

### 1. Clone and Deploy
```bash
git clone [your-github-url]
cd courier-management
npm install
```

### 2. Database Setup (Automatic)
- The system uses Replit's built-in PostgreSQL database
- All tables will be created automatically on first startup
- No manual database setup required

### 3. Start the Application
```bash
npm run dev
```

### 4. Login Credentials

The system includes **temporary test users** for immediate testing:

**Admin Access:**
- Email: `admin@courier.com`
- Password: `admin123`
- Role: Full system access (users, departments, settings)

**User Access:**
- Email: `user@courier.com` 
- Password: `user123`
- Role: Limited access (add/edit couriers only)

### 5. Using Test Credentials
1. Open the application
2. Click "Sign In"
3. **Check the "Use temporary test credentials (CSV)" checkbox**
4. Enter the credentials above
5. Click "Sign In"

## System Features Included

✅ **Role-Based Access Control**
- Admin: Full system management
- Manager: Department-specific access
- User: Basic courier operations

✅ **Courier Management**
- Create, edit, track courier deliveries
- File upload support for POD documents
- Status tracking (On The Way, Received, Completed)

✅ **Department Management**
- Multi-department support
- Custom fields per department
- User assignment to departments

✅ **Dashboard Analytics**
- Real-time courier statistics
- Visual charts and graphs
- Export functionality

✅ **SMTP Email Configuration**
- Admin-configurable email settings
- Notification system ready

## Database Tables (Auto-Created)
- `users` - User accounts and roles
- `departments` - Organization departments  
- `couriers` - Courier deliveries
- `fields` - Custom field definitions
- `department_fields` - Department-field assignments
- `smtp_settings` - Email configuration
- `audit_logs` - System activity tracking
- `sessions` - User session management

## Production Deployment

For production use:
1. Replace test credentials with real user accounts
2. Configure SMTP settings in admin panel
3. Set up proper backup procedures
4. Configure SSL certificates if needed

## Updates Made

**CSV Authentication System:**
- Added temporary user authentication via CSV file
- Login form includes checkbox for CSV mode
- Backend supports both database and CSV authentication
- Temporary users bypass database requirements

**Files Added/Modified:**
- `temp_users.csv` - Test user credentials
- `client/src/pages/landing.tsx` - Added CSV login option
- `client/src/hooks/useAuth.ts` - Support for temp user flag
- `server/routes.ts` - CSV authentication logic
- `server/auth.ts` - Token validation for temp users
- `DEPLOYMENT_SETUP.md` - This deployment guide

The system is now **deployment-ready** with automatic database setup and test credentials included for immediate use.