# [2026-02-27] demo.html 카테고리 UI 추가 및 Supabase 분석

## 작업 정보

| 항목 | 내용 |
|------|------|
| **날짜** | 2026-02-27 |
| **작업자** | nohyohan0727-byte + Claude (Sonnet 4.6) |
| **상태** | ✅ 완료 |

---

## Supabase 테이블 구조 (확인 완료)

| 테이블 | 설명 | 행 수 |
|--------|------|--------|
| `documents_ks_certification` | KS 인증 문서 (주요 데이터) | 2,560 |
| `documents_admin_upload` | 관리자 업로드 문서 | 52 |
| `documents_ks_cert` | KS cert 관련 | 16 |
| `documents_company_a` | 회사 A 전용 문서 | - |
| `documents_company_b` | 회사 B 전용 문서 | - |
| `documents_company_c` | 회사 C 전용 문서 | - |
| `documents_business` | 비즈니스 문서 | 0 (예정) |
| `documents_technical` | 기술 문서 | 0 (예정) |
| `companies` | 회사 정보 | 5 |
| `usage_logs` | 사용 로그 | - |

- 프로젝트 ID: `mkmxhmoocqnkltjxdfbm` (Seoul, ap-northeast-2)
- Supabase URL: `https://mkmxhmoocqnkltjxdfbm.supabase.co`

---

## n8n 워크플로우 분석

### RAG-4-Secure-Chat
- **webhook path**: `rag-chat` (POST)
- **responseMode**: `responseNode`
- **API 키 검증**: Google Sheets에서 유효한 키 목록 조회
- **현재 demo.html API 키**: `rag_EwgW0bY0c1o4M2TN42mC4eqJFCYAIedZ` → Google Sheets 등록 여부 미확인
- **검색 대상**: `documents_ks_certification` (pgvector)
- **LLM**: OpenAI GPT-4o

### RAG-Multi-Category-Chat (Workflow ID: 8rSdaAVh3wTpWwdN)
- **상태**: Stub (더미 응답만 반환)
- **구조**: Webhook → Category Processor (JS) → Response Generator (JS, 하드코딩)
- **카테고리 매핑 코드는 작성됨** but 실제 RAG 노드 미연결
- **향후 작업**: 각 카테고리를 Supabase 테이블에 연결하는 실제 RAG 파이프라인 구축 필요

---

## demo.html 변경 내용

### 추가된 기능
1. **카테고리 탭 바** (7개): KS인증, 비즈니스, 기술문서, 업무관리, 회사문서A/B/C
2. **카테고리별 설정**:
   - 헤더 아이콘/타이틀/부제목 동적 변경
   - 세션바에 현재 카테고리 배지 표시
   - 웰컴 카드 아이콘/제목/설명/샘플질문 동적 변경
   - 입력창 placeholder 동적 변경
3. **fetch body에 `category` 필드 추가**: `{ api_key, session_id, message, category }`
4. **에러 처리 개선**: `res.ok` 체크 + HTTP 상태코드 포함 오류 메시지
5. **모바일 반응형**: category-bar 가로 스크롤, 헤더 간소화

### 파일 위치
- `C:\dev\office-ai\demo.html`
- GitHub: `https://github.com/nohyohan0727-byte/office-ai/blob/main/demo.html`
- 배포 URL: `https://office-ai.app/demo`

---

## 향후 작업 (우선순위)

1. **API 키 확인** (높음): n8n Google Sheets에 `rag_EwgW0bY0c1o4M2TN42mC4eqJFCYAIedZ` 등록 여부 확인
   - 미등록 시 → 신규 키 발급 후 demo.html의 `API_KEY` 상수 업데이트
2. **RAG-Multi-Category-Chat 실제 연결** (높음): n8n에서 카테고리별 Supabase 테이블 라우팅 RAG 구성
3. **documents_business/technical 데이터 적재** (중간): 현재 0행 → 실제 문서 업로드 필요
