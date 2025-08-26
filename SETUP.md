# Setup Instructions for Replit

This file contains automatic setup instructions for when this project is imported to Replit.

## Automatic Setup Process

When you import this project to Replit, the following will happen automatically:

1. **Dependencies Installation**: All npm packages will be installed automatically
2. **Database Setup**: PostgreSQL database will be configured and migrated
3. **Environment Variables**: All required environment variables will be set by Replit
4. **File Structure**: Upload directories and configurations will be created

## Manual Steps (if needed)

If the automatic setup doesn't complete successfully, run these commands in the Shell:

```bash
# 1. Install all dependencies
npm install

# 2. Setup database schema
npm run db:push

# 3. Start the development server
npm run dev
```

## Environment Variables

Replit automatically provides these environment variables:
- `DATABASE_URL` - PostgreSQL connection (auto-configured)
- `REPL_ID` - Replit application ID (auto-configured)
- `REPLIT_DOMAINS` - Application domain (auto-configured)
- `JWT_SECRET` - JWT token secret (auto-configured)
- `SESSION_SECRET` - Session encryption secret (auto-configured)

## Required Permissions

Make sure your Replit account has:
- Database access enabled
- File upload permissions
- Network access for external APIs

## Troubleshooting

### If the app doesn't start:
1. Check the Console tab for error messages
2. Verify all environment variables are set in the Secrets tab
3. Run `npm run db:push` to ensure database schema is updated
4. Clear cache: delete `node_modules` and run `npm install`

### If database connection fails:
1. Go to the Database tab in Replit
2. Ensure PostgreSQL is enabled
3. Check that `DATABASE_URL` is set in environment variables
4. Run `npm run db:push` to create tables

### If file uploads fail:
1. Check that the `uploads/` directory exists
2. Verify file permissions in the Files tab
3. Ensure `UPLOAD_DIR` environment variable is set to `uploads`

## First Time Use

1. **Login**: Use your Replit account to authenticate
2. **Admin Setup**: The first user becomes admin automatically
3. **Department Creation**: Create your first department
4. **Upload Authority Template**: Upload a Word document template for letter generation
5. **User Management**: Add team members and assign roles

## Features Available

- ✅ User authentication with Replit
- ✅ Department and courier management
- ✅ Authority letter generation from Word templates
- ✅ File upload and document management
- ✅ Role-based access control
- ✅ Real-time dashboard and analytics
- ✅ Audit logging and activity tracking

Your courier management system is ready to use!