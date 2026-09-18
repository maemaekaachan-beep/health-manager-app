// 1回限りのスキーマ作成スクリプト。
// `vercel env pull .env.local` で接続情報を取得後、
// `node --env-file=.env.local scripts/init-db.mjs` で実行する。
import { neon } from '@neondatabase/serverless';

const connectionString = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL (or POSTGRES_URL) environment variable is not set');
}

const sql = neon(connectionString);

const LIST_TABLES = ['meals', 'sleep_entries', 'weight_entries', 'step_entries', 'bowel_entries'];

for (const table of LIST_TABLES) {
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
