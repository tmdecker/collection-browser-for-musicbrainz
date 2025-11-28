/**
 * @ai-file component
 * @ai-description Collection browser panel for browsing MusicBrainz collections
 * @ai-dependencies React, MusicBrainzCollection type, react-icons/bi, mbid-validation
 * @ai-features
 * - Collapsible panel with manual collection ID/URL input (accessible to all users)
 * - Display user's collections when authenticated with load and view on MusicBrainz.org actions
 * - Visual indicator for currently loaded collection
 * - Real-time collection ID validation with loading and error states
 * - Close button with hover visibility
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { MusicBrainzCollection } from '@/types/auth';
import { BiLoaderAlt, BiError, BiCollection, BiLinkExternal, BiCheck, BiUserX, BiX, BiRefresh } from 'react-icons/bi';
import { validateCollectionId } from '@/utils/mbid-validation';

interface CollectionBrowsePanelProps {
  isOpen: boolean;
  onClose: () => void;
  username: string | null;
  currentCollectionId: string;
  onLoadCollection: (collectionId: string, collectionName: string) => void;
  isAuthenticated: boolean;
  hasActiveFilters?: boolean;
  onLogin?: () => void;
  onRefreshCollection?: () => void;
}

export default function CollectionBrowsePanel({
  isOpen,
  onClose,
  username,
  currentCollectionId,
  onLoadCollection,
  isAuthenticated,
  hasActiveFilters = false,
  onLogin,
  onRefreshCollection,
}: CollectionBrowsePanelProps) {
  const [collections, setCollections] = useState<MusicBrainzCollection[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isHovered, setIsHovered] = useState(false);

  // Manual collection ID input state
  const [manualCollectionId, setManualCollectionId] = useState('');
  const [validationState, setValidationState] = useState<{
    status: 'idle' | 'validating' | 'valid' | 'error';
    message: string;
  }>({ status: 'idle', message: '' });
  const skipValidationRef = useRef(false);

  useEffect(() => {
    const fetchCollections = async () => {
      if (!isOpen || !username || !isAuthenticated) {
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const response = await fetch(
          `/api/musicbrainz/collections?username=${encodeURIComponent(username)}`
        );

        if (!response.ok) {
          throw new Error('Failed to fetch collections');
        }

        const data = await response.json();
        setCollections(data.collections);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
        console.error('❌ Failed to fetch collections:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchCollections();
  }, [isOpen, username, isAuthenticated]);

  // Handle loading collection
  const handleLoadCollection = (collection: MusicBrainzCollection) => {
    onLoadCollection(collection.id, collection.name);
    // Delay close to ensure state updates propagate
    setTimeout(() => {
      onClose();
    }, 100);
  };

  // Handle viewing collection on MusicBrainz
  const handleViewCollection = (collectionId: string) => {
    window.open(`https://musicbrainz.org/collection/${collectionId}`, '_blank');
  };

  // Debounced validation function for manual input
  const validateManualCollection = useCallback(async (input: string) => {
    if (!input.trim()) {
      setValidationState({ status: 'idle', message: '' });
      return;
    }

    setValidationState({ status: 'validating', message: 'Validating...' });

    const result = await validateCollectionId(input);

    if (result.valid && result.mbid) {
      setValidationState({ status: 'valid', message: result.message });

      // Auto-update the input field with the extracted MBID if user entered a URL
      if (result.mbid !== input.trim()) {
        skipValidationRef.current = true; // Skip validation on the next update
        setManualCollectionId(result.mbid);
      }

      // Auto-clear success toast after 3 seconds (but keep the valid state)
      setTimeout(() => {
        setValidationState(prev => prev.status === 'valid' ? { ...prev, message: '' } : prev);
      }, 3000);
    } else {
      setValidationState({ status: 'error', message: result.message });

      // Auto-clear error message after 5 seconds
      setTimeout(() => {
        setValidationState(prev => prev.status === 'error' ? { status: 'idle', message: '' } : prev);
      }, 5000);
    }
  }, []);

  // Debounce timer for manual input validation
  useEffect(() => {
    // Skip validation if we're just updating with extracted MBID
    if (skipValidationRef.current) {
      skipValidationRef.current = false;
      return;
    }

    const timer = setTimeout(() => {
      validateManualCollection(manualCollectionId);
    }, 800); // Wait 800ms after user stops typing

    return () => clearTimeout(timer);
  }, [manualCollectionId, validateManualCollection]);

  // Handle loading manual collection
  const handleLoadManualCollection = () => {
    if (validationState.status === 'valid' && manualCollectionId.trim()) {
      onLoadCollection(manualCollectionId.trim(), 'Manual Collection');
      setManualCollectionId('');
      setValidationState({ status: 'idle', message: '' });
      // Delay close to ensure state updates propagate
      setTimeout(() => {
        onClose();
      }, 100);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Validation Toast Notification - Only show for valid/error, not validating */}
      {validationState.message && validationState.status !== 'idle' && validationState.status !== 'validating' && (
        <div className="fixed top-4 right-4 z-50 animate-fade-in">
          <div className={`px-4 py-3 rounded-lg shadow-lg backdrop-blur-md border ${
            validationState.status === 'valid'
              ? 'bg-green-900/90 text-green-100 border-green-500/30'
              : 'bg-red-900/90 text-red-100 border-red-500/30'
          }`}>
            <div className="flex items-center space-x-2">
              {validationState.status === 'valid' && (
                <BiCheck className="flex-shrink-0" size={20} />
              )}
              {validationState.status === 'error' && (
                <BiError className="flex-shrink-0" size={20} />
              )}
              <span className="text-sm font-medium">{validationState.message}</span>
            </div>
          </div>
        </div>
      )}

      <div
        className="fixed z-15 px-2 sm:px-3 pt-3 md:pt-0 pointer-events-none left-0 right-0"
        style={{
          top: hasActiveFilters ? 'calc(var(--header-height, 64px) + var(--active-filters-height, 0px))' : 'var(--header-height, 64px)',
        }}
      >
      {/* Floating close button - positioned relative to sticky container */}
      <button
        onClick={onClose}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`absolute right-6 sm:right-6 top-[30px] md:top-3 z-30 p-1.5 rounded-full bg-background-tertiary/90 text-text-secondary transition-all shadow-lg backdrop-blur-sm lg:opacity-0 lg:pointer-events-none hover:bg-background hover:text-text-primary hover:scale-110 ${isHovered ? 'lg:!opacity-100 lg:!pointer-events-auto' : ''}`}
        aria-label="Close collections browser"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>

      <div
        className="max-h-[calc(100vh-var(--header-height)-2rem)] overflow-y-auto rounded-3xl border border-white/10 pointer-events-auto"
        role="region"
        aria-label="Collections browser panel"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          background: 'linear-gradient(180deg, rgba(26,26,26,0.98) 0%, rgba(26,26,26,0.95) 100%)',
          backdropFilter: 'blur(8px) saturate(1.2)',
          boxShadow: '0 1px 3px rgba(18,18,18,0.12), 0 1px 2px rgba(18,18,18,0.24)'
        }}
      >
        <div className="px-4 sm:px-6 pt-6 md:pt-[50px] pb-6 md:pb-[50px]">

          {/* Manual Collection Input - Available to all users */}
          <div className="mb-8">
            <div className="max-w-[1200px] mx-auto">
              <h2 className="text-xl font-bold text-text-primary mb-4">
                Browse Collection
              </h2>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={manualCollectionId}
                    onChange={(e) => setManualCollectionId(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && validationState.status === 'valid') {
                        handleLoadManualCollection();
                      }
                    }}
                    placeholder="Enter collection ID or URL"
                    className="w-full px-3 py-2 pr-10 bg-[#2A2A2A] text-text-primary text-sm rounded-lg border border-white/10 focus:border-primary focus:outline-none placeholder:text-white/40"
                  />

                  {/* Clear button */}
                  {manualCollectionId && (
                    <button
                      onClick={() => {
                        skipValidationRef.current = false;
                        setManualCollectionId('');
                        setValidationState({ status: 'idle', message: '' });
                      }}
                      className="absolute right-10 top-1/2 -translate-y-1/2 p-1 transition-colors group"
                      aria-label="Clear input"
                    >
                      <BiX className="w-5 h-5 text-white/60 group-hover:text-white/90 transition-colors" />
                    </button>
                  )}

                  {/* Validation Icon */}
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {validationState.status === 'validating' && (
                      <BiLoaderAlt className="w-4 h-4 text-white/40 animate-spin" />
                    )}
                    {validationState.status === 'valid' && (
                      <BiCheck className="w-5 h-5 text-green-500" />
                    )}
                    {validationState.status === 'error' && (
                      <BiError className="w-5 h-5 text-red-500" />
                    )}
                  </div>
                </div>

                {/* Load Button */}
                {validationState.status === 'valid' && (
                  <button
                    onClick={handleLoadManualCollection}
                    className="px-6 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-dark transition-colors flex-shrink-0"
                  >
                    Load
                  </button>
                )}

                {/* Refresh Button - show when current collection is manual (not in user's collections) */}
                {currentCollectionId &&
                 onRefreshCollection &&
                 !collections.some(c => c.id === currentCollectionId) && (
                  <button
                    onClick={onRefreshCollection}
                    className="p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-white/5 transition-colors flex-shrink-0"
                    title="Refresh collection"
                  >
                    <BiRefresh size={20} />
                  </button>
                )}
              </div>
              <p className="mt-2 text-xs text-text-tertiary">
                Enter a MusicBrainz collection ID or URL to browse public collections
                {!isAuthenticated && ' (login to access your private collections)'}
              </p>
            </div>
          </div>

          {/* Not authenticated state - Login prompt for user collections */}
          {!isAuthenticated && (
            <div className="text-center py-8 border-t border-white/5">
              <BiUserX className="w-12 h-12 text-white/40 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-text-primary mb-2">
                View Your Collections
              </h3>
              <p className="text-text-secondary mb-4">
                Log in with your MusicBrainz account to see your personal collections
              </p>
              {onLogin && (
                <button
                  onClick={onLogin}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-dark transition-colors"
                >
                  Login with MusicBrainz
                  <BiLinkExternal size={14} />
                </button>
              )}
            </div>
          )}

          {/* Loading state */}
          {isAuthenticated && loading && (
            <div className="py-12">
              <div className="flex items-center justify-center gap-3 text-text-secondary">
                <BiLoaderAlt className="w-6 h-6 animate-spin" />
                <span className="text-lg">Loading your collections...</span>
              </div>
            </div>
          )}

          {/* Error state */}
          {isAuthenticated && !loading && error && (
            <div className="py-12">
              <div className="flex flex-col items-center gap-3">
                <BiError className="w-12 h-12 text-red-500" />
                <div className="text-center">
                  <p className="font-semibold text-red-500 mb-1">Failed to load collections</p>
                  <p className="text-sm text-text-tertiary">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Empty state */}
          {isAuthenticated && !loading && !error && collections.length === 0 && (
            <div className="text-center py-12">
              <BiCollection className="w-16 h-16 text-white/40 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-text-primary mb-2">
                No Collections Found
              </h3>
              <p className="text-text-secondary mb-6">
                You don't have any release-group collections yet.
                <br />
                Create one on MusicBrainz.org to get started.
              </p>
              <button
                onClick={() => window.open('https://musicbrainz.org/collections', '_blank')}
                className="px-6 py-3 bg-primary text-white rounded-full hover:bg-primary-dark transition-colors inline-flex items-center gap-2"
              >
                <span>Create Collection</span>
                <BiLinkExternal size={16} />
              </button>
            </div>
          )}

          {/* Collections List */}
          {isAuthenticated && !loading && !error && collections.length > 0 && (() => {
            // Group collections by ownership
            const myCollections = collections.filter(c => c.editor === username);
            const collaborativeCollections = collections.filter(c => c.editor !== username);

            // Render collection card helper
            const renderCollectionCard = (collection: MusicBrainzCollection, index: number, totalInGroup: number) => {
              const isCurrentCollection = collection.id === currentCollectionId;

              return (
                <div
                  key={collection.id}
                  className={`transition-colors ${
                    isCurrentCollection
                      ? 'cursor-default'
                      : 'cursor-pointer hover:bg-white/[0.02]'
                  } ${
                    index !== totalInGroup - 1 ? 'border-b border-white/5' : ''
                  }`}
                  onClick={() => !isCurrentCollection && handleLoadCollection(collection)}
                >
                  <div className="px-4 sm:px-6 py-5">
                    {/* Content constrained in center for larger screens */}
                    <div className="max-w-[1200px] mx-auto flex items-center justify-between gap-6">

                      {/* Left: Collection Info */}
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-1">
                            <h3 className="text-base font-semibold text-text-primary truncate">
                              {collection.name}
                            </h3>
                            {isCurrentCollection && (
                              <>
                                <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-primary/20 text-primary text-xs font-medium flex-shrink-0">
                                  <BiCheck size={14} />
                                  <span>Current</span>
                                </div>
                                {onRefreshCollection && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onRefreshCollection();
                                    }}
                                    className="p-1 rounded text-text-secondary hover:text-text-primary transition-colors"
                                    title="Refresh collection"
                                  >
                                    <BiRefresh size={16} />
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                          <p className="text-sm text-text-tertiary">
                            {collection.editor}
                            {collection['release-group-count'] !== undefined && (
                              <>
                                <span className="mx-2">•</span>
                                {collection['release-group-count']} albums
                              </>
                            )}
                          </p>
                        </div>
                      </div>

                      {/* Right: View on MusicBrainz Button */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewCollection(collection.id);
                          }}
                          className="px-4 py-2 rounded-lg text-sm font-medium bg-[#2A2A2A] text-white/90 hover:bg-[#333333] hover:text-white transition-colors inline-flex items-center gap-2"
                        >
                          <span>View on MusicBrainz.org</span>
                          <BiLinkExternal size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            };

            return (
              <div className="space-y-8">
                {/* My Collections Section */}
                {myCollections.length > 0 && (
                  <div>
                    <div className="mb-4">
                      <h2 className="max-w-[1200px] mx-auto text-xl font-bold text-text-primary">
                        My Collections
                      </h2>
                    </div>

                    {/* Release Group Collections Subheading */}
                    <div>
                      <div className="mb-3">
                        <h3 className="max-w-[1200px] mx-auto text-sm font-semibold text-text-secondary uppercase tracking-wide">
                          Release Group Collections
                        </h3>
                      </div>
                      <div className="space-y-0 -mx-4 sm:-mx-6">
                        {myCollections.map((collection, index) =>
                          renderCollectionCard(collection, index, myCollections.length)
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Collaborative Collections Section */}
                {collaborativeCollections.length > 0 && (
                  <div>
                    <div className="mb-4">
                      <h2 className="max-w-[1200px] mx-auto text-xl font-bold text-text-primary">
                        Collaborative Collections
                      </h2>
                    </div>

                    {/* Release Group Collections Subheading */}
                    <div>
                      <div className="mb-3">
                        <h3 className="max-w-[1200px] mx-auto text-sm font-semibold text-text-secondary uppercase tracking-wide">
                          Release Group Collections
                        </h3>
                      </div>
                      <div className="space-y-0 -mx-4 sm:-mx-6">
                        {collaborativeCollections.map((collection, index) =>
                          renderCollectionCard(collection, index, collaborativeCollections.length)
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

        </div>
      </div>
      </div>
    </>
  );
}
