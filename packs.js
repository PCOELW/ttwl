/* The Top Wallhops: loads the public "Wallhop Packs" spreadsheet tab directly.
   Data layout: A pack heading; following records use A=Title, B=Difficulty,
   C=Tier, D=Verifier, E=Creator, F=Game, G=Video, H=Style, I=Attribute, J=Quality.
   Pack scores are NOT added to player leaderboard totals. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const config=window.WALLHOPS_CONFIG||{};
  const sheetName=String(config.packsSheetName||'Wallhop Packs');
  const state={packs:[],selected:'',rankings:{pc:[],mobile:[],legacy:[]},search:'',victors:null,victorsError:''};
  const norm=s=>String(s??'').normalize('NFKC').trim().replace(/[\u2018\u2019\u201b\u00b4\u0060]/g,"'").replace(/[\u2010-\u2015\u2212]/g,'-').replace(/\s+/g,' ').toLocaleLowerCase('en');
  const format=new Intl.NumberFormat('en-US');
  const cell=c=>{if(!c)return '';return String(c.f??c.v??'').trim();};
  const diffRe=/^\d+(?:[.,]\d+)?$/;
  const curve=Math.log(0.5)/Math.log(0.64);
  function pointsFor(raw){
    const v=String(raw||'').trim().replace(',','.');
    if(!/^[0-6](?:\.\d{1,2})?$/.test(v))return null;
    const n=Number(v),whole=Math.floor(n),hundredths=Math.round(n*100)-whole*100;
    return 100+whole*100+(hundredths===0?0:Math.max(1,Math.floor(100*((hundredths/100)**curve)+1e-9)));
  }
  function calculatePack(p){
    const valid=p.members.map(m=>Number(String(m.difficulty||'').replace(',','.'))).filter(n=>Number.isFinite(n)&&n>=0&&n<7);
    const points=p.members.map(m=>pointsFor(m.difficulty)).filter(n=>n!==null);
    // Do not silently calculate from a partial set of member difficulties.
    if(!p.members.length||valid.length!==p.members.length||points.length!==p.members.length)return {difficulty:null,points:null};
    return {difficulty:Math.ceil(valid.reduce((a,b)=>a+b,0)/valid.length),points:Math.round(points.reduce((a,b)=>a+b,0)/points.length)};
  }
  // Packs have no rank. Sort by the displayed, rounded-up pack difficulty,
  // using the unrounded member average only to order equally rated packs.
  // Stable original-sheet order is the final tiebreaker.
  function orderPacksByDifficulty(packs){
    const entries=packs.map((pack,index)=>{
      const difficulty=calculatePack(pack).difficulty;
      const values=pack.members.map(m=>Number(String(m.difficulty||'').trim().replace(',','.')));
      const valid=values.length>0&&values.every(n=>Number.isFinite(n)&&n>=0&&n<7);
      const mean=valid?values.reduce((a,b)=>a+b,0)/values.length:null;
      return {pack,index,difficulty,mean};
    });
    entries.sort((a,b)=>{
      if(a.difficulty===null)return b.difficulty===null?a.index-b.index:1;
      if(b.difficulty===null)return -1;
      return b.difficulty-a.difficulty||(b.mean-a.mean)||a.index-b.index;
    });
    return entries.map(item=>item.pack);
  }
  function spreadsheetId(){return String(config.spreadsheetUrl||'').match(/\/spreadsheets\/d\/([\w-]+)/)?.[1]||'';}
  let serial=0;
  function fetchGviz(tab){
    const id=spreadsheetId();if(!id)return Promise.reject(new Error('Spreadsheet URL is missing in config.js'));
    return new Promise((resolve,reject)=>{
      const name='__ttwlPacks'+(++serial)+'_'+Date.now();let done=false;
      const script=document.createElement('script');
      const timeout=setTimeout(()=>finish(new Error('Sheet request timed out')),16000);
      function finish(error,table){if(done)return;done=true;clearTimeout(timeout);script.remove();try{delete window[name]}catch(_){window[name]=undefined}if(error)reject(error);else resolve(table)}
      window[name]=response=>{
        if(String(response?.status).toLowerCase()!=='ok'||!response.table){
          const details=response?.errors?.map(e=>e.detailed_message||e.message).join('; ')||'Invalid sheet response';
          finish(new Error(details));return;
        }
        finish(null,response.table);
      };
      script.onerror=()=>finish(new Error('Cannot access the public spreadsheet tab'));
      const url=new URL('https://docs.google.com/spreadsheets/d/'+encodeURIComponent(id)+'/gviz/tq');
      url.search=new URLSearchParams({sheet:tab,headers:'0',tqx:'out:json;responseHandler:'+name,cacheBust:Date.now().toString()}).toString();
      script.src=url.href;document.head.appendChild(script);
    });
  }
  function parsePacks(table){
    const packs=[];let current=null;
    const columns=(table.cols||[]).map(c=>String(c.id||'').toUpperCase());
    const index=letter=>{const i=columns.indexOf(letter);return i===-1?letter.charCodeAt(0)-65:i;};
    const get=(row,letter)=>cell(row.c?.[index(letter)]);
    for(const row of table.rows||[]){
      const title=get(row,'A');if(!title)continue;
      const b=get(row,'B'), tier=get(row,'C');
      const joined=[b,tier,get(row,'D'),get(row,'E'),get(row,'F'),get(row,'G'),get(row,'H'),get(row,'I'),get(row,'J')].join('').trim();
      // Ignore the sheet title, repeated table headings and status labels.
      if (/^wallhop packs$/i.test(title)||/^wallhop title$/i.test(title)||/^\d+$/.test(title))continue;
      if(!joined && /\bpack\b/i.test(title)){
        current={id: 'pack-'+(packs.length+1),title,members:[]};packs.push(current);continue;
      }
      if(!current)continue;
      if(!diffRe.test(b.replace(/\s+/g,'')))continue;
      current.members.push({title,difficulty:b,tier});
    }
    return packs.filter(p=>p.members.length);
  }
  async function refreshLiveTitleIndex(){
    const tabs={pc:config.pcSheetName||'Top PC Wallhops',mobile:config.mobileSheetName||'Top Mobile Wallhops',legacy:config.legacySheetName||'Legacy List (PC)'};
    const outcomes=await Promise.allSettled(Object.entries(tabs).map(async ([platform,tab])=>{
      const table=await fetchGviz(tab);const titles=[];
      for(const row of table.rows||[]){
        const cells=row.c||[],rank=cell(cells[0]).replace(/[).]\s*$/,''),title=cell(cells[1]);
        if(Number.isSafeInteger(Number(rank))&&Number(rank)>0&&title)titles.push({title,rank:Number(rank)});
      }
      return {platform,titles};
    }));
    for(const result of outcomes){
      if(result.status!=='fulfilled'||!result.value.titles.length)continue;
      const {platform,titles}=result.value;
      const already=new Set(state.rankings[platform].map(r=>norm(r.title)));
      titles.forEach(row=>{if(!already.has(norm(row.title))){state.rankings[platform].push(row);already.add(norm(row.title));}});
    }
    renderDetails();
  }
  function renderError(e){
    const alert=$('packsAlert');alert.hidden=false;
    const msg=String(e?.message||e||'Unknown error');
    alert.textContent='Could not load the "Wallhop Packs" tab. Make sure that it exists and the spreadsheet is public. '+msg;
    if(!state.packs.length){$('packsList').replaceChildren();const p=document.createElement('p');p.className='packs-placeholder';p.textContent='No packs loaded.';$('packsList').append(p)}
  }
  function findRanked(member){
    const matches=[];
    for(const platform of ['pc','mobile','legacy'])for(const row of state.rankings[platform]||[]){
      if(norm(row.title)===norm(member.title))matches.push({platform,row});
    }
    return matches[0]||null;
  }
  function wallhopLink(member){
    const found=findRanked(member);if(!found)return null;
    const url=new URL('./index.html',location.href);
    url.searchParams.set('list',found.platform);url.searchParams.set('wallhop',found.row.title);url.hash=found.platform;
    return {url:url.href,platform:found.platform};
  }
  // Pack Victors are players with recorded completions for EVERY member.
  // Use each member's matching platform/version, not the pack's numerical rank.
  function memberVersion(member){
    const matches=[];
    for(const platform of ['pc','legacy','mobile']){
      for(const row of state.rankings[platform]||[]){
        if(norm(row.title)===norm(member.title))matches.push({platform,row});
      }
    }
    if(!matches.length)return null;
    const difficulty=Number(String(member.difficulty||'').trim().replace(',','.'));
    const exact=matches.filter(({row})=>Number.isFinite(difficulty)&&
      Math.abs(Number(String(row.difficulty??'').replace(',','.'))-difficulty)<0.0001);
    const candidates=exact.length?exact:matches;
    return candidates.find(c=>c.platform==='pc')||candidates.find(c=>c.platform==='legacy')||candidates[0];
  }
  function titleSignature(s){return norm(s).replace(/[^\p{L}\p{N}]+/gu,'');}
  function victorsFor(section,title){
    if(!section||typeof section!=='object'||Array.isArray(section))return null;
    const entries=Object.entries(section).filter(([,list])=>Array.isArray(list));
    const exact=entries.filter(([name])=>norm(name)===norm(title));
    if(exact.length===1)return exact[0][1];
    if(exact.length>1)return null;
    const sig=titleSignature(title);
    if(sig.length<4)return null;
    const fuzzy=entries.filter(([name])=>titleSignature(name)===sig);
    return fuzzy.length===1?fuzzy[0][1]:null;
  }
  function creditedVictors(platform,title){
    const fromPlatform=victorsFor(state.victors?.[platform],title);
    // Published 'all' is an alternative for the active PC/Mobile list; never
    // inherit its names for Legacy, which has a separate completion record.
    const fromAll=platform==='legacy'?null:victorsFor(state.victors?.all,title);
    const names=fromPlatform?.length?fromPlatform:(fromAll||fromPlatform||[]);
    const players=new Map();
    for(const raw of names){
      if(typeof raw!=='string')continue;
      const display=raw.trim(),key=norm(display);
      if(key&&!players.has(key))players.set(key,display);
    }
    return players;
  }
  function completedPackVictors(pack){
    if(!state.victors)return {status:state.victorsError?'error':'loading',names:[]};
    if(!pack.members.length)return {status:'empty',names:[]};
    // The published source can temporarily be a placeholder before sync.
    if(state.victors.status==='pending'||state.victors.status==='unavailable')
      return {status:'unavailable',names:[]};
    let shared=null;
    for(const member of pack.members){
      const found=memberVersion(member);
      if(!found)return {status:'unmatched',names:[]};
      const players=creditedVictors(found.platform,found.row.title);
      if(shared===null)shared=players;
      else for(const key of [...shared.keys()])if(!players.has(key))shared.delete(key);
      if(shared.size===0)break;
    }
    return {status:'ready',names:[...(shared?.values()||[])].sort((a,b)=>a.localeCompare(b,'en',{sensitivity:'base'}))};
  }
  function createPackVictorsPanel(){
    const detail=$('packDetails');if(!detail)return null;
    let panel=$('packVictorsPanel');if(panel)return panel;
    panel=document.createElement('section');panel.id='packVictorsPanel';panel.className='packs-victors';
    const heading=document.createElement('div');heading.className='packs-victors-heading';
    const title=document.createElement('h3');title.textContent='Victors';
    const count=document.createElement('span');count.id='packVictorsCount';
    heading.append(title,count);
    const list=document.createElement('ol');list.id='packVictorsList';list.className='packs-victors-list';
    panel.append(heading,list);detail.append(panel);
    return panel;
  }
  function renderPackVictors(pack){
    if(!createPackVictorsPanel())return;
    const count=$('packVictorsCount'),list=$('packVictorsList');
    list.replaceChildren();
    if(!pack){count.textContent='';return;}
    const result=completedPackVictors(pack);
    if(result.status!=='ready'||!result.names.length){
      count.textContent=result.status==='ready'?'0 players':'—';
      const empty=document.createElement('li');empty.className='packs-victors-empty';
      empty.textContent={loading:'Loading Victors...',error:'Could not load Victors.',
        unavailable:'Victors data is not available yet.',unmatched:'Some wallhops could not be matched to the list.',
        empty:'No wallhops in this pack.',ready:'No recorded full-pack completions.'}[result.status]||'No Victors available.';
      list.append(empty);return;
    }
    count.textContent=result.names.length+(result.names.length===1?' player':' players');
    const frag=document.createDocumentFragment();
    result.names.forEach((name,i)=>{
      const li=document.createElement('li');
      const a=document.createElement('a');a.href=new URL('./leaderboard.html?player='+encodeURIComponent(name)+'&tab=packs',location.href).href;
      const num=document.createElement('span');num.className='packs-victors-number';num.textContent=String(i+1).padStart(2,'0');
      const label=document.createElement('span');label.textContent=name;
      a.append(num,label);li.append(a);frag.append(li);
    });
    list.append(frag);
  }
  async function loadVictors(){
    try{
      const response=await fetch('./data/victors.json?t='+Date.now(),{cache:'no-store'});
      if(!response.ok)throw Error('HTTP '+response.status);
      const data=await response.json();
      if(!data||typeof data!=='object'||(!data.pc&&!data.legacy&&!data.all))throw Error('Invalid Victors format');
      state.victors=data;state.victorsError='';
    }catch(e){state.victorsError=String(e.message||e);console.warn('[TTWL pack Victors]',e);}
    renderPackVictors(state.packs.find(p=>p.id===state.selected)||state.packs[0]);
  }
  function renderDetails(){
    const pack=state.packs.find(p=>p.id===state.selected)||state.packs[0];
    $('packMembers').replaceChildren();
    if(!pack){$('packTitle').textContent='No pack selected';$('packDifficulty').textContent='—';$('packPoints').textContent='—';$('packCount').textContent='0';renderPackVictors(null);return;}
    $('packTitle').textContent=pack.title;
    const stat=calculatePack(pack);
    $('packDifficulty').textContent=stat.difficulty===null?'—':String(stat.difficulty);
    $('packPoints').textContent=stat.points===null?'—':format.format(stat.points);
    $('packCount').textContent=String(pack.members.length);
    const frag=document.createDocumentFragment();
    pack.members.forEach(member=>{
      const li=document.createElement('li');const linked=wallhopLink(member);
      const anchor=document.createElement(linked?'a':'span');
      if(linked)anchor.href=linked.url;
      else {anchor.className='packs-member-disabled';anchor.title='No matching wallhop found in the published ranking snapshot';}
      const title=document.createElement('span');title.className='packs-member-title';title.textContent=member.title;
      anchor.append(title);
      if(linked){const tag=document.createElement('span');tag.className='packs-member-tag';tag.textContent=linked.platform.toUpperCase();anchor.append(tag);}
      li.append(anchor);frag.append(li);
    });
    $('packMembers').append(frag);
    renderPackVictors(pack);
  }
  function renderList(){
    const found=state.packs.filter(p=>norm(p.title).includes(norm(state.search)));
    const list=$('packsList');const frag=document.createDocumentFragment();
    found.forEach(pack=>{
      const score=calculatePack(pack);
      const button=document.createElement('button');button.type='button';button.className='packs-card'+(state.selected===pack.id?' is-selected':'');
      button.setAttribute('aria-pressed',String(state.selected===pack.id));
      const text=document.createElement('span');const name=document.createElement('span');name.className='packs-card-name';name.textContent=pack.title;
      const meta=document.createElement('span');meta.className='packs-card-meta';meta.textContent=pack.members.length+' wallhops';text.append(name,meta);
      function stat(label,value){const wrap=document.createElement('span');wrap.className='packs-card-stat';const strong=document.createElement('strong');strong.textContent=value;wrap.append(strong,document.createTextNode(label));return wrap;}
      button.append(text,stat('Difficulty',score.difficulty===null?'—':String(score.difficulty)),stat('Points',score.points===null?'—':format.format(score.points)));
      button.addEventListener('click',()=>{
        state.selected=pack.id;try{localStorage.setItem('ttwl:selected-pack',pack.title);}catch(_){}
        try{const url=new URL(location.href);url.searchParams.set('pack',pack.title);
          history.replaceState(history.state,'',url.pathname+url.search+url.hash);}catch(_){}
        renderList();renderDetails();
      });
      frag.append(button);
    });
    if(!found.length){const msg=document.createElement('p');msg.className='packs-placeholder';msg.textContent=state.packs.length?'No packs match your search.':'Loading Wallhop Packs...';frag.append(msg);}
    list.replaceChildren(frag);$('packResults').textContent=found.length+' of '+state.packs.length+' packs';
    renderDetails();
  }
  async function loadSnapshot(){
    try {const response=await fetch('./data/rankings.json',{cache:'no-store'});if(!response.ok)throw Error('HTTP '+response.status);
      const d=await response.json();for(const platform of ['pc','mobile','legacy'])state.rankings[platform]=Array.isArray(d[platform])?d[platform]:[];
      renderDetails();
    } catch(e){console.warn('TTWL Packs: ranking snapshot unavailable',e);}
  }
  async function loadPacks(){
    try {const table=await fetchGviz(sheetName);const packs=parsePacks(table);
      if(!packs.length)throw new Error('No pack records found in the expected columns A–J');
      state.packs=orderPacksByDifficulty(packs);
      let saved='';try{saved=localStorage.getItem('ttwl:selected-pack')||'';}catch(_){}
      const requested=new URLSearchParams(location.search).get('pack')||'';
      const current=state.packs.find(p=>norm(p.title)===norm(requested))||state.packs.find(p=>p.title===saved);
      if(!state.selected || !state.packs.some(p=>p.id===state.selected))state.selected=current?.id||state.packs[0].id;
      $('packsAlert').hidden=true;renderList();
    }catch(e){renderError(e)}
  }
  function init(){
    $('packSearch').addEventListener('input',e=>{state.search=e.target.value;renderList()});
    loadSnapshot().then(refreshLiveTitleIndex);loadPacks();loadVictors();
    setInterval(()=>{if(!document.hidden)loadPacks()},30000);
    setInterval(()=>{if(!document.hidden)loadVictors()},120000);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
