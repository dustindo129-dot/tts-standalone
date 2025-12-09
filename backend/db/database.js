import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let db = null;

// Initialize database connection
export const initializeDatabase = async () => {
    if (db) return db;
    
    db = await open({
        filename: path.join(__dirname, 'tts-app.db'),
        driver: sqlite3.Database
    });

    // Enable foreign keys
    await db.exec('PRAGMA foreign_keys = ON');

    // Create users table
    await db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Migrate existing users table if it has email column
    try {
        const tableInfo = await db.all("PRAGMA table_info(users)");
        const hasEmailColumn = tableInfo.some(col => col.name === 'email');
        
        if (hasEmailColumn) {
            console.log('Migrating users table: removing email column...');
            
            // Temporarily disable foreign keys for migration
            await db.exec('PRAGMA foreign_keys = OFF');
            
            // Create new table without email
            await db.exec(`
                CREATE TABLE users_new (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT UNIQUE NOT NULL,
                    password_hash TEXT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);
            
            // Copy data (excluding email)
            await db.exec(`
                INSERT INTO users_new (id, username, password_hash, created_at, updated_at)
                SELECT id, username, password_hash, created_at, updated_at FROM users
            `);
            
            // Drop old table
            await db.exec('DROP TABLE users');
            
            // Rename new table
            await db.exec('ALTER TABLE users_new RENAME TO users');
            
            // Re-enable foreign keys
            await db.exec('PRAGMA foreign_keys = ON');
            
            console.log('Migration completed successfully');
        }
    } catch (migrationError) {
        console.error('Migration error (non-fatal):', migrationError.message);
        // Re-enable foreign keys in case of error
        await db.exec('PRAGMA foreign_keys = ON');
        // If migration fails, try to continue - might be a fresh database
    }

    // Create audio_history table
    await db.exec(`
        CREATE TABLE IF NOT EXISTS audio_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            text TEXT NOT NULL,
            voice_name TEXT NOT NULL,
            speaking_rate REAL DEFAULT 1.0,
            audio_url TEXT NOT NULL,
            audio_filename TEXT NOT NULL,
            character_count INTEGER NOT NULL,
            estimated_cost_usd REAL NOT NULL,
            duration REAL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);

    // Create index on user_id for faster queries
    await db.exec(`
        CREATE INDEX IF NOT EXISTS idx_audio_history_user_id 
        ON audio_history(user_id)
    `);

    // Create index on created_at for sorting
    await db.exec(`
        CREATE INDEX IF NOT EXISTS idx_audio_history_created_at 
        ON audio_history(created_at DESC)
    `);

    // Create conversation_history table
    await db.exec(`
        CREATE TABLE IF NOT EXISTS conversation_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            title TEXT,
            conversation_data TEXT NOT NULL, -- JSON string of conversation segments
            total_character_count INTEGER NOT NULL,
            estimated_cost_usd REAL NOT NULL,
            total_duration REAL,
            audio_url TEXT NOT NULL,
            audio_filename TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);

    // Create index on conversation_history user_id for faster queries
    await db.exec(`
        CREATE INDEX IF NOT EXISTS idx_conversation_history_user_id 
        ON conversation_history(user_id)
    `);

    // Create index on conversation_history created_at for sorting
    await db.exec(`
        CREATE INDEX IF NOT EXISTS idx_conversation_history_created_at 
        ON conversation_history(created_at DESC)
    `);

    console.log('Database initialized successfully');
    return db;
};

// Get database instance
export const getDatabase = () => {
    if (!db) {
        throw new Error('Database not initialized. Call initializeDatabase() first.');
    }
    return db;
};

// User model functions
export const userModel = {
    async create(username, passwordHash) {
        const result = await db.run(
            'INSERT INTO users (username, password_hash) VALUES (?, ?)',
            [username, passwordHash]
        );
        return result.lastID;
    },

    async findByUsername(username) {
        return await db.get('SELECT * FROM users WHERE username = ?', [username]);
    },

    async findById(id) {
        return await db.get('SELECT * FROM users WHERE id = ?', [id]);
    },

    async updatePassword(userId, passwordHash) {
        await db.run(
            'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [passwordHash, userId]
        );
    }
};

// Audio history model functions
export const audioHistoryModel = {
    async create(audioData) {
        const {
            userId,
            text,
            voiceName,
            speakingRate,
            audioUrl,
            audioFilename,
            characterCount,
            estimatedCostUSD,
            duration
        } = audioData;

        const result = await db.run(
            `INSERT INTO audio_history 
            (user_id, text, voice_name, speaking_rate, audio_url, audio_filename, 
             character_count, estimated_cost_usd, duration) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [userId, text, voiceName, speakingRate, audioUrl, audioFilename, 
             characterCount, estimatedCostUSD, duration]
        );
        return result.lastID;
    },

    async findByUserId(userId, limit = 50, offset = 0) {
        return await db.all(
            `SELECT * FROM audio_history 
             WHERE user_id = ? 
             ORDER BY created_at DESC 
             LIMIT ? OFFSET ?`,
            [userId, limit, offset]
        );
    },

    async findById(id) {
        return await db.get('SELECT * FROM audio_history WHERE id = ?', [id]);
    },

    async deleteById(id, userId) {
        await db.run(
            'DELETE FROM audio_history WHERE id = ? AND user_id = ?',
            [id, userId]
        );
    },

    async getUserStats(userId) {
        const result = await db.get(
            `SELECT 
                COUNT(*) as total_generations,
                COALESCE(SUM(character_count), 0) as total_characters,
                COALESCE(SUM(estimated_cost_usd), 0) as total_cost,
                COALESCE(SUM(duration), 0) as total_duration
             FROM audio_history 
             WHERE user_id = ?`,
            [userId]
        );
        return result || {
            total_generations: 0,
            total_characters: 0,
            total_cost: 0,
            total_duration: 0
        };
    },

    async getUserStatsForPeriod(userId, startDate) {
        const result = await db.get(
            `SELECT 
                COUNT(*) as total_generations,
                COALESCE(SUM(character_count), 0) as total_characters,
                COALESCE(SUM(estimated_cost_usd), 0) as total_cost
             FROM audio_history 
             WHERE user_id = ? AND created_at >= ?`,
            [userId, startDate]
        );
        return result || {
            total_generations: 0,
            total_characters: 0,
            total_cost: 0
        };
    }
};

// Conversation history model functions
export const conversationHistoryModel = {
    async create(conversationData) {
        const {
            userId,
            title,
            conversationSegments,
            totalCharacterCount,
            estimatedCostUSD,
            totalDuration,
            audioUrl,
            audioFilename
        } = conversationData;

        const result = await db.run(
            `INSERT INTO conversation_history 
            (user_id, title, conversation_data, total_character_count, 
             estimated_cost_usd, total_duration, audio_url, audio_filename) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [userId, title, JSON.stringify(conversationSegments), totalCharacterCount, 
             estimatedCostUSD, totalDuration, audioUrl, audioFilename]
        );
        return result.lastID;
    },

    async findByUserId(userId, limit = 50, offset = 0) {
        const results = await db.all(
            `SELECT * FROM conversation_history 
             WHERE user_id = ? 
             ORDER BY created_at DESC 
             LIMIT ? OFFSET ?`,
            [userId, limit, offset]
        );
        
        // Parse conversation data JSON
        return results.map(row => ({
            ...row,
            conversation_data: JSON.parse(row.conversation_data)
        }));
    },

    async findById(id) {
        const result = await db.get('SELECT * FROM conversation_history WHERE id = ?', [id]);
        if (result) {
            result.conversation_data = JSON.parse(result.conversation_data);
        }
        return result;
    },

    async deleteById(id, userId) {
        await db.run(
            'DELETE FROM conversation_history WHERE id = ? AND user_id = ?',
            [id, userId]
        );
    },

    async getUserStats(userId) {
        const result = await db.get(
            `SELECT 
                COUNT(*) as total_conversations,
                COALESCE(SUM(total_character_count), 0) as total_characters,
                COALESCE(SUM(estimated_cost_usd), 0) as total_cost,
                COALESCE(SUM(total_duration), 0) as total_duration
             FROM conversation_history 
             WHERE user_id = ?`,
            [userId]
        );
        return result || {
            total_conversations: 0,
            total_characters: 0,
            total_cost: 0,
            total_duration: 0
        };
    },

    async getUserStatsForPeriod(userId, startDate) {
        const result = await db.get(
            `SELECT 
                COUNT(*) as total_conversations,
                COALESCE(SUM(total_character_count), 0) as total_characters,
                COALESCE(SUM(estimated_cost_usd), 0) as total_cost
             FROM conversation_history 
             WHERE user_id = ? AND created_at >= ?`,
            [userId, startDate]
        );
        return result || {
            total_conversations: 0,
            total_characters: 0,
            total_cost: 0
        };
    }
};

export default {
    initializeDatabase,
    getDatabase,
    userModel,
    audioHistoryModel,
    conversationHistoryModel
};

