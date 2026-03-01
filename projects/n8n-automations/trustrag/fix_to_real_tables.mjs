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
          else console.log(`✅ [${label}]`);
          resolve(p);
        } catch(e) { resolve({ error: d }); }
      });
    });
    req.on('error', e => resolve({ error: e.message }));
    req.write(body);
    req.end();
  });
}

// audit_logs 에 resource_type, details 컬럼 추가
await sql('audit_logs: resource_type',
  `ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS resource_type TEXT`);
await sql('audit_logs: details',
  `ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS details JSONB`);

// tr_validate_key - 실제 테이블(users, companies, categories, user_category_access) 사용
await sql('tr_validate_key 업데이트',
  `CREATE OR REPLACE FUNCTION tr_validate_key(p_api_key TEXT)
RETURNS JSONB AS $$
DECLARE
  v_user    users%ROWTYPE;
  v_company companies%ROWTYPE;
  v_cats    JSONB;
BEGIN
  SELECT * INTO v_user FROM users WHERE api_key = p_api_key AND is_active = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', '유효하지 않은 API 키입니다');
  END IF;
  SELECT * INTO v_company FROM companies WHERE id = v_user.company_id AND is_active = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', '비활성화된 계정입니다');
  END IF;
  IF v_user.tokens_remaining <= 0 AND v_user.role NOT IN ('super_admin','company_admin') THEN
    RETURN jsonb_build_object('success', false, 'message', '토큰이 소진되었습니다. 관리자에게 문의하세요.');
  END IF;
  IF v_user.role = 'super_admin' THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'category_id', c.id, 'name', c.name, 'table_name', c.table_name, 'can_upload', true
    )), '[]'::jsonb)
    INTO v_cats FROM categories c
    WHERE c.company_id = v_user.company_id AND c.is_active = true;
  ELSIF v_user.role IN ('company_admin', 'group_admin') THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'category_id', c.id, 'name', c.name, 'table_name', c.table_name,
      'can_upload', COALESCE(p.can_upload, true)
    )), '[]'::jsonb)
    INTO v_cats FROM categories c
    LEFT JOIN user_category_access p ON p.category_id = c.id AND p.user_id = v_user.id
    WHERE c.company_id = v_user.company_id AND c.is_active = true;
  ELSE
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'category_id', c.id, 'name', c.name, 'table_name', c.table_name, 'can_upload', p.can_upload
    )), '[]'::jsonb)
    INTO v_cats FROM user_category_access p
    JOIN categories c ON c.id = p.category_id AND c.is_active = true
    WHERE p.user_id = v_user.id;
  END IF;
  RETURN jsonb_build_object(
    'success', true,
    'id', v_user.id,
    'name', v_user.name,
    'email', v_user.email,
    'role', v_user.role,
    'company', v_company.name,
    'company_id', v_user.company_id,
    'tokens_remaining', v_user.tokens_remaining,
    'categories', v_cats
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER`);

// match_documents 함수 - UUID 반환으로 수정
await sql('match_documents_iso_cert (UUID)',
  `DROP FUNCTION IF EXISTS match_documents_tr_jknetworks_iso_cert(VECTOR, UUID, INT, FLOAT);
   CREATE OR REPLACE FUNCTION match_documents_tr_jknetworks_iso_cert(
    query_embedding VECTOR(1536),
    p_company_id UUID DEFAULT NULL,
    match_count INT DEFAULT 5,
    similarity_threshold FLOAT DEFAULT 0.5
  )
  RETURNS TABLE (id UUID, content TEXT, metadata JSONB, similarity FLOAT)
  LANGUAGE sql SECURITY DEFINER AS $func$
    SELECT id, content, metadata,
           1 - (embedding <=> query_embedding) AS similarity
    FROM tr_jknetworks_iso_cert
    WHERE (p_company_id IS NULL OR company_id = p_company_id)
      AND 1 - (embedding <=> query_embedding) > similarity_threshold
    ORDER BY embedding <=> query_embedding
    LIMIT match_count;
  $func$`);

await sql('match_documents_ks_cert (UUID)',
  `DROP FUNCTION IF EXISTS match_documents_tr_jknetworks_ks_cert(VECTOR, UUID, INT, FLOAT);
   CREATE OR REPLACE FUNCTION match_documents_tr_jknetworks_ks_cert(
    query_embedding VECTOR(1536),
    p_company_id UUID DEFAULT NULL,
    match_count INT DEFAULT 5,
    similarity_threshold FLOAT DEFAULT 0.5
  )
  RETURNS TABLE (id UUID, content TEXT, metadata JSONB, similarity FLOAT)
  LANGUAGE sql SECURITY DEFINER AS $func$
    SELECT id, content, metadata,
           1 - (embedding <=> query_embedding) AS similarity
    FROM tr_jknetworks_ks_cert
    WHERE (p_company_id IS NULL OR company_id = p_company_id)
      AND 1 - (embedding <=> query_embedding) > similarity_threshold
    ORDER BY embedding <=> query_embedding
    LIMIT match_count;
  $func$`);

// write_audit_log - 실제 audit_logs 테이블 사용
await sql('write_audit_log 업데이트',
  `CREATE OR REPLACE FUNCTION write_audit_log(
    p_user_id UUID,
    p_company_id UUID,
    p_action TEXT,
    p_category_id UUID DEFAULT NULL,
    p_file_id UUID DEFAULT NULL,
    p_query_text TEXT DEFAULT NULL
  ) RETURNS VOID AS $func$
  BEGIN
    INSERT INTO audit_logs (user_id, company_id, action, resource_type, details)
    VALUES (p_user_id, p_company_id, p_action, 'category',
      jsonb_build_object('category_id', p_category_id, 'file_id', p_file_id, 'query', p_query_text));
  END;
  $func$ LANGUAGE plpgsql SECURITY DEFINER`);

// create_category_table - DROP 후 재생성
await sql('DROP create_category_table',
  `DROP FUNCTION IF EXISTS create_category_table(TEXT, UUID, UUID)`);

await sql('create_category_table 재생성',
  `CREATE OR REPLACE FUNCTION create_category_table(
    p_table_name TEXT,
    p_company_id UUID DEFAULT NULL,
    p_category_id UUID DEFAULT NULL
  ) RETURNS VOID AS $outer$
  BEGIN
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS %I (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        content TEXT,
        metadata JSONB,
        embedding VECTOR(1536),
        company_id UUID,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )', p_table_name);
    EXECUTE format(
      'CREATE OR REPLACE FUNCTION match_documents_%s(
        query_embedding VECTOR(1536),
        p_company_id UUID DEFAULT NULL,
        match_count INT DEFAULT 5,
        similarity_threshold FLOAT DEFAULT 0.5
      )
      RETURNS TABLE (id UUID, content TEXT, metadata JSONB, similarity FLOAT)
      LANGUAGE sql SECURITY DEFINER AS
      $f$
        SELECT id, content, metadata,
               1 - (embedding <=> query_embedding) AS similarity
        FROM %I
        WHERE (p_company_id IS NULL OR company_id = p_company_id)
          AND 1 - (embedding <=> query_embedding) > similarity_threshold
        ORDER BY embedding <=> query_embedding
        LIMIT match_count;
      $f$',
      p_table_name, p_table_name
    );
  END;
  $outer$ LANGUAGE plpgsql SECURITY DEFINER`);

// 스키마 캐시 갱신
await sql('스키마 캐시 갱신', `NOTIFY pgrst, 'reload schema'`);

console.log('\n⏳ 스키마 캐시 갱신 대기 (15초)...');
await new Promise(r => setTimeout(r, 15000));

// 실제 슈퍼어드민 키로 테스트
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ5emtjZHZ5d3hibHNieXVqdGZ2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjI2NDk4OCwiZXhwIjoyMDg3ODQwOTg4fQ.gcq-e2pLFWFxtx_Y1tLcPaOcACGthpWPRs7o6w2nz7s';
const realApiKey = 'trust_super_25a70cd8-5535-4197-b086-624203db2d9e';

await new Promise(resolve => {
  const body = JSON.stringify({ p_api_key: realApiKey });
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
      console.log(`\n🧪 RPC 테스트 (HTTP ${res.statusCode}):`, d.substring(0, 500));
      resolve();
    });
  });
  req.write(body);
  req.end();
});
