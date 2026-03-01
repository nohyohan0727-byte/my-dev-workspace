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

// Chat workflow code nodes
const chat = await n8nGet('Oo9ThEBXSg3QUv4L');
console.log('=== CHAT Code Nodes ===\n');
chat.nodes?.filter(n => n.type === 'n8n-nodes-base.code').forEach(n => {
  console.log(`\n--- [${n.name}] ---`);
  console.log(n.parameters?.jsCode || '');
});
