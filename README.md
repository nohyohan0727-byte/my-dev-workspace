# My Dev Workspace

> n8n 자동화 솔루션 구축 및 office-ai 홈페이지 연동을 위한 개발 워크스페이스
> 두 대의 PC에서 GitHub를 통해 형상관리합니다.

## 처음 시작하는 분은 여기서 시작하세요

1. **[SETUP.md](SETUP.md)** - 새 PC 환경 설정 가이드
2. **[WORK_HISTORY.md](WORK_HISTORY.md)** - 현재까지의 작업 이력

## 프로젝트 구조

```
my-dev-workspace/
├── .env                      ← API 키 모음 (Git 제외, 직접 설정 필요)
├── .env.example              ← API 키 목록 템플릿
├── .gitignore
├── README.md                 ← 이 파일
├── SETUP.md                  ← 신규 환경 설정 가이드
├── WORK_HISTORY.md           ← 작업 이력 메인 파일
├── projects/
│   └── n8n-automations/      ← n8n 워크플로우 JSON 저장소
├── notes/                    ← 개발 메모, 설계 문서
└── work-logs/                ← 날짜별 상세 작업 로그
```

## 주요 저장소

| 저장소 | 용도 |
|--------|------|
| `my-dev-workspace` (이 곳) | 개발 작업 공간, 자동화 워크플로우 |
| `office-ai` | 홍보 홈페이지 소스 |

## 매일 작업 루틴

```bash
# 시작: 최신 내용 동기화
git pull

# 종료: 작업 저장
git add .
git commit -m "YYYY-MM-DD: 작업 내용 요약"
git push
```
