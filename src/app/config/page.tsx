'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePreferences } from '@/hooks/usePreferences';
import { useAuth } from '@/hooks/useAuth';
import { StreamingServicePreferences } from '@/types/preferences';
import { BiInfoCircle } from 'react-icons/bi';

export default function ConfigPage() {
  const router = useRouter();

  // Get preferences from centralized hook
  const {
    preferences,
    updateDisplay,
    updateStreaming,
    updateApi,
    updateMetadata,
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

  // Local state for form inputs (for immediate feedback before saving)
  const [formData, setFormData] = useState(preferences.api);

  // Update form data when preferences change
  useEffect(() => {
    setFormData(preferences.api);
  }, [preferences.api]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target as HTMLInputElement;

    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Update preferences through the hook
    updateApi(formData);

    // Redirect to home page
    router.push('/');
  };

  return (
    <main className="min-h-screen p-6 bg-background">
      <h1 className="text-2xl font-bold mb-6 text-text-primary">Configuration Settings</h1>

      <form onSubmit={handleSubmit} className="max-w-2xl">
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
          
          <div className="flex items-center space-x-4 pt-4">
            <button
              type="submit"
              className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark"
            >
              Save Configuration
            </button>
            
            <button
              type="button"
              onClick={() => router.push('/')}
              className="px-4 py-2 bg-background-tertiary text-text-primary rounded-md hover:bg-background-secondary"
            >
              Cancel
            </button>
          </div>
        </div>
      </form>


      {/* Version Information */}
      <div className="mt-8 pt-6 border-t border-background-tertiary">
        <h2 className="text-lg font-medium text-text-primary mb-2">Version Information</h2>
        <div className="text-sm text-text-tertiary">
          <p>Music Library Viewer v{require('../../../package.json').version}</p>
        </div>
      </div>

      {/* Admin & Diagnostic Section (Development Mode Only) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-8 pt-6 border-t border-background-tertiary">
          <h2 className="text-xl font-bold mb-4 text-text-primary">Admin Section</h2>
          <p className="text-sm text-text-tertiary mb-4">
            Developer-only settings. This section is hidden in production.
          </p>

          <div className="space-y-6 max-w-2xl">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">
                User Agent
              </label>
              <input
                type="text"
                name="userAgent"
                value={formData.userAgent}
                onChange={handleChange}
                className="block w-full p-2 bg-background-secondary text-text-primary rounded-md"
              />
              <p className="mt-1 text-sm text-text-tertiary">
                MusicBrainz requires a User-Agent with contact information
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  name="useDirectApi"
                  checked={formData.useDirectApi}
                  onChange={handleChange}
                  className="h-4 w-4 text-primary focus:ring-primary"
                />
                <label className="ml-2 block text-sm text-text-secondary">
                  Try direct API access first (might help with CORS issues)
                </label>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  name="enableCaching"
                  checked={formData.enableCaching}
                  onChange={handleChange}
                  className="h-4 w-4 text-primary focus:ring-primary"
                />
                <label className="ml-2 block text-sm text-text-secondary">
                  Enable client-side caching (faster, but might show outdated data)
                </label>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  name="logErrors"
                  checked={formData.logErrors}
                  onChange={handleChange}
                  className="h-4 w-4 text-primary focus:ring-primary"
                />
                <label className="ml-2 block text-sm text-text-secondary">
                  Log detailed errors to console
                </label>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <h3 className="text-lg font-medium text-text-primary mb-3">Diagnostic Tools</h3>
            <div className="flex flex-wrap gap-2">
              <a
                href="/debug"
                className="px-4 py-2 bg-background-tertiary text-text-primary rounded-md hover:bg-background-secondary"
              >
                Basic Diagnostics
              </a>
              <a
                href="/debug/advanced"
                className="px-4 py-2 bg-background-tertiary text-text-primary rounded-md hover:bg-background-secondary"
              >
                Advanced API Testing
              </a>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
