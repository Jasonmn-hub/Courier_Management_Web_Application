import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from "@shared/schema";

// Get DATABASE_URL with proper validation
const getDatabaseUrl = () => {
  const databaseUrl = process.env.DATABASE_URL;
  
  // Check if DATABASE_URL exists and is a valid PostgreSQL URL
  if (databaseUrl && (databaseUrl.startsWith('postgres://') || databaseUrl.startsWith('postgresql://'))) {
    return databaseUrl;
  }
  
  // For production deployment, provide clear error message
  if (process.env.NODE_ENV === 'production') {
    console.error('🚨 DATABASE_URL is missing or invalid.');
    console.error('📋 To fix this on Render:');
    console.error('  1. Go to your Render dashboard');
    console.error('  2. Create a PostgreSQL database');
    console.error('  3. Copy the "External Database URL"');
    console.error('  4. Add it as DATABASE_URL environment variable to your web service');
    console.error('💡 The URL should start with postgresql:// or postgres://');
    
    throw new Error(
      'DATABASE_URL must be set to a valid PostgreSQL connection string. Please add DATABASE_URL environment variable in your hosting platform.'
    );
  }
  
  // For development, provide helpful message
  console.error('🚨 DATABASE_URL is missing or invalid for development.');
  console.error('💡 Make sure your database is properly configured in Replit.');
  throw new Error(
    'DATABASE_URL must be set. Did you forget to provision a database?'
  );
};

const databaseUrl = getDatabaseUrl();

// Configure for PostgreSQL with SSL preference for hosted databases
const client = postgres(databaseUrl, {
  ssl: 'prefer',
  max: 10,
  connect_timeout: 60,
  idle_timeout: 20,
  // Handle connection errors gracefully
  onnotice: () => {}, // Suppress notices
  connection: {
    application_name: 'courier-management-app',
  }
});

export const db = drizzle(client, { schema });