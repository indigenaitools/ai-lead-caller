import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';

const Admin = () => {
  const [dashboard, setDashboard] = useState(null);
  const [queueStats, setQueueStats] = useState(null);
  const [systemHealth, setSystemHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');

  useEffect(() => {
    fetchDashboardData();
    fetchQueueStats();
    fetchSystemHealth();
    
    // Refresh data every 30 seconds
    const interval = setInterval(() => {
      fetchQueueStats();
      fetchSystemHealth();
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async () => {
    try {
      const response = await axios.get('/api/admin/dashboard');
      setDashboard(response.data);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error('Failed to load dashboard data');
    }
  };

  const fetchQueueStats = async () => {
    try {
      const response = await axios.get('/api/admin/queues');
      setQueueStats(response.data);
    } catch (error) {
      console.error('Error fetching queue stats:', error);
    }
  };

  const fetchSystemHealth = async () => {
    try {
      const response = await axios.get('/api/admin/health');
      setSystemHealth(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching system health:', error);
      setLoading(false);
    }
  };

  const handleQueueAction = async (queueName, action) => {
    try {
      await axios.post(`/api/admin/queues/${queueName}/${action}`);
      toast.success(`Queue ${queueName} ${action}d successfully`);
      fetchQueueStats();
    } catch (error) {
      console.error(`Error ${action}ing queue:`, error);
      toast.error(`Failed to ${action} queue`);
    }
  };

  const cleanQueue = async (queueName, type = 'completed') => {
    try {
      const response = await axios.post(`/api/admin/queues/${queueName}/clean`, { type });
      toast.success(`Cleaned ${response.data.cleanedCount} ${type} jobs from ${queueName}`);
      fetchQueueStats();
    } catch (error) {
      console.error('Error cleaning queue:', error);
      toast.error('Failed to clean queue');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-gray-600">System monitoring and management</p>
      </div>

      {/* Tab Navigation */}
      <div className="mb-6">
        <nav className="flex space-x-8">
          {['dashboard', 'queues', 'health'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </nav>
      </div>

      {/* Dashboard Tab */}
      {activeTab === 'dashboard' && dashboard && (
        <div className="space-y-6">
          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard
              title="Total Users"
              value={dashboard.statistics.users.total}
              subtitle={`${dashboard.statistics.users.active} active`}
              color="blue"
            />
            <StatCard
              title="Total Campaigns"
              value={dashboard.statistics.campaigns.total}
              subtitle={`${dashboard.statistics.campaigns.active} active`}
              color="green"
            />
            <StatCard
              title="Total Leads"
              value={dashboard.statistics.leads.total}
              subtitle={`${dashboard.statistics.leads.contactRate}% contacted`}
              color="yellow"
            />
            <StatCard
              title="Total Calls"
              value={dashboard.statistics.calls.total}
              subtitle={`${dashboard.statistics.calls.successRate}% success rate`}
              color="purple"
            />
          </div>

          {/* Recent Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Users</h3>
              <div className="space-y-3">
                {dashboard.recentActivity.users.map((user) => (
                  <div key={user._id} className="flex justify-between items-center">
                    <div>
                      <p className="font-medium">{user.firstName} {user.lastName}</p>
                      <p className="text-sm text-gray-500">{user.email}</p>
                    </div>
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      user.subscription === 'free' ? 'bg-gray-100 text-gray-800' : 'bg-green-100 text-green-800'
                    }`}>
                      {user.subscription}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Campaigns</h3>
              <div className="space-y-3">
                {dashboard.recentActivity.campaigns.map((campaign) => (
                  <div key={campaign._id} className="flex justify-between items-center">
                    <div>
                      <p className="font-medium">{campaign.name}</p>
                      <p className="text-sm text-gray-500">
                        {campaign.user.firstName} {campaign.user.lastName}
                      </p>
                    </div>
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      campaign.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {campaign.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Queues Tab */}
      {activeTab === 'queues' && queueStats && (
        <div className="space-y-6">
          {/* Queue Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {Object.entries(queueStats.overview).map(([queueName, stats]) => (
              <QueueCard
                key={queueName}
                name={queueName}
                stats={stats}
                health={queueStats.health[queueName]}
                onAction={handleQueueAction}
                onClean={cleanQueue}
              />
            ))}
          </div>

          {/* Active Jobs */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Active Jobs</h3>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {Object.entries(queueStats.activeJobs).map(([queueName, jobs]) => (
                  <div key={queueName}>
                    <h4 className="font-medium text-gray-900 mb-3 capitalize">{queueName} Queue</h4>
                    <div className="space-y-2">
                      {jobs.length === 0 ? (
                        <p className="text-sm text-gray-500">No active jobs</p>
                      ) : (
                        jobs.slice(0, 5).map((job) => (
                          <div key={job.id} className="text-sm">
                            <p className="font-medium">Job #{job.id}</p>
                            <p className="text-gray-500">Progress: {job.progress}%</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Health Tab */}
      {activeTab === 'health' && systemHealth && (
        <div className="space-y-6">
          {/* Overall Health */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">System Health</h3>
              <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                systemHealth.overall.status === 'healthy' 
                  ? 'bg-green-100 text-green-800'
                  : systemHealth.overall.status === 'warning'
                  ? 'bg-yellow-100 text-yellow-800'
                  : 'bg-red-100 text-red-800'
              }`}>
                {systemHealth.overall.status} ({systemHealth.overall.score}%)
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {Object.entries(systemHealth.components).map(([component, health]) => (
                <div key={component} className="border rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 capitalize">{component}</h4>
                  <div className={`mt-2 px-2 py-1 rounded text-sm ${
                    health.status === 'healthy' 
                      ? 'bg-green-100 text-green-800'
                      : health.status === 'warning'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {health.status}
                  </div>
                  {health.responseTime && (
                    <p className="text-xs text-gray-500 mt-1">
                      Response: {health.responseTime}ms
                    </p>
                  )}
                  {health.message && (
                    <p className="text-xs text-gray-600 mt-1">{health.message}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Helper Components
const StatCard = ({ title, value, subtitle, color }) => {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    purple: 'bg-purple-50 text-purple-600'
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className={`w-12 h-12 rounded-lg ${colorClasses[color]} flex items-center justify-center mb-4`}>
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11.707 4.707a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
      </div>
      <h3 className="text-2xl font-bold text-gray-900">{value.toLocaleString()}</h3>
      <p className="text-gray-600">{title}</p>
      <p className="text-sm text-gray-500">{subtitle}</p>
    </div>
  );
};

const QueueCard = ({ name, stats, health, onAction, onClean }) => {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900 capitalize">{name}</h3>
        <div className={`px-2 py-1 rounded-full text-xs font-medium ${
          health.status === 'healthy' 
            ? 'bg-green-100 text-green-800'
            : health.status === 'warning'
            ? 'bg-yellow-100 text-yellow-800'
            : 'bg-red-100 text-red-800'
        }`}>
          {health.status}
        </div>
      </div>
      
      <div className="space-y-2 mb-4">
        <div className="flex justify-between">
          <span className="text-sm text-gray-600">Waiting:</span>
          <span className="font-medium">{stats.waiting}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-gray-600">Active:</span>
          <span className="font-medium">{stats.active}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-gray-600">Completed:</span>
          <span className="font-medium">{stats.completed}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-gray-600">Failed:</span>
          <span className="font-medium">{stats.failed}</span>
        </div>
      </div>
      
      <div className="flex space-x-2">
        <button
          onClick={() => onAction(`${name}-queue`, 'pause')}
          className="flex-1 px-3 py-1 text-xs bg-yellow-100 text-yellow-800 rounded hover:bg-yellow-200"
        >
          Pause
        </button>
        <button
          onClick={() => onAction(`${name}-queue`, 'resume')}
          className="flex-1 px-3 py-1 text-xs bg-green-100 text-green-800 rounded hover:bg-green-200"
        >
          Resume
        </button>
        <button
          onClick={() => onClean(`${name}-queue`)}
          className="flex-1 px-3 py-1 text-xs bg-gray-100 text-gray-800 rounded hover:bg-gray-200"
        >
          Clean
        </button>
      </div>
    </div>
  );
};

export default Admin;