// ビルド前に自動実行されるスキーマ作成スクリプト（`npm run build` の prebuild フックから起動）。
// `CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS` のみで構成されており、
// 既存データを壊さず何度実行しても安全。
import { neon } from '@neondatabase/serverless';

const connectionString = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL (or POSTGRES_URL) environment variable is not set');
}

const sql = neon(connectionString);

const LIST_TABLES_WITH_DATE = ['meals', 'sleep_entries', 'weight_entries', 'step_entries', 'bowel_entries'];

async function migrate() {
  for (const table of LIST_TABLES_WITH_DATE) {
    await sql.query(
      `create table if not exists ${table} (
         id text primary key,
         date text not null,
         payload jsonb not null
       )`
    );
    await sql.query(`create index if not exists ${table}_date_idx on ${table} (date)`);
    console.log(`ok: ${table}`);
  }

  await sql.query(
    `create table if not exists custom_foods (
       id text primary key,
       payload jsonb not null
     )`
  );
  console.log('ok: custom_foods');

  await sql.query(
    `create table if not exists conditions (
       id text primary key,
       payload jsonb not null
     )`
  );
  console.log('ok: conditions');

  await sql.query(
    `create table if not exists profile (
       id smallint primary key default 1,
       payload jsonb not null default '{}'
     )`
  );
  console.log('ok: profile');

  console.log('スキーマ作成が完了しました。');
}

migrate().catch((err) => {
  console.error('migrate failed:', err);
  process.exit(1);
});
