/* 윷놀이 화면 스냅샷 — ?demo=1&v=board|halt|phone|setup */
if (new URLSearchParams(location.search).has('demo')){
  const q=new URLSearchParams(location.search);
  S.pid='h1'; S.code='0000'; S.isHost=true; S.online=true;
  S.room=emptyRoom(); S.room.host='h1';
  S.room.players.h1={name:'나',joinedAt:1,seen:Date.now(),host:true};
  addBots(5); makeTeams(2);
  S.gameId='yut'; act('tool-start',{});
  const v=q.get('v')||'board';
  if(v!=='setup'){
    act('yut-start',{});
    S.room.yut.pieces=[[3,3,21,-1],[7,15,-1,YUT_HOME]];
    S.room.yut.log=['1팀 2칸 이동','2팀이 상대 말 1개를 잡았다!','나 — 개(2칸)'];
    if(v==='board'){ S.room.yut.roll={n:'걸',v:3,again:false,by:'h1',at:1}; }
    if(v==='halt'){ S.room.yut.halt={by:players()[1][0],team:0,at:1}; }
    if(v==='pick'){ S.room.yut.pick={team:0}; }
    if(v==='wait'){ S.room.yut.pieces=[[-1,-1,-1,-1],[7,-1,-1,-1]];
      S.room.yut.roll={n:'모',v:5,again:true,by:'h1',at:1}; }
    if(v==='phone'){ S.view='yut'; }
  }
  render(true);
}
