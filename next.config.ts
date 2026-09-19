import type { NextConfig } from "next";

// Cache Components (Next 16 PPR) stays off in Foundation: every page here is
// auth-aware and renders dynamically. Turning it on is a deliberate later
// decision, taken with the caching strategy for public participant pages.
const nextConfig: NextConfig = {};

export default nextConfig;
