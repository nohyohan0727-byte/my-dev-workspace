/**
 * TrustRAG_Upload 워크플로우 전면 재구성
 *
 * [변경 전] 잘못된 구조:
 *   Browser → base64 인코딩 → JSON body → n8n webhook
 *   → Prepare Storage Upload (binary 변환 실패)
 *   → Extract and Chunk Text (PDF binary를 UTF-8로 디코딩 → 쓰레기)
 *
 * [변경 후] 정석 구조:
 *   Browser → FormData multipart (raw binary, base64 없음) → n8n webhook
 *   → Extract Request (binary 보존, JSON 메타데이터 분리)
 *   → ... → Can Upload?
 *   → Storage Upload (Code: getBinaryDataBuffer → Supabase Storage PUT)
 *   → Extract Text (Code: binary에서 텍스트 추출, 파일 형식별 처리)
 *   → Chunk Text → 임베딩 → 저장 → Return Response
 *
 * 핵심 변경:
 * 1. Extract Request: binary pass-through 추가
 * 2. Prepare Storage Upload: getBinaryDataBuffer로 binary 직접 접근
 * 3. 새 노드 Extract Text: 파일 형식별 텍스트 추출 (PDF/TXT/CSV 등)
 * 4. Extract and Chunk Text → Chunk Text: 텍스트 청킹만 담당
 * 5. Save File Metadata: file_path = storage_path
 */

const N8N_HOST = 'https://jknetworks.app.n8n.cloud';
const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJlMTM4NWNiNC1mZmVkLTQ5YmItYjdlYi1iZWZkMGZmZWEwOGUiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiOTQzNTcyNjQtODJkZi00OWQ2LTk0NzQtZDc5NzEyYWE3MTY0IiwiaWF0IjoxNzcyMjc0ODU1fQ._ztKN-NyfltpWOef95dPuk5qetcts4628m8pFZzV5oE';
const WORKFLOW_ID = 'ZrdgEqchaCSoycyP';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ5emtjZHZ5d3hibHNieXVqdGZ2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjI2NDk4OCwiZXhwIjoyMDg3ODQwOTg4fQ.gcq-e2pLFWFxtx_Y1tLcPaOcACGthpWPRs7o6w2nz7s';
const SUPABASE_URL = 'https://ryzkcdvywxblsbyujtfv.supabase.co';

const resp0 = await fetch(`${N8N_HOST}/api/v1/workflows/${WORKFLOW_ID}`, {
  headers: { 'X-N8N-API-KEY': N8N_API_KEY }
});
const workflow = await resp0.json();
const conn = workflow.connections;

// ── 1. Extract Request: binary pass-through 추가 ─────────────────────────
// FormData 에서 텍스트 필드는 body.*, 파일 바이너리는 binary.file
const extractNode = workflow.nodes.find(n => n.name === 'Extract Request');
extractNode.parameters.jsCode = `
const body = $input.first().json.body || $input.first().json;
const binary = $input.first().binary || {};
// binary pass-through: 하위 노드에서 getBinaryDataBuffer로 접근
return [{
  json: {
    api_key:  (body.api_key  || '').trim(),
    category: body.category  || '',
    filename: body.filename  || '',
    filesize: Number(body.filesize) || 0,
    mimetype: body.mimetype  || 'application/octet-stream',
  },
  binary,
}];
`.trim();

// ── 2. Prepare Storage Upload: getBinaryDataBuffer 사용 ──────────────────
const prepNode = workflow.nodes.find(n => n.name === 'Prepare Storage Upload');
prepNode.parameters.jsCode = `
const req  = $('Extract Request').first().json;
const perm = $('Check Upload Permission').first().json;

const SERVICE_KEY  = '${SERVICE_KEY}';
const SUPABASE_URL = '${SUPABASE_URL}';

const filename    = req.filename;
const company_id  = perm.company_id;
const category_id = perm.selected_category.category_id;
const mimetype    = req.mimetype || 'application/octet-stream';

// UUID 기반 ASCII-safe storage path
const ext = filename.includes('.') ? filename.split('.').pop().toLowerCase() : '';
const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
  const r = Math.random() * 16 | 0;
  return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
});
const storage_path = company_id + '/' + category_id + '/' + uuid + (ext ? '.' + ext : '');

// binary 데이터 취득 (FormData 의 'file' 필드)
let fileBuffer;
try {
  fileBuffer = await this.helpers.getBinaryDataBuffer($('Extract Request').first(), 'file');
} catch(e) {
  throw new Error('파일 바이너리 읽기 실패: ' + e.message);
}

// Supabase Storage 업로드
try {
  await this.helpers.httpRequest({
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
  throw new Error('Storage 업로드 실패: ' + e.message);
}

return [{ json: { storage_path, filename, company_id, category_id, mimetype } }];
`.trim();

// ── 3. 새 노드: Extract Text (파일 형식별 텍스트 추출) ──────────────────
const extractTextNode = {
  id: 'up-extract-text-node',
  name: 'Extract Text',
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position: [2240, 64],
  parameters: {
    jsCode: `
const req      = $('Extract Request').first().json;
const mimetype = req.mimetype || 'application/octet-stream';
const filename = req.filename || '';

let fileBuffer;
try {
  fileBuffer = await this.helpers.getBinaryDataBuffer($('Extract Request').first(), 'file');
} catch(e) {
  return [{ json: { extracted_text: '[파일 읽기 실패: ' + e.message + ']' } }];
}

let extracted_text = '';
const isTextFile = mimetype.startsWith('text/') ||
  ['application/json','application/xml','application/csv'].includes(mimetype) ||
  /\\.(txt|md|csv|json|html|xml|htm)$/i.test(filename);
const isPDF = mimetype === 'application/pdf' || /\\.pdf$/i.test(filename);

if (isTextFile) {
  // 텍스트 파일: UTF-8 직접 디코딩
  extracted_text = fileBuffer.toString('utf-8');

} else if (isPDF) {
  // PDF 텍스트 추출 (텍스트 레이어가 있는 PDF만 가능)
  const str = fileBuffer.toString('binary');
  const parts = str.split('Tj');
  const texts = [];
  for (const p of parts) {
    const m = p.lastIndexOf('(');
    if (m >= 0) {
      const raw = p.slice(m + 1);
      const clean = raw.replace(/[^\\x20-\\x7E\\uAC00-\\uD7A3\\u3131-\\u314E]/g, ' ').replace(/\\s+/g, ' ').trim();
      if (clean && clean.length > 1) texts.push(clean);
    }
  }
  extracted_text = texts.join(' ').replace(/\\s+/g, ' ').trim();

  if (!extracted_text || extracted_text.length < 30) {
    extracted_text = '[스캔된 PDF: ' + filename + ']\\n' +
      '이 파일은 이미지 기반 스캔 PDF입니다. 텍스트 레이어가 없어 내용을 추출할 수 없습니다.\\n' +
      '해결 방법: PDF를 텍스트로 변환하거나, 내용을 TXT 파일로 저장하여 업로드해주세요.';
  }
} else {
  extracted_text = '[지원하지 않는 형식: ' + mimetype + ' (' + filename + ')]\\n' +
    'TXT, CSV, PDF(텍스트) 형식을 사용해주세요.';
}

return [{ json: { extracted_text } }];
`.trim()
  }
};

// ── 4. Extract and Chunk Text → Chunk Text (청킹만 담당) ────────────────
const chunkNode = workflow.nodes.find(n => n.name === 'Extract and Chunk Text');
chunkNode.name = 'Chunk Text';
chunkNode.position = [2460, 64];
chunkNode.parameters.jsCode = `
const extracted_text = $input.first().json.extracted_text || '';
const req  = $('Extract Request').first().json;
const perm = $('Check Upload Permission').first().json;

const paragraphs = extracted_text.split(/\\n\\n+/).filter(p => p.trim().length > 0);
const chunks = [];
let current = '';
for (const para of paragraphs) {
  if ((current + '\\n\\n' + para).length > 800) {
    if (current) chunks.push(current.trim());
    current = para;
  } else {
    current = current ? current + '\\n\\n' + para : para;
  }
}
if (current.trim()) chunks.push(current.trim());

if (chunks.length === 0) {
  return [{ json: {
    success: false,
    message: '텍스트를 추출할 수 없습니다: ' + req.filename
  }}];
}

const metadata = {
  source_filename: req.filename,
  filesize: req.filesize,
  mimetype: req.mimetype,
  category: req.category,
  uploaded_at: new Date().toISOString()
};

return chunks.map((chunk, i) => ({
  json: {
    chunk,
    chunk_index: i,
    total_chunks: chunks.length,
    metadata,
    company_id: perm.company_id,
    table_name: perm.selected_category.table_name,
    filename: req.filename,
  }
}));
`.trim();

// ── 5. Save File Metadata: file_path = storage_path ─────────────────────
const saveMetaNode = workflow.nodes.find(n => n.id === 'up-save-meta');
const filePathParam = saveMetaNode.parameters.bodyParameters.parameters
  .find(p => p.name === 'file_path');
filePathParam.value = "={{ $('Prepare Storage Upload').first().json.storage_path }}";
const fileNameParam = saveMetaNode.parameters.bodyParameters.parameters
  .find(p => p.name === 'file_name');
if (fileNameParam) {
  fileNameParam.value = "={{ $('Extract Request').first().json.filename }}";
}

// ── 6. 노드 추가 및 기존 노드 위치 조정 ─────────────────────────────────
// Prepare Storage Upload 위치: [1800, 64]
prepNode.position = [1800, 64];
// Extract Text 추가 (새 노드)
workflow.nodes.push(extractTextNode);

// 기존 다운스트림 노드 위치 이동 (2개 오른쪽 이동)
const posShift = {
  'up-embed-http':    [2680, 64],
  'up-insert-vector': [2900, 64],
  'up-aggregate':     [3120, 64],
  'up-save-meta':     [3340, 64],
  'up-audit':         [3560, 64],
  'up-return':        [3780, 64],
};
for (const node of workflow.nodes) {
  if (posShift[node.id]) node.position = posShift[node.id];
}

// ── 7. 연결 업데이트 ──────────────────────────────────────────────────────
// Upload to Storage 노드 제거 (있으면)
workflow.nodes = workflow.nodes.filter(n => n.name !== 'Upload to Storage');
delete conn['Upload to Storage'];

// Can Upload? true → Prepare Storage Upload
conn['Can Upload?'].main[0] = [{ node: 'Prepare Storage Upload', type: 'main', index: 0 }];

// Prepare Storage Upload → Extract Text
conn['Prepare Storage Upload'] = {
  main: [[{ node: 'Extract Text', type: 'main', index: 0 }]]
};

// Extract Text → Chunk Text
conn['Extract Text'] = {
  main: [[{ node: 'Chunk Text', type: 'main', index: 0 }]]
};

// Chunk Text → Get Chunk Embedding (기존 'Extract and Chunk Text' 연결 이전)
conn['Chunk Text'] = conn['Extract and Chunk Text'];
delete conn['Extract and Chunk Text'];

// ── 8. n8n API PUT ────────────────────────────────────────────────────────
const payload = {
  name: workflow.name,
  nodes: workflow.nodes,
  connections: workflow.connections,
  settings: workflow.settings,
  staticData: workflow.staticData,
};

const resp = await fetch(`${N8N_HOST}/api/v1/workflows/${WORKFLOW_ID}`, {
  method: 'PUT',
  headers: { 'X-N8N-API-KEY': N8N_API_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
});
const result = await resp.json();

if (resp.ok) {
  console.log('[OK] Upload 워크플로우 재구성 완료');
  console.log('  Extract Request: binary pass-through');
  console.log('  Prepare Storage Upload: getBinaryDataBuffer → Supabase Storage');
  console.log('  Extract Text: 파일 형식별 텍스트 추출 (PDF/TXT/CSV)');
  console.log('  Chunk Text: 텍스트 청킹만');
  console.log('  흐름: Can Upload? → Prepare Storage Upload → Extract Text → Chunk Text → ...');
} else {
  console.error('[ERROR]', resp.status, JSON.stringify(result).substring(0, 500));
}
