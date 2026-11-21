import { movie, movieCast } from "./lib/tmdb.mjs";

export const handler = async (event) => {
  const pathParts = (event.path || "").split("/").filter(Boolean);
  const pathMatch = (event.path || "").match(/(?:movies|movie-cast)\/(\d+)/);
  const id = Number(pathMatch?.[1] || pathParts.find((part) => /^\d+$/.test(part)));
  if (!id) {
    return { statusCode: 400, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ detail: "Missing movie id" }) };
  }
  try {
    const [movieData, cast] = await Promise.all([movie(id), movieCast(id)]);
    const ids = cast
      .filter((item) => item.known_for_department === "Acting")
      .slice(0, 10)
      .map((item) => item.id);
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ movie: { id, title: movieData.title }, actors: [], missing: ids })
    };
  } catch (error) {
    return { statusCode: 502, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ detail: error.message }) };
  }
};
