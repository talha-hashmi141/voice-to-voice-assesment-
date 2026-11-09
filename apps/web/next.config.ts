import { config as loadEnv } from 'dotenv';
import type { NextConfig } from 'next';
import { resolve } from 'node:path';

// The monorepo keeps a single .env at the root; Next only reads env files from its own directory.
loadEnv({ path: resolve(__dirname, '..', '..', '.env'), quiet: true });

const nextConfig: NextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000',
  },
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
