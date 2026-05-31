import type { Metadata } from "next";
import { Cinzel, Inter } from "next/font/google";
import dynamic from "next/dynamic";
import "./globals.css";

const Providers = dynamic(
  () => import("./providers").then((m) => ({ default: m.Providers })),
  { ssr: false }
);

const cinzel = Cinzel({
  subsets: ["latin"],
  weight: ["400", "600", "700", "900"],
  variable: "--font-cinzel",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "FlipChain Casino — Provably Fair Crypto Games",
  description:
    "On-chain provably fair casino on Ethereum Sepolia. Coin Flip, Dice, Crash & Slots — every result lives on the blockchain. No KYC, no tricks.",
  keywords: ["crypto casino", "provably fair", "ethereum", "blockchain", "sepolia", "coin flip", "dice", "crash"],
  icons: { icon: "/favicon.ico" },
  openGraph: {
    title: "FlipChain Casino — Provably Fair Crypto Games",
    description: "On-chain casino on Ethereum Sepolia. Every result is verifiable on the blockchain.",
    type: "website",
    url: "https://chainbet-casino.surge.sh",
    siteName: "FlipChain Casino",
  },
  twitter: {
    card: "summary_large_image",
    title: "FlipChain Casino",
    description: "On-chain provably fair casino — Coin Flip, Dice, Crash & Slots on Ethereum Sepolia.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" translate="no" className={`${cinzel.variable} ${inter.variable}`}>
      <body className="bg-casino-black font-body antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
