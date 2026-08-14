if (new URLSearchParams(location.search).has('demo')){
  const q=new URLSearchParams(location.search);
  S.pid='h1'; S.code='0000'; S.isHost=true; S.online=true;
  S.room=emptyRoom(); S.room.host='h1';
  S.room.players.h1={name:'나',joinedAt:1,seen:Date.now(),host:true};
  addBots(5);
  if(q.get('spec')){ const p=players()[1][0]; S.room.players[p].spec=true;
    S.room.players[p].name='태블릿'; }
  makeTeams(2);
  S.gameId=q.get('g')||'body'; S.view='game'; render(true);
}
