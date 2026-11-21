import { useEffect, useState } from "react";
import { X } from "lucide-react";
import ScoreBadge from "./ScoreBadge.jsx";

const FALLBACK = {
  SCORING_VERSION: 16,
  WEIGHTS: { quality: 0.40, awards: 0.30, versatility: 0.15, sentiment: 0.15 },
  BAYESIAN: { C: 6.5, m: 200, shrinkageK: 3 },
  QUALITY: { minimum: 5.5, maximum: 7.8 },
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
      <div role="dialog" aria-modal="true" aria-label="Criteria" onClick={(e) => e.stopPropagation()}
           className="relative my-8 w-full max-w-3xl rounded-3xl border border-line bg-coal p-6 text-sm leading-relaxed text-slate-300 sm:p-8">
        <button onClick={onClose} aria-label="Close" className="absolute right-4 top-4 rounded-full p-2 hover:bg-card"><X size={22} /></button>
        <h2 className="text-2xl font-extrabold text-white">Criteria</h2>

        <h3 className="mt-6 text-lg font-bold text-white">Data Sources</h3>
        <p className="mt-1">Filmography, credits and reviews come from TMDb. Awards and nominations come from Wikidata.</p>
        <p className="mt-2 text-slate-400">This product uses the TMDb API but is not endorsed or certified by TMDb.</p>
        <p className="text-slate-400">Awards data from Wikidata (CC0).</p>

        <h3 className="mt-6 text-lg font-bold text-white">Scoring Formula</h3>
        <p className="mt-1">Each actor receives an estimated acting-merit score from 0 to 100.</p>
        <ul className="mt-2 list-disc space-y-2 pl-5">
          <li><b className="text-white">Filmography Quality ({Math.round(weights.quality * 100)}%)</b>: A Bayesian-adjusted rating uses C = {config.BAYESIAN.C}, m = {config.BAYESIAN.m}. Billing order is weighted 1.00 at order 0, 0.80 at order 1, 0.60 at order 2, 0.35 for orders 3–5, and 0.10 after order 5. The quality pillar uses the six strongest weighted works, so a large catalog does not automatically reduce the score. “Top Lead Projects” includes billing orders 0–1.</li>
          <li><b className="text-white">Awards Prestige ({Math.round(weights.awards * 100)}%)</b>: Deduplicated wins and nominations follow a logarithmic curve. Oscar acting awards carry the highest impact: 25/9 points for lead wins/nominations and 18/6 for supporting wins/nominations. Any actor with an Oscar acting win has at least 75 in this pillar. Other lead Tier S awards are 15/6, Tier A 7/3 and Tier B 3/1; supporting awards are 11/4.5, 5/2 and 2/0.7.</li>
          <li><b className="text-white">Genre Versatility ({Math.round(weights.versatility * 100)}%)</b>: Similar genres are grouped: Action/Adventure, Crime/Thriller/Mystery, Science Fiction/Fantasy, Romance/Drama, and other categories. Top-three billing and rating of at least 6.5 are required. Six or more distinct groups score 100.</li>
          <li><b className="text-white">Critical Sentiment ({Math.round(weights.sentiment * 100)}%)</b>: VADER analyzes only review sentences mentioning the actor or character. At least 3 mentions are required. The formula is (average + 0.2) / 0.8 × 100. An omitted sentiment pillar redistributes its weight and caps the final score at 98.</li>
        </ul>
        <p className="mt-3">Excluded credits: self, himself/herself, archive footage, documentaries, voice roles, TV movies (genre 10770), releases without a date or in the future, and films with fewer than 50 votes.</p>
        <p className="mt-2">Actors with few credits are evaluated on their whole filmography, including supporting roles and series. With fewer than 12 valid works, minor billing weights are raised to at least 0.65, shrinkage is lighter, and the weighted result receives a calibrated 8-point quality adjustment. Adding more mediocre works does not increase the score by itself.</p>
        <p className="mt-2">Actors with fewer than five lead movies have all of their supporting appearances counted. Ordinary supporting roles receive less weight, while supporting work in important sagas or films directed by the curated prestige directors receives extra weight. A performance Oscar won within five years receives double Oscar points.</p>

        <h3 className="mt-6 text-lg font-bold text-white">Director Prestige</h3>
        <p>Films by a curated list of acclaimed directors count 25% more, all equally. The list is a fixed editorial selection. The same 1.25× multiplier applies regardless of which listed director is involved, and is not applied when the actor is also the director. Director credits are checked for the 15 highest-weight films and cache the movie-director result.</p>

        <h3 className="mt-6 text-lg font-bold text-white">What Counts as an Award</h3>
        <p className="mt-1">Only performance-related labels count: actor, actress, performance, interpretation, cast or ensemble. Director, picture/film, screenplay, score, song, editing, producer, documentary and short awards are excluded. “Supporting” identifies supporting awards; otherwise, an award is treated as lead.</p>
        <p className="mt-2"><b>Tier S:</b> Academy Award/Oscar, BAFTA, Cannes acting awards, Volpi Cup, Silver Bear for acting and Goya.</p>
        <p><b>Tier A:</b> Golden Globe, Primetime Emmy acting, SAG, Critics’ Choice, César, Feroz and Independent Spirit.</p>
        <p><b>Tier B:</b> NYFCC, LAFCA, National Board of Review, National Society of Film Critics, Gotham and Satellite.</p>
        <p className="mt-2">Kids’ Choice, Teen Choice, MTV, People’s Choice, Nickelodeon and Razzie/Golden Raspberry awards are ignored. Wikidata entries are deduplicated by award and year, or award and work when no year is available.</p>

        <h3 className="mt-6 text-lg font-bold text-white">Limitations</h3>
        <p>Award data comes from Wikidata and may be incomplete. Review sentiment is based on user reviews from TMDb and may be sparse for some actors. Scores are an estimate of acting merit, not an objective ranking.</p>

        <h3 className="mt-6 text-lg font-bold text-white">Badge Legend</h3>
        <div className="mt-3 flex flex-wrap gap-5">
          {LEGEND.map(([score, label]) => (
            <div key={label} className="flex flex-col items-center gap-2">
              <ScoreBadge score={score} size={52} />
              <span className="text-xs">{label}</span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-slate-400">Diamond (90–100) requires all four pillars and is exceptional. Gold is 80–89.</p>
        <p className="mt-6 border-t border-line pt-4 text-xs text-slate-500">Scoring version {config.SCORING_VERSION}</p>
      </div>
    </div>
  );
}
