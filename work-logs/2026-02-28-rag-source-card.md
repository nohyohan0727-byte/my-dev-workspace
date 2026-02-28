# 2026-02-28 작업 로그: RAG 소스 카드 기능 구현 + 워크플로우 범용화

## 작업 배경
- 채팅 답변에 참조된 내부 문서를 파일 카드로 표시하고 클릭 시 Google Drive에서 다운로드하는 기능 요청
- KS AI Agent가 KS 특화 하드코딩 → 카테고리별 동적 처리로 범용화 필요

---

## n8n 워크플로우 ID

| 워크플로우 | ID |
|-----------|-----|
| 채팅 (RAG-4-Secure-Chat-FIXED) | `DUhC36eo7SJNw2Wc` |
| 업로드 (RAG-Webhook-Admin-Upload) | `BnNM5zFuBsqrSyeM` |

---

## Supabase 정보

| 항목 | 값 |
|------|-----|
| 프로젝트 ID | `mkmxhmoocqnkltjxdfbm` |
| KS 인증 테이블 | `documents_ks_certification` (2560 rows) |
| 업무관리 테이블 | `documents_admin_upload` (286 rows) |
| 범용 검색 함수 | `match_documents_generic` |
| 테이블별 함수 | `match_documents_ks_certification` 등 7개 |

---

## 채팅 워크플로우 노드 구성 (최종)

```
Secure Chat Webhook
  → Category Table Selector (카테고리 → 테이블명 매핑)
  → Load User (Google Sheets)
  → Validate Auth
  → Is Authorized?
    [true] → Get Query Embedding (OpenAI)
           → Search Source Docs (Supabase RPC: match_documents_generic)
           → Extract Sources (Code: source_filename, drive_url 추출)
           → Build System Prompt (Code: 카테고리별 역할 + 내부문서 우선 지시)
           → RAG AI Agent
               ├── OpenAI Chat Model
               ├── Knowledge Base Retriever (Supabase, queryName 동적)
               │     └── Retriever Embeddings (OpenAI, dimensions 옵션 제거)
               ├── User Session Memory
               └── Web Search (SerpAPI, 내부검색 실패 시만 사용)
           → Deduct Token (Google Sheets)
           → Return Response (success, response, tokens_remaining, sources)
    [false] → Return Auth Error
```

---

## 카테고리 → 테이블 매핑

| demo.html 카테고리 값 | Supabase 테이블 | match 함수 |
|----------------------|----------------|------------|
| `ks_certification` | `documents_ks_certification` | `match_documents_ks_certification` |
| `ks_cert` | `documents_ks_certification` | `match_documents_ks_certification` |
| `business` | `documents_business` | `match_documents_business` |
| `technical` | `documents_technical` | `match_documents_technical` |
| `admin_general` | `documents_admin_upload` | `match_documents_admin_upload` |
| `company_a/b/c` | `documents_company_a/b/c` | `match_documents_company_a/b/c` |

---

## Build System Prompt 역할 매핑

| 카테고리 | AI 역할 |
|---------|---------|
| ks_certification | KS Certification Auditor |
| business | Business Strategy Expert |
| technical | Technical Specialist |
| admin_general | Administrative Operations Specialist |
| 기타 | Professional Research Assistant |

**공통 우선순위 지시:**
1. STEP1: `document_search` 도구 반드시 먼저 호출
2. STEP2: 내부 문서 결과 없을 때만 `web_search` 사용
3. 내부 문서 답변 시 "내부 문서 기준으로는:" 명시

---

## 해결된 오류 목록

| 오류 | 원인 | 해결 |
|------|------|------|
| "연결 오류" (최초) | Search Source Docs 빈 결과 → 이후 노드 미실행 → Return Response 없음 | `alwaysOutputData: true` 추가 |
| "연결 오류" (2차) | Retriever Embeddings `dimensions: 1536` 미지원 파라미터 | 옵션 제거 |
| "연결 오류" (3차) | `match_documents` SQL 함수 Supabase 미존재 | 테이블별 함수 7개 신규 생성 |
| "연결 오류" (4차) | SQL 함수 `id` 컬럼 ambiguous | `#variable_conflict use_column` + 테이블 별칭 `t.` 적용 |
| 내부 테이블명 노출 | admin-upload 성공 메시지에 `documents_admin_upload` 표시 | 카테고리명으로 변경 |
| KS 문서 못 찾음 | Category Table Selector가 `documents_ks_cert`(없는 테이블) 조회 | `documents_ks_certification`으로 수정 |

---

## 주요 스크립트 (C:/dev/)

| 파일 | 용도 |
|------|------|
| `backfill_ks_metadata.js` | documents_ks_certification 511개 source_filename 소급 적용 |
| `backfill_all_tables.js` | 나머지 테이블 metadata 소급 적용 |
| `fix_functions.js` | match_documents_* 함수 7개 DROP→재생성 |
| `create_match_functions.sql` | 수동 실행용 SQL 참고 파일 |
| `update_workflow.js` | 워크플로우 범용화 패치 스크립트 |
| `chat_workflow_v6.json` | 최종 채팅 워크플로우 백업 |

---

## 현재 상태 (2026-02-28 테스트 중)
- SQL 함수 `#variable_conflict` 패치 적용 후 테스트 중
- 소스 카드 표시 여부 확인 필요
- 내부 문서 우선 검색 동작 확인 필요
