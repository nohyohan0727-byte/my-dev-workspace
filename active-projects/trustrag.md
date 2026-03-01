# TrustRAG — 활성 프로젝트 상태

**최종 업데이트**: 2026-03-02
**상세 세션 로그**: `work-logs/2026-03-02-trustrag-upload-pdf.md`

---

## 현재 상태: 🔴 업로드 파이프라인 버그

### 블로킹 이슈
```
Prepare Storage Upload 노드 실패
Error: 파일 바이너리 읽기 실패: undefined [line 25]
```

**원인**: n8n task runner는 비인접 노드의 binary를 `getBinaryDataBuffer`로 읽지 못함.
`$('Extract Request').first()` → JSON은 되지만 binary는 안 됨.

---

## 다음 첫 번째 작업 (세션 시작하면 바로 실행)

**파일**: `C:\dev\my-dev-workspace\rebuild_upload_v2.mjs`

### 수정 1: Extract Request 노드 jsCode
```js
const body = $input.first().json.body || $input.first().json;
const binary = $input.first().binary || {};
const fileBase64 = binary.file?.data || '';  // ← 이 줄 추가

return [{
  json: {
    api_key:    (body.api_key  || '').trim(),
    category:   body.category  || '',
    filename:   body.filename  || '',
    filesize:   Number(body.filesize) || 0,
    mimetype:   body.mimetype  || 'application/octet-stream',
    fileBase64,  // ← 이 줄 추가
  },
  binary,
}];
```

### 수정 2: Prepare Storage Upload 노드 (getBinaryDataBuffer 제거)
```js
// 변경 전 (line 25 - 실패):
// fileBuffer = await this.helpers.getBinaryDataBuffer($('Extract Request').first(), 'file');

// 변경 후:
const req = $('Extract Request').first().json;
if (!req.fileBase64) throw new Error('파일 데이터 없음 (fileBase64)');
const fileBuffer = Buffer.from(req.fileBase64, 'base64');
```

### 수정 3: Extract Text 노드 (동일)
```js
// 변경 전 (실패):
// fileBuffer = await this.helpers.getBinaryDataBuffer($('Extract Request').first(), 'file');

// 변경 후:
const req = $('Extract Request').first().json;
const fileBuffer = Buffer.from(req.fileBase64 || '', 'base64');
```

### 적용 명령
```bash
cd C:\dev\my-dev-workspace
node rebuild_upload_v2.mjs
```

---

## 완료 후 테스트 순서
1. upload.html → 파일 업로드 테스트
2. Supabase Storage `trustrag-files` 버킷에 파일 있는지 확인
3. Supabase `files` 테이블에 메타데이터 있는지 확인
4. chat.html → 해당 파일 소스로 질문 → ⬇ 다운로드 버튼 테스트
5. PDF 텍스트 추출 품질 확인 (텍스트 기반 PDF)

---

## 시스템 구성

### n8n 워크플로우
| 이름 | ID |
|------|-----|
| TrustRAG_Upload | `ZrdgEqchaCSoycyP` |
| TrustRAG_Admin | `9c5kGAC7xHGXgvtX` |

### 파이프라인 흐름
```
Upload Webhook → Extract Request (fileBase64 포함) → Validate Auth
→ Is Authorized? → Check Upload Permission → Can Upload?
→ Prepare Storage Upload (fileBase64 → Buffer → Supabase) → Extract Text
→ Chunk Text → Get Chunk Embedding → Insert into Supabase
→ Aggregate Results → Save File Metadata → Write Audit Log → Return Response
```

### 프론트엔드
| 파일 | 경로 | 상태 |
|------|------|------|
| upload.html | `C:\dev\office-ai\trustrag\upload.html` | FormData 방식 ✅ |
| chat.html | `C:\dev\office-ai\trustrag\chat.html` | 마크다운+다운로드 ✅ |
| b3f9s1.html | `C:\dev\office-ai\trustrag\b3f9s1.html` | 어드민 ✅ |

### 완료된 수정
- `fix_file_url_final.mjs`: get_file_url → `this.helpers.httpRequest` 직접 사용 ✅
- `fix_upload_storage.mjs`: UUID 기반 storage_path (한글 파일명 대응) ✅
- `rebuild_upload_v2.mjs`: FormData 방식 + Extract Text 노드 추가 (적용됨, 버그 있음)

---

## 완료 처리 방법
이 파일 삭제 + WORK_HISTORY.md에 완료 항목 추가 + CLAUDE.md 활성 목록에서 제거
