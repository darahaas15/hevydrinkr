import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export for production only — in dev the constraint blocks dynamic
  // routes that rely on vercel.json rewrites (profile, feed detail, etc.).
  ...(process.env.NODE_ENV === 'production' && { output: 'export' as const }),
};

export default nextConfig;
