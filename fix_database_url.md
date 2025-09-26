# Fix DATABASE_URL Error - Windows

## 🔍 Quick Diagnosis

**Run this debug script first:**
```cmd
node debug_env.js
```
This will check if your .env file exists and show what environment variables are loaded.

## ✅ Solution 1: Create/Fix .env File

**Check if .env file exists** in your project root:
```cmd
dir .env
```

**If .env file is missing, create it:**
```cmd
echo DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/courier_cms > .env
echo NODE_ENV=development >> .env
echo PGHOST=localhost >> .env
echo PGPORT=5432 >> .env
echo PGUSER=postgres >> .env
echo PGPASSWORD=YOUR_PASSWORD >> .env
echo PGDATABASE=courier_cms >> .env
```

**Replace `YOUR_PASSWORD` with your actual PostgreSQL password!**

## ✅ Solution 2: Load .env File Properly

**Option A: Use dotenv in startup command**
```cmd
npx tsx -r dotenv/config server/index.ts
```

**Option B: Install cross-env (Recommended)**
```cmd
npm install --save-dev cross-env
```
Then use:
```cmd
npx cross-env NODE_ENV=development tsx server/index.ts
```

**Option C: Modify server/index.ts** (add at the very top):
```typescript
import 'dotenv/config';  // Add this line at the top
import express, { type Request, Response, NextFunction } from "express";
// ... rest of your imports
```

## ✅ Solution 3: Use npm script

**Edit package.json** and update the dev script:
```json
{
  "scripts": {
    "dev": "cross-env NODE_ENV=development tsx server/index.ts"
  }
}
```

Then run:
```cmd
npm run dev
```

## 🧪 Test Your Fix

After applying any solution, test with:
```cmd
node debug_env.js
```

You should see:
- ✅ .env file exists
- ✅ DATABASE_URL: SET (length: XX)
- ✅ All other env variables set

Then start your app:
```cmd
npx tsx server/index.ts
```

## 🔧 Expected Success Output

```
24-hour reminder email system initialized - checking every 2 hours
Database seeded successfully!
X:XX:XX AM [express] serving on port 5000
```

## 🆘 If Still Not Working

1. **Check PostgreSQL is running:**
   ```cmd
   psql -U postgres -h localhost -p 5432 -c "SELECT 1;"
   ```

2. **Verify database exists:**
   ```cmd
   psql -U postgres -h localhost -p 5432 -lqt | findstr courier_cms
   ```

3. **Manually set environment variable:**
   ```cmd
   set DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/courier_cms
   npx tsx server/index.ts
   ```