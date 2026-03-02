import { readFileSync, writeFileSync } from 'fs';

const N8N_HOST = 'https://jknetworks.app.n8n.cloud';
const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJlMTM4NWNiNC1mZmVkLTQ5YmItYjdlYi1iZWZkMGZmZWEwOGUiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiOTQzNTcyNjQtODJkZi00OWQ2LTk0NzQtZDc5NzEyYWE3MTY0IiwiaWF0IjoxNzcyMjc0ODU1fQ._ztKN-NyfltpWOef95dPuk5qetcts4628m8pFZzV5oE';
const WORKFLOW_ID = '9c5kGAC7xHGXgvtX';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ5emtjZHZ5d3hibHNieXVqdGZ2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjI2NDk4OCwiZXhwIjoyMDg3ODQwOTg4fQ.gcq-e2pLFWFxtx_Y1tLcPaOcACGthpWPRs7o6w2nz7s';
const SUPABASE_URL = 'https://ryzkcdvywxblsbyujtfv.supabase.co';

const workflow = JSON.parse(readFileSync('trustrag_admin_workflow.json', 'utf8'));
const conn = workflow.connections;

// ──────────────────────────────────────────────────────────────────────────
// 새 노드 정의
// ──────────────────────────────────────────────────────────────────────────

// 1. Is File URL Request? (인증된 모든 사용자가 접근 가능한 분기)
//    Is Authorized? true → Is File URL Request?
//      true  → Get File URL
//      false → Check Admin Role (기존 흐름)
const isFileUrlNode = {
  id: 'adm-is-file-url',
  name: 'Is File URL Request?',
  type: 'n8n-nodes-base.if',
  typeVersion: 2,
  position: [1120, 192],  // Check Admin Role 자리 (기존 노드 이동)
  parameters: {
    conditions: {
      options: { caseSensitive: true },
      conditions: [{
        id: 'c-file-url',
        leftValue: "={{ $('Extract Request').first().json.action }}",
        rightValue: 'get_file_url',
        operator: { type: 'string', operation: 'equals' }
      }],
      combinator: 'and'
    },
    options: {}
  }
};

// 2. Get File URL (Code node: DB조회 + Signed URL 생성)
//    인증된 사용자의 company_id로 파일 검색 후 5분 서명 URL 반환
const getFileUrlNode = {
  id: 'adm-get-file-url',
  name: 'Get File URL',
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position: [1344, 64],
  parameters: {
    jsCode: [
      "const auth = $('Validate Auth').first().json;",
      "const req = $('Extract Request').first().json;",
      "",
      "const SERVICE_KEY = '" + SERVICE_KEY + "';",
      "const SUPABASE_URL = '" + SUPABASE_URL + "';",
      "",
      "const company_id = auth.company_id;",
      "const filename = req.filename;",
      "const category_id = req.category_id || null;",
      "",
      "if (!filename) {",
      "  return [{ json: { error: 'filename is required' } }];",
      "}",
      "",
      "const authHeaders = {",
      "  apikey: SERVICE_KEY,",
      "  Authorization: `Bearer ${SERVICE_KEY}`,",
      "  'Content-Type': 'application/json'",
      "};",
      "",
      "// 1. files 테이블에서 파일 경로 조회 (회사 격리)",
      "let queryUrl = `${SUPABASE_URL}/rest/v1/files?company_id=eq.${company_id}&file_name=eq.${encodeURIComponent(filename)}&limit=1&select=id,file_path,file_name,mime_type`;",
      "if (category_id) queryUrl += `&category_id=eq.${category_id}`;",
      "",
      "const files = await $helpers.httpRequest({",
      "  method: 'GET',",
      "  url: queryUrl,",
      "  headers: authHeaders,",
      "});",
      "",
      "if (!files || files.length === 0) {",
      "  return [{ json: { error: 'File not found or access denied' } }];",
      "}",
      "",
      "const file = files[0];",
      "const file_path = file.file_path;",
      "",
      "// 2. Supabase Storage Signed URL 생성 (유효기간 5분)",
      "const signResp = await $helpers.httpRequest({",
      "  method: 'POST',",
      "  url: `${SUPABASE_URL}/storage/v1/object/sign/trustrag-files/${file_path}`,",
      "  headers: authHeaders,",
      "  body: { expiresIn: 300 },",
      "});",
      "",
      "if (signResp.error) {",
      "  return [{ json: { error: signResp.error } }];",
      "}",
      "",
      "const fullUrl = `${SUPABASE_URL}${signResp.signedURL}`;",
      "return [{ json: { signed_url: fullUrl, filename: file.file_name } }];"
    ].join('\n')
  }
};

// 3. Return File URL (respondToWebhook)
const returnFileUrlNode = {
  id: 'adm-return-file-url',
  name: 'Return File URL',
  type: 'n8n-nodes-base.respondToWebhook',
  typeVersion: 1.1,
  position: [1568, 64],
  parameters: {
    respondWith: 'text',
    responseBody: "={{ $json.error ? JSON.stringify({ success: false, message: $json.error }) : JSON.stringify({ success: true, url: $json.signed_url, filename: $json.filename }) }}",
    options: {
      responseHeaders: {
        entries: [
          { name: 'Content-Type', value: 'application/json' },
          { name: 'Access-Control-Allow-Origin', value: '*' }
        ]
      }
    }
  }
};

// ──────────────────────────────────────────────────────────────────────────
// 기존 노드 위치 조정 (Is File URL Request? 삽입으로 밀림)
// ──────────────────────────────────────────────────────────────────────────
const posShift = {
  'adm-check-role': [1344, 192],   // 기존 [1120,192] → 오른쪽으로 이동
  'adm-role-ok':    [1568, 192],   // 기존 [1344,192]
  'adm-router':     [1792, 128],   // 기존 [1568,128]
  'adm-role-err':   [1792, 368],   // 기존 [1568,368]
};
for (const node of workflow.nodes) {
  if (posShift[node.id]) node.position = posShift[node.id];
}

// ──────────────────────────────────────────────────────────────────────────
// 노드 추가
// ──────────────────────────────────────────────────────────────────────────
workflow.nodes.push(isFileUrlNode, getFileUrlNode, returnFileUrlNode);

// ──────────────────────────────────────────────────────────────────────────
// 연결 수정
// ──────────────────────────────────────────────────────────────────────────

// Is Authorized? true: Check Admin Role → Is File URL Request?
conn['Is Authorized?'].main[0] = [{ node: 'Is File URL Request?', type: 'main', index: 0 }];

// Is File URL Request?
//   true  → Get File URL
//   false → Check Admin Role (기존 흐름)
conn['Is File URL Request?'] = {
  main: [
    [{ node: 'Get File URL', type: 'main', index: 0 }],
    [{ node: 'Check Admin Role', type: 'main', index: 0 }]
  ]
};

// Get File URL → Return File URL
conn['Get File URL'] = {
  main: [[{ node: 'Return File URL', type: 'main', index: 0 }]]
};

// ──────────────────────────────────────────────────────────────────────────
// 저장 및 n8n API PUT
// ──────────────────────────────────────────────────────────────────────────
writeFileSync('trustrag_admin_workflow_updated.json', JSON.stringify(workflow, null, 2));
console.log('[OK] Updated admin workflow saved.');

const payload = {
  name: workflow.name,
  nodes: workflow.nodes,
  connections: workflow.connections,
  settings: workflow.settings,
  staticData: workflow.staticData
};

const resp = await fetch(`${N8N_HOST}/api/v1/workflows/${WORKFLOW_ID}`, {
  method: 'PUT',
  headers: {
    'X-N8N-API-KEY': N8N_API_KEY,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(payload)
});

const result = await resp.json();
if (resp.ok) {
  console.log('[OK] TrustRAG_Admin workflow updated!');
  console.log('     New action: get_file_url (accessible to all authenticated users)');
  console.log('     Flow: Is Authorized? → Is File URL Request? → Get File URL → Return File URL');
  console.log('     Security: company_id isolation, 5-min signed URL, service key server-side only');
} else {
  console.error('[ERROR]', resp.status, JSON.stringify(result, null, 2));
}
