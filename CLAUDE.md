# my-dev-workspace 추가 지침

> 전역 지침: `C:\Users\82103\.claude\CLAUDE.md` (항상 적용)
> 이 파일은 이 폴더에서 작업할 때 추가로 적용됩니다.

---

## 이 폴더 전용 규칙

- API 키는 `.env`에만 보관 (gitignore, 커밋 금지)
- n8n 워크플로우 수정 스크립트: `.mjs` 확장자, 이 폴더 루트에 저장
- 완료된 `.mjs` 스크립트는 `projects/n8n-automations/archive/`로 이동

## 디렉토리 구조

```
C:\dev\my-dev-workspace\
├── CLAUDE.md              ← 이 파일 (폴더 전용 추가 지침)
├── WORK_HISTORY.md        ← 완료 이력 아카이브 (자동 로드 X)
├── PERSONAL_PROJECTS.md   ← 개인/가족 프로젝트 기록
├── SETUP.md               ← 신규 환경 설정 가이드
├── .env                   ← API 키 (gitignore)
├── active-projects/       ← 진행 중 프로젝트 상태
├── work-logs/             ← 날짜별 세션 기록
└── projects/
    └── n8n-automations/   ← n8n 워크플로우 JSON
```
