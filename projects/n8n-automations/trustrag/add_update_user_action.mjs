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
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ5emtjZHZ5d3hibHNieXVqdGZ2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjI2NDk4OCwiZXhwIjoyMDg3ODQwOTg4fQ.gcq-e2pLFWFxtx_Y1tLcPaOcACGthpWPRs7o6w2nz7s';

const wf = await n8nApi('GET', '/workflows/' + WF_ID);
console.log('워크플로우 로드:', wf.name);

// 1) Route Action에 update_user 조건 추가
const routeNode = wf.nodes.find(n => n.name === 'Route Action');
const alreadyHas = routeNode.parameters.rules.values.some(
  r => r.conditions.conditions[0].rightValue === 'update_user'
);
if (!alreadyHas) {
  routeNode.parameters.rules.values.push({
    conditions: {
      options: { caseSensitive: true },
      conditions: [{
        leftValue: "={{ $('Extract Request').first().json.action }}",
        rightValue: 'update_user',
        operator: { type: 'string', operation: 'equals' }
      }],
      combinator: 'and'
    }
  });
  console.log('✅ Route Action에 update_user 추가');
}

const updateUserOutputIdx = routeNode.parameters.rules.values.length - 1;

// 기준 노드 위치
const listCatsNode = wf.nodes.find(n => n.name === 'List Categories');
const posX = listCatsNode ? listCatsNode.position[0] + 260 : 2700;
const posY = listCatsNode ? listCatsNode.position[1] : 1900;

// 2) Update User 노드 추가 (PATCH)
const updateUserNodeId = 'adm-update-user';
const returnUpdateUserNodeId = 'adm-return-update-user';

if (!wf.nodes.some(n => n.id === updateUserNodeId)) {
  wf.nodes.push({
    id: updateUserNodeId,
    name: 'Update User',
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.2,
    position: [posX, posY],
    parameters: {
      method: 'PATCH',
      url: `=${SUPABASE_URL}/rest/v1/users?id=eq.{{ $('Extract Request').first().json.data.user_id }}`,
      sendHeaders: true,
      headerParameters: {
        parameters: [
          { name: 'apikey', value: SERVICE_KEY },
          { name: 'Authorization', value: `Bearer ${SERVICE_KEY}` },
          { name: 'Content-Type', value: 'application/json' },
          { name: 'Prefer', value: 'return=representation' }
        ]
      },
      sendBody: true,
      specifyBody: 'json',
      jsonBody: `={{ JSON.stringify(Object.fromEntries(Object.entries({ role: $('Extract Request').first().json.data.role, is_active: $('Extract Request').first().json.data.is_active }).filter(([,v]) => v !== undefined && v !== null))) }}`,
      options: { response: { response: { neverError: true } } }
    }
  });
  console.log('✅ Update User 노드 추가');
}

// 3) Return Update User 노드 추가
if (!wf.nodes.some(n => n.id === returnUpdateUserNodeId)) {
  wf.nodes.push({
    id: returnUpdateUserNodeId,
    name: 'Return Update User',
    type: 'n8n-nodes-base.respondToWebhook',
    typeVersion: 1.1,
    position: [posX + 240, posY],
    parameters: {
      respondWith: 'text',
      responseBody: `={{ JSON.stringify({ success: true, action: 'update_user', result: $input.first().json }) }}`,
      options: {
        responseHeaders: {
          entries: [
            { name: 'Content-Type', value: 'application/json' },
            { name: 'Access-Control-Allow-Origin', value: '*' }
          ]
        }
      }
    }
  });
  console.log('✅ Return Update User 노드 추가');
}

// 4) 연결 추가
if (!wf.connections['Route Action']) wf.connections['Route Action'] = { main: [] };
while (wf.connections['Route Action'].main.length <= updateUserOutputIdx) {
  wf.connections['Route Action'].main.push([]);
}
const routeToUpdate = wf.connections['Route Action'].main[updateUserOutputIdx];
if (!routeToUpdate.some(c => c.node === 'Update User')) {
  routeToUpdate.push({ node: 'Update User', type: 'main', index: 0 });
  console.log('✅ Route Action → Update User 연결');
}

if (!wf.connections['Update User']) wf.connections['Update User'] = { main: [[]] };
if (!wf.connections['Update User'].main[0].some(c => c.node === 'Return Update User')) {
  wf.connections['Update User'].main[0].push({ node: 'Return Update User', type: 'main', index: 0 });
  console.log('✅ Update User → Return Update User 연결');
}

// 5) 저장
const updated = await n8nApi('PUT', '/workflows/' + WF_ID, {
  name: wf.name,
  nodes: wf.nodes,
  connections: wf.connections,
  settings: wf.settings,
  staticData: wf.staticData
});

if (updated.id) console.log('✅ 워크플로우 업데이트 완료:', updated.name);
else console.log('❌ 실패:', JSON.stringify(updated).substring(0, 400));
