import React, { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import AuthContext from '../context/AuthContext';
import CreditMeter from '../components/CreditMeter';

const Dashboard = () => {
  const { user } = useContext(AuthContext);
  const [stats, setStats] = useState(null);
  const [recentCalls, setRecentCalls] = useState([]);
  const [creditUsage, setCreditUsage] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [statsRes, callsRes, creditsRes] = await Promise.all([
        axios.get('/api/campaigns/stats'),
        axios.get('/api/campaigns/recent-calls'),
        axios.get('/api/users/credit-usage')
      ]);

      setStats(statsRes.data);
      setRecentCalls(callsRes.data.calls || []);
      setCreditUsage(creditsRes.data.usage || []);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const quickActions = [
    {
      title: 'Create Campaign',
      description: 'Start a new lead generation campaign',
      icon: '🚀',
      link: '/campaign-builder',
      color: 'bg-blue-500 hover:bg-blue-600'
    },
    {
      title: 'Import Leads',
      description: 'Upload leads from CSV file',
      icon: '📊',
      link: '/leads/import',
      color: 'bg-green-500 hover:bg-green-600'
    },
    {
      title: 'View Analytics',
      description: 'Check performance metrics',
      icon: '📈',
      link: '/analytics',
      color: 'bg-purple-500 hover:bg-purple-600'
    },
    {
      title: 'Manage Scripts',
      description: 'Create and edit call scripts',
      icon: '📝',
      link: '/scripts',
      color: 'bg-yellow-500 hover:bg-yellow-600'
    }
  ];

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600">Welcome back, {user?.firstName}!</p>
        </div>
        <CreditMeter credits={user?.credits || 0} maxCredits={user?.maxCredits || 1000} />
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Campaigns"
          value={stats?.totalCampaigns || 0}
          change={stats?.campaignChange || 0}
          icon="📊"
          color="blue"
        />
        <StatCard
          title="Active Leads"
          value={stats?.activeLeads || 0}
          change={stats?.leadChange || 0}
          icon="👥"
          color="green"
        />
        <StatCard
          title="Calls Made Today"
          value={stats?.callsToday || 0}
          change={stats?.callChange || 0}
          icon="📞"
          color="purple"
        />
        <StatCard
          title="Success Rate"
          value={`${stats?.successRate || 0}%`}
          change={stats?.successRateChange || 0}
          icon="🎯"
          color="yellow"
        />
      </div>

      {/* Charts and Tables Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Credit Usage Chart */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Credit Usage (Last 7 Days)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={creditUsage}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="credits" stroke="#3B82F6" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Call Performance Chart */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Call Performance</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={stats?.callPerformance || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="hour" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="successful" fill="#10B981" />
              <Bar dataKey="failed" fill="#EF4444" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Calls and Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Calls Table */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium text-gray-900">Recent Calls</h3>
              <Link
                to="/calls"
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                View all
              </Link>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Lead
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Duration
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Time
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {recentCalls.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="px-6 py-4 text-center text-gray-500">
                      No recent calls
                    </td>
                  </tr>
                ) : (
                  recentCalls.map((call) => (
                    <tr key={call._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {call.lead?.businessName || 'Unknown'}
                          </div>
                          <div className="text-sm text-gray-500">
                            {call.lead?.phone}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          call.outcome === 'answered' ? 'bg-green-100 text-green-800' :
                          call.outcome === 'no_answer' ? 'bg-yellow-100 text-yellow-800' :
                          call.outcome === 'busy' ? 'bg-orange-100 text-orange-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {call.outcome}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {call.duration ? `${Math.floor(call.duration / 60)}:${(call.duration % 60).toString().padStart(2, '0')}` : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(call.createdAt).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h3>
          <div className="space-y-3">
            {quickActions.map((action, index) => (
              <Link
                key={index}
                to={action.link}
                className={`block p-4 rounded-lg text-white transition-colors ${action.color}`}
              >
                <div className="flex items-center">
                  <span className="text-2xl mr-3">{action.icon}</span>
                  <div>
                    <div className="font-medium">{action.title}</div>
                    <div className="text-sm opacity-90">{action.description}</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Active Campaigns */}
      {stats?.activeCampaigns && stats.activeCampaigns.length > 0 && (
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Active Campaigns</h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {stats.activeCampaigns.map((campaign) => (
                <div key={campaign._id} className="border rounded-lg p-4">
                  <h4 className="font-medium text-gray-900">{campaign.name}</h4>
                  <p className="text-sm text-gray-500 mt-1">{campaign.description}</p>
                  <div className="mt-3 flex justify-between text-sm">
                    <span>Leads: {campaign.totalLeads}</span>
                    <span>Called: {campaign.leadsContacted}</span>
                  </div>
                  <div className="mt-2 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{
                        width: `${campaign.totalLeads > 0 ? (campaign.leadsContacted / campaign.totalLeads) * 100 : 0}%`
                      }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Statistics Card Component
const StatCard = ({ title, value, change, icon, color }) => {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    yellow: 'bg-yellow-50 text-yellow-600'
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center">
        <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
          <span className="text-2xl">{icon}</span>
        </div>
        <div className="ml-4 flex-1">
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          {change !== undefined && (
            <p className={`text-sm ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {change >= 0 ? '+' : ''}{change}% from last week
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;