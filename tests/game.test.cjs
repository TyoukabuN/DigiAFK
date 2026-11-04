const test = require('node:test');
const assert = require('node:assert/strict');
const G = require('../site/game.js');

test('all 70 forms have valid evolution targets; bosses are outside the collection', () => {
  assert.equal(Object.keys(G.dex).length, 70);
  assert.equal(new Set(G.bosses.map(b => b.id)).size, 5);
  for (const form of Object.values(G.dex))
    for (const id of form.next) assert.ok(G.dex[id]);
  for (const boss of G.bosses) assert.equal(G.dex[boss.id], undefined);
});

test('exploration feeds a six-slot team and sends extra catches to storage', () => {
  const s = G.create('agumon', 0);
  for (let i = 0; i < 100; i++) G.step(s, () => 0, i * 1000);
  assert.equal(s.team.length, 6);
  assert.ok(s.box.length > 0);
  assert.equal(new Set([...s.team, ...s.box]).size, s.team.length + s.box.length);
  assert.ok(s.seen.includes(s.mons[s.box[0]].id));
});

test('team changes wait for recovery; evolution keeps identity and old registration', () => {
  const s = G.create('agumon', 0);
  for (let i = 0; i < 100; i++) G.step(s, () => 0, i * 1000);
  const uid = s.team[0], reserve = s.box[0];
  assert.ok(G.queueSwap(s, uid, reserve));
  assert.equal(s.team[0], uid);
  G.recover(s);
  assert.equal(s.team[0], reserve);
  s.mons[uid].level = 15;
  assert.ok(G.evolve(s, uid, 'greymon'));
  assert.equal(s.mons[uid].id, 'greymon');
  assert.ok(s.seen.includes('agumon'));
});

test('main bosses unlock in order and terminal victory survives save and restore', () => {
  const s = G.create('agumon', 0);
  assert.equal(G.challenge(s, 'apocalymon'), false);
  for (let i = 0; i < G.bosses.length; i++) {
    s.mons[s.team[0]].level = 100;
    s.routeWins[i] = 3;
    assert.ok(G.challenge(s, G.bosses[i].id));
    for (let j = 0; j < 30 && s.battle; j++) G.step(s, () => 0, 0);
    assert.equal(s.cleared.length, i + 1);
  }
  assert.equal(G.load(G.serialize(s)).cleared.at(-1), 'apocalymon');
});

test('shop, breeding and offline rewards respect prerequisites and pay once', () => {
  const s = G.create('agumon', 1000);
  assert.equal(G.buy(s, 'evolution-chip'), false);
  s.coins = 100;
  assert.ok(G.buy(s, 'capsule'));
  assert.equal(s.coins, 80);
  for (let i = 0; i < 100; i++) G.step(s, () => 0, 1000);
  assert.ok(G.board(s, s.box[0], 1000));
  assert.equal(G.claimEgg(s, 1001), false);
  const now = 20 * 3600000;
  assert.equal(G.catchUp(s, now, () => 0).elapsed, 8 * 3600000);
  assert.equal(G.catchUp(s, now, () => 0).elapsed, 0);
  assert.equal(G.catchUp(s, now - 1, () => 0).elapsed, 0);
  assert.ok(G.claimEgg(s, now));
  assert.equal(G.claimEgg(s, now), false);
  assert.equal(G.load('{broken'), null);
});

test('single-player activities gate entry, support retry and persist rewards', () => {
  const s = G.create('agumon', 0);
  for (const id of ['raid','legend','tower','underground','casino','trade'])
    assert.equal(G.activity(s, id, () => 0).ok, false);
  s.cleared = G.bosses.slice(0,4).map(b => b.id);
  s.coins = 100;
  s.mons[s.team[0]].level = 100;
  for (const id of ['raid','legend','tower']) {
    assert.ok(G.activity(s, id, () => 0).ok);
    for (let i = 0; i < 30 && s.battle; i++) G.step(s, () => 0, 0);
    assert.equal(s.records[id], 1);
  }
  for (let i = 0; i < 100; i++) G.step(s, () => 0, 0);
  G.recover(s);
  for (const id of ['underground','casino','trade']) assert.ok(G.activity(s,id,()=>0).ok);
  assert.equal(G.load(G.serialize(s)).records.tower, 1);
});

test('a fully wiped party can retry and a paid evolution consumes exactly one chip', () => {
  const s = G.create('agumon', 0);
  s.routeWins[0] = 3;
  assert.ok(G.challenge(s,'metalseadramon'));
  s.battle.allyHp = 1;
  assert.match(G.step(s,()=>0,0), /败退/);
  assert.ok(G.challenge(s,'metalseadramon'));
  G.recover(s);
  const uid=s.team[0];
  s.mons[uid].level=28;
  assert.ok(G.evolve(s,uid,'greymon'));
  assert.equal(G.evolve(s,uid,'metalgreymonvirus'),false);
  s.bag['evolution-chip']=1;
  assert.ok(G.evolve(s,uid,'metalgreymonvirus'));
  assert.equal(s.bag['evolution-chip'],0);
  assert.equal(G.evolve(s,uid,'metalgreymonvirus'),false);
});

test('each starter can reach the ending using only legal progression actions', () => {
  for (const id of G.starters) {
    const s = G.create(id,0);
    assert.equal(G.travel(s,4),false);
    for (let i=0;i<G.bosses.length;i++) {
      assert.ok(G.travel(s,i));
      for (let j=0;j<400&&s.cleared.length===i;j++) {
        if (!s.battle&&s.routeWins[i]>=3) G.challenge(s,G.bosses[i].id);
        if (!s.bag.capsule) G.buy(s,'capsule');
        G.step(s,()=>0.25,0);
      }
      assert.equal(s.cleared[i],G.bosses[i].id,id);
    }
  }
});

test('casino slots pay tokens, pachinko spends tokens, and locked wagers charge nothing', () => {
  const s = G.create('agumon',0);
  assert.equal(G.casino(s,'slots',()=>0).ok,false);
  assert.equal(s.coins,20);
  s.cleared=G.bosses.slice(0,2).map(b=>b.id);
  assert.equal(G.casino(s,'pachinko',()=>0).ok,false);
  const spin=G.casino(s,'slots',()=>0);
  assert.equal(spin.lines.length,5);
  assert.equal(s.coins,10);
  assert.ok(s.bag.token>=2);
  const tokens=s.bag.token;
  assert.ok(G.casino(s,'pachinko',()=>0).ok);
  assert.equal(s.bag.token,tokens-2);
  assert.equal(s.bag.ration,1);
});
