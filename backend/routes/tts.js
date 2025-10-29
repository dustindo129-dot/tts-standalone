import express from 'express';
import { generateTTS, getTTSUsage, getTTSPricing } from '../services/ttsService.js';
import { body, validationResult } from 'express-validator';

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

/**
 * @route POST /api/tts/generate
 * @desc Generate TTS audio from text using Google Cloud TTS
 * @access Public (no authentication required for standalone version)
 */
router.post('/generate', validateTTSRequest, async (req, res) => {
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

        // Generate TTS audio (no userId needed for standalone)
        const result = await generateTTS({
            text,
            languageCode,
            voiceName,
            audioConfig: defaultAudioConfig,
            userId: 'anonymous',
            characterCount
        });

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
 * @route GET /api/tts/usage
 * @desc Get TTS usage statistics (anonymous usage for standalone)
 * @access Public
 */
router.get('/usage', async (req, res) => {
    try {
        const { period = 'month' } = req.query; // month, week, day
        
        const usage = await getTTSUsage('anonymous', period);
        
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
