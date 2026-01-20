import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import pool from '../config/database.js';
import { LoginRequest, LoginResponse, ApiResponse, JwtPayload } from '../types/index.js';
import { AuthRequest } from '../middleware/auth.js';

const generateToken = (payload: JwtPayload): string => {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('JWT_SECRET not configured');
  }

  const expiresIn = (process.env.JWT_EXPIRES_IN || '7d') as string;
  return jwt.sign(payload, jwtSecret, { expiresIn } as jwt.SignOptions);
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required' });
    }

    // Check if admin login
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (email === adminEmail && password === adminPassword) {
      const token = generateToken({
        userId: 'admin',
        email: adminEmail as string,
        role: 'admin',
      });

      return res.json({
        success: true,
        data: {
          token,
          user: {
            id: 'admin',
            email: adminEmail,
            name: 'Admin',
            role: 'admin',
          },
        },
      });
    }

    // Check ambassador login
    const result = await pool.query(
      'SELECT id, name, email, password_hash, referral_code, status FROM ambassadors WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    const ambassador = result.rows[0];

    if (ambassador.status !== 'active') {
      return res.status(403).json({ success: false, error: 'Account is not active' });
    }

    const isValidPassword = await bcrypt.compare(password, ambassador.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    const token = generateToken({
      userId: ambassador.id,
      email: ambassador.email,
      role: 'ambassador',
    });

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: ambassador.id,
          email: ambassador.email,
          name: ambassador.name,
          role: 'ambassador',
          referralCode: ambassador.referral_code,
        },
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export const logout = async (req: AuthRequest, res: Response) => {
  // Since we're using JWT, logout is handled client-side by removing the token
  res.json({ success: true, message: 'Logged out successfully' });
};

export const refresh = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const token = generateToken({
      userId: req.user.userId,
      email: req.user.email,
      role: req.user.role,
    });

    res.json({ success: true, data: { token } });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export const getMe = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    if (req.user.role === 'admin') {
      return res.json({
        success: true,
        data: {
          id: 'admin',
          email: process.env.ADMIN_EMAIL,
          name: 'Admin',
          role: 'admin',
        },
      });
    }

    // Get ambassador details
    const result = await pool.query(
      'SELECT id, name, email, referral_code, status FROM ambassadors WHERE id = $1',
      [req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const ambassador = result.rows[0];

    res.json({
      success: true,
      data: {
        id: ambassador.id,
        email: ambassador.email,
        name: ambassador.name,
        role: 'ambassador',
        referralCode: ambassador.referral_code,
      },
    });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

