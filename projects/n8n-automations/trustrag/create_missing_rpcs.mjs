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
        try {
          const p = d ? JSON.parse(d) : [];
          if (p.message || p.error) console.log(`❌ [${label}]: ${p.message || p.error}`);
          else console.log(`✅ [${label}]: OK`);
          resolve(p);
        } catch(e) { resolve({ error: d }); }
      });
    });
    req.on('error', e => resolve({ error: e.message }));
    req.write(body);
    req.end();
  });
}

// 기존 n8n 워크플로우가 호출하는 RPC 함수들을 tr_* 함수에 매핑

// 1. get_user_permissions → tr_validate_key 래퍼
await runSQL('get_user_permissions RPC', `
CREATE OR REPLACE FUNCTION get_user_permissions(api_key TEXT)
RETURNS JSONB AS $func$
DECLARE
  result JSONB;
BEGIN
  result := tr_validate_key(api_key);
  IF (result->>'success')::boolean THEN
    -- n8n이 기대하는 필드명으로 변환
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
$func$ LANGUAGE plpgsql SECURITY DEFINER
`);

// 2. deduct_token (기존 워크플로우가 호출할 수 있음)
await runSQL('deduct_token RPC', `
CREATE OR REPLACE FUNCTION deduct_token(p_user_id UUID, p_amount INT DEFAULT 1)
RETURNS JSONB AS $func$
DECLARE v_remaining INTEGER;
BEGIN
  UPDATE tr_users
  SET tokens_remaining = GREATEST(0, tokens_remaining - p_amount),
      tokens_used = tokens_used + p_amount
  WHERE id = p_user_id
  RETURNING tokens_remaining INTO v_remaining;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;
  RETURN jsonb_build_object('success', true, 'tokens_remaining', v_remaining);
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER
`);

// 3. 테스트
console.log('\n🔑 get_user_permissions 테스트:');
const testRes = await runSQL('test-validate',
  `SELECT get_user_permissions('trust_SUPER_ADMIN_KEY_CHANGE_THIS') AS result`
);
if (testRes[0]?.result) {
  const r = testRes[0].result;
  console.log('  user_id:', r.user_id);
  console.log('  name:', r.name);
  console.log('  role:', r.role);
  console.log('  tokens_remaining:', r.tokens_remaining);
  console.log('  categories:', JSON.stringify(r.categories));
}
