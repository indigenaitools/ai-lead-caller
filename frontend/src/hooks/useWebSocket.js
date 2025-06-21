import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

/**
 * Custom hook for WebSocket connection with authentication
 */
export const useWebSocket = (url = null) => {
  const { token } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState(null);
  const [connectionError, setConnectionError] = useState(null);
  const ws = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const reconnectDelay = 3000;

  // Default WebSocket URL
  const wsUrl = url || `${import.meta.env.VITE_WS_URL || 'ws://localhost:12000/ws'}`;

  const connect = useCallback(() => {
    if (!token) {
      console.warn('No authentication token available for WebSocket connection');
      return;
    }

    try {
      // Close existing connection if any
      if (ws.current) {
        ws.current.close();
      }

      // Create new WebSocket connection with token
      const wsUrlWithToken = `${wsUrl}?token=${token}`;
      ws.current = new WebSocket(wsUrlWithToken);

      ws.current.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        setConnectionError(null);
        reconnectAttempts.current = 0;
      };

      ws.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          setLastMessage(message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.current.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason);
        setIsConnected(false);

        // Attempt to reconnect if not a normal closure
        if (event.code !== 1000 && reconnectAttempts.current < maxReconnectAttempts) {
          reconnectAttempts.current++;
          console.log(`Attempting to reconnect (${reconnectAttempts.current}/${maxReconnectAttempts})...`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, reconnectDelay * reconnectAttempts.current);
        } else if (reconnectAttempts.current >= maxReconnectAttempts) {
          setConnectionError('Failed to reconnect after multiple attempts');
        }
      };

      ws.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnectionError('WebSocket connection error');
      };
    } catch (error) {
      console.error('Error creating WebSocket connection:', error);
      setConnectionError('Failed to create WebSocket connection');
    }
  }, [token, wsUrl]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    if (ws.current) {
      ws.current.close(1000, 'Manual disconnect');
      ws.current = null;
    }
    
    setIsConnected(false);
    setConnectionError(null);
    reconnectAttempts.current = 0;
  }, []);

  const sendMessage = useCallback((message) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      try {
        ws.current.send(JSON.stringify(message));
        return true;
      } catch (error) {
        console.error('Error sending WebSocket message:', error);
        return false;
      }
    } else {
      console.warn('WebSocket is not connected');
      return false;
    }
  }, []);

  const subscribe = useCallback((eventType, filters = {}) => {
    return sendMessage({
      type: 'subscribe',
      data: { type: eventType, filters }
    });
  }, [sendMessage]);

  const unsubscribe = useCallback((eventType, filters = {}) => {
    return sendMessage({
      type: 'unsubscribe',
      data: { type: eventType, filters }
    });
  }, [sendMessage]);

  // Connect when token is available
  useEffect(() => {
    if (token) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [token, connect, disconnect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (ws.current) {
        ws.current.close();
      }
    };
  }, []);

  return {
    isConnected,
    lastMessage,
    connectionError,
    sendMessage,
    subscribe,
    unsubscribe,
    connect,
    disconnect
  };
};

/**
 * Hook for monitoring call events
 */
export const useCallMonitoring = () => {
  const { isConnected, lastMessage, subscribe, unsubscribe, sendMessage } = useWebSocket();
  const [activeCalls, setActiveCalls] = useState([]);
  const [callEvents, setCallEvents] = useState([]);

  // Subscribe to call events when connected
  useEffect(() => {
    if (isConnected) {
      subscribe('call_events');
      
      // Request current active calls
      sendMessage({ type: 'get_active_calls' });
    }

    return () => {
      if (isConnected) {
        unsubscribe('call_events');
      }
    };
  }, [isConnected, subscribe, unsubscribe, sendMessage]);

  // Handle incoming messages
  useEffect(() => {
    if (!lastMessage) return;

    const { type, data } = lastMessage;

    switch (type) {
      case 'active_calls_update':
        setActiveCalls(data.calls || []);
        break;

      case 'call_initiated':
      case 'conversation_started':
      case 'user_input_processed':
      case 'call_ended':
      case 'status_updated':
      case 'speech_generated':
      case 'recording_saved':
      case 'call_failed':
        // Add to call events
        setCallEvents(prev => [
          {
            id: Date.now() + Math.random(),
            timestamp: new Date(),
            type,
            data
          },
          ...prev.slice(0, 99) // Keep last 100 events
        ]);

        // Update active calls if needed
        if (type === 'call_ended' || type === 'call_failed') {
          setActiveCalls(prev => prev.filter(call => call.callId !== data.callId));
        } else if (type === 'call_initiated') {
          setActiveCalls(prev => {
            const existing = prev.find(call => call.callId === data.callId);
            if (!existing) {
              return [...prev, {
                callId: data.callId,
                leadName: data.lead.businessName,
                leadPhone: data.lead.phone,
                campaignName: data.campaign.name,
                status: 'initiated',
                currentStage: 'introduction',
                startTime: new Date(),
                duration: 0
              }];
            }
            return prev;
          });
        } else if (type === 'status_updated') {
          setActiveCalls(prev => prev.map(call => 
            call.callId === data.callId 
              ? { ...call, status: data.status, currentStage: data.metadata?.stage || call.currentStage }
              : call
          ));
        }
        break;

      default:
        // Handle other message types
        break;
    }
  }, [lastMessage]);

  const endCall = useCallback((callId) => {
    return sendMessage({
      type: 'end_call',
      data: { callId }
    });
  }, [sendMessage]);

  return {
    isConnected,
    activeCalls,
    callEvents,
    endCall
  };
};