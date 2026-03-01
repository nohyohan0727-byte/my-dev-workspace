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
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try {
          const p = d ? JSON.parse(d) : [];
          if (p.message || p.error) {
            console.log(`❌ [${label}]: ${p.message || p.error}`);
          } else {
            console.log(`✅ [${label}]: ${JSON.stringify(p).substring(0, 120)}`);
          }
          resolve(p);
        } catch(e) {
          console.log(`❌ [${label}] 파싱 오류: ${d.substring(0, 100)}`);
          resolve({ error: d });
        }
      });
    });
    req.on('error', e => { console.log(`❌ [${label}] 오류: ${e.message}`); resolve({ error: e.message }); });
    req.write(body);
    req.end();
  });
}

// Fix 1: 슈퍼 어드민 (UUID 자동생성)
await runSQL('슈퍼어드민 생성',
  `INSERT INTO tr_users (company_id, email, name, role, api_key, tokens_remaining)
   VALUES (
     'c0000000-0000-0000-0000-000000000001',
     'admin@jknetworks.com',
     'JK 운영자',
     'super_admin',
     'trust_SUPER_ADMIN_KEY_CHANGE_THIS',
     999999
   ) ON CONFLICT (api_key) DO NOTHING`
);

// Fix 2: tr_create_doc_table (인덱스 별도)
await runSQL('tr_create_doc_table 함수',
  `CREATE OR REPLACE FUNCTION tr_create_doc_table(p_table_name TEXT)
   RETURNS VOID AS $func$
   BEGIN
     EXECUTE format(
       'CREATE TABLE IF NOT EXISTS %I (id BIGSERIAL PRIMARY KEY, content TEXT, metadata JSONB, embedding VECTOR(1536))',
       p_table_name
     );
   END;
   $func$ LANGUAGE plpgsql SECURITY DEFINER`
);

// 확인
await runSQL('전체 테이블 목록',
  `SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'tr_%' ORDER BY tablename`
);
await runSQL('슈퍼어드민 확인',
  `SELECT id, name, role, LEFT(api_key, 15) || '...' AS api_key_preview, tokens_remaining FROM tr_users WHERE role = 'super_admin'`
);
await runSQL('RPC 함수 목록',
  `SELECT routine_name FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name LIKE 'tr_%'`
);
