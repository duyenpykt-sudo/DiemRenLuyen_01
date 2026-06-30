/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Tạo bản build độc lập (self-contained) để đóng gói chạy trên máy CVHT:
  //   npm run build  → chạy: node .next/standalone/server.js
  output: "standalone",
};

export default nextConfig;
