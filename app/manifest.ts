import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'BoozedBunny AI Town',
    short_name: 'BBTown',
    description: 'A browser-based 3D multiplayer game where you build and compete in an isometric empire.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0F021A',
    theme_color: '#BD00FF',
    icons: [
      {
        src: '/favicon.ico',
        sizes: 'any',
        type: 'image/x-icon',
      },
      {
        src: '/logo.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}
