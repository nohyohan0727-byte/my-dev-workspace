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
          else console.log(`✅ [${label}]: ${JSON.stringify(p).substring(0, 150)}`);
          resolve(p);
        } catch(e) { resolve({ error: d }); }
      });
    });
    req.on('error', e => resolve({ error: e.message }));
    req.write(body);
    req.end();
  });
}

// 기존 doc 테이블 → tr_categories 등록
await runSQL('ISO인증 카테고리 등록',
  `INSERT INTO tr_categories (company_id, name, table_name, description)
   VALUES ('c0000000-0000-0000-0000-000000000001', 'ISO인증', 'tr_jknetworks_iso_cert', 'ISO 인증 관련 문서')
   ON CONFLICT (company_id, name) DO NOTHING`
);

await runSQL('KS인증 카테고리 등록',
  `INSERT INTO tr_categories (company_id, name, table_name, description)
   VALUES ('c0000000-0000-0000-0000-000000000001', 'KS인증', 'tr_jknetworks_ks_cert', 'KS 인증 관련 문서')
   ON CONFLICT (company_id, name) DO NOTHING`
);

// 결과 확인
await runSQL('카테고리 목록 확인',
  `SELECT id, name, table_name FROM tr_categories WHERE company_id = 'c0000000-0000-0000-0000-000000000001'`
);

// validate-key 재테스트 (카테고리 포함)
console.log('\n🔑 validate-key 재테스트 (카테고리 포함):');
const vk = await runSQL('validate-key',
  `SELECT tr_validate_key('trust_SUPER_ADMIN_KEY_CHANGE_THIS') AS result`
);
if (vk[0]?.result) {
  const r = vk[0].result;
  console.log(`  categories: ${JSON.stringify(r.categories, null, 2)}`);
}
