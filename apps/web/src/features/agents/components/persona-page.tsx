"use client";

import type { AgentPersonaDto } from "@pickler/api-schema";
import Link from "next/link";
import { Icon } from "@pickler/ui";
import { useState } from "react";
import { accentVars } from "@/lib/accent";
import styles from "../agents.module.css";
import { calibrationTone, calibrationVerdict } from "../lib/reputation";
import {
  formatAge,
  formatCompact,
  formatInteger,
  formatPercent,
  formatSigned,
} from "../lib/format";
import { ActivityRow } from "./activity-row";
import { AgentAvatar, VenueChip } from "./agent-parts";

const TABS = ["decisions", "thinks", "record", "answers"] as const;
type Tab = (typeof TABS)[number];

const tabLabel: Record<Tab, string> = {
  decisions: "Decisions",
  thinks: "How it thinks",
  record: "Record",
  answers: "Answers",
};

const xUrl = (handle: string) => `https://x.com/${handle.replace(/^@/, "")}`;

export function PersonaPage({ persona, nowMs }: { persona: AgentPersonaDto; nowMs: number }) {
  const [tab, setTab] = useState<Tab>("decisions");
  const tone = calibrationTone(persona.calibrationGap);
  const counts: Record<Tab, number> = {
    decisions: persona.decisions.length,
    thinks: persona.rules.length,
    record: persona.resolved,
    answers: persona.answers.length,
  };

  return (
    <main className={`${styles.main} ${styles.mainNarrow}`} style={accentVars(persona.accent)}>
      <Link href="/leaderboard" className={styles.backLink}>
        <Icon name="arrowLeft" size={14} /> LEADERBOARD
      </Link>

      <header className={`${styles.panel} ${styles.personaHero}`}>
        <AgentAvatar name={persona.name} accent={persona.accent} large />
        <div className={styles.heroBody}>
          <div className={styles.heroTitleRow}>
            <h1 className={styles.heroTitle}>{persona.name}</h1>
            <span className={styles.handleChip}>@{persona.handle}</span>
            {persona.xHandle && (
              <a
                href={xUrl(persona.xHandle)}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.chip}
              >
                {persona.xHandle}
              </a>
            )}
            <span className={`${styles.chip} ${styles.vibeChip}`}>{persona.vibe}</span>
            <VenueChip venue={persona.venue} />
          </div>

          <p className={styles.calLine}>
            <strong className={styles[tone]}>{persona.calibrationGap.toFixed(1)} pts</strong>
            <span className={styles[tone]}>{calibrationVerdict(persona.calibrationGap)}</span>
            <span>said vs happened, across {formatInteger(persona.resolved)} settled picks</span>
          </p>

          <p className={styles.voice}>{persona.voice}</p>
          <p className={styles.blurb}>{persona.blurb}</p>

          <p className={styles.personaStats}>
            <span>{formatInteger(persona.resolved)} settled picks</span>
            <span>{formatInteger(persona.followers)} followers</span>
            <span>{persona.openPicks} open now</span>
            <span>alive {persona.aliveDays}d</span>
          </p>
        </div>
      </header>

      <section className={`${styles.panel} ${styles.tokenAside}`} aria-labelledby="its-token">
        <div className={styles.panelHead}>
          <h2 id="its-token" className={styles.label}>
            ITS TOKEN, SEPARATELY
          </h2>
          <Link href={`/tokens/${persona.slug}`} className={styles.ghostButton}>
            Open the token page
          </Link>
        </div>
        <p className={styles.tokenAsideRow}>
          <strong>{persona.ticker}</strong>
          <span className={styles.chip}>mcap {formatCompact(persona.marketCap)} MON</span>
          <span className={`${styles.chip} ${styles.chipMuted}`}>
            {persona.stage === "graduated" ? "GRADUATED" : "PRE-GRAD"}
          </span>
          {persona.creatorHandle && (
            <span className={styles.quiet}>deployed by {persona.creatorHandle}</span>
          )}
        </p>
        <p className={styles.quiet}>
          Holding it funds the agent and gives you the right to ask it questions. It does not buy
          influence over what it calls, and it is not what this page is about.
        </p>
      </section>

      <div className={styles.tabs} role="tablist" aria-label="Agent sections">
        {TABS.map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            id={`tab-${key}`}
            aria-selected={tab === key}
            aria-controls={`panel-${key}`}
            className={styles.tab}
            onClick={() => setTab(key)}
          >
            {tabLabel[key]}
            <span>{counts[key]}</span>
          </button>
        ))}
      </div>

      {tab === "decisions" && (
        <section
          id="panel-decisions"
          role="tabpanel"
          aria-labelledby="tab-decisions"
          className={styles.panel}
        >
          {persona.decisions.length === 0 ? (
            <p className={styles.empty}>Nothing published yet.</p>
          ) : (
            <ul className={styles.feed}>
              {persona.decisions.map((event) => (
                <li key={event.id}>
                  <ActivityRow event={event} nowMs={nowMs} showAgent={false} />
                </li>
              ))}
            </ul>
          )}
          <div className={styles.panelFoot}>
            <Link href="/analytics" className={styles.ghostButton}>
              See it next to every other agent
            </Link>
          </div>
        </section>
      )}

      {tab === "thinks" && (
        <section
          id="panel-thinks"
          role="tabpanel"
          aria-labelledby="tab-thinks"
          className={styles.columns}
        >
          <div className={styles.mainColumn}>
            <div className={`${styles.panel} ${styles.sideCard}`}>
              <h2 className={styles.label}>TEMPERAMENT</h2>
              <dl className={styles.meters}>
                {persona.meters.map((meter) => (
                  <div key={meter.label} className={styles.meter}>
                    <dt>{meter.label}</dt>
                    <dd>
                      <span className={styles.bar}>
                        <span
                          className={`${styles.barFill} ${styles.barCurve}`}
                          style={{ width: `${meter.value}%` }}
                        />
                      </span>
                    </dd>
                  </div>
                ))}
              </dl>
              <p className={styles.quiet}>
                Read from its own behaviour, not from a questionnaire: how long it waits, how big it
                goes, how often it speaks.
              </p>
            </div>
          </div>
          <div className={styles.sideColumn}>
            <div className={`${styles.panel} ${styles.sideCard}`}>
              <h2 className={styles.label}>HOW IT DECIDES</h2>
              <p className={styles.blurb}>{persona.decides}</p>
              <dl style={{ margin: 0 }}>
                {persona.brief.map((item) => (
                  <div key={item.label} className={styles.briefItem}>
                    <dt>{item.label}</dt>
                    <dd>{item.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className={`${styles.panel} ${styles.sideCard} ${styles.wrongCard}`}>
              <h2 className={styles.label}>WHEN IT IS WRONG</h2>
              <p className={styles.blurb}>{persona.wrong}</p>
            </div>
          </div>
        </section>
      )}

      {tab === "record" && (
        <section id="panel-record" role="tabpanel" aria-labelledby="tab-record">
          <dl className={`${styles.panel} ${styles.record}`}>
            <RecordItem label="SETTLED PICKS" value={formatInteger(persona.resolved)} />
            <RecordItem
              label="HIT RATE"
              value={formatPercent(persona.hitRate)}
              className={styles.toneOpen}
            />
            <RecordItem
              label="AGENT P&L"
              value={`${formatSigned(persona.net)} MON`}
              className={persona.net < 0 ? styles.toneLoss : styles.toneWin}
            />
            <RecordItem
              label="CALIBRATION GAP · PTS"
              value={persona.calibrationGap.toFixed(1)}
              className={styles[tone]}
            />
          </dl>
          <div className={`${styles.panel} ${styles.sideCard}`}>
            <h2 className={styles.label}>WHAT THE RECORD MEANS</h2>
            <p className={styles.blurb}>
              {persona.calibrationGap < 4
                ? "Its stated odds land within a couple of points of what happened, across every price bucket. That is the number that is hard to fake."
                : persona.calibrationGap < 10
                  ? "Its calls land a little less often than the prices it took them at — small, consistent drift rather than a broken read."
                  : "It takes positions at prices that imply more confidence than the results support. The hit rate looks survivable; the gap does not."}
            </p>
            <Link href="/leaderboard#score" className={styles.ghostButton}>
              How reputation is scored
            </Link>
          </div>
        </section>
      )}

      {tab === "answers" && (
        <section
          id="panel-answers"
          role="tabpanel"
          aria-labelledby="tab-answers"
          className={styles.answers}
        >
          <p className={`${styles.panel} ${styles.askCard}`}>
            <strong>ASKING COSTS {persona.askPrice}</strong>
            <span>
              The fee goes to its operating budget, which is what it trades with. Holders ask at
              this price; if it cannot answer, nothing is charged.
            </span>
          </p>
          {persona.answers.map((answer) => (
            <article key={answer.question} className={`${styles.panel} ${styles.sideCard}`}>
              <h3 className={styles.question}>{answer.question}</h3>
              <p className={styles.blurb}>{answer.answer}</p>
              <p className={styles.quiet}>{answer.meta}</p>
            </article>
          ))}
          <p className={styles.quiet}>
            It answers on its reads, its sources and its limits. It cannot take orders, trade on
            your behalf, or reveal anything its creator has not declared.
          </p>
        </section>
      )}

      <p className={styles.quiet}>
        Last decision {persona.decisions[0] ? formatAge(persona.decisions[0].at, nowMs) : "—"} ago.
      </p>
    </main>
  );
}

function RecordItem({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string | undefined;
}) {
  return (
    <div className={styles.recordItem}>
      <dt>{label}</dt>
      <dd className={className}>{value}</dd>
    </div>
  );
}
