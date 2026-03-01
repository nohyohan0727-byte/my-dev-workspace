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
          else console.log(`\n📋 [${label}]:\n`, JSON.stringify(p, null, 2).substring(0, 2000));
          resolve(p);
        } catch(e) { resolve({ error: d }); }
      });
    });
    req.on('error', e => resolve({ error: e.message }));
    req.write(body);
    req.end();
  });
}

// 모든 public 테이블 목록
await sql('전체 테이블 목록',
  `SELECT tablename, tableowner FROM pg_tables WHERE schemaname='public' ORDER BY tablename`);

// 벡터 테이블 컬럼 구조
await sql('tr_jknetworks_iso_cert 컬럼',
  `SELECT column_name, data_type, udt_name FROM information_schema.columns 
   WHERE table_schema='public' AND table_name='tr_jknetworks_iso_cert' ORDER BY ordinal_position`);

// users 테이블 컬럼 구조
await sql('users 테이블 컬럼',
  `SELECT column_name, data_type FROM information_schema.columns 
   WHERE table_schema='public' AND table_name='users' ORDER BY ordinal_position`);

// 기존 RPC 함수 목록
await sql('RPC 함수 목록',
  `SELECT routine_name, pg_get_function_arguments(p.oid) as args
   FROM information_schema.routines r
   JOIN pg_proc p ON p.proname = r.routine_name
   WHERE r.routine_schema = 'public'
   ORDER BY routine_name`);
