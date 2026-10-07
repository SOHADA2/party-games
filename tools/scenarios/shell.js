/* 앱 셸 화면 스냅샷 — ?demo=1&v=title|enter|find|lobby|games|game|score|board|settings (&teams=1 &guest=1 &how=1) */
if (new URLSearchParams(location.search).has('demo')){
  const q=new URLSearchParams(location.search);
  const v=q.get('v')||'lobby';
  if(!['title','enter','find'].includes(v)){
    S.pid='h1'; S.code='4821'; S.isHost=!q.get('guest'); S.online=true;
    S.room=emptyRoom(); S.room.host='h1';
    S.room.players.h1={name:'나',joinedAt:1,seen:Date.now(),host:true,ch:q.get('ch')||'fox'};
    addBots(5); if(q.get('teams')) makeTeams(2);
    S.room.scores.s1={gameId:'act',mode:'solo',order:players().map(([p])=>p),weight:1,assign:{},at:1};
    S.room.scores.s2={gameId:'chosung',mode:'solo',order:players().map(([p])=>p).reverse(),weight:1,assign:{},at:2};
    S.gameId=q.get('g')||'chosung';
    /* &next=게임id → 그 게임을 고른 대기실 · &guest=1 과 같이 쓰면 참가자 화면 · &ready=1 → 내가 준비한 상태 */
    if(q.get('gname')) S.room.title=q.get('gname');
    if(q.get('next')) S.room.next={ g:q.get('next'), at:Date.now() };
    if(q.get('guest')){ S.room.players.g1={name:'손님',joinedAt:2,seen:Date.now()}; S.room.host='h1'; S.pid='g1';
      if(q.get('ready') && S.room.next) S.room.players.g1.ready=S.room.next.at; }
    /* &rule=1 → 게임마다 배점 + 경품·벌칙이 적힌 상태(설정·순위 화면 확인용) */
    if(q.get('rule')) S.room.rule={ wmode:'game', weights:{ cup:0 },
      prize:'다음 날 아침 안 차려도 됨', penalty:'설거지 담당' };
    if(v==='score'){ act('score-start',{}); }
    else S.view=v;
  }
  /* 타이틀·입장·로비는 방 밖 화면이다 — 방을 안 만들고 그 화면만 세운다 */
  if(['title','enter','find'].includes(v)) S.view = v;
  S.me = S.me || { name:'나', ch:q.get('ch') || 'fox' };
  if(q.get('nome')) S.me = null;
  if(q.get('rooms')) S.rooms = [
    { code:'4821', title:'양양 2박 3일', n:5, busy:false, last:Date.now(), chars:['fox','bear','cat','rabbit','frog'] },
    { code:'1907', title:'', n:3, busy:true, last:Date.now()-60000, chars:['penguin','otter','koala'] },
  ];
  render(true);
  /* &how=1 → 대기실의 「어떻게 하나요?」를 펼친 채로 찍는다(접힌 건 스냅샷으로 못 본다) */
  if(q.get('how')) setTimeout(()=>{ document.querySelector('.np-how')?.setAttribute('open',''); }, 50);
}
