"use client";
import Link from "next/link";
import Image from "next/image";
import { Pacifico } from "next/font/google";
import WalletButton from "./WalletButton";

const couchTitle = Pacifico({
  weight: "400",
  subsets: ["latin"],
});

export default function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-[#E8E8E8] bg-[#FAFAFA]/95 backdrop-blur-sm">
      <div className="px-3 py-2 flex flex-col gap-2 max-w-lg mx-auto w-full">
        <div className="flex items-start justify-between gap-2">
          <Link href="/" className="flex items-center gap-2 min-w-0 group">
            <Image
              src="/couchchain-mark.png"
              alt=""
              width={36}
              height={36}
              className="h-9 w-9 object-contain shrink-0 drop-shadow-sm"
              priority
            />
            <div className="min-w-0">
              <span
                className={`${couchTitle.className} text-[1.65rem] sm:text-[1.85rem] text-[#E85D04] leading-none block lowercase`}
              >
                couchchain
              </span>
              <p className="mt-0.5 text-[10px] sm:text-[11px] text-[#5c5c5c] leading-snug line-clamp-2">
                Rutas verificadas por IA · Hospitalidad descentralizada en Etherlink
              </p>
            </div>
          </Link>
          <div className="shrink-0 pt-0.5 scale-95 origin-top-right sm:scale-100">
            <WalletButton />
          </div>
        </div>
        <nav className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#5c5c5c] font-medium">
          <Link href="/" className="hover:text-[#E85D04] transition-colors">
            Explorar
          </Link>
          <Link href="/passport" className="hover:text-[#E85D04] transition-colors">
            Mi Pasaporte
          </Link>
        </nav>
      </div>
    </header>
  );
}
