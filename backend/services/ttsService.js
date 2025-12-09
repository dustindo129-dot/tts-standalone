import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

// Google Cloud TTS client will be initialized later
let TextToSpeechClient = null;

// Google Cloud TTS client (will be initialized when credentials are added)
let ttsClient = null;

// TTS Usage tracking (in-memory for now, could be moved to database)
const usageCache = new Map();

// Configuration
const TTS_CONFIG = {
    // Pricing per character (Google Cloud TTS pricing)
    standardCostPerCharacterUSD: 0.000004, // $4 per 1M characters for Standard voices
    neural2CostPerCharacterUSD: 0.000016, // $16 per 1M characters for Neural2 voices
    freeQuotaPerMonth: 1000000, // 1M characters free per month
    cacheDirectory: path.join(process.cwd(), 'public', 'tts-cache'),
    maxCacheSizeMB: 1000, // 1GB cache limit
    cacheExpiryHours: 168 // 7 days
};

// Check if voice is Neural2
const isNeural2Voice = (voiceName) => {
    return voiceName.includes('Neural2') || 
           voiceName === 'neural-female' || 
           voiceName === 'neural-male';
};

// Calculate cost in USD based on voice type and character count
const calculateCostUSD = (characterCount, voiceName) => {
    const isNeural = isNeural2Voice(voiceName);
    const costPerCharacter = isNeural 
        ? TTS_CONFIG.neural2CostPerCharacterUSD 
        : TTS_CONFIG.standardCostPerCharacterUSD;
    
    const costUSD = characterCount * costPerCharacter;
    return Math.round(costUSD * 100) / 100; // Round to 2 decimal places
};

// Generate cache key for TTS request
const generateCacheKey = (text, voiceName, audioConfig) => {
    const content = JSON.stringify({ text, voiceName, audioConfig });
    return crypto.createHash('sha256').update(content).digest('hex');
};

// Ensure cache directory exists
const ensureCacheDirectory = () => {
    if (!fs.existsSync(TTS_CONFIG.cacheDirectory)) {
        fs.mkdirSync(TTS_CONFIG.cacheDirectory, { recursive: true });
    }
};

// Clean old cache files
const cleanCache = () => {
    try {
        const now = Date.now();
        const maxAge = TTS_CONFIG.cacheExpiryHours * 60 * 60 * 1000;
        
        const files = fs.readdirSync(TTS_CONFIG.cacheDirectory);
        files.forEach(file => {
            const filePath = path.join(TTS_CONFIG.cacheDirectory, file);
            const stats = fs.statSync(filePath);
            
            if (now - stats.mtime.getTime() > maxAge) {
                fs.unlinkSync(filePath);
            }
        });
    } catch (error) {
        console.error('Error cleaning TTS cache:', error);
    }
};

// Initialize Google Cloud TTS client
const initializeTTSClient = async () => {
    try {
        if (!process.env.GOOGLE_CLOUD_PROJECT_ID || !process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
            return false;
        }
        
        const { TextToSpeechClient: TtsClient } = await import('@google-cloud/text-to-speech');
        TextToSpeechClient = TtsClient;
        
        let clientConfig = {
            projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
            quotaProjectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
        };

        try {
            const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
            
            const requiredFields = ['type', 'project_id', 'private_key', 'client_email'];
            for (const field of requiredFields) {
                if (!credentials[field]) {
                    throw new Error(`Missing required field in credentials: ${field}`);
                }
            }
            
            clientConfig.credentials = credentials;
        } catch (credError) {
            console.error('Error parsing credentials JSON:', credError.message);
            return false;
        }
        
        ttsClient = new TextToSpeechClient(clientConfig);
        
        const [result] = await ttsClient.listVoices({ languageCode: 'en-US' });
        
        if (result.voices && result.voices.length > 0) {
            console.log(`TTS initialized with ${result.voices.length} voices`);
            return true;
        } else {
            return false;
        }
        
    } catch (error) {
        console.error('TTS initialization failed:', error.message);
        return false;
    }
};

// Mock TTS generation for development (replace with real Google Cloud TTS)
const generateMockTTS = async (request) => {
    const { text, voiceName, audioConfig } = request;
    const characterCount = text.length;
    
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
    
    // Create a simple WAV file with a short beep sound (440Hz tone)
    const sampleRate = 22050;
    const duration = Math.max(1, Math.ceil(characterCount / 100)); // Duration based on text length
    const numSamples = sampleRate * duration;
    const frequency = 440; // A4 note
    
    // Generate audio samples (simple sine wave)
    const samples = [];
    for (let i = 0; i < numSamples; i++) {
        const t = i / sampleRate;
        const amplitude = Math.sin(2 * Math.PI * frequency * t) * 0.3; // Low volume
        const sample = Math.round(amplitude * 32767); // Convert to 16-bit
        samples.push(sample & 0xFF); // Low byte
        samples.push((sample >> 8) & 0xFF); // High byte
    }
    
    // Create WAV file header
    const dataSize = samples.length;
    const fileSize = 36 + dataSize;
    
    const wavHeader = Buffer.from([
        // RIFF chunk
        0x52, 0x49, 0x46, 0x46, // "RIFF"
        fileSize & 0xFF, (fileSize >> 8) & 0xFF, (fileSize >> 16) & 0xFF, (fileSize >> 24) & 0xFF, // File size
        0x57, 0x41, 0x56, 0x45, // "WAVE"
        
        // fmt chunk
        0x66, 0x6D, 0x74, 0x20, // "fmt "
        0x10, 0x00, 0x00, 0x00, // Chunk size (16)
        0x01, 0x00, // Audio format (1 = PCM)
        0x01, 0x00, // Number of channels (1 = mono)
        sampleRate & 0xFF, (sampleRate >> 8) & 0xFF, (sampleRate >> 16) & 0xFF, (sampleRate >> 24) & 0xFF, // Sample rate
        (sampleRate * 2) & 0xFF, ((sampleRate * 2) >> 8) & 0xFF, ((sampleRate * 2) >> 16) & 0xFF, ((sampleRate * 2) >> 24) & 0xFF, // Byte rate
        0x02, 0x00, // Block align
        0x10, 0x00, // Bits per sample (16)
        
        // data chunk
        0x64, 0x61, 0x74, 0x61, // "data"
        dataSize & 0xFF, (dataSize >> 8) & 0xFF, (dataSize >> 16) & 0xFF, (dataSize >> 24) & 0xFF // Data size
    ]);
    
    // Combine header and audio data
    const mockAudioData = Buffer.concat([wavHeader, Buffer.from(samples)]);
    
    
    return {
        audioContent: mockAudioData,
        characterCount,
        voiceUsed: voiceName,
        duration: duration
    };
};

// Map simplified voice names to Google Cloud TTS voice IDs
const VOICE_MAP = {
    'female': 'en-US-Standard-C',
    'male': 'en-US-Standard-B',
    'neural-female': 'en-US-Neural2-F',
    'neural-male': 'en-US-Neural2-D',
    // Legacy support for old voice names
    'en-US-Standard-C': 'en-US-Standard-C',
    'en-US-Standard-B': 'en-US-Standard-B',
    'en-US-Neural2-F': 'en-US-Neural2-F',
    'en-US-Neural2-D': 'en-US-Neural2-D'
};

// Map Google voice IDs to simplified names for cache filenames
const getSimplifiedVoiceName = (voiceName) => {
    if (voiceName === 'female' || voiceName === 'male' || voiceName === 'neural-female' || voiceName === 'neural-male') return voiceName;
    if (voiceName === 'en-US-Standard-C') return 'female';
    if (voiceName === 'en-US-Standard-B') return 'male';
    if (voiceName === 'en-US-Neural2-F') return 'neural-female';
    if (voiceName === 'en-US-Neural2-D') return 'neural-male';
    return 'female'; // Default to female voice
};

// Generate TTS audio using Google Cloud TTS
export const generateTTS = async (request) => {
    const {
        text,
        languageCode = 'en-US',
        voiceName: requestedVoice = 'female',
        audioConfig = {},
        userId = 'anonymous', // Make userId optional for standalone use
        characterCount = text?.length || 0
    } = request;
    
    // Map simplified voice name to Google Cloud TTS voice ID
    const voiceName = VOICE_MAP[requestedVoice] || VOICE_MAP['female'];

    try {
        ensureCacheDirectory();
        
        // Generate simplified filename for standalone TTS
        const cacheKey = generateCacheKey(text, voiceName, audioConfig);
        const voicePart = getSimplifiedVoiceName(voiceName);
        const hashPart = cacheKey.substring(0, 12);
        const timestamp = Date.now();
        
        const filename = `tts-${voicePart}-${hashPart}-${timestamp}.wav`;
        const cacheFilePath = path.join(TTS_CONFIG.cacheDirectory, filename);
        
        // Check if cached version exists (check by content hash only)
        const existingFiles = fs.readdirSync(TTS_CONFIG.cacheDirectory);
        const existingFile = existingFiles.find(file => 
            file.includes(hashPart) && file.includes(voicePart)
        );
        
        if (existingFile) {
            const cacheResult = {
                audioUrl: `${process.env.BACKEND_URL || 'http://localhost:5000'}/tts-cache/${existingFile}`,
                characterCount,
                estimatedCostUSD: 0, // No cost for cached content
                voiceUsed: voiceName,
                cacheHit: true,
                duration: Math.ceil(characterCount / 10)
            };
            return cacheResult;
        }

        // Prepare TTS request
        const ttsRequest = {
            input: { text },
            voice: {
                languageCode,
                name: voiceName
            },
            audioConfig: {
                audioEncoding: 'MP3',
                speakingRate: audioConfig.speakingRate || 1.0,
                pitch: audioConfig.pitch || 0.0,
                volumeGainDb: audioConfig.volumeGainDb || 0.0,
                sampleRateHertz: 24000
            }
        };

        let ttsResponse;
        
        if (ttsClient) {
            // Use real Google Cloud TTS
            const textBytes = Buffer.byteLength(text, 'utf8');
            
            try {
                if (textBytes > 5000) {
                    // Text exceeds limit, chunk into smaller pieces
                    const chunks = [];
                    const maxChunkSize = 4500; // Leave some buffer
                    
                    // Split by sentences to maintain natural speech flow
                    const sentences = text.split(/[.!?]+/).filter(s => s.trim());
                    let currentChunk = '';
                    
                    for (const sentence of sentences) {
                        const potentialChunk = currentChunk + sentence + '.';
                        if (Buffer.byteLength(potentialChunk, 'utf8') > maxChunkSize && currentChunk) {
                            chunks.push(currentChunk.trim());
                            currentChunk = sentence + '.';
                        } else {
                            currentChunk = potentialChunk;
                        }
                    }
                    if (currentChunk.trim()) {
                        chunks.push(currentChunk.trim());
                    }
                    
                    // Generate TTS for each chunk
                    const audioChunks = [];
                    for (let i = 0; i < chunks.length; i++) {
                        const chunkRequest = {
                            ...ttsRequest,
                            input: { text: chunks[i] }
                        };
                        
                        const [response] = await ttsClient.synthesizeSpeech(chunkRequest);
                        audioChunks.push(response.audioContent);
                    }
                    
                    // Combine audio chunks (simple concatenation for MP3)
                    const combinedAudio = Buffer.concat(audioChunks);
                    
                    ttsResponse = {
                        audioContent: combinedAudio,
                        characterCount,
                        voiceUsed: voiceName,
                        duration: Math.ceil(characterCount / 10),
                        isChunked: true,
                        chunkCount: chunks.length
                    };
                } else {
                    // Text is within limit, proceed normally
                    const [response] = await ttsClient.synthesizeSpeech(ttsRequest);
                    
                    ttsResponse = {
                        audioContent: response.audioContent,
                        characterCount,
                        voiceUsed: voiceName,
                        duration: Math.ceil(characterCount / 10)
                    };
                }
                
            } catch (googleError) {
                console.error('Google Cloud TTS API error:', googleError.message);
                ttsResponse = await generateMockTTS({ text, voiceName, audioConfig });
            }
        } else {
            // Use mock TTS for development
            ttsResponse = await generateMockTTS({ text, voiceName, audioConfig });
        }

        // Save audio to cache
        fs.writeFileSync(cacheFilePath, ttsResponse.audioContent);
        
        // Track usage (only if userId provided)
        if (userId && userId !== 'anonymous') {
            trackTTSUsage(userId, characterCount, voiceName);
        }
        
        // Calculate cost based on voice type
        const estimatedCostUSD = calculateCostUSD(characterCount, voiceName);
        
        // Clean old cache files periodically
        if (Math.random() < 0.1) { // 10% chance
            cleanCache();
        }

        const result = {
            audioUrl: `${process.env.BACKEND_URL || 'http://localhost:5000'}/tts-cache/${filename}`,
            characterCount: ttsResponse.characterCount,
            estimatedCostUSD,
            voiceUsed: ttsResponse.voiceUsed,
            duration: ttsResponse.duration,
            cacheHit: false
        };
        
        return result;

    } catch (error) {
        console.error('TTS service error:', error.message);
        throw new Error(`TTS generation failed: ${error.message}`);
    }
};

// Track TTS usage for a user
const trackTTSUsage = (userId, characterCount, voiceName) => {
    const today = new Date().toISOString().split('T')[0];
    const userKey = `${userId}-${today}`;
    
    if (!usageCache.has(userKey)) {
        usageCache.set(userKey, {
            userId,
            date: today,
            totalCharacters: 0,
            totalRequests: 0,
            totalCostUSD: 0
        });
    }
    
    const usage = usageCache.get(userKey);
    usage.totalCharacters += characterCount;
    usage.totalRequests += 1;
    usage.totalCostUSD += calculateCostUSD(characterCount, voiceName);
    
    usageCache.set(userKey, usage);
};

// Get TTS usage for a user
export const getTTSUsage = async (userId = 'anonymous', period = 'month') => {
    try {
        const now = new Date();
        let startDate, endDate;
        
        switch (period) {
            case 'day':
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                endDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000);
                break;
            case 'week':
                const dayOfWeek = now.getDay();
                startDate = new Date(now.getTime() - dayOfWeek * 24 * 60 * 60 * 1000);
                startDate.setHours(0, 0, 0, 0);
                endDate = new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000);
                break;
            case 'month':
            default:
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
                break;
        }
        
        // Calculate usage from cache
        let totalCharacters = 0;
        let totalRequests = 0;
        let totalCostUSD = 0;
        
        for (const [key, usage] of usageCache.entries()) {
            if (usage.userId === userId) {
                const usageDate = new Date(usage.date);
                if (usageDate >= startDate && usageDate < endDate) {
                    totalCharacters += usage.totalCharacters;
                    totalRequests += usage.totalRequests;
                    totalCostUSD += usage.totalCostUSD || 0; // Handle legacy data
                }
            }
        }
        
        const remainingQuota = Math.max(0, TTS_CONFIG.freeQuotaPerMonth - totalCharacters);
        
        return {
            totalCharacters,
            totalRequests,
            totalCostUSD,
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            remainingQuota
        };
    } catch (error) {
        console.error('Error getting TTS usage:', error);
        throw new Error('Failed to retrieve TTS usage');
    }
};

// Get TTS pricing information
export const getTTSPricing = async () => {
    return {
        standardCostPerCharacterUSD: TTS_CONFIG.standardCostPerCharacterUSD,
        neural2CostPerCharacterUSD: TTS_CONFIG.neural2CostPerCharacterUSD,
        standardCostPer1000CharactersUSD: calculateCostUSD(1000, 'female'),
        neural2CostPer1000CharactersUSD: calculateCostUSD(1000, 'neural-female'),
        freeQuotaPerMonth: TTS_CONFIG.freeQuotaPerMonth,
        supportedVoices: [
            { 
                value: 'female', 
                label: 'Female (Standard)', 
                googleVoice: 'en-US-Standard-C',
                costPer1000Chars: calculateCostUSD(1000, 'female')
            },
            { 
                value: 'male', 
                label: 'Male (Standard)', 
                googleVoice: 'en-US-Standard-B',
                costPer1000Chars: calculateCostUSD(1000, 'male')
            },
            { 
                value: 'neural-female', 
                label: 'Female (Neural2)', 
                googleVoice: 'en-US-Neural2-F',
                costPer1000Chars: calculateCostUSD(1000, 'neural-female')
            },
            { 
                value: 'neural-male', 
                label: 'Male (Neural2)', 
                googleVoice: 'en-US-Neural2-D',
                costPer1000Chars: calculateCostUSD(1000, 'neural-male')
            }
        ],
        qualityLevel: 'Standard & Neural2 quality voices',
        pricingNote: 'Standard voices: $4 per 1M characters. Neural2 voices: $16 per 1M characters.',
        lastUpdated: new Date().toISOString()
    };
};

// Initialize TTS service function
export const initializeTTSService = async () => {
    await initializeTTSClient();
    ensureCacheDirectory();
    
    // Clean cache on startup
    cleanCache();
    
    // Set up periodic cache cleaning (every 6 hours)
    setInterval(cleanCache, 6 * 60 * 60 * 1000);
};

// Generate conversation TTS with proper speaker separation
export const generateConversationTTS = async (request) => {
    const {
        conversationSegments, // Array of {text, voiceName}
        userId = 'anonymous',
        speakerPauseDuration = 0.5 // seconds of pause between speakers
    } = request;

    try {
        ensureCacheDirectory();
        
        // Generate cache key for the entire conversation
        const conversationString = JSON.stringify(conversationSegments);
        const cacheKey = generateCacheKey(conversationString, 'conversation', {});
        const hashPart = cacheKey.substring(0, 12);
        const timestamp = Date.now();
        
        const filename = `conversation-${hashPart}-${timestamp}.wav`;
        const cacheFilePath = path.join(TTS_CONFIG.cacheDirectory, filename);
        
        // Check if cached version exists
        const existingFiles = fs.readdirSync(TTS_CONFIG.cacheDirectory);
        const existingFile = existingFiles.find(file => 
            file.includes(hashPart) && file.includes('conversation')
        );
        
        if (existingFile) {
            const totalCharacters = conversationSegments.reduce((sum, segment) => sum + segment.text.length, 0);
            return {
                audioUrl: `${process.env.BACKEND_URL || 'http://localhost:5000'}/tts-cache/${existingFile}`,
                totalCharacterCount: totalCharacters,
                estimatedCostUSD: 0, // No cost for cached content
                cacheHit: true,
                duration: Math.ceil(totalCharacters / 10),
                conversationSegments
            };
        }

        // Generate TTS for each segment
        const audioBuffers = [];
        let totalCharacters = 0;
        let totalCost = 0;
        let totalDuration = 0;

        for (let i = 0; i < conversationSegments.length; i++) {
            const segment = conversationSegments[i];
            const voiceName = VOICE_MAP[segment.voiceName] || VOICE_MAP['female'];
            
            // Generate TTS for this segment
            const segmentRequest = {
                input: { text: segment.text },
                voice: {
                    languageCode: 'en-US',
                    name: voiceName
                },
                audioConfig: {
                    audioEncoding: 'MP3',
                    speakingRate: 1.0,
                    pitch: 0.0,
                    volumeGainDb: 0.0,
                    sampleRateHertz: 24000
                }
            };

            let segmentResponse;
            
            if (ttsClient) {
                try {
                    const [response] = await ttsClient.synthesizeSpeech(segmentRequest);
                    segmentResponse = response.audioContent;
                } catch (googleError) {
                    console.error('Google Cloud TTS API error for segment:', googleError.message);
                    const mockResponse = await generateMockTTS({ 
                        text: segment.text, 
                        voiceName, 
                        audioConfig: {} 
                    });
                    segmentResponse = mockResponse.audioContent;
                }
            } else {
                const mockResponse = await generateMockTTS({ 
                    text: segment.text, 
                    voiceName, 
                    audioConfig: {} 
                });
                segmentResponse = mockResponse.audioContent;
            }

            audioBuffers.push(segmentResponse);
            
            // Add pause between speakers (except after last segment)
            if (i < conversationSegments.length - 1) {
                const pauseBuffer = generateSilenceBuffer(speakerPauseDuration);
                audioBuffers.push(pauseBuffer);
            }

            totalCharacters += segment.text.length;
            totalCost += calculateCostUSD(segment.text.length, voiceName);
            totalDuration += Math.ceil(segment.text.length / 10);
        }

        // Combine all audio buffers
        const combinedAudio = Buffer.concat(audioBuffers);
        
        // Save combined audio to cache
        fs.writeFileSync(cacheFilePath, combinedAudio);
        
        // Track usage
        if (userId && userId !== 'anonymous') {
            trackTTSUsage(userId, totalCharacters, 'conversation');
        }
        
        // Clean old cache files periodically
        if (Math.random() < 0.1) {
            cleanCache();
        }

        return {
            audioUrl: `${process.env.BACKEND_URL || 'http://localhost:5000'}/tts-cache/${filename}`,
            totalCharacterCount: totalCharacters,
            estimatedCostUSD: totalCost,
            duration: totalDuration + (conversationSegments.length - 1) * speakerPauseDuration,
            cacheHit: false,
            conversationSegments
        };

    } catch (error) {
        console.error('Conversation TTS service error:', error.message);
        throw new Error(`Conversation TTS generation failed: ${error.message}`);
    }
};

// Generate a silence buffer for pause between speakers
const generateSilenceBuffer = (durationSeconds) => {
    // Generate silence for MP3 - just return a small MP3 silence buffer
    // For simplicity, we'll create a minimal MP3 header with silence
    const silenceDuration = Math.max(0.1, durationSeconds); // Minimum 0.1 seconds
    const sampleRate = 24000;
    const numSamples = Math.floor(sampleRate * silenceDuration);
    
    // Create silent samples (zeros)
    const silentSamples = Buffer.alloc(numSamples * 2); // 16-bit samples
    
    // Create simple WAV header for silence
    const dataSize = silentSamples.length;
    const fileSize = 36 + dataSize;
    
    const wavHeader = Buffer.from([
        // RIFF chunk
        0x52, 0x49, 0x46, 0x46, // "RIFF"
        fileSize & 0xFF, (fileSize >> 8) & 0xFF, (fileSize >> 16) & 0xFF, (fileSize >> 24) & 0xFF,
        0x57, 0x41, 0x56, 0x45, // "WAVE"
        
        // fmt chunk
        0x66, 0x6D, 0x74, 0x20, // "fmt "
        0x10, 0x00, 0x00, 0x00, // Chunk size (16)
        0x01, 0x00, // Audio format (1 = PCM)
        0x01, 0x00, // Number of channels (1 = mono)
        sampleRate & 0xFF, (sampleRate >> 8) & 0xFF, (sampleRate >> 16) & 0xFF, (sampleRate >> 24) & 0xFF,
        (sampleRate * 2) & 0xFF, ((sampleRate * 2) >> 8) & 0xFF, ((sampleRate * 2) >> 16) & 0xFF, ((sampleRate * 2) >> 24) & 0xFF,
        0x02, 0x00, // Block align
        0x10, 0x00, // Bits per sample (16)
        
        // data chunk
        0x64, 0x61, 0x74, 0x61, // "data"
        dataSize & 0xFF, (dataSize >> 8) & 0xFF, (dataSize >> 16) & 0xFF, (dataSize >> 24) & 0xFF
    ]);
    
    return Buffer.concat([wavHeader, silentSamples]);
};

// Don't auto-initialize on import - server will call initializeTTSService() after env vars are loaded
// (async () => {
//     await initializeTTSService();
// })();

export default {
    generateTTS,
    generateConversationTTS,
    getTTSUsage,
    getTTSPricing
};
