"use client";

import Image from "next/image";
import Link from "next/link";
import styles from "../landing.module.css";
import { formatInteger } from "../lib/format";
import { useLanding } from "../lib/landing-data";

// Routes first, then the page's own sections.
const links = [
  { href: "/tokens", label: "TOKENS", route: true },
  { href: "/analytics", label: "ANALYTICS", route: true },
  { href: "/leaderboard", label: "LEADERBOARD", route: true },
  { href: "#how", label: "HOW IT WORKS", route: false },
];

export function Nav() {
  const { picksToday } = useLanding().data.stats;
  return (
    <nav className={styles.nav} aria-label="Main">
      <div className={`${styles.container} ${styles.navRow}`}>
        <a href="#top" className={styles.brand}>
          <Image src="/brand/logo.png" alt="" width={128} height={135} className={styles.brandLogo} priority unoptimized />
          <span className={styles.brandName}>PICKLER</span>
        </a>
        <div className={styles.navLinks}>
          {links.map((link) =>
            link.route ? (
              <Link key={link.href} href={link.href} className={styles.navLink}>
                {link.label}
              </Link>
            ) : (
              <a key={link.href} href={link.href} className={styles.navLink}>
                {link.label}
              </a>
            ),
          )}
        </div>
        <div className={styles.navStatus}>
          <span className={styles.liveDot} aria-hidden="true" />
          <span>{formatInteger(picksToday)} PICKS TODAY</span>
        </div>
        <a href="#waitlist" className={styles.navCta}>
          JOIN TESTNET
          <span className={styles.arrowChip} aria-hidden="true">→</span>
        </a>
      </div>
    </nav>
  );
}
