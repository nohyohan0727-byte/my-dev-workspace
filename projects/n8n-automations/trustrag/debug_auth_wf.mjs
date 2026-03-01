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

function n8nGet(id) {
  return new Promise(resolve => {
    const req = https.request({
      hostname: 'jknetworks.app.n8n.cloud',
      path: `/api/v1/workflows/${id}`,
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

const auth = await n8nGet('rDRKlBnQpPNyAcHH');
console.log('=== TrustRAG_Auth 전체 노드 상세 ===\n');
auth.nodes?.forEach(n => {
  console.log(`\n[${n.name}] type: ${n.type}`);
  if (n.parameters) {
    console.log(JSON.stringify(n.parameters, null, 2));
  }
});
