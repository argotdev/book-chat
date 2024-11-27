/** @type {import('next').NextConfig} */
const nextConfig = {
    experimental: {
        serverActions: {
          bodySizeLimit: '8mb'
        },
        responseLimit: '10mb',
    }
};

export default nextConfig;
