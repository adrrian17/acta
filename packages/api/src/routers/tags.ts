import type { Database } from "@acta/db";
import { note, noteTag } from "@acta/db/schema/notes";
import { TRPCError } from "@trpc/server";
import { and, count, eq, ne } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure, router } from "../index";
import { noteContent } from "../notes/content";
import { taggedWith, untagged, writeNote } from "../notes/store";
import { buildTagTree } from "../notes/tag-tree";
import {
  canRenameTag,
  deleteTag,
  extractTags,
  isValidTag,
  normalizeTag,
  renameTag,
} from "../notes/tags";

const tagInput = z
  .string()
  .transform(normalizeTag)
  .refine(isValidTag, { error: "Invalid tag" });

/**
 * Rewrites every Timeline and Archived Note tagged `tag` (or a descendant). A Note is
 * skipped, unchanged, when the result is not valid content or it changed meanwhile.
 */
async function rewriteTagged(
  db: Database,
  tag: string,
  rewrite: (content: string) => string
): Promise<{ changed: number; skipped: number }> {
  const isTagged = (table: typeof note) => taggedWith(db, table, tag);

  const affected = await db.query.note.findMany({
    columns: { id: true, content: true, version: true },
    where: { state: { ne: "trashed" }, RAW: isTagged },
  });

  if (affected.length === 0) {
    throw new TRPCError({ code: "NOT_FOUND", message: "No note has this tag" });
  }

  const now = new Date();

  const outcomes = await Promise.all(
    affected.map(async (row) => {
      const content = rewrite(row.content);

      if (!noteContent.safeParse(content).success) {
        return false;
      }

      return await writeNote(db, {
        id: row.id,
        expectedVersion: row.version,
        now,
        patch: { content },
        tags: extractTags(content),
      });
    })
  );

  const changed = outcomes.filter(Boolean).length;

  return { changed, skipped: outcomes.length - changed };
}

export const tagsRouter = router({
  tree: protectedProcedure.query(async ({ ctx }) => {
    const { db } = ctx;

    const [rows, [untaggedNotes]] = await Promise.all([
      db
        .selectDistinct({ noteId: noteTag.noteId, tag: noteTag.tag })
        .from(noteTag)
        .innerJoin(note, eq(note.id, noteTag.noteId))
        .where(ne(note.state, "trashed")),
      db
        .select({ total: count() })
        .from(note)
        .where(and(ne(note.state, "trashed"), untagged(db, note))),
    ]);

    return {
      nodes: buildTagTree(rows),
      untaggedCount: untaggedNotes?.total ?? 0,
    };
  }),

  rename: protectedProcedure
    .input(z.object({ from: tagInput, to: tagInput }))
    .mutation(async ({ ctx, input }) => {
      if (!canRenameTag(input.from, input.to)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "A tag cannot be renamed to itself or one of its descendants",
        });
      }

      return await rewriteTagged(ctx.db, input.from, (content) =>
        renameTag(content, input.from, input.to)
      );
    }),

  delete: protectedProcedure
    .input(z.object({ tag: tagInput }))
    .mutation(
      async ({ ctx, input }) =>
        await rewriteTagged(ctx.db, input.tag, (content) =>
          deleteTag(content, input.tag)
        )
    ),
});
