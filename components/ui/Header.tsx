"use client";
import Link from "next/link";
import WalletButton from "./WalletButton";

export default function Header() {
  return (
    <header className="sticky top-0 z-40 bg-[#FAFAFA]/90 backdrop-blur-sm border-b border-[#E8E8E8]">
      <div className="max-w-screen-xl mx-auto flex items-center justify-between px-4 h-12">
        <Link href="/" className="font-semibold text-[#1a1a1a] tracking-tight">
          CouchChain
        </Link>
        <nav className="hidden md:flex items-center gap-6 text-sm text-[#5c5c5c]">
          <Link href="/" className="hover:text-[#1a1a1a] transition-colors">
            Explorar
          </Link>
          <Link href="/passport" className="hover:text-[#1a1a1a] transition-colors">
            Mi Pasaporte
          </Link>
        </nav>
        <WalletButton />
      </div>
    </header>
  );
}
