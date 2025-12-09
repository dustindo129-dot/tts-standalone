import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import ttsRoutes from './routes/tts.js';
import authRoutes from './routes/auth.js';
import historyRoutes from './routes/history.js';
import { initializeTTSService } from './services/ttsService.js';
import { initializeDatabase } from './db/database.js';

// Load environment variables
dotenv.config();

// Environment variables loaded successfully

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middleware
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173', // Vite default port
    credentials: true
}));

app.use(express.json({ limit: '50mb' })); // Increase limit for large text inputs
app.use(express.urlencoded({ extended: true }));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Serve TTS cache files with proper headers
app.use('/tts-cache', (req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    res.header('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
    next();
}, express.static(path.join(__dirname, 'public', 'tts-cache')));

// API routes
app.use('/api/tts', ttsRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/history', historyRoutes);


// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route not found'
    });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('Error:', err.message);
    res.status(500).json({
        success: false,
        message: 'Internal server error'
    });
});

// Start server
const PORT = process.env.PORT || 5000;

app.listen(PORT, async () => {
    console.log(`TTS Server running on port ${PORT}`);
    
    // Initialize database
    try {
        await initializeDatabase();
        console.log('Database initialized');
    } catch (error) {
        console.error('Database initialization failed:', error.message);
    }
    
    // Initialize TTS service
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
        try {
            await initializeTTSService();
        } catch (error) {
            console.error('TTS initialization failed:', error.message);
        }
    }
});

export default app;
