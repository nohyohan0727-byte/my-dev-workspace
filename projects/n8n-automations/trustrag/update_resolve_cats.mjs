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

function n8nPut(id, workflow) {
  return new Promise(resolve => {
    const body = JSON.stringify(workflow);
    const req = https.request({
      hostname: 'jknetworks.app.n8n.cloud',
      path: `/api/v1/workflows/${id}`,
      method: 'PUT',
      headers: { 'X-N8N-API-KEY': KEY, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(JSON.parse(d)));
    });
    req.write(body);
    req.end();
  });
}

// Chat 워크플로우 로드
const wf = await n8nGet('Oo9ThEBXSg3QUv4L');
console.log('워크플로우 로드:', wf.name);

// Resolve Categories 노드 찾기
const resolveCatsNode = wf.nodes?.find(n => n.name === 'Resolve Categories');
if (!resolveCatsNode) {
  console.log('❌ Resolve Categories 노드 없음');
  process.exit(1);
}

console.log('현재 코드:\n', resolveCatsNode.parameters.jsCode.substring(0, 200));

// 새 코드: table_name 또는 name으로 매칭
const newCode = `// N개 item 반환 → Search Documents가 N번 자동 실행
const embedding = $('Get Query Embedding').first().json.data[0].embedding;
const auth = $('Validate Auth').first().json;
const requestedTableNames = $('Extract Request').first().json.categories || [];

const allCats = auth.categories || [];
if (allCats.length === 0) {
  return [{ json: { error: '접근 가능한 카테고리가 없습니다' } }];
}

// 요청한 카테고리 table_name 기준 필터 (빈 배열이면 전체)
const filtered = requestedTableNames.length > 0
  ? allCats.filter(c => requestedTableNames.includes(c.table_name) || requestedTableNames.includes(c.name))
  : allCats;

if (filtered.length === 0) {
  return [{ json: { error: '선택한 카테고리에 접근 권한이 없습니다' } }];
}

// 각 카테고리별 item 반환 (n8n이 이후 노드를 각 item마다 실행)
return filtered.map(cat => ({
  json: {
    table_name: cat.table_name,
    category_name: cat.name,
    category_id: cat.category_id,
    company_id: auth.company_id,
    user_id: auth.user_id,
    embedding: embedding
  }
}));`;

resolveCatsNode.parameters.jsCode = newCode;

// 워크플로우 업데이트 (활성화 여부는 유지)
const updatePayload = {
  name: wf.name,
  nodes: wf.nodes,
  connections: wf.connections,
  settings: wf.settings || {},
  staticData: wf.staticData || null
};

const result = await n8nPut('Oo9ThEBXSg3QUv4L', updatePayload);
if (result.id) {
  console.log('✅ Resolve Categories 코드 업데이트 완료');
} else {
  console.log('❌ 업데이트 실패:', JSON.stringify(result).substring(0, 200));
}
