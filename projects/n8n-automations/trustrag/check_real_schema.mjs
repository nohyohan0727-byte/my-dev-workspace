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
          else console.log(`\n📋 [${label}]:`, JSON.stringify(p).substring(0, 1000));
          resolve(p);
        } catch(e) { resolve({ error: d }); }
      });
    });
    req.on('error', e => resolve({ error: e.message }));
    req.write(body);
    req.end();
  });
}

await sql('categories 컬럼',
  `SELECT column_name, data_type FROM information_schema.columns 
   WHERE table_schema='public' AND table_name='categories' ORDER BY ordinal_position`);

await sql('user_category_access 컬럼',
  `SELECT column_name, data_type FROM information_schema.columns 
   WHERE table_schema='public' AND table_name='user_category_access' ORDER BY ordinal_position`);

await sql('super_admin api_key 확인',
  `SELECT id, name, role, api_key, tokens_remaining FROM users WHERE role='super_admin'`);

await sql('iso_cert 행 수 및 id 타입',
  `SELECT COUNT(*), pg_typeof(id) as id_type FROM tr_jknetworks_iso_cert`);
