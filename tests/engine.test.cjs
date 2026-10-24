const {test} = require('node:test');
const assert = require('node:assert/strict');
const {Shoe,Game,TableGame,total,tag,recommend} = require('../engine.js');
const c = rank => ({rank:String(rank),suit:'♠',exposed:false,id:Math.random().toString()});
const hand = (...ranks) => ranks.map(c);
const upcards = ['2','3','4','5','6','7','8','9','10','A'];
const letter = {hit:'H',stand:'S',double:'D',split:'P'};
test('Every supported shoe has the correct composition and a balanced Hi-Lo count',()=>{
  for(const n of [1,2,4,6,8]){
    const shoe=new Shoe(n);assert.equal(shoe.cards.length,52*n);assert.equal(new Set(shoe.cards.map(c=>c.id)).size,52*n);
    const tally={};shoe.cards.forEach(c=>tally[c.rank]=(tally[c.rank]||0)+1);Object.values(tally).forEach(nr=>assert.equal(nr,n*4));
    assert.equal(shoe.cards.reduce((s,c)=>s+tag(c),0),0);
    while(shoe.cards.length)shoe.draw();assert.equal(shoe.running,0);assert.equal(shoe.exposed,52*n);assert.equal(shoe.unseenDecks,0);
    assert.throws(()=>shoe.draw(),/empty/);
  }
});
test('Hole cards stay out of the running count and inside unseen decks until exposed',()=>{
  const shoe=new Shoe(6),card=shoe.draw(false);assert.equal(shoe.running,0);assert.equal(shoe.exposed,0);assert.equal(shoe.unseenDecks,6);
  shoe.reveal(card);assert.equal(shoe.running,tag(card));assert.equal(shoe.exposed,1);shoe.reveal(card);assert.equal(shoe.exposed,1);
  shoe.running=-5;shoe.exposed=208;assert.equal(shoe.trueCount,-2);shoe.running=5;assert.equal(shoe.trueCount,2);
});
test('Aces adjust correctly through soft totals, multiple aces and busts',()=>{
  assert.deepEqual(total(hand('A',6)),{value:17,soft:true});assert.deepEqual(total(hand('A',6,10)),{value:17,soft:false});
  assert.deepEqual(total(hand('A','A',9)),{value:21,soft:true});assert.deepEqual(total(hand('A','A','K')), {value:12,soft:false});
  assert.equal(total(hand('K','Q',2)).value,22);
});
test('All hard-total strategy cells match independent S17 reference rows',()=>{
  const rows={8:'HHHHHHHHHH',9:'HDDDDHHHHH',10:'DDDDDDDDHH',11:'DDDDDDDDDH',12:'HHSSSHHHHH',13:'SSSSSHHHHH',14:'SSSSSHHHHH',15:'SSSSSHHHHH',16:'SSSSSHHHHH',17:'SSSSSSSSSS',18:'SSSSSSSSSS',19:'SSSSSSSSSS',20:'SSSSSSSSSS'};
  for(const [n,row]of Object.entries(rows))for(let i=0;i<10;i++){
    const v=Number(n),cards=v<=11?hand(2,v-2):hand(10,v-10);
    assert.equal(letter[recommend(cards,c(upcards[i]),{canSplit:false})],row[i],`${n} vs ${upcards[i]}`);
  }
});
test('All soft-total strategy cells match independent S17 reference rows',()=>{
  const rows={2:'HHHDDHHHHH',3:'HHHDDHHHHH',4:'HHDDDHHHHH',5:'HHDDDHHHHH',6:'HDDDDHHHHH',7:'SDDDDSSHHH',8:'SSSSSSSSSS',9:'SSSSSSSSSS'};
  for(const [r,row]of Object.entries(rows))for(let i=0;i<10;i++) assert.equal(letter[recommend(hand('A',r),c(upcards[i]))],row[i],`A,${r} vs ${upcards[i]}`);
});
test('All pair-split decisions match six-deck DAS reference cells',()=>{
  const splits={A:'YYYYYYYYYY',10:'NNNNNNNNNN',9:'YYYYYNYYNN',8:'YYYYYYYYYY',7:'YYYYYYNNNN',6:'YYYYYNNNNN',5:'NNNNNNNNNN',4:'NNNYYNNNNN',3:'YYYYYYNNNN',2:'YYYYYYNNNN'};
  for(const [r,row]of Object.entries(splits))for(let i=0;i<10;i++)assert.equal(recommend(hand(r,r),c(upcards[i]))==='split',row[i]==='Y',`${r},${r} vs ${upcards[i]}`);
  assert.equal(recommend(hand('A',7),c(6),{canDouble:false}),'stand');assert.equal(recommend(hand(5,6,2),c(10)),'hit');
  assert.equal(recommend(hand(8,8),c(10),{canSplit:false}),'hit');
});
function fixedGame(ranks){const shoe=new Shoe(6);const q=ranks.map(c);shoe.draw=function(expose=true){const next=q.shift();assert.ok(next,'fixture has enough cards');this.drawn++;if(expose)this.reveal(next);return next;};return new Game(shoe);}
test('Blackjack and dealer blackjack settle immediately with correct payouts',()=>{
  let game=fixedGame(['A',9,'K',7]);game.deal();assert.equal(game.phase,'complete');assert.equal(game.net,1.5);assert.equal(game.shoe.exposed,4);
  game=fixedGame([10,'A',9,'K']);game.deal();assert.equal(game.net,-1);
  game=fixedGame(['A','A',10,'K']);game.deal();assert.equal(game.net,0);
});
test('Dealer stands on soft 17 and doubles draw exactly one card',()=>{
  let game=fixedGame([10,'A',8,6]);game.deal();assert.equal(game.shoe.exposed,3);game.act('stand');assert.equal(game.dealer.length,2);assert.equal(game.net,1);assert.equal(game.shoe.exposed,4);
  game=fixedGame([5,10,6,7,10]);game.deal();assert.equal(game.advice,'double');game.act('double');assert.equal(game.hand.cards.length,3);assert.equal(game.hand.bet,2);assert.equal(game.net,2);assert.equal(game.phase,'complete');assert.equal(game.act('hit'),false);
});
test('Split aces get one card, finish automatically and pay 1:1 on 21',()=>{
  const game=fixedGame(['A',10,'A',7,'K',10]);game.deal();assert.equal(game.canSplit,true);game.act('split');assert.equal(game.hands.length,2);assert.equal(game.phase,'complete');assert.equal(game.net,2);assert.equal(game.hands.every(h=>h.cards.length===2&&h.split),true);
});
test('Splits advance to the next hand and allow doubling after split',()=>{
  const game=fixedGame([8,6,8,10,3,2,10,10]);game.deal();game.act('split');assert.equal(game.hands.length,2);assert.equal(game.active,0);assert.equal(game.canDouble,true);game.act('stand');assert.equal(game.active,1);game.act('double');assert.equal(game.phase,'complete');assert.equal(game.hands[1].bet,2);
});
test('Randomized complete rounds respect total, accounting, and split limits',()=>{
  const game=new Game();for(let i=0;i<1500;i++){
    game.deal();let n=0;while(game.phase==='playing'){assert.ok(++n<80);assert.ok(game.hands.length<=4);const advice=game.advice;assert.equal(game.act(advice),true);}
    assert.equal(game.net,game.hands.reduce((s,h)=>s+h.profit,0));assert.equal(game.shoe.drawn,game.shoe.exposed);
    assert.ok(game.hands.every(h=>h.done));
  }
});
test('Other players share the shoe, play basic strategy, and keep the dealer hole card hidden',()=>{
  const shoe=new Shoe(6),q=hand(5,10,6,6,7,10,10,10);
  shoe.draw=function(expose=true){const card=q.shift();assert.ok(card);this.drawn++;card.order=this.drawn;if(expose)this.reveal(card);return card;};
  const game=new TableGame(2,shoe);game.deal();
  assert.equal(game.others.length,1);assert.equal(game.others[0].hands[0].bet,2);assert.equal(total(game.others[0].hands[0].cards).value,21);
  assert.equal(game.dealer[1].exposed,false);assert.equal(shoe.exposed,6);assert.equal(shoe.drawn,7);
  game.act('stand');assert.equal(game.net,1);assert.equal(game.others[0].hands[0].profit,2);assert.equal(shoe.exposed,shoe.drawn);
});
test('Tables with one through seven players finish valid rounds without losing or duplicating cards',()=>{
  for(let players=1;players<=7;players++){
    const game=new TableGame(players);
    for(let round=0;round<500;round++){
      game.deal();assert.equal(game.others.length,players-1);
      while(game.phase==='playing')game.act(game.advice);
      const exposed=[...game.hands.flatMap(h=>h.cards),...game.others.flatMap(p=>p.hands.flatMap(h=>h.cards)),...game.dealer];
      assert.equal(new Set(exposed.map(c=>c.id)).size,exposed.length);
      assert.equal(game.shoe.exposed,game.shoe.drawn);
      assert.equal(game.net,game.hands.reduce((n,h)=>n+h.profit,0));
      for(const player of game.others)assert.ok(player.hands.length<=4&&player.hands.every(h=>h.done));
    }
  }
});

test('Exposure order reveals the final player card before the dealer hole card',()=>{
  for(const move of ['hit','double']){
    const shoe=new Shoe(6), q=hand(10,9,6,7,5,2);
    const pending=q.slice();
    shoe.draw=function(expose=true){const card=pending.shift();assert.ok(card);this.drawn++;card.order=this.drawn;if(expose)this.reveal(card);return card;};
    const game=new TableGame(1,shoe);game.deal();
    const hole=game.dealer[1];assert.equal(hole.revealOrder,undefined);
    game.act(move);
    const last=game.hands[0].cards[2], dealerHit=game.dealer[2];
    assert.equal(game.phase,'complete');
    assert.ok(hole.order<last.order);
    assert.ok(last.revealOrder<hole.revealOrder);
    assert.ok(hole.revealOrder<dealerHit.revealOrder);
    assert.deepEqual([last,hole,dealerHit].map(c=>c.rank),['5','7','2']);
    assert.equal(new Set(q.map(c=>c.revealOrder)).size,6);
  }
});
