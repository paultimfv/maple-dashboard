import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // the business page used to live at /maple; keep old links working
  async redirects() {
    return [{ source: "/maple", destination: "/", permanent: true }];
  },
};

export default nextConfig;
