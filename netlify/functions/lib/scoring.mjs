import { SentimentIntensityAnalyzer } from "vader-sentiment";
import { SCORING_CONFIG as Cfg } from "./scoring-config.mjs";
import fs from "node:fs";
import path from "node:path";

const curatedNotesPath = path.resolve(process.cwd(), "curated_notes.json");

function loadCuratedNotes() {
  try {
    return JSON.parse(fs.readFileSync(curatedNotesPath, "utf8"));
  } catch {
    return {};
  }
}

export function clamp(value) {
  return Math.max(0, Math.min(100, value));
}

export function validCredits(credits) {
  const today = new Date().toISOString().slice(0, 10);
  return credits
    .filter((credit) => {
      const character = (credit.character || "").trim();
      const releaseDate = (credit.release_date || "").trim();
      const genres = credit.genre_ids || [];
      return character &&
        !/\b(self|himself|herself|archive footage)\b/i.test(character) &&
        !/\(voice\)/i.test(character) &&
        !genres.includes(10770) &&
        !genres.some((genre) => Cfg.EXCLUDED_GENRES.includes(genre)) &&
        (credit.vote_count || 0) >= Cfg.VOTING_THRESHOLD &&
        releaseDate.length >= 10 &&
        releaseDate <= today;
    })
    .map((credit) => ({ ...credit, order: credit.order ?? 99 }));
}

export function validWorks(movieCredits, tvCredits) {
  const movies = validCredits(movieCredits).map((credit) => ({
    ...credit,
    title: credit.title || "",
    media_type: "movie"
  }));
  const today = new Date().toISOString().slice(0, 10);
  const series = (tvCredits || [])
    .filter((credit) => {
      const character = (credit.character || "").trim();
      const releaseDate = (credit.first_air_date || "").trim();
      const genres = credit.genre_ids || [];
      return character &&
        !/\b(self|himself|herself|archive footage)\b/i.test(character) &&
        !/\(voice\)/i.test(character) &&
        !genres.includes(10770) &&
        !genres.includes(99) &&
        (credit.vote_count || 0) >= Cfg.VOTING_THRESHOLD &&
        releaseDate.length >= 10 &&
        releaseDate <= today;
    })
    .map((credit) => ({
      ...credit,
      title: credit.name || "",
      release_date: credit.first_air_date || "",
      order: credit.order ?? 99,
      media_type: "tv"
    }));
  const works = new Map();
  for (const work of [...movies, ...series]) {
    const key = `${work.media_type}:${work.id}`;
    if (!works.has(key)) works.set(key, work);
  }
  return [...works.values()];
}

export function weight(order) {
  if (order === 0) return Cfg.CREDIT_WEIGHTS.order0;
  if (order === 1) return Cfg.CREDIT_WEIGHTS.order1;
  if (order === 2) return Cfg.CREDIT_WEIGHTS.order2;
  if (order >= 3 && order <= 5) return Cfg.CREDIT_WEIGHTS.order3to5;
  return Cfg.CREDIT_WEIGHTS.minor;
}

export function bayes(credit) {
  const votes = credit.vote_count;
  return (votes / (votes + Cfg.BAYESIAN.m)) * credit.vote_average +
    (Cfg.BAYESIAN.m / (votes + Cfg.BAYESIAN.m)) * Cfg.BAYESIAN.C;
}

export function quality(valid, qualityOptions = {}) {
  if (!valid.length) return 0;
  const directorMovieIds = new Set(qualityOptions.directorMovieIds || []);
  const sagaMovieIds = new Set(qualityOptions.sagaMovieIds || []);
  const awardMovieNames = qualityOptions.awardMovieNames || [];
  const fewLeadMovies = (qualityOptions.leadMovieCount ?? valid.filter((credit) => credit.order <= 2).length)
    < Cfg.LEAD_MOVIES_THRESHOLD;
  const fewWorks = fewLeadMovies ||
    (qualityOptions.allWorks && qualityOptions.allWorks.length < Cfg.FEW_WORKS_THRESHOLD);
  const qualityWorks = fewWorks ? (qualityOptions.allWorks || valid) : valid;
  if (!qualityWorks.length) return 0;
  const ranked = [...qualityWorks].map((credit) => {
    let finalWeight = weight(credit.order);
    const isImportant = directorMovieIds.has(credit.id) || sagaMovieIds.has(credit.id);
    if (fewWorks && credit.order <= 2) {
      finalWeight = Math.max(finalWeight, Cfg.FEW_WORKS_WEIGHT_FLOOR);
    } else if (fewWorks && credit.order > 2) {
      finalWeight *= Cfg.SECONDARY_WEIGHT;
    }
    if (fewWorks && credit.order > 2 && isImportant) {
      finalWeight = Math.max(
        Cfg.IMPORTANT_SECONDARY_FLOOR,
        finalWeight * Cfg.SAGA_MULTIPLIER
      );
    }
    if (directorMovieIds.has(credit.id)) finalWeight *= Cfg.DIRECTOR_MULTIPLIER;
    if (awardMovieNames.some((name) => name && credit.title &&
      name.toLowerCase().trim() === credit.title.toLowerCase().trim())) {
      finalWeight *= Cfg.AWARD_MOVIE_MULTIPLIER;
    }
    return { bayesian: bayes(credit), roleWeight: finalWeight };
  }).sort((a, b) => (b.bayesian * b.roleWeight) - (a.bayesian * a.roleWeight))
    .slice(0, Cfg.QUALITY.peakWorks);
  const n = ranked.reduce((sum, item) => sum + item.roleWeight, 0);
  const q = ranked.reduce((sum, item) => sum + item.roleWeight * item.bayesian, 0) / n;
  const minimum = Cfg.QUALITY.minimum;
  const maximum = Cfg.QUALITY.maximum;
  const midpoint = 6.5;
  let normalized;
  if (q <= midpoint) {
    normalized = 25 + ((q - minimum) / (midpoint - minimum)) * 30;
  } else {
    normalized = 55 + ((q - midpoint) / (maximum - midpoint)) * 45;
  }
  if (fewLeadMovies) normalized += Cfg.FEW_LEAD_QUALITY_BONUS;
  return clamp(normalized);
}

export function tier(label) {
  const lower = label.toLowerCase();
  for (const [awardTier, keywords] of Object.entries(Cfg.AWARD_TIER_KEYWORDS)) {
    if (keywords.some((keyword) => lower.includes(keyword))) return awardTier;
  }
  return null;
}

function interpretationFilter(label) {
  const lower = label.toLowerCase();
  const performanceMatch = Cfg.AWARD_KEYWORDS.performance.some((word) => lower.includes(word));
  if (!performanceMatch) return false;
  const explicitlyExcluded = Cfg.AWARD_KEYWORDS.excluded.some((word) => lower.includes(word));
  if (explicitlyExcluded) {
    const leadMatch = lower.includes("actor") || lower.includes("actress");
    if (!leadMatch) return false;
  }
  return true;
}

export function awardsScore(awards) {
  const ignored = [];
  const counted = [];
  const deduplicated = new Map();
  let wonOscar = false;
  let recentOscarWon = false;
  for (const award of awards) {
    const label = award.label || "";
    const awardTier = tier(label);
    if (awardTier === "0") {
      ignored.push({ label, reason: "Popularity award" });
      continue;
    }
    if (!interpretationFilter(label) || awardTier === null) {
      ignored.push({ label, reason: "Not an acting award" });
      continue;
    }
    const year = award.year || "";
    const work = award.work || "";
    const key = year ? `${label}|${year}` : work ? `${label}|${work}` : label;
    const existing = deduplicated.get(key);
    if (!existing || award.kind === "won") {
      deduplicated.set(key, { ...award, label, kind: award.kind === "won" ? "won" : "nominated", tier: awardTier });
    }
  }
  for (const award of deduplicated.values()) {
    const supporting = award.label.toLowerCase().includes("supporting");
    const role = supporting ? "supporting" : "lead";
    const lower = award.label.toLowerCase();
    const isOscar = (lower.includes("academy award") || lower.includes("oscar")) &&
      (lower.includes("actor") || lower.includes("actress") ||
       lower.includes("performance") || lower.includes("interpretation"));
    let points = isOscar
      ? Cfg.OSCAR_POINTS[role][award.kind]
      : Cfg.AWARD_TIERS[award.tier][role][award.kind];
    if (isOscar && award.kind === "won") wonOscar = true;
    const awardYear = Number.parseInt(award.year, 10);
    const recent = isOscar && award.kind === "won" &&
      Number.isInteger(awardYear) &&
      awardYear <= new Date().getFullYear() &&
      new Date().getFullYear() - awardYear <= Cfg.RECENT_OSCAR_WINDOW_YEARS;
    if (recent) {
      points *= Cfg.RECENT_OSCAR_MULTIPLIER;
      recentOscarWon = true;
    }
    counted.push({ ...award, role, points, recentOscar: recent });
  }
  const total = counted.reduce((sum, award) => sum + award.points, 0);
  let score = clamp(Math.min(100, Math.log(1 + total) * 100 / Cfg.AWARD_CURVE_DENOMINATOR));
  if (wonOscar) score = Math.max(score, Cfg.AWARDS_OSCAR_FLOOR);
  const summary = new Map();
  for (const award of counted) {
    let canonicalLabel = award.label;
    const lower = canonicalLabel.toLowerCase();
    if (lower.includes("golden globe") && lower.includes("best actress")) {
      canonicalLabel = "Golden Globe Award for Best Actress";
    }
    const key = `${canonicalLabel}|${award.role}`;
    const current = summary.get(key) || {
      label: canonicalLabel, tier: award.tier, role: award.role, won: 0, nominated: 0
    };
    current[award.kind]++;
    summary.set(key, current);
  }
  return [score, [...summary.values()], counted.length, ignored, recentOscarWon];
}

export function versatility(valid) {
  const groups = new Set();
  for (const credit of valid) {
    if (credit.order <= 3 && credit.vote_average >= 6.5) {
      for (const group of Cfg.GENRE_GROUPS) {
        if ((credit.genre_ids || []).some((genre) => group.ids.includes(genre))) groups.add(group.name);
      }
    }
  }
  return clamp((groups.size / Cfg.VERSATILITY_MAX_GROUPS) * 100);
}

export function reviewMovies(valid, limit = Cfg.REVIEW_MOVIES_LIMIT) {
  return [...valid]
    .sort((a, b) => (weight(b.order) * b.vote_count) - (weight(a.order) * a.vote_count))
    .slice(0, limit);
}

function terms(name, characters) {
  const termsSet = new Set([name.split(/\s+/).pop().toLowerCase(), name.toLowerCase()]);
  for (const character of characters) {
    for (const part of character.split(/[/(),]| and /i)) {
      const cleaned = part.replace(/\b(uncredited|voice|young|old)\b/gi, "").trim().toLowerCase();
      if (cleaned.length >= 4) termsSet.add(cleaned);
    }
  }
  return [...termsSet].map((term) =>
    new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i"));
}

export function sentiment(name, movies, reviewsByMovie) {
  const hits = [];
  movies.forEach((movie, index) => {
    const patterns = terms(name, [movie.character || ""]);
    for (const review of reviewsByMovie[index] || []) {
      const text = (review.content || "").replace(/\r/g, " ").replace(/\n/g, " ");
      for (const sentence of text.split(/(?<=[.!?])\s+/)) {
        if (patterns.some((pattern) => pattern.test(sentence))) {
          hits.push([SentimentIntensityAnalyzer.polarity_scores(sentence).compound, sentence.trim(), movie.title]);
        }
      }
    }
  });
  if (hits.length < Cfg.MIN_REVIEW_MENTIONS) return [null, []];
  const avg = hits.reduce((sum, hit) => sum + hit[0], 0) / hits.length;
  const good = [...hits].sort((a, b) => b[0] - a[0])
    .filter((hit) => hit[1].length >= 40 && hit[1].length <= 320).slice(0, 3);
  const score = clamp(((avg + Cfg.SENTIMENT.reference) / Cfg.SENTIMENT.divisor) * 100);
  return [score, good.map((hit) => ({ text: hit[1], movie: hit[2] }))];
}

export function compute(person, credits, awardsInput = [], reviewsByMovie = [], revMovies = [], qualityOptions = {}) {
  const awardsAvailable = Array.isArray(awardsInput)
    ? true
    : awardsInput.available !== false;
  const awards = Array.isArray(awardsInput) ? awardsInput : (awardsInput.awards || []);
  const valid = validCredits(credits);
  const [awardsValue, notable, awardCount, ignoredAwards, recentOscarWon] = awardsScore(awards);
  const awardMovieNames = [...new Set(awards
    .filter((award) => award.kind === "won" && award.work)
    .map((award) => award.work))];
  qualityOptions = {
    ...qualityOptions,
    awardMovieNames: [...(qualityOptions.awardMovieNames || []), ...awardMovieNames]
  };
  const allWorks = qualityOptions.allWorks || valid;
  const fewWorks = allWorks.length < Cfg.FEW_WORKS_THRESHOLD;
  const fewLeadMovies = (qualityOptions.leadMovieCount ?? valid.filter((credit) => credit.order <= 2).length)
    < Cfg.LEAD_MOVIES_THRESHOLD;
  const fewCredits = fewWorks || fewLeadMovies;
  qualityOptions.allWorks = allWorks;
  const [sentimentValue, excerpts] = sentiment(person.name, revMovies, reviewsByMovie);
  const pillars = {
    quality: quality(valid, qualityOptions),
    awards: awardsValue,
    versatility: versatility(valid),
    sentiment: sentimentValue
  };
  const weighted = Object.fromEntries(
    Object.entries(Cfg.WEIGHTS).filter(([key]) => pillars[key] !== null)
  );
  const totalWeight = Object.values(weighted).reduce((sum, value) => sum + value, 0);
  let score = totalWeight
    ? Object.entries(weighted).reduce((sum, [key, weightValue]) =>
        sum + pillars[key] * weightValue / totalWeight, 0)
    : 0;
  if (sentimentValue === null) score = Math.min(score, Cfg.SENTIMENT.cappedScore);
  score = Math.min(score, Cfg.QUALITY.finalScoreCap);
  const leads = [...valid].filter((credit) => credit.order <= Cfg.TOP_LEAD_MAX_ORDER)
    .sort((a, b) => b.vote_average - a.vote_average);
  const curatedNotes = loadCuratedNotes();
  const curated = curatedNotes[String(person.id)] || curatedNotes[person.name] || null;
  const cleanSummary = (person.biography || "")
    .replace(/\u00c2/g, "")
    .replace(/\u00a0/g, " ")
    .normalize("NFKC")
    .trim()
    .slice(0, 320);
  return {
    id: person.id,
    name: person.name,
    profile: person.profile_path || null,
    summary: cleanSummary,
    score: Math.round(score),
    scoring_version: Cfg.SCORING_VERSION,
    pillars: Object.fromEntries(Object.entries(pillars).map(([key, value]) =>
      [key, value === null ? null : Math.round(value)])),
    awards: notable,
    award_count: awardCount,
    ignored_awards: ignoredAwards,
    awards_available: awardsAvailable,
    few_works: fewCredits,
    few_lead_movies: fewLeadMovies,
    lead_movie_count: qualityOptions.leadMovieCount ?? valid.filter((credit) => credit.order <= 2).length,
    saga_movie_count: qualityOptions.sagaMovieCount || 0,
    recent_oscar_won: recentOscarWon,
    valid_work_count: allWorks.length,
    director_movie_count: qualityOptions.directorMovieCount || 0,
    curated_notes: curated ? (Array.isArray(curated) ? curated : [curated]) : [],
    excerpts,
    leads: leads.slice(0, 6).map((credit) => ({
      id: credit.id,
      title: credit.title,
      rating: Math.round(credit.vote_average * 10) / 10,
      year: (credit.release_date || "").slice(0, 4)
    }))
  };
}
