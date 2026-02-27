# [2026-02-27] office-ai 소스 분석 및 배포 환경 구축

## 작업 정보

| 항목 | 내용 |
|------|------|
| **날짜** | 2026-02-27 |
| **작업자** | nohyohan0727-byte + Claude (Sonnet 4.6) |
| **상태** | ✅ 완료 |

---

## 소스 분석 결과

### 기술 스택
| 항목 | 내용 |
|------|------|
| **종류** | 순수 정적 사이트 (빌드 불필요) |
| **언어** | HTML5 + CSS3 |
| **폰트** | Pretendard (Google Fonts) |
| **아이콘** | Lucide Icons (CDN) |
| **호스팅** | Netlify |
| **도메인** | https://office-ai.app |

### 파일 구조
```
office-ai/
├── index.html                    ← 메인 랜딩 페이지 (단일 페이지)
├── demo.html                     ← KS AI 체험 데모 페이지
├── style.css                     ← 반응형 다크 테마 스타일
├── profile-image.jpg             ← 노진광 대표 프로필 사진
├── DEPLOY.md                     ← 배포 가이드 (경로 업데이트됨)
├── README.md                     ← 프로젝트 개요
├── business_plan.md              ← 비즈니스 플랜 문서
├── create_ppt.py                 ← PPT 생성 스크립트
├── Office_AI_Business_Plan.pptx  ← 비즈니스 플랜 v1
└── Office_AI_Business_Plan_v2.pptx ← 비즈니스 플랜 v2
```

### 콘텐츠 구성 (index.html)
- **이벤트 배너**: 3월 특별 이벤트 (선착순 10명, 문서 자동화 무료)
- **Hero 섹션**: KS 심사위원 출신, AI 비즈니스 파트너 포지셔닝
- **Problem 섹션**: 중소기업 페인포인트 3가지
- **Solution 섹션**: AI 솔루션 소개 + 채팅 UI 시뮬레이션
- **Demo CTA 섹션**: KS AI 데모 페이지 연결
- **Automation 섹션**: 6가지 실무 자동화 사례 (견적서, 세금계산서, 사업계획서, 계약서, 회계, KS인증)
- **Services 섹션**: 4개 패키지 (Starter 무료, Business Plan Bot, Certification AI, 보안 RAG)
- **About 섹션**: 노진광 대표 프로필
- **Contact 섹션**: Netlify Form 연동 상담 신청 폼

---

## 배포 인프라

```
C:\dev\office-ai  →  git push  →  GitHub  →  Webhook  →  Netlify  →  office-ai.app
```

| 항목 | 값 |
|------|-----|
| **GitHub 저장소** | https://github.com/nohyohan0727-byte/office-ai |
| **Netlify 사이트** | https://office-ai.app |
| **Netlify 대시보드** | https://app.netlify.com/sites/elaborate-cendol-e22a61 |
| **Site ID** | `7b9d2cad-0a57-4d30-bbdf-54f80848ce94` |
| **배포 방식** | main 브랜치 push → 자동 배포 (10~30초) |
| **빌드** | 없음 (정적 파일 그대로 배포) |

---

## 이번 작업에서 변경된 내용

### office-ai 저장소
- `DEPLOY.md`: 경로 수정 (`C:\work` → `C:\dev`), 환경 변수 파일 경로 통합

### my-dev-workspace
- `.env` / `.env.example`: Netlify 관련 변수 추가
  - `NETLIFY_TOKEN` (값 별도 입력 필요)
  - `NETLIFY_SITE_ID`
  - `NETLIFY_BUILD_HOOK`
  - `NETLIFY_SITE_URL`

---

## 배포 방법 (요약)

```bash
# office-ai 수정 후 배포
cd C:\dev\office-ai
git add .
git commit -m "변경 내용 설명"
git push   # 자동으로 Netlify 배포 트리거

# 배포 확인: https://office-ai.app (약 30초 후)
```

---

## 향후 작업 예정

- [x] Netlify 토큰 `.env`에 추가 ✅ (완료 - API 연결 확인됨, 사이트 상태: ready)
- [ ] n8n 자동화 솔루션 구축 → office-ai 홈페이지에 신규 섹션으로 소개
- [ ] 모바일 햄버거 메뉴 추가 (현재 모바일에서 nav-links 숨겨짐)
- [ ] 이벤트 만료 날짜 관리 (3월 이벤트 → 추후 업데이트 필요)
