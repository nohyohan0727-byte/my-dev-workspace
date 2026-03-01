import fs from 'fs';
import https from 'https';

// .env 로드
const envPath = 'C:/dev/my-dev-workspace/.env';
const env = {};
fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
  line = line.trim();
  if (line && !line.startsWith('#') && line.includes('=')) {
    const [k, ...v] = line.split('=');
    env[k.trim()] = v.join('=').trim();
  }
});

const PROJECT = env['TRUSTRAG_SUPABASE_PROJECT_ID'];
const TOKEN = env['SUPABASE_TOKEN'];

if (!PROJECT || !TOKEN) {
  console.error('❌ TRUSTRAG_SUPABASE_PROJECT_ID 또는 SUPABASE_TOKEN 없음');
  process.exit(1);
}
console.log(`🔗 프로젝트: ${PROJECT}`);
console.log('='.repeat(60));

function runSQL(label, query) {
  return new Promise((resolve) => {
    const body = JSON.stringify({ query });
    const options = {
      hostname: 'api.supabase.com',
      path: `/v1/projects/${PROJECT}/database/query`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : [];
          if (parsed.message || parsed.error) {
            console.log(`  ❌ [${label}]: ${parsed.message || parsed.error}`);
          } else {
            console.log(`  ✅ [${label}]: OK ${JSON.stringify(parsed).substring(0,80)}`);
          }
          resolve(parsed);
        } catch(e) {
          console.log(`  ❌ [${label}] 파싱 오류: ${data.substring(0,100)}`);
          resolve({ error: data });
        }
      });
    });
    req.on('error', e => { console.log(`  ❌ [${label}] 연결 오류: ${e.message}`); resolve({ error: e.message }); });
    req.write(body);
    req.end();
  });
}

const steps = [
  ['pgvector 확장', `CREATE EXTENSION IF NOT EXISTS vector`],

  ['tr_companies', `CREATE TABLE IF NOT EXISTS tr_companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    plan TEXT NOT NULL DEFAULT 'starter',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`],

  ['tr_users', `CREATE TABLE IF NOT EXISTS tr_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES tr_companies(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    api_key TEXT NOT NULL UNIQUE,
    tokens_remaining INTEGER NOT NULL DEFAULT 1000,
    tokens_used INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(company_id, email)
  )`],

  ['tr_categories', `CREATE TABLE IF NOT EXISTS tr_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES tr_companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    table_name TEXT NOT NULL UNIQUE,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(company_id, name)
  )`],

  ['tr_user_permissions', `CREATE TABLE IF NOT EXISTS tr_user_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES tr_users(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES tr_categories(id) ON DELETE CASCADE,
    can_upload BOOLEAN NOT NULL DEFAULT false,
    granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, category_id)
  )`],

  ['tr_audit_logs', `CREATE TABLE IF NOT EXISTS tr_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES tr_users(id) ON DELETE SET NULL,
    company_id UUID REFERENCES tr_companies(id) ON DELETE CASCADE,
    user_name TEXT,
    action TEXT NOT NULL,
    query_text TEXT,
    session_id TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`],

  ['초기 회사 JK Networks', `INSERT INTO tr_companies (id, name, slug, plan)
    VALUES ('c0000000-0000-0000-0000-000000000001','JK Networks','jknetworks','enterprise')
    ON CONFLICT (slug) DO NOTHING`],

  ['초기 슈퍼 어드민', `INSERT INTO tr_users (id, company_id, email, name, role, api_key, tokens_remaining)
    VALUES (
      'u0000000-0000-0000-0000-000000000001',
      'c0000000-0000-0000-0000-000000000001',
      'admin@jknetworks.com', 'JK 운영자', 'super_admin',
      'trust_SUPER_ADMIN_KEY_CHANGE_THIS', 999999
    ) ON CONFLICT (api_key) DO NOTHING`],

  ['tr_validate_key RPC', `CREATE OR REPLACE FUNCTION tr_validate_key(p_api_key TEXT)
RETURNS JSONB AS $$
DECLARE
  v_user    tr_users%ROWTYPE;
  v_company tr_companies%ROWTYPE;
  v_cats    JSONB;
BEGIN
  SELECT * INTO v_user FROM tr_users WHERE api_key = p_api_key AND is_active = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', '유효하지 않은 API 키입니다');
  END IF;
  SELECT * INTO v_company FROM tr_companies WHERE id = v_user.company_id AND is_active = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', '비활성화된 계정입니다');
  END IF;
  IF v_user.tokens_remaining <= 0 AND v_user.role NOT IN ('super_admin','company_admin') THEN
    RETURN jsonb_build_object('success', false, 'message', '토큰이 소진되었습니다. 관리자에게 문의하세요.');
  END IF;
  IF v_user.role = 'super_admin' THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object('category_id',c.id,'name',c.name,'table_name',c.table_name,'can_upload',true)),'[]'::jsonb)
    INTO v_cats FROM tr_categories c WHERE c.company_id = v_user.company_id AND c.is_active = true;
  ELSIF v_user.role IN ('company_admin','group_admin') THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object('category_id',c.id,'name',c.name,'table_name',c.table_name,'can_upload',COALESCE(p.can_upload,true))),'[]'::jsonb)
    INTO v_cats FROM tr_categories c
    LEFT JOIN tr_user_permissions p ON p.category_id = c.id AND p.user_id = v_user.id
    WHERE c.company_id = v_user.company_id AND c.is_active = true;
  ELSE
    SELECT COALESCE(jsonb_agg(jsonb_build_object('category_id',c.id,'name',c.name,'table_name',c.table_name,'can_upload',p.can_upload)),'[]'::jsonb)
    INTO v_cats FROM tr_user_permissions p
    JOIN tr_categories c ON c.id = p.category_id AND c.is_active = true
    WHERE p.user_id = v_user.id;
  END IF;
  RETURN jsonb_build_object('success',true,'id',v_user.id,'name',v_user.name,'email',v_user.email,'role',v_user.role,'company',v_company.name,'company_id',v_user.company_id,'tokens_remaining',v_user.tokens_remaining,'categories',v_cats);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER`],

  ['tr_deduct_token RPC', `CREATE OR REPLACE FUNCTION tr_deduct_token(p_user_id UUID, p_session_id TEXT, p_query TEXT)
RETURNS JSONB AS $$
DECLARE v_remaining INTEGER;
BEGIN
  UPDATE tr_users
  SET tokens_remaining = tokens_remaining - 1, tokens_used = tokens_used + 1
  WHERE id = p_user_id AND tokens_remaining > 0
  RETURNING tokens_remaining INTO v_remaining;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', '토큰 부족');
  END IF;
  INSERT INTO tr_audit_logs (user_id, company_id, action, query_text, session_id)
  SELECT p_user_id, company_id, 'chat', p_query, p_session_id FROM tr_users WHERE id = p_user_id;
  RETURN jsonb_build_object('success', true, 'tokens_remaining', v_remaining);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER`],

  ['tr_create_doc_table RPC', `CREATE OR REPLACE FUNCTION tr_create_doc_table(p_table_name TEXT)
RETURNS VOID AS $$
BEGIN
  EXECUTE format('CREATE TABLE IF NOT EXISTS %I (
    id        BIGSERIAL PRIMARY KEY,
    content   TEXT,
    metadata  JSONB,
    embedding VECTOR(1536)
  )', p_table_name);
  EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)',
    p_table_name || ''_emb_idx'', p_table_name);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER`],
];

let errors = 0;
for (const [label, sql] of steps) {
  console.log(`\n▶ ${label}`);
  const result = await runSQL(label, sql.trim());
  if (result?.message || result?.error) errors++;
}

console.log('\n' + '='.repeat(60));
console.log(errors === 0 ? '🎉 모든 단계 완료!' : `⚠️ ${errors}개 오류 발생`);

// 최종 테이블 확인
console.log('\n📊 생성된 테이블:');
await runSQL('테이블 목록', `SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'tr_%' ORDER BY tablename`);
