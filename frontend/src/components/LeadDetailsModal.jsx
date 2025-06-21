import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import AudioPlayer from './AudioPlayer';

const LeadDetailsModal = ({ lead, onClose, onUpdate }) => {
  const [activeTab, setActiveTab] = useState('details');
  const [callHistory, setCallHistory] = useState([]);
  const [notes, setNotes] = useState(lead.notes || '');
  const [status, setStatus] = useState(lead.status);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (activeTab === 'calls') {
      fetchCallHistory();
    }
  }, [activeTab, lead._id]);

  const fetchCallHistory = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/leads/${lead._id}/calls`);
      setCallHistory(response.data.calls || []);
    } catch (error) {
      console.error('Error fetching call history:', error);
      toast.error('Failed to load call history');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await axios.put(`/api/leads/${lead._id}`, {
        notes,
        status
      });
      toast.success('Lead updated successfully');
      onUpdate();
    } catch (error) {
      console.error('Error updating lead:', error);
      toast.error('Failed to update lead');
    } finally {
      setSaving(false);
    }
  };

  const handleCall = async () => {
    try {
      await axios.post(`/api/leads/${lead._id}/call`);
      toast.success('Call initiated successfully');
      fetchCallHistory();
    } catch (error) {
      console.error('Error initiating call:', error);
      toast.error('Failed to initiate call');
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      new: 'bg-blue-100 text-blue-800',
      contacted: 'bg-yellow-100 text-yellow-800',
      qualified: 'bg-green-100 text-green-800',
      converted: 'bg-purple-100 text-purple-800',
      rejected: 'bg-red-100 text-red-800',
      calling: 'bg-orange-100 text-orange-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getCallOutcomeColor = (outcome) => {
    const colors = {
      answered: 'bg-green-100 text-green-800',
      no_answer: 'bg-yellow-100 text-yellow-800',
      busy: 'bg-orange-100 text-orange-800',
      failed: 'bg-red-100 text-red-800',
      voicemail: 'bg-blue-100 text-blue-800'
    };
    return colors[outcome] || 'bg-gray-100 text-gray-800';
  };

  const tabs = [
    { id: 'details', name: 'Details', icon: '📋' },
    { id: 'calls', name: 'Call History', icon: '📞' },
    { id: 'notes', name: 'Notes', icon: '📝' },
    { id: 'timeline', name: 'Timeline', icon: '⏰' }
  ];

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white">
        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <h3 className="text-2xl font-bold text-gray-900">{lead.businessName}</h3>
            <p className="text-gray-600">{lead.email}</p>
            <div className="mt-2">
              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(status)}`}>
                {status}
              </span>
            </div>
          </div>
          <div className="flex space-x-2">
            {lead.phone && (
              <button
                onClick={handleCall}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
              >
                📞 Call Now
              </button>
            )}
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.name}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="min-h-96">
          {/* Details Tab */}
          {activeTab === 'details' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="text-lg font-medium text-gray-900 mb-4">Contact Information</h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Business Name</label>
                    <p className="mt-1 text-sm text-gray-900">{lead.businessName}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Email</label>
                    <p className="mt-1 text-sm text-gray-900">{lead.email || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Phone</label>
                    <p className="mt-1 text-sm text-gray-900">{lead.phone || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Website</label>
                    <p className="mt-1 text-sm text-gray-900">
                      {lead.website ? (
                        <a href={lead.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800">
                          {lead.website}
                        </a>
                      ) : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Address</label>
                    <p className="mt-1 text-sm text-gray-900">{lead.address || 'N/A'}</p>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-lg font-medium text-gray-900 mb-4">Lead Information</h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Status</label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="new">New</option>
                      <option value="contacted">Contacted</option>
                      <option value="qualified">Qualified</option>
                      <option value="converted">Converted</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Campaign</label>
                    <p className="mt-1 text-sm text-gray-900">{lead.campaign?.name || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Source</label>
                    <p className="mt-1 text-sm text-gray-900">{lead.source || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Rating</label>
                    <p className="mt-1 text-sm text-gray-900">
                      {lead.rating ? `${lead.rating} ⭐` : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Created</label>
                    <p className="mt-1 text-sm text-gray-900">
                      {new Date(lead.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Last Contact</label>
                    <p className="mt-1 text-sm text-gray-900">
                      {lead.lastContactDate 
                        ? new Date(lead.lastContactDate).toLocaleDateString()
                        : 'Never'
                      }
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Call History Tab */}
          {activeTab === 'calls' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h4 className="text-lg font-medium text-gray-900">Call History</h4>
                {lead.phone && (
                  <button
                    onClick={handleCall}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    New Call
                  </button>
                )}
              </div>

              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                </div>
              ) : callHistory.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">No call history available</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {callHistory.map((call) => (
                    <div key={call._id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getCallOutcomeColor(call.outcome)}`}>
                              {call.outcome}
                            </span>
                            <span className="text-sm text-gray-500">
                              {new Date(call.createdAt).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">
                            Duration: {call.duration ? `${Math.floor(call.duration / 60)}:${(call.duration % 60).toString().padStart(2, '0')}` : 'N/A'}
                          </p>
                        </div>
                        {call.recordingUrl && (
                          <div className="text-sm text-blue-600">
                            🎵 Recording available
                          </div>
                        )}
                      </div>

                      {call.transcript && (
                        <div className="mb-3">
                          <h5 className="text-sm font-medium text-gray-700 mb-1">Transcript</h5>
                          <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                            {call.transcript}
                          </p>
                        </div>
                      )}

                      {call.recordingUrl && (
                        <div className="mb-3">
                          <h5 className="text-sm font-medium text-gray-700 mb-2">Recording</h5>
                          <AudioPlayer
                            src={call.recordingUrl}
                            title={`Call - ${new Date(call.createdAt).toLocaleString()}`}
                          />
                        </div>
                      )}

                      {call.notes && (
                        <div>
                          <h5 className="text-sm font-medium text-gray-700 mb-1">Notes</h5>
                          <p className="text-sm text-gray-600">{call.notes}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Notes Tab */}
          {activeTab === 'notes' && (
            <div>
              <h4 className="text-lg font-medium text-gray-900 mb-4">Notes</h4>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={10}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="Add notes about this lead..."
              />
            </div>
          )}

          {/* Timeline Tab */}
          {activeTab === 'timeline' && (
            <div>
              <h4 className="text-lg font-medium text-gray-900 mb-4">Activity Timeline</h4>
              <div className="flow-root">
                <ul className="-mb-8">
                  <li>
                    <div className="relative pb-8">
                      <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200"></span>
                      <div className="relative flex space-x-3">
                        <div>
                          <span className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center ring-8 ring-white">
                            <span className="text-white text-xs">📋</span>
                          </span>
                        </div>
                        <div className="min-w-0 flex-1 pt-1.5 flex justify-between space-x-4">
                          <div>
                            <p className="text-sm text-gray-500">
                              Lead created from <span className="font-medium text-gray-900">{lead.source || 'unknown source'}</span>
                            </p>
                          </div>
                          <div className="text-right text-sm whitespace-nowrap text-gray-500">
                            {new Date(lead.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  </li>

                  {callHistory.map((call, index) => (
                    <li key={call._id}>
                      <div className="relative pb-8">
                        {index < callHistory.length - 1 && (
                          <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200"></span>
                        )}
                        <div className="relative flex space-x-3">
                          <div>
                            <span className={`h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white ${
                              call.outcome === 'answered' ? 'bg-green-500' : 
                              call.outcome === 'no_answer' ? 'bg-yellow-500' : 'bg-red-500'
                            }`}>
                              <span className="text-white text-xs">📞</span>
                            </span>
                          </div>
                          <div className="min-w-0 flex-1 pt-1.5 flex justify-between space-x-4">
                            <div>
                              <p className="text-sm text-gray-500">
                                Call <span className="font-medium text-gray-900">{call.outcome}</span>
                                {call.duration && ` - ${Math.floor(call.duration / 60)}:${(call.duration % 60).toString().padStart(2, '0')}`}
                              </p>
                            </div>
                            <div className="text-right text-sm whitespace-nowrap text-gray-500">
                              {new Date(call.createdAt).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}

                  {lead.lastContactDate && (
                    <li>
                      <div className="relative pb-8">
                        <div className="relative flex space-x-3">
                          <div>
                            <span className="h-8 w-8 rounded-full bg-purple-500 flex items-center justify-center ring-8 ring-white">
                              <span className="text-white text-xs">✉️</span>
                            </span>
                          </div>
                          <div className="min-w-0 flex-1 pt-1.5 flex justify-between space-x-4">
                            <div>
                              <p className="text-sm text-gray-500">
                                Status updated to <span className="font-medium text-gray-900">{lead.status}</span>
                              </p>
                            </div>
                            <div className="text-right text-sm whitespace-nowrap text-gray-500">
                              {new Date(lead.lastContactDate).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                      </div>
                    </li>
                  )}
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LeadDetailsModal;