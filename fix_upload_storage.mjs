/**
 * TrustRAG_Upload - Storage 경로 UUID 기반으로 변경
 *
 * 문제: Supabase Storage가 유니코드(한글) 키를 InvalidKey 로 거부
 * 해결: storage_path = company_id/category_id/{uuid}.{ext}  (ASCII 안전)
 *       file_name (DB) = 원본 한글 파일명 그대로 보존
 *       file_path (DB) = UUID 경로 (Signed URL 생성에 사용)
 */

const N8N_HOST = 'https://jknetworks.app.n8n.cloud';
const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJlMTM4NWNiNC1mZmVkLTQ5YmItYjdlYi1iZWZkMGZmZWEwOGUiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiOTQzNTcyNjQtODJkZi00OWQ2LTk0NzQtZDc5NzEyYWE3MTY0IiwiaWF0IjoxNzcyMjc0ODU1fQ._ztKN-NyfltpWOef95dPuk5qetcts4628m8pFZzV5oE';
const UPLOAD_WORKFLOW_ID = 'ZrdgEqchaCSoycyP';
const ADMIN_WORKFLOW_ID  = '9c5kGAC7xHGXgvtX';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ5emtjZHZ5d3hibHNieXVqdGZ2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjI2NDk4OCwiZXhwIjoyMDg3ODQwOTg4fQ.gcq-e2pLFWFxtx_Y1tLcPaOcACGthpWPRs7o6w2nz7s';
const SUPABASE_URL = 'https://ryzkcdvywxblsbyujtfv.supabase.co';

// ── 1. Upload 워크플로우: Prepare Storage Upload ────────────────────────
const resp0 = await fetch(`${N8N_HOST}/api/v1/workflows/${UPLOAD_WORKFLOW_ID}`, {
  headers: { 'X-N8N-API-KEY': N8N_API_KEY }
});
const uploadWf = await resp0.json();

const prepNode = uploadWf.nodes.find(n => n.name === 'Prepare Storage Upload');
prepNode.parameters.jsCode = `
const req  = $('Extract Request').first().json;
const perm = $('Check Upload Permission').first().json;

const SERVICE_KEY  = '${SERVICE_KEY}';
const SUPABASE_URL = '${SUPABASE_URL}';

const filename    = req.filename;
const company_id  = perm.company_id;
const category_id = perm.selected_category.category_id;
const mimetype    = req.mimetype || 'application/octet-stream';

// 확장자 추출
const ext = filename.includes('.') ? filename.split('.').pop().toLowerCase() : '';

// UUID 기반 ASCII 안전 storage_path (한글 등 유니코드 불가)
const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
  const r = Math.random() * 16 | 0;
  return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
});
const safe_name    = uuid + (ext ? '.' + ext : '');
const storage_path = company_id + '/' + category_id + '/' + safe_name;

if (!req.filedata) {
  throw new Error('filedata is empty');
}

// base64 → Buffer → Supabase Storage 직접 업로드
const fileBuffer = Buffer.from(req.filedata, 'base64');

let uploadResp;
try {
  uploadResp = await this.helpers.httpRequest({
    method: 'POST',
    url: SUPABASE_URL + '/storage/v1/object/trustrag-files/' + storage_path,
    headers: {
      'apikey':        SERVICE_KEY,
      'Authorization': 'Bearer ' + SERVICE_KEY,
      'Content-Type':  mimetype,
      'x-upsert':      'true',
    },
    body: fileBuffer,
  });
} catch(e) {
  throw new Error('Storage upload failed: ' + e.message);
}

// filename은 원본 (한글 OK), storage_path는 UUID 경로
return [{ json: { storage_path, filename, company_id, category_id, mimetype, upload_result: uploadResp } }];
`.trim();

// 연결: Prepare Storage Upload → Extract and Chunk Text
uploadWf.connections['Prepare Storage Upload'] = {
  main: [[{ node: 'Extract and Chunk Text', type: 'main', index: 0 }]]
};

const uploadPayload = {
  name: uploadWf.name,
  nodes: uploadWf.nodes,
  connections: uploadWf.connections,
  settings: uploadWf.settings,
  staticData: uploadWf.staticData,
};

const resp1 = await fetch(`${N8N_HOST}/api/v1/workflows/${UPLOAD_WORKFLOW_ID}`, {
  method: 'PUT',
  headers: { 'X-N8N-API-KEY': N8N_API_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify(uploadPayload),
});
const result1 = await resp1.json();
console.log(resp1.ok ? '[OK] Upload 워크플로우 수정 완료' : `[ERROR] Upload: ${resp1.status} ${JSON.stringify(result1).substring(0,300)}`);

// ── 2. Admin 워크플로우: Get File URL (Signed URL 인코딩 제거 - UUID라 불필요) ──
const resp2 = await fetch(`${N8N_HOST}/api/v1/workflows/${ADMIN_WORKFLOW_ID}`, {
  headers: { 'X-N8N-API-KEY': N8N_API_KEY }
});
const adminWf = await resp2.json();

const getFileUrlNode = adminWf.nodes.find(n => n.name === 'Get File URL');
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

// 1. files 테이블에서 file_path 조회 (file_name = 원본 한글 파일명)
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
const file_path = file.file_path;  // UUID 기반 ASCII 경로

// 2. Supabase Storage Signed URL 생성 (5분)
//    file_path는 UUID 기반이라 인코딩 불필요
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

const adminPayload = {
  name: adminWf.name,
  nodes: adminWf.nodes,
  connections: adminWf.connections,
  settings: adminWf.settings,
  staticData: adminWf.staticData,
};

const resp3 = await fetch(`${N8N_HOST}/api/v1/workflows/${ADMIN_WORKFLOW_ID}`, {
  method: 'PUT',
  headers: { 'X-N8N-API-KEY': N8N_API_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify(adminPayload),
});
const result3 = await resp3.json();
console.log(resp3.ok ? '[OK] Admin 워크플로우 (Get File URL) 수정 완료' : `[ERROR] Admin: ${resp3.status} ${JSON.stringify(result3).substring(0,300)}`);

// ── 3. 로컬에서 UUID 방식으로 테스트 업로드 ───────────────────────────
console.log('\n[테스트] UUID 경로로 Supabase Storage 업로드...');
const testUuid = 'test-' + Date.now().toString(36);
const testPath = `test_company/test_cat/${testUuid}.pdf`;
const testResp = await fetch(`${SUPABASE_URL}/storage/v1/object/trustrag-files/${testPath}`, {
  method: 'POST',
  headers: {
    'apikey': SERVICE_KEY,
    'Authorization': `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/pdf',
    'x-upsert': 'true',
  },
  body: Buffer.from('test pdf content'),
});
const testBody = await testResp.text();
console.log(`  상태: ${testResp.status} | 응답: ${testBody}`);
if (testResp.ok) {
  console.log('  ✅ UUID 경로 업로드 성공! 한글 파일명도 이제 정상 동작할 것입니다.');
} else {
  console.log('  ❌ 여전히 실패');
}
