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
          else console.log(`\n📋 [${label}]:`, JSON.stringify(p).substring(0, 500));
          resolve(p);
        } catch(e) { resolve({ error: d }); }
      });
    });
    req.on('error', e => resolve({ error: e.message }));
    req.write(body);
    req.end();
  });
}

await sql('companies 데이터', `SELECT * FROM companies`);
await sql('users 데이터', `SELECT id, name, role, LEFT(api_key,15)||'...' AS api_key_preview, tokens_remaining FROM users`);
await sql('categories 데이터', `SELECT * FROM categories`);
await sql('user_category_access 수', `SELECT COUNT(*) FROM user_category_access`);

await sql('tr_companies', `SELECT * FROM tr_companies`);
await sql('tr_users', `SELECT id, name, role, LEFT(api_key,15)||'...' AS api_key_preview FROM tr_users`);
await sql('tr_categories', `SELECT id, name, table_name FROM tr_categories`);
