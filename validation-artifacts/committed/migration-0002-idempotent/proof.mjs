// migration-0002-idempotent: drizzle's own migrator against a throwaway
// in-memory Postgres (PGlite).  No production connection is opened.
//
//   node proof.mjs <node_modules dir with @electric-sql/pglite + drizzle-orm> <repo migrations dir> <workDir>
//
// Cases (prediction.md): fresh; production-like with the OLD 0002 (red);
// production-like with the NEW 0002 (green); re-run.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const [, , NM, MIGRATIONS, WORK] = process.argv;
const require = createRequire(path.join(NM, "x.js"));
const { PGlite } = require("@electric-sql/pglite");
const { drizzle } = require("drizzle-orm/pglite");
const { migrate } = require("drizzle-orm/pglite/migrator");

const OLD_0002 = 'ALTER TABLE "plans" ADD COLUMN "quote_settings" jsonb;';
const journal = JSON.parse(fs.readFileSync(path.join(MIGRATIONS, "meta", "_journal.json"), "utf8"));

// A migrations folder holding the first `n` journal entries, with 0002's SQL
// optionally replaced.
function folder(name, n, sql0002) {
  const dir = path.join(WORK, name);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(path.join(dir, "meta"), { recursive: true });
  const entries = journal.entries.slice(0, n);
  for (const e of entries) {
    const src = fs.readFileSync(path.join(MIGRATIONS, `${e.tag}.sql`), "utf8");
    fs.writeFileSync(path.join(dir, `${e.tag}.sql`), e.idx === 2 && sql0002 ? sql0002 : src);
  }
  fs.writeFileSync(path.join(dir, "meta", "_journal.json"), JSON.stringify({ ...journal, entries }));
  return dir;
}

async function state(client) {
  const col = await client.query(
    "select count(*)::int as n from information_schema.columns where table_name = 'plans' and column_name = 'quote_settings'",
  );
  const rec = await client.query("select count(*)::int as n from drizzle.__drizzle_migrations");
  return { quoteSettingsColumns: col.rows[0].n, recorded: rec.rows[0].n };
}

async function attempt(db) {
  try {
    await db;
    return { ok: true };
  } catch (e) {
    const msg = String(e?.cause?.message ?? e?.message ?? e);
    return { ok: false, error: msg.slice(0, 160) };
  }
}

// A production-like database: 0000 and 0001 applied and recorded by drizzle,
// then the column added by hand (as Ryan's Neon console run did).
async function productionLike() {
  const client = new PGlite();
  const db = drizzle(client);
  await migrate(db, { migrationsFolder: folder("first-two", 2) });
  await client.query('ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "quote_settings" jsonb;');
  return { client, db };
}

const out = {};

{
  const client = new PGlite();
  const db = drizzle(client);
  const r = await attempt(migrate(db, { migrationsFolder: MIGRATIONS }));
  out.fresh = { ...r, ...(await state(client)) };
}
{
  const { client, db } = await productionLike();
  out.productionLikeBefore = await state(client);
  const r = await attempt(migrate(db, { migrationsFolder: folder("old-0002", 3, OLD_0002) }));
  out.productionLikeOld0002 = { ...r, ...(await state(client)) };
}
{
  const { client, db } = await productionLike();
  const r = await attempt(migrate(db, { migrationsFolder: MIGRATIONS }));
  out.productionLikeNew0002 = { ...r, ...(await state(client)) };
  const again = await attempt(migrate(db, { migrationsFolder: MIGRATIONS }));
  out.rerun = { ...again, ...(await state(client)) };
}

console.log(JSON.stringify(out, null, 1));
