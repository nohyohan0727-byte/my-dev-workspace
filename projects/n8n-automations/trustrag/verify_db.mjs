import fs from 'fs';
import https from 'https';

const env = {};
fs.readFileSync('C:/dev/my-dev-workspace/.env', 'utf8').split('\n').forEach(line => {
  line = line.trim();
  if (line && !line.startsWith('#') && line.includes('=')) {
    const [k, ...v] = line.split('=');
    env[k.trim()] = v.join('=').trim();
  }
});
const PROJECT = env['TRUSTRAG_SUPABASE_PROJECT_ID'];
const TOKEN = env['SUPABASE_TOKEN'];

function runSQL(label, query) {
  return new Promise(resolve => {
    const body = JSON.stringify({ query });
    const req = https.request({
      hostname: 'api.supabase.com',
      path: `/v1/projects/${PROJECT}/database/query`,
      method: 'POST',
      headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(d ? JSON.parse(d) : []); }
        catch(e) { resolve({ error: d }); }
      });
    });
    req.on('error', e => resolve({ error: e.message }));
    req.write(body);
    req.end();
  });
}

console.log('=== TrustRAG DB 검증 ===\n');

// 전체 tr_ 테이블 목록
const tables = await runSQL('tables', `SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'tr_%' ORDER BY tablename`);
console.log('📋 테이블 목록:');
tables.forEach && tables.forEach(t => console.log(`  - ${t.tablename}`));

// RPC 함수 목록
const funcs = await runSQL('funcs', `SELECT routine_name FROM information_schema.routines WHERE routine_schema='public' AND routine_name LIKE 'tr_%'`);
console.log('\n🔧 RPC 함수:');
funcs.forEach && funcs.forEach(f => console.log(`  - ${f.routine_name}()`));

// validate-key 테스트
console.log('\n🔑 validate-key 테스트 (슈퍼어드민):');
const vk = await runSQL('validate-key', `SELECT tr_validate_key('trust_SUPER_ADMIN_KEY_CHANGE_THIS') AS result`);
if (vk[0]?.result) {
  const r = vk[0].result;
  console.log(`  success: ${r.success}`);
  console.log(`  name: ${r.name}`);
  console.log(`  role: ${r.role}`);
  console.log(`  tokens_remaining: ${r.tokens_remaining}`);
  console.log(`  categories: ${JSON.stringify(r.categories)}`);
}

// 이상한 테이블 확인
console.log('\n🔍 tr_jknetworks 관련 테이블:');
const ex = await runSQL('extra', `SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'tr_jknetworks%'`);
if (Array.isArray(ex)) ex.forEach(t => console.log(`  - ${t.tablename}`));
