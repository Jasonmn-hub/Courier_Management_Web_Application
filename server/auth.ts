import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import type { RequestHandler } from 'express';
import { storage } from './storage';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretjwt';

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
}

export const hashPassword = async (password: string): Promise<string> => {
  return await bcrypt.hash(password, 10);
};

export const comparePassword = async (password: string, hash: string): Promise<boolean> => {
  return await bcrypt.compare(password, hash);
};

export const generateToken = (payload: JWTPayload): string => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
};

export const verifyToken = (token: string): JWTPayload | null => {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch (error) {
    return null;
  }
};

export const authenticateToken: RequestHandler = async (req: any, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  const payload = verifyToken(token);
  if (!payload) {
    return res.status(403).json({ message: 'Invalid or expired token' });
  }

  try {
    let user;
    
    // Check if it's a temporary user ID
    if (payload.userId.startsWith('temp_')) {
      // For temp users, create a user object from the token payload
      user = {
        id: payload.userId,
        email: payload.email,
        role: payload.role,
        name: payload.email.split('@')[0], // Use email prefix as name
        firstName: null,
        lastName: null,
        departmentId: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };
    } else {
      // For regular users, fetch from database
      user = await storage.getUser(payload.userId);
      if (!user) {
        return res.status(403).json({ message: 'User not found' });
      }
    }
    
    req.user = user;
    next();
  } catch (error) {
    return res.status(403).json({ message: 'Authentication failed' });
  }
};

export const requireRole = (allowedRoles: string[]) => {
  return async (req: any, res: any, next: any) => {
    try {
      const user = req.user;
      
      if (!user || !allowedRoles.includes(user.role!)) {
        return res.status(403).json({ message: 'Insufficient permissions' });
      }
      
      next();
    } catch (error) {
      res.status(500).json({ message: 'Authorization error' });
    }
  };
};