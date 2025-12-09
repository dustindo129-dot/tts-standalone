import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './Profile.css';

export default function Profile({ onBack }) {
    const { user, token, logout } = useAuth();
    const [history, setHistory] = useState([]);
    const [stats, setStats] = useState(null);
    const [usage, setUsage] = useState(null);
    const [pricing, setPricing] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('history'); // 'history', 'stats', or 'usage'

    // Audio player state
    const [currentAudioUrl, setCurrentAudioUrl] = useState(null);
    const [currentAudioId, setCurrentAudioId] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [progress, setProgress] = useState(0);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [volume, setVolume] = useState(1.0);
    const [speakingRate, setSpeakingRate] = useState(1.0);
    const [isLooping, setIsLooping] = useState(false);

    const audioRef = useRef(null);

    const API_BASE_URL = 'http://localhost:5000';

    useEffect(() => {
        fetchHistory();
        fetchStats();
        fetchUsage();
        fetchPricing();
    }, []);

    // Refresh stats when switching to stats or usage tab
    useEffect(() => {
        if (activeTab === 'stats') {
            fetchStats();
        } else if (activeTab === 'usage') {
            fetchUsage();
        }
    }, [activeTab]);

    const fetchHistory = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/history?limit=50`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                setHistory(data.history);
            }
        } catch (error) {
            console.error('Failed to fetch history:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchStats = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/history/stats`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                setStats(data.stats);
            }
        } catch (error) {
            console.error('Failed to fetch stats:', error);
        }
    };

    const fetchUsage = async () => {
        try {
            const headers = {};
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }
            
            const response = await fetch(`${API_BASE_URL}/api/tts/usage`, {
                headers: headers
            });
            const data = await response.json();
            if (data.success) {
                setUsage(data.usage);
            }
        } catch (err) {
            console.error('Failed to fetch usage:', err);
        }
    };

    const fetchPricing = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/tts/pricing`);
            const data = await response.json();
            if (data.success) {
                setPricing(data.pricing);
            }
        } catch (err) {
            console.error('Failed to fetch pricing:', err);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Are you sure you want to delete this audio from history?')) {
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/api/history/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                // Remove from local state
                setHistory(history.filter(item => item.id !== id));
                // Refresh stats
                fetchStats();
            }
        } catch (error) {
            console.error('Failed to delete history item:', error);
        }
    };

    const handleLogout = async () => {
        await logout();
        onBack();
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    };

    const formatDuration = (seconds) => {
        if (!seconds) return 'N/A';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
    };

    const formatTime = (time) => {
        if (!time || isNaN(time)) return '0:00';
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    // Audio player handlers
    const handlePlayAudio = (audioUrl, audioId) => {
        // If clicking on a different audio, stop current and start new
        if (currentAudioId !== audioId) {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.currentTime = 0;
            }
            setCurrentAudioUrl(audioUrl);
            setCurrentAudioId(audioId);
            setProgress(0);
            setCurrentTime(0);
            setIsPaused(false);
            
            // Set new audio source and play
            if (audioRef.current) {
                audioRef.current.src = audioUrl;
                audioRef.current.playbackRate = speakingRate;
                audioRef.current.volume = volume;
                audioRef.current.loop = isLooping;
                audioRef.current.load();
                audioRef.current.play();
                setIsPlaying(true);
                setIsPaused(false);
            }
            return;
        }

        // Resume if paused
        if (isPaused && currentAudioId === audioId && audioRef.current) {
            audioRef.current.play();
            setIsPaused(false);
            setIsPlaying(true);
            return;
        }

        // Start playing current audio
        if (audioRef.current && currentAudioId === audioId) {
            audioRef.current.playbackRate = speakingRate;
            audioRef.current.volume = volume;
            audioRef.current.loop = isLooping;
            audioRef.current.play();
            setIsPlaying(true);
            setIsPaused(false);
        }
    };

    const handlePauseAudio = () => {
        if (audioRef.current) {
            audioRef.current.pause();
            setIsPaused(true);
            setIsPlaying(false);
        }
    };

    const handleStopAudio = () => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }
        setIsPlaying(false);
        setIsPaused(false);
        setProgress(0);
        setCurrentTime(0);
    };

    const handleSeek = (e) => {
        if (audioRef.current && duration) {
            const rect = e.target.getBoundingClientRect();
            const percent = (e.clientX - rect.left) / rect.width;
            const newTime = percent * duration;
            audioRef.current.currentTime = newTime;
            setCurrentTime(newTime);
            setProgress(percent * 100);
        }
    };

    const handleSpeedChange = (newRate) => {
        setSpeakingRate(newRate);
        if (audioRef.current) {
            audioRef.current.playbackRate = newRate;
        }
    };

    // Audio event handlers
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const updateTime = () => {
            setCurrentTime(audio.currentTime);
            setProgress((audio.currentTime / audio.duration) * 100);
        };

        const updateDuration = () => {
            setDuration(audio.duration);
        };

        const handleEnded = () => {
            if (!isLooping) {
                setIsPlaying(false);
                setIsPaused(false);
                setCurrentTime(0);
                setProgress(0);
            }
        };

        audio.addEventListener('timeupdate', updateTime);
        audio.addEventListener('loadedmetadata', updateDuration);
        audio.addEventListener('ended', handleEnded);

        return () => {
            audio.removeEventListener('timeupdate', updateTime);
            audio.removeEventListener('loadedmetadata', updateDuration);
            audio.removeEventListener('ended', handleEnded);
        };
    }, [currentAudioUrl, isLooping]);

    // Update audio properties when state changes
    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.volume = volume;
        }
    }, [volume]);

    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.loop = isLooping;
        }
    }, [isLooping]);

    return (
        <div className="profile-page">
            <div className="profile-container">
                <div className="profile-header">
                    <button onClick={onBack} className="back-btn">
                        ← Back to TTS
                    </button>
                    <div className="profile-user-info">
                        <div className="profile-avatar">
                            {user?.username?.charAt(0).toUpperCase() || 'U'}
                        </div>
                        <div>
                            <h2>👤 {user?.username}</h2>
                            <p>Member since {new Date(user?.createdAt).toLocaleDateString()}</p>
                        </div>
                    </div>
                    <button onClick={handleLogout} className="logout-btn">
                        🚪 Logout
                    </button>
                </div>

                <div className="profile-tabs">
                    <button
                        className={activeTab === 'history' ? 'active' : ''}
                        onClick={() => setActiveTab('history')}
                    >
                        📚 Audio History
                    </button>
                    <button
                        className={activeTab === 'stats' ? 'active' : ''}
                        onClick={() => setActiveTab('stats')}
                    >
                        📊 My Statistics
                    </button>
                    <button
                        className={activeTab === 'usage' ? 'active' : ''}
                        onClick={() => setActiveTab('usage')}
                    >
                        💰 Usage & Pricing
                    </button>
                </div>

                <div className="profile-content">
                    {activeTab === 'stats' && (
                        <div className="stats-section-profile">
                            <h3>📊 Your TTS Statistics</h3>
                            {stats ? (
                                <div className="stats-grid">
                                    <div className="stat-card">
                                        <div className="stat-icon">🎵</div>
                                        <div className="stat-value">{stats.totalGenerations || 0}</div>
                                        <div className="stat-label">Total Generations</div>
                                    </div>
                                    <div className="stat-card">
                                        <div className="stat-icon">📝</div>
                                        <div className="stat-value">{(stats.totalCharacters || 0).toLocaleString()}</div>
                                        <div className="stat-label">Characters Processed</div>
                                    </div>
                                    <div className="stat-card">
                                        <div className="stat-icon">💰</div>
                                        <div className="stat-value">${(stats.totalCost || 0).toFixed(4)}</div>
                                        <div className="stat-label">Total Cost (USD)</div>
                                    </div>
                                    <div className="stat-card">
                                        <div className="stat-icon">⏱️</div>
                                        <div className="stat-value">{formatDuration(stats.totalDuration || 0)}</div>
                                        <div className="stat-label">Total Audio Duration</div>
                                    </div>
                                </div>
                            ) : (
                                <div className="loading-state">
                                    <div className="spinner"></div>
                                    <p>Loading statistics...</p>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'usage' && (
                        <div className="usage-section-profile">
                            <h3>💰 Usage & Pricing Information</h3>
                            <div className="usage-pricing-grid">
                                {usage ? (
                                    <div className="usage-card">
                                        <h4>📈 Current Usage</h4>
                                        <div className="usage-item">
                                            <span>Characters processed:</span>
                                            <strong>{(usage.totalCharacters || 0).toLocaleString()}</strong>
                                        </div>
                                        <div className="usage-item">
                                            <span>Total requests:</span>
                                            <strong>{usage.totalRequests || 0}</strong>
                                        </div>
                                        <div className="usage-item">
                                            <span>Estimated cost:</span>
                                            <strong>${(usage.totalCostUSD || 0).toFixed(4)} USD</strong>
                                        </div>
                                        {usage.remainingQuota !== undefined && (
                                            <div className="usage-item">
                                                <span>Remaining quota:</span>
                                                <strong>{(usage.remainingQuota || 0).toLocaleString()} chars</strong>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="usage-card">
                                        <h4>📈 Current Usage</h4>
                                        <div className="loading-state">
                                            <div className="spinner"></div>
                                            <p>Loading usage data...</p>
                                        </div>
                                    </div>
                                )}

                                {pricing && (
                                    <div className="pricing-card">
                                        <h4>💵 Pricing Details</h4>
                                        <div className="usage-item">
                                            <span>Standard voices (per 1000 chars):</span>
                                            <strong>${pricing.standardCostPer1000CharactersUSD?.toFixed(4) || '0.0040'} USD</strong>
                                        </div>
                                        <div className="usage-item">
                                            <span>Neural2 voices (per 1000 chars):</span>
                                            <strong>${pricing.neural2CostPer1000CharactersUSD?.toFixed(4) || '0.0160'} USD</strong>
                                        </div>
                                        <div className="usage-item">
                                            <span>Free quota per month:</span>
                                            <strong>{pricing.freeQuotaPerMonth?.toLocaleString() || '1,000,000'} chars</strong>
                                        </div>
                                        <div className="usage-item">
                                            <span>Quality:</span>
                                            <strong>{pricing.qualityLevel || 'Standard & Neural2 quality voices'}</strong>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'history' && (
                        <div className="history-section">
                            {loading ? (
                                <div className="loading-state">
                                    <div className="spinner"></div>
                                    <p>Loading history...</p>
                                </div>
                            ) : history.length === 0 ? (
                                <div className="empty-state">
                                    <div className="empty-icon">🎤</div>
                                    <h3>No audio generated yet</h3>
                                    <p>Start generating text-to-speech audio to see your history here!</p>
                                </div>
                            ) : (
                                <div className="history-list">
                                    {history.map((item) => (
                                        <div key={item.id} className={`history-item ${item.type === 'conversation' ? 'history-item-conversation' : ''}`}>
                                            <div className="history-item-header">
                                                <div className="history-header-left">
                                                    {item.type === 'conversation' ? (
                                                        <span className="conversation-badge">💬 Conversation</span>
                                                    ) : (
                                                        <span className="standard-badge">🎤 Standard</span>
                                                    )}
                                                    <span className="history-date">
                                                        🕒 {formatDate(item.created_at)}
                                                    </span>
                                                </div>
                                                <button
                                                    onClick={() => handleDelete(item.id)}
                                                    className="delete-btn"
                                                    title="Delete from history"
                                                >
                                                    🗑️
                                                </button>
                                            </div>

                                            {item.type === 'conversation' ? (
                                                /* Conversation History Item */
                                                <>
                                                    <div className="conversation-title">
                                                        <strong>{item.title || 'Untitled Conversation'}</strong>
                                                    </div>
                                                    <div className="conversation-segments">
                                                        {item.conversation_data && (Array.isArray(item.conversation_data) ? item.conversation_data : JSON.parse(item.conversation_data)).map((segment, idx) => (
                                                            <div key={idx} className="conversation-segment">
                                                                <div className="segment-voice-label">
                                                                    🎭 {segment.voiceName}
                                                                </div>
                                                                <div className="segment-text">
                                                                    {segment.text.length > 150
                                                                        ? segment.text.substring(0, 150) + '...'
                                                                        : segment.text}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    <div className="history-meta">
                                                        {(() => {
                                                            const segments = item.conversation_data ? (Array.isArray(item.conversation_data) ? item.conversation_data : JSON.parse(item.conversation_data)) : [];
                                                            const uniqueVoices = [...new Set(segments.map(s => s.voiceName))];
                                                            const voicesDisplay = uniqueVoices.length === 1 
                                                                ? uniqueVoices[0] 
                                                                : uniqueVoices.length > 0 
                                                                    ? `${uniqueVoices.length} voices` 
                                                                    : 'N/A';
                                                            return (
                                                                <>
                                                                    <span>🎭 {voicesDisplay}</span>
                                                                    <span>⚡ 1.0x</span>
                                                                    <span>👥 {segments.length} segments</span>
                                                                     <span>📏 {item.total_character_count} chars</span>
                                                                     <span>⏱️ {formatDuration(item.total_duration)}</span>
                                                                     <span>💵 ${(item.total_character_count * 0.000004).toFixed(4)}</span>
                                                                </>
                                                            );
                                                        })()}
                                                    </div>
                                                </>
                                            ) : (
                                                /* Standard History Item */
                                                <>
                                                    <div className="history-text">
                                                        {item.text.length > 200
                                                            ? item.text.substring(0, 200) + '...'
                                                            : item.text}
                                                    </div>
                                                    <div className="history-meta">
                                                        <span>🎭 {item.voice_name}</span>
                                                        <span>⚡ {item.speaking_rate}x</span>
                                                         <span>📏 {item.character_count} chars</span>
                                                         <span>💵 ${(item.character_count * 0.000004).toFixed(4)}</span>
                                                    </div>
                                                </>
                                            )}

                                            {/* Audio Player Interface */}
                                            {currentAudioId === item.id ? (
                                                <div className="history-audio-player">
                                                    <div className="history-player-controls">
                                                        {isPlaying ? (
                                                            <button onClick={handlePauseAudio} className="btn btn-secondary">
                                                                ⏸️ Pause
                                                            </button>
                                                        ) : isPaused ? (
                                                            <button onClick={() => handlePlayAudio(item.audio_url, item.id)} className="btn btn-secondary">
                                                                ▶️ Resume
                                                            </button>
                                                        ) : (
                                                            <button onClick={() => handlePlayAudio(item.audio_url, item.id)} className="btn btn-secondary">
                                                                ▶️ Play
                                                            </button>
                                                        )}
                                                        <button onClick={handleStopAudio} className="btn btn-secondary">
                                                            ⏹️ Stop
                                                        </button>
                                                        <a
                                                            href={item.audio_url}
                                                            download
                                                            className="btn btn-success"
                                                        >
                                                            💾 Download
                                                        </a>
                                                    </div>

                                                    {/* Speed and Volume Controls */}
                                                    <div className="history-audio-controls">
                                                        <div className="history-audio-controls-grid">
                                                            <div className="control-group">
                                                                <label>⚡ Speed: {speakingRate}x</label>
                                                                <input
                                                                    type="range"
                                                                    min="0.25"
                                                                    max="2.0"
                                                                    step="0.25"
                                                                    value={speakingRate}
                                                                    onChange={(e) => handleSpeedChange(parseFloat(e.target.value))}
                                                                    className="range-input"
                                                                />
                                                            </div>

                                                            <div className="control-group">
                                                                <label>🔊 Volume: {Math.round(volume * 100)}%</label>
                                                                <input
                                                                    type="range"
                                                                    min="0"
                                                                    max="1"
                                                                    step="0.1"
                                                                    value={volume}
                                                                    onChange={(e) => setVolume(parseFloat(e.target.value))}
                                                                    className="range-input"
                                                                />
                                                            </div>

                                                            <div className="control-group control-group-horizontal">
                                                                <label>Loop</label>
                                                                <div className="toggle-container">
                                                                    <input
                                                                        type="checkbox"
                                                                        id={`loop-toggle-${item.id}`}
                                                                        checked={isLooping}
                                                                        onChange={(e) => setIsLooping(e.target.checked)}
                                                                        className="toggle-input"
                                                                    />
                                                                    <label htmlFor={`loop-toggle-${item.id}`} className="toggle-label">
                                                                        <span className="toggle-slider"></span>
                                                                    </label>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Audio Progress Bar */}
                                                    <div className="history-audio-progress">
                                                        <div className="time-display">
                                                            <span>{formatTime(currentTime)}</span>
                                                            <span>{formatTime(duration)}</span>
                                                        </div>
                                                        <div className="progress-bar" onClick={handleSeek}>
                                                            <div 
                                                                className="progress-fill" 
                                                                style={{ width: `${progress}%` }}
                                                            ></div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="history-actions">
                                                    <button
                                                        onClick={() => handlePlayAudio(item.audio_url, item.id)}
                                                        className="play-btn"
                                                    >
                                                        ▶️ Play
                                                    </button>
                                                    <a
                                                        href={item.audio_url}
                                                        download
                                                        className="download-btn"
                                                    >
                                                        💾 Download
                                                    </a>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Hidden Audio Element */}
            <audio 
                ref={audioRef}
                onEnded={() => {
                    if (!isLooping) {
                        setIsPlaying(false);
                        setIsPaused(false);
                        setCurrentTime(0);
                        setProgress(0);
                    }
                }}
                style={{ display: 'none' }}
            />
        </div>
    );
}

