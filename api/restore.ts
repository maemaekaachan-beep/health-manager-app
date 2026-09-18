import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql, LIST_TABLES, resourceHasDate } from './_db.js';
import type { NeonQueryInTransaction } from '@neondatabase/serverless';

type ListEntry = { id: string; date?: string; [key: string]: unknown };

interface RestoreBody {
  meals?: ListEntry[];
  sleepEntries?: ListEntry[];
  weightEntries?: ListEntry[];
  stepEntries?: ListEntry[];
  bowelEntries?: ListEntry[];
  customFoods?: ListEntry[];
  conditions?: ListEntry[];
  profile?: Record<string, unknown>;
}

const LIST_KEY_TO_RESOURCE = {
  meals: 'meals',
  sleepEntries: 'sleep',
  weightEntries: 'weight',
  stepEntries: 'steps',
  bowelEntries: 'bowel',
  customFoods: 'custom-foods',
  conditions: 'conditions',
} as const;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'method not allowed' });
    return;
  }

  const body = (req.body ?? {}) as RestoreBody;

  try {
    await sql.transaction((txn) => {
      const queries: NeonQueryInTransaction[] = [];

      for (const [dataKey, resource] of Object.entries(LIST_KEY_TO_RESOURCE) as [
        keyof typeof LIST_KEY_TO_RESOURCE,
        keyof typeof LIST_TABLES,
      ][]) {
        const table = LIST_TABLES[resource];
        const hasDate = resourceHasDate(resource);
        const entries = body[dataKey] ?? [];

        queries.push(txn.query(`truncate table ${table}`));
        for (const entry of entries) {
          if (hasDate) {
            queries.push(
              txn.query(`insert into ${table} (id, date, payload) values ($1, $2, $3)`, [
                entry.id,
                entry.date,
                JSON.stringify(entry),
              ])
            );
          } else {
            queries.push(
              txn.query(`insert into ${table} (id, payload) values ($1, $2)`, [entry.id, JSON.stringify(entry)])
            );
          }
        }
      }

      queries.push(txn.query(`truncate table profile`));
      queries.push(
        txn.query(`insert into profile (id, payload) values (1, $1)`, [JSON.stringify(body.profile ?? {})])
      );

      return queries;
    });

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal server error' });
  }
}
