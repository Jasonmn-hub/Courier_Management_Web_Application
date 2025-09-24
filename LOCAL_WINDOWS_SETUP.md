# Local Windows Setup Guide

## Quick Start (Automated)

1. **Run the Complete Installer**:
   ```bash
   python windows_installer_complete.py
   ```
   This will automatically install Node.js, PostgreSQL, create the database, and start the application.

## Manual Setup (If Automated Installer Fails)

### 1. Install Prerequisites

**Install Node.js:**
- Download from [nodejs.org](https://nodejs.org/) (LTS version 20.x)
- Run the installer and follow instructions

**Install PostgreSQL:**
- Download from [postgresql.org](https://www.postgresql.org/download/windows/)
- During installation, set a password for the `postgres` user (remember this password!)
- Note the port (default: 5432)
- **Important**: Remember your password - you'll need it for the DATABASE_URL

### 2. Create Database

Open Command Prompt as Administrator and run:
```bash
# Create the database (replace YOUR_PASSWORD with your actual PostgreSQL password)
createdb -U postgres -h localhost -p 5432 LMF
```
When prompted, enter the password you set during PostgreSQL installation.

### 3. Set Environment Variables

Create a `.env` file in your project root with (replace YOUR_PASSWORD with your actual PostgreSQL password):
```
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/LMF
NODE_ENV=development
PGHOST=localhost
PGPORT=5432
PGUSER=postgres
PGPASSWORD=YOUR_PASSWORD
PGDATABASE=LMF
```

### 4. Install Dependencies and Setup Database

```bash
# Install npm packages
npm install

# Create database tables
npm run db:push
```

### 5. Start the Application

```bash
npm run dev
```

The application will be available at: http://localhost:5000

## Troubleshooting

### "DATABASE_URL is missing" Error
- Make sure the `.env` file exists in the project root
- Verify PostgreSQL is running (check Services in Windows)
- Test database connection:
  ```bash
  psql -U postgres -h localhost -p 5432 -d LMF
  ```

### "Database does not exist" Error
- Create the database manually:
  ```bash
  createdb -U postgres LMF
  ```

### "Permission denied" Error
- Run Command Prompt as Administrator
- Make sure PostgreSQL service is running

### Port 5000 Already in Use
- Kill the process using port 5000:
  ```bash
  netstat -ano | findstr :5000
  taskkill /PID <PID_NUMBER> /F
  ```

## Database Configuration

The application expects these environment variables:
- `DATABASE_URL`: Full PostgreSQL connection string
- `PGHOST`: Database host (localhost for local development)
- `PGPORT`: Database port (5432 by default)
- `PGUSER`: Database user (postgres)
- `PGPASSWORD`: Database password
- `PGDATABASE`: Database name (LMF)

## Default Credentials

**Database:**
- Host: localhost
- Port: 5432
- Database: LMF
- User: postgres
- Password: (the password you set during PostgreSQL installation)

**Application:**
- First user to register becomes admin
- Login with your Replit account or create local account