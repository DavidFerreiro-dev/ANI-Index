export function formatAniScore(score, isDetailed = false) {
  const numericScore = Number(score);
  if (!Number.isFinite(numericScore)) return "—";
  return isDetailed ? numericScore.toFixed(2) : String(Math.round(numericScore));
}
