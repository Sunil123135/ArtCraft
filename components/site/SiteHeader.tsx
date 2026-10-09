import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-ink/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-cream text-[11px] font-semibold tracking-tight text-ink">
            A
          </span>
          <span className="text-sm font-medium tracking-wide text-cream">Atelier</span>
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-cream-dim sm:flex">
          <Link href="/#lineup" className="hover:text-cream">
            The lineup
          </Link>
          <Link href="/#principles" className="hover:text-cream">
            Principles
          </Link>
          <Link href="/photo" className="hover:text-cream">
            Launch studio
          </Link>
        </nav>
        <Link
          href="/photo"
          className="rounded-full bg-cream px-3.5 py-1.5 text-xs font-medium text-ink hover:bg-white"
        >
          Open Photo
        </Link>
      </div>
    </header>
  );
}
