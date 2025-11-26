/**
 * @ai-file component
 * @ai-description Cache status indicator with sync status and manual refresh
 * @ai-dependencies React, IndexedDB utilities
 * @ai-features
 * - Smart date formatting (shows "Today at HH:MM", "Yesterday at HH:MM", or full date)
 * - Color-coded status dots (green=complete, yellow=partial, blue=refreshing)
 * - Manual refresh button with disabled state during refresh
 * - Event-driven updates (listens for 'mb-data-updated' events)
 * - React.memo optimization with 2-second refresh cooldown
 */

import React, { useState, useEffect, useCallback } from 'react';
import { getCacheStatus, CacheStatus } from '@/utils/db';

interface CacheStatusIndicatorProps {
  onRefresh: () => void;
  className?: string;
}

const CacheStatusIndicator: React.FC<CacheStatusIndicatorProps> = React.memo(({ 
  onRefresh,
  className = ''
}) => {
  const [cacheStatus, setCacheStatus] = useState<CacheStatus>({
    lastUpdated: null,
    itemCount: 0,
    isComplete: false,
    collectionId: null
  });
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Format date for display
  const formatDate = (date: Date | null): string => {
    if (!date) return 'Never';
    
    // If it's today, show time only
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dateObj = new Date(date);
    
    if (dateObj >= today) {
      return `Today at ${dateObj.toLocaleTimeString(undefined, { 
        hour: '2-digit', 
        minute: '2-digit'
      })}`;
    }
    
    // If it's yesterday
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (dateObj >= yesterday) {
      return `Yesterday at ${dateObj.toLocaleTimeString(undefined, { 
        hour: '2-digit', 
        minute: '2-digit'
      })}`;
    }
    
    // Otherwise show full date
    return dateObj.toLocaleDateString(undefined, { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Update cache status
  const updateCacheStatus = useCallback(async () => {
    try {
      const status = await getCacheStatus();
      setCacheStatus(status);
    } catch (error) {
      console.error('Failed to get cache status:', error);
    }
  }, []);

  // Handle refresh button click
  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    onRefresh();
    
    // Reset refreshing state after a delay
    setTimeout(() => {
      setIsRefreshing(false);
      updateCacheStatus();
    }, 2000);
  }, [onRefresh, updateCacheStatus]);

  // Listen for data update events
  useEffect(() => {
    const handleDataUpdated = () => {
      updateCacheStatus();
      setIsRefreshing(false);
    };
    
    window.addEventListener('mb-data-updated', handleDataUpdated);
    
    return () => {
      window.removeEventListener('mb-data-updated', handleDataUpdated);
    };
  }, [updateCacheStatus]);

  // Initial load
  useEffect(() => {
    updateCacheStatus();
  }, [updateCacheStatus]);

  return (
    <div className={`flex items-center text-xs text-gray-400 ${className}`}>
      <div className="flex items-center mr-2">
        <div className={`w-2 h-2 rounded-full mr-1 ${
          isRefreshing 
            ? 'bg-blue-500 animate-pulse' 
            : cacheStatus.isComplete 
              ? 'bg-green-500' 
              : 'bg-yellow-500'
        }`} />
        <span>
          {isRefreshing
            ? 'Refreshing...'
            : cacheStatus.lastUpdated
              ? `Updated ${formatDate(cacheStatus.lastUpdated)}`
              : 'Never synced'
          }
        </span>
      </div>
      <button
        onClick={handleRefresh}
        disabled={isRefreshing}
        className="text-violet-400 hover:text-violet-300 disabled:text-gray-500 transition-colors p-1 rounded"
        title="Refresh collection data"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
        </svg>
      </button>
    </div>
  );
});

CacheStatusIndicator.displayName = 'CacheStatusIndicator';

export default CacheStatusIndicator;
