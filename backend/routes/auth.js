import express from 'express';
import bcrypt from 'bcrypt';
import { body, validationResult } from 'express-validator';
import { userModel } from '../db/database.js';
import { generateToken, authenticateToken } from '../middleware/auth.js';

const router = express.Router();
const SALT_ROUNDS = 10;

// Validation rules
const signupValidation = [
    body('username')
        .trim()
        .isLength({ min: 3, max: 30 })
        .withMessage('Username must be 3-30 characters')
        .matches(/^[a-zA-Z0-9]+$/)
        .withMessage('Username can only contain letters and numbers'),
    body('password')
        .isLength({ min: 6 })
        .withMessage('Password must be at least 6 characters')
];

const loginValidation = [
    body('username')
        .trim()
        .isLength({ min: 3, max: 30 })
        .withMessage('Username must be 3-30 characters'),
    body('password')
        .notEmpty()
        .withMessage('Password is required')
];

/**
 * @route POST /api/auth/signup
 * @desc Register a new user
 * @access Public
 */
router.post('/signup', signupValidation, async (req, res) => {
    try {
        // Check validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
        }

        const { username, password } = req.body;

        // Check if user already exists
        const existingUser = await userModel.findByUsername(username);
        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: 'Username already taken'
            });
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

        // Create user
        const userId = await userModel.create(username, passwordHash);

        // Generate token
        const token = generateToken(userId);

        // Get created user (without password)
        const user = await userModel.findById(userId);

        res.status(201).json({
            success: true,
            message: 'User registered successfully',
            token,
            user: {
                id: user.id,
                username: user.username,
                createdAt: user.created_at
            }
        });
    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({
            success: false,
            message: 'Registration failed. Please try again.'
        });
    }
});

/**
 * @route POST /api/auth/login
 * @desc Login user
 * @access Public
 */
router.post('/login', loginValidation, async (req, res) => {
    try {
        // Check validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
        }

        const { username, password } = req.body;

        // Find user by username
        const user = await userModel.findByUsername(username);
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid username or password'
            });
        }

        // Verify password
        const isPasswordValid = await bcrypt.compare(password, user.password_hash);
        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: 'Invalid username or password'
            });
        }

        // Generate token
        const token = generateToken(user.id);

        res.json({
            success: true,
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                username: user.username,
                createdAt: user.created_at
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Login failed. Please try again.'
        });
    }
});

/**
 * @route GET /api/auth/profile
 * @desc Get current user profile
 * @access Private
 */
router.get('/profile', authenticateToken, async (req, res) => {
    try {
        res.json({
            success: true,
            user: req.user
        });
    } catch (error) {
        console.error('Profile fetch error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch profile'
        });
    }
});

/**
 * @route POST /api/auth/logout
 * @desc Logout user (client-side token removal)
 * @access Private
 */
router.post('/logout', authenticateToken, async (req, res) => {
    try {
        // In a JWT-based system, logout is handled client-side by removing the token
        // This endpoint is mainly for consistency and future enhancements (e.g., token blacklisting)
        res.json({
            success: true,
            message: 'Logout successful'
        });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({
            success: false,
            message: 'Logout failed'
        });
    }
});

/**
 * @route POST /api/auth/verify
 * @desc Verify if token is valid
 * @access Public
 */
router.post('/verify', authenticateToken, async (req, res) => {
    try {
        // If middleware passes, token is valid
        res.json({
            success: true,
            valid: true,
            user: req.user
        });
    } catch (error) {
        res.status(401).json({
            success: false,
            valid: false,
            message: 'Invalid token'
        });
    }
});

export default router;

