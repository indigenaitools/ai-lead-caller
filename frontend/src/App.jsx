import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

// Pages
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Register from './pages/Register';
import Leads from './pages/Leads';
import LeadsTable from './pages/LeadsTable';
import Campaigns from './pages/Campaigns';
import CampaignBuilder from './pages/CampaignBuilder';
import Analytics from './pages/Analytics';
import Admin from './pages/Admin';
import NotFound from './pages/NotFound';

// Components
import PrivateRoute from './components/PrivateRoute';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';

// Context
import { AuthProvider } from './context/AuthContext';

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen bg-gray-100">
          <Toaster position="top-right" />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            
            {/* Private Routes */}
            <Route path="/" element={<PrivateRoute><Layout><Dashboard /></Layout></PrivateRoute>} />
            <Route path="/leads" element={<PrivateRoute><Layout><LeadsTable /></Layout></PrivateRoute>} />
            <Route path="/leads/table" element={<PrivateRoute><Layout><LeadsTable /></Layout></PrivateRoute>} />
            <Route path="/campaigns" element={<PrivateRoute><Layout><Campaigns /></Layout></PrivateRoute>} />
            <Route path="/campaign-builder" element={<PrivateRoute><Layout><CampaignBuilder /></Layout></PrivateRoute>} />
            <Route path="/analytics" element={<PrivateRoute><Layout><Analytics /></Layout></PrivateRoute>} />
            <Route path="/admin" element={<PrivateRoute><Layout><Admin /></Layout></PrivateRoute>} />
            
            {/* 404 Route */}
            <Route path="/404" element={<NotFound />} />
            <Route path="*" element={<Navigate to="/404" replace />} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

// Layout component with Navbar and Sidebar
function Layout({ children }) {
  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Navbar />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

export default App;