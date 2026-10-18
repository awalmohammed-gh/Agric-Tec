import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactCompiler: true, // stable in Next.js 16: automatic memoization
  // No webpack config: Turbopack is the default bundler.
  // Tailwind v4 is compiled by its Turbopack loader (this project has no PostCSS config).
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
};

export default nextConfig;
