import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import CallMonitoring from '../components/CallMonitoring';

const Campaigns = () => {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [showCallMonitoring, setShowCallMonitoring] = useState(false);
  const [activeCalls, setActiveCalls] = useState({});

  // Fetch campaigns
  useEffect(() => {
    fetchCampaigns();
  }, []);

  const fetchCampaigns = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/campaigns`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCampaigns(response.data.campaigns || []);
    } catch (error) {
      console.error('Error fetching campaigns:', error);
      toast.error('Failed to fetch campaigns');
    } finally {
      setLoading(false);
    }
  };

  // Fetch active calls for a campaign
  const fetchActiveCalls = async (campaignId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${import.meta.env.VITE_API_URL}/campaigns/${campaignId}/active-calls`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setActiveCalls(prev => ({
        ...prev,
        [campaignId]: response.data.activeCalls || []
      }));
    } catch (error) {
      console.error('Error fetching active calls:', error);
    }
  };

  // Start calling for a campaign
  const startCalling = async (campaignId, maxCalls = 5) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/campaigns/${campaignId}/start-calling`,
        { maxCalls },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success(`Started calling ${response.data.successfulCalls} leads`);
      
      if (response.data.errors.length > 0) {
        toast.error(`${response.data.failedCalls} calls failed to start`);
      }
      
      // Refresh active calls
      fetchActiveCalls(campaignId);
    } catch (error) {
      console.error('Error starting calls:', error);
      toast.error(error.response?.data?.message || 'Failed to start calling');
    }
  };

  // Start/pause campaign
  const toggleCampaign = async (campaignId, action) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${import.meta.env.VITE_API_URL}/campaigns/${campaignId}/${action}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success(`Campaign ${action}ed successfully`);
      fetchCampaigns();
    } catch (error) {
      console.error(`Error ${action}ing campaign:`, error);
      toast.error(error.response?.data?.message || `Failed to ${action} campaign`);
    }
  };

  // Get status color
  const getStatusColor = (status) => {
    const colors = {
      'draft': 'bg-gray-100 text-gray-800',
      'active': 'bg-green-100 text-green-800',
      'paused': 'bg-yellow-100 text-yellow-800',
      'completed': 'bg-blue-100 text-blue-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  // Format date
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (showCallMonitoring) {
    return (
      <div>
        <div className="mb-4">
          <button
            onClick={() => setShowCallMonitoring(false)}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
          >
            ← Back to Campaigns
          </button>
        </div>
        <CallMonitoring />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Campaigns</h1>
          <div className="flex space-x-3">
            <button
              onClick={() => setShowCallMonitoring(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              📞 Call Monitoring
            </button>
            <Link
              to="/campaigns/new"
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
            >
              + New Campaign
            </Link>
          </div>
        </div>
      </div>

      {campaigns.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-gray-400 text-6xl mb-4">📋</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No campaigns yet</h3>
          <p className="text-gray-500 mb-6">Create your first campaign to start generating leads</p>
          <Link
            to="/campaigns/new"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Create Campaign
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {campaigns.map((campaign) => (
            <div key={campaign._id} className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 truncate">
                    {campaign.name}
                  </h3>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(campaign.status)}`}>
                    {campaign.status}
                  </span>
                </div>
                
                <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                  {campaign.description || 'No description'}
                </p>
                
                <div className="space-y-2 text-sm text-gray-500">
                  <div className="flex justify-between">
                    <span>Industry:</span>
                    <span className="font-medium">{campaign.targetIndustry || 'Any'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Location:</span>
                    <span className="font-medium">{campaign.targetLocation || 'Any'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Leads:</span>
                    <span className="font-medium">{campaign.totalLeads || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Called:</span>
                    <span className="font-medium">{campaign.calledLeads || 0}</span>
                  </div>
                  {activeCalls[campaign._id] && (
                    <div className="flex justify-between">
                      <span>Active Calls:</span>
                      <span className="font-medium text-green-600">
                        {activeCalls[campaign._id].length}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>Created:</span>
                    <span className="font-medium">{formatDate(campaign.createdAt)}</span>
                  </div>
                </div>
              </div>
              
              <div className="px-6 py-4 bg-gray-50 border-t">
                <div className="flex space-x-2">
                  <Link
                    to={`/campaigns/${campaign._id}`}
                    className="flex-1 px-3 py-2 text-center text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                  >
                    View
                  </Link>
                  
                  {campaign.status === 'draft' && (
                    <button
                      onClick={() => toggleCampaign(campaign._id, 'start')}
                      className="flex-1 px-3 py-2 text-center text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                    >
                      Start
                    </button>
                  )}
                  
                  {campaign.status === 'active' && (
                    <>
                      <button
                        onClick={() => startCalling(campaign._id, 5)}
                        className="flex-1 px-3 py-2 text-center text-sm bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
                      >
                        Call Leads
                      </button>
                      <button
                        onClick={() => toggleCampaign(campaign._id, 'pause')}
                        className="px-3 py-2 text-center text-sm bg-yellow-600 text-white rounded hover:bg-yellow-700 transition-colors"
                      >
                        Pause
                      </button>
                    </>
                  )}
                  
                  {campaign.status === 'paused' && (
                    <button
                      onClick={() => toggleCampaign(campaign._id, 'start')}
                      className="flex-1 px-3 py-2 text-center text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                    >
                      Resume
                    </button>
                  )}
                  
                  <button
                    onClick={() => fetchActiveCalls(campaign._id)}
                    className="px-3 py-2 text-center text-sm bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
                  >
                    📞
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Campaigns;