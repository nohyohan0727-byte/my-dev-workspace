/**
 * get_file_url 흐름 재구성
 * 기존: Get File URL (Code, $helpers HTTP) → Return File URL
 * 변경: Get File URL (Code, 검증만) → Lookup File in DB (HTTP GET)
 *       → File Found? (IF) → Generate Signed URL (HTTP POST)
 *       → Format File Response (Code) → Return File URL
 *                              ↘ Return File Not Found (IF false 분기)
 */
import { readFileSync } from 'fs';

const N8N_HOST = 'https://jknetworks.app.n8n.cloud';
const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJlMTM4NWNiNC1mZmVkLTQ5YmItYjdlYi1iZWZkMGZmZWEwOGUiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiOTQzNTcyNjQtODJkZi00OWQ2LTk0NzQtZDc5NzEyYWE3MTY0IiwiaWF0IjoxNzcyMjc0ODU1fQ._ztKN-NyfltpWOef95dPuk5qetcts4628m8pFZzV5oE';
const WORKFLOW_ID = '9c5kGAC7xHGXgvtX';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ5emtjZHZ5d3hibHNieXVqdGZ2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjI2NDk4OCwiZXhwIjoyMDg3ODQwOTg4fQ.gcq-e2pLFWFxtx_Y1tLcPaOcACGthpWPRs7o6w2nz7s';
const SUPABASE_URL = 'https://ryzkcdvywxblsbyujtfv.supabase.co';
const AUTH_HEADERS = [
  { name: 'apikey',        value: SERVICE_KEY },
  { name: 'Authorization', value: `Bearer ${SERVICE_KEY}` },
  { name: 'Content-Type',  value: 'application/json' }
];

// 현재 live 워크플로우 가져오기
const resp0 = await fetch(`${N8N_HOST}/api/v1/workflows/${WORKFLOW_ID}`, {
  headers: { 'X-N8N-API-KEY': N8N_API_KEY }
});
const workflow = await resp0.json();
const conn = workflow.connections;

// ── 1. Get File URL 노드 재작성 (HTTP 호출 제거, 검증+URL빌드만) ──────────
const getFileUrlNode = workflow.nodes.find(n => n.name === 'Get File URL');
getFileUrlNode.parameters.jsCode = [
  "const auth = $('Validate Auth').first().json;",
  "const req  = $('Extract Request').first().json;",
  "const d    = req.data || {};",
  "const filename   = (d.filename   || '').trim();",
  "const category_id = d.category_id || null;",
  "const company_id  = auth.company_id;",
  "",
  "// Supabase PostgREST 쿼리 URL (파일명 URL 인코딩)",
  "let queryUrl = [",
  "  `${'" + SUPABASE_URL + "'}/rest/v1/files`,",
  "  `?company_id=eq.${company_id}`,",
  "  `&file_name=eq.${encodeURIComponent(filename)}`,",
  "  `&limit=1`,",
  "  `&select=id,file_path,file_name,mime_type`",
  "].join('');",
  "if (category_id) queryUrl += `&category_id=eq.${category_id}`;",
  "",
  "return [{ json: { company_id, filename, category_id, queryUrl } }];"
].join('\n');
getFileUrlNode.position = [1344, 64];

// ── 2. 새 노드 정의 ────────────────────────────────────────────────────────

// 2-a. Lookup File in DB (HTTP GET)
const lookupFileNode = {
  id: 'adm-lookup-file',
  name: 'Lookup File in DB',
  type: 'n8n-nodes-base.httpRequest',
  typeVersion: 4.2,
  position: [1568, 64],
  parameters: {
    method: 'GET',
    url: "={{ $json.queryUrl }}",
    sendHeaders: true,
    headerParameters: { parameters: AUTH_HEADERS },
    options: { response: { response: { neverError: true } } }
  }
};

// 2-b. File Found? (IF: 결과 배열 길이 > 0)
const fileFoundNode = {
  id: 'adm-file-found',
  name: 'File Found?',
  type: 'n8n-nodes-base.if',
  typeVersion: 2,
  position: [1792, 64],
  parameters: {
    conditions: {
      options: { caseSensitive: true },
      conditions: [{
        id: 'c-found',
        leftValue: "={{ Array.isArray($json) ? $json.length : ($json && $json.id ? 1 : 0) }}",
        rightValue: 0,
        operator: { type: 'number', operation: 'gt' }
      }],
      combinator: 'and'
    },
    options: {}
  }
};

// 2-c. Generate Signed URL (HTTP POST)
//      파일명 포함 경로를 encodeURIComponent 로 분할 인코딩
const genSignedUrlNode = {
  id: 'adm-gen-signed-url',
  name: 'Generate Signed URL',
  type: 'n8n-nodes-base.httpRequest',
  typeVersion: 4.2,
  position: [2016, 64],
  parameters: {
    method: 'POST',
    url: `={{ '${SUPABASE_URL}/storage/v1/object/sign/trustrag-files/' + ($json[0] ? $json[0].file_path : '') }}`,
    sendHeaders: true,
    headerParameters: { parameters: AUTH_HEADERS },
    sendBody: true,
    contentType: 'json',
    bodyParameters: {
      parameters: [{ name: 'expiresIn', value: 300 }]
    },
    options: { response: { response: { neverError: true } } }
  }
};

// 2-d. Format File Response (Code: 최종 응답 조립)
const formatFileRespNode = {
  id: 'adm-format-file-resp',
  name: 'Format File Response',
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position: [2240, 64],
  parameters: {
    jsCode: [
      "const signResult = $input.first().json;",
      "const lookupResult = $('Lookup File in DB').first().json;",
      "const fileData = Array.isArray(lookupResult) ? lookupResult[0] : lookupResult;",
      "const SUPABASE_URL = '" + SUPABASE_URL + "';",
      "",
      "if (!signResult.signedURL) {",
      "  return [{ json: { response: JSON.stringify({ success: false, message: signResult.error || 'Failed to generate download URL' }) } }];",
      "}",
      "",
      "const fullUrl = SUPABASE_URL + signResult.signedURL;",
      "return [{ json: { response: JSON.stringify({ success: true, url: fullUrl, filename: fileData.file_name }) } }];"
    ].join('\n')
  }
};

// 2-e. Return File Not Found (respondToWebhook, IF false 분기)
const returnFileNotFoundNode = {
  id: 'adm-return-file-404',
  name: 'Return File Not Found',
  type: 'n8n-nodes-base.respondToWebhook',
  typeVersion: 1.1,
  position: [2016, 240],
  parameters: {
    respondWith: 'text',
    responseBody: "={{ JSON.stringify({ success: false, message: 'File not found or access denied' }) }}",
    options: {
      responseHeaders: {
        entries: [
          { name: 'Content-Type',              value: 'application/json' },
          { name: 'Access-Control-Allow-Origin', value: '*' }
        ]
      }
    }
  }
};

workflow.nodes.push(lookupFileNode, fileFoundNode, genSignedUrlNode, formatFileRespNode, returnFileNotFoundNode);

// ── 3. Return File URL 표현식 업데이트 ────────────────────────────────────
const returnFileUrlNode = workflow.nodes.find(n => n.name === 'Return File URL');
returnFileUrlNode.parameters.responseBody = "={{ $json.response }}";
returnFileUrlNode.position = [2464, 64];

// ── 4. 연결 업데이트 ──────────────────────────────────────────────────────
// Get File URL → Lookup File in DB (기존 → Return File URL 제거)
conn['Get File URL'] = {
  main: [[{ node: 'Lookup File in DB', type: 'main', index: 0 }]]
};
// Lookup File in DB → File Found?
conn['Lookup File in DB'] = {
  main: [[{ node: 'File Found?', type: 'main', index: 0 }]]
};
// File Found? true→Generate Signed URL / false→Return File Not Found
conn['File Found?'] = {
  main: [
    [{ node: 'Generate Signed URL',   type: 'main', index: 0 }],
    [{ node: 'Return File Not Found', type: 'main', index: 0 }]
  ]
};
// Generate Signed URL → Format File Response
conn['Generate Signed URL'] = {
  main: [[{ node: 'Format File Response', type: 'main', index: 0 }]]
};
// Format File Response → Return File URL
conn['Format File Response'] = {
  main: [[{ node: 'Return File URL', type: 'main', index: 0 }]]
};

// ── 5. n8n API PUT ─────────────────────────────────────────────────────────
const payload = {
  name: workflow.name,
  nodes: workflow.nodes,
  connections: workflow.connections,
  settings: workflow.settings,
  staticData: workflow.staticData
};

const resp = await fetch(`${N8N_HOST}/api/v1/workflows/${WORKFLOW_ID}`, {
  method: 'PUT',
  headers: { 'X-N8N-API-KEY': N8N_API_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify(payload)
});
const result = await resp.json();

if (resp.ok) {
  console.log('[OK] get_file_url 흐름 재구성 완료');
  console.log('     Get File URL(Code) → Lookup File in DB(HTTP GET) → File Found?(IF)');
  console.log('       ├ true  → Generate Signed URL(HTTP POST) → Format File Response → Return File URL');
  console.log('       └ false → Return File Not Found');
} else {
  console.error('[ERROR]', resp.status, JSON.stringify(result, null, 2));
}
