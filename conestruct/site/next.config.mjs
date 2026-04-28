/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      { source: "/try", destination: "/sandbox", permanent: true },
    ];
  },
};

export default nextConfig;
