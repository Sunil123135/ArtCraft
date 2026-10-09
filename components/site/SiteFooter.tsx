import Link from "next/link";
import { CRAFT_APPS } from "@/lib/apps";

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-ink-2">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-5 py-10 sm:flex-row sm:justify-between">
        <div>
          <p className="text-sm font-medium text-cream">Atelier</p>
          <p className="mt-2 max-w-sm text-sm leading-6 text-mute">
            Seven creative benches in the browser. Your files stay on your machine.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-x-10 gap-y-2 text-sm text-cream-dim">
          {CRAFT_APPS.map((app) => (
            <Link key={app.slug} href={app.href} className="hover:text-cream">
              {app.name}
            </Link>
          ))}
        </div>
      </div>
    </footer>
  );
}
