'use strict';
const DigitalGame = (() => {
  const dex = typeof module === 'undefined' ? digimonCatalog : require('./catalog.js');
  const bosses = [
    ['metalseadramon','钢铁海龙兽'], ['pinochimon','木偶兽'],
    ['mugendramon','机械邪龙兽'], ['piemon','小丑皇'], ['apocalymon','启示录兽']
  ].map(([id,name],i) => ({id,name,level:8+i*7}));
  const routes = ['海岸','森林','机械城','黑暗山麓','终末之地'];
  const items = {
    capsule:{name:'捕获胶囊 ×5',price:20,gate:0,count:5},
    'evolution-chip':{name:'进化芯片',price:40,gate:1,count:1},
    ration:{name:'回复补给',price:15,gate:0,count:1}
  };
  const activities = {
    raid:{name:'单人突袭',gate:2,level:19,reward:50},
    legend:{name:'传说遭遇',gate:3,level:24,reward:65},
    tower:{name:'战斗塔',gate:3,level:21,reward:45},
    underground:{name:'地下探索',gate:1},
    casino:{name:'赌场',gate:2},
    trade:{name:'NPC 交换',gate:2}
  };
  const hour = 3600000;
  const starters = ['agumon','palmon','gabumon'];
  const hp = mon => 22 + mon.level * 4 + dex[mon.id].stage * 5;
  const add = (s,id,level,shiny=false) => {
    const uid = 'm'+s.nextUid++;
    s.mons[uid] = {id,level,xp:0,shiny};
    (s.team.length < 6 ? s.team : s.box).push(uid);
    if (!s.seen.includes(id)) s.seen.push(id);
    return uid;
  };
  function create(id,now) {
    if (!starters.includes(id)) throw new Error('Invalid starter');
    const s = {v:1,nextUid:1,mons:{},team:[],box:[],seen:[],discovered:[],
      coins:20,bag:{capsule:20},route:0,routeWins:[0,0,0,0,0],cleared:[],
      battle:null,lead:0,swap:null,presets:[null,null,null,null,null],
      boarded:null,egg:null,records:{},savedAt:now,speed:1};
    add(s,id,5);
    return s;
  }
  function recover(s) {
    if (s.swap) {
      const [a,b] = s.swap;
      const i = s.team.indexOf(a), j = s.box.indexOf(b);
      if (i >= 0 && j >= 0) [s.team[i],s.box[j]] = [b,a];
      s.swap = null;
    }
    s.battle = null;
    s.lead = 0;
  }
  function queueSwap(s,a,b) {
    if (!s.team.includes(a) || !s.box.includes(b)) return false;
    s.swap = [a,b];
    return true;
  }
  function preset(s,index,write) {
    if (!Number.isInteger(index) || index<0 || index>=5 || s.battle) return false;
    if (write) { s.presets[index] = [...s.team]; return true; }
    const ids = s.presets[index]?.filter(uid=>s.mons[uid] && s.boarded?.uid!==uid);
    if (!ids?.length) return false;
    s.team = [...ids];
    s.box = Object.keys(s.mons).filter(uid=>!ids.includes(uid) && s.boarded?.uid!==uid);
    recover(s);
    return true;
  }
  function evolve(s,uid,target) {
    const mon = s.mons[uid], form = dex[mon?.id];
    if (!form?.next.includes(target) || mon.level < [6,9,15,28][form.stage] || s.battle) return false;
    if (form.stage===3) {
      if (!(s.bag['evolution-chip']>0)) return false;
      s.bag['evolution-chip']--;
    }
    mon.id = target;
    if (!s.seen.includes(target)) s.seen.push(target);
    return true;
  }
  function encounter(s,random,now) {
    const night = new Date(now).getHours() < 6 || new Date(now).getHours() >= 18;
    const rain = Math.floor(now/hour)%3===2;
    const pool = Object.keys(dex).filter(id => {
      const d = dex[id];
      if (d.version !== s.route+1 || d.stage < 2) return false;
      return d.stage === 2 || (d.stage === 3 && (night || rain)) || (d.stage===4 && night && rain);
    });
    const id = pool[Math.floor(random()*pool.length)];
    const level = 2+s.route*5;
    if (!s.discovered.includes(id)) s.discovered.push(id);
    s.battle = {kind:'wild',id,name:dex[id].name,level,hp:14+level*3,shiny:random()<0.025,allyHp:hp(s.mons[s.team[0]])};
  }
  function challenge(s,id) {
    const boss = bosses[s.cleared.length];
    if (s.battle || !boss || boss.id!==id || s.routeWins[s.cleared.length]<3) return false;
    s.battle = {...boss,kind:'boss',hp:24+boss.level*4,allyHp:hp(s.mons[s.team[0]])};
    return true;
  }
  function travel(s,index) {
    if (!Number.isInteger(index)||!routes[index]||index>s.cleared.length||s.battle) return false;
    s.route=index;
    return true;
  }
  function train(mon,xp) {
    mon.xp += xp;
    while (mon.level < 100 && mon.xp >= mon.level*3) {
      mon.xp -= mon.level*3;
      mon.level++;
    }
  }
  function step(s,random=Math.random,now=Date.now()) {
    if (!s.battle) {
      encounter(s,random,now);
      return '遇见 '+s.battle.name;
    }
    const b = s.battle, mon = s.mons[s.team[s.lead]];
    const affinity = (dex[mon.id].version - (dex[b.id]?.version ?? 1) + 5)%5;
    const multiplier = affinity===1 ? 1.25 : affinity===4 ? 0.8 : 1;
    const hit = Math.round((5+mon.level*2+dex[mon.id].stage)*multiplier*(0.9+random()*0.2));
    b.hp = Math.max(0,b.hp-hit);
    if (b.hp) {
      b.allyHp = Math.max(0,b.allyHp-(3+b.level));
      if (b.allyHp) return dex[mon.id].name+' 攻击，造成 '+hit+' 伤害';
      s.lead++;
      if (s.lead < s.team.length) {
        b.allyHp=hp(s.mons[s.team[s.lead]]);
        return '下一位伙伴接战';
      }
      recover(s);
      return '队伍败退，已返回治疗中心';
    }
    for (const uid of s.team) train(s.mons[uid], b.level*2+2);
    s.coins += b.reward ?? 5+b.level;
    let message = '击败 '+b.name;
    if (b.kind==='boss') {
      s.cleared.push(b.id);
      message += b.id==='apocalymon'?' · 主线通关':' · 解锁下一地区';
    } else if (b.kind==='activity') {
      s.records[b.activity]=(s.records[b.activity]??0)+1;
    } else {
      s.routeWins[s.route]++;
      if ((s.bag.capsule??0)>0) {
        s.bag.capsule--;
        if (random()<0.65) {
          const destination = s.team.length<6?'队伍':'仓库';
          add(s,b.id,b.level,b.shiny);
          message += ' · 捕获成功，进入'+destination;
        } else message += ' · 捕获失败';
      }
    }
    recover(s);
    return message;
  }
  function buy(s,id) {
    const item=items[id];
    if (!item || s.cleared.length<item.gate || s.coins<item.price) return false;
    s.coins-=item.price;
    s.bag[id]=(s.bag[id]??0)+item.count;
    return true;
  }
  function use(s,id) {
    if (!(s.bag[id]>0) || !s.battle || id!=='ration') return false;
    s.bag[id]--;
    s.battle.allyHp=hp(s.mons[s.team[s.lead]]);
    return true;
  }
  function board(s,uid,now) {
    const index=s.box.indexOf(uid);
    if (index<0 || s.boarded || s.egg) return false;
    s.box.splice(index,1);
    s.boarded={uid,lastAt:now};
    const version=dex[s.mons[uid].id].version;
    s.egg={id:Object.keys(dex).find(id=>dex[id].version===version&&dex[id].stage===0),at:now+4*hour};
    return true;
  }
  function takeBack(s) {
    if (!s.boarded) return false;
    s.box.push(s.boarded.uid);
    s.boarded=null;
    return true;
  }
  function claimEgg(s,now) {
    if (!s.egg || now<s.egg.at) return false;
    add(s,s.egg.id,1);
    s.egg=null;
    return true;
  }
  function pension(s,now) {
    if (!s.boarded) return;
    const elapsed=Math.max(0,Math.min(8*hour,now-s.boarded.lastAt));
    const ticks=Math.floor(elapsed/(2*60000));
    if (!ticks) return;
    const version=dex[s.mons[s.boarded.uid].id].version;
    for (const mon of Object.values(s.mons)) if (dex[mon.id].version===version) train(mon,ticks);
    s.boarded.lastAt=now;
  }
  function catchUp(s,now) {
    const elapsed=Math.max(0,Math.min(8*hour,now-s.savedAt));
    if (!elapsed) return {elapsed,coins:0};
    const rounds=Math.floor(elapsed/60000);
    const coins=rounds*(s.route+1);
    s.coins+=coins;
    for (const uid of s.team) train(s.mons[uid],rounds);
    pension(s,now);
    s.savedAt=now;
    return {elapsed,coins};
  }
  function activity(s,id,random=Math.random) {
    const a=activities[id];
    if (!a || s.battle || s.cleared.length<a.gate) return {ok:false,message:'条件不足或战斗中'};
    if (a.level) {
      const level=a.level+(id==='tower'?(s.records.tower??0)*2:0);
      s.battle={kind:'activity',activity:id,name:a.name,level,hp:24+level*3,reward:a.reward,allyHp:hp(s.mons[s.team[0]])};
    } else if (id==='casino') {
      return casino(s,'slots',random);
    } else if (id==='trade') {
      if (!s.box.length) return {ok:false,message:'需要一只仓库伙伴'};
      const uid=s.box.shift();
      delete s.mons[uid];
      add(s,'elecmon',5);
    } else {
      const price=5;
      if (s.coins<price) return {ok:false,message:'余额不足'};
      s.coins-=price;
      s.bag.ration=(s.bag.ration??0)+1+Math.floor(random()*3);
    }
    if (!a.level) s.records[id]=(s.records[id]??0)+1;
    return {ok:true,message:a.name+(a.level?'已开始':'已结算')};
  }
  function casino(s,mode,random=Math.random) {
    if (s.battle||s.cleared.length<2) return {ok:false,message:'赌场尚不可用'};
    if (mode==='slots') {
      if (s.coins<10) return {ok:false,message:'需要 10 数码币'};
      const symbols=['◆','●','▲','★'];
      const lines=Array.from({length:5},()=>Array.from({length:3},()=>symbols[Math.floor(random()*4)]));
      const tokens=lines.filter(([a,b,c])=>a===b&&b===c).length*2;
      s.coins-=10;
      s.bag.token=(s.bag.token??0)+tokens;
      s.records.casino=(s.records.casino??0)+1;
      return {ok:true,lines,message:lines.map(line=>line.join(' ')).join(' ｜ ')+' · 获得 '+tokens+' 代币'};
    }
    if (mode!=='pachinko'||!(s.bag.token>=2)) return {ok:false,message:'需要 2 枚代币'};
    s.bag.token-=2;
    if (random()<0.5) {
      s.bag.ration=(s.bag.ration??0)+1;
      return {ok:true,message:'弹珠落入补给槽，获得 1 份回复补给'};
    }
    s.bag.token+=3;
    return {ok:true,message:'弹珠落入代币槽，获得 3 枚代币'};
  }
  function load(raw) {
    try {
      const s=JSON.parse(raw);
      if (s?.v!==1 || !s.team?.length || s.team.length>6 || !s.mons ||
          !Array.isArray(s.box) || !Array.isArray(s.seen) || !Array.isArray(s.cleared) ||
          !Array.isArray(s.routeWins) || !Array.isArray(s.presets) || !s.bag || !s.records ||
          !Number.isFinite(s.savedAt) || !routes[s.route] ||
          [...s.team,...s.box].some(uid=>!dex[s.mons[uid]?.id])) return null;
      return s;
    } catch { return null; }
  }
  return {dex,bosses,routes,items,activities,starters,hp,create,step,recover,queueSwap,preset,evolve,
    challenge,travel,buy,use,board,takeBack,claimEgg,pension,catchUp,activity,casino,load,serialize:JSON.stringify};
})();
if (typeof module !== 'undefined') module.exports = DigitalGame;
