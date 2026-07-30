/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Self-contained server bundle for the Docker/Cloud Run image. Netlify's Next
  // runtime manages its own output, so skip standalone there (it sets NETLIFY=true).
  output: process.env.NETLIFY ? undefined : "standalone",
};

export default nextConfig;
