import express from 'express';
import { generateTTS, generateConversationTTS, getTTSUsage, getTTSPricing } from '../services/ttsService.js';
import { body, validationResult } from 'express-validator';
import { optionalAuth } from '../middleware/auth.js';
import { audioHistoryModel, conversationHistoryModel } from '../db/database.js';

const router = express.Router();

// TTS routes middleware
router.use((req, res, next) => {
    next();
});

// Validation middleware for TTS generation
const validateTTSRequest = [
    body('text')
        .trim()
        .isLength({ min: 1, max: 100000 })
        .withMessage('Text must be between 1 and 100,000 characters'),
    body('languageCode')
        .optional()
        .isIn(['en-US', 'en'])
        .withMessage('Language code must be en-US or en'),
    body('voiceName')
        .optional()
        .custom((value) => {
            // Accept new simplified names or legacy Google Cloud format
            const validVoices = ['female', 'male', 'neural-female', 'neural-male'];
            const legacyPattern = /^en-US-(Standard|Wavenet|Neural2)-(A|B|C|D|F)$/;
            return validVoices.includes(value) || legacyPattern.test(value);
        })
        .withMessage('Invalid English voice name (use "female", "male", "neural-female", or "neural-male")'),
    body('audioConfig.speakingRate')
        .optional()
        .isFloat({ min: 0.25, max: 4.0 })
        .withMessage('Speaking rate must be between 0.25 and 4.0'),
    body('audioConfig.pitch')
        .optional()
        .isFloat({ min: -20.0, max: 20.0 })
        .withMessage('Pitch must be between -20.0 and 20.0'),
    body('audioConfig.volumeGainDb')
        .optional()
        .isFloat({ min: -96.0, max: 16.0 })
        .withMessage('Volume gain must be between -96.0 and 16.0 dB')
];

// Validation middleware for conversation TTS generation
const validateConversationRequest = [
    body('conversationSegments')
        .isArray({ min: 1, max: 50 })
        .withMessage('Conversation must have between 1 and 50 segments'),
    body('conversationSegments.*.text')
        .trim()
        .isLength({ min: 1, max: 1000 })
        .withMessage('Each segment text must be between 1 and 1,000 characters'),
    body('conversationSegments.*.voiceName')
        .custom((value) => {
            const validVoices = ['female', 'male', 'neural-female', 'neural-male'];
            const legacyPattern = /^en-US-(Standard|Wavenet|Neural2)-(A|B|C|D|F)$/;
            return validVoices.includes(value) || legacyPattern.test(value);
        })
        .withMessage('Invalid voice name for segment'),
    body('title')
        .optional()
        .trim()
        .isLength({ max: 100 })
        .withMessage('Title must be less than 100 characters'),
    body('speakerPauseDuration')
        .optional()
        .isFloat({ min: 0.1, max: 3.0 })
        .withMessage('Speaker pause duration must be between 0.1 and 3.0 seconds')
];

/**
 * @route POST /api/tts/generate
 * @desc Generate TTS audio from text using Google Cloud TTS
 * @access Public (supports both authenticated and anonymous users)
 */
router.post('/generate', optionalAuth, validateTTSRequest, async (req, res) => {
    try {
        // Check for validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
        }

        const {
            text,
            languageCode = 'en-US',
            voiceName = 'female', // Default to female voice
            audioConfig = {}
        } = req.body;

        const characterCount = text.length;

        // Default audio configuration
        const defaultAudioConfig = {
            audioEncoding: 'MP3',
            speakingRate: 1.0,
            pitch: 0.0,
            volumeGainDb: 0.0,
            ...audioConfig
        };

        // Get userId from authenticated user or use 'anonymous'
        const userId = req.user ? req.user.id : 'anonymous';

        // Generate TTS audio
        const result = await generateTTS({
            text,
            languageCode,
            voiceName,
            audioConfig: defaultAudioConfig,
            userId: userId,
            characterCount
        });

        // Save to history if user is authenticated (save even for cache hits)
        if (req.user) {
            try {
                // Extract filename from audioUrl
                const audioFilename = result.audioUrl.split('/').pop();
                
                await audioHistoryModel.create({
                    userId: req.user.id,
                    text: text.substring(0, 500), // Store first 500 chars to save space
                    voiceName: result.voiceUsed,
                    speakingRate: defaultAudioConfig.speakingRate,
                    audioUrl: result.audioUrl,
                    audioFilename: audioFilename,
                    characterCount: result.characterCount,
                    estimatedCostUSD: result.cacheHit ? 0 : result.estimatedCostUSD, // No cost for cached content
                    duration: result.duration
                });
            } catch (historyError) {
                console.error('Failed to save audio history:', historyError);
                // Don't fail the request if history save fails
            }
        }

        // TTS generation completed successfully
        res.json({
            success: true,
            audioUrl: result.audioUrl,
            characterCount: result.characterCount,
            estimatedCostUSD: result.estimatedCostUSD,
            duration: result.duration,
            voiceUsed: result.voiceUsed,
            cacheHit: result.cacheHit || false
        });

    } catch (error) {
        console.error('TTS generation error:', error.message);
        
        // Handle specific error types
        if (error.message.includes('quota')) {
            return res.status(429).json({
                success: false,
                message: 'TTS quota exceeded. Please try again later.',
                error: 'QUOTA_EXCEEDED'
            });
        }
        
        if (error.message.includes('authentication')) {
            return res.status(401).json({
                success: false,
                message: 'Authentication failed with Google Cloud TTS.',
                error: 'AUTH_FAILED'
            });
        }

        if (error.message.includes('billing')) {
            return res.status(402).json({
                success: false,
                message: 'Billing account required for TTS service.',
                error: 'BILLING_REQUIRED'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Failed to generate TTS audio. Please try again.',
            error: 'GENERATION_FAILED'
        });
    }
});

/**
 * @route POST /api/tts/generate-conversation
 * @desc Generate TTS audio from conversation segments using Google Cloud TTS
 * @access Public (supports both authenticated and anonymous users)
 */
router.post('/generate-conversation', optionalAuth, validateConversationRequest, async (req, res) => {
    try {
        // Check for validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
        }

        const {
            conversationSegments,
            title = null,
            speakerPauseDuration = 0.5
        } = req.body;

        // Calculate total character count
        const totalCharacterCount = conversationSegments.reduce((sum, segment) => sum + segment.text.length, 0);

        // Validate total character limit
        if (totalCharacterCount > 10000) {
            return res.status(400).json({
                success: false,
                message: 'Total conversation length exceeds 10,000 characters'
            });
        }

        // Get userId from authenticated user or use 'anonymous'
        const userId = req.user ? req.user.id : 'anonymous';

        // Generate conversation TTS audio
        const result = await generateConversationTTS({
            conversationSegments,
            userId: userId,
            speakerPauseDuration
        });

        // Save to conversation history if user is authenticated and it's not a cache hit
        if (req.user && !result.cacheHit) {
            try {
                // Extract filename from audioUrl
                const audioFilename = result.audioUrl.split('/').pop();
                
                await conversationHistoryModel.create({
                    userId: req.user.id,
                    title: title || `Conversation - ${new Date().toLocaleDateString()}`,
                    conversationSegments: conversationSegments,
                    totalCharacterCount: result.totalCharacterCount,
                    estimatedCostUSD: result.estimatedCostUSD,
                    totalDuration: result.duration,
                    audioUrl: result.audioUrl,
                    audioFilename: audioFilename
                });
            } catch (historyError) {
                console.error('Failed to save conversation history:', historyError);
                // Don't fail the request if history save fails
            }
        }

        // Conversation generation completed successfully
        res.json({
            success: true,
            audioUrl: result.audioUrl,
            totalCharacterCount: result.totalCharacterCount,
            estimatedCostUSD: result.estimatedCostUSD,
            duration: result.duration,
            conversationSegments: result.conversationSegments,
            speakerCount: conversationSegments.length,
            cacheHit: result.cacheHit || false
        });

    } catch (error) {
        console.error('Conversation TTS generation error:', error.message);
        
        // Handle specific error types
        if (error.message.includes('quota')) {
            return res.status(429).json({
                success: false,
                message: 'TTS quota exceeded. Please try again later.',
                error: 'QUOTA_EXCEEDED'
            });
        }
        
        if (error.message.includes('authentication')) {
            return res.status(401).json({
                success: false,
                message: 'Authentication failed with Google Cloud TTS.',
                error: 'AUTH_FAILED'
            });
        }

        if (error.message.includes('billing')) {
            return res.status(402).json({
                success: false,
                message: 'Billing account required for TTS service.',
                error: 'BILLING_REQUIRED'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Failed to generate conversation TTS audio. Please try again.',
            error: 'CONVERSATION_GENERATION_FAILED'
        });
    }
});

/**
 * @route GET /api/tts/usage
 * @desc Get TTS usage statistics (supports both authenticated and anonymous users)
 * @access Public
 */
router.get('/usage', optionalAuth, async (req, res) => {
    try {
        const { period = 'month' } = req.query; // month, week, day
        
        // For authenticated users, get usage from database (includes both standard and conversation)
        if (req.user) {
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
            
             // Get stats from both tables
             const audioStats = await audioHistoryModel.getUserStatsForPeriod(userId, startDate.toISOString());
             const conversationStats = await conversationHistoryModel.getUserStatsForPeriod(userId, startDate.toISOString());
             
             const totalCharacters = (audioStats?.total_characters || 0) + (conversationStats?.total_characters || 0);
             const totalRequests = (audioStats?.total_generations || 0) + (conversationStats?.total_conversations || 0);
             
             // Calculate cost using predefined formula (Standard voice rate: $0.000004 per character)
             const costPerCharacter = 0.000004; // $4 per 1M characters for standard voices
             const totalCostUSD = totalCharacters * costPerCharacter;
            
            const TTS_CONFIG = {
                freeQuotaPerMonth: 1000000 // 1M characters free per month
            };
            const remainingQuota = Math.max(0, TTS_CONFIG.freeQuotaPerMonth - totalCharacters);
            
            let endDate;
            switch (period) {
                case 'day':
                    endDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000);
                    break;
                case 'week':
                    endDate = new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000);
                    break;
                case 'month':
                default:
                    endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
                    break;
            }
            
            return res.json({
                success: true,
                usage: {
                    totalCharacters: totalCharacters || 0,
                    totalRequests: totalRequests || 0,
                    totalCostUSD: parseFloat((totalCostUSD || 0).toFixed(4)),
                    period: period,
                    startDate: startDate.toISOString(),
                    endDate: endDate.toISOString(),
                    remainingQuota: remainingQuota
                }
            });
        }
        
        // For anonymous users, use cache-based approach
        const userId = 'anonymous';
        const usage = await getTTSUsage(userId, period);
        
        res.json({
            success: true,
            usage: {
                totalCharacters: usage.totalCharacters,
                totalRequests: usage.totalRequests,
                totalCostUSD: usage.totalCostUSD,
                period: period,
                startDate: usage.startDate,
                endDate: usage.endDate,
                remainingQuota: usage.remainingQuota
            }
        });
    } catch (error) {
        console.error('TTS usage retrieval error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve TTS usage.'
        });
    }
});

/**
 * @route GET /api/tts/pricing
 * @desc Get current TTS pricing information
 * @access Public
 */
router.get('/pricing', async (req, res) => {
    try {
        const pricing = await getTTSPricing();
        
        res.json({
            success: true,
            pricing: {
                costPerCharacterUSD: pricing.costPerCharacterUSD,
                costPer1000CharactersUSD: pricing.costPer1000CharactersUSD,
                freeQuotaPerMonth: pricing.freeQuotaPerMonth,
                supportedVoices: pricing.supportedVoices,
                qualityLevel: pricing.qualityLevel,
                lastUpdated: pricing.lastUpdated
            }
        });
    } catch (error) {
        console.error('TTS pricing retrieval error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve TTS pricing.'
        });
    }
});


/**
 * @route GET /api/tts/voices
 * @desc Get available English voices
 * @access Public
 */
router.get('/voices', async (req, res) => {
    try {
        const voices = [
            {
                value: 'female',
                label: 'Female (Standard)',
                gender: 'FEMALE',
                description: 'English female voice (Standard quality)',
                googleVoice: 'en-US-Standard-C',
                sampleRate: 24000
            },
            {
                value: 'male',
                label: 'Male (Standard)',
                gender: 'MALE',
                description: 'English male voice (Standard quality)',
                googleVoice: 'en-US-Standard-B',
                sampleRate: 24000
            },
            {
                value: 'neural-female',
                label: 'Female (Neural2)',
                gender: 'FEMALE',
                description: 'English female voice (Neural2 quality)',
                googleVoice: 'en-US-Neural2-F',
                sampleRate: 24000
            },
            {
                value: 'neural-male',
                label: 'Male (Neural2)',
                gender: 'MALE',
                description: 'English male voice (Neural2 quality)',
                googleVoice: 'en-US-Neural2-D',
                sampleRate: 24000
            }
        ];

        res.json({
            success: true,
            voices,
            recommendedVoice: 'female',
            totalVoices: voices.length,
            quality: 'Standard & Neural2'
        });
    } catch (error) {
        console.error('TTS voices retrieval error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve available voices.'
        });
    }
});

/**
 * @route POST /api/tts/synthesize
 * @desc Alternative endpoint name matching your project proposal
 * @access Public
 */
router.post('/synthesize', validateTTSRequest, async (req, res) => {
    // Forward to the generate endpoint for consistency with your project proposal
    req.url = '/generate';
    router.handle(req, res);
});


export default router;
