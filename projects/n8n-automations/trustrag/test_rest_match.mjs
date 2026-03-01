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
const OPENAI = env['OPENAI_API_KEY'];

const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ5emtjZHZ5d3hibHNieXVqdGZ2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjI2NDk4OCwiZXhwIjoyMDg3ODQwOTg4fQ.gcq-e2pLFWFxtx_Y1tLcPaOcACGthpWPRs7o6w2nz7s';

// OpenAI 임베딩
const embedding = await new Promise(resolve => {
  const body = JSON.stringify({ model: 'text-embedding-ada-002', input: 'KS 인증 사후관리 심사는 얼마나 자주 실시되나요?' });
  const req = https.request({
    hostname: 'api.openai.com',
    path: '/v1/embeddings',
    method: 'POST',
    headers: { 'Authorization': `Bearer ${OPENAI}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
  }, res => {
    let d = '';
    res.on('data', c => d += c);
    res.on('end', () => resolve(JSON.parse(d).data?.[0]?.embedding));
  });
  req.write(body);
  req.end();
});

console.log('임베딩 차원:', embedding?.length);

// Supabase REST API로 직접 호출
await new Promise(resolve => {
  const body = JSON.stringify({
    query_embedding: embedding,
    p_company_id: '00000000-0000-0000-0000-000000000001',
    match_count: 5,
    similarity_threshold: 0.5
  });
  const req = https.request({
    hostname: 'ryzkcdvywxblsbyujtfv.supabase.co',
    path: '/rest/v1/rpc/match_documents_tr_jknetworks_ks_cert',
    method: 'POST',
    headers: {
      'apikey': SUPA_KEY,
      'Authorization': `Bearer ${SUPA_KEY}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body)
    }
  }, res => {
    let d = '';
    res.on('data', c => d += c);
    res.on('end', () => {
      console.log(`\nHTTP ${res.statusCode}:`);
      // 응답 길이가 크면 요약
      const resp = JSON.parse(d);
      if (Array.isArray(resp)) {
        console.log(`결과 ${resp.length}개`);
        resp.forEach((r, i) => {
          console.log(`  [${i}] similarity: ${r.similarity}, content: ${String(r.content).substring(0, 60)}`);
        });
      } else {
        console.log(JSON.stringify(resp).substring(0, 500));
      }
      resolve();
    });
  });
  req.write(body);
  req.end();
});
