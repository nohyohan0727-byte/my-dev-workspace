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
const P = env['TRUSTRAG_SUPABASE_PROJECT_ID'];
const T = env['SUPABASE_TOKEN'];
const N8N_KEY = env['N8N_API_KEY'];

function sql(label, query) {
  return new Promise(resolve => {
    const body = JSON.stringify({ query });
    const req = https.request({
      hostname: 'api.supabase.com',
      path: `/v1/projects/${P}/database/query`,
      method: 'POST',
      headers: { 'Authorization': `Bearer ${T}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try {
          const p = d ? JSON.parse(d) : [];
          if (p.message || p.error) console.log(`❌ [${label}]`, p.message || p.error);
          else console.log(`✅ [${label}]`);
          resolve(p);
        } catch(e) { resolve({ error: d }); }
      });
    });
    req.on('error', e => resolve({ error: e.message }));
    req.write(body);
    req.end();
  });
}

function n8nApi(method, path, body) {
  return new Promise(resolve => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const req = https.request({
      hostname: 'jknetworks.app.n8n.cloud',
      path: `/api/v1${path}`,
      method,
      headers: {
        'X-N8N-API-KEY': N8N_KEY,
        'Content-Type': 'application/json',
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {})
      }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d)); }
        catch(e) { resolve({ error: d }); }
      });
    });
    req.on('error', e => resolve({ error: e.message }));
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

// Step 1: DB - companies 테이블에 name_en 컬럼 추가
await sql('companies: name_en 컬럼 추가',
  `ALTER TABLE companies ADD COLUMN IF NOT EXISTS name_en TEXT`);

// Step 2: n8n 워크플로우 - Create Company 노드에 name_en 파라미터 추가
const WF_ID = '9c5kGAC7xHGXgvtX';
console.log('\n📥 워크플로우 조회 중...');
const wf = await n8nApi('GET', `/workflows/${WF_ID}`);

const node = wf.nodes?.find(n => n.name === 'Create Company');
if (!node) {
  console.log('❌ Create Company 노드를 찾을 수 없음');
  process.exit(1);
}

// name_en 파라미터가 없으면 추가
const hasNameEn = node.parameters.bodyParameters.parameters.some(p => p.name === 'name_en');
if (!hasNameEn) {
  node.parameters.bodyParameters.parameters.push({
    name: 'name_en',
    value: "={{ $('Extract Request').first().json.data.name_en }}"
  });
  console.log('✅ name_en 파라미터 추가됨');
} else {
  console.log('ℹ️  name_en 이미 존재함');
}

// 워크플로우 저장
const updated = await n8nApi('PUT', `/workflows/${WF_ID}`, {
  name: wf.name,
  nodes: wf.nodes,
  connections: wf.connections,
  settings: wf.settings,
  staticData: wf.staticData
});

if (updated.id) {
  console.log(`✅ 워크플로우 업데이트 완료: ${updated.name}`);
} else {
  console.log('❌ 워크플로우 업데이트 실패:', JSON.stringify(updated).substring(0, 200));
}

console.log('\n✅ 완료!');
