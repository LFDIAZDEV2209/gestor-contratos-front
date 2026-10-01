/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    unoptimized: true,
  },
  experimental: {
    workerThreads: true,
    useTypeScriptCli: false,
    cpus: 2,
  },
}

export default nextConfig
