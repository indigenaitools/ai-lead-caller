import React, { useContext, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import AuthContext from '../context/AuthContext';

const Dashboard = () => {
  const { user } = useContext(AuthContext);
  const [stats, setStats] = useState({
    totalLeads: 0,
    totalCampaigns: 0,
    activeCampaigns: 0,
    leadsByStatus: {
      new: 0,
      contacted: 0,
      qualified: 0,
      converted: 0,
      rejected: 0
    }
  });
  const [recentLeads, setRecentLeads] = useState([]);
  const [recentCampaigns, setRecentCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        
        // Fetch leads stats
        const leadsRes = await axios.get('/api/leads?pageSize=5');
        setRecentLeads(leadsRes.data.leads || []);
        
        // Fetch campaigns
        const campaignsRes = await axios.get('/api/campaigns?pageSize=5');
        setRecentCampaigns(campaignsRes.data.campaigns || []);
        
        // Set stats
        setStats({
          totalLeads: leadsRes.data.total || 0,
          totalCampaigns: campaignsRes.data.total || 0,
          activeCampaigns: campaignsRes.data.campaigns?.filter(c => c.status === 'active').length || 0,
          leadsByStatus: {
            new: leadsRes.data.leads?.filter(l => l.status === 'new').length || 0,
            contacted: leadsRes.data.leads?.filter(l => l.status === 'contacted').length || 0,
            qualified: leadsRes.data.leads?.filter(l => l.status === 'qualified').length || 0,
            converted: leadsRes.data.leads?.filter(l => l.status === 'converted').length || 0,
            rejected: leadsRes.data.leads?.filter(l => l.status === 'rejected').length || 0
          }
        });
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchDashboardData();
  }, []);

  // Prepare chart data
  const chartData = [
    { name: 'New', value: stats.leadsByStatus.new },
    { name: 'Contacted', value: stats.leadsByStatus.contacted },
    { name: 'Qualified', value: stats.leadsByStatus.qualified },
    { name: 'Converted', value: stats.leadsByStatus.converted },
    { name: 'Rejected', value: stats.leadsByStatus.rejected }
  ];

  return (
    <div className="pt-16 md:ml-64">
      <div className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <div className="card">
            <h5 className="text-xl font-bold leading-none text-gray-900 mb-2">Total Leads</h5>
            <div className="text-3xl font-bold">{stats.totalLeads}</div>
          </div>
          <div className="card">
            <h5 className="text-xl font-bold leading-none text-gray-900 mb-2">Total Campaigns</h5>
            <div className="text-3xl font-bold">{stats.totalCampaigns}</div>
          </div>
          <div className="card">
            <h5 className="text-xl font-bold leading-none text-gray-900 mb-2">Active Campaigns</h5>
            <div className="text-3xl font-bold">{stats.activeCampaigns}</div>
          </div>
          <div className="card">
            <h5 className="text-xl font-bold leading-none text-gray-900 mb-2">Conversion Rate</h5>
            <div className="text-3xl font-bold">
              {stats.totalLeads > 0
                ? ((stats.leadsByStatus.converted / stats.totalLeads) * 100).toFixed(1) + '%'
                : '0%'}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          <div className="card">
            <h5 className="text-xl font-bold leading-none text-gray-900 mb-4">Lead Status Distribution</h5>
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="value" fill="#3B82F6" name="Leads" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h5 className="text-xl font-bold leading-none text-gray-900">Recent Leads</h5>
              <Link to="/leads" className="text-sm font-medium text-blue-600 hover:underline">
                View all
              </Link>
            </div>
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
              </div>
            ) : recentLeads.length > 0 ? (
              <div className="flow-root">
                <ul className="divide-y divide-gray-200">
                  {recentLeads.map((lead) => (
                    <li key={lead._id} className="py-3 sm:py-4">
                      <div className="flex items-center space-x-4">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {lead.firstName} {lead.lastName}
                          </p>
                          <p className="text-sm text-gray-500 truncate">{lead.company}</p>
                        </div>
                        <div className="inline-flex items-center">
                          <span
                            className={`badge ${
                              lead.status === 'new'
                                ? 'badge-info'
                                : lead.status === 'contacted'
                                ? 'badge-secondary'
                                : lead.status === 'qualified'
                                ? 'badge-warning'
                                : lead.status === 'converted'
                                ? 'badge-success'
                                : 'badge-danger'
                            }`}
                          >
                            {lead.status}
                          </span>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-gray-500">No leads found</p>
                <Link to="/leads" className="btn btn-primary mt-2">
                  Create Lead
                </Link>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h5 className="text-xl font-bold leading-none text-gray-900">Recent Campaigns</h5>
            <Link to="/campaigns" className="text-sm font-medium text-blue-600 hover:underline">
              View all
            </Link>
          </div>
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          ) : recentCampaigns.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left text-gray-500">
                <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3">
                      Campaign Name
                    </th>
                    <th scope="col" className="px-6 py-3">
                      Status
                    </th>
                    <th scope="col" className="px-6 py-3">
                      Leads
                    </th>
                    <th scope="col" className="px-6 py-3">
                      Conversion
                    </th>
                    <th scope="col" className="px-6 py-3">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {recentCampaigns.map((campaign) => (
                    <tr key={campaign._id} className="bg-white border-b hover:bg-gray-50">
                      <th
                        scope="row"
                        className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap"
                      >
                        {campaign.name}
                      </th>
                      <td className="px-6 py-4">
                        <span
                          className={`badge ${
                            campaign.status === 'active'
                              ? 'badge-success'
                              : campaign.status === 'paused'
                              ? 'badge-warning'
                              : campaign.status === 'completed'
                              ? 'badge-info'
                              : 'badge-secondary'
                          }`}
                        >
                          {campaign.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">{campaign.leadsGenerated}</td>
                      <td className="px-6 py-4">
                        {campaign.leadsGenerated > 0
                          ? ((campaign.leadsConverted / campaign.leadsGenerated) * 100).toFixed(1) +
                            '%'
                          : '0%'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          to={`/campaigns/${campaign._id}`}
                          className="font-medium text-blue-600 hover:underline"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-gray-500">No campaigns found</p>
              <Link to="/campaigns/create" className="btn btn-primary mt-2">
                Create Campaign
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;