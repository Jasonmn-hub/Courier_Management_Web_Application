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
import mammoth from "mammoth";
import { PDFGenerator } from "./pdf-generator";
import { WordGenerator } from "./word-generator";
import { FieldTransformations } from "./field-transformations";
import Papa from "papaparse";
import nodemailer from "nodemailer";
import crypto from "crypto";

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

// Indian states list for dropdowns
const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana',
  'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Andaman and Nicobar Islands',
  'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Jammu and Kashmir', 'Ladakh',
  'Lakshadweep', 'Puducherry'
];

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

// CSV upload specifically for bulk uploads
const csvUpload = multer({
  dest: uploadDir,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /\.csv$/i;
    const extname = allowedTypes.test(path.extname(file.originalname));
    const mimetype = file.mimetype === 'text/csv' || 
                     file.mimetype === 'application/csv' ||
                     file.mimetype === 'text/plain'; // Some browsers send CSV as text/plain
    
    if (mimetype || extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed for bulk upload'));
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
  // Email confirmation endpoints (no auth required)
  app.get('/api/couriers/confirm-received', async (req: any, res) => {
    try {
      const token = req.query.token;
      
      if (!token) {
        return res.status(400).send(`
          <html>
            <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
              <h2 style="color: #dc2626;">❌ Invalid Link</h2>
              <p>The confirmation link is invalid or missing.</p>
            </body>
          </html>
        `);
      }

      // Find courier by token
      const allCouriers = await storage.getAllCouriers({});
      const courier = allCouriers.couriers.find(c => (c as any).confirmationToken === token);
      
      if (!courier) {
        return res.status(404).send(`
          <html>
            <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
              <h2 style="color: #dc2626;">❌ Courier Not Found</h2>
              <p>The courier confirmation link is invalid or has expired.</p>
            </body>
          </html>
        `);
      }

      // Check if already confirmed
      if ((courier as any).status === 'received') {
        return res.send(`
          <html>
            <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
              <h2 style="color: #16a34a;">✅ Already Confirmed</h2>
              <p>This courier (POD: ${courier.podNo}) has already been marked as received.</p>
              <p style="color: #6b7280; font-size: 14px;">Thank you for confirming the delivery.</p>
            </body>
          </html>
        `);
      }

      // Update status to received and clear token
      await storage.updateCourier(courier.id, { 
        status: 'received' as any,
        confirmationToken: null,
        receivedDate: new Date().toISOString().split('T')[0]
      });

      // Log audit for email confirmation with email address for tracking
      await logAudit(courier.createdBy || 'system', 'EMAIL_CONFIRM_RECEIVED', 'courier', `${courier.id} (${courier.email})`, courier.email);

      // Success response
      res.send(`
        <html>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h2 style="color: #16a34a;">✅ Courier Received Successfully</h2>
            <p>Thank you for confirming the receipt of courier:</p>
            <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px auto; max-width: 400px;">
              <p><strong>POD Number:</strong> ${courier.podNo}</p>
              <p><strong>To Branch:</strong> ${courier.toBranch}</p>
              <p><strong>Vendor:</strong> ${courier.vendor || courier.customVendor || 'N/A'}</p>
              <p><strong>Status:</strong> <span style="background: #dcfce7; color: #166534; padding: 4px 8px; border-radius: 4px;">RECEIVED</span></p>
            </div>
            <p style="color: #6b7280; font-size: 14px;">The status has been updated in our system.</p>
          </body>
        </html>
      `);
    } catch (error) {
      console.error("Error confirming courier:", error);
      res.status(500).send(`
        <html>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h2 style="color: #dc2626;">❌ Error</h2>
            <p>There was an error processing your confirmation. Please try again or contact support.</p>
          </body>
        </html>
      `);
    }
  });

  app.get('/api/received-couriers/confirm-received', async (req: any, res) => {
    try {
      const token = req.query.token;
      
      if (!token) {
        return res.status(400).send(`
          <html>
            <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
              <h2 style="color: #dc2626;">❌ Invalid Link</h2>
              <p>The confirmation link is invalid or missing.</p>
            </body>
          </html>
        `);
      }

      // Find courier by token
      const allCouriers = await storage.getAllReceivedCouriers({});
      const courier = allCouriers.find(c => (c as any).confirmationToken === token);
      
      if (!courier) {
        return res.status(404).send(`
          <html>
            <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
              <h2 style="color: #dc2626;">❌ Courier Not Found</h2>
              <p>The courier confirmation link is invalid or has expired.</p>
            </body>
          </html>
        `);
      }

      // Check if already confirmed
      if ((courier as any).status === 'received') {
        return res.send(`
          <html>
            <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
              <h2 style="color: #16a34a;">✅ Already Confirmed</h2>
              <p>This courier (POD: ${courier.podNumber}) has already been marked as received.</p>
              <p style="color: #6b7280; font-size: 14px;">Thank you for confirming the delivery.</p>
            </body>
          </html>
        `);
      }

      // Update status to received and clear token
      await storage.updateReceivedCourier(courier.id, { 
        status: 'received' as any,
        confirmationToken: null
      });

      // Log audit for email confirmation with email address for tracking
      await logAudit(null, 'EMAIL_CONFIRM_RECEIVED', 'received_courier', `${courier.id} (${(courier as any).emailId})`, (courier as any).emailId);

      // Success response
      res.send(`
        <html>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h2 style="color: #16a34a;">✅ Courier Received Successfully</h2>
            <p>Thank you for confirming the receipt of courier:</p>
            <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px auto; max-width: 400px;">
              <p><strong>POD Number:</strong> ${courier.podNumber}</p>
              <p><strong>From:</strong> ${courier.fromLocation}</p>
              <p><strong>Vendor:</strong> ${courier.courierVendor === 'Others' && (courier as any).customVendor ? (courier as any).customVendor : courier.courierVendor}</p>
              <p><strong>Status:</strong> <span style="background: #dcfce7; color: #166534; padding: 4px 8px; border-radius: 4px;">RECEIVED</span></p>
            </div>
            <p style="color: #6b7280; font-size: 14px;">The status has been updated in our system.</p>
          </body>
        </html>
      `);
    } catch (error) {
      console.error("Error confirming received courier:", error);
      res.status(500).send(`
        <html>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h2 style="color: #dc2626;">❌ Error</h2>
            <p>There was an error processing your confirmation. Please try again or contact support.</p>
          </body>
        </html>
      `);
    }
  });

  // Get Indian states endpoint
  app.get('/api/states', authenticateToken, async (req: any, res) => {
    try {
      res.json({ states: INDIAN_STATES });
    } catch (error) {
      console.error("Error fetching states:", error);
      res.status(500).json({ message: "Failed to fetch states" });
    }
  });

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

  // Forgot password endpoint
  app.post('/api/auth/forgot-password', async (req, res) => {
    try {
      const { email } = req.body;
      
      if (!email || !email.includes('@')) {
        return res.status(400).json({ message: 'Valid email is required' });
      }

      // Check if user exists
      const user = await storage.getUserByEmail(email);
      if (!user) {
        // Don't reveal if user exists or not for security
        return res.json({ message: 'If an account with that email exists, you will receive a password reset code.' });
      }

      // Generate secure token for email link
      const resetToken = crypto.randomBytes(32).toString('hex');
      
      // Set expiry to 1 hour from now
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
      
      // Save reset token to database
      await storage.createPasswordResetToken(email, resetToken, expiresAt);

      // Get SMTP settings for sending email
      const smtpSettings = await storage.getSmtpSettings();
      if (!smtpSettings || !smtpSettings.host) {
        return res.status(500).json({ message: 'Email service is not configured. Please contact your administrator.' });
      }

      // Send OTP email
      try {
        const transportConfig: any = {
          host: smtpSettings.host,
          port: smtpSettings.port || 587,
          auth: {
            user: smtpSettings.username,
            pass: smtpSettings.password,
          }
        };

        if (smtpSettings.useSSL) {
          transportConfig.secure = true;
        } else if (smtpSettings.useTLS) {
          transportConfig.secure = false;
          transportConfig.requireTLS = true;
        } else {
          transportConfig.secure = false;
        }

        const transporter = nodemailer.createTransport(transportConfig);

        const resetUrl = `${smtpSettings.applicationUrl || process.env.REPLIT_DOMAINS?.split(',')[0] ? `https://${process.env.REPLIT_DOMAINS?.split(',')[0]}` : 'http://localhost:5000'}/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`;

        const mailOptions = {
          from: smtpSettings.fromEmail || smtpSettings.username || 'noreply@courier-system.com',
          to: email,
          subject: 'Password Reset Link - Courier Management System',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #333;">Password Reset Request</h2>
              <p>You have requested to reset your password for the Courier Management System.</p>
              <p>Click the button below to reset your password:</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${resetUrl}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold;">Reset Password</a>
              </div>
              <p>Or copy and paste this link in your browser:</p>
              <p style="word-break: break-all; background-color: #f8f9fa; padding: 10px; border-radius: 4px;">${resetUrl}</p>
              <p><strong>Important:</strong></p>
              <ul>
                <li>This link will expire in 1 hour</li>
                <li>If you didn't request this reset, please ignore this email</li>
                <li>Do not share this link with anyone</li>
              </ul>
              <p>Thank you!</p>
            </div>
          `
        };

        await transporter.sendMail(mailOptions);
      } catch (emailError) {
        console.error('Error sending reset email:', emailError);
        return res.status(500).json({ message: 'Failed to send password reset email. Please try again later.' });
      }

      res.json({ message: 'If an account with that email exists, you will receive a password reset code.' });
    } catch (error) {
      console.error('Forgot password error:', error);
      res.status(500).json({ message: 'Password reset request failed' });
    }
  });

  // Reset password endpoint (using token from email link)
  app.post('/api/auth/reset-password', async (req, res) => {
    try {
      const { email, token, newPassword } = req.body;
      
      if (!email || !token || !newPassword) {
        return res.status(400).json({ message: 'Email, token, and new password are required' });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ message: 'Password must be at least 6 characters long' });
      }

      // Verify token
      const isValidToken = await storage.verifyPasswordResetToken(email, token);
      if (!isValidToken) {
        return res.status(400).json({ message: 'Invalid or expired reset link' });
      }

      // Hash new password
      const hashedPassword = await hashPassword(newPassword);

      // Update user password
      const passwordUpdated = await storage.updateUserPassword(email, hashedPassword);
      if (!passwordUpdated) {
        return res.status(400).json({ message: 'Failed to update password' });
      }

      // Mark token as used
      await storage.markPasswordResetTokenAsUsed(email, token);

      res.json({ message: 'Password has been reset successfully' });
    } catch (error) {
      console.error('Reset password error:', error);
      res.status(500).json({ message: 'Password reset failed' });
    }
  });

  // Change password endpoint (for logged-in users)
  app.post('/api/auth/change-password', authenticateToken, async (req: any, res) => {
    try {
      const { oldPassword, newPassword } = req.body;
      const userId = req.user.id;
      
      if (!oldPassword || !newPassword) {
        return res.status(400).json({ message: 'Old password and new password are required' });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ message: 'New password must be at least 6 characters long' });
      }

      if (oldPassword === newPassword) {
        return res.status(400).json({ message: 'New password must be different from the old password' });
      }

      // Get user from database
      const user = await storage.getUser(userId);
      if (!user || !user.password) {
        return res.status(404).json({ message: 'User not found or password not set' });
      }

      // Verify old password
      const isValidOldPassword = await comparePassword(oldPassword, user.password);
      if (!isValidOldPassword) {
        return res.status(400).json({ message: 'Current password is incorrect' });
      }

      // Hash new password
      const hashedNewPassword = await hashPassword(newPassword);

      // Update user password
      const passwordUpdated = await storage.updateUserPassword(user.email!, hashedNewPassword);
      if (!passwordUpdated) {
        return res.status(500).json({ message: 'Failed to update password' });
      }

      res.json({ message: 'Password changed successfully' });
    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({ message: 'Password change failed' });
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
  app.get('/api/users', authenticateToken, async (req: any, res) => {
    try {
      const { search } = req.query;
      const users = await storage.getUsersWithDepartments(search as string);
      // Only return basic info for security
      const basicUsers = users.map(user => ({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        departments: user.departments
      }));
      res.json({ users: basicUsers });
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Admin-only user management route
  app.get('/api/admin/users', authenticateToken, requireRole(['admin', 'sub_admin', 'manager']), async (req: any, res) => {
    try {
      const { search } = req.query;
      const users = await storage.getUsersWithDepartments(search as string);
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.post('/api/users', authenticateToken, requireRole(['admin', 'sub_admin']), setCurrentUser(), async (req: any, res) => {
    try {
      const { name, email, employeeCode, mobileNumber, password, role = 'user', departmentId } = req.body;
      
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
        employeeCode: employeeCode || null,
        mobileNumber: mobileNumber || null,
        password: hashedPassword,
        role: role as any,
        departmentId: departmentId || null
      });

      await logAudit(req.currentUser.id, 'CREATE', 'user', newUser.id);

      // Send email notification to new user
      try {
        const smtpSettings = await storage.getSmtpSettings();
        if (smtpSettings && smtpSettings.host && smtpSettings.username && smtpSettings.password) {
          const transportConfig: any = {
            host: smtpSettings.host,
            port: smtpSettings.port || 587,
            auth: {
              user: smtpSettings.username,
              pass: smtpSettings.password,
            }
          };

          if (smtpSettings.useSSL) {
            transportConfig.secure = true;
          } else if (smtpSettings.useTLS) {
            transportConfig.secure = false;
            transportConfig.requireTLS = true;
          } else {
            transportConfig.secure = false;
          }

          const transporter = nodemailer.createTransport(transportConfig);

          // Get login URL from SMTP settings, env, or default to current domain
          const loginUrl = smtpSettings.applicationUrl || 
            (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : `https://${req.get('host')}`);

          const mailOptions = {
            from: smtpSettings.fromEmail || smtpSettings.username,
            to: email,
            subject: 'Welcome to Courier Management System - Account Created',
            html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width" />
  <title>Account Created</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f8;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f4f6f8;">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px;background:#fff;border-radius:12px;box-shadow:0 4px 12px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background:#0b5fff;color:#fff;padding:18px 24px;font-size:18px;font-weight:600;border-radius:12px 12px 0 0;">
              <span style="font-size:24px;">🔐</span> Account Created Successfully
            </td>
          </tr>
          
          <!-- Welcome Message -->
          <tr>
            <td style="padding:24px 24px 20px;color:#111827;font-size:14px;line-height:1.6;">
              <h2 style="margin:0 0 16px;color:#111827;font-size:20px;">Welcome, ${name}!</h2>
              <p style="margin:0 0 16px;">Your account has been successfully created in the Courier Management System. Below are your login credentials:</p>
            </td>
          </tr>
          
          <!-- Account Details -->
          <tr>
            <td style="padding:0 24px 20px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;background:#f9fafb;">
                <tr>
                  <td style="padding:16px;">
                    <div style="margin-bottom:12px;">
                      <span style="font-weight:600;color:#374151;">Email:</span>
                      <span style="color:#0b5fff;margin-left:8px;">${email}</span>
                    </div>
                    <div style="margin-bottom:12px;">
                      <span style="font-weight:600;color:#374151;">Employee Code:</span>
                      <span style="margin-left:8px;">${employeeCode || 'Not assigned'}</span>
                    </div>
                    <div style="margin-bottom:12px;">
                      <span style="font-weight:600;color:#374151;">Role:</span>
                      <span style="margin-left:8px;text-transform:capitalize;">${role}</span>
                    </div>
                    <div>
                      <span style="font-weight:600;color:#374151;">Password:</span>
                      <span style="margin-left:8px;font-family:monospace;background:#fff;padding:4px 8px;border-radius:4px;border:1px solid #d1d5db;">${password}</span>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Login Button -->
          <tr>
            <td style="padding:0 24px 24px;text-align:center;">
              <a href="${loginUrl}" style="display:inline-block;background:#0b5fff;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px;">
                🔗 Access Your Account
              </a>
            </td>
          </tr>

          <!-- Security Note -->
          <tr>
            <td style="padding:0 24px 20px;color:#6b7280;font-size:13px;line-height:1.5;">
              <div style="background:#f3f4f6;padding:16px;border-radius:8px;border-left:4px solid #f59e0b;">
                <p style="margin:0 0 8px;font-weight:600;color:#92400e;">🔒 Security Reminder:</p>
                <p style="margin:0;">Please change your password after your first login. Keep your login credentials secure and do not share them with anyone.</p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 24px;text-align:center;border-top:1px solid #e5e7eb;color:#6b7280;font-size:12px;">
              <p style="margin:0;">This is an automated message from the Courier Management System.</p>
              <p style="margin:4px 0 0;">If you didn't expect this email, please contact your administrator.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
            `
          };

          await transporter.sendMail(mailOptions);
          console.log(`Welcome email sent to ${email}`);
        }
      } catch (emailError) {
        console.error('Error sending welcome email:', emailError);
        // Don't fail user creation if email fails
      }

      res.status(201).json(newUser);
    } catch (error) {
      console.error('User creation error:', error);
      res.status(500).json({ message: 'User creation failed' });
    }
  });

  app.put('/api/users/:id', authenticateToken, requireRole(['admin', 'sub_admin']), setCurrentUser(), async (req: any, res) => {
    try {
      const userId = req.params.id;
      const { name, email, employeeCode, mobileNumber, role, departmentId, password } = req.body;
      
      if (!name || !email) {
        return res.status(400).json({ message: 'Name and email are required' });
      }

      const updateData: any = {
        name,
        email,
        employeeCode: employeeCode || null,
        mobileNumber: mobileNumber || null,
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

  // Profile image upload endpoint
  app.post('/api/users/profile-image', authenticateToken, upload.single('profileImage'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No image file provided' });
      }

      // Get the file extension
      const originalExtension = path.extname(req.file.originalname);
      const newFileName = `profile_${req.user.id}_${Date.now()}${originalExtension}`;
      const newPath = path.join(uploadDir, newFileName);

      // Move file to new location with proper name
      fs.renameSync(req.file.path, newPath);

      // Create URL for the image
      const imageUrl = `/uploads/${newFileName}`;

      // Update user's profile image URL in database
      const updatedUser = await storage.updateUser(req.user.id, {
        profileImageUrl: imageUrl
      });

      if (!updatedUser) {
        return res.status(404).json({ message: 'User not found' });
      }

      await logAudit(req.user.id, 'UPDATE', 'user_profile_image', req.user.id);

      res.json({ 
        message: 'Profile image updated successfully',
        profileImageUrl: imageUrl
      });
    } catch (error) {
      console.error('Profile image upload error:', error);
      res.status(500).json({ message: 'Profile image upload failed' });
    }
  });

  app.delete('/api/users/:id', authenticateToken, requireRole(['admin', 'sub_admin']), setCurrentUser(), async (req: any, res) => {
    try {
      const userId = req.params.id;
      
      // Check if user exists before attempting deletion
      const existingUser = await storage.getUserByEmail(''); // We'll need to get user by ID
      
      const success = await storage.deleteUser(userId);
      if (!success) {
        // If user doesn't exist, consider it already deleted (success case)
        await logAudit(req.currentUser.id, 'DELETE', 'user', userId);
        return res.json({ message: 'User deleted successfully' });
      }

      await logAudit(req.currentUser.id, 'DELETE', 'user', userId);

      res.json({ message: 'User deleted successfully' });
    } catch (error) {
      console.error('User deletion error:', error);
      // Log the deletion attempt even if it fails
      try {
        await logAudit(req.currentUser.id, 'DELETE_ATTEMPT', 'user', req.params.id);
      } catch (auditError) {
        console.error('Audit log error:', auditError);
      }
      res.status(500).json({ message: 'User deletion failed' });
    }
  });

  app.post('/api/users/bulk-upload', authenticateToken, requireRole(['admin', 'sub_admin']), setCurrentUser(), csvUpload.single('file'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }

      const fileContent = fs.readFileSync(req.file.path, 'utf-8');
      const lines = fileContent.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        return res.status(400).json({ message: 'Invalid CSV file. Must have header row and at least one data row.' });
      }

      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
      const expectedHeaders = ['name', 'email', 'employeeCode', 'mobileNumber', 'role', 'departmentName', 'password'];
      
      // Validate headers
      const missingHeaders = expectedHeaders.filter(h => !headers.includes(h));
      if (missingHeaders.length > 0) {
        return res.status(400).json({ 
          message: `Missing required headers: ${missingHeaders.join(', ')}` 
        });
      }

      let processed = 0;
      let errors = 0;
      const results = [];

      for (let i = 1; i < lines.length; i++) {
        try {
          const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
          const userData: any = {};
          
          headers.forEach((header, index) => {
            userData[header] = values[index] || '';
          });

          // Validate required fields (employeeCode is optional)
          if (!userData.name || !userData.email || !userData.role || !userData.password) {
            errors++;
            continue;
          }

          // Check if user already exists
          const existingUser = await storage.getUserByEmail(userData.email);
          if (existingUser) {
            errors++;
            continue;
          }

          // Find department by name
          let departmentId = null;
          if (userData.departmentName) {
            const departments = await storage.getAllDepartments();
            const department = departments.find(d => d.name.toLowerCase() === userData.departmentName.toLowerCase());
            if (department) {
              departmentId = department.id;
            }
          }

          // Hash password
          const hashedPassword = await hashPassword(userData.password);

          // Create user
          const newUser = await storage.createUser({
            name: userData.name,
            email: userData.email,
            employeeCode: userData.employeeCode || null,
            mobileNumber: userData.mobileNumber || null,
            password: hashedPassword,
            role: userData.role,
            departmentId
          });

          await logAudit(req.currentUser.id, 'CREATE', 'user', newUser.id);

          // Send email notification to new user
          try {
            const smtpSettings = await storage.getSmtpSettings();
            if (smtpSettings && smtpSettings.host && smtpSettings.username && smtpSettings.password) {
              const transportConfig: any = {
                host: smtpSettings.host,
                port: smtpSettings.port || 587,
                auth: {
                  user: smtpSettings.username,
                  pass: smtpSettings.password,
                }
              };

              if (smtpSettings.useSSL) {
                transportConfig.secure = true;
              } else if (smtpSettings.useTLS) {
                transportConfig.secure = false;
                transportConfig.requireTLS = true;
              } else {
                transportConfig.secure = false;
              }

              const transporter = nodemailer.createTransport(transportConfig);

              // Get login URL from SMTP settings, env, or default to current domain
              const loginUrl = smtpSettings.applicationUrl || 
                (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : `https://${req.get('host')}`);

              const mailOptions = {
                from: smtpSettings.fromEmail || smtpSettings.username,
                to: userData.email,
                subject: 'Welcome to Courier Management System - Account Created',
                html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width" />
  <title>Account Created</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f8;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f4f6f8;">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px;background:#fff;border-radius:12px;box-shadow:0 4px 12px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background:#0b5fff;color:#fff;padding:18px 24px;font-size:18px;font-weight:600;border-radius:12px 12px 0 0;">
              <span style="font-size:24px;">🔐</span> Account Created Successfully
            </td>
          </tr>
          
          <!-- Welcome Message -->
          <tr>
            <td style="padding:24px 24px 20px;color:#111827;font-size:14px;line-height:1.6;">
              <h2 style="margin:0 0 16px;color:#111827;font-size:20px;">Welcome, ${userData.name}!</h2>
              <p style="margin:0 0 16px;">Your account has been successfully created in the Courier Management System. Below are your login credentials:</p>
            </td>
          </tr>
          
          <!-- Account Details -->
          <tr>
            <td style="padding:0 24px 20px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;background:#f9fafb;">
                <tr>
                  <td style="padding:16px;">
                    <div style="margin-bottom:12px;">
                      <span style="font-weight:600;color:#374151;">Email:</span>
                      <span style="color:#0b5fff;margin-left:8px;">${userData.email}</span>
                    </div>
                    <div style="margin-bottom:12px;">
                      <span style="font-weight:600;color:#374151;">Employee Code:</span>
                      <span style="margin-left:8px;">${userData.employeeCode || 'Not assigned'}</span>
                    </div>
                    <div style="margin-bottom:12px;">
                      <span style="font-weight:600;color:#374151;">Role:</span>
                      <span style="margin-left:8px;text-transform:capitalize;">${userData.role}</span>
                    </div>
                    <div>
                      <span style="font-weight:600;color:#374151;">Password:</span>
                      <span style="margin-left:8px;font-family:monospace;background:#fff;padding:4px 8px;border-radius:4px;border:1px solid #d1d5db;">${userData.password}</span>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Login Button -->
          <tr>
            <td style="padding:0 24px 24px;text-align:center;">
              <a href="${loginUrl}" style="display:inline-block;background:#0b5fff;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px;">
                🔗 Access Your Account
              </a>
            </td>
          </tr>

          <!-- Security Note -->
          <tr>
            <td style="padding:0 24px 20px;color:#6b7280;font-size:13px;line-height:1.5;">
              <div style="background:#f3f4f6;padding:16px;border-radius:8px;border-left:4px solid #f59e0b;">
                <p style="margin:0 0 8px;font-weight:600;color:#92400e;">🔒 Security Reminder:</p>
                <p style="margin:0;">Please change your password after your first login. Keep your login credentials secure and do not share them with anyone.</p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 24px;text-align:center;border-top:1px solid #e5e7eb;color:#6b7280;font-size:12px;">
              <p style="margin:0;">This is an automated message from the Courier Management System.</p>
              <p style="margin:4px 0 0;">If you didn't expect this email, please contact your administrator.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
                `
              };

              await transporter.sendMail(mailOptions);
              console.log(`Welcome email sent to ${userData.email}`);
            }
          } catch (emailError) {
            console.error('Error sending welcome email:', emailError);
            // Don't fail user creation if email fails
          }

          processed++;

        } catch (error) {
          console.error(`Error processing row ${i}:`, error);
          errors++;
        }
      }

      // Clean up uploaded file
      if (req.file && req.file.path) {
        fs.unlinkSync(req.file.path);
      }

      res.json({ 
        message: `Bulk upload completed. Processed: ${processed}, Errors: ${errors}`,
        processed,
        errors
      });

    } catch (error) {
      console.error('Bulk upload error:', error);
      
      // Clean up uploaded file on error
      if (req.file && req.file.path) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (cleanupError) {
          console.error('File cleanup error:', cleanupError);
        }
      }
      
      res.status(500).json({ message: 'Bulk upload failed' });
    }
  });

  // Helper function to log audit
  const logAudit = async (userId: string | null, action: string, entityType: string, entityId?: string | number, emailId?: string) => {
    try {
      // For temp users or email confirmations, create audit logs with null userId to avoid foreign key constraint
      await storage.createAuditLog({
        userId: (userId && userId.startsWith('temp_')) ? null : userId,
        action,
        entityType,
        entityId: typeof entityId === 'number' ? entityId.toString() : entityId,
        emailId: emailId || null,
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

  app.post('/api/fields', authenticateToken, requireRole(['admin', 'sub_admin']), setCurrentUser(), async (req: any, res) => {
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

  app.delete('/api/fields/:id', authenticateToken, requireRole(['admin', 'sub_admin']), setCurrentUser(), async (req: any, res) => {
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

  // Field dropdown options routes
  app.get('/api/field-dropdown-options/:fieldId', authenticateToken, async (req: any, res) => {
    try {
      const fieldId = parseInt(req.params.fieldId);
      if (isNaN(fieldId)) {
        return res.status(400).json({ message: "Invalid field ID" });
      }

      const options = await storage.getFieldDropdownOptions(fieldId);
      res.json(options);
    } catch (error) {
      console.error("Error fetching field dropdown options:", error);
      res.status(500).json({ message: "Failed to fetch dropdown options" });
    }
  });

  app.post('/api/field-dropdown-options', authenticateToken, requireRole(['admin', 'sub_admin']), setCurrentUser(), async (req: any, res) => {
    try {
      const { fieldId, departmentId, optionValue, optionLabel, sortOrder } = req.body;
      
      if (!fieldId || !departmentId || !optionValue || !optionLabel) {
        return res.status(400).json({ message: "fieldId, departmentId, optionValue, and optionLabel are required" });
      }

      const option = await storage.createFieldDropdownOption({
        fieldId,
        departmentId,
        optionValue,
        optionLabel,
        sortOrder: sortOrder || 0
      });

      await logAudit(req.currentUser.id, 'CREATE', 'field_dropdown_option', option.id);
      
      res.status(201).json(option);
    } catch (error) {
      console.error("Error creating field dropdown option:", error);
      res.status(500).json({ message: "Failed to create dropdown option" });
    }
  });

  app.put('/api/field-dropdown-options/:id', authenticateToken, requireRole(['admin', 'sub_admin']), setCurrentUser(), async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid option ID" });
      }

      const { optionValue, optionLabel, sortOrder } = req.body;
      
      const option = await storage.updateFieldDropdownOption(id, {
        optionValue,
        optionLabel,
        sortOrder
      });

      if (!option) {
        return res.status(404).json({ message: "Dropdown option not found" });
      }

      await logAudit(req.currentUser.id, 'UPDATE', 'field_dropdown_option', id);
      
      res.json(option);
    } catch (error) {
      console.error("Error updating field dropdown option:", error);
      res.status(500).json({ message: "Failed to update dropdown option" });
    }
  });

  app.delete('/api/field-dropdown-options/:id', authenticateToken, requireRole(['admin', 'sub_admin']), setCurrentUser(), async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid option ID" });
      }

      const success = await storage.deleteFieldDropdownOption(id);
      if (!success) {
        return res.status(404).json({ message: "Dropdown option not found" });
      }

      await logAudit(req.currentUser.id, 'DELETE', 'field_dropdown_option', id);
      
      res.json({ message: "Dropdown option deleted successfully" });
    } catch (error) {
      console.error("Error deleting field dropdown option:", error);
      res.status(500).json({ message: "Failed to delete dropdown option" });
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

  app.post('/api/departments', authenticateToken, requireRole(['admin', 'sub_admin']), setCurrentUser(), async (req: any, res) => {
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

  app.put('/api/departments/:id', authenticateToken, requireRole(['admin', 'sub_admin']), setCurrentUser(), async (req: any, res) => {
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

  app.delete('/api/departments/:id', authenticateToken, requireRole(['admin', 'sub_admin']), setCurrentUser(), async (req: any, res) => {
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
  app.post('/api/departments/upload-document', authenticateToken, requireRole(['admin', 'sub_admin']), documentUpload.single('document'), setCurrentUser(), async (req: any, res) => {
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

  app.put('/api/departments/:id/fields', authenticateToken, requireRole(['admin', 'sub_admin']), setCurrentUser(), async (req: any, res) => {
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
      
      // Apply department filtering based on user role and policies
      if (user.role === 'admin') {
        // Admin can see all departments or filter by specific department
        if (departmentId) filters.departmentId = parseInt(departmentId);
      } else {
        // Check if user's department has permission to view all couriers
        let canViewAllCouriers = false;
        if (user.departmentId) {
          try {
            const viewAllPolicy = await storage.getUserPolicy(user.departmentId, 'view_all_couriers');
            canViewAllCouriers = viewAllPolicy?.isEnabled || false;
          } catch (error) {
            console.error('Error checking view_all_couriers policy:', error);
          }
        }

        if (canViewAllCouriers) {
          // User can see all departments or filter by specific department
          if (departmentId) filters.departmentId = parseInt(departmentId);
        } else {
          // Non-admin users can only see their department's couriers
          filters.departmentId = user.departmentId;
        }
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
      
      // Apply department filtering for export based on user role and policies
      if (user.role !== 'admin') {
        // Check if user's department has permission to view all couriers
        let canViewAllCouriers = false;
        if (user.departmentId) {
          try {
            const viewAllPolicy = await storage.getUserPolicy(user.departmentId, 'view_all_couriers');
            canViewAllCouriers = viewAllPolicy?.isEnabled || false;
          } catch (error) {
            console.error('Error checking view_all_couriers policy for export:', error);
          }
        }

        if (!canViewAllCouriers) {
          // Non-admin users without view_all_couriers permission can only export their department's data
          courierFilters.departmentId = user.departmentId;
          receivedFilters.departmentId = user.departmentId;
        }
        // If canViewAllCouriers is true, no departmentId filter is applied (export all departments)
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

      // Generate confirmation token for email button
      const confirmationToken = Buffer.from(`${Date.now()}-${Math.random()}`).toString('base64url');
      
      const validatedData = insertCourierSchema.parse({
        ...courierData,
        confirmationToken: confirmationToken
      });
      const courier = await storage.createCourier(validatedData);
      
      // Send email notification if requested
      if (req.body.sendEmail === 'true' && req.body.email) {
        try {
          const smtpSettings = await storage.getSmtpSettings();
          if (smtpSettings && smtpSettings.host && smtpSettings.username && smtpSettings.password) {
            const transportConfig: any = {
              host: smtpSettings.host,
              port: smtpSettings.port || 587,
              auth: {
                user: smtpSettings.username,
                pass: smtpSettings.password,
              }
            };

            if (smtpSettings.useSSL) {
              transportConfig.secure = true;
            } else if (smtpSettings.useTLS) {
              transportConfig.secure = false;
              transportConfig.requireTLS = true;
            } else {
              transportConfig.secure = false;
            }

            const transporter = nodemailer.createTransport(transportConfig);

            // Get department name for email signature
            let departmentName = 'N/A';
            if (user.departmentId) {
              try {
                const department = await storage.getDepartmentById(user.departmentId);
                departmentName = department?.name || 'N/A';
              } catch (error) {
                console.error('Error fetching department for email:', error);
              }
            }

            // Determine greeting based on destination type (branch vs user)
            let greeting = `Dear ${courier.receiverName || 'Team'}`;
            const toBranchLower = (courier.toBranch || '').toLowerCase();
            const isBranchDestination = await storage.getAllBranches({ search: courier.toBranch || '', limit: 1 });
            
            if (isBranchDestination.branches.length > 0) {
              greeting = 'Dear Branch Team';
            }

            // Get vendor contact details if available
            let vendorContactInfo = '';
            const vendorName = courier.vendor === 'Others' ? courier.customVendor : courier.vendor;
            
            if (vendorName && vendorName !== 'Others') {
              try {
                const vendorData = await storage.getAllVendors({ search: vendorName, limit: 1 });
                if (vendorData.vendors.length > 0) {
                  const vendor = vendorData.vendors[0];
                  if (vendor.mobileNumber) {
                    vendorContactInfo = `For any assistance regarding this courier, you may coordinate directly with our courier vendor at ${vendor.mobileNumber}.`;
                  }
                }
              } catch (error) {
                console.error('Error fetching vendor contact details:', error);
              }
            }

            const mailOptions: any = {
              from: smtpSettings.fromEmail || smtpSettings.username,
              to: req.body.email,
              cc: req.body.ccEmails ? req.body.ccEmails.split(',').map((email: string) => email.trim()).filter((email: string) => email) : undefined,
              subject: 'Courier Dispatch Notification - Courier Management System',
              html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width" />
  <title>Courier Sent</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f8;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f4f6f8;">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;font-family:Segoe UI,Arial,Helvetica,sans-serif;">
          
          <!-- Header -->
          <tr>
            <td style="background:#0b5fff;color:#fff;padding:18px 24px;font-size:18px;font-weight:600;">
              ${departmentName} • Courier Sent
            </td>
          </tr>
          
          <!-- Intro -->
          <tr>
            <td style="padding:20px 24px;color:#111827;font-size:14px;line-height:1.5;">
              ${greeting},<br><br>
              This is to notify you that a courier has been 
              <strong>sent to you from ${vendorName || 'N/A'} courier services</strong>.
              ${vendorContactInfo ? `<br><br>${vendorContactInfo}` : ''}
            </td>
          </tr>
          
          <!-- Details Table -->
          <tr>
            <td style="padding:0 24px 12px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:10px;">
                <tr>
                  <td style="padding:12px 16px;background:#f9fafb;font-weight:600;font-size:13px;">
                    Courier Details
                  </td>
                </tr>
                <tr>
                  <td style="padding:12px 16px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;color:#374151;">
                      <tr>
                        <td style="padding:6px 0;width:180px;">Courier ID</td>
                        <td style="padding:6px 0;"><strong>${courier.podNo || 'N/A'}</strong></td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;">From</td>
                        <td style="padding:6px 0;"><strong>${user.name || user.email || 'User'}</strong></td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;">To</td>
                        <td style="padding:6px 0;"><strong>${courier.toBranch || 'N/A'}</strong></td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;">Contact Details</td>
                        <td style="padding:6px 0;"><strong>${courier.contactDetails || 'N/A'}</strong></td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;">Related Department</td>
                        <td style="padding:6px 0;"><strong>${departmentName}</strong></td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;">Sent Date</td>
                        <td style="padding:6px 0;"><strong>${courier.courierDate || 'N/A'}</strong></td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;">Remarks</td>
                        <td style="padding:6px 0;"><strong>${courier.remarks || 'N/A'}</strong></td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;">Status</td>
                        <td style="padding:6px 0;">
                          <span style="display:inline-block;padding:2px 8px;border-radius:999px;background:#eef2ff;color:#1f3bb3;font-weight:600;">Sent</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Received Button -->
          <tr>
            <td style="padding:20px 24px;text-align:center;">
              <a href="${process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : 'http://localhost:5000'}/api/couriers/confirm-received?token=${confirmationToken}" 
                 style="display:inline-block;background:#16a34a;color:#fff;padding:12px 32px;text-decoration:none;border-radius:8px;font-weight:600;font-size:16px;">
                ✅ Click Here to Confirm Received
              </a>
              <br><br>
              <p style="color:#6b7280;font-size:12px;margin:0;">
                Click the button above when you have received the courier to update the status automatically.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding:14px 24px;color:#6b7280;font-size:12px;border-top:1px solid #e5e7eb;">
              For discrepancies, please update the record or contact the Courier Desk. <br><br>
              Thanks And Regards,<br>
              ${user.name || user.email || 'User'}<br>
              ${departmentName}<br><br>
              © ${new Date().getFullYear()} Courier Management System
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
              `
            };

            // Add POD attachment if available
            if (courier.podCopyPath) {
              try {
                const fs = await import('fs');
                const path = await import('path');
                const attachmentPath = path.join(process.cwd(), 'uploads', courier.podCopyPath);
                
                // Check if file exists before adding as attachment
                if (fs.existsSync(attachmentPath)) {
                  mailOptions.attachments = [{
                    filename: courier.podCopyPath,
                    path: attachmentPath,
                    contentType: 'application/pdf'
                  }];
                }
              } catch (error) {
                console.error('Error adding POD attachment:', error);
              }
            }

            await transporter.sendMail(mailOptions);
          }
        } catch (emailError) {
          console.error('Error sending courier notification email:', emailError);
          // Don't fail the courier creation if email fails
        }
      }
      
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

      if ((user.role === 'manager' || user.role === 'sub_admin') && existingCourier.departmentId !== user.departmentId) {
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

      if ((user.role === 'manager' || user.role === 'sub_admin') && existingCourier.departmentId !== user.departmentId) {
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

  app.delete('/api/couriers/:id', authenticateToken, requireRole(['admin', 'sub_admin', 'manager']), setCurrentUser(), async (req: any, res) => {
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

  app.post('/api/couriers/:id/restore', authenticateToken, requireRole(['admin', 'sub_admin', 'manager']), setCurrentUser(), async (req: any, res) => {
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
      const { status, search, limit = "50", offset = "0", departmentId } = req.query;
      
      const filters = {
        status: status || undefined,
        search: search || undefined,
        departmentId: departmentId ? parseInt(departmentId) : undefined,
        limit: parseInt(limit),
        offset: parseInt(offset)
      };
      
      const result = await storage.getAllBranches(filters);
      res.json(result);
    } catch (error) {
      console.error("Error fetching branches:", error);
      res.status(500).json({ message: "Failed to fetch branches" });
    }
  });

  // Download sample CSV for branches (MUST be before :id route)
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
          email: 'mainbranch@example.com',
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
          email: 'secondarybranch@example.com',
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

  app.get('/api/branches/:id', authenticateToken, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid branch ID" });
      }
      
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

  app.post('/api/branches', authenticateToken, requireRole(['admin', 'sub_admin']), setCurrentUser(), async (req: any, res) => {
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

  app.put('/api/branches/:id', authenticateToken, requireRole(['admin', 'sub_admin']), setCurrentUser(), async (req: any, res) => {
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

  app.delete('/api/branches/:id', authenticateToken, requireRole(['admin', 'sub_admin']), setCurrentUser(), async (req: any, res) => {
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

  app.patch('/api/branches/:id/status', authenticateToken, requireRole(['admin', 'sub_admin']), setCurrentUser(), async (req: any, res) => {
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
  app.post('/api/branches/bulk-upload', authenticateToken, requireRole(['admin', 'sub_admin']), setCurrentUser(), csvUpload.single('csvFile'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "CSV file is required" });
      }

      const csvContent = req.file.buffer?.toString('utf-8') || req.file.path ? 
        fs.readFileSync(req.file.path, 'utf-8') : null;
      
      if (!csvContent) {
        return res.status(400).json({ message: "Failed to read CSV file content" });
      }
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
      const duplicates: any[] = [];

      // Check for duplicates in existing database
      const existingBranches = await storage.getAllBranches();
      const existingBranchNames = new Set(existingBranches.branches.map(b => b.branchName.toLowerCase()));
      const existingBranchCodes = new Set(existingBranches.branches.map(b => b.branchCode.toLowerCase()));

      // Check for duplicates within the CSV file itself
      const csvBranchNames = new Set();
      const csvBranchCodes = new Set();

      parsed.data.forEach((row: any, index: number) => {
        try {
          const branchName = row.branchName?.trim();
          const branchCode = row.branchCode?.trim();

          // Check for duplicates
          if (branchName && existingBranchNames.has(branchName.toLowerCase())) {
            duplicates.push({
              row: index + 1,
              field: 'branchName',
              value: branchName,
              message: 'Branch name already exists in database'
            });
          }

          if (branchCode && existingBranchCodes.has(branchCode.toLowerCase())) {
            duplicates.push({
              row: index + 1,
              field: 'branchCode', 
              value: branchCode,
              message: 'Branch code already exists in database'
            });
          }

          if (branchName && csvBranchNames.has(branchName.toLowerCase())) {
            duplicates.push({
              row: index + 1,
              field: 'branchName',
              value: branchName,
              message: 'Duplicate branch name in CSV file'
            });
          }

          if (branchCode && csvBranchCodes.has(branchCode.toLowerCase())) {
            duplicates.push({
              row: index + 1,
              field: 'branchCode',
              value: branchCode,
              message: 'Duplicate branch code in CSV file'
            });
          }

          // Add to tracking sets
          if (branchName) csvBranchNames.add(branchName.toLowerCase());
          if (branchCode) csvBranchCodes.add(branchCode.toLowerCase());

          const branchData = insertBranchSchema.parse({
            srNo: row.srNo ? parseInt(row.srNo) : undefined,
            branchName,
            branchCode,
            branchAddress: row.branchAddress?.trim(),
            pincode: row.pincode?.trim(),
            state: row.state?.trim(),
            email: row.email?.trim() || undefined,
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

      // Handle duplicates based on admin decision
      const { adminApproval } = req.body;
      if (duplicates.length > 0 && !adminApproval) {
        return res.status(409).json({
          message: "Duplicate entries found. Admin approval required to proceed.",
          duplicates,
          validationErrors,
          requiresApproval: true
        });
      }

      if (validationErrors.length > 0) {
        return res.status(400).json({
          message: "Validation errors in CSV data",
          errors: validationErrors,
          duplicates
        });
      }

      if (branches.length === 0) {
        return res.status(400).json({ message: "No valid branch data found in CSV" });
      }

      const createdBranches = await storage.createBulkBranches(branches);
      
      await logAudit(req.currentUser.id, 'CREATE', 'branch', createdBranches.length);

      res.status(201).json({
        message: `Successfully created ${createdBranches.length} branches${duplicates.length > 0 ? ` (${duplicates.length} duplicates were approved and processed)` : ''}`,
        branches: createdBranches,
        duplicatesProcessed: duplicates.length
      });
    } catch (error) {
      console.error("Error in bulk branch upload:", error);
      res.status(500).json({ message: "Failed to process bulk upload" });
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
        'Email': branch.email || '',
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

  // Vendor Management endpoints
  app.get('/api/vendors', authenticateToken, async (req: any, res) => {
    try {
      const { search, limit = 20, offset = 0 } = req.query;
      
      const filters: any = {};
      if (search) filters.search = search;
      if (limit) filters.limit = parseInt(limit);
      if (offset) filters.offset = parseInt(offset);
      
      const result = await storage.getAllVendors(filters);
      res.json(result);
    } catch (error) {
      console.error("Error fetching vendors:", error);
      res.status(500).json({ message: "Failed to fetch vendors" });
    }
  });

  app.get('/api/vendors/:id', authenticateToken, requireRole(['admin', 'sub_admin']), async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid vendor ID" });
      }
      
      const vendor = await storage.getVendorById(id);
      
      if (!vendor) {
        return res.status(404).json({ message: "Vendor not found" });
      }
      
      res.json(vendor);
    } catch (error) {
      console.error("Error fetching vendor:", error);
      res.status(500).json({ message: "Failed to fetch vendor" });
    }
  });

  app.post('/api/vendors', authenticateToken, requireRole(['admin', 'sub_admin']), setCurrentUser(), async (req: any, res) => {
    try {
      const { insertVendorSchema } = await import('@shared/schema');
      const validatedData = insertVendorSchema.parse(req.body);
      const vendor = await storage.createVendor(validatedData);
      
      await logAudit(req.currentUser.id, 'CREATE', 'vendor', vendor.id);
      
      res.status(201).json(vendor);
    } catch (error) {
      if (error instanceof Error && error.name === 'ZodError') {
        return res.status(400).json({ message: "Validation error", errors: (error as any).errors });
      }
      console.error("Error creating vendor:", error);
      res.status(500).json({ message: "Failed to create vendor" });
    }
  });

  app.put('/api/vendors/:id', authenticateToken, requireRole(['admin', 'sub_admin']), setCurrentUser(), async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid vendor ID" });
      }

      const { insertVendorSchema } = await import('@shared/schema');
      const validatedData = insertVendorSchema.parse(req.body);
      const vendor = await storage.updateVendor(id, validatedData);
      
      if (!vendor) {
        return res.status(404).json({ message: "Vendor not found" });
      }
      
      await logAudit(req.currentUser.id, 'UPDATE', 'vendor', vendor.id);
      
      res.json(vendor);
    } catch (error) {
      if (error instanceof Error && error.name === 'ZodError') {
        return res.status(400).json({ message: "Validation error", errors: (error as any).errors });
      }
      console.error("Error updating vendor:", error);
      res.status(500).json({ message: "Failed to update vendor" });
    }
  });

  app.delete('/api/vendors/:id', authenticateToken, requireRole(['admin', 'sub_admin']), setCurrentUser(), async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid vendor ID" });
      }

      const deleted = await storage.deleteVendor(id);
      
      if (!deleted) {
        return res.status(404).json({ message: "Vendor not found" });
      }
      
      await logAudit(req.currentUser.id, 'DELETE', 'vendor', id);
      
      res.json({ message: "Vendor deleted successfully" });
    } catch (error) {
      console.error("Error deleting vendor:", error);
      res.status(500).json({ message: "Failed to delete vendor" });
    }
  });

  app.patch('/api/vendors/:id/status', authenticateToken, requireRole(['admin', 'sub_admin']), setCurrentUser(), async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const { isActive } = req.body;
      
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid vendor ID" });
      }
      
      const vendor = await storage.updateVendorStatus(id, isActive);
      
      if (!vendor) {
        return res.status(404).json({ message: "Vendor not found" });
      }
      
      await logAudit(req.currentUser.id, 'UPDATE', 'vendor', vendor.id);
      
      res.json(vendor);
    } catch (error) {
      console.error("Error updating vendor status:", error);
      res.status(500).json({ message: "Failed to update vendor status" });
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
      
      // Transform the data to include flattened department name for frontend compatibility
      const transformedCouriers = couriers.map(courier => ({
        ...courier,
        departmentName: courier.department?.name || null,
        creatorName: courier.creator?.name || null
      }));
      
      res.json(transformedCouriers);
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
      
      // Send email notification if requested
      if (req.body.sendEmailNotification === true && req.body.emailId) {
        try {
          const smtpSettings = await storage.getSmtpSettings();
          if (smtpSettings && smtpSettings.host && smtpSettings.username && smtpSettings.password) {
            const transportConfig: any = {
              host: smtpSettings.host,
              port: smtpSettings.port || 587,
              auth: {
                user: smtpSettings.username,
                pass: smtpSettings.password,
              }
            };

            if (smtpSettings.useSSL) {
              transportConfig.secure = true;
            } else if (smtpSettings.useTLS) {
              transportConfig.secure = false;
              transportConfig.requireTLS = true;
            } else {
              transportConfig.secure = false;
            }

            const transporter = nodemailer.createTransport(transportConfig);

            const mailOptions = {
              from: smtpSettings.fromEmail || smtpSettings.username,
              to: req.body.emailId,
              subject: 'Courier Received Notification - Courier Management System',
              html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width" />
  <title>Courier Received</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f8;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f4f6f8;">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;font-family:Segoe UI,Arial,Helvetica,sans-serif;">
          
          <!-- Header -->
          <tr>
            <td style="background:#16a34a;color:#fff;padding:18px 24px;font-size:18px;font-weight:600;">
              Courier Management System • Courier Received
            </td>
          </tr>
          
          <!-- Intro -->
          <tr>
            <td style="padding:20px 24px;color:#111827;font-size:14px;line-height:1.5;">
              Dear ${courier.receiverName || 'Team'},<br><br>
              This is to notify you that a courier has been 
              <strong>received from ${courier.fromLocation || 'N/A'} via ${courier.courierVendor || courier.customVendor || 'N/A'} courier services</strong>.
            </td>
          </tr>
          
          <!-- Details Table -->
          <tr>
            <td style="padding:0 24px 12px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:10px;">
                <tr>
                  <td style="padding:12px 16px;background:#f9fafb;font-weight:600;font-size:13px;">
                    Courier Details
                  </td>
                </tr>
                <tr>
                  <td style="padding:12px 16px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;color:#374151;">
                      <tr>
                        <td style="padding:6px 0;width:180px;">POD Number</td>
                        <td style="padding:6px 0;"><strong>${courier.podNumber || 'N/A'}</strong></td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;">From Location</td>
                        <td style="padding:6px 0;"><strong>${courier.fromLocation || 'N/A'}</strong></td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;">Courier Vendor</td>
                        <td style="padding:6px 0;"><strong>${courier.courierVendor || courier.customVendor || 'N/A'}</strong></td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;">Receiver Name</td>
                        <td style="padding:6px 0;"><strong>${courier.receiverName || 'N/A'}</strong></td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;">Received Date</td>
                        <td style="padding:6px 0;"><strong>${courier.receivedDate || 'N/A'}</strong></td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;">Remarks</td>
                        <td style="padding:6px 0;"><strong>${courier.remarks || 'N/A'}</strong></td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;">Status</td>
                        <td style="padding:6px 0;">
                          <span style="display:inline-block;padding:2px 8px;border-radius:999px;background:#dcfce7;color:#166534;font-weight:600;">Received</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Action Note -->
          <tr>
            <td style="padding:20px 24px;color:#111827;font-size:14px;line-height:1.5;">
              <em>Please collect the courier from your designated department at your earliest convenience.</em>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding:14px 24px;color:#6b7280;font-size:12px;border-top:1px solid #e5e7eb;">
              For any discrepancies or questions, please contact the Courier Desk immediately. <br><br>
              © ${new Date().getFullYear()} Courier Management System
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
              `
            };

            await transporter.sendMail(mailOptions);
          }
        } catch (emailError) {
          console.error('Error sending received courier notification email:', emailError);
          // Don't fail the courier creation if email fails
        }
      }
      
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


  // Update received courier status and send email notification
  app.post('/api/received-couriers/:id/dispatch', authenticateToken, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = req.user.id;
      
      // Get the received courier
      const courier = await storage.getReceivedCourierById(id);
      if (!courier) {
        return res.status(404).json({ message: "Received courier not found" });
      }

      // Check if email exists
      if (!(courier as any).emailId) {
        return res.status(400).json({ message: "No email address found for this courier" });
      }

      // Generate secure confirmation token
      const confirmationToken = Buffer.from(`${id}-${Date.now()}-${Math.random()}`).toString('base64url');
      
      // Update status to dispatched and save token
      const updatedCourier = await storage.updateReceivedCourier(id, { 
        status: 'dispatched' as any,
        confirmationToken: confirmationToken
      });

      // Send email notification
      try {
        const smtpSettings = await storage.getSmtpSettings();
        if (smtpSettings && smtpSettings.host && smtpSettings.username && smtpSettings.password) {
          const transportConfig: any = {
            host: smtpSettings.host,
            port: smtpSettings.port || 587,
            auth: {
              user: smtpSettings.username,
              pass: smtpSettings.password,
            }
          };

          if (smtpSettings.useSSL) {
            transportConfig.secure = true;
          } else if (smtpSettings.useTLS) {
            transportConfig.secure = false;
            transportConfig.requireTLS = true;
          } else {
            transportConfig.secure = false;
          }

          const transporter = nodemailer.createTransport(transportConfig);

          const mailOptions: any = {
            from: smtpSettings.fromEmail || smtpSettings.username,
            to: (courier as any).emailId,
            subject: 'Courier Dispatched - Courier Management System',
            html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width" />
  <title>Courier Dispatched</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f8;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f4f6f8;">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;font-family:Segoe UI,Arial,Helvetica,sans-serif;">
          
          <!-- Header -->
          <tr>
            <td style="background:#16a34a;color:#fff;padding:18px 24px;font-size:18px;font-weight:600;">
              Courier Dispatched ✅
            </td>
          </tr>
          
          <!-- Intro -->
          <tr>
            <td style="padding:20px 24px;color:#111827;font-size:14px;line-height:1.5;">
              Dear ${(courier as any).receiverName || 'Team'},<br><br>
              This is to notify you that the courier with POD Number <strong>${courier.podNumber}</strong> 
              has been <strong>dispatched back</strong> from our office.
            </td>
          </tr>
          
          <!-- Details Table -->
          <tr>
            <td style="padding:0 24px 12px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:10px;">
                <tr>
                  <td style="padding:12px 16px;background:#f9fafb;font-weight:600;font-size:13px;">
                    Dispatch Details
                  </td>
                </tr>
                <tr>
                  <td style="padding:12px 16px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;color:#374151;">
                      <tr>
                        <td style="padding:4px 0;font-weight:600;">POD Number:</td>
                        <td style="padding:4px 0;">${courier.podNumber}</td>
                      </tr>
                      <tr>
                        <td style="padding:4px 0;font-weight:600;">Received Date:</td>
                        <td style="padding:4px 0;">${courier.receivedDate ? new Date(courier.receivedDate + 'T00:00:00').toLocaleDateString() : 'N/A'}</td>
                      </tr>
                      <tr>
                        <td style="padding:4px 0;font-weight:600;">From Location:</td>
                        <td style="padding:4px 0;">${courier.fromLocation}</td>
                      </tr>
                      <tr>
                        <td style="padding:4px 0;font-weight:600;">Courier Vendor:</td>
                        <td style="padding:4px 0;">${courier.courierVendor === 'Others' && (courier as any).customVendor ? (courier as any).customVendor : courier.courierVendor}</td>
                      </tr>
                      <tr>
                        <td style="padding:4px 0;font-weight:600;">Status:</td>
                        <td style="padding:4px 0;"><span style="background:#dcfce7;color:#166534;padding:2px 8px;border-radius:4px;font-size:12px;">DISPATCHED</span></td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Received Button -->
          <tr>
            <td style="padding:20px 24px;text-align:center;">
              <a href="${process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : 'http://localhost:5000'}/api/received-couriers/confirm-received?token=${confirmationToken}" 
                 style="display:inline-block;background:#16a34a;color:#fff;padding:12px 32px;text-decoration:none;border-radius:8px;font-weight:600;font-size:16px;">
                ✅ Click Here to Confirm Received
              </a>
              <br><br>
              <p style="color:#6b7280;font-size:12px;margin:0;">
                Click the button above when you have received the courier to update the status automatically.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding:20px 24px;color:#6b7280;font-size:12px;border-top:1px solid #e5e7eb;">
              This is an automated message from the Courier Management System.<br>
              Please contact us if you have any questions.
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
          };

          // Add POD attachment if available for received courier dispatch emails
          // Note: Received couriers don't typically have POD attachments, but if they do, include them
          if ((courier as any).podCopyPath) {
            try {
              const fs = await import('fs');
              const path = await import('path');
              const attachmentPath = path.join(process.cwd(), 'uploads', (courier as any).podCopyPath);
              
              // Check if file exists before adding as attachment
              if (fs.existsSync(attachmentPath)) {
                mailOptions.attachments = [{
                  filename: (courier as any).podCopyPath,
                  path: attachmentPath,
                  contentType: 'application/pdf'
                }];
              }
            } catch (error) {
              console.error('Error adding POD attachment to received courier dispatch email:', error);
            }
          }

          await transporter.sendMail(mailOptions);
          
          // Log audit with email tracking
          await logAudit(userId, 'DISPATCH_EMAIL', 'received_courier', `${id} (${(courier as any).emailId})`, (courier as any).emailId);
          
          res.json({ 
            message: "Status updated to dispatched and email notification sent successfully",
            courier: updatedCourier
          });
        } else {
          // Update status but note email couldn't be sent
          res.json({ 
            message: "Status updated to dispatched but email notification could not be sent (SMTP not configured)",
            courier: updatedCourier
          });
        }
      } catch (emailError) {
        console.error("Error sending dispatch email:", emailError);
        res.json({ 
          message: "Status updated to dispatched but email notification failed",
          courier: updatedCourier
        });
      }
    } catch (error) {
      console.error("Error dispatching received courier:", error);
      res.status(500).json({ message: "Failed to dispatch courier" });
    }
  });


  // Fields routes
  app.get('/api/fields', authenticateToken, requireRole(['admin', 'sub_admin']), async (req: any, res) => {
    try {
      const fields = await storage.getAllFields();
      res.json(fields);
    } catch (error) {
      console.error("Error fetching fields:", error);
      res.status(500).json({ message: "Failed to fetch fields" });
    }
  });

  app.post('/api/fields', authenticateToken, requireRole(['admin', 'sub_admin']), setCurrentUser(), async (req: any, res) => {
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
  app.get('/api/smtp-settings', authenticateToken, requireRole(['admin', 'sub_admin']), async (req: any, res) => {
    try {
      const settings = await storage.getSmtpSettings();
      res.json(settings || {});
    } catch (error) {
      console.error("Error fetching SMTP settings:", error);
      res.status(500).json({ message: "Failed to fetch SMTP settings" });
    }
  });

  app.put('/api/smtp-settings', authenticateToken, requireRole(['admin', 'sub_admin']), setCurrentUser(), async (req: any, res) => {
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
  app.get('/api/audit-logs', authenticateToken, requireRole(['admin', 'sub_admin']), async (req: any, res) => {
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
  app.get('/api/audit-logs/export', authenticateToken, requireRole(['admin', 'sub_admin']), setCurrentUser(), async (req: any, res) => {
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
  app.get('/api/user-policies', authenticateToken, requireRole(['admin', 'sub_admin']), async (req: any, res) => {
    try {
      const policies = await storage.getAllUserPolicies();
      res.json(policies);
    } catch (error) {
      console.error("Error fetching user policies:", error);
      res.status(500).json({ message: "Failed to fetch user policies" });
    }
  });

  // Get current user's accessible tabs based on their department policies
  app.get('/api/user-permissions', authenticateToken, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Admin users have access to all tabs
      if (user.role === 'admin') {
        res.json({
          accessibleTabs: ['branches', 'couriers', 'authority_letters', 'received_couriers', 'view_all_couriers']
        });
        return;
      }

      // For non-admin users, check their department policies
      const accessibleTabs = [];
      const tabsToCheck = ['branches', 'couriers', 'authority_letters', 'received_couriers', 'view_all_couriers'];
      
      if (user.departmentId) {
        for (const tabName of tabsToCheck) {
          try {
            const policy = await storage.getUserPolicy(user.departmentId, tabName);
            if (policy?.isEnabled) {
              accessibleTabs.push(tabName);
            }
          } catch (error) {
            console.error(`Error checking policy for ${tabName}:`, error);
          }
        }
      }

      res.json({ accessibleTabs });
    } catch (error) {
      console.error("Error fetching user permissions:", error);
      res.status(500).json({ message: "Failed to fetch user permissions" });
    }
  });

  app.post('/api/user-policies', authenticateToken, requireRole(['admin', 'sub_admin']), setCurrentUser(), async (req: any, res) => {
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

  app.post('/api/authority-letter-templates', authenticateToken, requireRole(['admin', 'sub_admin']), setCurrentUser(), async (req: any, res) => {
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

  app.put('/api/authority-letter-templates/:id', authenticateToken, requireRole(['admin', 'sub_admin']), setCurrentUser(), async (req: any, res) => {
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

  app.delete('/api/authority-letter-templates/:id', authenticateToken, requireRole(['admin', 'sub_admin']), setCurrentUser(), async (req: any, res) => {
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
      let templateId: number | undefined = undefined;
      
      // Handle template filtering from query parameter
      const queryTemplateId = req.query.templateId;
      if (queryTemplateId) {
        templateId = parseInt(queryTemplateId);
      } else {
        // Handle department filtering from query parameter for backward compatibility
        const queryDepartmentId = req.query.departmentId;
        if (queryDepartmentId) {
          departmentId = parseInt(queryDepartmentId);
        } else if (user.role !== 'admin') {
          // Non-admin users can only see their department's fields
          departmentId = user.departmentId;
        }
      }
      
      const fields = await storage.getAllAuthorityLetterFields(departmentId, templateId);
      res.json(fields);
    } catch (error) {
      console.error("Error fetching authority letter fields:", error);
      res.status(500).json({ message: "Failed to fetch fields" });
    }
  });

  app.post('/api/authority-letter-fields', authenticateToken, requireRole(['admin', 'sub_admin']), setCurrentUser(), async (req: any, res) => {
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

  // Reorder authority letter fields (must come before /:id route)
  app.put('/api/authority-letter-fields/reorder', authenticateToken, requireRole(['admin', 'sub_admin']), setCurrentUser(), async (req: any, res) => {
    try {
      const { fieldId, direction, templateId } = req.body;
      
      if (!fieldId || !direction || !templateId) {
        return res.status(400).json({ message: "Field ID, direction, and template ID are required" });
      }

      // Convert fieldId and templateId to numbers to ensure proper comparison
      const numericFieldId = typeof fieldId === 'number' ? fieldId : parseInt(fieldId);
      const numericTemplateId = typeof templateId === 'number' ? templateId : parseInt(templateId);
      
      if (isNaN(numericFieldId) || isNaN(numericTemplateId)) {
        return res.status(400).json({ message: "Invalid field ID or template ID" });
      }

      // Get all fields for this template in current order
      const fields = await storage.getAllAuthorityLetterFields(undefined, numericTemplateId);
      const currentIndex = fields.findIndex(f => f.id === numericFieldId);
      
      if (currentIndex === -1) {
        return res.status(404).json({ message: "Field not found" });
      }

      let newIndex = currentIndex;
      if (direction === 'up' && currentIndex > 0) {
        newIndex = currentIndex - 1;
      } else if (direction === 'down' && currentIndex < fields.length - 1) {
        newIndex = currentIndex + 1;
      }

      if (newIndex !== currentIndex) {
        // Swap sort orders
        const currentField = fields[currentIndex];
        const targetField = fields[newIndex];
        
        await storage.updateAuthorityLetterField(currentField.id, { 
          sortOrder: targetField.sortOrder || newIndex 
        });
        await storage.updateAuthorityLetterField(targetField.id, { 
          sortOrder: currentField.sortOrder || currentIndex 
        });
      }
      
      await logAudit(req.currentUser.id, 'UPDATE', 'authority_letter_field_order', numericFieldId);
      
      res.json({ message: "Field order updated successfully" });
    } catch (error) {
      console.error("Error reordering fields:", error);
      res.status(500).json({ message: "Failed to reorder fields" });
    }
  });

  // Update authority letter field
  app.put('/api/authority-letter-fields/:id', authenticateToken, requireRole(['admin', 'sub_admin']), setCurrentUser(), async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid field ID" });
      }

      const validatedData = insertAuthorityLetterFieldSchema.partial().parse(req.body);
      const field = await storage.updateAuthorityLetterField(id, validatedData);
      
      if (!field) {
        return res.status(404).json({ message: "Field not found" });
      }
      
      await logAudit(req.currentUser.id, 'UPDATE', 'authority_letter_field', id);
      
      res.json(field);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Error updating authority letter field:", error);
      res.status(500).json({ message: "Failed to update field" });
    }
  });

  // Delete authority letter field
  app.delete('/api/authority-letter-fields/:id', authenticateToken, requireRole(['admin', 'sub_admin']), setCurrentUser(), async (req: any, res) => {
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
      
      // Create field configurations for transformations
      const fieldConfigs: Record<string, any> = {};
      fields.forEach(field => {
        fieldConfigs[field.fieldName] = {
          fieldType: field.fieldType,
          textTransform: field.textTransform,
          numberFormat: field.numberFormat,
          dateFormat: field.dateFormat
        };
      });

      // Generate preview content that matches the actual letter format
      let dateValue = fieldValues['Currunt Date'] || '##Currunt Date##';
      if (fieldValues['Currunt Date'] && typeof fieldValues['Currunt Date'] === 'string' && fieldValues['Currunt Date'].match(/^\\d{4}-\\d{2}-\\d{2}$/)) {
        const [year, month, day] = fieldValues['Currunt Date'].split('-');
        dateValue = `${day}-${month}-${year}`;
      }
      
      // Process all field values with proper transformations
      const processedValues = FieldTransformations.transformAllFields(fieldValues || {}, fieldConfigs);
      
      // Get formatted values for template replacement
      const addressValue = processedValues['Address'] || fieldValues['Address'] || '##Address##';
      const assetNameValue = processedValues['Asset Name'] || fieldValues['Asset Name'] || '##Asset Name##';
      const valueValue = processedValues['Value'] || fieldValues['Value'] || '##Value##';
      
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

      // Create field configurations for transformations
      const fieldConfigs: Record<string, any> = {};
      fields.forEach(field => {
        fieldConfigs[field.fieldName] = {
          fieldType: field.fieldType,
          textTransform: field.textTransform,
          numberFormat: field.numberFormat,
          dateFormat: field.dateFormat
        };
      });

      // Generate PDF using the PDFGenerator with field configurations
      const pdfBuffer = await PDFGenerator.generatePDF({
        templateContent: htmlTemplate,
        fieldValues: fieldValues || {},
        fieldConfigs: fieldConfigs,
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
      
      // Check if template has Word document
      if (template.wordTemplateUrl && fs.existsSync(template.wordTemplateUrl)) {
        // Use Word template generation
        console.log(`Generating Word document from template: ${template.wordTemplateUrl}`);
        
        // Get the authority letter fields for this template to understand expected field names
        const templateFields = await storage.getAllAuthorityLetterFields(undefined, templateId);
        console.log('Template fields from database:', templateFields.map(f => ({ fieldName: f.fieldName, fieldLabel: f.fieldLabel })));
        console.log('Field values received:', fieldValues);

        // Create field configurations for transformations
        const fieldConfigs: Record<string, any> = {};
        templateFields.forEach(field => {
          fieldConfigs[field.fieldName] = {
            fieldType: field.fieldType,
            textTransform: field.textTransform,
            numberFormat: field.numberFormat,
            dateFormat: field.dateFormat
          };
        });
        
        console.log('Field configurations:', fieldConfigs);

        // Use the new Word generator with field configurations
        const wordBuffer = await WordGenerator.generateWordDocument({
          templatePath: template.wordTemplateUrl,
          fieldValues: fieldValues || {},
          fieldConfigs: fieldConfigs
        });

        await logAudit(user.id, 'CREATE', 'authority_letter_word', template.id.toString());
        
        // Set headers for Word document download
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename="authority_letter_${template.templateName}_${Date.now()}.docx"`);
        res.setHeader('Content-Length', wordBuffer.length);
        
        return res.send(wordBuffer);
      } else {
        // Fallback: Convert HTML template to Word document
        console.log('Converting HTML template to Word document');
        
        // Replace placeholders in template content
        let content = template.templateContent;
        
        // Replace ##field## placeholders with actual values
        for (const [fieldName, value] of Object.entries(fieldValues || {})) {
          const placeholder = `##${fieldName}##`;
          content = content.replace(new RegExp(placeholder, 'g'), value as string);
        }
        
        // Add current date
        content = content.replace(/##Current Date##/g, new Date().toLocaleDateString());
        
        // Convert HTML to Word document using mammoth (reverse conversion)
        // Since mammoth only converts Word to HTML, we'll create a simple Word-like document
        const wordContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Authority Letter</title>
    <style>
        body { font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.5; margin: 1in; }
        h1, h2, h3 { font-weight: bold; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #000; padding: 8px; text-align: left; }
    </style>
</head>
<body>
${content}
</body>
</html>`;
        
        // Create a simple Word document structure using JSZip
        const zip = new PizZip();
        
        // Add the main document content
        const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:r>
        <w:t>${content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()}</w:t>
      </w:r>
    </w:p>
  </w:body>
</w:document>`;
        
        zip.file("word/document.xml", documentXml);
        
        // Add required Word document structure files
        zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`);
        
        zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);
        
        zip.folder("word")?.file("_rels/document.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
</Relationships>`);
        
        // Generate the Word document
        const wordBuffer = await zip.generateAsync({
          type: 'nodebuffer',
          compression: 'DEFLATE'
        });
        
        await logAudit(user.id, 'CREATE', 'authority_letter_word', template.id.toString());
        
        // Set headers for Word document download
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename="authority_letter_${template.templateName}_${Date.now()}.docx"`);
        res.setHeader('Content-Length', wordBuffer.length);
        
        return res.send(wordBuffer);
      }
    } catch (error) {
      console.error("Error generating Word document:", error);
      res.status(500).json({ message: "Failed to generate Word document" });
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
  app.post('/api/authority-templates', authenticateToken, requireRole(['admin', 'sub_admin']), async (req: any, res) => {
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
  app.put('/api/authority-templates/:id', authenticateToken, requireRole(['admin', 'sub_admin']), async (req: any, res) => {
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
  app.delete('/api/authority-templates/:id', authenticateToken, requireRole(['admin', 'sub_admin']), async (req: any, res) => {
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

  // Upload Word template to authority letter template
  app.post('/api/authority-templates/:id/upload-word', authenticateToken, requireRole(['admin', 'sub_admin']), documentUpload.single('wordTemplate'), setCurrentUser(), async (req: any, res) => {
    try {
      const templateId = parseInt(req.params.id);
      const file = req.file;
      const user = req.currentUser;
      
      if (!file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      
      // Get the template to verify it exists
      const template = await storage.getAuthorityLetterTemplate(templateId);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }
      
      // Create a proper filename with extension
      const originalExtension = path.extname(file.originalname);
      const newFilename = `authority_word_template_${templateId}_${Date.now()}${originalExtension}`;
      const newFilePath = path.join(uploadDir, newFilename);
      
      // Move file to new location with proper name
      fs.renameSync(file.path, newFilePath);
      
      // Convert Word document to HTML for preview
      let htmlContent = '<p>Word document uploaded but conversion failed</p>';
      try {
        const result = await mammoth.convertToHtml({path: newFilePath});
        htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Authority Letter Template</title>
    <style>
        body {
            font-family: 'Times New Roman', serif;
            font-size: 12px;
            line-height: 1.4;
            margin: 0;
            padding: 20px;
            color: #000;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 10px 0;
        }
        th, td {
            border: 1px solid #000;
            padding: 6px;
            text-align: left;
        }
        th {
            background-color: #f0f0f0;
            font-weight: bold;
        }
        @media print {
            body { margin: 0; padding: 15px; }
        }
    </style>
</head>
<body>
${result.value}
</body>
</html>`;
        console.log('Word document converted to HTML successfully');
      } catch (conversionError) {
        console.error('Failed to convert Word document to HTML:', conversionError);
      }
      
      // Update template with Word document path AND converted HTML content
      const updatedTemplate = await storage.updateAuthorityLetterTemplate(templateId, {
        wordTemplateUrl: newFilePath,
        templateContent: htmlContent
      });
      
      if (!updatedTemplate) {
        return res.status(404).json({ message: "Failed to update template" });
      }
      
      await logAudit(user.id, 'UPLOAD', 'authority_word_template', templateId.toString());
      
      res.json({ 
        message: "Word template uploaded successfully",
        wordTemplatePath: newFilePath,
        template: updatedTemplate 
      });
    } catch (error) {
      console.error("Error uploading Word template:", error);
      res.status(500).json({ message: "Failed to upload Word template" });
    }
  });

  // Extract content from Word document for new templates
  app.post('/api/authority-templates/extract-word-content', authenticateToken, documentUpload.single('wordDocument'), setCurrentUser(), async (req: any, res) => {
    try {
      console.log('Word extraction request received');
      const file = req.file;
      
      if (!file) {
        console.log('No file uploaded in request');
        return res.status(400).json({ message: "No file uploaded" });
      }
      
      console.log('File received:', file.originalname, 'Size:', file.size);
      
      // Convert Word document to HTML
      let htmlContent = '<p>Word document uploaded but conversion failed</p>';
      try {
        const result = await mammoth.convertToHtml({path: file.path});
        htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Authority Letter Template</title>
    <style>
        body {
            font-family: 'Times New Roman', serif;
            font-size: 12px;
            line-height: 1.4;
            margin: 0;
            padding: 20px;
            color: #000;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 10px 0;
        }
        th, td {
            border: 1px solid #000;
            padding: 6px;
            text-align: left;
        }
        th {
            background-color: #f0f0f0;
            font-weight: bold;
        }
        @media print {
            body { margin: 0; padding: 15px; }
        }
    </style>
</head>
<body>
${result.value}
</body>
</html>`;
        console.log('Word document converted to HTML successfully for new template');
      } catch (conversionError) {
        console.error('Failed to convert Word document to HTML:', conversionError);
        return res.status(500).json({ message: "Failed to convert Word document to HTML" });
      }
      
      // Clean up the temporary file
      try {
        fs.unlinkSync(file.path);
      } catch (cleanupError) {
        console.error('Failed to clean up temporary file:', cleanupError);
      }
      
      res.json({ 
        message: "Word document content extracted successfully",
        htmlContent: htmlContent
      });
    } catch (error) {
      console.error("Error extracting Word document content:", error);
      res.status(500).json({ message: "Failed to extract Word document content" });
    }
  });

  // Generate PDF authority letter (smart routing based on template type)
  app.post('/api/authority-letter/generate-template', authenticateToken, setCurrentUser(), async (req: any, res) => {
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
      
      let pdfBuffer: Buffer;
      
      // Check if template has Word document
      if (template.wordTemplateUrl && fs.existsSync(template.wordTemplateUrl)) {
        // Use Word template generation
        console.log(`Using Word template: ${template.wordTemplateUrl}`);
        
        // Read the Word document
        const content = fs.readFileSync(template.wordTemplateUrl, 'binary');
        const zip = new PizZip(content);
        const doc = new Docxtemplater(zip, {
          paragraphLoop: true,
          linebreaks: true,
          delimiters: {
            start: '##',
            end: '##'
          }
        });
        
        // Prepare data for template replacement
        const templateData: any = {
          currentDate: new Date().toLocaleDateString('en-GB'),
          departmentName: template.templateName,
          generatedAt: new Date().toISOString()
        };
        
        // Add field values
        for (const [fieldName, value] of Object.entries(fieldValues || {})) {
          templateData[fieldName] = value;
        }
        
        // Render the document
        doc.setData(templateData);
        doc.render();
        
        // Generate Word document buffer
        const wordBuffer = doc.getZip().generate({
          type: 'nodebuffer',
          compression: 'DEFLATE',
        });
        
        // Convert Word to PDF using pandoc or return Word document
        // For now, we'll return the Word document
        await logAudit(user.id, 'CREATE', 'authority_letter_word', template.id.toString());
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename="authority_letter_${template.templateName}_${Date.now()}.docx"`);
        res.setHeader('Content-Length', wordBuffer.length);
        
        return res.send(wordBuffer);
      } else {
        // Use HTML template generation
        console.log('Using HTML template generation');
        
        pdfBuffer = await PDFGenerator.generatePDF({
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
      }
    } catch (error) {
      console.error("Error generating authority letter:", error);
      res.status(500).json({ message: "Failed to generate authority letter" });
    }
  });

  // Generate PDF authority letter (legacy HTML only)
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
  app.post('/api/authority-letter/preview', authenticateToken, setCurrentUser(), async (req: any, res) => {
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
      
      // Get template fields for proper transformations
      const fields = await storage.getAllAuthorityLetterFields(undefined, templateId);
      
      // Create field configurations for transformations
      const fieldConfigs: Record<string, any> = {};
      fields.forEach(field => {
        fieldConfigs[field.fieldName] = {
          fieldType: field.fieldType,
          textTransform: field.textTransform,
          numberFormat: field.numberFormat,
          dateFormat: field.dateFormat
        };
      });
      
      // Process all field values with proper transformations
      const processedValues = FieldTransformations.transformAllFields(fieldValues || {}, fieldConfigs);
      
      // Replace placeholders for preview
      let htmlContent = template.templateContent;
      
      // Apply processed field values with transformations
      Object.entries(processedValues).forEach(([key, value]) => {
        const placeholder = `##${key}##`;
        htmlContent = htmlContent.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value as string);
      });
      
      // Add current date
      const currentDate = new Date().toLocaleDateString('en-GB');
      htmlContent = htmlContent.replace(/##currentDate##/g, currentDate);
      htmlContent = htmlContent.replace(/##current_date##/g, currentDate);
      
      res.json({
        content: htmlContent,
        templateName: template.templateName
      });
    } catch (error) {
      console.error("Error generating preview:", error);
      res.status(500).json({ message: "Failed to generate preview" });
    }
  });

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

  // ============= USER DEPARTMENT MANAGEMENT ROUTES =============

  app.get('/api/users/:id/departments', authenticateToken, requireRole(['admin', 'sub_admin']), async (req: any, res) => {
    try {
      const userId = req.params.id;
      const departments = await storage.getUserDepartments(userId);
      res.json(departments);
    } catch (error) {
      console.error("Error fetching user departments:", error);
      res.status(500).json({ message: "Failed to fetch user departments" });
    }
  });

  app.post('/api/users/:id/departments', authenticateToken, requireRole(['admin', 'sub_admin']), setCurrentUser(), async (req: any, res) => {
    try {
      const userId = req.params.id;
      const { departmentIds } = req.body;
      
      if (!Array.isArray(departmentIds)) {
        return res.status(400).json({ message: "departmentIds must be an array" });
      }

      await storage.assignUserToDepartments(userId, departmentIds);
      await logAudit(req.currentUser.id, 'UPDATE', 'user_departments', userId);
      
      res.json({ message: "User departments updated successfully" });
    } catch (error) {
      console.error("Error updating user departments:", error);
      res.status(500).json({ message: "Failed to update user departments" });
    }
  });

  // ============= SMTP SETTINGS ROUTES =============
  
  app.get('/api/smtp-settings', authenticateToken, requireRole(['admin', 'sub_admin']), async (req: any, res) => {
    try {
      const settings = await storage.getSmtpSettings();
      res.json(settings || {});
    } catch (error) {
      console.error("Error fetching SMTP settings:", error);
      res.status(500).json({ message: "Failed to fetch SMTP settings" });
    }
  });

  app.post('/api/smtp-settings', authenticateToken, requireRole(['admin', 'sub_admin']), setCurrentUser(), async (req: any, res) => {
    try {
      const { host, port, username, password, useTLS, useSSL, fromEmail, applicationUrl } = req.body;
      
      const smtpData = {
        host: host?.trim(),
        port: parseInt(port) || 587,
        username: username?.trim(),
        password: password?.trim(),
        useTLS: Boolean(useTLS),
        useSSL: Boolean(useSSL),
        fromEmail: fromEmail?.trim(),
        applicationUrl: applicationUrl?.trim()
      };

      const settings = await storage.updateSmtpSettings(smtpData);
      await logAudit(req.currentUser.id, 'UPDATE', 'smtp_settings', settings.id);
      
      res.json({ message: "SMTP settings saved successfully", settings });
    } catch (error) {
      console.error("Error saving SMTP settings:", error);
      res.status(500).json({ message: "Failed to save SMTP settings" });
    }
  });

  app.post('/api/smtp-settings/test', authenticateToken, requireRole(['admin', 'sub_admin']), async (req: any, res) => {
    try {
      const { testEmail } = req.body;
      
      if (!testEmail || !testEmail.includes('@')) {
        return res.status(400).json({ message: "Valid test email is required" });
      }

      // Get current SMTP settings
      const smtpSettings = await storage.getSmtpSettings();
      if (!smtpSettings || !smtpSettings.host || !smtpSettings.username || !smtpSettings.password) {
        return res.status(400).json({ message: "SMTP settings incomplete. Please configure host, username, and password." });
      }

      // Create transporter with the saved settings
      const transportConfig: any = {
        host: smtpSettings.host,
        port: smtpSettings.port || 587,
        auth: {
          user: smtpSettings.username,
          pass: smtpSettings.password,
        }
      };

      // Configure TLS/SSL based on port and settings
      const port = smtpSettings.port || 587;
      
      if (port === 465 || smtpSettings.useSSL) {
        // SSL mode (port 465)
        transportConfig.secure = true;
        transportConfig.tls = {
          rejectUnauthorized: false
        };
      } else if (port === 587 || smtpSettings.useTLS || port === 25) {
        // TLS mode (port 587) - STARTTLS
        transportConfig.secure = false;
        transportConfig.tls = {
          rejectUnauthorized: false, // Allow self-signed certificates
          ciphers: 'TLSv1.2',
          minVersion: 'TLSv1.2'
        };
      } else {
        // No encryption fallback
        transportConfig.secure = false;
        transportConfig.ignoreTLS = true;
        transportConfig.tls = {
          rejectUnauthorized: false
        };
      }

      const transporter = nodemailer.createTransport(transportConfig);

      // Verify connection configuration
      await transporter.verify();

      // Send test email
      const mailOptions = {
        from: smtpSettings.fromEmail || smtpSettings.username,
        to: testEmail,
        subject: 'Courier Management System - SMTP Test Email',
        html: `
          <h2>SMTP Configuration Test</h2>
          <p>This is a test email from your Courier Management System.</p>
          <p>If you received this email, your SMTP configuration is working correctly!</p>
          <p><strong>Test details:</strong></p>
          <ul>
            <li>Host: ${smtpSettings.host}</li>
            <li>Port: ${smtpSettings.port}</li>
            <li>TLS: ${smtpSettings.useTLS ? 'Enabled' : 'Disabled'}</li>
            <li>SSL: ${smtpSettings.useSSL ? 'Enabled' : 'Disabled'}</li>
            <li>Test sent at: ${new Date().toLocaleString()}</li>
          </ul>
          <p>Thank you!</p>
        `
      };

      await transporter.sendMail(mailOptions);

      res.json({ 
        message: `Test email sent successfully to ${testEmail}`,
        success: true 
      });
    } catch (error: any) {
      console.error("Error sending test email:", error);
      
      let errorMessage = "Failed to send test email";
      if (error.code === 'EAUTH') {
        errorMessage = "Authentication failed. Please check your username and password.";
      } else if (error.code === 'ECONNECTION') {
        errorMessage = "Connection failed. Please check your SMTP host and port.";
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      res.status(500).json({ message: errorMessage });
    }
  });

  // 24-hour reminder email system
  async function sendReminderEmails() {
    try {
      const overdueCouriers = await storage.getOverdueCouriers();
      console.log(`Checking for overdue couriers: ${overdueCouriers.length} found`);
      
      if (overdueCouriers.length === 0) {
        return;
      }

      const smtpSettings = await storage.getSmtpSettings();
      if (!smtpSettings || !smtpSettings.host || !smtpSettings.username || !smtpSettings.password) {
        console.log('SMTP settings not configured, skipping reminder emails');
        return;
      }

      const transportConfig: any = {
        host: smtpSettings.host,
        port: smtpSettings.port || 587,
        auth: {
          user: smtpSettings.username,
          pass: smtpSettings.password,
        }
      };

      if (smtpSettings.useSSL) {
        transportConfig.secure = true;
      } else if (smtpSettings.useTLS) {
        transportConfig.secure = false;
        transportConfig.requireTLS = true;
      } else {
        transportConfig.secure = false;
      }

      const transporter = nodemailer.createTransport(transportConfig);

      for (const courier of overdueCouriers) {
        if (!courier.email) continue;
        
        try {
          const mailOptions: any = {
            from: smtpSettings.fromEmail || smtpSettings.username,
            to: courier.email,
            cc: courier.contactDetails,
            subject: 'Courier Status Reminder - 24 Hours Overdue',
            html: `
              <!DOCTYPE html>
              <html lang="en">
              <head>
                <meta charset="UTF-8" />
                <meta name="viewport" content="width=device-width" />
                <title>Courier Status Reminder</title>
              </head>
              <body style="margin:0;padding:0;background:#f4f6f8;">
                <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f4f6f8;">
                  <tr>
                    <td align="center" style="padding:24px 12px;">
                      <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;font-family:Segoe UI,Arial,Helvetica,sans-serif;">
                        <tr>
                          <td style="background:#dc2626;color:#fff;padding:18px 24px;font-size:18px;font-weight:600;">
                            Courier Management System • Status Update Reminder
                          </td>
                        </tr>
                        <tr>
                          <td style="padding:20px 24px;color:#111827;font-size:14px;line-height:1.5;">
                            Dear ${courier.receiverName || 'Team'},<br><br>
                            This is a reminder that a courier sent to you <strong>24 hours ago</strong> has not been marked as delivered yet.
                            <br><br>
                            <strong>Courier Details:</strong><br>
                            POD Number: ${courier.podNo}<br>
                            Sent Date: ${courier.courierDate}<br>
                            From: ${courier.department?.name || 'N/A'}<br>
                            Details: ${courier.details}<br>
                            <br>
                            Please confirm receipt or contact us if there are any issues with the delivery.
                            <br><br>
                            Thank you for your cooperation.
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </body>
              </html>
            `
          };

          // Add POD attachment if available for reminder emails
          if (courier.podCopyPath) {
            try {
              const fs = await import('fs');
              const path = await import('path');
              const attachmentPath = path.join(process.cwd(), 'uploads', courier.podCopyPath);
              
              // Check if file exists before adding as attachment
              if (fs.existsSync(attachmentPath)) {
                mailOptions.attachments = [{
                  filename: courier.podCopyPath,
                  path: attachmentPath,
                  contentType: 'application/pdf'
                }];
              }
            } catch (error) {
              console.error('Error adding POD attachment to reminder email:', error);
            }
          }

          await transporter.sendMail(mailOptions);
          await storage.markReminderEmailSent(courier.id);
          console.log(`Reminder email sent for courier ID: ${courier.id}`);
          
        } catch (emailError) {
          console.error(`Failed to send reminder email for courier ID ${courier.id}:`, emailError);
        }
      }
    } catch (error) {
      console.error('Error in reminder email system:', error);
    }
  }

  // API endpoint to manually trigger reminder email check
  app.post('/api/couriers/send-reminders', authenticateToken, requireRole(['admin', 'sub_admin']), async (req: any, res) => {
    try {
      await sendReminderEmails();
      res.json({ message: "Reminder emails checked and sent if needed" });
    } catch (error) {
      console.error("Error sending reminder emails:", error);
      res.status(500).json({ message: "Failed to send reminder emails" });
    }
  });

  // Set up periodic reminder email checks (every 2 hours)
  setInterval(sendReminderEmails, 2 * 60 * 60 * 1000);
  console.log('24-hour reminder email system initialized - checking every 2 hours');

  const httpServer = createServer(app);
  return httpServer;
}
