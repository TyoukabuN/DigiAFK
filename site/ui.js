'use strict';
(() => {
  const G=DigitalGame, $=id=>document.getElementById(id);
  const key='digital-field-campaign-v1';
  let state, raw, invalid=false, page='adventure', screen='title', paused=false, timer, selected;
  let storageAvailable=true;
  try {
    raw=localStorage.getItem(key);
    state=G.load(raw);
    invalid=raw!==null&&!state;
  } catch { storageAvailable=false; }
  const notice=text=>{$('notice').textContent=text;};
  const btn=(action,value,label,disabled=false)=>
    '<button class="btn small" data-action="'+action+'" data-value="'+value+'"'+(disabled?' disabled':'')+'>'+label+'</button>';
  const spriteMap={agumon:'agumon',palmon:'palmon',gabumon:'gabumon',elecmon:'elecmon',betamon:'betamon'};
  const art=id=>spriteMap[id]?'<img class="art" alt="" src="assets/digimon/'+spriteMap[id]+'.png">':
    '<span class="art placeholder" aria-hidden="true">◇</span>';
  const name=uid=>G.dex[state.mons[uid].id].name;
  const label=uid=>name(uid)+' · Lv.'+state.mons[uid].level+(state.mons[uid].shiny?' ✦':'');
  function persist(now=Date.now()) {
    state.savedAt=Math.max(state.savedAt,now);
    try {
      raw=G.serialize(state);
      localStorage.setItem(key,raw);
      $('saveStatus').textContent='已保存在当前浏览器。';
    } catch { $('saveStatus').textContent='浏览器无法保存进度。'; }
  }
  function reloadExternalSave(latest) {
    clearInterval(timer);
    screen='title';
    raw=latest;
    state=G.load(raw);
    invalid=raw!==null&&!state;
    $('saveStatus').textContent='其他标签页已更新存档。点击继续前，请先关闭另一个游戏标签页。';
    render();
  }
  function isCurrentSave() {
    try {
      const latest=localStorage.getItem(key);
      if (latest===raw) return true;
      reloadExternalSave(latest);
      return false;
    } catch { return true; }
  }
  window.addEventListener('storage',event=>{
    if (event.key!==key || event.newValue===raw) return;
    reloadExternalSave(event.newValue);
  });
  function render() {
    $('title-screen').hidden=screen!=='title';
    $('continue').hidden=!state;
    $('starter').hidden=screen!=='starter';
    $('game').hidden=screen!=='game';
    if (screen!=='game') return;
    $('summary').textContent='图鉴 '+state.seen.length+' / 70 · '+state.coins+' 数码币';
    document.querySelectorAll('[data-page]').forEach(el=>{el.hidden=el.id!==page;});
    document.querySelectorAll('[data-tab]').forEach(el=>el.setAttribute('aria-pressed',el.dataset.tab===page));
    if (page==='adventure') adventure();
    if (page==='team') team();
    if (page==='dex') dex();
    if (page==='shop') shop();
    if (page==='pension') pension();
    if (page==='activities') activities();
  }
  function fighter(id,title,level,health) {
    return art(id)+'<strong>'+title+'</strong><br><small>Lv.'+level+' · HP '+health+'</small>';
  }
  function adventure() {
    const s=state,b=s.battle,mon=s.mons[s.team[s.lead]],boss=G.bosses[s.cleared.length];
    $('campaign-complete').hidden=!s.cleared.includes('apocalymon');
    $('scene').classList.toggle('river',s.route%2===0);
    $('ally').innerHTML=fighter(mon.id,G.dex[mon.id].name,mon.level,b?.allyHp??G.hp(mon));
    $('enemy').innerHTML=b?fighter(b.id,b.name,b.level,b.hp):'<small>搜寻踪迹中…</small>';
    $('routes').innerHTML=G.routes.map((r,i)=>btn('route',i,r+' '+s.routeWins[i]+'/3',i>s.cleared.length||i===s.route||!!b)).join('');
    $('boss').textContent=boss?'挑战 '+boss.name:'主线已通关';
    $('boss').disabled=!boss||s.routeWins[s.cleared.length]<3||(b&&b.kind!=='wild');
    $('pause').textContent=paused?'继续':'暂停';
    document.querySelectorAll('[data-speed]').forEach(el=>el.setAttribute('aria-pressed',Number(el.dataset.speed)===s.speed));
  }
  function evolutions(uid) {
    const mon=state.mons[uid];
    const form=G.dex[mon.id], level=[6,9,15,28][form.stage];
    return form.next.map(id=>btn('evolve',uid+':'+id,
      G.dex[id].name+' · Lv.'+level+(form.stage===3?' + 芯片':''),
      !!state.battle||mon.level<level||(form.stage===3&&!(state.bag['evolution-chip']>0)))).join(' ');
  }
  function team() {
    const s=state, q=$('box-search').value.trim().toLowerCase(), order=$('box-order').value;
    $('presets').innerHTML=s.presets.map((ids,i)=>btn('preset',i,(ids?'读取 ':'保存 ')+(i+1),!!s.battle)).join('');
    $('team-list').innerHTML=Array.from({length:6},(_,i)=>{
      const uid=s.team[i];
      return '<div class="entry">'+(uid?btn('select',uid,(selected===uid?'✓ ':'')+label(uid))+' '+evolutions(uid):'空槽')+'</div>';
    }).join('')+(s.swap?'<p>已排队，等待战斗结算。</p>':'');
    const ids=s.box.filter(uid=>name(uid).toLowerCase().includes(q)).reverse();
    if (order==='level') ids.sort((a,b)=>s.mons[b].level-s.mons[a].level);
    if (order==='name') ids.sort((a,b)=>name(a).localeCompare(name(b),'zh-CN'));
    $('box').innerHTML=ids.map(uid=>'<div class="entry">'+btn('swap',uid,label(uid),!selected)+' '+evolutions(uid)+'</div>').join('')||'<p>没有符合条件的伙伴。</p>';
  }
  function dex() {
    const q=$('dex-search').value.trim().toLowerCase(), mode=$('dex-filter').value;
    const owned=new Set(Object.values(state.mons).map(mon=>mon.id));
    $('dex-list').innerHTML=Object.entries(G.dex).filter(([id,d])=>
      (d.name.toLowerCase().includes(q)||id.includes(q))&&
      (mode==='all'||(mode==='owned'&&owned.has(id))||(mode==='seen'&&state.seen.includes(id))||
      (mode==='found'&&state.discovered.includes(id))||(mode==='missing'&&!state.seen.includes(id))))
      .map(([id,d])=>'<details class="entry"><summary>'+d.name+' · Ver.'+d.version+' · '+
        (owned.has(id)?'持有':state.seen.includes(id)?'曾收录':state.discovered.includes(id)?'已见过':'未收录')+
        '</summary><p>'+['幼年期 I','幼年期 II','成长期','成熟期','完全体'][d.stage]+
        ' · 进化：'+(d.next.map(next=>G.dex[next].name).join('、')||'无')+'</p></details>').join('');
  }
  function shop() {
    $('shop-list').innerHTML=Object.entries(G.items).map(([id,item])=>
      '<div class="entry">'+item.name+' · '+item.price+' 数码币 · 持有 '+(state.bag[id]??0)+' '+
      btn('buy',id,'购买',state.cleared.length<item.gate||state.coins<item.price)+
      (id==='ration'?btn('use',id,'使用',!(state.bag[id]>0&&state.battle)):'')+'</div>').join('');
  }
  function pension() {
    const s=state;
    $('pension-list').innerHTML=(s.boarded?'<p>寄放中：'+label(s.boarded.uid)+' '+btn('take','0','取回')+'</p>':
      '<p>从仓库选择伙伴寄放，可获得经验并孵化同版本幼年体。</p>'+s.box.map(uid=>btn('board',uid,label(uid),!!s.egg)).join(' '))+
      (s.egg?'<p>孵化器：'+G.dex[s.egg.id].name+' · '+new Date(s.egg.at).toLocaleString()+' '+
       btn('egg','0','领取',Date.now()<s.egg.at)+'</p>':'');
  }
  function activities() {
    $('activity-list').innerHTML=Object.entries(G.activities).map(([id,a])=>
      '<div class="entry">'+(id==='casino'?
        btn('casino','slots','老虎机 · 10 数码币',state.cleared.length<a.gate)+
        btn('casino','pachinko','弹珠 · 2 代币',state.cleared.length<a.gate)+
        ' · 代币 '+(state.bag.token??0):btn('activity',id,a.name,state.cleared.length<a.gate))+
      ' · 完成 '+(state.records[id]??0)+(state.cleared.length<a.gate?' · 需击败 '+a.gate+' 位主线首领':'')+'</div>').join('');
  }
  function record(text) {
    const row=document.createElement('div');
    row.textContent=text;
    $('log').prepend(row);
    if ($('log').children.length>30) $('log').lastElementChild.remove();
  }
  function schedule() {
    clearInterval(timer);
    if (paused||screen!=='game') return;
    timer=setInterval(()=>{
      if ((page!=='adventure'&&!state.battle)||!isCurrentSave()) return;
      const now=Date.now();
      record(G.step(state,Math.random,now));
      G.pension(state,now);
      persist(now);
      if (page==='adventure') render();
      else $('summary').textContent='图鉴 '+state.seen.length+' / 70 · '+state.coins+' 数码币';
    },1100/state.speed);
  }
  function enter(resume) {
    screen='game';
    page='adventure';
    paused=false;
    selected=null;
    const now=Date.now();
    if (resume) {
      const report=G.catchUp(state,now);
      if (report.elapsed>=60000) record('离线结算 · '+Math.floor(report.elapsed/60000)+' 分钟 · +'+report.coins+' 数码币');
    }
    persist(now);
    render();
    schedule();
  }
  $('choices').innerHTML=G.starters.map(id=>btn('starter',id,art(id)+G.dex[id].name)).join('');
  $('new-game').onclick=()=>{screen='starter';render();};
  $('back-title').onclick=()=>{screen='title';render();};
  $('continue').onclick=()=>{if(state&&isCurrentSave()) enter(true);};
  $('box-search').oninput=team;
  $('box-order').onchange=team;
  $('dex-search').oninput=dex;
  $('dex-filter').onchange=dex;
  document.querySelector('#game').addEventListener('click',event=>{
    const button=event.target.closest('button');
    if (!button||button.disabled) return;
    if (button.dataset.tab) {page=button.dataset.tab;notice('');render();return;}
    if (!isCurrentSave()) return;
    if (button.dataset.speed) state.speed=Number(button.dataset.speed);
    else if (button.id==='pause') paused=!paused;
    else if (button.id==='boss') {
      if (state.battle?.kind==='wild') G.recover(state);
      if (G.challenge(state,G.bosses[state.cleared.length]?.id)) {paused=false;record('首领挑战开始');}
    } else {
      const {action,value}=button.dataset;
      let ok=true;
      if (action==='route') ok=G.travel(state,Number(value));
      else if (action==='select') selected=value;
      else if (action==='swap') {
        ok=G.queueSwap(state,selected,value);
        if (ok&&!state.battle) G.recover(state);
        selected=null;
      } else if (action==='preset') ok=G.preset(state,Number(value),!state.presets[value]);
      else if (action==='evolve') ok=G.evolve(state,...value.split(':'));
      else if (action==='buy') ok=G.buy(state,value);
      else if (action==='use') ok=G.use(state,value);
      else if (action==='board') ok=G.board(state,value,Date.now());
      else if (action==='take') ok=G.takeBack(state);
      else if (action==='egg') ok=G.claimEgg(state,Date.now());
      else if (action==='casino') notice(G.casino(state,value).message);
      else if (action==='activity') {
        const result=G.activity(state,value);
        notice(result.message);
        if (result.ok&&state.battle) {page='adventure';paused=false;record(result.message);}
      } else return;
      if (action!=='activity'&&action!=='casino') notice(ok?'':'当前条件未满足，请在战斗结算后重试或检查所需等级。');
    }
    persist();
    render();
    schedule();
  });
  $('choices').addEventListener('click',event=>{
    const id=event.target.closest('button')?.dataset.value;
    if (!G.starters.includes(id)||!isCurrentSave()||((state||invalid)&&!confirm('新建冒险会覆盖当前存档。继续吗？'))) return;
    state=G.create(id,Date.now());
    enter(false);
  });
  if (invalid||!storageAvailable) $('saveStatus').textContent='存档无法读取或浏览器禁用了存储。';
  render();
})();
