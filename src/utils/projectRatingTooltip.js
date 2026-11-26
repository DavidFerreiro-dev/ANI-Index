function formatRating(value) {
  const rating = Number(value);
  return Number.isFinite(rating) && rating > 0 ? rating.toFixed(1) : "—";
}

export function formatProjectRating(project) {
  return `IMDb ${formatRating(project.imdb_rating)} · TMDb ${formatRating(project.tmdb_rating ?? project.rating)} → Final ${formatRating(project.final_rating ?? project.rating)}`;
}
