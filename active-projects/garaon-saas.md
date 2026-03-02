# Garaon SaaS — 활성 프로젝트 상태

**최종 업데이트**: 2026-03-02
**상세 세션 로그**: `work-logs/2026-03-02-garaon-saas.md`

---

## 현재 상태: 🟡 계획서 검토 대기

### 완료된 것
- 계획서 작성 완료: `C:\Users\82103\.claude\plans\adaptive-stargazing-cascade.md`
- GitHub 저장소 생성: `nohyohan0727-byte/garaon-saas` (private)
- `C:\dev\garaon-saas\` 디렉토리 초기화 + git 연결

### 블로커
Supabase 무료 플랜 제한 (2개 프로젝트 초과)
- 현재 활성: `mkmxhmoocqnkltjxdfbm` (garaon-bros), `ryzkcdvywxblsbyujtfv` (TrustRAG)
- 해결 방법: 하나를 pause 하거나 유료 전환 필요

---

## 다음 첫 번째 작업 (세션 시작하면 바로 실행)

1. 계획서 검토 + 승인 받기
2. Supabase 블로커 해결 (TrustRAG pause 또는 유료 전환)
3. 구현 시작 (12단계)

---

## 구현 12단계 요약

| 단계 | 작업 | 상태 |
|------|------|------|
| 0 | GitHub 저장소 + Supabase 프로젝트 | ⚠️ Supabase 블로커 |
| 1 | garaon-bros → garaon-saas 파일 복사 | ⬜ |
| 2 | Supabase `tenants` 테이블 + RLS | ⬜ |
| 3 | `tenant-loader.js` 구현 | ⬜ |
| 4 | `config.js` 동적 로드 | ⬜ |
| 5 | 기존 테이블 `tenant_id` 추가 + 쿼리 필터 | ⬜ |
| 6 | `setup.html` 셋업 마법사 | ⬜ |
| 7 | `master.html` 마스터 대시보드 | ⬜ |
| 8 | API 키 은닉 (n8n 프록시) | ⬜ |
| 9 | `i18n.js` + 언어팩 | ⬜ |
| 10 | 범용 양식 (custom_fields JSONB) | ⬜ |
| 11 | 코드 난독화 빌드 스크립트 | ⬜ |
| 12 | 테스트 + 배포 | ⬜ |

---

## 핵심 원칙
- **기존 `garaon-bros/` 폴더는 절대 수정하지 않음**
- 별도 GitHub 저장소 (`garaon-saas`)
- 새 Supabase 프로젝트 (완전 격리)
