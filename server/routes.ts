import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { insertCourierSchema, insertDepartmentSchema, insertFieldSchema, insertSmtpSettingsSchema } from "@shared/schema";
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

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Helper function to check role permissions
  const checkRole = (allowedRoles: string[]) => {
    return async (req: any, res: any, next: any) => {
      try {
        const userId = req.user.claims.sub;
        const user = await storage.getUser(userId);
        
        if (!user || !allowedRoles.includes(user.role!)) {
          return res.status(403).json({ message: "Insufficient permissions" });
        }
        
        req.currentUser = user;
        next();
      } catch (error) {
        res.status(500).json({ message: "Authorization error" });
      }
    };
  };

  // Helper function to log audit
  const logAudit = async (userId: string, action: string, entityType: string, entityId?: number) => {
    try {
      await storage.createAuditLog({
        userId,
        action,
        entityType,
        entityId,
      });
    } catch (error) {
      console.error("Failed to log audit:", error);
    }
  };

  // Department routes
  app.get('/api/departments', isAuthenticated, async (req: any, res) => {
    try {
      const departments = await storage.getAllDepartments();
      res.json(departments);
    } catch (error) {
      console.error("Error fetching departments:", error);
      res.status(500).json({ message: "Failed to fetch departments" });
    }
  });

  app.post('/api/departments', isAuthenticated, checkRole(['admin']), async (req: any, res) => {
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

  app.put('/api/departments/:id', isAuthenticated, checkRole(['admin']), async (req: any, res) => {
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

  app.delete('/api/departments/:id', isAuthenticated, checkRole(['admin']), async (req: any, res) => {
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

  // Courier routes
  app.get('/api/couriers', isAuthenticated, async (req: any, res) => {
    try {
      const { status, departmentId, search, limit = 10, offset = 0 } = req.query;
      
      const filters: any = {};
      if (status) filters.status = status;
      if (departmentId) filters.departmentId = parseInt(departmentId);
      if (search) filters.search = search;
      if (limit) filters.limit = parseInt(limit);
      if (offset) filters.offset = parseInt(offset);
      
      const result = await storage.getAllCouriers(filters);
      res.json(result);
    } catch (error) {
      console.error("Error fetching couriers:", error);
      res.status(500).json({ message: "Failed to fetch couriers" });
    }
  });

  app.get('/api/couriers/:id', isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
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

  app.post('/api/couriers', isAuthenticated, upload.single('podCopy'), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      // Parse courier data
      const courierData = {
        ...req.body,
        createdBy: userId,
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

  app.put('/api/couriers/:id', isAuthenticated, upload.single('podCopy'), async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = req.user.claims.sub;
      
      // Check if courier exists and user has permission
      const existingCourier = await storage.getCourierById(id);
      if (!existingCourier) {
        return res.status(404).json({ message: "Courier not found" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
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

  app.delete('/api/couriers/:id', isAuthenticated, checkRole(['admin', 'manager']), async (req: any, res) => {
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

  app.post('/api/couriers/:id/restore', isAuthenticated, checkRole(['admin', 'manager']), async (req: any, res) => {
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
  app.get('/api/stats', isAuthenticated, async (req: any, res) => {
    try {
      const stats = await storage.getCourierStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ message: "Failed to fetch statistics" });
    }
  });

  // Fields routes
  app.get('/api/fields', isAuthenticated, checkRole(['admin']), async (req: any, res) => {
    try {
      const fields = await storage.getAllFields();
      res.json(fields);
    } catch (error) {
      console.error("Error fetching fields:", error);
      res.status(500).json({ message: "Failed to fetch fields" });
    }
  });

  app.post('/api/fields', isAuthenticated, checkRole(['admin']), async (req: any, res) => {
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
  app.get('/api/smtp-settings', isAuthenticated, checkRole(['admin']), async (req: any, res) => {
    try {
      const settings = await storage.getSmtpSettings();
      res.json(settings || {});
    } catch (error) {
      console.error("Error fetching SMTP settings:", error);
      res.status(500).json({ message: "Failed to fetch SMTP settings" });
    }
  });

  app.put('/api/smtp-settings', isAuthenticated, checkRole(['admin']), async (req: any, res) => {
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
  app.get('/api/audit-logs', isAuthenticated, checkRole(['admin']), async (req: any, res) => {
    try {
      const { limit = 50, offset = 0 } = req.query;
      const result = await storage.getAuditLogs(parseInt(limit), parseInt(offset));
      res.json(result);
    } catch (error) {
      console.error("Error fetching audit logs:", error);
      res.status(500).json({ message: "Failed to fetch audit logs" });
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
