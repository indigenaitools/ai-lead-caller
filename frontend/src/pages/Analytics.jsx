import React, { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart
} from 'recharts';
import axios from 'axios';
import { toast } from 'react-hot-toast';

const Analytics = () => {
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('30d');
  const [analytics, setAnalytics] = useState({
    callSuccessRate: [],
    callingTimes: [],
    scriptPerformance: [],
    roiData: {},
    conversionFunnel: [],
    campaignComparison: []
  });

  useEffect(() => {
    fetchAnalytics();
  }, [dateRange]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/analytics?range=${dateRange}`);
      setAnalytics(response.data);
    } catch (error) {
      console.error('Error fetching analytics:', error);
      toast.error('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4'];

  const heatmapData = [
    { hour: '9 AM', Mon: 85, Tue: 78, Wed: 82, Thu: 88, Fri: 75, Sat: 45, Sun: 32 },
    { hour: '10 AM', Mon: 92, Tue: 88, Wed: 90, Thu: 95, Fri: 85, Sat: 52, Sun: 38 },
    { hour: '11 AM', Mon: 88, Tue: 85, Wed: 87, Thu: 92, Fri: 82, Sat: 48, Sun: 35 },
    { hour: '12 PM', Mon: 75, Tue: 72, Wed: 78, Thu: 80, Fri: 70, Sat: 55, Sun: 42 },
    { hour: '1 PM', Mon: 68, Tue: 65, Wed: 70, Thu: 72, Fri: 62, Sat: 58, Sun: 45 },
    { hour: '2 PM', Mon: 82, Tue: 78, Wed: 85, Thu: 88, Fri: 75, Sat: 62, Sun: 48 },
    { hour: '3 PM', Mon: 90, Tue: 87, Wed: 92, Thu: 95, Fri: 85, Sat: 65, Sun: 52 },
    { hour: '4 PM', Mon: 85, Tue: 82, Wed: 88, Thu: 90, Fri: 80, Sat: 60, Sun: 48 },
    { hour: '5 PM', Mon: 70, Tue: 68, Wed: 72, Thu: 75, Fri: 65, Sat: 55, Sun: 42 }
  ];

  const getHeatmapColor = (value) => {
    if (value >= 90) return 'bg-green-500';
    if (value >= 80) return 'bg-green-400';
    if (value >= 70) return 'bg-yellow-400';
    if (value >= 60) return 'bg-orange-400';
    if (value >= 50) return 'bg-red-400';
    return 'bg-red-500';
  };

  const calculateROI = () => {
    const { totalInvestment, totalRevenue, totalCalls, conversionRate } = analytics.roiData;
    const roi = totalInvestment > 0 ? ((totalRevenue - totalInvestment) / totalInvestment) * 100 : 0;
    const costPerCall = totalCalls > 0 ? totalInvestment / totalCalls : 0;
    const revenuePerCall = totalCalls > 0 ? totalRevenue / totalCalls : 0;
    
    return { roi, costPerCall, revenuePerCall, conversionRate };
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  const roiMetrics = calculateROI();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Analytics</h1>
          <p className="text-gray-600">Performance insights and metrics</p>
        </div>
        <div className="flex space-x-3">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="1y">Last year</option>
          </select>
          <button
            onClick={fetchAnalytics}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Success Rate"
          value={`${analytics.roiData?.conversionRate || 0}%`}
          change={5.2}
          icon="🎯"
          color="green"
        />
        <MetricCard
          title="Total Calls"
          value={analytics.roiData?.totalCalls || 0}
          change={12.5}
          icon="📞"
          color="blue"
        />
        <MetricCard
          title="ROI"
          value={`${roiMetrics.roi.toFixed(1)}%`}
          change={roiMetrics.roi > 0 ? 8.3 : -2.1}
          icon="💰"
          color="purple"
        />
        <MetricCard
          title="Cost per Call"
          value={`$${roiMetrics.costPerCall.toFixed(2)}`}
          change={-3.2}
          icon="💸"
          color="yellow"
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Call Success Rate Trend */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Call Success Rate Trend</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={analytics.callSuccessRate}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Area type="monotone" dataKey="successRate" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.3} />
              <Area type="monotone" dataKey="totalCalls" stroke="#10B981" fill="#10B981" fillOpacity={0.3} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Conversion Funnel */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Conversion Funnel</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={analytics.conversionFunnel} layout="horizontal">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="stage" type="category" width={80} />
              <Tooltip />
              <Bar dataKey="count" fill="#3B82F6" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Best Calling Times Heatmap */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Best Calling Times Heatmap</h3>
        <p className="text-sm text-gray-600 mb-4">Success rate by day and hour (darker = higher success rate)</p>
        
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Mon</th>
                <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Tue</th>
                <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Wed</th>
                <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Thu</th>
                <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Fri</th>
                <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Sat</th>
                <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Sun</th>
              </tr>
            </thead>
            <tbody>
              {heatmapData.map((row, index) => (
                <tr key={index}>
                  <td className="px-3 py-2 text-sm font-medium text-gray-900">{row.hour}</td>
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                    <td key={day} className="px-3 py-2 text-center">
                      <div
                        className={`w-12 h-8 rounded flex items-center justify-center text-white text-xs font-medium ${getHeatmapColor(row[day])}`}
                        title={`${day} ${row.hour}: ${row[day]}% success rate`}
                      >
                        {row[day]}%
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Script Performance */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Script Performance Comparison</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={analytics.scriptPerformance}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="scriptName" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="successRate" fill="#3B82F6" name="Success Rate %" />
              <Bar dataKey="totalCalls" fill="#10B981" name="Total Calls" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Campaign Comparison */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Campaign Performance</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={analytics.campaignComparison}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {analytics.campaignComparison.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ROI Calculator */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">ROI Calculator</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-blue-50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-blue-900">Total Investment</h4>
            <p className="text-2xl font-bold text-blue-600">
              ${(analytics.roiData?.totalInvestment || 0).toLocaleString()}
            </p>
            <p className="text-xs text-blue-600">Platform + Credits</p>
          </div>
          
          <div className="bg-green-50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-green-900">Total Revenue</h4>
            <p className="text-2xl font-bold text-green-600">
              ${(analytics.roiData?.totalRevenue || 0).toLocaleString()}
            </p>
            <p className="text-xs text-green-600">From Conversions</p>
          </div>
          
          <div className="bg-purple-50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-purple-900">ROI</h4>
            <p className={`text-2xl font-bold ${roiMetrics.roi >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {roiMetrics.roi.toFixed(1)}%
            </p>
            <p className="text-xs text-purple-600">Return on Investment</p>
          </div>
          
          <div className="bg-yellow-50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-yellow-900">Revenue per Call</h4>
            <p className="text-2xl font-bold text-yellow-600">
              ${roiMetrics.revenuePerCall.toFixed(2)}
            </p>
            <p className="text-xs text-yellow-600">Average Revenue</p>
          </div>
        </div>

        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <h4 className="font-medium text-gray-900 mb-2">ROI Insights</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-600">
                • Your current ROI is <strong>{roiMetrics.roi.toFixed(1)}%</strong>
              </p>
              <p className="text-gray-600">
                • Cost per successful call: <strong>${(roiMetrics.costPerCall / (roiMetrics.conversionRate / 100)).toFixed(2)}</strong>
              </p>
            </div>
            <div>
              <p className="text-gray-600">
                • Break-even point: <strong>{Math.ceil(analytics.roiData?.totalInvestment / roiMetrics.revenuePerCall)} calls</strong>
              </p>
              <p className="text-gray-600">
                • Projected monthly ROI: <strong>{(roiMetrics.roi * 1.2).toFixed(1)}%</strong>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Performance Recommendations */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Performance Recommendations</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium text-gray-900 mb-3">🎯 Optimization Opportunities</h4>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>• Best calling time: Tuesday-Thursday, 10-11 AM</li>
              <li>• Top performing script: "Consultative Approach" (85% success)</li>
              <li>• Avoid calling: Weekends and lunch hours (12-1 PM)</li>
              <li>• Focus on: Healthcare and Professional Services sectors</li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-medium text-gray-900 mb-3">📈 Growth Strategies</h4>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>• Increase call volume during peak hours (10-11 AM)</li>
              <li>• A/B test new scripts against current top performer</li>
              <li>• Implement follow-up sequences for no-answer calls</li>
              <li>• Consider expanding to similar high-performing industries</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

// Metric Card Component
const MetricCard = ({ title, value, change, icon, color }) => {
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
              {change >= 0 ? '+' : ''}{change}% from last period
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Analytics;