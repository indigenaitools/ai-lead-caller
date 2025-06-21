import React, { useContext } from 'react';
import { Link, useLocation } from 'react-router-dom';
import AuthContext from '../context/AuthContext';

const Sidebar = () => {
  const location = useLocation();
  const { user } = useContext(AuthContext);

  // Function to check if a link is active
  const isActive = (path) => {
    return location.pathname === path;
  };

  return (
    <aside
      className="fixed top-0 left-0 z-40 w-64 h-screen pt-14 transition-transform -translate-x-full bg-white border-r border-gray-200 md:translate-x-0"
      aria-label="Sidenav"
      id="drawer-navigation"
    >
      <div className="overflow-y-auto py-5 px-3 h-full bg-white">
        <div className="flex items-center mb-6 pl-2.5">
          <span className="self-center text-xl font-semibold whitespace-nowrap">
            {user?.subscription !== 'free' ? (
              <span className="bg-blue-100 text-blue-800 text-xs font-semibold mr-2 px-2.5 py-0.5 rounded">
                {user?.subscription}
              </span>
            ) : null}
            Credits: {user?.credits || 0}
          </span>
        </div>
        <ul className="space-y-2">
          <li>
            <Link
              to="/"
              className={`flex items-center p-2 text-base font-medium rounded-lg ${
                isActive('/') ? 'bg-gray-100 text-blue-600' : 'text-gray-900 hover:bg-gray-100'
              }`}
            >
              <svg
                className="w-6 h-6 transition duration-75"
                fill="currentColor"
                viewBox="0 0 20 20"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M2 10a8 8 0 018-8v8h8a8 8 0 11-16 0z"></path>
                <path d="M12 2.252A8.014 8.014 0 0117.748 8H12V2.252z"></path>
              </svg>
              <span className="ml-3">Dashboard</span>
            </Link>
          </li>
          <li>
            <Link
              to="/leads"
              className={`flex items-center p-2 text-base font-medium rounded-lg ${
                isActive('/leads') ? 'bg-gray-100 text-blue-600' : 'text-gray-900 hover:bg-gray-100'
              }`}
            >
              <svg
                className="w-6 h-6 transition duration-75"
                fill="currentColor"
                viewBox="0 0 20 20"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"></path>
              </svg>
              <span className="ml-3">Leads</span>
            </Link>
          </li>
          <li>
            <Link
              to="/campaigns"
              className={`flex items-center p-2 text-base font-medium rounded-lg ${
                isActive('/campaigns') ? 'bg-gray-100 text-blue-600' : 'text-gray-900 hover:bg-gray-100'
              }`}
            >
              <svg
                className="w-6 h-6 transition duration-75"
                fill="currentColor"
                viewBox="0 0 20 20"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path>
              </svg>
              <span className="ml-3">Campaigns</span>
            </Link>
          </li>
          <li>
            <Link
              to="/subscription"
              className={`flex items-center p-2 text-base font-medium rounded-lg ${
                isActive('/subscription') ? 'bg-gray-100 text-blue-600' : 'text-gray-900 hover:bg-gray-100'
              }`}
            >
              <svg
                className="w-6 h-6 transition duration-75"
                fill="currentColor"
                viewBox="0 0 20 20"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  fillRule="evenodd"
                  d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z"
                  clipRule="evenodd"
                ></path>
              </svg>
              <span className="ml-3">Subscription</span>
            </Link>
          </li>
          <li>
            <Link
              to="/profile"
              className={`flex items-center p-2 text-base font-medium rounded-lg ${
                isActive('/profile') ? 'bg-gray-100 text-blue-600' : 'text-gray-900 hover:bg-gray-100'
              }`}
            >
              <svg
                className="w-6 h-6 transition duration-75"
                fill="currentColor"
                viewBox="0 0 20 20"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  fillRule="evenodd"
                  d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                  clipRule="evenodd"
                ></path>
              </svg>
              <span className="ml-3">Profile</span>
            </Link>
          </li>
        </ul>
      </div>
    </aside>
  );
};

export default Sidebar;