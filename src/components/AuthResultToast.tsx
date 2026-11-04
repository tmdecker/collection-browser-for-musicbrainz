/**
 * @ai-file component
 * @ai-description Shows the login result after the MusicBrainz OAuth redirect and clears its query parameters
 * @ai-dependencies React, Next.js navigation, useAuth, Toast
 * @ai-features
 * - "Logged in as …" once the user is known, or the login error
 * - Drops only auth_success/auth_error from the address and keeps the page's own query
 * - Wrapped in its own Suspense boundary (useSearchParams), so any page can mount it
 */

'use client';

import { Suspense, useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { BiUserCheck, BiUserX } from 'react-icons/bi';
import Toast from './Toast';
import { useAuth } from '@/hooks/useAuth';

function AuthResult() {
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();

  useEffect(() => {
    const withoutAuthParams = () => {
      const params = new URLSearchParams(searchParams.toString());
      params.delete('auth_success');
      params.delete('auth_error');
      const query = params.toString();
      return query ? `${pathname}?${query}` : pathname;
    };

    const authSuccess = searchParams.get('auth_success');
    const authError = searchParams.get('auth_error');
    // Nothing to do once router.replace has cleared them
    if (!authSuccess && !authError) return;

    if (authSuccess === 'true' && user) {
      // Only once the user's name is known
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMessage({ type: 'success', text: `Successfully logged in as ${user.name}!` });
      router.replace(withoutAuthParams());
      setTimeout(() => setMessage(null), 3000);
    } else if (authError) {
      setMessage({ type: 'error', text: `Login failed: ${authError}` });
      router.replace(withoutAuthParams());
      setTimeout(() => setMessage(null), 5000);
    }
  }, [searchParams, router, pathname, user]);

  if (!message) return null;
  return (
    <Toast
      type={message.type}
      message={message.text}
      icon={message.type === 'success'
        ? <BiUserCheck className="flex-shrink-0" size={20} />
        : <BiUserX className="flex-shrink-0" size={20} />}
    />
  );
}

export default function AuthResultToast() {
  return (
    <Suspense fallback={null}>
      <AuthResult />
    </Suspense>
  );
}
