import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { authenticateToken, requireRole, hashPassword, comparePassword, generateToken } from "./auth";
import { insertCourierSchema, insertDepartmentSchema, insertFieldSchema, insertSmtpSettingsSchema, insertReceivedCourierSchema, insertAuthorityLetterTemplateSchema, insertAuthorityLetterFieldSchema, insertBranchSchema, insertUserPolicySchema, type InsertBranch } from "@shared/schema";
import { z } from "zod";
import multer from "multer";
import path from "path";
import fs from "fs";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { PDFGenerator } from "./pdf-generator";
import Papa from "papaparse";

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

// Document upload specifically for Word documents
const documentUpload = multer({
  dest: uploadDir,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /\.(doc|docx)$/i;
    const extname = allowedTypes.test(path.extname(file.originalname));
    const mimetype = file.mimetype === 'application/msword' || 
                     file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    
    if (mimetype || extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only Word documents (.doc, .docx) are allowed'));
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

  // Upload authority document for department
  app.post('/api/departments/upload-document', authenticateToken, requireRole(['admin']), documentUpload.single('document'), setCurrentUser(), async (req: any, res) => {
    try {
      const { departmentId } = req.body;
      const file = req.file;
      
      if (!file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      
      if (!departmentId) {
        return res.status(400).json({ message: "Department ID is required" });
      }

      // Create a proper filename with extension
      const originalExtension = path.extname(file.originalname);
      const newFilename = `authority_template_dept_${departmentId}_${Date.now()}${originalExtension}`;
      const newFilePath = path.join(uploadDir, newFilename);
      
      // Move file to new location with proper name
      fs.renameSync(file.path, newFilePath);
      
      // Update department with document path
      const department = await storage.updateDepartment(parseInt(departmentId), {
        authorityDocumentPath: newFilePath
      });
      
      if (!department) {
        return res.status(404).json({ message: "Department not found" });
      }
      
      await logAudit(req.currentUser.id, 'UPLOAD', 'authority_document', departmentId);
      
      res.json({ 
        message: "Document uploaded successfully",
        documentPath: newFilePath,
        department 
      });
    } catch (error) {
      console.error("Error uploading document:", error);
      res.status(500).json({ message: "Failed to upload document" });
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

  // Monthly trends route
  app.get('/api/stats/monthly', authenticateToken, setCurrentUser(), async (req: any, res) => {
    try {
      const user = req.currentUser;
      let departmentId: number | undefined = undefined;
      
      // Non-admin users can only see their department's stats
      if (user.role !== 'admin') {
        departmentId = user.departmentId;
      }
      
      const monthlyStats = await storage.getMonthlyStats(departmentId);
      res.json(monthlyStats);
    } catch (error) {
      console.error("Error fetching monthly stats:", error);
      res.status(500).json({ message: "Failed to fetch monthly statistics" });
    }
  });

  // Branches route
  // ============= BRANCH MANAGEMENT ROUTES =============
  
  app.get('/api/branches', authenticateToken, async (req: any, res) => {
    try {
      const { status, search, page = "1", limit = "50" } = req.query;
      const offset = (parseInt(page) - 1) * parseInt(limit);
      
      const filters = {
        status: status || undefined,
        search: search || undefined,
        limit: parseInt(limit),
        offset
      };
      
      const result = await storage.getAllBranches(filters);
      res.json(result);
    } catch (error) {
      console.error("Error fetching branches:", error);
      res.status(500).json({ message: "Failed to fetch branches" });
    }
  });

  app.get('/api/branches/:id', authenticateToken, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const branch = await storage.getBranchById(id);
      
      if (!branch) {
        return res.status(404).json({ message: "Branch not found" });
      }
      
      res.json(branch);
    } catch (error) {
      console.error("Error fetching branch:", error);
      res.status(500).json({ message: "Failed to fetch branch" });
    }
  });

  app.post('/api/branches', authenticateToken, requireRole(['admin']), setCurrentUser(), async (req: any, res) => {
    try {
      const validatedData = insertBranchSchema.parse(req.body);
      const branch = await storage.createBranch(validatedData);
      
      await logAudit(req.currentUser.id, 'CREATE', 'branch', branch.id);
      
      res.status(201).json(branch);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Error creating branch:", error);
      res.status(500).json({ message: "Failed to create branch" });
    }
  });

  app.put('/api/branches/:id', authenticateToken, requireRole(['admin']), setCurrentUser(), async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = insertBranchSchema.partial().parse(req.body);
      
      const branch = await storage.updateBranch(id, validatedData);
      if (!branch) {
        return res.status(404).json({ message: "Branch not found" });
      }
      
      await logAudit(req.currentUser.id, 'UPDATE', 'branch', branch.id);
      
      res.json(branch);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Error updating branch:", error);
      res.status(500).json({ message: "Failed to update branch" });
    }
  });

  app.delete('/api/branches/:id', authenticateToken, requireRole(['admin']), setCurrentUser(), async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteBranch(id);
      
      if (!success) {
        return res.status(404).json({ message: "Branch not found" });
      }
      
      await logAudit(req.currentUser.id, 'DELETE', 'branch', id);
      
      res.json({ message: "Branch deleted successfully" });
    } catch (error) {
      console.error("Error deleting branch:", error);
      res.status(500).json({ message: "Failed to delete branch" });
    }
  });

  app.patch('/api/branches/:id/status', authenticateToken, requireRole(['admin']), setCurrentUser(), async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const { status } = req.body;
      
      if (!['active', 'closed'].includes(status)) {
        return res.status(400).json({ message: "Status must be 'active' or 'closed'" });
      }
      
      const branch = await storage.updateBranchStatus(id, status);
      if (!branch) {
        return res.status(404).json({ message: "Branch not found" });
      }
      
      await logAudit(req.currentUser.id, 'UPDATE', 'branch', branch.id);
      
      res.json(branch);
    } catch (error) {
      console.error("Error updating branch status:", error);
      res.status(500).json({ message: "Failed to update branch status" });
    }
  });

  // Bulk upload branches from CSV
  app.post('/api/branches/bulk-upload', authenticateToken, requireRole(['admin']), setCurrentUser(), upload.single('csvFile'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "CSV file is required" });
      }

      const csvContent = req.file.buffer.toString('utf-8');
      const parsed = Papa.parse(csvContent, { 
        header: true, 
        skipEmptyLines: true,
        transformHeader: (header: string) => header.trim()
      });

      if (parsed.errors.length > 0) {
        return res.status(400).json({ 
          message: "CSV parsing error", 
          errors: parsed.errors 
        });
      }

      const branches: InsertBranch[] = [];
      const validationErrors: any[] = [];

      parsed.data.forEach((row: any, index: number) => {
        try {
          const branchData = insertBranchSchema.parse({
            srNo: row.srNo ? parseInt(row.srNo) : undefined,
            branchName: row.branchName?.trim(),
            branchCode: row.branchCode?.trim(),
            branchAddress: row.branchAddress?.trim(),
            pincode: row.pincode?.trim(),
            state: row.state?.trim(),
            latitude: row.latitude?.trim() || undefined,
            longitude: row.longitude?.trim() || undefined,
            status: row.status?.trim() || 'active'
          });
          branches.push(branchData);
        } catch (error) {
          if (error instanceof z.ZodError) {
            validationErrors.push({
              row: index + 1,
              errors: error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
            });
          }
        }
      });

      if (validationErrors.length > 0) {
        return res.status(400).json({
          message: "Validation errors in CSV data",
          errors: validationErrors
        });
      }

      if (branches.length === 0) {
        return res.status(400).json({ message: "No valid branch data found in CSV" });
      }

      const createdBranches = await storage.createBulkBranches(branches);
      
      await logAudit(req.currentUser.id, 'CREATE', 'branch', createdBranches.length);

      res.status(201).json({
        message: `Successfully created ${createdBranches.length} branches`,
        branches: createdBranches
      });
    } catch (error) {
      console.error("Error in bulk branch upload:", error);
      res.status(500).json({ message: "Failed to process bulk upload" });
    }
  });

  // Download sample CSV for branches
  app.get('/api/branches/sample-csv', authenticateToken, async (req: any, res) => {
    try {
      const sampleData = [
        {
          srNo: 1,
          branchName: 'Main Branch',
          branchCode: 'MB001',
          branchAddress: '123 Main Street, City Center',
          pincode: '110001',
          state: 'Delhi',
          latitude: '28.6139',
          longitude: '77.2090',
          status: 'active'
        },
        {
          srNo: 2,
          branchName: 'Secondary Branch',
          branchCode: 'SB002',
          branchAddress: '456 Market Street, Commercial Area',
          pincode: '110002',
          state: 'Delhi',
          latitude: '28.6304',
          longitude: '77.2177',
          status: 'active'
        }
      ];

      const csv = Papa.unparse(sampleData, {
        header: true
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="branch_sample.csv"');
      res.send(csv);
    } catch (error) {
      console.error("Error generating sample CSV:", error);
      res.status(500).json({ message: "Failed to generate sample CSV" });
    }
  });

  // Export branches (All, Active, or Closed)
  app.get('/api/branches/export', authenticateToken, requireRole(['admin', 'manager']), async (req: any, res) => {
    try {
      const { status } = req.query; // 'all', 'active', or 'closed'
      
      let filterStatus: string | undefined;
      if (status === 'active') filterStatus = 'active';
      if (status === 'closed') filterStatus = 'closed';
      // if status === 'all' or undefined, filterStatus remains undefined (gets all)
      
      const branches = await storage.exportBranches(filterStatus);
      
      const csvData = branches.map(branch => ({
        'Sr. No': branch.srNo || '',
        'Branch Name': branch.branchName,
        'Branch Code': branch.branchCode,
        'Branch Address': branch.branchAddress,
        'Pincode': branch.pincode,
        'State': branch.state,
        'Latitude': branch.latitude || '',
        'Longitude': branch.longitude || '',
        'Status': branch.status,
        'Created Date': branch.createdAt ? new Date(branch.createdAt).toLocaleDateString() : ''
      }));

      const csv = Papa.unparse(csvData, { header: true });
      
      const filename = status === 'all' || !status 
        ? 'all_branches.csv' 
        : `${status}_branches.csv`;
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(csv);
    } catch (error) {
      console.error("Error exporting branches:", error);
      res.status(500).json({ message: "Failed to export branches" });
    }
  });

  // Legacy branch stats route for backward compatibility
  app.get('/api/branch-stats', authenticateToken, setCurrentUser(), async (req: any, res) => {
    try {
      const user = req.currentUser;
      let departmentId: number | undefined = undefined;
      
      // Non-admin users can only see their department's branches
      if (user.role !== 'admin') {
        departmentId = user.departmentId;
      }
      
      const branches = await storage.getBranchStats(departmentId);
      res.json(branches);
    } catch (error) {
      console.error("Error fetching branch stats:", error);
      res.status(500).json({ message: "Failed to fetch branch stats" });
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

  // User Policy routes
  app.get('/api/user-policies', authenticateToken, requireRole(['admin']), async (req: any, res) => {
    try {
      const policies = await storage.getAllUserPolicies();
      res.json(policies);
    } catch (error) {
      console.error("Error fetching user policies:", error);
      res.status(500).json({ message: "Failed to fetch user policies" });
    }
  });

  app.post('/api/user-policies', authenticateToken, requireRole(['admin']), setCurrentUser(), async (req: any, res) => {
    try {
      const validatedData = insertUserPolicySchema.parse(req.body);
      const policy = await storage.createOrUpdateUserPolicy(validatedData);
      
      await logAudit(req.currentUser.id, 'UPDATE', 'user_policy', `${policy.departmentId}-${policy.tabName}`);
      
      res.status(201).json(policy);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Error creating/updating user policy:", error);
      res.status(500).json({ message: "Failed to create/update user policy" });
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

  // Authority Letter Template routes
  app.get('/api/authority-letter-templates', authenticateToken, setCurrentUser(), async (req: any, res) => {
    try {
      const user = req.currentUser;
      let departmentId: number | undefined = undefined;
      
      // Non-admin users can only see their department's templates
      if (user.role !== 'admin') {
        departmentId = user.departmentId;
      }
      
      const templates = await storage.getAllAuthorityLetterTemplates(departmentId);
      res.json(templates);
    } catch (error) {
      console.error("Error fetching authority letter templates:", error);
      res.status(500).json({ message: "Failed to fetch templates" });
    }
  });

  app.post('/api/authority-letter-templates', authenticateToken, requireRole(['admin']), setCurrentUser(), async (req: any, res) => {
    try {
      const validatedData = insertAuthorityLetterTemplateSchema.parse(req.body);
      const template = await storage.createAuthorityLetterTemplate(validatedData);
      
      await logAudit(req.currentUser.id, 'CREATE', 'authority_letter_template', template.id);
      
      res.status(201).json(template);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Error creating authority letter template:", error);
      res.status(500).json({ message: "Failed to create template" });
    }
  });

  app.put('/api/authority-letter-templates/:id', authenticateToken, requireRole(['admin']), setCurrentUser(), async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = insertAuthorityLetterTemplateSchema.partial().parse(req.body);
      
      const template = await storage.updateAuthorityLetterTemplate(id, validatedData);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }
      
      await logAudit(req.currentUser.id, 'UPDATE', 'authority_letter_template', template.id);
      
      res.json(template);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Error updating authority letter template:", error);
      res.status(500).json({ message: "Failed to update template" });
    }
  });

  app.delete('/api/authority-letter-templates/:id', authenticateToken, requireRole(['admin']), setCurrentUser(), async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteAuthorityLetterTemplate(id);
      
      if (!success) {
        return res.status(404).json({ message: "Template not found" });
      }
      
      await logAudit(req.currentUser.id, 'DELETE', 'authority_letter_template', id);
      
      res.json({ message: "Template deleted successfully" });
    } catch (error) {
      console.error("Error deleting authority letter template:", error);
      res.status(500).json({ message: "Failed to delete template" });
    }
  });

  // Authority Letter Field routes
  app.get('/api/authority-letter-fields', authenticateToken, setCurrentUser(), async (req: any, res) => {
    try {
      const user = req.currentUser;
      let departmentId: number | undefined = undefined;
      
      // Handle department filtering from query parameter
      const queryDepartmentId = req.query.departmentId;
      if (queryDepartmentId) {
        departmentId = parseInt(queryDepartmentId);
      } else if (user.role !== 'admin') {
        // Non-admin users can only see their department's fields
        departmentId = user.departmentId;
      }
      
      const fields = await storage.getAllAuthorityLetterFields(departmentId);
      res.json(fields);
    } catch (error) {
      console.error("Error fetching authority letter fields:", error);
      res.status(500).json({ message: "Failed to fetch fields" });
    }
  });

  app.post('/api/authority-letter-fields', authenticateToken, requireRole(['admin']), setCurrentUser(), async (req: any, res) => {
    try {
      const validatedData = insertAuthorityLetterFieldSchema.parse(req.body);
      const field = await storage.createAuthorityLetterField(validatedData);
      
      await logAudit(req.currentUser.id, 'CREATE', 'authority_letter_field', field.id);
      
      res.status(201).json(field);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Error creating authority letter field:", error);
      res.status(500).json({ message: "Failed to create field" });
    }
  });

  // Delete authority letter field
  app.delete('/api/authority-letter-fields/:id', authenticateToken, requireRole(['admin']), setCurrentUser(), async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteAuthorityLetterField(id);
      
      if (!success) {
        return res.status(404).json({ message: "Field not found" });
      }
      
      await logAudit(req.currentUser.id, 'DELETE', 'authority_letter_field', id);
      
      res.json({ message: "Field deleted successfully" });
    } catch (error) {
      console.error("Error deleting authority letter field:", error);
      res.status(500).json({ message: "Failed to delete field" });
    }
  });

  // Authority Letter Preview from Department Word Document
  app.post('/api/authority-letter/preview-from-department', authenticateToken, setCurrentUser(), async (req: any, res) => {
    try {
      const { departmentId, fieldValues } = req.body;
      const user = req.currentUser;
      
      // Get department
      const departments = await storage.getAllDepartments();
      const department = departments.find(d => d.id === departmentId);
      if (!department) {
        return res.status(404).json({ message: "Department not found" });
      }
      
      // Check if user has access to this department
      if (user.role !== 'admin' && user.departmentId !== departmentId) {
        return res.status(403).json({ message: "Access denied to this department" });
      }
      
      // Get department's custom fields
      const fields = await storage.getAllAuthorityLetterFields(departmentId);
      
      // Helper function to apply text transformations
      const applyTextTransform = (text: string, transform: string): string => {
        switch (transform) {
          case 'uppercase':
            return text.toUpperCase();
          case 'capitalize':
            return text.split(' ').map(word => 
              word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
            ).join(' ');
          case 'toggle':
            return text.split('').map(char => 
              char === char.toUpperCase() ? char.toLowerCase() : char.toUpperCase()
            ).join('');
          default:
            return text;
        }
      };

      // Generate preview content that matches the actual letter format
      let dateValue = fieldValues['Currunt Date'] || '##Currunt Date##';
      if (fieldValues['Currunt Date'] && typeof fieldValues['Currunt Date'] === 'string' && fieldValues['Currunt Date'].match(/^\\d{4}-\\d{2}-\\d{2}$/)) {
        const [year, month, day] = fieldValues['Currunt Date'].split('-');
        dateValue = `${day}-${month}-${year}`;
      }
      
      // Apply text transform to address field
      const addressField = fields.find(f => f.fieldName === 'Address');
      let addressValue = fieldValues['Address'] || '##Address##';
      if (addressField?.textTransform && fieldValues['Address']) {
        addressValue = applyTextTransform(fieldValues['Address'], addressField.textTransform);
      }
      
      // Apply text transform to asset name field
      const assetNameField = fields.find(f => f.fieldName === 'Asset Name');
      let assetNameValue = fieldValues['Asset Name'] || '##Asset Name##';
      if (assetNameField?.textTransform && fieldValues['Asset Name']) {
        assetNameValue = applyTextTransform(fieldValues['Asset Name'], assetNameField.textTransform);
      } else if (fieldValues['Asset Name']) {
        assetNameValue = fieldValues['Asset Name'].toUpperCase(); // Default behavior for Asset Name
      }
      
      // Apply text transform to value field
      const valueField = fields.find(f => f.fieldName === 'Value');
      let valueValue = fieldValues['Value'] || '##Value##';
      if (valueField?.textTransform && fieldValues['Value']) {
        valueValue = applyTextTransform(fieldValues['Value'], valueField.textTransform);
      }
      
      let previewContent = `AUTHORITY LETTER

${dateValue}

To,

Maruti Courier

UF-16, Sanskar-1 Complex

Nr Ketav Petrol Pump

Polytechnic Road Ambawadi

Ahmedabad -380015



SUB- LETTER AUTHORISING M/S MARUTI COURIER

Dear Sir/Ma'am,

We hereby authorize M/s. Maruti Courier to provide the services of transporting the System of Light Microfinance Pvt. Ltd. from Head Office Ahmedabad to its branch office Light Microfinance "${addressValue}" said authority is only for transporting the computer system to the above-mentioned branch address and not any other purpose.



*NOTE: - NOT FOR SALE THIS ${assetNameValue} ARE FOR ONLY OFFICE USE. (Asset Value ${valueValue} /-)



Thanking you,



FOR LIGHT MICROFINANCE PVT. LTD



_____________________________

Jigar Jodhani

[Manager - IT]`;
      
      res.json({
        content: previewContent,
        departmentName: department.name,
        generatedAt: new Date().toISOString(),
        isPreview: true
      });
    } catch (error) {
      console.error("Error generating authority letter preview:", error);
      res.status(500).json({ message: "Failed to generate preview" });
    }
  });

  // Authority Letter PDF Generation from Department Template
  app.post('/api/authority-letter/generate-pdf-from-department', authenticateToken, setCurrentUser(), async (req: any, res) => {
    try {
      const { departmentId, fieldValues, fileName } = req.body;
      const user = req.currentUser;
      
      // Get department
      const departments = await storage.getAllDepartments();
      const department = departments.find(d => d.id === departmentId);
      if (!department) {
        return res.status(404).json({ message: "Department not found" });
      }
      
      // Check if user has access to this department
      if (user.role !== 'admin' && user.departmentId !== departmentId) {
        return res.status(403).json({ message: "Access denied to this department" });
      }
      
      // Check if department has uploaded document
      if (!department.authorityDocumentPath) {
        return res.status(400).json({ message: "No authority document uploaded for this department" });
      }
      
      // Get department's custom fields for text transformations
      const fields = await storage.getAllAuthorityLetterFields(departmentId);
      
      // Create a basic HTML template from the hardcoded format (we'll improve this later)
      const htmlTemplate = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Authority Letter</title>
    <style>
        body {
            font-family: 'Times New Roman', serif;
            font-size: 14px;
            line-height: 1.6;
            margin: 30px;
            max-width: 800px;
            color: #000;
        }
        .header {
            text-align: center;
            font-weight: bold;
            font-size: 18px;
            margin-bottom: 30px;
        }
        .date {
            text-align: right;
            margin-bottom: 30px;
        }
        .subject {
            font-weight: bold;
            margin: 20px 0;
            text-decoration: underline;
        }
        .content {
            margin-bottom: 30px;
            text-align: justify;
        }
        .note {
            font-weight: bold;
            margin: 20px 0;
        }
        .signature {
            margin-top: 40px;
        }
    </style>
</head>
<body>
    <div class="date">
        Date: ##Currunt Date##
    </div>
    
    <div class="header">
        SUB- LETTER AUTHORISING M/S MARUTI COURIER
    </div>
    
    <div class="content">
        <p>Dear Sir/Ma'am,</p>
        
        <p>We hereby authorize M/s. Maruti Courier to provide the services of transporting the System of Light Microfinance Pvt. Ltd. from Head Office Ahmedabad to its branch office Light Microfinance "##Address##" said authority is only for transporting the computer system to the above-mentioned branch address and not any other purpose.</p>
        
        <div class="note">
            *NOTE: - NOT FOR SALE THIS ##Asset Name## ARE FOR ONLY OFFICE USE. (Asset Value ##Value## /-)
        </div>
        
        <p>Thanking you,</p>
        
        <div class="signature">
            <p>FOR LIGHT MICROFINANCE PVT. LTD</p>
            <br><br>
            <p>_____________________________</p>
            <p>Jigar Jodhani</p>
            <p>[Manager - IT]</p>
        </div>
    </div>
</body>
</html>`;

      // Apply field transformations
      const processedValues: Record<string, any> = {};
      Object.entries(fieldValues || {}).forEach(([key, value]) => {
        const field = fields.find(f => f.fieldName === key);
        let processedValue = value as string;
        
        if (field?.textTransform && processedValue) {
          switch (field.textTransform) {
            case 'uppercase':
              processedValue = processedValue.toUpperCase();
              break;
            case 'capitalize':
              processedValue = processedValue.split(' ').map(word => 
                word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
              ).join(' ');
              break;
            case 'toggle':
              processedValue = processedValue.split('').map(char => 
                char === char.toUpperCase() ? char.toLowerCase() : char.toUpperCase()
              ).join('');
              break;
          }
        }
        
        processedValues[key] = processedValue;
      });

      // Generate PDF using the PDFGenerator
      const pdfBuffer = await PDFGenerator.generatePDF({
        templateContent: htmlTemplate,
        fieldValues: processedValues,
        fileName: fileName || `authority_letter_${department.name}_${Date.now()}.pdf`
      });
      
      await logAudit(user.id, 'CREATE', 'authority_letter_pdf_dept', department.id.toString());
      
      // Set headers for PDF download
      const finalFileName = fileName?.endsWith('.pdf') ? fileName : `${fileName || 'authority_letter'}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${finalFileName}"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      
      res.send(pdfBuffer);
    } catch (error) {
      console.error("Error generating PDF from department:", error);
      res.status(500).json({ message: "Failed to generate PDF" });
    }
  });

  // Bulk PDF Generation from Department Template
  app.post('/api/authority-letter/bulk-generate-from-department', authenticateToken, setCurrentUser(), multer().single('csvFile'), async (req: any, res) => {
    try {
      const { departmentId } = req.body;
      const user = req.currentUser;
      
      if (!req.file) {
        return res.status(400).json({ message: "CSV file is required" });
      }
      
      // Get department
      const departments = await storage.getAllDepartments();
      const department = departments.find(d => d.id === parseInt(departmentId));
      if (!department) {
        return res.status(404).json({ message: "Department not found" });
      }
      
      // Check access
      if (user.role !== 'admin' && department.id !== user.departmentId) {
        return res.status(403).json({ message: "Access denied to this department" });
      }
      
      // Parse CSV
      const csvContent = req.file.buffer.toString('utf8');
      const parsedData = Papa.parse(csvContent, { header: true, skipEmptyLines: true });
      
      if (parsedData.errors.length > 0) {
        return res.status(400).json({ message: "CSV parsing error", errors: parsedData.errors });
      }
      
      // Use the same HTML template
      const htmlTemplate = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Authority Letter</title>
    <style>
        body {
            font-family: 'Times New Roman', serif;
            font-size: 14px;
            line-height: 1.6;
            margin: 30px;
            max-width: 800px;
            color: #000;
        }
        .header {
            text-align: center;
            font-weight: bold;
            font-size: 18px;
            margin-bottom: 30px;
        }
        .date {
            text-align: right;
            margin-bottom: 30px;
        }
        .subject {
            font-weight: bold;
            margin: 20px 0;
            text-decoration: underline;
        }
        .content {
            margin-bottom: 30px;
            text-align: justify;
        }
        .note {
            font-weight: bold;
            margin: 20px 0;
        }
        .signature {
            margin-top: 40px;
        }
    </style>
</head>
<body>
    <div class="date">
        Date: ##Currunt Date##
    </div>
    
    <div class="header">
        SUB- LETTER AUTHORISING M/S MARUTI COURIER
    </div>
    
    <div class="content">
        <p>Dear Sir/Ma'am,</p>
        
        <p>We hereby authorize M/s. Maruti Courier to provide the services of transporting the System of Light Microfinance Pvt. Ltd. from Head Office Ahmedabad to its branch office Light Microfinance "##Address##" said authority is only for transporting the computer system to the above-mentioned branch address and not any other purpose.</p>
        
        <div class="note">
            *NOTE: - NOT FOR SALE THIS ##Asset Name## ARE FOR ONLY OFFICE USE. (Asset Value ##Value## /-)
        </div>
        
        <p>Thanking you,</p>
        
        <div class="signature">
            <p>FOR LIGHT MICROFINANCE PVT. LTD</p>
            <br><br>
            <p>_____________________________</p>
            <p>Jigar Jodhani</p>
            <p>[Manager - IT]</p>
        </div>
    </div>
</body>
</html>`;
      
      // Generate bulk PDFs
      const results = await PDFGenerator.generateBulkPDFs(
        htmlTemplate,
        parsedData.data as Array<Record<string, any>>,
        {} // Field mappings - let PDFGenerator handle direct mapping
      );
      
      if (results.length === 0) {
        return res.status(400).json({ message: "No PDFs could be generated" });
      }
      
      // Create a ZIP file with all PDFs
      const JSZip = await import('jszip').then(m => m.default);
      const zip = new JSZip();
      
      results.forEach((result, index) => {
        zip.file(result.fileName, result.data);
      });
      
      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
      
      await logAudit(user.id, 'CREATE', 'bulk_authority_letters_dept', `${results.length} PDFs for dept ${department.id}`);
      
      // Send ZIP file
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="authority_letters_${department.name}_bulk_${Date.now()}.zip"`);
      res.setHeader('Content-Length', zipBuffer.length);
      
      res.send(zipBuffer);
    } catch (error) {
      console.error("Error in bulk generation from department:", error);
      res.status(500).json({ message: "Failed to generate bulk PDFs" });
    }
  });

  // Authority Letter Generation from Department Word Document (keep original for backwards compatibility)
  app.post('/api/authority-letter/generate-from-department', authenticateToken, setCurrentUser(), async (req: any, res) => {
    try {
      const { departmentId, fieldValues } = req.body;
      const user = req.currentUser;
      
      // Get department
      const departments = await storage.getAllDepartments();
      const department = departments.find(d => d.id === departmentId);
      if (!department) {
        return res.status(404).json({ message: "Department not found" });
      }
      
      // Check if department has uploaded document
      if (!department.authorityDocumentPath) {
        return res.status(400).json({ message: "No authority document uploaded for this department" });
      }
      
      // Check if user has access to this department
      if (user.role !== 'admin' && user.departmentId !== departmentId) {
        return res.status(403).json({ message: "Access denied to this department" });
      }
      
      // Get department's custom fields
      const fields = await storage.getAllAuthorityLetterFields(departmentId);
      
      // Read the uploaded Word document template
      const documentPath = department.authorityDocumentPath;
      if (!fs.existsSync(documentPath)) {
        return res.status(404).json({ message: "Authority document file not found" });
      }
      
      try {
        // Read the Word document
        const content = fs.readFileSync(documentPath, 'binary');
        const zip = new PizZip(content);
        const doc = new Docxtemplater(zip, {
          paragraphLoop: true,
          linebreaks: true,
        });
        
        // Prepare data for template replacement
        const templateData: any = {
          currentDate: new Date().toLocaleDateString('en-GB'), // DD/MM/YYYY format
          departmentName: department.name,
          generatedAt: new Date().toISOString()
        };
        
        // Add field values with proper mapping
        console.log('Field values received:', fieldValues);
        console.log('Available fields in DB:', fields.map(f => ({ name: f.fieldName, label: f.fieldLabel })));
        
        for (const [fieldName, value] of Object.entries(fieldValues || {})) {
          templateData[fieldName] = value;
          console.log(`Mapping ${fieldName} = ${value}`);
        }
        
        // Read the document content and manually replace ##field## placeholders
        const docText = doc.getFullText();
        console.log('Original document contains:', docText.substring(0, 200));
        
        // Replace ##field## placeholders manually
        let updatedText = docText;
        
        // Helper function to apply text transformations
        const applyTextTransform = (text: string, transform: string): string => {
          switch (transform) {
            case 'uppercase':
              return text.toUpperCase();
            case 'capitalize':
              return text.split(' ').map(word => 
                word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
              ).join(' ');
            case 'toggle':
              return text.split('').map(char => 
                char === char.toUpperCase() ? char.toLowerCase() : char.toUpperCase()
              ).join('');
            default:
              return text;
          }
        };
        
        // Replace field placeholders
        for (const [fieldName, value] of Object.entries(fieldValues || {})) {
          let processedValue = value as string;
          
          // Convert date format from YYYY-MM-DD to DD-MM-YYYY for date fields
          if (fieldName.toLowerCase().includes('date') && typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}$/)) {
            const [year, month, day] = value.split('-');
            processedValue = `${day}-${month}-${year}`;
            console.log(`Converted date from ${value} to ${processedValue}`);
          } else {
            // Apply text transformation based on field settings
            const field = fields.find(f => f.fieldName === fieldName);
            if (field?.textTransform && field.textTransform !== 'none') {
              processedValue = applyTextTransform(processedValue, field.textTransform);
              console.log(`Applied ${field.textTransform} transform to ${fieldName}: ${value} -> ${processedValue}`);
            }
          }
          
          const placeholder = `##${fieldName}##`;
          const regex = new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
          updatedText = updatedText.replace(regex, processedValue);
          console.log(`Replaced ${placeholder} with ${processedValue}`);
        }
        
        // Replace current date placeholder if it exists
        updatedText = updatedText.replace(/##Current Date##/g, new Date().toLocaleDateString('en-GB'));
        updatedText = updatedText.replace(/##currentDate##/g, new Date().toLocaleDateString('en-GB'));
        
        console.log('Updated text preview:', updatedText.substring(0, 300));
        
        // Since we can't easily modify the Word document text directly,
        // let's try using docxtemplater's standard format by converting ##field## to {field}
        const xmlContent = zip.files['word/document.xml'].asText();
        let modifiedXmlContent = xmlContent;
        
        // Replace ##field## with {field} format for docxtemplater
        for (const [fieldName, value] of Object.entries(fieldValues || {})) {
          let processedValue = value as string;
          
          // Convert date format from YYYY-MM-DD to DD-MM-YYYY for date fields
          if (fieldName.toLowerCase().includes('date') && typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}$/)) {
            const [year, month, day] = value.split('-');
            processedValue = `${day}-${month}-${year}`;
          } else {
            // Apply text transformation based on field settings
            const field = fields.find(f => f.fieldName === fieldName);
            if (field?.textTransform && field.textTransform !== 'none') {
              processedValue = applyTextTransform(processedValue, field.textTransform);
              console.log(`Applied ${field.textTransform} transform to ${fieldName}: ${value} -> ${processedValue}`);
            }
          }
          
          templateData[fieldName] = processedValue; // Update template data with converted value
          
          const oldPlaceholder = `##${fieldName}##`;
          const newPlaceholder = `{${fieldName}}`;
          modifiedXmlContent = modifiedXmlContent.replace(new RegExp(oldPlaceholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), newPlaceholder);
        }
        
        // Update the zip with modified content
        zip.file('word/document.xml', modifiedXmlContent);
        
        // Create new docxtemplater with updated content
        const newDoc = new Docxtemplater(zip, {
          paragraphLoop: true,
          linebreaks: true,
        });
        
        console.log('Template data for rendering:', templateData);
        newDoc.render(templateData);
        
        // Generate the final document
        const output = newDoc.getZip().generate({
          type: 'nodebuffer',
          compression: 'DEFLATE',
        });
        
        // Create filename for the generated document
        const filename = `authority-letter-${department.name.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.docx`;
        
        await logAudit(user.id, 'CREATE', 'authority_letter_generated', departmentId);
        
        // Set response headers for Word document download
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', output.length);
        
        // Send the Word document
        res.send(output);
        
      } catch (docError) {
        console.error("Error processing Word document:", docError);
        
        // Fallback to text-based generation if Word processing fails
        let textContent = `AUTHORITY LETTER\n\nGenerated on: ${new Date().toLocaleDateString()}\nDepartment: ${department.name}\n\n`;
        
        // Add field values
        for (const [fieldName, value] of Object.entries(fieldValues || {})) {
          const field = fields.find(f => f.fieldName === fieldName);
          if (field) {
            textContent += `${field.fieldLabel}: ${value}\n`;
          }
        }
        
        textContent += `\nThis authority letter was generated from ${department.name} department's uploaded Word document template.\n`;
        textContent += `Note: Word document processing failed, showing text version. Please check template format.\n`;
        
        await logAudit(user.id, 'CREATE', 'authority_letter_generated', departmentId);
        
        res.json({
          content: textContent,
          departmentName: department.name,
          generatedAt: new Date().toISOString(),
          isTextFallback: true
        });
      }
    } catch (error) {
      console.error("Error generating authority letter from department:", error);
      res.status(500).json({ message: "Failed to generate authority letter" });
    }
  });

  // Legacy Authority Letter Generation route (keeping for backward compatibility)
  app.post('/api/authority-letter/generate', authenticateToken, setCurrentUser(), async (req: any, res) => {
    try {
      const { templateId, fieldValues } = req.body;
      const user = req.currentUser;
      
      const template = await storage.getAuthorityLetterTemplate(templateId);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }
      
      // Check if user has access to this department's template
      if (user.role !== 'admin' && template.departmentId !== user.departmentId) {
        return res.status(403).json({ message: "Access denied to this template" });
      }
      
      // Replace placeholders in template content
      let content = template.templateContent;
      
      // Replace ##field## placeholders with actual values
      for (const [fieldName, value] of Object.entries(fieldValues || {})) {
        const placeholder = `##${fieldName}##`;
        content = content.replace(new RegExp(placeholder, 'g'), value as string);
      }
      
      // Add current date
      content = content.replace(/##Current Date##/g, new Date().toLocaleDateString());
      
      await logAudit(user.id, 'CREATE', 'authority_letter_generated', templateId);
      
      res.json({
        content,
        templateName: template.templateName,
        generatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error generating authority letter:", error);
      res.status(500).json({ message: "Failed to generate authority letter" });
    }
  });

  // ===== NEW PDF-BASED AUTHORITY LETTER SYSTEM =====

  // Get all templates for a department
  app.get('/api/authority-templates/:departmentId', authenticateToken, setCurrentUser(), async (req: any, res) => {
    try {
      const departmentId = parseInt(req.params.departmentId);
      const user = req.currentUser;
      
      // Check access
      if (user.role !== 'admin' && user.departmentId !== departmentId) {
        return res.status(403).json({ message: "Access denied to this department" });
      }
      
      const templates = await storage.getAllAuthorityLetterTemplates(departmentId);
      res.json(templates);
    } catch (error) {
      console.error("Error fetching authority templates:", error);
      res.status(500).json({ message: "Failed to fetch templates" });
    }
  });

  // Create new template
  app.post('/api/authority-templates', authenticateToken, requireRole(['admin']), async (req: any, res) => {
    try {
      const templateData = insertAuthorityLetterTemplateSchema.parse(req.body);
      const user = req.currentUser;
      
      // If setting as default, unset other defaults in the same department
      if (templateData.isDefault && templateData.departmentId) {
        const existingTemplates = await storage.getAllAuthorityLetterTemplates(templateData.departmentId);
        for (const template of existingTemplates) {
          if (template.isDefault) {
            await storage.updateAuthorityLetterTemplate(template.id, { isDefault: false });
          }
        }
      }
      
      const newTemplate = await storage.createAuthorityLetterTemplate(templateData);
      await logAudit(user.id, 'CREATE', 'authority_template', newTemplate.id.toString());
      
      res.status(201).json(newTemplate);
    } catch (error) {
      console.error("Error creating authority template:", error);
      res.status(500).json({ message: "Failed to create template" });
    }
  });

  // Update template
  app.put('/api/authority-templates/:id', authenticateToken, requireRole(['admin']), async (req: any, res) => {
    try {
      const templateId = parseInt(req.params.id);
      const updateData = req.body;
      const user = req.currentUser;
      
      // If setting as default, unset other defaults in the same department
      if (updateData.isDefault) {
        const template = await storage.getAuthorityLetterTemplate(templateId);
        if (template && template.departmentId) {
          const existingTemplates = await storage.getAllAuthorityLetterTemplates(template.departmentId);
          for (const existingTemplate of existingTemplates) {
            if (existingTemplate.isDefault && existingTemplate.id !== templateId) {
              await storage.updateAuthorityLetterTemplate(existingTemplate.id, { isDefault: false });
            }
          }
        }
      }
      
      const updatedTemplate = await storage.updateAuthorityLetterTemplate(templateId, updateData);
      if (!updatedTemplate) {
        return res.status(404).json({ message: "Template not found" });
      }
      
      await logAudit(user.id, 'UPDATE', 'authority_template', templateId.toString());
      res.json(updatedTemplate);
    } catch (error) {
      console.error("Error updating authority template:", error);
      res.status(500).json({ message: "Failed to update template" });
    }
  });

  // Delete template
  app.delete('/api/authority-templates/:id', authenticateToken, requireRole(['admin']), async (req: any, res) => {
    try {
      const templateId = parseInt(req.params.id);
      const user = req.currentUser;
      
      const deleted = await storage.deleteAuthorityLetterTemplate(templateId);
      if (!deleted) {
        return res.status(404).json({ message: "Template not found" });
      }
      
      await logAudit(user.id, 'DELETE', 'authority_template', templateId.toString());
      res.json({ message: "Template deleted successfully" });
    } catch (error) {
      console.error("Error deleting authority template:", error);
      res.status(500).json({ message: "Failed to delete template" });
    }
  });

  // Generate PDF authority letter
  app.post('/api/authority-letter/generate-pdf', authenticateToken, setCurrentUser(), async (req: any, res) => {
    try {
      const { templateId, fieldValues } = req.body;
      const user = req.currentUser;
      
      // Get template
      const template = await storage.getAuthorityLetterTemplate(templateId);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }
      
      // Check access
      if (user.role !== 'admin' && template.departmentId !== user.departmentId) {
        return res.status(403).json({ message: "Access denied to this template" });
      }
      
      // Generate PDF
      const pdfBuffer = await PDFGenerator.generatePDF({
        templateContent: template.templateContent,
        fieldValues,
        fileName: `authority_letter_${Date.now()}.pdf`
      });
      
      await logAudit(user.id, 'CREATE', 'authority_letter_pdf', template.id.toString());
      
      // Set headers for PDF download
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="authority_letter_${template.templateName}_${Date.now()}.pdf"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      
      res.send(pdfBuffer);
    } catch (error) {
      console.error("Error generating PDF:", error);
      res.status(500).json({ message: "Failed to generate PDF" });
    }
  });

  // Preview authority letter (HTML)
  app.post('/api/authority-letter/preview-pdf', authenticateToken, setCurrentUser(), async (req: any, res) => {
    try {
      const { templateId, fieldValues } = req.body;
      const user = req.currentUser;
      
      // Get template
      const template = await storage.getAuthorityLetterTemplate(templateId);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }
      
      // Check access
      if (user.role !== 'admin' && template.departmentId !== user.departmentId) {
        return res.status(403).json({ message: "Access denied to this template" });
      }
      
      // Replace placeholders for preview
      let htmlContent = template.templateContent;
      
      // Replace ##field## placeholders
      Object.entries(fieldValues || {}).forEach(([key, value]) => {
        const placeholder = `##${key}##`;
        htmlContent = htmlContent.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value as string || '');
      });
      
      // Add current date
      const currentDate = new Date().toLocaleDateString('en-GB');
      htmlContent = htmlContent.replace(/##currentDate##/g, currentDate);
      htmlContent = htmlContent.replace(/##current_date##/g, currentDate);
      
      res.json({
        htmlContent,
        templateName: template.templateName
      });
    } catch (error) {
      console.error("Error generating preview:", error);
      res.status(500).json({ message: "Failed to generate preview" });
    }
  });

  // Generate sample CSV for bulk operations
  app.get('/api/authority-letter/sample-csv/:departmentId', authenticateToken, setCurrentUser(), async (req: any, res) => {
    try {
      const departmentId = parseInt(req.params.departmentId);
      const user = req.currentUser;
      
      // Check access
      if (user.role !== 'admin' && user.departmentId !== departmentId) {
        return res.status(403).json({ message: "Access denied to this department" });
      }
      
      // Get department fields
      const fields = await storage.getAllAuthorityLetterFields(departmentId);
      
      // Create CSV headers based on department fields
      const headers = ['row_id', ...fields.map(f => f.fieldName), 'notes'];
      
      // Create sample data
      const sampleRows = [
        ['1', ...fields.map(f => `Sample ${f.fieldLabel}`), 'Sample notes for row 1'],
        ['2', ...fields.map(f => `Example ${f.fieldLabel}`), 'Sample notes for row 2'],
        ['3', ...fields.map(f => `Test ${f.fieldLabel}`), 'Sample notes for row 3']
      ];
      
      const csvContent = Papa.unparse([headers, ...sampleRows]);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="authority_letter_sample_${departmentId}.csv"`);
      res.send(csvContent);
    } catch (error) {
      console.error("Error generating sample CSV:", error);
      res.status(500).json({ message: "Failed to generate sample CSV" });
    }
  });

  // Bulk generate PDFs from CSV
  app.post('/api/authority-letter/bulk-generate', authenticateToken, setCurrentUser(), multer().single('csvFile'), async (req: any, res) => {
    try {
      const { templateId } = req.body;
      const user = req.currentUser;
      
      if (!req.file) {
        return res.status(400).json({ message: "CSV file is required" });
      }
      
      // Get template
      const template = await storage.getAuthorityLetterTemplate(parseInt(templateId));
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }
      
      // Check access
      if (user.role !== 'admin' && template.departmentId !== user.departmentId) {
        return res.status(403).json({ message: "Access denied to this template" });
      }
      
      // Parse CSV
      const csvContent = req.file.buffer.toString('utf8');
      const parsedData = Papa.parse(csvContent, { header: true, skipEmptyLines: true });
      
      if (parsedData.errors.length > 0) {
        return res.status(400).json({ message: "CSV parsing error", errors: parsedData.errors });
      }
      
      // Get field mappings (CSV column to template field)
      const fields = template.departmentId ? await storage.getAllAuthorityLetterFields(template.departmentId) : [];
      const fieldMappings: Record<string, string> = {};
      fields.forEach(field => {
        fieldMappings[field.fieldName] = field.fieldName; // Assuming CSV columns match field names
      });
      
      // Generate bulk PDFs
      const results = await PDFGenerator.generateBulkPDFs(
        template.templateContent,
        parsedData.data as Array<Record<string, any>>,
        fieldMappings
      );
      
      if (results.length === 0) {
        return res.status(400).json({ message: "No PDFs could be generated" });
      }
      
      // Create a ZIP file with all PDFs
      const JSZip = await import('jszip').then(m => m.default);
      const zip = new JSZip();
      
      results.forEach((result, index) => {
        zip.file(result.fileName, result.data);
      });
      
      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
      
      await logAudit(user.id, 'CREATE', 'bulk_authority_letters', `${results.length} PDFs`);
      
      // Send ZIP file
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="authority_letters_bulk_${Date.now()}.zip"`);
      res.setHeader('Content-Length', zipBuffer.length);
      
      res.send(zipBuffer);
    } catch (error) {
      console.error("Error in bulk generation:", error);
      res.status(500).json({ message: "Failed to generate bulk PDFs" });
    }
  });

  // ===== END OF NEW PDF SYSTEM =====

  const httpServer = createServer(app);
  return httpServer;
}
