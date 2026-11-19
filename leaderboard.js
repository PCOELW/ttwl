/* TTWL player leaderboard — no extra API, account, or spreadsheet required.
   Based exclusively on published data/rankings.json + data/victors.json.
   Hardest: lexicographic comparison of PC ranks first, then Legacy ranks.
   This prevents Legacy #1 from masking a current PC #1/#2/#3 clear.
   Total: PC completions only; Legacy and Mobile are not counted.
   Points: PC completions only; Legacy and Mobile are not counted.
   Player details show the PC list completion percentage (Legacy excluded).
   Same continuous Points formula as ttwl-points.js; never based on rank.
   Each player receives a unique sequential display rank in all modes. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const state = {mode:'hardest', search:'', completedSearch:'', players:[], profiles:new Map(),
    selected:'', tab:'wallhops', rankings:null, victors:null, totalPcWallhops:0, packs:[], packsError:'', packsLoading:true};
  const storageKey='ttwl:selected-leaderboard-player:v1';
  const modeKey='ttwl:leaderboard-sort:v1';
  const tabs=['wallhops','packs','verifications','creations'];
  const safeStorage={get(key){try{return localStorage.getItem(key)||'';}catch(_){return '';}},
    set(key,value){try{localStorage.setItem(key,value);}catch(_){}}};
  const text = x => String(x ?? '').trim();
  const pointsFormat = new Intl.NumberFormat('en-US');
  const CURVE = Math.log(0.5) / Math.log(0.64);
  function pointsFromDifficulty(raw){
    const value = text(raw).replace(',', '.');
    if (!/^[0-6](?:\.\d{1,2})?$/.test(value)) return null;
    const difficulty = Number(value);
    if (!Number.isFinite(difficulty) || difficulty < 0 || difficulty >= 7) return null;
    const integer = Math.floor(difficulty);
    const hundredths = Math.round(difficulty * 100) - integer * 100;
    return 100 + integer * 100 + (hundredths === 0 ? 0 : Math.max(1, Math.floor(100 * ((hundredths / 100) ** CURVE) + 1e-9)));
  }
  const canonical = x => text(x).normalize('NFKC').replace(/[\u200b-\u200f\u2060\ufeff]/g,'').replace(/[\u2018\u2019\u201b\u00b4\u0060]/g,"'").replace(/[\u2010-\u2015\u2212]/g,'-').replace(/\s+/g,' ').toLowerCase();
  const signature = x => canonical(x).replace(/[^\p{L}\p{N}]+/gu,'');
  const validName = x => /^[A-Za-z0-9_]{3,20}$/.test(text(x));
  const node = (tag, className, value) => {const n=document.createElement(tag);if(className)n.className=className;if(value!==undefined)n.textContent=value;return n;};
  // PC Wallhops and Legacy have independent rank scales. Compare the current
  // PC list first; use Legacy only after all compared PC records are tied.
  const platformPriority = platform => platform === 'pc' ? 0 : 1;
  const byRank = (a,b) => platformPriority(a.platform)-platformPriority(b.platform)
    || a.rank-b.rank || a.title.localeCompare(b.title,'en');
  function compareHardest(a,b){
    const x=a.clears, y=b.clears;
    for(let i=0;i<Math.min(x.length,y.length);i++){
      const first=platformPriority(x[i].platform)-platformPriority(y[i].platform);
      if(first)return first;
      if(x[i].rank!==y[i].rank)return x[i].rank-y[i].rank;
    }
    return y.length-x.length;
  }
  function compareTotal(a,b){return b.pcCount-a.pcCount;}
  function comparePoints(a,b){return b.totalXp-a.totalXp;}
  function compareByMode(a,b,mode){
    if (mode==='total') return compareTotal(a,b);
    if (mode==='points') return comparePoints(a,b);
    return compareHardest(a,b);
  }
  // Each mode gets unique consecutive ranking numbers even in a tie.
  // Points ties: Hardest, then number of clears, then username.
  // Total ties: Hardest, then username (same rule as the earlier leaderboard).
  function compareDisplay(a,b,mode){
    return compareByMode(a,b,mode)
      || (mode!=='hardest' ? compareHardest(a,b) : 0)
      || (mode==='points' ? compareTotal(a,b) : 0)
      || a.name.localeCompare(b.name,'en',{sensitivity:'base'});
  }
  function rankClass(rank){return rank<=3 ? ' top-'+rank : ''; }
  function matchedWallhop(title, rows){
    const exact=rows.filter(r=>canonical(r.title)===canonical(title));
    if(exact.length===1)return exact[0];
    const normalized=signature(title);
    if(normalized.length<4)return null;
    const candidates=rows.filter(r=>signature(r.title)===normalized);
    return candidates.length===1?candidates[0]:null;
  }
  function createPlayers(rankings,victors,mode='hardest'){
    const players=new Map(), platformNames=['pc','legacy'];
    const seenCompleted=new Set();
    let rejected=0, unmatched=0;
    for(const platform of platformNames){
      const rows=Array.isArray(rankings[platform]) ? rankings[platform]
        .filter(r=>r&&text(r.title)&&Number.isInteger(Number(r.rank))&&Number(r.rank)>0)
        .map(r=>({...r,rank:Number(r.rank),platform})) : [];
      const section=victors[platform];
      if(!section || typeof section!=='object' || Array.isArray(section))continue;
      for(const [wallhop,names] of Object.entries(section)){
        if(!Array.isArray(names))continue;
        const ranked=matchedWallhop(wallhop,rows);
        if(!ranked){unmatched++;continue;}
        for(const rawName of names){
          if(!validName(rawName)){rejected++;continue;}
          const playerName=text(rawName), key=playerName.toLowerCase();
          const distinct=key+'\u0000'+platform+'\u0000'+canonical(ranked.title);
          if(seenCompleted.has(distinct))continue;
          seenCompleted.add(distinct);
          if(!players.has(key))players.set(key,{key,name:playerName,clears:[],pcCount:0,totalXp:0});
          const player=players.get(key);
          // Legacy completions are still shown under the player, but never
          // contribute to Total, Points, or PC-list completion percentage.
          const xp=platform==='pc' ? pointsFromDifficulty(ranked.difficulty) : null;
          player.clears.push({rank:ranked.rank,title:ranked.title,platform,xp});
          if(platform==='pc'){
            player.pcCount++;
            if(xp!==null) player.totalXp+=xp;
          }
        }
      }
    }
    // Players with only Legacy completions remain visible in Hardest,
    // but cannot rank on the PC-only Total or Points leaderboards.
    const output=[...players.values()].filter(p=>mode==='hardest'||p.pcCount>0);
    output.forEach(p=>p.clears.sort(byRank));
    output.sort((a,b)=>compareDisplay(a,b,mode));
    output.forEach((p,i)=>{p.place=i+1;});
    return {players:output,rejected,unmatched};
  }
  // Profiles include credited creators even when they have not completed a wallhop.
  // Only players with recorded clears appear in the ranked player table.
  const ignoredCreditNames=new Set(['unknown','none','n/a','uncredited','anonymous','tbd','multiple']);
  function creditedNames(raw){
    return [...new Set(text(raw).split(/\s*(?:[,;，；]|\s+\/\s+|\s+\|\s+|\s+&\s+|\s+\+\s+|\s+(?:and|or)\s+)\s*/gi)
      .map(text).filter(n=>validName(n)&&!ignoredCreditNames.has(n.toLowerCase())))];
  }
  function belongsTo(name,raw){return creditedNames(raw).some(n=>canonical(n)===canonical(name));}
  function profileFor(name,profiles){
    const key=canonical(name);
    if(!profiles.has(key)) profiles.set(key,{key,name,clears:[],pcCount:0,totalXp:0,place:null,creations:[],verifications:[]});
    return profiles.get(key);
  }
  function buildProfiles(rankings,victors){
    const allCleared=createPlayers(rankings,victors,'hardest').players;
    const profiles=new Map(allCleared.map(p=>[p.key,{...p,creations:[],verifications:[]}]));
    const indexed={pc:new Map(),legacy:new Map(),mobile:new Map()};
    for(const platform of ['pc','legacy','mobile']){
      const rows=Array.isArray(rankings[platform])?rankings[platform]:[];
      for(const row of rows){
        if(!row||!text(row.title))continue;
        const key=canonical(row.title);
        if(!indexed[platform].has(key))indexed[platform].set(key,row);
        for(const name of creditedNames(row.creator)){
          const profile=profileFor(name,profiles);
          if(!profile.creations.some(c=>c.platform===platform&&canonical(c.title)===key))
            profile.creations.push({rank:Number(row.rank)||0,title:text(row.title),platform});
        }
      }
    }
    for(const profile of profiles.values()){
      for(const clear of profile.clears){
        const matching=indexed[clear.platform]?.get(canonical(clear.title));
        if(matching&&belongsTo(profile.name,matching.verifier))profile.verifications.push(clear);
      }
      profile.creations.sort(byRank);profile.verifications.sort(byRank);
    }
    return profiles;
  }
  function profileUrl(name,tab){
    const url=new URL('./leaderboard.html',location.href);
    url.searchParams.set('player',name);
    if(tabs.includes(tab)&&tab!=='wallhops')url.searchParams.set('tab',tab);
    return url.href;
  }
  function writeSelection(name){
    safeStorage.set(storageKey,canonical(name));
    try{
      const url=new URL(location.href);url.searchParams.set('player',name);
      if(state.tab==='wallhops')url.searchParams.delete('tab');else url.searchParams.set('tab',state.tab);
      history.replaceState(history.state,'',url.pathname+url.search+url.hash);
    }catch(_){}
  }
  // A pack counts as completed ONLY when every member has a verified completion
  // in the published PC/Legacy Victors data. Mobile-only entries cannot count.
  function completedPacks(profile){
    if(!Array.isArray(state.packs)||!state.packs.length)return [];
    const cleared=new Set(profile.clears.map(c=>c.platform+'\0'+canonical(c.title)));
    const output=[];
    for(const pack of state.packs){
      if(!pack.members.length)continue;
      const ok=pack.members.every(member=>{
        const title=canonical(member.title);
        const candidates=['pc','legacy','mobile'].flatMap(platform=>
          (state.rankings[platform]||[]).filter(r=>canonical(r.title)===title).map(r=>({platform,title:canonical(r.title),difficulty:Number(String(r.difficulty||'').replace(',','.'))})));
        if(!candidates.length)return false;
        // Match the specific version by sheet difficulty when the same title
        // occurs across multiple lists. Never count a Mobile-only completion.
        const targetDiff=Number(String(member.difficulty||'').replace(',','.'));
        const precise=candidates.filter(c=>Number.isFinite(targetDiff)&&Math.abs(c.difficulty-targetDiff)<0.0001);
        const choices=precise.length?precise:candidates;
        const target=choices.find(c=>c.platform==='pc')||choices.find(c=>c.platform==='legacy')||choices[0];
        return target.platform!=='mobile'&&cleared.has(target.platform+'\0'+target.title);
      });
      if(ok)output.push(pack);
    }
    return output;
  }
  function makePackLink(pack){
    const link=new URL('./packs.html',location.href);
    link.searchParams.set('pack',pack.title);
    return link.href;
  }
  function profileRows(profile){
    if(state.tab==='packs')return completedPacks(profile);
    if(state.tab==='verifications')return profile.verifications;
    if(state.tab==='creations')return profile.creations;
    return profile.clears;
  }
  function ensureDetailTabs(){
    if($('ttwlProfileTabs'))return;
    const heading=document.querySelector('.player-clears-head');
    if(!heading)return;
    const bar=node('div','ttwl-profile-tabs');bar.id='ttwlProfileTabs';bar.setAttribute('role','tablist');
    const labels={wallhops:'Wallhops',packs:'Packs',verifications:'Verifications',creations:'Creations'};
    for(const tab of tabs){
      const button=node('button','ttwl-profile-tab',labels[tab]);button.type='button';
      button.dataset.tab=tab;button.setAttribute('role','tab');
      button.addEventListener('click',()=>{
        if(state.tab===tab)return;
        state.tab=tab;state.completedSearch='';$('completedWallhopSearch').value='';
        const profile=state.profiles.get(state.selected);
        if(profile)writeSelection(profile.name);
        renderPlayerDetails(currentProfile());
      });
      bar.append(button);
    }
    heading.before(bar);
  }
  function currentVisiblePlayers(){
    const query=canonical(state.search);
    return state.players.filter(p=>!query||canonical(p.name).includes(query));
  }
  function currentProfile(){
    const visible=currentVisiblePlayers();
    // No search results: do not display or highlight an unrelated player.
    if(state.search.trim()&&!visible.length)return null;
    if(state.search.trim())return state.profiles.get(visible.find(p=>p.key===state.selected)?.key||visible[0]?.key)||null;
    return state.profiles.get(state.selected)||state.profiles.get(visible[0]?.key)||null;
  }
  let packSerial=0;
  function fetchPackData(){
    const cfg=window.WALLHOPS_CONFIG||{};
    const id=text(cfg.sheetId)||text(cfg.spreadsheetUrl).match(/\/spreadsheets\/d\/([\w-]+)/)?.[1];
    if(!id)return Promise.reject(new Error('Spreadsheet ID unavailable'));
    const tab=text(cfg.packsSheetName)||'Wallhop Packs';
    return new Promise((resolve,reject)=>{
      const callback='__ttwlProfilePack_'+(++packSerial)+'_'+Date.now();
      const script=document.createElement('script');let finished=false;
      const timer=setTimeout(()=>finish(new Error('Pack sheet request timed out')),12000);
      function finish(err,result){
        if(finished)return;finished=true;clearTimeout(timer);script.remove();
        try{delete window[callback];}catch(_){window[callback]=undefined;}
        if(err)reject(err);else resolve(result);
      }
      window[callback]=response=>{
        if(response?.status==='ok'&&response.table)finish(null,response.table);
        else finish(new Error('Pack sheet unavailable'));
      };
      script.onerror=()=>finish(new Error('Cannot load public Pack sheet'));
      const url=new URL('https://docs.google.com/spreadsheets/d/'+encodeURIComponent(id)+'/gviz/tq');
      url.search=new URLSearchParams({sheet:tab,headers:'0',tqx:'out:json;responseHandler:'+callback,
        cacheBust:String(Date.now())}).toString();
      script.src=url.href;document.head.append(script);
    });
  }
  function parsePackData(table){
    const packs=[];let pack=null;
    const cols=(table.cols||[]).map(c=>text(c.id).toUpperCase());
    const at=(row,letter)=>{let idx=cols.indexOf(letter);if(idx<0)idx=letter.charCodeAt(0)-65;
      const c=row.c?.[idx];return text(c?.f??c?.v);};
    for(const row of table.rows||[]){
      const name=at(row,'A'),difficulty=at(row,'B'),tier=at(row,'C');
      if(!name||/^(wallhop packs|wallhop title)$/i.test(name))continue;
      const joined=[difficulty,tier,...'DEFGHIJ'.split('').map(c=>at(row,c))].join('').trim();
      if(!joined&&/\bpack\b/i.test(name)){pack={title:name,members:[]};packs.push(pack);continue;}
      if(!pack||!/^[0-9]+(?:[.,][0-9]+)?$/.test(difficulty.replace(/\s+/g,'')))continue;
      pack.members.push({title:name,difficulty});
    }
    return packs.filter(p=>p.members.length);
  }
  async function loadPacks(){
    try{state.packs=parsePackData(await fetchPackData());state.packsError='';}
    catch(e){state.packsError=e.message;}
    finally{state.packsLoading=false;if($('selectedPlayerClears'))renderPlayerDetails(currentProfile());}
  }
  function makeWallhopLink(clear){
    const path=new URL('./index.html',location.href);
    path.searchParams.set('list',clear.platform);
    path.searchParams.set('wallhop',clear.title);
    path.hash=clear.platform;
    return path.href;
  }
  // Add one summary row using the existing leaderboard styling. No HTML/CSS
  // file change is necessary. This is intentionally idempotent.
  function addListCompletionField(){
    if($('selectedPlayerProgress'))return;
    const summary=document.querySelector('.player-details-summary');
    if(!summary)return;
    const field=node('div','player-list-progress');
    field.style.gridColumn='1 / -1';
    field.style.paddingTop='12px';
    field.style.borderTop='1px solid var(--line-2, #313d4d)';
    const label=node('span','', 'List Completion (PC only)');
    const value=node('strong','', '—');
    value.id='selectedPlayerProgress';
    value.style.fontVariantNumeric='tabular-nums';
    field.append(label,value);
    summary.append(field);
  }
  function completionPercent(pcCount,totalPc){
    return totalPc>0 ? (100*pcCount/totalPc).toFixed(2)+'%' : '—';
  }
  function displayCompletion(pcCount){
    const denominator=state.totalPcWallhops;
    return denominator>0
      ? `${completionPercent(pcCount,denominator)} (${pcCount}/${denominator})`
      : '—';
  }
  function renderPlayerDetails(player=currentProfile()){
    ensureDetailTabs();
    const list=$('selectedPlayerClears');
    const tabsBar=$('ttwlProfileTabs');
    if(tabsBar){
      for(const button of tabsBar.querySelectorAll('button[data-tab]')){
        const selected=button.dataset.tab===state.tab;
        button.classList.toggle('is-active',selected);
        button.setAttribute('aria-selected',String(selected));
        button.tabIndex=selected?0:-1;
      }
    }
    const titles={wallhops:'Completed Wallhops',packs:'Completed Packs',verifications:'Verifications',creations:'Creations'};
    const heading=document.querySelector('.player-clears-head h3');if(heading)heading.textContent=titles[state.tab];
    const searchInput=$('completedWallhopSearch');
    searchInput.placeholder='Search '+titles[state.tab].toLowerCase()+'...';
    searchInput.setAttribute('aria-label',searchInput.placeholder);
    if(!player){
      $('selectedPlayerRank').textContent='#—';$('selectedPlayerName').textContent=state.search.trim()?'No search results':'No player selected';
      $('selectedPlayerBest').textContent='—';$('selectedPlayerCount').textContent='0';
      $('selectedPlayerXp').textContent='0 Points';
      $('selectedPlayerProgress').textContent=displayCompletion(0);
      $('selectedPlayerCaption').textContent='0 shown';
      list.replaceChildren(node('li','player-empty',state.search.trim()?'No players match your search.':'Select a player to view details.'));
      return;
    }
    // A profile can be opened from the verifier/creator credits even if the
    // person has no recorded Victors. Such profiles have no leaderboard rank.
    $('selectedPlayerRank').textContent=player.place?'#'+player.place:'#—';
    $('selectedPlayerName').textContent=player.name;
    $('selectedPlayerBest').textContent=player.clears[0]?.title||'—';
    $('selectedPlayerCount').textContent=String(player.pcCount);
    $('selectedPlayerXp').textContent=pointsFormat.format(player.totalXp)+' Points';
    $('selectedPlayerProgress').textContent=displayCompletion(player.pcCount);
    const rows=profileRows(player);
    const query=canonical(state.completedSearch);
    const visible=rows.filter(item=>!query||canonical(item.title).includes(query));
    $('selectedPlayerCaption').textContent=state.tab==='packs'&&state.packsLoading
      ? 'Loading packs...' : (query?`${visible.length} of ${rows.length} shown`:`${rows.length} shown`);
    const frag=document.createDocumentFragment();
    if(!visible.length){
      let label='No '+titles[state.tab].toLowerCase()+' found.';
      if(query)label='No results match your search.';
      else if(state.tab==='packs'&&state.packsLoading)label='Loading packs...';
      else if(state.tab==='packs'&&state.packsError)label='Could not load Packs data.';
      frag.append(node('li','player-empty',label));
    }
    visible.forEach(entry=>{
      const li=node('li');const link=node('a');
      if(state.tab==='packs'){
        link.href=makePackLink(entry);
        link.append(node('span','player-clear-title',entry.title),node('span','player-clear-tag',entry.members.length+' wallhops'));
      }else{
        link.href=makeWallhopLink(entry);
        link.title='Open '+entry.title+' in '+entry.platform+' list';
        link.append(node('span','player-clear-rank'+rankClass(entry.rank),'#'+entry.rank),
          node('span','player-clear-title',entry.title),
          node('span','player-clear-tag',entry.platform==='legacy'?'Legacy':entry.platform.toUpperCase()));
      }
      li.append(link);frag.append(li);
    });
    list.replaceChildren(frag);
  }
  // In the split view, show the sorting metric alongside Rank and Player.
  // The original three metric cells are preserved; CSS exposes only the one
  // matching the active sort mode, so no ranking data or scores are changed.
  function updateLeaderboardMetric(){
    const table=document.querySelector('.leaderboard-table');
    if(!table)return;
    table.dataset.metric=['hardest','total','points'].includes(state.mode)?state.mode:'hardest';
    const headings=table.querySelectorAll('thead tr th');
    if(headings[3])headings[3].textContent='Total';
  }
  function renderPlayers(){
    updateLeaderboardMetric();
    const visible=currentVisiblePlayers();
    const selected=currentProfile();
    const frag=document.createDocumentFragment();
    if(!visible.length){
      const tr=node('tr','ttwl-no-results');
      const td=node('td','leaderboard-empty',state.players.length?'No players match your search.':'No players available.');
      td.colSpan=5;tr.append(td);frag.append(tr);
    }
    for(const player of visible){
      const tr=node('tr',player.key===selected?.key?'is-selected':'');tr.tabIndex=0;
      tr.setAttribute('aria-label',`Player ${player.name}, position ${player.place}. View player profile`);
      const place=node('td','leaderboard-place'+rankClass(player.place),'#'+player.place);
      const username=node('td','leaderboard-name',player.name);
      const best=node('td','leaderboard-best',player.clears[0]?.title||'—');
      best.title=player.clears[0]?`${player.clears[0].title} (#${player.clears[0].rank}, ${player.clears[0].platform.toUpperCase()})`:'No completions';
      const total=node('td','leaderboard-total',String(player.pcCount));
      const xp=node('td','leaderboard-xp',pointsFormat.format(player.totalXp));
      xp.title='Total Points from PC Wallhops only (Legacy excluded)';
      tr.append(place,username,best,total,xp);
      const choose=()=>{
        if(state.selected!==player.key){state.completedSearch='';$('completedWallhopSearch').value='';}
        state.selected=player.key;writeSelection(player.name);
        renderPlayers();
        if(window.innerWidth<=900)$('playerDetailsPanel').scrollIntoView({behavior:'smooth',block:'start'});
      };
      tr.addEventListener('click',choose);
      tr.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choose();}});
      frag.append(tr);
    }
    $('playerRankingRows').replaceChildren(frag);
    $('playerResults').textContent=`${visible.length} of ${state.players.length} players`;
    renderPlayerDetails(selected);
  }
  function recompute(){
    if(!state.rankings||!state.victors)return;
    const result=createPlayers(state.rankings,state.victors,state.mode);
    state.players=result.players;
    state.profiles=buildProfiles(state.rankings,state.victors);
    const requested=canonical(new URLSearchParams(location.search).get('player'));
    const saved=canonical(safeStorage.get(storageKey));
    if(!state.profiles.has(state.selected)){
      state.selected=[requested,saved,state.players[0]?.key].find(k=>k&&state.profiles.has(k))||'';
    }
    // Reflect CURRENT sort's position; other modes may exclude the profile.
    for(const profile of state.profiles.values())profile.place=null;
    for(const player of state.players){
      const profile=state.profiles.get(player.key);
      if(profile)profile.place=player.place;
    }
    const alerts=[];
    if(!state.players.length)alerts.push('No valid Victors were found for this ranking. Total and Points require PC completions.');
    else if(result.unmatched)alerts.push(`${result.unmatched} Victor entries did not match a ranked wallhop and were not counted.`);
    if(state.victors.status==='unavailable')alerts.push('The latest Victors import is marked unavailable.');
    $('leaderboardAlert').hidden=!alerts.length;
    $('leaderboardAlert').textContent=alerts.join(' ');
    renderPlayers();
  }
  async function readJson(filename){
    const r=await fetch('./data/'+filename+'?t='+Date.now(),{cache:'no-store'});
    if(!r.ok)throw new Error(`${filename}: HTTP ${r.status}`);
    return r.json();
  }
  async function refresh(){
    try{
      const [r,v]=await Promise.all([readJson('rankings.json'),readJson('victors.json')]);
      if(!r || !Array.isArray(r.pc) || !Array.isArray(r.legacy))throw new Error('Rankings JSON is missing PC or Legacy lists.');
      if(!v || !v.pc || !v.legacy)throw new Error('Victors JSON is missing PC or Legacy data.');
      state.rankings=r;state.victors=v;
      // Denominator: all ranked PC Wallhops (the same valid PC entries that
      // can contribute to the leaderboard). Neither Legacy nor Mobile count.
      state.totalPcWallhops=r.pc.filter(w=>w && text(w.title) && Number.isInteger(Number(w.rank)) && Number(w.rank)>0).length;
      const raw=v.updatedAt||r.updatedAt;
      const date=raw?new Date(raw):null;
      $('leaderboardUpdated').textContent='Victors last synced: '+(date&&!Number.isNaN(date.getTime())?date.toLocaleString(): 'not available')+'. Rankings and Victors are read from the published site data.';
      recompute();
    }catch(e){
      if(!state.players.length){$('playerRankingRows').replaceChildren((()=>{const tr=node('tr'),td=node('td','leaderboard-empty','Could not load the player leaderboard.');td.colSpan=5;tr.append(td);return tr;})());}
      $('leaderboardAlert').hidden=false;
      $('leaderboardAlert').textContent='Data could not be loaded: '+e.message+' Check that both data/rankings.json and data/victors.json are published.';
      console.warn('[TTWL leaderboard]',e);
    }
  }
  function init(){
    addListCompletionField();ensureDetailTabs();
    const params=new URLSearchParams(location.search);
    const urlTab=params.get('tab');
    if(tabs.includes(urlTab))state.tab=urlTab;
    const savedMode=safeStorage.get(modeKey);
    if(['hardest','total','points'].includes(savedMode))state.mode=savedMode;
    $('playerMode').value=state.mode;
    $('playerSearch').addEventListener('input',e=>{state.search=e.target.value;renderPlayers();});
    $('completedWallhopSearch').addEventListener('input',e=>{
      state.completedSearch=e.target.value;renderPlayerDetails(currentProfile());
    });
    $('playerMode').addEventListener('change',e=>{
      state.mode=['hardest','total','points'].includes(e.target.value)?e.target.value:'hardest';
      safeStorage.set(modeKey,state.mode);recompute();
    });
    refresh();loadPacks();
    setInterval(()=>{if(!document.hidden)refresh();},30000);
    setInterval(()=>{if(!document.hidden)loadPacks();},180000);
  }
  window.TTWLLeaderboardXP = Object.freeze({ calculate: pointsFromDifficulty });
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
