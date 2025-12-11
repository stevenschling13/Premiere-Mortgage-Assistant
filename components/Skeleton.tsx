import React from 'react';

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = '', ...props }) => {
  return (
    <div 
      className={`animate-pulse bg-gray-200 rounded ${className}`} 
      {...props}
    />
  );
};