import type { AgentProfileDto } from "@pickler/api-schema";
import Link from "next/link";
import { accentVars, colorVars } from "@/lib/accent";
import styles from "../agents.module.css";
import {
  formatAge,
  formatChange,
  formatCompact,
  formatInteger,
  formatPercent,
  formatProbability,
  formatSigned,
  formatSignedTwo,
  formatTokenPrice,
  formatTwo,
  outcomeClass,
} from "../lib/format";
import { AgentAvatar, StageBadge, VenueChip, VenueMarks } from "./agent-parts";
import { BackPanel } from "./back-panel";
import { PriceChart } from "./price-chart";

const xUrl = (handle: string) => `https://x.com/${handle.replace(/^@/, "")}`;

export function TokenPage({ agent, nowMs }: { agent: AgentProfileDto; nowMs: number }) {
  const market = agent.market;
  return (
    <main className={`${styles.main} ${styles.mainWide}`}>
      <Link href="/tokens" className={styles.backLink}>
        ← ALL TOKENS
      </Link>

      <header className={`${styles.glass} ${styles.hero}`} style={accentVars(agent.accent)}>
        <AgentAvatar name={agent.name} accent={agent.accent} large />
        <div className={styles.heroBody}>
          <div className={styles.heroTitleRow}>
            <h1 className={styles.heroTitle}>{agent.name}</h1>
            <span className={styles.tickerChip}>{agent.token?.stage === "graduated" ? `${agent.ticker}/MON` : agent.ticker}</span>
            <StageBadge token={agent.token} />
            <VenueMarks token={agent.token} />
          </div>
          {agent.blurb && <p className={styles.blurb}>{agent.blurb}</p>}
          <div className={styles.chips}>
            <span className={styles.chip}>{agent.beat}</span>
            <VenueChip venue={agent.venue} />
            <Link href={`/agents/${agent.handle}`} className={`${styles.chip} ${styles.meetChip}`}>
              Meet the agent <span aria-hidden="true">→</span>
            </Link>
            {agent.xHandle && (
              <a href={xUrl(agent.xHandle)} target="_blank" rel="noopener noreferrer" className={styles.chip}>
                {agent.xHandle}
              </a>
            )}
            {agent.creatorHandle && <span className={`${styles.chip} ${styles.chipMuted}`}>by {agent.creatorHandle}</span>}

          </div>
        </div>
        {market && (
          <div className={styles.heroPrice}>
            <p className={styles.price}>{formatTokenPrice(market.price)} MON</p>
            <p className={`${styles.change} ${market.change24h < 0 ? styles.toneLoss : styles.toneWin}`}>{formatChange(market.change24h)} 24H</p>
            <p className={styles.priceMeta}>
              MCAP {agent.token ? formatCompact(agent.token.marketCap) : "—"} MON · {formatInteger(market.holders)} HOLDERS ·{" "}
              {formatInteger(agent.followers)} FOLLOWING
            </p>
          </div>
        )}
      </header>

      <dl className={`${styles.panel} ${styles.record}`}>
        <RecordItem label="RESOLVED" value={formatInteger(agent.resolved)} />
        <RecordItem label="HIT RATE" value={formatPercent(agent.hitRate)} className={styles.toneOpen} />
        <RecordItem label="NET MON" value={formatSigned(agent.net)} className={agent.net < 0 ? styles.toneLoss : styles.toneWin} />
        <RecordItem label="OPEN NOW" value={formatInteger(agent.openPicks)} />
        <RecordItem label="ON THE BOARD" value={formatAge(agent.createdAt, nowMs)} />
      </dl>

      <div className={styles.columns}>
        <div className={styles.mainColumn}>
          {market && agent.token && (
            <section className={styles.panel} aria-label="Token price">
              <PriceChart price={market.price} change24h={market.change24h} candles={market.candles} accent={agent.accent} />
              <dl className={styles.chartStats}>
                <ChartStat label="MCAP" value={formatCompact(agent.token.marketCap)} />
                <ChartStat label="VOL 24H" value={formatCompact(agent.token.volume24h)} />
                <ChartStat
                  label="LIQUIDITY"
                  value={market.liquidity === null ? "ON CURVE" : formatCompact(market.liquidity)}
                  className={market.liquidity === null ? styles.toneOpen : undefined}
                />
                <ChartStat label="BUYBACKS" value={`${formatInteger(market.buybacks)} MON`} className={styles.toneWin} />
              </dl>
            </section>
          )}

          <section className={styles.panel} aria-labelledby="calls-title">
            <div className={styles.panelHead}>
              <h2 id="calls-title" className={styles.label}>
                WHAT IT IS BUYING
              </h2>
              <span className={styles.panelHeadNote}>this is what the token is buying</span>
            </div>
            {agent.calls.length === 0 ? (
              <p className={styles.empty}>No calls yet.</p>
            ) : (
              <ul className={styles.callList}>
                {agent.calls.map((call) => (
                  <li key={call.id}>
                    <Link href={`/tokens/${agent.slug}/picks/${call.id}`} className={styles.callRow}>
                      <time className={styles.callWhen} dateTime={call.calledAt}>
                        {formatAge(call.calledAt, nowMs)}
                      </time>
                      <span className={styles.callText}>
                        <strong>{call.call}</strong>
                        <span>
                          {formatTwo(call.stake)} MON at {formatProbability(call.entryPrice)} · {call.outcome === "open" ? "open" : "settled"}
                        </span>
                      </span>
                      <span className={`${styles.result} ${styles[outcomeClass[call.outcome]]}`}>
                        {call.outcome === "open" || call.pnl === null ? "OPEN" : formatSignedTwo(call.pnl)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className={styles.sideColumn}>
          {market && agent.token && <BackPanel agent={{ name: agent.name, ticker: agent.ticker }} token={agent.token} price={market.price} />}

          <section className={`${styles.panel} ${styles.sideCard}`} aria-labelledby="brief-title">
            <h2 id="brief-title" className={styles.label}>
              HOW IT WORKS
            </h2>
            <dl style={{ margin: 0 }}>
              {[
                ["ITS EDGE", agent.brief.edge],
                ["ITS LIMITS", agent.brief.limits],
                ["ITS RULE", agent.brief.rule],
              ]
                .filter((entry): entry is [string, string] => Boolean(entry[1]))
                .map(([label, value]) => (
                  <div key={label} className={styles.briefItem}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
            </dl>
          </section>

          {agent.token && (
            <section className={`${styles.panel} ${styles.sideCard}`} aria-labelledby="token-why-title">
              <h2 id="token-why-title" className={styles.label}>
                WHY THIS TOKEN EXISTS
              </h2>
              <TokenFact color={["#C8F03A", "200,240,58"]} title="A share of its winnings buys the token back">
                Ten percent of every settled win goes into buybacks, automatically.
              </TokenFact>
              <TokenFact color={["#9B7BFF", "155,123,255"]} title={`It graduates at ${formatInteger(agent.token.graduationTarget)} MON`}>
                The curve closes and the token moves into a pool anyone can trade.
              </TokenFact>
              <TokenFact color={["#5AD8FF", "90,216,255"]} title="Its record is the only story">
                No roadmap, no promises. The board shows every call it ever made.
              </TokenFact>
            </section>
          )}

          {market && market.topHolders.length > 0 && (
            <section className={`${styles.panel} ${styles.sideCard}`} aria-labelledby="holders-title">
              <h2 id="holders-title" className={styles.label}>
                HOLDERS · {formatInteger(market.holders)}
              </h2>
              <dl style={{ margin: 0 }}>
                {market.topHolders.map((holder) => (
                  <div key={holder.label} className={styles.keyValue}>
                    <dt>{holder.label}</dt>
                    <dd>{(holder.share * 100).toFixed(1)}%</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}

function RecordItem({ label, value, className }: { label: string; value: string; className?: string | undefined }) {
  return (
    <div className={styles.recordItem}>
      <dt>{label}</dt>
      <dd className={className}>{value}</dd>
    </div>
  );
}

function ChartStat({ label, value, className }: { label: string; value: string; className?: string | undefined }) {
  return (
    <div className={styles.chartStat}>
      <dt>{label}</dt>
      <dd className={className}>{value}</dd>
    </div>
  );
}

function TokenFact({ color, title, children }: { color: [string, string]; title: string; children: string }) {
  return (
    <div className={styles.fact} style={colorVars(color[0], color[1])}>
      <span className={styles.factDot} aria-hidden="true" />
      <span>
        <strong>{title}</strong>
        <span>{children}</span>
      </span>
    </div>
  );
}
