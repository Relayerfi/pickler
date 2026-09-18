import type { AccentDto, AgentSummaryDto, VenueDto } from "@pickler/api-schema";
import Image from "next/image";
import { accentVars } from "@/lib/accent";
import styles from "../agents.module.css";
import { formatInteger, initials } from "../lib/format";

export function AgentAvatar({ name, accent, large = false, small = false }: { name: string; accent: AccentDto; large?: boolean; small?: boolean }) {
  return (
    <span
      className={`${styles.avatar} ${large ? styles.avatarLarge : ""} ${small ? styles.avatarSmall : ""}`}
      style={accentVars(accent)}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}

export function StageBadge({ token }: { token: AgentSummaryDto["token"] }) {
  if (!token) return <span className={`${styles.stage} ${styles.stageNone}`}>NO TOKEN</span>;
  const graduated = token.stage === "graduated";
  return <span className={`${styles.stage} ${graduated ? styles.stageGraduated : ""}`}>{graduated ? "GRADUATED" : "PRE-GRAD"}</span>;
}

/** Where the token trades: our curve on Monad before graduation, Pons on Robinhood Chain after it. */
export function VenueMarks({ token }: { token: AgentSummaryDto["token"] }) {
  if (!token) return null;
  const marks =
    token.stage === "graduated"
      ? [
          { src: "/brand/pons.png", label: "Graduated on Pons" },
          { src: "/brand/robinhood.png", label: "Robinhood Chain" },
        ]
      : [
          { src: "/brand/logo.png", label: "On the Pickler curve" },
          { src: "/brand/monad.png", label: "Monad" },
        ];
  return (
    <span className={styles.marks}>
      {marks.map((mark) => (
        <span key={mark.src} className={styles.mark} title={mark.label}>
          <Image src={mark.src} alt={mark.label} width={64} height={64} unoptimized />
        </span>
      ))}
    </span>
  );
}

const venueLabel: Record<VenueDto, string> = { predictions: "PREDICTION MARKETS", perps: "PERPL", both: "PREDICTIONS + PERPL" };

export function VenueChip({ venue }: { venue: VenueDto }) {
  return <span className={`${styles.chip} ${styles.venueChip}`}>{venueLabel[venue]}</span>;
}

export function CurveProgress({
  token,
  className,
  bareBar = false,
}: {
  token: NonNullable<AgentSummaryDto["token"]>;
  className?: string | undefined;
  bareBar?: boolean;
}) {
  const target = token.graduationTarget;
  const graduated = token.stage === "graduated";
  const ratio = graduated ? 1 : Math.min(1, target > 0 ? token.raised / target : 0);
  return (
    <span className={className}>
      <span
        className={styles.bar}
        role="progressbar"
        aria-label="Progress to graduation"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(ratio * 100)}
      >
        <span className={`${styles.barFill} ${graduated ? styles.barGraduated : styles.barCurve}`} style={{ width: `${ratio * 100}%` }} />
      </span>
      {!bareBar && (
        <span className={styles.curveNote}>
          {graduated ? "graduated · trading in a pool" : `${formatInteger(token.raised)} / ${formatInteger(target)} MON to graduate`}
        </span>
      )}
    </span>
  );
}
