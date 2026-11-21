import { searchPerson, searchMovie } from "./lib/tmdb.mjs";

export const handler = async (event) => {
  const q = (event.queryStringParameters?.q || "").trim();
  if (q.length < 2) return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: "[]" };
  try {
    const [people, movies] = await Promise.all([searchPerson(q), searchMovie(q)]);
    const actors = people
      .filter((item) => item.known_for_department === "Acting")
      .slice(0, 5)
      .map((item) => ({ type: "Actor", id: item.id, name: item.name, image: item.profile_path || null }));
    const movieItems = movies.slice(0, 4).map((item) => ({
      type: "Movie",
      id: item.id,
      name: item.title,
      image: item.poster_path || null,
      year: (item.release_date || "").slice(0, 4)
    }));
    return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify([...actors, ...movieItems]) };
  } catch (error) {
    return { statusCode: 502, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ detail: error.message }) };
  }
};
