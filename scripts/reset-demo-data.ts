// デモDB(health-manager-demo)のダミーデータを全削除するスクリプト。
// 削除対象: meals / sleep_entries / weight_entries / step_entries / bowel_entries / conditions
// profile テーブルは対象外(触らない)。
//
// 接続先の安全チェック(scripts/_db-guard.ts と共通)・件数表示・yes確認を行ったうえで、
// 1トランザクションで削除する。
//
// 使い方:
//   npx tsx --env-file=.env.local scripts/reset-demo-data.ts
//   npx tsx --env-file=.env.local scripts/reset-demo-data.ts --yes
import { connectToDemoDatabase, confirm } from './_db-guard.ts';

const TABLES = ['meals', 'sleep_entries', 'weight_entries', 'step_entries', 'bowel_entries', 'conditions'];

async function main() {
  const { sql, host } = connectToDemoDatabase();
  console.log('接続先ホスト:', host, '(デモ用DBであることを確認しました)');

  console.log('\n現在の件数(削除対象):');
  const counts: Record<string, number> = {};
  for (const table of TABLES) {
    const rows = (await sql.query(`select count(*)::int as count from ${table}`)) as unknown as { count: number }[];
    counts[table] = rows[0]?.count ?? 0;
    console.log(`  ${table}: ${counts[table]}件`);
  }

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  console.log('\n※ profile テーブルは削除対象に含まれません。');

  if (total === 0) {
    console.log('削除対象のデータがありません。終了します。');
    return;
  }

  const ok = await confirm(`\n上記 合計${total}件 を全て削除してよろしいですか? (yes と入力): `);
  if (!ok) {
    console.log('中断しました。');
    process.exit(1);
  }

  await sql.transaction((tx) => TABLES.map((table) => tx.query(`delete from ${table}`)));

  console.log('\n削除が完了しました。');
}

main().catch((err) => {
  console.error('reset failed:', err);
  process.exit(1);
});
