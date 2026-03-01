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
const P = env['TRUSTRAG_SUPABASE_PROJECT_ID'];
const T = env['SUPABASE_TOKEN'];

function sql(label, query) {
  return new Promise(resolve => {
    const body = JSON.stringify({ query });
    const req = https.request({
      hostname: 'api.supabase.com',
      path: `/v1/projects/${P}/database/query`,
      method: 'POST',
      headers: { 'Authorization': `Bearer ${T}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try {
          const p = d ? JSON.parse(d) : [];
          if (p.message || p.error) console.log(`❌ [${label}]`, p.message || p.error);
          else console.log(`\n📋 [${label}]:`, JSON.stringify(p).substring(0, 600));
          resolve(p);
        } catch(e) { resolve({ error: d }); }
      });
    });
    req.on('error', e => resolve({ error: e.message }));
    req.write(body);
    req.end();
  });
}

// KS 인증 테이블에 데이터 있는지 확인
await sql('ks_cert 행 수',
  `SELECT COUNT(*) as cnt, MIN(id) as first_id FROM tr_jknetworks_ks_cert`);

await sql('ks_cert 최근 데이터',
  `SELECT id, company_id, LEFT(content, 100) as content_preview, metadata FROM tr_jknetworks_ks_cert ORDER BY id LIMIT 5`);

// embedding 벡터가 NULL인지 확인
await sql('embedding NULL 확인',
  `SELECT COUNT(*) as total, COUNT(embedding) as with_embedding FROM tr_jknetworks_ks_cert`);

// match_documents 함수 직접 테스트 (임시 임베딩으로)
await sql('match_documents 함수 존재 확인',
  `SELECT routine_name, pg_get_function_arguments(p.oid) as args
   FROM information_schema.routines r
   JOIN pg_proc p ON p.proname = r.routine_name
   WHERE r.routine_schema = 'public' AND r.routine_name LIKE 'match_documents%'`);
