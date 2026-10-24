/* TWENTYone runs entirely on this device, including settings and progress. */
(() => {
  'use strict';
  const { Shoe, Game, TableGame, total, value, tag, signed, recommend, explain } = BJ;
  const $ = s => document.querySelector(s);
  const icon = (name) => {
    const paths = { cards:'<rect x="4" y="5" width="11" height="15" rx="2"/><path d="m9 5 2-3 9 4-5 12"/><path d="M9.5 10v5m-2.5-2.5h5"/>', chart:'<path d="M4 20V4m0 16h16M8 15l4-5 4 2 4-7"/>', book:'<path d="M12 5v15m0-15C8 2 4 3 2 4v14c3-1 6-1 10 2 4-3 7-3 10-2V4c-3-1-6-1-10 1Z"/>', help:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 4 2c-1.5 1-1.5 1.5-1.5 2.5M12 17h.01"/>', reset:'<path d="M4 10a8 8 0 1 1 1 8M4 4v6h6"/>', arrow:'<path d="M4 12h15m-5-5 5 5-5 5"/>', play:'<path d="m8 5 11 7-11 7Z"/>', pause:'<path d="M8 5v14M16 5v14"/>', settings:'<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="2" fill="currentColor"/><circle cx="15" cy="17" r="2" fill="currentColor"/>', eye:'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>', shuffle:'<path d="M3 5h3c5 0 5 14 10 14h5m-4-4 4 4-4 3M3 19h3c2 0 4-3 5-6m3-6c1-1 2-2 4-2h3m-4-3 4 3-4 4"/>', shield:'<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z"/><path d="m8 12 3 3 5-6"/>', next:'<path d="m5 5 10 7-10 7Zm13 0v14"/>', flame:'<path d="M12 3c1 5 6 5 6 11a6 6 0 0 1-12 0c0-3 2-5 3-6 0 3 2 4 2 4s3-3 1-9Z"/>', clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>' };
    return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.cards}</svg>`;
  };
  const brand = `<svg class="brandmark" viewBox="0 0 30 34" aria-hidden="true"><path d="M15 1C12 8 2 11 2 19a7 7 0 0 0 12 5c0 4-2 6-5 8h12c-3-2-5-4-5-8a7 7 0 0 0 12-5C28 11 18 8 15 1Z"/></svg><span>TWENTY<em>one</em></span>`;
  const defaultSettings = { decks:6, speed:1.5, interval:10, goal:'both', auto:true, practice:true, players:3, showCount:true, coach:true, tableSpeed:0.3, countBubble:true };
  const emptyStats = () => ({ fields:0, correct:0, checkpoints:0, decisions:0, rightMoves:0, streak:0, best:0, cards:0, rounds:0, net:0, history:[] });
  function load(key, fallback) { try { const raw = JSON.parse(localStorage.getItem(key)); return raw && typeof raw === 'object' ? {...fallback, ...raw} : fallback; } catch { return fallback; } }
  let settings = load('twentyone-settings-v1',defaultSettings), stats = load('twentyone-stats-v1',emptyStats());
  settings.decks = [1,2,4,6,8].includes(settings.decks) ? settings.decks : 6;
  settings.speed = [0.6,0.9,1.2,1.5,1.8,2.1,2.4,2.7,3].includes(settings.speed) ? settings.speed : 1.5;
  settings.interval = [5,10,20,52].includes(settings.interval) ? settings.interval : 10;
  settings.goal = ['running','true','both'].includes(settings.goal) ? settings.goal : 'both';
  if (!Array.isArray(stats.history)) stats.history = [];
  settings.players = [1,2,3,4,5,6,7].includes(settings.players) ? settings.players : 3;
  settings.tableSpeed = Math.min(1.5,Math.max(0.15,Number(settings.tableSpeed)||0.3));
  let view = 'training', mode = 'blackjack', chartTab = 'hard', timer = null, feedback = null, hinted = false;
  let drill = newDrill(), game = new TableGame(settings.players), roundRecorded = false;
  let tableBusy=false, tableTimer=null, animatedCards=new Map(), tableReveal=null, revealTimers=[];
  function newDrill() { return { shoe:new Shoe(settings.decks), phase:'idle', cards:[], latest:null, since:0, resume:true, answer:null, error:'', started:0, checkpointStart:0, segment:[] }; }
  function persist() { try { localStorage.setItem('twentyone-settings-v1',JSON.stringify(settings)); localStorage.setItem('twentyone-stats-v1',JSON.stringify(stats)); } catch {} }
  function log(type, text, good) { stats.history.unshift({type,text,good,time:new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}); stats.history = stats.history.slice(0,30); persist(); }
  function score(good) { stats.streak = good ? stats.streak+1 : 0; stats.best = Math.max(stats.best,stats.streak); }
  function percentage(correct, attempted) { return attempted ? Math.round(100*correct/attempted)+'%' : '—'; }
  function accuracy() { return percentage(stats.correct+stats.rightMoves,stats.fields+stats.decisions); }
  function card(c, back = false) {
    const suit={'♠':'S','♥':'H','♣':'C','♦':'D'}[c.suit]||'S';
    const file=back?'B-1':suit+'-'+c.rank;
    const plannedDelay=animatedCards.get(c.id);
    const delay=plannedDelay===undefined?undefined:plannedDelay-(tableReveal?performance.now()-tableReveal.started:0);
    return `<div class="playing-card image-card ${back?'back':''} ${delay!==undefined?'card-arriving':''}" ${delay!==undefined?`style="--deal-delay:${delay}ms;animation-delay:${delay}ms"`:''} role="img" aria-label="${back?'Face-down card':c.rank+' of '+({'♠':'spades','♥':'hearts','♣':'clubs','♦':'diamonds'}[c.suit])}"><img src="assets/cards/${file}.svg" alt="" draggable="false"></div>`;
  }
  function welcome(isBlackjack = false) {
    return `<div class="welcome"><div class="welcome-cards" aria-label="Illustrative playing cards">${card({rank:'K',suit:'♥'})}${card({rank:'5',suit:'♣'})}${card({rank:'A',suit:'♠'})}</div><h2>${isBlackjack?'Play the hand. Learn the move.':'Every card counts.'}</h2><p>${isBlackjack?'Read your hand. Read the dealer. Build the instinct.':'Find your rhythm. Keep your count. Trust the practice.'}</p></div>`;
  }
  const navItems = [['training','cards','Training'],['strategy','book','Basic strategy'],['progress','chart','Your progress']];
  function uppercaseUi(root) {
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node;
    while((node=walker.nextNode()))if(!node.parentElement?.closest('script,style,textarea'))node.nodeValue=node.nodeValue.toUpperCase();
  }
  function render() {
    const name = view==='training'?'Training room':view==='strategy'?'Basic strategy':'Your progress';
    $('#app').innerHTML = `<div class="shell"><aside class="sidebar"><a class="brand" href="#" data-action="home" aria-label="TWENTYone home">${brand}</a><p class="brand-sub">A sharper game starts here.</p><div class="nav-label">Your practice</div><nav class="nav" aria-label="Main navigation">${navItems.map(([v,i,n])=>`<button data-view="${v}" class="${view===v?'active':''}" ${view===v?'aria-current="page"':''}>${icon(i)}${n}</button>`).join('')}</nav><div class="sidebar-bottom"><button class="help-link" data-action="help">${icon('help')}How to play</button><div class="sidebar-note"><span>Made for the long game.</span>No bets. Just better instincts.</div></div></aside><main class="main"><header class="topbar"><div class="breadcrumb">Your practice <span>/</span><strong>${name}</strong></div><a class="brand mobile-brand" href="#" data-action="home">${brand}</a><div class="top-right"><span class="local-badge">${icon('shield')} Progress saved on this device</span><button class="text-button" data-action="help">${icon('help')}<span>Quick guide</span></button></div></header><div class="workspace">${view==='training'?training():view==='strategy'?strategy():progress()}<footer class="page-footer"><span>Built for practice. Play with knowledge, not luck.</span><button data-action="help">Rules & shortcuts ${icon('arrow')}</button></footer></div></main><nav class="mobile-nav" aria-label="Mobile navigation">${navItems.map(([v,i,n])=>`<button data-view="${v}" class="${view===v?'active':''}" ${view===v?'aria-current="page"':''}>${icon(i)}${n}</button>`).join('')}</nav></div>`;
    uppercaseUi(document.querySelector('#app'));
    if(view==='training'&&mode==='blackjack')centerYourSeat();
    if (drill.phase==='quiz' && view==='training' && mode==='count') requestAnimationFrame(()=>$('#runningAnswer, #trueAnswer')?.focus({preventScroll:true}));
  }
  function training() {
    return `<div class="page-heading"><div><h1>Practice your edge.</h1><p>One card at a time. One better decision at a time.</p></div><button class="outline-button" data-action="resetShoe">${icon('shuffle')}New shoe</button></div><div class="training-grid"><div class="left-column"><section class="trainer ${mode==='blackjack'?'table-trainer':''}" aria-label="Blackjack training table"><div class="trainer-top"><div class="mode-tabs" role="group" aria-label="Training mode"><button data-mode="count" class="${mode==='count'?'active':''}" aria-pressed="${mode==='count'}">Count practice</button><button data-mode="blackjack" class="${mode==='blackjack'?'active':''}" aria-pressed="${mode==='blackjack'}">Blackjack hands</button></div><span class="trainer-state ${mode==='count'&&drill.phase==='running'||mode==='blackjack'&&game.phase==='playing'?'live':''}"><i class="status-dot"></i>${mode==='count'?({idle:'Ready to deal',running:settings.auto?'In practice':'Manual drill',paused:'Paused',quiz:'Checkpoint',feedback:'Review',complete:'Shoe complete'}[drill.phase]):(tableBusy?'Dealing…':({ready:'Ready to deal',playing:'Your turn',complete:'Hand complete'}[game.phase]))}</span></div>${countHint()}<div class="felt ${mode==='blackjack'?'photo-table':''}">${mode==='count'?'<div class="felt-line"></div><div class="table-wordmark">TWENTYone <span>•</span> HI–LO COUNTING</div>':''}${mode==='count'?countStage():blackjackStage()}</div>${mode==='count'?countControls():blackjackControls()}</section>${mode==='blackjack'&&feedback?`<div class="feedback-panel ${feedback.wrong?'wrong':''}" role="status"><strong>${feedback.title}</strong>${feedback.text}${feedback.note?`<small>${feedback.note}</small>`:''}</div>`:''}${countsStrip()}${sessionStrip()}</div><aside class="settings-area">${mode==='count'?countSettings():blackjackSettings()}${reference()}</aside></div>`;
  }
  function countStage() {
    if (['quiz','feedback'].includes(drill.phase)) return quiz();
    if (drill.phase==='complete') return `<div class="count-stage"><div class="welcome"><h2>A clean finish.</h2><p>${drill.shoe.exposed} cards. Running count ${signed(drill.shoe.running)}.</p><p>A complete Hi-Lo shoe always balances back to zero.</p></div></div>`;
    if (drill.phase==='idle') return `<div class="count-stage">${welcome()}<div class="stage-legend"><span>2–6 <b>+1</b></span><span>7–9 <b>0</b></span><span>10–A <b>−1</b></span></div></div>`;
    return `<div class="count-stage"><div class="shoe-marker">${icon('cards')}${settings.decks}-deck shoe</div><div class="card-row" aria-label="Most recent cards">${drill.cards.map((c,i)=>`<div class="card-wrap ${c.id===drill.latest?'new':''}">${card(c)}${settings.practice?`<span class="card-tag">${signed(tag(c))}</span>`:''}</div>`).join('')}</div><p class="latest-caption">${drill.shoe.exposed} ${drill.shoe.exposed===1?'card':'cards'} dealt · checkpoint in ${Math.min(settings.interval-drill.since,drill.shoe.cards.length)} cards</p><div class="stage-legend"><span>2–6 <b>+1</b></span><span>7–9 <b>0</b></span><span>10–A <b>−1</b></span></div></div>`;
  }
  function quizFields() { return {running: settings.goal!=='true'||drill.shoe.unseenDecks===0, true: settings.goal!=='running'&&drill.shoe.unseenDecks>0}; }
  function countExplanation() {
    const cards=drill.segment,low=cards.filter(c=>tag(c)===1).length,high=cards.filter(c=>tag(c)===-1).length,neutral=cards.length-low-high;
    const shoe=drill.shoe,remaining=shoe.size-shoe.exposed;
    return `<section class="count-reasoning"><h3>How the count changed</h3><p>Started at <b>${signed(drill.checkpointStart)}</b>. ${low} low ${low===1?'card':'cards'} added <b>+${low}</b>; ${high} high ${high===1?'card':'cards'} added <b>${high?-high:0}</b>. ${neutral} neutral ${neutral===1?'card':'cards'} added <b>0</b>.</p><p class="count-equation">${signed(drill.checkpointStart)} + ${low} − ${high} = <b>${signed(shoe.running)}</b> running count.</p><div class="count-card-audit" aria-label="Cards since the previous checkpoint">${cards.map(c=>`<span>${c.rank}${c.suit} <b>${signed(tag(c))}</b></span>`).join('')}</div><h3>From running to true count</h3>${remaining?`<p>${shoe.size} cards − ${shoe.exposed} seen = ${remaining} unseen.<br>${remaining} ÷ 52 = ${shoe.unseenDecks.toFixed(2)} decks remaining.</p><p class="count-equation">${signed(shoe.running)} ÷ ${shoe.unseenDecks.toFixed(2)} = ${(shoe.running/shoe.unseenDecks).toFixed(2)} → <b>${signed(shoe.trueCount)}</b> true count.</p><p class="count-rounding">Drop the decimal toward zero. A value of −2.8 becomes −2, and +2.8 becomes +2. Calculations use exact unseen cards, before display rounding.</p>`:'<p>No cards remain. The complete Hi-Lo shoe balances to zero. True count is undefined at zero decks, so this checkpoint checks only the running count.</p>'}</section>`;
  }
  function quiz() {
    const q = quizFields(), answered = drill.phase==='feedback';
    if (answered) {
      const a = drill.answer;
      return `<div class="checkpoint"><h2>${a.good?'Right on the count.':'Let’s find the count.'}</h2><p>${a.good?'Nicely tracked. Keep the rhythm going.':'Reset your mental count to the answer below.'}</p><div class="checkpoint-feedback" role="status"><strong>${q.running?`Running count: ${signed(drill.shoe.running)}`:''}${q.running&&q.true?' · ':''}${q.true?`True count: ${signed(drill.shoe.trueCount)}`:''}</strong>${a.lines.join('<br>')}</div>${countExplanation()}<button class="primary" data-action="continueCount">${drill.shoe.cards.length?'Continue practice':'Finish shoe'}${icon('arrow')}</button></div>`;
    }
    return `<form class="checkpoint" id="checkpointForm" novalidate><h2>Still with the count?</h2><p>${drill.shoe.exposed} cards seen · ${drill.shoe.unseenDecks.toFixed(2)} unseen decks</p><div class="checkpoint-fields">${q.running?'<label for="runningAnswer">Running count<input id="runningAnswer" name="running" type="text" inputmode="text" placeholder="0" required autocomplete="off" maxlength="8"></label>':''}${q.true?'<label for="trueAnswer">True count<input id="trueAnswer" name="true" type="text" inputmode="text" placeholder="0" required autocomplete="off" maxlength="8"></label>':''}</div><div class="form-error" role="alert">${drill.error?`<p class="error-text">${drill.error}</p>`:''}</div><button class="primary" type="submit">Check my count${icon('arrow')}</button><p class="checkpoint-math">${q.true?'Divide by unseen decks; truncate toward zero.':'Add each exposed card’s Hi-Lo value to your count.'}</p></form>`;
  }
  function countControls() {
    const phase=drill.phase,locked=['quiz','feedback'].includes(phase);
    const label=phase==='idle'?'Start training':phase==='complete'?'Start a new shoe':phase==='running'&&settings.auto?'Pause dealing':phase==='paused'&&settings.auto?'Resume dealing':'Next card';
    return `<div class="session-controls count-controls"><div class="control-primary"><button class="primary" data-action="countPrimary" ${locked?'disabled':''}>${icon(phase==='running'&&settings.auto?'pause':phase==='running'?'next':'play')}${label}</button>${settings.auto&&phase!=='idle'&&phase!=='complete'?`<button class="secondary" data-action="nextCard" ${locked||phase==='running'&&settings.auto?'disabled':''}>${icon('next')}Next card</button>`:''}</div>${phase!=='idle'?`<button class="text-button" data-action="checkNow" ${locked||!drill.since?'disabled':''}>Check now</button>`:''}<button class="text-button restart-button" data-action="restartCount" title="Fresh shoe and zero count; saved progress stays">${icon('reset')}Restart practice</button></div>`;
  }
  function liveCount() {
    const shoe=mode==='count'?drill.shoe:game.shoe;
    const shown=mode==='blackjack'&&tableReveal?tableReveal:shoe;
    const decks=(shoe.size-shown.exposed)/52;
    return {running:shown.running,exposed:shown.exposed,size:shoe.size,decks,trueCount:decks>0?Math.trunc(shown.running/decks)||0:0};
  }
  function countIsHidden() {return !settings.showCount||(mode==='count'&&(!settings.practice||drill.phase==='quiz'));}
  function lastSeen() {
    if(mode==='count'){const c=drill.cards.at(-1);return c?c.rank+c.suit+' ('+signed(tag(c))+')':'Start at zero';}
    return tableReveal?tableReveal.last||'Watch the next card':game.phase==='ready'?'Start at zero':'All exposed cards counted';
  }
  function countHint() {
    const live=liveCount(),hidden=countIsHidden(),quiz=mode==='count'&&drill.phase==='quiz';
    return `<section class="count-hint-row" aria-label="Live count hint"><button class="count-hint-toggle" data-action="countBubble" aria-expanded="${settings.countBubble}">${icon('help')}Count hint</button>${settings.countBubble?`<div class="count-hint-bubble"><div><span>Running <b data-count-value="running">${hidden?'••':signed(live.running)}</b></span><span>True <b data-count-value="true">${hidden?'••':live.decks>0?signed(live.trueCount):'—'}</b></span></div><p data-count-last>${quiz?'Submit your count to reveal':hidden?'Count hidden — keep it in your head':lastSeen()}</p></div>`:'<span class="bubble-closed">Your count coach is one tap away.</span>'}<button class="text-button bubble-visibility" data-action="toggleCount" aria-pressed="${settings.showCount}">${icon('eye')}${settings.showCount?'Hide':'Show'}</button></section>`;
  }
  function countsStrip() {
    const live=liveCount(),hidden=countIsHidden();
    return `<div class="counts-header"><span>Hi-Lo count</span><button data-action="toggleCount" class="text-button" aria-pressed="${settings.showCount}">${icon('eye')}${settings.showCount?'Hide count':'Show count'}</button></div><section class="counts-strip" aria-label="Shoe and counts"><div class="count-item"><label>Running count ${icon('eye')}</label><div class="count-number ${hidden?'hidden-count':''}" data-count-value="running">${hidden?'••':signed(live.running)}</div><small>${hidden?'Keep it in your head':'Every exposed card'}</small></div><div class="count-item"><label>True count</label><div class="count-number ${hidden?'hidden-count':''}" data-count-value="true">${hidden?'••':live.decks<=0?'—':signed(live.trueCount)}</div><small>Truncated toward zero</small></div><div class="count-item"><label>Decks unseen</label><div class="count-number" data-count-value="decks">${live.decks.toFixed(2)}</div><div class="shoe-track" role="progressbar" aria-label="Cards exposed" aria-valuemin="0" aria-valuemax="${live.size}" aria-valuenow="${live.exposed}"><i style="width:${100*live.exposed/live.size}%"></i></div><div class="shoe-track-caption"><span data-count-value="seen">${live.exposed} seen</span><span>${live.size} cards</span></div></div></section>`;
  }
  function refreshCountText() {
    if(mode!=='blackjack'||view!=='training')return;
    const live=liveCount(),hidden=countIsHidden();
    const values={running:hidden?'••':signed(live.running),true:hidden?'••':live.decks>0?signed(live.trueCount):'—',decks:live.decks.toFixed(2),seen:live.exposed+' seen'};
    document.querySelectorAll('[data-count-value]').forEach(el=>el.textContent=values[el.dataset.countValue]);
    const last=document.querySelector('[data-count-last]');if(last)last.textContent=hidden?'Count hidden — keep it in your head':lastSeen();
    const bar=document.querySelector('.shoe-track');if(bar){bar.setAttribute('aria-valuenow',live.exposed);bar.querySelector('i').style.width=100*live.exposed/live.size+'%';}
  }
  function sessionStrip() { return `<section class="mini-session" aria-label="Practice progress"><div><label>Accuracy</label><strong>${accuracy()}</strong></div><div><label>Current streak</label><strong>${stats.streak}<small>correct</small></strong></div><div><label>Best streak</label><strong>${stats.best}<small>correct</small></strong></div><div><label>${mode==='count'?'Cards practiced':'Hands played'}</label><strong>${mode==='count'?stats.cards:stats.rounds}</strong></div></section>`; }
  function countSettings() {
    const lock = ['quiz','feedback'].includes(drill.phase);
    return `<section class="settings" aria-labelledby="settingsTitle"><div class="settings-heading"><h2 id="settingsTitle">Session setup</h2>${icon('settings')}</div><div class="setting-group"><div class="field-label">Number of decks</div><div class="segmented" role="group" aria-label="Number of decks">${[1,2,4,6,8].map(n=>`<button data-decks="${n}" class="${settings.decks===n?'active':''}" aria-pressed="${settings.decks===n}" ${lock?'disabled':''}>${n}</button>`).join('')}</div></div><div class="setting-group"><label class="field-label" for="speed">Dealing speed<span id="speedValue">${settings.speed.toFixed(1)}s / card</span></label><input type="range" id="speed" min="0.6" max="3" step="0.3" value="${settings.speed}" aria-valuetext="${settings.speed} seconds per card"><div class="range-labels"><span>Fast</span><span>Unhurried</span></div></div><div class="setting-group"><div class="field-label">Dealing style</div><div class="segmented" role="group" aria-label="Dealing style"><button data-auto="true" class="${settings.auto?'active':''}" aria-pressed="${settings.auto}" ${lock?'disabled':''}>Auto deal</button><button data-auto="false" class="${!settings.auto?'active':''}" aria-pressed="${!settings.auto}" ${lock?'disabled':''}>One card</button></div></div><div class="setting-group"><label class="field-label" for="interval">Checkpoint frequency</label><select id="interval" ${lock?'disabled':''}>${[5,10,20,52].map(n=>`<option value="${n}" ${settings.interval===n?'selected':''}>Every ${n} cards</option>`).join('')}</select></div><div class="setting-group"><label class="field-label" for="goal">What to practice</label><select id="goal" ${lock?'disabled':''}>${[['both','Running + true count'],['running','Running count only'],['true','True count only']].map(([v,n])=>`<option value="${v}" ${settings.goal===v?'selected':''}>${n}</option>`).join('')}</select></div><hr><div class="switch-row"><span class="switch-label" id="practiceLabel">Practice mode</span><button class="switch" role="switch" aria-checked="${settings.practice}" aria-labelledby="practiceLabel" data-action="practice" ${lock?'disabled':''}><i></i></button></div><p class="switch-desc">${settings.practice?'Card values and live counts stay visible. Answers hide at checkpoints.':'Counts stay hidden. Keep your own count until each checkpoint.'}</p><p class="settings-footer">Changing deck count starts a fresh shoe. Speed can change as you practice.</p></section>`;
  }
  function reference() {
    return mode==='count'?`<section class="rule-reference"><h3>A quick Hi-Lo refresher</h3><div class="hilo-row"><span class="rank-label">2, 3, 4, 5, 6</span><strong class="positive">+1</strong></div><div class="hilo-row"><span class="rank-label">7, 8, 9</span><strong>0</strong></div><div class="hilo-row"><span class="rank-label">10, J, Q, K, A</span><strong>−1</strong></div><p class="rules-quiet" style="margin-top:16px">True count = running count ÷ unseen decks.</p></section>`:`<section class="rule-reference"><h3>The count still matters.</h3><p class="rules-quiet">Track the dealer’s upcard and your own cards as they appear. The hole card joins the count only when revealed.</p><button class="text-button" data-mode="count" style="padding-left:0;margin-top:8px">Go to count practice${icon('arrow')}</button></section>`;
  }
  function tableCards() {return [...game.hands.flatMap(h=>h.cards),...game.others.flatMap(p=>p.hands.flatMap(h=>h.cards)),...game.dealer];}
  const seatPositions=[[23,78],[79,78],[9,68],[91,68],[9,89],[91,89]];
  function blackjackStage() {
    const playing=game.phase==='playing',ready=game.phase==='ready';
    const others=ready?Array.from({length:settings.players-1},(_,i)=>({name:'Player '+(i+2),hands:[]})):game.others;
    return `<div class="table-pan" aria-label="Casino table; swipe horizontally on small screens" tabindex="0"><div class="casino-scene" style="--players:${settings.players}"><div class="dealer-at-table"><div class="seat-label">Dealer ${!ready?`<b>${tableBusy?'…':playing?value(game.dealer[0]):total(game.dealer).value}</b>`:''}<small>Stands on soft 17</small></div>${!ready?`<div class="scene-cards dealer-cards">${game.dealer.map((c,i)=>card(c,playing&&i===1)).join('')}</div>`:''}</div>${others.map((p,i)=>{const [x,y]=seatPositions[i];return `<div class="opponent-seat" style="left:${x}%;top:${y}%;--mobile-y:${[68,68,58,58,76,76][i]}%"><div class="seat-label">${p.name}${p.hands.length?`<b>${tableBusy?'…':p.hands.map(h=>total(h.cards).value).join(' / ')}</b>`:'<small>Ready</small>'}</div><div class="opponent-hands">${p.hands.map(h=>`<div class="scene-cards opponent-cards">${h.cards.map(c=>card(c)).join('')}</div>`).join('')}</div>${p.hands.length?`<div class="seat-result">${p.hands.map(h=>tableBusy?'Dealing':ready?'':!playing?h.result:total(h.cards).value>21?'Bust':h.cards.length===2&&total(h.cards).value===21?'Blackjack':'Stood').join(' · ')}</div>`:''}</div>`;}).join('')}<div class="your-seat ${playing?'your-turn':''} ${game.hands.length>1?'split-seat':''}"><div class="seat-label">You${ready?'<small>Ready to play</small>':''}</div>${ready?'<p class="ready-caption">Your table is ready.</p>':`<div class="your-table-hands">${game.hands.map((h,i)=>`<div class="your-table-hand ${playing&&i===game.active?'current':''}"><div class="your-hand-label">${game.hands.length>1?'Hand '+(i+1)+' · ':''}${tableBusy?'Dealing':(total(h.cards).soft?'Soft ':'')+total(h.cards).value}${!playing&&!tableBusy?' · '+h.result:''}</div><div class="scene-cards your-cards">${h.cards.map(c=>card(c)).join('')}</div></div>`).join('')}</div>`}</div></div></div><div class="table-mobile-hint">Swipe the table to see all seats ${icon('arrow')}</div><div class="round-caption" role="status">${tableBusy?'Cards are being dealt. Watch every exposed card.':playing?`Your ${total(game.hand.cards).soft?'soft':'hard'} ${total(game.hand.cards).value} against the dealer’s ${game.dealer[0].rank}.`:ready?'The other players follow basic strategy. Every seat shares your shoe.':game.hands.map((h,i)=>`${game.hands.length>1?'Hand '+(i+1)+': ':''}${h.result}`).join(' · ')+' · '+signed(game.net)+' practice units'}</div>`;
  }
  function blackjackControls() {
    const coach=game.phase==='playing'&&settings.coach&&!tableBusy;
    return `${coach?`<div class="strategist-inline" role="status"><span>${icon('book')}Strategist recommends <b>${game.advice}</b></span><p>${explain(game.hand.cards,game.dealer[0],game.advice)}</p></div>`:''}${game.phase!=='playing'?`<div class="session-controls"><button class="primary" data-action="dealHand" ${tableBusy?'disabled':''}>${icon('play')}${game.phase==='ready'?'Deal the table':'Next round'}</button><button class="text-button" data-action="tableSetup">Table setup${icon('settings')}</button></div>`:`<div class="session-controls blackjack-controls"><div class="table-action-row" role="group" aria-label="Play your hand">${[['hit','H'],['stand','S'],['double','D'],['split','P']].map(([a,k])=>`<button class="secondary" data-move="${a}" ${tableBusy||a==='double'&&!game.canDouble||a==='split'&&!game.canSplit?'disabled':''}>${a}<kbd>${k}</kbd></button>`).join('')}</div><button class="text-button" data-action="hint" ${tableBusy?'disabled':''}>${icon('eye')}Ask strategist</button></div>`}${tableBusy?'<button class="text-button finish-deal" data-action="finishDeal">Finish dealing now</button>':''}${game.events.length&&!tableBusy?`<details class="table-review"><summary>Other players’ hands & decisions</summary>${game.others.map(p=>`<div><b>${p.name}</b> ${p.hands.map(h=>h.cards.map(c=>c.rank+c.suit).join(' ')+' = '+total(h.cards).value).join(' | ')}<br><small>${game.events.filter(e=>e.seat===p.name).map(e=>e.move).join(' → ')}</small></div>`).join('')}</details>`:''}`;
  }
  function blackjackSettings() {
    return `<section class="settings table-settings"><div class="settings-heading"><h2>Your table</h2>${icon('settings')}</div><div class="setting-group"><label class="field-label" for="players">Players at the table</label><select id="players" ${game.phase==='playing'||tableBusy?'disabled':''}>${[1,2,3,4,5,6,7].map(n=>`<option value="${n}" ${settings.players===n?'selected':''}>${n} ${n===1?'player — just you':'players — you + '+(n-1)}</option>`).join('')}</select><p class="switch-desc">Includes you. Other seats play basic strategy. Finish this round or choose New shoe to change seats.</p></div><div class="setting-group table-speed-setting"><label class="field-label" for="tableSpeed">Dealing speed<span id="tableSpeedValue">${settings.tableSpeed.toFixed(2)}s / card</span></label><input type="range" id="tableSpeed" min="0.15" max="1.5" step="0.15" value="${settings.tableSpeed}" ${tableBusy?'disabled':''}><div class="range-labels"><span>Fast</span><span>Slow</span></div></div><div class="switch-row"><span class="switch-label" id="coachLabel">Strategist</span><button class="switch" role="switch" aria-checked="${settings.coach}" aria-labelledby="coachLabel" data-action="coach"><i></i></button></div><p class="switch-desc">${settings.coach?'Guidance before every move. Turn off to test your instincts and score unassisted decisions.':'Choose your move, then learn from the feedback. Ask for a hint whenever you need one.'}</p><hr><h3>Play by the book</h3><div class="strategy-rules"><div class="rule-line"><span>Shoe</span><strong>6 decks</strong></div><div class="rule-line"><span>Dealer on soft 17</span><strong>Stands</strong></div><div class="rule-line"><span>Blackjack payout</span><strong>3:2</strong></div><div class="rule-line"><span>Double after split</span><strong>Allowed</strong></div><div class="rule-line"><span>Surrender / insurance</span><strong>Not offered</strong></div></div><hr><h3>Your next move</h3><p class="coach-tip">${game.phase==='playing'&&(settings.coach||hinted)&&!tableBusy?`<strong>${game.advice}.</strong> ${explain(game.hand.cards,game.dealer[0],game.advice)}`:'Your strategist explains the best play for your hand and the dealer’s upcard, using standard six-deck S17 basic strategy.'}</p><button class="outline-button" data-view="strategy" style="width:100%;margin-top:20px">Open strategy chart${icon('arrow')}</button><button class="text-button back-to-table" data-action="backToTable">Back to table${icon('arrow')}</button><p class="units-note">Guided and hinted decisions are excluded from accuracy. Up to 4 split hands; one card to split aces. No real wagers.</p></section>`;
  }
  function strategy() {
    const ranks = ['2','3','4','5','6','7','8','9','10','A'];
    const rows = chartTab==='hard'?Array.from({length:14},(_,i)=>({label:String(i+5),cards:[{rank:'2'},{rank:String(i+3)}]})):chartTab==='soft'?Array.from({length:8},(_,i)=>({label:`A, ${i+2}`,cards:[{rank:'A'},{rank:String(i+2)}]})):['A','10','9','8','7','6','5','4','3','2'].map(r=>({label:r+', '+r,cards:[{rank:r},{rank:r}]}));
    // Hard rows above 12 require valid card ranks; hard 12 is 10+2, not a pair.
    if(chartTab==='hard') rows.forEach((r,i)=>{const n=i+5;r.cards=n<=11?[{rank:'2'},{rank:String(n-2)}]:[{rank:'10'},{rank:String(n-10)}];});
    return `<div class="page-heading"><div><h1>Make the right call.</h1><p>Your hand. Their upcard. A clear next move.</p></div><button class="outline-button" data-action="returnTable">${icon('cards')}Back to practice</button></div><p class="chart-intro">Read your hand down the left, then the dealer’s upcard across the top. Use pairs first, then soft totals, then hard totals. This reference uses six decks, S17, double after split, and no surrender.</p><div class="chart-tabs" role="group" aria-label="Strategy hand type">${[['hard','Hard totals'],['soft','Soft totals'],['pairs','Pairs']].map(([v,n])=>`<button data-chart="${v}" class="${chartTab===v?'active':''}" aria-pressed="${chartTab===v}">${n}</button>`).join('')}</div><section class="chart-panel"><h2>${chartTab==='hard'?'Hard totals':chartTab==='soft'?'Soft totals':'Pair strategy'}</h2><p class="rules-quiet" style="margin-top:5px">${chartTab==='hard'?'No ace counted as 11. Stand on all hard 17 and higher.':chartTab==='soft'?'An ace counted as 11. Soft 20 and 21 always stand.':'Split recommendations assume double after split is allowed.'}</p><div class="chart-scroll" tabindex="0" aria-label="Strategy chart; scroll horizontally on small screens"><table class="strategy-chart"><caption class="sr-only">${chartTab} six-deck strategy by dealer upcard</caption><thead><tr><th scope="col">Your hand</th>${ranks.map(r=>`<th scope="col">${r}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr><th scope="row">${r.label}</th>${ranks.map(d=>{const move=recommend(r.cards,{rank:d},{canDouble:true,canSplit:chartTab==='pairs'});const ds=move==='double'&&total(r.cards).soft&&total(r.cards).value===18;return `<td class="${move}" title="${move}${ds?' or stand if double unavailable':''}">${({hit:'H',stand:'S',double:ds?'Ds':'D',split:'P'})[move]}</td>`;}).join('')}</tr>`).join('')}</tbody></table></div><div class="chart-legend"><span><b>H</b> Hit</span><span><b>S</b> Stand</span><span><b>D</b> Double, otherwise hit</span><span><b>Ds</b> Double, otherwise stand</span><span><b>P</b> Split</span></div><p class="chart-notes">Doubling is available on the first two cards only. At the split limit, use the hand’s soft or hard total. Split aces receive one card each and cannot be resplit. A pair of 10-value cards stays together. Basic strategy makes the best statistical play; individual hands can still lose.</p><p class="chart-notes" style="margin-top:14px">Verified against <a href="https://www.blackjackapprenticeship.com/wp-content/uploads/2024/09/S17-Basic-Strategy.pdf" target="_blank" rel="noopener">Blackjack Apprenticeship’s S17 chart</a>, with surrender unavailable.</p></section>`;
  }
  function progress() {
    const pct=percentage;
    return `<div class="page-heading"><div><h1>Good habits add up.</h1><p>Your practice, saved on this device.</p></div><button class="outline-button" data-action="clearStats">${icon('reset')}Reset progress</button></div><div class="stats-overview"><div><label>Overall accuracy</label><strong>${accuracy()}</strong></div><div><label>Current streak</label><strong>${stats.streak}</strong></div><div><label>Best streak</label><strong>${stats.best}</strong></div><div><label>Cards practiced</label><strong>${stats.cards}</strong></div></div><div class="stats-detail"><section><h2>Count practice</h2><div class="stats-row"><span>Count answers checked</span><strong>${stats.fields}</strong></div><div class="stats-row"><span>Correct answers</span><strong>${stats.correct}</strong></div><div class="stats-row"><span>Count accuracy</span><strong>${pct(stats.correct,stats.fields)}</strong></div><div class="stats-row"><span>Checkpoints completed</span><strong>${stats.checkpoints}</strong></div></section><section><h2>Blackjack decisions</h2><div class="stats-row"><span>Unassisted decisions</span><strong>${stats.decisions}</strong></div><div class="stats-row"><span>Correct moves</span><strong>${stats.rightMoves}</strong></div><div class="stats-row"><span>Strategy accuracy</span><strong>${pct(stats.rightMoves,stats.decisions)}</strong></div><div class="stats-row"><span>Hands / net practice units</span><strong>${stats.rounds} / ${signed(stats.net)}</strong></div></section></div><p class="progress-note">Accuracy counts each submitted running / true count separately plus each unassisted strategy decision. A fully correct checkpoint or an unassisted correct move adds to your streak. Hints don’t affect it.</p><section class="history-section"><h2>Recent practice</h2>${stats.history.length?stats.history.slice(0,10).map(h=>`<div class="history-row"><span>${escapeHtml(h.time)}</span><div>${escapeHtml(h.text)}</div><strong class="${h.good?'positive':'negative'}">${h.good?'Correct':'Review'}</strong></div>`).join(''):'<p class="empty-history">Your first checkpoint or blackjack decision will show up here. A few minutes is a good place to start.</p>'}</section>`;
  }
  function escapeHtml(s) { return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function stopTimer() { clearTimeout(timer); timer=null; }
  function schedule() { stopTimer(); if(drill.phase==='running'&&settings.auto&&view==='training'&&mode==='count') timer=setTimeout(()=>{dealOne();schedule();},settings.speed*1000); }
  function dealOne() {
    if (!['running','paused'].includes(drill.phase)) return;
    const c=drill.shoe.draw();drill.cards.push(c);drill.segment.push(c);drill.cards=drill.cards.slice(-5);drill.latest=c.id;drill.since++;stats.cards++;
    if(drill.since>=settings.interval||!drill.shoe.cards.length) { drill.resume=drill.phase==='running';drill.phase='quiz';stopTimer(); }
    persist();render();
  }
  function countPrimary() {
    if(drill.phase==='idle'||drill.phase==='complete') { if(drill.phase==='complete') drill=newDrill();drill.phase='running';drill.started=Date.now();dealOne();schedule(); }
    else if(drill.phase==='running'&&settings.auto) {stopTimer();drill.phase='paused';render();}
    else if(drill.phase==='paused') {drill.phase='running';if(!settings.auto)dealOne();else render();schedule();}
    else if(drill.phase==='running'&&!settings.auto) dealOne();
  }
  function pause() {stopTimer();if(drill.phase==='running')drill.phase='paused';}
  function showView(next) {pause();if(tableBusy)cancelTableAnimation();view=next;if(next==='strategy'&&game.phase==='playing')hinted=true;render();window.scrollTo({top:0,behavior:'instant'});}
  function setMode(next) {pause();if(tableBusy)cancelTableAnimation();mode=next;view='training';render();centerYourSeat();}
  function cancelTableAnimation() {clearTimeout(tableTimer);revealTimers.forEach(clearTimeout);revealTimers=[];tableBusy=false;tableReveal=null;animatedCards=new Map();}
  function animateTable(before=new Set()) {
    cancelTableAnimation();
    const fresh=tableCards().filter(c=>!before.has(c.id)&&c.exposed).sort((a,b)=>(a.revealOrder||0)-(b.revealOrder||0));
    animatedCards=new Map(fresh.map((c,i)=>[c.id,i*settings.tableSpeed*1000]));
    tableReveal={running:game.shoe.running-fresh.reduce((n,c)=>n+tag(c),0),exposed:game.shoe.exposed-fresh.length,last:null,started:performance.now()};
    tableBusy=true;render();
    fresh.forEach((c,i)=>revealTimers.push(setTimeout(()=>{if(!tableReveal)return;tableReveal.running+=tag(c);tableReveal.exposed++;tableReveal.last=c.rank+c.suit+' ('+signed(tag(c))+')';refreshCountText();},i*settings.tableSpeed*1000+280)));
    tableTimer=setTimeout(()=>{tableBusy=false;tableReveal=null;animatedCards=new Map();revealTimers=[];render();},Math.max(0,fresh.length-1)*settings.tableSpeed*1000+350);
  }
  function centerYourSeat() {const pan=document.querySelector('.table-pan');if(!pan)return;const overflow=pan.scrollWidth>pan.clientWidth+1;if(overflow)pan.scrollLeft=(pan.scrollWidth-pan.clientWidth)/2;const hint=document.querySelector('.table-mobile-hint');if(hint)hint.hidden=!overflow;}
  function recordRound() {if(game.phase==='complete'&&!roundRecorded){stats.rounds++;stats.net+=game.net;roundRecorded=true;persist();}}
  function act(move) {
    if(game.phase!=='playing'||tableBusy)return;
    if(move==='double'&&!game.canDouble||move==='split'&&!game.canSplit)return;
    const advice=game.advice, good=move===advice, text=explain(game.hand.cards,game.dealer[0],advice);
    if(!hinted&&!settings.coach){stats.decisions++;if(good)stats.rightMoves++;score(good);log('strategy',`${total(game.hand.cards).soft?'Soft':'Hard'} ${total(game.hand.cards).value} vs ${game.dealer[0].rank}: ${move}${good?'':' → '+advice}`,good);}
    feedback={title:good?'Good call. '+advice[0].toUpperCase()+advice.slice(1)+'.':`Basic strategy says ${advice}.`,text,wrong:!good,note:hinted||settings.coach?'Assisted move — excluded from accuracy.':'Your chosen move was played. Strategy feedback is independent of the hand’s result.'};
    const before=new Set(tableCards().filter(c=>c.exposed).map(c=>c.id));game.act(move);hinted=false;recordRound();animateTable(before);
  }
  document.addEventListener('click',e=>{
    const b=e.target.closest('button,a[data-action]');if(!b||b.disabled)return;
    if(b.tagName==='A')e.preventDefault();
    if(b.dataset.view){showView(b.dataset.view);return;}
    if(b.dataset.mode){setMode(b.dataset.mode);return;}
    if(b.dataset.chart){chartTab=b.dataset.chart;render();return;}
    if(b.dataset.decks){settings.decks=Number(b.dataset.decks);stopTimer();drill=newDrill();persist();render();return;}
    if(b.dataset.auto){settings.auto=b.dataset.auto==='true';pause();persist();render();return;}
    if(b.dataset.move){act(b.dataset.move);return;}
    switch(b.dataset.action){
      case 'home':showView('training');break;
      case 'returnTable':showView('training');break;
      case 'help':pause();render();$('#helpDialog').showModal();break;
      case 'closeHelp':$('#helpDialog').close();break;
      case 'resetShoe':if(mode==='count'){stopTimer();drill=newDrill();}else{cancelTableAnimation();game=new TableGame(settings.players);feedback=null;hinted=false;roundRecorded=false;}render();break;
      case 'tableSetup':document.querySelector('.table-settings')?.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth'});break;
      case 'backToTable':document.querySelector('.table-trainer')?.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth'});break;
      case 'finishDeal':cancelTableAnimation();render();centerYourSeat();break;
      case 'restartCount':stopTimer();drill=newDrill();render();break;
      case 'countBubble':settings.countBubble=!settings.countBubble;persist();render();break;
      case 'toggleCount':settings.showCount=!settings.showCount;persist();render();break;
      case 'coach':settings.coach=!settings.coach;if(settings.coach&&game.phase==='playing')hinted=true;persist();render();centerYourSeat();break;
      case 'countPrimary':countPrimary();break;
      case 'nextCard':dealOne();break;
      case 'checkNow':if(drill.since&&['running','paused'].includes(drill.phase)){drill.resume=drill.phase==='running';stopTimer();drill.phase='quiz';render();}break;
      case 'continueCount':drill.since=0;drill.checkpointStart=drill.shoe.running;drill.segment=[];drill.answer=null;drill.phase=!drill.shoe.cards.length?'complete':drill.resume?'running':'paused';render();schedule();break;
      case 'practice':settings.practice=!settings.practice;persist();render();break;
      case 'dealHand':if(game.phase!=='playing'&&!tableBusy){feedback=null;hinted=!!settings.coach;roundRecorded=false;game.deal();recordRound();animateTable();}break;
      case 'hint':if(game.phase==='playing'&&!tableBusy){hinted=true;const move=game.advice;feedback={title:'Recommended move: '+move[0].toUpperCase()+move.slice(1)+'.',text:explain(game.hand.cards,game.dealer[0],move),wrong:false,note:'This decision is assisted and won’t affect your accuracy or streak.'};render();if(matchMedia('(max-width:760px)').matches)requestAnimationFrame(()=>document.querySelector('.feedback-panel')?.scrollIntoView({block:'nearest',behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth'}));}break;
      case 'clearStats':if(confirm('RESET YOUR SAVED PRACTICE STATISTICS? YOUR CURRENT SHOE WILL STAY IN PLACE.')){stats=emptyStats();persist();render();}break;
    }
  });
  document.addEventListener('input',e=>{
    if(e.target.id==='tableSpeed'){settings.tableSpeed=Number(e.target.value);document.querySelector('#tableSpeedValue').textContent=settings.tableSpeed.toFixed(2)+'s / card';persist();}
    if(e.target.id==='speed'){settings.speed=Number(e.target.value);$('#speedValue').textContent=settings.speed.toFixed(1)+'s / card';e.target.setAttribute('aria-valuetext',settings.speed+' seconds per card');persist();schedule();}
  });
  document.addEventListener('change',e=>{
    if(e.target.id==='players'){cancelTableAnimation();settings.players=Number(e.target.value);game=new TableGame(settings.players);feedback=null;hinted=false;roundRecorded=false;persist();render();centerYourSeat();}
    if(e.target.id==='interval'){settings.interval=Number(e.target.value);drill.since=0;persist();render();}
    if(e.target.id==='goal'){settings.goal=e.target.value;persist();render();}
  });
  document.addEventListener('submit',e=>{
    if(e.target.id!=='checkpointForm')return;e.preventDefault();
    if(drill.phase!=='quiz')return;
    const form=new FormData(e.target),q=quizFields(),lines=[];let good=true;
    const fields=[...(q.running?[['running',drill.shoe.running,'Running count']]:[]),...(q.true?[['true',drill.shoe.trueCount,'True count']]:[])];
    if(fields.some(([key])=>!/^[-+]?\d+$/.test(String(form.get(key)).trim())||!Number.isInteger(Number(form.get(key))))){drill.error='Enter a whole number for each count, including a minus sign when needed.';$('.form-error').innerHTML=`<p class="error-text">${drill.error}</p>`;return;}
    fields.forEach(([key,expected,label])=>{const n=Number(form.get(key)),correct=n===expected;stats.fields++;if(correct)stats.correct++;else good=false;lines.push(`${label}: you entered ${signed(n)}${correct?' — correct.':`; the count is ${signed(expected)}.`}`);});
    stats.checkpoints++;score(good);drill.answer={good,lines};drill.phase='feedback';drill.error='';log('count',`${drill.shoe.exposed} cards · RC ${signed(drill.shoe.running)}${q.true?' / TC '+signed(drill.shoe.trueCount):''}`,good);render();
  });
  document.addEventListener('keydown',e=>{
    if(e.ctrlKey||e.metaKey||e.altKey||e.repeat||$('#helpDialog').open||['INPUT','SELECT','TEXTAREA','BUTTON','A'].includes(e.target.tagName))return;
    if(view!=='training')return;
    if(e.code==='Space'){e.preventDefault();if(mode==='count')countPrimary();else if(game.phase!=='playing')$('[data-action="dealHand"]')?.click();}
    if(e.key.toLowerCase()==='n'){if(mode==='count'&&['running','paused'].includes(drill.phase)&&!(settings.auto&&drill.phase==='running'))dealOne();else if(mode==='blackjack'&&game.phase!=='playing')$('[data-action="dealHand"]')?.click();}
    if(mode==='blackjack'){const move=({h:'hit',s:'stand',d:'double',p:'split'})[e.key.toLowerCase()];if(move){e.preventDefault();act(move);}}
  });
  document.addEventListener('visibilitychange',()=>{if(document.hidden){pause();render();}});
  window.addEventListener('resize',centerYourSeat);
  uppercaseUi(document.querySelector('#helpDialog'));
  render();centerYourSeat();
})();
