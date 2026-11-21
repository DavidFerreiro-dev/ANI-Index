import { useEffect, useState } from "react";
import { X } from "lucide-react";
import ScoreBadge from "./ScoreBadge.jsx";

const FALLBACK = {
  SCORING_VERSION: 18,
  WEIGHTS: { quality: 0.40, awards: 0.30, versatility: 0.10, sentiment: 0.10, commercial: 0.10 },
  BAYESIAN: { C: 6.5, m: 200, shrinkageK: 3 },
  QUALITY: { minimum: 6.0, maximum: 7.8, manyMaxWorks: 8, finalScoreCap: 100 },
  FILMOGRAPHY_WORKS: { few: 6, many: 14 },
  DIRECTOR_MULTIPLIER: 1.25,
  VOTING_THRESHOLD: 50,
  VERSATILITY_MAX_GROUPS: 6,
};

const LEGEND = [
  [20, "0–39 Red"],
  [50, "40–59 Bronze"],
  [70, "60–79 Silver"],
  [85, "80–89 Gold"],
  [100, "90–100 Diamond"]
];

export default function CriteriaModal({ onClose }) {
  const [config, setConfig] = useState(FALLBACK);
  useEffect(() => {
    fetch("/api/config")
      .then((response) => response.ok ? response.json() : FALLBACK)
      .then(setConfig)
      .catch(() => setConfig(FALLBACK));
  }, []);
  const weights = config.WEIGHTS;

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-auto bg-black/75 p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Criteria" onClick={(event) => event.stopPropagation()}
           className="relative my-8 w-full max-w-3xl rounded-3xl border border-line bg-coal p-6 text-sm leading-relaxed text-slate-300 sm:p-8">
        <button onClick={onClose} aria-label="Close" className="absolute right-4 top-4 rounded-full p-2 hover:bg-card">
          <X size={22} />
        </button>
        <h2 className="text-2xl font-extrabold text-white">Criteria</h2>

        <h3 className="mt-6 text-lg font-bold text-white">Data Sources</h3>
        <p className="mt-1">Filmography, credits and reviews come from TMDb. Awards and nominations come from Wikidata.</p>
        <p className="mt-2 text-slate-400">This product uses the TMDb API but is not endorsed or certified by TMDb.</p>
        <p className="text-slate-400">Awards data from Wikidata (CC0).</p>

        <h3 className="mt-6 text-lg font-bold text-white">Overall Score</h3>
        <p className="mt-1">
          The final score is a weighted average: Filmography Quality {Math.round(weights.quality * 100)}%,
          Awards Prestige {Math.round(weights.awards * 100)}%, Genre Versatility {Math.round(weights.versatility * 100)}%,
          Critical Sentiment {Math.round(weights.sentiment * 100)}%, and Commercial Impact {Math.round(weights.commercial * 100)}%.
        </p>
        <p className="mt-2">If a pillar is unavailable, its weight is redistributed proportionally among the available pillars. If a pillar or two is missing, the final score is capped at 89.</p>

        <h3 className="mt-6 text-lg font-bold text-white">Filmography Quality ({Math.round(weights.quality * 100)}%)</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Valid works include released movies and series with at least {config.VOTING_THRESHOLD} votes, excluding documentaries, TV movies, self appearances, archive footage and voice roles.</li>
          <li>With {config.FILMOGRAPHY_WORKS.few} valid works or fewer, all works are used. With {config.FILMOGRAPHY_WORKS.many} or more, the {config.QUALITY.manyMaxWorks} strongest weighted works are used. Between those limits, the number of works is interpolated.</li>
          <li>Billing weights: order 0 = 1.00, order 1 = 0.80, order 2 = 0.60, orders 3–5 = 0.35, and orders above 5 = 0.10.</li>
          <li>The Bayesian rating uses C = {config.BAYESIAN.C} and m = {config.BAYESIAN.m}. It is normalized from {config.QUALITY.minimum} to {config.QUALITY.maximum} and recounted as 0–100.</li>
          <li>A film directed by any person in the curated prestige-director list receives a single {config.DIRECTOR_MULTIPLIER}× multiplier. The actor does not receive it if the actor is also the director.</li>
          <li>Awarded films identified by Wikidata receive an additional 1.15× quality weight.</li>
        </ul>

        <h3 className="mt-6 text-lg font-bold text-white">Awards Prestige ({Math.round(weights.awards * 100)}%)</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Only acting and performance labels count. Awards for directing, films/pictures, screenplay, music, editing, producing or other non-acting work are ignored.</li>
          <li>P166 wins and P1411 nominations are combined with inverse P1346 winner statements. Missing Wikidata identifiers are resolved by exact name, actor occupation P106 and birth date where available.</li>
          <li>Each pair of award and year is counted once. If no year exists, award and work are used. Victory wins over a nomination in the same pair.</li>
          <li>Oscar acting wins and nominations: lead 25/9, supporting 18/6. A won acting Oscar establishes a minimum Awards Prestige score of 75.</li>
          <li>Other Tier S lead/supporting: 15/6 and 11/4.5. Tier A: 7/3 and 5/2. Tier B: 3/1 and 2/0.7.</li>
          <li>The final award score is min(100, ln(1 + points) × 100 / ln(101)).</li>
        </ul>

        <h3 className="mt-6 text-lg font-bold text-white">Genre Versatility ({Math.round(weights.versatility * 100)}%)</h3>
        <p className="mt-1">It counts distinct grouped genres in movies with order 0–3 and rating at least 6.5. Action/Adventure, Crime/Thriller/Mystery, Science Fiction/Fantasy and Romance/Drama are grouped. Animation and Family are separate. Six or more groups score 100.</p>

        <h3 className="mt-6 text-lg font-bold text-white">Critical Sentiment ({Math.round(weights.sentiment * 100)}%)</h3>
        <p className="mt-1">VADER is applied only to review sentences that mention the actor or a character. At least 3 mentions are required. The score is clamp((average + 0.2) / 0.8 × 100). Sparse reviews omit the pillar and do not count it as zero.</p>

        <h3 className="mt-6 text-lg font-bold text-white">Commercial Impact ({Math.round(weights.commercial * 100)}%)</h3>
        <p className="mt-1">Standalone and collection films released in 1980 or later are scored by log10(revenue): 10 million = 0 and 1 billion = 100. From each collection, only the actor's highest-grossing appearance is counted. Missing revenue and pre-1980 films are excluded. Standalone and representative collection movies are weighted by billing order and director prestige. Fewer than 2 valid commercial movies omit the pillar.</p>

        <h3 className="mt-6 text-lg font-bold text-white">Limitations</h3>
        <p>Award data comes from Wikidata and may be incomplete. TMDb review sentiment may be sparse. Commercial revenue is not a quality metric. Scores are estimates of acting merit, not objective rankings.</p>

        <h3 className="mt-6 text-lg font-bold text-white">Badge Legend</h3>
        <div className="mt-3 flex flex-wrap gap-5">
          {LEGEND.map(([score, label]) => (
            <div key={label} className="flex flex-col items-center gap-2">
              <ScoreBadge score={score} size={52} />
              <span className="text-xs">{label}</span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-slate-400">Diamond (90–100) requires all applicable pillars and is exceptional. Gold is 80–89.</p>
        <p className="mt-6 border-t border-line pt-4 text-xs text-slate-500">Scoring version {config.SCORING_VERSION}</p>
      </div>
    </div>
  );
}
