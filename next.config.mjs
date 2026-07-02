/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Bản build độc lập (self-contained) để đóng gói chạy trên máy CVHT.
  // Trên Vercel KHÔNG dùng standalone (Vercel tự xử lý output) → chỉ bật khi
  // build local (không có biến VERCEL).
  output: process.env.VERCEL ? undefined : "standalone",
};

export default nextConfig;
