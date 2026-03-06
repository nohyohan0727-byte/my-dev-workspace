# 2026-03-06: 챗봇 시스템 고도화 (텔레그램 인라인키보드, AI 프롬프트, 챗봇관리 UI)

## 완료 작업

### 1. 텔레그램 인라인 키보드 callback_query 처리
- n8n `site-chat-telegram-reply` 워크플로우(uP53qMSp2SZ9TIxX) 수정
- Extract Reply: callback_query 감지 -> type 분기 (callback_view / callback_delete / reply)
- Route by Type (Switch 노드): reply / view / delete 3분기
- view 경로: Fetch Chat History (Supabase) -> Format Chat History -> Answer Callback + Send Chat History
- delete 경로: Delete Message -> Answer Callback Delete
- 문제 해결 과정:
  - SM getUpdates 방식 불가 (봇 webhook 설정됨) -> n8n 워크플로우에서 직접 처리
  - webhook responseMode "lastNode" -> "onReceived" 변경 (500 에러 해결)
  - Switch v3 conditions에 options.caseSensitive 누락 -> 추가
  - 봇 토큰 불일치 수정 (7926... -> 8468...)
  - Supabase 키 불일치 수정
  - Code 노드에서 fetch 미지원 -> HTTP Request + Code 분리
  - Supabase 빈 결과 시 파이프라인 중단 -> alwaysOutputData

### 2. AI 시스템 프롬프트 업데이트
- n8n `site-chat` 워크플로우(FOQu342VqpM8X7GT) Call OpenAI 노드
- 기존: 하드코딩된 서비스 정보 (Certification AI 등 엉뚱한 서비스)
- 변경: SM 실제 서비스 목록 기반 (Office-AI, Dev-Master, RAG Chat, TrustRAG, LaunchKit)
- 구독서비스 질문 시 정확한 요금제 안내

### 3. 서비스 구분 (svc_id) 시스템
- Supabase site_chat 테이블: `svc_id` 컬럼 추가 (기본값 'office-ai')
- chat-widget.js: `svcId` 파라미터 지원, 모든 webhook 호출에 svc_id 포함
- n8n: Clean Response에서 svc_id 추출, 모든 Save 노드에 저장
- SM 서버: 세션 데이터에 svc_id 반환
- dev-master index.html: ChatWidget.init에 svcId: 'devmaster' 추가
- Netlify 배포 완료

### 4. SM 챗봇관리 UI 개선
- select box -> 서비스 카드 (큰 아이콘 + 진행중/대기중 뱃지)
- 서비스 카드 클릭 -> 해당 서비스 세션만 필터링
- 상단 대시보드(전체/진행중/대기중/종료) 클릭 -> 상태 필터링
- 세션 목록: 카드형 디자인, 서비스명 표시, 호버 효과
- 중복 상태필터 버튼 제거

### 5. SM 서버 정리
- 작동 불가한 pollTelegramCallbacks / setInterval 코드 제거

## 수정된 파일
- `C:\work\service-manager\server.js` - broken polling 제거, svc_id 지원
- `C:\work\service-manager\public\index.html` - 챗봇관리 UI 구조
- `C:\work\service-manager\public\js\app.js` - 챗봇관리 렌더링 전면 개편
- `C:\work\dev-master\index.html` - ChatWidget svcId 추가
- `C:\dev\office-ai\js\chat-widget.js` - svcId 파라미터 지원 (Netlify 배포)
- n8n 워크플로우 2개 (site-chat, site-chat-telegram-reply)
- Supabase site_chat 테이블 (svc_id 컬럼)

## 미완료 / 다음 작업
- 텔레그램 봇 토큰/chatId 범용화: 현재 하드코딩 -> SM 설정 기반 동적 조회
- dev-master 사이트에 챗봇이 뜨는지 실제 확인 (chat-widget.js 로드 여부)
- 다른 서비스(LaunchKit, TrustRAG 등)에도 ChatWidget 장착
