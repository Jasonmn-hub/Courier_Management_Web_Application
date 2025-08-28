import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Configure for Replit PostgreSQL
const client = postgres(process.env.DATABASE_URL, {
  ssl: 'prefer',
  max: 10,
  connect_timeout: 60,
  idle_timeout: 20
});

export const db = drizzle(client, { schema });