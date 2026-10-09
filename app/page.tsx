import Link from "next/link";
import { CRAFT_APPS, PRINCIPLES } from "@/lib/apps";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";

export default function HomePage() {
  return (
    <div className="min-h-full bg-ink">
      <SiteHeader />
      <main>
        <section className="mx-auto max-w-6xl px-5 pb-20 pt-20 sm:pt-28">
          <p className="text-[11px] uppercase tracking-[0.22em] text-mute">01 / The workshop</p>
          <h1 className="serif mt-5 max-w-4xl text-5xl leading-[1.05] text-cream sm:text-7xl">
            Seven tools.
            <br />
            One workshop.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-cream-dim">
            Image editing, vector illustration, video, photography, PDFs, motion graphics and
            page layout. Free browser studios that keep every file on your machine.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="#lineup"
              className="rounded-full bg-cream px-5 py-2.5 text-sm font-medium text-ink hover:bg-white"
            >
              Pick a craft
            </Link>
            <Link
              href="/photo"
              className="rounded-full border border-line px-5 py-2.5 text-sm text-cream hover:bg-panel"
            >
              Launch Photo
            </Link>
          </div>
        </section>

        <section id="lineup" className="border-t border-line bg-ink-2">
          <div className="mx-auto max-w-6xl px-5 py-16">
            <p className="text-[11px] uppercase tracking-[0.22em] text-mute">02 / The lineup</p>
            <h2 className="serif mt-3 text-4xl text-cream">Pick a craft to explore</h2>
            <div className="mt-10 divide-y divide-line">
              {CRAFT_APPS.map((craft) => (
                <article key={craft.slug} className="grid gap-6 py-10 md:grid-cols-[160px_1fr_auto]">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-mute">
                      {craft.category}
                    </p>
                    <p className="mt-2 font-mono text-xs text-accent">{craft.number}</p>
                  </div>
                  <div>
                    <h3 className="serif text-3xl text-cream">{craft.name}</h3>
                    <p className="mt-2 max-w-xl text-sm leading-7 text-cream-dim">
                      {craft.description}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className="rounded-full border border-line px-2.5 py-1 text-[11px] text-cream-dim">
                        {craft.status}
                      </span>
                      {craft.platforms.map((platform) => (
                        <span
                          key={platform}
                          className="rounded-full border border-line px-2.5 py-1 text-[11px] text-mute"
                        >
                          {platform}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center">
                    <Link
                      href={craft.href}
                      className="rounded-full bg-cream px-4 py-2 text-sm text-ink hover:bg-white"
                    >
                      Explore {craft.name}
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="principles" className="border-t border-line">
          <div className="mx-auto max-w-6xl px-5 py-16">
            <p className="text-[11px] uppercase tracking-[0.22em] text-mute">03 / How it is built</p>
            <h2 className="serif mt-3 text-4xl text-cream">Built the hard way.</h2>
            <p className="mt-3 max-w-xl text-sm leading-7 text-cream-dim">
              Every bench is held to the same rules: local files, familiar tools, and a model an
              agent can drive.
            </p>
            <ol className="mt-10 grid gap-6 md:grid-cols-2">
              {PRINCIPLES.map((item) => (
                <li key={item.number} className="rounded-2xl border border-line bg-panel p-6">
                  <p className="font-mono text-xs text-accent">{item.number}</p>
                  <h3 className="mt-3 text-lg text-cream">{item.title}</h3>
                  <p className="mt-2 text-sm leading-7 text-cream-dim">{item.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
