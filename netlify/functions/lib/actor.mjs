import fs from "node:fs";
import path from "node:path";
import { person, movieCredits, tvCredits, externalIds, reviews, movieDirectors, movieDetails } from "./tmdb.mjs";
import { fetchAwards } from "./wikidata.mjs";
import { compute, reviewMovies, validCredits, validWorks } from "./scoring.mjs";

function prestigeDirectorIds() {
  try {
    const file = path.resolve(process.cwd(), "directors.json");
    const directors = JSON.parse(fs.readFileSync(file, "utf8"));
    return new Set(directors.filter((item) => item.tmdb_id).map((item) => item.tmdb_id));
  } catch {
    return new Set();
  }
}

function sagaCollectionIds() {
  try {
    const file = path.resolve(process.cwd(), "sagas.json");
    return new Set(JSON.parse(fs.readFileSync(file, "utf8"))
      .map((saga) => saga.tmdb_collection_id)
      .filter(Boolean));
  } catch {
    return new Set();
  }
}

export async function qualityContext(personId, credits, tv = []) {
  const valid = validCredits(credits);
  const allWorks = validWorks(credits, tv);
  const leadMovieCount = valid.filter((credit) => credit.order <= 2).length;
  const topMovies = [...valid]
    .sort((a, b) => {
      const weight = (order) => order === 0 ? 1 : order === 1 ? 0.8 : order === 2 ? 0.6 :
        order >= 3 && order <= 5 ? 0.35 : 0.1;
      return (weight(b.order) * b.vote_count) - (weight(a.order) * a.vote_count);
    })
    .slice(0, 15);
  const prestigeIds = prestigeDirectorIds();
  const sagaIds = sagaCollectionIds();
  const [directorResults, movieDetailsResults] = await Promise.all([
    Promise.all(topMovies.map((movie) => movieDirectors(movie.id))),
    Promise.all(topMovies.map((movie) => movieDetails(movie.id)))
  ]);
  const directorMovieIds = [];
  const sagaMovieIds = [];
  directorResults.forEach((directors, index) => {
    if (directors?.some((director) => director.id === personId)) return;
    if (directors?.some((director) => prestigeIds.has(director.id))) {
      directorMovieIds.push(topMovies[index].id);
    }
  });
  movieDetailsResults.forEach((details, index) => {
    const collectionId = details?.belongs_to_collection?.id;
    if (collectionId && sagaIds.has(collectionId)) sagaMovieIds.push(topMovies[index].id);
  });
  return {
    directorMovieIds,
    directorMovieCount: directorMovieIds.length,
    sagaMovieIds,
    sagaMovieCount: sagaMovieIds.length,
    leadMovieCount,
    allWorks
  };
}

export async function buildActor(id) {
  const [personData, credits, tv, external] = await Promise.all([
    person(id),
    movieCredits(id),
    tvCredits(id),
    externalIds(id)
  ]);
  const valid = validCredits(credits);
  const selectedMovies = reviewMovies(valid);
  const [awards, reviewsByMovie, qualityOptions] = await Promise.all([
    fetchAwards(external.wikidata_id),
    Promise.all(selectedMovies.map((movie) => reviews(movie.id))),
    qualityContext(personData.id, credits, tv)
  ]);
  const actor = compute(personData, credits, awards, reviewsByMovie, selectedMovies, qualityOptions);
  return actor;
}
