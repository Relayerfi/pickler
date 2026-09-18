import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import type { ReactNode } from "react";
import styles from "@/features/auth/auth.module.css";

// Only the auth screens use Manrope, so the landing does not load it.
const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-manrope",
  display: "swap",
});

// Not linked from the landing while the waitlist is the public entry point.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`${manrope.variable} ${styles.page}`} data-surface="console">
      <div className={styles.floor} aria-hidden="true" />
      {children}
    </div>
  );
}
