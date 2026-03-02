#!/usr/bin/env node
/**
 * Claude API Usage CLI
 * Usage: node usage.mjs
 *
 * 필요: Admin API Key (sk-ant-admin...) → .env 파일에 ANTHROPIC_ADMIN_KEY=... 로 저장
 */

import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── 설정 ────────────────────────────────────────────────────────────────────
// .env 파일 읽기 (프로젝트 루트 → workspace 루트 순으로 탐색)
function loadEnv() {
  const candidates = [
    path.join(__dirname, '.env'),
    path.join(__dirname, '../../.env'),   // my-dev-workspace/.env
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      const lines = fs.readFileSync(p, 'utf8').split('\n');
      for (const line of lines) {
        const m = line.match(/^([^#=\s]+)\s*=\s*(.+)$/);
        if (m) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
      }
      return p;
    }
  }
  return null;
}

const envFile = loadEnv();
const ADMIN_KEY = process.env.ANTHROPIC_ADMIN_KEY;
const MONTHLY_BUDGET_USD = parseFloat(process.env.CLAUDE_MONTHLY_BUDGET_USD || '0');

// ─── 날짜 헬퍼 ───────────────────────────────────────────────────────────────
function toISOString(d) {
  return d.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function getMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    starting_at: toISOString(start),
    ending_at: toISOString(now),
  };
}

// ─── API 호출 ────────────────────────────────────────────────────────────────
function apiGet(apiPath) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.anthropic.com',
      path: apiPath,
      method: 'GET',
      headers: {
        'x-api-key': ADMIN_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        if (res.statusCode === 200) {
          try { resolve(JSON.parse(data)); }
          catch { reject(new Error('JSON 파싱 실패')); }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

// ─── 사용량 집계 ─────────────────────────────────────────────────────────────
async function fetchUsage() {
  const { starting_at, ending_at } = getMonthRange();
  const qs = new URLSearchParams({
    starting_at,
    ending_at,
    bucket_width: '1d',
  });

  const usageData = await apiGet(`/v1/organizations/usage_report/messages?${qs}`);
  const costData  = await apiGet(`/v1/organizations/cost_report?${qs}`).catch(() => null);

  let inputTokens = 0, outputTokens = 0, cacheRead = 0, cacheCreate = 0;
  for (const bucket of (usageData.data || [])) {
    const u = bucket.usage || bucket;
    inputTokens  += u.input_tokens              || 0;
    outputTokens += u.output_tokens             || 0;
    cacheRead    += u.cache_read_input_tokens   || 0;
    cacheCreate  += u.cache_creation_input_tokens || 0;
  }

  let totalCost = 0;
  if (costData?.data) {
    for (const bucket of costData.data) {
      totalCost += bucket.total_cost || 0;
    }
  }

  return { inputTokens, outputTokens, cacheRead, cacheCreate, totalCost };
}

// ─── 터미널 출력 ─────────────────────────────────────────────────────────────
function progressBar(pct, width = 30) {
  const filled = Math.round((pct / 100) * width);
  const bar = '█'.repeat(filled) + '░'.repeat(width - filled);
  return `[${bar}] ${pct.toFixed(1)}%`;
}

function formatNumber(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`;
  return `${n}`;
}

async function main() {
  const CYAN  = '\x1b[36m';
  const GREEN = '\x1b[32m';
  const YELLOW= '\x1b[33m';
  const RED   = '\x1b[31m';
  const BOLD  = '\x1b[1m';
  const RESET = '\x1b[0m';

  console.log(`\n${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}`);
  console.log(`${BOLD}  Claude API 사용량 — ${new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' })}${RESET}`);
  console.log(`${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}\n`);

  if (!ADMIN_KEY) {
    console.error(`${RED}✗ ANTHROPIC_ADMIN_KEY 가 없습니다.${RESET}`);
    console.log(`\n설정 방법:`);
    console.log(`  1. Anthropic Console → API Keys → Admin Key 생성`);
    console.log(`     https://console.anthropic.com/settings/admin-keys`);
    const targetEnv = path.join(__dirname, '../../.env');
    console.log(`  2. ${targetEnv} 에 추가:`);
    console.log(`     ${YELLOW}ANTHROPIC_ADMIN_KEY=sk-ant-admin...${RESET}`);
    console.log(`  3. 선택) 월 예산 설정:`);
    console.log(`     ${YELLOW}CLAUDE_MONTHLY_BUDGET_USD=10${RESET}\n`);
    process.exit(1);
  }

  console.log(`${CYAN}⏳ 데이터 불러오는 중...${RESET}`);

  try {
    const u = await fetchUsage();
    const totalTokens = u.inputTokens + u.outputTokens;

    // 토큰 현황
    console.log(`\n${BOLD}[ 토큰 ]${RESET}`);
    console.log(`  입력 (input)       ${CYAN}${formatNumber(u.inputTokens)}${RESET}`);
    console.log(`  출력 (output)      ${CYAN}${formatNumber(u.outputTokens)}${RESET}`);
    if (u.cacheRead || u.cacheCreate) {
      console.log(`  캐시 읽기          ${CYAN}${formatNumber(u.cacheRead)}${RESET}`);
      console.log(`  캐시 생성          ${CYAN}${formatNumber(u.cacheCreate)}${RESET}`);
    }
    console.log(`  ─────────────────────────────`);
    console.log(`  합계               ${BOLD}${CYAN}${formatNumber(totalTokens)}${RESET}`);

    // 비용 현황
    console.log(`\n${BOLD}[ 비용 ]${RESET}`);
    const costColor = u.totalCost > 5 ? RED : u.totalCost > 2 ? YELLOW : GREEN;
    console.log(`  이번 달 합계       ${BOLD}${costColor}$${u.totalCost.toFixed(4)}${RESET}`);

    // 예산 대비 프로그레스 바
    if (MONTHLY_BUDGET_USD > 0) {
      const pct = Math.min((u.totalCost / MONTHLY_BUDGET_USD) * 100, 100);
      const barColor = pct > 80 ? RED : pct > 50 ? YELLOW : GREEN;
      console.log(`\n${BOLD}[ 예산 진행률 — $${MONTHLY_BUDGET_USD}/월 ]${RESET}`);
      console.log(`  ${barColor}${progressBar(pct)}${RESET}  ($${u.totalCost.toFixed(2)} / $${MONTHLY_BUDGET_USD})`);
    }

    console.log(`\n${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}`);
    console.log(`  자세히: https://console.anthropic.com/usage`);
    console.log(`  갱신 시간: ${new Date().toLocaleTimeString('ko-KR')}`);
    console.log(`${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}\n`);

  } catch (err) {
    console.error(`\n${RED}✗ 오류: ${err.message}${RESET}`);
    if (err.message.includes('403') || err.message.includes('401')) {
      console.log(`\n${YELLOW}Admin API 키를 확인하세요. 일반 API 키(sk-ant-api...)로는 조직 사용량 조회가 불가합니다.${RESET}`);
      console.log(`Admin 키 발급: https://console.anthropic.com/settings/admin-keys`);
    }
    process.exit(1);
  }
}

main();
