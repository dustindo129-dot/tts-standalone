import './ApiDocs.css';

export default function ApiDocs({ onBack }) {
    const API_BASE_URL = 'http://localhost:5000';

    return (
        <div className="api-docs-page">
            <div className="api-docs-container">
                <div className="api-docs-header">
                    <button onClick={onBack} className="back-btn">
                        ← Back to TTS
                    </button>
                    <h1>📚 API Documentation</h1>
                    <p>Complete API reference for the Text-to-Speech Service</p>
                </div>

                <div className="api-docs-content">
                    <section className="api-section">
                        <h2>Base URL</h2>
                        <div className="code-block">
                            <code>{API_BASE_URL}</code>
                        </div>
                    </section>

                    <section className="api-section">
                        <h2>🔐 Authentication Endpoints</h2>
                        
                        <div className="endpoint">
                            <div className="endpoint-header">
                                <span className="method post">POST</span>
                                <code>/api/auth/signup</code>
                            </div>
                            <p className="endpoint-desc">Register a new user account</p>
                            <div className="request-body">
                                <strong>Request Body:</strong>
                                <pre>{JSON.stringify({
                                    username: "string (3-30 chars, letters and numbers only)",
                                    password: "string (min 6 chars)"
                                }, null, 2)}</pre>
                            </div>
                            <div className="response">
                                <strong>Response:</strong>
                                <pre>{JSON.stringify({
                                    success: true,
                                    message: "User registered successfully",
                                    token: "jwt-token",
                                    user: {
                                        id: 1,
                                        username: "username",
                                        createdAt: "2024-01-01T00:00:00.000Z"
                                    }
                                }, null, 2)}</pre>
                            </div>
                        </div>

                        <div className="endpoint">
                            <div className="endpoint-header">
                                <span className="method post">POST</span>
                                <code>/api/auth/login</code>
                            </div>
                            <p className="endpoint-desc">Login with username and password</p>
                            <div className="request-body">
                                <strong>Request Body:</strong>
                                <pre>{JSON.stringify({
                                    username: "string",
                                    password: "string"
                                }, null, 2)}</pre>
                            </div>
                            <div className="response">
                                <strong>Response:</strong>
                                <pre>{JSON.stringify({
                                    success: true,
                                    message: "Login successful",
                                    token: "jwt-token",
                                    user: {
                                        id: 1,
                                        username: "username",
                                        createdAt: "2024-01-01T00:00:00.000Z"
                                    }
                                }, null, 2)}</pre>
                            </div>
                        </div>

                        <div className="endpoint">
                            <div className="endpoint-header">
                                <span className="method get">GET</span>
                                <code>/api/auth/profile</code>
                                <span className="auth-badge">🔒 Auth Required</span>
                            </div>
                            <p className="endpoint-desc">Get current user profile</p>
                            <div className="headers">
                                <strong>Headers:</strong>
                                <pre>Authorization: Bearer &lt;token&gt;</pre>
                            </div>
                        </div>

                        <div className="endpoint">
                            <div className="endpoint-header">
                                <span className="method post">POST</span>
                                <code>/api/auth/logout</code>
                                <span className="auth-badge">🔒 Auth Required</span>
                            </div>
                            <p className="endpoint-desc">Logout user</p>
                        </div>
                    </section>

                    <section className="api-section">
                        <h2>🎤 Text-to-Speech Endpoints</h2>
                        
                        <div className="endpoint">
                            <div className="endpoint-header">
                                <span className="method post">POST</span>
                                <code>/api/tts/generate</code>
                            </div>
                            <p className="endpoint-desc">Generate TTS audio from text (Standard mode)</p>
                            <div className="request-body">
                                <strong>Request Body:</strong>
                                <pre>{JSON.stringify({
                                    text: "string (1-100,000 characters)",
                                    languageCode: "en-US (optional, default: en-US)",
                                    voiceName: "female | male | neural-female | neural-male (optional, default: female)",
                                    audioConfig: {
                                        audioEncoding: "MP3 (optional)",
                                        speakingRate: "number (0.25-4.0, optional, default: 1.0)",
                                        pitch: "number (-20.0 to 20.0, optional, default: 0.0)",
                                        volumeGainDb: "number (-96.0 to 16.0, optional, default: 0.0)"
                                    }
                                }, null, 2)}</pre>
                            </div>
                            <div className="headers">
                                <strong>Optional Headers:</strong>
                                <pre>Authorization: Bearer &lt;token&gt; (for authenticated users)</pre>
                            </div>
                            <div className="response">
                                <strong>Response:</strong>
                                <pre>{JSON.stringify({
                                    success: true,
                                    audioUrl: "http://localhost:5000/tts-cache/filename.wav",
                                    characterCount: 100,
                                    estimatedCostUSD: 0.0004,
                                    duration: 10,
                                    voiceUsed: "en-US-Standard-C",
                                    cacheHit: false
                                }, null, 2)}</pre>
                            </div>
                            <div className="note">
                                <strong>Note:</strong> Cost is calculated using the formula: <code>characterCount × 0.000004</code> (Standard voice rate: $4 per 1M characters). For authenticated users, the generation is saved to history regardless of cache status.
                            </div>
                        </div>

                        <div className="endpoint">
                            <div className="endpoint-header">
                                <span className="method post">POST</span>
                                <code>/api/tts/generate-conversation</code>
                            </div>
                            <p className="endpoint-desc">Generate TTS audio from conversation segments (Conversation mode)</p>
                            <div className="request-body">
                                <strong>Request Body:</strong>
                                <pre>{JSON.stringify({
                                    conversationSegments: [
                                        {
                                            text: "string (1-1,000 characters per segment)",
                                            voiceName: "female | male | neural-female | neural-male"
                                        }
                                    ],
                                    title: "string (optional, max 100 characters)",
                                    speakerPauseDuration: "number (0.1-3.0, optional, default: 0.5 seconds)"
                                }, null, 2)}</pre>
                            </div>
                            <div className="headers">
                                <strong>Optional Headers:</strong>
                                <pre>Authorization: Bearer &lt;token&gt; (for authenticated users)</pre>
                            </div>
                            <div className="response">
                                <strong>Response:</strong>
                                <pre>{JSON.stringify({
                                    success: true,
                                    audioUrl: "http://localhost:5000/tts-cache/conversation-filename.wav",
                                    totalCharacterCount: 250,
                                    estimatedCostUSD: 0.001,
                                    duration: 25,
                                    conversationSegments: [
                                        {
                                            text: "Hello, how are you?",
                                            voiceName: "female"
                                        },
                                        {
                                            text: "I'm doing great, thanks!",
                                            voiceName: "male"
                                        }
                                    ],
                                    speakerCount: 2,
                                    cacheHit: false
                                }, null, 2)}</pre>
                            </div>
                            <div className="note">
                                <strong>Note:</strong> The conversation audio includes automatic pauses (default 0.5 seconds) between speakers to clarify who is talking. Maximum 50 segments per conversation, total character limit of 10,000 characters. Cost is calculated using the formula: <code>totalCharacterCount × 0.000004</code> (Standard voice rate: $4 per 1M characters). For authenticated users, the conversation is saved to history.
                            </div>
                        </div>

                        <div className="endpoint">
                            <div className="endpoint-header">
                                <span className="method get">GET</span>
                                <code>/api/tts/voices</code>
                            </div>
                            <p className="endpoint-desc">Get available voices</p>
                            <div className="response">
                                <strong>Response:</strong>
                                <pre>{JSON.stringify({
                                    success: true,
                                    voices: [
                                        {
                                            value: "female",
                                            label: "Female (Standard)",
                                            gender: "FEMALE",
                                            description: "English female voice (Standard quality)",
                                            googleVoice: "en-US-Standard-C",
                                            sampleRate: 24000
                                        }
                                    ],
                                    recommendedVoice: "female",
                                    totalVoices: 4
                                }, null, 2)}</pre>
                            </div>
                        </div>

                        <div className="endpoint">
                            <div className="endpoint-header">
                                <span className="method get">GET</span>
                                <code>/api/tts/usage</code>
                            </div>
                            <p className="endpoint-desc">Get usage statistics (supports authenticated and anonymous users)</p>
                            <div className="query-params">
                                <strong>Query Parameters:</strong>
                                <pre>?period=month | week | day (optional, default: month)</pre>
                            </div>
                            <div className="headers">
                                <strong>Optional Headers:</strong>
                                <pre>Authorization: Bearer &lt;token&gt; (for authenticated users)</pre>
                            </div>
                            <div className="response">
                                <strong>Response:</strong>
                                <pre>{JSON.stringify({
                                    success: true,
                                    usage: {
                                        totalCharacters: 312,
                                        totalRequests: 2,
                                        totalCostUSD: 0.0012,
                                        period: "month",
                                        startDate: "2024-01-01T00:00:00.000Z",
                                        endDate: "2024-02-01T00:00:00.000Z",
                                        remainingQuota: 999688
                                    }
                                }, null, 2)}</pre>
                            </div>
                            <div className="note">
                                <strong>Note:</strong> Cost is calculated using the formula: <code>totalCharacters × 0.000004</code> (Standard voice rate: $4 per 1M characters). For authenticated users, usage is calculated from database history. For anonymous users, usage is tracked in-memory.
                            </div>
                        </div>

                        <div className="endpoint">
                            <div className="endpoint-header">
                                <span className="method get">GET</span>
                                <code>/api/tts/pricing</code>
                            </div>
                            <p className="endpoint-desc">Get pricing information</p>
                            <div className="response">
                                <strong>Response:</strong>
                                <pre>{JSON.stringify({
                                    success: true,
                                    pricing: {
                                        costPerCharacterUSD: 0.000004,
                                        costPer1000CharactersUSD: 0.004,
                                        freeQuotaPerMonth: 1000000,
                                        supportedVoices: ["female", "male", "neural-female", "neural-male"],
                                        qualityLevel: "Standard & Neural2 quality voices",
                                        lastUpdated: "2024-01-01T00:00:00.000Z"
                                    }
                                }, null, 2)}</pre>
                            </div>
                            <div className="note">
                                <strong>Note:</strong> Cost calculation uses a predefined formula: <code>characterCount × 0.000004</code> for standard voices ($4 per 1M characters). This formula is applied consistently across all endpoints (stats, usage, history) regardless of cache hits or stored database values.
                            </div>
                        </div>
                    </section>

                    <section className="api-section">
                        <h2>📚 History Endpoints</h2>
                        <p className="section-note">🔒 All history endpoints require authentication</p>
                        
                        <div className="endpoint">
                            <div className="endpoint-header">
                                <span className="method get">GET</span>
                                <code>/api/history</code>
                                <span className="auth-badge">🔒 Auth Required</span>
                            </div>
                            <p className="endpoint-desc">Get user's audio generation history (includes both standard and conversation history)</p>
                            <div className="query-params">
                                <strong>Query Parameters:</strong>
                                <pre>?limit=50 (optional, default: 50)
?offset=0 (optional, default: 0)
?type=all | standard | conversation (optional, default: all)</pre>
                            </div>
                            <div className="response">
                                <strong>Response:</strong>
                                <pre>{JSON.stringify({
                                    success: true,
                                    history: [
                                        {
                                            id: 1,
                                            type: "standard",
                                            text: "Hello world",
                                            voice_name: "female",
                                            speaking_rate: 1.0,
                                            character_count: 11,
                                            estimated_cost_usd: 0.000044,
                                            audio_url: "http://localhost:5000/tts-cache/filename.wav",
                                            created_at: "2024-01-01T00:00:00.000Z"
                                        },
                                        {
                                            id: 2,
                                            type: "conversation",
                                            title: "My Conversation",
                                            conversation_data: [
                                                { text: "Hello", voiceName: "female" },
                                                { text: "Hi there", voiceName: "male" }
                                            ],
                                            total_character_count: 15,
                                            estimated_cost_usd: 0.00006,
                                            total_duration: 2,
                                            audio_url: "http://localhost:5000/tts-cache/conversation-filename.wav",
                                            created_at: "2024-01-01T00:00:00.000Z"
                                        }
                                    ],
                                    count: 2
                                }, null, 2)}</pre>
                            </div>
                            <div className="note">
                                <strong>Note:</strong> History items include a <code>type</code> field indicating "standard" or "conversation". Conversation items include <code>conversation_data</code> array with all segments. Cost values in history items are stored from generation time, but for display purposes, cost is calculated using the formula: <code>characterCount × 0.000004</code> (Standard voice rate: $4 per 1M characters).
                            </div>
                        </div>

                        <div className="endpoint">
                            <div className="endpoint-header">
                                <span className="method get">GET</span>
                                <code>/api/history/stats</code>
                                <span className="auth-badge">🔒 Auth Required</span>
                            </div>
                            <p className="endpoint-desc">Get user's usage statistics (includes both standard and conversation history)</p>
                            <div className="headers">
                                <strong>Headers:</strong>
                                <pre>Authorization: Bearer &lt;token&gt;</pre>
                            </div>
                            <div className="response">
                                <strong>Response:</strong>
                                <pre>{JSON.stringify({
                                    success: true,
                                    stats: {
                                        totalGenerations: 2,
                                        totalCharacters: 312,
                                        totalCost: 0.0012,
                                        totalDuration: 33
                                    }
                                }, null, 2)}</pre>
                            </div>
                            <div className="note">
                                <strong>Note:</strong> Statistics are calculated from both <code>audio_history</code> and <code>conversation_history</code> tables. Cost is calculated using the formula: <code>totalCharacters × 0.000004</code> (Standard voice rate: $4 per 1M characters), regardless of cache hits.
                            </div>
                        </div>

                        <div className="endpoint">
                            <div className="endpoint-header">
                                <span className="method get">GET</span>
                                <code>/api/history/:id</code>
                                <span className="auth-badge">🔒 Auth Required</span>
                            </div>
                            <p className="endpoint-desc">Get specific audio history item</p>
                        </div>

                        <div className="endpoint">
                            <div className="endpoint-header">
                                <span className="method delete">DELETE</span>
                                <code>/api/history/:id</code>
                                <span className="auth-badge">🔒 Auth Required</span>
                            </div>
                            <p className="endpoint-desc">Delete specific audio history item</p>
                        </div>
                    </section>

                    <section className="api-section">
                        <h2>🔑 Authentication</h2>
                        <p>For protected endpoints, include the JWT token in the Authorization header:</p>
                        <div className="code-block">
                            <code>Authorization: Bearer &lt;your-jwt-token&gt;</code>
                        </div>
                        <p>Tokens are obtained from the <code>/api/auth/login</code> or <code>/api/auth/signup</code> endpoints.</p>
                    </section>

                    <section className="api-section">
                        <h2>📝 Error Responses</h2>
                        <p>All endpoints return errors in the following format:</p>
                        <div className="code-block">
                            <pre>{JSON.stringify({
                                success: false,
                                message: "Error description",
                                errors: [] // Optional: validation errors
                            }, null, 2)}</pre>
                        </div>
                        <div className="status-codes">
                            <strong>Common Status Codes:</strong>
                            <ul>
                                <li><code>200</code> - Success</li>
                                <li><code>201</code> - Created</li>
                                <li><code>400</code> - Bad Request (validation errors)</li>
                                <li><code>401</code> - Unauthorized (invalid/missing token)</li>
                                <li><code>403</code> - Forbidden</li>
                                <li><code>404</code> - Not Found</li>
                                <li><code>409</code> - Conflict (e.g., username already taken)</li>
                                <li><code>500</code> - Internal Server Error</li>
                            </ul>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}

