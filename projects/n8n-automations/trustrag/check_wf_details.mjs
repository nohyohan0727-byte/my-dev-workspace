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
const KEY = env['N8N_API_KEY'];

function n8nGet(path) {
  return new Promise(resolve => {
    const req = https.request({
      hostname: 'jknetworks.app.n8n.cloud',
      path: `/api/v1${path}`,
      method: 'GET',
      headers: { 'X-N8N-API-KEY': KEY }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(JSON.parse(d)));
    });
    req.end();
  });
}

const wfs = {
  'TrustRAG_Auth': 'rDRKlBnQpPNyAcHH',
  'TrustRAG_Chat': 'Oo9ThEBXSg3QUv4L',
  'TrustRAG_Upload': 'ZrdgEqchaCSoycyP',
  'TrustRAG_Admin': '9c5kGAC7xHGXgvtX'
};

for (const [name, id] of Object.entries(wfs)) {
  const wf = await n8nGet(`/workflows/${id}`);
  console.log(`\n${'='.repeat(50)}`);
  console.log(`📋 ${name} (${id}) - ${wf.active ? '✅ 활성' : '⏸ 비활성'}`);
  console.log('노드 목록:');
  wf.nodes?.forEach(n => {
    console.log(`  [${n.type}] ${n.name}`);
    // SQL 쿼리 표시
    if (n.parameters?.query) {
      console.log(`    SQL: ${String(n.parameters.query).substring(0, 100)}`);
    }
    // Code 노드
    if (n.parameters?.jsCode) {
      console.log(`    Code: ${String(n.parameters.jsCode).substring(0, 80)}...`);
    }
    // Credential
    if (n.credentials) {
      console.log(`    Creds: ${JSON.stringify(n.credentials)}`);
    }
  });
}
