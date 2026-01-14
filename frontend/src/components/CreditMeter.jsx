import React from 'react';

const CreditMeter = ({ credits, maxCredits, className = '' }) => {
  const percentage = Math.min((credits / maxCredits) * 100, 100);
  
  const getColorClass = () => {
    if (percentage >= 70) return 'bg-green-500';
    if (percentage >= 30) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getTextColorClass = () => {
    if (percentage >= 70) return 'text-green-600';
    if (percentage >= 30) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className={`bg-white rounded-lg shadow p-4 ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-700">Credits</span>
        <span className={`text-sm font-bold ${getTextColorClass()}`}>
          {credits.toLocaleString()} / {maxCredits.toLocaleString()}
        </span>
      </div>
      
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all duration-300 ${getColorClass()}`}
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
      
      <div className="mt-2 text-xs text-gray-500">
        {percentage < 20 && (
          <span className="text-red-600 font-medium">⚠️ Low credits remaining</span>
        )}
        {percentage >= 20 && percentage < 50 && (
          <span className="text-yellow-600">Consider upgrading your plan</span>
        )}
        {percentage >= 50 && (
          <span className="text-green-600">Good credit balance</span>
        )}
      </div>
    </div>
  );
};

export default CreditMeter;