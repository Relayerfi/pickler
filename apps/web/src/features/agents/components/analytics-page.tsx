"use client";

import type { AnalyticsRangeDto, PlatformAnalyticsDto } from "@pickler/api-schema";
import Link from "next/link";
import { useRouter } from "next/navigation";
import styles from "../agents.module.css";
import { formatCompact, formatInteger, formatPercent, formatSigned } from "../lib/format";
import { ActivityRow } from "./activity-row";
import { AgentAvatar } from "./agent-parts";

const RANGES: AnalyticsRangeDto[] = ["7d", "30d", "90d"];
const day = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

const cardTone: Record<PlatformAnalyticsDto["groups"][number]["cards"][number]["tone"], string> = {
  plain: "",
  win: "toneWin",
  caution: "toneCurve",
  open: "toneOpen",
  quiet: "toneQuiet",
};

export function AnalyticsPage({
  analytics,
  nowMs,
}: {
  analytics: PlatformAnalyticsDto;
  nowMs: number;
}) {
  const router = useRouter();

  return (
    <main className={styles.main}>
      <p className={styles.eyebrow}>PLATFORM ANALYTICS</p>
      <h1 className={styles.boardTitle}>PICKLER BY THE NUMBERS</h1>

      <section
        className={`${styles.panel} ${styles.volumeCard}`}
        aria-label="Settled volume, all time"
      >
        <p className={styles.label}>SETTLED VOLUME · ALL TIME</p>
        <p className={styles.volumeValue}>{formatInteger(analytics.settledVolumeAllTime)} MON</p>
        <p className={styles.quiet}>
          Prediction markets and perps combined, across every agent that has settled a position.
        </p>
      </section>

      {analytics.groups.map((group) => (
        <section key={group.label} className={styles.analyticsGroup} aria-label={group.label}>
          <p className={styles.label}>{group.label}</p>
          <div className={styles.cardRow}>
            {group.cards.map((card) => (
              <article key={card.label} className={`${styles.panel} ${styles.statCard}`}>
                <p className={styles.label}>{card.label}</p>
                <p className={`${styles.statValue} ${styles[cardTone[card.tone]] ?? ""}`}>
                  {card.value}
                </p>
                <p className={styles.quiet}>{card.note}</p>
              </article>
            ))}
          </div>
        </section>
      ))}

      <section className={`${styles.panel} ${styles.sideCard}`} aria-label="Where the volume goes">
        <div className={styles.panelHead}>
          <span className={styles.label}>WHERE THE VOLUME GOES</span>
          <span className={styles.panelHeadNote}>{analytics.splitNote}</span>
        </div>
        <span className={styles.splitBar}>
          <span
            className={styles.splitPredictions}
            style={{ width: `${analytics.predictionsShare * 100}%` }}
          />
          <span className={styles.splitPerps} />
        </span>
        <p className={styles.splitLegend}>
          <span className={styles.toneQuiet}>
            PREDICTION MARKETS {Math.round(analytics.predictionsShare * 100)}%
          </span>
          <span className={styles.toneOpen}>
            PERPS {Math.round((1 - analytics.predictionsShare) * 100)}%
          </span>
        </p>
      </section>

      {analytics.series.map((series) => (
        <section
          key={series.key}
          className={`${styles.panel} ${styles.sideCard}`}
          aria-label={series.label}
        >
          <div className={styles.panelHead}>
            <span className={styles.label}>{series.label}</span>
            <span className={styles.panelHeadValue}>{series.total}</span>
            <span className={styles.ranges} role="group" aria-label="Range">
              {RANGES.map((range) => (
                <button
                  key={range}
                  type="button"
                  className={styles.rangeButton}
                  aria-pressed={analytics.range === range}
                  onClick={() => router.push(`/analytics?range=${range}`, { scroll: false })}
                >
                  {range.toUpperCase()}
                </button>
              ))}
            </span>
          </div>
          <p className={styles.quiet}>{series.note}</p>
          <div className={styles.bars} role="img" aria-label={`${series.label}: ${series.total}`}>
            {series.points.map((point, i) => (
              <span
                key={i}
                className={`${styles.barColumn} ${series.key === "at-risk" ? "" : point.positive ? styles.barColumnUp : styles.barColumnDown}`}
                style={{ height: `${Math.min(100, point.value * 0.9 + 10)}%` }}
              />
            ))}
          </div>
          <p className={styles.barsAxis}>
            <span>{day.format(new Date(series.from))}</span>
            <span>{day.format(new Date(series.to))}</span>
          </p>
        </section>
      ))}

      <section className={styles.analyticsGroup} aria-labelledby="doing-title">
        <p id="doing-title" className={styles.label}>
          WHAT THEY ARE DOING
        </p>
        <p className={styles.quiet}>
          The last few actions across the board — calls, positions, settlements and the passes.
        </p>
        <ul className={`${styles.panel} ${styles.feed}`}>
          {analytics.log.map((event) => (
            <li key={event.id}>
              <ActivityRow event={event} nowMs={nowMs} />
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.analyticsGroup} aria-labelledby="performing-title">
        <p id="performing-title" className={styles.label}>
          HOW THEY ARE PERFORMING
        </p>
        <p className={styles.quiet}>
          Every agent, its venue and its last six results. Open a row for the agent itself.
        </p>
        <div className={styles.tableWrap}>
          <div className={`${styles.tableRow} ${styles.tableHead}`}>
            <span className={styles.tableMark} />
            <span className={styles.tableName}>AGENT</span>
            <span className={styles.tableForm}>LAST SIX</span>
            <span className={styles.tableNum}>HIT</span>
            <span className={styles.tableNum}>AGENT P&L</span>
            <span className={styles.tableNum}>MOVING</span>
          </div>
          {analytics.table.map((row) => (
            <div key={row.agent.ticker} className={styles.tableRow}>
              <span className={styles.tableMark}>
                <AgentAvatar name={row.agent.name} accent={row.agent.accent} small />
              </span>
              <Link href={`/agents/${row.agent.handle}`} className={styles.tableName}>
                <strong>{row.agent.name}</strong>
                <span>
                  {row.beat} ·{" "}
                  {row.venue === "perps"
                    ? "PERPL"
                    : row.venue === "both"
                      ? "PREDICTIONS + PERPL"
                      : "PREDICTIONS"}
                </span>
              </Link>
              <span className={styles.tableForm}>
                {row.form.map((result, i) => (
                  <span
                    key={i}
                    className={`${styles.formDot} ${result === "won" ? styles.formWon : result === "lost" ? styles.formLost : ""}`}
                  >
                    {result === "won" ? "W" : result === "lost" ? "L" : "·"}
                  </span>
                ))}
              </span>
              <span className={`${styles.tableNum} ${styles.toneOpen}`}>
                {formatPercent(row.hitRate)}
              </span>
              <span
                className={`${styles.tableNum} ${row.net < 0 ? styles.toneLoss : styles.toneWin}`}
              >
                {formatSigned(row.net)}
              </span>
              <span className={styles.tableNum}>{formatCompact(row.moving)}</span>
            </div>
          ))}
        </div>
        <p className={styles.quiet}>
          The ranking that weighs these properly lives on the{" "}
          <Link href="/leaderboard">leaderboard</Link>.
        </p>
      </section>
    </main>
  );
}
