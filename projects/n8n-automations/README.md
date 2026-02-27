# n8n 자동화 프로젝트

> n8n으로 구축한 자동화 워크플로우 모음입니다.
> 각 워크플로우는 JSON으로 저장되어 있으며, n8n에서 import하면 바로 사용 가능합니다.

---

## 워크플로우 목록

| 이름 | 설명 | 상태 | Webhook | 파일 |
|------|------|------|---------|------|
| RAG-3-User-Registration | 이름/이메일 입력 → API 키 자동 발급 → Google Sheets 저장 | ✅ 운영 중 | `POST /rag-register` | (n8n 내부) |
| RAG-4-Secure-Chat-FIXED | API 키 인증 + 다중 카테고리 RAG 챗봇 | ✅ 운영 중 | `POST /rag-category-chat` | [RAG-4-Secure-Chat-FIXED.json](RAG-4-Secure-Chat-FIXED.json) |

---

## 시스템 아키텍처

```
[office-ai.app]
      │
      ├── register.html ──→ POST /rag-register ──→ [RAG-3-User-Registration]
      │                                                      │
      │                                               Google Sheets
      │                                               (유저 등록 + API 키 발급)
      │
      └── demo.html ──────→ POST /rag-category-chat → [RAG-4-Secure-Chat-FIXED]
                                                              │
                                                    ┌─────────┼─────────┐
                                                    │         │         │
                                               Google    Supabase   OpenAI
                                               Sheets   (벡터 DB)   GPT-4.1
                                              (인증/토큰)
```

---

## RAG-3-User-Registration

### 기능
- `POST /webhook/rag-register` 요청 수신
- 이름, 이메일을 Google Sheets에 저장
- `rag_` 접두사 랜덤 API 키 자동 생성
- 응답으로 API 키 반환

### 요청
```json
{
  "name": "홍길동",
  "email": "hong@example.com"
}
```

### 응답
```json
{
  "success": true,
  "api_key": "rag_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "message": "등록이 완료되었습니다."
}
```

---

## RAG-4-Secure-Chat-FIXED

### 기능
- API 키 인증 (Google Sheets 기반)
- 카테고리별 Supabase 테이블 동적 라우팅
- GPT-4.1 + RAG 지식베이스 검색 + Google 웹검색
- 대화 세션 메모리
- 자동 토큰 차감

> 상세 문서: [RAG-4-Secure-Chat-FIXED.md](RAG-4-Secure-Chat-FIXED.md)

### 요청
```json
{
  "api_key": "rag_xxxxxxxx...",
  "session_id": "unique-session-id",
  "message": "질문 내용",
  "category": "ks_certification"
}
```

### 카테고리 목록
| category | Supabase 테이블 |
|----------|----------------|
| `ks_certification` | `documents_ks_certification` |
| `ks_cert` | `documents_ks_cert` |
| `business` | `documents_business` |
| `technical` | `documents_technical` |
| `admin_general` | `documents_admin_upload` |

---

## 워크플로우 추가 방법

1. n8n에서 워크플로우 완성 후 **Export to File** (JSON 다운로드)
2. `projects/n8n-automations/워크플로우명.json` 으로 저장
3. 같은 이름의 `워크플로우명.md` 설명 파일 작성
4. `WORK_HISTORY.md` 에 작업 이력 추가
5. git commit & push

---

## 워크플로우 import 방법

1. n8n 접속: https://jknetworks.app.n8n.cloud
2. 상단 메뉴 > **Import from File**
3. JSON 파일 선택
4. 크리덴셜(Google Sheets OAuth, OpenAI, Supabase) 재연결 필요

---

## n8n 연결 정보

- **Host**: `.env` 파일의 `N8N_HOST` 참고
- **API Key**: `.env` 파일의 `N8N_API_KEY` 참고
- **Google Sheets 크리덴셜**: `Google Sheets RAG` (OAuth2)
- **OpenAI 크리덴셜**: `OpenAi account 0206`
- **Supabase 크리덴셜**: `Supabase account`

---

## office-ai 연동

구축된 자동화 솔루션은 office-ai 홈페이지에서 직접 사용됩니다.
- 홈페이지: https://office-ai.app
- 데모 페이지: https://office-ai.app/demo.html
- 등록 페이지: https://office-ai.app/register.html
