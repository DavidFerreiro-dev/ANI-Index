import { buildDirector, curatedDirectorIds } from "./lib/director.mjs";

export const handler = async (event) => {
  try {
    const pathParts = (event.path || "").split("/").filter(Boolean);
    const idIndex = pathParts.findIndex((part) => part === "directors");
    const id = pathParts[idIndex + 1];
    if (id && /^\d+$/.test(id)) {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(await buildDirector(Number(id)))
      };
    }
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: "[]"
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: err.message, message: err.message, detail: err.message })
    };
  }
};

export { curatedDirectorIds };
