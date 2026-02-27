# 작업 히스토리 (WORK_HISTORY)

> 이 파일은 모든 작업의 이력을 기록합니다.
> 새로운 작업자(사람 또는 AI)가 이 파일을 읽고 즉시 작업을 이어갈 수 있도록 작성합니다.

---

## 현재 프로젝트 개요

| 항목 | 내용 |
|------|------|
| **주요 목적** | n8n 기반 자동화 솔루션 구축 및 office-ai 홈페이지 홍보 연동 |
| **주요 저장소** | `my-dev-workspace` (개발 워크스페이스), `office-ai` (홍보 홈페이지) |
| **주요 도구** | n8n, GitHub, Claude Code |
| **작업 환경** | 2대의 PC에서 GitHub를 통해 형상관리 |

---

## 작업 이력

> 형식: 날짜순 최신 작업이 위에 옵니다.
> 상세 내용이 긴 경우 별도 파일로 분리하여 경로를 기입합니다.

---

### [2026-02-27 저녁] 홈페이지 UX/카피 전면 개편 + 랜딩페이지 신규 제작

| 항목 | 내용 |
|------|------|
| **작업자** | nohyohan0727-byte + Claude (Sonnet 4.6) |
| **상태** | ✅ 완료 |
| **상세 로그** | [work-logs/2026-02-27-homepage-landing.md](work-logs/2026-02-27-homepage-landing.md) |

**요약:**

#### office-ai/index.html 개편
- Hero 타이틀: `반복 서류 업무에서 벗어나` → **`대표님 대신 서류 쓰는 AI 비서를 채용하세요`**
- 전체 "AI" 추상 표현 → "AI 비서", "RAG 시스템", "업무 자동화" 구체 표현으로 통일
- demo.html/register.html 전체 "AI" → "RAG 시스템 (검색 증강 생성)" 표기 변경
- `자동화 사례 보기` 버튼 앵커 버그 수정: `#services` → `#cases`
- **브릿지 배너** 추가 (자동화 사례 섹션 후): index2.html 유도
- **Hero 이벤트 버튼** 추가 (빨간 계열, border 깜빡임 애니메이션): index2.html 연결
- **플로팅 CTA 버튼** 추가 (300px 스크롤 후 등장, 우측 하단 고정)
- 네비게이션 `fixed → sticky` 변경: 이벤트 배너가 데스크탑/모바일 모두 노출되도록 수정
- 로고 클릭 시 메인 이동: `<div>` → `<a href="index.html">` 링크 추가
- **상담 폼 하단 직통 연락처** 추가: 제이케이네트웍스 대표 노진광 📞 010-3127-4528 (tel: 링크)

#### index2.html 신규 생성 (무료상담 전환 랜딩)
- 구성: Hero → 체크리스트 → 손실 비용 → 차별점 → 직원교육 대체 → LIVE DEMO → 고객 후기 → 상담무료 이유 → 긴박감 → Final CTA → 폼
- CTA 버튼 5회 삽입, 섹션별 문구 차별화
- 직원교육 섹션: BEFORE/AFTER 비교 + 실제 대화 시나리오
- 고객 후기 3개: 제조업(KS심사 2주→3일), IT스타트업(계획서 5일→당일), 유통업(신입교육 2주→3일)
- 잔여 슬롯 동적 표시 (JS)
- 직통 연락처 추가 (tel: 링크)

#### index3.html 신규 생성 (전환 최적화 고도화 버전)
- index2 업그레이드: "대표 시간 = 가장 비싼 자원" 심리 자극 강화
- **손실 수치 카운트업 애니메이션**: 월 40h+ / 90% 단축 / 10분 진단
- **Before/After 그리드**: "최대 90%↓" 배지 포함
- **보증 4알약**: ✔ 비용없음 · 부담없음 · 강요없음 · 10분완료 Final 섹션 집중 배치
- 폼 항목 5개 (신입교육/인수인계 추가)
- 직통 연락처 추가 (tel: 링크)

#### demo.html 개선
- 에러 메시지 HTML 렌더링 지원 (`error` 타입 → innerHTML 처리)
- 토큰 소진 에러 메시지 내 연락처 tel: 링크 적용

**배포:** 모든 변경사항 GitHub push → Netlify 자동 배포 완료
- **URL 목록**:
  - 메인: https://office-ai.app/
  - 전환 랜딩 v1: https://office-ai.app/index2.html
  - 전환 랜딩 v2: https://office-ai.app/index3.html
  - 데모: https://office-ai.app/demo.html
  - 등록: https://office-ai.app/register.html
  - 관리자 업로드: https://office-ai.app/admin-upload.html

---

### [2026-02-27 오후] admin-upload.html 보안·기능 완성 및 n8n 연동

| 항목 | 내용 |
|------|------|
| **작업자** | nohyohan0727-byte + Claude (Sonnet 4.6) |
| **상태** | ✅ 완료 |
| **상세 로그** | [work-logs/2026-02-27-admin-upload-complete.md](work-logs/2026-02-27-admin-upload-complete.md) |

**요약:**
- `admin-upload.html` 신규 생성: 관리자 문서 업로드 페이지 (https://office-ai.app/admin-upload.html)
- **로그인 보안**: 하드코딩 비밀번호 제거 → n8n 서버사이드 키 검증 (`admin_JKN_7kX2pM9vR5tN3wQ8`)
- **n8n `RAG-Webhook-Admin-Upload` 워크플로우 수정**:
  - `Validate Admin Key` 노드 추가: admin_key 검증 + 원본 데이터 pass-through
  - `Is Admin?` IF 노드 추가: 인증 성공/실패 분기
  - `Return Admin 401` 노드 추가: 인증 실패 시 401 반환
  - `Base64 to Binary` 수정: `_validate_only` 플래그로 파일 없이 키 검증 가능
- **카테고리 필수 선택 + 기타 직접 입력**: 없는 카테고리 직접 생성 가능
- **구글시트 연동 카테고리 드롭다운**: 신규 n8n 워크플로우 `RAG-Admin-Category-List` 생성
  - 엔드포인트: `POST /webhook/admin-categories`
  - 업로드 이력 시트에서 프로젝트 목록 읽어 드롭다운에 동적 표시
  - 중복 카테고리 생성 방지
- **API 키 URL 노출 보안 수정**: `register.html` → `demo.html` 이동 시 sessionStorage 사용 (URL 파라미터 제거)
- **토큰 100개로 제한**: `RAG-3-User-Registration` 워크플로우 `tokens_total: 1000 → 100` 변경
- **토큰 소진 안내**: 연락처 표시 (제이케이네트웍스 대표 노진광 010-3127-4528)
- 모든 변경사항 GitHub push → Netlify 자동 배포 완료

---

### [2026-02-27] RAG-4-Secure-Chat-FIXED 워크플로우 완성 및 검증

| 항목 | 내용 |
|------|------|
| **작업자** | nohyohan0727-byte + Claude (Sonnet 4.6) |
| **상태** | ✅ 완료 |
| **상세 로그** | [work-logs/2026-02-27-rag4-secure-chat-fix.md](work-logs/2026-02-27-rag4-secure-chat-fix.md) |

**요약:**
- n8n `RAG-4-Secure-Chat` 분석: webhook path 불일치(`rag-chat` vs `rag-category-chat`) 문제 발견
- `RAG-4-Secure-Chat-FIXED` 워크플로우 신규 구축:
  - **Category Table Selector**: `category` 파라미터 → Supabase 테이블명 동적 매핑
  - **Load User**: Google Sheets에서 `api_key`로 유저 조회
  - **Validate Auth**: JS 코드로 api_key/status/expires_at/tokens 4단계 검증
  - **Is Authorized?**: 인증 통과/실패 분기
  - **KS AI Agent**: GPT-4.1 + Supabase RAG + SerpAPI 웹검색 + 대화 메모리
  - **Deduct Token**: 응답 후 Google Sheets `tokens_used` +1 자동 업데이트
  - **Return Response**: `success`, `response`, `tokens_remaining` JSON 반환
- 실제 동작 검증 완료: `POST /webhook/rag-category-chat` → KS 인증 답변 + `tokens_remaining: 99` 확인
- 워크플로우 JSON 저장: `projects/n8n-automations/RAG-4-Secure-Chat-FIXED.json`
- 워크플로우 문서화: `projects/n8n-automations/RAG-4-Secure-Chat-FIXED.md`

---

### [2026-02-27] register.html 유저 등록 페이지 추가 및 demo.html 연동

| 항목 | 내용 |
|------|------|
| **작업자** | nohyohan0727-byte + Claude (Sonnet 4.6) |
| **상태** | ✅ 완료 |
| **상세 로그** | [work-logs/2026-02-27-demo-category-ui.md](work-logs/2026-02-27-demo-category-ui.md) |

**요약:**
- `register.html` 신규 생성: 이름/이메일 입력 → n8n `RAG-3-User-Registration` 호출 → API 키 자동 발급
- 가입 성공 후 API 키 화면 표시 + 복사 버튼, "AI 체험하기" 버튼으로 demo.html 이동
- `demo.html` URL 파라미터 수신 추가: `?api_key=xxx&name=xxx` 로 개인 키 자동 적용
- n8n `RAG-3-User-Registration` webhook: `POST /rag-register` (Active), Google Sheets에 유저 저장
- GitHub push → Netlify 자동 배포 완료

---

### [2026-02-27] demo.html 카테고리 UI 추가 및 Supabase 분석

| 항목 | 내용 |
|------|------|
| **작업자** | nohyohan0727-byte + Claude (Sonnet 4.6) |
| **상태** | ✅ 완료 |
| **상세 로그** | [work-logs/2026-02-27-demo-category-ui.md](work-logs/2026-02-27-demo-category-ui.md) |

**요약:**
- Supabase 테이블 구조 확인: `documents_ks_certification`(2,560행), `documents_company_a/b/c`, `documents_business`, `documents_technical`, `documents_admin_upload`(52행)
- n8n `RAG-Multi-Category-Chat` 분석: stub 상태 (더미 응답, 실제 RAG 미연결)
- n8n `RAG-4-Secure-Chat` 분석: webhook path=`rag-chat`, 실제 OpenAI+Supabase RAG 동작
- `demo.html` 전면 개편: 7개 카테고리 탭 추가 (KS인증/비즈니스/기술문서/업무관리/회사문서A-C)
- fetch POST body에 `category` 필드 추가, 에러 처리 상세화
- GitHub push → Netlify 자동 배포 완료

---

### [2026-02-27] office-ai 소스 분석 및 배포 환경 구축

| 항목 | 내용 |
|------|------|
| **작업자** | nohyohan0727-byte + Claude (Sonnet 4.6) |
| **상태** | ✅ 완료 |
| **상세 로그** | [work-logs/2026-02-27-office-ai-setup.md](work-logs/2026-02-27-office-ai-setup.md) |

**요약:**
- `office-ai` 저장소 `C:\dev\office-ai` 에 clone 완료
- 소스 분석: 순수 정적 HTML+CSS, Netlify 자동배포 파이프라인 확인
- `DEPLOY.md` 경로 수정 (`C:\work` → `C:\dev`)
- `.env` / `.env.example` 에 Netlify 변수 추가 (Site ID, Build Hook URL)
- 배포 흐름: git push → GitHub → Netlify Webhook → office-ai.app (30초)

---

### [2026-02-27] 초기 환경 설정

| 항목 | 내용 |
|------|------|
| **작업자** | nohyohan0727-byte + Claude (Sonnet 4.6) |
| **상태** | ✅ 완료 |
| **상세 로그** | [work-logs/2026-02-27-initial-setup.md](work-logs/2026-02-27-initial-setup.md) |

**요약:**
- GitHub 저장소 `my-dev-workspace` 생성
- `C:\dev\my-dev-workspace` 로컬 작업 폴더 설정
- `.env` / `.env.example` 키 관리 파일 생성
- `projects/`, `notes/`, `work-logs/` 폴더 구조 생성
- `SETUP.md` 신규 개발자 온보딩 가이드 작성

---

## 다음 작업 예정

### ✅ 완료 항목
- [x] Netlify 배포 파이프라인 구축
- [x] demo.html 카테고리 선택 UI + RAG 연동
- [x] register.html 유저 등록 페이지
- [x] sessionStorage 보안 전환 (URL 파라미터 제거)
- [x] n8n RAG-4-Secure-Chat-FIXED 완성
- [x] admin-upload.html + n8n admin_key 인증
- [x] n8n RAG-Admin-Category-List (카테고리 동적 로딩)
- [x] 신규 유저 토큰 100개 제한
- [x] 홈페이지 전체 UX/카피 개편 (AI비서 컨셉)
- [x] index2.html 무료상담 전환 랜딩
- [x] index3.html 고도화 전환 랜딩
- [x] 직통 연락처 tel: 링크 전 페이지 적용
- [x] 이벤트 배너/플로팅 버튼 index2 유도

### 🔲 다음 작업 후보
- [ ] **index2 vs index3 A/B 테스트**: 어느 버전 전환율이 높은지 비교
- [ ] **실제 고객 후기로 교체**: 현재 가상 후기 → 실제 도입 사례로 변경
- [ ] **모바일 햄버거 메뉴**: 현재 모바일에서 nav 링크 숨겨짐
- [ ] **n8n RAG-Multi-Category-Chat 실제 연결**: 더미→진짜 OpenAI+Supabase RAG
- [ ] **Google Analytics / 전환 추적 설치**: 상담 폼 제출 이벤트 트래킹
- [ ] **admin-upload 카테고리 기타 선택 후 실제 업로드 테스트** 확인
- [ ] **HWP 파일 지원**: n8n Docker 이미지에 LibreOffice 추가 → `Execute Command` 노드로 HWP→TXT 변환 후 Supabase 업로드 (현재는 HWP 업로드 시 PDF 변환 안내 메시지 표시 중)

---

## 작업 기록 방법

새 작업을 시작할 때 이 파일 상단(작업 이력 섹션)에 아래 형식으로 추가하세요:

```markdown
### [YYYY-MM-DD] 작업 제목

| 항목 | 내용 |
|------|------|
| **작업자** | 이름 또는 AI 모델명 |
| **상태** | 🔄 진행중 / ✅ 완료 / ⏸️ 보류 |
| **상세 로그** | [work-logs/YYYY-MM-DD-작업명.md](work-logs/YYYY-MM-DD-작업명.md) |

**요약:**
- 핵심 작업 내용 bullet point
```
