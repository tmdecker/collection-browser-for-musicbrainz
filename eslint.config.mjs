import nextVitals from 'eslint-config-next/core-web-vitals';

const config = [
  {
    ignores: ['.next/**', 'node_modules/**', '.cache/**', '.image-cache/**', 'next-env.d.ts'],
  },
  ...nextVitals,
  {
    rules: {
      // Hook dependency bugs (stale closures, timers set once) are the main thing lint should catch here
      'react-hooks/exhaustive-deps': 'error',
      // New React Compiler rules in eslint-plugin-react-hooks 7: warn until the auth/preferences
      // refactor removes most of the setState-in-effect patterns, then switch back to error
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
    },
  },
];

export default config;
