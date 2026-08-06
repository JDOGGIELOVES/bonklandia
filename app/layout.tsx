import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Playfair_Display } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "@solana/wallet-adapter-react-ui/styles.css";
import "./globals.css";
import { WalletProviderLazy } from "@/components/WalletProviderLazy";
import GlobalMusicToggle from "@/components/GlobalMusicToggle";
import PwaRegister from "@/components/PwaRegister";
import { BRAND } from "@/lib/brand";

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-display",
});

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#1a0b2e" },
    { media: "(prefers-color-scheme: light)", color: "#1a0b2e" },
  ],
  colorScheme: "dark",
};

export const metadata: Metadata = {
  title: BRAND.name,
  description: BRAND.tagline,
  applicationName: BRAND.name,
  metadataBase: new URL(BRAND.url),
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: BRAND.name,
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    title: BRAND.name,
    description: BRAND.tagline,
    url: BRAND.url,
    siteName: BRAND.name,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: BRAND.name,
    description: BRAND.tagline,
  },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${playfair.variable} ${cormorant.variable} font-body bg-black text-white min-h-screen antialiased`}>
        <WalletProviderLazy>
          {children}
          <GlobalMusicToggle />
          <PwaRegister />
        </WalletProviderLazy>
        <Analytics />
      </body>
    </html>
  );
}