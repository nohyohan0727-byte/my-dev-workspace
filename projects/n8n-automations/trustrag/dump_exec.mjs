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
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { resolve({raw: d.substring(0, 200)}); }});
    });
    req.end();
  });
}

const detail = await n8nGet('/executions/1157');
fs.writeFileSync('C:/dev/my-dev-workspace/projects/n8n-automations/trustrag/exec_1157.json', JSON.stringify(detail, null, 2));
console.log('저장 완료. 크기:', JSON.stringify(detail).length, 'bytes');
console.log('최상위 키:', Object.keys(detail));
