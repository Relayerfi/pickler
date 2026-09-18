import Link from "next/link";
import styles from "../apply.module.css";

export function NoSeat({ referralCode }: { referralCode: string | null }) {
  const href = referralCode ? `/?ref=${encodeURIComponent(referralCode)}#waitlist` : "/#waitlist";
  return (
    <main className={`${styles.main} ${styles.noSeat}`}>
      <p className={styles.eyebrow}>CLOSED TESTNET · MONAD</p>
      <h1 className={styles.title}>GET IN LINE FIRST.</h1>
      <p className={styles.lead}>
        Applications open right after you join the waitlist, in the same browser. Drop your email on
        the board and we will bring you back here.
      </p>
      <Link href={href} className={styles.primaryButton}>
        JOIN THE WAITLIST
      </Link>
    </main>
  );
}
