// デモ用ダミーデータ投入スクリプト。
// 【重要】必ず「デモ専用の新しいDB」に対して実行すること。
// 本番のDATABASE_URLに対して実行すると、実データと混ざってしまう。
//
// 使い方:
//   node --env-file=.env.demo.local scripts/seed-dummy-data.mjs
import { neon } from '@neondatabase/serverless';
import { randomUUID } from 'crypto';

const connectionString = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL (or POSTGRES_URL) environment variable is not set');
}

const sql = neon(connectionString);

function dateStr(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

function rand(min, max, decimals = 0) {
  const v = Math.random() * (max - min) + min;
  return decimals ? Number(v.toFixed(decimals)) : Math.round(v);
}

const mealNames = {
  breakfast: ['ご飯と味噌汁、焼き鮭', 'トーストと卵', 'ヨーグルトとバナナ'],
  lunch: ['鶏むね肉の定食', 'パスタ', 'そば'],
  dinner: ['野菜炒めと豆腐', '鮭の塩焼き定食', '鍋料理'],
  snack: ['ナッツ少々', 'プロテインバー', 'みかん'],
};

const meals = [];
const sleep = [];
const weight = [];
const steps = [];
const bowel = [];

for (let i = 0; i < 30; i++) {
  const date = dateStr(i);

  // 食事（1日3〜4件）
  const categories = ['breakfast', 'lunch', 'dinner'];
  if (Math.random() > 0.5) categories.push('snack');
  for (const category of categories) {
    const names = mealNames[category];
    meals.push({
      id: randomUUID(),
      date,
      time: category === 'breakfast' ? '07:30' : category === 'lunch' ? '12:30' : category === 'dinner' ? '19:00' : '15:00',
      name: names[Math.floor(Math.random() * names.length)],
      calories: rand(200, 700),
      category,
      protein: rand(10, 35),
      fat: rand(5, 20),
      carbs: rand(20, 80),
      salt: rand(1, 4, 1),
    });
  }

  // 睡眠
  sleep.push({
    id: randomUUID(),
    date,
    bedtime: '23:' + String(rand(0, 59)).padStart(2, '0'),
    wakeTime: '0' + rand(6, 7) + ':' + String(rand(0, 59)).padStart(2, '0'),
    duration: rand(360, 450),
    quality: rand(2, 5),
  });

  // 体重（緩やかに変動）
  weight.push({
    id: randomUUID(),
    date,
    weight: rand(600, 650, 1) / 10,
    bodyFat: rand(180, 220, 1) / 10,
    note: '',
  });

  // 歩数
  steps.push({
    id: randomUUID(),
    date,
    steps: rand(3000, 12000),
  });

  // 排便（毎日ではない）
  if (Math.random() > 0.2) {
    bowel.push({
      id: randomUUID(),
      date,
      time: '0' + rand(7, 9) + ':00',
      bristol: rand(3, 5),
      amount: ['small', 'medium', 'large'][rand(0, 2)],
      count: 1,
    });
  }
}

async function insertAll(table, rows) {
  for (const row of rows) {
    await sql.query(
      `insert into ${table} (id, date, payload) values ($1, $2, $3)
       on conflict (id) do nothing`,
      [row.id, row.date, JSON.stringify(row)]
    );
  }
  console.log(`inserted: ${table} (${rows.length}件)`);
}

await insertAll('meals', meals);
await insertAll('sleep_entries', sleep);
await insertAll('weight_entries', weight);
await insertAll('step_entries', steps);
await insertAll('bowel_entries', bowel);

await sql.query(
  `insert into profile (id, payload) values (1, $1)
   on conflict (id) do update set payload = excluded.payload`,
  [JSON.stringify({ height: 165, age: 30, gender: 'female' })]
);
console.log('inserted: profile');

console.log('ダミーデータの投入が完了しました。');
