import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Web3Provider from "@/components/ui/Web3Provider";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "CouchChain",
  description: "AI-verified travel routes & decentralized hospitality on Etherlink",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={inter.variable}>
      <body className="bg-[#FAFAFA] text-[#1a1a1a] antialiased">
        <Web3Provider>{children}</Web3Provider>
      </body>
    </html>
  );
}
