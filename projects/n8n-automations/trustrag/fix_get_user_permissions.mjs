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

// 기존 함수 시그니처 확인
await sql('기존 함수 확인',
  `SELECT proname, pg_get_function_arguments(oid) AS args FROM pg_proc WHERE proname='get_user_permissions' AND pronamespace='public'::regnamespace`
);

// 가능한 모든 시그니처 DROP
await sql('DROP all', `DROP FUNCTION IF EXISTS get_user_permissions(text); DROP FUNCTION IF EXISTS get_user_permissions(varchar)`);

// 재생성 - n8n이 기대하는 응답 형식
await sql('get_user_permissions 재생성', `CREATE OR REPLACE FUNCTION get_user_permissions(api_key TEXT)
RETURNS JSONB AS $f$
DECLARE
  result JSONB;
BEGIN
  result := tr_validate_key(api_key);
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
$f$ LANGUAGE plpgsql SECURITY DEFINER`);

// 테스트
const r = await sql('get_user_permissions 테스트',
  `SELECT get_user_permissions('trust_SUPER_ADMIN_KEY_CHANGE_THIS') AS result`
);
if (Array.isArray(r) && r[0]?.result) {
  const v = r[0].result;
  console.log('\n🎯 결과:');
  console.log('  name:', v.name);
  console.log('  role:', v.role);
  console.log('  tokens_remaining:', v.tokens_remaining);
  console.log('  categories:', JSON.stringify(v.categories));
}
