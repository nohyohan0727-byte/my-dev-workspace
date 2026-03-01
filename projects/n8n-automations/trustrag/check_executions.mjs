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

// 최근 실행 목록 (Chat workflow)
const execs = await n8nGet('/executions?workflowId=Oo9ThEBXSg3QUv4L&limit=3');
console.log('\n=== 최근 Chat 실행 ===');
execs.data?.forEach(e => {
  console.log(`ID: ${e.id}, Status: ${e.status}, Started: ${e.startedAt}`);
});

// 가장 최근 실행 상세 확인
if (execs.data?.length > 0) {
  const latest = execs.data[0];
  const detail = await n8nGet(`/executions/${latest.id}`);
  
  console.log('\n=== 최근 실행 상세 ===');
  console.log('Status:', detail.status);
  
  // Search Documents 노드 결과 확인
  const nodes = detail.data?.resultData?.runData;
  if (nodes) {
    const searchNode = nodes['Search Documents'];
    if (searchNode) {
      console.log('\n[Search Documents] 결과:');
      searchNode.forEach((run, i) => {
        const out = run.data?.main?.[0];
        if (out) {
          console.log(`  Run ${i}:`, JSON.stringify(out).substring(0, 300));
        }
        if (run.error) {
          console.log(`  Error:`, run.error?.message);
        }
      });
    }
    
    const mergeNode = nodes['Merge Results'];
    if (mergeNode) {
      console.log('\n[Merge Results] 결과:');
      mergeNode.forEach((run, i) => {
        const out = run.data?.main?.[0];
        if (out) console.log(`  Run ${i}:`, JSON.stringify(out).substring(0, 300));
      });
    }
  }
}
