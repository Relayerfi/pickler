"use client";

import type { AgentProfileDto } from "@pickler/api-schema";
import { useState } from "react";
import styles from "../agents.module.css";
import { formatInteger, formatTokenPrice } from "../lib/format";
import { CurveProgress } from "./agent-parts";

const QUICK_AMOUNTS = [10, 25, 100, 250];

/**
 * Buy or sell the agent's token. The quote is an estimate from the sample price: there is no
 * wallet connection and no launcher contract yet, so the action stays disabled.
 */
export function TradePanel({ agent }: { agent: AgentProfileDto }) {
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("");

  const token = agent.token;
  const price = agent.market?.price ?? 0;
  const value = Number.parseFloat(amount);
  const entered = Number.isFinite(value) && value > 0;
  const graduated = token?.stage === "graduated";

  // Rough curve impact, only to show the direction of the move.
  const depth = graduated ? 160_000 : 3_400;
  const after = price * (1 + (side === "buy" ? 1 : -1) * ((entered ? value : 0) / depth));

  return (
    <section className={`${styles.panel} ${styles.tradePanel}`} aria-labelledby="trade-title">
      <h2 id="trade-title" className={styles.srOnly}>
        {graduated ? "Trade" : "Back"} {agent.name}
      </h2>

      <div className={styles.sideToggle} role="group" aria-label="Side">
        <button
          type="button"
          className={styles.sideButton}
          aria-pressed={side === "buy"}
          onClick={() => setSide("buy")}
        >
          Buy
        </button>
        <button
          type="button"
          className={styles.sideButton}
          aria-pressed={side === "sell"}
          onClick={() => setSide("sell")}
        >
          Sell
        </button>
      </div>

      <div className={styles.amountRow}>
        <input
          className={styles.amountInput}
          type="number"
          min="0"
          step="any"
          inputMode="decimal"
          placeholder="0"
          aria-label={`Amount in MON to ${side}`}
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
        />
        <span className={styles.unitChip}>MON</span>
      </div>

      <p className={styles.balanceRow}>No wallet connected</p>

      {/* Trading opens with the testnet contracts and a wallet connection, which do not exist yet. */}
      <button type="button" className={styles.ctaButton} disabled aria-describedby="trade-status">
        Connect wallet
      </button>

      <div className={styles.quickRow} role="group" aria-label="Amount">
        {QUICK_AMOUNTS.map((quick) => (
          <button
            key={quick}
            type="button"
            className={styles.quickButton}
            onClick={() => setAmount(String(quick))}
          >
            {quick}
          </button>
        ))}
      </div>

      <dl className={styles.quoteList}>
        <div className={styles.quoteRow}>
          <dt>{side === "buy" ? "You get" : "You sell"}</dt>
          <dd>{entered && price > 0 ? `${formatInteger(value / price)} ${agent.ticker}` : "—"}</dd>
        </div>
        <div className={styles.quoteRow}>
          <dt>{graduated ? "Pool price after" : "Curve price after"}</dt>
          <dd className={styles.quiet}>
            {entered && price > 0 ? `${formatTokenPrice(after)} MON` : "—"}
          </dd>
        </div>
      </dl>

      {token && token.stage !== "graduated" && (
        <div className={styles.curveBlock}>
          <p className={styles.curveHead}>
            <span>CURVE</span>
            <span className={styles.toneCurve}>
              {Math.round((token.raised / token.graduationTarget) * 100)}%
            </span>
          </p>
          <CurveProgress token={token} />
        </div>
      )}

      <p id="trade-status" className={styles.disclaimer}>
        Trading opens with the testnet contracts. Backing an agent is not a bet on a game — it is a
        bet on its record.
      </p>
    </section>
  );
}
