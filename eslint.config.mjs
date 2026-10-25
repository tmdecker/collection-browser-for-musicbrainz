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
      // React Compiler rules from eslint-plugin-react-hooks 7 (all existing cases are fixed)
      'react-hooks/set-state-in-effect': 'error',
      'react-hooks/refs': 'error',
    },
  },
];

export default config;
