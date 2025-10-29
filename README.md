# TTS Standalone Service

A standalone Text-to-Speech service powered by Google Cloud TTS API, featuring a modern web interface for converting English text to high-quality speech.

## 🎯 Features

- **Natural Voice Synthesis**: Multiple voice options (male/female, standard/neural quality)
- **Real-time Audio Playback**: Built-in audio player with play/pause/stop controls
- **Audio Caching**: Intelligent caching system to reduce API calls and costs
- **Usage Tracking**: Monitor character count, API usage, and estimated costs
- **Flexible Configuration**: Adjust speaking rate, volume, and voice selection
- **Developer-Friendly**: Fallback to mock TTS for development without API credentials
- **Clean API**: RESTful endpoints for TTS generation, usage stats, and pricing info

## 🏗️ Architecture

### Backend (Express.js)
- **Server**: `backend/server.js` - Main Express server
- **TTS Service**: `backend/services/ttsService.js` - Google Cloud TTS integration
- **Routes**: `backend/routes/tts.js` - API endpoints
- **Cache**: `backend/public/tts-cache/` - Audio file storage

### Frontend (React + Vite)
- **Main App**: `frontend/src/App.jsx` - TTS interface
- **Styling**: Modern CSS with responsive design

## 📦 Installation

### Prerequisites
- Node.js (v18+)
- npm or yarn
- Google Cloud Project with TTS API enabled (optional for development)

### Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/tts-standalone.git
   cd tts-standalone
   ```

2. **Install backend dependencies**
   ```bash
   cd backend
   npm install
   ```

3. **Install frontend dependencies**
   ```bash
   cd ../frontend
   npm install
   ```

4. **Configure environment variables**

   Create `backend/.env` file:
   ```env
   PORT=5000
   FRONTEND_URL=http://localhost:5173
   BACKEND_URL=http://localhost:5000
   
   # Google Cloud TTS (optional for development)
   GOOGLE_CLOUD_PROJECT_ID=your-project-id
   GOOGLE_APPLICATION_CREDENTIALS_JSON='{"type":"service_account",...}'
   ```

## 🚀 Usage

### Development Mode

1. **Start the backend server**
   ```bash
   cd backend
   npm run dev
   ```
   Server will run on `http://localhost:5000`

2. **Start the frontend**
   ```bash
   cd frontend
   npm run dev
   ```
   Frontend will run on `http://localhost:5173`

3. **Open the app** in your browser at `http://localhost:5173`

### Production

1. **Build the frontend**
   ```bash
   cd frontend
   npm run build
   ```

2. **Start the backend**
   ```bash
   cd backend
   npm start
   ```

## 🎙️ API Endpoints

### POST `/api/tts/generate`
Generate TTS audio from text.

**Request:**
```json
{
  "text": "Hello, world!",
  "voiceName": "female",
  "languageCode": "en-US",
  "audioConfig": {
    "speakingRate": 1.0,
    "pitch": 0.0,
    "volumeGainDb": 0.0
  }
}
```

**Response:**
```json
{
  "success": true,
  "audioUrl": "http://localhost:5000/tts-cache/tts-female-abc123-1234567890.mp3",
  "characterCount": 13,
  "estimatedCostUSD": 0.0001,
  "duration": 2,
  "voiceUsed": "en-US-Standard-C",
  "cacheHit": false
}
```

### GET `/api/tts/voices`
Get available voice options.

### GET `/api/tts/pricing`
Get pricing information.

### GET `/api/tts/usage`
Get usage statistics.

## 🎭 Available Voices

- **female** - Female voice (Standard quality) - `en-US-Standard-C`
- **male** - Male voice (Standard quality) - `en-US-Standard-B`
- **neural-female** - Female voice (Neural2 quality) - `en-US-Neural2-F`
- **neural-male** - Male voice (Neural2 quality) - `en-US-Neural2-D`

## 💰 Pricing

- **Cost**: ~$4 per 1M characters
- **Free Tier**: 1M characters per month
- **Quality**: Standard and Neural2 voice options

## 🔧 Configuration

### Audio Configuration
- **Speaking Rate**: 0.25x - 4.0x (default: 1.0x)
- **Pitch**: -20.0 to +20.0 semitones (default: 0.0)
- **Volume Gain**: -96.0 to +16.0 dB (default: 0.0 dB)

### Cache Settings
- **Location**: `backend/public/tts-cache/`
- **Expiry**: 7 days
- **Max Size**: 1GB

## 🛠️ Tech Stack

- **Backend**: Node.js, Express.js
- **Frontend**: React 19, Vite
- **TTS API**: Google Cloud Text-to-Speech
- **Storage**: File-based caching
- **Validation**: express-validator

## 📝 License

MIT License - feel free to use this project for your own purposes.

## 👤 Author

**Dustin Do**
- Built with ❤️ for text-to-speech conversion

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 Note

This project uses Google Cloud TTS API which requires:
- A Google Cloud account
- TTS API enabled
- Billing account (though free tier is generous)

For development without credentials, the service falls back to mock TTS generation.

