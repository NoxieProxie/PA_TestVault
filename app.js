/* ============ New World vault browser v2 ============ */
const BUILD_AT = '2026-11-26 16:34';
let DATA = {}, META = {}, NAMES = {}, SRC = 'snapshot', SRC_AT = BUILD_AT;
let current = null, hist = [], recent = [];

/* ---------- storage ---------- */
const LS = {
  get(k, d){ try { const v = localStorage.getItem(k); return v===null?d:JSON.parse(v); } catch(e){ return d; } },
  set(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch(e){ return false; } },
  del(k){ try { localStorage.removeItem(k); } catch(e){} }
};
let pins = LS.get('nw_pins', []);
recent = LS.get('nw_recent', []);


/* ---------- icons ---------- */
let ICO=null;
const WALIAS=[[/^(s&amp;s|s&s|sword (&amp;|&|and) shield|sword|shield)\b/i,'Sword and Shield'],[/^(hammer|war hammer)\b/i,'War Hammer'],
  [/^(gs|greatsword)\b/i,'Greatsword'],[/^great axe\b/i,'Great Axe'],[/^hatchet\b/i,'Hatchet'],[/^spear\b/i,'Spear'],[/^bow\b/i,'Bow'],
  [/^rapier\b/i,'Rapier'],[/^musket\b/i,'Musket'],[/^blunderbuss\b/i,'Blunderbuss'],[/^fire staff\b/i,'Fire Staff'],
  [/^ice gauntlet\b/i,'Ice Gauntlet'],[/^void gauntlet\b/i,'Void Gauntlet'],[/^life staff\b/i,'Life Staff'],[/^flail\b/i,'Flail']];
function walias(t){ t=stripTags(t||'').replace(/\*/g,'').trim(); for(const [re,w] of WALIAS) if(re.test(t)) return w; return ''; }
// icons ship as one WebP sprite sheet; cut it into small images once at load
async function sliceSprite(url, meta){
  const blob=await (await fetch(url)).blob();
  const bmp=await createImageBitmap(blob);
  const T=meta.tile, C=meta.cols, cv=document.createElement('canvas'); cv.width=T; cv.height=T;
  const cx=cv.getContext('2d'), out={};
  for(const k in meta.idx){ const i=meta.idx[k]; cx.clearRect(0,0,T,T); cx.drawImage(bmp,(i%C)*T,Math.floor(i/C)*T,T,T,0,0,T,T); out[k]=cv.toDataURL('image/webp'); }
  return out;
}
function icoFor(n,w){
  if(!ICO||!n) return '';
  n=stripTags(n).replace(/&amp;/g,'&').trim().replace(/\s+II$/,'');
  const k=(w&&ICO.ab[w+'|'+n])||ICO.perk[n]||ICO.perk[n+' II']||ICO.ab[n];
  return k&&ICO.img[k]?ICO.img[k]:'';
}
const IMG=(src,n)=>`<img class="ico" src="${src}" alt="" title="${esc(n)}">`;
function deco(html,w){
  if(!ICO) return html;
  let done=false;
  html=html.replace(/<strong>([^<]{3,60})<\/strong>/g,(m,n)=>{ const s=icoFor(n,w); if(s){ done=true; return IMG(s,n)+m; } return m; });
  if(done || /<[^>]+>/.test(html)) return html;
  const t=html.trim(); if(!t) return html;
  const s=icoFor(t,w); if(s) return IMG(s,t)+html;
  if(t.includes(', ')) return t.split(', ').map(x=>{ const s2=icoFor(x.replace(/\s*\(.*\)$/,''),w); return s2?IMG(s2,x)+x:x; }).join(', ');
  return html;
}

/* ---------- markdown ---------- */
const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
// remove HTML tags completely (repeats until nothing is left, then drops any stray < or >)
const unesc = s => String(s).replace(/&#39;/g,"'").replace(/&quot;/g,'"').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
function stripTags(s){ s=String(s==null?'':s); let p; do{ p=s; s=s.replace(/<[^<>]*>/g,''); }while(s!==p); return s.replace(/[<>]/g,''); }
function stripComments(s){ s=String(s==null?'':s); let p; do{ p=s; s=s.replace(/<!--[\s\S]*?-->/g,''); }while(s!==p); return s.replace(/<!--|-->/g,''); }
const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
function inline(s){
  s = esc(s);
  s = s.replace(/`([^`]+)`/g, (m,a)=>`<code>${a}</code>`);
  s = s.replace(/\[\[([^\]]+?)\]\]/g, (m, inner)=>{
    let [tgt, alias] = inner.split(/\\?\|/);
    tgt = unesc((tgt||'').trim()); alias = (alias||esc(tgt)).trim();
    if (tgt.startsWith('#')) return `<a class="wl" href="#" data-anchor="${esc(tgt.slice(1))}">${alias}</a>`;
    const base = tgt.split('#')[0].trim();
    if (NAMES[base]) return `<a class="wl" href="#" data-note="${esc(base)}">${alias}</a>`;
    return `<span class="wl dead" title="no page called ${esc(base)}">${alias}</span>`;
  });
  s = s.replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, (m,a,b)=>`<a href="${esc(unesc(b))}" target="_blank" rel="noopener">${a} &#8599;</a>`);
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');
  return s.replace(/\\\|/g,'|');
}
function splitRow(line){
  const out=[]; let cur='';
  for (let i=0;i<line.length;i++){
    const c=line[i];
    if (c==='\\' && line[i+1]==='|'){ cur+='\\|'; i++; continue; }
    if (c==='|'){ out.push(cur); cur=''; continue; }
    cur+=c;
  }
  out.push(cur);
  if (out.length && !out[0].trim()) out.shift();
  if (out.length && !out[out.length-1].trim()) out.pop();
  return out.map(c=>c.trim());
}
const CALLOUT={note:['&#8505;','note'],tip:['&#128161;','tip'],warning:['&#9888;','warn'],info:['&#128203;','info'],important:['&#10071;','warn'],danger:['&#128721;','warn']};
function md(src){
  const L=src.split('\n'); const out=[]; let i=0, para=[], ctxW='';
  const flush=()=>{ if(para.length){ out.push(`<p>${inline(para.join(' '))}</p>`); para=[]; } };
  while(i<L.length){
    const ln=L[i];
    if(!ln.trim()){ flush(); i++; continue; }
    const emb=ln.trim().match(/^!\[\[(.+?)\]\]$/);
    if(emb){ flush(); out.push(typeof embedHTML==='function'?embedHTML(emb[1]):''); i++; continue; }
    if(/^\s*\|/.test(ln) && i+1<L.length && /^\s*\|[\s:|-]+\|?\s*$/.test(L[i+1])){
      flush(); const head=splitRow(ln); i+=2; const rows=[];
      while(i<L.length && /^\s*\|/.test(L[i])){ rows.push(splitRow(L[i])); i++; }
      const wIdx=head.findIndex(h=>/^weapon$/i.test(h.replace(/\*/g,'').trim()));
      out.push(`<div class="tw"><table><thead><tr>${head.map(h=>`<th>${inline(h)}</th>`).join('')}</tr></thead><tbody>`+
        rows.map(r=>{ const w=(wIdx>=0&&walias(r[wIdx]))||ctxW; return `<tr>${r.map((c,ci)=>`<td>${ci===wIdx?inline(c):deco(inline(c),w)}</td>`).join('')}</tr>`; }).join('')+`</tbody></table></div>`);
      continue;
    }
    const co=ln.match(/^>\s*\[!(\w+)\]\s*(.*)$/i);
    if(co){
      flush(); const [ic,cls]=CALLOUT[co[1].toLowerCase()]||['&#8505;','note'];
      const txt=[co[2]]; i++;
      while(i<L.length && /^>/.test(L[i])){ txt.push(L[i].replace(/^>\s?/,'')); i++; }
      const lines=txt.join('\n').split('\n').filter(x=>x.trim());
      const lis=lines.filter(x=>/^\s*[-*]\s/.test(x));
      const lead=lines.filter(x=>!/^\s*[-*]\s/.test(x)).join(' ');
      const body=(lead?`<p>${inline(lead)}</p>`:'')+(lis.length?'<ul>'+lis.map(x=>`<li>${inline(x.replace(/^\s*[-*]\s/,''))}</li>`).join('')+'</ul>':'');
      out.push(`<div class="callout ${cls}"><span class="ci">${ic}</span><div>${body}</div></div>`);
      continue;
    }
    if(/^>/.test(ln)){ flush(); const t=[]; while(i<L.length&&/^>/.test(L[i])){ t.push(L[i].replace(/^>\s?/,'')); i++; } out.push(`<blockquote>${inline(t.join(' '))}</blockquote>`); continue; }
    const h=ln.match(/^(#{1,6})\s+(.*)$/);
    if(h){ flush(); const tx=h[2].replace(/^-#\s*/,''); const wa=walias(tx.replace(/^\d+\.\s*/,'')); if(h[1].length<=2) ctxW=wa||''; else if(wa) ctxW=wa;
      out.push(`<h${h[1].length} id="${slug(tx)}">${inline(tx)}</h${h[1].length}>`); i++; continue; }
    if(/^(-{3,}|\*{3,})\s*$/.test(ln)){ flush(); out.push('<hr>'); i++; continue; }
    if(/^\s*([-*]|\d+\.)\s+/.test(ln)){
      flush(); const ord=/^\s*\d+\./.test(ln); const items=[];
      while(i<L.length && /^\s*([-*]|\d+\.)\s+/.test(L[i])){ items.push(L[i].replace(/^\s*([-*]|\d+\.)\s+/,'')); i++; }
      out.push(`<${ord?'ol':'ul'}>${items.map(x=>`<li>${deco(inline(x),ctxW)}</li>`).join('')}</${ord?'ol':'ul'}>`);
      continue;
    }
    para.push(ln.replace(/^-#\s*/,'')); i++;
  }
  flush(); return out.join('\n');
}

/* ---------- index ---------- */
const ICONS=[[/my pages/i,'&#9998;'],[/build/i,'&#9876;'],[/boss/i,'&#128128;'],[/expedition/i,'&#128506;'],[/pvp/i,'&#128481;'],[/war/i,'&#127984;'],[/outpost/i,'&#128681;'],[/gear/i,'&#127890;'],[/reference/i,'&#128214;']];
const label = t => t.replace(/^\d+[\s._-]+/,'');
let TOPS=[], TOP_BUILDS='Builds', TOP_BOSSES='Bosses';
function reindex(){
  META={}; NAMES={};
  for (const p in DATA){
    // anything wrapped in <!-- web-hide --> ... <!-- /web-hide --> stays in Obsidian only; other HTML comments are dropped too
    const raw=stripComments(String(DATA[p]).replace(/<!--\s*web-hide[\s\S]*?<!--\s*\/web-hide\s*-->\n?/g,'')); let body=raw, tags=[], source='';
    const fm=raw.match(/^---\n([\s\S]*?)\n---\n?/);
    if(fm){ body=raw.slice(fm[0].length);
      const t=fm[1].match(/tags:\s*\[(.*?)\]/); if(t) tags=t[1].split(',').map(s=>s.trim()).filter(Boolean);
      const s=fm[1].match(/source:\s*(.*)/); if(s) source=s[1].trim(); }
    const parts=p.split('/'); const name=parts[parts.length-1].replace(/\.md$/,'');
    META[p]={name, folder:parts.slice(0,-1).join('/'), tags, source, body, path:p};
    NAMES[name]=p;
  }
  if(typeof injectCustom==='function') injectCustom();
  TOPS=[...new Set(Object.keys(META).filter(p=>p.includes('/')).map(p=>p.split('/')[0]))].sort();
  TOP_BUILDS=TOPS.find(t=>/build/i.test(t))||'Builds';
  TOP_BOSSES=TOPS.find(t=>/boss/i.test(t))||'Bosses';
}
const sectionOf = p => p.includes('/') ? label(p.split('/')[0]) : 'Home';
const iconOf = t => (ICONS.find(([re])=>re.test(t))||[,'&#128196;'])[1];

/* ---------- top nav ---------- */
function navTabs(){
  const hid=(typeof SITE!=='undefined'&&SITE.hidden)||[];
  const T=[];
  T.push({k:'Home', h:`<button class="nb" data-note="${esc((typeof SITE!=='undefined'&&NAMES[SITE.start])?SITE.start:'New World Home')}">&#127968; Home</button>`});
  T.push({k:'Items', h:`<button class="nb calcnb" data-view="items">&#128270; Items</button>`});
  T.push({k:'Loadout', h:`<button class="nb calcnb" data-view="gear">&#128737; Loadout</button>`});
  T.push({k:'Calculator', h:`<button class="nb calcnb" data-view="calc">&#129518; Calculator</button>`});
  if(typeof myLoMenu==='function') T.push({k:'Your loadouts', h:`<div class="drop"><button class="nb">&#128190; Your loadouts <span class="car">&#9662;</span></button><div class="menu">${myLoMenu()}</div></div>`});
  if(typeof canWrite==='function' && canWrite() && !TOPS.includes('My Pages'))
    T.push({k:'My Pages', h:`<div class="drop"><button class="nb">&#9998; My Pages <span class="car">&#9662;</span></button><div class="menu"><a class="mi hi" data-newpage="1">&#65291; New page</a><div class="mn">Pages you write yourself show up here.</div></div></div>`});
  for (const t of TOPS){
    const paths=Object.keys(META).filter(p=>p.startsWith(t+'/')).sort();
    const groups={};
    paths.forEach(p=>{ const rel=p.slice(t.length+1); const sub=rel.includes('/')?rel.split('/')[0]:''; (groups[sub]=groups[sub]||[]).push(p); });
    const extra = /build/i.test(t) ? `<a class="mi hi" data-view="builds">&#9881; Build browser (filterable)</a>`
               : /boss/i.test(t) ? `<a class="mi hi" data-view="bosses">&#9881; Boss browser (filterable)</a>`
               : (/my pages/i.test(t) && typeof canWrite==='function' && canWrite()) ? `<a class="mi hi" data-newpage="1">&#65291; New page</a>` : '';
    let menu = extra;
    for (const g of Object.keys(groups).sort()){
      if (g) menu += `<div class="mh">${esc(label(g))}</div>`;
      menu += groups[g].map(p=>`<a class="mi" data-note="${esc(META[p].name)}">${esc(META[p].name)}</a>`).join('');
    }
    T.push({k:label(t), h:`<div class="drop"><button class="nb">${iconOf(t)} ${esc(label(t))} <span class="car">&#9662;</span></button><div class="menu">${menu}</div></div>`});
  }
  const order=(typeof SITE!=='undefined'&&SITE.order)||[];
  const pos=k=>{ const i=order.indexOf(k); return i<0?1000:i; };
  return T.map((t,i)=>({...t,i})).sort((a,b)=>pos(a.k)-pos(b.k)||a.i-b.i).map(t=>({...t,hidden:hid.includes(t.k)}));
}
function topnav(){
  const own=typeof canWrite==='function' && canWrite();
  let h = navTabs().filter(t=>!t.hidden).map(t=>`<span class="tabw" ${own?'draggable="true"':''} data-tabkey="${esc(t.k)}">${t.h}</span>`).join('');
  if(own) h += `<span class="dragtip">drag tabs to reorder</span>`;
  h += `<div class="drop right"><button class="nb" id="starbtn">&#9733; <span id="pincount"></span><span class="car">&#9662;</span></button><div class="menu" id="pinmenu"></div></div>`;
  h += `<div class="drop right"><button class="nb">&#8635; Data<span class="car">&#9662;</span></button><div class="menu" id="datamenu"></div></div>`;
  if(own) h += `<button class="nb" id="gearbtn" title="Customise">&#9881;</button>`;
  document.getElementById('topnav').innerHTML = h;
  renderPinMenu(); renderDataMenu();
  if(own) wireTabDrag();
}
let dragKey=null;
function wireTabDrag(){
  document.querySelectorAll('.tabw[draggable]').forEach(el=>{
    el.addEventListener('dragstart',e=>{ dragKey=el.dataset.tabkey; el.classList.add('dragging'); try{ e.dataTransfer.setData('text/plain',dragKey); e.dataTransfer.effectAllowed='move'; }catch(_){} document.querySelectorAll('.drop').forEach(x=>x.classList.remove('open')); });
    el.addEventListener('dragend',()=>{ el.classList.remove('dragging'); document.querySelectorAll('.tabw').forEach(x=>x.classList.remove('over-l','over-r')); dragKey=null; });
    el.addEventListener('dragover',e=>{ if(!dragKey||dragKey===el.dataset.tabkey) return; e.preventDefault();
      const r=el.getBoundingClientRect(), left=e.clientX<r.left+r.width/2;
      el.classList.toggle('over-l',left); el.classList.toggle('over-r',!left); });
    el.addEventListener('dragleave',()=>el.classList.remove('over-l','over-r'));
    el.addEventListener('drop',e=>{ e.preventDefault(); e.stopPropagation(); if(!dragKey) return;
      const r=el.getBoundingClientRect(), left=e.clientX<r.left+r.width/2;
      moveTab(dragKey, el.dataset.tabkey, left); });
  });
}
async function moveTab(from, to, before){
  const keys=navTabs().map(t=>t.k).filter(k=>k!==from);
  let i=keys.indexOf(to); if(i<0) return; if(!before) i++;
  keys.splice(i,0,from);
  await saveSite(Object.assign({},SITE,{order:keys})); topnav();
}
function renderPinMenu(){
  document.getElementById('pincount').textContent = pins.length ? pins.length : '';
  const m = document.getElementById('pinmenu');
  const pl = pins.filter(n=>NAMES[n]);
  const rl = recent.filter(n=>NAMES[n]).slice(0,8);
  m.innerHTML = (pl.length ? `<div class="mh">Pinned</div>` + pl.map(n=>`<a class="mi" data-note="${esc(n)}">${esc(n)}</a>`).join('')
                           : `<div class="mn">Press &#9734; on any page to pin it</div>`)
    + (rl.length ? `<div class="mh">Recent</div>` + rl.map(n=>`<a class="mi" data-note="${esc(n)}">${esc(n)}</a>`).join('') : '');
}
function renderDataMenu(){
  const n = Object.keys(META).length;
  document.getElementById('datamenu').innerHTML =
    `<div class="mh">Loaded</div>
     <div class="mn"><b>${n} pages</b> &middot; ${SRC==='snapshot'?'built-in snapshot':SRC==='saved'?'your folder, saved to the page':'your own folder'}<br>${esc(SRC_AT)}</div>
     ${(typeof canWrite==='function'&&canWrite()&&!GHMODE)?`<a class="mi hi" id="pickfolder">&#128193; Load my vault folder&hellip;</a>`:`<div class="mn tiny">&#128274; Read-only. Only the page's owner can change what's shown here.</div>`}
     ${(typeof canWrite==='function'&&canWrite()&&!GHMODE)?`<div class="mn tiny">Pick the <b>New World</b> folder in your vault. ${(typeof CMODE!=='undefined'&&CMODE==='db'&&IS_OWNER)?'The pages are saved into this page\'s own storage, so they stay put between sessions and show on every device. Only you can change them.':'The page reads the .md files in your browser and remembers them in this browser.'}</div>`:''}
     ${SRC!=='snapshot'&&typeof canWrite==='function'&&canWrite()&&!GHMODE?`<a class="mi" id="resetdata">&#8634; Back to the built-in snapshot</a>`:''}
     ${(typeof canWrite==='function'&&canWrite())?`<div class="mh">Adding or changing things</div>
     <div class="mn tiny">${GHMODE?'The pages come from your Obsidian vault (Publish public site.bat). ':''}<b>&#9998; Edit</b> (top right of any page) changes that page. <b>Add your own notes</b> sits at the bottom of every page. <b>My Pages &rarr; New page</b> makes a page of your own. <b>&#9881;</b> changes the look.</div>`:''}`;
  const pf=document.getElementById('pickfolder'); if (pf) pf.onclick=pickFolder;
  const rd=document.getElementById('resetdata');
  if (rd) rd.onclick=async ()=>{ LS.del('nw_vault'); LS.del('nw_vault_at'); if(typeof clearVaultDb==='function') await clearVaultDb(); location.reload(); };
}

/* ---------- load from a local folder ---------- */
function pickFolder(){
  if(!(typeof canWrite==='function'&&canWrite())){ toast('Only the owner can load a vault folder'); return; }
  const inp=document.createElement('input');
  inp.type='file'; inp.multiple=true;
  inp.webkitdirectory=true; inp.setAttribute('webkitdirectory',''); inp.setAttribute('directory','');
  inp.onchange=async ()=>{
    const files=[...inp.files].filter(f=>f.name.toLowerCase().endsWith('.md'));
    if(!files.length){ toast('No .md files in that folder'); return; }
    const obj={};
    for(const f of files){
      let rel=f.webkitRelativePath||f.name;
      const bits=rel.split('/'); if(bits.length>1) bits.shift();
      rel=bits.join('/');
      if(/(^|\/)\./.test(rel)) continue;
      obj[rel]=await f.text();
    }
    applyData(obj,'folder',new Date().toLocaleString());
    const ok=LS.set('nw_vault',obj)&&LS.set('nw_vault_at',SRC_AT);
    persistVault(obj, ok);
  };
  inp.click();
}
async function persistVault(obj, okLocal){
  const n=Object.keys(obj).length;
  if(typeof saveVaultToDb==='function' && typeof CMODE!=='undefined' && CMODE==='db' && IS_OWNER){
    toast(`Loaded ${n} pages, saving them to the page…`);
    const r=await saveVaultToDb(obj, SRC_AT);
    if(r===true){ SRC='saved'; renderDataMenu(); toast(typeof drafting==='function'&&drafting()?`Saved ${n} pages as a draft. Press Publish to live when you're ready`:`Saved ${n} pages to the page: they'll be here next session, on any device`); return; }
    toast(`Loaded ${n} pages, but saving to the page failed (${r}). ${okLocal?'Kept in this browser instead.':'This session only.'}`); return;
  }
  toast(`Loaded ${n} pages from your folder${okLocal?' and remembered them in this browser':' (too big to remember, this session only)'}`);
}
function applyData(obj, src, at, keep){
  DATA=obj; SRC=src; SRC_AT=at; reindex(); topnav();
  if(keep && current){ if(current.kind==='note'&&NAMES[current.name]) openNote(current.name,false); return; }
  openNote(NAMES['New World Home']?'New World Home':META[Object.keys(META)[0]].name,false);
}
function toast(msg){
  let t=document.getElementById('toast');
  if(!t){ t=document.createElement('div'); t.id='toast'; document.body.appendChild(t); }
  t.textContent=msg; t.className='show';
  clearTimeout(t._h); t._h=setTimeout(()=>t.className='',4200);
}

/* ---------- browsers ---------- */
const ROLES=[['tank','Tank'],['bruiser','Bruiser'],['melee','Melee'],['ranged','Ranged'],['healer','Healer'],['caster','Caster']];
const MODES=['Expeditions & raids','3v3 Arenas','Outpost Rush','Capture the Flag','Wars','Duels','FFA zone','Influence races','Open-world PvP','Open-world PvE'].map(m=>[m,m]);
// the "| Modes |" row of a build note -> ['3v3 Arenas', 'Outpost Rush', ...]
function noteModes(body){
  const m=body.match(/^\|\s*Modes\s*\|(.*)\|\s*$/m); if(!m) return [];
  return [...m[1].matchAll(/\[\[([^\]]+?)\]\]/g)].map(x=>{ const s=x[1].split(/\\?\|/); return (s[1]||s[0]).trim(); });
}
const WEAPONS=[['sword-and-shield','Sword & Shield'],['war-hammer','War Hammer'],['greatsword','Greatsword'],['great-axe','Great Axe'],['spear','Spear'],['hatchet','Hatchet'],['bow','Bow'],['rapier','Rapier'],['musket','Musket'],['blunderbuss','Blunderbuss'],['fire-staff','Fire Staff'],['ice-gauntlet','Ice Gauntlet'],['void-gauntlet','Void Gauntlet'],['life-staff','Life Staff'],['flail','Flail']];
let filt={role:new Set(),mode:new Set(),weapon:new Set()}, bfilt={exp:'',dmg:''};
const buildPaths = () => Object.keys(META).filter(p=>p.startsWith(TOP_BUILDS+'/') && META[p].tags.includes('builds') && !/Builds\.md$|Gear Basics|Gear Rules|Activities/.test(p));
function kv(body){ const o={}; body.split('\n').forEach(l=>{ const c=splitRow(l); if(c.length===2) o[c[0].replace(/\*/g,'')]=c[1]; }); return o; }
function viewBuilds(){
  const chips=(k,l)=>l.map(([v,t])=>`<button class="chip ${filt[k].has(v)?'on':''}" data-f="${k}" data-v="${v}">${t}</button>`).join('');
  const all=buildPaths();
  const shown=all.filter(p=>{ const t=META[p].tags; const ok=k=>filt[k].size===0||[...filt[k]].every(v=>t.includes(v)); const md=noteModes(META[p].body); const okm=filt.mode.size===0||[...filt.mode].some(v=>md.includes(v)); return ok('role')&&okm&&ok('weapon'); });
  const card=p=>{ const m=META[p]; const q=kv(m.body);
    const title=(m.body.match(/^#\s+(.*)$/m)||[,m.name])[1];
    const sum=(m.body.split('\n').find(l=>l.trim()&&!/^[#>|]/.test(l)&&!l.startsWith('Related'))||'').replace(/\*\*/g,'');
    return `<div class="card" data-note="${esc(m.name)}"><div class="ct">${inline(title)}</div>
      <div class="cs">${inline(sum.slice(0,165))}</div>
      <div class="cmeta">${['Role','Modes','Armor','Attributes'].filter(k=>q[k]).map(k=>`<span><b>${k}</b> ${inline(q[k])}</span>`).join('')}</div>
      <div class="ctags">${m.tags.filter(t=>!['new-world','builds'].includes(t)).map(t=>`<span class="tag">${t}</span>`).join('')}</div></div>`; };
  return `<h1>Build browser</h1><p class="lede">${all.length} builds. Stack the filters, then click one.</p>
   <div class="filters" data-h="Filter builds"><div class="frow"><span class="fl">Role</span>${chips('role',ROLES)}</div>
   <div class="frow"><span class="fl">Mode</span>${chips('mode',MODES)}</div>
   <div class="frow"><span class="fl">Weapon</span>${chips('weapon',WEAPONS)}</div>
   <button class="clear" id="clearf">Clear all</button></div>
   <div class="count">${shown.length} of ${all.length}</div>
   <div class="cards">${shown.map(card).join('')||'<p class="empty">Nothing matches that combination.</p>'}</div>`;
}
function bossRows(){
  return Object.keys(META).filter(p=>p.startsWith(TOP_BOSSES+'/') && p.split('/').length>2).map(p=>{
    const m=META[p], q=kv(m.body);
    return {name:m.name, exp:p.split('/')[1], exact:(q['Exact damage taken (nwdb)']||'').replace(/\*/g,''),
            mit:q['Damage mitigation']||'', weak:q['Weak to (guide)']||'',
            tank:(m.body.match(/\*\*Your job as tank:\*\*\s*(.*)/)||[,''])[1]};
  }).sort((a,b)=>a.exp.localeCompare(b.exp)||a.name.localeCompare(b.name));
}
function viewBosses(){
  const rows=bossRows(); const exps=[...new Set(rows.map(r=>r.exp))].sort();
  const dmgs=['Slash','Thrust','Strike','Fire','Ice','Nature','Lightning','Void','Arcane'];
  const shown=rows.filter(r=>(!bfilt.exp||r.exp===bfilt.exp)&&(!bfilt.dmg||(r.exact+r.weak).toLowerCase().includes(bfilt.dmg.toLowerCase())));
  return `<h1>Boss browser</h1><p class="lede">${rows.length} bosses. Filter by expedition, or by what they take extra damage from.</p>
  <div class="filters" data-h="Filter bosses"><div class="frow"><span class="fl">Expedition</span>${['',...exps].map(e=>`<button class="chip ${bfilt.exp===e?'on':''}" data-bf="exp" data-v="${esc(e)}">${esc(label(e))||'All'}</button>`).join('')}</div>
  <div class="frow"><span class="fl">Weak to</span>${['',...dmgs].map(d=>`<button class="chip ${bfilt.dmg===d?'on':''}" data-bf="dmg" data-v="${d}">${d||'All'}</button>`).join('')}</div></div>
  <div class="count">${shown.length} of ${rows.length}</div>
  <div class="tw"><table><thead><tr><th>Boss</th><th>Expedition</th><th>Exact damage taken</th><th>Mitigation</th><th>Your job as tank</th></tr></thead><tbody>
  ${shown.map(r=>`<tr><td><a class="wl" href="#" data-note="${esc(r.name)}">${esc(r.name)}</a></td><td>${esc(label(r.exp))}</td><td>${esc(r.exact)||'&ndash;'}</td><td>${esc(r.mit)||'&ndash;'}</td><td class="small">${esc(r.tank)}</td></tr>`).join('')}
  </tbody></table></div>`;
}

/* ---------- search ---------- */
function search(q){
  q=q.trim().toLowerCase(); if(!q) return null;
  const hits=[];
  for(const p in META){ const m=META[p];
    const inName=m.name.toLowerCase().includes(q); const idx=m.body.toLowerCase().indexOf(q);
    if(!inName && idx<0) continue;
    let snip=''; if(idx>=0){ const s=Math.max(0,idx-70),e=Math.min(m.body.length,idx+130); snip=m.body.slice(s,e).replace(/\n/g,' ').replace(/\|/g,' &middot; '); }
    hits.push({m,p,score:inName?0:1,snip});
  }
  hits.sort((a,b)=>a.score-b.score||a.m.name.localeCompare(b.m.name));
  return `<h1>Search</h1><p class="lede">${hits.length} page${hits.length===1?'':'s'} mentioning &ldquo;${esc(q)}&rdquo;</p>`+
    hits.slice(0,80).map(h=>`<div class="hit" data-note="${esc(h.m.name)}"><div class="hp">${esc(sectionOf(h.p))}</div>
      <div class="ct">${esc(h.m.name)}</div><div class="cs">${inline(h.snip)}</div></div>`).join('');
}

/* ---------- render a note ---------- */
function siblings(path){
  const dir=path.split('/').slice(0,-1).join('/');
  return Object.keys(META).filter(p=>p.split('/').slice(0,-1).join('/')===dir).sort();
}
function openNote(name, push=true){
  const p=NAMES[name]; if(!p) return;
  if(push && current) hist.push(current);
  current={kind:'note',name};
  recent=[name,...recent.filter(n=>n!==name)].slice(0,12); LS.set('nw_recent',recent);
  const m=META[p], pinned=pins.includes(name);
  const sib=siblings(p), ix=sib.indexOf(p);
  const prev=ix>0?META[sib[ix-1]].name:null, next=ix<sib.length-1?META[sib[ix+1]].name:null;
  const heads=[...m.body.matchAll(/^##\s+(.*)$/gm)].map(x=>x[1]);
  const toc=heads.length>2?`<aside class="toc"><div class="tl">On this page</div>${heads.map(h=>`<a href="#" data-anchor="${esc(slug(h))}">${inline(h)}</a>`).join('')}</aside>`:'';
  document.getElementById('main').innerHTML=
    `<div class="crumb"><span>${esc(sectionOf(p))}${m.folder.includes('/')?' &rsaquo; '+esc(label(m.folder.split('/').slice(1).join(' / '))):''}</span>
       ${typeof canWrite==='function'&&canWrite()?(m.custom?`<button class="pin" data-editpage="${esc(m.cid)}">&#9998; Edit</button>`:`<button class="pin" data-noteedit="${esc(name)}">&#9998; Edit</button>`):''}
       <button class="pin ${pinned?'on':''}" id="pinbtn">${pinned?'&#9733; Pinned':'&#9734; Pin'}</button></div>
     ${typeof editedBanner==='function'?editedBanner(name):''}
     <div class="cols">${toc}<article>${md(m.body)}
       <div class="pager">${prev?`<button class="pg" data-note="${esc(prev)}">&larr; ${esc(prev)}</button>`:'<span></span>'}
         ${next?`<button class="pg" data-note="${esc(next)}">${esc(next)} &rarr;</button>`:'<span></span>'}</div>
       ${m.custom&&typeof canWrite==='function'&&canWrite()?`<div class="addbar"><button class="mini" data-editpage="${esc(m.cid)}">&#9998; Edit this page</button></div>`:''}
       ${!m.custom&&typeof addendumHTML==='function'?addendumHTML(name):''}
       ${m.source?`<div class="srcline">Source: ${esc(m.source)}</div>`:''}</article></div>`;
  window.scrollTo(0,0);
  try { history.replaceState(null,'','#'+slug(name)); } catch(e){}
  const pb0=document.querySelector('.crumb .pin'); if(pb0) pb0.style.marginLeft='auto';
  document.getElementById('pinbtn').onclick=()=>{
    const i=pins.indexOf(name); i>=0?pins.splice(i,1):pins.push(name);
    LS.set('nw_pins',pins); renderPinMenu(); openNote(name,false);
  };
}
function openView(v,push=true){
  if(v==='review') v='admin';
  const same = current && current.kind==='view' && current.v===v;   // a re-render of the page you're on keeps your scroll position
  if(push && current) hist.push(current);
  current={kind:'view',v};
  document.getElementById('main').innerHTML = v==='builds'?viewBuilds():v==='calc'?viewCalc():v==='gear'?viewGear():v==='items'?viewItems():v==='myloadouts'?viewMyLo():v==='admin'?viewReview():viewBosses();
  if(v==='items') itemsEvents();
  if(v==='calc') calcEvents();
  if(v==='gear') gearEvents();
  if(v==='myloadouts') myLoEvents();
  if(v==='admin') reviewEvents();
  if(!same) window.scrollTo(0,0);
  try { history.replaceState(null,'','#'+v); } catch(e){}
  const c=document.getElementById('clearf');
  if(c) c.onclick=()=>{ filt={role:new Set(),mode:new Set(),weapon:new Set()}; openView('builds',false); };
}

/* ---------- events ---------- */
document.addEventListener('click', e=>{
  const dd=e.target.closest('.drop > .nb');
  if(dd){ const d=dd.parentElement; const was=d.classList.contains('open');
    document.querySelectorAll('.drop').forEach(x=>x.classList.remove('open'));
    if(!was) d.classList.add('open'); e.stopPropagation(); return; }
  if(!e.target.closest('.menu')) document.querySelectorAll('.drop').forEach(x=>x.classList.remove('open'));
  const n=e.target.closest('[data-note]');
  if(n){ e.preventDefault(); document.querySelectorAll('.drop').forEach(x=>x.classList.remove('open'));
    document.getElementById('q').value=''; openNote(n.dataset.note); return; }
  const v=e.target.closest('[data-view]');
  if(v){ e.preventDefault(); document.querySelectorAll('.drop').forEach(x=>x.classList.remove('open')); openView(v.dataset.view); return; }
  const f=e.target.closest('[data-f]');
  if(f){ const k=f.dataset.f,val=f.dataset.v; filt[k].has(val)?filt[k].delete(val):filt[k].add(val); openView('builds',false); return; }
  const b=e.target.closest('[data-bf]');
  if(b){ bfilt[b.dataset.bf]=bfilt[b.dataset.bf]===b.dataset.v?'':b.dataset.v; openView('bosses',false); return; }
  const a=e.target.closest('[data-anchor]');
  if(a){ e.preventDefault(); const t=document.getElementById(a.dataset.anchor)||document.getElementById(slug(a.dataset.anchor));
    if(t) t.scrollIntoView({behavior:'smooth',block:'start'}); return; }
  const np=e.target.closest('[data-newpage]'); if(np){ e.preventDefault(); document.querySelectorAll('.drop').forEach(x=>x.classList.remove('open')); openPageEditor(null); return; }
  const ep=e.target.closest('[data-editpage]'); if(ep){ openPageEditor(ep.dataset.editpage); return; }
  const ae=e.target.closest('[data-addedit]'); if(ae){ openAddendumEditor(ae.dataset.addedit); return; }
  const ne=e.target.closest('[data-noteedit]'); if(ne){ openNoteEditor(ne.dataset.noteedit); return; }
  const so=e.target.closest('[data-showorig]'); if(so){ const m=META[NAMES[so.dataset.showorig]];
    if(m&&m.orig!=null){ const art=document.querySelector('article'); if(art) art.innerHTML=md(m.orig)+`<div class="addbar"><button class="mini" data-note="${esc(m.name)}">&larr; Back to my version</button></div>`; } return; }
  if(e.target.closest('#gearbtn')){ openPanel(); return; }
  if(e.target.closest('#back')){ const p=hist.pop(); if(p) p.kind==='note'?openNote(p.name,false):openView(p.v,false); }
});
const qEl=document.getElementById('q');
qEl.addEventListener('input',()=>{
  const r=search(qEl.value);
  if(r===null){ current?.kind==='view'?openView(current.v,false):openNote(current?.name||'New World Home',false); return; }
  document.getElementById('main').innerHTML=r;
});
document.addEventListener('keydown',e=>{
  if(e.key==='/'&&document.activeElement!==qEl){ e.preventDefault(); qEl.focus(); }
  if(e.key==='Escape'){ qEl.value=''; qEl.blur(); document.querySelectorAll('.drop').forEach(x=>x.classList.remove('open')); }
});
/* drag a folder or files onto the page */
['dragover','drop'].forEach(ev=>document.addEventListener(ev,e=>e.preventDefault()));
document.addEventListener('drop', async e=>{
  if(!(typeof canWrite==='function'&&canWrite()) || GHMODE) return;
  const items=[...(e.dataTransfer?.items||[])].map(i=>i.webkitGetAsEntry?.()).filter(Boolean);
  if(!items.length) return;
  const obj={};
  const walk=(entry,base='')=>new Promise(res=>{
    if(entry.isFile) entry.file(f=>{ if(f.name.toLowerCase().endsWith('.md')) f.text().then(t=>{obj[base+f.name]=t; res();}); else res(); });
    else if(entry.isDirectory){ const rd=entry.createReader();
      rd.readEntries(async ents=>{ for(const en of ents) await walk(en, base+entry.name+'/'); res(); }); }
    else res();
  });
  for(const it of items) await walk(it);
  const clean={}; Object.keys(obj).forEach(k=>{ const b=k.split('/'); if(b.length>1) b.shift(); clean[b.join('/')]=obj[k]; });
  if(!Object.keys(clean).length){ toast('No .md files found in what you dropped'); return; }
  applyData(clean,'folder',new Date().toLocaleString());
  const ok=LS.set('nw_vault',clean)&&LS.set('nw_vault_at',SRC_AT);
  persistVault(clean, ok);
});

/* ================= build calculator ================= */
let CALC = null;
const C = Object.assign({
  weapon:'Sword and Shield', ability:'Upheaval',
  emp:0, weak:0, base:0, bane:0, behind:0, critC:0, critD:30,
  tMit:35, tRend:0, pen:0, tAbs:0,
  weight:'Heavy', mit:40, fort:0, rend:0, abs:0, enemyPen:0,
  Str:300, Dex:0, Int:0, Foc:0, Con:200
}, LS.get('nw_calc', {}));
const saveC = () => LS.set('nw_calc', C);
let compareSnap = LS.get('nw_calc_cmp', null);

const clamp=(v,a,b)=>Math.max(a,Math.min(b,isNaN(v)?a:v));
const mitFrom=(m0,plus)=>{ const r0=m0/(1-m0||.0001); const r=Math.max(0,r0*(1+plus)); return r/(1+r); };
function offence(){
  const abil=(CALC?.abilities?.[C.weapon]||[]).find(a=>a.n===C.ability);
  const abilPct=abil?abil.d:100;
  const net=clamp(C.emp,0,50)-clamp(C.weak,0,50);
  const fEmp=1+net/100;
  const fBase=1+(C.base/100)+(C.bane/100)+(C.behind/100);
  const tm=mitFrom(clamp(C.tMit,0,90)/100, -clamp(C.tRend,0,70)/100);
  const fMit=1-tm*(1-clamp(C.pen,0,100)/100);
  const fAbs=1-clamp(C.tAbs,0,100)/100;
  const hit=(abilPct/100)*fEmp*fBase*fMit*fAbs*100;
  const critMul=1+clamp(C.critD,0,300)/100;
  const avg=hit*(1+(clamp(C.critC,0,100)/100)*(critMul-1));
  const baseline=(abilPct/100)*(1-mitFrom(clamp(C.tMit,0,90)/100,0))*100;
  return {abilPct,net,fEmp,fBase,tm,fMit,fAbs,hit,crit:hit*critMul,avg,baseline,
          gain:baseline?((avg/baseline-1)*100):0};
}
function defence(){
  const m=mitFrom(clamp(C.mit,0,90)/100, clamp(C.fort,0,200)/100 - clamp(C.rend,0,70)/100);
  const taken=(1-m*(1-clamp(C.enemyPen,0,100)/100))*(1-clamp(C.abs,0,100)/100)*100;
  const m0=mitFrom(clamp(C.mit,0,90)/100,0);
  const taken0=(1-m0)*100;
  return {m,taken,ehp:taken?100/taken:0,ehp0:taken0?100/taken0:0,saved:taken0?((1-taken/taken0)*100):0};
}
const WEIGHTS={Light:25,Medium:33,Heavy:42};
function num(id,label,val,min,max,step,hint){
  return `<label class="in"><span>${label}${hint?`<i>${hint}</i>`:''}</span>
    <input type="number" data-c="${id}" value="${val}" min="${min}" max="${max}" step="${step||1}"></label>`;
}
function viewCalc(){
  if(!CALC) return `<h1>Build calculator</h1><p class="lede">calc.json did not load, so the ability list is missing.</p>`;
  const o=offence(), d=defence();
  const ab=(CALC.abilities[C.weapon]||[]);
  const attrRows=[['Str','Strength'],['Dex','Dexterity'],['Int','Intelligence'],['Foc','Focus'],['Con','Constitution']].map(([k,nm])=>{
    const t=CALC.attrs[k]||{}; const ks=Object.keys(t).map(Number).sort((a,b)=>a-b);
    const val=C[k]|0;
    const active=ks.filter(x=>val>=x);
    const next=ks.find(x=>val<x);
    return `<tr><td><b>${nm}</b><div class="stepper">
        <button data-step="${k}" data-by="-25">&minus;</button>
        <input type="number" data-c="${k}" value="${val}" min="0" max="350" step="5">
        <button data-step="${k}" data-by="25">+</button></div></td>
      <td>${active.length?active.map(x=>`<div class="bp"><b>${x}</b> ${esc((t[x]||'').split('•').filter(Boolean)[0]||'').trim()}</div>`).join(''):'<span class="dimtx">nothing yet</span>'}</td>
      <td>${next?`<span class="dimtx">${next-val} more to <b>${next}</b></span><div class="bp next">${esc((t[next]||'').split('•').filter(Boolean)[0]||'').trim()}</div>`:'<span class="dimtx">maxed</span>'}</td></tr>`;
  }).join('');
  const total=['Str','Dex','Int','Foc','Con'].reduce((s,k)=>s+(C[k]|0),0);
  const cmp = compareSnap ? `<div class="cmp"><b>Saved for comparison:</b> ${esc(compareSnap.name)} &mdash;
      hit <b>${compareSnap.hit.toFixed(1)}</b>, average <b>${compareSnap.avg.toFixed(1)}</b>, damage taken <b>${compareSnap.taken.toFixed(1)}</b>
      &nbsp;<span class="delta">${(o.avg-compareSnap.avg>=0?'+':'')}${(o.avg-compareSnap.avg).toFixed(1)} damage</span>,
      <span class="delta">${(d.taken-compareSnap.taken>=0?'+':'')}${(d.taken-compareSnap.taken).toFixed(1)} taken</span>
      <button class="mini" id="clearcmp">clear</button></div>` : '';
  return `<h1>Build calculator</h1>
  <p class="lede">Set your buffs, debuffs and the target, and see what your hit actually comes to. Everything is per <b>100 weapon damage</b>, so it compares builds rather than guessing your weapon's numbers.</p>
  <div class="callout info"><span class="ci">&#128203;</span><div><p><b>What's real and what's modelled.</b> The formula, the Season 10 caps and every ability percentage come from your own notes and game-data export. The armor curve is modelled as <code>mitigation = armor / (armor + k)</code>, which is why Fortify and Rend behave correctly relative to each other. Base mitigation per armour weight is a rough community figure you can overwrite. Absolute hit points would need the weapon and armor datasheets &mdash; see the note at the bottom.</p></div></div>
  ${cmp}
  <div class="calcgrid">
    <section class="panel">
      <h2>&#9876; Your attack</h2>
      <label class="in"><span>Weapon</span><select data-c="weapon">${Object.keys(CALC.abilities).sort().map(w=>`<option ${w===C.weapon?'selected':''}>${esc(w)}</option>`).join('')}</select></label>
      <label class="in"><span>Ability</span><select data-c="ability">${ab.map(a=>`<option ${a.n===C.ability?'selected':''} value="${esc(a.n)}">${esc(a.n)} &mdash; ${a.d?a.d+'%':'no damage'}</option>`).join('')}</select></label>
      <div class="two">
        ${num('emp','Empower %',C.emp,0,50,1,'cap 50')}
        ${num('weak','Weaken on you %',C.weak,0,50,1,'subtracts')}
      </div>
      <div class="two">
        ${num('base','Flat damage perks %',C.base,0,200,1,'Keenly, Attunement&hellip;')}
        ${num('bane','Enemy-type bonus %',C.bane,0,100,1,'Bane perks')}
      </div>
      <div class="two">
        ${num('behind','From behind %',C.behind,0,100,1,'backstab perks')}
        ${num('critC','Crit chance %',C.critC,0,100,1)}
      </div>
      ${num('critD','Crit damage bonus %',C.critD,0,300,1,'base crit is +30%')}
      <h3>The target</h3>
      <div class="two">
        ${num('tMit','Their mitigation %',C.tMit,0,90,1,'light 25 / med 33 / heavy 42')}
        ${num('tRend','Rend you apply %',C.tRend,0,70,1,'cap 70')}
      </div>
      <div class="two">
        ${num('pen','Armor penetration %',C.pen,0,100,1)}
        ${num('tAbs','Their absorption %',C.tAbs,0,100,1,'ward, conditioning')}
      </div>
      <div class="res">
        <div class="big"><span>${o.hit.toFixed(1)}</span><i>per 100 weapon damage</i></div>
        <div class="big alt"><span>${o.avg.toFixed(1)}</span><i>average with crits</i></div>
        <div class="big alt"><span>${o.crit.toFixed(1)}</span><i>on a crit</i></div>
      </div>
      <div class="gain">${o.gain>=0?'+':''}${o.gain.toFixed(1)}% vs the same ability with no buffs or debuffs</div>
      <div class="tw"><table><tbody>
        <tr><td>Ability</td><td>${esc(C.ability)}</td><td class="r">&times;${(o.abilPct/100).toFixed(2)}</td></tr>
        <tr><td>Empower &minus; Weaken</td><td>${o.net>=0?'+':''}${o.net}%</td><td class="r">&times;${o.fEmp.toFixed(3)}</td></tr>
        <tr><td>Damage perks + bane + behind</td><td>+${(C.base+C.bane+C.behind)}%</td><td class="r">&times;${o.fBase.toFixed(3)}</td></tr>
        <tr><td>Their mitigation after your Rend</td><td>${(o.tm*100).toFixed(1)}%</td><td class="r">&times;${o.fMit.toFixed(3)}</td></tr>
        <tr><td>Their absorption</td><td>${C.tAbs}%</td><td class="r">&times;${o.fAbs.toFixed(3)}</td></tr>
      </tbody></table></div>
    </section>

    <section class="panel">
      <h2>&#128737; Your defence</h2>
      <label class="in"><span>Armour weight<i>sets the starting mitigation</i></span>
        <select data-c="weight">${Object.keys(WEIGHTS).map(w=>`<option ${w===C.weight?'selected':''}>${w}</option>`).join('')}</select></label>
      <div class="two">
        ${num('mit','Base mitigation %',C.mit,0,90,1,'rough: L25 M33 H42')}
        ${num('abs','Absorption %',C.abs,0,100,1,'ward, conditioning')}
      </div>
      <div class="two">
        ${num('fort','Fortify %',C.fort,0,200,1,'cap 200')}
        ${num('rend','Rend on you %',C.rend,0,70,1,'cap 70')}
      </div>
      ${num('enemyPen','Their armor penetration %',C.enemyPen,0,100,1)}
      <div class="res">
        <div class="big"><span>${(d.m*100).toFixed(1)}%</span><i>effective mitigation</i></div>
        <div class="big alt"><span>${d.taken.toFixed(1)}</span><i>damage taken per 100</i></div>
        <div class="big alt"><span>&times;${d.ehp.toFixed(2)}</span><i>effective health</i></div>
      </div>
      <div class="gain">${d.saved>=0?'':'&minus;'}${Math.abs(d.saved).toFixed(1)}% ${d.saved>=0?'less':'more'} damage than base mitigation alone</div>
      <div class="callout tip"><span class="ci">&#128161;</span><div><p>Fortify and Rend both act on your <b>armor rating</b>, not straight off the damage, so the first 50% Fortify is worth far more than the last 50%. Try 0 &rarr; 50 &rarr; 100 and watch the effective-health number flatten.</p></div></div>
    </section>
  </div>

  <h2>Attribute planner</h2>
  <p class="lede">Points spent: <b>${total}</b>. Thresholds and their effects are the game's own tooltips.</p>
  <div class="tw"><table><thead><tr><th>Attribute</th><th>Active now</th><th>Next threshold</th></tr></thead><tbody>${attrRows}</tbody></table></div>

  <h2>Save this build</h2>
  <div class="saverow">
    <input id="bname" placeholder="Name it, e.g. Juggernaut 300/200" value="">
    <button class="mini go" id="savebuild">Save</button>
    <button class="mini" id="cmpbuild">Hold for comparison</button>
    <button class="mini" id="resetcalc">Reset</button>
  </div>
  <div id="savedlist"></div>

  <div class="callout note"><span class="ci">&#8505;</span><div><p><b>Want real hit points instead of per-100 figures?</b> That needs two things this export doesn't have: each weapon's base damage and the attribute scaling curve, plus the armor table per weight and gear score. Both are in <code>DataStrm-part21.pak</code>, which you already have next to the vault. Run <code>datasheet-converter.exe</code> over it, point me at the output, and I can switch these numbers to actual damage.</p></div></div>`;
}
function renderSaved(){
  const el=document.getElementById('savedlist'); if(!el) return;
  const list=LS.get('nw_builds',[]);
  el.innerHTML = list.length ? `<div class="tw"><table><thead><tr><th>Build</th><th>Weapon / ability</th><th>Hit</th><th>Average</th><th>Taken</th><th></th></tr></thead><tbody>`+
    list.map((b,i)=>`<tr><td><b>${esc(b.name)}</b></td><td>${esc(b.weapon)} &middot; ${esc(b.ability)}</td>
      <td>${b.hit.toFixed(1)}</td><td>${b.avg.toFixed(1)}</td><td>${b.taken.toFixed(1)}</td>
      <td class="r"><button class="mini" data-load="${i}">Load</button> <button class="mini" data-del="${i}">&times;</button></td></tr>`).join('')
    +`</tbody></table></div>` : `<p class="dimtx">No saved builds yet.</p>`;
}
function snapshot(name){
  const o=offence(), d=defence();
  return {name:name||'(unnamed)', weapon:C.weapon, ability:C.ability, hit:o.hit, avg:o.avg, taken:d.taken, state:{...C}};
}
function calcEvents(){
  document.querySelectorAll('[data-c]').forEach(el=>{
    const k=el.dataset.c;
    el.oninput=()=>{
      C[k]= el.tagName==='SELECT' ? el.value : parseFloat(el.value||0);
      if(k==='weapon'){ const l=CALC.abilities[C.weapon]||[]; C.ability=l[0]?l[0].n:''; }
      if(k==='weight'){ C.mit=WEIGHTS[C.weight]; }
      saveC(); openView('calc',false);
      const f=document.querySelector(`[data-c="${k}"]`); if(f&&f.focus&&el.tagName!=='SELECT'){ f.focus(); f.select&&f.select(); }
    };
  });
  document.querySelectorAll('[data-step]').forEach(b=>b.onclick=()=>{
    const k=b.dataset.step; C[k]=clamp((C[k]|0)+parseInt(b.dataset.by),0,350); saveC(); openView('calc',false);
  });
  const sb=document.getElementById('savebuild');
  if(sb) sb.onclick=()=>{
    const n=(document.getElementById('bname').value||'').trim()||('Build '+(LS.get('nw_builds',[]).length+1));
    const list=LS.get('nw_builds',[]); list.push(snapshot(n)); LS.set('nw_builds',list); renderSaved(); toast('Saved “'+n+'”');
  };
  const cb=document.getElementById('cmpbuild');
  if(cb) cb.onclick=()=>{ compareSnap=snapshot((document.getElementById('bname').value||'current').trim()); LS.set('nw_calc_cmp',compareSnap); openView('calc',false); };
  const cc=document.getElementById('clearcmp');
  if(cc) cc.onclick=()=>{ compareSnap=null; LS.del('nw_calc_cmp'); openView('calc',false); };
  const rc=document.getElementById('resetcalc');
  if(rc) rc.onclick=()=>{ LS.del('nw_calc'); location.reload(); };
  document.querySelectorAll('[data-load]').forEach(b=>b.onclick=()=>{
    const b2=LS.get('nw_builds',[])[+b.dataset.load]; if(b2){ Object.assign(C,b2.state); saveC(); openView('calc',false); toast('Loaded “'+b2.name+'”'); }
  });
  document.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>{
    const list=LS.get('nw_builds',[]); list.splice(+b.dataset.del,1); LS.set('nw_builds',list); renderSaved();
  });
  renderSaved();
}

/* ================= item database ================= */
let ITEMDB=null, SPRITES=[];
const WT2LOAD={'Sword':'Sword and Shield','Round Shield':'Sword and Shield','Kite Shield':'Sword and Shield','Tower Shield':'Sword and Shield'};
const itemByName=n=>{ if(!ITEMDB||!n) return null; const l=n.toLowerCase().trim(); return ITEMDB.items.find(i=>i.n.toLowerCase()===l)||null; };
function itemIcon(it, size=24){
  if(!ITEMDB||!it||it.x<0||!SPRITES.length) return `<span class="iic none" style="width:${size}px;height:${size}px"></span>`;
  const T=ITEMDB.tile, C=ITEMDB.cols, sheet=Math.floor(it.x/ITEMDB.per), j=it.x%ITEMDB.per;
  const sc=size/T;
  return `<span class="iic" style="width:${size}px;height:${size}px;background-image:url(${SPRITES[sheet]});background-size:${C*T*sc}px auto;background-position:-${(j%C)*T*sc}px -${Math.floor(j/C)*T*sc}px" title="${esc(it.n)}"></span>`;
}
const cleanPerks=it=>(it?.p||[]).filter(p=>!/^Empty |^\[/.test(p));
const RARCLS={Artifact:'art',Named:'named',Set:'set',PVP:'pvp'};
let IQ={q:'',slot:'',rar:'',wt:'',page:0};
function viewItems(){
  if(!ITEMDB) return `<h1>Items</h1><p class="lede">items.json did not load.</p>`;
  const q=IQ.q.trim().toLowerCase();
  let list=ITEMDB.items.filter(i=>(!q||i.n.toLowerCase().includes(q)||i.p.some(p=>p.toLowerCase().includes(q))||(i.src||[]).some(x=>x.toLowerCase().includes(q)))
    &&(!IQ.slot||i.s===IQ.slot)&&(!IQ.rar||i.r===IQ.rar)&&(!IQ.wt||i.t===IQ.wt));
  const pages=Math.max(1,Math.ceil(list.length/10)); IQ.page=Math.min(IQ.page,pages-1);
  const shown=list.slice(IQ.page*10,IQ.page*10+10);
  const slots=['Weapon','Shield','Helmet','Chest','Gloves','Pants','Boots','Amulet','Ring','Earring'];
  const rars=['Artifact','Named','Set','PVP','Crafting','Loot'];
  const wts=[...new Set(ITEMDB.items.map(i=>i.t).filter(Boolean))].sort();
  const pager=`<div class="ipager"><button class="mini" data-ipg="-1" ${IQ.page===0?'disabled':''}>&larr; Prev</button>
    <span>Page <b>${IQ.page+1}</b> of ${pages} &middot; ${list.length} items</span>
    <button class="mini" data-ipg="1" ${IQ.page>=pages-1?'disabled':''}>Next &rarr;</button></div>`;
  return `<h1>Items</h1>
  <p class="lede">${ITEMDB.items.length.toLocaleString()} endgame items from your game's own item tables. Searches names, perks <i>and</i> where things drop, so "gorgon", "Refreshing" or "Chardis" all work.</p>
  <div class="filters" data-h="Search items">
    <input id="iq" class="isearch" placeholder="Search items or perks, e.g. gorgon" value="${esc(IQ.q)}" autocomplete="off">
    <div class="frow"><span class="fl">Slot</span>${['',...slots].map(s=>`<button class="chip ${IQ.slot===s?'on':''}" data-is="${esc(s)}">${esc(s)||'All'}</button>`).join('')}</div>
    <div class="frow"><span class="fl">Type</span>${['',...rars].map(s=>`<button class="chip ${IQ.rar===s?'on':''}" data-ir="${esc(s)}">${esc(s)||'All'}</button>`).join('')}</div>
    <div class="frow"><span class="fl">Weapon</span><select id="iwt"><option value="">Any</option>${wts.map(w=>`<option ${IQ.wt===w?'selected':''}>${esc(w)}</option>`).join('')}</select></div>
  </div>
  ${pager}
  <div class="ilist">${shown.map(it=>`<div class="irow">
     ${itemIcon(it,40)}
     <div class="ibody"><div class="iname">${esc(it.n)} <span class="rb ${RARCLS[it.r]||''}">${esc(it.r)}</span></div>
       <div class="imeta">${esc(it.s)}${it.t?' &middot; '+esc(it.t):''}${it.w?' &middot; '+esc(it.w):''} &middot; GS ${it.g}${it.e?' &middot; set: '+esc(it.e):''}</div>
       ${cleanPerks(it).length?`<div class="iperks">${cleanPerks(it).map(p=>`<span>${icoFor(p)?`<img class="ico" src="${icoFor(p)}" alt="">`:''}${esc(p)}</span>`).join('')}</div>`:''}
       ${it.src?`<div class="isrc">&#128205; ${it.src.map(esc).join(' &middot; ')}</div>`:''}
       ${it.d?`<div class="idesc">${esc(it.d)}</div>`:''}</div>
     <button class="mini go" data-equip="${esc(it.n)}">Equip</button></div>`).join('')||'<p class="empty">No items match.</p>'}</div>
  ${list.length>10?pager:''}`;
}
function equipItem(it, quiet){
  if(!it) return false;
  const perks=cleanPerks(it);
  if(['Helmet','Chest','Gloves','Pants','Boots'].includes(it.s)){
    const a=G.armor[it.s]; a.item=it.n; if(it.w) a.wt=it.w; a.p1=perks[0]||''; a.p2=perks[1]||''; a.p3=perks[2]||'';
  } else if(['Amulet','Ring','Earring'].includes(it.s)){
    const j=G.jew[it.s]; j.item=it.n; j.p1=perks[0]||''; j.p2=perks[1]||'';
  } else if(it.s==='Shield'){
    G.w1='Sword and Shield'; G.shield=it.n;
  } else {
    const wt=WT2LOAD[it.t]||it.t;
    const slot = G.w1===wt ? 1 : G.w2===wt ? 2 : 1;
    G['w'+slot]=wt; G['w'+slot+'item']=it.n;
    G['w'+slot+'p1']=perks[0]||''; G['w'+slot+'p2']=perks[1]||''; G['w'+slot+'p3']=perks[2]||'';
  }
  saveG(); if(!quiet) toast('Equipped '+it.n);
  return true;
}
function itemsEvents(){
  const iq=document.getElementById('iq');
  if(iq){ iq.oninput=()=>{ IQ.q=iq.value; IQ.page=0; const pos=iq.selectionStart; openView('items',false); const n=document.getElementById('iq'); n.focus(); n.setSelectionRange(pos,pos); }; }
  document.querySelectorAll('[data-is]').forEach(b=>b.onclick=()=>{ IQ.slot=IQ.slot===b.dataset.is?'':b.dataset.is; IQ.page=0; openView('items',false); });
  document.querySelectorAll('[data-ir]').forEach(b=>b.onclick=()=>{ IQ.rar=IQ.rar===b.dataset.ir?'':b.dataset.ir; IQ.page=0; openView('items',false); });
  const w=document.getElementById('iwt'); if(w) w.onchange=()=>{ IQ.wt=w.value; IQ.page=0; openView('items',false); };
  document.querySelectorAll('[data-ipg]').forEach(b=>b.onclick=()=>{ IQ.page+=parseInt(b.dataset.ipg); openView('items',false); window.scrollTo(0,0); });
  document.querySelectorAll('[data-equip]').forEach(b=>b.onclick=()=>{ equipItem(itemByName(b.dataset.equip)); });
}
/* best-in-slot table in a build note -> items */
function bisFromNote(name){
  const p=NAMES[name]; if(!p) return [];
  const body=META[p].body; const m=body.match(/## Best in slot[\s\S]*?(\n\|[\s\S]*?)(\n\n|\n##|$)/);
  if(!m) return [];
  return m[1].split('\n').filter(l=>/^\|/.test(l)&&!/^\|\s*-/.test(l)&&!/\|\s*Slot\s*\|/.test(l)).map(l=>{
    const c=splitRow(l); return {slot:(c[0]||'').trim(), item:(c[1]||'').replace(/\*/g,'').trim()};
  });
}
function resolveBis(txt){
  if(!txt||/^crafted/i.test(txt)) return null;
  const cands=txt.split(/\s+or\s+|,\s*|\s+\(|\s+—\s+/).map(s=>s.replace(/\).*$/,'').trim()).filter(Boolean);
  for(const c of [txt,...cands]){ const it=itemByName(c); if(it) return it; }
  return null;
}

/* ================= loadout builder ================= */
let PERKS=null, PRESETS=null, TREES=null;
/* ---------- skill trees (layout + icons from the game data) ---------- */
function treePicksFromNote(name){
  const p=NAMES[name]; if(!p) return {};
  const body=META[p].body; const k=body.indexOf('### Skill trees'); if(k<0) return {};
  let sec=body.slice(k+15); const e=sec.search(/\n##/); if(e>=0) sec=sec.slice(0,e);
  const out={};
  tableRows(sec).slice(1).forEach(r=>{ const w=r[0]; if(!w) return; (out[w]=out[w]||[]).push(...(r[3]||'').split(/\s*,\s*/).filter(x=>x&&!/^[–—-]$/.test(x))); });
  return out;
}
function abilWD(wt,a){ if(!TREES||!TREES[wt]) return ''; for(const t of TREES[wt]){ const n=t.nodes.find(x=>x.n===a); if(n) return n.wd||''; } return ''; }
function treeChain(t, n){   // ability -> upgrade 1 -> upgrade 2 ..., the line you follow in-game
  if(n.k!=='U') return [];
  const c=[n.p].concat(t.nodes.filter(x=>x.k==='U'&&x.p===n.p).sort((a,b)=>a.r-b.r).map(x=>x.n));
  return c.slice(0,c.indexOf(n.n));
}
function treeNodeState(t, n, ps){
  if(ps.has(n.n)) return 'on';
  if(n.k==='U'){ const c=treeChain(t,n); if(c.length && !ps.has(c[c.length-1])) return 'lock'; }
  if(n.k==='X' && t.nodes.filter(x=>ps.has(x.n)).length<10) return 'lock';
  return '';
}
function cleanTree(wt, list){   // drop anything whose prerequisite isn't picked (repeat until stable)
  if(!TREES||!TREES[wt]) return list||[];
  let l=(list||[]).filter(n=>TREES[wt].some(t=>t.nodes.some(x=>x.n===n))), ch=true;
  while(ch){ ch=false; const ps=new Set(l);
    for(const t of TREES[wt]) for(const n of t.nodes){ if(!ps.has(n.n)) continue;
      const pre=treeChain(t,n); const bad=(pre.length&&!ps.has(pre[pre.length-1]))||(n.k==='X'&&t.nodes.filter(x=>ps.has(x.n)&&x.k!=='X').length<10);
      if(bad){ l=l.filter(x=>x!==n.n); ch=true; } } }
  return l;
}
function skillTreeHTML(wt, picks, slotN){
  if(!TREES||!TREES[wt]) return '';
  const ps=new Set(picks||[]); const total=TREES[wt].reduce((s,t)=>s+t.nodes.filter(n=>ps.has(n.n)).length,0);
  const ult=TREES[wt].map(t=>t.nodes.filter(n=>ps.has(n.n)).length);
  return `<div class="stree"><div class="sthead"><b>${esc(wt)}</b> <span class="${total>19?'bad':''}">${total} / 19 points</span>${slotN?' <i>click a node to add or remove it &middot; dimmed with a lock = take the node above it first</i>':''}</div><div class="stpair">`+
   TREES[wt].map((t,ti)=>{ const ultOn=t.nodes.some(n=>n.k==='X'&&ps.has(n.n));
     const at={}; t.nodes.forEach(n=>at[n.n]=n); const P=50, C=22;
     const lines=[];
     t.nodes.filter(n=>n.k==='A').forEach(a=>{ const ch=[a].concat(t.nodes.filter(x=>x.k==='U'&&x.p===a.n).sort((x,y)=>x.r-y.r));
       for(let i=1;i<ch.length;i++){ const p=ch[i-1], q=ch[i]; const lit=ps.has(p.n)&&ps.has(q.n);
         lines.push(`<line x1="${p.c*P+C}" y1="${p.r*P+C}" x2="${q.c*P+C}" y2="${q.r*P+C}" class="${lit?'lit':''}"/>`); } });
     return `<div class="stcol"><div class="stt">${esc(t.t)} &middot; ${ult[ti]}${ultOn&&ult[ti]<10?' <span class="bad">(ultimate needs 10)</span>':''}</div><div class="stgrid"><svg class="stlines" width="244" height="294" aria-hidden="true">${lines.join('')}</svg>`+
     t.nodes.map(n=>{ const ic=icoFor(n.n,wt); const st=treeNodeState(t,n,ps);
       const fx=(n.e||[]).map(f=>`${STATLBL[f.s]||f.s} ${f.v}%${f.a?'':' (when triggered)'}`).join(', ');
       const tip=`${n.n}${n.wd?' · '+n.wd+' weapon damage':''}${n.d?' — '+n.d:''}${fx?' ['+fx+']':''}${st==='lock'?(n.k==='X'?' 🔒 Needs 10 points in this tree first.':' 🔒 Take the node above it first.'):''}`;
       return `<div class="stn k${n.k} ${st}" style="grid-row:${n.r+1};grid-column:${n.c+1}" title="${esc(tip)}" ${slotN?`data-stn="${slotN}" data-n="${esc(n.n)}"`:''}>${ic?`<img src="${ic}" alt="">`:''}</div>`; }).join('')+`</div></div>`; }).join('')+`</div>${treeBonusHTML(wt,picks)}</div>`;
}
const STATLBL={dmg:'Damage',emp:'Empower',fort:'Fortify',crit:'Crit chance',critd:'Crit damage',pen:'Armor pen',armor:'Armor',dr:'Damage reduction',rend:'Rend you apply',wkn:'Weaken you apply',cdr:'Cooldown cut',haste:'Haste',heal:'Healing'};
function treeBonuses(wt, picks){
  const out={}; if(!TREES||!TREES[wt]) return out; const ps=new Set(picks||[]);
  TREES[wt].forEach(t=>t.nodes.forEach(n=>{ if(!ps.has(n.n)) return; (n.e||[]).forEach(f=>{
    const o=out[f.s]=out[f.s]||{always:0,trig:0,from:[]}; if(f.a) o.always+=f.v; else o.trig+=f.v; o.from.push(`${n.n} ${f.v}%${f.a?'':'*'}`); }); }));
  return out;
}
function treeBonusHTML(wt, picks){
  const b=treeBonuses(wt,picks); const ks=Object.keys(STATLBL).filter(k=>b[k]);
  if(!ks.length) return '';
  return `<div class="tw stbon"><table><thead><tr><th>What the picked nodes add</th><th class="r">Always on</th><th class="r">When triggered</th><th>From</th></tr></thead><tbody>`+
    ks.map(k=>`<tr><td>${STATLBL[k]}</td><td class="r">${b[k].always?'+'+(+b[k].always.toFixed(1))+'%':'&ndash;'}</td><td class="r">${b[k].trig?'up to +'+(+b[k].trig.toFixed(1))+'%':'&ndash;'}</td><td class="dimtx">${esc(b[k].from.join(', '))}</td></tr>`).join('')+
    `</tbody></table><p class="dimtx tiny">Read from each node's tooltip. "When triggered" bonuses need their condition (on block, vs slowed targets, for 5s after a heavy&hellip;), so they won't all be up at once. * = triggered.</p></div>`;
}
function embedHTML(fname){
  const m=fname.match(/^(.+) - (.+)\.svg$/);
  if(!m||!TREES||!TREES[m[2]]) return '';
  const picks=treePicksFromNote(m[1])[m[2]]||[];
  return skillTreeHTML(m[2], picks, 0);
}
const G = Object.assign({
  w1:'Sword and Shield', w2:'War Hammer',
  w1gem:'', w2gem:'', w1perk:'', w2perk:'', w1off:'', w2off:'', w1item:'', w2item:'', shield:'',
  w1p1:'', w1p2:'', w1p3:'', w2p1:'', w2p2:'', w2p3:'',
  armor:{Helmet:{wt:'Heavy',item:'',gem:'',p1:'',p2:'',p3:''},Chest:{wt:'Heavy',item:'',gem:'',p1:'',p2:'',p3:''},
         Gloves:{wt:'Heavy',item:'',gem:'',p1:'',p2:'',p3:''},Pants:{wt:'Heavy',item:'',gem:'',p1:'',p2:'',p3:''},
         Boots:{wt:'Heavy',item:'',gem:'',p1:'',p2:'',p3:''}},
  jew:{Amulet:{item:'',gem:'',p1:'',p2:''},Ring:{item:'',gem:'',p1:'',p2:''},Earring:{item:'',gem:'',p1:'',p2:''}},
  rune:'Stoneform', runev:'Stalwart', note:'',
  abil:{1:[],2:[]}, attrs:{STR:0,DEX:0,INT:0,FOC:0,CON:0}, trees:{1:[],2:[]}
}, LS.get('nw_gear', {}));
['Helmet','Chest','Gloves','Pants','Boots'].forEach(s=>{ if(G.armor[s].ch===undefined) G.armor[s].ch=''; });
['Amulet','Ring','Earring'].forEach(s=>{ if(G.jew[s].ch===undefined) G.jew[s].ch=''; });
if(!G.abil) G.abil={1:[],2:[]}; if(!G.trees) G.trees={1:[],2:[]}; if(!G.attrs) G.attrs={STR:0,DEX:0,INT:0,FOC:0,CON:0};
const saveG = () => LS.set('nw_gear', G);
const RUNES=['Stoneform','Detonate','Grasping Vines','Dark Ascent','Cannon Blast','Fire Storm','Bile Bomb','Phantom Blades','The Devourer','Primal Fury'];
const RVARIANTS=['Minor','Cunning','Stalwart','Brutal'];
const ARMOR_SLOTS=['Helmet','Chest','Gloves','Pants','Boots'];
const JEW_SLOTS=['Amulet','Ring','Earring'];
const STACKRULES=[
  [/^Refreshing$|^Refreshing II$/,'Refreshing',4,'No more than 4 in total'],
  [/^Freedom/,'Freedom',5,'Counts in stacks — run 3 or 5, never 1 or 2'],
  [/^Resilient/,'Resilient',5,'5 for max PvP damage reduction; 4 is fine'],
  [/Punishing/,'Punishing runeglass',3,'1-3 only — it has an internal cooldown, so 5 is wasted'],
  [/Shirking Heals/,'Shirking Heals',5,'Each piece adds a stack'],
];
function perksFor(opt){
  if(!PERKS) return [];
  return PERKS.filter(p=>{
    if(opt.gem) return p.t==='Gem' && p.s.includes(opt.gem);
    if(opt.charmW) return (p.t==='SkillCharm' && p.w.includes(opt.charmW));
    if(opt.off) return p.t==='OffensiveCharm'||p.t==='DefensiveCharm';
    if(opt.slot) return p.t!=='Gem' && p.t!=='SkillCharm' && (p.s.includes(opt.slot)||p.s.includes('Armor')||p.s.includes('Jewelry'));
    return false;
  });
}
const perkByName = n => n ? ((PERKS||[]).find(p=>p.n===n)||(PERKS||[]).find(p=>p.n.startsWith(n+'  '))) : null;
function dl(id, list){
  return `<datalist id="${id}">${list.slice(0,900).map(p=>`<option value="${esc(p.n)}">${esc(p.d.slice(0,90))}</option>`).join('')}</datalist>`;
}
function itemField(path, val, listId){
  const it=itemByName(val);
  return `<div class="pkrow itm">${itemIcon(it,28)}<input class="pk item" list="${listId}" data-gi="${path}" value="${esc(val||'')}" placeholder="Item (optional) — type to search"></div>`;
}
function itemDL(id, filt){
  if(!ITEMDB) return '';
  const l=ITEMDB.items.filter(filt).slice(0,700);
  return `<datalist id="${id}">${l.map(i=>`<option value="${esc(i.n)}">${esc(i.r)} · GS ${i.g}${i.w?' · '+i.w:''}</option>`).join('')}</datalist>`;
}
function pin2(path, val, listId, ph){
  const ic=icoFor(val);
  return `<div class="pkrow">${ic?`<img class="ico" src="${ic}" alt="">`:'<span class="ico none"></span>'}<input class="pk" list="${listId}" data-g="${path}" value="${esc(val||'')}" placeholder="${ph}"></div>`;
}
function allChosen(g=G){
  const out=[];
  const add=(name, where)=>{ if(!name) return; const p=perkByName(name); out.push({name, where, p}); };
  add(g.w1gem,'Weapon 1 gem'); add(g.w2gem,'Weapon 2 gem');
  add(g.w1perk,'Weapon 1 charm'); add(g.w2perk,'Weapon 2 charm');
  add(g.w1off,'Weapon 1 charm 2'); add(g.w2off,'Weapon 2 charm 2');
  ['w1p1','w1p2','w1p3'].forEach(k=>add(G[k],'Weapon 1')); ['w2p1','w2p2','w2p3'].forEach(k=>add(G[k],'Weapon 2'));
  ARMOR_SLOTS.forEach(s=>{ const a=g.armor[s]; add(a.gem,s+' gem'); add(a.p1,s); add(a.p2,s); add(a.p3,s); add(a.ch,s+' charm'); });
  JEW_SLOTS.forEach(s=>{ const j=g.jew[s]; add(j.gem,s+' gem'); add(j.p1,s); add(j.p2,s); add(j.ch,s+' charm'); });
  return out;
}
function totals(g=G){
  const t={fort:0,emp:0,rend:0,dmg:0,crit:0,critd:0,ls:0,abs:0,wkn:0}, contrib=[];
  allChosen(g).forEach(c=>{
    if(!c.p||!c.p.f) return;
    Object.keys(c.p.f).forEach(k=>{ if(k in t){ t[k]+=c.p.f[k]; contrib.push({k,v:c.p.f[k],n:c.name,w:c.where}); } });
  });
  return {t,contrib};
}
function stackWarnings(){
  const names=allChosen().map(c=>c.name);
  const out=[];
  STACKRULES.forEach(([re,label,max,advice])=>{
    const n=names.filter(x=>re.test(x)).length;
    if(!n) return;
    const bad = label==='Punishing runeglass' ? n>max : (label==='Freedom' ? ![0,3,5].includes(n) : n>max);
    out.push({label,n,max,advice,bad});
  });
  // one weapon, one armour, one jewellery artifact
  const isArt=n=>{ const it=itemByName(n); return it&&it.r==='Artifact'; };
  const grp={weapon:[G.w1item,G.w2item,G.shield], armour:ARMOR_SLOTS.map(s=>G.armor[s].item), jewellery:JEW_SLOTS.map(s=>G.jew[s].item)};
  Object.entries(grp).forEach(([k,l])=>{ const a=l.filter(isArt); if(a.length) out.push({label:k+' artifact',n:a.length,max:1,bad:a.length>1,
    advice:a.length>1?`only one ${k} artifact can be worn at a time (${a.join(', ')})`:a[0]}); });
  return out;
}
/* ---------- presets read from the build notes' "## Full loadout" tables ---------- */
function notePresets(){
  const out=[];
  Object.values(META).forEach(m=>{
    if(!m.folder.startsWith(TOP_BUILDS)||!/\n## Full loadout/.test('\n'+m.body)) return;
    const sub=m.folder.split('/').slice(1).join('/')||'Builds';
    out.push({name:m.name, folder:label(sub), fromNote:true, modes:noteModes(m.body)});
  });
  (PRESETS||[]).forEach(p=>{ if(!out.find(o=>o.name===p.name)) out.push(p); });
  return out;
}
function tableRows(txt){
  return txt.split('\n').filter(l=>/^\|/.test(l)&&!/^\|\s*:?-/.test(l)).map(l=>splitRow(l).map(c=>c.replace(/\*\*/g,'').trim()));
}
function parseLoadout(name){
  const p=NAMES[name]; if(!p) return null;
  const body=META[p].body; const i=body.indexOf('## Full loadout'); if(i<0) return null;
  let sec=body.slice(i+15); const j=sec.search(/\n## /); if(j>=0) sec=sec.slice(0,j);
  const part=h=>{ const k=sec.indexOf('### '+h); if(k<0) return ''; let t=sec.slice(k); const e=t.slice(4).search(/\n### /); return e>=0?t.slice(0,e+4):t; };
  const main=sec.split('\n### ')[0];
  const rows=tableRows(main); const head=rows.shift()||[];
  const col=n=>head.findIndex(h=>h.toLowerCase()===n);
  const ix={slot:0,item:col('item'),type:col('type'),gem:col('gem'),p1:col('perk 1'),p2:col('perk 2'),p3:col('perk 3'),ch:col('charm')};
  const v=(r,k)=>{ const x=ix[k]>=0?(r[ix[k]]||''):''; return /^[–—-]$/.test(x)?'':x; };
  const slots={}; rows.forEach(r=>{ slots[r[0]]={item:v(r,'item'),type:v(r,'type'),gem:v(r,'gem'),p:[v(r,'p1'),v(r,'p2'),v(r,'p3')],ch:v(r,'ch')}; });
  const ab=tableRows(part('Abilities')).slice(1).map(r=>({w:r[0],a:r.slice(1).filter(x=>x&&!/^[–—-]$/.test(x))}));
  const at=tableRows(part('Attributes')); const attrs={};
  if(at.length>1){ const keys={strength:'STR',dexterity:'DEX',intelligence:'INT',focus:'FOC',constitution:'CON'};
    at[0].forEach((h,k)=>{ const key=keys[h.toLowerCase()]; if(key) attrs[key]=parseInt(at[1][k])||0; }); }
  return {slots, abil:ab, attrs};
}
function applyLoadout(name, L){
  const real=n=>(!n||/^crafted/i.test(n))?'':n;
  const wlist=CALC?Object.keys(CALC.abilities):[];
  ['1','2'].forEach(n=>{
    const r=L.slots['Weapon '+n]; if(!r) return;
    if(wlist.includes(r.type)) G['w'+n]=r.type;
    G['w'+n+'item']=real(r.item); G['w'+n+'gem']=r.gem;
    G['w'+n+'p1']=r.p[0]; G['w'+n+'p2']=r.p[1]; G['w'+n+'p3']=r.p[2];
    const ch=r.ch.split(/\s*\+\s*/); G['w'+n+'perk']=ch[0]||''; G['w'+n+'off']=ch[1]||'';
  });
  G.shield=L.slots.Shield?real(L.slots.Shield.item):'';
  ARMOR_SLOTS.forEach(s=>{ const r=L.slots[s]; const a=G.armor[s];
    Object.assign(a,{item:'',gem:'',p1:'',p2:'',p3:'',ch:''});
    if(!r) return; if(['Light','Medium','Heavy'].includes(r.type)) a.wt=r.type;
    Object.assign(a,{item:real(r.item),gem:r.gem,p1:r.p[0],p2:r.p[1],p3:r.p[2],ch:r.ch}); });
  JEW_SLOTS.forEach(s=>{ const r=L.slots[s]; const j=G.jew[s];
    Object.assign(j,{item:'',gem:'',p1:'',p2:'',ch:''});
    if(r) Object.assign(j,{item:real(r.item),gem:r.gem,p1:r.p[0],p2:r.p[1],ch:r.ch}); });
  const hr=L.slots.Heartrune; if(hr&&hr.item){ const b=hr.item.split(' '); if(RVARIANTS.includes(b[0])){ G.runev=b.shift(); } const rn=b.join(' '); G.rune=RUNES.find(x=>x.toLowerCase()===rn.toLowerCase()||x==='The '+rn)||G.rune; }
  G.abil={1:[],2:[]};
  L.abil.forEach(x=>{ const w=WT2LOAD[x.w]||x.w; if(w===G.w1) G.abil[1]=x.a.slice(0,3); else if(w===G.w2) G.abil[2]=x.a.slice(0,3); });
  G.attrs=Object.assign({STR:0,DEX:0,INT:0,FOC:0,CON:0},L.attrs);
  const tp=treePicksFromNote(name); G.trees={1:tp[G.w1]||[],2:tp[G.w2]||[]};
  const named=[G.w1item,G.shield,G.w2item].concat(ARMOR_SLOTS.map(s=>G.armor[s].item),JEW_SLOTS.map(s=>G.jew[s].item)).filter(Boolean);
  const miss=named.filter(n=>!itemByName(n));
  G.note=`Loaded “${name}” from its Full loadout table: every slot, gem, perk, charm, abilities and attributes. Named items: ${named.length?named.join(', '):'none (all crafted)'}.`+(miss.length?` Not in the item list: ${miss.join(', ')}.`:'')+' Edit the table in the note to change this preset.';
}
function viewGear(){
  [1,2].forEach(n=>{ const c=cleanTree(G['w'+n],G.trees[n]); if(c.length!==(G.trees[n]||[]).length){ G.trees[n]=c; saveG(); } });
  if(!PERKS) return `<h1>Loadout builder</h1><p class="lede">gear_perks.json did not load.</p>`;
  const {t,contrib}=totals();
  const warn=stackWarnings();
  const wlist=[...new Set((CALC?Object.keys(CALC.abilities):[]).concat(['Sword and Shield','War Hammer']))].sort();
  const counts={};
  ARMOR_SLOTS.forEach(s=>counts[G.armor[s].wt]=(counts[G.armor[s].wt]||0)+1);
  const load=(counts.Heavy>=3?'Heavy':counts.Light>=4?'Light':'Medium');
  const gemW=dl('gem_w', perksFor({gem:'Weapon'}));
  const gemA=dl('gem_a', perksFor({gem:'Armor'}));
  const gemJ=dl('gem_j', perksFor({gem:'Jewelry'}));  // jewelry takes the armour-style gem effects
  const charm1=dl('ch1', perksFor({charmW:G.w1}));
  const charm2=dl('ch2', perksFor({charmW:G.w2}));
  const offd=dl('offd', perksFor({off:true}));
  const armd=dl('armd', perksFor({slot:'Armor'}));
  const jewd=dl('jewd', perksFor({slot:'Jewelry'}));
  const chA=dl('chA', perksFor({off:true}).concat(perksFor({charmW:G.w1}),perksFor({charmW:G.w2})));
  const wType=w=>Object.keys(WT2LOAD).filter(k=>WT2LOAD[k]===w).concat([w]);
  const itDL=itemDL('it_w1',i=>i.s==='Weapon'&&wType(G.w1).includes(i.t))+itemDL('it_w2',i=>i.s==='Weapon'&&wType(G.w2).includes(i.t))
    +itemDL('it_sh',i=>i.s==='Shield')+ARMOR_SLOTS.map(s=>itemDL('it_'+s,i=>i.s===s)).join('')+JEW_SLOTS.map(s=>itemDL('it_'+s,i=>i.s===s)).join('');
  const wrow=(n)=>`<div class="slot"><div class="sh">Weapon ${n}</div>
    <select data-g="w${n}">${wlist.map(w=>`<option ${G['w'+n]===w?'selected':''}>${esc(w)}</option>`).join('')}</select>
    ${itemField('w'+n+'item',G['w'+n+'item'],'it_w'+n)}
    ${(n===1&&G.w1==='Sword and Shield')?itemField('shield',G.shield,'it_sh'):''}
    ${pin2('w'+n+'gem',G['w'+n+'gem'],'gem_w','Gem / runeglass')}
    ${pin2('w'+n+'p1',G['w'+n+'p1'],'armd','Weapon perk 1')}
    ${pin2('w'+n+'p2',G['w'+n+'p2'],'armd','Weapon perk 2')}
    ${pin2('w'+n+'p3',G['w'+n+'p3'],'armd','Weapon perk 3')}
    ${pin2('w'+n+'perk',G['w'+n+'perk'],'ch'+n,'Ability perk (skill charm)')}
    ${pin2('w'+n+'off',G['w'+n+'off'],'offd','Offence / defence charm')}</div>`;
  const arow=(s)=>`<div class="slot"><div class="sh">${s}</div>
    ${itemField('armor.'+s+'.item',G.armor[s].item,'it_'+s)}
    <select data-g="armor.${s}.wt">${['Light','Medium','Heavy'].map(w=>`<option ${G.armor[s].wt===w?'selected':''}>${w}</option>`).join('')}</select>
    ${pin2(`armor.${s}.gem`,G.armor[s].gem,'gem_a','Gem')}
    ${pin2(`armor.${s}.p1`,G.armor[s].p1,'armd','Perk 1')}
    ${pin2(`armor.${s}.p2`,G.armor[s].p2,'armd','Perk 2')}
    ${pin2(`armor.${s}.p3`,G.armor[s].p3,'armd','Perk 3')}
    ${pin2(`armor.${s}.ch`,G.armor[s].ch,'chA','Charm')}</div>`;
  const jrow=(s)=>`<div class="slot"><div class="sh">${s}<i class="warnlite">no attributes in S10</i></div>
    ${itemField('jew.'+s+'.item',G.jew[s].item,'it_'+s)}
    ${pin2(`jew.${s}.gem`,G.jew[s].gem,'gem_j','Gem')}
    ${pin2(`jew.${s}.p1`,G.jew[s].p1,'jewd','Perk 1')}
    ${pin2(`jew.${s}.p2`,G.jew[s].p2,'jewd','Perk 2')}
    ${pin2(`jew.${s}.ch`,G.jew[s].ch,'chA','Charm')}</div>`;
  const chosen=allChosen().filter(c=>c.p);
  const byGroup={}; const allP=notePresets(); const com=communityLos();
  const modeList=MODES.map(x=>x[0]).filter(m=>allP.some(p=>(p.modes||[]).includes(m)));
  const comTags=LO_TAGS.filter(t=>com.some(x=>loTags(x.mode).includes(t)));
  const isCom=/^community/.test(G.mode||''), comTag=isCom?(G.mode.split(':')[1]||''):'';
  if(G.mode&&!isCom&&!modeList.includes(G.mode)) G.mode='';
  if(isCom){ com.filter(x=>!comTag||loTags(x.mode).includes(comTag)).forEach(x=>{ const k=comTag||'Community'; (byGroup[k]=byGroup[k]||[]).push({name:x.name+(x.by?' · '+x.by:''), value:'c:'+x.code, fromNote:true}); }); }
  else allP.filter(p=>!G.mode||(p.modes||[]).includes(G.mode)).forEach(p=>{ const k=G.mode||p.folder; (byGroup[k]=byGroup[k]||[]).push(p); });
  return gemW+gemA+gemJ+charm1+charm2+offd+armd+jewd+chA+itDL+`<h1>Loadout builder</h1>
  <p class="lede">Equip the slots, or load one of your own builds and tweak it. Perk, gem and charm lists are the real Season 10 ones from your game-data export &mdash; start typing in any field to filter.</p>
  <div class="slots lobar">
   <div class="slot lcard"><div class="sh">Start from a build</div>
    <label class="lof"><span>Mode</span><select id="modesel"><option value="">All vault builds</option><optgroup label="Vault builds by mode">${modeList.map(m=>`<option ${G.mode===m?'selected':''}>${esc(m)}</option>`).join('')}</optgroup>
      <optgroup label="Community (${com.length})"><option value="community" ${G.mode==='community'?'selected':''}>Community: all</option>${comTags.map(t=>`<option value="community:${esc(t)}" ${G.mode==='community:'+t?'selected':''}>Community: ${esc(t)}</option>`).join('')}</optgroup></select></label>
    <label class="lof"><span>Build</span><select id="presetsel"><option value="">&mdash; pick one &mdash;</option>
      ${isCom&&!Object.keys(byGroup).length?'<option disabled>No community loadouts yet</option>':''}${Object.keys(byGroup).sort().map(g=>`<optgroup label="${esc(g)}">`+byGroup[g].map(p=>`<option value="${esc(p.value||p.name)}">${esc(p.name)}${p.fromNote?'':' (no loadout table)'}</option>`).join('')+`</optgroup>`).join('')}
</select></label>
    <div class="lbtns"><button class="mini go" id="loadpreset">Load</button><button class="mini" id="clearload">Empty everything</button></div></div>
   <div class="slot lcard"><div class="sh">Save this loadout</div>
    <label class="lof"><span>Name</span><input id="loname" class="pk loname" placeholder="e.g. OPR point tank"></label>
    <label class="lof"><span>Made for</span>${loTagSelect('lomode')}</label>
    <div class="lbtns"><button class="mini go" id="losave">&#128190; Save</button><a class="losub" data-view="myloadouts">&#127760; Submit your loadouts here &rarr;</a></div></div>
  </div>
    ${G.note?`<div class="loadnote">${esc(G.note)}</div>`:''}
  <div class="gearwrap">
    <div>
      <h2>&#9876; Weapons</h2><div class="slots">${wrow(1)}${wrow(2)}</div>
      <h2>&#128737; Armour <span class="loadtag">${load} load</span></h2>
      <div class="slots">${ARMOR_SLOTS.map(arow).join('')}</div>
      <h2>&#128141; Jewelry</h2><div class="slots">${JEW_SLOTS.map(jrow).join('')}</div>
      <h2>&#10024; Heartrune</h2>
      <div class="slot wide">
        ${icoFor(G.rune,'Heartrune')?`<img class="ico big" src="${icoFor(G.rune,'Heartrune')}" alt="">`:''}
        <select data-g="runev">${RVARIANTS.map(v=>`<option ${G.runev===v?'selected':''}>${v}</option>`).join('')}</select>
        <select data-g="rune">${RUNES.map(r=>`<option ${G.rune===r?'selected':''}>${esc(r)}</option>`).join('')}</select>
        <a class="wl" data-note="Heart Runes">What each one does &rarr;</a>
      </div>
      <h2>&#127919; Abilities</h2>
      <div class="slots">${[1,2].map(n=>{ const w=G['w'+n]; const l=(CALC?.abilities?.[w]||[]).map(a=>a.n);
        return `<div class="slot"><div class="sh">${esc(w)}</div>${[0,1,2].map(k=>{ const v=(G.abil[n]||[])[k]||''; const ic=icoFor(v,w);
          return `<div class="pkrow">${ic?`<img class="ico" src="${ic}" alt="">`:'<span class="ico none"></span>'}<select data-ga="${n}.${k}"><option value="">&mdash; ability ${k+1} &mdash;</option>${l.map(a=>`<option value="${esc(a)}" ${a===v?'selected':''}>${esc(a)}${abilWD(w,a)?' · '+abilWD(w,a)+' weapon dmg':''}</option>`).join('')}</select></div>`; }).join('')}</div>`; }).join('')}</div>
      <h2>&#127795; Skill trees</h2>
      ${[1,2].map(n=>skillTreeHTML(G['w'+n],G.trees[n],n)).join('')}
      <h2>&#128202; Attributes</h2>
      <div class="slot wide attrs">${[['STR','Strength'],['DEX','Dexterity'],['INT','Intelligence'],['FOC','Focus'],['CON','Constitution']].map(([k,l])=>
        `<label class="attr"><span>${l}</span><input type="number" min="0" max="500" step="5" data-gt="${k}" value="${G.attrs[k]||0}"></label>`).join('')}
        <span class="attrtot ${Object.values(G.attrs).reduce((a,b)=>a+(+b||0),0)>500?'bad':''}">${Object.values(G.attrs).reduce((a,b)=>a+(+b||0),0)} / 500 points</span>
        <a class="wl" data-note="Attribute Breakpoints">Breakpoints &rarr;</a>
      </div>
    </div>
    <aside class="sum">
      <h2>Totals</h2>
      <div class="tw"><table><tbody>
        ${[['fort','Fortify','%'],['emp','Empower','%'],['rend','Rend you apply','%'],['wkn','Weaken you apply','%'],
           ['dmg','Flat damage','%'],['crit','Crit chance','%'],['critd','Crit damage','%'],['ls','Lifesteal','%'],['abs','Absorption','%']]
          .map(([k,l])=>`<tr><td>${l}</td><td class="r">${t[k]?('+'+t[k].toFixed(1)+'%'):'&ndash;'}</td></tr>`).join('')}
      </tbody></table></div>
      <button class="mini go" id="tocalc">Send to the calculator &rarr;</button>
      <div class="callout note mini-co"><span class="ci">&#8505;</span><div><p>These are the numbers written on the perks, added up. Most only apply in a condition &mdash; on block, while exhausted, against a slowed target. Treat the total as "everything at once", which is your ceiling, not your average.</p></div></div>
      ${warn.length?`<h3>Stack checks</h3>${warn.map(w=>`<div class="chk ${w.bad?'bad':'ok'}">${w.bad?'&#9888;':'&#10003;'} <b>${w.n}&times; ${esc(w.label)}</b> &mdash; ${esc(w.advice)}</div>`).join('')}`:''}
      <h3>Items</h3>${[['Weapon 1',G.w1item],['Shield',G.shield],['Weapon 2',G.w2item]].concat(ARMOR_SLOTS.map(s=>[s,G.armor[s].item])).concat(JEW_SLOTS.map(s=>[s,G.jew[s].item])).filter(x=>x[1]).map(([s,n])=>`<div class="eq">${itemIcon(itemByName(n),22)}<b>${esc(n)}</b><i>${s}</i>${(itemByName(n)||{}).src?`<div>&#128205; ${esc(itemByName(n).src.slice(0,2).join(' · '))}</div>`:''}</div>`).join('')||'<p class="dimtx">No items picked &mdash; perks only.</p>'}
      <h3>Equipped perks (${chosen.length})</h3>
      ${chosen.length?chosen.map(c=>`<div class="eq">${icoFor(c.name)?`<img class="ico" src="${icoFor(c.name)}" alt="">`:''}<b>${esc(c.name)}</b><i>${esc(c.where)}</i><div>${esc(c.p.d.slice(0,150))}</div></div>`).join(''):'<p class="dimtx">Nothing equipped yet.</p>'}
    </aside>
  </div>`;
}
function setPath(path, val){
  const bits=path.split('.');
  let o=G;
  while(bits.length>1) o=o[bits.shift()];
  o[bits[0]]=val;
}
function gearEvents(){
  document.querySelectorAll('[data-gi]').forEach(el=>{
    el.onchange=()=>{ const it=itemByName(el.value);
      if(it){ equipItem(it,true); toast('Equipped '+it.n+(cleanPerks(it).length?' and its perks':'')); }
      else { setPath(el.dataset.gi, el.value); saveG(); }
      openView('gear',false); };
  });
  document.querySelectorAll('[data-g]').forEach(el=>{
    const h=()=>{ const m=el.dataset.g.match(/^w([12])$/); if(m&&G['w'+m[1]]!==el.value){ G.trees[m[1]]=[]; G.abil[m[1]]=[]; } setPath(el.dataset.g, el.value); G.note=''; saveG(); openView('gear',false); };
    if(el.tagName==='SELECT') el.onchange=h; else el.onchange=h;
  });
  document.querySelectorAll('[data-ga]').forEach(el=>el.onchange=()=>{ const [n,k]=el.dataset.ga.split('.'); G.abil[n]=G.abil[n]||[]; G.abil[n][+k]=el.value; saveG(); openView('gear',false); });
  document.querySelectorAll('[data-stn]').forEach(el=>el.onclick=()=>{
    const n=el.dataset.stn, nm=el.dataset.n, wt=G['w'+n]; const l=G.trees[n]=G.trees[n]||[]; const ps=new Set(l);
    const t=TREES[wt].find(t=>t.nodes.some(x=>x.n===nm)); const nd=t.nodes.find(x=>x.n===nm);
    if(ps.has(nm)){
      // removing a node also removes everything that hangs off it
      const drop=new Set([nm]);
      t.nodes.forEach(x=>{ if(x.k==='U' && treeChain(t,x).includes(nm)) drop.add(x.n); });
      let left=l.filter(x=>!drop.has(x));
      const ultN=t.nodes.find(x=>x.k==='X'); if(ultN && left.includes(ultN.n) && left.filter(x=>t.nodes.some(y=>y.n===x&&y.k!=='X')).length<10){ left=left.filter(x=>x!==ultN.n); drop.add(ultN.n); }
      G.trees[n]=left; if(drop.size>1) toast('Also removed: '+[...drop].filter(x=>x!==nm).join(', '));
    } else {
      const st=treeNodeState(t,nd,ps);
      if(st==='lock'){ const c=treeChain(t,nd); toast(nd.k==='X'?'The ultimate needs 10 points in this tree first':`Take ${c[c.length-1]} first`); return; }
      if(l.length>=19){ toast('19 points used: remove one first'); return; }
      l.push(nm);
    }
    saveG(); openView('gear',false); });
  document.querySelectorAll('[data-gt]').forEach(el=>el.onchange=()=>{ G.attrs[el.dataset.gt]=Math.max(0,parseInt(el.value)||0); saveG(); openView('gear',false); });
  const lsv=document.getElementById('losave'); if(lsv) lsv.onclick=()=>{ saveCurrentLoadout(document.getElementById('loname').value, document.getElementById('lomode').value); };
  const ms=document.getElementById('modesel'); if(ms) ms.onchange=()=>{ G.mode=ms.value; saveG(); openView('gear',false); };
  const lp=document.getElementById('loadpreset');
  if(lp) lp.onclick=()=>{
    const n=document.getElementById('presetsel').value;
    if(n.startsWith('c:')){ openSharedLo(n.slice(2)); return; }
    const L=parseLoadout(n);
    if(L&&Object.keys(L.slots).length){ applyLoadout(n,L); saveG(); openView('gear',false); toast('Loaded '+n+': every slot filled'); return; }
    const p=(PRESETS||[]).find(x=>x.name===n); if(!p) return;
    if(p.weapons[0]) G.w1=p.weapons[0]; if(p.weapons[1]) G.w2=p.weapons[1];
    ARMOR_SLOTS.forEach(s=>{ if(p.weights[s]) G.armor[s].wt=p.weights[s]; });
    // spread the named perks across armour slots, weapon charms first
    const named=[...p.perks];
    // an "ability perk" names one of the chosen weapons' abilities, e.g. Fortifying Shield Rush
    const abil=w=>(CALC?.abilities?.[w]||[]).map(a=>a.n.toLowerCase());
    const forW=w=>named.find(x=>abil(w).some(a=>x.toLowerCase().includes(a)));
    const best=x=>x&&perkByName(x+' II')?x+' II':(x||'');
    const a1=forW(G.w1), a2=forW(G.w2);
    G.w1perk=best(a1); G.w2perk=best(a2);
    const used=new Set([a1,a2].filter(Boolean));
    const gems=named.filter(x=>{const q=perkByName(x); return q&&q.t==='Gem';});
    G.w1gem=gems[0]||''; G.w2gem=gems[1]||'';
    const armor=named.filter(x=>{const q=perkByName(x); return q&&q.t!=='Gem'&&!used.has(x);});
    let i=0; ARMOR_SLOTS.forEach(s=>{ ['p1','p2','p3'].forEach(k=>{ G.armor[s][k]=armor[i++]||''; }); });
    if(p.rune){ const bits=p.rune.split(' '); G.runev=bits.shift(); G.rune=bits.join(' ').replace(/^Devourer$/,'The Devourer'); }
    // best-in-slot items from the note's table (fills their real perks)
    ['w1item','w2item','shield'].forEach(k=>G[k]=''); ARMOR_SLOTS.forEach(s=>G.armor[s].item=''); JEW_SLOTS.forEach(s=>G.jew[s].item='');
    const got=[], miss=[];
    bisFromNote(p.name).forEach(({slot,item})=>{
      if(/heartrune/i.test(slot)) return;
      const it=resolveBis(item);
      if(!it){ if(!/^crafted/i.test(item)) miss.push(item.replace(/\s*\(.*$/,'')); return; }
      if(/^(sword|main weapon)$/i.test(slot)&&it.s==='Weapon'){ G.w1=WT2LOAD[it.t]||it.t; }
      if(/^second weapon$/i.test(slot)&&it.s==='Weapon'){ G.w2=WT2LOAD[it.t]||it.t;
        const perks=cleanPerks(it); G.w2item=it.n; G.w2p1=perks[0]||''; G.w2p2=perks[1]||''; G.w2p3=perks[2]||''; got.push(it.n); return; }
      equipItem(it,true); got.push(it.n);
    });
    G.note=`Loaded “${p.name}” — ${p.attrs||'attributes in the note'}. Best-in-slot items equipped: ${got.length?got.join(', '):'none named (crafted build)'}.`+(miss.length?` Not found in the item list: ${miss.join(', ')}.`:'')+` Slots marked "crafted" are left for you to fill.`;
    saveG(); openView('gear',false); toast('Loaded '+p.name);
  };
  const cl=document.getElementById('clearload');
  if(cl) cl.onclick=()=>{
    ARMOR_SLOTS.forEach(s=>Object.assign(G.armor[s],{item:'',gem:'',p1:'',p2:'',p3:'',ch:''}));
    JEW_SLOTS.forEach(s=>Object.assign(G.jew[s],{item:'',gem:'',p1:'',p2:'',ch:''}));
    Object.assign(G,{w1gem:'',w2gem:'',w1perk:'',w2perk:'',w1off:'',w2off:'',w1item:'',w2item:'',shield:'',w1p1:'',w1p2:'',w1p3:'',w2p1:'',w2p2:'',w2p3:'',note:'',abil:{1:[],2:[]},attrs:{STR:0,DEX:0,INT:0,FOC:0,CON:0},trees:{1:[],2:[]}});
    saveG(); openView('gear',false);
  };
  const tc=document.getElementById('tocalc');
  if(tc) tc.onclick=()=>{
    const {t}=totals();
    C.emp=Math.min(50,Math.round(t.emp)); C.fort=Math.min(200,Math.round(t.fort));
    C.tRend=Math.min(70,Math.round(t.rend));
    const tb=[treeBonuses(G.w1,G.trees[1])];   // the calculator models weapon 1 const tv=k=>tb.reduce((s,b)=>s+((b[k]&&b[k].always)||0),0);
    C.critC=Math.min(100,Math.round(t.crit+tv('crit'))); C.critD=30+Math.round(t.critd+tv('critd')); C.base=Math.round(t.dmg+tv('dmg'));
    C.abs=Math.min(100,Math.round(t.abs));
    const counts={}; ARMOR_SLOTS.forEach(s=>counts[G.armor[s].wt]=(counts[G.armor[s].wt]||0)+1);
    C.weight=(counts.Heavy>=3?'Heavy':counts.Light>=4?'Light':'Medium'); C.mit=WEIGHTS[C.weight];
    C.weapon=G.w1; const l=(CALC?.abilities?.[G.w1]||[]); if(l[0]) C.ability=l[0].n;
    saveC(); openView('calc'); toast('Totals copied into the calculator');
  };
}

/* ================= your loadouts: saved in this browser, shared by link ================= */
const PUBLIC_SITE='https://noxieproxie.github.io/PA_TestVault/';
let MYLO=LS.get('nw_myloadouts',[]);
const saveMYLO=()=>LS.set('nw_myloadouts',MYLO);
function snapG(){ const g=JSON.parse(JSON.stringify(G)); delete g.note; delete g.mode; return g; }
const LO_TAGS=['Open-world PvE','Open-world PvP','Expeditions (normal)','Mutations M1','Mutations M2','Mutations M3','Raids','Catacombs','Outpost Rush','3v3 Arenas','Capture the Flag','Duels','FFA zone','Wars','Influence races'];
const loTags=s=>(s||'').split(/\s*[,·]\s*/).map(x=>x.trim()).filter(Boolean);
function loTagSelect(id,val){ return `<select id="${id}" class="lomode" title="What is this loadout for?"><option value="">Made for&hellip; (pick one)</option>${LO_TAGS.map(t=>`<option ${val===t?'selected':''}>${esc(t)}</option>`).join('')}</select>`; }
function saveCurrentLoadout(name, mode){
  if(!mode){ toast('Pick what the loadout is for (open world, M3, OPR, war...) first'); const s=document.querySelector('.lomode'); if(s) s.focus(); return null; }
  name=(name||'').trim()||`${G.w1} + ${G.w2}`;
  const ex=MYLO.find(x=>x.name.toLowerCase()===name.toLowerCase());
  const rec={id:ex?ex.id:('l'+Date.now()), name, mode, saved:new Date().toISOString(), g:snapG()};
  if(ex) Object.assign(ex,rec); else MYLO.unshift(rec);
  saveMYLO(); topnav(); toast(ex?`Updated “${name}”`:`Saved “${name}” to Your loadouts`); return rec;
}
// a shared loadout comes from someone else's link: keep only the expected shapes and safe values
function cleanLo(g){
  g=JSON.parse(JSON.stringify(g||{}));
  const str=v=>typeof v==='string'?v.slice(0,120):'';
  const out={}; const wl=CALC?Object.keys(CALC.abilities):[];
  ['w1','w2'].forEach(k=>out[k]=(!wl.length||wl.includes(g[k]))?str(g[k]):wl[0]);
  ['w1gem','w2gem','w1perk','w2perk','w1off','w2off','w1item','w2item','shield','w1p1','w1p2','w1p3','w2p1','w2p2','w2p3','rune','runev'].forEach(k=>out[k]=str(g[k]));
  out.armor={}; ARMOR_SLOTS.forEach(s=>{ const a=(g.armor||{})[s]||{}; out.armor[s]={wt:['Light','Medium','Heavy'].includes(a.wt)?a.wt:'Heavy',item:str(a.item),gem:str(a.gem),p1:str(a.p1),p2:str(a.p2),p3:str(a.p3),ch:str(a.ch)}; });
  out.jew={}; JEW_SLOTS.forEach(s=>{ const a=(g.jew||{})[s]||{}; out.jew[s]={item:str(a.item),gem:str(a.gem),p1:str(a.p1),p2:str(a.p2),ch:str(a.ch)}; });
  const arr=v=>Array.isArray(v)?v.filter(x=>typeof x==='string').map(x=>x.slice(0,80)).slice(0,40):[];
  out.abil={1:arr((g.abil||{})[1]).slice(0,3),2:arr((g.abil||{})[2]).slice(0,3)};
  out.trees={1:arr((g.trees||{})[1]),2:arr((g.trees||{})[2])};
  out.attrs={}; ['STR','DEX','INT','FOC','CON'].forEach(k=>{ const n=parseInt((g.attrs||{})[k],10); out.attrs[k]=isFinite(n)?Math.max(0,Math.min(500,n)):0; });
  return out;
}
function applyLo(g,label){
  LS.set('nw_gear_prev', snapG());   // keep what was in the builder, just in case
  const mode=G.mode; Object.keys(G).forEach(k=>delete G[k]); Object.assign(G, cleanLo(g), {mode});
  ARMOR_SLOTS.forEach(s=>{ if(G.armor[s].ch===undefined) G.armor[s].ch=''; }); JEW_SLOTS.forEach(s=>{ if(G.jew[s].ch===undefined) G.jew[s].ch=''; });
  if(!G.abil) G.abil={1:[],2:[]}; if(!G.trees) G.trees={1:[],2:[]}; if(!G.attrs) G.attrs={STR:0,DEX:0,INT:0,FOC:0,CON:0};
  G.note=`Loaded “${label}”.`; saveG();
}
async function encodeLo(rec){
  let bytes=new TextEncoder().encode(JSON.stringify({v:1,n:rec.name,by:rec.by||'',m:rec.mode||'',g:rec.g})), tag='j';
  if(typeof CompressionStream!=='undefined'){ try{ const cs=new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw')); bytes=new Uint8Array(await new Response(cs).arrayBuffer()); tag='z'; }catch(e){} }
  let s=''; for(let i=0;i<bytes.length;i++) s+=String.fromCharCode(bytes[i]);
  return tag+btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
async function decodeLo(str){
  const tag=str[0]; let b=str.slice(1).replace(/-/g,'+').replace(/_/g,'/'); while(b.length%4) b+='=';
  let bytes=Uint8Array.from(atob(b),c=>c.charCodeAt(0));
  if(tag==='z'){ const ds=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw')); bytes=new Uint8Array(await new Response(ds).arrayBuffer()); }
  return JSON.parse(new TextDecoder().decode(bytes));
}
function shareBase(){ return /github\.io$/.test(location.hostname) ? location.href.split('#')[0] : PUBLIC_SITE; }
async function shareLink(rec){ return shareBase()+'#lo='+(await encodeLo(rec)); }
async function copyText(t){ try{ await navigator.clipboard.writeText(t); return true; }catch(e){ return false; } }
async function openSharedLo(code){
  try{ const d=await decodeLo(code); applyLo(d.g, d.n+(d.by?' by '+d.by:''));
    G.note=`Shared loadout “${d.n}”${d.by?' by '+d.by:''}${d.m?' ('+d.m+')':''}. Press 💾 Save to keep a copy in Your loadouts.`; saveG();
    openView('gear',false); toast('Opened a shared loadout'); }
  catch(e){ toast('That loadout link is damaged or incomplete'); }
}
let COMMUNITY=[];   // community.json in the GitHub repo, written by the owner's Review page
function communityLos(){
  const out=COMMUNITY.map(x=>({...x, src:'site'}));
  const p=NAMES['Community Loadouts'];
  if(p) tableRows(META[p].body).slice(1).forEach(r=>{ const m=r.join(' ').match(/#lo=([A-Za-z0-9_-]+)/); if(m && !out.some(x=>x.code===m[1])) out.push({name:r[0].replace(/\[|\]/g,''),by:r[1]||'',mode:r[2]||'',code:m[1],src:'note'}); });
  return out;
}
/* ---------- GitHub: submissions are issues, the community list is community.json ---------- */
const GH={owner:'NoxieProxie', repo:'PA_TestVault'};
const ghToken=()=>LS.get('nw_gh_token','');
async function gh(path, opts={}){
  const h={'Accept':'application/vnd.github+json'}; const t=ghToken(); if(t) h.Authorization='Bearer '+t;
  if(opts.body) h['Content-Type']='application/json';
  const r=await fetch('https://api.github.com/repos/'+GH.owner+'/'+GH.repo+path,{...opts,headers:h,cache:'no-store'});
  if(!r.ok){ let m=''; try{ m=(await r.json()).message; }catch(e){} throw new Error(r.status+' '+(m||r.statusText)); }
  return r.status===204?null:r.json();
}
const b64e=s=>btoa(unescape(encodeURIComponent(s))), b64d=s=>decodeURIComponent(escape(atob(s.replace(/\n/g,''))));
/* ---------- pictures of a loadout for Discord posts (drawn on a canvas, sent as PNG) ---------- */
const RARCOL={Artifact:'#e8913a',Named:'#d9a84e',Set:'#5fbf6a',PVP:'#d65c5c',Faction:'#6fa8dc'};
const _imgC={};
function loadImg(src){ if(!src) return Promise.resolve(null); if(!_imgC[src]) _imgC[src]=new Promise(res=>{ const im=new Image(); im.onload=()=>res(im); im.onerror=()=>res(null); im.src=src; }); return _imgC[src]; }
async function drawItemIcon(cx,it,x,y,sz){
  if(!ITEMDB||!it||it.x<0||!SPRITES.length) return false;
  const T=ITEMDB.tile, C=ITEMDB.cols, sheet=Math.floor(it.x/ITEMDB.per), j=it.x%ITEMDB.per;
  const im=await loadImg(SPRITES[sheet]); if(!im) return false;
  cx.drawImage(im,(j%C)*T,Math.floor(j/C)*T,T,T,x,y,sz,sz); return true;
}
function fitText(cx,t,w){ t=String(t||''); if(cx.measureText(t).width<=w) return t; while(t.length>1&&cx.measureText(t+'…').width>w) t=t.slice(0,-1); return t+'…'; }
function rrect(cx,x,y,w,h,r){ cx.beginPath(); cx.moveTo(x+r,y); cx.arcTo(x+w,y,x+w,y+h,r); cx.arcTo(x+w,y+h,x,y+h,r); cx.arcTo(x,y+h,x,y,r); cx.arcTo(x,y,x+w,y,r); cx.closePath(); }
const FONT='"Segoe UI",Roboto,Arial,sans-serif';
function cardBase(w,h,title,sub){
  const cv=document.createElement('canvas'); cv.width=w; cv.height=h; const cx=cv.getContext('2d');
  const gr=cx.createLinearGradient(0,0,0,h); gr.addColorStop(0,'#1a1f2a'); gr.addColorStop(1,'#10141c'); cx.fillStyle=gr; cx.fillRect(0,0,w,h);
  cx.fillStyle='#d9a84e'; cx.fillRect(0,0,w,4);
  cx.font='700 26px '+FONT; cx.fillStyle='#f0d9a8'; cx.textBaseline='top'; cx.fillText(fitText(cx,title,w-48),24,18);
  if(sub){ cx.font='15px '+FONT; cx.fillStyle='#9aa3b2'; cx.fillText(fitText(cx,sub,w-48),24,52); }
  return {cv,cx};
}
async function gearCard(rec){
  const g=rec.g, rows=[];
  const perks=(...l)=>l.filter(Boolean);
  rows.push({h:'Weapons'});
  rows.push({slot:'Weapon 1 · '+g.w1, item:g.w1item, gem:g.w1gem, perks:perks(g.w1p1,g.w1p2,g.w1p3), ch:perks(g.w1perk,g.w1off).join(', ')});
  if(g.w1==='Sword and Shield') rows.push({slot:'Shield', item:g.shield});
  rows.push({slot:'Weapon 2 · '+g.w2, item:g.w2item, gem:g.w2gem, perks:perks(g.w2p1,g.w2p2,g.w2p3), ch:perks(g.w2perk,g.w2off).join(', ')});
  rows.push({h:'Armour'});
  ARMOR_SLOTS.forEach(sl=>{ const a=g.armor[sl]||{}; rows.push({slot:sl+(a.wt?' · '+a.wt:''), item:a.item, gem:a.gem, perks:perks(a.p1,a.p2,a.p3), ch:a.ch}); });
  rows.push({h:'Jewelry'});
  JEW_SLOTS.forEach(sl=>{ const a=g.jew[sl]||{}; rows.push({slot:sl, item:a.item, gem:a.gem, perks:perks(a.p1,a.p2), ch:a.ch}); });
  const W=1000, RH=58, HH=34;
  const H=96+rows.reduce((t,r)=>t+(r.h?HH:RH),0)+120;
  const {cv,cx}=cardBase(W,H,rec.name,[rec.mode,rec.by?'by '+rec.by:''].filter(Boolean).join('  ·  '));
  let y=88;
  for(const r of rows){
    if(r.h){ cx.font='700 13px '+FONT; cx.fillStyle='#d9a84e'; cx.fillText(r.h.toUpperCase(),24,y+12); cx.fillStyle='#2a3140'; cx.fillRect(24+cx.measureText(r.h.toUpperCase()).width+10,y+19,W-60-cx.measureText(r.h.toUpperCase()).width,1); y+=HH; continue; }
    cx.fillStyle='#161b25'; rrect(cx,20,y+3,W-40,RH-6,8); cx.fill();
    const it=r.item?itemByName(r.item):null;
    cx.fillStyle='#232a37'; rrect(cx,28,y+8,42,42,6); cx.fill();
    await drawItemIcon(cx,it,29,y+9,40);
    cx.font='12px '+FONT; cx.fillStyle='#8a93a3'; cx.fillText(fitText(cx,r.slot,250),82,y+9);
    cx.font='600 16px '+FONT; cx.fillStyle=it?(RARCOL[it.r]||'#e8e4da'):(r.item?'#e8e4da':'#6b7383');
    cx.fillText(fitText(cx,r.item||'Any',260),82,y+27);
    // gem + perks + charm with small icons
    let x=360; const line=[];
    if(r.gem) line.push({t:r.gem,gem:1}); (r.perks||[]).forEach(p=>line.push({t:p})); if(r.ch) line.push({t:r.ch,ch:1});
    cx.font='13.5px '+FONT;
    for(const p of line){
      if(x>W-60) break;
      const ic=icoFor(p.t); const im=ic?await loadImg(ic):null;
      if(im){ cx.drawImage(im,x,y+19,20,20); x+=24; }
      cx.fillStyle=p.gem?'#7fc4e8':p.ch?'#c9a6ff':'#d6d0c4';
      const t=fitText(cx,p.t.replace(/\s{2,}.*/,''),Math.min(210,W-40-x)); cx.fillText(t,x,y+21); x+=cx.measureText(t).width+18;
    }
    y+=RH;
  }
  // attributes, rune and perk totals
  y+=8; cx.fillStyle='#161b25'; rrect(cx,20,y,W-40,96,8); cx.fill();
  cx.font='700 13px '+FONT; cx.fillStyle='#d9a84e'; cx.fillText('ATTRIBUTES',36,y+12); cx.fillText('HEARTRUNE',560,y+12);
  const at=g.attrs||{}; let ax=36;
  ['STR','DEX','INT','FOC','CON'].forEach(k=>{ cx.font='12px '+FONT; cx.fillStyle='#8a93a3'; cx.fillText(k,ax,y+36); cx.font='700 20px '+FONT; cx.fillStyle='#e8e4da'; cx.fillText(String(at[k]||0),ax,y+52); ax+=96; });
  cx.font='600 16px '+FONT; cx.fillStyle='#e8e4da'; cx.fillText(fitText(cx,[g.runev,g.rune].filter(Boolean).join(' ')||'—',400),560,y+36);
  const T=totals(g).t, lb={fort:'Fortify',emp:'Empower',rend:'Rend',dmg:'Damage',crit:'Crit',critd:'Crit dmg',ls:'Lifesteal',abs:'Absorb',wkn:'Weaken'};
  const tl=Object.keys(lb).filter(k=>T[k]).map(k=>lb[k]+' '+(+T[k].toFixed(1))+'%');
  cx.font='13.5px '+FONT; cx.fillStyle='#9aa3b2'; cx.fillText(fitText(cx,tl.length?'From perks: '+tl.join(' · '):'',W-600),560,y+62);
  return cv;
}
async function treesCard(rec){
  const g=rec.g, ws=[1,2].map(n=>({n,wt:g['w'+n],picks:new Set((g.trees||{})[n]||[]),ab:((g.abil||{})[n]||[])}));
  const P=50, C=22, TW=260, BW=2*TW+20, W=24*2+BW*2+30, H=540;
  const {cv,cx}=cardBase(W,H,rec.name+'  ·  skill trees',ws.map(w=>w.wt).join('  +  '));
  for(const [wi,w] of ws.entries()){
    const ox=24+wi*(BW+30), oy=88, tr=(TREES||{})[w.wt]||[];
    const pts=tr.reduce((s,t)=>s+t.nodes.filter(nd=>w.picks.has(nd.n)).length,0);
    cx.font='700 17px '+FONT; cx.fillStyle='#f0d9a8'; cx.fillText(w.wt,ox,oy); const tw=cx.measureText(w.wt).width;
    cx.font='14px '+FONT; cx.fillStyle=pts>19?'#e06c6c':'#9aa3b2'; cx.fillText(pts+' / 19 points',ox+tw+12,oy+2);
    // chosen abilities
    let ax=ox; cx.font='13px '+FONT;
    for(const a of w.ab){ const ic=icoFor(a,w.wt), im=ic?await loadImg(ic):null; if(im) cx.drawImage(im,ax,oy+26,22,22); cx.fillStyle='#d6d0c4'; const t=fitText(cx,a,140); cx.fillText(t,ax+(im?26:0),oy+30); ax+=(im?26:0)+cx.measureText(t).width+16; }
    for(const [ti,t] of tr.entries()){
      const tx=ox+ti*(TW+20), ty=oy+62;
      cx.fillStyle='#161b25'; rrect(cx,tx,ty,TW,H-ty-14,10); cx.fill();
      const n=t.nodes.filter(nd=>w.picks.has(nd.n)).length;
      cx.font='600 13px '+FONT; cx.fillStyle='#d9a84e'; cx.fillText(fitText(cx,t.t+'  ·  '+n,TW-20),tx+10,ty+8);
      const gx=tx+8, gy=ty+34, at={}; t.nodes.forEach(nd=>at[nd.n]=nd);
      t.nodes.filter(nd=>nd.k==='A').forEach(a=>{ const ch=[a].concat(t.nodes.filter(x=>x.k==='U'&&x.p===a.n).sort((x,y)=>x.r-y.r));
        for(let i=1;i<ch.length;i++){ const p=ch[i-1], q=ch[i], lit=w.picks.has(p.n)&&w.picks.has(q.n);
          cx.strokeStyle=lit?'#d9a84e':'#2c3443'; cx.lineWidth=lit?3:2; cx.beginPath(); cx.moveTo(gx+p.c*P+C,gy+p.r*P+C); cx.lineTo(gx+q.c*P+C,gy+q.r*P+C); cx.stroke(); } });
      for(const nd of t.nodes){
        const on=w.picks.has(nd.n), r=nd.k==='X'?21:nd.k==='A'?19:15, x=gx+nd.c*P+C, y=gy+nd.r*P+C;
        cx.save(); cx.globalAlpha=on?1:.28;
        cx.beginPath(); cx.arc(x,y,r,0,7); cx.fillStyle='#0d1118'; cx.fill();
        const ic=icoFor(nd.n,w.wt), im=ic?await loadImg(ic):null;
        if(im){ cx.save(); cx.beginPath(); cx.arc(x,y,r-2,0,7); cx.clip(); cx.drawImage(im,x-r+2,y-r+2,(r-2)*2,(r-2)*2); cx.restore(); }
        cx.beginPath(); cx.arc(x,y,r,0,7); cx.lineWidth=on?3:1.5; cx.strokeStyle=on?(nd.k==='X'?'#ff9d4d':'#d9a84e'):'#3a4252'; cx.stroke();
        cx.restore();
      }
    }
  }
  return cv;
}
const cvB64=cv=>cv.toDataURL('image/png').split(',')[1];
async function loPictures(rec){ return [{name:'gear.png',data:cvB64(await gearCard(rec))},{name:'trees.png',data:cvB64(await treesCard(rec))}]; }
async function announceToDiscord(entry){
  const rec=await decodeLo(entry.code); rec.name=entry.name||rec.n; rec.mode=entry.mode||rec.m||''; rec.by=entry.by||rec.by||'';
  const images=await loPictures(rec);
  return ownerApi('announce',{entry:{name:rec.name,by:rec.by,mode:rec.mode,code:entry.code,did:entry.did||'',weapons:rec.g.w1+' + '+rec.g.w2,rune:[rec.g.runev,rec.g.rune].filter(Boolean).join(' '),site:shareBase()},images});
}
let CFG={worker:''};   // site-config.json: {"worker":"https://...workers.dev"} turns on Discord login
async function loadCommunity(){
  try{ const r=await fetch('community.json',{cache:'no-cache'}); if(r.ok) COMMUNITY=await r.json(); }catch(e){}
  try{ const r=await fetch('site-config.json',{cache:'no-cache'}); if(r.ok) CFG=Object.assign(CFG,await r.json()); }catch(e){}
  CFG.worker=(CFG.worker||'').replace(/\/+$/,'');
}
const dPass=()=>LS.get('nw_discord','');
function dUser(){ const p=dPass(); if(!p) return null; try{ let s=p.split('.')[0].replace(/-/g,'+').replace(/_/g,'/'); while(s.length%4) s+='=';
  const o=JSON.parse(decodeURIComponent(escape(atob(s)))); if(o.exp<Date.now()){ LS.del('nw_discord'); return null; } return o; }catch(e){ return null; } }
function dAvatar(u){
  if(u&&u.av) return 'https://cdn.discordapp.com/avatars/'+encodeURIComponent(u.id)+'/'+encodeURIComponent(u.av)+'.png?size=64';
  let n=0; try{ n=Number((BigInt(u.id)>>22n)%6n); }catch(e){}
  return 'https://cdn.discordapp.com/embed/avatars/'+n+'.png';
}
function loginHref(){ return CFG.worker+'/login'; }
function rememberReturn(){ LS.set('nw_after_login',(location.hash||'').replace('#','')||'myloadouts'); }
function renderAcct(){
  const el=document.getElementById('acct'); if(!el) return;
  if(!CFG.worker){ el.innerHTML=''; return; }
  const u=dUser();
  if(!u){ el.innerHTML=`<a class="acctin" id="acctlogin" href="${esc(loginHref())}" title="Log in with Discord"><span class="dlogo">&#9673;</span> Log in</a>`;
    document.getElementById('acctlogin').onclick=rememberReturn; return; }
  const own=!!(OWNER&&OWNER.owner);
  const letter=esc((u.name||'?').trim().charAt(0).toUpperCase()||'?');
  el.innerHTML=`<div class="drop right acctd"><button class="nb acctnb" title="${esc(u.name)}"><span class="avw"><span class="avl">${letter}</span>${u.av?`<img class="av" src="${esc(dAvatar(u))}" alt="" referrerpolicy="no-referrer" onerror="this.remove()">`:''}</span><span class="acn">${esc(u.name)}</span>${own?'<span class="ownb">owner</span>':''}<span class="car">&#9662;</span></button>
    <div class="menu"><div class="mh">Logged in with Discord</div><div class="mn"><b>${esc(u.name)}</b> <span class="dimtx">@${esc(u.user||'')}</span></div>
      ${u.av?'':`<div class="mn tiny">No profile picture in this login. ${(OWNER&&OWNER.owner)?'Check the helper page says <b>Version 3</b>, then log out and back in.':'Log out and back in to load it.'}</div>`}
      <a class="mi" data-view="myloadouts">&#128190; Your loadouts</a>
      ${own?`<a class="mi" data-view="admin">&#128736; Admin</a><div class="mn tiny">You can edit this site: use <b>&#9998; Edit</b> on any page, <b>&#9881;</b> (top right) for the look, and drag tabs to reorder.</div>`:''}
      <a class="mi" id="acctout">&#8617; Log out</a></div></div>`;
  document.getElementById('acctout').onclick=()=>{ LS.del('nw_discord'); location.reload(); };
}
function handleAuthHash(h){
  if(h.startsWith('discord=')){ LS.set('nw_discord',h.slice(8)); OWNER=null; const u=dUser(); const after=LS.get('nw_after_login','')||'myloadouts'; LS.del('nw_after_login');
    try{ history.replaceState(null,'','#'+after); }catch(e){}
    if(['builds','bosses','calc','gear','items','myloadouts','review','admin'].includes(after)) openView(after,false);
    else { const hit=Object.keys(NAMES).find(n=>slug(n)===after); hit?openNote(hit,false):openView('myloadouts',false); }
    renderAcct(); toast(u?'Logged in as '+u.name:'Logged in'); return true; }
  if(h.startsWith('error=login')){ try{ history.replaceState(null,'','#myloadouts'); }catch(e){} openView('myloadouts',false); toast('Discord login did not finish. Try again.'); return true; }
  return false;
}
async function submitViaHelper(rec){
  const u=dUser(); if(!u){ toast('Log in with Discord first (top right)'); return; }
  const code=await encodeLo(rec);
  const r=await fetch(CFG.worker+'/submit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pass:dPass(),name:rec.name,mode:rec.mode,code,weapons:rec.g.w1+' + '+rec.g.w2})});
  let d={}; try{ d=await r.json(); }catch(e){}
  if(r.ok) toast('Submitted! The site owner will review it.'); else { if(r.status===401) LS.del('nw_discord'); toast(d.error||('Could not submit ('+r.status+')')); openView('myloadouts',false); }
}
/* Owner actions through the helper (Discord login, no GitHub token in the browser) */
let OWNER=null;   // null = not checked yet, {owner:true/false,name}
async function ownerApi(action, data={}){
  const r=await fetch(CFG.worker+'/owner',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pass:dPass(),action,...data})});
  let d={}; try{ d=await r.json(); }catch(e){}
  if(r.status===401){ LS.del('nw_discord'); OWNER=null; }
  if(!r.ok) throw new Error(d.error||('helper said '+r.status));
  return d;
}
const viaHelper=()=>!!(CFG.worker && dUser() && OWNER && OWNER.owner);
async function checkOwner(){
  if(!CFG.worker || !dUser()){ OWNER=null; return; }
  try{ OWNER=await ownerApi('whoami'); }catch(e){ OWNER={owner:false, err:e.message}; }
  renderAcct();
  if(current?.kind==='view'&&current.v==='admin'){ openView('admin',false); }
}
async function submitIssueUrl(rec){
  const link=await shareLink(rec);
  const body=`**Loadout:** ${rec.name}\n**Weapons:** ${rec.g.w1} + ${rec.g.w2}\n**Mode:** ${rec.mode||'(say which mode it is for)'}\n**By:** (your in-game name)\n\nOpen it: ${link}\n\n_Submitted from the New World vault site. The site owner reviews it before it appears in Community loadouts._`;
  return `https://github.com/${GH.owner}/${GH.repo}/issues/new?title=${encodeURIComponent('[Loadout] '+rec.name)}&body=${encodeURIComponent(body)}`;
}
async function listSubmissions(){
  const l=viaHelper()?(await ownerApi('submissions')).issues.map(i=>({...i,user:{login:i.login}})):await gh('/issues?state=open&per_page=50');
  return l.filter(i=>!i.pull_request && /^\[Loadout\]/i.test(i.title)).map(i=>{
    const m=(i.body||'').match(/#lo=([A-Za-z0-9_-]+)/); const by=((i.body||'').match(/\*\*By:\*\*\s*(.+)/)||[,''])[1].trim();
    const mode=((i.body||'').match(/\*\*Mode:\*\*\s*(.+)/)||[,''])[1].trim();
    const did=((i.body||'').match(/\(id (\d{5,25})\)/)||[,''])[1];
    return {num:i.number, did, title:i.title.replace(/^\[Loadout\]\s*/i,''), user:i.user.login, by:/^\(your/.test(by)?'':by, mode:/^\(say/.test(mode)?'':mode, code:m?m[1]:'', url:i.html_url, at:i.created_at};
  });
}
async function writeCommunity(fn, msg){
  let sha=null, list=[];
  try{ const f=await gh('/contents/community.json'); sha=f.sha; list=JSON.parse(b64d(f.content)); }catch(e){ if(!/^404/.test(e.message)) throw e; }
  list=fn(list);
  await gh('/contents/community.json',{method:'PUT',body:JSON.stringify({message:msg, content:b64e(JSON.stringify(list,null,1)), ...(sha?{sha}:{}), branch:'main'})});
  COMMUNITY=list; topnav();
}
async function publishToCommunity(entry, issueNum){
  if(viaHelper()){ const d=await ownerApi('publish',{entry,issue:issueNum||0}); COMMUNITY=d.community; topnav(); return; }
  await writeCommunity(l=>{ l=l.filter(x=>x.code!==entry.code); l.unshift({name:entry.name, by:entry.by||'', mode:entry.mode||'', code:entry.code, added:new Date().toISOString().slice(0,10)}); return l; }, 'Community loadout: '+entry.name);
  if(issueNum){ try{ await gh('/issues/'+issueNum+'/comments',{method:'POST',body:JSON.stringify({body:'Published to Community loadouts. Thanks!'})});
    await gh('/issues/'+issueNum,{method:'PATCH',body:JSON.stringify({state:'closed',state_reason:'completed'})}); }catch(e){} }
}
async function removeFromCommunity(code){
  if(viaHelper()){ const d=await ownerApi('remove',{code}); COMMUNITY=d.community; topnav(); return; }
  await writeCommunity(l=>l.filter(x=>x.code!==code),'Remove community loadout');
}
async function rejectSubmission(num){
  if(viaHelper()){ await ownerApi('reject',{issue:num}); return; }
  await gh('/issues/'+num+'/comments',{method:'POST',body:JSON.stringify({body:'Thanks for sending this in. It wasn\'t added to Community loadouts this time.'})});
  await gh('/issues/'+num,{method:'PATCH',body:JSON.stringify({state:'closed',state_reason:'not_planned'})});
}
let BOTCH=null, BOTCHERR='', STAT=null, STATERR='', STATALL=LS.get('nw_statall',false);
function statusView(){
  if(!viaHelper()) return '<p class="dimtx">Service status needs the Discord login (helper Version 6 or newer).</p>';
  const dot=i=>({none:'&#128994;',minor:'&#128993;',major:'&#128992;',critical:'&#128308;',maintenance:'&#128309;'}[i]||'&#9898;');
  const list=STAT===null?(STATERR?`<p class="bad">${esc(STATERR)}</p>`:'<p class="dimtx">Checking Cloudflare and GitHub&hellip;</p>'):STAT.map(sv=>`<div class="slot lcard stcard"><div class="sh">${sv.icon} ${esc(sv.name)}</div>
      <div class="stline">${dot(sv.indicator)} <b>${esc(sv.description)}</b> <a class="wl tiny" href="${esc(sv.page)}" target="_blank" rel="noopener">status page &rarr;</a></div>
      ${sv.incidents.length?sv.incidents.map(i=>`<div class="stinc"><div><a href="${esc(i.link)}" target="_blank" rel="noopener"><b>${esc(i.name)}</b></a> <span class="tag">${esc(i.status)}</span> <span class="tag">${esc(i.impact)} impact</span>${i.relevant?'':' <span class="dimtx tiny">(not something the site uses)</span>'}</div>
        ${i.components.length?`<div class="dimtx tiny">Affects: ${esc(i.components.join(', '))}</div>`:''}
        <ol class="stups">${i.updates.map(u=>`<li><b>${esc(u.status.replace(/_/g,' '))}</b> <span class="dimtx tiny">${new Date(u.at).toLocaleString()}</span><div>${esc(u.body)}</div></li>`).join('')}</ol></div>`).join('')
      :`<p class="dimtx">No open issues${STATALL?'':' affecting the site or bot'}.${sv.hidden?` ${sv.hidden} other issue${sv.hidden>1?'s':''} elsewhere.`:''}</p>`}</div>`).join('');
  return `<p class="dimtx">Cloudflare runs the helper and the Discord bot; GitHub runs the site. By default this only shows problems with the parts the site uses (Workers, dashboard, API &middot; Pages, Actions, Issues).</p>
  <div class="presetbar"><button class="mini" id="statref">&#8635; Refresh</button><label class="dimtx"><input type="checkbox" id="statall" ${STATALL?'checked':''}> Show every incident (lots of these are single data centres)</label></div>
  <div class="slots lobar">${list}</div>`;
}
async function loadStatus(){ STAT=null; STATERR=''; try{ STAT=(await ownerApi('status',{all:STATALL})).services; }catch(e){ STATERR=e.message; }
  if(current?.kind==='view'&&current.v==='admin'&&ADMTAB==='status') openView('admin',false); }
function botCard(b){
  const row=(ok,txt,fix)=>`<tr><td>${ok?'&#9989;':'&#11036;'}</td><td>${txt}</td><td class="dimtx">${ok?'':fix}</td></tr>`;
  const ready=b.token&&b.key;
  const opts=(sel)=>BOTCH?BOTCH.guilds.map(g=>`<optgroup label="${esc(g.name)}">${g.channels.map(c=>`<option value="${c.id}" ${sel===c.id?'selected':''}>#${esc(c.name)}${c.cat?' ('+esc(c.cat)+')':''}</option>`).join('')}</optgroup>`).join(''):'';
  const chans=!b.token?'<p class="dimtx">Add the bot token first.</p>'
    :BOTCH===null?(BOTCHERR?`<p class="bad">${esc(BOTCHERR)}</p>`:'<p class="dimtx">Loading your server\'s channels&hellip;</p>')
    :!BOTCH.guilds.length?`<p class="dimtx">The bot isn't in a server yet. Use <b>Add the bot to your server</b> below, then <a class="wl" id="botchre">reload the channel list</a>.</p>`
    :`<div class="two"><label class="lof"><span>Post published loadouts in</span><select id="botch"><option value="">Don't post with the bot (use the webhook)</option>${opts(b.channel)}</select></label>
       <label class="lof"><span>Moderation log</span><select id="botlog"><option value="">No log</option>${opts(b.log)}</select></label></div>
       <div class="two"><label class="lof"><span>Cloudflare &amp; GitHub status alerts</span><select id="botstatus"><option value="">Don't post status alerts</option>${opts(b.status)}</select></label>
       <label class="lof"><span>Which incidents</span><select id="botstatall"><option value="">Only ones affecting the site and bot</option><option value="1" ${b.statusAll?'selected':''}>Every incident (very chatty)</option></select></label></div>
       <p class="dimtx tiny">Status alerts need a Cron Trigger on the helper: Cloudflare &rarr; nw-vault-helper &rarr; Settings &rarr; Trigger events &rarr; Add &rarr; Cron, schedule <code>*/5 * * * *</code>. <a class="wl" id="statnow">Check for updates now</a> <span id="statnowst"></span></p>
       <div class="lbtns"><button class="mini go" id="botchsave">Save channels</button><a class="wl tiny" id="botchre">Reload channel list</a><span id="botchst" class="dimtx"></span></div>`;
  return `<h2>Discord bot</h2>
  <div class="slots lobar">
   <div class="slot lcard" style="grid-column:1/-1"><div class="sh">1. Connect the bot</div>
    <div class="tw"><table><tbody>
      ${row(b.token,'Bot token','Developer Portal &rarr; your app &rarr; <b>Bot</b> &rarr; Reset Token, then add <code>DISCORD_BOT_TOKEN</code> (Secret) to the helper')}
      ${row(b.key,'Public key','Developer Portal &rarr; your app &rarr; <b>General Information</b> &rarr; Public Key, then add <code>DISCORD_PUBLIC_KEY</code> (Text) to the helper')}
    </tbody></table></div>
    <label class="lof"><span>Interactions Endpoint URL (paste into the Developer Portal &rarr; General Information)</span><input class="pk" readonly value="${esc(b.endpoint)}" onclick="this.select()"></label>
    <div class="lbtns"><button class="mini go" id="botsetup" ${ready?'':'disabled'}>Register slash commands</button>
      ${b.invite?`<a class="mini" href="${esc(b.invite)}" target="_blank" rel="noopener">&#10133; Add the bot to your server</a>`:''}<span id="botstat" class="dimtx"></span></div></div>
   <div class="slot lcard" style="grid-column:1/-1"><div class="sh">2. Channels</div>${chans}</div>
  </div>`;
}
async function loadBotChannels(){ BOTCH=null; BOTCHERR=''; try{ const d=await ownerApi('botchannels'); BOTCH=d; if(OWNER&&OWNER.bot){ OWNER.bot.channel=d.channel; OWNER.bot.log=d.log; } }catch(e){ BOTCHERR=e.message; }
  if(current?.kind==='view'&&current.v==='admin'&&ADMTAB==='bot') openView('admin',false); }
let SUBS=null, SUBERR='', ADMTAB=LS.get('nw_admtab','subs');
function viewReview(){
  const t=ghToken(), u=CFG.worker?dUser():null, helper=viaHelper();
  const tokenBox=`<div class="slot wide losave"><input id="ghtok" type="password" placeholder="Paste your GitHub token here" value=""><button class="mini go" id="ghtoksave">Save token</button>${t?'<button class="mini" id="ghtokdel">Forget token</button>':''}</div>`;
  // only the owner (or someone with the GitHub token saved) ever sees this page; everyone else is sent home
  if(!helper && !t){
    if(CFG.worker && u && OWNER===null) return '<p class="dimtx">Loading&hellip;</p>';
    setTimeout(()=>{ if(current?.kind==='view'&&current.v==='admin') openNote((typeof SITE!=='undefined'&&NAMES[SITE.start])?SITE.start:'New World Home',false); },0);
    return '';
  }
  const rows=SUBS===null?'<p class="dimtx">Loading submissions&hellip;</p>':SUBERR?`<p class="bad">Couldn't read submissions: ${esc(SUBERR)}</p>`:
    (SUBS.length?SUBS.map((s,i)=>`<div class="locard"><div><b>${esc(s.title)}</b><div class="dimtx">from ${esc(s.by||s.user)}${s.mode?' &middot; '+esc(s.mode):''} &middot; ${new Date(s.at).toLocaleDateString()} &middot; <a href="${esc(s.url)}" target="_blank" rel="noopener">issue #${s.num}</a></div>${s.code?'':'<div class="bad">No loadout link found in this submission</div>'}</div>
      <div class="lobtns">${s.code?`<button class="mini" data-subprev="${i}">Preview</button><button class="mini go" data-subpub="${i}">Publish</button>`:''}<button class="mini" data-subrej="${i}">Reject</button></div></div>`).join(''):'<p class="dimtx">No submissions waiting.</p>');
  const com=communityLos().filter(x=>x.src==='site');
  const tabs=[['subs','&#128229; Submissions'+(SUBS&&SUBS.length?` <span class="admn">${SUBS.length}</span>`:'')],['published','&#127760; Community ('+com.length+')'],['bot','&#129302; Discord bot'],['status','&#128225; Service status'+(STAT&&STAT.some(x=>x.incidents.length)?' <span class="admn">!</span>':'')],['helper','&#9881; Helper & links']];
  if(!tabs.some(x=>x[0]===ADMTAB)) ADMTAB='subs';
  const head=`<h1>Admin</h1>
  <p class="lede">Only you can see this page. ${helper?`Signed in as <b>${esc(OWNER.name||u.name)}</b> with Discord.`:'Using a GitHub token in this browser.'}</p>
  <div class="admtabs">${tabs.map(([k,l])=>`<button class="chip ${ADMTAB===k?'on':''}" data-admtab="${k}">${l}</button>`).join('')}</div>`;
  let body='';
  if(ADMTAB==='subs') body=`<p class="dimtx">Loadouts people have submitted. <b>Preview</b> opens one in the builder, <b>Publish</b> puts it in Community loadouts for everyone, <b>Reject</b> closes it with a polite note.</p>
  <div class="presetbar"><button class="mini" id="subrefresh">&#8635; Refresh</button>${helper?(OWNER.discord?`<label class="dimtx"><input type="checkbox" id="dpost" ${LS.get('nw_dpost',true)?'checked':''}> Also post to Discord when I publish</label>`:`<span class="dimtx tiny">Add DISCORD_WEBHOOK_URL or the bot settings to the helper to post published loadouts to Discord.</span>`):''}</div>
  ${rows}
  <h2>Add one from a link</h2>
  <div class="slots lobar"><div class="slot lcard"><div class="sh">Publish a share link</div>
    <label class="lof"><span>Share link</span><input id="addlink" class="pk" placeholder="Paste a share link someone sent you"></label>
    <div class="two"><label class="lof"><span>Name</span><input id="addname" class="pk" placeholder="Leave blank to use its own name"></label><label class="lof"><span>By</span><input id="addby" class="pk" placeholder="Who made it"></label></div>
    <label class="lof"><span>Made for</span>${loTagSelect('addmode')}</label>
    <div class="lbtns"><button class="mini go" id="addpub">Publish</button></div></div></div>`;
  if(ADMTAB==='published') body=`<p class="dimtx">Everything in Community loadouts. Changes go live after GitHub rebuilds the site (a minute or two).</p>
  ${com.length?com.map((x,i)=>`<div class="locard"><div><b>${esc(x.name)}</b><div class="dimtx">${esc(x.by)}${x.mode?' &middot; '+esc(x.mode):''}${x.added?' &middot; added '+esc(x.added):''}${x.img?' &middot; has pictures':''}</div></div><div class="lobtns"><button class="mini" data-colo2="${esc(x.code)}">Open</button>${helper&&OWNER.discord?`<button class="mini" data-dpost="${esc(x.code)}">&#128227; Post to Discord</button>`:''}<button class="mini" data-comdel="${esc(x.code)}">Remove</button></div></div>`).join(''):'<p class="dimtx">Nothing published yet.</p>'}`;
  if(ADMTAB==='bot') body=helper&&OWNER.bot?botCard(OWNER.bot).replace('<h2>Discord bot</h2>',''):`<p class="dimtx">The Discord bot settings need the Discord login (helper Version 5 or newer).</p>`;
  if(ADMTAB==='status') body=statusView();
  if(ADMTAB==='helper') body=`<div class="slots lobar">
    <div class="slot lcard"><div class="sh">Helper status</div><pre class="helperst" id="helperst">${CFG.worker?'Checking&hellip;':'No helper set in site-config.json'}</pre>
      <div class="lbtns"><button class="mini" id="helperchk">&#8635; Check again</button>${CFG.worker?`<a class="mini" href="${esc(CFG.worker)}" target="_blank" rel="noopener">Open helper page</a>`:''}</div></div>
    <div class="slot lcard"><div class="sh">Your account</div>
      ${helper?`<div class="dlogin">&#9989; <b>${esc(OWNER.name||u.name)}</b> <span class="dimtx">owner, via Discord</span><button class="mini" id="revlogout">Log out</button></div>`
        :CFG.worker?(!u?`<div class="dlogin"><a class="dbtn" id="revlogin" href="${esc(CFG.worker)}/login">Log in with Discord</a></div>`:`<div class="dlogin">Logged in as <b>${esc(u.name)}</b>, not the owner.<button class="mini" id="revlogout">Log out</button></div>`):''}
      <details class="tiny dimtx"><summary>GitHub token (fallback)</summary>${tokenBox}</details></div>
    <div class="slot lcard" style="grid-column:1/-1"><div class="sh">Quick links</div><div class="tw"><table><tbody>
      <tr><td>Public site</td><td><a href="${esc(PUBLIC_SITE)}" target="_blank" rel="noopener">${esc(PUBLIC_SITE)}</a></td></tr>
      <tr><td>GitHub repo</td><td><a href="https://github.com/${GH.owner}/${GH.repo}" target="_blank" rel="noopener">${GH.owner}/${GH.repo}</a></td></tr>
      <tr><td>Submissions on GitHub</td><td><a href="https://github.com/${GH.owner}/${GH.repo}/issues" target="_blank" rel="noopener">Issues</a></td></tr>
      <tr><td>Site build progress</td><td><a href="https://github.com/${GH.owner}/${GH.repo}/actions" target="_blank" rel="noopener">GitHub Actions</a></td></tr>
      <tr><td>Cloudflare (helper settings)</td><td><a href="https://dash.cloudflare.com" target="_blank" rel="noopener">dash.cloudflare.com</a> &rarr; Workers &amp; Pages &rarr; nw-vault-helper</td></tr>
      <tr><td>Discord app (login + bot)</td><td><a href="https://discord.com/developers/applications" target="_blank" rel="noopener">Developer Portal</a></td></tr>
    </tbody></table></div></div></div>`;
  return head+body+`<p class="dimtx tiny" style="margin-top:20px">Published loadouts go live on the site after GitHub rebuilds it (a minute or two).</p>`;
}
async function refreshSubs(){ SUBS=null; SUBERR=''; try{ SUBS=await listSubmissions(); }catch(e){ SUBS=[]; SUBERR=e.message; } if(current?.kind==='view'&&current.v==='admin') openView('admin',false); }
function reviewEvents(){
  const on=(id,f)=>{ const e=document.getElementById(id); if(e) e.onclick=f; };
  on('ghtoksave',()=>{ const v=document.getElementById('ghtok').value.trim(); if(!v) return; LS.set('nw_gh_token',v); toast('Token saved in this browser'); refreshSubs(); openView('admin',false); });
  on('ghtokdel',()=>{ LS.del('nw_gh_token'); SUBS=null; openView('admin',false); });
  on('subrefresh',refreshSubs);
  document.querySelectorAll('[data-admtab]').forEach(el=>el.onclick=()=>{ ADMTAB=el.dataset.admtab; LS.set('nw_admtab',ADMTAB); openView('admin',false); });
  const hs=document.getElementById('helperst');
  const chk=async()=>{ if(!hs||!CFG.worker) return; hs.textContent='Checking…'; try{ const r=await fetch(CFG.worker+'/',{cache:'no-store'}); hs.textContent=(await r.text()).trim(); }catch(e){ hs.textContent='Could not reach the helper: '+e.message; } };
  if(hs) chk(); on('helperchk',chk);
  on('revlogout',()=>{ LS.del('nw_discord'); location.reload(); });
  const rl=document.getElementById('revlogin'); if(rl) rl.addEventListener('click',()=>LS.set('nw_after_login','admin'));
  const busy=async(el,f,ok)=>{ el.disabled=true; try{ await f(); toast(ok); }catch(e){ toast((viaHelper()?'':'GitHub said: ')+e.message); } await refreshSubs(); };
  document.querySelectorAll('[data-subprev]').forEach(el=>el.onclick=()=>{ const s=SUBS[+el.dataset.subprev]; openSharedLo(s.code); });
  const wantPost=()=>viaHelper()&&OWNER.discord&&LS.get('nw_dpost',true);
  const postAfter=async e=>{ if(!wantPost()) return; try{ toast('Posting to Discord…'); await announceToDiscord(e); toast('Posted “'+e.name+'” to Discord'); }catch(err){ toast('Published, but the Discord post failed: '+err.message); } };
  on('botsetup',async()=>{ const st=document.getElementById('botstat'), bt=document.getElementById('botsetup'); bt.disabled=true; st.textContent='Registering…';
    try{ const d=await ownerApi('botsetup'); st.textContent=`Done: ${d.count} commands registered. They show up in Discord within a minute.`; }catch(e){ st.textContent='Failed: '+e.message; } bt.disabled=false; });
  if(ADMTAB==='bot' && viaHelper() && OWNER.bot && OWNER.bot.token && BOTCH===null && !BOTCHERR) loadBotChannels();
  on('statnow',async()=>{ const st=document.getElementById('statnowst'); st.textContent='checking…'; try{ const d=await ownerApi('statuscheck'); st.textContent=d.skipped?'Save a status channel first':`done, ${d.posted} new update${d.posted===1?'':'s'} posted`; }catch(e){ st.textContent='failed: '+e.message; } });
  if(ADMTAB==='status' && viaHelper() && STAT===null && !STATERR) loadStatus();
  on('statref',loadStatus);
  const sa=document.getElementById('statall'); if(sa) sa.onchange=()=>{ STATALL=sa.checked; LS.set('nw_statall',STATALL); loadStatus(); };
  on('botchre',()=>{ BOTCH=null; BOTCHERR=''; openView('admin',false); });
  on('botchsave',async()=>{ const st=document.getElementById('botchst'); st.textContent='Saving…';
    try{ const d=await ownerApi('setbotconfig',{channel:document.getElementById('botch').value,log:document.getElementById('botlog').value,status:document.getElementById('botstatus').value,statusAll:!!document.getElementById('botstatall').value});
      OWNER.bot.channel=d.channel; OWNER.bot.log=d.log; OWNER.bot.status=d.status; OWNER.bot.statusAll=d.statusAll; OWNER.discord=OWNER.discord||!!d.channel; st.textContent='Saved ✓'; }catch(e){ st.textContent='Failed: '+e.message; } });
  const dp=document.getElementById('dpost'); if(dp) dp.onchange=()=>LS.set('nw_dpost',dp.checked);
  document.querySelectorAll('[data-subpub]').forEach(el=>el.onclick=()=>{ const s=SUBS[+el.dataset.subpub]; const e={name:s.title,by:s.by||s.user,mode:s.mode,code:s.code,did:s.did}; busy(el,async()=>{ await publishToCommunity(e,s.num); await postAfter(e); },'Published “'+s.title+'”'); });
  document.querySelectorAll('[data-dpost]').forEach(el=>el.onclick=async()=>{ const x=communityLos().find(c=>c.code===el.dataset.dpost); if(!x) return; el.disabled=true; el.textContent='Posting…';
    try{ await announceToDiscord(x); toast('Posted “'+x.name+'” to Discord'); el.textContent='Posted ✓'; }catch(err){ toast('Discord post failed: '+err.message); el.disabled=false; el.textContent='📣 Post to Discord'; } });
  document.querySelectorAll('[data-subrej]').forEach(el=>el.onclick=()=>{ if(el.dataset.sure!=='1'){ el.dataset.sure='1'; el.textContent='Click again to reject'; return; } const s=SUBS[+el.dataset.subrej]; busy(el,()=>rejectSubmission(s.num),'Rejected'); });
  document.querySelectorAll('[data-comdel]').forEach(el=>el.onclick=()=>{ if(el.dataset.sure!=='1'){ el.dataset.sure='1'; el.textContent='Click again to remove'; return; } const c=el.dataset.comdel; busy(el,()=>removeFromCommunity(c),'Removed'); });
  document.querySelectorAll('[data-colo2]').forEach(el=>el.onclick=()=>openSharedLo(el.dataset.colo2));
  on('addpub',async()=>{ const m=document.getElementById('addlink').value.match(/#lo=([A-Za-z0-9_-]+)/); if(!m){ toast('That isn\'t a loadout share link'); return; }
    let name=document.getElementById('addname').value.trim(); try{ if(!name) name=(await decodeLo(m[1])).n; }catch(e){}
    let mode=document.getElementById('addmode').value; try{ if(!mode) mode=(await decodeLo(m[1])).m||''; }catch(e){}
    if(!mode){ toast('Pick what it is for (open world, M3, OPR...)'); return; }
    const e={name:name||'Shared loadout',by:document.getElementById('addby').value.trim(),mode,code:m[1]};
    busy(document.getElementById('addpub'),async()=>{ await publishToCommunity(e); await postAfter(e); },'Published'); });
  if(CFG.worker && dUser() && OWNER===null) checkOwner();
  else if((viaHelper()||ghToken()) && SUBS===null) refreshSubs();
}
function myLoMenu(){
  const com=communityLos();
  return `<a class="mi hi" data-view="myloadouts">&#128190; Manage loadouts</a>`+
    (MYLO.length?`<div class="mh">Saved on this device</div>`+MYLO.slice(0,15).map(x=>`<a class="mi" data-lo="${esc(x.id)}">${esc(x.name)}</a>`).join(''):`<div class="mn">Nothing saved yet. Build one in Loadout, then Save.</div>`)+
    (com.length?`<div class="mh">Community</div>`+com.slice(0,15).map((x,i)=>`<a class="mi" data-colo="${i}">${esc(x.name)}${x.mode?` <i class="dimtx">${esc(x.mode)}</i>`:''}</a>`).join(''):'');
}
function viewMyLo(){
  const com=communityLos();
  const card=x=>`<div class="locard"><div><b>${esc(x.name)}</b><div class="dimtx">${x.mode?`<span class="tag">${esc(x.mode)}</span> `:''}${esc(x.g.w1)} + ${esc(x.g.w2)} &middot; saved ${new Date(x.saved).toLocaleDateString()}</div></div>
    <div class="lobtns"><button class="mini go" data-lo="${esc(x.id)}">Load</button><button class="mini" data-loshare="${esc(x.id)}">&#128279; Share link</button><button class="mini" data-losub="${esc(x.id)}">&#127760; Submit to Community</button><button class="mini" data-lodel="${esc(x.id)}">Delete</button></div>
    <input class="lolink" id="ll_${esc(x.id)}" readonly hidden></div>`;
  return `<h1>Your loadouts</h1>
  <p class="lede">Save what's in the loadout builder, come back to it later, or share it.</p>
  <div class="slots lobar"><div class="slot lcard"><div class="sh">Save what's in the builder</div>
    <label class="lof"><span>Name</span><input id="loname2" class="pk loname" placeholder="e.g. OPR point tank" value=""></label>
    <label class="lof"><span>Made for</span>${loTagSelect('lomode2')}</label>
    <div class="lbtns"><button class="mini go" id="losave2">&#128190; Save current loadout</button></div></div></div>
  <div class="tw"><table><thead><tr><th>You want to&hellip;</th><th>Do this</th><th>Who sees it</th></tr></thead><tbody>
    <tr><td>Keep it for yourself</td><td><b>Save</b></td><td>Only you, in this browser</td></tr>
    <tr><td>Send it to a friend</td><td><b>Share link</b>, then paste it to them</td><td>Whoever has the link</td></tr>
    <tr><td>Put it on the site for everyone</td><td><b>Submit to Community</b> ${CFG.worker?'(log in with Discord first)':'(needs a free GitHub account)'}</td><td>Everyone, once the site owner approves it</td></tr>
  </tbody></table></div>
  ${CFG.worker&&!dUser()?`<div class="callout note mini-co"><span class="ci">&#128273;</span><div><p><b>Log in</b> with Discord (top right) to share your builds with everyone in Community loadouts. Saving on this device works without logging in.</p></div></div>`:''}
  <h2>Saved on this device (${MYLO.length})</h2>
  ${MYLO.length?MYLO.map(card).join(''):'<p class="dimtx">Nothing saved yet.</p>'}
  <h2>Community loadouts (${com.length})</h2>
  ${com.length?com.map((x,i)=>`<div class="locard"><div><b>${esc(x.name)}</b><div class="dimtx">${esc(x.by)}${x.mode?' &middot; '+esc(x.mode):''}</div></div><div class="lobtns"><button class="mini go" data-colo="${i}">Open</button></div></div>`).join(''):'<p class="dimtx">None yet.</p>'}
  ${(typeof OWNER!=='undefined'&&OWNER&&OWNER.owner)?`<p class="dimtx tiny" style="margin-top:24px"><a class="wl" data-view="admin">&#128736; Admin &rarr;</a></p>`:''}`;
}
function myLoEvents(){
  const b=document.getElementById('losave2'); if(b) b.onclick=()=>{ if(saveCurrentLoadout(document.getElementById('loname2').value, document.getElementById('lomode2').value)) openView('myloadouts',false); };
  document.querySelectorAll('[data-lodel]').forEach(el=>el.onclick=()=>{ const x=MYLO.find(y=>y.id===el.dataset.lodel); if(!x) return;
    if(el.dataset.sure!=='1'){ el.dataset.sure='1'; el.textContent='Click again to delete'; return; }
    MYLO=MYLO.filter(y=>y.id!==x.id); saveMYLO(); topnav(); openView('myloadouts',false); toast('Deleted “'+x.name+'”'); });
  document.querySelectorAll('[data-losub]').forEach(el=>el.onclick=async()=>{ const x=MYLO.find(y=>y.id===el.dataset.losub); if(!x) return;
    if(!x.mode){ toast('Load it and save it again with "Made for…" picked, so people can find it'); return; }
    if(CFG.worker){ el.disabled=true; await submitViaHelper(x); el.disabled=false; return; }
    window.open(await submitIssueUrl(x),'_blank','noopener'); toast('GitHub opened in a new tab: press "Submit new issue" there'); });
  const lo=document.getElementById('dlogout'); if(lo) lo.onclick=()=>{ LS.del('nw_discord'); location.reload(); };
  const li=document.querySelector('.dlogin a.dbtn'); if(li && !li.id) li.addEventListener('click',()=>LS.set('nw_after_login','myloadouts'));
  document.querySelectorAll('[data-loshare]').forEach(el=>el.onclick=async()=>{ const x=MYLO.find(y=>y.id===el.dataset.loshare); if(!x) return;
    const link=await shareLink(x); const box=document.getElementById('ll_'+x.id); box.hidden=false; box.value=link; box.select();
    toast((await copyText(link))?'Share link copied':'Link shown below: press Ctrl+C to copy'); });
}
document.addEventListener('click',e=>{
  const a=e.target.closest('[data-lo]');
  if(a){ e.preventDefault(); document.querySelectorAll('.drop').forEach(x=>x.classList.remove('open')); const x=MYLO.find(y=>y.id===a.dataset.lo); if(x){ applyLo(x.g,x.name); openView('gear'); } return; }
  const c=e.target.closest('[data-colo]');
  if(c){ e.preventDefault(); document.querySelectorAll('.drop').forEach(x=>x.classList.remove('open')); const x=communityLos()[+c.dataset.colo]; if(x) openSharedLo(x.code); }
});

/* ================= owner content + customise panel ================= */
let CDB=null, CUSER=null, IS_OWNER=false, CMODE='loading';   // 'db' | 'local' | 'loading'
const DEFAULT_SITE={brand:'New World · S10 Nighthaven', accent:'#d9a84e', theme:'dark', font:'m', width:'normal',
  hidden:[], order:[], start:'New World Home', icons:true};
let SITE=Object.assign({}, DEFAULT_SITE, LS.get('nw_site',{}));
let CPAGES={}, CADD={}, COVR={};
/* ---- draft mode: the owner's changes wait in drafts/ (only the owner can read them) until "Publish to live" ---- */
let DRAFT_ON=LS.get('nw_draftmode', true), DRAFTS={}, LIVE={pages:{},overrides:{},addenda:{},site:null};
const dkey=p=>p.replace(/\//g,'__');
let GHMODE=false;   // GitHub Pages: page edits are saved to custom.json in the repo through the Discord helper
const drafting=()=>IS_OWNER && CMODE==='db' && DRAFT_ON && !GHMODE;
async function dbSet(path,data){ if(drafting()) await CDB.doc('drafts/'+dkey(path)).set({path,data,del:false,at:Date.now()}); else await CDB.doc(path).set(data); }
async function dbDel(path){ if(drafting()) await CDB.doc('drafts/'+dkey(path)).set({path,data:null,del:true,at:Date.now()}); else await CDB.doc(path).delete(); }
function overlay(coll){ const o=Object.assign({},LIVE[coll]);
  if(IS_OWNER) Object.values(DRAFTS).forEach(d=>{ if(d.path.startsWith(coll+'/')){ const id=d.path.slice(coll.length+1); if(d.del) delete o[id]; else o[id]=d.data; } });
  return o; }
function recompute(){
  CPAGES=overlay('pages'); COVR=overlay('overrides'); CADD=overlay('addenda');
  let s=LIVE.site; const ds=IS_OWNER&&DRAFTS[dkey('site/settings')]; if(ds) s=ds.del?null:ds.data;
  if(s){ SITE=Object.assign({},DEFAULT_SITE,s); applySite(); }
}
const draftCount=()=>{ const l=Object.values(DRAFTS); const v=l.filter(d=>/^vault(meta)?\//.test(d.path)).length; return (l.length-v)+(v?1:0); };
function renderDraftBar(){
  let b=document.getElementById('draftbar');
  if(GHMODE){ if(!IS_OWNER || (!GHPENDING && !GHJUST)){ if(b) b.remove(); return; }
    if(!b){ b=document.createElement('div'); b.id='draftbar'; document.body.appendChild(b); }
    b.className='has';
    b.innerHTML=GHPENDING?`<span>&#9998; Saving your change&hellip;</span>`:`<span>&#9989; Saved. Everyone sees it after GitHub rebuilds the site (a minute or two).</span>`;
    return; }
  if(!(IS_OWNER&&CMODE==='db')){ if(b) b.remove(); return; }
  if(!b){ b=document.createElement('div'); b.id='draftbar'; document.body.appendChild(b); }
  const n=draftCount();
  b.className=DRAFT_ON?(n?'has':''):'off';
  b.innerHTML=DRAFT_ON
    ? `<span>&#9998; <b>Draft mode</b> &middot; ${n?`${n} unpublished change${n>1?'s':''} &mdash; only you can see ${n>1?'them':'it'}`:'your changes stay hidden until you publish'}</span>
       ${n?`<button class="mini go" id="dpub">Publish to live</button><button class="mini" id="ddis">Discard</button>`:''}
       <button class="mini" id="doff" title="Changes go live straight away">Turn off</button>`
    : `<span>Draft mode is off: your changes go live straight away.</span><button class="mini" id="don">Turn on</button>`;
  const on=(id,f)=>{ const e=document.getElementById(id); if(e) e.onclick=f; };
  on('dpub',publishDrafts); on('ddis',discardDrafts);
  on('doff',()=>{ if(draftCount()){ toast('Publish or discard your drafts first'); return; } DRAFT_ON=false; LS.set('nw_draftmode',false); renderDraftBar(); });
  on('don',()=>{ DRAFT_ON=true; LS.set('nw_draftmode',true); renderDraftBar(); });
}
async function publishDrafts(){
  const l=Object.entries(DRAFTS); if(!l.length) return;
  const rank=p=>/^vaultmeta\//.test(p)?2:/^vault\//.test(p)?0:1;   // vault notes first, the vault's "current" marker last
  l.sort((a,b)=>rank(a[1].path)-rank(b[1].path));
  toast(`Publishing ${draftCount()} change(s)…`);
  try{
    for(const r of [0,1,2]){ const part=l.filter(x=>rank(x[1].path)===r);
      for(let i=0;i<part.length;i+=8) await Promise.all(part.slice(i,i+8).map(([k,d])=>d.del?CDB.doc(d.path).delete():CDB.doc(d.path).set(d.data))); }
    for(let i=0;i<l.length;i+=8) await Promise.all(l.slice(i,i+8).map(([k])=>CDB.doc('drafts/'+k).delete()));
    toast('Published: everyone now sees the new version');
  }catch(e){ toast('Publishing stopped part-way: '+((e&&e.message)||'error')+'. Press Publish again to finish.'); }
}
async function discardDrafts(){
  const l=Object.keys(DRAFTS); if(!l.length) return;
  try{ for(let i=0;i<l.length;i+=8) await Promise.all(l.slice(i,i+8).map(k=>CDB.doc('drafts/'+k).delete())); }catch(e){}
  LS.del('nw_vault'); LS.del('nw_vault_at'); location.reload();
}
let editing=false;
const LOCAL=Object.assign({pages:{},addenda:{},overrides:{}},LS.get('nw_custom',{}));
// Only the signed-in owner can change anything, and only through the page's own storage (db rules: owner writes).
function canWrite(){ return IS_OWNER && CMODE==='db'; }

/* ---- settings ---- */
function hex2rgb(h){ const m=h.replace('#','').match(/.{2}/g)||['d9','a8','4e']; return m.map(x=>parseInt(x,16)); }
function lighten(h,f){ const [r,g,b]=hex2rgb(h); const L=v=>Math.round(v+(255-v)*f); return '#'+[L(r),L(g),L(b)].map(v=>v.toString(16).padStart(2,'0')).join(''); }
function applySite(){
  const R=document.documentElement.style;
  R.setProperty('--gold', SITE.accent); R.setProperty('--gold2', lighten(SITE.accent,.35));
  document.body.classList.remove('light','midnight'); if(SITE.theme!=='dark') document.body.classList.add(SITE.theme);
  document.body.classList.remove('fs-s','fs-l'); if(SITE.font!=='m') document.body.classList.add('fs-'+SITE.font);
  document.body.classList.remove('w-wide','w-full'); if(SITE.width!=='normal') document.body.classList.add('w-'+SITE.width);
  document.body.classList.toggle('noicons', !SITE.icons);
  const b=document.querySelector('.brand'); if(b) b.textContent=SITE.brand||DEFAULT_SITE.brand;
}
async function saveSite(next){
  SITE=Object.assign({}, DEFAULT_SITE, next);
  LS.set('nw_site', SITE); applySite();
  if(CMODE==='db' && IS_OWNER){ try{ await dbSet('site/settings', SITE); return 'saved'; }catch(e){ return 'local'; } }
  return 'local';
}

/* ---- virtual notes for my pages ---- */
function h32(t){ let h=5381; for(let i=0;i<t.length;i++) h=((h<<5)+h+t.charCodeAt(i))|0; return (h>>>0).toString(36); }
function overrideFor(name){ const o=(CMODE==='db'?COVR:LOCAL.overrides)[slug(name)]; return o&&o.body!=null?o:null; }
function injectCustom(){
  Object.keys(META).forEach(p=>{ const m=META[p]; if(m.custom) return; const o=overrideFor(m.name);
    if(o){ m.orig=m.body; m.body=o.body; m.edited=true; m.stale=o.base && o.base!==h32(m.orig); } });
  const pages = CMODE==='db' ? CPAGES : LOCAL.pages;
  Object.entries(pages).forEach(([id,pg])=>{
    if(!pg||!pg.title) return;
    let name=pg.title.trim(); if(NAMES[name] && !(META[NAMES[name]]||{}).custom) name+=' (mine)';
    const sec=(pg.section||'').trim();
    const path='My Pages/'+(sec?sec.replace(/[\/]/g,'-')+'/':'')+name+'.md';
    META[path]={name, folder:path.split('/').slice(0,-1).join('/'), tags:['custom'], source:'', body:'# '+pg.title+'\n\n'+(pg.body||''), path, custom:true, cid:id};
    NAMES[name]=path;
  });
}
function addendumFor(name){ const a=(CMODE==='db'?CADD:LOCAL.addenda)[slug(name)]; return a&&a.body?a:null; }
function addendumHTML(name){
  const a=addendumFor(name);
  const edit=canWrite()?`<button class="mini" data-addedit="${esc(name)}">${a?'&#9998; Edit your notes':'&#65291; Add your own notes to this page'}</button>`:'';
  if(!a) return edit?`<div class="addbar">${edit}</div>`:'';
  return `<section class="mine"><div class="mh2">&#9998; Your notes ${edit}</div>${md(a.body)}</section>`;
}

/* ---- refresh after data changes ---- */
function customChanged(){
  if(editing) return;
  reindex(); topnav();
  if(current?.kind==='note') openNote(NAMES[current.name]?current.name:'New World Home', false);
}

/* ---- editors ---- */
const MDHELP=`<details class="mdhelp"><summary>Formatting help</summary>
<code># Heading</code> &middot; <code>## Section</code> &middot; <code>**bold**</code> &middot; <code>*italic*</code> &middot; <code>- list item</code> &middot;
<code>[[Immovable Juggernaut]]</code> links to any page &middot; <code>&gt; [!tip] text</code> makes a tip box (also note, warning, info) &middot;
tables: <code>| Slot | Item |</code> then <code>|---|---|</code> then rows</details>`;
function openPageEditor(id){
  editing=true; if(current) hist.push(current); current={kind:'edit'};
  const pages = CMODE==='db' ? CPAGES : LOCAL.pages;
  const pg = id ? (pages[id]||{}) : {title:'',section:'',body:''};
  const secs=[...new Set(Object.values(pages).map(p=>p.section).filter(Boolean))];
  document.getElementById('main').innerHTML=`<h1>${id?'Edit page':'New page'}</h1>
   <p class="lede">${CMODE==='db'?'Saved to the page itself &mdash; only you can change it, and it shows on every device.':'Saved in this browser only (the page\'s storage isn\'t available here).'}</p>
   <div class="edgrid">
     <div class="edl">
       <label class="in"><span>Title</span><input id="pgtitle" value="${esc(pg.title||'')}" placeholder="e.g. My Ennead M3 run notes"></label>
       <label class="in"><span>Group it under<i>optional &mdash; becomes a heading in the My Pages menu</i></span>
         <input id="pgsec" list="pgsecs" value="${esc(pg.section||'')}" placeholder="e.g. Raids, Gear plans"><datalist id="pgsecs">${secs.map(s=>`<option value="${esc(s)}">`).join('')}</datalist></label>
       <label class="in"><span>Content</span><textarea id="pgbody" rows="20" placeholder="Write anything. Tables, lists and [[links]] work.">${esc(pg.body||'')}</textarea></label>
       ${MDHELP}
       <div class="saverow"><button class="mini go" id="pgsave">Save</button><button class="mini" id="pgcancel">Cancel</button>
         ${id?`<button class="mini danger" id="pgdel">Delete page</button>`:''}<span id="pgstat" class="dimtx"></span></div>
     </div>
     <div class="edr"><div class="dimtx">Preview</div><article id="pgprev"></article></div>
   </div>`;
  const prev=()=>{ document.getElementById('pgprev').innerHTML=md('# '+(document.getElementById('pgtitle').value||'Untitled')+'\n\n'+document.getElementById('pgbody').value); };
  ['pgtitle','pgbody'].forEach(i=>document.getElementById(i).oninput=prev); prev();
  document.getElementById('pgcancel').onclick=()=>{ editing=false; const p=hist.pop(); p&&p.kind==='note'?openNote(p.name,false):openNote('New World Home',false); };
  document.getElementById('pgsave').onclick=async ()=>{
    const data={title:document.getElementById('pgtitle').value.trim(), section:document.getElementById('pgsec').value.trim(),
                body:document.getElementById('pgbody').value, updated:new Date().toISOString()};
    if(!data.title){ document.getElementById('pgstat').textContent='Give it a title first.'; return; }
    const btn=document.getElementById('pgsave'); btn.disabled=true; document.getElementById('pgstat').textContent='Saving…';
    let nid=id;
    try{
      if(CMODE==='db'){ nid=id||('p'+Date.now()); await dbSet('pages/'+nid, data); CPAGES[nid]=data; }
      else { nid=id||('p'+Date.now()); LOCAL.pages[nid]=data; LS.set('nw_custom',LOCAL); }
    }catch(e){ btn.disabled=false; document.getElementById('pgstat').textContent='Could not save: '+(e.message||e.code||e); return; }
    editing=false; reindex(); topnav();
    const nm=Object.values(META).find(m=>m.custom&&m.cid===nid); toast('Saved “'+data.title+'”');
    openNote(nm?nm.name:'New World Home', false);
  };
  const del=document.getElementById('pgdel');
  if(del) del.onclick=async ()=>{
    if(del.dataset.sure!=='1'){ del.dataset.sure='1'; del.textContent='Click again to delete'; return; }
    try{ if(CMODE==='db'){ await dbDel('pages/'+id); delete CPAGES[id]; } else { delete LOCAL.pages[id]; LS.set('nw_custom',LOCAL); } }catch(e){}
    editing=false; reindex(); topnav(); toast('Page deleted'); openNote('New World Home',false);
  };
}
function openAddendumEditor(name){
  editing=true; if(current) hist.push(current); current={kind:'edit'};
  const a=addendumFor(name)||{body:''};
  document.getElementById('main').innerHTML=`<h1>Your notes on &ldquo;${esc(name)}&rdquo;</h1>
   <p class="lede">These appear at the bottom of the page in a gold box. ${CMODE==='db'?'Only you can change them.':'Saved in this browser only.'}</p>
   <div class="edgrid"><div class="edl">
     <textarea id="adbody" rows="16" placeholder="e.g. Tried this in M3 on Tuesday — swap Upheaval for Shield Bash on the second boss.">${esc(a.body)}</textarea>
     ${MDHELP}
     <div class="saverow"><button class="mini go" id="adsave">Save</button><button class="mini" id="adcancel">Cancel</button>
       ${a.body?`<button class="mini danger" id="addel">Remove my notes</button>`:''}<span id="adstat" class="dimtx"></span></div>
   </div><div class="edr"><div class="dimtx">Preview</div><article id="adprev"></article></div></div>`;
  const prev=()=>document.getElementById('adprev').innerHTML=md(document.getElementById('adbody').value||'*Nothing yet*');
  document.getElementById('adbody').oninput=prev; prev();
  const back=()=>{ editing=false; hist.pop(); openNote(name,false); };
  document.getElementById('adcancel').onclick=back;
  const write=async(body)=>{
    const k=slug(name);
    if(CMODE==='db'){ if(body) { await dbSet('addenda/'+k,{note:name,body,updated:new Date().toISOString()}); CADD[k]={note:name,body}; }
                      else { await dbDel('addenda/'+k); delete CADD[k]; } }
    else { if(body) LOCAL.addenda[k]={note:name,body}; else delete LOCAL.addenda[k]; LS.set('nw_custom',LOCAL); }
  };
  document.getElementById('adsave').onclick=async ()=>{
    const b=document.getElementById('adsave'); b.disabled=true;
    try{ await write(document.getElementById('adbody').value.trim()); toast('Notes saved'); back(); }
    catch(e){ b.disabled=false; document.getElementById('adstat').textContent='Could not save: '+(e.message||e.code||e); }
  };
  const d=document.getElementById('addel'); if(d) d.onclick=async()=>{ try{ await write(''); }catch(e){} toast('Notes removed'); back(); };
}

function openNoteEditor(name){
  const p=NAMES[name]; if(!p) return; const m=META[p];
  editing=true; if(current) hist.push(current); current={kind:'edit'};
  const orig=m.orig!=null?m.orig:m.body;
  document.getElementById('main').innerHTML=`<h1>Edit &ldquo;${esc(name)}&rdquo;</h1>
   <p class="lede">Change anything on this page &mdash; numbers, tables, the Best in slot list. ${CMODE==='db'?'Only you can do this, and it shows on every device.':'Saved in this browser only.'} Your Obsidian note isn't touched: use <b>Copy</b> to paste the new version into it.</p>
   <div class="edgrid"><div class="edl">
     <textarea id="nebody" rows="26">${esc(m.body)}</textarea>
     ${MDHELP}
     <div class="saverow"><button class="mini go" id="nesave">Save</button><button class="mini" id="necancel">Cancel</button>
       <button class="mini" id="necopy">Copy</button>
       ${m.edited?`<button class="mini danger" id="nerevert">Revert to the original</button>`:''}<span id="nestat" class="dimtx"></span></div>
   </div><div class="edr"><div class="dimtx">Preview</div><article id="neprev"></article></div></div>`;
  const prev=()=>document.getElementById('neprev').innerHTML=md(document.getElementById('nebody').value);
  document.getElementById('nebody').oninput=prev; prev();
  const back=()=>{ editing=false; hist.pop(); reindex(); topnav(); openNote(name,false); };
  document.getElementById('necancel').onclick=()=>{ editing=false; hist.pop(); openNote(name,false); };
  document.getElementById('necopy').onclick=async()=>{ try{ await navigator.clipboard.writeText(document.getElementById('nebody').value); toast('Copied — paste it into the Obsidian note'); }catch(e){ document.getElementById('nebody').select(); toast('Select-all done: press Ctrl+C to copy'); } };
  const write=async(body)=>{ const k=slug(name);
    if(CMODE==='db'){ if(body!=null){ const d={note:name,body,base:h32(orig),updated:new Date().toISOString()}; await dbSet('overrides/'+k,d); COVR[k]=d; }
                      else { await dbDel('overrides/'+k); delete COVR[k]; } }
    else { if(body!=null) LOCAL.overrides[k]={note:name,body,base:h32(orig)}; else delete LOCAL.overrides[k]; LS.set('nw_custom',LOCAL); }
    m.body=orig; delete m.orig; m.edited=false;
  };
  document.getElementById('nesave').onclick=async()=>{ const b=document.getElementById('nesave'); b.disabled=true;
    const body=document.getElementById('nebody').value;
    try{ if(body===orig) await write(null); else await write(body); toast('Page saved'); back(); }
    catch(e){ b.disabled=false; document.getElementById('nestat').textContent='Could not save: '+(e.message||e.code||e); } };
  const rv=document.getElementById('nerevert'); if(rv) rv.onclick=async()=>{ try{ await write(null); }catch(e){} toast('Back to the original'); back(); };
}
function editedBanner(name){
  const m=META[NAMES[name]]; if(!m||!m.edited) return '';
  return `<div class="edbanner">&#9998; You've edited this page.${m.stale?' <b>The original has been updated since</b> &mdash; check whether you still want your version.':''}
    <button class="mini" data-showorig="${esc(name)}">Show the original</button></div>`;
}

/* ---- customise panel ---- */
function openPanel(){
  const s=Object.assign({},SITE); s.hidden=[...(SITE.hidden||[])];
  let order=navTabs().map(t=>t.k);
  const sw=['#d9a84e','#6fa8dc','#7fbf7f','#d9705e','#b48ce0','#e08cc0','#5ec4b6','#c9c9c9'];
  const el=document.createElement('div'); el.id='panel';
  el.innerHTML=`<div class="pbox"><div class="ph"><b>&#9881; Customise</b><button class="mini" id="pclose">&times;</button></div>
   <p class="dimtx">${CMODE==='db'?'Changes are saved to the page, so they follow you to every device.':'Saved in this browser only.'}</p>
   <label class="in"><span>Title in the top bar</span><input id="pbrand" value="${esc(s.brand)}"></label>
   <div class="in"><span>Accent colour</span><div class="sw">${sw.map(c=>`<button class="swb ${s.accent===c?'on':''}" data-sw="${c}" style="background:${c}"></button>`).join('')}
     <input type="color" id="pacc" value="${esc(/^#[0-9a-f]{6}$/i.test(s.accent||'')?s.accent:DEFAULT_SITE.accent)}"></div></div>
   <div class="in"><span>Theme</span><div class="seg">${[['dark','Dark'],['midnight','Midnight'],['light','Light']].map(([v,l])=>`<button class="${s.theme===v?'on':''}" data-th="${v}">${l}</button>`).join('')}</div></div>
   <div class="in"><span>Text size</span><div class="seg">${[['s','Small'],['m','Normal'],['l','Large']].map(([v,l])=>`<button class="${s.font===v?'on':''}" data-fs="${v}">${l}</button>`).join('')}</div></div>
   <div class="in"><span>Page width</span><div class="seg">${[['normal','Normal'],['wide','Wide'],['full','Full']].map(([v,l])=>`<button class="${s.width===v?'on':''}" data-wd="${v}">${l}</button>`).join('')}</div></div>
   <label class="chkl"><input type="checkbox" id="picons" ${s.icons?'checked':''}> Show game icons</label>
   <div class="in"><span>Start page</span><select id="pstart">${Object.keys(NAMES).sort().map(n=>`<option ${n===s.start?'selected':''}>${esc(n)}</option>`).join('')}</select></div>
   <div class="in"><span>Top bar tabs<i>tick to show &middot; arrows or drag to reorder</i></span><div id="taborder"></div></div>
   <div class="saverow"><button class="mini go" id="psave">Save</button><button class="mini" id="preset">Reset to defaults</button><span id="pstat" class="dimtx"></span></div></div>`;
  document.body.appendChild(el);
  const live=()=>{ SITE=Object.assign({},DEFAULT_SITE,s); applySite(); };
  el.querySelector('#pbrand').oninput=e=>{ s.brand=e.target.value; live(); };
  el.querySelectorAll('[data-sw]').forEach(b=>b.onclick=()=>{ s.accent=b.dataset.sw; el.querySelector('#pacc').value=s.accent; el.querySelectorAll('.swb').forEach(x=>x.classList.toggle('on',x===b)); live(); });
  el.querySelector('#pacc').oninput=e=>{ s.accent=e.target.value; live(); };
  const seg=(attr,key)=>el.querySelectorAll(`[data-${attr}]`).forEach(b=>b.onclick=()=>{ s[key]=b.dataset[attr]; el.querySelectorAll(`[data-${attr}]`).forEach(x=>x.classList.toggle('on',x===b)); live(); });
  seg('th','theme'); seg('fs','font'); seg('wd','width');
  el.querySelector('#picons').onchange=e=>{ s.icons=e.target.checked; live(); };
  el.querySelector('#pstart').onchange=e=>{ s.start=e.target.value; };
  const drawOrder=()=>{
    const box=el.querySelector('#taborder');
    box.innerHTML=order.map((k,i)=>`<div class="tord" draggable="true" data-ok="${esc(k)}"><span class="grip">&#8942;&#8942;</span>
      <label class="chkl"><input type="checkbox" data-tab="${esc(k)}" ${s.hidden.includes(k)?'':'checked'}> ${esc(k)}</label>
      <button class="mini" data-up="${i}" ${i===0?'disabled':''}>&uarr;</button><button class="mini" data-dn="${i}" ${i===order.length-1?'disabled':''}>&darr;</button></div>`).join('');
    const sync=()=>{ s.order=[...order]; live(); topnav(); };
    box.querySelectorAll('[data-tab]').forEach(c=>c.onchange=()=>{ const t=c.dataset.tab; s.hidden=s.hidden.filter(x=>x!==t); if(!c.checked) s.hidden.push(t); sync(); });
    box.querySelectorAll('[data-up]').forEach(b=>b.onclick=()=>{ const i=+b.dataset.up; [order[i-1],order[i]]=[order[i],order[i-1]]; drawOrder(); sync(); });
    box.querySelectorAll('[data-dn]').forEach(b=>b.onclick=()=>{ const i=+b.dataset.dn; [order[i+1],order[i]]=[order[i],order[i+1]]; drawOrder(); sync(); });
    let dk=null;
    box.querySelectorAll('.tord').forEach(r=>{
      r.ondragstart=()=>{ dk=r.dataset.ok; r.classList.add('dragging'); };
      r.ondragend=()=>{ r.classList.remove('dragging'); dk=null; };
      r.ondragover=e=>{ e.preventDefault(); };
      r.ondrop=e=>{ e.preventDefault(); if(!dk||dk===r.dataset.ok) return; order=order.filter(x=>x!==dk); order.splice(order.indexOf(r.dataset.ok),0,dk); drawOrder(); sync(); };
    });
  };
  drawOrder();
  const close=()=>{ el.remove(); };
  el.querySelector('#pclose').onclick=()=>{ SITE=Object.assign({},DEFAULT_SITE,LS.get('nw_site',{})); applySite(); topnav(); close(); };
  el.onclick=e=>{ if(e.target===el) el.querySelector('#pclose').click(); };
  el.querySelector('#preset').onclick=async()=>{ await saveSite(DEFAULT_SITE); topnav(); close(); toast('Back to the defaults'); };
  el.querySelector('#psave').onclick=async()=>{
    const r=await saveSite(s); topnav(); close();
    toast(r==='saved'?'Saved — it\'ll look like this on every device':'Saved in this browser');
  };
}

/* ---- GitHub Pages store: same shape as the claude.ai db, kept in custom.json ---- */
let GHPENDING=0, GHJUST=null;
function ghStore(docs, writable){
  const subs=[];
  const snapDoc=p=>({exists:docs[p]!=null, id:p.split('/').pop(), data:()=>docs[p]});
  const snapCol=c=>({docs:Object.keys(docs).filter(k=>k.startsWith(c+'/')&&!k.slice(c.length+1).includes('/')).map(k=>({id:k.slice(c.length+1), data:()=>docs[k]}))});
  const fire=()=>subs.forEach(s=>{ try{ s.cb(s.doc?snapDoc(s.key):snapCol(s.key)); }catch(e){} });
  let queue=[], waiters=[], timer=null;
  const flush=async()=>{ timer=null; const ops=queue, w=waiters; queue=[]; waiters=[];
    try{ await ownerApi('setdocs',{ops}); w.forEach(x=>x.res()); }
    catch(e){ w.forEach(x=>x.rej(e)); toast('Not saved: '+e.message); }
    GHPENDING=Math.max(0,GHPENDING-1); clearTimeout(GHJUST); GHJUST=setTimeout(()=>{ GHJUST=null; renderDraftBar(); },6000); renderDraftBar(); };
  const write=(path,data)=>{
    if(!writable) return Promise.reject(new Error('Only the site owner can save changes'));
    if(!/^(site|pages|overrides|addenda)\//.test(path)) return Promise.reject(new Error('That can\'t be saved on this site'));
    data=data==null?null:JSON.parse(JSON.stringify(data));
    if(data==null) delete docs[path]; else docs[path]=data;
    queue=queue.filter(o=>o.path!==path); queue.push({path,data}); fire();
    if(!timer){ GHPENDING++; renderDraftBar(); }
    return new Promise((res,rej)=>{ waiters.push({res,rej}); clearTimeout(timer); timer=setTimeout(flush,400); });
  };
  return {
    doc:p=>({ set:d=>write(p,d), delete:()=>write(p,null), get:async()=>snapDoc(p),
              onSnapshot:cb=>{ subs.push({doc:true,key:p,cb}); cb(snapDoc(p)); return ()=>{}; } }),
    collection:c=>({ get:async()=>snapCol(c), onSnapshot:cb=>{ subs.push({doc:false,key:c,cb}); cb(snapCol(c)); return ()=>{}; } })
  };
}
async function initGitHubStore(){
  GHMODE=true; DRAFT_ON=false;
  let docs=null, own=false;
  if(dUser()){
    await checkOwner();
    if(OWNER&&OWNER.owner){ try{ docs=(await ownerApi('getcustom')).docs||{}; own=true; }catch(e){ toast('Couldn\'t load your saved edits: '+e.message); } }
  }
  if(!docs){ try{ const r=await fetch('custom.json',{cache:'no-cache'}); docs=r.ok?((await r.json()).docs||{}):{}; }catch(e){ docs={}; } }
  CDB=ghStore(docs, own); IS_OWNER=own;
  renderAcct();
}

/* ---- start-up ---- */
/* ---------- vault kept in the page's own storage ---------- */
async function saveVaultToDb(obj, at){
  try{
    const old=await CDB.collection('vault').get();
    const keep=new Set(), jobs=[];
    const liveBody={}; old.docs.forEach(d=>{ const v=d.data(); liveBody[d.id]=v&&v.body; });
    for(const [path,body] of Object.entries(obj)){ const id=h32(path)+'_'+path.length; keep.add(id);
      if(drafting() && liveBody[id]===body && !DRAFTS[dkey('vault/'+id)]) continue;   // unchanged note: no draft needed
      jobs.push(()=>dbSet('vault/'+id,{path,body})); }
    old.docs.forEach(d=>{ if(!keep.has(d.id)) jobs.push(()=>dbDel('vault/'+d.id)); });
    for(let i=0;i<jobs.length;i+=8) await Promise.all(jobs.slice(i,i+8).map(f=>f()));
    if(jobs.length||!drafting()) await dbSet('vaultmeta/current',{at:String(at), count:keep.size, saved:new Date().toISOString()});
    LS.set('nw_vault_at',String(at));
    return true;
  }catch(e){ return (e&&e.message)||'error'; }
}
async function clearVaultDb(){
  if(!(CMODE==='db'&&IS_OWNER)) return;
  try{ await dbDel('vaultmeta/current');
       const q=await CDB.collection('vault').get(); for(const d of q.docs) await dbDel('vault/'+d.id); }catch(e){}
}
async function loadVaultFromDb(){
  try{
    const m=await CDB.doc('vaultmeta/current').get();
    let meta=m.exists?m.data():null;
    const dm=IS_OWNER&&DRAFTS[dkey('vaultmeta/current')]; if(dm) meta=dm.del?null:dm.data;   // the owner sees their draft vault
    if(!meta) return;
    const q=await CDB.collection('vault').get();
    const docs={}; q.docs.forEach(d=>{ docs[d.id]=d.data(); });
    if(IS_OWNER) Object.values(DRAFTS).forEach(d=>{ if(d.path.startsWith('vault/')){ const id=d.path.slice(6); if(d.del) delete docs[id]; else docs[id]=d.data; } });
    const obj={}; Object.values(docs).forEach(v=>{ if(v&&v.path) obj[v.path]=v.body||''; });
    if(!Object.keys(obj).length) return;
    if(IS_OWNER){ LS.set('nw_vault',obj); LS.set('nw_vault_at',meta.at); }
    if(SRC==='saved' && SRC_AT===meta.at) return;
    applyData(obj,'saved',meta.at,true); renderDataMenu();
  }catch(e){}
}

async function initCustom(){
  applySite();
  try { CUSER=await claude.use('user'); } catch(e){ CUSER=null; }
  try { CDB=await claude.use('db'); } catch(e){ CDB=null; }
  IS_OWNER = CUSER ? ((await CUSER.isOwner()) ?? false) : false;
  if(!CDB && typeof CFG!=='undefined' && CFG.worker) await initGitHubStore();
  // A visitor never keeps a private copy of the vault: everyone sees the owner's version.
  if(!IS_OWNER){ LS.del('nw_vault'); LS.del('nw_vault_at'); LS.del('nw_custom'); LS.del('nw_site');
    if(SRC!=='snapshot'){ try{ const snap=await (await fetch('vault.json')).json(); applyData(snap,'snapshot',BUILD_AT,true); }catch(e){} } }
  if(!CDB){ CMODE='local'; customChanged(); return; }   // no storage here: read-only for everyone
  CMODE='db';
  let first=true;
  const t=setTimeout(()=>{ toast('Your saved pages and settings can\'t be reached yet'); },10000);
  if(IS_OWNER){ let tm=null, firstD=true;
    await new Promise(res=>{ CDB.collection('drafts').onSnapshot(q=>{ DRAFTS={}; q.docs.forEach(d=>DRAFTS[d.id]=d.data());
      recompute(); renderDraftBar(); clearTimeout(tm); tm=setTimeout(()=>customChanged(),300); if(firstD){ firstD=false; res(); } }, ()=>{ firstD=false; res(); }); setTimeout(res,4000); }); }
  CDB.doc('site/settings').onSnapshot(s=>{ clearTimeout(t);
    LIVE.site=s.exists?s.data():null; recompute();
    if(s.exists||(IS_OWNER&&DRAFTS[dkey('site/settings')])){ LS.set('nw_site',SITE); if(!editing) topnav();
      if(first && current?.kind==='note' && current.name==='New World Home' && !location.hash.replace('#','') && SITE.start && NAMES[SITE.start] && SITE.start!=='New World Home') openNote(SITE.start,false); }
    first=false; }, ()=>{});
  loadVaultFromDb();
  CDB.collection('pages').onSnapshot(q=>{ LIVE.pages={}; q.docs.forEach(d=>LIVE.pages[d.id]=d.data()); recompute(); customChanged(); }, ()=>{ toast('Saved pages could not be loaded'); });
  CDB.collection('overrides').onSnapshot(q=>{ LIVE.overrides={}; q.docs.forEach(d=>LIVE.overrides[d.id]=d.data()); recompute(); customChanged(); }, ()=>{});
  CDB.collection('addenda').onSnapshot(q=>{ LIVE.addenda={}; q.docs.forEach(d=>LIVE.addenda[d.id]=d.data()); recompute(); if(current?.kind==='note'&&!editing) openNote(current.name,false); }, ()=>{});
  customChanged(); renderDraftBar();
}

/* ---------- boot ---------- */
(async function(){
  const saved=LS.get('nw_vault',null), savedAt=LS.get('nw_vault_at','');
  if(saved && Object.keys(saved).length){ DATA=saved; SRC='folder'; SRC_AT=savedAt||'earlier'; }
  else {
    try { DATA=await (await fetch('vault.json',{cache:'no-cache'})).json(); SRC='snapshot'; SRC_AT=BUILD_AT; }
    catch(err){ document.getElementById('main').innerHTML='<h1>Could not load the data</h1><p class="lede">'+err+'</p>'; return; }
  }
  try { CALC = await (await fetch('calc.json')).json(); } catch(e){ CALC = null; }
  try { PERKS = await (await fetch('gear_perks.json')).json(); } catch(e){ PERKS = null; }
  try { ICO = await (await fetch('icons.json')).json(); ICO.img = await sliceSprite('icons_0.webp', ICO); } catch(e){ ICO = null; }
  try { ITEMDB = await (await fetch('items.json')).json();
        for(let k=0;k<ITEMDB.sheets;k++){ const b=await (await fetch('items_'+k+'.webp')).blob(); SPRITES.push(URL.createObjectURL(b)); } } catch(e){ ITEMDB = null; }
  try { PRESETS = await (await fetch('gear_presets.json')).json(); } catch(e){ PRESETS = null; }
  if(typeof loadCommunity==='function') await loadCommunity();
  try { TREES = await (await fetch('trees.json')).json(); } catch(e){ TREES = null; }
  reindex(); topnav(); if(typeof renderAcct==='function') renderAcct();
  const h=(location.hash||'').replace('#','');
  if(typeof handleAuthHash==='function' && handleAuthHash(h)){}
  else if(h.startsWith('lo=') && typeof openSharedLo==='function'){ openView('gear',false); openSharedLo(h.slice(3)); }
  else if(h.startsWith('c=') && typeof openSharedLo==='function'){ const x=(typeof COMMUNITY!=='undefined'?COMMUNITY:[]).find(c=>h32(c.code)===h.slice(2)); openView('gear',false);
    if(x) openSharedLo(x.code); else toast('That loadout was only just published. Give it a minute and reload.'); }
  else if(['builds','bosses','calc','gear','items','myloadouts','review','admin'].includes(h)) openView(h,false);
  else {
    const hit=Object.keys(NAMES).find(n=>slug(n)===h);
    openNote(hit||((typeof SITE!=='undefined'&&NAMES[SITE.start])?SITE.start:'New World Home'),false);
  }
  initCustom();
  // a copy with env.json {"env":"staging"} is the test copy: say so loudly
  try{ const env=await (await fetch('env.json',{cache:'no-store'})).json();
    if(env&&env.env==='staging'){ document.body.classList.add('staging'); const s=document.createElement('div'); s.id='stagebar'; s.textContent='STAGING COPY: for testing new features. Nothing here is live.'; document.body.prepend(s); } }catch(e){}
})();
