// brain inbox를 읽고 처리 표시한다 (로드맵 ⑤, docs/design/brain-inbox.md).
//
//   node scripts/brain-inbox.mjs count          # 미처리 건수
//   node scripts/brain-inbox.mjs list           # 미처리 항목 JSON (오래된 순, 50개까지)
//   node scripts/brain-inbox.mjs done <id>...   # processed_at 기록
//
// 종료 코드: 0 성공, 1 실행 오류·잘못된 id, 2 사용법·환경 키 누락
import { createServiceClient, loadEnv } from './lib/brain-env.mjs';
import {
  countUnprocessed,
  listUnprocessed,
  markDone,
  validateIds,
} from './lib/brain-inbox.mjs';

const USAGE = '사용법: node scripts/brain-inbox.mjs count | list | done <id>...';

async function main([cmd, ...rest]) {
  if (!['count', 'list', 'done'].includes(cmd) || (cmd !== 'done' && rest.length)) {
    console.error(USAGE);
    return 2;
  }
  if (cmd === 'done') {
    const problem = validateIds(rest);
    if (problem) {
      console.error(problem);
      return 1;
    }
  }

  const { values, errors } = loadEnv(['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']);
  if (errors.length) {
    for (const e of errors) console.error(e);
    return 2;
  }
  const client = createServiceClient(values);

  if (cmd === 'count') console.log(await countUnprocessed(client));
  if (cmd === 'list') console.log(JSON.stringify(await listUnprocessed(client), null, 2));
  if (cmd === 'done') console.log(`처리 표시: ${await markDone(client, rest)}건`);
  return 0;
}

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (err) => {
    console.error(err.message);
    process.exit(1);
  }
);
