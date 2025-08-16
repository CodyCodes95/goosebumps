"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { UserMenu } from "./user-menu";

export default function Header() {
  // const pathname = usePathname();
  // const shouldHideHeader =
  //   pathname?.startsWith("/play/") || pathname?.startsWith("/present/");

  // if (shouldHideHeader) return null;

  return (
    <header className="border-b z-1">
      <div className="container mx-auto flex items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2 text-xl font-bold">
          Goosebumps
        </Link>

        <nav className="flex items-center">
          <UserMenu />
        </nav>
      </div>
    </header>
  );
}
