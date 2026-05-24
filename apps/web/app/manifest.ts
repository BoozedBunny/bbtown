import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BoozedBunnyTown",
    short_name: "BBTown",
    description: "A browser-based 3D multiplayer game where you build and compete with your own empire.",
    start_url: '/',
    display: 'standalone',
    background_color: '#0F021A',
    theme_color: '#BD00FF',
    icons: [
      {
        src: 'https://www.boozedbunnytown.com/media/favicon.ico',
        sizes: 'any',
        type: 'image/x-icon',
      },
      {
        src: 'https://www.boozedbunnytown.com/media/logo.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}
