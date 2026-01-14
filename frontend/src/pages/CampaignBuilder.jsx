import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-hot-toast';

const CampaignBuilder = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [previewLeads, setPreviewLeads] = useState([]);
  const [scripts, setScripts] = useState([]);
  const [voices, setVoices] = useState([]);

  const [campaignData, setCampaignData] = useState({
    name: '',
    description: '',
    targetIndustry: '',
    targetLocation: '',
    searchQuery: '',
    maxLeads: 100,
    scriptId: '',
    voiceId: '',
    scheduledTime: '',
    callSettings: {
      maxCallsPerDay: 50,
      callBetweenHours: { start: 9, end: 17 },
      timezone: 'America/New_York',
      retryAttempts: 2
    }
  });

  useEffect(() => {
    if (currentStep === 3) {
      fetchScripts();
    }
    if (currentStep === 4) {
      fetchVoices();
    }
  }, [currentStep]);

  const fetchScripts = async () => {
    try {
      const response = await axios.get('/api/scripts');
      setScripts(response.data.scripts || []);
    } catch (error) {
      console.error('Error fetching scripts:', error);
      toast.error('Failed to load scripts');
    }
  };

  const fetchVoices = async () => {
    try {
      const response = await axios.get('/api/voices');
      setVoices(response.data.voices || []);
    } catch (error) {
      console.error('Error fetching voices:', error);
      toast.error('Failed to load voices');
    }
  };

  const handleInputChange = (field, value) => {
    setCampaignData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSettingsChange = (field, value) => {
    setCampaignData(prev => ({
      ...prev,
      callSettings: {
        ...prev.callSettings,
        [field]: value
      }
    }));
  };

  const previewLeadsSearch = async () => {
    if (!campaignData.searchQuery || !campaignData.targetLocation) {
      toast.error('Please enter search query and location');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post('/api/leads/preview', {
        query: campaignData.searchQuery,
        location: campaignData.targetLocation,
        maxResults: 10 // Preview only 10 leads
      });
      setPreviewLeads(response.data.leads || []);
      toast.success(`Found ${response.data.leads?.length || 0} preview leads`);
    } catch (error) {
      console.error('Error previewing leads:', error);
      toast.error('Failed to preview leads');
    } finally {
      setLoading(false);
    }
  };

  const createCampaign = async () => {
    setLoading(true);
    try {
      const response = await axios.post('/api/campaigns', campaignData);
      toast.success('Campaign created successfully!');
      navigate(`/campaigns/${response.data._id}`);
    } catch (error) {
      console.error('Error creating campaign:', error);
      toast.error('Failed to create campaign');
    } finally {
      setLoading(false);
    }
  };

  const nextStep = () => {
    if (currentStep < 5) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const steps = [
    { number: 1, title: 'Search Setup', description: 'Define your target audience' },
    { number: 2, title: 'Preview Leads', description: 'Review potential leads' },
    { number: 3, title: 'Select Script', description: 'Choose your call script' },
    { number: 4, title: 'Choose Voice', description: 'Select AI voice' },
    { number: 5, title: 'Schedule Calls', description: 'Set calling preferences' }
  ];

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Campaign Builder</h1>
        <p className="text-gray-600">Create a new AI-powered calling campaign</p>
      </div>

      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <div key={step.number} className="flex items-center">
              <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                currentStep >= step.number
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : 'border-gray-300 text-gray-500'
              }`}>
                {currentStep > step.number ? (
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                ) : (
                  step.number
                )}
              </div>
              <div className="ml-3">
                <p className={`text-sm font-medium ${
                  currentStep >= step.number ? 'text-blue-600' : 'text-gray-500'
                }`}>
                  {step.title}
                </p>
                <p className="text-xs text-gray-500">{step.description}</p>
              </div>
              {index < steps.length - 1 && (
                <div className={`flex-1 h-0.5 mx-4 ${
                  currentStep > step.number ? 'bg-blue-600' : 'bg-gray-300'
                }`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <div className="bg-white rounded-lg shadow p-6">
        {/* Step 1: Search Setup */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-900">Search Setup</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Campaign Name
                </label>
                <input
                  type="text"
                  value={campaignData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Restaurant Outreach Q1"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Target Industry
                </label>
                <input
                  type="text"
                  value={campaignData.targetIndustry}
                  onChange={(e) => handleInputChange('targetIndustry', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., restaurants, retail, healthcare"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                value={campaignData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Describe your campaign goals..."
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Search Query
                </label>
                <input
                  type="text"
                  value={campaignData.searchQuery}
                  onChange={(e) => handleInputChange('searchQuery', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Italian restaurants"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Target Location
                </label>
                <input
                  type="text"
                  value={campaignData.targetLocation}
                  onChange={(e) => handleInputChange('targetLocation', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., New York, NY"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Maximum Leads
              </label>
              <input
                type="number"
                value={campaignData.maxLeads}
                onChange={(e) => handleInputChange('maxLeads', parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="1"
                max="1000"
              />
            </div>
          </div>
        )}

        {/* Step 2: Preview Leads */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900">Preview Leads</h2>
              <button
                onClick={previewLeadsSearch}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Searching...' : 'Preview Search'}
              </button>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-600">
                <strong>Search Query:</strong> {campaignData.searchQuery || 'Not set'}
              </p>
              <p className="text-sm text-gray-600">
                <strong>Location:</strong> {campaignData.targetLocation || 'Not set'}
              </p>
              <p className="text-sm text-gray-600">
                <strong>Max Leads:</strong> {campaignData.maxLeads}
              </p>
            </div>

            {previewLeads.length > 0 && (
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Preview Results</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Business Name
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Phone
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Address
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Rating
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {previewLeads.map((lead, index) => (
                        <tr key={index}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {lead.businessName}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {lead.phone || 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {lead.address}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {lead.rating ? `${lead.rating} ⭐` : 'N/A'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Select Script */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-900">Select Call Script</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {scripts.map((script) => (
                <div
                  key={script._id}
                  className={`border-2 rounded-lg p-4 cursor-pointer transition-colors ${
                    campaignData.scriptId === script._id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => handleInputChange('scriptId', script._id)}
                >
                  <h3 className="font-medium text-gray-900">{script.name}</h3>
                  <p className="text-sm text-gray-500 mt-1">{script.description}</p>
                  <p className="text-xs text-gray-400 mt-2">Industry: {script.industry}</p>
                </div>
              ))}
            </div>

            {scripts.length === 0 && (
              <div className="text-center py-8">
                <p className="text-gray-500">No scripts available</p>
                <button className="mt-2 text-blue-600 hover:text-blue-800">
                  Create a new script
                </button>
              </div>
            )}
          </div>
        )}

        {/* Step 4: Choose Voice */}
        {currentStep === 4 && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-900">Choose AI Voice</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {voices.map((voice) => (
                <div
                  key={voice._id}
                  className={`border-2 rounded-lg p-4 cursor-pointer transition-colors ${
                    campaignData.voiceId === voice._id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => handleInputChange('voiceId', voice._id)}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-medium text-gray-900">{voice.name}</h3>
                      <p className="text-sm text-gray-500 mt-1">{voice.description}</p>
                      <div className="flex items-center mt-2 space-x-4">
                        <span className="text-xs text-gray-400">
                          {voice.gender} • {voice.accent}
                        </span>
                        <span className="text-xs text-gray-400">
                          {voice.language}
                        </span>
                      </div>
                    </div>
                    <button className="text-blue-600 hover:text-blue-800 text-sm">
                      🔊 Preview
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {voices.length === 0 && (
              <div className="text-center py-8">
                <p className="text-gray-500">No voices available</p>
              </div>
            )}
          </div>
        )}

        {/* Step 5: Schedule Calls */}
        {currentStep === 5 && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-900">Schedule Calls</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Max Calls Per Day
                </label>
                <input
                  type="number"
                  value={campaignData.callSettings.maxCallsPerDay}
                  onChange={(e) => handleSettingsChange('maxCallsPerDay', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="1"
                  max="500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Timezone
                </label>
                <select
                  value={campaignData.callSettings.timezone}
                  onChange={(e) => handleSettingsChange('timezone', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="America/New_York">Eastern Time</option>
                  <option value="America/Chicago">Central Time</option>
                  <option value="America/Denver">Mountain Time</option>
                  <option value="America/Los_Angeles">Pacific Time</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Start Calling Hour
                </label>
                <select
                  value={campaignData.callSettings.callBetweenHours.start}
                  onChange={(e) => handleSettingsChange('callBetweenHours', {
                    ...campaignData.callSettings.callBetweenHours,
                    start: parseInt(e.target.value)
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i}>
                      {i === 0 ? '12:00 AM' : i < 12 ? `${i}:00 AM` : i === 12 ? '12:00 PM' : `${i - 12}:00 PM`}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  End Calling Hour
                </label>
                <select
                  value={campaignData.callSettings.callBetweenHours.end}
                  onChange={(e) => handleSettingsChange('callBetweenHours', {
                    ...campaignData.callSettings.callBetweenHours,
                    end: parseInt(e.target.value)
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i}>
                      {i === 0 ? '12:00 AM' : i < 12 ? `${i}:00 AM` : i === 12 ? '12:00 PM' : `${i - 12}:00 PM`}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Retry Attempts
              </label>
              <select
                value={campaignData.callSettings.retryAttempts}
                onChange={(e) => handleSettingsChange('retryAttempts', parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={0}>No retries</option>
                <option value={1}>1 retry</option>
                <option value={2}>2 retries</option>
                <option value={3}>3 retries</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start Date & Time (Optional)
              </label>
              <input
                type="datetime-local"
                value={campaignData.scheduledTime}
                onChange={(e) => handleInputChange('scheduledTime', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Leave empty to start immediately after creation
              </p>
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex justify-between pt-6 border-t border-gray-200">
          <button
            onClick={prevStep}
            disabled={currentStep === 1}
            className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          
          {currentStep < 5 ? (
            <button
              onClick={nextStep}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Next
            </button>
          ) : (
            <button
              onClick={createCampaign}
              disabled={loading || !campaignData.name || !campaignData.scriptId || !campaignData.voiceId}
              className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating...' : 'Create Campaign'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CampaignBuilder;