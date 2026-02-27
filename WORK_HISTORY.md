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

- [ ] Netlify 토큰 `.env`에 추가 (Netlify 대시보드 → User Settings → Applications)
- [ ] n8n 첫 번째 자동화 워크플로우 기획 및 구현
- [ ] office-ai 홈페이지에 n8n 솔루션 소개 섹션 추가
- [ ] 모바일 햄버거 메뉴 추가 (현재 모바일에서 nav 숨겨짐)

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
