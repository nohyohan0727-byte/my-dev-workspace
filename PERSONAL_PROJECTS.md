# 개인 프로젝트 히스토리

> 회사 업무와 무관한 개인/가족 프로젝트 기록입니다.
> WORK_HISTORY.md(회사용)와 분리하여 관리합니다.

---

## 프로젝트 목록

| 프로젝트명 | 폴더 | 상태 |
|---|---|---|
| 가라온브로스 — 보드게임 추천 앱 | `garaon-bros/` | ✅ 1차 완성 |
| 가라온 브로즈: 픽셀 기지 | `garaon-bros/pixel-base.html` | ✅ 개발 완료 |

> 세부 히스토리는 이 파일(`PERSONAL_PROJECTS.md`)에 기록 (WORK_HISTORY.md는 회사용)

---

## [프로젝트 1] 가라온브로스 — 보드게임 추천 앱

| 항목 | 내용 |
|------|------|
| **성격** | 가족용 개인 프로젝트 |
| **목적** | 보드게임방에서 인원·상황에 맞는 게임 추천 |
| **상태** | ✅ 1차 완성 (로컬 동작) |
| **경로** | `C:\dev\office-ai\garaon-bros\` |
| **Supabase** | `mkmxhmoocqnkltjxdfbm` |
| **배포** | office-ai.app/garaon-bros/ (push 후 자동) |

**실제 파일 구조:**
```
garaon-bros/
├── index.html        ← 메인 허브 (비밀번호 → 추천/픽셀기지 선택)
├── recommend.html    ← 보드게임/맨손 게임 추천 앱 ✅
├── admin.html        ← 게임 목록 관리
├── pixel-base.html   ← 픽셀 기지 앱
├── data/
│   └── games-data.js ← 보드게임 20종 + 맨손게임 10종 로컬 데이터
├── js/
│   ├── app.js        ← 추천 알고리즘 + Supabase 연동 함수
│   └── config.js     ← Supabase 연결 설정
└── db/
    └── schema.sql    ← board_games / hand_games 테이블 (선택 실행)
```

**추천 필터:**
- 보드게임: 인원수 / 게임종류(전략·카드·파티·협력·추리 등) / 난이도 / 플레이 시간
- 맨손게임: 인원수 / 분위기(시끌벅적·조용·신체·언어·추리·창의) / 플레이 시간

**작업 이력:**
- 2026-03-01: recommend.html 추천 플로우 완성, 게임 데이터 30종, 추천 알고리즘 구현

---

## [프로젝트 2] 가라온 브로즈: 픽셀 기지

| 항목 | 내용 |
|------|------|
| **성격** | 가족용 개인 프로젝트 |
| **목적** | 집 보드게임 컬렉션 관리 + 별점/후기 |
| **대상** | 가온 (12세, 관리자), 라온 (6세, 큰화면 모드) |
| **상태** | ✅ 개발 완료 / Supabase 키 입력 후 배포 가능 |
| **파일** | `C:\dev\office-ai\garaon-bros\pixel-base.html` |
| **URL** | https://office-ai.app/garaon-bros/pixel-base.html (배포 후) |

**DB 테이블 (별도 Supabase 프로젝트 사용 권장):**
- `games`   — 보유 게임 목록
- `ratings` — 아이들 별점/후기
- `players` — EXP/레벨 관리

**Supabase 설정:**
```
pixel-base.html 상단 주석의 SQL → Supabase SQL Editor 실행
SUPABASE_URL, SUPABASE_ANON_KEY 두 값을 파일에 입력
```

**주요 기능:**
- 🔐 비밀번호 진입 (`!20150910!`) — 키패드 UI
- 👑 가온 모드: 게임 등록 + 라온이 힌트 작성 (+30~50 EXP)
- 🌈 라온 모드: 대형 카드 + 형아찬스 버튼
- ⭐ 별점/후기 → "공략 완료!" 스탬프 + EXP
- 🏆 이번 주 TOP 3 스크롤 티커
- 📱 게임별 QR 코드 (qrserver.com API)
- 💬 가온 힌트 말풍선

**배포:**
```bash
cd C:\dev\office-ai
git add garaon-bros/pixel-base.html
git commit -m "2026-03-01: 가라온 브로즈 픽셀 기지 추가"
git push
```

---

## 작업 규칙

- 개인 프로젝트 히스토리는 **이 파일(`PERSONAL_PROJECTS.md`)에만** 기록
- 회사 업무용 `WORK_HISTORY.md`에는 절대 기록하지 않음
- 파일명 충돌 주의: `index.html` → 메인 허브, `recommend.html` → 추천, `pixel-base.html` → 픽셀기지
