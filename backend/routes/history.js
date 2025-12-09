import express from 'express';
import { audioHistoryModel, conversationHistoryModel } from '../db/database.js';
import { authenticateToken } from '../middleware/auth.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

/**
 * @route GET /api/history
 * @desc Get user's audio generation history (includes both standard and conversation history)
 * @access Private
 */
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { limit = 50, offset = 0, type = 'all' } = req.query;
        const userId = req.user.id;

        let history = [];
        
        if (type === 'all' || type === 'standard') {
            const audioHistory = await audioHistoryModel.findByUserId(
                userId,
                parseInt(limit),
                parseInt(offset)
            );
            // Add type identifier for frontend
            history.push(...audioHistory.map(item => ({ ...item, type: 'standard' })));
        }
        
        if (type === 'all' || type === 'conversation') {
            const conversationHistory = await conversationHistoryModel.findByUserId(
                userId,
                parseInt(limit),
                parseInt(offset)
            );
            // Add type identifier for frontend
            history.push(...conversationHistory.map(item => ({ ...item, type: 'conversation' })));
        }

        // Sort by created_at descending
        history.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        // Apply limit after combining and sorting
        if (type === 'all') {
            history = history.slice(0, parseInt(limit));
        }

        res.json({
            success: true,
            history,
            count: history.length
        });
    } catch (error) {
        console.error('History fetch error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch audio history'
        });
    }
});

/**
 * @route GET /api/history/stats
 * @desc Get user's usage statistics (includes both standard and conversation history)
 * @access Private
 */
router.get('/stats', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        
        // Get stats from both audio_history and conversation_history
        const audioStats = await audioHistoryModel.getUserStats(userId);
        const conversationStats = await conversationHistoryModel.getUserStats(userId);

        // Combine stats from both tables
        const totalGenerations = (audioStats?.total_generations || 0) + (conversationStats?.total_conversations || 0);
        const totalCharacters = (audioStats?.total_characters || 0) + (conversationStats?.total_characters || 0);
        const totalDuration = (audioStats?.total_duration || 0) + (conversationStats?.total_duration || 0);
        
        // Calculate cost using predefined formula (Standard voice rate: $0.000004 per character)
        const costPerCharacter = 0.000004; // $4 per 1M characters for standard voices
        const totalCost = totalCharacters * costPerCharacter;

        res.json({
            success: true,
            stats: {
                totalGenerations: totalGenerations,
                totalCharacters: totalCharacters || 0,
                totalCost: parseFloat((totalCost || 0).toFixed(4)),
                totalDuration: totalDuration || 0
            }
        });
    } catch (error) {
        console.error('Stats fetch error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch statistics'
        });
    }
});

/**
 * @route GET /api/history/:id
 * @desc Get specific audio history item
 * @access Private
 */
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const item = await audioHistoryModel.findById(id);

        if (!item) {
            return res.status(404).json({
                success: false,
                message: 'Audio history not found'
            });
        }

        // Ensure user owns this history item
        if (item.user_id !== userId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        res.json({
            success: true,
            item
        });
    } catch (error) {
        console.error('History item fetch error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch history item'
        });
    }
});

/**
 * @route DELETE /api/history/:id
 * @desc Delete specific audio history item
 * @access Private
 */
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        // Get item before deleting to check ownership and get filename
        const item = await audioHistoryModel.findById(id);

        if (!item) {
            return res.status(404).json({
                success: false,
                message: 'Audio history not found'
            });
        }

        // Ensure user owns this history item
        if (item.user_id !== userId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        // Delete from database
        await audioHistoryModel.deleteById(id, userId);

        // Optionally delete the audio file
        // Note: We might want to keep files for cache purposes
        // If deleting, uncomment below:
        /*
        try {
            const filePath = path.join(__dirname, '..', 'public', 'tts-cache', item.audio_filename);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        } catch (fileError) {
            console.error('File deletion error:', fileError);
        }
        */

        res.json({
            success: true,
            message: 'Audio history deleted successfully'
        });
    } catch (error) {
        console.error('History delete error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete history item'
        });
    }
});

/**
 * @route GET /api/history/period/:period
 * @desc Get usage stats for specific period (day, week, month)
 * @access Private
 */
router.get('/period/:period', authenticateToken, async (req, res) => {
    try {
        const { period } = req.params;
        const userId = req.user.id;

        const now = new Date();
        let startDate;

        switch (period) {
            case 'day':
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                break;
            case 'week':
                const dayOfWeek = now.getDay();
                startDate = new Date(now.getTime() - dayOfWeek * 24 * 60 * 60 * 1000);
                startDate.setHours(0, 0, 0, 0);
                break;
            case 'month':
            default:
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                break;
        }

         // Get stats from both tables for the period
         const audioStats = await audioHistoryModel.getUserStatsForPeriod(userId, startDate.toISOString());
         const conversationStats = await conversationHistoryModel.getUserStatsForPeriod(userId, startDate.toISOString());
         
         const totalGenerations = (audioStats?.total_generations || 0) + (conversationStats?.total_conversations || 0);
         const totalCharacters = (audioStats?.total_characters || 0) + (conversationStats?.total_characters || 0);
         
         // Calculate cost using predefined formula
         const costPerCharacter = 0.000004;
         const totalCost = totalCharacters * costPerCharacter;

         res.json({
             success: true,
             period,
             stats: {
                 totalGenerations: totalGenerations,
                 totalCharacters: totalCharacters,
                 totalCost: parseFloat(totalCost.toFixed(4))
             },
             startDate: startDate.toISOString()
         });
    } catch (error) {
        console.error('Period stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch period statistics'
        });
    }
});

export default router;

