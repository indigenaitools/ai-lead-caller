const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const http = require('http');

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 12000;

// Create HTTP server for WebSocket support
const server = http.createServer(app);

// Middleware
app.use(helmet());
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ai-lead-caller')
  .then(() => console.log('MongoDB connected successfully'))
  .catch(err => console.error('MongoDB connection error:', err));

// Authentication Middleware
const authMiddleware = require('./utils/authMiddleware');

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to AI Lead Caller API' });
});

// Import routes
const userRoutes = require('./routes/userRoutes');
const leadRoutes = require('./routes/leadRoutes');
const campaignRoutes = require('./routes/campaignRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const webhookRoutes = require('./routes/webhook.routes');
const scriptRoutes = require('./routes/scriptRoutes');
const voiceRoutes = require('./routes/voiceRoutes');
const adminRoutes = require('./routes/admin.routes');

// Use routes
app.use('/api/users', userRoutes);
app.use('/api/leads', authMiddleware, leadRoutes);
app.use('/api/campaigns', authMiddleware, campaignRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/scripts', authMiddleware, scriptRoutes);
app.use('/api/voices', authMiddleware, voiceRoutes);
app.use('/api/admin', authMiddleware, adminRoutes);
app.use('/webhooks', webhookRoutes); // Webhook routes don't need auth

// Initialize services
const websocketService = require('./services/websocket.service');
const callingService = require('./services/calling.service');
const aiService = require('./services/ai.service');

// Initialize WebSocket service
websocketService.initialize(server);

// Initialize calling service if credentials are available
if (process.env.PLIVO_AUTH_ID && process.env.PLIVO_AUTH_TOKEN) {
  callingService.initialize(process.env.PLIVO_AUTH_ID, process.env.PLIVO_AUTH_TOKEN);
}

// Initialize AI service if API key is available
if (process.env.GROQ_API_KEY) {
  aiService.initialize(process.env.GROQ_API_KEY);
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    message: 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? err.message : {}
  });
});

// Start server
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`WebSocket server available at ws://localhost:${PORT}/ws`);
});

module.exports = { app, server };