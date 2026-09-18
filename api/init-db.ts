import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from './_db.js';

const LIST_TABLES_WITH_DATE = ['meals', 'sleep_entries', 'weight_entries', 'step_entries', 'bowel_entries'];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'method not allowed' });
    return;
  }

  try {
    for (const table of LIST_TABLES_WITH_DATE) {
      await sql.query(
        `create table if not exists ${table} (
           id text primary key,
           date text not null,
           payload jsonb not null
         )`
      );
      await sql.query(`create index if not exists ${table}_date_idx on ${table} (date)`);
    }

    await sql.query(
      `create table if not exists custom_foods (
         id text primary key,
         payload jsonb not null
       )`
    );

    await sql.query(
      `create table if not exists conditions (
         id text primary key,
         payload jsonb not null
       )`
    );

    await sql.query(
      `create table if not exists profile (
         id smallint primary key default 1,
         payload jsonb not null default '{}'
       )`
    );

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal server error' });
  }
}
