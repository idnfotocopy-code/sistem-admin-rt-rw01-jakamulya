/** @type {import('next').NextConfig} */
module.exports = {
  eslint: { ignoreDuringBuilds: true },
  experimental: {
    serverComponentsExternalPackages: ['better-sqlite3', 'pdfkit', 'bcryptjs'],
    serverActions: { bodySizeLimit: '5mb' },
  },
};
