/* 검증용 사본(_demo.html)을 만든다 — Firebase 쓰기를 막고 시나리오를 주입한다.
 *
 *   node tools/demo.mjs tools/scenarios/smoke-e2e.js _s.html
 *
 * 그다음 serve.mjs 를 띄우고  http://localhost:8080/_s.html?demo=1  식으로 연다.
 *
 * ⚠️ 왜 이 도구가 필요한가
 *   검증 스크립트가 **진짜 RTDB에 방을 만들어 버린 사고**가 있었다(유령 방 4821).
 *   그래서 사본은 반드시 쓰기를 막고 열어야 한다.
 *
 * ⚠️ 왜 import 를 건드리나
 *   예전에는 set(...)/update(...) 호출부 7군데를 하나씩 패치했는데, 화면을 고칠 때마다
 *   그 문자열이 사라져 **조용히 무력화**됐다(= 진짜 DB에 쓴다). 지금은 import 한 줄만
 *   바꾸고 스텁을 심는다. 호출부가 어떻게 바뀌든 막힌다.
 */
import { readFile, writeFile } from 'node:fs/promises';

const [scenarioPath, outPath = '_demo.html', srcPath = 'index.html'] = process.argv.slice(2);
if (!scenarioPath){
  console.error('사용법: node tools/demo.mjs <시나리오.js> [출력.html] [원본.html]');
  process.exit(1);
}

let html = await readFile(srcPath, 'utf8');
const scenario = await readFile(scenarioPath, 'utf8');

/* ── 1) firebase import 를 가로채 스텁으로 갈아끼운다 ──
   ⚠️ 쓰기 함수뿐 아니라 **연결 자체**(initializeApp/getDatabase/ref)도 막는다.
      CDN이 막힌 환경(원격 컨테이너·기내 와이파이)에서는 import 가 실패하면
      `<script type="module">` 이 통째로 안 돌아 시나리오가 조용히 건너뛰어진다.
      "검사가 다 통과한 줄 알았는데 애초에 실행이 안 된 것"이 제일 나쁜 실패다. */
const STUBS = {
  initializeApp: '() => ({})',
  getDatabase:   '() => ({})',
  ref:           '(...a) => ({ _p:a.slice(1).join("/") })',
  /* ⚠️ 그냥 삼키지 않고 **무엇을 어디에 썼는지 기록**한다.
        「폰이 서버에 제대로 올렸는가」를 검사에서 확인할 수 있어야 하기 때문이다
        (네트워크 자체는 여전히 안 탄다 — 기록되는 건 앱이 보내려 한 내용이다). */
  set:      '(r, v) => { (globalThis.__W ||= []).push(["set", r && r._p, v]); return Promise.resolve(); }',
  update:   '(r, v) => { (globalThis.__W ||= []).push(["update", r && r._p, v]); return Promise.resolve(); }',
  remove:   '(r) => { (globalThis.__W ||= []).push(["remove", r && r._p]); return Promise.resolve(); }',
  push:     '() => Promise.resolve()',
  get:      '() => Promise.resolve({ val: () => null, exists: () => false })',
  onValue:  '() => () => {}',
  onDisconnect: '() => ({ set:() => Promise.resolve(), remove:() => Promise.resolve() })',
};

const impRe = /import\s*\{([^}]*)\}\s*(?:\r?\n\s*)?from\s*(["'])([^"']*\/firebase-[\w-]+\.js)\2\s*;/g;
const imps = [...html.matchAll(impRe)];
if (!imps.length){ console.error('✕ firebase import 를 못 찾았습니다 — tools/demo.mjs 를 고쳐야 합니다'); process.exit(1); }

const stubbed = [];
html = html.replace(impRe, (_, list, q, url) => {
  const names = list.split(',').map(s => s.trim()).filter(Boolean);
  const keep = names.filter(n => !(n in STUBS));
  names.filter(n => n in STUBS).forEach(n => stubbed.push(n));
  /* keep 이 남으면 import 를 살려야 하는데, 그러면 CDN 의존이 되살아난다 → 그때만 남긴다 */
  return (keep.length ? `import { ${keep.join(', ')} } from ${q}${url}${q};\n` : '')
    + `/* ⚠️ 검증 사본: 아래 이름들은 진짜 Firebase 대신 스텁이다. 절대 커밋하지 말 것(_*.html 은 gitignore) */\n`
    + names.filter(n => n in STUBS).map(n => `const ${n} = ${STUBS[n]};`).join('\n');
});
if (!stubbed.length){ console.error('✕ 막을 함수가 하나도 없습니다 — import 목록을 확인하세요'); process.exit(1); }
for (const must of ['set','update','remove','initializeApp']){
  if (!stubbed.includes(must)){
    console.error(`✕ ${must} 를 못 막았습니다 — 진짜 DB에 쓰거나 CDN에 붙습니다. 중단합니다.`);
    process.exit(1);
  }
}

/* ── 2) 시나리오를 모듈 끝에 붙인다(부팅이 끝난 뒤 실행되도록) ── */
const tail = html.lastIndexOf('</script>');
if (tail < 0){ console.error('✕ </script> 를 못 찾았습니다'); process.exit(1); }
html = html.slice(0, tail)
  + `\n/* ══ 검증 시나리오: ${scenarioPath} ══ */\n` + scenario + '\n'
  + html.slice(tail);

await writeFile(outPath, html, 'utf8');

/* ⚠️ 사본이 문법적으로 깨지면 `<script type="module">` 이 통째로 안 돈다.
   그러면 시나리오가 실행조차 안 되는데 에러도 없어서 **조용히 통과**한다.
   (실제로 시나리오에 변수 충돌을 내고도 exit 0 을 받은 적이 있다.)
   그래서 여기서 한 번 파싱해 본다. */
{
  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const { mkdtemp } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const js = html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1] || '';
  const dir = await mkdtemp(join(tmpdir(), 'pg-demo-'));
  const f = join(dir, 'bundle.mjs');
  await writeFile(f, js, 'utf8');
  try { await promisify(execFile)(process.execPath, ['--check', f]); }
  catch (e) {
    console.error(`✕ ${outPath} 가 문법적으로 깨졌습니다 — 시나리오가 아예 안 돕니다.`);
    console.error(String(e.stderr || e.message).split(/\r?\n/).slice(0, 6).join('\n'));
    process.exit(1);
  }
}

console.log(`✔ ${outPath} — 막은 함수: ${stubbed.join(', ')}`);
console.log(`  node serve.mjs 8080  후  http://localhost:8080/${outPath}?demo=1`);
