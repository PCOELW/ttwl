/* TTWL packs navigation + persistent wallhop selection. No changes to app.js required. */
(() => {
  'use strict';
  const KEY = 'ttwl:selected-wallhops:v2';
  const $ = s => document.querySelector(s);
  const valid = ['pc','mobile','legacy'];
  const currentPlatform = () => $('.main-nav [data-platform].is-active')?.dataset.platform || location.hash.slice(1).toLowerCase() || 'pc';
  function readSaved() { try { const v=JSON.parse(localStorage.getItem(KEY)||'{}'); return v && typeof v==='object'?v:{}; } catch { return {}; } }
  function save(platform,title) {
    if (!valid.includes(platform)||!title) return;
    const value=readSaved(); value[platform]=title;
    try { localStorage.setItem(KEY, JSON.stringify(value)); } catch (_) {}
  }
  function makeSelectionLink(platform,title) {
    if (!valid.includes(platform) || !title) return;
    const url=new URL(location.href);
    url.searchParams.set('list',platform);
    url.searchParams.set('wallhop',title);
    url.hash=platform;
    try { history.replaceState(history.state,'',url.pathname+url.search+url.hash); } catch (_) {}
  }
  function installPacksTab() {
    const nav=$('.main-nav');
    if(!nav || nav.querySelector('.ttwl-packs-link'))return;
    const link=document.createElement('a');
    link.className='nav-item ttwl-packs-link';
    link.href='./packs.html'; link.textContent='Packs';
    const onPacks=/\/packs\.html$/i.test(location.pathname);
    if(onPacks){link.classList.add('is-active');link.setAttribute('aria-current','page');}
    const leader=nav.querySelector('a[href*="leaderboard.html"]');
    const legacy=nav.querySelector('[data-platform="legacy"], a[href*="#legacy"]');
    const mobile=nav.querySelector('[data-platform="mobile"], a[href*="#mobile"]');
    if(leader)leader.before(link);
    else if(legacy)legacy.after(link);
    else if(mobile)mobile.after(link);
    else nav.append(link);
  }
  function installSelectionPersistence(){
    const tbody=document.getElementById('rankingRows');
    if(!tbody)return;
    // Explicit links from leaderboard/packs take precedence over local storage.
    const incoming=new URLSearchParams(location.search);
    const direct=incoming.get('wallhop') && valid.includes(incoming.get('list'));
    const previous=readSaved();
    let restored=!!direct;
    let trying=false;
    function restore() {
      if(restored || trying)return;
      const platform=currentPlatform(), title=previous[platform];
      if(!title){restored=true;return;}
      const rows=[...tbody.querySelectorAll('tr')];
      const match=rows.find(tr=>tr.querySelector('.title-value')?.textContent?.trim().toLocaleLowerCase()===title.toLocaleLowerCase());
      if(match){
        restored=true;
        if(!match.classList.contains('is-selected')){
          trying=true; match.click(); trying=false;
        }
        makeSelectionLink(platform,title);
      }
    }
    tbody.addEventListener('click',e=>{
      const row=e.target.closest('tr'), title=row?.querySelector('.title-value')?.textContent?.trim();
      if(!title)return;
      const platform=currentPlatform();
      save(platform,title); makeSelectionLink(platform,title);
    },true);
    tbody.addEventListener('keydown',e=>{
      if(e.key!=='Enter' && e.key!==' ')return;
      const title=e.target.closest('tr')?.querySelector('.title-value')?.textContent?.trim();
      if(title){const p=currentPlatform();save(p,title);makeSelectionLink(p,title);}
    },true);
    const observer=new MutationObserver(()=>{restore();});
    observer.observe(tbody,{childList:true});
    restore();
    document.querySelectorAll('.main-nav [data-platform]').forEach(tab=>tab.addEventListener('click',()=>{
      restored=false;
      // Run after app.js switches the platform and renders its rows.
      queueMicrotask(()=>{ const p=currentPlatform(); const title=readSaved()[p];
        if(title){const match=[...tbody.querySelectorAll('tr')].find(tr=>tr.querySelector('.title-value')?.textContent?.trim()===title);
          if(match && !match.classList.contains('is-selected'))match.click();
          makeSelectionLink(p,title);
        } else {
          const url=new URL(location.href);url.searchParams.delete('list');url.searchParams.delete('wallhop');
          try{history.replaceState(history.state,'',url.pathname+url.search+url.hash);}catch(_){}
        }
        restored=true;
      });
    }));
  }
  function init(){
    document.title='TTWL';
    installPacksTab();
    installSelectionPersistence();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
