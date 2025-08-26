import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { authenticateToken, requireRole, hashPassword, comparePassword, generateToken } from "./auth";
import { insertCourierSchema, insertDepartmentSchema, insertFieldSchema, insertSmtpSettingsSchema, insertReceivedCourierSchema } from "@shared/schema";
import { z } from "zod";
import multer from "multer";
import path from "path";
import fs from "fs";

// Configure multer for file uploads
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({
  dest: uploadDir,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|pdf/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only PDF, PNG, JPG files are allowed'));
    }
  },
});

// CSV helper function
const readTempUsersFromCSV = (): Array<{email: string, name: string, firstName: string, lastName: string, password: string, role: string}> => {
  try {
    const csvPath = path.join(process.cwd(), 'temp_users.csv');
    if (!fs.existsSync(csvPath)) {
      console.error('CSV file not found:', csvPath);
      return [];
    }
    
    const csvContent = fs.readFileSync(csvPath, 'utf8');
    const lines = csvContent.split('\n');
    const headers = lines[0].split(',');
    
    const users = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line) {
        const values = line.split(',');
        const user: any = {};
        headers.forEach((header, index) => {
          user[header.trim()] = values[index]?.trim();
        });
        users.push(user);
      }
    }
    
    return users;
  } catch (error) {
    console.error('Error reading CSV file:', error);
    return [];
  }
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Login endpoint
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password, useTempUser } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
      }

      let user;
      let isValidPassword = false;

      if (useTempUser) {
        // Use CSV authentication
        const tempUsers = readTempUsersFromCSV();
        const tempUser = tempUsers.find(u => u.email === email);
        
        if (tempUser && tempUser.password === password) {
          // Create a user object compatible with the response
          user = {
            id: `temp_${tempUser.email}`,
            email: tempUser.email,
            name: tempUser.name,
            firstName: tempUser.firstName,
            lastName: tempUser.lastName,
            role: tempUser.role,
            departmentId: null
          };
          isValidPassword = true;
        }
      } else {
        // Use database authentication
        user = await storage.getUserByEmail(email);
        if (user && user.password) {
          isValidPassword = await comparePassword(password, user.password);
        }
      }

      if (!user || !isValidPassword) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }
      const token = generateToken({
        userId: user.id,
        email: user.email!,
        role: user.role!
      });

      res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ message: 'Login failed' });
    }
  });

  // Register endpoint
  app.post('/api/auth/register', async (req, res) => {
    try {
      const { name, email, password, role = 'user', departmentId } = req.body;
      
      if (!name || !email || !password) {
        return res.status(400).json({ message: 'Name, email and password are required' });
      }

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: 'User already exists' });
      }

      const hashedPassword = await hashPassword(password);
      
      const newUser = await storage.createUser({
        name,
        email,
        password: hashedPassword,
        role: role as any,
        departmentId: departmentId || null
      });

      const token = generateToken({
        userId: newUser.id,
        email: newUser.email!,
        role: newUser.role!
      });

      res.status(201).json({ token, user: { id: newUser.id, email: newUser.email, name: newUser.name, role: newUser.role } });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ message: 'Registration failed' });
    }
  });

  // Auth routes
  // Get current user endpoint
  app.get('/api/auth/user', authenticateToken, async (req: any, res) => {
    try {
      res.json(req.user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Helper function for setting current user
  const setCurrentUser = () => {
    return async (req: any, res: any, next: any) => {
      req.currentUser = req.user;
      next();
    };
  };

  // User management routes
  app.get('/api/users', authenticateToken, requireRole(['admin', 'manager']), async (req: any, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.post('/api/users', authenticateToken, requireRole(['admin']), setCurrentUser(), async (req: any, res) => {
    try {
      const { name, email, password, role = 'user', departmentId } = req.body;
      
      if (!name || !email) {
        return res.status(400).json({ message: 'Name and email are required' });
      }

      if (!password) {
        return res.status(400).json({ message: 'Password is required for new users' });
      }

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: 'User already exists' });
      }

      const hashedPassword = await hashPassword(password);
      
      const newUser = await storage.createUser({
        name,
        email,
        password: hashedPassword,
        role: role as any,
        departmentId: departmentId || null
      });

      await logAudit(req.currentUser.id, 'CREATE', 'user', newUser.id);

      res.status(201).json(newUser);
    } catch (error) {
      console.error('User creation error:', error);
      res.status(500).json({ message: 'User creation failed' });
    }
  });

  app.put('/api/users/:id', authenticateToken, requireRole(['admin']), setCurrentUser(), async (req: any, res) => {
    try {
      const userId = req.params.id;
      const { name, email, role, departmentId, password } = req.body;
      
      if (!name || !email) {
        return res.status(400).json({ message: 'Name and email are required' });
      }

      const updateData: any = {
        name,
        email,
        role: role as any,
        departmentId: departmentId || null
      };

      // Only update password if provided
      if (password && password.trim()) {
        updateData.password = await hashPassword(password);
      }

      const updatedUser = await storage.updateUser(userId, updateData);

      if (!updatedUser) {
        return res.status(404).json({ message: 'User not found' });
      }

      await logAudit(req.currentUser.id, 'UPDATE', 'user', userId);

      res.json(updatedUser);
    } catch (error) {
      console.error('User update error:', error);
      res.status(500).json({ message: 'User update failed' });
    }
  });

  app.delete('/api/users/:id', authenticateToken, requireRole(['admin']), setCurrentUser(), async (req: any, res) => {
    try {
      const userId = req.params.id;
      
      const success = await storage.deleteUser(userId);
      if (!success) {
        return res.status(404).json({ message: 'User not found' });
      }

      await logAudit(req.currentUser.id, 'DELETE', 'user', userId);

      res.json({ message: 'User deleted successfully' });
    } catch (error) {
      console.error('User deletion error:', error);
      res.status(500).json({ message: 'User deletion failed' });
    }
  });

  // Helper function to log audit
  const logAudit = async (userId: string, action: string, entityType: string, entityId?: string | number) => {
    try {
      // For temp users, create audit logs with null userId to avoid foreign key constraint
      await storage.createAuditLog({
        userId: userId.startsWith('temp_') ? null : userId,
        action,
        entityType,
        entityId: typeof entityId === 'number' ? entityId.toString() : entityId,
      });
    } catch (error) {
      console.error("Failed to log audit:", error);
    }
  };

  // Field routes
  app.get('/api/fields', authenticateToken, async (req: any, res) => {
    try {
      const fields = await storage.getAllFields();
      res.json(fields);
    } catch (error) {
      console.error("Error fetching fields:", error);
      res.status(500).json({ message: "Failed to fetch fields" });
    }
  });

  app.post('/api/fields', authenticateToken, requireRole(['admin']), setCurrentUser(), async (req: any, res) => {
    try {
      const validatedData = insertFieldSchema.parse(req.body);
      const field = await storage.createField(validatedData);
      
      await logAudit(req.currentUser.id, 'CREATE', 'field', field.id);
      
      res.status(201).json(field);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Error creating field:", error);
      res.status(500).json({ message: "Failed to create field" });
    }
  });

  app.delete('/api/fields/:id', authenticateToken, requireRole(['admin']), setCurrentUser(), async (req: any, res) => {
    try {
      const fieldId = parseInt(req.params.id);
      if (isNaN(fieldId)) {
        return res.status(400).json({ message: "Invalid field ID" });
      }
      
      const success = await storage.deleteField(fieldId);
      if (!success) {
        return res.status(404).json({ message: 'Field not found' });
      }

      await logAudit(req.currentUser.id, 'DELETE', 'field', fieldId);

      res.json({ message: 'Field deleted successfully' });
    } catch (error) {
      console.error('Field deletion error:', error);
      res.status(500).json({ message: 'Field deletion failed' });
    }
  });

  // Department routes
  app.get('/api/departments', authenticateToken, async (req: any, res) => {
    try {
      const departments = await storage.getAllDepartments();
      res.json(departments);
    } catch (error) {
      console.error("Error fetching departments:", error);
      res.status(500).json({ message: "Failed to fetch departments" });
    }
  });

  app.post('/api/departments', authenticateToken, requireRole(['admin']), setCurrentUser(), async (req: any, res) => {
    try {
      const validatedData = insertDepartmentSchema.parse(req.body);
      const department = await storage.createDepartment(validatedData);
      
      await logAudit(req.currentUser.id, 'CREATE', 'department', department.id);
      
      res.status(201).json(department);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Error creating department:", error);
      res.status(500).json({ message: "Failed to create department" });
    }
  });

  app.put('/api/departments/:id', authenticateToken, requireRole(['admin']), setCurrentUser(), async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = insertDepartmentSchema.partial().parse(req.body);
      
      const department = await storage.updateDepartment(id, validatedData);
      if (!department) {
        return res.status(404).json({ message: "Department not found" });
      }
      
      await logAudit(req.currentUser.id, 'UPDATE', 'department', department.id);
      
      res.json(department);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Error updating department:", error);
      res.status(500).json({ message: "Failed to update department" });
    }
  });

  app.delete('/api/departments/:id', authenticateToken, requireRole(['admin']), setCurrentUser(), async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteDepartment(id);
      
      if (!success) {
        return res.status(404).json({ message: "Department not found" });
      }
      
      await logAudit(req.currentUser.id, 'DELETE', 'department', id);
      
      res.json({ message: "Department deleted successfully" });
    } catch (error) {
      console.error("Error deleting department:", error);
      res.status(500).json({ message: "Failed to delete department" });
    }
  });

  // Department-Field Assignment routes
  app.get('/api/departments/:id/fields', authenticateToken, async (req: any, res) => {
    try {
      const departmentId = parseInt(req.params.id);
      const fields = await storage.getDepartmentFields(departmentId);
      res.json(fields);
    } catch (error) {
      console.error("Error fetching department fields:", error);
      res.status(500).json({ message: "Failed to fetch department fields" });
    }
  });

  app.put('/api/departments/:id/fields', authenticateToken, requireRole(['admin']), setCurrentUser(), async (req: any, res) => {
    try {
      const departmentId = parseInt(req.params.id);
      const { fieldIds } = req.body;
      
      if (!Array.isArray(fieldIds)) {
        return res.status(400).json({ message: "fieldIds must be an array" });
      }
      
      await storage.updateDepartmentFields(departmentId, fieldIds);
      
      await logAudit(req.currentUser.id, 'UPDATE', 'department_fields', departmentId);
      
      res.json({ message: "Department fields updated successfully" });
    } catch (error) {
      console.error("Error updating department fields:", error);
      res.status(500).json({ message: "Failed to update department fields" });
    }
  });

  // Courier routes
  app.get('/api/couriers', authenticateToken, setCurrentUser(), async (req: any, res) => {
    try {
      const { status, departmentId, search, limit = 10, offset = 0 } = req.query;
      const user = req.currentUser;
      
      const filters: any = {};
      if (status) filters.status = status;
      if (search) filters.search = search;
      if (limit) filters.limit = parseInt(limit);
      if (offset) filters.offset = parseInt(offset);
      
      // Apply department filtering based on user role
      if (user.role === 'admin') {
        // Admin can see all departments or filter by specific department
        if (departmentId) filters.departmentId = parseInt(departmentId);
      } else {
        // Non-admin users can only see their department's couriers
        filters.departmentId = user.departmentId;
      }
      
      const result = await storage.getAllCouriers(filters);
      res.json(result);
    } catch (error) {
      console.error("Error fetching couriers:", error);
      res.status(500).json({ message: "Failed to fetch couriers" });
    }
  });

  // Export routes - Must be before :id route to avoid route conflicts
  app.get('/api/couriers/export', authenticateToken, setCurrentUser(), async (req: any, res) => {
    try {
      const { startDate, endDate } = req.query;
      const user = req.currentUser;
      
      // Build filters based on user role
      const courierFilters: any = { 
        limit: 10000,
        startDate,
        endDate
      };
      
      const receivedFilters: any = {
        limit: 10000,
        startDate,
        endDate
      };
      
      // Non-admin users can only export their department's data
      if (user.role !== 'admin') {
        courierFilters.departmentId = user.departmentId;
        receivedFilters.departmentId = user.departmentId;
      }
      
      // Get sent couriers with date and department filtering
      const sentCouriers = await storage.getAllCouriers(courierFilters);
      
      // Get received couriers with date and department filtering
      const receivedCouriers = await storage.getAllReceivedCouriers(receivedFilters);
      
      // Create CSV content
      const headers = ['Type', 'POD No', 'To Branch / From Location', 'Email', 'Vendor', 'Date', 'Status', 'Details', 'Contact Details', 'Remarks', 'Department', 'Created By'];
      const csvRows = [headers.join(',')];
      
      // Add sent couriers
      sentCouriers.couriers.forEach(courier => {
        const row = [
          'Sent Courier',
          courier.podNo || '',
          courier.toBranch || '',
          courier.email || '',
          courier.vendor || '',
          courier.courierDate ? new Date(courier.courierDate).toLocaleDateString() : '',
          courier.status || '',
          courier.details || '',
          courier.contactDetails || '',
          courier.remarks || '',
          courier.department?.name || '',
          courier.creator?.name || ''
        ].map(field => `"${(field || '').toString().replace(/"/g, '""')}"`);
        csvRows.push(row.join(','));
      });
      
      // Add received couriers
      receivedCouriers.forEach(courier => {
        const row = [
          'Received Courier',
          courier.podNumber || '',
          courier.fromLocation || '',
          courier.emailId || '',
          courier.courierVendor || '',
          courier.receivedDate ? new Date(courier.receivedDate).toLocaleDateString() : '',
          'Received',
          '',
          '',
          courier.remarks || '',
          courier.department?.name || '',
          courier.creator?.name || ''
        ].map(field => `"${(field || '').toString().replace(/"/g, '""')}"`);
        csvRows.push(row.join(','));
      });
      
      const csvContent = csvRows.join('\n');
      
      const dateRange = startDate && endDate ? `_${startDate}_to_${endDate}` : '';
      const filename = `couriers-export${dateRange}.csv`;
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(csvContent);
    } catch (error) {
      console.error("Error exporting couriers:", error);
      res.status(500).json({ message: "Failed to export couriers" });
    }
  });

  app.get('/api/couriers/:id', authenticateToken, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid courier ID" });
      }
      const courier = await storage.getCourierById(id);
      
      if (!courier) {
        return res.status(404).json({ message: "Courier not found" });
      }
      
      res.json(courier);
    } catch (error) {
      console.error("Error fetching courier:", error);
      res.status(500).json({ message: "Failed to fetch courier" });
    }
  });

  app.post('/api/couriers', authenticateToken, upload.single('podCopy'), async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = req.user;
      
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      // Parse courier data
      const courierData = {
        ...req.body,
        createdBy: userId.startsWith('temp_') ? null : userId, // Handle temp users
        departmentId: user.departmentId || undefined,
      };

      // Handle file upload
      if (req.file) {
        const fileExtension = path.extname(req.file.originalname);
        const fileName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}${fileExtension}`;
        const filePath = path.join(uploadDir, fileName);
        
        fs.renameSync(req.file.path, filePath);
        courierData.podCopyPath = `/uploads/${fileName}`;
      }

      const validatedData = insertCourierSchema.parse(courierData);
      const courier = await storage.createCourier(validatedData);
      
      await logAudit(userId, 'CREATE', 'courier', courier.id);
      
      res.status(201).json(courier);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Error creating courier:", error);
      res.status(500).json({ message: "Failed to create courier" });
    }
  });

  app.patch('/api/couriers/:id', authenticateToken, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = req.user.id;
      const user = req.user;
      
      // Check if courier exists and user has permission
      const existingCourier = await storage.getCourierById(id);
      if (!existingCourier) {
        return res.status(404).json({ message: "Courier not found" });
      }

      // Check permissions
      if (user.role === 'user' && existingCourier.createdBy !== userId) {
        return res.status(403).json({ message: "You can only edit your own couriers" });
      }

      if (user.role === 'manager' && existingCourier.departmentId !== user.departmentId) {
        return res.status(403).json({ message: "You can only edit couriers in your department" });
      }

      const validatedData = insertCourierSchema.partial().parse(req.body);
      const courier = await storage.updateCourier(id, validatedData);
      
      await logAudit(userId, 'UPDATE', 'courier', id);
      
      res.json(courier);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Error updating courier:", error);
      res.status(500).json({ message: "Failed to update courier" });
    }
  });

  app.put('/api/couriers/:id', authenticateToken, upload.single('podCopy'), async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = req.user.id;
      const user = req.user;
      
      // Check if courier exists and user has permission
      const existingCourier = await storage.getCourierById(id);
      if (!existingCourier) {
        return res.status(404).json({ message: "Courier not found" });
      }

      // Check permissions
      if (user.role === 'user' && existingCourier.createdBy !== userId) {
        return res.status(403).json({ message: "You can only edit your own couriers" });
      }

      if (user.role === 'manager' && existingCourier.departmentId !== user.departmentId) {
        return res.status(403).json({ message: "You can only edit couriers in your department" });
      }

      const updateData = { ...req.body };

      // Handle file upload
      if (req.file) {
        const fileExtension = path.extname(req.file.originalname);
        const fileName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}${fileExtension}`;
        const filePath = path.join(uploadDir, fileName);
        
        fs.renameSync(req.file.path, filePath);
        updateData.podCopyPath = `/uploads/${fileName}`;
        
        // Delete old file if exists
        if (existingCourier.podCopyPath) {
          const oldFilePath = path.join(process.cwd(), existingCourier.podCopyPath);
          if (fs.existsSync(oldFilePath)) {
            fs.unlinkSync(oldFilePath);
          }
        }
      }

      const validatedData = insertCourierSchema.partial().parse(updateData);
      const courier = await storage.updateCourier(id, validatedData);
      
      await logAudit(userId, 'UPDATE', 'courier', id);
      
      res.json(courier);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Error updating courier:", error);
      res.status(500).json({ message: "Failed to update courier" });
    }
  });

  app.delete('/api/couriers/:id', authenticateToken, requireRole(['admin', 'manager']), setCurrentUser(), async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteCourier(id);
      
      if (!success) {
        return res.status(404).json({ message: "Courier not found" });
      }
      
      await logAudit(req.currentUser.id, 'DELETE', 'courier', id);
      
      res.json({ message: "Courier deleted successfully" });
    } catch (error) {
      console.error("Error deleting courier:", error);
      res.status(500).json({ message: "Failed to delete courier" });
    }
  });

  app.post('/api/couriers/:id/restore', authenticateToken, requireRole(['admin', 'manager']), setCurrentUser(), async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.restoreCourier(id);
      
      if (!success) {
        return res.status(404).json({ message: "Courier not found" });
      }
      
      await logAudit(req.currentUser.id, 'RESTORE', 'courier', id);
      
      res.json({ message: "Courier restored successfully" });
    } catch (error) {
      console.error("Error restoring courier:", error);
      res.status(500).json({ message: "Failed to restore courier" });
    }
  });

  // Statistics route
  app.get('/api/stats', authenticateToken, setCurrentUser(), async (req: any, res) => {
    try {
      const user = req.currentUser;
      let departmentId: number | undefined = undefined;
      
      // Non-admin users can only see their department's stats
      if (user.role !== 'admin') {
        departmentId = user.departmentId;
      }
      
      const stats = await storage.getCourierStats(departmentId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ message: "Failed to fetch statistics" });
    }
  });

  // Received Couriers endpoints
  app.get('/api/received-couriers', authenticateToken, setCurrentUser(), async (req: any, res) => {
    try {
      const { departmentId, search, limit = 50, offset = 0 } = req.query;
      const user = req.currentUser;
      
      const filters: any = {};
      if (search) filters.search = search;
      if (limit) filters.limit = parseInt(limit);
      if (offset) filters.offset = parseInt(offset);
      
      // Apply department filtering based on user role
      if (user.role === 'admin') {
        // Admin can see all departments or filter by specific department
        if (departmentId) filters.departmentId = parseInt(departmentId);
      } else {
        // Non-admin users can only see their department's received couriers
        filters.departmentId = user.departmentId;
      }
      
      const couriers = await storage.getAllReceivedCouriers(filters);
      res.json(couriers);
    } catch (error) {
      console.error("Error fetching received couriers:", error);
      res.status(500).json({ message: "Failed to fetch received couriers" });
    }
  });

  app.post('/api/received-couriers', authenticateToken, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = req.user;
      
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      // Parse received courier data
      const courierData = {
        ...req.body,
        createdBy: userId.startsWith('temp_') ? null : userId, // Handle temp users
        departmentId: user.departmentId || null,
      };

      const validatedData = insertReceivedCourierSchema.parse(courierData);
      const courier = await storage.createReceivedCourier(validatedData);
      
      await logAudit(userId, 'CREATE', 'received_courier', courier.id);
      
      res.status(201).json(courier);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Error creating received courier:", error);
      res.status(500).json({ message: "Failed to create received courier" });
    }
  });

  // Fields routes
  app.get('/api/fields', authenticateToken, requireRole(['admin']), async (req: any, res) => {
    try {
      const fields = await storage.getAllFields();
      res.json(fields);
    } catch (error) {
      console.error("Error fetching fields:", error);
      res.status(500).json({ message: "Failed to fetch fields" });
    }
  });

  app.post('/api/fields', authenticateToken, requireRole(['admin']), setCurrentUser(), async (req: any, res) => {
    try {
      const validatedData = insertFieldSchema.parse(req.body);
      const field = await storage.createField(validatedData);
      
      await logAudit(req.currentUser.id, 'CREATE', 'field', field.id);
      
      res.status(201).json(field);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Error creating field:", error);
      res.status(500).json({ message: "Failed to create field" });
    }
  });

  // SMTP settings routes
  app.get('/api/smtp-settings', authenticateToken, requireRole(['admin']), async (req: any, res) => {
    try {
      const settings = await storage.getSmtpSettings();
      res.json(settings || {});
    } catch (error) {
      console.error("Error fetching SMTP settings:", error);
      res.status(500).json({ message: "Failed to fetch SMTP settings" });
    }
  });

  app.put('/api/smtp-settings', authenticateToken, requireRole(['admin']), setCurrentUser(), async (req: any, res) => {
    try {
      const validatedData = insertSmtpSettingsSchema.parse(req.body);
      const settings = await storage.updateSmtpSettings(validatedData);
      
      await logAudit(req.currentUser.id, 'UPDATE', 'smtp_settings');
      
      res.json(settings);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Error updating SMTP settings:", error);
      res.status(500).json({ message: "Failed to update SMTP settings" });
    }
  });


  // Audit logs route
  app.get('/api/audit-logs', authenticateToken, requireRole(['admin']), async (req: any, res) => {
    try {
      const { limit = 50, offset = 0 } = req.query;
      const result = await storage.getAuditLogs(parseInt(limit), parseInt(offset));
      res.json(result);
    } catch (error) {
      console.error("Error fetching audit logs:", error);
      res.status(500).json({ message: "Failed to fetch audit logs" });
    }
  });

  // Audit logs export route
  app.get('/api/audit-logs/export', authenticateToken, requireRole(['admin']), setCurrentUser(), async (req: any, res) => {
    try {
      const { startDate, endDate } = req.query;
      const result = await storage.getAuditLogs(10000, 0, startDate, endDate);
      
      // Create CSV content
      const headers = ['Action', 'Entity Type', 'Entity ID', 'User Name', 'User Email', 'Date & Time'];
      const csvRows = [headers.join(',')];
      
      result.logs.forEach(log => {
        const row = [
          log.action || '',
          log.entityType || '',
          log.entityId || '',
          log.user?.name || 'Unknown',
          log.user?.email || '',
          log.timestamp ? new Date(log.timestamp).toLocaleString() : ''
        ].map(field => `"${(field || '').toString().replace(/"/g, '""')}"`);
        csvRows.push(row.join(','));
      });
      
      const csvContent = csvRows.join('\n');
      
      const dateRange = startDate && endDate ? `_${startDate}_to_${endDate}` : '';
      const filename = `audit-logs-export${dateRange}.csv`;
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(csvContent);
    } catch (error) {
      console.error("Error exporting audit logs:", error);
      res.status(500).json({ message: "Failed to export audit logs" });
    }
  });

  // Serve uploaded files
  app.get('/uploads/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(uploadDir, filename);
    
    if (fs.existsSync(filePath)) {
      res.sendFile(filePath);
    } else {
      res.status(404).json({ message: "File not found" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
