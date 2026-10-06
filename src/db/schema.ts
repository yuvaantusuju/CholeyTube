import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";

/**
 * Lightweight log of every "yoink" — useful for analytics and abuse mitigation.
 * No video data or URLs are stored beyond the raw URL the user submitted.
 */
export const downloads = pgTable("downloads", {
  id: serial("id").primaryKey(),
  url: text("url").notNull(),
  title: text("title"),
  formatId: text("format_id").notNull(),
  formatKind: text("format_kind").notNull(),
  height: integer("height"),
  requestedAt: timestamp("requested_at", { withTimezone: true }).defaultNow().notNull(),
  userAgent: text("user_agent"),
  ip: text("ip"),
});

export type DownloadRow = typeof downloads.$inferSelect;
export type NewDownloadRow = typeof downloads.$inferInsert;
