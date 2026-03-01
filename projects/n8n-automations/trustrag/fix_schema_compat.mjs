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

// Step 1: tr_users 컬럼 추가
await sql('tr_users: tokens_total',
  `ALTER TABLE tr_users ADD COLUMN IF NOT EXISTS tokens_total INTEGER NOT NULL DEFAULT 0`);
await sql('tr_users: updated_at',
  `ALTER TABLE tr_users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ`);
await sql('tr_users: tokens_total 초기값',
  `UPDATE tr_users SET tokens_total = tokens_remaining WHERE tokens_total = 0`);

// Step 2: tr_audit_logs 컬럼 추가
await sql('tr_audit_logs: resource_type',
  `ALTER TABLE tr_audit_logs ADD COLUMN IF NOT EXISTS resource_type TEXT`);
await sql('tr_audit_logs: details',
  `ALTER TABLE tr_audit_logs ADD COLUMN IF NOT EXISTS details JSONB`);

// Step 3: 벡터 테이블에 company_id 추가
await sql('iso_cert: company_id',
  `ALTER TABLE tr_jknetworks_iso_cert ADD COLUMN IF NOT EXISTS company_id UUID`);
await sql('ks_cert: company_id',
  `ALTER TABLE tr_jknetworks_ks_cert ADD COLUMN IF NOT EXISTS company_id UUID`);
await sql('기존 행 company_id 설정',
  `UPDATE tr_jknetworks_iso_cert SET company_id='c0000000-0000-0000-0000-000000000001' WHERE company_id IS NULL;
   UPDATE tr_jknetworks_ks_cert SET company_id='c0000000-0000-0000-0000-000000000001' WHERE company_id IS NULL`);

// Step 4: files 테이블
await sql('files 테이블',
  `CREATE TABLE IF NOT EXISTS files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES tr_companies(id) ON DELETE CASCADE,
    category_id UUID REFERENCES tr_categories(id) ON DELETE SET NULL,
    file_name TEXT,
    file_path TEXT,
    drive_file_id TEXT DEFAULT '',
    file_size INTEGER DEFAULT 0,
    mime_type TEXT,
    chunk_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);

// Step 5: 뷰 생성
await sql('users 뷰',
  `DROP VIEW IF EXISTS users CASCADE; CREATE VIEW users AS SELECT * FROM tr_users`);
await sql('categories 뷰',
  `DROP VIEW IF EXISTS categories CASCADE; CREATE VIEW categories AS SELECT * FROM tr_categories`);
await sql('companies 뷰',
  `DROP VIEW IF EXISTS companies CASCADE; CREATE VIEW companies AS SELECT * FROM tr_companies`);
await sql('audit_logs 뷰',
  `DROP VIEW IF EXISTS audit_logs CASCADE; CREATE VIEW audit_logs AS SELECT * FROM tr_audit_logs`);
await sql('user_category_access 뷰',
  `DROP VIEW IF EXISTS user_category_access CASCADE; CREATE VIEW user_category_access AS SELECT * FROM tr_user_permissions`);

// Step 6: 뷰 권한
await sql('뷰 권한',
  `GRANT SELECT, INSERT, UPDATE, DELETE ON users TO anon, authenticated, service_role;
   GRANT SELECT, INSERT, UPDATE, DELETE ON categories TO anon, authenticated, service_role;
   GRANT SELECT, INSERT, UPDATE, DELETE ON companies TO anon, authenticated, service_role;
   GRANT SELECT, INSERT, UPDATE, DELETE ON audit_logs TO anon, authenticated, service_role;
   GRANT SELECT, INSERT, UPDATE, DELETE ON user_category_access TO anon, authenticated, service_role;
   GRANT ALL ON files TO anon, authenticated, service_role`);

// Step 7: match_documents 함수 - ISO인증
await sql('match_documents_iso_cert',
  `CREATE OR REPLACE FUNCTION match_documents_tr_jknetworks_iso_cert(
    query_embedding VECTOR(1536),
    p_company_id UUID DEFAULT NULL,
    match_count INT DEFAULT 5,
    similarity_threshold FLOAT DEFAULT 0.5
  )
  RETURNS TABLE (id BIGINT, content TEXT, metadata JSONB, similarity FLOAT)
  LANGUAGE sql SECURITY DEFINER AS $func$
    SELECT id, content, metadata,
           1 - (embedding <=> query_embedding) AS similarity
    FROM tr_jknetworks_iso_cert
    WHERE (p_company_id IS NULL OR company_id = p_company_id)
      AND 1 - (embedding <=> query_embedding) > similarity_threshold
    ORDER BY embedding <=> query_embedding
    LIMIT match_count;
  $func$`);

// Step 8: match_documents 함수 - KS인증
await sql('match_documents_ks_cert',
  `CREATE OR REPLACE FUNCTION match_documents_tr_jknetworks_ks_cert(
    query_embedding VECTOR(1536),
    p_company_id UUID DEFAULT NULL,
    match_count INT DEFAULT 5,
    similarity_threshold FLOAT DEFAULT 0.5
  )
  RETURNS TABLE (id BIGINT, content TEXT, metadata JSONB, similarity FLOAT)
  LANGUAGE sql SECURITY DEFINER AS $func$
    SELECT id, content, metadata,
           1 - (embedding <=> query_embedding) AS similarity
    FROM tr_jknetworks_ks_cert
    WHERE (p_company_id IS NULL OR company_id = p_company_id)
      AND 1 - (embedding <=> query_embedding) > similarity_threshold
    ORDER BY embedding <=> query_embedding
    LIMIT match_count;
  $func$`);

// Step 9: write_audit_log RPC
await sql('write_audit_log RPC',
  `CREATE OR REPLACE FUNCTION write_audit_log(
    p_user_id UUID,
    p_company_id UUID,
    p_action TEXT,
    p_category_id UUID DEFAULT NULL,
    p_file_id UUID DEFAULT NULL,
    p_query_text TEXT DEFAULT NULL
  ) RETURNS VOID AS $func$
  BEGIN
    INSERT INTO tr_audit_logs (user_id, company_id, action, query_text, metadata)
    VALUES (p_user_id, p_company_id, p_action, p_query_text,
      jsonb_build_object('category_id', p_category_id, 'file_id', p_file_id));
  END;
  $func$ LANGUAGE plpgsql SECURITY DEFINER`);

// Step 10: create_category_table RPC (동적 match_documents 생성 포함)
await sql('create_category_table RPC',
  `CREATE OR REPLACE FUNCTION create_category_table(
    p_table_name TEXT,
    p_company_id UUID DEFAULT NULL,
    p_category_id UUID DEFAULT NULL
  ) RETURNS VOID AS $outer$
  BEGIN
    -- 벡터 테이블 생성
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS %I (
        id BIGSERIAL PRIMARY KEY,
        content TEXT,
        metadata JSONB,
        embedding VECTOR(1536),
        company_id UUID
      )', p_table_name);
    -- match_documents 함수 동적 생성
    EXECUTE format(
      'CREATE OR REPLACE FUNCTION match_documents_%s(
        query_embedding VECTOR(1536),
        p_company_id UUID DEFAULT NULL,
        match_count INT DEFAULT 5,
        similarity_threshold FLOAT DEFAULT 0.5
      )
      RETURNS TABLE (id BIGINT, content TEXT, metadata JSONB, similarity FLOAT)
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

// Step 11: 스키마 캐시 갱신
await sql('스키마 캐시 갱신', `NOTIFY pgrst, 'reload schema'`);

console.log('\n✅ 모든 호환성 수정 완료!');
