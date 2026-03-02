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

function n8nApi(method, path, body) {
  return new Promise(resolve => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const req = https.request({
      hostname: 'jknetworks.app.n8n.cloud',
      path: '/api/v1' + path,
      method,
      headers: {
        'X-N8N-API-KEY': env.N8N_API_KEY,
        'Content-Type': 'application/json',
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {})
      }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { resolve({ error: d }); } });
    });
    req.on('error', e => resolve({ error: e.message }));
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

const WF_ID = '9c5kGAC7xHGXgvtX';
const SUPABASE_URL = 'https://ryzkcdvywxblsbyujtfv.supabase.co';

const wf = await n8nApi('GET', '/workflows/' + WF_ID);

// List Users: select에 company_id 추가
const listUsersNode = wf.nodes.find(n => n.name === 'List Users');
if (listUsersNode) {
  const old = listUsersNode.parameters.url;
  listUsersNode.parameters.url = old.replace(
    'select=id,email,name,role,tokens_remaining,is_active,created_at',
    'select=id,email,name,role,tokens_remaining,is_active,created_at,company_id'
  );
  console.log('✅ List Users select에 company_id 추가');
  console.log('   URL:', listUsersNode.parameters.url);
}

const updated = await n8nApi('PUT', '/workflows/' + WF_ID, {
  name: wf.name,
  nodes: wf.nodes,
  connections: wf.connections,
  settings: wf.settings,
  staticData: wf.staticData
});

if (updated.id) console.log('✅ 워크플로우 업데이트 완료');
else console.log('❌ 실패:', JSON.stringify(updated).substring(0, 300));
