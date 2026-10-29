// .env.local + .env.brain.local을 읽어 키를 확인하고 service role 클라이언트를 만든다.
// 값은 어떤 출력·에러 메시지에도 넣지 않는다. 키 이름과 파일 경로만 쓴다.
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

export const REPO_ROOT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../..'
);
export const MIN_SECRET_BYTES = 32;

// 키마다 들어 있어야 할 파일과 안내 문구
const KEY_SPECS = {
  NEXT_PUBLIC_SUPABASE_URL: {
    file: '.env.local',
    hint: 'Supabase 대시보드 → Project Settings → API의 Project URL을 추가하세요.',
  },
  SUPABASE_SERVICE_ROLE_KEY: {
    file: '.env.brain.local',
    hint: 'Supabase 대시보드 → Project Settings → API Keys의 service_role(secret) 키를 추가하세요.',
  },
  SITE_URL: {
    file: '.env.brain.local',
    hint: '블로그 주소(https://...)를 추가하세요.',
  },
  REVALIDATE_SECRET: {
    file: '.env.brain.local',
    hint: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"로 만든 값을 추가하고 Vercel에도 같은 값을 넣으세요.`,
  },
};

/** KEY=VALUE 줄을 파싱한다. 파일이 없으면 빈 객체 */
export function parseEnvFile(path) {
  let text;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    return {};
  }
  const env = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line
      .slice(0, eq)
      .replace(/^export\s+/, '')
      .trim();
    let value = line.slice(eq + 1).trim();
    if (/^(['"]).*\1$/.test(value)) value = value.slice(1, -1);
    env[key] = value;
  }
  return env;
}

function isAllowedSiteUrl(value) {
  let u;
  try {
    u = new URL(value);
  } catch {
    return false;
  }
  if (u.protocol === 'https:') return true;
  return u.protocol === 'http:' && u.hostname === 'localhost';
}

/**
 * 필요한 키를 각 파일에서 읽는다. 하나라도 없거나 형식이 틀리면 errors에 안내 문구를 담는다.
 * @param {string[]} keys
 * @param {string} [root] 환경 파일이 있는 폴더 (기본: 저장소 루트)
 * @returns {{ values: Record<string, string>, errors: string[] }}
 */
export function loadEnv(keys, root = REPO_ROOT) {
  const files = new Map();
  const values = {};
  const errors = [];
  for (const key of keys) {
    const spec = KEY_SPECS[key];
    const path = join(root, spec.file);
    if (!files.has(path)) files.set(path, parseEnvFile(path));
    const value = files.get(path)[key];
    if (!value) {
      errors.push(`${key}가 ${path}에 없습니다. ${spec.hint}`);
      continue;
    }
    values[key] = value;
  }
  if (values.SITE_URL && !isAllowedSiteUrl(values.SITE_URL)) {
    errors.push(
      `SITE_URL(${join(root, KEY_SPECS.SITE_URL.file)})은 https:// 주소여야 합니다(http://localhost만 예외).`
    );
  }
  if (
    values.REVALIDATE_SECRET &&
    Buffer.byteLength(values.REVALIDATE_SECRET) < MIN_SECRET_BYTES
  ) {
    errors.push(
      `REVALIDATE_SECRET(${join(root, KEY_SPECS.REVALIDATE_SECRET.file)})이 너무 짧습니다. ${KEY_SPECS.REVALIDATE_SECRET.hint}`
    );
  }
  return { values, errors };
}

/** service role 클라이언트. publishable key로 넘어가지 않는다 */
export function createServiceClient(values) {
  return createClient(
    values.NEXT_PUBLIC_SUPABASE_URL,
    values.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

/** Supabase 응답에서 error가 있으면 던진다 (data를 삼키지 않음) */
export function unwrap({ data, error }, what) {
  if (error) throw new Error(`${what}: ${error.message}`);
  return data;
}

/** SITE_URL로 재검증 엔드포인트를 부른다. 헤더는 어디에도 찍지 않는다 */
export async function callRevalidate(values) {
  const url = new URL('/api/revalidate', values.SITE_URL);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${values.REVALIDATE_SECRET}` },
      redirect: 'error',
    });
    return { ok: res.ok, status: res.status };
  } catch (err) {
    return { ok: false, status: 0, message: err.message };
  }
}
