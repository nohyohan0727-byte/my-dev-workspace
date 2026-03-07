# Claude Manager

## 상태: 진행중

## 개요
- 위치: `C:\work\claude-manager`
- 실행: `node server.js` → `localhost:5000`
- 목적: Claude Code 관리 도구 (대시보드, 프롬프트, 작업실, 개발현황, 메모리, 브레인스토밍)

## 최근 작업 (2026-03-07)
- 개발현황 업무별 뷰에 프로젝트 필터 탭 버튼 추가 (pill 스타일, 프로젝트 고유 색상)
- dev-tasks.json에 Claude Manager 태스크 10개 등록 (완료 9, 예정 1)
- 신규 프로젝트 "보완취약점 개선" 추가됨 (사용자 직접 추가)

## 다음 작업
- 사용자 요청에 따라 진행
- 모바일 Dev Console 지원 (pending)

## 주요 파일
- `public/index.html` — 메인 SPA (CSS v20)
- `public/js/app.js` — 핵심 로직 (v16)
- `public/js/project-chat.js` — 작업실 채팅 (v7)
- `public/js/brainstorm.js` — 브레인스토밍 (v3)
- `public/css/style.css` — 스타일 (v20)
- `data/dev-tasks.json` — 개발현황 데이터
- `server.js` — Express 서버
- `agent.js` — Gemini AI 에이전트
