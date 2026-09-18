import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from './_db.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ error: 'method not allowed' });
    return;
  }

  try {
    const [meals, sleepEntries, weightEntries, stepEntries, bowelEntries, customFoods, conditions, profileRows] =
      await Promise.all([
        sql`select payload from meals order by date asc`,
        sql`select payload from sleep_entries order by date asc`,
        sql`select payload from weight_entries order by date asc`,
        sql`select payload from step_entries order by date asc`,
        sql`select payload from bowel_entries order by date asc`,
        sql`select payload from custom_foods order by payload->>'name' asc`,
        sql`select payload from conditions order by payload->>'name' asc`,
        sql`select payload from profile where id = 1`,
      ]);

    res.status(200).json({
      meals: meals.map((r) => r.payload),
      sleepEntries: sleepEntries.map((r) => r.payload),
      weightEntries: weightEntries.map((r) => r.payload),
      stepEntries: stepEntries.map((r) => r.payload),
      bowelEntries: bowelEntries.map((r) => r.payload),
      customFoods: customFoods.map((r) => r.payload),
      conditions: conditions.map((r) => r.payload),
      profile: profileRows[0]?.payload ?? {},
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal server error' });
  }
}
