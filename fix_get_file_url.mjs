import { readFileSync, writeFileSync } from 'fs';

const N8N_HOST = 'https://jknetworks.app.n8n.cloud';
const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJlMTM4NWNiNC1mZmVkLTQ5YmItYjdlYi1iZWZkMGZmZWEwOGUiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiOTQzNTcyNjQtODJkZi00OWQ2LTk0NzQtZDc5NzEyYWE3MTY0IiwiaWF0IjoxNzcyMjc0ODU1fQ._ztKN-NyfltpWOef95dPuk5qetcts4628m8pFZzV5oE';
const WORKFLOW_ID = '9c5kGAC7xHGXgvtX';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ5emtjZHZ5d3hibHNieXVqdGZ2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjI2NDk4OCwiZXhwIjoyMDg3ODQwOTg4fQ.gcq-e2pLFWFxtx_Y1tLcPaOcACGthpWPRs7o6w2nz7s';
const SUPABASE_URL = 'https://ryzkcdvywxblsbyujtfv.supabase.co';

const workflow = JSON.parse(readFileSync('trustrag_admin_current.json', 'utf8'));

// Get File URL 노드: req.data.filename 으로 수정
const getFileUrlNode = workflow.nodes.find(n => n.name === 'Get File URL');
getFileUrlNode.parameters.jsCode = [
  "const auth = $('Validate Auth').first().json;",
  "const req = $('Extract Request').first().json;",
  "// data 객체에서 파라미터 추출 (Extract Request가 data 필드로 감쌈)",
  "const d = req.data || {};",
  "",
  "const SERVICE_KEY = '" + SERVICE_KEY + "';",
  "const SUPABASE_URL = '" + SUPABASE_URL + "';",
  "",
  "const company_id = auth.company_id;",
  "const filename = d.filename || '';",
  "const category_id = d.category_id || null;",
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
].join('\n');

// n8n API PUT
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
  console.log('[OK] Get File URL 노드 수정 완료: req.filename → req.data.filename');
} else {
  console.error('[ERROR]', resp.status, JSON.stringify(result, null, 2));
}
