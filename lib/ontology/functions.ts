// ── Ontology Functions ───────────────────────────────────────────────────────
// Computed aggregations and derived data. These replace ad-hoc dashboard queries
// with named, discoverable ontology-level computations.

import { db } from "@/lib/db";
import { investors, blogPosts, brandApps, inquiries, pokerPlayers, pokerVotes } from "@/lib/db/schema";
import { eq, sql, and, ne } from "drizzle-orm";

export interface OntologyFunction {
  name: string;
  description: string;
  compute: () => Promise<unknown>;
}

async function countTable(table: any): Promise<number> {
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(table);
  return count;
}

export const functions: Record<string, OntologyFunction> = {
  dashboardStats: {
    name: "dashboardStats",
    description: "Aggregate counts for dashboard tiles: investors, blog posts, brands tracked, open deals",
    compute: async () => {
      const [investorCount, blogCount, brandCount] = await Promise.all([
        countTable(investors),
        countTable(blogPosts),
        countTable(brandApps),
      ]);

      // Open deals = brand apps not in "Closed" or "Passed" stage
      const [{ openDeals }] = await db
        .select({ openDeals: sql<number>`count(*)::int` })
        .from(brandApps)
        .where(
          and(
            ne(brandApps.stage, "Closed"),
            ne(brandApps.stage, "Passed"),
          ),
        );

      return { investors: investorCount, blogPosts: blogCount, brandsTracked: brandCount, openDeals };
    },
  },

  investorTypeCounts: {
    name: "investorTypeCounts",
    description: "Investor count grouped by type (Angel Group, VC, Family Office)",
    compute: async () => {
      const rows = await db
        .select({
          type: investors.type,
          count: sql<number>`count(*)::int`,
        })
        .from(investors)
        .groupBy(investors.type);

      return Object.fromEntries(rows.map((r) => [r.type, r.count]));
    },
  },

  pokerStandings: {
    name: "pokerStandings",
    description: "Current poker tournament standings with computed vote totals and percentages",
    compute: async () => {
      const players = await db.select().from(pokerPlayers);
      const votes = await db.select().from(pokerVotes).where(eq(pokerVotes.isTest, false));

      // Compute totals
      const deltaSums: Record<string, number> = {};
      for (const v of votes) {
        deltaSums[v.playerId] = (deltaSums[v.playerId] ?? 0) + v.delta;
      }

      const standings = players
        .filter((p) => !p.isEliminated)
        .map((p) => {
          const total = p.baseVotes + (deltaSums[p.id] ?? 0);
          return { name: p.name, company: p.company, totalVotes: total };
        });

      const grandTotal = standings.reduce((s, p) => s + p.totalVotes, 0) || 1;
      const result = standings
        .map((p) => ({
          ...p,
          pct: Math.round((p.totalVotes / grandTotal) * 10000) / 100,
        }))
        .sort((a, b) => b.totalVotes - a.totalVotes);

      return result;
    },
  },

  dealPipeline: {
    name: "dealPipeline",
    description: "Deal count grouped by pipeline stage",
    compute: async () => {
      const rows = await db
        .select({
          stage: brandApps.stage,
          count: sql<number>`count(*)::int`,
        })
        .from(brandApps)
        .groupBy(brandApps.stage);

      return Object.fromEntries(rows.map((r) => [r.stage ?? "Unknown", r.count]));
    },
  },
};
