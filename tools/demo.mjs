/* 검증용 사본(_demo.html)을 만든다 — Firebase 쓰기를 막고 시나리오를 주입한다.
 *
 *   node tools/demo.mjs tools/scenarios/crime.js            → _demo.html
 *   node tools/demo.mjs tools/scenarios/crime-e2e.js _t.html
 *
 * 그다음 serve.mjs 를 띄우고  http://localhost:8080/_demo.html?demo=1&v=grill  식으로 연다.
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

/* ── 1) firebase-database import 를 가로채 스텁으로 갈아끼운다 ── */
const STUBS = {
  set:      '() => Promise.resolve()',
  update:   '() => Promise.resolve()',
  remove:   '() => Promise.resolve()',
  push:     '() => Promise.resolve()',
  get:      '() => Promise.resolve({ val: () => null, exists: () => false })',
  onValue:  '() => () => {}',
  onDisconnect: '() => ({ set:() => Promise.resolve(), remove:() => Promise.resolve() })',
};

const impRe = /import\s*\{([^}]*)\}\s*(?:\r?\n\s*)?from\s*(["'])([^"']*firebase-database\.js)\2\s*;/;
const imp = html.match(impRe);
if (!imp){ console.error('✕ firebase-database import 를 못 찾았습니다 — tools/demo.mjs 를 고쳐야 합니다'); process.exit(1); }

const names = imp[1].split(',').map(s => s.trim()).filter(Boolean);
const keep    = names.filter(n => !(n in STUBS));
const stubbed = names.filter(n => n in STUBS);
if (!stubbed.length){ console.error('✕ 막을 쓰기 함수가 하나도 없습니다 — import 목록을 확인하세요'); process.exit(1); }

html = html.replace(impRe,
  `import { ${keep.join(', ')} } from ${imp[2]}${imp[3]}${imp[2]};\n` +
  `/* ⚠️ 검증 사본: 아래 이름들은 진짜 Firebase 대신 스텁이다. 절대 커밋하지 말 것(_*.html 은 gitignore) */\n` +
  stubbed.map(n => `const ${n} = ${STUBS[n]};`).join('\n'));

/* ── 2) 시나리오를 모듈 끝에 붙인다(부팅이 끝난 뒤 실행되도록) ── */
const tail = html.lastIndexOf('</script>');
if (tail < 0){ console.error('✕ </script> 를 못 찾았습니다'); process.exit(1); }
html = html.slice(0, tail)
  + `\n/* ══ 검증 시나리오: ${scenarioPath} ══ */\n` + scenario + '\n'
  + html.slice(tail);

await writeFile(outPath, html, 'utf8');
console.log(`✔ ${outPath} — 막은 함수: ${stubbed.join(', ')}`);
console.log(`  node serve.mjs 8080  후  http://localhost:8080/${outPath}?demo=1`);
