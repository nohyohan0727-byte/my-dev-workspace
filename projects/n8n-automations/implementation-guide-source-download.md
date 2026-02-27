# 참조 문서 표시 및 다운로드 시스템 구현 가이드

## 전체 아키텍처

```
[업로드 시]
admin-upload.html
  → n8n RAG-Webhook-Admin-Upload
      → Google Drive 업로드 → file_id 획득
      → Supabase Vector Store (metadata에 file_id, drive_url 포함 저장)

[채팅 시]
demo.html → n8n RAG-4-Secure-Chat-FIXED
  → KS AI Agent (답변 생성)
  → Get Query Embedding (OpenAI)
  → Search Source Docs (Supabase match_documents_generic RPC)
  → Extract Sources (Code)
  → Return Response { success, response, tokens_remaining, sources: [{filename, fileId, driveUrl, tableName}] }

[다운로드 시]
demo.html 파일 카드 클릭
  → n8n RAG-File-Download
      → Validate API Key
      → Query Supabase (metadata에서 driveUrl 조회)
      → Return { downloadUrl }
  → window.open(downloadUrl)
```

---

## Step 1 — Supabase SQL 함수 생성

Supabase 대시보드 → SQL Editor → 아래 SQL 실행

```sql
-- 테이블명을 파라미터로 받는 범용 시맨틱 검색 함수
CREATE OR REPLACE FUNCTION match_documents_generic(
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  table_name text
)
RETURNS TABLE (
  id bigint,
  content text,
  metadata jsonb,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY EXECUTE format(
    'SELECT id, content, metadata,
            1 - (embedding <=> $1) AS similarity
     FROM %I
     WHERE 1 - (embedding <=> $1) > $2
     ORDER BY embedding <=> $1
     LIMIT $3',
    table_name
  ) USING query_embedding, match_threshold, match_count;
END;
$$;

-- 실행 권한 부여
GRANT EXECUTE ON FUNCTION match_documents_generic TO anon, authenticated;
```

> 테스트: Supabase SQL Editor에서 아래로 확인
> ```sql
> SELECT source_filename FROM match_documents_generic(
>   array_fill(0::float, ARRAY[1536])::vector,
>   0.0, 3, 'documents_admin_upload'
> );
> ```

---

## Step 2 — n8n: RAG-Webhook-Admin-Upload 수정

### 수정할 노드: Supabase Vector Store

현재: 파일 텍스트만 저장 (metadata = {source: "filename"})
변경: Google Drive file_id / URL 포함 저장

**Supabase Vector Store 노드 → "Additional Metadata" 섹션에 추가:**

| 키 | 값 (n8n expression) |
|----|---------------------|
| `source_filename` | `{{ $('Base64 to Binary').first().json.filename }}` |
| `source_file_id` | `{{ $('Upload to Drive').first().json.id }}` |
| `source_drive_url` | `https://drive.google.com/uc?export=download&id={{ $('Upload to Drive').first().json.id }}` |
| `source_table` | `{{ $json.tableName }}` |

> 주의: 노드 이름은 실제 워크플로우와 다를 수 있음. "Upload to Drive" 노드 출력에서 `.id` 필드 확인 필요.

---

## Step 3 — n8n: RAG-4-Secure-Chat-FIXED 수정

### 추가할 노드 3개 (KS AI Agent → Deduct Token 사이에 삽입)

#### 노드 1: "Get Query Embedding" (HTTP Request)

- **Method**: POST
- **URL**: `https://api.openai.com/v1/embeddings`
- **Authentication**: Generic Credential (Header Auth)
  - Name: `Authorization`
  - Value: `Bearer {OPENAI_API_KEY}`
- **Body (JSON)**:
```json
{
  "input": "={{ $('Secure Chat Webhook').first().json.message }}",
  "model": "text-embedding-3-small"
}
```
- **Output** 확인: `data[0].embedding` (1536차원 벡터 배열)

#### 노드 2: "Search Source Docs" (HTTP Request)

- **Method**: POST
- **URL**: `https://{SUPABASE_PROJECT_ID}.supabase.co/rest/v1/rpc/match_documents_generic`
- **Headers**:
  - `apikey`: `{SUPABASE_ANON_KEY}`
  - `Authorization`: `Bearer {SUPABASE_ANON_KEY}`
  - `Content-Type`: `application/json`
- **Body (JSON)**:
```json
{
  "query_embedding": "={{ $json.data[0].embedding }}",
  "match_threshold": 0.5,
  "match_count": 5,
  "table_name": "={{ $('Category Table Selector').first().json.selectedTable }}"
}
```

#### 노드 3: "Extract Sources" (Code — JavaScript)

```javascript
const docs = $input.all();
const seen = new Set();
const sources = [];

for (const doc of docs) {
  const meta = doc.json?.metadata;
  if (!meta) continue;

  // source_filename 우선, 없으면 source(기존 구조) 사용
  const filename = meta.source_filename || meta.source || '';
  if (!filename || seen.has(filename)) continue;

  seen.add(filename);
  sources.push({
    filename,
    fileId:   meta.source_file_id  || '',
    driveUrl: meta.source_drive_url || '',
    tableName: meta.source_table
              || $('Category Table Selector').first().json.selectedTable
              || ''
  });
}

return [{ json: { sources } }];
```

### 수정할 노드: "Return Response"

responseBody를:
```
={{ JSON.stringify({
  success: true,
  response: $('KS AI Agent').first().json.output,
  tokens_remaining: $('Validate Auth').first().json.tokens_remaining - 1
}) }}
```

아래로 교체:
```
={{ JSON.stringify({
  success: true,
  response: $('KS AI Agent').first().json.output,
  tokens_remaining: $('Validate Auth').first().json.tokens_remaining - 1,
  sources: $('Extract Sources').first().json.sources
}) }}
```

### 연결 구조 (변경 후)

```
KS AI Agent
  → Get Query Embedding
    → Search Source Docs
      → Extract Sources
        → Deduct Token
          → Return Response
```

---

## Step 4 — n8n: RAG-File-Download 워크플로우 신규 생성

### 워크플로우 구조

```
Webhook → Validate API Key → Is Authorized? → Query Supabase → Return Download URL
                                            ↘ Return 401
```

### 각 노드 설정

#### Webhook
- **HTTP Method**: POST
- **Path**: `file-download`
- **Response Mode**: Response Node

#### Validate API Key (Code — JavaScript)
```javascript
const { api_key, filename, tableName } = $input.first().json;

if (!api_key || !filename) {
  return [{ json: { authorized: false, error: 'Missing required fields', code: 400 } }];
}

// 간단 형식 검증 (실제 유저 검증은 Google Sheets에서)
const valid = api_key.startsWith('rag_') && api_key.length > 10;

return [{ json: {
  authorized: valid,
  api_key,
  filename,
  tableName: tableName || 'documents_admin_upload',
  code: valid ? 200 : 401
}}];
```

#### Is Authorized? (IF)
- Condition: `{{ $json.authorized }}` equals `true`

#### Query Supabase (HTTP Request)
- **Method**: GET
- **URL**:
```
https://{SUPABASE_PROJECT_ID}.supabase.co/rest/v1/{{ $('Validate API Key').first().json.tableName }}
```
- **Headers**:
  - `apikey`: `{SUPABASE_ANON_KEY}`
  - `Authorization`: `Bearer {SUPABASE_ANON_KEY}`
- **Query Parameters**:
  - `select`: `metadata`
  - `metadata->>source_filename`: `eq.{{ $('Validate API Key').first().json.filename }}`
  - `limit`: `1`

#### Extract Download URL (Code — JavaScript)
```javascript
const rows = $input.all();
const filename = $('Validate API Key').first().json.filename;

if (!rows.length || !rows[0].json) {
  return [{ json: {
    success: false,
    message: `파일을 찾을 수 없습니다: ${filename}`
  }}];
}

const meta = rows[0].json.metadata;
const driveUrl = meta?.source_drive_url || '';
const fileId   = meta?.source_file_id  || '';

if (!driveUrl && !fileId) {
  return [{ json: {
    success: false,
    message: '다운로드 URL 정보가 없습니다. 파일을 다시 업로드해주세요.'
  }}];
}

const downloadUrl = driveUrl || `https://drive.google.com/uc?export=download&id=${fileId}`;

return [{ json: { success: true, downloadUrl, filename } }];
```

#### Return Download URL (Respond to Webhook)
- **Respond With**: JSON
- **Response Body**: `={{ JSON.stringify($json) }}`
- **Response Code**: 200

#### Return 401 (Respond to Webhook)
- **Respond With**: JSON
- **Response Body**: `={{ JSON.stringify({ success: false, message: '인증 실패' }) }}`
- **Response Code**: 401

---

## Step 5 — 기존 파일 metadata 업데이트 (선택)

이미 업로드된 파일은 `source_file_id`가 없을 수 있음.
구글시트 업로드 이력에 file_id가 없다면 수동으로 Drive ID를 조회 후 Supabase SQL로 업데이트:

```sql
UPDATE documents_admin_upload
SET metadata = metadata || '{"source_file_id": "{DRIVE_FILE_ID}", "source_drive_url": "https://drive.google.com/uc?export=download&id={DRIVE_FILE_ID}"}'
WHERE metadata->>'source_filename' = '파일명.pdf';
```

---

## 구현 체크리스트

- [ ] Supabase SQL Editor에서 `match_documents_generic` 함수 생성
- [ ] RAG-Webhook-Admin-Upload: Supabase Vector Store 메타데이터 추가
- [ ] RAG-4-Secure-Chat-FIXED: 3개 노드 추가 + Return Response 수정
- [ ] RAG-File-Download: 신규 워크플로우 생성
- [ ] 테스트 파일 업로드 후 채팅에서 참조 문서 카드 확인
- [ ] 다운로드 버튼 클릭 테스트
