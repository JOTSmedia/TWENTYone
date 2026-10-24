(function (root) {
  'use strict';
  const SUITS = ['♠', '♥', '♣', '♦'];
  const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const value = c => c.rank === 'A' ? 11 : ['J', 'Q', 'K'].includes(c.rank) ? 10 : Number(c.rank);
  const tag = c => value(c) >= 10 ? -1 : value(c) <= 6 ? 1 : 0;
  const signed = n => n > 0 ? '+' + n : String(n === 0 ? 0 : n);
  function total(cards) {
    let sum = cards.reduce((n, c) => n + value(c), 0), aces = cards.filter(c => c.rank === 'A').length;
    while (sum > 21 && aces > 0) { sum -= 10; aces--; }
    return { value: sum, soft: aces > 0 };
  }
  class Shoe {
    constructor(decks = 6) {
      this.decks = decks; this.size = decks * 52; this.running = 0; this.exposed = 0; this.drawn = 0;
      this.cards = [];
      for (let d = 0; d < decks; d++) for (const suit of SUITS) for (const rank of RANKS)
        this.cards.push({ rank, suit, id: `${d}-${suit}-${rank}`, exposed: false });
      for (let i = this.cards.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1)); [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
      }
    }
    draw(expose = true) {
      if (!this.cards.length) throw new Error('Shoe is empty');
      const card = this.cards.pop(); this.drawn++; card.order = this.drawn;
      if (expose) this.reveal(card);
      return card;
    }
    reveal(card) { if (!card.exposed) { card.exposed = true; this.running += tag(card); this.exposed++; card.revealOrder = this.exposed; } }
    get unseenDecks() { return (this.size - this.exposed) / 52; }
    get trueCount() { return this.unseenDecks > 0 ? Math.trunc(this.running / this.unseenDecks) || 0 : 0; }
  }
  // Six-deck S17, DAS, no surrender. A double falls back to hit, except soft 18 (stand).
  function recommend(cards, upcard, options = {}) {
    const { canDouble = cards.length === 2, canSplit = cards.length === 2 } = options;
    const d = value(upcard), t = total(cards), pair = cards.length === 2 && value(cards[0]) === value(cards[1]);
    if (pair && canSplit) {
      const p = value(cards[0]);
      if (p === 11 || p === 8 || p === 9 && [2,3,4,5,6,8,9].includes(d) || p === 7 && d <= 7 || p === 6 && d <= 6 || p === 4 && [5,6].includes(d) || [2,3].includes(p) && d <= 7) return 'split';
    }
    if (t.soft) {
      if (t.value >= 19) return 'stand';
      if (t.value === 18) return d >= 3 && d <= 6 && canDouble ? 'double' : [2,3,4,5,6,7,8].includes(d) ? 'stand' : 'hit';
      const doubles = t.value === 17 ? [3,4,5,6] : [15,16].includes(t.value) ? [4,5,6] : [13,14].includes(t.value) ? [5,6] : [];
      return canDouble && doubles.includes(d) ? 'double' : 'hit';
    }
    if (t.value >= 17) return 'stand';
    if (t.value >= 13) return d <= 6 ? 'stand' : 'hit';
    if (t.value === 12) return d >= 4 && d <= 6 ? 'stand' : 'hit';
    if (canDouble && (t.value === 11 && d !== 11 || t.value === 10 && d <= 9 || t.value === 9 && d >= 3 && d <= 6)) return 'double';
    return 'hit';
  }
  function explain(cards, upcard, move) {
    const t = total(cards), d = upcard.rank, label = `${t.soft ? 'Soft' : 'Hard'} ${t.value}`;
    if (move === 'split') return cards[0].rank === 'A' ? 'Split aces to give each ace its own chance to make a strong hand. Split aces receive one card each.' : cards[0].rank === '8' ? 'Split 8s: two separate hands are a better starting point than a hard 16, even against a strong dealer upcard.' : `Split this pair against the dealer’s ${d}. Double after split is allowed in this game.`;
    if (move === 'double') return `${label} against ${d}: double for one more card. This matchup favors adding a unit; the recommendation uses six-deck S17 basic strategy.`;
    if (move === 'stand') return t.soft ? `${label} is strong enough to keep against ${d}. The ace still counts as 11. Against 9, 10 or ace, soft 18 would hit.` : t.value >= 17 ? `Keep hard ${t.value}. With 17 or more, taking another card carries too much bust risk.` : `Stand on ${t.value} against ${d}. The dealer’s weak upcard makes keeping your hand the better basic-strategy play.`;
    return t.soft ? `Hit soft ${t.value} against ${d}. The ace can fall from 11 to 1, giving you room to improve.` : t.value === 11 && value(upcard) === 11 ? 'Hit 11 against an ace under S17 rules. Unlike many H17 charts, this game does not recommend doubling here.' : `Hit hard ${t.value} against ${d}. Improving your hand is the better basic-strategy choice in this matchup.`;
  }
  class Game {
    constructor(shoe = new Shoe(6)) { this.shoe = shoe; this.hands = []; this.dealer = []; this.phase = 'ready'; this.active = 0; this.net = 0; }
    deal() {
      if (this.phase === 'playing') return false;
      if (this.shoe.cards.length < 78) this.shoe = new Shoe(6);
      this.hands = [{ cards: [this.shoe.draw()], bet: 1, done: false, split: false }];
      this.dealer = [this.shoe.draw()];
      this.hands[0].cards.push(this.shoe.draw()); this.dealer.push(this.shoe.draw(false));
      this.active = 0; this.net = 0; this.phase = 'playing';
      if (total(this.hands[0].cards).value === 21 || total(this.dealer).value === 21) this.settle(true);
      return true;
    }
    get hand() { return this.hands[this.active]; }
    get canDouble() { return this.phase === 'playing' && this.hand.cards.length === 2; }
    get canSplit() {
      if (this.phase !== 'playing' || this.hands.length >= 4 || this.hand.cards.length !== 2) return false;
      return value(this.hand.cards[0]) === value(this.hand.cards[1]) && (this.hand.cards[0].rank !== 'A' || !this.hand.split);
    }
    get advice() { return recommend(this.hand.cards, this.dealer[0], { canDouble: this.canDouble, canSplit: this.canSplit }); }
    act(move) {
      if (this.phase !== 'playing' || !['hit','stand','double','split'].includes(move) || move === 'double' && !this.canDouble || move === 'split' && !this.canSplit) return false;
      const h = this.hand;
      if (move === 'split') {
        const ace = h.cards[0].rank === 'A';
        const other = { cards: [h.cards.pop(), this.shoe.draw()], bet: 1, split: true, done: ace };
        h.cards.push(this.shoe.draw()); h.split = true; h.done = ace;
        this.hands.splice(this.active + 1, 0, other);
        if (total(h.cards).value === 21) h.done = true;
        if (total(other.cards).value === 21) other.done = true;
      } else if (move === 'stand') h.done = true;
      else { if (move === 'double') h.bet *= 2; h.cards.push(this.shoe.draw()); h.done = move === 'double' || total(h.cards).value >= 21; }
      while (this.active < this.hands.length && this.hands[this.active].done) this.active++;
      if (this.active >= this.hands.length) this.settle();
      return true;
    }
    settle(natural = false) {
      this.shoe.reveal(this.dealer[1]);
      const playerBJ = this.hands.length === 1 && !this.hands[0].split && this.hands[0].cards.length === 2 && total(this.hands[0].cards).value === 21;
      const dealerBJ = this.dealer.length === 2 && total(this.dealer).value === 21;
      if (!natural && this.hands.some(h => total(h.cards).value <= 21)) while (total(this.dealer).value < 17) this.dealer.push(this.shoe.draw());
      const d = total(this.dealer).value;
      this.net = 0;
      this.hands.forEach(h => {
        const p = total(h.cards).value;
        h.result = p > 21 ? 'Bust' : dealerBJ && !playerBJ ? 'Dealer blackjack' : playerBJ && !dealerBJ ? 'Blackjack' : dealerBJ && playerBJ ? 'Push' : d > 21 ? 'Dealer busts' : p > d ? 'Win' : p === d ? 'Push' : 'Dealer wins';
        h.profit = h.result === 'Blackjack' ? 1.5 : ['Win','Dealer busts'].includes(h.result) ? h.bet : h.result === 'Push' ? 0 : -h.bet;
        this.net += h.profit; h.done = true;
      });
      this.phase = 'complete'; this.active = 0;
    }
  }
  class TableGame extends Game {
    constructor(players = 1, shoe = new Shoe(6)) {
      super(shoe);
      this.playerCount = Math.min(7,Math.max(1,Math.trunc(players)||1));
      this.others = []; this.events = [];
    }
    deal() {
      if (this.phase === 'playing') return false;
      if (this.shoe.cards.length < Math.max(78, this.playerCount * 18)) this.shoe = new Shoe(6);
      this.others = Array.from({length:this.playerCount-1},(_,i)=>({name:`Player ${i+2}`,hands:[{cards:[],bet:1,done:false,split:false}]}));
      this.hands = [{cards:[],bet:1,done:false,split:false}]; this.dealer=[];this.active=0;this.net=0;this.events=[];
      // Other seats play before you. Every seat shares the same finite shoe.
      for(let pass=0;pass<2;pass++) {
        for(const p of this.others) p.hands[0].cards.push(this.shoe.draw());
        this.hands[0].cards.push(this.shoe.draw());
        this.dealer.push(this.shoe.draw(pass===0));
      }
      this.phase='playing';
      if(total(this.dealer).value===21) {this.settle(true);return true;}
      for(const p of this.others) {
        const bot=new Game(this.shoe);bot.hands=p.hands;bot.dealer=this.dealer;bot.phase='playing';
        // Finishing a bot seat advances to the next seat, without revealing the dealer.
        bot.settle=()=>{bot.phase='complete';};
        if(total(bot.hand.cards).value===21) {bot.hand.done=true;bot.phase='complete';this.events.push({seat:p.name,move:'blackjack',total:21});}
        let guard=0;
        while(bot.phase==='playing') {
          if(++guard>100)throw new Error('Bot hand did not finish');
          const move=bot.advice;this.events.push({seat:p.name,move,total:total(bot.hand.cards).value});bot.act(move);
        }
        p.hands=bot.hands;
      }
      if(total(this.hands[0].cards).value===21)this.settle();
      return true;
    }
    settle(dealerNatural = false) {
      this.shoe.reveal(this.dealer[1]);
      const dealerBJ=this.dealer.length===2&&total(this.dealer).value===21;
      const everyone=[...this.others.map(p=>p.hands),this.hands].flat();
      const natural=h=>!h.split&&h.cards.length===2&&total(h.cards).value===21;
      if(!dealerNatural&&!dealerBJ&&everyone.some(h=>total(h.cards).value<=21&&!natural(h)))
        while(total(this.dealer).value<17)this.dealer.push(this.shoe.draw());
      const d=total(this.dealer).value;
      for(const h of everyone) {
        const p=total(h.cards).value,bj=natural(h);
        h.result=p>21?'Bust':dealerBJ&&!bj?'Dealer blackjack':bj&&!dealerBJ?'Blackjack':dealerBJ&&bj?'Push':d>21?'Dealer busts':p>d?'Win':p===d?'Push':'Dealer wins';
        h.profit=h.result==='Blackjack'?1.5:['Win','Dealer busts'].includes(h.result)?h.bet:h.result==='Push'?0:-h.bet;h.done=true;
      }
      this.net=this.hands.reduce((n,h)=>n+h.profit,0);this.phase='complete';this.active=0;
    }
  }
  const api = { Shoe, Game, TableGame, total, value, tag, recommend, explain, signed, SUITS, RANKS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.BJ = api;
})(typeof window !== 'undefined' ? window : globalThis);
