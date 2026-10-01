/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: false,
  },
  // Sin badge flotante del entorno dev: se superponía a botones/CTAs en móvil (QA ola 1)
  devIndicators: false,
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
