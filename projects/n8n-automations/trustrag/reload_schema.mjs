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
          else console.log(`✅ [${label}]`, JSON.stringify(p).substring(0, 300));
          resolve(p);
        } catch(e) { resolve({ error: d }); }
      });
    });
    req.on('error', e => resolve({ error: e.message }));
    req.write(body);
    req.end();
  });
}

// PostgREST 스키마 캐시 강제 갱신
await sql('schema reload', `NOTIFY pgrst, 'reload schema'`);

// 30초 대기
console.log('⏳ 30초 대기 중...');
await new Promise(r => setTimeout(r, 30000));

// 다시 테스트
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
      console.log(`\nHTTP ${res.statusCode}:`, d.substring(0, 600));
      resolve();
    });
  });
  req.write(body);
  req.end();
});
