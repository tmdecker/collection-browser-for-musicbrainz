'use client';

import type { ReactNode } from 'react';
import { PreferencesProvider } from '@/hooks/usePreferences';
import { AuthProvider } from '@/hooks/useAuth';

/**
 * Client-side app state shared by all pages (one instance each)
 */
export default function Providers({ children }: { children: ReactNode }) {
  return (
    <PreferencesProvider>
      <AuthProvider>{children}</AuthProvider>
    </PreferencesProvider>
  );
}
