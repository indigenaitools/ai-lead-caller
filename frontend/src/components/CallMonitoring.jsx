import React, { useState, useEffect } from 'react';
import { useCallMonitoring } from '../hooks/useWebSocket';
import toast from 'react-hot-toast';

const CallMonitoring = () => {
  const { isConnected, activeCalls, callEvents, endCall } = useCallMonitoring();
  const [selectedCall, setSelectedCall] = useState(null);
  const [showEvents, setShowEvents] = useState(false);

  // Format duration
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Format timestamp
  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  // Get status color
  const getStatusColor = (status) => {
    const colors = {
      'initiated': 'bg-blue-100 text-blue-800',
      'answered': 'bg-green-100 text-green-800',
      'conversation_started': 'bg-green-100 text-green-800',
      'speaking': 'bg-yellow-100 text-yellow-800',
      'recording': 'bg-purple-100 text-purple-800',
      'ended': 'bg-gray-100 text-gray-800',
      'failed': 'bg-red-100 text-red-800',
      'voicemail': 'bg-orange-100 text-orange-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  // Get stage color
  const getStageColor = (stage) => {
    const colors = {
      'introduction': 'bg-blue-100 text-blue-800',
      'qualification': 'bg-yellow-100 text-yellow-800',
      'presentation': 'bg-green-100 text-green-800',
      'objection_handling': 'bg-orange-100 text-orange-800',
      'closing': 'bg-purple-100 text-purple-800',
      'follow_up': 'bg-gray-100 text-gray-800'
    };
    return colors[stage] || 'bg-gray-100 text-gray-800';
  };

  // Handle end call
  const handleEndCall = async (callId) => {
    if (window.confirm('Are you sure you want to end this call?')) {
      const success = endCall(callId);
      if (success) {
        toast.success('Call ended successfully');
      } else {
        toast.error('Failed to end call');
      }
    }
  };

  // Update call durations
  useEffect(() => {
    const interval = setInterval(() => {
      // This will trigger a re-render to update durations
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Call Monitoring</h1>
          <div className="flex items-center space-x-4">
            <div className="flex items-center">
              <div className={`w-3 h-3 rounded-full mr-2 ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className="text-sm text-gray-600">
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            <button
              onClick={() => setShowEvents(!showEvents)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              {showEvents ? 'Hide Events' : 'Show Events'}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Calls */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">
                Active Calls ({activeCalls.length})
              </h2>
            </div>
            <div className="p-6">
              {activeCalls.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-gray-400 text-lg mb-2">📞</div>
                  <p className="text-gray-500">No active calls</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {activeCalls.map((call) => {
                    const duration = call.startTime 
                      ? Math.floor((new Date() - new Date(call.startTime)) / 1000)
                      : 0;
                    
                    return (
                      <div
                        key={call.callId}
                        className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                          selectedCall?.callId === call.callId
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                        onClick={() => setSelectedCall(call)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-3">
                              <h3 className="font-medium text-gray-900">
                                {call.leadName}
                              </h3>
                              <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(call.status)}`}>
                                {call.status}
                              </span>
                              <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStageColor(call.currentStage)}`}>
                                {call.currentStage}
                              </span>
                            </div>
                            <div className="mt-1 text-sm text-gray-500">
                              <span>{call.leadPhone}</span>
                              <span className="mx-2">•</span>
                              <span>{call.campaignName}</span>
                              <span className="mx-2">•</span>
                              <span>{formatDuration(duration)}</span>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEndCall(call.callId);
                              }}
                              className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors"
                            >
                              End Call
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Call Details / Events */}
        <div className="lg:col-span-1">
          {showEvents ? (
            /* Events Panel */
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-medium text-gray-900">
                  Recent Events ({callEvents.length})
                </h2>
              </div>
              <div className="p-6 max-h-96 overflow-y-auto">
                {callEvents.length === 0 ? (
                  <p className="text-gray-500 text-center">No events yet</p>
                ) : (
                  <div className="space-y-3">
                    {callEvents.slice(0, 20).map((event) => (
                      <div key={event.id} className="border-l-4 border-blue-500 pl-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-900">
                            {event.type.replace(/_/g, ' ')}
                          </span>
                          <span className="text-xs text-gray-500">
                            {formatTime(event.timestamp)}
                          </span>
                        </div>
                        {event.data.lead && (
                          <p className="text-sm text-gray-600 mt-1">
                            {event.data.lead.businessName}
                          </p>
                        )}
                        {event.data.text && (
                          <p className="text-xs text-gray-500 mt-1 truncate">
                            {event.data.text}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : selectedCall ? (
            /* Call Details Panel */
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-medium text-gray-900">Call Details</h2>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Lead</label>
                    <p className="mt-1 text-sm text-gray-900">{selectedCall.leadName}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Phone</label>
                    <p className="mt-1 text-sm text-gray-900">{selectedCall.leadPhone}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Campaign</label>
                    <p className="mt-1 text-sm text-gray-900">{selectedCall.campaignName}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Status</label>
                    <span className={`inline-block mt-1 px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(selectedCall.status)}`}>
                      {selectedCall.status}
                    </span>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Stage</label>
                    <span className={`inline-block mt-1 px-2 py-1 text-xs font-medium rounded-full ${getStageColor(selectedCall.currentStage)}`}>
                      {selectedCall.currentStage}
                    </span>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Duration</label>
                    <p className="mt-1 text-sm text-gray-900">
                      {formatDuration(
                        selectedCall.startTime 
                          ? Math.floor((new Date() - new Date(selectedCall.startTime)) / 1000)
                          : 0
                      )}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Call ID</label>
                    <p className="mt-1 text-xs text-gray-500 font-mono">{selectedCall.callId}</p>
                  </div>
                </div>
                
                <div className="mt-6">
                  <button
                    onClick={() => handleEndCall(selectedCall.callId)}
                    className="w-full px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                  >
                    End Call
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* No Selection */
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-medium text-gray-900">Call Details</h2>
              </div>
              <div className="p-6 text-center">
                <p className="text-gray-500">Select a call to view details</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Connection Status */}
      {!isConnected && (
        <div className="fixed bottom-4 right-4 bg-red-600 text-white px-4 py-2 rounded-lg shadow-lg">
          <div className="flex items-center">
            <div className="w-2 h-2 bg-white rounded-full mr-2 animate-pulse"></div>
            <span className="text-sm">Reconnecting...</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default CallMonitoring;