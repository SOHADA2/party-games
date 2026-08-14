/* Edge 헤드리스로 화면을 찍거나 DOM을 떠온다.
 *
 *   node tools/shot.mjs "/_demo.html?demo=1&v=grill"                 → Temp에 png
 *   node tools/shot.mjs "/_demo.html?demo=1&v=vote" -o vote.png -w 440 -h 1700
 *   node tools/shot.mjs --dom "/_t.html?demo=1"                      → <title> 출력
 *   node tools/shot.mjs --grid brief,grill,vote                      → 여러 화면 한 장에
 *
 * ⚠️ 이 PC에서 실패했던 것들 — 플래그를 지우지 말 것
 *   · `--no-sandbox --user-data-dir=<새 폴더>` 를 빼면 **그냥 멈춘다**(프로필 잠금).
 *     "스크린샷이 안 된다"의 정체는 대부분 이것이었다.
 *   · 출력 png 는 **Temp** 에 쓴다. 스크래치패드는 쓰기 거부(0x5).
 *   · file:// 로 열면 안 된다. serve.mjs 를 띄우고 **localhost** 로 연다.
 *     (하네스와 대상이 다른 출처면 가상시간이 전파되지 않아 애니메이션 도중에 찍힌다.)
 *   · 모바일 폭 스샷의 **우측 잘림은 캡처 아티팩트**다. 실제 오버플로가 아니다.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile, rm, readFile, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const run = promisify(execFile);
const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(n); return i < 0 ? d : args[i + 1]; };
const has  = n => args.includes(n);

const PORT = flag('-p', '8080');
const W = flag('-w', '420'), H = flag('-h', '1600');
const TMP = tmpdir();

/* 브라우저 위치는 기기마다 다르다 — 윈도우 Edge / 맥·리눅스 크롬 계열을 순서대로 본다.
   ⚠️ 플래그는 크로미움 공통이라 어느 것이 잡혀도 아래 실행부는 그대로 돈다. */
const CANDIDATES = [
  process.env.EDGE, process.env.CHROME,
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/microsoft-edge', '/usr/bin/google-chrome', '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean);
/* 리눅스 컨테이너(원격 세션)에는 Playwright 크로미움만 있는 경우가 많다 */
try{
  const { readdir } = await import('node:fs/promises');
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  for (const d of await readdir(root))
    if (/^chromium-/.test(d)) CANDIDATES.push(join(root, d, 'chrome-linux', 'chrome'));
}catch{}

let EDGE = null;
for (const c of CANDIDATES){ try{ await access(c); EDGE = c; break; }catch{} }
if (!EDGE){
  console.error('✕ 브라우저를 못 찾았습니다. EDGE 또는 CHROME 환경변수로 경로를 주세요.');
  console.error('  찾아본 곳: ' + CANDIDATES.join(', '));
  process.exit(1);
}

/* 서버가 떠 있는지 먼저 본다 — 안 떠 있으면 헤드리스가 빈 화면을 찍는다 */
try{ await fetch(`http://localhost:${PORT}/`); }
catch{ console.error(`✕ http://localhost:${PORT} 응답 없음 — 먼저 \`node serve.mjs ${PORT}\` 를 띄우세요.`); process.exit(1); }

async function edge(url, extra){
  const ud = join(TMP, 'pg-edge-' + Math.random().toString(36).slice(2, 8));
  try{
    await run(EDGE, [
      '--headless=new', '--disable-gpu', '--no-sandbox', `--user-data-dir=${ud}`,
      '--hide-scrollbars', `--window-size=${W},${H}`, '--virtual-time-budget=7000',
      ...extra, url,
    ], { maxBuffer: 64 * 1024 * 1024, timeout: 120000 });
  } finally { await rm(ud, { recursive:true, force:true }).catch(()=>{}); }
}

/* ── DOM 떠오기 (E2E 결과를 <title> 로 받는 용도) ── */
if (has('--dom')){
  const path = args[args.indexOf('--dom') + 1];
  const out = join(TMP, 'pg-dom.html');
  // --dump-dom 은 stdout 으로 나오므로 edge() 헬퍼(스크린샷용) 대신 직접 돌린다
  const ud = join(TMP, 'pg-edge-dom');
  await rm(ud, { recursive:true, force:true }).catch(()=>{});
  const { stdout } = await run(EDGE, [
    '--headless=new', '--disable-gpu', '--no-sandbox', `--user-data-dir=${ud}`,
    // ⚠️ 시나리오에 연출(윷 던지기 등)이 있으면 9초로는 모자라 중간에 잘린다
    '--virtual-time-budget=20000', '--dump-dom', `http://localhost:${PORT}${path}`,
  ], { maxBuffer: 64 * 1024 * 1024, timeout: 120000 });
  await writeFile(out, stdout, 'utf8');
  await rm(ud, { recursive:true, force:true }).catch(()=>{});
  const t = stdout.match(/<title>([\s\S]*?)<\/title>/);
  console.log(t ? t[1].split(' ## ').join('\n') : '(title 없음) → ' + out);
  /* ⚠️ 판정에 「문제」 같은 **평범한 낱말**을 넣지 말 것.
     예전엔 /문제|ERR |‼/ 였는데, 초성 퀴즈처럼 라벨에 "문제"가 들어가는 시나리오가
     들어오자 **전부 통과인데도 exit 1** 이 됐다. 시나리오 쪽은 v0.12.0에 같은 이유로
     이미 고쳤는데 여기가 남아 있었다. 판정은 시나리오가 찍는 표시로만 한다:
     `‼`(실패 건수 요약) · `✕FAIL`(항목 실패) · 맨 앞의 `ERR `(예외). */
  /* ⚠️ 「아무 표시도 없음」을 통과로 보면 안 된다.
     사본이 깨져 시나리오가 통째로 안 돌면 <title> 이 앱 기본값 그대로인데,
     예전엔 그걸 exit 0 으로 넘겼다 — 제일 나쁜 실패다(다 통과한 줄 안다).
     시나리오는 끝에 반드시 ✅ 또는 ‼ 를 찍는다. 둘 다 없으면 안 돈 것이다. */
  const title = t?.[1] || '';
  if (/^ERR |‼|✕FAIL/.test(title)) process.exit(1);
  if (!title.includes('✅')){
    console.error('✕ 시나리오가 실행되지 않았습니다(합격 표시 없음).');
    console.error('  사본이 깨졌을 수 있습니다 → node tools/check.mjs <사본.html>');
    process.exit(1);
  }
  process.exit(0);
}

/* ── 여러 화면을 한 장에 (같은 출처에서 iframe 으로 나란히) ── */
if (has('--grid')){
  const views = (args[args.indexOf('--grid') + 1] || '').split(',').filter(Boolean);
  const file = flag('-f', '_demo.html');
  const harness = `_grid.html`;   // _*.html 이라 gitignore 된다
  await writeFile(harness, `<!doctype html><meta charset="utf-8"><style>
body{margin:0;background:#0B0713;display:flex;gap:10px;font-family:system-ui,sans-serif}
figure{margin:0}figcaption{color:#fff;font:700 13px system-ui;padding:5px 2px}
iframe{width:${W}px;height:${H}px;border:0;background:#0B0713}</style>
${views.map(v => `<figure><figcaption>${v}</figcaption><iframe src="/${file}?demo=1&v=${v}"></iframe></figure>`).join('')}`, 'utf8');
  const out = flag('-o', join(TMP, 'pg-grid.png'));
  await edge(`http://localhost:${PORT}/${harness}`, [`--screenshot=${out}`, `--window-size=${views.length * (Number(W) + 10)},${Number(H) + 40}`]);
  console.log('✔', out);
  process.exit(0);
}

/* ── 화면 한 장 ── */
const path = args.find(a => a.startsWith('/'));
if (!path){ console.error('사용법: node tools/shot.mjs "/_demo.html?demo=1&v=grill" [-o out.png] [-w 420] [-h 1600]'); process.exit(1); }
const out = flag('-o', join(TMP, 'pg-shot.png'));
await edge(`http://localhost:${PORT}${path}`, [`--screenshot=${out}`]);
console.log('✔', out);
