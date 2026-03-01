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

// ISO 인증 - 두 오버로드 모두 제거 후 단일 함수로
await sql('DROP iso_cert 함수 (match_count 먼저)',
  `DROP FUNCTION IF EXISTS match_documents_tr_jknetworks_iso_cert(VECTOR, INT, UUID, FLOAT)`);
await sql('DROP iso_cert 함수 (p_company_id 먼저)',
  `DROP FUNCTION IF EXISTS match_documents_tr_jknetworks_iso_cert(VECTOR, UUID, INT, FLOAT)`);

// KS 인증 - 두 오버로드 모두 제거
await sql('DROP ks_cert 함수 (match_count 먼저)',
  `DROP FUNCTION IF EXISTS match_documents_tr_jknetworks_ks_cert(VECTOR, INT, UUID, FLOAT)`);
await sql('DROP ks_cert 함수 (p_company_id 먼저)',
  `DROP FUNCTION IF EXISTS match_documents_tr_jknetworks_ks_cert(VECTOR, UUID, INT, FLOAT)`);

// n8n 워크플로우가 보내는 파라미터 순서에 맞게 단일 함수 생성
// n8n 전송: {"query_embedding":..., "p_company_id":..., "match_count":5, "similarity_threshold":0.5}
await sql('match_documents_iso_cert 단일 생성',
  `CREATE FUNCTION match_documents_tr_jknetworks_iso_cert(
    query_embedding VECTOR(1536),
    p_company_id UUID DEFAULT NULL,
    match_count INT DEFAULT 5,
    similarity_threshold FLOAT DEFAULT 0.5
  )
  RETURNS TABLE (id UUID, content TEXT, metadata JSONB, similarity FLOAT)
  LANGUAGE sql SECURITY DEFINER AS $func$
    SELECT id, content, metadata,
           1 - (embedding <=> query_embedding) AS similarity
    FROM tr_jknetworks_iso_cert
    WHERE (p_company_id IS NULL OR company_id = p_company_id)
      AND 1 - (embedding <=> query_embedding) > similarity_threshold
    ORDER BY embedding <=> query_embedding
    LIMIT match_count;
  $func$`);

await sql('match_documents_ks_cert 단일 생성',
  `CREATE FUNCTION match_documents_tr_jknetworks_ks_cert(
    query_embedding VECTOR(1536),
    p_company_id UUID DEFAULT NULL,
    match_count INT DEFAULT 5,
    similarity_threshold FLOAT DEFAULT 0.5
  )
  RETURNS TABLE (id UUID, content TEXT, metadata JSONB, similarity FLOAT)
  LANGUAGE sql SECURITY DEFINER AS $func$
    SELECT id, content, metadata,
           1 - (embedding <=> query_embedding) AS similarity
    FROM tr_jknetworks_ks_cert
    WHERE (p_company_id IS NULL OR company_id = p_company_id)
      AND 1 - (embedding <=> query_embedding) > similarity_threshold
    ORDER BY embedding <=> query_embedding
    LIMIT match_count;
  $func$`);

// 스키마 캐시 갱신 + 대기
await sql('스키마 갱신', `NOTIFY pgrst, 'reload schema'`);
console.log('⏳ 20초 대기...');
await new Promise(r => setTimeout(r, 20000));

// Supabase REST API로 직접 테스트 (간단한 임베딩 없이, 함수 존재 확인)
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ5emtjZHZ5d3hibHNieXVqdGZ2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjI2NDk4OCwiZXhwIjoyMDg3ODQwOTg4fQ.gcq-e2pLFWFxtx_Y1tLcPaOcACGthpWPRs7o6w2nz7s';

console.log('\n🧪 함수 호출 테스트 (임의 벡터)...');
await new Promise(resolve => {
  // 1536차원 임의 벡터 생성
  const vec = Array.from({length: 1536}, () => Math.random() * 0.1);
  const body = JSON.stringify({
    query_embedding: vec,
    p_company_id: '00000000-0000-0000-0000-000000000001',
    match_count: 5,
    similarity_threshold: 0.0  // 임계값 0으로 모든 행 반환
  });
  const req = https.request({
    hostname: 'ryzkcdvywxblsbyujtfv.supabase.co',
    path: '/rest/v1/rpc/match_documents_tr_jknetworks_ks_cert',
    method: 'POST',
    headers: {
      'apikey': KEY,
      'Authorization': `Bearer ${KEY}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body)
    }
  }, res => {
    let d = '';
    res.on('data', c => d += c);
    res.on('end', () => {
      console.log(`HTTP ${res.statusCode}:`, d.substring(0, 500));
      resolve();
    });
  });
  req.write(body);
  req.end();
});
