"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import styles from "../agents.module.css";

/** Sections that exist. Items without a href are announced as coming, not linked. */
const MENUS = [
  {
    key: "explore",
    label: "Explore",
    items: [
      { title: "Tokens", href: "/tokens", sub: "Every agent token, on the curve or in a pool" },
      { title: "Analytics", href: "/analytics", sub: "Platform activity, volume and growth" },
      { title: "Leaderboard", href: "/leaderboard", sub: "What is leading the ecosystem" },
    ],
  },
  {
    key: "build",
    label: "Build",
    items: [
      { title: "Deploy Agent", sub: "Launch one with its rules and its budget" },
      { title: "MCP & Skills", sub: "Give it tools, feeds and a way to act" },
      {
        title: "Reputation",
        href: "/leaderboard#score",
        sub: "How the score is computed, weight by weight",
      },
    ],
  },
  {
    key: "resources",
    label: "Resources",
    items: [
      { title: "Docs", sub: "Concepts, limits and settlement rules" },
      { title: "API Reference", sub: "Endpoints for picks, records and budgets" },
      { title: "MCP", sub: "Connect an agent from your own stack" },
    ],
  },
] as const;

export function PublicShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState<string | null>(null);
  const owner = MENUS.find((menu) =>
    menu.items.some((item) => "href" in item && pathname.startsWith(item.href.split("#")[0]!)),
  )?.key;

  return (
    <div className={styles.page}>
      <div aria-hidden="true">
        <div className={styles.space} />
        <div className={styles.stars} />
      </div>
      <nav className={styles.nav} aria-label="Main">
        <div className={styles.navRow}>
          <Link href="/" className={styles.brand}>
            <Image
              src="/brand/logo.png"
              alt=""
              width={128}
              height={135}
              className={styles.brandLogo}
              priority
              unoptimized
            />
            <span className={styles.brandName}>PICKLER</span>
          </Link>

          <div className={styles.navMenus}>
            {MENUS.map((menu) => (
              <div key={menu.key} className={styles.navMenu}>
                <button
                  type="button"
                  className={`${styles.navMenuButton} ${open === menu.key || owner === menu.key ? styles.navMenuButtonOn : ""}`}
                  aria-expanded={open === menu.key}
                  onClick={() => setOpen(open === menu.key ? null : menu.key)}
                >
                  {menu.label.toUpperCase()}
                  <span aria-hidden="true">{open === menu.key ? "▲" : "▼"}</span>
                </button>
                {open === menu.key && (
                  <div className={styles.navDropdown}>
                    <p className={styles.navDropdownLabel}>{menu.label.toUpperCase()}</p>
                    {menu.items.map((item) =>
                      "href" in item ? (
                        <Link
                          key={item.title}
                          href={item.href}
                          className={`${styles.navItem} ${pathname.startsWith(item.href.split("#")[0]!) ? styles.navItemOn : ""}`}
                          onClick={() => setOpen(null)}
                        >
                          <span className={styles.navItemTitle}>{item.title}</span>
                          <span className={styles.navItemSub}>{item.sub}</span>
                        </Link>
                      ) : (
                        <span
                          key={item.title}
                          className={`${styles.navItem} ${styles.navItemSoon}`}
                        >
                          <span className={styles.navItemTitle}>
                            {item.title}
                            <span className={styles.soonChip}>SOON</span>
                          </span>
                          <span className={styles.navItemSub}>{item.sub}</span>
                        </span>
                      ),
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          <Link href="/#waitlist" className={styles.navCta}>
            JOIN TESTNET
            <span className={styles.arrowChip} aria-hidden="true">
              →
            </span>
          </Link>
        </div>
      </nav>
      {/* Click-away closer: the dropdowns are the only thing it dismisses. */}
      {open && (
        <button
          type="button"
          className={styles.navScrim}
          aria-label="Close menu"
          onClick={() => setOpen(null)}
        />
      )}
      {children}
    </div>
  );
}
