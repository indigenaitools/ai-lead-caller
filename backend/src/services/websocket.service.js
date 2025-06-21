const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');
const callOrchestrator = require('./callOrchestrator');

/**
 * WebSocket service for real-time call monitoring
 */
class WebSocketService {
  constructor() {
    this.wss = null;
    this.clients = new Map();
    this.userConnections = new Map();
  }

  /**
   * Initialize WebSocket server
   * @param {object} server - HTTP server instance
   */
  initialize(server) {
    this.wss = new WebSocket.Server({
      server,
      path: '/ws',
      verifyClient: this.verifyClient.bind(this)
    });

    this.wss.on('connection', this.handleConnection.bind(this));
    
    // Listen to call orchestrator events
    this.setupCallOrchestratorListeners();
    
    logger.info('WebSocket server initialized');
  }

  /**
   * Verify client connection (authentication)
   * @param {object} info - Connection info
   * @returns {boolean} - Whether to accept the connection
   * @private
   */
  verifyClient(info) {
    try {
      const url = new URL(info.req.url, 'ws://localhost');
      const token = url.searchParams.get('token');
      
      if (!token) {
        logger.warn('WebSocket connection rejected: No token provided');
        return false;
      }

      // Verify JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Store user info for later use
      info.req.user = decoded;
      
      return true;
    } catch (error) {
      logger.warn(`WebSocket connection rejected: ${error.message}`);
      return false;
    }
  }

  /**
   * Handle new WebSocket connection
   * @param {WebSocket} ws - WebSocket connection
   * @param {object} req - HTTP request object
   * @private
   */
  handleConnection(ws, req) {
    const user = req.user;
    const clientId = this.generateClientId();
    
    logger.info(`WebSocket client connected: ${user.email} (${clientId})`);

    // Store client connection
    this.clients.set(clientId, {
      ws: ws,
      user: user,
      connectedAt: new Date(),
      subscriptions: new Set()
    });

    // Store user connection mapping
    if (!this.userConnections.has(user.id)) {
      this.userConnections.set(user.id, new Set());
    }
    this.userConnections.get(user.id).add(clientId);

    // Send welcome message
    this.sendToClient(clientId, {
      type: 'connected',
      message: 'WebSocket connection established',
      clientId: clientId
    });

    // Send current active calls
    this.sendActiveCallsUpdate(clientId);

    // Handle messages from client
    ws.on('message', (data) => {
      this.handleClientMessage(clientId, data);
    });

    // Handle client disconnect
    ws.on('close', () => {
      this.handleClientDisconnect(clientId);
    });

    // Handle errors
    ws.on('error', (error) => {
      logger.error(`WebSocket error for client ${clientId}: ${error.message}`);
    });
  }

  /**
   * Handle messages from WebSocket clients
   * @param {string} clientId - Client ID
   * @param {Buffer} data - Message data
   * @private
   */
  handleClientMessage(clientId, data) {
    try {
      const client = this.clients.get(clientId);
      if (!client) return;

      const message = JSON.parse(data.toString());
      
      logger.debug(`WebSocket message from ${clientId}: ${message.type}`);

      switch (message.type) {
        case 'subscribe':
          this.handleSubscription(clientId, message.data);
          break;
        
        case 'unsubscribe':
          this.handleUnsubscription(clientId, message.data);
          break;
        
        case 'get_active_calls':
          this.sendActiveCallsUpdate(clientId);
          break;
        
        case 'end_call':
          this.handleEndCallRequest(clientId, message.data);
          break;
        
        case 'ping':
          this.sendToClient(clientId, { type: 'pong' });
          break;
        
        default:
          logger.warn(`Unknown message type from client ${clientId}: ${message.type}`);
      }
    } catch (error) {
      logger.error(`Error handling client message from ${clientId}: ${error.message}`);
    }
  }

  /**
   * Handle client subscription requests
   * @param {string} clientId - Client ID
   * @param {object} subscriptionData - Subscription data
   * @private
   */
  handleSubscription(clientId, subscriptionData) {
    const client = this.clients.get(clientId);
    if (!client) return;

    const { type, filters } = subscriptionData;
    
    // Add subscription
    client.subscriptions.add(JSON.stringify({ type, filters }));
    
    this.sendToClient(clientId, {
      type: 'subscription_confirmed',
      data: { type, filters }
    });
    
    logger.debug(`Client ${clientId} subscribed to ${type}`);
  }

  /**
   * Handle client unsubscription requests
   * @param {string} clientId - Client ID
   * @param {object} subscriptionData - Subscription data
   * @private
   */
  handleUnsubscription(clientId, subscriptionData) {
    const client = this.clients.get(clientId);
    if (!client) return;

    const { type, filters } = subscriptionData;
    
    // Remove subscription
    client.subscriptions.delete(JSON.stringify({ type, filters }));
    
    this.sendToClient(clientId, {
      type: 'subscription_removed',
      data: { type, filters }
    });
    
    logger.debug(`Client ${clientId} unsubscribed from ${type}`);
  }

  /**
   * Handle end call requests from clients
   * @param {string} clientId - Client ID
   * @param {object} data - End call data
   * @private
   */
  async handleEndCallRequest(clientId, data) {
    try {
      const client = this.clients.get(clientId);
      if (!client) return;

      const { callId } = data;
      
      // Check if user has permission to end this call
      const callData = callOrchestrator.getActiveCalls().find(call => call.callId === callId);
      if (!callData) {
        this.sendToClient(clientId, {
          type: 'error',
          message: 'Call not found'
        });
        return;
      }

      // End the call
      await callOrchestrator.forceEndCall(callId);
      
      this.sendToClient(clientId, {
        type: 'call_ended',
        data: { callId, reason: 'user_request' }
      });
      
      logger.info(`Call ${callId} ended by user request from client ${clientId}`);
    } catch (error) {
      logger.error(`Error handling end call request: ${error.message}`);
      this.sendToClient(clientId, {
        type: 'error',
        message: 'Failed to end call'
      });
    }
  }

  /**
   * Handle client disconnect
   * @param {string} clientId - Client ID
   * @private
   */
  handleClientDisconnect(clientId) {
    const client = this.clients.get(clientId);
    if (!client) return;

    logger.info(`WebSocket client disconnected: ${client.user.email} (${clientId})`);

    // Remove from user connections
    const userConnections = this.userConnections.get(client.user.id);
    if (userConnections) {
      userConnections.delete(clientId);
      if (userConnections.size === 0) {
        this.userConnections.delete(client.user.id);
      }
    }

    // Remove client
    this.clients.delete(clientId);
  }

  /**
   * Setup listeners for call orchestrator events
   * @private
   */
  setupCallOrchestratorListeners() {
    // Call initiated
    callOrchestrator.on('callInitiated', (data) => {
      this.broadcastToSubscribers('call_events', {
        type: 'call_initiated',
        data: data
      });
    });

    // Conversation started
    callOrchestrator.on('conversationStarted', (data) => {
      this.broadcastToSubscribers('call_events', {
        type: 'conversation_started',
        data: data
      });
    });

    // User input processed
    callOrchestrator.on('userInputProcessed', (data) => {
      this.broadcastToSubscribers('call_events', {
        type: 'user_input_processed',
        data: data
      });
    });

    // Call ended
    callOrchestrator.on('callEnded', (data) => {
      this.broadcastToSubscribers('call_events', {
        type: 'call_ended',
        data: data
      });
    });

    // Status updated
    callOrchestrator.on('statusUpdated', (data) => {
      this.broadcastToSubscribers('call_events', {
        type: 'status_updated',
        data: data
      });
    });

    // Speech generated
    callOrchestrator.on('speechGenerated', (data) => {
      this.broadcastToSubscribers('call_events', {
        type: 'speech_generated',
        data: {
          callId: data.callId,
          text: data.text,
          duration: data.duration
        }
      });
    });

    // Recording saved
    callOrchestrator.on('recordingSaved', (data) => {
      this.broadcastToSubscribers('call_events', {
        type: 'recording_saved',
        data: data
      });
    });

    // Call failed
    callOrchestrator.on('callFailed', (data) => {
      this.broadcastToSubscribers('call_events', {
        type: 'call_failed',
        data: data
      });
    });
  }

  /**
   * Send message to a specific client
   * @param {string} clientId - Client ID
   * @param {object} message - Message to send
   */
  sendToClient(clientId, message) {
    const client = this.clients.get(clientId);
    if (!client || client.ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      client.ws.send(JSON.stringify({
        ...message,
        timestamp: new Date().toISOString()
      }));
      return true;
    } catch (error) {
      logger.error(`Error sending message to client ${clientId}: ${error.message}`);
      return false;
    }
  }

  /**
   * Send message to all clients of a specific user
   * @param {string} userId - User ID
   * @param {object} message - Message to send
   */
  sendToUser(userId, message) {
    const userConnections = this.userConnections.get(userId);
    if (!userConnections) return 0;

    let sentCount = 0;
    for (const clientId of userConnections) {
      if (this.sendToClient(clientId, message)) {
        sentCount++;
      }
    }
    
    return sentCount;
  }

  /**
   * Broadcast message to subscribers of a specific event type
   * @param {string} eventType - Event type
   * @param {object} message - Message to broadcast
   */
  broadcastToSubscribers(eventType, message) {
    let sentCount = 0;
    
    for (const [clientId, client] of this.clients) {
      // Check if client is subscribed to this event type
      const isSubscribed = Array.from(client.subscriptions).some(sub => {
        const subscription = JSON.parse(sub);
        return subscription.type === eventType;
      });
      
      if (isSubscribed && this.sendToClient(clientId, message)) {
        sentCount++;
      }
    }
    
    logger.debug(`Broadcasted ${eventType} event to ${sentCount} subscribers`);
    return sentCount;
  }

  /**
   * Send active calls update to a client
   * @param {string} clientId - Client ID
   * @private
   */
  sendActiveCallsUpdate(clientId) {
    const activeCalls = callOrchestrator.getActiveCalls().map(call => ({
      callId: call.callId,
      leadName: call.lead.businessName,
      leadPhone: call.lead.phone,
      campaignName: call.campaign.name,
      status: call.status,
      currentStage: call.currentStage,
      startTime: call.startTime,
      duration: call.startTime ? Math.floor((new Date() - call.startTime) / 1000) : 0
    }));

    this.sendToClient(clientId, {
      type: 'active_calls_update',
      data: {
        calls: activeCalls,
        totalCount: activeCalls.length
      }
    });
  }

  /**
   * Broadcast active calls update to all connected clients
   */
  broadcastActiveCallsUpdate() {
    for (const clientId of this.clients.keys()) {
      this.sendActiveCallsUpdate(clientId);
    }
  }

  /**
   * Generate unique client ID
   * @returns {string} - Unique client ID
   * @private
   */
  generateClientId() {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get connected clients count
   * @returns {number} - Number of connected clients
   */
  getConnectedClientsCount() {
    return this.clients.size;
  }

  /**
   * Get connected users count
   * @returns {number} - Number of connected users
   */
  getConnectedUsersCount() {
    return this.userConnections.size;
  }

  /**
   * Close all connections and shutdown
   */
  shutdown() {
    if (this.wss) {
      this.wss.close();
      logger.info('WebSocket server shut down');
    }
  }
}

module.exports = new WebSocketService();