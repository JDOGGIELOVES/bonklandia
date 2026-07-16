import type { Metadata } from "next";
import { Cormorant_Garamond, Playfair_Display } from "next/font/google";
import "@solana/wallet-adapter-react-ui/styles.css";
import "./globals.css";
import { WalletProviderWrapper } from "@/components/WalletProvider";
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

export const metadata: Metadata = {
  title: BRAND.name,
  description: BRAND.tagline,
  metadataBase: new URL(BRAND.url),
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
    icon: "/favicon.ico",
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
        <WalletProviderWrapper>
          {children}
        </WalletProviderWrapper>
      </body>
    </html>
  );
}