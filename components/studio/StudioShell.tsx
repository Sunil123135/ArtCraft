"use client";

import Link from "next/link";
import { type ReactNode } from "react";
import { CRAFT_APPS, type CraftApp } from "@/lib/apps";

type MenuItem = {
  label: string;
  shortcut?: string;
  onSelect?: () => void;
  danger?: boolean;
};

type MenuGroup = {
  label: string;
  items: MenuItem[];
};

type StudioShellProps = {
  app: CraftApp;
  menus: MenuGroup[];
  tools?: ReactNode;
  inspector?: ReactNode;
  status?: string;
  children: ReactNode;
  openMenu: string | null;
  onOpenMenu: (label: string | null) => void;
};

export function StudioShell({
  app,
  menus,
  tools,
  inspector,
  status,
  children,
  openMenu,
  onOpenMenu,
}: StudioShellProps) {
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-ink text-cream">
      <header className="flex h-10 shrink-0 items-center border-b border-line bg-panel">
        <Link
          href="/"
          className="flex h-full items-center gap-2 border-r border-line px-3 text-xs text-cream-dim hover:text-cream"
        >
          <span className="grid h-5 w-5 place-items-center rounded bg-cream text-[10px] font-semibold text-ink">
            A
          </span>
          Atelier
        </Link>
        <div className="flex items-center px-2">
          {CRAFT_APPS.map((item) => (
            <Link
              key={item.slug}
              href={item.href}
              className={`rounded px-2 py-1 text-[11px] ${
                item.slug === app.slug
                  ? "bg-panel-2 text-cream"
                  : "text-mute hover:text-cream"
              }`}
            >
              {item.shortName}
            </Link>
          ))}
        </div>
        <div className="ml-auto pr-3 text-[11px] uppercase tracking-[0.16em] text-mute">
          {app.category}
        </div>
      </header>

      <div className="flex h-8 shrink-0 items-center border-b border-line bg-ink-2 px-1">
        {menus.map((menu) => (
          <div key={menu.label} className="relative">
            <button
              type="button"
              className={`rounded px-2 py-1 text-[12px] ${
                openMenu === menu.label ? "bg-line text-cream" : "text-cream-dim hover:bg-panel"
              }`}
              onClick={() => onOpenMenu(openMenu === menu.label ? null : menu.label)}
            >
              {menu.label}
            </button>
            {openMenu === menu.label ? (
              <div className="absolute left-0 top-full z-50 mt-1 min-w-52 rounded-md border border-line bg-panel-2 py-1 shadow-2xl">
                {menu.items.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-[12px] hover:bg-line ${
                      item.danger ? "text-danger" : "text-cream"
                    }`}
                    onClick={() => {
                      item.onSelect?.();
                      onOpenMenu(null);
                    }}
                  >
                    <span>{item.label}</span>
                    {item.shortcut ? (
                      <span className="text-[10px] text-mute">{item.shortcut}</span>
                    ) : null}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <div className="flex min-h-0 flex-1">
        {tools ? (
          <aside className="flex w-12 shrink-0 flex-col items-center gap-1 border-r border-line bg-panel py-2">
            {tools}
          </aside>
        ) : null}
        <main className="relative min-w-0 flex-1 overflow-hidden bg-tool">{children}</main>
        {inspector ? (
          <aside className="scrollbar-thin w-[280px] shrink-0 overflow-y-auto border-l border-line bg-panel">
            {inspector}
          </aside>
        ) : null}
      </div>

      <footer className="flex h-7 shrink-0 items-center justify-between border-t border-line bg-panel px-3 text-[11px] text-mute">
        <span>{status ?? `${app.name} · documents stay on this device`}</span>
        <span>{app.status}</span>
      </footer>
    </div>
  );
}

export function ToolButton({
  active,
  label,
  onClick,
}: {
  active?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      onClick={onClick}
      className={`grid h-8 w-8 place-items-center rounded text-[10px] font-medium ${
        active ? "bg-cream text-ink" : "text-cream-dim hover:bg-panel-2 hover:text-cream"
      }`}
    >
      {label.slice(0, 2)}
    </button>
  );
}

export function Panel({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="border-b border-line">
      <h2 className="px-3 py-2 text-[10px] font-medium uppercase tracking-[0.16em] text-mute">
        {title}
      </h2>
      <div className="space-y-2 px-3 pb-3">{children}</div>
    </section>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] text-mute">{label}</span>
      {children}
    </label>
  );
}
