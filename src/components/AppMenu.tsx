/**
 * @ai-file component
 * @ai-description App menu (round button + dropdown) shared by the collection header and the Collections page
 * @ai-dependencies React, Next.js Link and navigation, useAuth, Toast
 * @ai-features
 * - Login/logout with the MusicBrainz account, Collections, Settings
 * - Optional "Reload from MusicBrainz" for the collection on screen
 * - On phones, the current collection name as the first item and a link back to the series
 *   collection a series was opened from (the header hides the breadcrumb there)
 * - Shows the login/logout result after the OAuth redirect and clears its query parameters
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { BiArrowBack, BiCollection, BiCog, BiMenu, BiX, BiUserX, BiUserCheck, BiLogOut, BiLinkExternal, BiRefresh } from 'react-icons/bi';
import Toast from './Toast';
import { useAuth } from '@/hooks/useAuth';

interface AppMenuProps {
  // Current collection or series name, shown as the first item on phones
  currentName?: string;
  onCurrentNameClick?: () => void;
  // Reload the collection on screen from MusicBrainz
  onReloadCollection?: () => void;
  isReloadingCollection?: boolean;
  // Series collection a series was opened from: a link back to it on phones
  parentLink?: { href: string; name: string };
}

export default function AppMenu({ currentName, onCurrentNameClick, onReloadCollection, isReloadingCollection = false, parentLink }: AppMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [authMessage, setAuthMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, user, login, logout: authLogout } = useAuth();

  // Wrap logout to show success message
  const logout = async () => {
    await authLogout();
    setAuthMessage({ type: 'success', text: 'Successfully logged out!' });
    setTimeout(() => setAuthMessage(null), 3000);
  };

  // Check for auth success/error from OAuth callback
  useEffect(() => {
    const authSuccess = searchParams.get('auth_success');
    const authError = searchParams.get('auth_error');

    // Only process if we have query params (prevents running after router.replace clears them)
    if (!authSuccess && !authError) return;

    if (authSuccess === 'true' && user) {
      // Only show message once user info is available
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAuthMessage({ type: 'success', text: `Successfully logged in as ${user.name}!` });
      router.replace(pathname);
      setTimeout(() => setAuthMessage(null), 3000);
    } else if (authError) {
      setAuthMessage({ type: 'error', text: `Login failed: ${authError}` });
      router.replace(pathname);
      setTimeout(() => setAuthMessage(null), 5000);
    }
  }, [searchParams, router, pathname, user]);

  // Close menu when clicking outside or pressing Escape
  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false);
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [menuOpen]);

  const itemClass = 'w-full flex items-center space-x-3 px-4 py-3 hover:bg-white/10 transition-colors text-left border-b border-white/10';

  return (
    <>
      {authMessage && (
        <Toast
          type={authMessage.type}
          message={authMessage.text}
          icon={authMessage.type === 'success'
            ? <BiUserCheck className="flex-shrink-0" size={20} />
            : <BiUserX className="flex-shrink-0" size={20} />}
        />
      )}

      <button
        onClick={() => setMenuOpen(!menuOpen)}
        className="p-2 rounded-full bg-background-control hover:bg-white/20 text-white/75 hover:text-white transition-colors border border-white/15 hover:border-white/35 flex-shrink-0"
        title="Menu"
        aria-label="Menu"
        aria-expanded={menuOpen}
        aria-haspopup="true"
      >
        {menuOpen ? <BiX className="w-5 h-5 md:w-6 md:h-6" /> : <BiMenu className="w-5 h-5 md:w-6 md:h-6" />}
      </button>

      {/* Dropdown, positioned against the enclosing header */}
      {menuOpen && (
        <div ref={menuRef} className="absolute left-3 md:left-6 top-full mt-2 w-[calc(100%-1.5rem)] md:w-80 rounded-3xl bg-background-secondary border border-white/10 overflow-hidden shadow-lg z-50 animate-fade-in">
          {/* Current collection name - only on phones, where the header doesn't show it */}
          {currentName && onCurrentNameClick && (
            <button
              onClick={() => {
                onCurrentNameClick();
                setMenuOpen(false);
              }}
              className={`md:hidden ${itemClass}`}
            >
              <BiCollection className="text-white/70 flex-shrink-0" size={20} />
              <span className="text-white font-medium truncate">{currentName}</span>
            </button>
          )}

          {/* Back to the series collection - only on phones, desktop has the breadcrumb */}
          {parentLink && (
            <Link href={parentLink.href} onClick={() => setMenuOpen(false)} className={`md:hidden ${itemClass}`}>
              <BiArrowBack className="text-white/70 flex-shrink-0" size={20} />
              <span className="text-white font-medium truncate">{parentLink.name}</span>
            </Link>
          )}

          {/* Authentication Section */}
          {isAuthenticated && user ? (
            <div className="w-full flex items-center justify-between px-4 py-3 border-b border-white/10">
              <div className="flex items-center space-x-3 min-w-0">
                <BiUserCheck className="text-primary flex-shrink-0" size={20} />
                <a
                  href={`https://musicbrainz.org/user/${user.name}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setMenuOpen(false)}
                  className="text-white font-medium hover:text-primary transition-colors inline-flex items-center gap-1 truncate"
                >
                  <span className="truncate">{user.name}</span>
                  <BiLinkExternal className="flex-shrink-0" size={12} />
                </a>
              </div>
              <button
                onClick={() => {
                  logout();
                  setMenuOpen(false);
                }}
                className="flex items-center space-x-1 text-white/70 hover:text-white transition-colors flex-shrink-0 ml-2"
              >
                <BiLogOut className="flex-shrink-0" size={16} />
                <span>Logout</span>
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                login();
                setMenuOpen(false);
              }}
              className={itemClass}
            >
              <BiUserX className="text-white/70 flex-shrink-0" size={20} />
              <span className="text-white font-medium inline-flex items-center gap-1">
                Login with MusicBrainz.org
                <BiLinkExternal className="flex-shrink-0" size={12} />
              </span>
            </button>
          )}

          <Link href="/collections" onClick={() => setMenuOpen(false)} className={itemClass}>
            <BiCollection className="text-white/70 flex-shrink-0" size={20} />
            <span className="text-white font-medium">Collections</span>
          </Link>

          {onReloadCollection && (
            <button
              onClick={() => {
                onReloadCollection();
                setMenuOpen(false);
              }}
              disabled={isReloadingCollection}
              className={`${itemClass} disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <BiRefresh className={`text-white/70 flex-shrink-0 ${isReloadingCollection ? 'animate-spin' : ''}`} size={20} />
              <span className="text-white font-medium">Reload from MusicBrainz</span>
            </button>
          )}

          <Link
            href="/config"
            onClick={() => setMenuOpen(false)}
            className="w-full flex items-center space-x-3 px-4 py-3 hover:bg-white/10 transition-colors"
          >
            <BiCog className="text-white/70 flex-shrink-0" size={20} />
            <span className="text-white font-medium">Settings</span>
          </Link>
        </div>
      )}
    </>
  );
}
