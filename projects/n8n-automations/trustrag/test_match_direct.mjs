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
const OPENAI = env['OPENAI_API_KEY'];

function sqlApi(label, query) {
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
          if (p.message || p.error) { console.log(`❌ [${label}]`, p.message || p.error); resolve(null); }
          else { console.log(`✅ [${label}]`, JSON.stringify(p).substring(0, 300)); resolve(p); }
        } catch(e) { resolve(null); }
      });
    });
    req.on('error', e => resolve(null));
    req.write(body);
    req.end();
  });
}

function openaiEmbed(text) {
  return new Promise(resolve => {
    const body = JSON.stringify({ model: 'text-embedding-ada-002', input: text });
    const req = https.request({
      hostname: 'api.openai.com',
      path: '/v1/embeddings',
      method: 'POST',
      headers: { 'Authorization': `Bearer ${OPENAI}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        const p = JSON.parse(d);
        resolve(p.data?.[0]?.embedding || null);
      });
    });
    req.write(body);
    req.end();
  });
}

console.log('1. OpenAI 임베딩 생성 중...');
const embedding = await openaiEmbed('KS 인증 사후관리 심사는 얼마나 자주 실시되나요?');
if (!embedding) { console.log('❌ OpenAI 임베딩 실패'); process.exit(1); }
console.log('✅ 임베딩 생성 완료, 차원:', embedding.length);

const vecStr = `'[${embedding.join(',')}]'::vector`;

// Management API로 직접 SQL 실행
console.log('\n2. match_documents 직접 테스트 (threshold=0.5)...');
await sqlApi('match 0.5',
  `SELECT id, LEFT(content,100) as content, similarity FROM match_documents_tr_jknetworks_ks_cert(${vecStr}, '00000000-0000-0000-0000-000000000001', 5, 0.5)`);

console.log('\n3. match_documents (threshold=0.0)...');
await sqlApi('match 0.0',
  `SELECT id, LEFT(content,100) as content, similarity FROM match_documents_tr_jknetworks_ks_cert(${vecStr}, '00000000-0000-0000-0000-000000000001', 5, 0.0)`);

console.log('\n4. 원시 유사도 확인...');
await sqlApi('raw similarity',
  `SELECT id, 1-(embedding<=>${vecStr}) as sim, LEFT(content,80) as c FROM tr_jknetworks_ks_cert ORDER BY embedding<=>${vecStr}`);
