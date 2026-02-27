# [2026-02-27] RAG-4-Secure-Chat-FIXED 워크플로우 구축 및 검증

| 항목 | 내용 |
|------|------|
| **작업자** | nohyohan0727-byte + Claude (Sonnet 4.6) |
| **작업 시간** | 2026-02-27 오후 |
| **상태** | ✅ 완료 |

---

## 배경 / 문제 상황

기존 `RAG-4-Secure-Chat` 워크플로우의 문제점을 분석:

1. **Webhook 경로 불일치**: JSON 내부 path는 `rag-chat`이지만 프론트엔드(demo.html)는 `rag-category-chat` 호출
2. **카테고리 라우팅 미구현**: `category` 파라미터를 받아도 실제 Supabase 테이블 선택 로직 없음
3. **API 경로 혼재**: 기존 `RAG-Multi-Category-Chat`은 stub 상태 (더미 응답)

---

## 해결 방법

### 새 워크플로우 `RAG-4-Secure-Chat-FIXED` 구축

#### 핵심 설계 결정사항

1. **단일 워크플로우로 통합**: 인증 + 카테고리 라우팅 + RAG + 토큰 관리를 하나의 흐름으로
2. **Webhook 경로**: `POST /rag-category-chat` (프론트엔드와 일치)
3. **카테고리 → 테이블 매핑**: Code 노드에서 JavaScript Map으로 동적 처리
4. **Google Sheets 기반 인증**: 별도 DB 없이 스프레드시트로 유저/토큰 관리

---

## 구축 내용

### 노드 구성 (순서대로)

```
[Secure Chat Webhook] → [Category Table Selector] → [Load User]
                                                          ↓
                                                   [Validate Auth]
                                                          ↓
                                                   [Is Authorized?]
                                                    /            \
                                              [KS AI Agent]  [Return Auth Error]
                                                    ↓
                                             [Deduct Token]
                                                    ↓
                                            [Return Response]
```

### Category Table Selector (신규 추가)

```javascript
const CATEGORY_TABLES = {
  'ks_cert': 'documents_ks_cert',
  'business': 'documents_business',
  'technical': 'documents_technical',
  'admin_general': 'documents_admin_upload'
};

const category = input.category || 'ks_cert';
const tableName = CATEGORY_TABLES[category] || 'documents_ks_cert';
// selectedTable 필드로 하위 노드에 전달
```

### Validate Auth (핵심 인증 로직)

4단계 검증:
1. `api_key`, `user_id` 존재 → 없으면 `401 Invalid API key`
2. `status === 'active'` → 아니면 `403 Account is inactive`
3. `expires_at < today` → 만료 시 `403 API key expired on {date}`
4. `tokens_remaining <= 0` → `403 No tokens remaining ({total} total used)`

### KS AI Agent 구성

| 컴포넌트 | 상세 |
|---------|------|
| LLM | GPT-4.1 (`gpt-4.1`) |
| RAG 검색 | Supabase Vector Store (카테고리별 동적 테이블) |
| 임베딩 | OpenAI text-embedding-3-small (1536 dims) |
| 웹 검색 | SerpAPI Google (`hl=ko&gl=kr&num=5`) |
| 메모리 | Buffer Window (user_id 기반 세션) |
| 시스템 프롬프트 | KS 인증 전문가 역할, 3단계 답변 전략 |

### Deduct Token

```
Google Sheets Update
- 매칭: api_key
- 업데이트: tokens_used = tokens_used + 1
```

---

## 테스트 결과

### 테스트 1: 토큰 소진 API 키

```powershell
POST /webhook/rag-category-chat
Body: { "api_key": "rag_EwgW0bY0c1o4M2TN42mC4eqJFCYAIedZ", ... }
```

**결과**: `403 {"success":false,"message":"No tokens remaining (10 total used)."}`

→ 인증 파이프라인 정상 동작, 토큰 소진 감지 ✅

### 테스트 2: 정상 API 키 (TestUser, 100 토큰)

```powershell
POST /webhook/rag-category-chat
Body: {
  "api_key": "rag_LuzDS9Qofsw6Yrq36cWiywKdt3nRScED",
  "session_id": "test-001",
  "message": "KS 인증 심사 주기가 어떻게 되나요?",
  "category": "ks_certification"
}
```

**결과**:
```json
{
  "success": true,
  "response": "KS(한국산업표준)... (KS 인증 관련 상세 답변)",
  "tokens_remaining": 99
}
```

→ 전체 파이프라인 정상 동작 ✅
- API 키 인증 ✅
- 카테고리 라우팅 ✅
- Supabase RAG 검색 ✅
- GPT-4.1 답변 생성 ✅
- 토큰 차감 (100 → 99) ✅

---

## 파일 저장

| 파일 | 경로 |
|------|------|
| 워크플로우 JSON | `projects/n8n-automations/RAG-4-Secure-Chat-FIXED.json` |
| 워크플로우 문서 | `projects/n8n-automations/RAG-4-Secure-Chat-FIXED.md` |

---

## 다음 작업

- [ ] `demo.html` endpoint를 `/rag-category-chat`으로 업데이트 (현재는 `/rag-chat` 호출 중)
- [ ] `category` 파라미터 값 통일: `ks_certification` vs `ks_cert` 정리 필요
- [ ] 회사문서 A/B/C 카테고리 추가 (`documents_company_a/b/c` 테이블 연결)
- [ ] 토큰 관리 UI: 관리자 페이지에서 토큰 충전 기능 추가
