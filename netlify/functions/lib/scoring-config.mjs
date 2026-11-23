export const SCORING_CONFIG = {
  SCORING_VERSION: "20.8",
  WEIGHTS: { quality: 0.40, awards: 0.30, versatility: 0.10, sentiment: 0.10, commercial: 0.10 },
  BAYESIAN: { C: 6.5, m: 200, shrinkageK: 3 },
  QUALITY: { minimum: 6.0, maximum: 7.8, manyMaxWorks: 8, finalScoreCap: 100 },
  FILMOGRAPHY_WORKS: { few: 6, many: 14 },
  CREDIT_WEIGHTS: { order0: 1.0, order1: 0.8, order2: 0.60, order3to5: 0.35, minor: 0.10 },
  DIRECTOR_MULTIPLIER: 1.25,
  TOP_LEAD_MAX_ORDER: 1,
  AWARD_MOVIE_MULTIPLIER: 1.15,
  VOTING_THRESHOLD: 50,
  COMMERCIAL_REVENUE_MIN_LOG: 7,
  COMMERCIAL_REVENUE_MAX_LOG: 9,
  COMMERCIAL_MIN_VALID_MOVIES: 2,
  REVIEW_MOVIES_LIMIT: 6,
  MIN_REVIEW_MENTIONS: 3,
  SENTIMENT: { reference: 0.2, divisor: 0.8, missingPillarCap: 89 },
  AWARD_TIERS: {
    S: { lead: { won: 24, nominated: 8 }, supporting: { won: 11, nominated: 4.5 } },
    A: { lead: { won: 10, nominated: 4 }, supporting: { won: 5, nominated: 2 } },
    B: { lead: { won: 3, nominated: 1 }, supporting: { won: 2, nominated: 0.7 } },
    "0": { lead: { won: 0, nominated: 0 }, supporting: { won: 0, nominated: 0 } }
  },
  OSCAR_POINTS: {
    lead: { won: 38, nominated: 10 },
    supporting: { won: 18, nominated: 6 }
  },
  TIER_B_CAP: 15,
  OTHER_AWARD_POINTS: 0.5,
  OTHER_AWARD_CAP: 10,
  AWARDS_OSCAR_FLOOR: 75,
  AWARD_CURVE_DENOMINATOR: Math.log(101),
  AWARD_KEYWORDS: {
    performance: ["actor", "actress", "performance", "interpretation", "cast", "ensemble"],
    excluded: ["director", "picture", "screenplay", "score", "song", "editing", "producer", "documentary", "short"]
  },
  AWARD_TIER_KEYWORDS: {
    "0": ["kids' choice", "kids choice", "teen choice", "mtv", "people's choice", "peoples choice", "nickelodeon", "razzie", "golden raspberry"],
    B: ["sitges", "saturn award", "saturn awards", "satellite", "nyfcc", "lafca", "national board of review", "national society of film critics", "new york film critics", "los angeles film critics", "london film critics", "gotham"],
    S: ["academy award", "oscar", "premio oscar", "bafta", "volpi cup", "coppa volpi", "silver bear", "goya award", "premio goya", "cannes film festival award", "prix d'interprétation", "festival de cannes"],
    A: ["golden globe", "primetime emmy", "screen actors guild", "sag award", "actor award", "critics' choice", "critics choice", "césar", "cesar award", "premios feroz", "feroz award", "independent spirit", "gotham award", "gotham awards", "british independent film", "bifa"]
  },
  GENRE_GROUPS: [
    { name: "Action/Adventure", ids: [28, 12] },
    { name: "Crime/Thriller/Mystery", ids: [80, 53, 9648] },
    { name: "Science Fiction/Fantasy", ids: [878, 14] },
    { name: "Romance/Drama", ids: [10749, 18] },
    { name: "Animation", ids: [16] },
    { name: "Family", ids: [10751] },
    { name: "Comedy", ids: [35] },
    { name: "Horror", ids: [27] },
    { name: "Music", ids: [10402] },
    { name: "History/War", ids: [36, 10752] },
    { name: "Western", ids: [37] },
    { name: "Documentary", ids: [99] }
  ],
  EXCLUDED_GENRES: [99, 10770],
  VERSATILITY_MAX_GROUPS: 6
};
