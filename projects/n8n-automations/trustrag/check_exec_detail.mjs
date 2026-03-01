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
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { resolve({error: d}); }});
    });
    req.end();
  });
}

const detail = await n8nGet('/executions/1157');
const nodes = detail.data?.resultData?.runData;

// 모든 노드 출력
if (nodes) {
  for (const [name, runs] of Object.entries(nodes)) {
    console.log(`\n=== [${name}] ===`);
    runs.forEach((run, i) => {
      if (run.error) {
        console.log(`  ERROR:`, JSON.stringify(run.error).substring(0, 200));
      }
      const out = run.data?.main;
      if (out) {
        out.forEach((items, branch) => {
          if (items && items.length > 0) {
            const sample = items[0]?.json;
            console.log(`  Branch[${branch}][0]:`, JSON.stringify(sample).substring(0, 200));
          }
        });
      }
    });
  }
}
