import { readFileSync, writeFileSync } from 'fs';

const N8N_HOST = 'https://jknetworks.app.n8n.cloud';
const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJlMTM4NWNiNC1mZmVkLTQ5YmItYjdlYi1iZWZkMGZmZWEwOGUiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiOTQzNTcyNjQtODJkZi00OWQ2LTk0NzQtZDc5NzEyYWE3MTY0IiwiaWF0IjoxNzcyMjc0ODU1fQ._ztKN-NyfltpWOef95dPuk5qetcts4628m8pFZzV5oE';
const WORKFLOW_ID = 'ZrdgEqchaCSoycyP';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ5emtjZHZ5d3hibHNieXVqdGZ2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjI2NDk4OCwiZXhwIjoyMDg3ODQwOTg4fQ.gcq-e2pLFWFxtx_Y1tLcPaOcACGthpWPRs7o6w2nz7s';
const SUPABASE_URL = 'https://ryzkcdvywxblsbyujtfv.supabase.co';

const workflow = JSON.parse(readFileSync('trustrag_upload_workflow.json', 'utf8'));

// ── 1. 노드 위치 재배치 (시각적 순서 정렬) ──────────────────────────────
const positionMap = {
  'up-extract-text':  [2020, 64],
  'up-embed-http':    [2240, 64],
  'up-insert-vector': [2460, 64],
  'up-aggregate':     [2680, 64],
  'up-save-meta':     [2900, 64],
  'up-audit':         [3120, 64],
  'up-return':        [3340, 64],
};
for (const node of workflow.nodes) {
  if (positionMap[node.id]) node.position = positionMap[node.id];
}

// ── 2. 새 노드 추가 ────────────────────────────────────────────────────

// Prepare Storage Upload: base64 → binary
const prepStorageNode = {
  id: 'up-prep-storage',
  name: 'Prepare Storage Upload',
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position: [1580, 64],
  parameters: {
    jsCode: [
      "const req = $('Extract Request').first().json;",
      "const perm = $('Check Upload Permission').first().json;",
      "const filename = req.filename;",
      "const company_id = perm.company_id;",
      "const category_id = perm.selected_category.category_id;",
      "// 스토리지 경로: {company_id}/{category_id}/{filename}",
      "const storage_path = `${company_id}/${category_id}/${filename}`;",
      "",
      "// base64 → Buffer → n8n binary",
      "const fileBuffer = Buffer.from(req.filedata, 'base64');",
      "const binaryData = await this.helpers.prepareBinaryData(fileBuffer, filename, req.mimetype);",
      "",
      "return [{",
      "  json: { storage_path, company_id, category_id, filename, mimetype: req.mimetype },",
      "  binary: { file: binaryData }",
      "}];"
    ].join('\n')
  }
};

// Upload to Storage: POST binary to Supabase Storage
const storageUploadNode = {
  id: 'up-storage-upload',
  name: 'Upload to Storage',
  type: 'n8n-nodes-base.httpRequest',
  typeVersion: 4.2,
  position: [1800, 64],
  parameters: {
    method: 'POST',
    url: `={{ '${SUPABASE_URL}/storage/v1/object/trustrag-files/' + $json.storage_path }}`,
    sendHeaders: true,
    headerParameters: {
      parameters: [
        { name: 'apikey',         value: SERVICE_KEY },
        { name: 'Authorization',  value: `Bearer ${SERVICE_KEY}` },
        { name: 'Content-Type',   value: '={{ $json.mimetype }}' },
        { name: 'x-upsert',       value: 'true' }
      ]
    },
    sendBody: true,
    contentType: 'binaryData',
    binaryPropertyName: 'file',
    options: {
      response: { response: { neverError: true } }
    }
  }
};

workflow.nodes.push(prepStorageNode, storageUploadNode);

// ── 3. 연결 수정 ────────────────────────────────────────────────────────
const conn = workflow.connections;

// Can Upload? true: Extract and Chunk Text → Prepare Storage Upload
conn['Can Upload?'].main[0] = [{ node: 'Prepare Storage Upload', type: 'main', index: 0 }];

// Prepare Storage Upload → Upload to Storage
conn['Prepare Storage Upload'] = {
  main: [[{ node: 'Upload to Storage', type: 'main', index: 0 }]]
};

// Upload to Storage → Extract and Chunk Text
conn['Upload to Storage'] = {
  main: [[{ node: 'Extract and Chunk Text', type: 'main', index: 0 }]]
};

// ── 4. Save File Metadata: file_path 수정 (스토리지 경로 반영) ──────────
const saveMetaNode = workflow.nodes.find(n => n.id === 'up-save-meta');
const filePathParam = saveMetaNode.parameters.bodyParameters.parameters
  .find(p => p.name === 'file_path');
// 이전: TrustRAG/{company_id}/{filename}
// 이후: {company_id}/{category_id}/{filename}  (버킷 내 경로)
filePathParam.value = "={{ $('Prepare Storage Upload').first().json.storage_path }}";

// drive_file_id 제거 (Storage로 대체되므로 불필요)
saveMetaNode.parameters.bodyParameters.parameters =
  saveMetaNode.parameters.bodyParameters.parameters.filter(p => p.name !== 'drive_file_id');

// ── 5. 업데이트된 워크플로우 저장 ──────────────────────────────────────
writeFileSync('trustrag_upload_workflow_updated.json', JSON.stringify(workflow, null, 2));
console.log('[OK] Updated workflow saved to trustrag_upload_workflow_updated.json');

// ── 6. n8n API에 PUT ───────────────────────────────────────────────────
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
  console.log('[OK] TrustRAG_Upload workflow updated successfully!');
  console.log('     New nodes: Prepare Storage Upload, Upload to Storage');
  console.log('     Flow: Can Upload? → Prepare Storage Upload → Upload to Storage → Extract and Chunk Text → ...');
} else {
  console.error('[ERROR]', resp.status, JSON.stringify(result, null, 2));
}
