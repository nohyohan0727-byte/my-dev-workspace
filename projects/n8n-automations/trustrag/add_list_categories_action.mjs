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

// 1) Route Action에 list_categories 조건 추가
const routeNode = wf.nodes.find(n => n.name === 'Route Action');
const alreadyHas = routeNode.parameters.rules.values.some(
  r => r.conditions.conditions[0].rightValue === 'list_categories'
);
if (!alreadyHas) {
  routeNode.parameters.rules.values.push({
    conditions: {
      options: { caseSensitive: true },
      conditions: [{
        leftValue: "={{ $('Extract Request').first().json.action }}",
        rightValue: 'list_categories',
        operator: { type: 'string', operation: 'equals' }
      }],
      combinator: 'and'
    }
  });
  console.log('✅ Route Action에 list_categories 추가');
}

// Route Action의 출력 인덱스: list_categories는 10번 (0-based, 기존 10개 라우트 다음)
const listCatsOutputIdx = routeNode.parameters.rules.values.length - 1;

// Return List Companies 노드 위치를 기준으로 새 노드 배치
const returnCompNode = wf.nodes.find(n => n.name === 'Return List Companies');
const posX = returnCompNode ? returnCompNode.position[0] + 260 : 2400;
const posY = returnCompNode ? returnCompNode.position[1] : 1900;

// 2) List Categories 노드 추가
const listCatsNodeId = 'adm-list-categories';
const returnCatsNodeId = 'adm-return-list-categories';

const listCatsExists = wf.nodes.some(n => n.id === listCatsNodeId);
if (!listCatsExists) {
  wf.nodes.push({
    id: listCatsNodeId,
    name: 'List Categories',
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.2,
    position: [posX, posY],
    parameters: {
      url: `=${SUPABASE_URL}/rest/v1/categories?company_id=eq.{{ $('Extract Request').first().json.data.company_id || $('Check Admin Role').first().json.company_id }}&select=id,name,table_name,description,is_active,company_id&order=name.asc`,
      sendHeaders: true,
      headerParameters: {
        parameters: [
          { name: 'apikey', value: SERVICE_KEY },
          { name: 'Authorization', value: `Bearer ${SERVICE_KEY}` }
        ]
      },
      options: {}
    }
  });
  console.log('✅ List Categories 노드 추가');
}

// 3) Return List Categories 노드 추가
const returnCatsExists = wf.nodes.some(n => n.id === returnCatsNodeId);
if (!returnCatsExists) {
  wf.nodes.push({
    id: returnCatsNodeId,
    name: 'Return List Categories',
    type: 'n8n-nodes-base.respondToWebhook',
    typeVersion: 1.1,
    position: [posX + 240, posY],
    parameters: {
      respondWith: 'text',
      responseBody: `={{ JSON.stringify({ success: true, action: 'list_categories', result: $input.all().map(i => i.json) }) }}`,
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
  console.log('✅ Return List Categories 노드 추가');
}

// 4) 연결 추가: Route Action[listCatsOutputIdx] → List Categories → Return List Categories
// connections 구조: { [fromNodeName]: { main: [ [array of targets per output] ] } }
if (!wf.connections['Route Action']) wf.connections['Route Action'] = { main: [] };
// 배열 길이를 listCatsOutputIdx+1까지 늘리기
while (wf.connections['Route Action'].main.length <= listCatsOutputIdx) {
  wf.connections['Route Action'].main.push([]);
}
const routeToListCats = wf.connections['Route Action'].main[listCatsOutputIdx];
if (!routeToListCats.some(c => c.node === 'List Categories')) {
  routeToListCats.push({ node: 'List Categories', type: 'main', index: 0 });
  console.log('✅ Route Action → List Categories 연결');
}

if (!wf.connections['List Categories']) wf.connections['List Categories'] = { main: [[]] };
if (!wf.connections['List Categories'].main[0].some(c => c.node === 'Return List Categories')) {
  wf.connections['List Categories'].main[0].push({ node: 'Return List Categories', type: 'main', index: 0 });
  console.log('✅ List Categories → Return List Categories 연결');
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
