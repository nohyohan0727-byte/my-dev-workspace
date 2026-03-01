import fs from 'fs';
import https from 'https';

// .env 로드
const env = {};
fs.readFileSync('C:/dev/my-dev-workspace/.env', 'utf8').split('\n').forEach(line => {
  line = line.trim();
  if (line && !line.startsWith('#') && line.includes('=')) {
    const [k, ...v] = line.split('=');
    env[k.trim()] = v.join('=').trim();
  }
});

const N8N_HOST = 'jknetworks.app.n8n.cloud';
const API_KEY = env['N8N_API_KEY'];
const SUPABASE_CRED_ID = env['TRUSTRAG_N8N_SUPABASE_CRED_ID'];

function n8nRequest(method, path, body = null) {
  return new Promise(resolve => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const options = {
      hostname: N8N_HOST,
      path: `/api/v1${path}`,
      method,
      headers: {
        'X-N8N-API-KEY': API_KEY,
        'Content-Type': 'application/json',
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {})
      }
    };
    const req = https.request(options, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(d) }); }
        catch(e) { resolve({ status: res.statusCode, data: d }); }
      });
    });
    req.on('error', e => resolve({ status: 0, data: { error: e.message } }));
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

// 1. 기존 워크플로우 목록
console.log('📋 기존 워크플로우 목록:');
const list = await n8nRequest('GET', '/workflows?limit=50');
const workflows = list.data?.data || [];
workflows.forEach(w => {
  console.log(`  ${w.active ? '✅' : '⏸'} [${w.id}] ${w.name}`);
});

// TrustRAG 워크플로우 이미 있는지 확인
const existingNames = workflows.map(w => w.name);
const trustragWFs = workflows.filter(w => w.name.startsWith('TrustRAG'));
console.log(`\n  TrustRAG 워크플로우 기존: ${trustragWFs.length}개`);

// 2. TrustRAG 워크플로우 정의 (n8n 형식)
const wfDefinitions = [
  {
    name: 'TrustRAG-1-Validate-Key',
    path: 'trustrag/validate-key',
    nodes: [
      {
        id: 'wh-vk',
        name: 'Webhook',
        type: 'n8n-nodes-base.webhook',
        typeVersion: 2,
        position: [240, 300],
        parameters: {
          httpMethod: 'POST',
          path: 'trustrag/validate-key',
          responseMode: 'responseNode',
          options: {}
        },
        webhookId: 'trustrag-validate-key'
      },
      {
        id: 'pg-vk',
        name: 'Supabase RPC',
        type: 'n8n-nodes-base.postgres',
        typeVersion: 2.5,
        position: [480, 300],
        parameters: {
          operation: 'executeQuery',
          query: "SELECT tr_validate_key('{{ $json.body.api_key }}') AS result",
          options: {}
        },
        credentials: { postgres: { id: SUPABASE_CRED_ID, name: 'Supabase (Postgres)' } }
      },
      {
        id: 'resp-vk',
        name: 'Respond',
        type: 'n8n-nodes-base.respondToWebhook',
        typeVersion: 1.1,
        position: [720, 300],
        parameters: {
          respondWith: 'json',
          responseBody: '={{ $json.result }}',
          options: { responseCode: 200 }
        }
      }
    ],
    connections: {
      'Webhook': { main: [[{ node: 'Supabase RPC', type: 'main', index: 0 }]] },
      'Supabase RPC': { main: [[{ node: 'Respond', type: 'main', index: 0 }]] }
    }
  }
];

// 3. validate-key 워크플로우 생성/업데이트
for (const wf of wfDefinitions) {
  const existing = workflows.find(w => w.name === wf.name);

  const payload = {
    name: wf.name,
    nodes: wf.nodes,
    connections: wf.connections,
    settings: { executionOrder: 'v1' }
  };

  let result;
  if (existing) {
    console.log(`\n🔄 업데이트: ${wf.name} (id: ${existing.id})`);
    result = await n8nRequest('PUT', `/workflows/${existing.id}`, payload);
  } else {
    console.log(`\n➕ 생성: ${wf.name}`);
    result = await n8nRequest('POST', '/workflows', payload);
  }

  if (result.status >= 200 && result.status < 300) {
    const id = result.data.id;
    console.log(`  ✅ 성공 (id: ${id})`);

    // 활성화
    const act = await n8nRequest('POST', `/workflows/${id}/activate`);
    console.log(`  ⚡ 활성화: ${act.status === 200 ? '✅' : '❌ ' + JSON.stringify(act.data).substring(0,80)}`);
  } else {
    console.log(`  ❌ 실패: ${JSON.stringify(result.data).substring(0, 200)}`);
  }
}

console.log('\n🎯 Credential ID 확인:');
const creds = await n8nRequest('GET', '/credentials?limit=50');
const credList = creds.data?.data || [];
credList.forEach(c => console.log(`  [${c.id}] ${c.name} (${c.type})`));
