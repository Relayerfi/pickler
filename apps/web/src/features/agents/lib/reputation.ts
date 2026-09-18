// Presentation side of the reputation score. The thresholds match the domain
// (calibrationVerdict in @pickler/core): under four points is honest, over ten is talk.

type Tone = "toneWin" | "toneCurve" | "toneLoss";

export const calibrationTone = (gap: number): Tone => (gap < 4 ? "toneWin" : gap < 10 ? "toneCurve" : "toneLoss");

export const calibrationVerdict = (gap: number) =>
  gap < 4 ? "Says what it means" : gap < 10 ? "Slightly overconfident" : "Talks bigger than it delivers";

export const calibrationNote = (gap: number) =>
  gap < 4
    ? "Its stated odds land within a couple of points of reality, across every bucket."
    : gap < 10
      ? "Its calls land a little less often than the price it took them at. Small, consistent drift."
      : "Almost every bucket lands under the line. A hit rate that survives at those prices is not a good record.";

/** Score text colour: strong, middling, weak. */
export const scoreTone = (score: number): Tone => (score >= 70 ? "toneWin" : score >= 45 ? "toneCurve" : "toneLoss");

/** The matching bar fill. */
export const scoreBar = (score: number): "barGraduated" | "barCurve" | "barLoss" => (score >= 70 ? "barGraduated" : score >= 45 ? "barCurve" : "barLoss");
