@type {import('next').NextConfig}
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/api/proxy",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Origin, X-Requested-With, Content-Type, Accept" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
