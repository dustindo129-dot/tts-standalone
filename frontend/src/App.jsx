import { useState, useRef, useCallback, useEffect } from 'react';
import './App.css';

function App() {
  // State management
  const [text, setText] = useState('');
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
  const [voices, setVoices] = useState([]);
  const [pricing, setPricing] = useState(null);
  const [usage, setUsage] = useState(null);

  // Refs
  const audioRef = useRef(null);

  // Fetch available voices on component mount
  useEffect(() => {
    fetchVoices();
    fetchPricing();
    fetchUsage();
  }, []);

  // Update audio element properties when volume changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

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
      setIsPlaying(false);
      setIsPaused(false);
      setCurrentTime(0);
      setProgress(0);
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

  // Fetch pricing information
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

  // Fetch usage statistics
  const fetchUsage = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/tts/usage`);
      const data = await response.json();
      if (data.success) {
        setUsage(data.usage);
      }
    } catch (err) {
      console.error('Failed to fetch usage:', err);
    }
  };

  // Generate TTS audio
  const generateTTS = async (text) => {
    try {
      setLoading(true);
      setError('');
      
      const response = await fetch(`${API_BASE_URL}/api/tts/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
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
      
      // Update usage statistics
      fetchUsage();
      
      return data.audioUrl;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
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
  };

  // Pause audio
  const handlePause = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPaused(true);
      setIsPlaying(false);
    }
  };

  // Stop audio
  const handleStop = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
      setIsPaused(false);
      setCurrentTime(0);
      setProgress(0);
    }
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
          <h1>🎤 Cloud Text-to-Speech Service</h1>
          <p>Convert English text to natural-sounding audio powered by Google Cloud TTS</p>
        </div>
      </header>

      <main className="main">
        <div className="container">
          <div className="tts-interface">
            
            {/* Text Input Section */}
            <section className="input-section">
              <div className="section-header">
                <h2>📝 Text Input</h2>
                <span className="char-count">{text.length} / 100,000 characters</span>
              </div>
              
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Enter your English text here to convert to speech..."
                rows={8}
                maxLength={100000}
                className="text-input"
              />

              {/* Voice and Settings */}
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

                <div className="setting-group">
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

                <div className="setting-group">
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
              </div>
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
                  disabled={loading || !text.trim()}
                  className={`btn btn-primary ${loading ? 'loading' : ''}`}
                >
                  {loading ? (
                    <>🔄 Generating...</>
                  ) : isPlaying ? (
                    <>▶️ Playing...</>
                  ) : (
                    <>🎵 Generate & Play</>
                  )}
                </button>

                {(isPlaying || isPaused) && (
                  <>
                    <button onClick={handlePause} className="btn btn-secondary">
                      ⏸️ Pause
                    </button>
                    <button onClick={handleStop} className="btn btn-secondary">
                      ⏹️ Stop
                    </button>
                  </>
                )}

                {audioUrl && (
                  <button onClick={handleDownload} className="btn btn-success">
                    💾 Download MP3
                  </button>
                )}
              </div>

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

            {/* Statistics Section */}
            <section className="stats-section">
              <div className="section-header">
                <h2>📊 Usage & Pricing</h2>
              </div>
              
              <div className="stats-grid">
                {usage && (
                  <div className="stat-card">
                    <h3>📈 Usage Statistics</h3>
                    <div className="stat-item">
                      <span>Characters processed:</span>
                      <strong>{usage.totalCharacters.toLocaleString()}</strong>
                    </div>
                    <div className="stat-item">
                      <span>Total requests:</span>
                      <strong>{usage.totalRequests}</strong>
                    </div>
                    <div className="stat-item">
                      <span>Estimated cost:</span>
                      <strong>${usage.totalCostUSD.toFixed(4)} USD</strong>
                    </div>
                  </div>
                )}

                {pricing && (
                  <div className="stat-card">
                    <h3>💰 Pricing Information</h3>
                    <div className="stat-item">
                      <span>Cost per 1000 chars:</span>
                      <strong>${pricing.costPer1000CharactersUSD.toFixed(4)} USD</strong>
                    </div>
                    <div className="stat-item">
                      <span>Free quota per month:</span>
                      <strong>{pricing.freeQuotaPerMonth.toLocaleString()} chars</strong>
                    </div>
                    <div className="stat-item">
                      <span>Quality:</span>
                      <strong>{pricing.qualityLevel}</strong>
                    </div>
                  </div>
                )}
              </div>
            </section>

          </div>
        </div>
      </main>

      <footer className="footer">
        <div className="container">
          <p>
            ⚡ Powered by <strong>Google Cloud Text-to-Speech API</strong> | 
            🎯 Built with React & Vite | 
            🇺🇸 English Language Support
          </p>
          <p>
            <a href="/api" target="_blank" rel="noopener noreferrer">API Documentation</a> | 
            <a href="/health" target="_blank" rel="noopener noreferrer">Health Check</a>
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
    </div>
  );
}

export default App;