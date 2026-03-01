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

const wfs = {
  'TrustRAG_Chat':   'Oo9ThEBXSg3QUv4L',
  'TrustRAG_Upload': 'ZrdgEqchaCSoycyP',
  'TrustRAG_Admin':  '9c5kGAC7xHGXgvtX'
};

for (const [name, id] of Object.entries(wfs)) {
  const wf = await n8nGet(id);
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📋 ${name} (${id})`);
  wf.nodes?.forEach(n => {
    console.log(`\n  [${n.name}] type: ${n.type}`);
    if (n.type === 'n8n-nodes-base.httpRequest') {
      console.log('    URL:', n.parameters?.url);
      if (n.parameters?.bodyParameters?.parameters) {
        console.log('    Body params:', JSON.stringify(n.parameters.bodyParameters.parameters));
      }
      if (n.parameters?.sendQuery && n.parameters?.queryParameters?.parameters) {
        console.log('    Query params:', JSON.stringify(n.parameters.queryParameters.parameters));
      }
    }
    if (n.type === 'n8n-nodes-base.code') {
      console.log('    Code:', n.parameters?.jsCode?.substring(0, 200));
    }
    if (n.type === 'n8n-nodes-base.respondToWebhook') {
      console.log('    Response:', n.parameters?.responseBody?.substring(0, 150));
    }
  });
}
