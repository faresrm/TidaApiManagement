/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    dynamicIO: true,
  },
  // Cette option permet de prolonger la durée de vie des fonctions serverless
  // après l'envoi de la réponse, ce qui donne plus de temps pour terminer les opérations asynchrones
  serverExternalPackages: ["@supabase/supabase-js"],

  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
