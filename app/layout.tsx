import type { Metadata } from "next";
import { Space_Grotesk, Be_Vietnam_Pro } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
});

const beVietnamPro = Be_Vietnam_Pro({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-be-vietnam-pro",
});

export const metadata: Metadata = {
  title: {
    default: "BoozedBunny AI Town",
    template: "%s | BoozedBunny AI Town",
  },
  description: "A browser-based 3D multiplayer game where you build and compete in an isometric empire.",
  keywords: ["AI Town", "Multiplayer", "3D Game", "Simulation", "Isometric", "BoozedBunny"],
  authors: [{ name: "BoozedBunny Team" }],
  metadataBase: new URL("https://bbtown.ai"),
  creator: "BoozedBunny",
  publisher: "BoozedBunny",
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/logo.png",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://bbtown.ai",
    title: "BoozedBunny AI Town",
    description: "Enter the next generation of building and competition in BoozedBunny AI Town.",
    siteName: "BoozedBunny AI Town",
    images: [
      {
        url: "/logo.png",
        width: 512,
        height: 512,
        alt: "BoozedBunny AI Town Logo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "BoozedBunny AI Town",
    description: "Enter the next generation of building and competition in BoozedBunny AI Town.",
    images: ["/logo.png"],
    creator: "@BoozedBunny",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${beVietnamPro.className} ${spaceGrotesk.variable} ${beVietnamPro.variable} antialiased`}>
        {children}
        <Toaster theme="dark" position="bottom-right" richColors />
      </body>
    </html>
  );
}
