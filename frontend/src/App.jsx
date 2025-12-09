import { useState, useRef, useCallback, useEffect } from 'react';
import './App.css';
import { useAuth } from './contexts/AuthContext';
import Auth from './components/Auth';
import Profile from './components/Profile';
import ApiDocs from './components/ApiDocs';

function App() {
  // Auth state
  const { user, isAuthenticated, token } = useAuth();
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'signup'
  const [currentPage, setCurrentPage] = useState('tts'); // 'tts', 'profile', or 'api-docs'

  // State management
  const [inputMode, setInputMode] = useState('standard'); // 'standard' or 'conversation'
  const [text, setText] = useState('');
  const [audioTitle, setAudioTitle] = useState(''); // Optional title for standard mode
  const [voice, setVoice] = useState('female'); // female, male, neural-female, neural-male
  const [speakingRate, setSpeakingRate] = useState(1.0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(1.0);
  const [isLooping, setIsLooping] = useState(false);
  const [voices, setVoices] = useState([]);
  
  // Conversation mode state
  const [conversationSegments, setConversationSegments] = useState([
    { id: 1, text: '', voiceName: 'female' },
    { id: 2, text: '', voiceName: 'male' }
  ]);
  const [conversationTitle, setConversationTitle] = useState('');

  // Refs
  const audioRef = useRef(null);

  // Fetch available voices on component mount
  useEffect(() => {
    fetchVoices();
  }, []);

  // Update audio element properties when volume changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  // Update loop when state changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.loop = isLooping;
    }
  }, [isLooping]);

  // Track audio progress
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

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('ended', () => {
      if (!isLooping) {
        setIsPlaying(false);
        setIsPaused(false);
        setCurrentTime(0);
        setProgress(0);
      }
    });

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
    };
  }, [audioUrl]);

  const API_BASE_URL = 'http://localhost:5000';

  // Fetch available voices
  const fetchVoices = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/tts/voices`);
      const data = await response.json();
      if (data.success) {
        setVoices(data.voices);
      }
    } catch (err) {
      console.error('Failed to fetch voices:', err);
    }
  };

  // Generate TTS audio
  const generateTTS = async (text) => {
    try {
      setLoading(true);
      setError('');
      
      const headers = {
        'Content-Type': 'application/json',
      };
      
      // Add authorization header if user is logged in
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch(`${API_BASE_URL}/api/tts/generate`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          text: text,
          languageCode: 'en-US',
          voiceName: voice,
          audioConfig: {
            audioEncoding: 'MP3',
            speakingRate: speakingRate,
            pitch: 0.0,
            volumeGainDb: 0.0
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'TTS generation failed');
      }
      
      const data = await response.json();
      setAudioUrl(data.audioUrl);
      
      return data.audioUrl;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Generate conversation TTS audio
  const generateConversationTTS = async () => {
    try {
      setLoading(true);
      setError('');
      
      // Filter out empty segments
      const validSegments = conversationSegments.filter(seg => seg.text.trim());
      
      if (validSegments.length === 0) {
        setError('Please enter text for at least one conversation segment');
        setLoading(false);
        return;
      }
      
      const headers = {
        'Content-Type': 'application/json',
      };
      
      // Add authorization header if user is logged in
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch(`${API_BASE_URL}/api/tts/generate-conversation`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          conversationSegments: validSegments.map(seg => ({
            text: seg.text,
            voiceName: seg.voiceName
          })),
          title: conversationTitle || null,
          speakerPauseDuration: 0.5
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Conversation TTS generation failed');
      }
      
      const data = await response.json();
      setAudioUrl(data.audioUrl);
      
      return data.audioUrl;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Conversation segment handlers
  const addConversationSegment = () => {
    const newId = Math.max(...conversationSegments.map(s => s.id)) + 1;
    setConversationSegments([
      ...conversationSegments,
      { id: newId, text: '', voiceName: 'female' }
    ]);
  };

  const removeConversationSegment = (id) => {
    if (conversationSegments.length > 1) {
      setConversationSegments(conversationSegments.filter(seg => seg.id !== id));
    }
  };

  const updateConversationSegment = (id, field, value) => {
    setConversationSegments(conversationSegments.map(seg => 
      seg.id === id ? { ...seg, [field]: value } : seg
    ));
  };

  // Play audio
  const handlePlay = async () => {
    if (isPaused && audioRef.current) {
      audioRef.current.play();
      setIsPaused(false);
      setIsPlaying(true);
      return;
    }

    if (audioUrl && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play();
      setIsPlaying(true);
      return;
    }

    // Handle different input modes
    if (inputMode === 'standard') {
      if (!text.trim()) {
        setError('Please enter text to synthesize');
        return;
      }

      try {
        const url = await generateTTS(text);
        if (url && audioRef.current) {
          audioRef.current.src = url;
          audioRef.current.playbackRate = speakingRate;
          audioRef.current.play();
          setIsPlaying(true);
        }
      } catch (err) {
        // Error already handled in generateTTS
      }
    } else if (inputMode === 'conversation') {
      const validSegments = conversationSegments.filter(seg => seg.text.trim());
      if (validSegments.length === 0) {
        setError('Please enter text for at least one conversation segment');
        return;
      }

      try {
        const url = await generateConversationTTS();
        if (url && audioRef.current) {
          audioRef.current.src = url;
          audioRef.current.play();
          setIsPlaying(true);
        }
      } catch (err) {
        // Error already handled in generateConversationTTS
      }
    }
  };

  // Pause audio
  const handlePause = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPaused(true);
      setIsPlaying(false);
    }
  };

  // Clear audio
  const handleClear = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current.currentTime = 0;
    }
    setIsPlaying(false);
    setIsPaused(false);
    setAudioUrl(null);
    setCurrentTime(0);
    setProgress(0);
    setDuration(0);
    setIsLooping(false);
  };

  // Seek in audio
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

  // Format time for display
  const formatTime = (time) => {
    if (!time || isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Update playback rate in real-time
  const handleSpeedChange = (newRate) => {
    setSpeakingRate(newRate);
    if (audioRef.current) {
      audioRef.current.playbackRate = newRate;
    }
  };

  // Download audio file
  const handleDownload = () => {
    if (audioUrl) {
      const a = document.createElement('a');
      a.href = audioUrl;
      a.download = `tts-audio-${Date.now()}.mp3`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  return (
    <div className="tts-app">
      <header className="header">
        <div className="container">
          <div className="header-content">
            <div className="header-text">
              <h1>🎤 Cloud Text-to-Speech Service</h1>
              <p>Convert English text to natural-sounding audio powered by Google Cloud TTS (Project by Dustin Do)</p>
            </div>
            <div className="header-actions">
              {isAuthenticated ? (
                <button onClick={() => setCurrentPage('profile')} className="user-btn">
                  👤 {user?.username}
                </button>
              ) : (
                <>
                  <button onClick={() => { setAuthMode('login'); setShowAuth(true); }} className="login-btn">
                    🔐 Login
                  </button>
                  <button onClick={() => { setAuthMode('signup'); setShowAuth(true); }} className="signup-btn">
                    📝 Sign Up
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {currentPage === 'tts' ? (
        <main className="main">
          <div className="container">
            <div className="tts-interface">
            
            {/* Text Input Section with Tabs */}
            <section className="input-section">
              <div className="section-header">
                <h2>📝 Text Input</h2>
                <div className="input-mode-tabs">
                  <button 
                    className={`tab-btn ${inputMode === 'standard' ? 'active' : ''}`}
                    onClick={() => setInputMode('standard')}
                  >
                    Standard
                  </button>
                  <button 
                    className={`tab-btn ${inputMode === 'conversation' ? 'active' : ''}`}
                    onClick={() => setInputMode('conversation')}
                  >
                    Conversation
                  </button>
                </div>
              </div>

              {/* Standard Mode */}
              {inputMode === 'standard' && (
                <>
                  <div className="standard-header">
                    <input
                      type="text"
                      value={audioTitle}
                      onChange={(e) => setAudioTitle(e.target.value)}
                      placeholder="Audio title (optional)"
                      className="audio-title-input"
                    />
                  </div>
                  
                  <div className="text-input-wrapper">
                    <textarea
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      placeholder="Enter your English text here to convert to speech..."
                      rows={8}
                      maxLength={100000}
                      className="text-input"
                    />
                    <div className="char-count-bottom">
                      <span className="char-count">{text.length} / 100,000 characters</span>
                    </div>
                  </div>

                  {/* Voice Settings */}
                  <div className="settings-grid">
                    <div className="setting-group">
                      <label>🎭 Voice:</label>
                      <select value={voice} onChange={(e) => setVoice(e.target.value)} className="select-input">
                        {voices.map(v => (
                          <option key={v.value} value={v.value}>
                            {v.label} - {v.description}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </>
              )}

              {/* Conversation Mode */}
              {inputMode === 'conversation' && (
                <div className="conversation-mode">
                  <div className="conversation-header">
                    <input
                      type="text"
                      value={conversationTitle}
                      onChange={(e) => setConversationTitle(e.target.value)}
                      placeholder="Conversation title (optional)"
                      className="conversation-title-input"
                    />
                  </div>

                  <div className="conversation-table">
                    <div className="conversation-table-header">
                      <div className="col-text">Text</div>
                      <div className="col-voice">Voice / Model</div>
                      <div className="col-actions">Actions</div>
                    </div>

                    {conversationSegments.map((segment, index) => (
                      <div key={segment.id} className="conversation-row">
                        <div className="col-text">
                          <textarea
                            value={segment.text}
                            onChange={(e) => updateConversationSegment(segment.id, 'text', e.target.value)}
                            placeholder={`Speaker ${index + 1} text...`}
                            rows={3}
                            maxLength={1000}
                            className="conversation-text-input"
                          />
                          <span className="segment-char-count">{segment.text.length} / 1,000</span>
                        </div>
                        
                        <div className="col-voice">
                          <select 
                            value={segment.voiceName} 
                            onChange={(e) => updateConversationSegment(segment.id, 'voiceName', e.target.value)}
                            className="conversation-voice-select"
                          >
                            {voices.map(v => (
                              <option key={v.value} value={v.value}>
                                {v.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="col-actions">
                          <button
                            onClick={() => removeConversationSegment(segment.id)}
                            className="btn-remove-segment"
                            disabled={conversationSegments.length === 1}
                            title="Remove segment"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={addConversationSegment}
                    className="btn-add-segment"
                    disabled={conversationSegments.length >= 20}
                  >
                    ➕ Add Segment
                  </button>

                  {conversationSegments.length >= 20 && (
                    <p className="warning-text">Maximum 20 segments reached</p>
                  )}
                </div>
              )}
            </section>

            {/* Error Display */}
            {error && (
              <div className="error-message">
                ❌ {error}
              </div>
            )}

            {/* Controls Section */}
            <section className="controls-section">
              <div className="section-header">
                <h2>🎮 Audio Controls</h2>
              </div>

              <div className="primary-controls">
                <button 
                  onClick={handlePlay} 
                  disabled={loading || audioUrl || (inputMode === 'standard' && !text.trim()) || (inputMode === 'conversation' && conversationSegments.filter(s => s.text.trim()).length === 0)}
                  className={`btn btn-primary ${loading ? 'loading' : ''}`}
                >
                  {loading ? (
                    <>Generating...</>
                  ) : inputMode === 'conversation' ? (
                    <>🎵 Generate Conversation</>
                  ) : (
                    <>🎵 Generate & Play</>
                  )}
                </button>

                {audioUrl && (
                  <>
                    {isPlaying ? (
                      <button onClick={handlePause} className="btn btn-secondary">
                        ⏸️ Pause
                      </button>
                    ) : isPaused ? (
                      <button onClick={handlePlay} className="btn btn-secondary">
                        ▶️ Resume
                      </button>
                    ) : (
                      <button onClick={handlePlay} className="btn btn-secondary">
                        ▶️ Play
                      </button>
                    )}
                    <button onClick={handleClear} className="btn btn-secondary">
                      🗑️ Clear
                    </button>
                    <button onClick={handleDownload} className="btn btn-success">
                      💾 Download MP3
                    </button>
                  </>
                )}
              </div>

              {/* Speed and Volume Controls - Only show when audio exists */}
              {audioUrl && (
                <div className="audio-controls">
                  <div className="audio-controls-grid">
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
                          id="loop-toggle"
                          checked={isLooping}
                          onChange={(e) => setIsLooping(e.target.checked)}
                          className="toggle-input"
                        />
                        <label htmlFor="loop-toggle" className="toggle-label">
                          <span className="toggle-slider"></span>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Audio Progress Bar */}
              {audioUrl && (
                <div className="audio-progress">
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
              )}
            </section>

            </div>
          </div>
        </main>
      ) : currentPage === 'profile' ? (
        <Profile onBack={() => setCurrentPage('tts')} />
      ) : (
        <ApiDocs onBack={() => setCurrentPage('tts')} />
      )}

      <footer className="footer">
        <div className="container">
          <p>
            ⚡ Powered by <strong>Google Cloud Text-to-Speech API</strong> | 
            🎯 Built with React & Vite | 
            🇺🇸 English Language Support
          </p>
          <p>
            <button onClick={() => setCurrentPage('api-docs')} className="footer-link">
              API Documentation
            </button>
          </p>
        </div>
      </footer>

      {/* Hidden Audio Element */}
      <audio 
        ref={audioRef}
        onEnded={() => {
          setIsPlaying(false);
          setIsPaused(false);
        }}
        style={{ display: 'none' }}
      />

      {/* Auth Modal */}
      {showAuth && <Auth onClose={() => setShowAuth(false)} initialMode={authMode} />}
    </div>
  );
}

export default App;