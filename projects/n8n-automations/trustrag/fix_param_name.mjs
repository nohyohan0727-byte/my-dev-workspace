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
          else console.log(`✅ [${label}]`, JSON.stringify(p).substring(0, 200));
          resolve(p);
        } catch(e) { resolve({ error: d }); }
      });
    });
    req.on('error', e => resolve({ error: e.message }));
    req.write(body);
    req.end();
  });
}

// 기존 함수 DROP (모든 시그니처)
await sql('DROP 기존 함수',
  `DROP FUNCTION IF EXISTS get_user_permissions(text);
   DROP FUNCTION IF EXISTS get_user_permissions(varchar);`
);

// n8n이 보내는 파라미터 이름 p_api_key 로 재생성
await sql('get_user_permissions 재생성 (p_api_key)',
  `CREATE OR REPLACE FUNCTION get_user_permissions(p_api_key TEXT)
RETURNS JSONB AS $f$
DECLARE
  result JSONB;
BEGIN
  result := tr_validate_key(p_api_key);
  IF (result->>'success')::boolean THEN
    RETURN jsonb_build_object(
      'user_id',          result->>'id',
      'company_id',       result->>'company_id',
      'name',             result->>'name',
      'email',            result->>'email',
      'role',             result->>'role',
      'company',          result->>'company',
      'tokens_remaining', (result->>'tokens_remaining')::int,
      'categories',       result->'categories'
    );
  ELSE
    RETURN jsonb_build_object('error', result->>'message');
  END IF;
END;
$f$ LANGUAGE plpgsql SECURITY DEFINER`
);

// 직접 Supabase REST API로 테스트 (n8n과 동일한 방식)
await sql('함수 시그니처 확인',
  `SELECT proname, pg_get_function_arguments(oid) AS args FROM pg_proc WHERE proname='get_user_permissions' AND pronamespace='public'::regnamespace`
);

console.log('\n🧪 Supabase REST RPC로 테스트...');
// Supabase anon/service role key로 REST API 직접 호출
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ5emtjZHZ5d3hibHNieXVqdGZ2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjI2NDk4OCwiZXhwIjoyMDg3ODQwOTg4fQ.gcq-e2pLFWFxtx_Y1tLcPaOcACGthpWPRs7o6w2nz7s';

await new Promise(resolve => {
  const body = JSON.stringify({ p_api_key: 'trust_SUPER_ADMIN_KEY_CHANGE_THIS' });
  const req = https.request({
    hostname: 'ryzkcdvywxblsbyujtfv.supabase.co',
    path: '/rest/v1/rpc/get_user_permissions',
    method: 'POST',
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body)
    }
  }, res => {
    let d = '';
    res.on('data', c => d += c);
    res.on('end', () => {
      console.log(`HTTP ${res.statusCode}:`, d.substring(0, 400));
      resolve();
    });
  });
  req.write(body);
  req.end();
});
