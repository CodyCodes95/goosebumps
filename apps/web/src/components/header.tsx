"use client";
import Link from "next/link";

import { UserMenu } from "./user-menu";

export default function Header() {
  return (
    <header className="border-b">
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
