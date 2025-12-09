import jwt from 'jsonwebtoken';
import { userModel } from '../db/database.js';

// Get JWT secret from environment or use default (should be changed in production)
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';
const JWT_EXPIRES_IN = '7d'; // Token expires in 7 days

// Generate JWT token for user
export const generateToken = (userId) => {
    return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

// Verify JWT token
export const verifyToken = (token) => {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        return null;
    }
};

// Authentication middleware
export const authenticateToken = async (req, res, next) => {
    try {
        // Get token from Authorization header
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Access token required'
            });
        }

        // Verify token
        const decoded = verifyToken(token);
        if (!decoded) {
            return res.status(403).json({
                success: false,
                message: 'Invalid or expired token'
            });
        }

        // Get user from database
        const user = await userModel.findById(decoded.userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Attach user to request object (without password hash)
        req.user = {
            id: user.id,
            username: user.username,
            createdAt: user.created_at
        };

        next();
    } catch (error) {
        console.error('Authentication error:', error);
        res.status(500).json({
            success: false,
            message: 'Authentication failed'
        });
    }
};

// Optional authentication middleware (doesn't fail if no token)
export const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (token) {
            const decoded = verifyToken(token);
            if (decoded) {
                const user = await userModel.findById(decoded.userId);
                if (user) {
                    req.user = {
                        id: user.id,
                        username: user.username,
                        createdAt: user.created_at
                    };
                }
            }
        }

        // Continue regardless of authentication status
        next();
    } catch (error) {
        // Silently fail and continue
        next();
    }
};

export default {
    generateToken,
    verifyToken,
    authenticateToken,
    optionalAuth
};

