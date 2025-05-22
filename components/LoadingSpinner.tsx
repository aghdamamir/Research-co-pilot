
import React from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ size = 'md', text }) => {
  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  return (
    <div className="flex flex-col items-center justify-center my-4">
      <div
        className={`animate-spin rounded-full border-4 border-primary-500 border-t-transparent ${sizeClasses[size]}`}
      ></div>
      {text && <p className="mt-2 text-sm text-secondary-600">{text}</p>}
    </div>
  );
};

export default LoadingSpinner;
