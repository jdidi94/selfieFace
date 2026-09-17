import type { NextConfig } from 'next';

type RemotePattern = {
  protocol?: 'http' | 'https';
  hostname: string;
  port?: string;
  pathname?: string;
};

function patternFromUrl(raw: string | undefined, pathname: string): RemotePattern | null {
  if (!raw?.trim()) return null;
  try {
    const u = new URL(raw);
    const protocol = u.protocol.replace(':', '') as 'http' | 'https';
    if (protocol !== 'http' && protocol !== 'https') return null;
    return {
      protocol,
      hostname: u.hostname,
      ...(u.port ? { port: u.port } : {}),
      pathname,
    };
  } catch {
    return null;
  }
}

function mediaRemotePatterns(): RemotePattern[] {
  const patterns: RemotePattern[] = [
    { protocol: 'https', hostname: 'images.unsplash.com' },
    { protocol: 'http', hostname: 'localhost', port: '4000', pathname: '/api/media/**' },
    { protocol: 'http', hostname: '127.0.0.1', port: '4000', pathname: '/api/media/**' },
  ];

  const api = patternFromUrl(process.env.NEXT_PUBLIC_API_URL, '/api/media/**');
  if (api) patterns.push(api);

  for (const envKey of ['NEXT_PUBLIC_MEDIA_URL', 'NEXT_PUBLIC_MEDIA_CDN_URL'] as const) {
    const cdn = patternFromUrl(process.env[envKey], '/**');
    if (cdn) patterns.push(cdn);
  }

  return patterns;
}

const nextConfig: NextConfig = {
  transpilePackages: ['@lumea/ui', '@lumea/types', '@lumea/utils'],
  images: {
    remotePatterns: mediaRemotePatterns(),
  },
  experimental: {
    optimizePackageImports: ['lucide-react', '@lumea/ui'],
  },
};

export default nextConfig;
