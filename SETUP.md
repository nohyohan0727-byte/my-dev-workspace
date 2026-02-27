# 개발 환경 설정 가이드 (SETUP)

> 새로운 PC 또는 새로운 작업자가 이 프로젝트를 이어가기 위한 온보딩 가이드입니다.
> 이 문서만 따라 하면 즉시 작업을 이어갈 수 있습니다.

---

## 프로젝트 개요

| 항목 | 내용 |
|------|------|
| **목적** | n8n 자동화 솔루션 구축 + office-ai 홈페이지 연동 홍보 |
| **주 작업자** | nohyohan0727-byte |
| **주요 도구** | n8n, GitHub, Claude Code (AI 개발 어시스턴트) |
| **저장소** | [my-dev-workspace](https://github.com/nohyohan0727-byte/my-dev-workspace), [office-ai](https://github.com/nohyohan0727-byte/office-ai) |

---

## Step 1. 필수 도구 설치

```bash
# Git 설치 확인
git --version

# Node.js (필요시)
node --version

# Claude Code CLI 설치 (AI 어시스턴트)
npm install -g @anthropic-ai/claude-code
```

---

## Step 2. 저장소 Clone

```bash
# 작업 폴더 생성
mkdir C:\dev
cd C:\dev

# 워크스페이스 저장소 clone
git clone https://github.com/nohyohan0727-byte/my-dev-workspace.git

# office-ai 저장소 clone (홈페이지 소스)
git clone https://github.com/nohyohan0727-byte/office-ai.git
```

---

## Step 3. Git 사용자 설정

```bash
git config --global user.name "your-name"
git config --global user.email "your-email"
git config --global credential.helper store
```

---

## Step 4. 환경 변수 설정

```bash
# 템플릿 복사
cd C:\dev\my-dev-workspace
cp .env.example .env

# .env 파일 열어서 실제 값 입력
# 필요한 키 목록은 .env.example 참고
# 실제 키 값은 팀 내 안전한 채널로 요청
```

### 필수 API 키 목록

| 서비스 | 용도 | 발급처 |
|--------|------|--------|
| `GITHUB_TOKEN` | GitHub API 접근 | GitHub Settings > Developer Settings |
| `N8N_API_KEY` | n8n API 접근 | n8n 설정 > API 섹션 |

---

## Step 5. 현재 작업 상태 파악

작업을 시작하기 전에 반드시 확인:

```bash
# 1. 최신 코드 받기
cd C:\dev\my-dev-workspace
git pull

# 2. 작업 이력 확인 (가장 중요!)
# WORK_HISTORY.md 파일을 읽어서 현재 상태 파악
```

**→ [WORK_HISTORY.md](WORK_HISTORY.md) 를 먼저 읽으세요**

---

## Step 6. 작업 시작

```bash
# 매일 작업 시작 시
git pull                          # 최신 내용 동기화

# 작업 후 저장
git add .
git commit -m "날짜: 작업 내용 요약"
git push
```

---

## 프로젝트 구조

```
C:\dev\
├── my-dev-workspace/             ← 이 저장소 (메인 워크스페이스)
│   ├── .env                      ← API 키 모음 (git 제외)
│   ├── .env.example              ← API 키 목록 템플릿
│   ├── WORK_HISTORY.md           ← 작업 이력 (여기서 시작!)
│   ├── SETUP.md                  ← 이 파일
│   ├── projects/
│   │   └── n8n-automations/      ← n8n 워크플로우 JSON 저장
│   ├── notes/                    ← 개발 메모, 설계 문서
│   └── work-logs/                ← 날짜별 상세 작업 로그
└── office-ai/                    ← 홍보 홈페이지 소스
```

---

## n8n 작업 관련

- n8n 워크플로우는 JSON으로 export하여 `projects/n8n-automations/` 에 저장
- 각 워크플로우마다 README 작성 (목적, 트리거, 연결 서비스 설명)
- office-ai 홈페이지에 솔루션 소개 시 `notes/` 에 초안 작성 후 반영

---

## 문제 발생 시

1. `WORK_HISTORY.md` 에서 관련 작업 이력 확인
2. `work-logs/` 에서 상세 로그 확인
3. Claude Code에 질문: `claude` 명령으로 AI 어시스턴트 실행
