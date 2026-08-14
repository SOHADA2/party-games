/* 노래 맞히기 화면 스냅샷 — ?demo=1&v=setup|run|reveal|done */
if (new URLSearchParams(location.search).has('demo')){
  const q=new URLSearchParams(location.search);
  S.pid='h1'; S.code='0000'; S.isHost=true; S.online=true;
  S.room=emptyRoom(); S.room.host='h1';
  S.room.players.h1={name:'나',joinedAt:1,seen:Date.now(),host:true};
  addBots(5);
  S.gameId='song'; act('tool-start',{});
  const v=q.get('v')||'setup';
  if(v!=='setup'){
    S.play.n=5; act('song-start',{});
    const P=playing().map(([pid])=>pid);
    act('song-hit',{pid:P[2]});
    if(v==='reveal') act('song-pass',{});
    if(v==='done'){ act('song-hit',{pid:P[1]}); act('song-pass',{}); act('song-skip',{});
      act('song-done',{}); }
  }
  render(true);
}
