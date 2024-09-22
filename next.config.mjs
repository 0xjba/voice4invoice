/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    webpack: (config, { isServer }) => {
      if (!isServer) {
        config.resolve.fallback = {
          ...config.resolve.fallback,
          crypto: 'crypto-browserify',
          stream: 'stream-browserify'
        };
      }
      return config;
    },
  };
  
  export default nextConfig;