import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { Logo } from "@/components/ui/logo";

export function AuthPageLayout({
  children,
  imageSrc,
  imageAlt,
}: {
  children: ReactNode;
  imageSrc: string;
  imageAlt: string;
}) {
  return (
    <main className="grid min-h-dvh bg-background lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
      <section className="relative order-2 flex min-w-0 items-center justify-center px-5 py-10 sm:px-8 lg:order-1 lg:min-h-dvh lg:px-12 lg:py-24 xl:px-20">
        <Link
          href="/"
          className="absolute left-5 top-6 hidden items-center gap-2.5 rounded-lg sm:left-8 sm:top-8 lg:left-12 lg:flex xl:left-16"
        >
          <Logo className="size-9" />
          <span className="flex flex-col">
            <span className="text-base font-bold tracking-tight">Mealio</span>
            <span className="text-[11px] leading-tight text-muted-foreground">Mess management, made simple</span>
          </span>
        </Link>
        <div className="w-full max-w-md pt-14">{children}</div>
      </section>

      <aside
        className="relative order-1 h-56 overflow-hidden bg-[#f0f7f4] sm:h-64 lg:order-2 lg:h-dvh"
      >
        <Link
          href="/"
          className="absolute left-5 top-4 z-10 flex items-center gap-2.5 rounded-lg lg:hidden"
        >
          <Logo className="size-8" />
          <span className="flex flex-col">
            <span className="text-sm font-bold tracking-tight">Mealio</span>
            <span className="text-[10px] leading-tight text-muted-foreground">Mess management, made simple</span>
          </span>
        </Link>
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/70" />
        <div aria-hidden="true" className="absolute -right-20 -top-24 size-72 rounded-full bg-primary/10 blur-3xl" />
        <Image
          src={imageSrc}
          alt={imageAlt}
          fill
          priority
          sizes="(min-width: 1024px) 52vw, 100vw"
          className="object-contain p-2 pt-12 mix-blend-multiply sm:p-4 sm:pt-14 lg:p-8"
        />
      </aside>
    </main>
  );
}
