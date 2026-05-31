

const nextConfig = {
  output: "export",
  trailingSlash: true,
  reactStrictMode: true,
  // Required for wagmi / RainbowKit — they use browser-only APIs
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };
    return config;
  },
};

export default nextConfig;
