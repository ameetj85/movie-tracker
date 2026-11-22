import { beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/db";
import { copies, movies, viewings } from "@/db/schema";

// Cache revalidation only works inside a Next request; it's a no-op here.
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { bulkUpdate, deleteViewing, logViewing } = await import("@/lib/library-actions");

const add = (values: Partial<typeof movies.$inferInsert> & { title: string }) =>
  db.insert(movies).values(values).returning({ id: movies.id }).get().id;
const get = (id: number) => db.select().from(movies).all().find((m) => m.id === id);

beforeEach(() => {
  db.delete(viewings).run();
  db.delete(copies).run();
  db.delete(movies).run();
});

describe("bulkUpdate", () => {
  it("adds a tag once, case-insensitively, and removes it", async () => {
    const a = add({ title: "A", tags: ["kids"] });
    const b = add({ title: "B" });
    expect(await bulkUpdate([a, b], { type: "addTag", tag: "Kids" })).toMatchObject({ ok: true });
    expect(get(a)?.tags).toEqual(["kids"]);
    expect(get(b)?.tags).toEqual(["Kids"]);
    await bulkUpdate([a, b], { type: "removeTag", tag: "KIDS" });
    expect(get(a)?.tags).toBeNull();
    expect(get(b)?.tags).toBeNull();
  });

  it("sets watch status and deletes", async () => {
    const a = add({ title: "A" });
    const b = add({ title: "B" });
    await bulkUpdate([a, b], { type: "status", status: "watched" });
    expect(get(a)?.watchStatus).toBe("watched");
    expect(await bulkUpdate([a], { type: "delete" })).toMatchObject({ ok: true, message: "Deleted 1 movie." });
    expect(get(a)).toBeUndefined();
    expect(get(b)).toBeDefined();
  });

  it("rejects invalid input", async () => {
    expect(await bulkUpdate([], { type: "delete" })).toMatchObject({ ok: false });
    expect(await bulkUpdate([1], { type: "addTag", tag: "  " })).toMatchObject({ ok: false });
  });
});

describe("watch history", () => {
  it("logging a viewing marks the movie watched; viewings can be removed", async () => {
    const id = add({ title: "Heat" });
    expect(await logViewing(id, { watchedOn: "2026-11-20", note: " with Sam " })).toEqual({ ok: true });
    expect(get(id)?.watchStatus).toBe("watched");
    const [v] = db.select().from(viewings).all();
    expect(v).toMatchObject({ movieId: id, watchedOn: "2026-11-20", note: "with Sam" });
    expect(await deleteViewing(v.id)).toEqual({ ok: true });
    expect(db.select().from(viewings).all()).toEqual([]);
  });

  it("validates the date", async () => {
    const id = add({ title: "Heat" });
    expect(await logViewing(id, { watchedOn: "yesterday", note: "" })).toMatchObject({ ok: false });
  });

  it("removes a movie's viewings when the movie is deleted", async () => {
    const id = add({ title: "Heat" });
    await logViewing(id, { watchedOn: "2026-01-01", note: "" });
    await bulkUpdate([id], { type: "delete" });
    expect(db.select().from(viewings).all()).toEqual([]);
  });
});
