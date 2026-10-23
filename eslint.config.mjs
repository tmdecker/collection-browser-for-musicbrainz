import { FlatCompat } from '@eslint/eslintrc';

// eslint-config-next 14 only ships a legacy config, so wrap it for flat config.
// After the Next 16 upgrade this can import eslint-config-next directly.
const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

const config = [
  {
    ignores: ['.next/**', 'node_modules/**', '.cache/**', '.image-cache/**', 'next-env.d.ts'],
  },
  ...compat.extends('next/core-web-vitals'),
  {
    rules: {
      // Hook dependency bugs (stale closures, timers set once) are the main thing lint should catch here
      'react-hooks/exhaustive-deps': 'error',
    },
  },
];

export default config;
