/* index.html 안의 <script type="module"> 을 뽑아 문법 + 끊어진 참조를 검사한다.
 *
 *   node tools/check.mjs
 *
 * 왜 필요한가: 이 프로젝트는 단일 HTML이라 `node --check index.html` 이 안 된다
 * (ERR_UNKNOWN_FILE_EXTENSION). 그리고 문법 검사만으로는 **삭제한 함수를 아직
 * 호출하고 있는 것**을 못 잡는다 — 화면을 갈아엎을 때 가장 자주 나는 사고다.
 * 그래서 선언되지 않은 채 호출되는 이름을 따로 훑는다.
 */
import { readFile, writeFile, mkdtemp } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const run = promisify(execFile);
const SRC = process.argv[2] || 'index.html';

/* 브라우저·JS 기본 제공 이름 — 여기 없는 게 호출되면 우리가 만든 것이어야 한다.
   빠진 게 있어 오탐이 나면 여기 추가하면 된다(오탐이 나도 검사는 계속 돈다). */
const GLOBALS = new Set(`
Array Boolean Date Error JSON Map Math Number Object Promise Proxy Reflect RegExp Set String Symbol WeakMap WeakSet
BigInt Intl URL URLSearchParams TextEncoder TextDecoder AbortController Blob FormData Headers Request Response
parseInt parseFloat isNaN isFinite encodeURIComponent decodeURIComponent encodeURI decodeURI structuredClone fetch
setTimeout clearTimeout setInterval clearInterval requestAnimationFrame cancelAnimationFrame queueMicrotask
alert confirm prompt console document window navigator location history localStorage sessionStorage screen
getComputedStyle matchMedia atob btoa crypto performance Audio Image Event CustomEvent MutationObserver
addEventListener removeEventListener dispatchEvent scrollTo scrollBy open close focus blur print
IntersectionObserver ResizeObserver DOMParser Notification Worker
if for while switch catch return typeof instanceof new delete void yield await function class super this
async of in
rgba rgb hsl hsla var calc url linear-gradient radial-gradient conic-gradient gradient
translate translateX translateY translateZ translate3d scale scaleX scaleY rotate skew matrix
blur brightness saturate drop-shadow cubic-bezier steps clamp min max minmax repeat attr counter
`.trim().split(/\s+/));

const html = await readFile(SRC, 'utf8');
const m = html.match(/<script type="module">([\s\S]*?)<\/script>/);
if (!m){ console.error('✕ <script type="module"> 를 못 찾았습니다'); process.exit(1); }
const js = m.group ?? m[1];

/* ── 1) 문법 ────────────────────────────────────────────── */
const dir = await mkdtemp(join(tmpdir(), 'pg-check-'));
const file = join(dir, 'bundle.mjs');
await writeFile(file, js, 'utf8');

let ok = true;
try {
  await run(process.execPath, ['--check', file]);
  console.log('✔ 문법 OK');
} catch (e) {
  ok = false;
  console.log('✕ 문법 오류');
  // node --check 는 임시 bundle.mjs 기준 줄번호를 준다 → 원본 줄번호로 옮겨준다
  const offset = html.slice(0, m.index).split('\n').length;
  console.log(String(e.stderr || e.message)
    .split(dir + '\\').join('').split(dir + '/').join('')      // 임시 경로 제거
    .replace(/bundle\.mjs:(\d+)/g, (_, n) => `${SRC}:${Number(n) + offset - 1}`)
    .split('\n').slice(0, 10).join('\n'));
}

/* ── 2) 끊어진 참조 ─────────────────────────────────────── */
// ⚠️ 주석만 걷어낸다. 문자열까지 지우면 따옴표 짝이 어긋나는 순간
//    코드 뭉텅이가 함께 사라져 **호출부를 놓친다**(검사기가 조용해지는 게 제일 나쁘다).
//    문자열 안에서 딸려 오는 오탐은 위 GLOBALS 의 CSS 함수 목록으로 거른다.
const code = js
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

// ⚠️ 선언은 **원본**에서 모은다. 위에서 문자열을 걷어낸 code 로 모으면
//    템플릿 리터럴 안의 따옴표 짝이 어긋나면서 선언부까지 통째로 지워진다.
//    (주석 안의 선언이 섞여 들어와도 경고 하나 덜 뜰 뿐이라 안전한 방향이다.)
const declared = new Set();
for (const re of [
  /\bfunction\s*\*?\s+([A-Za-z_$][\w$]*)/g,
  /\bclass\s+([A-Za-z_$][\w$]*)/g,
  /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g,
  /\bimport\s*\{([^}]*)\}/g,
  /\b(?:const|let|var)\s*\{([^}]*)\}/g,   // 구조분해
  /\(([^()]*)\)\s*=>/g,                   // 화살표 매개변수 — 콜백으로 받은 걸 호출하는 경우
  /([A-Za-z_$][\w$]*)\s*=>/g,             // 괄호 없는 화살표 매개변수
  /\bfunction\s*\*?\s*[\w$]*\s*\(([^()]*)\)/g,
]) for (const d of js.matchAll(re)) {
  for (const name of d[1].split(',')) {
    const n = name.split(/\s+as\s+/).pop().split(':').pop().replace(/=[\s\S]*/, '').trim();
    if (n) declared.add(n);
  }
}

const missing = new Map();
for (const c of code.matchAll(/([.\w$]?)\b([A-Za-z_$][\w$]*)\s*\(/g)) {
  const [, prev, name] = c;
  if (prev === '.') continue;                       // 메서드 호출
  if (GLOBALS.has(name) || declared.has(name)) continue;
  missing.set(name, (missing.get(name) || 0) + 1);
}

if (missing.size) {
  ok = false;
  console.log('\n✕ 선언 없이 호출되는 이름 — 지운 함수를 아직 부르고 있진 않은지 확인하세요');
  for (const [name, n] of [...missing].sort((a, b) => b[1] - a[1]))
    console.log(`   ${name}  ${n}곳`);
} else {
  console.log('✔ 끊어진 참조 없음');
}

/* ── 3) 안 쓰는 헬퍼(지우고 남은 껍데기) ─────────────────── */
const dead = [...declared].filter(n =>
  /^[a-z]/.test(n) && n.length > 3 &&
  (code.match(new RegExp(`\\b${n}\\b`, 'g')) || []).length === 1);
if (dead.length) console.log('\n· 한 번만 나오는 이름(죽은 코드일 수 있음):', dead.join(', '));

process.exit(ok ? 0 : 1);
