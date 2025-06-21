# AI Lead Caller Platform

An AI-powered cold calling lead generation platform built with Node.js/Express backend and React frontend. This platform automates lead discovery, conducts intelligent AI-powered phone calls, and provides real-time monitoring and analytics.

## 🚀 Features

### Core Features
- **🎯 Lead Generation**: Automated lead discovery using Google Maps scraping
- **🤖 AI-Powered Calling**: Intelligent conversation management with Plivo integration
- **📞 Real-time Call Monitoring**: Live call tracking with WebSocket updates
- **📊 Campaign Management**: Create and manage calling campaigns with analytics
- **🎙️ Text-to-Speech**: Multiple TTS providers (PlayHT, ElevenLabs, CoquiTTS)
- **💬 Conversation AI**: Advanced objection handling and script management
- **💳 Payment Integration**: Stripe-powered subscription management
- **🔐 User Authentication**: Secure JWT-based authentication

### Advanced Features
- **📈 Real-time Analytics**: Track call performance and conversion rates
- **🎨 Voice Customization**: Multiple voice options and settings
- **📝 Script Templates**: Pre-built and custom call scripts
- **🔄 Webhook Integration**: Real-time call event processing
- **📱 WebSocket Support**: Live call monitoring and updates
- **🎵 Audio Processing**: WAV conversion and audio merging capabilities

## 🛠️ Tech Stack

### Backend
- **Runtime**: Node.js with Express.js
- **Database**: MongoDB with Mongoose ODM
- **Queue**: Redis with Bull for job processing
- **Calling**: Plivo API for phone calls
- **AI**: Groq API for conversation intelligence
- **TTS**: PlayHT, ElevenLabs, CoquiTTS integration
- **Scraping**: Puppeteer for lead generation
- **Payments**: Stripe for subscription management
- **Auth**: JWT with bcrypt encryption
- **WebSocket**: Real-time communication
- **Logging**: Winston for application logging

### Frontend
- **Framework**: React 18 with Vite
- **Routing**: React Router v6
- **Styling**: Tailwind CSS
- **Charts**: Recharts for analytics
- **Notifications**: React Hot Toast
- **HTTP Client**: Axios
- **WebSocket**: Native WebSocket with custom hooks

### Infrastructure
- **Containerization**: Docker & Docker Compose
- **Database**: MongoDB
- **Cache/Queue**: Redis
- **Audio Processing**: FFmpeg

## 📁 Project Structure

```
ai-lead-caller/
├── backend/
│   ├── src/
│   │   ├── controllers/     # Route controllers
│   │   │   ├── campaignController.js
│   │   │   ├── leadController.js
│   │   │   ├── userController.js
│   │   │   ├── paymentController.js
│   │   │   ├── webhook.controller.js
│   │   │   ├── scriptController.js
│   │   │   └── voiceController.js
│   │   ├── models/         # MongoDB models
│   │   │   ├── User.js
│   │   │   ├── Campaign.js
│   │   │   ├── Lead.js
│   │   │   ├── CallLog.js
│   │   │   ├── ScriptTemplate.js
│   │   │   └── Voice.js
│   │   ├── routes/         # Express routes
│   │   ├── services/       # Business logic
│   │   │   ├── calling.service.js
│   │   │   ├── tts.service.js
│   │   │   ├── ai.service.js
│   │   │   ├── callOrchestrator.js
│   │   │   ├── websocket.service.js
│   │   │   ├── scraper.service.js
│   │   │   └── payment.service.js
│   │   ├── utils/          # Utility functions
│   │   │   ├── audioProcessor.js
│   │   │   ├── promptBuilder.js
│   │   │   ├── dataEnrichment.js
│   │   │   └── logger.js
│   │   ├── workers/        # Background job workers
│   │   └── server.js       # Express server
│   ├── scripts/           # Utility scripts
│   │   ├── seed-defaults.js
│   │   └── generate-audio-assets.js
│   ├── assets/            # Static assets
│   │   └── audio/         # Audio files
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/     # React components
│   │   │   ├── CallMonitoring.jsx
│   │   │   ├── Navbar.jsx
│   │   │   ├── Sidebar.jsx
│   │   │   └── PrivateRoute.jsx
│   │   ├── pages/          # Page components
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Campaigns.jsx
│   │   │   ├── Leads.jsx
│   │   │   ├── Login.jsx
│   │   │   └── Register.jsx
│   │   ├── hooks/          # Custom React hooks
│   │   │   └── useWebSocket.js
│   │   ├── context/        # React context
│   │   │   └── AuthContext.jsx
│   │   ├── services/       # API services
│   │   └── utils/          # Utility functions
│   └── package.json
├── docker/
│   └── docker-compose.yml
├── .env.example
└── README.md
```

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18+ and npm
- **MongoDB** 4.4+
- **Redis** 6.0+
- **FFmpeg** (for audio processing)
- **Docker** (optional, recommended)

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# Backend Environment Variables
NODE_ENV=development
PORT=12000
BASE_URL=http://localhost:12000
MONGODB_URI=mongodb://localhost:27017/ai-lead-caller
JWT_SECRET=your_jwt_secret_key_here
REDIS_HOST=localhost
REDIS_PORT=6379

# Payment Processing
STRIPE_SECRET_KEY=your_stripe_secret_key_here
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret_here

# Calling Service (Plivo)
PLIVO_AUTH_ID=your_plivo_auth_id_here
PLIVO_AUTH_TOKEN=your_plivo_auth_token_here
PLIVO_APP_ID=your_plivo_app_id_here
DEFAULT_PHONE_NUMBER=your_default_phone_number_here

# AI Services
GROQ_API_KEY=your_groq_api_key_here

# TTS Services
PLAYHT_API_KEY=your_playht_api_key_here
PLAYHT_USER_ID=your_playht_user_id_here
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here

# Frontend Environment Variables
VITE_API_URL=http://localhost:12000/api
VITE_WS_URL=ws://localhost:12000/ws
```

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/indigenaitools/ai-lead-caller.git
   cd ai-lead-caller
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

4. **Start services with Docker (recommended)**
   ```bash
   cd ..
   docker-compose up -d
   ```

   Or start services manually:
   ```bash
   # Start MongoDB and Redis
   # Then start backend
   cd backend
   npm run dev
   
   # In another terminal, start frontend
   cd frontend
   npm run dev
   ```

5. **Seed default data**
   ```bash
   cd backend
   npm run seed
   ```

6. **Generate audio assets**
   ```bash
   npm run generate-audio
   ```

### Development

- **Backend**: http://localhost:12000
- **Frontend**: http://localhost:5173
- **MongoDB**: localhost:27017
- **Redis**: localhost:6379
- **WebSocket**: ws://localhost:12000/ws

## 📚 API Documentation

### Authentication
- `POST /api/users/register` - Register new user
- `POST /api/users/login` - User login
- `GET /api/users/profile` - Get user profile

### Campaigns
- `GET /api/campaigns` - Get user campaigns
- `POST /api/campaigns` - Create new campaign
- `PUT /api/campaigns/:id` - Update campaign
- `DELETE /api/campaigns/:id` - Delete campaign
- `POST /api/campaigns/:id/start` - Start campaign
- `POST /api/campaigns/:id/pause` - Pause campaign
- `GET /api/campaigns/:id/analytics` - Get campaign analytics
- `POST /api/campaigns/:id/start-calling` - Start calling leads
- `POST /api/campaigns/:id/call-lead/:leadId` - Call specific lead
- `GET /api/campaigns/:id/active-calls` - Get active calls
- `POST /api/campaigns/:id/end-call/:callId` - End specific call

### Leads
- `GET /api/leads` - Get leads with filtering
- `POST /api/leads` - Create lead
- `PUT /api/leads/:id` - Update lead
- `DELETE /api/leads/:id` - Delete lead
- `POST /api/leads/:id/call` - Initiate call to lead

### Script Templates
- `GET /api/scripts` - Get script templates
- `GET /api/scripts/defaults` - Get public script templates
- `POST /api/scripts` - Create script template
- `PUT /api/scripts/:id` - Update script template
- `DELETE /api/scripts/:id` - Delete script template

### Voices
- `GET /api/voices` - Get voices
- `GET /api/voices/defaults` - Get public voices
- `POST /api/voices` - Create voice
- `PUT /api/voices/:id` - Update voice
- `DELETE /api/voices/:id` - Delete voice
- `POST /api/voices/:id/test` - Test voice

### Payments
- `POST /api/payments/create-subscription` - Create Stripe subscription
- `POST /api/payments/cancel-subscription` - Cancel subscription

### Webhooks
- `POST /webhooks/plivo` - Plivo call events
- `POST /webhooks/stripe` - Stripe payment events

## 🎯 Usage

### Creating a Campaign

1. **Navigate to Campaigns** page
2. **Click "New Campaign"**
3. **Configure campaign settings**:
   - Target industry and location
   - Company size and positions
   - Search criteria
4. **Select script template and voice**
5. **Start the campaign** to begin lead generation

### Managing Calls

1. **Start calling** from campaign dashboard
2. **Monitor active calls** in real-time
3. **View call analytics** and performance metrics
4. **End calls manually** if needed

### Real-time Monitoring

The platform provides real-time call monitoring through WebSocket connections:

- **Live call status updates**
- **Conversation stage tracking**
- **Call duration and metrics**
- **Event logging and history**

## 🔧 Configuration

### TTS Providers

Configure multiple TTS providers in your environment:

```bash
# PlayHT (Recommended)
PLAYHT_API_KEY=your_api_key
PLAYHT_USER_ID=your_user_id

# ElevenLabs
ELEVENLABS_API_KEY=your_api_key
```

### Calling Service

Set up Plivo for phone calls:

```bash
PLIVO_AUTH_ID=your_auth_id
PLIVO_AUTH_TOKEN=your_auth_token
PLIVO_APP_ID=your_app_id
DEFAULT_PHONE_NUMBER=+1234567890
```

### AI Configuration

Configure Groq for conversation intelligence:

```bash
GROQ_API_KEY=your_groq_api_key
```

## 🧪 Testing

```bash
# Backend tests
cd backend
npm test

# Frontend tests
cd frontend
npm test
```

## 📦 Deployment

### Docker Deployment

```bash
# Build and start all services
docker-compose up -d --build

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Production Environment

1. **Set production environment variables**
2. **Configure SSL certificates**
3. **Set up monitoring and logging**
4. **Configure backup strategies**

## 🤝 Contributing

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Make your changes**
4. **Add tests** if applicable
5. **Commit your changes**: `git commit -m 'Add amazing feature'`
6. **Push to the branch**: `git push origin feature/amazing-feature`
7. **Submit a pull request**

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:

- **Create an issue** on GitHub
- **Check the documentation** in the `/docs` folder
- **Review the API documentation** above

## 🙏 Acknowledgments

- **Plivo** for calling infrastructure
- **PlayHT** for text-to-speech services
- **Groq** for AI conversation management
- **Stripe** for payment processing
- **MongoDB** for database services