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
const wf = await n8nApi('GET', '/workflows/' + WF_ID);

// 1) List Companies: select에 name_en 추가
const listNode = wf.nodes.find(n => n.name === 'List Companies');
if (listNode) {
  listNode.parameters.url = 'https://ryzkcdvywxblsbyujtfv.supabase.co/rest/v1/companies?is_active=eq.true&select=id,name,name_en,slug&order=name.asc';
  console.log('✅ List Companies URL 업데이트 (name_en 추가)');
}

// 2) Return List Companies: Collect Companies의 companies 배열을 result로 직접 반환
const returnNode = wf.nodes.find(n => n.name === 'Return List Companies');
if (returnNode) {
  // Collect Companies가 { companies: [...] } 를 반환하므로 그 배열을 직접 result로
  returnNode.parameters.responseBody =
    `={{ JSON.stringify({ success: true, action: 'list_companies', result: $('Collect Companies').first().json.companies }) }}`;
  console.log('✅ Return List Companies 수정 (companies 배열 직접 반환)');
}

const updated = await n8nApi('PUT', '/workflows/' + WF_ID, {
  name: wf.name,
  nodes: wf.nodes,
  connections: wf.connections,
  settings: wf.settings,
  staticData: wf.staticData
});

if (updated.id) console.log('✅ 워크플로우 업데이트 완료:', updated.name);
else console.log('❌ 실패:', JSON.stringify(updated).substring(0, 300));
