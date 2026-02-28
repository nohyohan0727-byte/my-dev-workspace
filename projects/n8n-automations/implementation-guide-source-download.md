# 참조 문서 표시 및 다운로드 구현 가이드 (v2 - 개선판)

## 설계 원칙
- AI가 소스를 자기 보고하지 않음 → 벡터 검색 시 metadata에서 직접 추출 (정확)
- 다운로드 전용 webhook 불필요 → 업로드 시 drive_url 저장 → 채팅 응답에 포함
- 소스 검색을 AI Agent 앞에 배치 → 지연 최소화

## 전체 흐름
```
[업로드] 파일 → Google Drive → file_id + drive_url → Supabase metadata 저장
[채팅]   질문 → 임베딩 → Supabase RPC → sources 추출 → KS AI Agent → 응답 + sources
[다운로드] sources[].drive_url → window.open() 직접 (webhook 없음)
```

---

## STEP 0 — Supabase SQL 함수 생성 (최초 1회)

Supabase 대시보드 → SQL Editor → 아래 실행:

```sql
CREATE OR REPLACE FUNCTION match_documents_generic(
  query_embedding vector(1536),
  match_table     text,
  match_count     int     DEFAULT 5,
  match_threshold float   DEFAULT 0.75
)
RETURNS TABLE (
  id         bigint,
  content    text,
  metadata   jsonb,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY EXECUTE format(
    'SELECT id, content, metadata, 1 - (embedding <=> $1) AS similarity
     FROM %I
     WHERE 1 - (embedding <=> $1) > $2
     ORDER BY embedding <=> $1
     LIMIT $3',
    match_table
  )
  USING query_embedding, match_threshold, match_count;
END;
$$;

GRANT EXECUTE ON FUNCTION match_documents_generic TO anon, authenticated;
```

> ⚠️ 임베딩 차원이 1536이 아닌 경우 첫 번째 파라미터 타입 수정 필요
> (text-embedding-ada-002 = 1536, text-embedding-3-large = 3072)

---

## STEP 1 — RAG-Webhook-Admin-Upload 수정

### 수정 위치
n8n → RAG-Webhook-Admin-Upload → **Supabase Vector Store 노드** → Metadata 섹션

### 추가할 메타데이터 필드 3개
| 필드명 | 값 |
|--------|-----|
| `source_filename` | `{{ $json.filename }}` |
| `source_file_id` | `{{ $('Upload to Drive').first().json.id }}` |
| `source_drive_url` | `https://drive.google.com/uc?export=download&id={{ $('Upload to Drive').first().json.id }}` |

> ⚠️ `$json.filename`은 파일 업로드 노드의 실제 파일명 필드로 조정 필요
> (노드마다 다를 수 있음: `$json.name`, `$binary.data.fileName` 등)

---

## STEP 2 — RAG-4-Secure-Chat-FIXED 수정

### 2-1. 새 노드 3개 추가

**위치**: "Is Authorized?" → [새 노드 3개] → "KS AI Agent"

---

#### 노드 A: "Get Query Embedding" (HTTP Request)

| 항목 | 값 |
|------|-----|
| 노드 타입 | HTTP Request |
| 노드 이름 | Get Query Embedding |
| Method | POST |
| URL | `https://api.openai.com/v1/embeddings` |

**Headers:**
```
Authorization: Bearer {{ $env.OPENAI_API_KEY }}
Content-Type: application/json
```

> 또는 n8n 자격증명 탭에서 OpenAI API Key 자격증명 선택

**Body (JSON):**
```json
{
  "model": "text-embedding-ada-002",
  "input": "={{ $('Secure Chat Webhook').first().json.body.message }}"
}
```

> ⚠️ 현재 Knowledge Base Retriever의 임베딩 모델과 반드시 동일해야 함
> (Retriever Embeddings 노드 설정 확인)

**응답에서 사용할 값:** `$json.data[0].embedding`

---

#### 노드 B: "Search Source Docs" (HTTP Request)

| 항목 | 값 |
|------|-----|
| 노드 타입 | HTTP Request |
| 노드 이름 | Search Source Docs |
| Method | POST |
| URL | `https://YOUR_SUPABASE_PROJECT.supabase.co/rest/v1/rpc/match_documents_generic` |

> URL의 `YOUR_SUPABASE_PROJECT` 부분을 실제 Supabase 프로젝트 ID로 교체

**Headers:**
```
apikey: YOUR_SUPABASE_ANON_KEY
Authorization: Bearer YOUR_SUPABASE_ANON_KEY
Content-Type: application/json
```

**Body (JSON):**
```json
{
  "query_embedding": "={{ $json.data[0].embedding }}",
  "match_table": "={{ $('Category Table Selector').first().json.selectedTable }}",
  "match_count": 5,
  "match_threshold": 0.75
}
```

> `selectedTable`은 Category Table Selector 노드 출력 필드명에 맞게 조정

---

#### 노드 C: "Extract Sources" (Code)

| 항목 | 값 |
|------|-----|
| 노드 타입 | Code |
| 노드 이름 | Extract Sources |
| Language | JavaScript |

**코드:**
```javascript
const items = $input.all();
const seen = new Set();
const sources = [];

for (const item of items) {
  const meta = item.json.metadata || {};
  const filename = meta.source_filename;

  if (filename && !seen.has(filename)) {
    seen.add(filename);
    sources.push({
      filename,
      tableName: $('Category Table Selector').first().json.selectedTable || '',
      drive_url: meta.source_drive_url || null,
      similarity: Math.round((item.json.similarity || 0) * 100) / 100
    });
  }
}

// 유사도 내림차순 정렬
sources.sort((a, b) => b.similarity - a.similarity);

return [{ json: { sources } }];
```

---

### 2-2. 연결 변경

| 변경 전 | 변경 후 |
|---------|---------|
| Is Authorized? (true) → KS AI Agent | Is Authorized? (true) → **Get Query Embedding** |
| — | Get Query Embedding → **Search Source Docs** |
| — | Search Source Docs → **Extract Sources** |
| — | Extract Sources → **KS AI Agent** |
| KS AI Agent → Deduct Token | KS AI Agent → Deduct Token (유지) |

---

### 2-3. Return Response 노드 수정

**responseBody** 값을 아래로 교체:

```
={{ JSON.stringify({
  success: true,
  response: $('KS AI Agent').first().json.output,
  tokens_remaining: $('Validate Auth').first().json.tokens_remaining - 1,
  sources: $('Extract Sources').first().json.sources
}) }}
```

---

## STEP 3 — demo.html (완료)

`downloadSourceFile` 함수가 `src.drive_url` 있으면 webhook 없이 직접 `window.open()` 하도록 수정 완료.
별도 `/webhook/file-download` 워크플로우 불필요.

---

## 기존 파일 메타데이터 소급 적용 (선택)

이미 업로드된 파일에 drive_url이 없는 경우, Supabase SQL Editor에서 수동 업데이트:

```sql
-- 예시: 특정 테이블의 특정 파일에 메타데이터 추가
UPDATE ks_certification
SET metadata = metadata || jsonb_build_object(
  'source_filename', '파일명.pdf',
  'source_file_id', '구글드라이브_FILE_ID',
  'source_drive_url', 'https://drive.google.com/uc?export=download&id=구글드라이브_FILE_ID'
)
WHERE metadata->>'source_filename' = '파일명.pdf';
```

---

## 테스트 체크리스트

- [ ] Supabase `match_documents_generic` 함수 생성 확인
  - SQL Editor에서 `SELECT match_documents_generic(...)` 직접 실행 테스트
- [ ] 새 파일 업로드 후 Supabase에서 `source_drive_url` 메타데이터 저장 확인
  - `SELECT metadata FROM ks_certification LIMIT 5`
- [ ] n8n 채팅 테스트 실행 후 응답에 `sources` 배열 포함 확인
  - n8n 워크플로우 → 최근 실행 → Return Response 출력값 확인
- [ ] demo.html에서 파일 카드 클릭 → Google Drive 다운로드 확인

---

## 트러블슈팅

| 증상 | 원인 | 해결 |
|------|------|------|
| sources 빈 배열 | 임베딩 모델 불일치 | Get Query Embedding의 model을 Retriever Embeddings와 동일하게 |
| sources 빈 배열 | match_threshold 너무 높음 | 0.75 → 0.6으로 낮추기 |
| drive_url null | 업로드 시 메타데이터 미설정 | STEP 1 재확인 |
| Google Drive 미리보기만 뜨고 다운로드 안 됨 | 파일 크기가 크거나 공유 설정 문제 | Drive 파일을 "링크가 있는 모든 사용자" 공유로 변경 |
