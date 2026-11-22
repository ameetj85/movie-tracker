import { connection } from "next/server";

import { TAG_SUGGESTIONS_ID } from "@/lib/constants";
import { getAllTags } from "@/lib/queries";

/** Existing tags as a <datalist>, which the movie form's Tags input autocompletes from. */
export async function TagSuggestions() {
  // Read per request; the add page itself is prerendered.
  await connection();
  const tags = await getAllTags();
  return (
    <datalist id={TAG_SUGGESTIONS_ID}>
      {tags.map((t) => (
        <option key={t} value={t} />
      ))}
    </datalist>
  );
}
