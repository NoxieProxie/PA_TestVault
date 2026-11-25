/* ============ New World vault browser v2 ============ */
const BUILD_AT = 'snapshot taken 25 Nov 2026, 16:07';
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
function walias(t){ t=(t||'').replace(/<[^>]+>/g,'').replace(/\*/g,'').trim(); for(const [re,w] of WALIAS) if(re.test(t)) return w; return ''; }
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
  n=String(n).replace(/<[^>]+>/g,'').replace(/&amp;/g,'&').trim().replace(/\s+II$/,'');
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
const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
function inline(s){
  s = esc(s);
  s = s.replace(/`([^`]+)`/g, (m,a)=>`<code>${a}</code>`);
  s = s.replace(/\[\[([^\]]+?)\]\]/g, (m, inner)=>{
    let [tgt, alias] = inner.split(/\\?\|/);
    tgt = (tgt||'').trim(); alias = (alias||tgt).trim();
    if (tgt.startsWith('#')) return `<a class="wl" href="#" data-anchor="${esc(tgt.slice(1))}">${alias}</a>`;
    const base = tgt.split('#')[0].trim();
    if (NAMES[base]) return `<a class="wl" href="#" data-note="${esc(base)}">${alias}</a>`;
    return `<span class="wl dead" title="no page called ${esc(base)}">${alias}</span>`;
  });
  s = s.replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, (m,a,b)=>`<a href="${b}" target="_blank" rel="noopener">${a} &#8599;</a>`);
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
    const raw=DATA[p]; let body=raw, tags=[], source='';
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
     ${(typeof canWrite==='function'&&canWrite())?`<a class="mi hi" id="pickfolder">&#128193; Load my vault folder&hellip;</a>`:`<div class="mn tiny">&#128274; Read-only. Only the page's owner can change what's shown here.</div>`}
     ${(typeof canWrite==='function'&&canWrite())?`<div class="mn tiny">Pick the <b>New World</b> folder in your vault. ${(typeof CMODE!=='undefined'&&CMODE==='db'&&IS_OWNER)?'The pages are saved into this page\'s own storage, so they stay put between sessions and show on every device. Only you can change them.':'The page reads the .md files in your browser and remembers them in this browser.'}</div>`:''}
     ${SRC!=='snapshot'&&typeof canWrite==='function'&&canWrite()?`<a class="mi" id="resetdata">&#8634; Back to the built-in snapshot</a>`:''}
     ${(typeof canWrite==='function'&&canWrite())?`<div class="mh">Adding or changing things</div>
     <div class="mn tiny"><b>&#9998; Edit</b> (top right of any page) changes that page. <b>Add your own notes</b> sits at the bottom of every page. <b>My Pages &rarr; New page</b> makes a page of your own. <b>&#9881;</b> changes the look.</div>`:''}`;
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
const MODES=['Expeditions & raids','3v3 Arenas','Outpost Rush','Capture the Flag','Wars','Open-world PvP','Open-world PvE'].map(m=>[m,m]);
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
   <div class="filters"><div class="frow"><span class="fl">Role</span>${chips('role',ROLES)}</div>
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
  <div class="filters"><div class="frow"><span class="fl">Expedition</span>${['',...exps].map(e=>`<button class="chip ${bfilt.exp===e?'on':''}" data-bf="exp" data-v="${esc(e)}">${esc(label(e))||'All'}</button>`).join('')}</div>
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
  const same = current && current.kind==='view' && current.v===v;   // a re-render of the page you're on keeps your scroll position
  if(push && current) hist.push(current);
  current={kind:'view',v};
  document.getElementById('main').innerHTML = v==='builds'?viewBuilds():v==='calc'?viewCalc():v==='gear'?viewGear():v==='items'?viewItems():viewBosses();
  if(v==='items') itemsEvents();
  if(v==='calc') calcEvents();
  if(v==='gear') gearEvents();
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
  if(!(typeof canWrite==='function'&&canWrite())) return;
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
  <div class="filters">
    <input id="iq" class="isearch" placeholder="Search items or perks, e.g. gorgon" value="${esc(IQ.q)}" autocomplete="off">
    <div class="frow"><span class="fl">Slot</span>${['',...slots].map(s=>`<button class="chip ${IQ.slot===s?'on':''}" data-is="${s}">${s||'All'}</button>`).join('')}</div>
    <div class="frow"><span class="fl">Type</span>${['',...rars].map(s=>`<button class="chip ${IQ.rar===s?'on':''}" data-ir="${s}">${s||'All'}</button>`).join('')}</div>
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
function allChosen(){
  const out=[];
  const add=(name, where)=>{ if(!name) return; const p=perkByName(name); out.push({name, where, p}); };
  add(G.w1gem,'Weapon 1 gem'); add(G.w2gem,'Weapon 2 gem');
  add(G.w1perk,'Weapon 1 charm'); add(G.w2perk,'Weapon 2 charm');
  add(G.w1off,'Weapon 1 charm 2'); add(G.w2off,'Weapon 2 charm 2');
  ['w1p1','w1p2','w1p3'].forEach(k=>add(G[k],'Weapon 1')); ['w2p1','w2p2','w2p3'].forEach(k=>add(G[k],'Weapon 2'));
  ARMOR_SLOTS.forEach(s=>{ const a=G.armor[s]; add(a.gem,s+' gem'); add(a.p1,s); add(a.p2,s); add(a.p3,s); add(a.ch,s+' charm'); });
  JEW_SLOTS.forEach(s=>{ const j=G.jew[s]; add(j.gem,s+' gem'); add(j.p1,s); add(j.p2,s); add(j.ch,s+' charm'); });
  return out;
}
function totals(){
  const t={fort:0,emp:0,rend:0,dmg:0,crit:0,critd:0,ls:0,abs:0,wkn:0}, contrib=[];
  allChosen().forEach(c=>{
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
  const byGroup={}; const allP=notePresets();
  const modeList=MODES.map(x=>x[0]).filter(m=>allP.some(p=>(p.modes||[]).includes(m)));
  if(G.mode&&!modeList.includes(G.mode)) G.mode='';
  allP.filter(p=>!G.mode||(p.modes||[]).includes(G.mode)).forEach(p=>{ const k=G.mode||p.folder; (byGroup[k]=byGroup[k]||[]).push(p); });
  return gemW+gemA+gemJ+charm1+charm2+offd+armd+jewd+chA+itDL+`<h1>Loadout builder</h1>
  <p class="lede">Equip the slots, or load one of your own builds and tweak it. Perk, gem and charm lists are the real Season 10 ones from your game-data export &mdash; start typing in any field to filter.</p>
  <div class="presetbar">
    <span class="fl">Mode</span>
    <select id="modesel"><option value="">All builds</option>${modeList.map(m=>`<option ${G.mode===m?'selected':''}>${esc(m)}</option>`).join('')}</select>
    <span class="fl">Load a build</span>
    <select id="presetsel"><option value="">&mdash; pick one &mdash;</option>
      ${Object.keys(byGroup).sort().map(g=>`<optgroup label="${esc(g)}">`+byGroup[g].map(p=>`<option value="${esc(p.name)}">${esc(p.name)}${p.fromNote?'':' (no loadout table)'}</option>`).join('')+`</optgroup>`).join('')}
    </select>
    <button class="mini go" id="loadpreset">Load</button>
    <button class="mini" id="clearload">Empty everything</button>
    ${G.note?`<span class="loadnote">${esc(G.note)}</span>`:''}
  </div>
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
  const ms=document.getElementById('modesel'); if(ms) ms.onchange=()=>{ G.mode=ms.value; saveG(); openView('gear',false); };
  const lp=document.getElementById('loadpreset');
  if(lp) lp.onclick=()=>{
    const n=document.getElementById('presetsel').value;
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

/* ================= owner content + customise panel ================= */
let CDB=null, CUSER=null, IS_OWNER=false, CMODE='loading';   // 'db' | 'local' | 'loading'
const DEFAULT_SITE={brand:'New World · S10 Nighthaven', accent:'#d9a84e', theme:'dark', font:'m', width:'normal',
  hidden:[], order:[], start:'New World Home', icons:true};
let SITE=Object.assign({}, DEFAULT_SITE, LS.get('nw_site',{}));
let CPAGES={}, CADD={}, COVR={};
/* ---- draft mode: the owner's changes wait in drafts/ (only the owner can read them) until "Publish to live" ---- */
let DRAFT_ON=LS.get('nw_draftmode', true), DRAFTS={}, LIVE={pages:{},overrides:{},addenda:{},site:null};
const dkey=p=>p.replace(/\//g,'__');
const drafting=()=>IS_OWNER && CMODE==='db' && DRAFT_ON;
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
     <input type="color" id="pacc" value="${s.accent}"></div></div>
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
    try { DATA=await (await fetch('vault.json')).json(); SRC='snapshot'; SRC_AT=BUILD_AT; }
    catch(err){ document.getElementById('main').innerHTML='<h1>Could not load the data</h1><p class="lede">'+err+'</p>'; return; }
  }
  try { CALC = await (await fetch('calc.json')).json(); } catch(e){ CALC = null; }
  try { PERKS = await (await fetch('gear_perks.json')).json(); } catch(e){ PERKS = null; }
  try { ICO = await (await fetch('icons.json')).json(); ICO.img = await sliceSprite('icons_0.webp', ICO); } catch(e){ ICO = null; }
  try { ITEMDB = await (await fetch('items.json')).json();
        for(let k=0;k<ITEMDB.sheets;k++){ const b=await (await fetch('items_'+k+'.webp')).blob(); SPRITES.push(URL.createObjectURL(b)); } } catch(e){ ITEMDB = null; }
  try { PRESETS = await (await fetch('gear_presets.json')).json(); } catch(e){ PRESETS = null; }
  try { TREES = await (await fetch('trees.json')).json(); } catch(e){ TREES = null; }
  reindex(); topnav();
  const h=(location.hash||'').replace('#','');
  if(['builds','bosses','calc','gear','items'].includes(h)) openView(h,false);
  else {
    const hit=Object.keys(NAMES).find(n=>slug(n)===h);
    openNote(hit||((typeof SITE!=='undefined'&&NAMES[SITE.start])?SITE.start:'New World Home'),false);
  }
  initCustom();
  // a copy with env.json {"env":"staging"} is the test copy: say so loudly
  try{ const env=await (await fetch('env.json',{cache:'no-store'})).json();
    if(env&&env.env==='staging'){ document.body.classList.add('staging'); const s=document.createElement('div'); s.id='stagebar'; s.textContent='STAGING COPY: for testing new features. Nothing here is live.'; document.body.prepend(s); } }catch(e){}
})();
