/**
 * Loads the demo dataset into a Supabase/Postgres database.
 *
 *   npm run db:seed
 *
 * Uses the same `buildSeedData()` the in-memory store uses, so the demo data
 * cannot drift between the two backends. Requires SUPABASE_URL and
 * SUPABASE_SERVICE_ROLE_KEY, and the migrations in supabase/migrations to have
 * been applied.
 *
 * Idempotent: every row is upserted on its primary key, so re-running refreshes
 * the demo without duplicating anything.
 */
import { createClient } from "@supabase/supabase-js";

import { buildSeedData } from "../lib/db/seed";

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n" +
      "Set both in .env.local (or the shell) and try again.",
  );
  process.exit(1);
}

const client = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function upsert(table: string, rows: unknown[]) {
  if (rows.length === 0) return;
  const { error } = await client.from(table).upsert(rows as never[], { onConflict: "id" });
  if (error) throw new Error(`${table}: ${error.message}`);
  console.log(`  ${table.padEnd(18)} ${String(rows.length).padStart(3)} rows`);
}

async function main() {
  const data = buildSeedData();
  console.log(`Seeding ${url}\n`);

  // Insert order matters: foreign keys point backwards up this list.
  await upsert("businesses", data.businesses);
  await upsert("users", data.users);
  await upsert("services", data.services);
  await upsert("customers", data.customers);
  await upsert("addresses", data.addresses);
  await upsert("leads", data.leads);
  await upsert("appointments", data.appointments);
  await upsert("calls", data.calls);
  await upsert("conversations", data.conversations);
  await upsert("messages", data.messages);
  await upsert("estimates", data.estimates);
  await upsert("ai_actions", data.aiActions);
  await upsert("notifications", data.notifications);
  await upsert("analytics_events", data.analyticsEvents);

  console.log("\nDone. Sign in with the seeded owner account once you have created");
  console.log("a matching Supabase Auth user and set users.auth_user_id.");
}

main().catch((error: unknown) => {
  console.error("\nSeed failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
