# TrustRAG 백엔드 구현 가이드

## 구현 순서

### Step 1: Supabase SQL 실행 (01_supabase_schema.sql)
1. Supabase 대시보드 → SQL Editor
2. `01_supabase_schema.sql` 전체 복사 → 실행
3. 완료 메시지 확인: "TrustRAG 스키마 생성 완료"
4. **초기 슈퍼 어드민 API 키 변경 필수:**
   ```sql
   UPDATE tr_users SET api_key = 'trust_your_secure_key_here' WHERE role = 'super_admin';
   ```

### Step 2: n8n 워크플로우 4개 import

순서대로 import → 활성화:
1. `02_n8n_validate_key.json` → webhook path: `trustrag/validate-key`
2. `03_n8n_admin.json` → webhook path: `trustrag/admin`
3. `04_n8n_upload.json` → webhook path: `trustrag/upload`
4. `05_n8n_chat.json` → webhook path: `trustrag/chat`

### Step 3: n8n Credentials 확인
- `Supabase (Postgres)` - Supabase DB 연결 (기존 사용 중인 것 그대로)
- `Google Drive` - 구글 드라이브 OAuth
- `OPENAI_API_KEY` - n8n 환경변수로 설정 (Settings → Variables)

### Step 4: 초기 데이터 셋업
어드민 페이지(`/trustrag/admin.html`)에서:
1. 슈퍼 어드민 API 키로 로그인
2. 카테고리 생성 (예: KS인증, 업무관리 등)
3. 회원 등록 → 카테고리 권한 설정

---

## API 응답 스펙

### POST /trustrag/validate-key
**Request:**
```json
{ "api_key": "trust_xxx" }
```
**Response:**
```json
{
  "success": true,
  "id": "uuid",
  "name": "홍길동",
  "email": "user@company.com",
  "role": "super_admin|company_admin|group_admin|user",
  "company": "회사명",
  "company_id": "uuid",
  "tokens_remaining": 1000,
  "categories": [
    { "category_id": "uuid", "name": "KS인증", "table_name": "tr_docs_ks_abc123", "can_upload": true }
  ]
}
```

### POST /trustrag/chat
**Request:**
```json
{
  "api_key": "trust_xxx",
  "message": "질문 내용",
  "session_id": "session-xxx",
  "categories": ["KS인증"]  // 빈 배열이면 전체 검색
}
```
**Response:**
```json
{
  "success": true,
  "response": "AI 답변",
  "tokens_remaining": 999,
  "sources": [
    { "filename": "파일명.pdf", "similarity": 0.92, "category_name": "KS인증", "drive_url": "..." }
  ]
}
```

### POST /trustrag/upload
**Request:**
```json
{
  "api_key": "trust_xxx",
  "category": "tr_docs_ks_abc123",  // table_name
  "filename": "파일명.pdf",
  "filedata": "base64...",
  "filesize": 12345,
  "mimetype": "application/pdf"
}
```
**Response:**
```json
{ "success": true, "chunks": 15, "filename": "파일명.pdf" }
```

### POST /trustrag/admin
**Request:**
```json
{
  "api_key": "trust_xxx",
  "action": "create_user",
  "data": { "email": "user@co.com", "name": "홍길동", "role": "user", "tokens_remaining": 1000 }
}
```

**지원 액션:**
| action | 권한 | data 필드 |
|--------|------|-----------|
| list_companies | super_admin | - |
| create_company | super_admin | name, slug, plan |
| list_users | company_admin+ | company_id (optional) |
| create_user | company_admin+ | email, name, role, tokens_remaining, company_id |
| add_tokens | company_admin+ | user_id, amount |
| create_category | company_admin+ | name, description |
| get_user_permissions | group_admin+ | user_id |
| grant_permission | group_admin+ | user_id, category_id, can_upload |
| revoke_permission | group_admin+ | user_id, category_id |
| get_audit_logs | company_admin+ | limit (기본 20) |
