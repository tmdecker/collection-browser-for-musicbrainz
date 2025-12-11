'use client';

import { useRouter } from 'next/navigation';
import { usePreferences } from '@/hooks/usePreferences';
import { useAuth } from '@/hooks/useAuth';
import { StreamingServicePreferences } from '@/types/preferences';
import { BiInfoCircle } from 'react-icons/bi';
import { useEffect, useState } from 'react';

interface CacheStatsResponse {
  timestamp: string;
  releaseGroups: {
    cached: number;
    hits: number;
    misses: number;
    hitRate: number;
    memoryMB: number;
  };
  releases: {
    cached: number;
    hits: number;
    misses: number;
    hitRate: number;
    memoryMB: number;
  };
  overall: {
    totalMemoryMB: number;
    combinedHitRate: number;
  };
  prefetch: {
    status: 'running' | 'idle';
    completed: number;
    total: number;
    percentage: number;
  };
  queue: {
    highPriority: number;
    lowPriority: number;
    processing: number;
  };
}

export default function ConfigPage() {
  const router = useRouter();

  // Get preferences from centralized hook
  const {
    preferences,
    updateStreaming,
    setUseGenresOnly,
    setEnableLabelFilter,
    setSpotifyUseDesktopApp,
    setTidalUseDesktopApp,
    setAppleMusicUseDesktopApp,
    setShowRatings,
    setRatingDisplayMode,
  } = usePreferences();

  // Get auth state
  const { isAuthenticated } = useAuth();

  // Cache stats state
  const [cacheStats, setCacheStats] = useState<CacheStatsResponse | null>(null);

  // Fetch cache stats
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('/api/cache/stats');
        if (response.ok) {
          const data = await response.json();
          setCacheStats(data);
        }
      } catch (error) {
        console.error('Failed to fetch cache stats:', error);
      }
    };

    // Initial fetch
    fetchStats();

    // Poll every 10 seconds only if prefetch is running
    const interval = setInterval(() => {
      if (cacheStats?.prefetch.status === 'running') {
        fetchStats();
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [cacheStats?.prefetch.status]);

  return (
    <main className="min-h-screen p-6 bg-background">
      <h1 className="text-2xl font-bold mb-6 text-text-primary">Configuration Settings</h1>

      <div className="max-w-2xl">
        <div className="space-y-6">
          {/* Display Settings */}
          <div>
            <h3 className="text-lg font-medium text-text-primary mb-2">Display Settings</h3>
            <div className="flex items-center">
              <input
                type="checkbox"
                checked={preferences.display.useGenresOnly}
                onChange={(e) => setUseGenresOnly(e.target.checked)}
                className="h-4 w-4 text-primary focus:ring-primary"
              />
              <label className="ml-2 block text-sm text-text-secondary">
                Show official genres only (recommended)
              </label>
            </div>
            <p className="mt-1 text-sm text-text-tertiary ml-6">
              When checked, only official MusicBrainz genre tags are shown in filters and album details.
              When unchecked, all user-submitted tags are shown as genres.
            </p>

            <div className="flex items-center mt-4">
              <input
                type="checkbox"
                checked={preferences.display.enableLabelFilter}
                onChange={(e) => setEnableLabelFilter(e.target.checked)}
                className="h-4 w-4 text-primary focus:ring-primary"
              />
              <label className="ml-2 block text-sm text-text-secondary">
                Enable label filter
              </label>
            </div>
            <p className="mt-1 text-sm text-text-tertiary ml-6">
              When checked, record label filtering is available in the filter panel.
              <strong className="text-text-secondary"> Note:</strong> This feature is currently in development
              and only works for albums where you&apos;ve viewed the release details.
            </p>
          </div>

          {/* Rating Display Settings */}
          <div>
            <h3 className="text-lg font-medium text-text-primary mb-2">
              Rating Display
            </h3>

            {/* Master toggle */}
            <div className="flex items-center">
              <input
                type="checkbox"
                checked={preferences.display.showRatings}
                onChange={(e) => setShowRatings(e.target.checked)}
                className="h-4 w-4 text-primary focus:ring-primary"
              />
              <label className="ml-2 block text-sm text-text-secondary">
                Show ratings on albums
              </label>
            </div>

            {/* Display mode selection */}
            {preferences.display.showRatings && (
              <div className="space-y-2 pl-8">
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="radio"
                    name="ratingMode"
                    value="average"
                    checked={preferences.display.ratingDisplayMode === 'average'}
                    onChange={() => setRatingDisplayMode('average')}
                    className="w-4 h-4 text-primary focus:ring-primary"
                  />
                  <div>
                    <span className="text-text-primary">Average community rating</span>
                    <p className="text-sm text-text-tertiary">
                      Shows the average rating from all MusicBrainz users
                    </p>
                  </div>
                </label>

                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="radio"
                    name="ratingMode"
                    value="personal"
                    checked={preferences.display.ratingDisplayMode === 'personal'}
                    onChange={() => setRatingDisplayMode('personal')}
                    className="w-4 h-4 text-primary focus:ring-primary"
                  />
                  <div>
                    <span className="text-text-primary">My personal rating</span>
                    <p className="text-sm text-text-tertiary">
                      Shows your own ratings (requires MusicBrainz authentication)
                    </p>
                  </div>
                </label>

                {/* Auth reminder for personal mode */}
                {preferences.display.ratingDisplayMode === 'personal' && !isAuthenticated && (
                  <div className="bg-background-tertiary border border-white/10 rounded-lg p-3 mt-2">
                    <p className="text-sm text-text-secondary">
                      <BiInfoCircle className="inline mr-1" />
                      Personal ratings require MusicBrainz authentication.
                      Please log in using the menu in the top-right corner.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Streaming Service Settings */}
          <div>
            <h3 className="text-lg font-medium text-text-primary mb-3">Streaming Services</h3>

            {/* Desktop App Settings */}
            <div className="mb-4 space-y-3">
              <div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={preferences.streaming.spotifyUseDesktopApp}
                    onChange={(e) => setSpotifyUseDesktopApp(e.target.checked)}
                    className="h-4 w-4 text-primary focus:ring-primary"
                  />
                  <label className="ml-2 block text-sm text-text-secondary">
                    Open Spotify links in desktop app
                  </label>
                </div>
                <p className="mt-1 text-sm text-text-tertiary ml-6">
                  When enabled, Spotify links will open in the desktop app instead of the web browser.
                </p>
              </div>

              <div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={preferences.streaming.tidalUseDesktopApp}
                    onChange={(e) => setTidalUseDesktopApp(e.target.checked)}
                    className="h-4 w-4 text-primary focus:ring-primary"
                  />
                  <label className="ml-2 block text-sm text-text-secondary">
                    Open Tidal links in desktop app
                  </label>
                </div>
                <p className="mt-1 text-sm text-text-tertiary ml-6">
                  When enabled, Tidal links will open in the desktop app instead of the web browser.
                </p>
              </div>

              <div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={preferences.streaming.appleMusicUseDesktopApp}
                    onChange={(e) => setAppleMusicUseDesktopApp(e.target.checked)}
                    className="h-4 w-4 text-primary focus:ring-primary"
                  />
                  <label className="ml-2 block text-sm text-text-secondary">
                    Open Apple Music links in desktop app
                  </label>
                </div>
                <p className="mt-1 text-sm text-text-tertiary ml-6">
                  When enabled, Apple Music links will open in the desktop app instead of the web browser.
                </p>
              </div>
            </div>

            {/* Enabled Services */}
            <div>
              <h4 className="text-md font-medium text-text-primary mb-2">Show These Services</h4>
              <p className="text-sm text-text-tertiary mb-3">
                Select which streaming services to display in album details. Disabled services won't show their icons.
              </p>

              <div className="grid grid-cols-2 gap-2">
                {Object.entries(preferences.streaming.enabledServices).map(([service, enabled]) => {
                  const serviceLabels: Record<string, string> = {
                    spotify: 'Spotify',
                    appleMusic: 'Apple Music',
                    youtube: 'YouTube',
                    youtubeMusic: 'YouTube Music',
                    amazon: 'Amazon',
                    amazonMusic: 'Amazon Music',
                    deezer: 'Deezer',
                    tidal: 'Tidal',
                    soundcloud: 'SoundCloud',
                    pandora: 'Pandora',
                  };

                  return (
                    <div key={service} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={enabled}
                        onChange={(e) => {
                          updateStreaming({
                            enabledServices: {
                              ...preferences.streaming.enabledServices,
                              [service]: e.target.checked,
                            },
                          });
                        }}
                        className="h-4 w-4 text-primary focus:ring-primary"
                      />
                      <label className="ml-2 block text-sm text-text-secondary">
                        {serviceLabels[service] || service}
                      </label>
                    </div>
                  );
                })}
              </div>

              {/* Select All/None Buttons */}
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const allEnabled = Object.keys(preferences.streaming.enabledServices).reduce(
                      (acc, service) => ({ ...acc, [service]: true }),
                      {} as StreamingServicePreferences
                    );
                    updateStreaming({ enabledServices: allEnabled });
                  }}
                  className="px-3 py-1 text-xs bg-background-tertiary text-text-secondary rounded hover:bg-background-secondary"
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const allDisabled = Object.keys(preferences.streaming.enabledServices).reduce(
                      (acc, service) => ({ ...acc, [service]: false }),
                      {} as StreamingServicePreferences
                    );
                    updateStreaming({ enabledServices: allDisabled });
                  }}
                  className="px-3 py-1 text-xs bg-background-tertiary text-text-secondary rounded hover:bg-background-secondary"
                >
                  Select None
                </button>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <div className="mt-6 pt-4 border-t border-background-tertiary">
            <button
              type="button"
              onClick={() => router.push('/')}
              className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark"
            >
              Done
            </button>
          </div>
        </div>
      </div>

      {/* Cache Status */}
      {cacheStats && (
        <div className="mt-8 pt-6 border-t border-background-tertiary">
          <h2 className="text-lg font-medium text-text-primary mb-2">Cache Status</h2>
          <div className="text-sm text-text-secondary space-y-1">
            <p>
              Release Groups: {cacheStats.releaseGroups.cached} cached (
              {Math.round(cacheStats.releaseGroups.hitRate * 100)}% hit rate)
            </p>
            <p>Releases: {cacheStats.releases.cached} cached</p>
            <p>Memory: {Math.round(cacheStats.overall.totalMemoryMB)} MB</p>
            {cacheStats.prefetch.total > 0 && (
              <p>
                Prefetch: {cacheStats.prefetch.percentage}% complete (
                {cacheStats.prefetch.completed}/{cacheStats.prefetch.total})
                {cacheStats.prefetch.status === 'running' && (
                  <span className="text-primary ml-1">• Running</span>
                )}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Version Information */}
      <div className="mt-8 pt-6 border-t border-background-tertiary">
        <h2 className="text-lg font-medium text-text-primary mb-2">Version Information</h2>
        <div className="text-sm text-text-tertiary">
          <p>Music Library Viewer v{require('../../../package.json').version}</p>
        </div>
      </div>
    </main>
  );
}
