# RAG-4-Secure-Chat-FIXED

> n8n 워크플로우: API 키 인증 기반 다중 카테고리 RAG 챗봇

---

## 개요

| 항목 | 내용 |
|------|------|
| **워크플로우 이름** | RAG-4-Secure-Chat-FIXED |
| **파일** | `RAG-4-Secure-Chat-FIXED.json` |
| **Webhook 경로** | `POST /webhook/rag-category-chat` |
| **상태** | ✅ 운영 중 (2026-02-27 검증 완료) |
| **n8n 인스턴스** | https://jknetworks.app.n8n.cloud |
| **AI 모델** | GPT-4.1 (OpenAI) |
| **벡터 DB** | Supabase |
| **유저 관리** | Google Sheets |

---

## 기능 요약

1. **API 키 인증**: 모든 요청에 `api_key` 필드 필수, Google Sheets에서 유저 검증
2. **토큰 관리**: 요청마다 토큰 1개 차감, 잔여 토큰 응답에 포함
3. **다중 카테고리 RAG**: `category` 필드로 Supabase 테이블 동적 선택
4. **AI 에이전트**: LangChain Agent + GPT-4.1 + 지식베이스 검색 + 웹 검색
5. **대화 메모리**: 세션 ID 기반 대화 컨텍스트 유지

---

## API 사용법

### 요청 (Request)

```http
POST https://jknetworks.app.n8n.cloud/webhook/rag-category-chat
Content-Type: application/json

{
  "api_key": "rag_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "session_id": "user-unique-session-id",
  "message": "질문 내용을 입력하세요",
  "category": "ks_certification"
}
```

### 요청 파라미터

| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| `api_key` | string | ✅ | 발급받은 API 키 (`rag_` 로 시작) |
| `session_id` | string | ✅ | 대화 세션 식별자 (사용자별 유니크하게 설정) |
| `message` | string | ✅ | 질문 내용 |
| `category` | string | ✅ | 검색할 지식베이스 카테고리 |

### 카테고리 목록

| category 값 | 설명 | Supabase 테이블 |
|------------|------|----------------|
| `ks_certification` | KS 인증 관련 문서 | `documents_ks_certification` |
| `ks_cert` | KS 인증 (단축) | `documents_ks_cert` |
| `business` | 비즈니스/사업 문서 | `documents_business` |
| `technical` | 기술 문서 | `documents_technical` |
| `admin_general` | 일반 업무/행정 문서 | `documents_admin_upload` |

### 성공 응답 (200 OK)

```json
{
  "success": true,
  "response": "AI 답변 내용...",
  "tokens_remaining": 99
}
```

### 오류 응답

```json
{
  "success": false,
  "message": "오류 메시지"
}
```

| HTTP 코드 | 원인 |
|----------|------|
| 401 | API 키 없음 또는 유효하지 않은 키 |
| 403 | 계정 비활성, 만료, 또는 토큰 소진 |

---

## 워크플로우 구조

```
[Secure Chat Webhook]  [Manual Test Trigger]
         │                      │
         │              [Test Data Generator]
         ↓                      │
[Category Table Selector] ←─────┘
         │
         ↓
    [Load User]
    (Google Sheets: api_key로 유저 조회)
         │
         ↓
  [Validate Auth]
  (JS: api_key/status/expires_at/tokens 검증)
         │
         ↓
  [Is Authorized?]
    /          \
   ✅           ❌
   │             │
   ↓             ↓
[KS AI Agent]  [Return Auth Error]
   │
   ↓
[Deduct Token]
(Google Sheets: tokens_used + 1)
   │
   ↓
[Return Response]
```

---

## 노드 상세 설명

### 1. Secure Chat Webhook
- **타입**: Webhook
- **경로**: `POST /rag-category-chat`
- **응답 모드**: responseNode (다운스트림에서 직접 응답)

### 2. Category Table Selector
- **타입**: Code (JavaScript)
- **역할**: `category` 값을 Supabase 테이블명으로 변환
- **매핑 로직**:
  ```javascript
  const CATEGORY_TABLES = {
    'ks_cert': 'documents_ks_cert',
    'business': 'documents_business',
    'technical': 'documents_technical',
    'admin_general': 'documents_admin_upload'
  };
  ```
- 알 수 없는 카테고리는 `documents_ks_cert` 기본값 사용

### 3. Load User
- **타입**: Google Sheets (Read)
- **시트 ID**: `1pth-I92vh4SmwILpAlKzeSeiwTrBNrdUcBLgTEJ8mas`
- **조건**: `api_key = {{ $json.body.api_key }}`
- **오류 시 계속 진행**: true (continueOnFail)

### 4. Validate Auth
- **타입**: Code (JavaScript)
- **검증 로직** (순서대로):
  1. `api_key`, `user_id` 존재 여부 → 없으면 401
  2. `status === 'active'` 여부 → 비활성이면 403
  3. `expires_at < today` 여부 → 만료됐으면 403
  4. `tokens_remaining <= 0` 여부 → 토큰 소진이면 403
- **성공 시 반환**: `authorized: true`, 유저 정보, 토큰 현황

### 5. Is Authorized?
- **타입**: IF (조건 분기)
- **조건**: `{{ $json.authorized }} === true`
- **참(true) → 출력1**: KS AI Agent로 이동
- **거짓(false) → 출력2**: Return Auth Error로 이동

### 6. KS AI Agent
- **타입**: LangChain Agent
- **LLM**: GPT-4.1
- **도구(Tools)**:
  - `Knowledge Base Retriever`: Supabase 벡터 검색 (카테고리별 테이블)
  - `Web Search`: SerpAPI Google 검색 (한국 로컬)
- **메모리**: User Session Memory (user_id 기반 대화 컨텍스트)
- **시스템 프롬프트**: KS 인증 전문 AI 에이전트 역할, 3단계 답변 전략

### 7. Knowledge Base Retriever
- **타입**: Supabase Vector Store (retrieve-as-tool)
- **테이블**: `{{ $("Category Table Selector").first().json.selectedTable }}`
- **임베딩**: OpenAI text-embedding-3-small (1536 dimensions)

### 8. Web Search
- **타입**: HTTP Request Tool
- **엔진**: SerpAPI (Google 검색)
- **파라미터**: `hl=ko&gl=kr&num=5` (한국어, 한국 로컬 결과)

### 9. User Session Memory
- **타입**: Buffer Window Memory
- **세션 키**: `{{ $('Validate Auth').first().json.user_id }}`
- 같은 user_id로 요청하면 이전 대화 맥락 유지

### 10. Deduct Token
- **타입**: Google Sheets (Update)
- **시트 ID**: `1ObjurBWNTlMT7jHQns8VpVO82IkOcG6lwSGDBdCnmWU`
- **업데이트**: `tokens_used = tokens_used + 1` (api_key 매칭)

### 11. Return Response
- **타입**: Respond to Webhook
- **응답 코드**: 200
- **응답 본문**:
  ```json
  {
    "success": true,
    "response": "{{ KS AI Agent 출력 }}",
    "tokens_remaining": "{{ tokens_remaining - 1 }}"
  }
  ```

### 12. Return Auth Error
- **타입**: Respond to Webhook
- **응답 코드**: `{{ $json.code || 403 }}`
- **응답 본문**: `{ "success": false, "message": "오류 메시지" }`

---

## Google Sheets 구조

### 유저 목록 시트 (Load User용)

| 컬럼 | 설명 | 예시 |
|------|------|------|
| `user_id` | 유저 고유 ID | `user_001` |
| `name` | 유저 이름 | `홍길동` |
| `email` | 이메일 | `hong@example.com` |
| `api_key` | API 키 | `rag_xxxxxxxx...` |
| `status` | 활성 상태 | `active` / `inactive` |
| `expires_at` | 만료일 | `2026-12-31` |
| `tokens_total` | 총 토큰 | `1000` |
| `tokens_used` | 사용 토큰 | `5` |

---

## 관련 워크플로우

| 워크플로우 | 역할 |
|-----------|------|
| `RAG-3-User-Registration` | 유저 등록 → API 키 자동 발급 (webhook: `/rag-register`) |
| `RAG-4-Secure-Chat-FIXED` | 이 워크플로우 - 인증 기반 RAG 채팅 |

---

## 테스트 방법

### cURL

```bash
curl -X POST https://jknetworks.app.n8n.cloud/webhook/rag-category-chat \
  -H "Content-Type: application/json" \
  -d '{
    "api_key": "YOUR_API_KEY",
    "session_id": "test-001",
    "message": "KS 인증 심사 주기가 어떻게 되나요?",
    "category": "ks_certification"
  }'
```

### PowerShell

```powershell
$result = Invoke-RestMethod `
  -Uri "https://jknetworks.app.n8n.cloud/webhook/rag-category-chat" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"api_key":"YOUR_API_KEY","session_id":"test-001","message":"KS 인증 심사 주기가 어떻게 되나요?","category":"ks_certification"}'
$result | ConvertTo-Json
```

---

## 연동 프론트엔드

- **demo.html**: `https://office-ai.app/demo.html` - 카테고리 탭 UI로 이 API 호출
- **register.html**: `https://office-ai.app/register.html` - 유저 등록 → API 키 발급

---

## 작업 이력

| 날짜 | 내용 | 작업자 |
|------|------|-------|
| 2026-02-27 | 워크플로우 분석 및 수정 (FIXED), 실제 동작 검증 완료 | nohyohan0727 + Claude |
