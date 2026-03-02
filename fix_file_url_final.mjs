/**
 * get_file_url 흐름 최종 수정
 *
 * 문제: 빈 배열 응답 시 HTTP Request 노드 0 items 출력 → 하위 노드 실행 안됨
 * 해결: 단일 Code 노드에서 this.helpers.httpRequest 로 직접 처리
 *       Get File URL (Code) → Return File URL (respondToWebhook) 만 사용
 *       나머지 중간 노드(Lookup File in DB, File Found? 등) 전부 제거
 */
import { readFileSync } from 'fs';

const N8N_HOST = 'https://jknetworks.app.n8n.cloud';
const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJlMTM4NWNiNC1mZmVkLTQ5YmItYjdlYi1iZWZkMGZmZWEwOGUiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiOTQzNTcyNjQtODJkZi00OWQ2LTk0NzQtZDc5NzEyYWE3MTY0IiwiaWF0IjoxNzcyMjc0ODU1fQ._ztKN-NyfltpWOef95dPuk5qetcts4628m8pFZzV5oE';
const WORKFLOW_ID = '9c5kGAC7xHGXgvtX';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ5emtjZHZ5d3hibHNieXVqdGZ2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjI2NDk4OCwiZXhwIjoyMDg3ODQwOTg4fQ.gcq-e2pLFWFxtx_Y1tLcPaOcACGthpWPRs7o6w2nz7s';
const SUPABASE_URL = 'https://ryzkcdvywxblsbyujtfv.supabase.co';

// 현재 live 워크플로우 가져오기
const resp0 = await fetch(`${N8N_HOST}/api/v1/workflows/${WORKFLOW_ID}`, {
  headers: { 'X-N8N-API-KEY': N8N_API_KEY }
});
const workflow = await resp0.json();
const conn = workflow.connections;

// ── 1. 불필요한 중간 노드 제거 ─────────────────────────────────────────────
const removeNodes = ['Lookup File in DB', 'File Found?', 'Generate Signed URL',
                     'Format File Response', 'Return File Not Found'];
workflow.nodes = workflow.nodes.filter(n => !removeNodes.includes(n.name));

// ── 2. Get File URL 노드 재작성: this.helpers.httpRequest 사용 ───────────
const getFileUrlNode = workflow.nodes.find(n => n.name === 'Get File URL');
getFileUrlNode.position = [1568, 64];
getFileUrlNode.parameters.jsCode = `
const auth = $('Validate Auth').first().json;
const req  = $('Extract Request').first().json;
const d    = req.data || {};

const SERVICE_KEY  = '${SERVICE_KEY}';
const SUPABASE_URL = '${SUPABASE_URL}';

const company_id  = auth.company_id;
const filename    = (d.filename   || '').trim();
const category_id = d.category_id || null;

if (!filename) {
  return [{ json: { error: 'filename is required' } }];
}

const headers = {
  apikey:        SERVICE_KEY,
  Authorization: 'Bearer ' + SERVICE_KEY,
  'Content-Type': 'application/json',
};

// 1. files 테이블에서 file_path 조회 (회사 격리 + 파일명 인코딩)
let queryUrl = SUPABASE_URL + '/rest/v1/files'
  + '?company_id=eq.' + company_id
  + '&file_name=eq.' + encodeURIComponent(filename)
  + '&limit=1&select=id,file_path,file_name,mime_type';
if (category_id) queryUrl += '&category_id=eq.' + category_id;

let files;
try {
  files = await this.helpers.httpRequest({ method: 'GET', url: queryUrl, headers });
} catch(e) {
  return [{ json: { error: 'DB lookup failed: ' + e.message } }];
}

if (!Array.isArray(files) || files.length === 0) {
  return [{ json: { error: 'File not found or access denied' } }];
}

const file      = files[0];
const file_path = file.file_path;

// 2. Supabase Storage Signed URL 생성 (5분)
const signUrl = SUPABASE_URL + '/storage/v1/object/sign/trustrag-files/' + file_path;
let signResp;
try {
  signResp = await this.helpers.httpRequest({
    method: 'POST',
    url:    signUrl,
    headers,
    body:   { expiresIn: 300 },
    json:   true,
  });
} catch(e) {
  return [{ json: { error: 'Sign URL failed: ' + e.message } }];
}

if (!signResp || signResp.error || !signResp.signedURL) {
  return [{ json: { error: (signResp && signResp.error) || 'Failed to generate download URL' } }];
}

return [{ json: { signed_url: SUPABASE_URL + signResp.signedURL, filename: file.file_name } }];
`.trim();

// ── 3. Return File URL 표현식 업데이트 ────────────────────────────────────
const returnFileUrlNode = workflow.nodes.find(n => n.name === 'Return File URL');
returnFileUrlNode.position = [1792, 64];
returnFileUrlNode.parameters.responseBody =
  "={{ $json.error ? JSON.stringify({ success: false, message: $json.error }) : JSON.stringify({ success: true, url: $json.signed_url, filename: $json.filename }) }}";

// ── 4. 연결 업데이트 ──────────────────────────────────────────────────────
// 중간 노드 연결 제거
removeNodes.forEach(n => { delete conn[n]; });

// Get File URL → Return File URL (직접 연결)
conn['Get File URL'] = {
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
  console.log('[OK] get_file_url 최종 수정 완료');
  console.log('     구조: Get File URL (Code, this.helpers.httpRequest) → Return File URL');
  console.log('     - 중간 노드 제거:', removeNodes.join(', '));
} else {
  console.error('[ERROR]', resp.status, JSON.stringify(result).substring(0, 500));
}
