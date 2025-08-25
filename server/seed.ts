import { db } from './db';
import { departments, users } from '@shared/schema';
import { hashPassword } from './auth';

export async function seedDatabase() {
  try {
    // Check if data already exists
    const existingDepartments = await db.select().from(departments).limit(1);
    if (existingDepartments.length > 0) {
      console.log('Database already seeded, skipping...');
      return;
    }

    console.log('Seeding database with initial data...');

    // Create default departments
    const defaultDepartments = [
      { name: 'IT Department' },
      { name: 'Operations' }, 
      { name: 'Customer Service' }
    ];

    for (const dept of defaultDepartments) {
      await db.insert(departments).values(dept);
    }

    // Create a default admin user (only if no users exist)
    const existingUsers = await db.select().from(users).limit(1);
    if (existingUsers.length === 0) {
      const adminPassword = await hashPassword('admin123');
      await db.insert(users).values({
        name: 'System Admin',
        email: 'admin@system.com',
        password: adminPassword,
        role: 'admin',
        departmentId: 1
      });
    }

    console.log('Database seeded successfully!');
  } catch (error) {
    console.error('Error seeding database:', error);
  }
}