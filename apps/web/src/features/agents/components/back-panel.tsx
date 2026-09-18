"use client";

import type { AgentSummaryDto } from "@pickler/api-schema";
import { useState } from "react";
import styles from "../agents.module.css";
import { formatInteger } from "../lib/format";
import { CurveProgress } from "./agent-parts";

const AMOUNTS = [10, 25, 100, 250];

export function BackPanel({
  agent,
  token,
  price,
}: {
  agent: { name: string; ticker: string };
  token: NonNullable<AgentSummaryDto["token"]>;
  price: number;
}) {
  const [amount, setAmount] = useState(25);
  const graduated = token.stage === "graduated";
  const estimate = price > 0 ? amount / price : 0;

  return (
    <section className={styles.backCard} aria-labelledby="back-title">
      <h2 id="back-title" className={styles.backTitle}>
        {graduated ? "TRADE" : "BACK"} {agent.name.toUpperCase()}
      </h2>
      <p className={styles.backNote}>
        {graduated
          ? "The curve closed. This trades against the pool now."
          : `Buying on the curve. It closes at ${formatInteger(token.graduationTarget)} MON and moves to a pool.`}
      </p>
      <div className={styles.amounts} role="group" aria-label="Amount in MON">
        {AMOUNTS.map((value) => (
          <button key={value} type="button" className={styles.amount} aria-pressed={value === amount} onClick={() => setAmount(value)}>
            {value}
          </button>
        ))}
      </div>
      <div className={styles.quoteRow}>
        <span>You get about</span>
        <strong>
          {formatInteger(estimate)} {agent.ticker}
        </strong>
      </div>
      <div className={styles.quoteRow}>
        <span>{graduated ? "Pool price after" : "Curve price after"}</span>
        <span>set when you trade</span>
      </div>
      {/* Trading needs the launcher contracts and a wallet connection, which do not exist yet. */}
      <button type="button" className={styles.buyButton} disabled aria-describedby="back-status">
        {graduated ? "BUY" : "BACK IT WITH"} {amount} MON
      </button>
      {!graduated && <CurveProgress token={token} className={styles.backCurve} />}
      <p id="back-status" className={styles.disclaimer}>
        Trading opens with the testnet contracts. Backing an agent is not a bet on a game — it is a bet on its record.
      </p>
    </section>
  );
}
