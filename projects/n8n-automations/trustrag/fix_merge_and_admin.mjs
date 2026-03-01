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

// ── Chat 워크플로우 수정 ──────────────────────────────────────────
const chatWf = await n8nGet('Oo9ThEBXSg3QUv4L');
console.log('Chat 워크플로우:', chatWf.name);

const mergeNode = chatWf.nodes?.find(n => n.name === 'Merge Results');
if (mergeNode) {
  // category 표시 버그 수정: metadata.category_name 또는 metadata.category 사용
  mergeNode.parameters.jsCode = `// 모든 카테고리 검색 결과 통합
const allItems = $input.all();
const results = [];
const sources = [];

allItems.forEach(item => {
  const d = item.json;
  // Supabase RPC 오류 응답 스킵 (code 필드 존재 = 오류)
  if (d.code || d.error) return;
  if (d.content) {
    results.push({
      content: d.content,
      similarity: d.similarity || 0,
      metadata: d.metadata || {},
      category_name: d.metadata?.category_name || d.metadata?.category || ''
    });
    // 소스 중복 제거
    const fname = d.metadata?.source_filename || d.metadata?.filename || '알 수 없는 파일';
    if (!sources.find(s => s.filename === fname)) {
      sources.push({
        filename: fname,
        similarity: Math.round((d.similarity || 0) * 100) / 100,
        category: d.metadata?.category_name || d.metadata?.category || ''
      });
    }
  }
});

// 유사도 내림차순 정렬
results.sort((a, b) => b.similarity - a.similarity);

return [{ json: { results, sources } }];`;
  console.log('✅ Merge Results 수정 완료');
}

const chatPayload = {
  name: chatWf.name,
  nodes: chatWf.nodes,
  connections: chatWf.connections,
  settings: chatWf.settings || {},
  staticData: chatWf.staticData || null
};
const chatResult = await n8nPut('Oo9ThEBXSg3QUv4L', chatPayload);
console.log(chatResult.id ? '✅ Chat 업데이트 완료' : '❌ Chat 업데이트 실패');

// ── Admin 워크플로우 수정 (list_users 다중 행 반환) ───────────────
const adminWf = await n8nGet('9c5kGAC7xHGXgvtX');
console.log('\nAdmin 워크플로우:', adminWf.name);

const listUsersNode = adminWf.nodes?.find(n => n.name === 'Return List Users');
if (listUsersNode) {
  listUsersNode.parameters.responseBody = `={{ JSON.stringify({ success: true, action: 'list_users', result: $input.all().map(i => i.json) }) }}`;
  console.log('✅ Return List Users 수정 완료');
}

// list_companies도 동일하게 수정
const listCompaniesNode = adminWf.nodes?.find(n => n.name === 'Return List Companies');
if (listCompaniesNode) {
  listCompaniesNode.parameters.responseBody = `={{ JSON.stringify({ success: true, action: 'list_companies', result: $input.all().map(i => i.json) }) }}`;
  console.log('✅ Return List Companies 수정 완료');
}

// audit logs도
const auditNode = adminWf.nodes?.find(n => n.name === 'Return Audit Logs');
if (auditNode) {
  auditNode.parameters.responseBody = `={{ JSON.stringify({ success: true, action: 'get_audit_logs', result: $input.all().map(i => i.json) }) }}`;
  console.log('✅ Return Audit Logs 수정 완료');
}

const adminPayload = {
  name: adminWf.name,
  nodes: adminWf.nodes,
  connections: adminWf.connections,
  settings: adminWf.settings || {},
  staticData: adminWf.staticData || null
};
const adminResult = await n8nPut('9c5kGAC7xHGXgvtX', adminPayload);
console.log(adminResult.id ? '✅ Admin 업데이트 완료' : '❌ Admin 업데이트 실패');
