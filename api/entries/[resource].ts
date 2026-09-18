import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql, LIST_TABLES, isListResource, resourceHasDate } from '../_db.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const resourceParam = req.query.resource;
  const resource = Array.isArray(resourceParam) ? resourceParam[0] : resourceParam;

  if (!resource || !isListResource(resource)) {
    res.status(404).json({ error: 'unknown resource' });
    return;
  }

  const table = LIST_TABLES[resource];
  const hasDate = resourceHasDate(resource);

  try {
    if (req.method === 'GET') {
      const rows = hasDate
        ? await sql.query(`select payload from ${table} order by date asc`)
        : await sql.query(`select payload from ${table} order by payload->>'name' asc`);
      res.status(200).json(rows.map((r) => (r as { payload: unknown }).payload));
      return;
    }

    if (req.method === 'POST') {
      const entry = req.body as { id?: string; date?: string };
      if (!entry?.id || (hasDate && !entry.date)) {
        res.status(400).json({ error: 'invalid entry' });
        return;
      }

      if (hasDate) {
        await sql.query(
          `insert into ${table} (id, date, payload) values ($1, $2, $3)
           on conflict (id) do update set date = excluded.date, payload = excluded.payload`,
          [entry.id, entry.date, JSON.stringify(entry)]
        );
      } else {
        await sql.query(
          `insert into ${table} (id, payload) values ($1, $2)
           on conflict (id) do update set payload = excluded.payload`,
          [entry.id, JSON.stringify(entry)]
        );
      }
      res.status(200).json(entry);
      return;
    }

    if (req.method === 'DELETE') {
      const idParam = req.query.id;
      const id = Array.isArray(idParam) ? idParam[0] : idParam;
      if (!id) {
        res.status(400).json({ error: 'id is required' });
        return;
      }
      await sql.query(`delete from ${table} where id = $1`, [id]);
      res.status(204).end();
      return;
    }

    res.setHeader('Allow', 'GET, POST, DELETE');
    res.status(405).json({ error: 'method not allowed' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal server error' });
  }
}
