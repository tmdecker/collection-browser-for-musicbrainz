/**
 * @ai-file component
 * @ai-description Account button at the right end of the header: the user's initial, or a person icon when logged out, with a small menu
 * @ai-dependencies React, Next.js Link, useAuth, react-icons
 * @ai-features
 * - Logged in: round button with the MusicBrainz name's initial; menu with the name, a profile link, Settings and Log out
 * - Logged out: round grey person icon; menu with "Log in with MusicBrainz" and Settings (so Settings is reachable without an account)
 * - Menu closes on outside click and Escape; it is positioned against the enclosing header
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { BiCog, BiLinkExternal, BiLogOut, BiUser } from 'react-icons/bi';
import { useAuth } from '@/hooks/useAuth';

export default function UserAvatarButton({ className = '' }: { className?: string }) {
  const { authState, isAuthenticated, user, login, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Keep the space while the session is being checked, so the header doesn't jump
  if (authState.status === 'authenticating' && !isAuthenticated) {
    return <span className={`w-10 h-10 md:w-[42px] md:h-[42px] flex-shrink-0 ${className}`} aria-hidden="true" />;
  }

  const loggedIn = isAuthenticated && !!user;
  const itemClass = 'w-full flex items-center gap-2 px-3 py-2.5 rounded-2xl text-left text-text-secondary hover:text-white hover:bg-white/10 transition-colors';
  const settingsLink = (
    <Link href="/config" onClick={() => setOpen(false)} className={itemClass}>
      <BiCog size={16} />
      Settings
    </Link>
  );

  return (
    <div ref={wrapRef} className={`flex-shrink-0 ${className}`}>
      {loggedIn ? (
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="w-10 h-10 md:w-[42px] md:h-[42px] grid place-items-center rounded-full bg-primary-dark hover:bg-primary text-white text-[15px] font-semibold transition-colors"
          title={user.name}
          aria-label={`Account: ${user.name}`}
          aria-expanded={open}
          aria-haspopup="true"
        >
          {(user.name.trim().charAt(0) || '?').toUpperCase()}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="w-10 h-10 md:w-[42px] md:h-[42px] grid place-items-center rounded-full bg-background-control hover:bg-white/20 text-white/75 hover:text-white border border-white/15 hover:border-white/35 transition-colors"
          title="Log in and settings"
          aria-label="Log in and settings"
          aria-expanded={open}
          aria-haspopup="true"
        >
          <BiUser className="w-5 h-5 md:w-[22px] md:h-[22px]" />
        </button>
      )}
      {open && (
        <div className="absolute right-3 md:right-8 top-full mt-2 w-64 rounded-3xl bg-background-secondary border border-white/10 overflow-hidden shadow-lg z-50 animate-fade-in p-2">
          {loggedIn ? (
            <>
              <div className="px-3 pt-2 pb-3 mb-1 border-b border-white/10">
                <div className="font-semibold text-white truncate">{user.name}</div>
                <div className="text-xs text-text-tertiary">Logged in with MusicBrainz</div>
              </div>
              <a
                href={`https://musicbrainz.org/user/${encodeURIComponent(user.name)}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setOpen(false)}
                className={itemClass}
              >
                Your MusicBrainz profile
                <BiLinkExternal size={13} />
              </a>
              {settingsLink}
              <div className="my-1 border-t border-white/10" />
              <button type="button" onClick={() => { setOpen(false); logout(); }} className={itemClass}>
                <BiLogOut size={16} />
                Log out
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => { setOpen(false); login(); }}
                className="w-full mb-1 px-3 py-2.5 rounded-2xl bg-primary-dark hover:bg-primary text-white text-sm font-medium transition-colors"
              >
                Log in with MusicBrainz
              </button>
              {settingsLink}
            </>
          )}
        </div>
      )}
    </div>
  );
}
