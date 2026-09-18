"use client";

import type { AccentDto, AgentProfileDto, ChartRangeDto } from "@pickler/api-schema";
import { useState } from "react";
import { accentVars } from "@/lib/accent";
import styles from "../agents.module.css";
import { formatChange, formatTokenPrice } from "../lib/format";

const RANGES: ChartRangeDto[] = ["5m", "1h", "4h", "1d"];
type Candles = NonNullable<AgentProfileDto["market"]>["candles"];

export function PriceChart({ price, change24h, candles, accent }: { price: number; change24h: number; candles: Candles; accent: AccentDto }) {
  const [range, setRange] = useState<ChartRangeDto>("1h");
  const series = candles[range];

  // Scale to the visible window with a little headroom top and bottom.
  const lows = series.map((c) => c.low);
  const highs = series.map((c) => c.high);
  const min = Math.min(...lows, price);
  const max = Math.max(...highs, price);
  const span = max - min || max || 1;
  const y = (value: number) => 6 + (1 - (value - min) / span) * 88;

  return (
    <>
      <div className={styles.panelHead}>
        <span className={styles.label}>PRICE</span>
        <span className={styles.panelHeadValue}>{formatTokenPrice(price)} MON</span>
        <span className={`${styles.change} ${change24h < 0 ? styles.toneLoss : styles.toneWin}`} style={{ margin: 0 }}>
          {formatChange(change24h)} 24H
        </span>
        <span className={styles.ranges} role="group" aria-label="Chart range">
          {RANGES.map((r) => (
            <button key={r} type="button" className={styles.rangeButton} aria-pressed={r === range} onClick={() => setRange(r)}>
              {r.toUpperCase()}
            </button>
          ))}
        </span>
      </div>
      <div className={styles.chart} style={accentVars(accent)} role="img" aria-label={`${range} price candles`}>
        {series.length === 0 ? (
          <p className={styles.chartEmpty}>No trades in this range yet.</p>
        ) : (
          <>
            <div className={styles.candles}>
              {series.map((candle, i) => {
                const tone = candle.close >= candle.open ? styles.up : styles.down;
                const bodyTop = y(Math.max(candle.open, candle.close));
                const bodyBottom = y(Math.min(candle.open, candle.close));
                return (
                  <span key={i} className={styles.candle}>
                    <span className={`${styles.wick} ${tone}`} style={{ top: `${y(candle.high)}%`, height: `${y(candle.low) - y(candle.high)}%` }} />
                    <span className={`${styles.body} ${tone}`} style={{ top: `${bodyTop}%`, height: `${bodyBottom - bodyTop}%` }} />
                  </span>
                );
              })}
            </div>
            <span className={styles.lastPrice} style={{ top: `calc(14px + (100% - 28px) * ${(y(price) / 100).toFixed(4)})` }}>
              {formatTokenPrice(price)}
            </span>
          </>
        )}
      </div>
    </>
  );
}
