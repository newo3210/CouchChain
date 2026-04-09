"use client";
import Link from "next/link";
import { Pacifico } from "next/font/google";
import WalletButton from "./WalletButton";

const couchTitle = Pacifico({
  weight: "400",
  subsets: ["latin"],
});

export default function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-[#e7e5e4] bg-[#fafaf9]/95 backdrop-blur-sm">
      <div className="max-w-lg mx-auto w-full px-4 py-2.5 flex items-center justify-between gap-3">
        <Link
          href="/"
          className={`${couchTitle.className} text-[1.55rem] sm:text-[1.75rem] text-[#1e293b] leading-none lowercase shrink-0`}
        >
          couchchain
        </Link>
        <WalletButton />
      </div>
    </header>
  );
}
