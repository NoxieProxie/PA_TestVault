/* ============ Azoth Vault browser v2 ============ */
const BUILD_AT = '2026-11-28 14:35';
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
/* item pictures for names in notes: gear from the item list, everything else (potions, food, coatings...) from the recipe data */
let NOTEICO=null;
function noteIcon(n,size=22){
  if(!NOTEICO) return ''; const x=NOTEICO.map[n.toLowerCase()]; if(x==null) return '';
  const T=NOTEICO.tile,C=NOTEICO.cols,sheet=Math.floor(x/NOTEICO.per),j=x%NOTEICO.per,sc=size/T;
  return `<span class="iic" style="width:${size}px;height:${size}px;background-image:url(${NOTEICO.urls[sheet]});background-size:${C*T*sc}px auto;background-position:-${(j%C)*T*sc}px -${Math.floor(j/C)*T*sc}px" title="${esc(n)}"></span>`;
}
function itemIco(n){
  n=stripTags(n).replace(/&amp;/g,'&').replace(/&#39;/g,"'").trim(); if(n.length<3||n.length>60) return '';
  const ni=noteIcon(n); if(ni) return ni;
  if(typeof ITEMDB!=='undefined'&&ITEMDB){ if(!ITEMDB.byLc){ ITEMDB.byLc={}; ITEMDB.items.forEach(i=>{ const k=i.n.toLowerCase(); if(!ITEMDB.byLc[k]) ITEMDB.byLc[k]=i; }); }
    const it=ITEMDB.byLc[n.toLowerCase()]; if(it&&it.x>=0) return itemIcon(it,22); }
  if(typeof CR!=='undefined'&&CR&&CRSHEETS.length){
    if(!CR.byName){ CR.byName={}; for(const [id,v] of Object.entries(CR.items)) if(v[2]>=0){ const k=v[0].toLowerCase(); if(!CR.byName[k]) CR.byName[k]=id; } }
    const id=CR.byName[n.toLowerCase()]; if(id) return crIcon(id,22);
  }
  return '';
}
/* gem perks ("Cruel IV") and charms ("Gravity Well" skill charm, "Slash Harnessing") get their gem/charm picture, with hover text saying which gem or charm it is */
let GCRX=null;
function gcIcon(k){ const g=NOTEICO.gc[k]; if(!g) return '';
  const T=NOTEICO.tile,C=NOTEICO.cols,sheet=Math.floor(g[0]/NOTEICO.per),j=g[0]%NOTEICO.per,size=22,sc=size/T;
  return `<span class="iic gci" style="width:${size}px;height:${size}px;background-image:url(${NOTEICO.urls[sheet]});background-size:${C*T*sc}px auto;background-position:-${(j%C)*T*sc}px -${Math.floor(j/C)*T*sc}px" title="${esc(g[1])}" aria-label="${esc(g[1].split('\n')[0])}"></span>`; }
function tsNameIcon(k){ const g=TSD.names[k]; if(!g) return '';
  const T=TSD.tile,C=TSD.cols,size=22,sc=size/T;
  return `<span class="iic gci" style="width:${size}px;height:${size}px;background-image:url(${TSD.sheet});background-size:${C*T*sc}px auto;background-position:-${(g[0]%C)*T*sc}px -${Math.floor(g[0]/C)*T*sc}px" title="${esc(g[1])}" aria-label="${esc(g[1].split(':')[0])}"></span>`; }
function gcDeco(html){
  if(!NOTEICO||!NOTEICO.gc) return html;   // (gem/charm data and the tradeskill names both arrive at start-up)
  if(!GCRX){ const q=x=>x.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); const ks=Object.keys(NOTEICO.gc).sort((a,b)=>b.length-a.length);
    GCRX={gem:new RegExp('\\b('+ks.filter(k=>NOTEICO.gc[k][2]==='gem').map(q).join('|')+')\\b','gi'),
          charm:new RegExp('\\b('+ks.filter(k=>NOTEICO.gc[k][2]==='charm').map(q).join('|')+')\\b','gi')}; }
  if(typeof TSD!=='undefined'&&TSD&&TSD.names&&!GCRX.ts){ const q=x=>x.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); GCRX.ts=new RegExp('\\b('+Object.keys(TSD.names).sort((a,b)=>b.length-a.length).map(q).join('|')+')\\b','gi'); }
  const charm=/charm/i.test(stripTags(html));
  const parts=html.split(/(<[^>]+>)/); let inTag=0, prevIco=false;
  return parts.map(p=>{
    if(p.startsWith('<')){ prevIco=/class="(ico|iic)/.test(p)||(prevIco&&/^<\/span>$/.test(p)); return p; }
    if(!p) return p;
    let out=p.replace(GCRX.gem,(m,_,off)=>(off===0&&prevIco)?m:gcIcon(m.toLowerCase())+m);
    if(charm){
      out=out.replace(/\b(\w+)(?= or \w+ Harnessing\b)/g,(m)=>NOTEICO.gc[(m+' harnessing').toLowerCase()]?gcIcon((m+' harnessing').toLowerCase())+m:m);
      out=out.split(/(<[^>]+>)/).map(q=>q.startsWith('<')?q:q.replace(GCRX.charm,(m,_,off)=>(off===0&&prevIco)?m:gcIcon(m.toLowerCase())+m)).join('');
    }
    if(GCRX.ts){ const seen=new Set(); out=out.split(/(<[^>]+>)/).map(q=>q.startsWith('<')?q:q.replace(GCRX.ts,(m,_,off)=>{ const k=m.toLowerCase(); if(seen.has(k)||(off===0&&prevIco)) return m; seen.add(k); return tsNameIcon(k)+m; })).join(''); }
    prevIco=false; return out; }).join('');
}
/* table columns that label or describe a row never get icons: the icon belongs next to the thing itself */
const NOICO_HEAD=/^(slots?|weapons?( type)?|weapon \d|type|types|role|roles|mode|modes|made for|tier|tiers|points|tree|trees|level|lvl|rank|weight|armou?r( weight)?|attributes?|stats?|when|where|location|sources?|drops? from|dropped by|boss|bosses|expedition|phase|time|cost|price|fee|gs|gear score|difficulty|what it does|what it gives|effects?|why|notes?|details?|description|how|how to get it|tip|tips|use|used for|best for|good for|values?|amount|qty|quantity|count|#|bonus|bonuses|requirement|requirements|cooldown|duration|percent|%)$/i;
/* a cell that is only a weapon type, a gear slot or an armour weight is a label, not an item */
const TYPE_WORDS=new Set(['sword and shield','sword & shield','s&s','sword','longsword','shield','round shield','kite shield','tower shield','rapier','hatchet','spear','great axe','greataxe','war hammer','warhammer','hammer','greatsword','flail','bow','flatbow','musket','blunderbuss','fire staff','life staff','ice gauntlet','void gauntlet','weapon','weapons','weapon 1','weapon 2','main hand','off hand',
  'helmet','helm','head','chest','gloves','hands','pants','legs','boots','feet','amulet','ring','earring','jewellery','jewelry','trinkets','heartrune','heart rune','light','medium','heavy','armour','armor','tool','tools','bag','bags','charm','charms','gem','gems']);
const isTypeWord = h => TYPE_WORDS.has(stripTags(h).replace(/&amp;/g,'&').replace(/\s*\(.*\)\s*$/,'').trim().toLowerCase());
function deco(html,w){
  if(!ICO) return html;
  let done=false;
  html=html.replace(/<strong>([^<]{3,60})<\/strong>/g,(m,n)=>{ const s=icoFor(n,w); if(s){ done=true; return IMG(s,n)+m; } const ii=itemIco(n); if(ii){ done=true; return ii+m; } return m; });
  if(done || /<[^>]+>/.test(html)) return html;
  const t=html.trim(); if(!t) return html;
  const s=icoFor(t,w); if(s) return IMG(s,t)+html;
  const ii=itemIco(t); if(ii) return ii+html;
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
    tgt = unesc((tgt||'').trim()); alias = (alias||esc(tgt.startsWith('#')?tgt.slice(1):tgt)).trim();
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
      // icons only where a column names things (items, perks, abilities, gems...): never in label or description columns
      const noIco=head.map(h=>NOICO_HEAD.test(stripTags(inline(h)).replace(/\*/g,'').trim()));
      out.push(`<div class="tw"><table><thead><tr>${head.map(h=>`<th>${inline(h)}</th>`).join('')}</tr></thead><tbody>`+
        rows.map(r=>{ const w=(wIdx>=0&&walias(r[wIdx]))||ctxW;
          const seen=new Set();   // the same name twice in a row gets one icon
          return `<tr>${r.map((c,ci)=>{ const h=inline(c), k=stripTags(h).trim().toLowerCase();
            if(ci===wIdx||noIco[ci]||isTypeWord(h)||seen.has(k)) return `<td>${h}</td>`;
            const d=gcDeco(deco(h,w)); if(d!==h) seen.add(k); return `<td>${d}</td>`; }).join('')}</tr>`; }).join('')+`</tbody></table></div>`);
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
// tab and tool icons: real New World item art, small copies in ui/
const ICONS=[[/craft/i,'craft'],[/my pages/i,'mypages'],[/build/i,'builds'],[/boss/i,'bosses'],[/expedition|raid/i,'raids'],[/pvp/i,'pvp'],[/war/i,'war'],[/outpost/i,'outpost'],[/gear/i,'grind'],[/reference/i,'refs']];
const ui = (k, c='ui') => `<img class="${c}" src="ui/${k}.webp" alt="" width="64" height="64" decoding="async">`;
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
const iconOf = t => ui((ICONS.find(([re])=>re.test(t))||[,'page'])[1]);

/* ---------- top nav ---------- */
function navTabs(){
  const hid=(typeof SITE!=='undefined'&&SITE.hidden)||[];
  const T=[];
  T.push({k:'Home', h:`<button class="nb" data-note="${esc((typeof SITE!=='undefined'&&NAMES[SITE.start])?SITE.start:'New World Home')}">${ui('home')}Home</button>`});
  const tool=(v,n,d,i)=>`<a class="mi tl2" data-view="${v}">${ui(i)}<div><b>${n}</b><span>${d}</span></div></a>`;
  T.push({k:'Tools', h:`<div class="drop"><button class="nb">${ui('tools')}Tools <span class="car">&#9662;</span></button><div class="menu">
    ${tool('items','Items','Search every weapon, armour piece and perk','items')}
    ${tool('gear','Loadout builder','Plan gear, perks and attributes, then share it','gear')}
    ${tool('calc','Calculator','Real damage and health, against raid bosses too','calc')}
    ${tool('craft','Recipe finder','Every recipe, with a shopping list','recipe')}
    ${tool('weight','Weight calculator','Equip load, and what light, medium and heavy give and cost','weight')}
    ${tool('tslevel','Tradeskill levelling','Cheapest and fastest way to level any crafting or gathering skill','recipe')}
    ${tool('trophyplanner','Trophy planner','Plan trophies for your houses, see the totals and what to craft','trophy')}
    ${tool('builds','Build browser','Filter every build by role, mode and weapon','buildbrowser')}
    ${tool('bosses','Boss browser','Filter bosses by expedition and weakness','bosses')}</div></div>`});
  if(typeof myLoMenu==='function') T.push({k:'Your loadouts', h:`<div class="drop"><button class="nb">${ui('loadouts')}Your loadouts <span class="car">&#9662;</span></button><div class="menu">${myLoMenu()}</div></div>`});
  if(typeof favMenu==='function') T.push({k:'Favourites', h:`<div class="drop"><button class="nb">&#9733; Favourites <span id="favcount" class="favn"></span><span class="car">&#9662;</span></button><div class="menu" id="favmenu">${favMenu()}</div></div>`});
  if(typeof openFeedback==='function') T.push({k:'Ideas & problems', h:`<button class="nb" data-fbopen="idea">Ideas &amp; problems</button>`});
  if(typeof edEnsure==='function'){ edEnsure(); if(ED.roles.length && !edIsOwner()) T.push({k:'Admin', h:`<button class="nb calcnb admnb" data-view="admin">Admin</button>`}); }
  if(typeof OWNER!=='undefined' && OWNER && OWNER.owner) T.push({k:'Admin', h:`<button class="nb calcnb admnb" data-view="admin">${ui('admin')}Admin</button>`});
  if(typeof canWrite==='function' && canWrite() && !TOPS.includes('My Pages'))
    T.push({k:'My Pages', h:`<div class="drop"><button class="nb">${ui('mypages')}My Pages <span class="car">&#9662;</span></button><div class="menu"><a class="mi hi" data-newpage="1">&#65291; New page</a><div class="mn">Pages you write yourself show up here.</div></div></div>`});
  for (const t of TOPS){
    const paths=Object.keys(META).filter(p=>p.startsWith(t+'/')).sort();
    const groups={};
    paths.forEach(p=>{ const rel=p.slice(t.length+1); const sub=rel.includes('/')?rel.split('/')[0]:''; (groups[sub]=groups[sub]||[]).push(p); });
    const extra = /build/i.test(t) ? `<a class="mi hi" data-view="builds">${ui('buildbrowser')}Build browser (filterable)</a>`
               : /boss/i.test(t) ? `<a class="mi hi" data-view="bosses">${ui('bosses')}Boss browser (filterable)</a>`
               : /craft/i.test(t) ? `<a class="mi hi" data-view="craft">${ui('recipe')}Recipe finder (every recipe, with shopping lists)</a><a class="mi hi" data-view="tslevel">${ui('recipe')}Tradeskill levelling planner</a>`
               : (/my pages/i.test(t) && typeof canWrite==='function' && canWrite()) ? `<a class="mi hi" data-newpage="1">&#65291; New page</a>` : '';
    let menu = extra;
    const fold = paths.length>12 && Object.keys(groups).some(g=>g);   // long menus: sub-folders start folded, click a heading to open it
    const items = l => l.map(p=>`<a class="mi" data-note="${esc(META[p].name)}">${esc(label(META[p].name))}</a>`).join('');
    for (const g of Object.keys(groups).sort((a,b)=>(a?1:0)-(b?1:0)||a.localeCompare(b))){
      if (!g) { menu += items(groups[g]); continue; }
      menu += fold ? `<div class="fold"><button class="mh tg" aria-expanded="false">${esc(label(g))} <span class="cnt">${groups[g].length}</span></button><div class="grp">${items(groups[g])}</div></div>`
                   : `<div class="mh">${esc(label(g))}</div>`+items(groups[g]);
    }
    T.push({k:label(t), h:`<div class="drop"><button class="nb">${iconOf(t)}${esc(label(t))} <span class="car">&#9662;</span></button><div class="menu">${menu}</div></div>`});
  }
  const order=(typeof SITE!=='undefined'&&SITE.order)||[];
  const pos=k=>{ let i=order.indexOf(k); if(i<0&&k==='Tools') i=order.indexOf('Items'); const after={'Favourites':.5,'Ideas & problems':.6,'Editor':.7}; if(i<0&&after[k]){ const y=order.indexOf('Your loadouts'); if(y>=0) return y+after[k]; } return i<0?1000:i; };
  const plain=h=>/Favourites/.test(h.slice(0,120))?h:h.replace(/(<button class="nb[^"]*"[^>]*>)\s*(?:&#\d+;)+\s*/,'$1');
  return T.map((t,i)=>({...t,h:plain(t.h),i})).sort((a,b)=>pos(a.k)-pos(b.k)||a.i-b.i).map(t=>({...t,hidden:hid.includes(t.k)}));
}
function topnav(){
  const own=typeof canWrite==='function' && canWrite();
  let h = navTabs().filter(t=>!t.hidden).map(t=>`<span class="tabw" ${own?'draggable="true"':''} data-tabkey="${esc(t.k)}">${t.h}</span>`).join('');
  if(own) h += `<span class="dragtip">drag tabs to reorder</span>`;
  h += `<div class="drop right"><button class="nb">Data <span class="car">&#9662;</span></button><div class="menu" id="datamenu"></div></div>`;
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
/* seasonal look picker: Automatic follows the in-game event calendar (dates live in index.html) */
function seasonPickHTML(){
  if(!window.NWSEASONS) return '';
  let cur='auto'; try{ cur=localStorage.getItem('nw_season')||'auto'; }catch(e){}
  const now=window.nwSeasonNow&&nwSeasonNow();
  const b=(k,n,c)=>`<button type="button" data-season="${k}" aria-pressed="${cur===k}"><i style="background:${c}"></i>${esc(n)}</button>`;
  return `<div class="mn tiny">Automatic changes the look for each in-game event${now?` (now: <b>${esc(now.n)}</b>)`:' (no event on right now)'}. Your pick is saved in this browser.</div>
    <div class="sspick">${b('auto','Automatic','conic-gradient(#9fd0e6,#e8b04a,#e7a3be,#f2a65a,#f0913c,#9fd0e6)')}${b('off','Normal look','#cfa557')}${NWSEASONS.map(x=>b(x.k,x.n,x.c)).join('')}</div>
    <label class="fxtog"><input type="checkbox" id="fxtog" ${window.nwFxOn&&nwFxOn()?'checked':''}> Moving light, glow and seasonal effects</label>
    ${window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches&&!document.body.classList.contains('fxforce')?'<div class="mn tiny">Your device asks websites to reduce motion (on Windows: Settings → Accessibility → Visual effects → Animation effects), so these start switched off. Tick the box to turn them on anyway.</div>':''}`;
}
document.addEventListener('change',e=>{ if(e.target&&e.target.id==='fxtog'&&window.nwFx) nwFx(e.target.checked); });
document.addEventListener('click',e=>{ const b=e.target.closest('[data-season]'); if(!b) return; e.preventDefault(); e.stopPropagation();
  try{ localStorage.setItem('nw_season',b.dataset.season); }catch(_){} if(window.nwApplySeason) nwApplySeason();
  b.parentElement.querySelectorAll('[data-season]').forEach(x=>x.setAttribute('aria-pressed',x===b)); });
function renderDataMenu(){
  const n = Object.keys(META).length;
  document.getElementById('datamenu').innerHTML =
    `<div class="mh">Loaded</div>
     <div class="mn"><b>${n} pages</b> &middot; ${SRC==='snapshot'?'built-in snapshot':SRC==='saved'?'your folder, saved to the page':'your own folder'}<br>${esc(SRC_AT)}</div>
     ${(typeof canWrite==='function'&&canWrite()&&!GHMODE)?`<a class="mi hi" id="pickfolder">&#128193; Load my vault folder&hellip;</a>`:`<div class="mn tiny">&#128274; Read-only. Only the page's owner can change what's shown here.</div>`}
     ${(typeof canWrite==='function'&&canWrite()&&!GHMODE)?`<div class="mn tiny">Pick the <b>New World</b> folder in your vault. ${(typeof CMODE!=='undefined'&&CMODE==='db'&&IS_OWNER)?'The pages are saved into this page\'s own storage, so they stay put between sessions and show on every device. Only you can change them.':'The page reads the .md files in your browser and remembers them in this browser.'}</div>`:''}
     ${SRC!=='snapshot'&&typeof canWrite==='function'&&canWrite()&&!GHMODE?`<a class="mi" id="resetdata">&#8634; Back to the built-in snapshot</a>`:''}
     ${(typeof canWrite==='function'&&canWrite())?`<div class="mh">Adding or changing things</div>
     <div class="mn tiny">${GHMODE?'The pages come from your Obsidian vault (Publish public site.bat). ':''}<b>&#9998; Edit</b> (top right of any page) changes that page. <b>Add your own notes</b> sits at the bottom of every page. <b>My Pages &rarr; New page</b> makes a page of your own. <b>&#9881;</b> changes the look.</div>`:''}<div class="mh">Site look</div>${typeof seasonPickHTML==='function'?seasonPickHTML():''}<div class="mh">About</div>${typeof clAdmin==='function'&&clAdmin()?'<a class="mi" data-view="changelog">Changelog</a>':''}<a class="mi" data-fbopen="idea">Send an idea or report a problem</a><a class="mi" href="terms.html">Terms of Service</a><a class="mi" href="privacy.html">Privacy Policy</a>`;
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
  if(typeof talkSummary==='function') talkSummary();
  const chips=(k,l)=>l.map(([v,t])=>`<button class="chip ${filt[k].has(v)?'on':''}" data-f="${k}" data-v="${v}">${t}</button>`).join('');
  const all=buildPaths();
  const shown=all.filter(p=>{ const t=META[p].tags; const ok=k=>filt[k].size===0||[...filt[k]].every(v=>t.includes(v)); const md=noteModes(META[p].body); const okm=filt.mode.size===0||[...filt.mode].some(v=>md.includes(v)); return ok('role')&&okm&&ok('weapon'); });
  const card=p=>{ const m=META[p]; const q=kv(m.body);
    const title=(m.body.match(/^#\s+(.*)$/m)||[,m.name])[1];
    const sum=(m.body.split('\n').find(l=>l.trim()&&!/^[#>|]/.test(l)&&!l.startsWith('Related'))||'').replace(/\*\*/g,'');
    const hasLo=/\n## Full loadout/.test('\n'+m.body);
    return `<div class="card" data-note="${esc(m.name)}">${typeof favBtn==='function'?favBtn('note',m.name,'card'):''}${hasLo?`<button class="peekbtn" data-peek="${esc(m.name)}" title="See the gear" aria-label="See the gear for ${esc(m.name)}"><svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M10 4C5.5 4 2.4 7.4 1.4 10c1 2.6 4.1 6 8.6 6s7.6-3.4 8.6-6C17.6 7.4 14.5 4 10 4zm0 10a4 4 0 110-8 4 4 0 010 8zm0-2.2a1.8 1.8 0 100-3.6 1.8 1.8 0 000 3.6z" fill="currentColor"/></svg> Gear</button>`:''}<div class="ct">${inline(title)}</div>
      <div class="cs">${inline(sum.slice(0,165))}</div>
      <div class="cmeta">${['Role','Modes','Armor','Attributes'].filter(k=>q[k]).map(k=>`<span><b>${k}</b> ${inline(q[k])}</span>`).join('')}</div>
      <div class="ctags">${m.tags.filter(t=>!['new-world','builds'].includes(t)).map(t=>`<span class="tag">${t}</span>`).join('')}${typeof talkBadge==='function'?talkBadge('note:'+m.name):''}</div></div>`; };
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

/* ---------- front page ---------- */
function homeHero(){
  const days=Math.ceil((Date.UTC(2027,0,31)-Date.now())/864e5);
  const end=days>1?`Season 10 Nighthaven is the last season. The servers close on 31 January 2027, ${days} days from now.`
           :days===1?'The servers close tomorrow, 31 January 2027.':'The servers closed on 31 January 2027. This vault stays up as a record.';
  const again=recent.filter(n=>NAMES[n]&&n!==(typeof SITE!=='undefined'&&SITE.start||'New World Home')).slice(0,5);
  return `<section class="hero">
    <h1>Azoth Vault</h1>
    <p class="sub">Builds, bosses, raids and gear for Season 10, worked out from the game's own data.</p>
    <p class="end">${end}</p>
    <div class="tools">
      <button class="tool" data-view="items">${ui('items','ti')}<b>Find an item</b><span>Search every weapon, armour piece and perk.</span></button>
      <button class="tool" data-view="gear">${ui('gear','ti')}<b>Build a loadout</b><span>Plan gear, perks and attributes, then share it.</span></button>
      <button class="tool" data-view="calc">${ui('calc','ti')}<b>Work out damage</b><span>Real hits and health for your build, against raid bosses too.</span></button>
      <button class="tool" data-view="craft">${ui('recipe','ti')}<b>Look up a recipe</b><span>Every recipe, with a shopping list.</span></button>
    </div>
    ${again.length?`<p class="again">Carry on reading: ${again.map(n=>`<a href="#" data-note="${esc(n)}">${esc(n)}</a>`).join('')}</p>`:''}
  </section>`;
}
/* ---------- browser history: every page you open is a step, so the browser's Back and Forward buttons move through the site ---------- */
let NAVD=0;   // how many site pages deep this tab's history is
function navWrite(url, st, push){
  try{
    if(push && current){ NAVD=(history.state&&history.state.nwd||0)+1; history.pushState({nw:1,nwd:NAVD,...st}, '', url); }
    else history.replaceState({nw:1,nwd:(history.state&&history.state.nwd)||0,...st}, '', url);
  }catch(e){}
  backState();
}
function goBack(){
  if(history.state&&history.state.nwd>0) history.back();
  else { const p=hist.pop(); if(p) p.kind==='note'?openNote(p.name,false):openView(p.v,false); }
}
function backState(){
  const b=document.getElementById('back'); if(!b) return;
  const can=(history.state&&history.state.nwd>0)||hist.length>0;
  b.disabled=!can; b.title=can?'Back to the previous page (or use your browser\'s Back button)':'Nothing to go back to yet';
}
function routeHash(h){
  if(h.startsWith('craft=')){ CQ.sel=decodeURIComponent(h.slice(6)); CQ.all=true; openView('craft',false); return true; }
  if(['builds','bosses','calc','gear','items','myloadouts','review','admin','craft','weight','trophyplanner','favs','feedback','editor','changelog','tslevel'].includes(h)){ openView(h,false); return true; }
  const hit=Object.keys(NAMES).find(n=>slug(n)===h); if(hit){ openNote(hit,false); return true; }
  return false;
}
window.addEventListener('popstate',e=>{
  if(typeof NAMES==='undefined'||!Object.keys(NAMES).length) return;
  const st=e.state;
  if(st&&st.nw){ if(hist.length) hist.pop(); st.kind==='note'?openNote(st.name,false):openView(st.v,false); }
  else routeHash((location.hash||'').replace('#',''));
  backState();
});
function openNote(name, push=true){
  const p=NAMES[name]; if(!p) return;
  if(push && current && current.kind==='note' && current.name===name) push=false;   // clicking the page you're on isn't a new step
  if(push && current) hist.push(current);
  current={kind:'note',name};
  recent=[name,...recent.filter(n=>n!==name)].slice(0,12); LS.set('nw_recent',recent);
  const m=META[p], pinned=pins.includes(name);
  if(/Game Data\/|Housing\//.test(p) && typeof loadCrafting==='function' && typeof CR!=='undefined' && !CR) loadCrafting().then(()=>{ if(current&&current.kind==='note'&&current.name===name) openNote(name,false); });
  const sib=siblings(p), ix=sib.indexOf(p);
  const prev=ix>0?META[sib[ix-1]].name:null, next=ix<sib.length-1?META[sib[ix+1]].name:null;
  const heads=[...m.body.matchAll(/^##\s+(.*)$/gm)].map(x=>x[1]);
  const toc=heads.length>2?`<aside class="toc"><div class="tl">On this page</div>${heads.map(h=>`<a href="#" data-anchor="${esc(slug(h))}">${inline(h)}</a>`).join('')}</aside>`:'';
  const homeName=(typeof SITE!=='undefined'&&SITE.start&&NAMES[SITE.start])?SITE.start:'New World Home';
  const isHome=name===homeName;
  document.getElementById('main').classList.toggle('home',isHome);
  document.getElementById('main').innerHTML=(isHome?homeHero():'')+
    `<div class="crumb"><span>${esc(sectionOf(p))}${m.folder.includes('/')?' &rsaquo; '+esc(label(m.folder.split('/').slice(1).join(' / '))):''}</span>
       ${typeof canWrite==='function'&&canWrite()?(m.custom?`<button class="pin" data-editpage="${esc(m.cid)}">&#9998; Edit</button>`:`<button class="pin" data-noteedit="${esc(name)}">&#9998; Edit</button>`):''}
       ${typeof edCanEdit==='function'&&edCanEdit(name)?`<button class="pin" data-edsug="${esc(name)}">&#9998; Suggest a change</button>`:''}
       ${typeof favBtn==='function'?favBtn('note',name,'pin'):''}</div>
     ${typeof editedBanner==='function'?editedBanner(name):''}
     <div class="cols">${toc}<article>${md(m.body)}
       <div class="pager">${prev?`<button class="pg" data-note="${esc(prev)}">&larr; ${esc(label(prev))}</button>`:'<span></span>'}
         ${next?`<button class="pg" data-note="${esc(next)}">${esc(label(next))} &rarr;</button>`:'<span></span>'}</div>
       ${m.custom&&typeof canWrite==='function'&&canWrite()?`<div class="addbar"><button class="mini" data-editpage="${esc(m.cid)}">&#9998; Edit this page</button></div>`:''}
       ${!m.custom&&typeof addendumHTML==='function'?addendumHTML(name):''}
       ${m.source?`<div class="srcline">Source: ${esc(m.source)}</div>`:''}
       ${typeof talkSlot==='function'&&p.startsWith(TOP_BUILDS+'/')&&/\n## Full loadout/.test('\n'+m.body)?talkSlot('note:'+name,name):''}
       ${typeof openFeedback==='function'&&!isHome?`<div class="fbline">Spotted something wrong or out of date on this page? <a href="#" data-fbopen="problem">Report it</a> &middot; <a href="#" data-fbopen="idea">Suggest an idea</a></div>`:''}</article></div>`;
  window.scrollTo(0,0);
  navWrite('#'+slug(name), {kind:'note',name}, push);
  const pb0=document.querySelector('.crumb .pin'); if(pb0) pb0.style.marginLeft='auto';
  if(!isHome && heads.length>2) foldSections(document.querySelector('#main article'));
  if(typeof talkMount==='function') talkMount(document.getElementById('main'));
}
/* pages with an "On this page" list: each ## section folds shut, click its heading to open it */
function foldSections(art){
  if(!art) return;
  let body=null, n=0;
  for(const el of [...art.children]){
    if(el.matches('.pager,.addbar,.mine,.srcline,.fbline,.talk')) break;
    if(el.tagName==='H2'){
      const sec=document.createElement('section'); sec.className='sec';
      body=document.createElement('div'); body.className='secb'; body.setAttribute('hidden','until-found');
      el.before(sec); sec.append(el,body);
      el.classList.add('sech'); el.tabIndex=0; el.setAttribute('role','button'); el.setAttribute('aria-expanded','false');
      body.addEventListener('beforematch',()=>openSec(sec,true));   // the browser's own find (Ctrl+F) opens the section it finds text in
      n++; continue;
    }
    if(body) body.append(el);
  }
  if(!n) return;
  art.querySelectorAll('section.sec').forEach(sec=>{
    const b=sec.querySelector('.secb'); const c=b.querySelectorAll('tbody tr').length||b.querySelectorAll(':scope > ul > li, :scope > ol > li').length;
    if(c>1) sec.firstElementChild.insertAdjacentHTML('beforeend',`<span class="seccnt">${c}</span>`);
  });
  const bar=document.createElement('div'); bar.className='secbar';
  bar.innerHTML=`<button class="mini" data-secall="1">Open all sections</button>`;
  art.querySelector('section.sec').before(bar);
}
function openSec(sec,o){ if(!sec) return; const h=sec.firstElementChild, b=sec.querySelector('.secb');
  if(sec.dataset&&sec.dataset.gf){ try{ const st=JSON.parse(localStorage.getItem('nw_gearfold')||'{}'); st[sec.dataset.gf]=!!o; localStorage.setItem('nw_gearfold',JSON.stringify(st)); }catch(e){} }
  if(o) b.removeAttribute('hidden'); else b.setAttribute('hidden','until-found');
  sec.classList.toggle('open',o); h.setAttribute('aria-expanded',o);
  const all=document.querySelector('[data-secall]'); if(all){ const any=[...document.querySelectorAll('section.sec')].some(s=>!s.classList.contains('open')); all.textContent=any?'Open all sections':'Close all sections'; } }
function openView(v,push=true){
  if(v==='review') v='admin';
  // editors (not the owner) get an Admin page with one section: suggesting changes in their area
  if(v==='admin' && typeof ED!=='undefined' && !(typeof OWNER!=='undefined'&&OWNER&&OWNER.owner) && (ED.roles.length||ED.loading)) v='editor';
  const same = current && current.kind==='view' && current.v===v;   // a re-render of the page you're on keeps your scroll position
  if(push && same) push=false;
  if(push && current) hist.push(current);
  current={kind:'view',v};
  document.getElementById('main').classList.remove('home');
  document.getElementById('main').innerHTML = v==='builds'?viewBuilds():v==='calc'?viewCalc():v==='gear'?viewGear():v==='items'?viewItems():v==='myloadouts'?viewMyLo():v==='admin'?viewReview():v==='craft'?viewCraft():v==='weight'?viewWeight():v==='trophyplanner'?viewTrophies():v==='favs'?viewFavs():v==='feedback'?viewFeedback():v==='editor'?viewEditor():v==='changelog'?viewChangelog():v==='tslevel'?viewTS():viewBosses();
  if(v==='items') itemsEvents();
  if(v==='calc') calcEvents();
  if(v==='gear') gearEvents();
  if(v==='myloadouts') myLoEvents();
  if(v==='admin') reviewEvents();
  if(v==='craft') craftEvents();
  if(v==='weight') weightEvents();
  if(v==='trophyplanner') trophyEvents();
  if(v==='favs') favsEvents();
  if(v==='feedback') feedbackEvents();
  if(v==='editor') editorEvents();
  if(v==='tslevel') tsEvents();
  if(!same) window.scrollTo(0,0);
  navWrite('#'+v, {kind:'view',v}, push);
  const c=document.getElementById('clearf');
  if(c) c.onclick=()=>{ filt={role:new Set(),mode:new Set(),weapon:new Set()}; openView('builds',false); };
}

/* ---------- events ---------- */
document.addEventListener('click', e=>{
  const dd=e.target.closest('.drop > .nb');
  if(dd){ const d=dd.parentElement; const was=d.classList.contains('open');
    document.querySelectorAll('.drop').forEach(x=>x.classList.remove('open'));
    if(!was){ d.classList.add('open'); const hb=document.querySelector('header').getBoundingClientRect().bottom; document.documentElement.style.setProperty('--hdr',Math.round(hb)+'px');
      // open the section that holds the page you're reading, and mark that page
      d.querySelectorAll('.mi.cur').forEach(x=>x.classList.remove('cur'));
      const cn=current&&current.kind==='note'?current.name:'';
      const here=cn?[...d.querySelectorAll('.mi[data-note]')].find(x=>x.dataset.note===cn):null;
      d.querySelectorAll('.fold').forEach(f=>{ const o=!!(here&&f.contains(here)); f.classList.toggle('open',o); f.firstElementChild.setAttribute('aria-expanded',o); });
      if(here){ here.classList.add('cur'); here.scrollIntoView({block:'nearest'}); } }
    e.stopPropagation(); return; }
  const tg=e.target.closest('.mh.tg');
  if(tg){ const f=tg.parentElement; const o=!f.classList.contains('open');
    // one section open at a time, so a long menu never runs past the bottom of the screen
    if(o) f.parentElement.querySelectorAll(':scope > .fold.open').forEach(x=>{ x.classList.remove('open'); x.firstElementChild.setAttribute('aria-expanded','false'); });
    f.classList.toggle('open',o); tg.setAttribute('aria-expanded',o); e.stopPropagation(); return; }
  if(!e.target.closest('.menu')) document.querySelectorAll('.drop').forEach(x=>x.classList.remove('open'));
  const pk=e.target.closest('[data-peek]');
  if(pk){ e.preventDefault(); e.stopPropagation(); if(typeof peekBuild==='function') peekBuild(pk.dataset.peek); return; }
  const n=e.target.closest('[data-note]');
  if(n){ e.preventDefault(); document.querySelectorAll('.drop').forEach(x=>x.classList.remove('open'));
    document.getElementById('q').value=''; openNote(n.dataset.note); return; }
  const v=e.target.closest('[data-view]');
  if(v){ e.preventDefault(); document.querySelectorAll('.drop').forEach(x=>x.classList.remove('open')); openView(v.dataset.view); return; }
  const f=e.target.closest('[data-f]');
  if(f){ const k=f.dataset.f,val=f.dataset.v; filt[k].has(val)?filt[k].delete(val):filt[k].add(val); openView('builds',false); return; }
  const b=e.target.closest('[data-bf]');
  if(b){ bfilt[b.dataset.bf]=bfilt[b.dataset.bf]===b.dataset.v?'':b.dataset.v; openView('bosses',false); return; }
  const sh=e.target.closest('.sech'); if(sh){ openSec(sh.parentElement,!sh.parentElement.classList.contains('open')); return; }
  const sa=e.target.closest('[data-secall]'); if(sa){ const o=sa.textContent.startsWith('Open'); document.querySelectorAll('section.sec').forEach(s=>openSec(s,o)); return; }
  const a=e.target.closest('[data-anchor]');
  if(a){ e.preventDefault(); const t=document.getElementById(a.dataset.anchor)||document.getElementById(slug(a.dataset.anchor));
    if(t) openSec(t.closest('section.sec'),true);
    if(t) t.scrollIntoView({behavior:'smooth',block:'start'}); return; }
  const np=e.target.closest('[data-newpage]'); if(np){ e.preventDefault(); document.querySelectorAll('.drop').forEach(x=>x.classList.remove('open')); openPageEditor(null); return; }
  const ep=e.target.closest('[data-editpage]'); if(ep){ openPageEditor(ep.dataset.editpage); return; }
  const ae=e.target.closest('[data-addedit]'); if(ae){ openAddendumEditor(ae.dataset.addedit); return; }
  const ne=e.target.closest('[data-noteedit]'); if(ne){ openNoteEditor(ne.dataset.noteedit); return; }
  const so=e.target.closest('[data-showorig]'); if(so){ const m=META[NAMES[so.dataset.showorig]];
    if(m&&m.orig!=null){ const art=document.querySelector('article'); if(art) art.innerHTML=md(m.orig)+`<div class="addbar"><button class="mini" data-note="${esc(m.name)}">&larr; Back to my version</button></div>`; } return; }
  if(e.target.closest('#gearbtn')){ openPanel(); return; }
  if(e.target.closest('#back')){ goBack(); }
});
const qEl=document.getElementById('q');
qEl.addEventListener('input',()=>{
  const r=search(qEl.value);
  if(r===null){ current?.kind==='view'?openView(current.v,false):openNote(current?.name||'New World Home',false); return; }
  document.getElementById('main').innerHTML=r;
});
document.addEventListener('keydown',e=>{
  const typing=/^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement||{}).tagName||'')||(document.activeElement||{}).isContentEditable;
  if(e.key==='/'&&!typing){ e.preventDefault(); qEl.focus(); }
  if((e.key==='Enter'||e.key===' ')&&document.activeElement&&document.activeElement.classList.contains('sech')){ e.preventDefault(); const s=document.activeElement.parentElement; openSec(s,!s.classList.contains('open')); }
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

/* ---------- interactive background (see style.css: #bgfx) ---------- */
(function(){
  const off=()=>{ try{ return localStorage.getItem('nw_fx')==='off'; }catch(e){ return false; } };
  const fx=document.createElement('div'); fx.id='bgfx'; fx.innerHTML='<div class="aur a1"></div><div class="aur a2"></div><div class="aur a3"></div><div class="g2"></div><div class="g1"></div><div class="dots"></div><div class="grain"></div><div class="vig"></div>'; document.body.prepend(fx);
  document.body.classList.toggle('nofx', off());
  try{ document.body.classList.toggle('fxforce', localStorage.getItem('nw_fx')==='on'); }catch(e){}
  let x=-999,y=-999,raf=0,card=null,cx=0,cy=0;
  const paint=()=>{ raf=0; fx.style.setProperty('--mx',x+'px'); fx.style.setProperty('--my',y+'px');
    if(x>-999){ fx.style.setProperty('--px',(x/innerWidth-.5).toFixed(3)); fx.style.setProperty('--py',(y/innerHeight-.5).toFixed(3)); }
    if(card){ card.style.setProperty('--cx',cx+'px'); card.style.setProperty('--cy',cy+'px'); } };
  document.addEventListener('pointermove',e=>{ if(e.pointerType!=='mouse'||document.body.classList.contains('nofx')) return;
    x=e.clientX; y=e.clientY;
    const c=e.target.closest&&e.target.closest('.slot,.card,.callout,.tw,.lcard,.panel');
    card=c; if(c){ const r=c.getBoundingClientRect(); cx=e.clientX-r.left; cy=e.clientY-r.top; }
    if(!raf) raf=requestAnimationFrame(paint); },{passive:true});
  document.addEventListener('pointerleave',()=>{ x=y=-999; if(!raf) raf=requestAnimationFrame(paint); });
  window.nwFx=on=>{ try{ localStorage.setItem('nw_fx',on?'on':'off'); }catch(e){} document.body.classList.toggle('nofx',!on); document.body.classList.toggle('fxforce',!!on); };
  window.nwFxOn=()=>!document.body.classList.contains('nofx') && (document.body.classList.contains('fxforce') || !(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches));
})();
/* ---------- falling things in the top bar: snow in winter, leaves in autumn, petals in spring, fireflies in summer, embers at Lunar New Year ---------- */
(function(){
  const hdr=document.querySelector('header'); if(!hdr) return;
  const cv=document.createElement('canvas'); cv.id='hdrfx'; cv.setAttribute('aria-hidden','true'); hdr.prepend(cv);
  const cx=cv.getContext('2d'); let W=0,H=0,dpr=1,P=[],kind='',last=0,run=true;
  const reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)');
  const KINDS={
    winter:{n:1/14, make:p=>Object.assign(p,{r:.8+Math.random()*1.9, vy:.25+Math.random()*.55, vx:0, sw:Math.random()*6.28, col:'rgba(235,246,255,'+(.45+Math.random()*.45)+')'}), draw:p=>{cx.beginPath();cx.arc(p.x,p.y,p.r,0,6.283);cx.fillStyle=p.col;cx.fill();}},
    harvest:{n:1/38, make:p=>leaf(p,['#c9682b','#e0a446','#9a4a1f','#d98a3a']), draw:drawLeaf},
    hallow:{n:1/40, make:p=>leaf(p,['#e2762a','#b34a1c','#7c3fb0','#f0a040']), draw:drawLeaf},
    spring:{n:1/34, make:p=>Object.assign(leaf(p,['#f3b8cf','#f7d3e2','#e79ab9','#fff0f5']),{s:2.2+Math.random()*2}), draw:drawLeaf},
    summer:{n:1/40, up:true, make:p=>Object.assign(p,{r:1+Math.random()*1.6, vy:-(.08+Math.random()*.2), vx:(Math.random()-.5)*.15, tw:Math.random()*6.28, col:Math.random()<.6?'255,213,120':'120,230,220'}),
      draw:p=>{ const a=.35+.45*Math.sin(p.tw+=.05); const g=cx.createRadialGradient(p.x,p.y,0,p.x,p.y,p.r*4); g.addColorStop(0,'rgba('+p.col+','+a+')'); g.addColorStop(1,'rgba('+p.col+',0)'); cx.fillStyle=g; cx.fillRect(p.x-p.r*4,p.y-p.r*4,p.r*8,p.r*8);} },
    lunar:{n:1/36, up:true, make:p=>Object.assign(p,{r:.8+Math.random()*1.5, vy:-(.15+Math.random()*.35), vx:(Math.random()-.5)*.25, tw:Math.random()*6.28, col:Math.random()<.5?'240,120,70':'246,200,110'}),
      draw:p=>{ const a=.4+.4*Math.sin(p.tw+=.08); cx.beginPath(); cx.arc(p.x,p.y,p.r,0,6.283); cx.fillStyle='rgba('+p.col+','+a+')'; cx.shadowColor='rgba('+p.col+',.8)'; cx.shadowBlur=6; cx.fill(); cx.shadowBlur=0; } },
    none:{n:1/70, up:true, make:p=>Object.assign(p,{r:.7+Math.random()*1.1, vy:-(.05+Math.random()*.12), vx:(Math.random()-.5)*.1, tw:Math.random()*6.28, col:'108,199,183'}),
      draw:p=>{ const a=.15+.25*Math.sin(p.tw+=.03); cx.beginPath(); cx.arc(p.x,p.y,p.r,0,6.283); cx.fillStyle='rgba('+p.col+','+a+')'; cx.fill(); } }
  };
  function leaf(p,cols){ return Object.assign(p,{s:3+Math.random()*3, vy:.35+Math.random()*.5, vx:.15+Math.random()*.35, rot:Math.random()*6.28, vr:(Math.random()-.5)*.05, sw:Math.random()*6.28, col:cols[Math.random()*cols.length|0]}); }
  function drawLeaf(p){ cx.save(); cx.translate(p.x,p.y); cx.rotate(p.rot); cx.scale(1,Math.abs(Math.cos(p.sw*.7))*.6+.4);
    const s=p.s; cx.beginPath(); cx.moveTo(-s,0); cx.quadraticCurveTo(0,-s*.75,s,0); cx.quadraticCurveTo(0,s*.75,-s,0);
    cx.fillStyle=p.col; cx.globalAlpha=.85; cx.fill();
    if(s>3){ cx.beginPath(); cx.moveTo(-s*1.25,0); cx.lineTo(s*.8,0); cx.strokeStyle='rgba(0,0,0,.25)'; cx.lineWidth=.6; cx.stroke(); }
    cx.globalAlpha=1; cx.restore(); }
  function size(){ const r=hdr.getBoundingClientRect(); dpr=Math.min(2,window.devicePixelRatio||1); W=r.width; H=r.height; cv.width=W*dpr; cv.height=H*dpr; cv.style.width=W+'px'; cv.style.height=H+'px'; cx.setTransform(dpr,0,0,dpr,0,0); }
  function reset(){ const k=KINDS[kind]; const n=Math.round(Math.min(90,W*k.n)); P=[]; for(let i=0;i<n;i++){ const p={x:Math.random()*W,y:Math.random()*H}; k.make(p); P.push(p);} }
  function off(){ return document.body.classList.contains('nofx')||(reduce&&reduce.matches&&!document.body.classList.contains('fxforce')); }
  function tick(t){
    if(!run) return; requestAnimationFrame(tick);
    const want=(window.NWSEASON&&KINDS[window.NWSEASON.k])?window.NWSEASON.k:'none';
    if(off()){ if(kind!=='off'){ cx.clearRect(0,0,W,H); kind='off'; } return; }
    if(want!==kind){ kind=want; reset(); }
    const dt=Math.min(3,(t-last)/16.7||1); last=t; const k=KINDS[kind];
    cx.clearRect(0,0,W,H);
    for(const p of P){
      if(p.sw!==undefined){ p.sw+=.02*dt; p.x+=(p.vx+Math.sin(p.sw)*.35)*dt; } else p.x+=p.vx*dt;
      p.y+=p.vy*dt; if(p.vr) p.rot+=p.vr*dt;
      if(k.up?p.y<-6:p.y>H+6){ p.y=k.up?H+4:-4; p.x=Math.random()*W; }
      if(p.x>W+8) p.x=-8; if(p.x<-8) p.x=W+8;
      k.draw(p);
    }
  }
  size(); new ResizeObserver(size).observe(hdr);
  document.addEventListener('visibilitychange',()=>{ run=!document.hidden; if(run){ last=performance.now(); requestAnimationFrame(tick); } });
  requestAnimationFrame(tick);
})();
/* ================= build calculator ================= */
let CALC = null;
const C = Object.assign({
  weapon:'Sword and Shield', ability:'Upheaval',
  emp:0, weak:0, base:0, bane:0, behind:0, critC:0, critD:0,
  tMit:35, tRend:0, pen:0, tAbs:0,
  weight:'Heavy', mit:40, fort:0, rend:0, abs:0, enemyPen:0, eWeak:0, eHit:5000,
  Str:300, Dex:0, Int:0, Foc:0, Con:200,
  real:true, gs:800, level:70, wOver:0, hpOver:0, hpBonus:0, food:'',
  hone:false, coat:false, ward:false, absorb:false,
  set:'', pieces:4, stacks:0, cond:false, boss:''
}, LS.get('nw_calc', {}));
if(!C.v){ C.critD=Math.max(0,(C.critD||0)-30); C.v=2; }   // old saves stored crit damage including the base +30%
const saveC = () => LS.set('nw_calc', C);
let compareSnap = LS.get('nw_calc_cmp', null);

const clamp=(v,a,b)=>Math.max(a,Math.min(b,isNaN(v)?a:v));
const mitFrom=(m0,plus)=>{ const r0=m0/(1-m0||.0001); const r=Math.max(0,r0*(1+plus)); return r/(1+r); };
const fmt=n=>Math.round(n).toLocaleString('en-GB');
const ELEM=['Fire','Ice','Nature','Corruption','Lightning','Arcane'];
const ATTRS=[['Str','Strength'],['Dex','Dexterity'],['Int','Intelligence'],['Foc','Focus'],['Con','Constitution']];
const FOOD_PTS=48;   // tier 5 attribute food, from the game data

/* ---------- set bonuses (numbers from EquipmentSets / perk text) ---------- */
const SETS={
  '':{n:'None'},
  SecondWind:{n:"Dreadwarden's (Second Wind)", tiers:[2,4], cond:'Exhausted, enemy within 5 m', note:'4 pc adds 10% lifesteal and Empower stacks when you leave exhaustion (not modelled)'},
  Enrage:{n:'Spectral Wrath (Enrage)', tiers:[1,3,5], stacks:true, cond:'Below 70% health (5 pc)', note:'Each stack: +1% damage, +0.5% damage taken. Max stacks 10 / 15 / 25 by pieces'},
  Overcharged:{n:"Barrow Robber's (Overcharged)", tiers:[3,5], stacks:true, note:'Each stack: +5% base damage and 4% Rend on you. Max 3 stacks, 5 at 5 pc. Getting hit clears them'},
  Protector:{n:'Hallowed Aegis (Protector\'s Blessing)', tiers:[2,4], stacks:true, note:'4 pc: +3% base damage per stack (max 5). At 5 stacks you also take 7% Rend'},
  Stifling:{n:"Obstructor's (Stifling)", tiers:[2,4], cond:'You are silenced (basic attacks only)', note:'4 pc: +10% base damage on basic attacks while silenced'},
  Elemental:{n:'Grave Offering (Elementally Charged)', tiers:[2,4], cond:'Spending a stored charge on a non-magic weapon', note:'Magic abilities do 7% less; a stored charge adds 10% weapon damage to non-magic attacks'},
  Tenacity:{n:'Insurmountable (Tenacity)', tiers:[2,4], cond:'Grit is active', note:'2 pc: take 5% more damage while Grit is up. 4 pc: Grit on light attacks and 5% lifesteal'},
  Focused:{n:"Thaumaturge's (Focused)", tiers:[2,4], note:'Healing only: +15% healing (not part of damage)'}
};
function setFx(){
  const s=SETS[C.set]||SETS['']; const p=C.pieces|0; const fx={base:0,dmg:0,taken:0,rendYou:0,txt:[]};
  if(!C.set) return fx;
  const magic=ELEM.includes((wData()||{}).type);
  if(C.set==='SecondWind' && p>=2 && C.cond){ fx.base+=20; fx.txt.push('+20% base damage while exhausted'); }
  if(C.set==='Enrage' && p>=1){ const max=p>=5?25:p>=3?15:10; const n=clamp(C.stacks|0,0,max); fx.dmg+=n; fx.taken+=n*0.5; fx.txt.push(`${n} Enrage stacks: +${n}% damage, +${n*0.5}% taken`); if(p>=5&&C.cond){ fx.base+=8; fx.txt.push('+8% below 70% health'); } }
  if(C.set==='Overcharged' && p>=3){ const max=p>=5?5:3; const n=clamp(C.stacks|0,0,max); fx.base+=n*5; fx.rendYou+=n*4; fx.txt.push(`${n} stacks: +${n*5}% base damage, ${n*4}% Rend on you`); }
  if(C.set==='Protector' && p>=4){ const n=clamp(C.stacks|0,0,5); fx.base+=n*3; if(n>=5) fx.rendYou+=7; fx.txt.push(`${n} stacks: +${n*3}% base damage`+(n>=5?', 7% Rend on you':'')); }
  if(C.set==='Stifling' && p>=4 && C.cond){ fx.base+=10; fx.txt.push('+10% base damage on basic attacks'); }
  if(C.set==='Elemental' && p>=2){ if(magic){ fx.base-=7; fx.txt.push('Magic weapon: −7% base damage'); } else if(C.cond){ fx.base+=10; fx.txt.push('Stored charge: +10% weapon damage'); } }
  if(C.set==='Tenacity' && p>=2 && C.cond){ fx.taken+=5; fx.txt.push('Grit up: +5% damage taken'); }
  return fx;
}

/* ---------- real-number helpers ---------- */
const hasReal=()=>!!(CALC&&CALC.weapons&&CALC.attrSum);
const isReal=()=>C.real&&hasReal();
const wData=()=>CALC&&CALC.weapons&&CALC.weapons[C.weapon];
const bossData=()=>(CALC&&CALC.bosses||[]).find(b=>b.id===C.boss);
const attrVal=k=>clamp((C[k]|0)+(C.food===k?FOOD_PTS:0),0,500);
function gsDamage(base,gs){
  const g=CALC.gs||{rate:.0112,over500:.6667,step:5}; gs=clamp(gs,100,800);
  const low=Math.floor((Math.min(gs,500)-100)/g.step), high=Math.max(0,Math.floor((gs-500)/g.step));
  return base*Math.pow(1+g.rate,low)*Math.pow(1+g.over500*g.rate,high);
}
function weaponDamage(){
  const w=wData(); if(!w) return null;
  const gsd=gsDamage(w.base,C.gs);
  const lvl=0.025*(clamp(C.level,1,70)-1);
  const parts=['Str','Dex','Int','Foc'].map(k=>({k, s:w.scale[k]||0, v:attrVal(k), m:(w.scale[k]||0)*((CALC.attrSum[k]||[])[attrVal(k)]||0)})).filter(x=>x.s>0);
  const am=parts.reduce((s,x)=>s+x.m,0);
  const est=gsd*(1+lvl+am);
  return {gsd,lvl,am,parts,est,used:C.wOver>0?C.wOver:est,over:C.wOver>0};
}
function maxHealth(){
  if(C.hpOver>0) return {hp:C.hpOver,over:true};
  const L=clamp(C.level,1,70), lh=CALC.levelHealth||{};
  const base=lh[L]!=null?lh[L]:(lh[L-1]!=null?lh[L-1]+50:50*L);
  const con=(CALC.conHealth||[])[attrVal('Con')]||0;
  return {hp:(base+con)*(1+clamp(C.hpBonus,0,100)/100),base,con,over:false};
}
function bossWkn(){ const b=bossData(), w=wData(); if(!b||!w) return 0; return (b.wkn||{})[w.type]||0; }
function bossAbs(){ const b=bossData(), w=wData(); if(!b||!w) return 0; return (b.abs||{})[w.type]||0; }

/* ---------- the maths ---------- */
function offence(){
  const abil=(CALC?.abilities?.[C.weapon]||[]).find(a=>a.n===C.ability);
  const abilPct=abil?abil.d:100;
  const sf=setFx(), b=bossData();
  const net=clamp(C.emp,0,50)-clamp(C.weak,0,50);
  const fEmp=1+net/100;
  const extraBase=(C.hone?7:0)+sf.base, extraBane=(C.coat?15:0);
  const fBase=1+(C.base+C.bane+C.behind+extraBase+extraBane)/100;
  const fSet=1+sf.dmg/100;
  const rendEff=clamp(C.tRend,0,70)*(1-(b?b.rendRes:0)/100);
  const tm=mitFrom(clamp(C.tMit,0,90)/100, -rendEff/100);
  const fMit=1-tm*(1-clamp(C.pen,0,100)/100);
  const fAbs=1-clamp(C.tAbs+bossAbs(),0,100)/100;
  const fWkn=1+bossWkn()/100;
  const w=wData(), real=isReal();
  const critBase=real&&w?w.critC*100:0, critMulBase=real&&w?w.critM:1.3;
  const critC=clamp(critBase+C.critC,0,100), critMul=critMulBase+clamp(C.critD,0,300)/100;
  const wd=real?weaponDamage():null;
  const unit=real&&wd?wd.used:100;
  const hit=unit*(abilPct/100)*fEmp*fBase*fSet*fMit*fAbs*fWkn;
  const avg=hit*(1+(critC/100)*(critMul-1));
  const baseline=unit*(abilPct/100)*(1-mitFrom(clamp(C.tMit,0,90)/100,0));
  return {abilPct,net,fEmp,fBase,fSet,tm,fMit,fAbs,fWkn,hit,crit:hit*critMul,avg,baseline,critC,critMul,critBase,critMulBase,
          wd,unit,real,sf,extraBase,extraBane,rendEff,gain:baseline?((avg/baseline-1)*100):0};
}
function defence(){
  const sf=setFx(), b=bossData();
  const rendYou=clamp(C.rend+sf.rendYou,0,70);
  const m=mitFrom(clamp(C.mit,0,90)/100, clamp(C.fort,0,200)/100 - rendYou/100);
  const absT=clamp(C.abs+(C.ward?10:0)+(C.absorb?15:0),0,100);
  const weakEff=clamp(C.eWeak,0,50)*(1-(b?b.weakRes:0)/100);
  const taken=(1-m*(1-clamp(C.enemyPen,0,100)/100))*(1-absT/100)*(1-weakEff/100)*(1+sf.taken/100)*100;
  const m0=mitFrom(clamp(C.mit,0,90)/100,0);
  const taken0=(1-m0)*100;
  const H=hasReal()?maxHealth():null;
  const hitTaken=(C.eHit||0)*taken/100;
  return {m,taken,absT,weakEff,rendYou,ehp:taken?100/taken:0,ehp0:taken0?100/taken0:0,saved:taken0?((1-taken/taken0)*100):0,
          H,ehpReal:H&&taken?H.hp*100/taken:0,hitTaken,hits:hitTaken?H&&H.hp/hitTaken:0};
}
const WEIGHTS={Light:25,Medium:33,Heavy:42};
function num(id,label,val,min,max,step,hint){
  return `<label class="in"><span>${label}${hint?`<i>${hint}</i>`:''}</span>
    <input type="number" data-c="${id}" value="${val}" min="${min}" max="${max}" step="${step||1}"></label>`;
}
const tog=(id,label,hint)=>`<label class="tog ${C[id]?'on':''}"><input type="checkbox" data-ct="${id}" ${C[id]?'checked':''}> <span>${label}${hint?` <i>${hint}</i>`:''}</span></label>`;

/* ---------- presets: raid bosses ---------- */
function applyBoss(id){
  C.boss=id; const b=bossData();
  if(b){
    const w=wData(); const el=w&&ELEM.includes(w.type);
    C.tMit=el?b.em:b.pm;
    toast(`${b.name}: ${b.family}, ${el?'elemental':'physical'} mitigation ${C.tMit}%`+(b.rendRes?`, Rend works at ${100-b.rendRes}%`:''));
  }
  saveC();
}

function viewCalc(){
  if(!CALC) return `<h1>Build calculator</h1><p class="lede">calc.json did not load, so the ability list is missing.</p>`;
  const o=offence(), d=defence(), real=o.real, w=wData(), b=bossData();
  const ab=(CALC.abilities[C.weapon]||[]);
  const attrRows=ATTRS.map(([k,nm])=>{
    const t=CALC.attrs[k]||{}; const ks=Object.keys(t).map(Number).sort((a,b)=>a-b);
    const val=attrVal(k);
    const active=ks.filter(x=>val>=x);
    const next=ks.find(x=>val<x);
    return `<tr><td><b>${nm}</b>${C.food===k?` <span class="tag">+${FOOD_PTS} food</span>`:''}<div class="stepper">
        <button data-step="${k}" data-by="-25">&minus;</button>
        <input type="number" data-c="${k}" value="${C[k]|0}" min="0" max="500" step="5">
        <button data-step="${k}" data-by="25">+</button></div></td>
      <td>${active.length?active.map(x=>`<div class="bp"><b>${x}</b> ${esc((t[x]||'').split('•').filter(Boolean)[0]||'').trim()}</div>`).join(''):'<span class="dimtx">nothing yet</span>'}</td>
      <td>${next?`<span class="dimtx">${next-val} more to <b>${next}</b></span><div class="bp next">${esc((t[next]||'').split('•').filter(Boolean)[0]||'').trim()}</div>`:'<span class="dimtx">maxed</span>'}</td></tr>`;
  }).join('');
  const total=ATTRS.reduce((s,[k])=>s+(C[k]|0),0);
  const F=v=>real?fmt(v):v.toFixed(1);
  const cmp = compareSnap ? `<div class="cmp"><b>Saved for comparison:</b> ${esc(compareSnap.name)} &mdash;
      hit <b>${F(compareSnap.hit)}</b>, average <b>${F(compareSnap.avg)}</b>, damage taken <b>${compareSnap.taken.toFixed(1)}</b>
      &nbsp;<span class="delta">${(o.avg-compareSnap.avg>=0?'+':'')}${F(o.avg-compareSnap.avg)} damage</span>,
      <span class="delta">${(d.taken-compareSnap.taken>=0?'+':'')}${(d.taken-compareSnap.taken).toFixed(1)} taken</span>
      ${!!compareSnap.real!==real?'<span class="dimtx">(saved in the other mode)</span>':''}
      <button class="mini" id="clearcmp">clear</button></div>` : '';
  const mylo=(typeof MYLO!=='undefined'?MYLO:[]);
  const importBar=`<div class="presetbar"><b>Import:</b>
      <select id="loimp"><option value="">Pick a loadout&hellip;</option><option value="cur">Loadout builder (current)</option>
        ${mylo.map((x,i)=>`<option value="${i}">${esc(x.name)} &mdash; ${esc(x.g.w1)}</option>`).join('')}</select>
      <button class="mini go" id="doimp">Import</button>
      <span class="dimtx tiny">Brings in weapon, attributes and perk totals (Empower, Fortify, Rend, crit, damage, absorption).</span></div>`;
  const bosses=CALC.bosses||[];
  const bossBar=bosses.length?`<div class="presetbar"><b>Target:</b>
      <button class="chip ${!C.boss?'on':''}" data-boss="">Custom</button>
      ${bosses.map(x=>`<button class="chip ${C.boss===x.id?'on':''}" data-boss="${esc(x.id)}" title="${esc(x.raid)}">${esc(x.name)}</button>`).join('')}</div>
      ${b?`<div class="callout info"><span class="ci">&#127919;</span><div><p><b>${esc(b.name)}</b> (${esc(b.raid)}) &middot; ${esc(b.family)} &middot; physical mitigation ${b.pm}%, elemental ${b.em}%
        ${b.rendRes?` &middot; <b>Rend works at ${100-b.rendRes}%</b>`:''}${b.weakRes?` &middot; Weaken works at ${100-b.weakRes}%`:''}
        &middot; weak to ${Object.entries(b.wkn||{}).map(([k,v])=>`${esc(k)} +${v}%`).join(', ')||'nothing'}.
        Bring the <b>${esc(b.family)}</b> coating and ward potion${w&&b.wkn&&b.wkn[w.type]?`; your ${esc(C.weapon)} (${esc(w.type)}) gets the +${b.wkn[w.type]}% weakness`:''}.</p></div></div>`:''}`:'';
  const s=SETS[C.set]||SETS[''];
  const wd=o.wd;
  return `<h1>Build calculator</h1>
  <p class="lede">${real?`Real numbers from your game data: weapon base damage, gear score, level and attribute scaling, with each weapon's own crit. Switch to <b>per 100</b> to compare builds without the weapon's numbers.`:`Set your buffs, debuffs and the target, and see what your hit comes to. Everything is per <b>100 weapon damage</b>, so it compares builds rather than guessing your weapon's numbers.`}</p>
  <div class="presetbar"><b>Show:</b>
    <button class="chip ${real?'on':''}" data-real="1" ${hasReal()?'':'disabled'}>Real numbers</button>
    <button class="chip ${!real?'on':''}" data-real="0">Per 100 weapon damage</button>
    ${hasReal()?'':'<span class="dimtx tiny">Real numbers need the new calc.json (run build-calc-data.py).</span>'}</div>
  ${importBar}
  ${bossBar}
  ${cmp}
  <div class="calcgrid">
    <section class="panel">
      <h2>&#9876; Your attack</h2>
      <label class="in"><span>Weapon<i><a class="wl" data-craftword="${esc((typeof CRAFT_WORD!=='undefined'&&CRAFT_WORD[C.weapon])||C.weapon)}">&#9874;&#65039; craftable ${esc(C.weapon)} weapons</a></i></span><select data-c="weapon">${Object.keys(CALC.abilities).sort().map(x=>`<option ${x===C.weapon?'selected':''}>${esc(x)}</option>`).join('')}</select></label>
      ${w?`<div class="wstats dimtx tiny">Base damage <b>${w.base}</b> &middot; ${esc(w.type)} &middot; crit ${Math.round(w.critC*100)}% &times;${w.critM} &middot; stagger ${w.stagger} &middot; block stability ${w.block.stab}</div>`:''}
      <label class="in"><span>Ability</span><select data-c="ability">${ab.map(a=>`<option ${a.n===C.ability?'selected':''} value="${esc(a.n)}">${esc(a.n)} &mdash; ${a.d?a.d+'%':'no damage'}</option>`).join('')}</select></label>
      ${real?`<div class="two">
        ${num('gs','Weapon gear score',C.gs,100,800,5,'max 800')}
        ${num('level','Character level',C.level,1,70,1,'cap 70')}
      </div>
      ${num('wOver','Weapon damage from your tooltip',C.wOver||'',0,99999,1,'optional: overrides the estimate')}`:''}
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
        ${num('critC',real?'Extra crit chance %':'Crit chance %',C.critC,0,100,1,real?`weapon has ${o.critBase.toFixed(0)}%`:'')}
      </div>
      ${num('critD','Extra crit damage %',C.critD,0,300,1,real?`weapon crits do &times;${o.critMulBase}`:'base crit is +30%')}
      <h3>The target</h3>
      <div class="two">
        ${num('tMit','Their mitigation %',C.tMit,0,90,1,b?`${esc(b.name)}: ${b.pm}% phys / ${b.em}% elem`:'light 25 / med 33 / heavy 42')}
        ${num('tRend','Rend you apply %',C.tRend,0,70,1,b&&b.rendRes?`boss resists: counts as ${o.rendEff.toFixed(0)}%`:'cap 70')}
      </div>
      <div class="two">
        ${num('pen','Armor penetration %',C.pen,0,100,1)}
        ${num('tAbs','Their absorption %',C.tAbs,0,100,1,'ward, conditioning')}
      </div>
      <div class="res">
        <div class="big"><span>${F(o.hit)}</span><i>${real?'per hit':'per 100 weapon damage'}</i></div>
        <div class="big alt"><span>${F(o.avg)}</span><i>average with crits (${o.critC.toFixed(0)}%)</i></div>
        <div class="big alt"><span>${F(o.crit)}</span><i>on a crit (&times;${o.critMul.toFixed(2)})</i></div>
      </div>
      <div class="gain">${o.gain>=0?'+':''}${o.gain.toFixed(1)}% vs the same ability with no buffs or debuffs</div>
      <div class="tw"><table><tbody>
        ${real&&wd?`<tr><td>Weapon damage</td><td>${wd.over?'from your tooltip':`GS ${C.gs}: ${fmt(wd.gsd)} &times; (1 + level ${wd.lvl.toFixed(2)} + attributes ${wd.am.toFixed(2)})`}</td><td class="r"><b>${fmt(wd.used)}</b></td></tr>`:''}
        <tr><td>Ability</td><td>${esc(C.ability)}</td><td class="r">&times;${(o.abilPct/100).toFixed(2)}</td></tr>
        <tr><td>Empower &minus; Weaken</td><td>${o.net>=0?'+':''}${o.net}%</td><td class="r">&times;${o.fEmp.toFixed(3)}</td></tr>
        <tr><td>Damage perks + bane + behind${o.extraBase||o.extraBane?' + extras':''}</td><td>+${(C.base+C.bane+C.behind+o.extraBase+o.extraBane)}%</td><td class="r">&times;${o.fBase.toFixed(3)}</td></tr>
        ${o.fSet!==1?`<tr><td>Set bonus damage</td><td>+${o.sf.dmg}%</td><td class="r">&times;${o.fSet.toFixed(3)}</td></tr>`:''}
        <tr><td>Their mitigation after your Rend</td><td>${(o.tm*100).toFixed(1)}%</td><td class="r">&times;${o.fMit.toFixed(3)}</td></tr>
        <tr><td>Their absorption</td><td>${(C.tAbs+bossAbs())}%</td><td class="r">&times;${o.fAbs.toFixed(3)}</td></tr>
        ${o.fWkn!==1?`<tr><td>Boss weakness to ${esc(w.type)}</td><td>+${bossWkn()}%</td><td class="r">&times;${o.fWkn.toFixed(3)}</td></tr>`:''}
      </tbody></table></div>
    </section>

    <section class="panel">
      <h2>&#128737; Your defence</h2>
      <label class="in"><span>Armour weight<i>sets the starting mitigation</i></span>
        <select data-c="weight">${Object.keys(WEIGHTS).map(x=>`<option ${x===C.weight?'selected':''}>${x}</option>`).join('')}</select></label>
      <div class="two">
        ${num('mit','Base mitigation %',C.mit,0,90,1,'rough: L25 M33 H42')}
        ${num('abs','Absorption %',C.abs,0,100,1,'ward, conditioning')}
      </div>
      <div class="two">
        ${num('fort','Fortify %',C.fort,0,200,1,'cap 200')}
        ${num('rend','Rend on you %',C.rend,0,70,1,'cap 70')}
      </div>
      <div class="two">
        ${num('enemyPen','Their armor penetration %',C.enemyPen,0,100,1)}
        ${num('eWeak','Weaken you apply to them %',C.eWeak,0,50,1,b&&b.weakRes?`boss resists: counts as ${d.weakEff.toFixed(0)}%`:'cuts their damage')}
      </div>
      ${real?`<div class="two">
        ${num('hpBonus','Max health bonus %',C.hpBonus,0,100,1,'amulet, perks')}
        ${num('hpOver','Max health from your sheet',C.hpOver||'',0,99999,1,'optional: overrides the estimate')}
      </div>
      ${num('eHit','Size of an enemy hit (before your defences)',C.eHit,0,999999,100,'to see what it does to you')}`:''}
      <div class="res">
        ${real&&d.H?`<div class="big"><span>${fmt(d.H.hp)}</span><i>max health${d.H.over?' (yours)':''}</i></div>
          <div class="big alt"><span>${fmt(d.ehpReal)}</span><i>effective health</i></div>
          <div class="big alt"><span>${(d.m*100).toFixed(1)}%</span><i>effective mitigation</i></div>`
        :`<div class="big"><span>${(d.m*100).toFixed(1)}%</span><i>effective mitigation</i></div>
          <div class="big alt"><span>${d.taken.toFixed(1)}</span><i>damage taken per 100</i></div>
          <div class="big alt"><span>&times;${d.ehp.toFixed(2)}</span><i>effective health</i></div>`}
      </div>
      <div class="gain">${d.saved>=0?'':'&minus;'}${Math.abs(d.saved).toFixed(1)}% ${d.saved>=0?'less':'more'} damage than base mitigation alone${real&&C.eHit?` &middot; a ${fmt(C.eHit)} hit does <b>${fmt(d.hitTaken)}</b> to you (${d.hits?d.hits.toFixed(1):'&infin;'} hits from full)`:''}</div>
      ${real&&d.H&&!d.H.over?`<p class="dimtx tiny">Health = level ${C.level} (${fmt(d.H.base)}) + ${attrVal('Con')} Constitution (${fmt(d.H.con)})${C.hpBonus?` + ${C.hpBonus}%`:''}. If your character sheet says something different, type it in above.</p>`:''}
      <div class="tw"><table><tbody>
        <tr><td>Mitigation after Fortify &minus; Rend</td><td>Fortify ${C.fort}% &middot; Rend ${d.rendYou}%</td><td class="r">${(d.m*100).toFixed(1)}%</td></tr>
        <tr><td>Absorption</td><td>${C.abs}%${C.ward?' + ward 10%':''}${C.absorb?' + potion 15%':''}</td><td class="r">${d.absT}%</td></tr>
        ${d.weakEff?`<tr><td>Weaken on them</td><td></td><td class="r">&minus;${d.weakEff.toFixed(1)}%</td></tr>`:''}
        ${o.sf.taken?`<tr><td>Set bonus downside</td><td></td><td class="r">+${o.sf.taken}% taken</td></tr>`:''}
        <tr><td><b>Damage taken</b></td><td>per 100 incoming</td><td class="r"><b>${d.taken.toFixed(1)}</b></td></tr>
      </tbody></table></div>
      <div class="callout tip"><span class="ci">&#128161;</span><div><p>Fortify and Rend both act on your <b>armor rating</b>, not straight off the damage, so the first 50% Fortify is worth far more than the last 50%. Try 0 &rarr; 50 &rarr; 100 and watch the effective-health number flatten.</p></div></div>
    </section>
  </div>

  <div class="calcgrid">
    <section class="panel">
      <h2>&#129514; Consumables</h2>
      <p class="dimtx tiny">Tier 5 values from the game data. They add on top of the boxes above.</p>
      <div class="togs">
        ${tog('hone','Powerful Honing Stone','+7% weapon damage')}
        ${tog('coat',`Infused ${b?esc(b.family):'creature'} Coating`,'+15% vs that enemy type')}
        ${tog('ward',`Infused ${b?esc(b.family):'creature'} Ward Potion`,'+10% absorption')}
        ${tog('absorb','Infused absorption potion','+15% vs one element, 30 s')}
      </div>
      <label class="in"><span>Attribute food<i>tier 5: +${FOOD_PTS} points</i></span>
        <select data-c="food"><option value="">None</option>${ATTRS.map(([k,n])=>`<option value="${k}" ${C.food===k?'selected':''}>${n} +${FOOD_PTS}</option>`).join('')}</select></label>
    </section>
    <section class="panel">
      <h2>&#128305; Set bonus</h2>
      <label class="in"><span>Set</span><select data-c="set">${Object.entries(SETS).map(([k,v])=>`<option value="${k}" ${C.set===k?'selected':''}>${esc(v.n)}</option>`).join('')}</select></label>
      ${C.set?`<div class="two">
        <label class="in"><span>Pieces worn<i>bonuses at ${s.tiers.join(' / ')}</i></span><select data-c="pieces">${[1,2,3,4,5].map(n=>`<option ${C.pieces==n?'selected':''}>${n}</option>`).join('')}</select></label>
        ${s.stacks?num('stacks','Stacks',C.stacks,0,25,1,'how many you have up'):'<div></div>'}
      </div>
      ${s.cond?tog('cond',s.cond):''}
      <p class="dimtx tiny">${esc(s.note||'')}</p>
      ${o.sf.txt.length?`<div class="gain">${o.sf.txt.map(esc).join(' &middot; ')}</div>`:`<p class="dimtx tiny">No bonus active with these settings.</p>`}
      <p class="tiny"><a class="wl" data-note="Set Pieces">See every piece and its fixed perks &rarr;</a></p>`:'<p class="dimtx tiny">Pick a set to add its bonus to the numbers.</p>'}
    </section>
  </div>

  <h2>Attribute planner</h2>
  <p class="lede">Points spent: <b>${total}</b>${C.food?` (+${FOOD_PTS} from food)`:''}. Thresholds and their effects are the game's own tooltips.${real&&wd&&!wd.over?` Your attributes add <b>${(wd.am*100).toFixed(0)}%</b> of the weapon's gear score damage (${wd.parts.map(x=>`${x.k} ${x.v}`).join(', ')}).`:''}</p>
  <div class="tw"><table><thead><tr><th>Attribute</th><th>Active now</th><th>Next threshold</th></tr></thead><tbody>${attrRows}</tbody></table></div>

  <h2>Save this build</h2>
  <div class="saverow">
    <input id="bname" placeholder="Name it, e.g. Juggernaut 300/200" value="">
    <button class="mini go" id="savebuild">Save</button>
    <button class="mini" id="cmpbuild">Hold for comparison</button>
    <button class="mini" id="resetcalc">Reset</button>
  </div>
  <div id="savedlist"></div>

  <div class="callout note"><span class="ci">&#8505;</span><div><p><b>How the real numbers are worked out.</b> Weapon damage = gear-score damage &times; (1 + level bonus + attribute bonus). Gear-score damage is the weapon's base damage compounded by 1.12% every 5 GS up to 500, then by two-thirds of that up to 800. The attribute bonus is the weapon's scaling &times; the game's own attribute curve (<code>AttributeDefinition</code>). Health is the level's base health plus the Constitution table. The level bonus (2.5% per level) and the gear-score formula are community figures, so if a number looks off, type the <b>weapon damage from your tooltip</b> and your <b>max health</b> from the character sheet, and everything else is worked out from those. Boss stats come from the game's <code>VitalsBaseData</code>.</p></div></div>`;
}
function renderSaved(){
  const el=document.getElementById('savedlist'); if(!el) return;
  const list=LS.get('nw_builds',[]);
  const F=(b,v)=>b.real?fmt(v):v.toFixed(1);
  el.innerHTML = list.length ? `<div class="tw"><table><thead><tr><th>Build</th><th>Weapon / ability</th><th>Hit</th><th>Average</th><th>Taken</th><th></th></tr></thead><tbody>`+
    list.map((b,i)=>`<tr><td><b>${esc(b.name)}</b></td><td>${esc(b.weapon)} &middot; ${esc(b.ability)}</td>
      <td>${F(b,b.hit)}</td><td>${F(b,b.avg)}</td><td>${b.taken.toFixed(1)}</td>
      <td class="r"><button class="mini" data-load="${i}">Load</button> <button class="mini" data-del="${i}">&times;</button></td></tr>`).join('')
    +`</tbody></table></div>` : `<p class="dimtx">No saved builds yet.</p>`;
}
function snapshot(name){
  const o=offence(), d=defence();
  return {name:name||'(unnamed)', weapon:C.weapon, ability:C.ability, hit:o.hit, avg:o.avg, taken:d.taken, real:o.real, state:{...C}};
}
function calcEvents(){
  const re=(k)=>{ saveC(); openView('calc',false); if(k){ const f=document.querySelector(`[data-c="${k}"]`); if(f&&f.focus&&f.tagName!=='SELECT'){ f.focus(); f.select&&f.select(); } } };
  document.querySelectorAll('[data-craftword]').forEach(el=>el.onclick=e=>{ e.preventDefault(); craftSearch(el.dataset.craftword); });
  document.querySelectorAll('[data-c]').forEach(el=>{
    const k=el.dataset.c;
    el.onchange=el.oninput=()=>{
      if(el.tagName==='SELECT') C[k]=(k==='pieces')?parseInt(el.value):el.value;
      else C[k]=parseFloat(el.value||0)||0;
      if(k==='weapon'){ const l=CALC.abilities[C.weapon]||[]; C.ability=l[0]?l[0].n:''; if(C.boss) applyBoss(C.boss); }
      if(k==='weight'){ C.mit=WEIGHTS[C.weight]; }
      if(k==='set'){ const s=SETS[C.set]; if(s&&s.tiers) C.pieces=s.tiers[s.tiers.length-1]; C.stacks=0; C.cond=false; }
      re(el.tagName==='SELECT'?null:k);
    };
  });
  document.querySelectorAll('[data-ct]').forEach(el=>el.onchange=()=>{ C[el.dataset.ct]=el.checked; re(); });
  document.querySelectorAll('[data-real]').forEach(b=>b.onclick=()=>{ if(b.disabled) return; C.real=b.dataset.real==='1'; re(); });
  document.querySelectorAll('[data-boss]').forEach(b=>b.onclick=()=>{ applyBoss(b.dataset.boss); openView('calc',false); });
  const di=document.getElementById('doimp');
  if(di) di.onclick=()=>{
    const v=document.getElementById('loimp').value; if(!v) return toast('Pick a loadout first');
    if(typeof loadoutToCalc!=='function') return toast('The loadout builder is not loaded');
    if(v==='cur'){ loadoutToCalc(G); toast('Imported the loadout builder'); }
    else { const x=MYLO[+v]; if(!x) return; loadoutToCalc(x.g); toast('Imported “'+x.name+'”'); }
    openView('calc',false);
  };
  document.querySelectorAll('[data-step]').forEach(b=>b.onclick=()=>{
    const k=b.dataset.step; C[k]=clamp((C[k]|0)+parseInt(b.dataset.by),0,500); re();
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
    const b2=LS.get('nw_builds',[])[+b.dataset.load]; if(b2){ Object.assign(C,b2.state); if(!b2.state.v){ C.critD=Math.max(0,(C.critD||0)-30); C.v=2; } saveC(); openView('calc',false); toast('Loaded “'+b2.name+'”'); }
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
  <p class="lede">${ITEMDB.items.length.toLocaleString()} endgame items from your game's own item tables. Searches names, perks <i>and</i> where things drop, so "gorgon", "Refreshing" or "Chardis" all work.${ITEMDB.srcNote?` <span class="credit">Drop sources and pictures from <a href="https://nw-buddy.de" target="_blank" rel="noopener">NW Buddy</a>.</span>`:''}</p>
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
     <div class="lobtns" style="flex-direction:column"><button class="mini go" data-equip="${esc(it.n)}">Equip</button>${typeof favBtn==='function'?favBtn('item',it.n):''}${it.r==='Crafting'||/craft/i.test((it.src||[]).join(' '))?`<button class="mini" data-craftit="${esc(it.n)}">&#9874;&#65039; Craft</button>`:''}</div></div>`).join('')||'<p class="empty">No items match.</p>'}</div>
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
  document.querySelectorAll('[data-craftit]').forEach(b=>b.onclick=()=>craftItemByName(b.dataset.craftit));
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
  [/Punishing/,'Punishing runeglass',3,'1-3 only — it has an internal cooldown, so 5 is wasted'],
  [/Shirking Heals/,'Shirking Heals',5,'Each piece adds a stack'],
];
/* ---- attributes: a slider for each, with the breakpoints you've reached listed beside it ---- */
const ATTR_LIST=[['STR','Strength','Str'],['DEX','Dexterity','Dex'],['INT','Intelligence','Int'],['FOC','Focus','Foc'],['CON','Constitution','Con']];
const attrTotal=()=>Object.values(G.attrs).reduce((a,b)=>a+(+b||0),0);
function attrBps(c){ const t=(CALC&&CALC.attrs&&CALC.attrs[c])||{}; return Object.keys(t).map(Number).sort((a,b)=>a-b).map(n=>{
  const parts=String(t[n]).split('•').map(x=>x.trim()).filter(Boolean); return {n, fight:parts[0]||'', gather:parts.slice(1).join(' · ')}; }); }
function attrListHTML(c,v){
  const bps=attrBps(c); if(!bps.length) return '';
  const got=bps.filter(b=>v>=b.n), next=bps.find(b=>v<b.n);
  return (got.length?got.map(b=>`<li class="got"><b>${b.n}</b><span>${esc(b.fight)}${b.gather?`<i>${esc(b.gather)}</i>`:''}</span></li>`).join(''):'<li class="none">No breakpoints reached yet</li>')
    +(next?`<li class="next"><b>${next.n}</b><span>Next: ${esc(next.fight)} <i>(${next.n-v} more)</i></span></li>`:'');
}
function attrRowsHTML(){
  return ATTR_LIST.map(([k,l,c])=>{ const v=+G.attrs[k]||0; const marks=attrBps(c).map(b=>`<span style="left:${b.n/5}%" class="${v>=b.n?'on':''}" title="${b.n}"></span>`).join('');
    return `<div class="attrrow">
      <div class="attrctl"><div class="attrhd"><span>${l}</span><output id="av-${k}">${v}</output></div>
        <div class="attrtrack"><input type="range" min="0" max="500" step="5" value="${v}" data-gr="${k}" aria-label="${l}"><div class="attrmarks">${marks}</div></div></div>
      <ul class="attrbp" id="ab-${k}">${attrListHTML(c,v)}</ul></div>`; }).join('');
}
function attrEvents(){
  document.querySelectorAll('[data-gr]').forEach(el=>{
    const k=el.dataset.gr, c=ATTR_LIST.find(a=>a[0]===k)[2];
    el.oninput=()=>{ const others=attrTotal()-(+G.attrs[k]||0); let v=Math.min(+el.value, Math.max(0,500-others)); v=Math.floor(v/5)*5; if(+el.value!==v) el.value=v;
      G.attrs[k]=v; document.getElementById('av-'+k).textContent=v; document.getElementById('ab-'+k).innerHTML=attrListHTML(c,v);
      el.parentElement.querySelectorAll('.attrmarks span').forEach(s=>s.classList.toggle('on', v>=+s.title));
      const t=document.getElementById('attrtot'); if(t){ const tot=attrTotal(); t.textContent=tot+' / 500 points'; t.classList.toggle('bad',tot>500); } };
    el.onchange=()=>{ saveG(); openView('gear',false); };   // totals and the summary card refresh when you let go
  });
}
/* ---- loadout builder: every heading folds. Open/closed is remembered (all open the first time) ---- */
function gearFold(){
  const col=document.querySelector('.gearwrap > div'); if(!col) return;
  let st={}; try{ st=JSON.parse(localStorage.getItem('nw_gearfold')||'{}'); }catch(e){}
  let body=null;
  for(const el of [...col.children]){
    if(el.tagName==='H2'){
      const key=el.textContent.replace(/[^A-Za-z ]/g,'').trim().split(' ')[0].toLowerCase();
      const sec=document.createElement('section'); sec.className='sec gsec'; sec.dataset.gf=key;
      body=document.createElement('div'); body.className='secb';
      el.before(sec); sec.append(el,body);
      el.classList.add('sech'); el.tabIndex=0; el.setAttribute('role','button');
      const open=st[key]!==false; if(open){ sec.classList.add('open'); el.setAttribute('aria-expanded','true'); } else { body.setAttribute('hidden','until-found'); el.setAttribute('aria-expanded','false'); }
      body.addEventListener('beforematch',()=>openSec(sec,true));
      continue;
    }
    if(body) body.append(el);
  }
  if(col.querySelector('section.gsec') && !col.querySelector('.secbar')){
    const bar=document.createElement('div'); bar.className='secbar';
    const any=[...col.querySelectorAll('section.gsec')].some(s=>!s.classList.contains('open'));
    bar.innerHTML=`<button class="mini" data-secall="1">${any?'Open all sections':'Close all sections'}</button>`;
    col.prepend(bar);
  }
}
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
  return `<div class="pkrow itm">${itemIcon(it,28)}<input class="pk item" list="${listId}" data-gi="${path}" value="${esc(val||'')}" placeholder="Item (optional) — type to search">${val?`<button class="crbtn" data-craftfind="${esc(val)}" title="How do I craft ${esc(val)}?">&#9874;&#65039;</button>`:''}</div>`;
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
  ['w1p1','w1p2','w1p3'].forEach(k=>add(g[k],'Weapon 1')); ['w2p1','w2p2','w2p3'].forEach(k=>add(g[k],'Weapon 2'));
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
      <div class="slot wide attrs">${attrRowsHTML()}
        <div class="attrfoot"><span class="attrtot ${attrTotal()>500?'bad':''}" id="attrtot">${attrTotal()} / 500 points</span>
        <a class="wl" data-note="Attribute Breakpoints">All breakpoints &rarr;</a></div>
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
  document.querySelectorAll('[data-craftfind]').forEach(el=>el.onclick=e=>{ e.preventDefault(); craftItemByName(el.dataset.craftfind); });
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
  attrEvents(); gearFold();
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
  if(tc) tc.onclick=()=>{ loadoutToCalc(G); openView('calc'); toast('Totals copied into the calculator'); };
}
/* copy a loadout (the builder's current one, or a saved one) into the calculator */
function loadoutToCalc(g){
  const {t}=totals(g);
  C.emp=Math.min(50,Math.round(t.emp)); C.fort=Math.min(200,Math.round(t.fort));
  C.tRend=Math.min(70,Math.round(t.rend));
  const tb=[treeBonuses(g.w1,(g.trees||{})[1]||[])];   // the calculator models weapon 1
  const tv=k=>tb.reduce((s,b)=>s+((b[k]&&b[k].always)||0),0);
  C.critC=Math.min(100,Math.round(t.crit+tv('crit'))); C.critD=Math.round(t.critd+tv('critd')); C.base=Math.round(t.dmg+tv('dmg'));
  C.abs=Math.min(100,Math.round(t.abs));
  const counts={}; ARMOR_SLOTS.forEach(s=>{ const w=(g.armor&&g.armor[s]&&g.armor[s].wt)||'Medium'; counts[w]=(counts[w]||0)+1; });
  C.weight=(counts.Heavy>=3?'Heavy':counts.Light>=4?'Light':'Medium'); C.mit=WEIGHTS[C.weight];
  if(CALC?.abilities?.[g.w1]){ C.weapon=g.w1; const l=CALC.abilities[g.w1]; if(l[0]) C.ability=l[0].n; }
  const a=g.attrs||{}; if(Object.values(a).some(v=>+v>0)) [['STR','Str'],['DEX','Dex'],['INT','Int'],['FOC','Foc'],['CON','Con']].forEach(([k,c])=>C[c]=Math.max(0,Math.min(500,parseInt(a[k])||0)));
  saveC();
}

/* ================= your loadouts: saved in this browser, shared by link ================= */
const PUBLIC_SITE=((document.querySelector('meta[name="nw-site"]')||{}).content)||'https://azothvault.com/';
let MYLO=LS.get('nw_myloadouts',[]);
/* saved loadouts follow your Discord login: kept in this browser, and copied to your account when you're logged in */
let LOUID=null, LOTIMER=null, LOSTATE='local';
const saveMYLO=()=>{ LS.set('nw_myloadouts',MYLO); loPush(); };
async function loApi(body){
  const r=await fetch(CFG.worker+'/los',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pass:dPass(),...body})});
  let d={}; try{ d=await r.json(); }catch(e){}
  if(!r.ok) throw Object.assign(new Error(d.error||('error '+r.status)),{status:r.status});
  return d;
}
function loPush(now){
  if(!LOUID||LOSTATE!=='synced') return; clearTimeout(LOTIMER);
  const send=()=>loApi({op:'put',data:{los:MYLO}}).catch(e=>toast("Couldn't save your loadouts to Discord: "+e.message));
  if(now) send(); else LOTIMER=setTimeout(send,1200);
}
function loSync(){
  const u=(typeof CFG!=='undefined'&&CFG.worker&&typeof dUser==='function')?dUser():null;
  if(!u){ LOUID=null; LOSTATE='local'; return; }
  if(u.id===LOUID) return; LOUID=u.id; LOSTATE='loading';
  loApi({op:'get'}).then(d=>{ if(LOUID!==u.id) return;
    const cloud=(d.data&&Array.isArray(d.data.los))?d.data.los:[]; const byId={};
    cloud.forEach(x=>byId[x.id]=x);
    let added=0; MYLO.forEach(x=>{ const c=byId[x.id]; if(!c){ byId[x.id]=x; added++; } else if((x.saved||'')>(c.saved||'')) byId[x.id]=x; });
    MYLO=Object.values(byId).sort((a,b)=>(b.saved||'').localeCompare(a.saved||'')); LS.set('nw_myloadouts',MYLO); LOSTATE='synced';
    if(added||MYLO.length!==cloud.length) loPush(true);
    if(added&&cloud.length) toast(`Added ${added} loadout${added>1?'s':''} from this browser to your account`);
    topnav(); if(current&&current.kind==='view'&&current.v==='myloadouts') openView('myloadouts',false);
  }).catch(e=>{ if(LOUID!==u.id) return; LOSTATE=e.status===503?'off':'error'; if(e.status===401) LOUID=null; });
}
window.addEventListener('pagehide',()=>{ if(LOTIMER&&LOUID){ clearTimeout(LOTIMER); LOTIMER=null;
  try{ navigator.sendBeacon&&navigator.sendBeacon(CFG.worker+'/los',new Blob([JSON.stringify({pass:dPass(),op:'put',data:{los:MYLO}})],{type:'text/plain'})); }catch(e){} } });
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
function shareBase(){ const h=location.hostname; return /^https?:$/.test(location.protocol) && h && !/github\.io$|^localhost$|^127\./.test(h) ? location.href.split('#')[0].split('?')[0] : PUBLIC_SITE; }
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
const GH={owner:'NoxieProxie', repo:'azothvault'};
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
  CFG.worker=(CFG.worker||'').replace(/\/+$/,''); CFG.gateway=(CFG.gateway||'').replace(/\/+$/,'');
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
      <div class="mn tiny">Your Discord ID: <code>${esc(u.id)}</code> <button class="mini tiny" id="acctid">Copy</button></div>
      <a class="mi" data-view="myloadouts">&#128190; Your loadouts</a>
      ${own?`<a class="mi" data-view="admin">&#128736; Admin</a><div class="mn tiny">You can edit this site: use <b>&#9998; Edit</b> on any page, <b>&#9881;</b> (top right) for the look, and drag tabs to reorder.</div>`:''}
      <a class="mi" id="acctout">&#8617; Log out</a></div></div>`;
  document.getElementById('acctout').onclick=()=>{ LS.del('nw_discord'); location.reload(); };
  const ci=document.getElementById('acctid'); if(ci) ci.onclick=async e=>{ e.stopPropagation(); try{ await navigator.clipboard.writeText(u.id); toast('Copied your Discord ID'); }catch(err){ toast('Your Discord ID is '+u.id); } };
}
function handleAuthHash(h){
  if(h.startsWith('discord=')){ LS.set('nw_discord',h.slice(8)); OWNER=null; const u=dUser(); const after=LS.get('nw_after_login','')||'myloadouts'; LS.del('nw_after_login');
    try{ history.replaceState(null,'','#'+after); }catch(e){}
    if(['builds','bosses','calc','gear','items','myloadouts','review','admin','craft','weight','trophyplanner','favs','feedback','editor'].includes(after)) openView(after,false);
    else { const hit=Object.keys(NAMES).find(n=>slug(n)===after); hit?openNote(hit,false):openView('myloadouts',false); }
    renderAcct(); if(typeof renderPinMenu==='function') renderPinMenu(); toast(u?'Logged in as '+u.name:'Logged in'); return true; }
  if(h.startsWith('error=login')){ try{ history.replaceState(null,'','#myloadouts'); }catch(e){} openView('myloadouts',false); const why=(h.match(/why=([a-z]+)/)||[])[1]||''; const WHY={discord:'you cancelled on Discord',nocode:'Discord sent nothing back',nocookie:'it took too long, or your browser blocked the login cookie',state:'another login was started in a different tab',token:'Discord refused the login code',user:'Discord would not share your profile'}; toast('Discord login did not finish'+(WHY[why]?': '+WHY[why]:'')+'. Try again.'); return true; }
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
  renderAcct(); if(OWNER&&OWNER.owner&&typeof topnav==='function') topnav();
  if(current?.kind==='view'&&current.v==='admin'){ openView('admin',false); }
  if(current?.kind==='view'&&current.v==='changelog'){ openView('changelog',false); }
}
async function submitIssueUrl(rec){
  const link=await shareLink(rec);
  const body=`**Loadout:** ${rec.name}\n**Weapons:** ${rec.g.w1} + ${rec.g.w2}\n**Mode:** ${rec.mode||'(say which mode it is for)'}\n**By:** (your in-game name)\n\nOpen it: ${link}\n\n_Submitted from the Azoth Vault site. The site owner reviews it before it appears in Community loadouts._`;
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
let AMG=LS.get('nw_amguild',''), AM=null, AMERR='';
/* ---- shared: server info for the Advanced rules and Role menus tabs ---- */
let GI=null, GIERR='', ADVRES=null, RMMSG='';
const rid6=()=>Math.random().toString(36).slice(2,8);
function serverGate(){
  if(!viaHelper()||!OWNER.bot||!OWNER.bot.token) return '<p class="dimtx">Set up the Discord bot first (Discord bot tab).</p>';
  if(BOTCH===null) return BOTCHERR?`<p class="bad">${esc(BOTCHERR)}</p>`:'<p class="dimtx">Loading your servers&hellip;</p>';
  if(!BOTCH.guilds.length) return '<p class="dimtx">The bot isn\'t in a server yet. Add it from the Discord bot tab.</p>';
  if(!AMG||!BOTCH.guilds.some(g=>g.id===AMG)) AMG=BOTCH.guilds[0].id;
  if(GI===null||GI.guild!==AMG) return GIERR?`<p class="bad">${esc(GIERR)}</p>`:'<p class="dimtx">Loading server details&hellip;</p>';
  return '';
}
function serverPick(){ return BOTCH.guilds.length>1?`<label class="lof"><span>Server</span><select id="amguild">${BOTCH.guilds.map(g=>`<option value="${g.id}" ${g.id===AMG?'selected':''}>${esc(g.name)}</option>`).join('')}</select></label>`:`<div class="dimtx">Server: <b>${esc(BOTCH.guilds[0].name)}</b></div>`; }
async function loadGuildInfo(){ GIERR=''; const g=AMG; try{ const d=await ownerApi('guildinfo',{guild:g}); GI={guild:g,...d}; }catch(e){ GIERR=e.message; GI=null; }
  if(current?.kind==='view'&&current.v==='admin'&&['advanced','roles','live'].includes(ADMTAB)) openView('admin',false); }
const optsOf=(list,sel)=>list.map(x=>`<option value="${x.id}" ${(sel||[]).includes(x.id)?'selected':''}>${esc(x.name)}${x.cat?' ('+esc(x.cat)+')':''}</option>`).join('');

/* ---- Live bot (always-online gateway worker) ---- */
let LIVECFG=null, LIVEERR='', LIVEST=null, LIVESTERR='';
const gwURL=()=>(CFG.gateway||'').replace(/\/+$/,'');
async function loadLive(){ LIVEERR=''; try{ LIVECFG=(await ownerApi('liveget')).live; }catch(e){ LIVEERR=e.message; LIVECFG=null; }
  if(current?.kind==='view'&&current.v==='admin'&&ADMTAB==='live') openView('admin',false); }
async function loadLiveStatus(path){ LIVESTERR=''; if(!gwURL()){ LIVEST=null; LIVESTERR='not set up'; return; }
  try{ const r=await fetch(gwURL()+(path||'/status'),{cache:'no-store'}); LIVEST=await r.json(); }catch(e){ LIVEST=null; LIVESTERR=e.message; }
  if(current?.kind==='view'&&current.v==='admin'&&ADMTAB==='live') openView('admin',false); }
function liveView(){
  if(!viaHelper()) return '<p class="dimtx">Needs the Discord login.</p>';
  const gate=serverGate(); if(gate) return gate;
  if(LIVECFG===null) return LIVEERR?`<p class="bad">${esc(LIVEERR)}</p>`:'<p class="dimtx">Loading live bot settings&hellip;</p>';
  const L=LIVECFG, st=LIVEST;
  const dot=!gwURL()?'&#9898; Not set up yet':LIVESTERR?'&#128308; Can\'t reach the live bot':!st?'&#9898; Checking&hellip;':st.state==='ready'?'&#128994; Online':st.stopped?'&#128308; Stopped':'&#128993; '+esc(st.state);
  const on=(id,v,label)=>`<label class="amon"><input type="checkbox" id="${id}" ${v?'checked':''}> ${label}</label>`;
  const num=(id,v,label,min,max)=>`<label class="lof"><span>${label}</span><input type="number" class="pk" id="${id}" min="${min}" max="${max}" value="${v}"></label>`;
  const TO=[[0,'No timeout'],[60,'1 minute'],[300,'5 minutes'],[600,'10 minutes'],[3600,'1 hour'],[21600,'6 hours'],[86400,'1 day'],[604800,'1 week']];
  const to=(id,v,label)=>`<label class="lof"><span>${label||'Time them out for'}</span><select id="${id}">${TO.map(([x,l])=>`<option value="${x}" ${+v===x?'selected':''}>${l}</option>`).join('')}</select></label>`;
  const card=(t,inner,full)=>`<div class="slot lcard"${full?' style="grid-column:1/-1"':''}><div class="sh">${t}</div>${inner}</div>`;
  return `<p class="dimtx">The live bot stays connected to Discord all the time, so it shows as <b>Online</b> and can react to messages as they're sent. It runs as its own small Cloudflare worker (<code>nw-vault-gateway</code>) and picks up changes here within about 2 minutes.</p>
  <div class="slots lobar">
   ${card('Status',`<div class="stline"><b>${dot}</b>${st&&st.bot?` as <b>${esc(st.bot)}</b>`:''}</div>
     ${st?`<div class="dimtx tiny">Servers: ${esc((st.servers||[]).join(', ')||'none yet')} &middot; connected since ${st.connectedSince?new Date(st.connectedSince).toLocaleString():'—'} &middot; ${st.events||0} events</div>`:''}
     ${st&&st.stopped?`<p class="bad">${esc(st.stopped)}</p>`:''}
     ${!gwURL()?'<p class="dimtx">Run <b>Deploy bot.bat</b> in the nw-vault-gateway folder first, then publish the site.</p>':`<div class="lbtns"><button class="mini" id="livechk">&#8635; Check</button><button class="mini" id="liverestart">Restart the connection</button></div>`}`,true)}
   ${card('&#127918; Status text',`<div class="two"><label class="lof"><span>Shown as</span><select id="lv_pt">${[['watching','Watching'],['playing','Playing'],['listening','Listening to'],['competing','Competing in'],['custom','Custom text']].map(([v,l])=>`<option value="${v}" ${L.presence.type===v?'selected':''}>${l}</option>`).join('')}</select></label>
     <label class="lof"><span>Text</span><input class="pk" id="lv_ptext" maxlength="100" value="${esc(L.presence.text)}"></label></div>`)}
   ${card('&#9889; Message spam',on('lv_spam',L.spam.on,'Catch members sending messages too fast')+`<div class="two">${num('lv_spamn',L.spam.msgs,'Messages',2,50)}${num('lv_spams',L.spam.secs,'Within (seconds)',1,60)}</div>`+to('lv_spamto',L.spam.timeout)+'<p class="dimtx tiny">Their burst of messages is deleted.</p>')}
   ${card('&#128257; Repeated messages',on('lv_dup',L.dupes.on,'Catch the same message sent again and again')+`<div class="two">${num('lv_dupn',L.dupes.count,'Times',2,20)}${num('lv_dups',L.dupes.secs,'Within (seconds)',5,600)}</div>`+to('lv_dupto',L.dupes.timeout))}
   ${card('&#128200; Violations',on('lv_vio',L.violations.on,'Escalate when someone keeps breaking rules')+`<div class="two">${num('lv_vion',L.violations.count,'Violations',1,50)}${num('lv_viom',L.violations.mins,'Within (minutes)',1,1440)}</div>
     <div class="two"><label class="lof"><span>Then</span><select id="lv_vioa">${[['timeout','Time out'],['kick','Kick'],['ban','Ban']].map(([v,l])=>`<option value="${v}" ${L.violations.action===v?'selected':''}>${l}</option>`).join('')}</select></label>${to('lv_vioto',L.violations.timeout,'Timeout length')}</div>
     <p class="dimtx tiny">Spam, repeats and anything Discord AutoMod blocks all count as violations.</p>`)}
   ${card('&#128118; New accounts',on('lv_new',L.newacc.on,'Flag accounts that are very new')+`<div class="two">${num('lv_newd',L.newacc.days,'Younger than (days)',1,365)}<label class="lof"><span>Then</span><select id="lv_newa"><option value="log" ${L.newacc.action==='log'?'selected':''}>Warn in the log</option><option value="kick" ${L.newacc.action==='kick'?'selected':''}>Kick them</option></select></label></div>`)}
   ${card('&#128075; Welcome',on('lv_wel',L.welcome.on,'Post a welcome card when someone joins')+`<label class="lof"><span>Channel</span><select id="lv_welc"><option value="">Pick a channel…</option>${optsOf(GI.channels,[L.welcome.channel])}</select></label>
     <label class="lof"><span>Message ({user}, {name}, {server}, {count})</span><textarea class="pk amta" id="lv_welt">${esc(L.welcome.text)}</textarea></label>`)}
   ${card('&#127991;&#65039; Auto-roles',`<label class="lof"><span>Give new members these roles (Ctrl+click for several)</span><select multiple size="5" class="amms" id="lv_ar">${optsOf(GI.roles,L.autoroles)}</select></label>`)}
   ${card('&#128221; Logs (to the mod log channel)',on('lv_lj',L.logs.joins,'Members joining')+on('lv_ll',L.logs.leaves,'Members leaving')+on('lv_le',L.logs.edits,'Edited messages (before and after)')+on('lv_ld',L.logs.deletes,'Deleted messages'))}
   ${card('&#128101; Skip',`<label class="lof"><span>Never act on these roles (staff with Manage Messages, Timeout Members or Admin are always skipped)</span><select multiple size="4" class="amms" id="lv_ig">${optsOf(GI.roles,L.ignoreRoles)}</select></label>`)}
  </div>
  <div class="lbtns" style="margin-top:12px"><button class="mini go" id="livesave">&#128190; Save</button><span id="livest" class="dimtx"></span></div>`;
}
/* ---- Advanced rules (YAGPDB-style rulesets) ---- */
const ADV_T=[['words','Words or phrases'],['links','Links (except approved sites)'],['invites','Invites to other servers'],['sites','Banned websites'],['names','Usernames and nicknames']];
const ADV_TO=[[0,'No timeout'],[60,'1 minute'],[300,'5 minutes'],[600,'10 minutes'],[3600,'1 hour'],[21600,'6 hours'],[86400,'1 day'],[604800,'1 week']];
function advView(){
  const gate=serverGate(); if(gate) return gate;
  const A=GI.advanced, chOpts=sel=>`<optgroup label="Categories">${optsOf(GI.categories,sel)}</optgroup><optgroup label="Channels">${optsOf(GI.channels,sel)}</optgroup>`;
  const lines=v=>esc((v||[]).join('\n'));
  const rule=(r,i,k)=>{ const p=`${i}:${k}:`;
    const listLabel={words:'Words or phrases (one per line; *word* also matches inside other words)',sites:'Websites (one per line)',names:'Words not allowed in names (one per line)'}[r.type];
    return `<div class="advrule ${r.enabled?'':'off'}">
      <div class="advhd"><input class="pk advname" data-adv="${p}name" value="${esc(r.name)}" placeholder="Rule name"><label class="amon"><input type="checkbox" data-adv="${p}enabled" ${r.enabled?'checked':''}> On</label><button class="mini" data-advdel="${i}:${k}">Delete rule</button></div>
      <div class="two"><label class="lof"><span>Trigger</span><select data-adv="${p}type" data-advre="1">${ADV_T.map(([v,l])=>`<option value="${v}" ${r.type===v?'selected':''}>${l}</option>`).join('')}</select></label>
        ${r.type==='names'?`<div class="dimtx tiny" style="align-self:end">Blocks members whose name contains these words from chatting until they change it.</div>`:`<label class="lof"><span>Then time them out for</span><select data-adv="${p}timeout">${ADV_TO.map(([v,l])=>`<option value="${v}" ${r.timeout===v?'selected':''}>${l}</option>`).join('')}</select></label>`}</div>
      ${listLabel?`<label class="lof"><span>${listLabel}</span><textarea class="pk amta" data-adv="${p}list">${lines(r.list)}</textarea></label>`:''}
      ${['links','invites','words','names'].includes(r.type)?`<label class="lof"><span>${r.type==='links'?'Approved sites':r.type==='invites'?'Allowed invite codes':'Let these through anyway'} (one per line)</span><textarea class="pk amta" data-adv="${p}allow">${lines(r.allow)}</textarea></label>`:''}
      ${r.type==='words'||r.type==='names'?`<details class="tiny"><summary>Advanced: patterns (regex, up to 10)</summary><textarea class="pk amta" data-adv="${p}regex">${lines(r.regex)}</textarea></details>`:''}
      <div class="two">${r.type!=='names'?`<label class="lof"><span>Message the member sees</span><input class="pk" data-adv="${p}message" maxlength="150" value="${esc(r.message)}" placeholder="Blocked by the server's rules."></label>`:'<span></span>'}
        <label class="amon" style="align-self:end"><input type="checkbox" data-adv="${p}alert" ${r.alert?'checked':''}> Send an alert to the log channel</label></div></div>`; };
  const rs=(x,i)=>`<div class="slot lcard advrs" style="grid-column:1/-1">
     <div class="advhd"><span class="sh">Ruleset</span><input class="pk advname" data-adv="${i}::name" value="${esc(x.name)}" placeholder="Ruleset name"><label class="amon"><input type="checkbox" data-adv="${i}::enabled" ${x.enabled?'checked':''}> Enabled</label><button class="mini" data-advrsdel="${i}">Delete ruleset</button></div>
     <div class="dimtx tiny">Ruleset conditions apply to every rule below.</div>
     <div class="two"><label class="lof"><span>Ignore these roles</span><select multiple size="4" class="amms" data-adv="${i}::ignoreRoles">${optsOf(GI.roles,x.ignoreRoles)}</select></label>
       <label class="lof"><span>Only active in (leave empty for everywhere)</span><select multiple size="4" class="amms" data-adv="${i}::onlyIn">${chOpts(x.onlyIn)}</select></label></div>
     <label class="lof"><span>Alerts go to</span><select data-adv="${i}::alertChannel"><option value="">The mod log channel</option>${optsOf(GI.channels,[x.alertChannel])}</select></label>
     <div class="sh" style="margin-top:6px">Rules</div>
     ${x.rules.map((r,k)=>rule(r,i,k)).join('')||'<p class="dimtx">No rules yet.</p>'}
     <div class="lbtns"><button class="mini" data-advadd="${i}">&#65291; Add rule</button></div></div>`;
  return `<p class="dimtx">Like YAGPDB's Advanced Automoderator: group rules into rulesets, give each ruleset conditions (roles to ignore, where it's active) and give each rule a trigger and effects. The rules run inside Discord's AutoMod, so they work 24/7. Bots and admins are always ignored.</p>
  <div class="slots lobar"><div class="slot lcard" style="grid-column:1/-1">${serverPick()}<p class="dimtx tiny">Discord allows 6 word/link rules per server in total (the AutoMod tab uses up to 4) and one username rule.</p></div>
  ${A.rulesets.map(rs).join('')}</div>
  <div class="lbtns" style="margin-top:12px"><button class="mini" id="advnewrs">&#65291; New ruleset</button><button class="mini go" id="advsave">&#128190; Save and apply to Discord</button><span id="advst" class="dimtx"></span></div>
  ${ADVRES?`<div class="tw" style="margin-top:10px"><table><tbody>${ADVRES.map(r=>`<tr><td>${esc(r.rule)}</td><td class="${/fail/.test(r.status)?'bad':''}">${esc(r.status)}</td></tr>`).join('')||'<tr><td>No rules switched on.</td></tr>'}</tbody></table></div>`:''}`;
}
function advCollect(){
  document.querySelectorAll('[data-adv]').forEach(el=>{ const [i,k,f]=el.dataset.adv.split(':'); const rs=GI.advanced.rulesets[+i]; if(!rs) return; const tgt=k===''?rs:rs.rules[+k]; if(!tgt) return;
    let v; if(el.type==='checkbox') v=el.checked; else if(el.multiple) v=[...el.selectedOptions].map(o=>o.value); else if(el.tagName==='TEXTAREA') v=el.value.split('\n').map(x=>x.trim()).filter(Boolean); else v=el.value;
    if(f==='timeout') v=+v; tgt[f]=v; });
}

/* ---- Role menus ---- */
function rmView(){
  const gate=serverGate(); if(gate) return gate;
  const M=GI.rolemenus, top=GI.botTop;
  const roleRow=(r,i,k)=>{ const ro=GI.roles.find(x=>x.id===r.id); const high=ro&&ro.position>=top;
    return `<div class="rmrow"><select data-rm="${i}:${k}:id" data-rmre="1"><option value="">Pick a role…</option>${GI.roles.map(x=>`<option value="${x.id}" ${x.id===r.id?'selected':''}>${esc(x.name)}</option>`).join('')}</select>
      <input class="pk" data-rm="${i}:${k}:emoji" value="${esc(r.emoji||'')}" placeholder="Emoji" maxlength="8" style="max-width:80px">
      <input class="pk" data-rm="${i}:${k}:label" value="${esc(r.label||'')}" placeholder="Label">
      <input class="pk" data-rm="${i}:${k}:desc" value="${esc(r.desc||'')}" placeholder="Description (menu only)">
      <button class="mini" data-rmrdel="${i}:${k}">&times;</button>${high?'<div class="bad tiny" style="flex-basis:100%">This role is above the bot\'s role, so the bot can\'t give it. Drag the bot\'s role higher in Server Settings → Roles.</div>':''}</div>`; };
  const menu=(m,i)=>`<div class="slot lcard" style="grid-column:1/-1">
    <div class="advhd"><span class="sh">Role menu</span>${m.message?'<span class="tag">posted</span>':'<span class="tag">not posted yet</span>'}<button class="mini" data-rmdel="${i}">Delete menu</button></div>
    <div class="two"><label class="lof"><span>Title</span><input class="pk" data-rm="${i}::title" value="${esc(m.title)}"></label>
      <label class="lof"><span>Post in channel</span><select data-rm="${i}::channel"><option value="">Pick a channel…</option>${optsOf(GI.channels,[m.channel])}</select></label></div>
    <label class="lof"><span>Text (Discord formatting works)</span><textarea class="pk amta" data-rm="${i}::text">${esc(m.text)}</textarea></label>
    <label class="lof"><span>Style</span><select data-rm="${i}::mode"><option value="menu" ${m.mode==='menu'?'selected':''}>Dropdown menu (pick several)</option><option value="buttons" ${m.mode==='buttons'?'selected':''}>Buttons (click to add or remove)</option></select></label>
    <div class="lof"><span>Roles (up to 25)</span></div>${m.roles.map((r,k)=>roleRow(r,i,k)).join('')}
    <div class="lbtns"><button class="mini" data-rmradd="${i}">&#65291; Add role</button><button class="mini go" data-rmpost="${i}">${m.message?'Update in Discord':'Post to Discord'}</button><span class="dimtx" id="rmst${i}"></span></div></div>`;
  return `<p class="dimtx">Post a message where members pick their own roles (for example Tank / Healer / DPS, or PvP / PvE pings). The bot needs the <b>Manage Roles</b> permission, and its role must sit above the roles it hands out.</p>
  <div class="slots lobar"><div class="slot lcard" style="grid-column:1/-1">${serverPick()}</div>${M.map(menu).join('')}</div>
  <div class="lbtns" style="margin-top:12px"><button class="mini" id="rmnew">&#65291; New role menu</button><span class="dimtx">${esc(RMMSG)}</span></div>`;
}
function rmCollect(){
  document.querySelectorAll('[data-rm]').forEach(el=>{ const [i,k,f]=el.dataset.rm.split(':'); const m=GI.rolemenus[+i]; if(!m) return; const tgt=k===''?m:m.roles[+k]; if(!tgt) return; tgt[f]=el.value; });
}
function automodView(){
  if(!viaHelper()||!OWNER.bot||!OWNER.bot.token) return '<p class="dimtx">Set up the Discord bot first (Discord bot tab).</p>';
  if(BOTCH===null) return BOTCHERR?`<p class="bad">${esc(BOTCHERR)}</p>`:'<p class="dimtx">Loading your servers&hellip;</p>';
  if(!BOTCH.guilds.length) return '<p class="dimtx">The bot isn\'t in a server yet. Add it from the Discord bot tab.</p>';
  if(!AMG||!BOTCH.guilds.some(g=>g.id===AMG)) AMG=BOTCH.guilds[0].id;
  const pick=BOTCH.guilds.length>1?`<label class="lof"><span>Server</span><select id="amguild">${BOTCH.guilds.map(g=>`<option value="${g.id}" ${g.id===AMG?'selected':''}>${esc(g.name)}</option>`).join('')}</select></label>`:`<div class="dimtx">Server: <b>${esc(BOTCH.guilds[0].name)}</b></div>`;
  if(AM===null||AM.guild!==AMG) return `<div class="slots lobar"><div class="slot lcard" style="grid-column:1/-1">${pick}<p class="dimtx">${AMERR?`<span class="bad">${esc(AMERR)}</span>`:'Loading AutoMod settings&hellip;'}</p></div></div>`;
  const c=AM.cfg, w=AM.warn;
  const T=[[0,'No timeout'],[60,'1 minute'],[300,'5 minutes'],[600,'10 minutes'],[3600,'1 hour'],[21600,'6 hours'],[86400,'1 day'],[604800,'1 week']];
  const to=(id,v)=>`<label class="lof"><span>Then time them out for</span><select id="${id}">${T.map(([s,l])=>`<option value="${s}" ${+v===s?'selected':''}>${l}</option>`).join('')}</select></label>`;
  const on=(id,v,label)=>`<label class="amon"><input type="checkbox" id="${id}" ${v?'checked':''}> ${label}</label>`;
  const ta=(id,v,ph)=>`<textarea id="${id}" class="pk amta" rows="3" placeholder="${esc(ph)}">${esc((v||[]).join('\n'))}</textarea>`;
  const ms=(id,list,sel)=>`<select id="${id}" multiple size="5" class="amms">${list.map(x=>`<option value="${x.id}" ${sel.includes(x.id)?'selected':''}>${esc(x.name)}</option>`).join('')}</select>`;
  const card=(title,inner,full)=>`<div class="slot lcard"${full?' style="grid-column:1/-1"':''}><div class="sh">${title}</div>${inner}</div>`;
  const others=AM.rules.filter(r=>!r.ours);
  return `<p class="dimtx">These rules run inside Discord itself (Discord AutoMod), so they work 24/7 even when nobody is online. Blocked messages never appear, the member sees a short note, and${OWNER.bot.log?' the mod log channel gets an alert':' (pick a mod log channel on the Discord bot tab to get alerts)'}.</p>
  <div class="slots lobar">
   ${card('Server',pick+(others.length?`<p class="dimtx tiny">Other AutoMod rules already in this server: ${others.map(r=>esc(r.name)+(r.enabled?'':' (off)')).join(', ')}. The spam, mention and word-filter ones are shared with these settings.</p>`:''),true)}
   ${card('&#128680; Spam',on('am_spam',c.spam.on,'Block messages Discord thinks are spam')+'<p class="dimtx tiny">Discord\'s own spam detection (scam links, copy-paste raids). For "too many messages too fast", use <code>/slowmode</code> in that channel.</p>')}
   ${card('&#128226; Mass mentions',on('am_men',c.mentions.on,'Block messages with lots of mentions')+`<div class="two"><label class="lof"><span>Mentions allowed per message</span><input type="number" id="am_menlim" class="pk" min="1" max="50" value="${c.mentions.limit}"></label>${to('am_mento',c.mentions.timeout)}</div>`+on('am_raid',c.mentions.raid,'Also catch mention raids across many messages'))}
   ${card('&#128279; Server invites',on('am_inv',c.invites.on,'Block invites to other Discord servers')+`<label class="lof"><span>Allowed invites (one per line, e.g. your own server's invite code)</span>${ta('am_invallow',c.invites.allow,'nwbuddies')}</label>`+to('am_invto',c.invites.timeout))}
   ${card('&#127760; Links',on('am_links',c.links.on,'Block all links except approved sites')+`<label class="lof"><span>Approved sites (one per line)</span>${ta('am_linkallow',c.links.allow,'youtube.com')}</label>`+to('am_linkto',c.links.timeout))}
   ${card('&#9940; Banned websites',on('am_sites',c.sites.on,'Block links to these websites')+`<label class="lof"><span>Websites (one per line)</span>${ta('am_siteslist',c.sites.list,'example-scam.com')}</label>`+to('am_sitesto',c.sites.timeout))}
   ${card('&#129324; Banned words',on('am_words',c.words.on,'Block messages with these words')+`<label class="lof"><span>Words or phrases (one per line; *word* matches inside other words)</span>${ta('am_wordslist',c.words.list,'badword')}</label><details class="tiny"><summary>Advanced: patterns (regex)</summary>${ta('am_wordsre',c.words.regex,'(?i)fr[e3]{2} n[i1]tro')}</details>`+to('am_wordsto',c.words.timeout))}
   ${card('&#128683; Built-in word lists',on('am_pre',c.presets.on,'Use Discord\'s word lists')+on('am_pre_sl',c.presets.slurs,'Slurs')+on('am_pre_sx',c.presets.sexual,'Sexual content')+on('am_pre_pr',c.presets.profanity,'Swearing')+`<label class="lof"><span>Words to let through anyway</span>${ta('am_preallow',c.presets.allow,'one per line')}</label>`)}
   ${card('&#128101; Who the rules skip',`<div class="two"><label class="lof"><span>Roles (Ctrl+click for several)</span>${ms('am_xr',AM.roles,c.exemptRoles)}</label><label class="lof"><span>Channels</span>${ms('am_xc',AM.channels,c.exemptChannels)}</label></div><p class="dimtx tiny">Admins and anyone with Manage Server are always skipped by Discord.</p>`+on('am_alert',c.alert,'Send an alert to the mod log channel when something is blocked'),true)}
   ${card('&#9888;&#65039; Warnings: automatic punishments',`<p class="dimtx tiny">Counts <code>/warn</code> warnings. Set a number to 0 to turn that step off.</p>
     <div class="two"><label class="lof"><span>Time out at this many warnings</span><input type="number" id="w_to" class="pk" min="0" max="50" value="${w.timeoutAt}"></label><label class="lof"><span>Timeout length (minutes)</span><input type="number" id="w_tom" class="pk" min="1" max="40320" value="${w.timeoutMins}"></label></div>
     <div class="two"><label class="lof"><span>Kick at this many</span><input type="number" id="w_kick" class="pk" min="0" max="50" value="${w.kickAt}"></label><label class="lof"><span>Ban at this many</span><input type="number" id="w_ban" class="pk" min="0" max="50" value="${w.banAt}"></label></div>
     <label class="lof"><span>Warnings expire after (days, 0 = never)</span><input type="number" id="w_exp" class="pk" min="0" max="3650" value="${w.expireDays}"></label>
     <p class="dimtx tiny">Mods can use <code>/warnings</code> to see someone's warnings and <code>/clearwarnings</code> to wipe them.</p>`,true)}
  </div>
  <div class="lbtns" style="margin-top:12px"><button class="mini go" id="amsave">&#128190; Save and apply to Discord</button><span id="amst" class="dimtx"></span></div>
  ${AM.results?`<div class="tw" style="margin-top:10px"><table><tbody>${AM.results.map(r=>`<tr><td>${esc(r.rule)}</td><td class="${/fail/.test(r.status)?'bad':''}">${esc(r.status)}</td></tr>`).join('')}</tbody></table></div>`:''}`;
}
async function loadAutomod(){ AMERR=''; const g=AMG; try{ const d=await ownerApi('automodget',{guild:g}); AM={guild:g,...d}; }catch(e){ AMERR=e.message; AM={guild:'_'}; }
  if(current?.kind==='view'&&current.v==='admin'&&ADMTAB==='automod') openView('admin',false); }
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
  if(current?.kind==='view'&&current.v==='admin'&&['bot','automod','advanced','roles','live'].includes(ADMTAB)) openView('admin',false); }
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
  const tabs=[['subs','&#128229; Submissions'+(SUBS&&SUBS.length?` <span class="admn">${SUBS.length}</span>`:'')],['published','&#127760; Community ('+com.length+')'],['bot','&#129302; Discord bot'],['automod','&#128737; AutoMod'],['advanced','&#129513; Advanced rules'],['live','&#128994; Live bot'],['roles','&#127917; Role menus'],['status','&#128225; Service status'+(STAT&&STAT.some(x=>x.incidents.length)?' <span class="admn">!</span>':'')],['helper','&#9881; Helper & links']];
  if(helper && typeof fbAdminHTML==='function') tabs.splice(1,0,['feedback','&#128172; Ideas and problems'+(fbNewCount()?` <span class="admn">${fbNewCount()}</span>`:'')]);
  if(helper && typeof edAdminHTML==='function') tabs.splice(2,0,['updates','&#128221; Waiting updates'+(edWaiting()?` <span class="admn">${edWaiting()}</span>`:'')],['editors','&#128101; Editors'],['suggest','&#9998; Suggest a change']);
  if(helper && typeof talkModHTML==='function') tabs.push(['comments','&#128488; Comments']);
  if(helper && typeof secHTML==='function') tabs.push(['security','&#128274; Security'+(SECD&&SECD.health&&SECD.health.some(h=>h.state==='missing'||h.state==='warn')?' <span class="admn">!</span>':'')]);
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
  if(ADMTAB==='feedback') body=fbAdminHTML();
  if(ADMTAB==='updates') body=edAdminHTML();
  if(ADMTAB==='editors') body=edRolesHTML();
  if(ADMTAB==='suggest') body=viewEditor(true);
  if(ADMTAB==='published') body=`<p class="dimtx">Everything in Community loadouts. Changes go live after GitHub rebuilds the site (a minute or two).</p>
  ${com.length?com.map((x,i)=>`<div class="locard"><div><b>${esc(x.name)}</b><div class="dimtx">${esc(x.by)}${x.mode?' &middot; '+esc(x.mode):''}${x.added?' &middot; added '+esc(x.added):''}${x.img?' &middot; has pictures':''}</div></div><div class="lobtns"><button class="mini" data-colo2="${esc(x.code)}">Open</button>${helper&&OWNER.discord?`<button class="mini" data-dpost="${esc(x.code)}">&#128227; Post to Discord</button>`:''}<button class="mini" data-comdel="${esc(x.code)}">Remove</button></div></div>`).join(''):'<p class="dimtx">Nothing published yet.</p>'}`;
  if(ADMTAB==='bot') body=helper&&OWNER.bot?botCard(OWNER.bot).replace('<h2>Discord bot</h2>',''):`<p class="dimtx">The Discord bot settings need the Discord login (helper Version 5 or newer).</p>`;
  if(ADMTAB==='status') body=statusView();
  if(ADMTAB==='security') body=secHTML();
  if(ADMTAB==='comments') body=talkModHTML();
  if(ADMTAB==='automod') body=automodView();
  if(ADMTAB==='advanced') body=advView();
  if(ADMTAB==='live') body=liveView();
  if(ADMTAB==='roles') body=rmView();
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
  if(ADMTAB==='feedback' && typeof fbAdminEvents==='function') fbAdminEvents();
  if(ADMTAB==='security' && typeof secEvents==='function') secEvents();
  if(ADMTAB==='comments' && typeof talkModEvents==='function') talkModEvents();
  if((ADMTAB==='updates'||ADMTAB==='editors') && typeof edAdminEvents==='function') edAdminEvents();
  if(ADMTAB==='suggest' && typeof editorEvents==='function') editorEvents();
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
  if((ADMTAB==='bot'||ADMTAB==='automod') && viaHelper() && OWNER.bot && OWNER.bot.token && BOTCH===null && !BOTCHERR) loadBotChannels();
  if(ADMTAB==='automod' && BOTCH && BOTCH.guilds.length && (AM===null || (AM.guild!==AMG && AM.guild!=='_'))) loadAutomod();
  const amg=document.getElementById('amguild'); if(amg) amg.onchange=()=>{ AMG=amg.value; LS.set('nw_amguild',AMG); AM=null; GI=null; ADVRES=null; openView('admin',false); };
  if((ADMTAB==='advanced'||ADMTAB==='roles') && viaHelper() && OWNER.bot && OWNER.bot.token && BOTCH===null && !BOTCHERR) loadBotChannels();
  if((ADMTAB==='advanced'||ADMTAB==='roles') && BOTCH && BOTCH.guilds.length && (GI===null||GI.guild!==(AMG||BOTCH.guilds[0].id)) && !GIERR){ if(!AMG) AMG=BOTCH.guilds[0].id; loadGuildInfo(); }
  if(ADMTAB==='live'){
    if(viaHelper() && OWNER.bot && OWNER.bot.token && BOTCH===null && !BOTCHERR) loadBotChannels();
    if(BOTCH && BOTCH.guilds.length && (GI===null||GI.guild!==(AMG||BOTCH.guilds[0].id)) && !GIERR){ if(!AMG) AMG=BOTCH.guilds[0].id; loadGuildInfo(); }
    if(LIVECFG===null && !LIVEERR) loadLive();
    if(LIVEST===null && !LIVESTERR && gwURL()) loadLiveStatus();
    on('livechk',()=>{ LIVEST=null; LIVESTERR=''; loadLiveStatus(); });
    on('liverestart',()=>{ LIVEST=null; openView('admin',false); loadLiveStatus('/restart'); });
    on('livesave',async()=>{ const v=id=>document.getElementById(id), ck=id=>!!v(id).checked, sel=id=>[...v(id).selectedOptions].map(o=>o.value);
      const live={presence:{type:v('lv_pt').value,text:v('lv_ptext').value}, spam:{on:ck('lv_spam'),msgs:+v('lv_spamn').value,secs:+v('lv_spams').value,timeout:+v('lv_spamto').value},
        dupes:{on:ck('lv_dup'),count:+v('lv_dupn').value,secs:+v('lv_dups').value,timeout:+v('lv_dupto').value},
        violations:{on:ck('lv_vio'),count:+v('lv_vion').value,mins:+v('lv_viom').value,action:v('lv_vioa').value,timeout:+v('lv_vioto').value},
        newacc:{on:ck('lv_new'),days:+v('lv_newd').value,action:v('lv_newa').value}, welcome:{on:ck('lv_wel'),channel:v('lv_welc').value,text:v('lv_welt').value},
        autoroles:sel('lv_ar'), logs:{joins:ck('lv_lj'),leaves:ck('lv_ll'),edits:ck('lv_le'),deletes:ck('lv_ld')}, ignoreRoles:sel('lv_ig')};
      const st=v('livest'), bt=v('livesave'); bt.disabled=true; st.textContent='Saving…';
      try{ LIVECFG=(await ownerApi('liveset',{live})).live; if(gwURL()) setTimeout(()=>fetch(gwURL()+'/reload').catch(()=>{}),4000); st.textContent='Saved ✓ The live bot picks it up in a few seconds.'; bt.disabled=false; toast('Live bot settings saved'); }
      catch(e){ st.textContent='Failed: '+e.message; bt.disabled=false; } });
  }
  if(ADMTAB==='advanced' && GI){
    const re=()=>{ advCollect(); openView('admin',false); };
    document.querySelectorAll('[data-advre]').forEach(el=>el.onchange=re);
    on('advnewrs',()=>{ advCollect(); GI.advanced.rulesets.push({id:rid6(),name:'New ruleset',enabled:true,ignoreRoles:[],onlyIn:[],alertChannel:'',rules:[{id:rid6(),name:'New rule',enabled:true,type:'words',list:[],regex:[],allow:[],alert:true,timeout:0,message:''}]}); openView('admin',false); });
    document.querySelectorAll('[data-advadd]').forEach(el=>el.onclick=()=>{ advCollect(); GI.advanced.rulesets[+el.dataset.advadd].rules.push({id:rid6(),name:'New rule',enabled:true,type:'words',list:[],regex:[],allow:[],alert:true,timeout:0,message:''}); openView('admin',false); });
    document.querySelectorAll('[data-advdel]').forEach(el=>el.onclick=()=>{ advCollect(); const [i,k]=el.dataset.advdel.split(':'); GI.advanced.rulesets[+i].rules.splice(+k,1); openView('admin',false); });
    document.querySelectorAll('[data-advrsdel]').forEach(el=>el.onclick=()=>{ if(el.dataset.sure!=='1'){ el.dataset.sure='1'; el.textContent='Click again to delete'; return; } advCollect(); GI.advanced.rulesets.splice(+el.dataset.advrsdel,1); openView('admin',false); });
    on('advsave',async()=>{ advCollect(); const st=document.getElementById('advst'), bt=document.getElementById('advsave'); bt.disabled=true; st.textContent='Applying to Discord…';
      try{ const d=await ownerApi('advset',{guild:AMG,advanced:GI.advanced}); GI.advanced=d.advanced; ADVRES=d.results; toast('Advanced rules saved'); openView('admin',false); }catch(e){ st.textContent='Failed: '+e.message; bt.disabled=false; } });
  }
  if(ADMTAB==='roles' && GI){
    const re=()=>{ rmCollect(); openView('admin',false); };
    document.querySelectorAll('[data-rmre]').forEach(el=>el.onchange=()=>{ rmCollect(); const [i,k]=el.dataset.rm.split(':'); const r=GI.rolemenus[+i].roles[+k]; const ro=GI.roles.find(x=>x.id===r.id); if(ro&&!r.label) r.label=ro.name; openView('admin',false); });
    on('rmnew',()=>{ rmCollect(); GI.rolemenus.push({id:rid6(),channel:'',message:'',title:'Pick your roles',text:'',mode:'menu',roles:[{id:'',label:'',desc:'',emoji:''}]}); openView('admin',false); });
    document.querySelectorAll('[data-rmradd]').forEach(el=>el.onclick=()=>{ rmCollect(); GI.rolemenus[+el.dataset.rmradd].roles.push({id:'',label:'',desc:'',emoji:''}); openView('admin',false); });
    document.querySelectorAll('[data-rmrdel]').forEach(el=>el.onclick=()=>{ rmCollect(); const [i,k]=el.dataset.rmrdel.split(':'); GI.rolemenus[+i].roles.splice(+k,1); openView('admin',false); });
    document.querySelectorAll('[data-rmpost]').forEach(el=>el.onclick=async()=>{ rmCollect(); const i=+el.dataset.rmpost, st=document.getElementById('rmst'+i); el.disabled=true; st.textContent='Posting…';
      const m=GI.rolemenus[i]; m.roles=m.roles.filter(r=>r.id);
      try{ const d=await ownerApi('rmpost',{guild:AMG,menu:m}); GI.rolemenus=d.rolemenus; RMMSG='Posted ✓'; toast('Role menu posted'); openView('admin',false); }catch(e){ st.textContent='Failed: '+e.message; el.disabled=false; } });
    document.querySelectorAll('[data-rmdel]').forEach(el=>el.onclick=async()=>{ if(el.dataset.sure!=='1'){ el.dataset.sure='1'; el.textContent='Click again to delete'; return; } rmCollect(); const m=GI.rolemenus[+el.dataset.rmdel];
      if(m.message){ try{ const d=await ownerApi('rmdelete',{guild:AMG,menu:m}); GI.rolemenus=d.rolemenus; }catch(e){ toast('Failed: '+e.message); return; } } else GI.rolemenus.splice(+el.dataset.rmdel,1);
      RMMSG='Menu deleted'; openView('admin',false); });
  }
  on('amsave',async()=>{ const v=id=>document.getElementById(id), ck=id=>!!(v(id)&&v(id).checked), lines=id=>(v(id)?v(id).value:'').split('\n').map(x=>x.trim()).filter(Boolean), sel=id=>v(id)?[...v(id).selectedOptions].map(o=>o.value):[];
    const cfg={spam:{on:ck('am_spam')}, mentions:{on:ck('am_men'),limit:+v('am_menlim').value,raid:ck('am_raid'),timeout:+v('am_mento').value},
      presets:{on:ck('am_pre'),slurs:ck('am_pre_sl'),sexual:ck('am_pre_sx'),profanity:ck('am_pre_pr'),allow:lines('am_preallow')},
      words:{on:ck('am_words'),list:lines('am_wordslist'),regex:lines('am_wordsre'),timeout:+v('am_wordsto').value},
      invites:{on:ck('am_inv'),allow:lines('am_invallow'),timeout:+v('am_invto').value}, links:{on:ck('am_links'),allow:lines('am_linkallow'),timeout:+v('am_linkto').value},
      sites:{on:ck('am_sites'),list:lines('am_siteslist'),timeout:+v('am_sitesto').value}, exemptRoles:sel('am_xr'), exemptChannels:sel('am_xc'), alert:ck('am_alert')};
    const warn={timeoutAt:+v('w_to').value,timeoutMins:+v('w_tom').value,kickAt:+v('w_kick').value,banAt:+v('w_ban').value,expireDays:+v('w_exp').value};
    const st=v('amst'), bt=v('amsave'); bt.disabled=true; st.textContent='Applying to Discord…';
    try{ const d=await ownerApi('automodset',{guild:AMG,cfg,warn}); AM={...AM,cfg,warn,results:d.results}; toast('AutoMod saved'); openView('admin',false); }
    catch(e){ st.textContent='Failed: '+e.message; bt.disabled=false; } });
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
  if(typeof loSync==='function') loSync();
  const com=communityLos();
  return `<a class="mi hi" data-view="myloadouts">&#128190; Manage loadouts</a>`+
    (MYLO.length?`<div class="mh">${LOSTATE==='synced'?'Saved to your account':'Saved on this device'}</div>`+MYLO.slice(0,15).map(x=>`<a class="mi" data-lo="${esc(x.id)}">${esc(x.name)}</a>`).join(''):`<div class="mn">Nothing saved yet. Build one in Loadout, then Save.</div>`)+
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
    <tr><td>Keep it for yourself</td><td><b>Save</b></td><td>Only you. ${LOSTATE==='synced'?'Saved to your Discord account, so it shows on every device you log in on':CFG.worker?'In this browser, or on every device once you log in with Discord':'In this browser'}</td></tr>
    <tr><td>Send it to a friend</td><td><b>Share link</b>, then paste it to them</td><td>Whoever has the link</td></tr>
    <tr><td>Put it on the site for everyone</td><td><b>Submit to Community</b> ${CFG.worker?'(log in with Discord first)':'(needs a free GitHub account)'}</td><td>Everyone, once the site owner approves it</td></tr>
  </tbody></table></div>
  ${CFG.worker&&!dUser()?`<div class="callout note mini-co"><span class="ci">&#128273;</span><div><p><b>Log in</b> with Discord (top right) to share your builds with everyone in Community loadouts. Logging in also saves your loadouts to your account, so they show on any device. Saving in this browser works without logging in.</p></div></div>`:''}
  <h2>${LOSTATE==='synced'?'Saved to your Discord account':'Saved on this device'} (${MYLO.length})</h2>${LOSTATE==='synced'?'<p class="dimtx small">These follow your Discord login to any device. Changes save automatically.</p>':LOSTATE==='error'?'<p class="bad small">Couldn\'t reach your account just now, so these are only in this browser for the moment.</p>':''}
  ${MYLO.length?MYLO.map(card).join(''):'<p class="dimtx">Nothing saved yet.</p>'}
  <h2>Community loadouts (${com.length})</h2>
  ${com.length?com.map((x,i)=>`<div class="locard"><div><b>${esc(x.name)}</b><div class="dimtx">${esc(x.by)}${x.mode?' &middot; '+esc(x.mode):''} ${typeof talkBadge==='function'?talkBadge('lo:'+h32(x.code)):''}</div></div><div class="lobtns"><button class="mini go" data-colo="${i}">Open</button>${typeof talkSlot==='function'&&CFG.worker?`<button class="mini" data-cotalk="${i}">&#128172; Ratings and comments</button>`:''}</div></div><div class="cotalk" id="cotalk_${i}" hidden></div>`).join(''):'<p class="dimtx">None yet.</p>'}
  ${(typeof OWNER!=='undefined'&&OWNER&&OWNER.owner)?`<p class="dimtx tiny" style="margin-top:24px"><a class="wl" data-view="admin">&#128736; Admin &rarr;</a></p>`:''}`;
}
function myLoEvents(){
  if(typeof talkSummary==='function') talkSummary();
  document.querySelectorAll('[data-cotalk]').forEach(b=>b.onclick=()=>{ const i=+b.dataset.cotalk, x=communityLos()[i], box=document.getElementById('cotalk_'+i); if(!x||!box) return;
    if(!box.hidden){ box.hidden=true; return; } box.hidden=false; if(!box.innerHTML) box.innerHTML=talkSlot('lo:'+h32(x.code),x.name); talkMount(box); });
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

/* ================= build preview: the same pictures as the Discord posts, for any build with a Full loadout ================= */
function presetRec(name){
  const L=parseLoadout(name); if(!L||!Object.keys(L.slots).length) return null;
  const keep=JSON.stringify(G);
  try { applyLoadout(name,L); return {name, mode:'', g:snapG()}; }
  finally { const o=JSON.parse(keep); Object.keys(G).forEach(k=>delete G[k]); Object.assign(G,o); }
}
function closePeek(){ const m=document.getElementById('peek'); if(m) m.remove(); document.removeEventListener('keydown',peekKey); }
function peekKey(e){ if(e.key==='Escape') closePeek(); }
async function peekBuild(name, tab){
  const rec=presetRec(name); if(!rec) return toast('This build has no Full loadout table yet');
  closePeek();
  const m=document.createElement('div'); m.id='peek'; m.className='peekbg';
  m.innerHTML=`<div class="peekbox" role="dialog" aria-modal="true" aria-label="${esc(name)} loadout">
    <div class="peekhead"><b>${esc(name)}</b>
      <span class="peektabs"><button class="chip ${tab!=='trees'?'on':''}" data-pt="gear">Gear</button><button class="chip ${tab==='trees'?'on':''}" data-pt="trees">Skill trees</button></span>
      <button class="mini go" data-pload="1">Open in loadout builder</button>
      <button class="mini" data-pnote="1">Read the guide</button>
      <button class="peekx" aria-label="Close">&times;</button></div>
    <div class="peekimg"><p class="dimtx">Drawing the loadout&hellip;</p></div></div>`;
  document.body.appendChild(m);
  document.addEventListener('keydown',peekKey);
  m.onclick=e=>{ if(e.target===m||e.target.closest('.peekx')) closePeek(); };
  m.querySelectorAll('[data-pt]').forEach(b=>b.onclick=()=>peekBuild(name,b.dataset.pt));
  m.querySelector('[data-pload]').onclick=()=>{ const L=parseLoadout(name); applyLoadout(name,L); saveG(); closePeek(); openView('gear'); toast('Loaded '+name+' into the loadout builder'); };
  m.querySelector('[data-pnote]').onclick=()=>{ closePeek(); openNote(name); };
  m.querySelector('.peekx').focus();
  try {
    const cv = tab==='trees' ? await treesCard(rec) : await gearCard(rec);
    if(!document.body.contains(m)) return;
    cv.className='peekcv'; const box=m.querySelector('.peekimg'); box.innerHTML=''; box.appendChild(cv);
  } catch(e){ m.querySelector('.peekimg').innerHTML=`<p class="dimtx">Couldn't draw this loadout: ${esc(e.message||String(e))}</p>`; }
}

/* ================= owner content + customise panel ================= */
let CDB=null, CUSER=null, IS_OWNER=false, CMODE='loading';   // 'db' | 'local' | 'loading'
const DEFAULT_SITE={brand:'Azoth Vault', accent:'#cfa557', theme:'dark', font:'m', width:'normal',
  hidden:[], order:[], start:'New World Home', icons:true};
let SITE=Object.assign({}, DEFAULT_SITE, LS.get('nw_site',{}));
if(SITE.brand==='New World · S10 Nighthaven'||SITE.brand==='New World vault'||SITE.brand==='New World Vault') SITE.brand=DEFAULT_SITE.brand;   // the old default title
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
  if(window.NWSEASON){ R.removeProperty('--gold'); R.removeProperty('--gold2'); }   // a seasonal look brings its own colours
  else { R.setProperty('--gold', SITE.accent); R.setProperty('--gold2', lighten(SITE.accent,.35)); }
  document.body.classList.remove('light','midnight'); if(SITE.theme!=='dark') document.body.classList.add(SITE.theme);
  document.body.classList.remove('fs-s','fs-l'); if(SITE.font!=='m') document.body.classList.add('fs-'+SITE.font);
  document.body.classList.remove('w-wide','w-full'); if(SITE.width!=='normal') document.body.classList.add('w-'+SITE.width);
  document.body.classList.toggle('noicons', !SITE.icons);
  const b=document.querySelector('.brand'); if(b){ const t=(SITE.brand==='New World · S10 Nighthaven'||SITE.brand==='New World vault'||SITE.brand==='New World Vault'?'':SITE.brand)||DEFAULT_SITE.brand;
    b.innerHTML=esc(t)+(t===DEFAULT_SITE.brand?' <small>Season 10 Nighthaven</small>':'')+`<span class="sstag" id="sstag">${esc(window.NWSEASON?NWSEASON.n:'')}</span>`; }
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
    // pages an editor added (approved by the owner) sit in their real folder; only editor areas are allowed
    // (the helper only saves these for folders inside an editor's area; here they just have to be a real folder of the site)
    const fol=String(pg.folder||'').replace(/\/$/,'');
    const inArea=fol && !fol.includes('..') && !/^My Pages/i.test(fol) && Object.keys(META).some(p=>!META[p].custom&&p.startsWith(fol.split('/')[0]+'/'));
    const path=inArea ? fol+'/'+name+'.md' : 'My Pages/'+(sec?sec.replace(/[\/]/g,'-')+'/':'')+name+'.md';
    let body=pg.body||'', tags=['custom'];
    const fm=body.match(/^---\n([\s\S]*?)\n---\n?/); if(fm){ body=body.slice(fm[0].length); const tg=fm[1].match(/tags:\s*\[(.*?)\]/); if(tg) tags=tags.concat(tg[1].split(',').map(s=>s.trim()).filter(Boolean)); }
    META[path]={name, folder:path.split('/').slice(0,-1).join('/'), tags, source:'', body:/^#\s/.test(body.trim())?body:'# '+pg.title+'\n\n'+body, path, custom:true, cid:id, by:pg.by||''};
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

/* ================= Crafting: every recipe from the game data ================= */
let CR=null, CRERR='', CRLOAD=null, CRSHEETS=[];
let CQ={q:'', ts:'', cat:'', all:false, page:0, sel:LS.get('nw_craft_sel',''), qty:1, open:{}, raw:LS.get('nw_craft_raw','raw')};
const REFINE_TS=['Smelting','Weaving','Leatherworking','Woodworking','Stonecutting'];
const EVENT_RX=/WinterConvergence|SummerMedleyfaire|NightveilHallow|SpringtideBloom|CraftingQuest|Rabbit|Turkey|Lunar|Anniversary/i;
async function loadCrafting(){
  if(CR||CRLOAD) return CRLOAD;
  CRLOAD=(async()=>{
    try{
      const d=await (await fetch('crafting.json')).json();
      for(let k=0;k<d.sheets;k++) CRSHEETS.push('craft_'+k+'.webp?v='+d.tile);
      d.byOut={}; d.byId={}; d.usedIn={};
      d.recipes.forEach((r,i)=>{ r.ix=i; d.byId[r.id]=r; (d.byOut[r.o]=d.byOut[r.o]||[]).push(r);
        r.ev=!r.ts || EVENT_RX.test(r.cat+' '+r.grp+' '+r.id) || /Seasons|SeasonalServers/.test(r.src) || r.cat==='Furniture' || /Dye|Pattern|Faction/.test(r.cat);
        r.lc=r.n.toLowerCase();
        r.i.forEach(([id])=>{ if(id[0]!=='$'&&!id.startsWith('c:')) (d.usedIn[id]=d.usedIn[id]||[]).push(i); }); });
      const tsn={}; d.recipes.forEach(r=>{ if(r.ts) tsn[r.ts]=(tsn[r.ts]||0)+1; }); d.tradeskills=Object.keys(tsn).filter(t=>tsn[t]>=10).sort();
      CR=d;
    }catch(e){ CRERR=String(e.message||e); }
    if(current?.kind==='view'&&(current.v==='craft'||current.v==='tslevel')) openView(current.v,false);
  })();
  return CRLOAD;
}
const crItem=id=>CR.items[id]||[id,'',-1];
function crName(id){ if(id[0]==='$') return id.slice(1); if(id.startsWith('c:')){ const c=CR.cats[id.slice(2)]; if(!c) return id.slice(2); const ex=c[1].slice(0,2).map(m=>crItem(m)[0]).join(', '); return 'Any '+c[0]+(ex?' (e.g. '+ex+')':''); } return crItem(id)[0]; }
function crIcon(id,size=32){
  if(id[0]==='$') return `<span class="iic crcur" style="width:${size}px;height:${size}px">&#9883;</span>`;
  if(id.startsWith('c:')){ const m=(CR.cats[id.slice(2)]||[])[1]||[]; const f=m.find(x=>crItem(x)[2]>=0); if(f) id=f; else return `<span class="iic none" style="width:${size}px;height:${size}px"></span>`; }
  const it=crItem(id), x=it[2];
  if(x>=0&&CRSHEETS.length){ const T=CR.tile,C=CR.cols,sheet=Math.floor(x/CR.per),j=x%CR.per,sc=size/T;
    return `<span class="iic" style="width:${size}px;height:${size}px;background-image:url(${CRSHEETS[sheet]});background-size:${C*T*sc}px auto;background-position:-${(j%C)*T*sc}px -${Math.floor(j/C)*T*sc}px" title="${esc(it[0])}"></span>`; }
  const big=typeof itemByName==='function'?itemByName(it[0]):null;
  return big?itemIcon(big,size):`<span class="iic none" style="width:${size}px;height:${size}px"></span>`;
}
// refining reagents (flux, tannin, sandpaper, solvent, weave) are bought or gathered, not broken down
const crNoBreak=(id,r)=>/^(Flux|Tannin|Sandpaper|Solvent|Weave|Wireweave)T/i.test(id)||(r&&r.i.some(([x])=>/Converter/i.test(x)));
// the recipe used to make an ingredient (prefer a normal, non-random one)
function crRecipeFor(id){ const l=CR.byOut[id]; if(!l) return null; return l.find(r=>!r.proc&&!r.ev)||l.find(r=>!r.proc)||l[0]; }
function crTree(id,need,depth,path,key){
  let r=(depth<6&&id[0]!=='$'&&!id.startsWith('c:')&&!path.includes(id))?crRecipeFor(id):null;
  if(r&&crNoBreak(id,r)) r=null;
  const crafts=r?Math.ceil(need/(r.q||1)):0, open=CQ.open[key];
  const cat=id.startsWith('c:')?CR.cats[id.slice(2)]:null;
  let h=`<div class="crrow" style="padding-left:${depth*22}px">${r||cat?`<button class="crtog" data-crtog="${esc(key)}">${open?'&#9662;':'&#9656;'}</button>`:'<span class="crtog sp"></span>'}
    ${crIcon(id,28)}<span class="crq">${need.toLocaleString()}&times;</span><span class="crn">${esc(crName(id))}</span>
    ${r?`<span class="dimtx tiny">${esc(r.ts||'')}${r.lv?' '+r.lv:''}${r.st?' &middot; '+esc(r.st):''}${crafts&&r.q>1?` &middot; ${crafts} craft${crafts>1?'s':''} (makes ${r.q})`:''}</span><button class="mini tiny" data-crsel="${esc(r.id)}">Open</button>`:''}</div>`;
  if(open&&r) h+=r.i.map(([iid,q],k)=>crTree(iid,q*crafts,depth+1,path.concat(id),key+'/'+k)).join('');
  if(open&&cat) h+=`<div class="crrow crany" style="padding-left:${(depth+1)*22+26}px"><span class="dimtx tiny">Any one of: ${cat[1].slice(0,24).map(m=>esc(crItem(m)[0])).join(', ')}${cat[1].length>24?'…':''}</span></div>`;
  return h;
}
// everything you need to gather, refining things down to raw materials
function crRaw(id,need,depth,path,acc){
  const r=(depth<6&&id[0]!=='$'&&!id.startsWith('c:')&&!path.includes(id))?crRecipeFor(id):null;
  if(r&&CQ.raw==='raw'&&REFINE_TS.includes(r.ts)&&!crNoBreak(id,r)){
    const crafts=Math.ceil(need/(r.q||1)); r.i.forEach(([iid,q])=>crRaw(iid,q*crafts,depth+1,path.concat(id),acc)); return; }
  acc[id]=(acc[id]||0)+need;
}
function viewCraft(){
  if(!CR){ loadCrafting(); return `<h1>Crafting</h1>${CRERR?`<p class="bad">Couldn't load the recipes: ${esc(CRERR)}</p>`:'<p class="dimtx">Loading every recipe from the game data&hellip;</p>'}`; }
  const q=CQ.q.trim().toLowerCase();
  const list=CR.recipes.filter(r=>(CQ.all||!r.ev)&&(!CQ.ts||r.ts===CQ.ts)&&(!CQ.cat||r.cat===CQ.cat)&&(!q||r.lc.includes(q)||crItem(r.o)[0].toLowerCase().includes(q)))
    .sort((a,b)=>(q?((b.lc.startsWith(q))-(a.lc.startsWith(q))):0)||(b.gs-a.gs)||a.n.localeCompare(b.n));
  const per=30, pages=Math.max(1,Math.ceil(list.length/per)); if(CQ.page>=pages) CQ.page=0;
  const shown=list.slice(CQ.page*per,CQ.page*per+per);
  const cats=[...new Set(CR.recipes.filter(r=>(CQ.all||!r.ev)&&(!CQ.ts||r.ts===CQ.ts)).map(r=>r.cat).filter(Boolean))].sort();
  const sel=CQ.sel&&CR.byId[CQ.sel];
  return `<h1>Crafting</h1>
  <p class="lede">${CR.recipes.length.toLocaleString()} recipes straight from the game's own data. Pick one to see what it needs, where to make it and the full list of materials to gather.${CR.where?` <span class="credit">Where to gather each material comes from <a href="https://nw-buddy.de" target="_blank" rel="noopener">NW Buddy</a>'s game data.</span>`:''}</p>
  <div class="crwrap"><div class="crleft">
   <div class="filters" data-h="Find a recipe"><input id="crq" class="isearch" placeholder="Search, e.g. prismatic ingot, artisan, infused health" value="${esc(CQ.q)}" autocomplete="off">
    <div class="frow"><span class="fl">Skill</span>${['',...CR.tradeskills].map(t=>`<button class="chip ${CQ.ts===t?'on':''}" data-crts="${esc(t)}">${esc(t)||'All'}</button>`).join('')}</div>
    <div class="frow"><span class="fl">Category</span><select id="crcat"><option value="">Any</option>${cats.map(c=>`<option ${CQ.cat===c?'selected':''}>${esc(c)}</option>`).join('')}</select>
     <label class="amon"><input type="checkbox" id="crall" ${CQ.all?'checked':''}> Include event, faction, cosmetic and quest recipes</label></div></div>
   <div class="pager"><button class="mini" data-crpg="-1" ${CQ.page?'':'disabled'}>&larr; Prev</button><span>Page <b>${CQ.page+1}</b> of ${pages} &middot; ${list.length.toLocaleString()} recipes</span><button class="mini" data-crpg="1" ${CQ.page>=pages-1?'disabled':''}>Next &rarr;</button></div>
   <div class="crlist">${shown.map(r=>`<div class="crli ${sel&&sel.id===r.id?'on':''}" data-crsel="${esc(r.id)}">${crIcon(r.o,36)}<div><b>${esc(r.n)}</b><div class="dimtx tiny">${esc(r.ts||'—')}${r.lv?' '+r.lv:''}${r.gs?' &middot; GS '+r.gs:''}${r.cat?' &middot; '+esc(r.cat):''}</div></div></div>`).join('')||'<p class="empty">No recipes match.</p>'}</div>
  </div>
  <div class="crright">${sel?craftDetail(sel):'<div class="slot lcard"><p class="dimtx">Pick a recipe on the left.</p></div>'}</div></div>`;
}
function craftDetail(r){
  const n=Math.max(1,Math.min(9999,CQ.qty|0)), raw={};
  r.i.forEach(([id,q])=>crRaw(id,q*n,0,[r.o],raw));
  const rawList=Object.entries(raw).sort((a,b)=>b[1]-a[1]);
  const used=(CR.usedIn[r.o]||[]).map(i=>CR.recipes[i]).filter(x=>CQ.all||!x.ev).slice(0,12);
  const others=(CR.byOut[r.o]||[]).filter(x=>x.id!==r.id);
  return `<div class="slot lcard crdet">
    <div class="crhead">${crIcon(r.o,56)}<div><h2 style="margin:0">${esc(r.n)}</h2>
      <div class="dimtx">${r.q>1?'Makes '+r.q+' &middot; ':''}${r.tier?'Tier '+esc(r.tier)+' &middot; ':''}${r.gs?'Gear score '+r.gs+(r.proc?' (base, rolls higher with better materials)':''):''}</div></div></div>
    <div class="tw"><table><tbody>
      <tr><td>Tradeskill</td><td><b>${esc(r.ts||'—')}</b>${r.lv?' level '+r.lv:''}</td></tr>
      <tr><td>Made at</td><td>${esc(r.st||'—')}</td></tr>
      ${r.cat?`<tr><td>Category</td><td>${esc(r.cat)}${r.grp?' &middot; '+esc(r.grp):''}</td></tr>`:''}
      ${r.fee?`<tr><td>Crafting fee</td><td>${r.fee} coin before town tax</td></tr>`:''}
      <tr><td>Recipe</td><td>${r.known?'Known by default':'Has to be learned (schematic, quest or event)'}${r.proc?' &middot; perks and gear score are rolled':''}</td></tr>
    </tbody></table></div>
    <div class="advhd" style="margin-top:6px"><span class="sh">Ingredients</span><label class="lof" style="flex-direction:row;align-items:center;gap:8px"><span>How many to craft</span><input type="number" id="crqty" class="pk" min="1" max="9999" value="${n}" style="width:90px"></label>
      <button class="mini" id="crexp">Expand all</button><button class="mini" id="crcol">Collapse</button></div>
    <div class="crtree">${r.i.map(([id,q],k)=>crTree(id,q*n,0,[r.o],r.id+':'+k)).join('')}</div>
    <div class="advhd" style="margin-top:10px"><span class="sh">Shopping list</span><select id="crraw" style="max-width:320px"><option value="raw" ${CQ.raw==='raw'?'selected':''}>Break refined materials down to what you gather</option><option value="direct" ${CQ.raw==='direct'?'selected':''}>Just the ingredients (buy refined materials)</option></select></div>
    <div class="crshop">${rawList.map(([id,q])=>`<div class="crrow">${crIcon(id,24)}<span class="crq">${q.toLocaleString()}&times;</span><span class="crn">${esc(crName(id))}</span>${(CR.where||{})[id]?`<div class="crw">&#128205; ${CR.where[id].map(esc).join('<br>&#128205; ')}</div>`:''}</div>`).join('')}</div>
    <div class="lbtns">${typeof favBtn==='function'?favBtn('recipe',r.id):''}<button class="mini" id="crcopy">&#128203; Copy shopping list</button><button class="mini" id="crlink">&#128279; Copy link to this recipe</button></div>
    ${others.length?`<div class="sh" style="margin-top:10px">Other ways to make it</div>${others.slice(0,6).map(x=>`<div class="crrow"><button class="mini tiny" data-crsel="${esc(x.id)}">Open</button> ${esc(x.n)} <span class="dimtx tiny">${esc(x.ts)} ${x.lv||''} &middot; ${esc(x.cat)}</span></div>`).join('')}`:''}
    ${used.length?`<div class="sh" style="margin-top:10px">Used to make</div>${used.map(x=>`<div class="crrow">${crIcon(x.o,22)}<a class="wl" data-crsel="${esc(x.id)}">${esc(x.n)}</a> <span class="dimtx tiny">${esc(x.ts)} ${x.lv||''}</span></div>`).join('')}`:''}
  </div>`;
}
function craftEvents(){
  if(!CR) return;
  const re=()=>openView('craft',false);
  const qi=document.getElementById('crq'); if(qi){ let t; qi.oninput=()=>{ clearTimeout(t); t=setTimeout(()=>{ CQ.q=qi.value; CQ.page=0; const pos=qi.selectionStart; re(); const n=document.getElementById('crq'); n.focus(); n.setSelectionRange(pos,pos); },250); }; }
  document.querySelectorAll('[data-crts]').forEach(b=>b.onclick=()=>{ CQ.ts=b.dataset.crts; CQ.cat=''; CQ.page=0; re(); });
  const c=document.getElementById('crcat'); if(c) c.onchange=()=>{ CQ.cat=c.value; CQ.page=0; re(); };
  const a=document.getElementById('crall'); if(a) a.onchange=()=>{ CQ.all=a.checked; CQ.page=0; re(); };
  document.querySelectorAll('[data-crpg]').forEach(b=>b.onclick=()=>{ CQ.page+= +b.dataset.crpg; re(); });
  document.querySelectorAll('[data-crsel]').forEach(b=>b.onclick=e=>{ e.preventDefault(); CQ.sel=b.dataset.crsel; CQ.open={}; LS.set('nw_craft_sel',CQ.sel); try{ history.replaceState(null,'','#craft='+encodeURIComponent(CQ.sel)); }catch(_){}
    re(); try{ history.replaceState(null,'','#craft='+encodeURIComponent(CQ.sel)); }catch(_){} const d=document.querySelector('.crright'); if(d&&window.innerWidth<900) d.scrollIntoView({behavior:'smooth'}); });
  document.querySelectorAll('[data-crtog]').forEach(b=>b.onclick=()=>{ const k=b.dataset.crtog; CQ.open[k]=!CQ.open[k]; re(); });
  const rw=document.getElementById('crraw'); if(rw) rw.onchange=()=>{ CQ.raw=rw.value; LS.set('nw_craft_raw',CQ.raw); re(); };
  const qty=document.getElementById('crqty'); if(qty) qty.onchange=()=>{ CQ.qty=Math.max(1,Math.min(9999,+qty.value||1)); re(); };
  const r=CQ.sel&&CR.byId[CQ.sel];
  const walk=(id,depth,path,key,set)=>{ let rr=(depth<6&&id[0]!=='$'&&!path.includes(id))?(id.startsWith('c:')?null:crRecipeFor(id)):null; if(rr&&crNoBreak(id,rr)) rr=null; if(rr||id.startsWith('c:')) set[key]=true; if(rr) rr.i.forEach(([iid],k)=>walk(iid,depth+1,path.concat(id),key+'/'+k,set)); };
  const ex=document.getElementById('crexp'); if(ex&&r) ex.onclick=()=>{ const s={}; r.i.forEach(([id],k)=>walk(id,0,[r.o],r.id+':'+k,s)); CQ.open=s; re(); };
  const co=document.getElementById('crcol'); if(co) co.onclick=()=>{ CQ.open={}; re(); };
  const cp=document.getElementById('crcopy'); if(cp&&r) cp.onclick=async()=>{ const raw={}; r.i.forEach(([id,q])=>crRaw(id,q*Math.max(1,CQ.qty|0),0,[r.o],raw));
    const txt=`${r.n} x${Math.max(1,CQ.qty|0)}\n`+Object.entries(raw).sort((a,b)=>b[1]-a[1]).map(([id,q])=>`- ${q} x ${crName(id)}`).join('\n');
    try{ await navigator.clipboard.writeText(txt); toast('Shopping list copied'); }catch(e){ toast('Copy failed'); } };
  const ln=document.getElementById('crlink'); if(ln&&r) ln.onclick=async()=>{ const u=(typeof shareBase==='function'?shareBase():location.href.split('#')[0])+'#craft='+encodeURIComponent(r.id);
    try{ await navigator.clipboard.writeText(u); toast('Link copied'); }catch(e){ toast(u); } };
}
// open the crafting tab on the recipe for an item name (Items tab, Loadout builder)
async function craftItemByName(name){
  name=String(name||'').trim(); if(!name) return;
  if(!CR){ toast('Loading recipes…'); await loadCrafting(); }
  if(!CR){ toast('Couldn\'t load the recipes'); return; }
  const lc=name.toLowerCase();
  const r=CR.recipes.find(x=>x.lc===lc&&!x.ev)||CR.recipes.find(x=>x.lc===lc)||CR.recipes.find(x=>crItem(x.o)[0].toLowerCase()===lc);
  if(!r){ toast(`There's no crafting recipe for ${name}. It has to drop.`); return; }
  CQ.sel=r.id; CQ.q=''; CQ.ts=''; CQ.cat=''; CQ.all=r.ev; CQ.open={}; CQ.page=0; LS.set('nw_craft_sel',r.id);
  openView('craft'); try{ history.replaceState(null,'','#craft='+encodeURIComponent(r.id)); }catch(e){}
}
// open the crafting tab searching for a word (Calculator weapon)
function craftSearch(q){ CQ.q=q; CQ.ts=''; CQ.cat=''; CQ.all=false; CQ.page=0; openView('craft'); }
const CRAFT_WORD={'Sword and Shield':'Longsword','Great Axe':'Great Axe','War Hammer':'War Hammer','Greatsword':'Greatsword','Rapier':'Rapier','Hatchet':'Hatchet','Spear':'Spear','Flail':'Flail',
  'Bow':'Bow','Musket':'Musket','Blunderbuss':'Blunderbuss','Fire Staff':'Fire Staff','Life Staff':'Life Staff','Ice Gauntlet':'Ice Gauntlet','Void Gauntlet':'Void Gauntlet'};

/* ================= weight (equip load) calculator ================= */
const WSLOTS=[['Head','Helmet'],['Chest','Chest'],['Hands','Gloves'],['Legs','Pants'],['Feet','Boots']];
const WT=Object.assign({Head:'Light',Chest:'Light',Hands:'Light',Legs:'Light',Feet:'Light',shield:'',countW:false,w1:'',w2:''}, LS.get('nw_weight',{}));
const saveWT=()=>LS.set('nw_weight',WT);
const wkg=n=>(Math.round(n*10)/10).toFixed(1);
function wTotal(st=WT){
  const W=CALC.weights; let t=0; const parts=[];
  WSLOTS.forEach(([k,l])=>{ const v=(W[k]||{})[st[k]]||0; t+=v; parts.push({l,v,c:st[k]}); });
  if(st.shield){ const v=(CALC.shields||{})[st.shield]||0; t+=v; parts.push({l:st.shield+' shield',v}); }
  if(st.countW) ['w1','w2'].forEach(k=>{ if(st[k]){ const v=(CALC.wweights||{})[st[k]]||0; t+=v; parts.push({l:st[k],v}); } });
  return {t:Math.round(t*10)/10, parts};
}
function wBand(t){ const E=CALC.equipLoad; return t>E.max?'Overburdened':t>=E.heavy?'Heavy':t>=E.medium?'Medium':'Light'; }
/* the heaviest armour mix (most armour) that still stays in a band, found by trying every combination */
function bestMix(band, extra){
  const E=CALC.equipLoad, W=CALC.weights, cls=['Light','Medium','Heavy'], lim=band==='Light'?E.medium:E.heavy;
  let best=null;
  for(let i=0;i<243;i++){ let n=i, st={}, t=extra;
    WSLOTS.forEach(([k])=>{ st[k]=cls[n%3]; n=Math.floor(n/3); t+=W[k][st[k]]; });
    if(t<lim-0.05 && (!best||t>best.t)) best={st,t};
  }
  return best;
}
function viewWeight(){
  if(!CALC||!CALC.weights||!CALC.equipLoad) return `<h1>Weight calculator</h1><p class="lede">This needs the new calc.json (run build-calc-data.py).</p>`;
  const E=CALC.equipLoad, W=CALC.weights, {t,parts}=wTotal(), band=wBand(t);
  const pct=x=>Math.min(100,x/E.max*100);
  const next=band==='Light'?E.medium:band==='Medium'?E.heavy:band==='Heavy'?E.max:null;
  const extra=(WT.shield?(CALC.shields[WT.shield]||0):0)+(WT.countW?['w1','w2'].reduce((s,k)=>s+(WT[k]?(CALC.wweights[WT[k]]||0):0),0):0);
  const preset=(id,label,st)=>st?`<button class="chip" data-wpre="${id}">${label} <span class="dimtx">${wkg(st.t)}</span></button>`:'';
  const bl=bestMix('Light',extra), bm=bestMix('Medium',extra);
  window.__WPRE={light:bl&&bl.st, medium:bm&&bm.st, heavy:{Head:'Heavy',Chest:'Heavy',Hands:'Heavy',Legs:'Heavy',Feet:'Heavy'}, allLight:{Head:'Light',Chest:'Light',Hands:'Light',Legs:'Light',Feet:'Light'}};
  const rows=[
    ['Damage', `+${E.dmg.Light}%${E.meleeLight?` (+${E.meleeLight}% more on melee hits)`:''}`, `${E.dmg.Medium}%`, `${E.dmg.Heavy}%`, 'game data'],
    ['Outgoing healing', `+${E.heal.Light}%`, `${E.heal.Medium}%`, `${E.heal.Heavy}%`, 'game data'],
    ['Critical damage you take', `−${E.critTaken.Light}%`, `−${E.critTaken.Medium}%`, `−${E.critTaken.Heavy}%`, 'game data'],
    ['Dodge', 'Long roll', 'Quick hop', 'Short sidestep', 'guides'],
    ['Armour rating', 'Lowest', 'Middle', 'Highest', 'from the pieces you wear'],
    ['Block stability', '−15%', '0', '+10% to +15%', 'guides'],
    ['Crowd control on you', 'Lasts longer', 'Normal', 'Lasts shorter', 'guides']];
  const col=b=>band===b?' class="on"':'';
  return `<h1>Weight calculator</h1>
  <p class="lede">Pick the armour weight for each slot and see which equip load you land in, how close you are to the next one, and what each load gives and costs. Weights come from your game's item data.</p>
  <div class="calcgrid">
    <section class="panel">
      <h2>Your gear</h2>
      ${WSLOTS.map(([k,l])=>`<div class="wrow"><span class="wl2">${l}</span>${['Light','Medium','Heavy'].map(c=>`<button class="chip ${WT[k]===c?'on':''}" data-wset="${k}" data-v="${c}">${c} <span class="wkg">${wkg(W[k][c])}</span></button>`).join('')}</div>`).join('')}
      <div class="wrow"><span class="wl2">Shield</span>${[['','None'],['Round','Round'],['Kite','Kite'],['Tower','Tower']].map(([v,n])=>`<button class="chip ${WT.shield===v?'on':''}" data-wset="shield" data-v="${v}">${n}${v?` <span class="wkg">${wkg(CALC.shields[v]||0)}</span>`:''}</button>`).join('')}</div>
      <label class="tog ${WT.countW?'on':''}"><input type="checkbox" data-wtog="countW" ${WT.countW?'checked':''}> <span>Count weapons too <i>Guides disagree on whether weapons count. Most say armour and shield only</i></span></label>
      ${WT.countW?`<div class="two">${['w1','w2'].map((k,i)=>`<label class="in"><span>Weapon ${i+1}</span><select data-wsel="${k}"><option value="">None</option>${Object.keys(CALC.wweights).sort().map(n=>`<option ${WT[k]===n?'selected':''} value="${esc(n)}">${esc(n)} (${wkg(CALC.wweights[n])})</option>`).join('')}</select></label>`).join('')}</div>`:''}
      <div class="presetbar"><b>Quick picks:</b>
        ${preset('light','Most armour, still light',bl)}${preset('medium','Most armour, still medium',bm)}
        <button class="chip" data-wpre="allLight">All light</button><button class="chip" data-wpre="heavy">All heavy</button>
        ${typeof G!=='undefined'?'<button class="chip" data-wpre="builder">From loadout builder</button>':''}</div>
    </section>
    <section class="panel">
      <h2>Equip load</h2>
      <div class="wtotal"><span class="wbig">${wkg(t)}</span><span class="wband b-${band.toLowerCase()}">${band}</span></div>
      <div class="wbar" role="img" aria-label="${wkg(t)} out of ${E.max}">
        <span class="seg l" style="width:${pct(E.medium)}%"></span><span class="seg m" style="width:${pct(E.heavy)-pct(E.medium)}%"></span><span class="seg h" style="width:${100-pct(E.heavy)}%"></span>
        <span class="mark" style="left:${pct(t)}%"></span></div>
      <div class="wscale"><span>0</span><span style="left:${pct(E.medium)}%">${E.medium}</span><span style="left:${pct(E.heavy)}%">${E.heavy}</span><span style="right:0">${E.max}</span></div>
      <p class="gain">${next!=null?`${wkg(next-t)} until ${band==='Light'?'medium':band==='Medium'?'heavy':'overburdened'}`:'Over the limit: drop some weight'}${band!=='Light'?(()=>{ const ov=t-(band==='Medium'?E.medium:band==='Heavy'?E.heavy:E.max); return ov<0.05?` &middot; exactly on the line, so 0.1 less would drop you to ${band==='Medium'?'light':'medium'}`:` &middot; ${wkg(ov)} over ${band==='Medium'?'light':band==='Heavy'?'medium':'the limit'}`; })():''}</p>
      <div class="tw"><table><tbody>${parts.map(p=>`<tr><td>${esc(p.l)}</td><td>${p.c?esc(p.c):''}</td><td class="r">${wkg(p.v)}</td></tr>`).join('')}<tr><td><b>Total</b></td><td></td><td class="r"><b>${wkg(t)}</b></td></tr></tbody></table></div>
      <p class="dimtx tiny">Light is under ${E.medium}, medium is ${E.medium} to under ${E.heavy}, heavy is ${E.heavy} to ${E.max}. Landing exactly on ${E.medium} or ${E.heavy} most likely counts as the heavier load, so stay 0.1 under to be safe.</p>
    </section>
  </div>
  <h2>What each load gives and costs</h2>
  <div class="tw wtable"><table><thead><tr><th>Effect</th><th${col('Light')}>Light</th><th${col('Medium')}>Medium</th><th${col('Heavy')}>Heavy</th><th>Source</th></tr></thead><tbody>
    ${rows.map(r=>`<tr><td>${r[0]}</td><td${col('Light')}>${r[1]}</td><td${col('Medium')}>${r[2]}</td><td${col('Heavy')}>${r[3]}</td><td class="small">${r[4]}</td></tr>`).join('')}
  </tbody></table></div>
  <div class="calcgrid">
    <section class="panel"><h2>Who picks which</h2>
      <div class="tw"><table><tbody>
        <tr><td><b>Light</b></td><td>Healers, ranged DPS, mages and melee assassins. Most damage and healing, best dodge, takes the most damage.</td></tr>
        <tr><td><b>Medium</b></td><td>Bruisers and PvP fighters who want toughness without losing the dodge hop. The baseline: no damage or healing change.</td></tr>
        <tr><td><b>Heavy</b></td><td>Tanks and war frontliners. Highest armour and the biggest crit-damage cut, for 15% less damage and 30% less healing.</td></tr>
      </tbody></table></div>
      <p class="tiny"><a class="wl" data-note="Gear Basics">Gear for each role &rarr;</a></p></section>
    <section class="panel"><h2>Good to know</h2>
      <div class="tw"><table><tbody>
        <tr><td>Weightless items</td><td>The Featherweight artifact (light chest) weighs nothing, so you can keep a light load with heavier pieces elsewhere.</td></tr>
        <tr><td>Most armour per load</td><td>Use the quick picks: they try every mix and keep the heaviest one that stays in the band, which means the most armour.</td></tr>
        <tr><td>Calculator</td><td>The damage and healing changes above aren't in the <a class="wl" data-view="calc">Calculator</a> yet. Add them under "Flat damage perks" if you want them counted.</td></tr>
      </tbody></table></div></section>
  </div>
  <div class="callout note"><span class="ci">&#8505;</span><div><p>Load limits, damage, healing and crit numbers come from your game data (<code>EncumbranceLimits</code> and the equip-load abilities). The item weights are the most common tier 5 weight for each slot in <code>MasterItemDefinitions</code>; a few named items weigh more. Dodge, block stability and crowd-control rows are from community guides, because the export doesn't hold those numbers.</p></div></div>`;
}
function weightEvents(){
  document.querySelectorAll('[data-wset]').forEach(b=>b.onclick=()=>{ WT[b.dataset.wset]=b.dataset.v; saveWT(); openView('weight',false); });
  document.querySelectorAll('[data-wtog]').forEach(c=>c.onchange=()=>{ WT[c.dataset.wtog]=c.checked; saveWT(); openView('weight',false); });
  document.querySelectorAll('[data-wsel]').forEach(s=>s.onchange=()=>{ WT[s.dataset.wsel]=s.value; saveWT(); openView('weight',false); });
  document.querySelectorAll('[data-wpre]').forEach(b=>b.onclick=()=>{
    const id=b.dataset.wpre;
    if(id==='builder'){ const map={Helmet:'Head',Chest:'Chest',Gloves:'Hands',Pants:'Legs',Boots:'Feet'};
      ARMOR_SLOTS.forEach(s=>{ const w=G.armor[s]&&G.armor[s].wt; if(map[s]&&w) WT[map[s]]=w; });
      WT.shield=G.w1==='Sword and Shield'?(WT.shield||'Kite'):''; WT.w1=G.w1||''; WT.w2=G.w2||''; toast('Took the armour weights from the loadout builder'); }
    else if(window.__WPRE&&window.__WPRE[id]) Object.assign(WT,window.__WPRE[id]);
    saveWT(); openView('weight',false);
  });
}

/* ================= trophy planner: up to 3 houses x 5 trophies ================= */
let TROPH=null, TROPHLOAD=null;
const TP=Object.assign({houses:3, slots:[['','','','',''],['','','','',''],['','','','','']]}, LS.get('nw_trophies',{}));
const saveTP=()=>LS.set('nw_trophies',TP);
async function loadTrophies(){
  if(TROPH||TROPHLOAD) return TROPHLOAD;
  TROPHLOAD=(async()=>{ try{ TROPH=await (await fetch('trophies.json')).json(); TROPH.byId={}; TROPH.trophies.forEach(t=>TROPH.byId[t.id]=t); }catch(e){ TROPH={err:String(e)}; }
    if(current&&current.kind==='view'&&current.v==='trophyplanner') openView('trophyplanner',false); })();
  return TROPHLOAD;
}
const tIco=(n,s=22)=>(typeof noteIcon==='function'?noteIcon(n,s):'');
function fmtFx(sum,kind){
  const lbl=(TROPH.kinds[kind]||[kind])[0];
  return Object.entries(sum).map(([u,v])=>{
    if(u==='size') return `${['','Small','Medium','Large'][Math.min(3,v.max)]||''} chance${v.n>1?` (${v.n} trophies)`:''}`;
    if(u==='%') return `+${v.t}%`;
    return `+${v.t.toLocaleString('en-GB')} ${u}`;
  }).join(', ');
}
function trophyState(){
  const houses=[]; const totals={}; let clashes=0;
  for(let h=0;h<TP.houses;h++){
    const seen={}; const slots=(TP.slots[h]||[]).map((id,i)=>{
      const t=id&&TROPH.byId[id]; if(!t) return {i,t:null};
      const clash=t.k.filter(k=>seen[k]!=null).map(k=>seen[k]);
      if(clash.length){ clashes++; return {i,t,clash:[...new Set(clash)]}; }
      t.k.forEach(k=>seen[k]=t.n);
      Object.entries(t.fx||{}).forEach(([k,[v,u]])=>{ const K=totals[k]=totals[k]||{}; const e=K[u]=K[u]||{t:0,max:0,n:0}; e.t+=v; e.max=Math.max(e.max,v); e.n++; });
      return {i,t};
    });
    houses.push(slots);
  }
  return {houses,totals,clashes};
}
function shopping(state){
  const raw={}, fees={g:0}, notCraft=[], lvl={max:0};
  const add=(t,mult)=>{
    if(!t.rec){ notCraft.push(t); return; }
    lvl.max=Math.max(lvl.max,t.rec.lvl); fees.g+=t.rec.fee*mult;
    t.rec.ings.forEach(([n,q])=>raw[n]=(raw[n]||0)+q*mult);
    (t.rec.prev||[]).forEach(id=>{ const p=TROPH.byId[id]; if(p) add(p,mult); });
  };
  state.houses.forEach(h=>h.forEach(s=>{ if(s.t&&!s.clash) add(s.t,1); }));
  return {raw,fees:fees.g,notCraft,lvl:lvl.max};
}
function viewTrophies(){
  if(!TROPH){ loadTrophies(); return `<h1>Trophy planner</h1><p class="lede">Loading trophies&hellip;</p>`; }
  if(TROPH.err) return `<h1>Trophy planner</h1><p class="lede">trophies.json did not load (${esc(TROPH.err)}). Run build-housing.py.</p>`;
  const st=trophyState(), sh=shopping(st);
  const groups={}; TROPH.trophies.forEach(t=>(groups[t.g]=groups[t.g]||[]).push(t));
  const opts=sel=>`<option value="">Empty</option>`+Object.entries(groups).map(([g,l])=>`<optgroup label="${esc(g)}">${l.map(t=>`<option value="${esc(t.id)}" ${t.id===sel?'selected':''}>${esc(t.n)}</option>`).join('')}</optgroup>`).join('');
  const house=(h,i)=>`<section class="panel thouse"><h2>House ${i+1}</h2>
    ${h.map(s=>`<div class="tslot ${s.clash?'clash':''}">${s.t?tIco(s.t.n,30):'<span class="iic none" style="width:30px;height:30px"></span>'}
      <div class="tsel"><select data-tslot="${i}:${s.i}" aria-label="House ${i+1}, trophy ${s.i+1}">${opts(s.t?s.t.id:'')}</select>
      <div class="teff">${s.t?(s.clash?`Won't count: this house already has ${esc(s.clash.join(', '))} for the same bonus`:esc(s.t.eff)):'&nbsp;'}</div></div></div>`).join('')}
    </section>`;
  const order=Object.keys(TROPH.kinds);
  const tot=order.filter(k=>st.totals[k]);
  const byCat={}; tot.forEach(k=>{ const c=TROPH.kinds[k][1]; (byCat[c]=byCat[c]||[]).push(k); });
  const rawRows=Object.entries(sh.raw).sort((a,b)=>b[1]-a[1]);
  return `<h1>Trophy planner</h1>
  <p class="lede">Put up to 5 trophies in each of your houses and see what they add up to, then get a shopping list for crafting them. Each house holds 5 trophies and only one of each kind counts per house, but the same kind in different houses stacks (so three Major Beast trophies in three houses give +15%).</p>
  <div class="presetbar"><b>Houses:</b>${[1,2,3].map(n=>`<button class="chip ${TP.houses===n?'on':''}" data-thouses="${n}">${n}</button>`).join('')}
    <b style="margin-left:10px">Quick fill:</b>
    <button class="chip" data-tpre="ultcombat">Ultimate combat in every house</button>
    <button class="chip" data-tpre="majorcombat">Major combat (Beast, Lost, Angry Earth, Corrupted, Ancient)</button>
    <button class="chip" data-tpre="crafter">Crafter</button><button class="chip" data-tpre="gatherer">Gatherer</button>
    <button class="chip" data-tpre="clear">Clear</button></div>
  <div class="thouses">${st.houses.map(house).join('')}</div>
  <div class="calcgrid">
    <section class="panel"><h2>What it adds up to</h2>
      ${tot.length?Object.entries(byCat).map(([c,ks])=>`<h3>${esc(c)}</h3><div class="tw"><table><tbody>${ks.map(k=>`<tr><td>${esc(TROPH.kinds[k][0])}</td><td class="r"><b>${fmtFx(st.totals[k],k)}</b></td></tr>`).join('')}</tbody></table></div>`).join(''):'<p class="dimtx">Pick some trophies to see the totals.</p>'}
      ${st.clashes?`<p class="gain" style="color:var(--red)">${st.clashes} trophy${st.clashes>1?' slots don\'t':' doesn\'t'} count because ${st.clashes>1?'they clash':'it clashes'} with another in the same house.</p>`:''}
    </section>
    <section class="panel"><h2>Shopping list</h2>
      ${rawRows.length?`<p class="dimtx tiny">Everything needed to craft these from scratch, including the lower tiers each upgrade uses up. Furnishing level needed: <b>${sh.lvl}</b>. Crafting fees: about <b>${Math.round(sh.fees).toLocaleString('en-GB')} gold</b> before town tax.</p>
      <div class="tw"><table><thead><tr><th>Material</th><th class="r">Amount</th><th>Where to get it</th></tr></thead><tbody>
        ${rawRows.map(([n,q])=>`<tr><td>${tIco(n)}${esc(n)}</td><td class="r">${q.toLocaleString('en-GB')}</td><td class="small">${esc((TROPH.src||{})[n]||'')}</td></tr>`).join('')}</tbody></table></div>`:'<p class="dimtx">Nothing to craft yet.</p>'}
      ${sh.notCraft.length?`<p class="dimtx tiny">Not craftable: ${sh.notCraft.map(t=>`${esc(t.n)} (${esc(t.how||'found')})`).join(', ')}.</p>`:''}
      <p class="tiny"><a class="wl" data-note="Trophies">Every trophy and its recipe &rarr;</a> &middot; <a class="wl" data-note="Housing">House tiers and costs &rarr;</a></p>
    </section>
  </div>`;
}
function trophyEvents(){
  const re=()=>{ saveTP(); openView('trophyplanner',false); };
  document.querySelectorAll('[data-tslot]').forEach(s=>s.onchange=()=>{ const [h,i]=s.dataset.tslot.split(':').map(Number); TP.slots[h][i]=s.value; re(); });
  document.querySelectorAll('[data-thouses]').forEach(b=>b.onclick=()=>{ TP.houses=+b.dataset.thouses; re(); });
  document.querySelectorAll('[data-tpre]').forEach(b=>b.onclick=()=>{
    const id=n=>(TROPH.trophies.find(t=>t.n===n)||{}).id||'';
    const fill=l=>{ for(let h=0;h<3;h++) TP.slots[h]=l.map(id).concat(['','','','','']).slice(0,5); };
    const p=b.dataset.tpre;
    if(p==='clear') fill([]);
    if(p==='ultcombat') fill(['Ultimate Combat Trophy','Major Loot Luck Trophy']);
    if(p==='majorcombat') fill(['Major Wildlife Combat Trophy','Major Lost Combat Trophy','Major Angry Earth Combat Trophy','Major Corrupted Combat Trophy','Major Ancients Combat Trophy']);
    if(p==='crafter') fill(['Major Arcana Crafting Trophy','Major Armoring Crafting Trophy','Major Weaponsmithing Crafting Trophy','Major Engineering Crafting Trophy','Major Cooking Crafting Trophy']);
    if(p==='gatherer') fill(['Major Mining Gathering Trophy','Major Harvesting Gathering Trophy','Major Logging Gathering Trophy','Major Skinning Gathering Trophy','Major Fishing Gathering Trophy']);
    re();
  });
}

/* ================= favourites: your own folders of items, recipes, builds and pages =================
   Needs a Discord login. Saved to your Discord account through the helper worker (/favs), with a copy in
   this browser ('nw_favs_u_<discord id>') so the page shows them straight away.
   FAV = { folders:[ {id, name, desc, icon, made, items:[ {t:'item'|'recipe'|'note', id, note, at} ]} ] }
   icon is 'ui:<key>' (vault icons in ui/), 'item:<item name>' or 'rcp:<recipe id>'. */
let FAV = {folders:[]}, FAVUID = null, FAVSTATE = 'out', FAVERR = '', FAVTIMER = null;
let FAVSEL = '', FAVTYPE = '';
const FAV_UI = ['builds','gear','items','calc','recipe','weight','trophy','buildbrowser','bosses','raids','pvp','war','outpost','craft','grind','refs','loadouts','tools','home','page','admin','mypages'];
const FAV_T = {item:'Item', gear:'Gear', abil:'Abilities', recipe:'Recipe', note:'Page'};
/* gear goes in slots, one thing per slot (two for weapons); recipes and pages can hold as many as you like */
const FAV_SLOTS = ['Weapon 1','Weapon 2','Shield','Helmet','Chest','Gloves','Pants','Boots','Amulet','Ring','Earring','Heartrune'];
const FAV_SECT = [
  ['Weapons', x=>['Weapon 1','Weapon 2','Shield'].includes(x.s), ['Weapon 1','Weapon 2','Shield']],
  ['Armour', x=>['Helmet','Chest','Gloves','Pants','Boots'].includes(x.s), ['Helmet','Chest','Gloves','Pants','Boots']],
  ['Jewellery and heart rune', x=>['Amulet','Ring','Earring','Heartrune'].includes(x.s), ['Amulet','Ring','Earring','Heartrune']],
  ['Abilities', x=>x.t==='abil'],
  ['Recipes', x=>x.t==='recipe'],
  ['Builds and pages', x=>x.t==='note'],
  ['Other items', x=>x.t==='item'&&!x.s]];
const favSlotName = s => s==='Heartrune' ? 'Heart rune' : s;
const favSame = (a,b) => a.t===b.t && a.id===b.id;
function favItemSlot(id){ const it=itemByName(id); if(!it) return ''; return it.s==='Weapon'?'Weapon':(FAV_SLOTS.includes(it.s)?it.s:''); }
/* a stand-in picture for "Crafted legendary" gear: the first real item of that weapon type or armour weight */
function favRepItem(e){
  if(typeof ITEMDB==='undefined'||!ITEMDB) return null;
  const s=e.s.startsWith('Weapon')?'Weapon':e.s;
  // the plain season 10 loot piece of that kind ("Hatchet", "Cloth Gloves", "Exemplary Ring") shows the basic picture
  const W={Light:'Light',Medium:'Medium',Heavy:'Heavy'}[e.wt];
  const plain=ITEMDB.items.find(i=>i.x>=0&&i.r==='Loot'&&/^Infix_/.test(i.i||'')&&i.s===s&&(s==='Weapon'?i.t===e.wt:(!W||i.w===W)));
  if(plain) return plain;
  return ITEMDB.items.find(i=>i.x>=0&&i.s===s&&(s==='Weapon'?i.t===e.wt:(!e.wt||!['Light','Medium','Heavy'].includes(e.wt)||i.w===e.wt)))||ITEMDB.items.find(i=>i.x>=0&&i.s===s)||null;
}
/* everything a build's Full loadout table holds, as favourites */
function favBuildEntries(name){
  const L=typeof parseLoadout==='function'?parseLoadout(name):null; if(!L) return [];
  const out=[];
  FAV_SLOTS.forEach(s=>{ const r=L.slots[s]; if(!r||!(r.item||r.type)) return;
    out.push({t:'gear', id:s+'|'+name, s, n:r.item, wt:r.type, gem:r.gem, p:(r.p||[]).filter(Boolean), ch:r.ch, from:name}); });
  (L.abil||[]).forEach(x=>{ if(x.a.length) out.push({t:'abil', id:'abil|'+x.w, s:'Abilities: '+x.w, w:x.w, a:x.a.slice(0,3), from:name}); });
  return out;
}
/* ---------- how to get a piece: craft it, or where it drops ---------- */
const FAV_CRAFT_W={'Fire Staff':'Procedural_StaffFire_Sockets','Life Staff':'Procedural_StaffLife_Sockets','Ice Gauntlet':'Procedural_GauntletIce_Sockets','Void Gauntlet':'Procedural_GauntletVoid_Sockets',
  'Flail':'Procedural_1hFlail_Sockets','Spear':'Procedural_Spear_Sockets','Hatchet':'Procedural_Hatchet_Sockets','Sword':'Procedural_Sockets_Longsword','Sword and Shield':'Procedural_Sockets_Longsword',
  'Rapier':'Procedural_Sockets_Rapier','War Hammer':'Procedural_Sockets_WarHammer','Great Axe':'Procedural_Sockets_2hGreatAxe','Greatsword':'Procedural_Sockets_2hGreatSword',
  'Bow':'Procedural_Bow_Sockets','Musket':'Procedural_Musket_Sockets','Blunderbuss':'Procedural_Blunderbuss_Sockets',
  'Round Shield':'Procedural_Sockets_ShieldRound','Kite Shield':'Procedural_Sockets_ShieldKite','Tower Shield':'Procedural_Sockets_ShieldTower'};
const FAV_WEIGHT={Light:'Cloth',Medium:'Leather',Heavy:'Plate'}, FAV_PART={Helmet:'Head',Chest:'Chest',Gloves:'Hands',Pants:'Legs',Boots:'Feet'};
const FAV_FROM={Faction:'Faction shop (spend faction tokens at an outpost)',Seasons:'Season rewards (season pass or journey)',PVP:'PvP reward track or PvP store',Quest:'Quest reward',
  Artifact:'Artifact: its own quest chain or a specific drop',Set:'Part of a gear set: drops in the content the set belongs to',ConquerorsItems:'Conqueror reward',
  Named:'World drop (the game data lists no single source)',Loot:'World drop (the game data lists no single source)',Common:'World drop or vendor'};
function favRecipeByName(n){ if(typeof CR==='undefined'||!CR||!n) return null; const lc=n.toLowerCase();
  return CR.recipes.find(x=>x.lc===lc&&!x.ev)||CR.recipes.find(x=>x.lc===lc)||CR.recipes.find(x=>crItem(x.o)[0].toLowerCase()===lc)||null; }
function favGenericRecipe(x){
  const s=x.s||''; let id='';
  if(s.startsWith('Weapon')||s==='Shield') id=FAV_CRAFT_W[x.wt]||(s==='Shield'?FAV_CRAFT_W['Kite Shield']:'');
  else if(FAV_PART[s]) id=`Procedural_${FAV_WEIGHT[x.wt]||'Plate'}${FAV_PART[s]}_Sockets`;
  else if(['Amulet','Ring','Earring'].includes(s)) id=`Procedural_${s}_Sockets`;
  return id;
}
function favSource(x){
  if(x.t!=='item'&&x.t!=='gear') return null;
  const nm = x.t==='item' ? x.id : x.n;
  const generic = x.t==='gear' && (!nm || /^crafted/i.test(nm));
  if(generic){ const id=favGenericRecipe(x); return id ? {craft:{id, label:'Crafted, top-tier recipe (gear score 730)'}, found:null} : null; }
  const it=itemByName(nm), r=favRecipeByName(nm);
  const src=(it&&it.src||[]).filter(s=>!/^craftable$/i.test(s));
  const craftable = !!r || (typeof CR!=='undefined'&&!CR && it && (it.r==='Crafting'||(it.src||[]).some(s=>/^craftable$/i.test(s))));
  const found = src.length ? src : (!craftable && it ? [FAV_FROM[it.r]||'Found in the world'] : []);
  return {craft: craftable?{id:r?r.id:'', name:nm, label:'Craftable'}:null, found: found.length?{list:found, it}:null, it};
}
function favGetHTML(x,k){
  const S=favSource(x); if(!S||(!S.craft&&!S.found)) return '';
  return `<div class="favget">
    ${S.craft?`<div class="favgetrow"><span class="favbadge craft">&#9874; ${esc(S.craft.label)}</span><button class="mini go" data-favcraft="${esc(k)}">Craft it</button></div>`:''}
    ${S.found?`<div class="favgetrow"><span class="favbadge found">&#128205; ${esc(S.found.list.slice(0,2).join(' · '))}${S.found.list.length>2?` +${S.found.list.length-2} more`:''}</span>${S.found.it?`<button class="mini" data-favfind="${esc(k)}">Where to find it</button>`:''}</div>`:''}</div>`;
}
/* item details: description, perks and every place it comes from */
function favItemPop(it){
  const S=favSource({t:'item', id:it.n}); const r=S&&S.craft;
  const all=(it.src||[]).filter(s=>!/^craftable$/i.test(s)); const where=all.length?all:(S&&S.found?S.found.list:[]);
  const m=favPop(it.n, `<div class="favwhat">${itemIcon(it,56)}<div><b>${esc(it.n)}</b> <span class="rb ${RARCLS[it.r]||''}">${esc(it.r)}</span>
      <div class="dimtx tiny">${esc([it.s,it.t,it.w,it.g?'GS '+it.g:'',it.e?'set: '+it.e:''].filter(Boolean).join(' · '))}</div></div></div>
    ${cleanPerks(it).length?`<div class="sh">Perks</div><div class="iperks">${cleanPerks(it).map(p=>`<span>${icoFor(p)?`<img class="ico" src="${icoFor(p)}" alt="">`:''}${esc(p)}</span>`).join('')}</div>`:''}
    ${it.d?`<p class="idesc">${esc(it.d)}</p>`:''}
    <div class="sh">Where to get it</div>
    <ul class="favwhere">${r?'<li>&#9874; <b>Craftable</b>'+(r.id&&CR.byId[r.id]?' &middot; '+esc(CR.byId[r.id].ts||'')+(CR.byId[r.id].lv?' '+CR.byId[r.id].lv:'')+' at '+esc(CR.byId[r.id].st||'a crafting station'):'')+'</li>':''}
      ${where.map(w=>`<li>&#128205; ${esc(w)}</li>`).join('')||(!r?'<li>No source listed in the game data</li>':'')}</ul>
    <div class="lbtns">${r?`<button class="mini go" data-pc="1">Craft it</button>`:''}<button class="mini" data-pi="1">Open in the item list</button></div>`);
  const c=m.querySelector('[data-pc]'); if(c) c.onclick=()=>{ favClose(); r.id?favOpenRecipe(r.id):craftItemByName(it.n); };
  m.querySelector('[data-pi]').onclick=()=>{ favClose(); IQ.q=it.n; IQ.slot=''; IQ.rar=''; IQ.wt=''; IQ.page=0; openView('items'); };
}
const favHasLoadout = n => !!(NAMES[n] && /\n## Full loadout/.test('\n'+META[NAMES[n]].body));

// pages pinned with the old Pin button move into a folder once
(function(){
  if(LS.get('nw_favs_mig',0)) return;
  const old = LS.get('nw_pins', []), pre = LS.get('nw_favs', null) || {folders:[]};
  if(old.length && !pre.folders.length)
    pre.folders.push({id:favId(), name:'Pinned pages', desc:'Pages you pinned before folders existed.', icon:'ui:page', made:Date.now(),
      items:old.map(n=>({t:'note', id:n, note:'', at:Date.now()}))});
  if(pre.folders.length) LS.set('nw_favs', pre); LS.set('nw_favs_mig', 1);
})();

function favId(){ return Math.random().toString(36).slice(2,9); }
/* ---------- your account ---------- */
const favUser = () => (typeof dUser==='function' && typeof CFG!=='undefined' && CFG.worker) ? dUser() : null;
async function favApi(body){
  const r = await fetch(CFG.worker+'/favs', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({pass:dPass(), ...body})});
  let d={}; try{ d=await r.json(); }catch(e){}
  if(r.status===401){ LS.del('nw_discord'); FAVUID=null; FAVSTATE='out'; if(typeof renderAcct==='function') renderAcct(); }
  if(!r.ok) throw Object.assign(new Error(d.error||('error '+r.status)), {status:r.status});
  return d;
}
function favEnsure(){
  const u = favUser();
  if(!u){ if(FAVSTATE!=='out'){ FAV={folders:[]}; FAVUID=null; FAVSTATE='out'; } return; }
  if(u.id===FAVUID) return;
  FAVUID = u.id; FAV = LS.get('nw_favs_u_'+u.id, null) || {folders:[]}; FAVSTATE = 'loading';
  favApi({op:'get'}).then(async d=>{
    if(FAVUID!==u.id) return;
    const pre = LS.get('nw_favs', null);   // favourites made in this browser before logging in
    FAV = d.data && Array.isArray(d.data.folders) ? {folders:d.data.folders} : FAV;
    if(pre && pre.folders && pre.folders.length){
      pre.folders.forEach(f=>{ const same=FAV.folders.find(x=>x.name.toLowerCase()===f.name.toLowerCase());
        if(!same) FAV.folders.push(f); else f.items.forEach(x=>{ if(!same.items.some(y=>y.t===x.t&&y.id===x.id)) same.items.push(x); }); });
      LS.del('nw_favs'); favSave(true); toast('Moved the favourites from this browser into your account');
    }
    LS.set('nw_favs_u_'+u.id, FAV); FAVSTATE='ready'; favRerender();
  }).catch(e=>{ if(FAVUID!==u.id) return; FAVSTATE = e.status===401 ? 'out' : 'error'; FAVERR = e.status===503 ? 'Favourites aren\'t switched on for this site yet.' : 'Couldn\'t load your favourites ('+e.message+').'; favRerender(); });
}
function favRerender(){ favRefreshButtons(); if(current&&current.kind==='view'&&current.v==='favs') openView('favs',false); }
function favSave(now){
  if(!FAVUID) return;
  LS.set('nw_favs_u_'+FAVUID, FAV);
  clearTimeout(FAVTIMER);
  const send=()=>favApi({op:'put', data:FAV}).catch(e=>toast('Couldn\'t save your favourites to Discord: '+e.message));
  if(now) send(); else FAVTIMER=setTimeout(send, 1500);   // a burst of changes goes up as one save
}
window.addEventListener('pagehide',()=>{ if(FAVTIMER&&FAVUID){ clearTimeout(FAVTIMER); FAVTIMER=null;
  try{ navigator.sendBeacon && navigator.sendBeacon(CFG.worker+'/favs', new Blob([JSON.stringify({pass:dPass(), op:'put', data:FAV})],{type:'text/plain'})); }catch(e){} } });
function favLoginBox(why){
  return `<div class="favlogin"><p>${why} Favourites are saved to your Discord account, so they follow you to any device. Only you can see them.</p>
    <a class="dbtn" href="${esc(loginHref())}" data-favlogin="1">Log in with Discord</a></div>`;
}
document.addEventListener('click', e=>{ if(e.target.closest('[data-favlogin]') && typeof rememberReturn==='function') rememberReturn(); }, true);
function favFolder(id){ return FAV.folders.find(f=>f.id===id); }
function favHas(t,id){ return FAV.folders.filter(f=>f.items.some(x=>x.t===t&&x.id===id)); }

/* ---------- what a favourite is ---------- */
function favLookup(x){
  if(x.t==='item'){ const it=itemByName(x.id); return it ? {name:it.n, icon:s=>itemIcon(it,s),
      meta:[it.s, it.t, it.g?'GS '+it.g:'', it.r].filter(Boolean).join(' · '), open:()=>{ IQ.q=it.n; IQ.slot=''; IQ.rar=''; IQ.wt=''; IQ.page=0; openView('items'); }}
    : {name:x.id, icon:s=>favIcon('ui:items',s), meta:'Item (not in this season\'s item list)', open:()=>{}}; }
  if(x.t==='gear'){ const real=x.n&&!/^crafted/i.test(x.n)?itemByName(x.n):null; const rep=real||favRepItem(x);
    const nm=real?real.n:(x.n&&!/^crafted/i.test(x.n)?x.n:`${x.n||'Crafted'} ${x.wt&&x.wt!=='–'?x.wt+' ':''}${x.s.startsWith('Weapon')?'':favSlotName(x.s).toLowerCase()}`.trim());
    return {name:nm, icon:s=>rep?itemIcon(rep,s):favIcon('ui:gear',s), meta:[favSlotName(x.s), x.wt].filter(Boolean).join(' · '),
      open:()=>{ if(real){ IQ.q=real.n; IQ.slot=''; IQ.rar=''; IQ.wt=''; IQ.page=0; openView('items'); } else if(x.from&&NAMES[x.from]) openNote(x.from); }}; }
  if(x.t==='abil') return {name:x.w+' abilities', icon:s=>{ const u=typeof icoFor==='function'&&x.a[0]?icoFor(x.a[0],x.w):''; return u?`<img class="fi" src="${u}" alt="" width="${s}" height="${s}">`:favIcon('ui:calc',s); },
      meta:x.a.join(' · '), open:()=>{ if(x.from&&NAMES[x.from]) openNote(x.from); }};
  if(x.t==='recipe'){
    if(typeof CR==='undefined'||!CR) return {name:x.label||x.id, icon:s=>`<span class="iic none" style="width:${s}px;height:${s}px"></span>`, meta:'Recipe', open:()=>favOpenRecipe(x.id), wait:true};
    const r=CR.byId[x.id]; return r ? {name:r.n, icon:s=>crIcon(r.o,s), meta:[r.ts&&(r.ts+(r.lv?' '+r.lv:'')), r.cat, r.gs?'GS '+r.gs:''].filter(Boolean).join(' · '), open:()=>favOpenRecipe(x.id)}
      : {name:x.label||x.id, icon:s=>favIcon('ui:recipe',s), meta:'Recipe (no longer in the game data)', open:()=>{}}; }
  const p=NAMES[x.id];
  return {name:label(x.id), icon:s=>(typeof noteIcon==='function'&&noteIcon(x.id,s))||favIcon(p&&/build/i.test(p)?'ui:builds':'ui:page',s),
    meta:p?sectionOf(p)+(META[p].folder.includes('/')?' › '+label(META[p].folder.split('/').slice(1).join(' / ')):''):'Page (not found)', open:()=>{ if(p) openNote(x.id); }};
}
function favOpenRecipe(id){ CQ.sel=id; LS.set('nw_craft_sel',id); openView('craft'); }
function favIcon(spec,size){
  const [k,...r]=String(spec||'ui:page').split(':'); const v=r.join(':');
  if(k==='item'){ const it=itemByName(v); if(it) return itemIcon(it,size); }
  if(k==='rcp' && typeof CR!=='undefined' && CR && CR.byId[v]) return crIcon(CR.byId[v].o,size);
  return `<img class="fi" src="ui/${esc(FAV_UI.includes(v)?v:'page')}.webp" alt="" width="${size}" height="${size}">`;
}
const favDefaultIcon = (t,id) => t==='item' ? 'item:'+id : t==='recipe' ? 'rcp:'+id : 'ui:page';

/* ---------- the button on items, recipes, build cards and pages ---------- */
function favBtn(t,id,cls){
  favEnsure();
  const on=favHas(t,id).length;
  if(cls==='card') return `<button class="peekbtn favc ${on?'on':''}" data-fav="${t}" data-id="${esc(id)}" title="${on?'In your favourites':'Add to favourites'}" aria-label="${on?'In your favourites':'Add to favourites'}">${on?'&#9733;':'&#9734;'}</button>`;
  return `<button class="${cls||'mini'} favb ${on?'on':''}" data-fav="${t}" data-id="${esc(id)}">${on?'&#9733; Saved':'&#9734; Favourite'}</button>`;
}
function favRefreshButtons(){
  document.querySelectorAll('[data-fav]').forEach(b=>{ const on=favHas(b.dataset.fav,b.dataset.id).length; b.classList.toggle('on',!!on);
    if(b.classList.contains('favc')){ b.innerHTML=on?'&#9733;':'&#9734;'; b.title=on?'In your favourites':'Add to favourites'; b.setAttribute('aria-label',b.title); }
    else b.innerHTML=on?'&#9733; Saved':'&#9734; Favourite'; });
  renderPinMenu();
}
document.addEventListener('click', e=>{
  const b=e.target.closest('[data-fav]'); if(!b) return;
  e.preventDefault(); e.stopPropagation(); favEnsure();
  if(FAVSTATE==='out'){ favPop('Favourites need a Discord login', favLoginBox('Log in with Discord to save this to a folder.')); return; }
  if(FAVSTATE==='error'){ toast(FAVERR); return; }
  favPick(b.dataset.fav, b.dataset.id, b.dataset.label||'');
}, true);

/* ---------- pop-up: choose folders, or make a new one ---------- */
function favClose(){ const m=document.getElementById('favpop'); if(m) m.remove(); document.removeEventListener('keydown',favKey); favRefreshButtons(); if(current&&current.kind==='view'&&current.v==='favs') openView('favs',false); }
function favKey(e){ if(e.key==='Escape') favClose(); }
function favPop(title, inner){
  const old=document.getElementById('favpop'); if(old) old.remove();
  const m=document.createElement('div'); m.id='favpop'; m.className='peekbg';
  m.innerHTML=`<div class="peekbox favbox" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="peekhead"><b>${esc(title)}</b><button class="peekx" aria-label="Close">&times;</button></div><div class="favin">${inner}</div></div>`;
  document.body.appendChild(m); document.addEventListener('keydown',favKey);
  m.onclick=e=>{ if(e.target===m||e.target.closest('.peekx')) favClose(); };
  return m;
}
/* add entries to a folder; anything that would take an occupied slot asks first */
function favAdd(f, entries, done){
  const add=[], ask=[];
  for(const e0 of entries){ const e={...e0, note:e0.note||'', at:Date.now()};
    if(f.items.some(y=>favSame(y,e))) continue;
    if(e.s==='Weapon'){   // a weapon from the item list: the first free weapon slot, or ask which to swap
      const w1=f.items.find(y=>y.s==='Weapon 1'), w2=f.items.find(y=>y.s==='Weapon 2');
      if(!w1){ e.s='Weapon 1'; add.push(e); } else if(!w2){ e.s='Weapon 2'; add.push(e); } else ask.push({e, opts:[w1,w2]});
      continue; }
    const old=e.s?f.items.find(y=>y.s===e.s&&!favSame(y,e)):null;
    old ? ask.push({e, opts:[old]}) : add.push(e);
  }
  const apply=(swaps)=>{ add.forEach(e=>f.items.push(e));
    swaps.forEach(({e,old})=>{ if(old){ e.s=old.s; f.items=f.items.filter(y=>y!==old); f.items.push(e); } });
    favSave(); done(add.length+swaps.filter(x=>x.old).length); };
  if(!ask.length) return apply([]);
  const box=document.querySelector('#favpop .favin');
  box.innerHTML=`<div class="favask"><div class="sh">“${esc(f.name)}” already has ${ask.length===1?'something in this slot':'things in these slots'}</div>
    <p class="dimtx tiny">Tick what to replace with the new pick. Anything left unticked stays as it is.${add.length?` ${add.length} other thing${add.length===1?'':'s'} will be added either way.`:''}</p>
    ${ask.map((q,i)=>{ const N=favLookup(q.e);
      return `<div class="favswap"><div class="favswapnew">${N.icon(36)}<div><b>${esc(N.name)}</b><div class="dimtx tiny">New${q.e.from?' · from '+esc(q.e.from):''}</div></div></div>
        ${q.opts.map((o,k)=>{ const O=favLookup(o); return `<label class="favswapold"><input type="${q.opts.length>1?'radio':'checkbox'}" name="fsw${i}" data-sw="${i}" data-k="${k}" ${k===0?'checked':''}>
          <span class="favslot">${esc(favSlotName(o.s||''))}</span>${O.icon(28)}<span>Replace <b>${esc(O.name)}</b></span></label>`; }).join('')}
        ${q.opts.length>1?`<label class="favswapold"><input type="radio" name="fsw${i}" data-sw="${i}" data-k="-1"><span>Keep both weapons, skip this one</span></label>`:''}</div>`; }).join('')}
    <div class="lbtns"><button class="mini go" data-swgo>Save</button><button class="mini" data-swno>Cancel</button></div></div>`;
  box.querySelector('[data-swgo]').onclick=()=>{
    const swaps=ask.map((q,i)=>{ const c=box.querySelector(`[data-sw="${i}"]:checked`); const k=c?+c.dataset.k:-1; return {e:q.e, old:k>=0?q.opts[k]:null}; });
    apply(swaps); };
  box.querySelector('[data-swno]').onclick=()=>{ done(-1); };
}
function favPick(t,id){
  if(t==='recipe' && typeof CR!=='undefined' && !CR && typeof loadCrafting==='function') loadCrafting();
  const L=favLookup({t,id}); const isBuild=t==='note'&&favHasLoadout(id);
  const main=()=>({t, id, s:t==='item'?favItemSlot(id):''});
  let withGear=isBuild;
  const entries=()=>[main(), ...(withGear?favBuildEntries(id):[])];
  const list=()=>FAV.folders.map(f=>{ const has=f.items.some(x=>x.t===t&&x.id===id);
    return `<label class="favrow ${has?'on':''}"><input type="checkbox" data-ff="${f.id}" ${has?'checked':''}>${favIcon(f.icon,30)}<span><b>${esc(f.name)}</b><small>${f.items.length} saved</small></span></label>`; }).join('');
  const slot=t==='item'?favItemSlot(id):'';
  const body=()=>`
    <div class="favwhat">${L.icon(40)}<div><b>${esc(L.name)}</b><div class="dimtx tiny">${esc(FAV_T[t])}${slot?' · '+esc(slot==='Weapon'?'weapon slot':favSlotName(slot)+' slot'):''}${L.meta?' · '+esc(L.meta):''}</div></div></div>
    ${isBuild?`<label class="favopt"><input type="checkbox" id="favgear" ${withGear?'checked':''}> Also add the build's weapons, armour, jewellery and abilities, each in its own slot</label>`:''}
    ${slot?`<p class="dimtx tiny favrule">Each folder holds one ${slot==='Weapon'?'pair of weapons':favSlotName(slot).toLowerCase()}. If the folder already has one, you'll be asked whether to replace it.</p>`:''}
    <div class="favlist">${list()||'<p class="dimtx">You have no folders yet. Make your first one below.</p>'}</div>
    <div class="favnew"><div class="sh">New folder</div>${favForm({name:'',desc:'',icon:favDefaultIcon(t,id)},'Create folder and add')}</div>`;
  const m=favPop('Add to favourites', body());
  const wire=()=>{
    const g=m.querySelector('#favgear'); if(g) g.onchange=()=>{ withGear=g.checked; };
    m.querySelectorAll('[data-ff]').forEach(cb=>cb.onchange=()=>{
      const f=favFolder(cb.dataset.ff); if(!f) return;
      if(cb.checked){
        favAdd(f, entries(), n=>{ if(n<0){ m.querySelector('.favin').innerHTML=body(); wire(); return; }
          toast(n?`Added to ${f.name}`:`Already in ${f.name}`); m.querySelector('.favin').innerHTML=body(); wire(); });
      } else {
        f.items=f.items.filter(x=>!(x.t===t&&x.id===id) && !(isBuild&&x.from===id));
        favSave(); toast(isBuild?`Removed the build and its gear from ${f.name}`:`Removed from ${f.name}`);
        m.querySelector('.favin').innerHTML=body(); wire();
      } });
    favFormEvents(m, v=>{
      const f={id:favId(), name:v.name, desc:v.desc, icon:v.icon, made:Date.now(), items:[]};
      FAV.folders.push(f); favAdd(f, entries(), ()=>{ toast(`Made “${f.name}” and added ${L.name}`); favClose(); });
    });
  };
  wire();
}

/* folder form: name, description, icon picker */
function favForm(f, go){
  return `<div class="favform" data-icon="${esc(f.icon)}">
    <div class="favfrow"><button type="button" class="favicobtn" title="Choose an icon">${favIcon(f.icon,44)}<span>Icon</span></button>
      <div class="favfields"><input class="pk" data-fn maxlength="40" placeholder="Folder name, e.g. Healer" value="${esc(f.name)}">
      <textarea class="pk" data-fd maxlength="300" rows="2" placeholder="What it's for (optional), e.g. Life Staff gear and potions for raids">${esc(f.desc)}</textarea></div></div>
    <div class="favpick" hidden><input class="pk" data-fq placeholder="Search item and recipe icons, e.g. life staff, health potion" autocomplete="off"><div class="favgrid"></div></div>
    <div class="lbtns"><button class="mini go" data-fgo>${go}</button></div></div>`;
}
function favIconChoices(q){
  q=q.trim().toLowerCase(); const out=[];
  if(!q){ FAV_UI.forEach(k=>out.push(['ui:'+k,k])); }
  else {
    if(typeof ITEMDB!=='undefined'&&ITEMDB) for(const it of ITEMDB.items){ if(it.x>=0&&it.n.toLowerCase().includes(q)){ out.push(['item:'+it.n,it.n]); if(out.length>=36) break; } }
    if(typeof CR!=='undefined'&&CR){ const seen=new Set(); for(const r of CR.recipes){ if(out.length>=60) break; if(r.n.toLowerCase().includes(q)&&!seen.has(r.o)&&crItem(r.o)[2]>=0){ seen.add(r.o); out.push(['rcp:'+r.id,r.n]); } } }
  }
  return out;
}
function favFormEvents(root, done){
  const form=root.querySelector('.favform'), pick=form.querySelector('.favpick'), grid=form.querySelector('.favgrid'), fq=form.querySelector('[data-fq]');
  const draw=()=>{ const ch=favIconChoices(fq.value); grid.innerHTML=ch.map(([s,n])=>`<button type="button" class="favgi ${form.dataset.icon===s?'on':''}" data-fi="${esc(s)}" title="${esc(n)}">${favIcon(s,40)}</button>`).join('')||'<p class="dimtx tiny">No icons match that.</p>'; };
  form.querySelector('.favicobtn').onclick=()=>{ pick.hidden=!pick.hidden; if(!pick.hidden){ if(typeof CR!=='undefined'&&!CR&&typeof loadCrafting==='function') loadCrafting().then(draw); draw(); fq.focus(); } };
  let tm; fq.oninput=()=>{ clearTimeout(tm); tm=setTimeout(draw,120); };
  grid.onclick=e=>{ const b=e.target.closest('[data-fi]'); if(!b) return; form.dataset.icon=b.dataset.fi; form.querySelector('.favicobtn').innerHTML=favIcon(b.dataset.fi,44)+'<span>Icon</span>'; grid.querySelectorAll('.favgi').forEach(x=>x.classList.toggle('on',x===b)); };
  form.querySelector('[data-fgo]').onclick=()=>{
    const name=form.querySelector('[data-fn]').value.trim(); if(!name){ form.querySelector('[data-fn]').focus(); return toast('Give the folder a name'); }
    done({name, desc:form.querySelector('[data-fd]').value.trim(), icon:form.dataset.icon});
  };
}

/* ---------- the Favourites tab menu ---------- */
function favMenu(){
  favEnsure();
  if(FAVSTATE==='out') return `<div class="mn">Favourites need a Discord login. Log in to make folders of items, recipes, builds and pages.</div><a class="mi hi" href="${esc(loginHref())}" data-favlogin="1">${ui('loadouts')}Log in with Discord</a>`;
  if(FAVSTATE==='error') return `<div class="mn">${esc(FAVERR)}</div>`;
  const fs=FAV.folders;
  return (fs.length ? fs.map(f=>`<a class="mi favmi" data-favopen="${f.id}">${favIcon(f.icon,22)}<span>${esc(f.name)}</span><span class="cnt">${f.items.length}</span></a>`).join('')
                    : `<div class="mn">Press &#9734; Favourite on an item, recipe, build or page to start a folder.</div>`)
    + `<a class="mi hi" data-view="favs">${ui('loadouts')}All folders</a>`;
}
function renderPinMenu(){
  if(typeof favMenu!=='function') return;
  const m=document.getElementById('favmenu'); if(m) m.innerHTML=favMenu();
  const c=document.getElementById('favcount'); if(c){ const n=FAV.folders.reduce((a,f)=>a+f.items.length,0); c.textContent=n?n:''; }
}
document.addEventListener('click', e=>{
  if(e.target.closest('[data-view="favs"]')) FAVSEL='';   // "All folders" in the menu
  const o=e.target.closest('[data-favopen]'); if(!o) return;
  e.preventDefault(); e.stopPropagation(); document.querySelectorAll('.drop').forEach(x=>x.classList.remove('open'));
  FAVSEL=o.dataset.favopen; FAVTYPE=''; openView('favs');
}, true);

/* ---------- the Favourites page ---------- */
function viewFavs(){
  favEnsure();
  if(FAVSTATE==='out') return `<div id="favview"><h1>Favourites</h1><p class="lede">Make your own folders of items, recipes, builds and pages, each with a name, a description and an icon you choose.</p>${favLoginBox('You need to be logged in with Discord to use favourites.')}</div>`;
  if(FAVSTATE==='error') return `<div id="favview"><h1>Favourites</h1><p class="bad">${esc(FAVERR)}</p></div>`;
  if(FAVSTATE==='loading' && !FAV.folders.length) return `<div id="favview"><h1>Favourites</h1><p class="dimtx">Loading your favourites&hellip;</p></div>`;
  const f=FAVSEL&&favFolder(FAVSEL);
  if(!f){ FAVSEL='';
    return `<div id="favview"><h1>Favourites</h1>
    <p class="lede">Your own folders of items, recipes, builds and pages. They're saved to your Discord account${favUser()?' ('+esc(favUser().name)+')':''}, so they follow you to any device, and only you can see them.</p>
    <div class="lbtns"><button class="mini go" id="favnew">&#65291; New folder</button></div>
    <div id="favnewbox" hidden class="slot lcard favnewbox">${favForm({name:'',desc:'',icon:'ui:builds'},'Create folder')}</div>
    <div class="count">${FAV.folders.length} folder${FAV.folders.length===1?'':'s'}</div>
    <div class="cards">${FAV.folders.map(f=>`<div class="card favcard" data-favopen="${f.id}">
        <div class="favch">${favIcon(f.icon,48)}<div><div class="ct">${esc(f.name)}</div><div class="dimtx tiny">${f.items.length} saved</div></div></div>
        ${f.desc?`<div class="cs">${esc(f.desc)}</div>`:''}
        <div class="favstrip">${f.items.slice(0,8).map(x=>favLookup(x).icon(26)).join('')}</div></div>`).join('')
      ||'<p class="empty">No folders yet. Make one here, or press &#9734; Favourite on an item, recipe, build card or page.</p>'}</div>
    <div class="favfoot"><button class="mini" id="favwipe">Delete all my favourites</button><span class="dimtx tiny">Removes every folder from your Discord account. <a href="privacy.html">Privacy Policy</a></span></div></div>`;
  }
  if(f.items.some(x=>['recipe','item','gear'].includes(x.t)) && typeof CR!=='undefined' && !CR && typeof loadCrafting==='function') loadCrafting().then(()=>{ if(current&&current.v==='favs') openView('favs',false); });
  const others=FAV.folders.filter(o=>o.id!==f.id);
  const card=x=>{ const L=favLookup(x), k=x.t+'|'+x.id;
    const extra = x.t==='gear' ? `${x.gem||x.p.length?`<div class="iperks">${[x.gem,...x.p].filter(Boolean).map(p=>`<span>${typeof icoFor==='function'&&icoFor(p)?`<img class="ico" src="${icoFor(p)}" alt="">`:''}${esc(p)}</span>`).join('')}</div>`:''}${x.ch?`<div class="dimtx tiny">Charm: ${esc(x.ch)}</div>`:''}`
      : x.t==='abil' ? `<div class="iperks">${x.a.map(a=>`<span>${typeof icoFor==='function'&&icoFor(a,x.w)?`<img class="ico" src="${icoFor(a,x.w)}" alt="">`:''}${esc(a)}</span>`).join('')}</div>` : '';
    return `<div class="card favitem" data-favgo="${esc(k)}">
      <div class="favch">${L.icon(44)}<div>${x.s&&x.t!=='abil'?`<span class="favslot">${esc(favSlotName(x.s))}</span>`:''}<div class="ct">${esc(L.name)}</div><div class="dimtx tiny">${esc(x.t==='gear'||x.t==='abil'?(x.from?'From '+x.from:FAV_T[x.t]):FAV_T[x.t]+(L.meta?' · '+L.meta:''))}</div></div></div>
      ${extra}
      ${favGetHTML(x,k)}
      ${x.note?`<div class="cs favnote">${esc(x.note)}</div>`:''}
      <div class="favact">
        <button class="mini" data-favnote="${esc(k)}">&#9998; ${x.note?'Edit note':'Add a note'}</button>
        ${others.length?`<select class="mini" data-favmove="${esc(k)}" aria-label="Move to another folder"><option value="">Move to&hellip;</option>${others.map(o=>`<option value="${o.id}">${esc(o.name)}</option>`).join('')}</select>`:''}
        <button class="mini" data-favrm="${esc(k)}">Remove</button></div></div>`; };
  const secs=FAV_SECT.map(([h,test,slots])=>{ const l=f.items.filter(test); if(!l.length) return '';
    if(slots) l.sort((a,b)=>slots.indexOf(a.s)-slots.indexOf(b.s));
    const empty=slots?slots.filter(s=>!l.some(x=>x.s===s)&&s!=='Shield'&&s!=='Heartrune'):[];
    return `<section class="favsec"><h2>${esc(h)} <span class="seccnt">${l.length}</span></h2><div class="cards">${l.map(card).join('')}
      ${empty.map(s=>`<div class="card favempty"><span class="favslot">${esc(favSlotName(s))}</span><span class="dimtx tiny">Empty. Favourite ${/^[AEIOU]/.test(s)?'an':'a'} ${esc(s.startsWith('Weapon')?'weapon':favSlotName(s).toLowerCase())} to fill it.</span></div>`).join('')}</div></section>`; }).join('');
  return `<div id="favview"><div class="crumb"><a href="#" class="wl" data-favall="1">&larr; All folders</a></div>
  <div class="favhead">${favIcon(f.icon,64)}<div><h1>${esc(f.name)}</h1>${f.desc?`<p class="lede">${esc(f.desc)}</p>`:''}</div>
    <div class="lbtns"><button class="mini" id="favedit">&#9998; Edit folder</button><button class="mini" id="favdel">Delete folder</button></div></div>
  <div id="faveditbox" hidden class="slot lcard favnewbox">${favForm(f,'Save changes')}</div>
  ${secs||`<p class="empty">Nothing here yet. Press &#9734; Favourite on an item, recipe, build card or page and tick “${esc(f.name)}”.</p>`}</div>`;
}
function favsEvents(){
  const main=document.getElementById('favview'); if(!main) return;
  const nb=document.getElementById('favnew');
  if(nb){ const box=document.getElementById('favnewbox'); nb.onclick=()=>{ box.hidden=!box.hidden; if(!box.hidden) box.querySelector('[data-fn]').focus(); };
    favFormEvents(box, v=>{ const f={id:favId(), ...v, made:Date.now(), items:[]}; FAV.folders.push(f); favSave(); renderPinMenu(); FAVSEL=f.id; openView('favs',false); toast(`Made “${f.name}”`); }); }
  const wipe=document.getElementById('favwipe');
  if(wipe) wipe.onclick=async()=>{ if(!wipe.dataset.sure){ wipe.dataset.sure=1; wipe.classList.add('danger'); wipe.textContent='Click again to delete all '+FAV.folders.length+' folders for good'; return; }
    wipe.disabled=true; clearTimeout(FAVTIMER);
    try{ await favApi({op:'del'}); FAV={folders:[]}; LS.set('nw_favs_u_'+FAVUID, FAV); LS.del('nw_favs'); renderPinMenu(); openView('favs',false); toast('All your favourites are deleted'); }
    catch(e){ wipe.disabled=false; toast('Couldn\'t delete them: '+e.message); } };
  const f=FAVSEL&&favFolder(FAVSEL); if(!f) return;
  const find=k=>f.items.find(x=>x.t+'|'+x.id===k);
  const eb=document.getElementById('faveditbox');
  document.getElementById('favedit').onclick=()=>{ eb.hidden=!eb.hidden; };
  favFormEvents(eb, v=>{ Object.assign(f,v); favSave(); renderPinMenu(); openView('favs',false); toast('Folder saved'); });
  const del=document.getElementById('favdel');
  del.onclick=()=>{ if(del.dataset.sure){ FAV.folders=FAV.folders.filter(x=>x!==f); favSave(); renderPinMenu(); FAVSEL=''; openView('favs',false); toast(`Deleted “${f.name}”`); return; }
    del.dataset.sure=1; del.textContent=`Delete “${f.name}” and its ${f.items.length} favourites?`; del.classList.add('danger'); };
  main.onclick=e=>{
    const al=e.target.closest('[data-favall]'); if(al){ e.preventDefault(); e.stopPropagation(); FAVSEL=''; openView('favs',false); return; }
    const rm=e.target.closest('[data-favrm]'); if(rm){ e.stopPropagation(); const x=find(rm.dataset.favrm); f.items=f.items.filter(y=>y!==x); favSave(); renderPinMenu(); openView('favs',false); toast('Removed'); return; }
    const cf=e.target.closest('[data-favcraft]'); if(cf){ e.stopPropagation(); const x=find(cf.dataset.favcraft); const S=x&&favSource(x); if(!S||!S.craft) return;
      if(S.craft.id && CR && CR.byId[S.craft.id]) favOpenRecipe(S.craft.id); else craftItemByName(S.craft.name||''); return; }
    const fd=e.target.closest('[data-favfind]'); if(fd){ e.stopPropagation(); const x=find(fd.dataset.favfind); const S=x&&favSource(x); if(S&&S.it) favItemPop(S.it); return; }
    const nt=e.target.closest('[data-favnote]'); if(nt){ e.stopPropagation(); const x=find(nt.dataset.favnote); const card=nt.closest('.card');
      if(card.querySelector('.favnoteed')) return;
      card.querySelector('.favact').insertAdjacentHTML('beforebegin',`<div class="favnoteed"><textarea class="pk" rows="3" maxlength="400" placeholder="Why it's here, e.g. craft with Refreshing + Sacred">${esc(x.note||'')}</textarea><div class="lbtns"><button class="mini go">Save note</button></div></div>`);
      const ed=card.querySelector('.favnoteed'); ed.onclick=ev=>ev.stopPropagation(); ed.querySelector('textarea').focus();
      ed.querySelector('button').onclick=()=>{ x.note=ed.querySelector('textarea').value.trim(); favSave(); openView('favs',false); };
      return; }
    if(e.target.closest('select,textarea,input,.favnoteed')) { e.stopPropagation(); return; }
    const go=e.target.closest('[data-favgo]'); if(go){ const x=find(go.dataset.favgo); if(x) favLookup(x).open(); }
  };
  main.querySelectorAll('[data-favmove]').forEach(s=>s.onchange=()=>{
    const x=find(s.dataset.favmove), to=favFolder(s.value); if(!x||!to) return;
    const go=()=>{ favPop('Move to '+to.name,'<p class="dimtx">Checking the folder&hellip;</p>');
      favAdd(to, [{...x, s:x.t==='item'&&x.s&&x.s.startsWith('Weapon')?'Weapon':x.s}], n=>{ if(n>=0){ f.items=f.items.filter(y=>y!==x); favSave(); toast(`Moved to ${to.name}`); } favClose(); renderPinMenu(); openView('favs',false); }); };
    go(); });
}

/* ================= ideas and problem reports =================
   Anyone logged in with Discord can send one. The helper (/feedback) posts it to a Discord channel webhook
   and keeps it for the owner, who sees and sorts them on the Admin page. */
let FB = {kind:'idea', page:'', sent:false};
let FBLIST = null, FBERR = '', FBFILT = {kind:'', status:'open'};
const FB_STATUS = {new:'New', planned:'Planned', done:'Done', closed:'Closed'};

async function fbApi(body){
  const r = await fetch(CFG.worker+'/feedback', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({pass:dPass(), ...body})});
  let d={}; try{ d=await r.json(); }catch(e){}
  if(r.status===401){ LS.del('nw_discord'); if(typeof renderAcct==='function') renderAcct(); }
  if(!r.ok) throw new Error(d.error||('error '+r.status));
  return d;
}
/* open the form, remembering which page you came from */
function openFeedback(kind){
  FB.kind = kind==='problem' ? 'problem' : 'idea'; FB.sent = false;
  FB.page = current && current.kind==='note' ? location.href.split('?')[0] : (current && current.kind==='view' && current.v!=='feedback' ? location.href.split('?')[0] : FB.page);
  document.querySelectorAll('.drop').forEach(x=>x.classList.remove('open'));
  openView('feedback');
}
document.addEventListener('click', e=>{
  const b=e.target.closest('[data-fbopen]'); if(!b) return;
  e.preventDefault(); e.stopPropagation(); openFeedback(b.dataset.fbopen);
}, true);

function viewFeedback(){
  const u = typeof dUser==='function' && CFG.worker ? dUser() : null;
  const head = `<h1>Ideas and problems</h1>
    <p class="lede">Got an idea for the vault, or spotted something wrong? Send it here and it goes straight to the site owner.</p>`;
  if(!CFG.worker) return head+`<p class="bad">Sending isn't set up on this copy of the site.</p>`;
  if(!u) return head+`<div class="favlogin"><p>You need to be logged in with Discord to send ideas and reports. It shows the owner who sent it, so they can reply, and it keeps spam out.</p>
    <a class="dbtn" href="${esc(loginHref())}" data-fblogin="1">Log in with Discord</a></div>`;
  if(FB.sent) return head+`<div class="slot lcard fbdone"><h2>Thanks, ${esc(u.name)}!</h2><p>Your ${FB.kind==='problem'?'report':'idea'} has been sent to the site owner.</p>
    <div class="lbtns"><button class="mini go" data-fbopen="idea">Send another idea</button><button class="mini" data-fbopen="problem">Report a problem</button></div></div>`;
  return head+`<div class="slot lcard fbform">
    <div class="fbkinds" role="radiogroup" aria-label="What are you sending?">
      <button class="fbkind ${FB.kind==='idea'?'on':''}" data-fbk="idea" role="radio" aria-checked="${FB.kind==='idea'}"><b>&#128161; An idea</b><span>Something to add or improve</span></button>
      <button class="fbkind ${FB.kind==='problem'?'on':''}" data-fbk="problem" role="radio" aria-checked="${FB.kind==='problem'}"><b>&#128030; A problem</b><span>Something broken, wrong or out of date</span></button></div>
    <label class="lof"><span>Title</span><input id="fbt" class="pk" maxlength="100" placeholder="${FB.kind==='problem'?'e.g. The Hive of Gorgons boss table shows the wrong weakness':'e.g. Add a timer for respawning bosses'}"></label>
    <label class="lof"><span>Details</span><textarea id="fbb" class="pk" rows="6" maxlength="2000" placeholder="${FB.kind==='problem'?'What happened, and what did you expect? Which item, build or page?':'What would it do, and how would you use it?'}"></textarea></label>
    ${FB.page?`<label class="amon"><input type="checkbox" id="fbp" checked> Include the page I was on <span class="dimtx tiny">${esc(decodeURIComponent(FB.page.replace(/^https?:\/\/[^/]+\/?/,'')).slice(0,80)||'home')}</span></label>`:''}
    <div class="lbtns"><button class="mini go" id="fbsend">Send to the site owner</button><span class="dimtx tiny">Sent as ${esc(u.name)}. See the <a href="privacy.html">Privacy Policy</a>.</span></div></div>`;
}
function feedbackEvents(){
  const m=document.getElementById('main');
  m.querySelectorAll('[data-fbk]').forEach(b=>b.onclick=()=>{ const t=document.getElementById('fbt').value, d=document.getElementById('fbb').value; FB.kind=b.dataset.fbk; openView('feedback',false);
    document.getElementById('fbt').value=t; document.getElementById('fbb').value=d; });
  const lg=m.querySelector('[data-fblogin]'); if(lg) lg.addEventListener('click',()=>LS.set('nw_after_login','feedback'));
  const s=document.getElementById('fbsend'); if(!s) return;
  s.onclick=async()=>{
    const title=document.getElementById('fbt').value.trim(), body=document.getElementById('fbb').value.trim(), pg=document.getElementById('fbp');
    if(title.length<3){ document.getElementById('fbt').focus(); return toast('Give it a short title'); }
    s.disabled=true; s.textContent='Sending…';
    try{ await fbApi({op:'send', kind:FB.kind, title, body, page:pg&&pg.checked?FB.page:''}); FB.sent=true; openView('feedback',false); }
    catch(e){ s.disabled=false; s.textContent='Send to the site owner'; toast('Couldn\'t send it: '+e.message); }
  };
}

/* ---------- Admin page tab ---------- */
async function fbLoad(){ FBERR=''; try{ FBLIST=(await fbApi({op:'list'})).items||[]; }catch(e){ FBERR=e.message; FBLIST=[]; } if(current&&current.v==='admin'&&ADMTAB==='feedback') openView('admin',false); }
const fbNewCount = () => FBLIST ? FBLIST.filter(x=>x.status==='new').length : 0;
function fbAdminHTML(){
  if(FBLIST===null){ fbLoad(); return '<p class="dimtx">Loading ideas and reports&hellip;</p>'; }
  if(FBERR) return `<p class="bad">Couldn't load them: ${esc(FBERR)}</p><button class="mini" id="fbref">&#8635; Try again</button>`;
  const open=x=>x.status==='new'||x.status==='planned';
  const list=FBLIST.filter(x=>(!FBFILT.kind||x.kind===FBFILT.kind)&&(FBFILT.status==='all'||(FBFILT.status==='open'?open(x):x.status===FBFILT.status)));
  const chip=(k,v,l)=>`<button class="chip ${FBFILT[k]===v?'on':''}" data-fbf="${k}" data-v="${v}">${l}</button>`;
  return `<p class="dimtx">Ideas and problem reports people sent from the site. Each one was also posted to your Discord feedback channel.</p>
  <div class="filters" data-h="Show"><div class="frow"><span class="fl">Type</span>${chip('kind','','All')}${chip('kind','idea','&#128161; Ideas')}${chip('kind','problem','&#128030; Problems')}</div>
    <div class="frow"><span class="fl">Status</span>${chip('status','open','Open')}${chip('status','new','New')}${chip('status','planned','Planned')}${chip('status','done','Done')}${chip('status','closed','Closed')}${chip('status','all','All')}</div></div>
  <div class="presetbar"><button class="mini" id="fbref">&#8635; Refresh</button><span class="count">${list.length} of ${FBLIST.length}</span></div>
  ${list.map(x=>`<div class="locard fbitem ${x.kind}"><div class="fbmain">
      <div class="fbtop"><span class="fbtag ${x.kind}">${x.kind==='problem'?'&#128030; Problem':'&#128161; Idea'}</span><b>${esc(x.title)}</b></div>
      ${x.body?`<div class="fbbody">${esc(x.body)}</div>`:''}
      <div class="dimtx tiny">From ${esc(x.by&&x.by.name||'someone')} (@${esc(x.by&&x.by.user||'')}) &middot; ${new Date(x.at).toLocaleString()}${x.page?` &middot; <a href="${esc(x.page)}">the page they were on</a>`:''}</div></div>
    <div class="lobtns"><select class="mini" data-fbst="${esc(x.id)}" aria-label="Status">${Object.entries(FB_STATUS).map(([k,l])=>`<option value="${k}" ${x.status===k?'selected':''}>${l}</option>`).join('')}</select>
      <button class="mini" data-fbdel="${esc(x.id)}">Delete</button></div></div>`).join('')||'<p class="empty">Nothing here.</p>'}`;
}
function fbAdminEvents(){
  const m=document.getElementById('main');
  const r=document.getElementById('fbref'); if(r) r.onclick=()=>{ FBLIST=null; openView('admin',false); };
  m.querySelectorAll('[data-fbf]').forEach(b=>b.onclick=()=>{ FBFILT[b.dataset.fbf]=b.dataset.v; openView('admin',false); });
  m.querySelectorAll('[data-fbst]').forEach(s=>s.onchange=async()=>{ const x=FBLIST.find(y=>y.id===s.dataset.fbst); try{ await fbApi({op:'status', id:x.id, status:s.value}); x.status=s.value; toast('Marked '+FB_STATUS[s.value].toLowerCase()); openView('admin',false); }catch(e){ toast('Couldn\'t change it: '+e.message); } });
  m.querySelectorAll('[data-fbdel]').forEach(b=>b.onclick=async()=>{ if(!b.dataset.sure){ b.dataset.sure=1; b.textContent='Delete for good?'; b.classList.add('danger'); return; }
    try{ await fbApi({op:'del', id:b.dataset.fbdel}); FBLIST=FBLIST.filter(y=>y.id!==b.dataset.fbdel); toast('Deleted'); openView('admin',false); }catch(e){ toast('Couldn\'t delete it: '+e.message); } });
}

/* ---------- Changelog: every website update that went live (kept by the helper, admins only) ---------- */
let CLTXT = null, CLERR = '';
/* admins = the site owner, plus anyone with an editor role */
function clAdmin(){ return !!((typeof OWNER!=='undefined'&&OWNER&&OWNER.owner)||(typeof ED!=='undefined'&&ED.roles&&ED.roles.length)); }
function viewChangelog(){
  if(!clAdmin() && typeof dUser==='function' && dUser() && (typeof OWNER==='undefined' || OWNER===null || (typeof ED!=='undefined' && ED.loading))) return '<h1>Changelog</h1><p class="dimtx">Checking your access&hellip;</p>';
  if(!clAdmin()) return '<h1>Changelog</h1><p class="lede">The changelog is only for the site\'s admins. Log in with Discord on an admin or editor account to see it.</p>';
  if(CLTXT===null){ edApi({op:'changelog'}).then(d=>{ CLTXT=d.text||''; }).catch(e=>{ CLTXT=''; CLERR=e.message; }).finally(()=>{ if(current&&current.v==='changelog') openView('changelog',false); });
    return '<h1>Changelog</h1><p class="dimtx">Loading&hellip;</p>'; }
  const body=CLTXT.replace(/^(?:New World|Azoth) Vault changelog\n=+\n[^\n]*\n+/,'').trim();
  const blocks=body?body.split(/\n\s*\n/).map(b=>b.split('\n')).filter(b=>b[0].trim()):[];
  return `<h1>Changelog</h1>
  <p class="lede">Every update to the website that went live, newest first: edits by the site owner and approved updates from editors. Only admins and editors can see this page.</p>
  ${CLERR?`<p class="bad">Couldn't load the changelog: ${esc(CLERR)}</p>`:''}
  ${blocks.length?`<div class="cl">${blocks.map(b=>{ const m=b[0].match(/^(\d{4}-\d\d-\d\d) (\d\d:\d\d) UTC\s+(.*)$/);
      const when=m?new Date(m[1]+'T'+m[2]+':00Z'):null;
      return `<div class="clrow"><div class="clwhen">${when?`${esc(when.toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'}))}<span>${esc(when.toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit'}))}</span>`:''}</div>
        <div class="clwhat"><b>${esc(m?m[3]:b[0])}</b>${b.slice(1).map(l=>`<div class="${/^\s*\+\d+ \/ -\d+ lines/.test(l)?'clstat':'dimtx'}">${esc(l.trim())}</div>`).join('')}</div></div>`; }).join('')}</div>`
    :'<p class="empty">Nothing yet. Updates appear here as soon as they go live.</p>'}`;
}

/* ================= editors: people with a role suggest updates in their own area =================
   Roles and areas live in the helper (ROLE_AREAS). Suggestions wait on the owner's Admin page; once approved
   they're saved into custom.json like the owner's own edits. Every suggestion is checked here as you type,
   then again by the helper when it's sent, and again when it's approved. */
const ED_AREAS_ALL = {builds:['Builds/'], crafting:['6 Crafting/','1 References/Game Data/','1 References/Housing/']};
const ED_NAMES = {builds:'Builds', crafting:'Crafting & materials'};
let ED = {roles:[], areas:{}, names:{}, uid:null, loading:false};
let EDDEFS = null, EDDEFS_DIRTY = false;
const edRoleName = r => (EDDEFS&&EDDEFS[r]&&EDDEFS[r].name) || (ED.names&&ED.names[r]) || ED_NAMES[r] || r;
/* the owner sees the editors' page inside their own Admin page (tab "Suggest a change"); editors get it as their Admin page */
function edGo(push){ if(edIsOwner()){ ADMTAB='suggest'; LS.set('nw_admtab','suggest'); openView('admin',push); } else openView('editor',push); }
const edHere = () => current && current.kind==='view' && (current.v==='editor' || (current.v==='admin' && ADMTAB==='suggest'));
let EDV = {mode:'home', path:'', mine:null, q:''};
let EDP = null, EDPERR = '', EDPF = 'pending', EDROLES = null;

/* ---------- who you are ---------- */
async function edApi(body){
  const r=await fetch(CFG.worker+'/editor',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pass:dPass(),...body})});
  let d={}; try{ d=await r.json(); }catch(e){}
  if(!r.ok) throw Object.assign(new Error(d.error||('error '+r.status)),{status:r.status, bad:d.bad});
  return d;
}
function edEnsure(){
  const u=typeof dUser==='function'&&CFG.worker?dUser():null;
  if(!u){ ED={roles:[],areas:{},names:{},uid:null,loading:false}; return; }
  if(ED.uid===u.id||ED.loading) return;
  ED.loading=true; const c=LS.get('nw_ed_'+u.id,null); if(c){ ED.roles=c.roles||[]; ED.areas=c.areas||{}; ED.names=c.names||{}; }
  edApi({op:'me'}).then(d=>{ ED={roles:d.roles||[], areas:d.areas||{}, names:d.names||{}, uid:u.id, loading:false}; LS.set('nw_ed_'+u.id,{roles:ED.roles,areas:ED.areas,names:ED.names}); topnav();
      if(current&&current.kind==='view'&&current.v==='editor') openView(ED.roles.length?'editor':'admin',false);
      else if(edHere()) openView('admin',false);
      else if(current&&current.kind==='view'&&current.v==='changelog') openView('changelog',false); })
    .catch(()=>{ ED.loading=false; ED.uid=u.id; if(edHere()) openView(current.v,false); });
}
const edIsOwner = () => !!(typeof OWNER!=='undefined'&&OWNER&&OWNER.owner);
const edAreaOf = path => ED.roles.find(r=>(ED.areas[r]||[]).some(a=>path.startsWith(a)));
const edCanEdit = name => { const p=NAMES[name]; return !!(p && !META[p].custom && ED.roles.length && !edIsOwner() && edAreaOf(p)); };

/* the same safety check the helper runs, so problems show while you type */
const ED_OK_TAGS=['br','sub','sup','b','i','u','kbd','mark','small'];
const ED_SITES=['azothvault.com','nwdb.info','newworld.com','youtube.com','youtu.be','twitch.tv','discord.com','discord.gg','github.com','reddit.com','icy-veins.com','aoeah.com','iggm.com','gamesfuze.com','mein-mmo.de','nw-buddy.de','gaming.tools','pages.dev'];
function edCheck(body,title,orig){
  const bad=[],warn=[];
  if(!body.trim()) bad.push('The page is empty');
  if(body.length>60000) bad.push('The page is too long (over 60,000 characters)');
  if(title!=null && !/^[A-Za-z0-9 '’&()+,.:!?-]{3,80}$/.test(title)) bad.push('The title can only use letters, numbers, spaces and simple punctuation (3 to 80 characters)');
  if(/[\u202A-\u202E\u2066-\u2069\u200B-\u200F\u2028\u2029\uFEFF]/.test(body+(title||''))) bad.push('It contains hidden or direction-changing characters');
  if(/(javascript|vbscript|livescript)\s*:|data\s*:\s*text\/html/i.test(body)) bad.push('It contains a script link');
  if(/<[^>]*\son[a-z]+\s*=/i.test(body)) bad.push('It contains HTML event code');
  const tags=[...body.matchAll(/<\s*\/?\s*([a-zA-Z][\w-]*)/g)].map(m=>m[1].toLowerCase()).filter(x=>!ED_OK_TAGS.includes(x));
  if(tags.length) bad.push(`It contains HTML that isn't allowed (${[...new Set(tags)].slice(0,5).map(x=>'<'+x+'>').join(', ')}). Use Markdown instead.`);
  const hosts=[...body.matchAll(/https?:\/\/([^\s/)\]>"']+)/gi)].map(m=>m[1].toLowerCase().replace(/^www\./,''));
  const odd=[...new Set(hosts.filter(h=>!ED_SITES.some(k=>h===k||h.endsWith('.'+k))))];
  if(odd.length) warn.push('Links to sites not on the usual list: '+odd.slice(0,6).join(', ')+'. The owner will check these.');
  if(orig && body.length<orig.length*0.4) warn.push('This removes more than half of the page.');
  return {bad,warn};
}

/* ---------- line-by-line differences, for the owner's review ---------- */
function edDiff(a,b){
  const A=a.split('\n'), B=b.split('\n'), n=A.length, m=B.length;
  if(n*m>4e6) return [{t:'-',s:'(too big to compare line by line)'},{t:'+',s:'(see Preview)'}];
  const L=Array.from({length:n+1},()=>new Uint16Array(m+1));
  for(let i=n-1;i>=0;i--) for(let j=m-1;j>=0;j--) L[i][j]=A[i]===B[j]?L[i+1][j+1]+1:Math.max(L[i+1][j],L[i][j+1]);
  const out=[]; let i=0,j=0;
  while(i<n&&j<m){ if(A[i]===B[j]){ out.push({t:' ',s:A[i]}); i++; j++; } else if(L[i+1][j]>=L[i][j+1]) out.push({t:'-',s:A[i++]}); else out.push({t:'+',s:B[j++]}); }
  while(i<n) out.push({t:'-',s:A[i++]}); while(j<m) out.push({t:'+',s:B[j++]});
  return out;
}
function edDiffHTML(a,b){
  const d=edDiff(a,b), keep=new Set();
  d.forEach((x,k)=>{ if(x.t!==' ') for(let z=k-2;z<=k+2;z++) keep.add(z); });
  let html='', skip=0; const flush=()=>{ if(skip){ html+=`<div class="dl dsk">&hellip; ${skip} unchanged line${skip===1?'':'s'}</div>`; skip=0; } };
  d.forEach((x,k)=>{ if(x.t===' '&&!keep.has(k)){ skip++; return; } flush(); html+=`<div class="dl ${x.t==='+'?'dadd':x.t==='-'?'ddel':''}"><span>${x.t==='+'?'+':x.t==='-'?'&minus;':''}</span>${esc(x.s)||'&nbsp;'}</div>`; });
  flush();
  const adds=d.filter(x=>x.t==='+').length, dels=d.filter(x=>x.t==='-').length;
  return {html:`<div class="ddiff">${html||'<div class="dl dsk">No changes</div>'}</div>`, adds, dels};
}

/* ---------- instructions to paste into Claude (or another assistant) ---------- */
function edAIPrompt(isNew, path, title, body){
  const isBuild=path.startsWith('Builds');
  const names=Object.keys(META).filter(p=>!META[p].custom&&(edAreaOf(p)||/^1 References\//.test(p))).map(p=>META[p].name).sort();
  return `I'm editing a page for the Azoth Vault, a fan website for New World: Aeternum (Season 10). ${isNew?`Write a new page called "${title||'(page name)'}" for the folder "${path}".`:'Rewrite the page below with my changes.'} Give me back ONLY the finished page, in one markdown code block, ready to paste.

My changes: [DESCRIBE WHAT YOU WANT ADDED OR CHANGED HERE]

The website rejects anything that breaks these rules, so follow them exactly:
- Markdown only, with no HTML. The only tags allowed are <br>, <sub>, <sup>, <b>, <i>, <u>, <kbd>, <mark> and <small>. No scripts, iframes, images or styles.
- Link to other vault pages as [[Page Name]], or [[Page Name|shown text]], using only names from the list at the end. Link to websites as [text](https://...), https only.
- One "# Title" line at the top, "##" for sections and "###" for sub-sections.
- Tables use pipes, with a header row and a |---| row under it.
- Tips and warnings use Obsidian callouts: "> [!info]", "> [!tip]" or "> [!warning]" on the first line.
- UK spelling. Write item, perk, gem, ability and set names exactly as they are in the game. Don't make up numbers: if you're not sure of a value, say so.
- Keep everything I didn't ask to change.${isBuild?`
- Keep the "## Quick reference" table (columns: Item | Detail) with rows called Role, Modes, Armor and Attributes. The site's Build browser reads them.
- A "## Full loadout" section has a table with exactly these columns: Slot | Item | Type | Gem | Perk 1 | Perk 2 | Perk 3 | Charm. Slots are named Weapon 1, Weapon 2, Shield (only if used), Helmet, Chest, Gloves, Pants, Boots, Amulet, Ring, Earring, Heartrune. Write "Crafted legendary" as the Item for crafted gear and "–" for an empty cell. Type is the weapon (e.g. Hatchet) or the armour weight (Light, Medium, Heavy).
- Under it: "### Abilities" (Weapon | Ability 1 | Ability 2 | Ability 3), "### Attributes" (Strength | Dexterity | Intelligence | Focus | Constitution, then one row of numbers) and "### Skill trees" (Weapon | Tree | Points | Nodes, with nodes separated by commas). The site builds the loadout and draws the skill trees from these tables.`:''}${isNew&&isBuild?`
- Start the page with this front matter, filled in:
---
tags: [new-world, builds, <mode, e.g. pve or pvp or open-world>, <weapon 1>, <weapon 2>]
---`:''}

Vault pages you can link to: ${names.join(', ')}

${isNew?'Here is my rough draft (it may be empty):':'Here is the page as it is now:'}
\`\`\`markdown
${body}
\`\`\``;
}

/* ---------- the Editor page ---------- */
function edFolders(){
  const out=new Set();
  ED.roles.forEach(r=>(ED.areas[r]||[]).forEach(a=>{ out.add(a.replace(/\/$/,''));
    Object.keys(META).forEach(p=>{ if(p.startsWith(a)&&!META[p].custom){ const f=p.split('/').slice(0,-1).join('/'); if(f) out.add(f); } }); }));
  return [...out].sort();
}
const edHead = (lede) => `<h1>Admin</h1><p class="lede">${lede}</p><div class="admtabs"><button class="chip on">&#128221; Suggest a change</button></div>`;
function viewEditor(embedded){
  edEnsure();
  if(ED.loading && !ED.roles.length) return '<p class="dimtx">Loading&hellip;</p>';
  const u=typeof dUser==='function'&&CFG.worker?dUser():null;
  if(!u) return `<h1>Admin</h1>${typeof favLoginBox==='function'?favLoginBox('Log in with Discord to suggest updates.'):''}`;
  if(!ED.roles.length) return `<h1>Admin</h1><p class="lede">You don't have an editor role yet. Ask the site owner to add you, and send them your Discord ID: <code>${esc(u.id)}</code></p>`;
  const roleTags=ED.roles.map(r=>`<span class="edrole ${esc(r)}">${esc(edRoleName(r))}</span>`).join(' ');
  if(EDV.mode==='edit'||EDV.mode==='new') return edEditorHTML(u);
  if(EDV.mine===null){ edApi({op:'mine'}).then(d=>{ EDV.mine=d.items||[]; if(edHere()) edGo(false); }).catch(()=>{ EDV.mine=[]; }); }
  const q=EDV.q.trim().toLowerCase();
  const pages=Object.keys(META).filter(p=>!META[p].custom&&edAreaOf(p)&&(!q||META[p].name.toLowerCase().includes(q))).sort();
  const groups={}; pages.forEach(p=>{ const f=p.split('/').slice(0,-1).join(' / '); (groups[f]=groups[f]||[]).push(p); });
  const st={pending:['Waiting for the owner','wait'],approved:['Approved and live','ok'],rejected:['Not approved','no']};
  return `${embedded?`<p class="dimtx">This is exactly what your editors see on their Admin page. As the owner you have every role, so you can try it on any area. What you send here waits under Waiting updates like theirs.</p>`:edHead(`Signed in as <b>${esc(u.name)}</b>. Suggest changes to pages in your area: everything you send waits for the site owner, who approves it before anyone else sees it. Your role: ${roleTags}`)}
  <div class="lbtns"><button class="mini go" id="ednew">&#65291; New page</button></div>
  <h2>Your updates</h2>
  ${EDV.mine===null?'<p class="dimtx">Loading&hellip;</p>':EDV.mine.length?`<div class="edmine">${EDV.mine.map(x=>`<div class="locard"><div><b>${esc(x.kind==='new'?'New page: ':'')}${esc(x.name)}</b>
      <div class="dimtx tiny">${new Date(x.at).toLocaleString()}${x.summary?' &middot; '+esc(x.summary):''}</div>${x.note?`<div class="ednote">Owner: ${esc(x.note)}</div>`:''}</div>
      <div class="lobtns"><span class="edst ${st[x.status][1]}">${st[x.status][0]}</span>${x.status==='pending'?`<button class="mini" data-edwd="${esc(x.id)}">Withdraw</button>`:''}</div></div>`).join('')}</div>`
    :'<p class="dimtx">Nothing sent yet.</p>'}
  <h2>Pages you can update</h2>
  <input id="edq" class="isearch" placeholder="Find a page" value="${esc(EDV.q)}" autocomplete="off">
  ${Object.entries(groups).map(([f,l])=>`<div class="edgrp"><div class="sh">${esc(label(f))}</div>${l.map(p=>`<div class="edrow"><span>${esc(label(META[p].name))}</span><button class="mini" data-edgo="${esc(p)}">&#9998; Suggest a change</button></div>`).join('')}</div>`).join('')||'<p class="empty">No pages match.</p>'}`;
}
function edEditorHTML(u){
  const isNew=EDV.mode==='new'; const m=isNew?null:META[EDV.path];
  const folders=edFolders();
  const tpl=isNew?(EDV.folder&&EDV.folder.startsWith('Builds')?`---\ntags: [new-world, builds]\n---\n# Build name\n\nOne or two lines on what it does and who it's for.\n\n| | |\n|---|---|\n| **Role** | |\n| **Modes** | |\n| **Armor** | |\n| **Attributes** | |\n\n## How to play it\n\n`:'# Page title\n\n'):'';
  return `<div class="crumb"><a href="#" class="wl" id="edback">&larr; Admin</a></div>
  <h1>${isNew?'New page':'Suggest a change to “'+esc(label(m.name))+'”'}</h1>
  <p class="lede">The owner sees exactly what you changed and approves it before it goes on the site.</p>
  <div class="edgrid"><div class="edl">
    ${isNew?`<div class="two"><label class="lof"><span>Folder</span><select id="edf" class="pk">${folders.map(f=>`<option ${EDV.folder===f?'selected':''}>${esc(f)}</option>`).join('')}</select></label>
      <label class="lof"><span>Page name</span><input id="edt" class="pk" maxlength="80" placeholder="e.g. Void Gauntlet Healer" value="${esc(EDV.title||'')}"></label></div>`:''}
    <label class="lof"><span>What did you change? (for the owner)</span><input id="eds" class="pk" maxlength="300" placeholder="e.g. Updated the Season 10 perks on the chest piece"></label>
    <div class="edai"><button class="mini" id="edai">&#128203; Copy instructions for Claude</button><span class="dimtx tiny">Paste them into Claude or another assistant, describe your change where it says, then paste its answer back in the box below. It's checked the same way.</span></div>
    <textarea id="edb" rows="24">${esc(isNew?(EDV.body||tpl):m.body)}</textarea>
    ${typeof MDHELP!=='undefined'?MDHELP:''}
    <div id="edchk" class="edchk"></div>
    <div class="saverow"><button class="mini go" id="edsend">Send for review</button><button class="mini" id="edcancel">Cancel</button><span class="dimtx tiny">Sending as ${esc(u.name)}</span></div>
  </div><div class="edr"><div class="dimtx">Preview</div><article id="edprev"></article></div></div>`;
}
function editorEvents(){
  const on=(id,f)=>{ const e=document.getElementById(id); if(e) e.onclick=f; };
  if(EDV.mode==='home'){
    on('ednew',()=>{ EDV={...EDV,mode:'new',folder:edFolders()[0]||'',title:'',body:''}; edGo(false); });
    const q=document.getElementById('edq'); if(q){ let tm; q.oninput=()=>{ clearTimeout(tm); tm=setTimeout(()=>{ EDV.q=q.value; edGo(false); const n=document.getElementById('edq'); n.focus(); n.setSelectionRange(n.value.length,n.value.length); },200); }; }
    document.querySelectorAll('[data-edgo]').forEach(b=>b.onclick=()=>{ EDV.mode='edit'; EDV.path=b.dataset.edgo; edGo(false); });
    document.querySelectorAll('[data-edwd]').forEach(b=>b.onclick=async()=>{ try{ await edApi({op:'withdraw',id:b.dataset.edwd}); EDV.mine=null; toast('Withdrawn'); edGo(false); }catch(e){ toast(e.message); } });
    return;
  }
  const isNew=EDV.mode==='new', m=isNew?null:META[EDV.path], orig=m?(m.orig!=null?m.orig:m.body):'';
  const tb=document.getElementById('edb'), pv=document.getElementById('edprev'), ck=document.getElementById('edchk'), send=document.getElementById('edsend');
  const run=()=>{ pv.innerHTML=md(tb.value.replace(/^---\n[\s\S]*?\n---\n?/,''));
    const r=edCheck(tb.value, isNew?(document.getElementById('edt').value.trim()):null, orig);
    if(!isNew && tb.value===m.body) r.bad.unshift('Nothing has changed yet');
    if(isNew){ const t=document.getElementById('edt').value.trim(); if(t&&NAMES[t]) r.bad.push('There\'s already a page called '+t); }
    ck.innerHTML=r.bad.map(x=>`<div class="edbad">&#10006; ${esc(x)}</div>`).join('')+r.warn.map(x=>`<div class="edwarn">&#9888; ${esc(x)}</div>`).join('')||'<div class="edgood">&#10004; Passes the safety check</div>';
    send.disabled=!!r.bad.length; };
  let tm; tb.oninput=()=>{ clearTimeout(tm); tm=setTimeout(run,200); }; if(isNew){ document.getElementById('edt').oninput=tb.oninput; document.getElementById('edf').onchange=()=>{ EDV.folder=document.getElementById('edf').value; }; }
  run();
  const back=()=>{ EDV.mode='home'; EDV.mine=null; edGo(false); };
  on('edback',e=>{ if(e) e.preventDefault(); back(); }); on('edcancel',back);
  on('edai',async()=>{ const txt=edAIPrompt(isNew, isNew?document.getElementById('edf').value:EDV.path, isNew?document.getElementById('edt').value.trim():'', tb.value.replace(/^\s+|\s+$/g,''));
    try{ await navigator.clipboard.writeText(txt); toast('Copied. Paste it into Claude, then fill in “My changes”'); }
    catch(e){ favPop('Instructions for Claude',`<p class="dimtx">Copy everything in the box.</p><textarea class="pk" rows="16" style="width:100%">${esc(txt)}</textarea>`); } });
  // whatever comes back, take just the page out of a pasted code block
  tb.addEventListener('paste',()=>setTimeout(()=>{ const m=tb.value.match(/^\s*```(?:markdown|md)?\n([\s\S]*?)\n```\s*$/); if(m){ tb.value=m[1]; run(); toast('Took the page out of the code block'); } },0));
  send.onclick=async()=>{ send.disabled=true; send.textContent='Sending…';
    try{
      const d = isNew ? await edApi({op:'submit',kind:'new',folder:document.getElementById('edf').value,title:document.getElementById('edt').value.trim(),body:tb.value,summary:document.getElementById('eds').value})
                      : await edApi({op:'submit',kind:'edit',path:EDV.path,body:tb.value,base:h32(orig),summary:document.getElementById('eds').value});
      toast('Sent. The owner will review it'+(d.warn&&d.warn.length?' (with a note about links)':'')); back();
    }catch(e){ send.disabled=false; send.textContent='Send for review'; ck.innerHTML=`<div class="edbad">&#10006; ${esc(e.message)}</div>`; }
  };
}
/* "Suggest a change" on a page in your area */
document.addEventListener('click', e=>{
  const b=e.target.closest('[data-edsug]'); if(!b) return;
  e.preventDefault(); e.stopPropagation(); const p=NAMES[b.dataset.edsug]; if(!p) return;
  EDV.mode='edit'; EDV.path=p; edGo(true);
}, true);

/* ---------- Admin: waiting updates and editors ---------- */
async function edLoadProps(){ EDPERR=''; try{ EDP=(await ownerApi('props_list')).items||[]; }catch(e){ EDPERR=e.message; EDP=[]; } if(current&&current.v==='admin') openView('admin',false); }
const edWaiting = () => EDP ? EDP.filter(x=>x.status==='pending').length : 0;
function edAdminHTML(){
  if(EDP===null){ edLoadProps(); return '<p class="dimtx">Loading updates&hellip;</p>'; }
  if(EDPERR) return `<p class="bad">Couldn't load them: ${esc(EDPERR)}</p><button class="mini" id="edpref">&#8635; Try again</button>`;
  const list=EDP.filter(x=>EDPF==='all'||x.status===EDPF);
  const chip=(v,l)=>`<button class="chip ${EDPF===v?'on':''}" data-edpf="${v}">${l}</button>`;
  return `<p class="dimtx">Updates your editors sent. Each one passed the safety check when it was sent, and is checked again when you approve it. Approved updates go live after the site rebuilds (a minute or two).</p>
  <div class="presetbar">${chip('pending','Waiting')}${chip('approved','Approved')}${chip('rejected','Not approved')}${chip('all','All')}<button class="mini" id="edpref">&#8635; Refresh</button></div>
  ${list.map(x=>{ const D=x.kind==='edit'&&x.orig?edDiffHTML(x.orig,x.body):null;
    return `<div class="slot lcard edprop">
      <div class="edph"><span class="edrole ${esc(x.role)}">${esc(edRoleName(x.role))}</span><b>${x.kind==='new'?'New page: ':''}${esc(x.name)}</b>
        <span class="dimtx tiny">${esc(x.path)}</span></div>
      <div class="dimtx tiny">From <b>${esc(x.by.name)}</b> (@${esc(x.by.user||'')}) &middot; ${new Date(x.at).toLocaleString()}${D?` &middot; <span class="dadd">+${D.adds}</span> <span class="ddel">&minus;${D.dels}</span> lines`:''}</div>
      ${x.summary?`<p class="edsum">${esc(x.summary)}</p>`:''}
      ${x.warn&&x.warn.length?x.warn.map(w=>`<div class="edwarn">&#9888; ${esc(w)}</div>`).join(''):'<div class="edgood">&#10004; Passed the safety check with nothing to flag</div>'}
      ${x.status==='pending'?(D?D.html:`<details class="edsrc"><summary>Show the Markdown</summary><pre>${esc(x.body)}</pre></details>`):''}
      ${x.note?`<div class="ednote">Your note: ${esc(x.note)}</div>`:''}
      <div class="lbtns">${x.status==='pending'?`<button class="mini go" data-edok="${esc(x.id)}">Approve and publish</button><button class="mini" data-edpv="${esc(x.id)}">Preview</button>
        <input class="pk edrej" data-edrn="${esc(x.id)}" maxlength="300" placeholder="Reason if you say no (they'll see it)"><button class="mini" data-edno="${esc(x.id)}">Not approved</button>`
        :`<span class="edst ${x.status==='approved'?'ok':'no'}">${x.status==='approved'?'Approved':'Not approved'}</span><button class="mini" data-eddel="${esc(x.id)}">Remove from list</button>`}</div></div>`; }).join('')||'<p class="empty">Nothing here.</p>'}`;
}
function edFolderTree(){   // top-level folders and the folders inside them, from the site's own pages
  const set=new Set(); Object.keys(META).forEach(p=>{ if(META[p].custom) return; const parts=p.split('/'); if(parts.length<2||/^My Pages$/i.test(parts[0])) return;
    set.add(parts[0]+'/'); if(parts.length>2) set.add(parts[0]+'/'+parts[1]+'/'); });
  const tops=[...set].filter(x=>x.split('/').length===2).sort();
  return tops.map(tp=>({path:tp, subs:[...set].filter(x=>x!==tp&&x.startsWith(tp)).sort()}));
}
function edRolesHTML(){
  if(EDROLES===null){ ownerApi('roles_get').then(d=>{ EDROLES=d.roles||{}; EDDEFS=d.defs||{}; EDDEFS_DIRTY=false; if(current&&current.v==='admin') openView('admin',false); }).catch(e=>{ EDROLES={}; EDDEFS={}; toast(e.message); }); return '<p class="dimtx">Loading&hellip;</p>'; }
  const roleIds=Object.keys(EDDEFS), rows=Object.entries(EDROLES), tree=edFolderTree();
  const covered=(areas,p)=>areas.some(a=>a!==p&&p.startsWith(a));
  const roleCard=id=>{ const r=EDDEFS[id];
    return `<div class="slot lcard edrolecard"><div class="edrchead"><input class="pk" data-rdn="${esc(id)}" maxlength="40" value="${esc(r.name)}" aria-label="Role name">
        <span class="dimtx tiny">${r.areas.length} area${r.areas.length===1?'':'s'}</span><button class="mini" data-rddel="${esc(id)}">Delete role</button></div>
      <div class="sh">Can suggest updates to</div>
      <div class="edtree">${tree.map(n=>`<div class="edtn"><label class="amon"><input type="checkbox" data-rda="${esc(id)}" data-p="${esc(n.path)}" ${r.areas.includes(n.path)?'checked':''}> <b>${esc(label(n.path.slice(0,-1)))}</b></label>
        ${n.subs.length?`<div class="edtsubs">${n.subs.map(s=>{ const inc=covered(r.areas,s); return `<label class="amon ${inc?'inc':''}"><input type="checkbox" data-rda="${esc(id)}" data-p="${esc(s)}" ${r.areas.includes(s)||inc?'checked':''} ${inc?'disabled':''}> ${esc(label(s.split('/')[1]))}</label>`; }).join('')}</div>`:''}</div>`).join('')}</div></div>`; };
  return `<h2>People</h2>
  <p class="dimtx">People you trust to suggest updates. Everything they send waits for you under Waiting updates.</p>
  <div class="tw"><table><thead><tr><th>Person</th><th>Discord ID</th>${roleIds.map(r=>`<th>${esc(edRoleName(r))}</th>`).join('')}<th></th></tr></thead><tbody>
  ${rows.map(([id,x])=>`<tr><td>${esc(x.name)}</td><td><code>${esc(id)}</code></td>${roleIds.map(r=>`<td><input type="checkbox" data-edr="${esc(id)}" data-role="${esc(r)}" ${x.roles.includes(r)?'checked':''} aria-label="${esc(edRoleName(r))} for ${esc(x.name)}"></td>`).join('')}<td><button class="mini" data-edrm="${esc(id)}">Remove</button></td></tr>`).join('')||`<tr><td colspan="${roleIds.length+3}" class="dimtx">No editors yet.</td></tr>`}
  </tbody></table></div>
  <div class="slot lcard edadd"><div class="sh">Add an editor</div>
    <div class="two"><label class="lof"><span>Name (for you)</span><input id="edan" class="pk" maxlength="40" placeholder="e.g. Sam"></label>
    <label class="lof"><span>Discord ID</span><input id="edai" class="pk" inputmode="numeric" placeholder="17 to 20 digits"></label></div>
    <div class="frow">${roleIds.map(r=>`<label class="amon"><input type="checkbox" data-edar="${esc(r)}"> ${esc(edRoleName(r))}</label>`).join('')}</div>
    <div class="lbtns"><button class="mini go" id="edaadd">Add</button></div>
    <p class="dimtx tiny">They can find their ID in the account menu (top right) once they log in on the site, or in Discord with Developer Mode on: right-click their name, then Copy User ID.</p></div>
  <h2>Roles and what they can update</h2>
  <p class="dimtx">Tick the parts of the site each role can suggest updates to. Ticking a folder includes everything inside it. Changes apply as soon as you save.</p>
  <div class="edroles">${roleIds.map(roleCard).join('')}</div>
  <div class="slot lcard edadd"><div class="sh">Add a role</div><div class="two"><label class="lof"><span>Role name</span><input id="ednr" class="pk" maxlength="40" placeholder="e.g. Bosses and raids"></label></div>
    <div class="lbtns"><button class="mini" id="ednradd">Add role</button></div></div>
  <div class="edsavebar ${EDDEFS_DIRTY?'on':''}"><span>${EDDEFS_DIRTY?'You have unsaved role changes.':'Roles are saved.'}</span><button class="mini go" id="edrsave" ${EDDEFS_DIRTY?'':'disabled'}>Save roles</button></div>`;
}
function edAdminEvents(){
  const main=document.getElementById('main');
  const r=document.getElementById('edpref'); if(r) r.onclick=()=>{ EDP=null; openView('admin',false); };
  main.querySelectorAll('[data-edpf]').forEach(b=>b.onclick=()=>{ EDPF=b.dataset.edpf; openView('admin',false); });
  const busy=async(btn,f,ok)=>{ btn.disabled=true; try{ await f(); toast(ok); EDP=null; openView('admin',false); }catch(e){ btn.disabled=false; toast(e.message); } };
  main.querySelectorAll('[data-edok]').forEach(b=>b.onclick=()=>busy(b,()=>ownerApi('prop_approve',{id:b.dataset.edok}),'Approved. It goes live after the site rebuilds'));
  main.querySelectorAll('[data-edno]').forEach(b=>b.onclick=()=>{ const n=main.querySelector(`[data-edrn="${b.dataset.edno}"]`); busy(b,()=>ownerApi('prop_reject',{id:b.dataset.edno,note:n?n.value:''}),'Marked as not approved'); });
  main.querySelectorAll('[data-eddel]').forEach(b=>b.onclick=()=>busy(b,()=>ownerApi('prop_delete',{id:b.dataset.eddel}),'Removed'));
  main.querySelectorAll('[data-edpv]').forEach(b=>b.onclick=()=>{ const x=EDP.find(y=>y.id===b.dataset.edpv); if(!x) return;
    if(typeof favPop==='function') favPop('Preview: '+x.name, `<article class="edpvart">${md(x.body.replace(/^---\n[\s\S]*?\n---\n?/,''))}</article>`); });
  // roles and areas
  const dirty=()=>{ EDDEFS_DIRTY=true; openView('admin',false); };
  main.querySelectorAll('[data-rda]').forEach(c=>c.onchange=()=>{ const r=EDDEFS[c.dataset.rda], p=c.dataset.p;
    r.areas=c.checked?[...r.areas.filter(a=>!a.startsWith(p)),p]:r.areas.filter(a=>a!==p); dirty(); });
  main.querySelectorAll('[data-rdn]').forEach(i=>i.onchange=()=>{ EDDEFS[i.dataset.rdn].name=i.value.trim()||i.dataset.rdn; EDDEFS_DIRTY=true; const s=document.getElementById('edrsave'); if(s){ s.disabled=false; s.parentElement.classList.add('on'); s.previousElementSibling.textContent='You have unsaved role changes.'; } });
  main.querySelectorAll('[data-rddel]').forEach(b=>b.onclick=()=>{ const id=b.dataset.rddel; if(!b.dataset.sure){ b.dataset.sure=1; b.textContent='Delete “'+EDDEFS[id].name+'”? Click again'; b.classList.add('danger'); return; }
    if(Object.keys(EDDEFS).length<2) return toast('Keep at least one role'); delete EDDEFS[id]; dirty(); });
  const nr=document.getElementById('ednradd'); if(nr) nr.onclick=()=>{ const n=document.getElementById('ednr').value.trim(); if(n.length<2) return toast('Give the role a name');
    let id=n.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,30)||'role'; while(EDDEFS[id]) id+='-2'; if(id.length<2) id='role-'+id;
    if(Object.keys(EDDEFS).length>=12) return toast('You can have up to 12 roles'); EDDEFS[id]={name:n,areas:[]}; dirty(); };
  const rs=document.getElementById('edrsave'); if(rs) rs.onclick=async()=>{ rs.disabled=true;
    try{ const d=await ownerApi('roledefs_set',{defs:EDDEFS}); EDDEFS=d.defs; EDROLES=d.roles||EDROLES; EDDEFS_DIRTY=false; LS.del('nw_ed_'+(dUser()||{}).id); ED.uid=null; toast('Roles saved'); openView('admin',false); }
    catch(e){ rs.disabled=false; toast('Not saved: '+e.message); } };
  // editors
  const setRoles=async(id,name,roles)=>{ const d=await ownerApi('roles_set',{id,name,roles}); EDROLES=d.roles||{}; openView('admin',false); };
  main.querySelectorAll('[data-edr]').forEach(c=>c.onchange=async()=>{ const id=c.dataset.edr, x=EDROLES[id];
    const roles=[...main.querySelectorAll(`[data-edr="${id}"]`)].filter(y=>y.checked).map(y=>y.dataset.role);
    try{ await setRoles(id,x.name,roles); toast(roles.length?'Roles updated':'Removed '+x.name); }catch(e){ toast(e.message); } });
  main.querySelectorAll('[data-edrm]').forEach(b=>b.onclick=async()=>{ const id=b.dataset.edrm; if(!b.dataset.sure){ b.dataset.sure=1; b.textContent='Remove for good?'; b.classList.add('danger'); return; }
    try{ await setRoles(id,EDROLES[id].name,[]); toast('Removed'); }catch(e){ toast(e.message); } });
  const add=document.getElementById('edaadd'); if(add) add.onclick=async()=>{
    const id=document.getElementById('edai').value.trim(), name=document.getElementById('edan').value.trim();
    const roles=[...main.querySelectorAll('[data-edar]')].filter(c=>c.checked).map(c=>c.dataset.edar);
    if(!/^\d{15,22}$/.test(id)) return toast('A Discord ID is 17 to 20 digits');
    if(!roles.length) return toast('Tick at least one role');
    try{ await setRoles(id,name,roles); toast('Added '+(name||id)); }catch(e){ toast(e.message); } };
}

/* ================= Tradeskill levelling: cheapest and fastest ways to level every crafting, refining and gathering skill ================= */
let TSD=null, TSERR='', TSLOAD=null;
let TQ={sk:LS.get('nw_ts_sk','Weaponsmithing'), from:LS.get('nw_ts_from',0), to:LS.get('nw_ts_to',250), mode:LS.get('nw_ts_mode','cheap'), research:LS.get('nw_ts_res',true), all:false};
const TS_GROUPS=[['Crafting','craft'],['Refining','refine'],['Gathering','gather']];
async function loadTS(){
  if(TSD||TSLOAD) return TSLOAD;
  TSLOAD=(async()=>{ try{ TSD=await (await fetch('tradeskills.json')).json(); TSD.sheet='ts_0.webp?v='+TSD.tile; }catch(e){ TSERR=String(e.message||e); }
    if(current?.kind==='view'&&current.v==='tslevel') openView('tslevel',false); })();
  return TSLOAD;
}
function tsPic(i,size=32,title=''){
  if(!TSD||i==null) return `<span class="iic none" style="width:${size}px;height:${size}px"></span>`;
  const T=TSD.tile,C=TSD.cols,sc=size/T;
  return `<span class="iic" style="width:${size}px;height:${size}px;background-image:url(${TSD.sheet});background-size:${C*T*sc}px auto;background-position:-${(i%C)*T*sc}px -${Math.floor(i/C)*T*sc}px" title="${esc(title)}"></span>`;
}
const tsFmt=n=>Math.round(n).toLocaleString();
function tsXp(sk,from,to){ const c=TSD.skills[sk].curve; let s=0; for(let l=from+1;l<=to;l++) s+=c[l]||0; return s; }
/* raw materials for one craft of a recipe (refined materials broken down to what you gather) */
const TSRAW={};
/* "Any Tier 2 Metals" and the like: count it as its plainest member (something you can gather, or the basic refined version) */
const TSREP={};
function tsRep(cat){
  if(cat in TSREP) return TSREP[cat];
  const c=CR.cats[cat]; const m=(c&&c[1])||[]; const W=CR.where||{};
  const ok=m.filter(id=>!/coin|converter|token/i.test(crName(id)));
  const refined=id=>{ const r=crRecipeFor(id); return r&&REFINE_TS.includes(r.ts)&&!r.ev&&!r.proc; };
  const pick=ok.find(refined)||ok.find(id=>W[id])||ok[0]||m[0]||null;
  return TSREP[cat]=pick;
}
function tsRawOf(id,q,depth,path,acc){
  if(id.startsWith('c:')){ const rep=tsRep(id.slice(2)); if(rep&&depth<8){ tsRawOf(rep,q,depth+1,path,acc); return; } }
  const r=(depth<8&&id[0]!=='$'&&!id.startsWith('c:')&&!path.includes(id))?crRecipeFor(id):null;
  if(r&&REFINE_TS.includes(r.ts)){ const k=q/(r.q||1); r.i.forEach(([iid,qq])=>tsRawOf(iid,qq*k,depth+1,path.concat(id),acc)); return; }
  acc[id]=(acc[id]||0)+q;
}
function tsRaw(r){
  if(TSRAW[r.id]) return TSRAW[r.id];
  const acc={}; r.i.forEach(([iid,q])=>tsRawOf(iid,q,0,[r.o],acc));
  Object.keys(acc).forEach(k=>acc[k]=Math.round(acc[k]*100)/100);
  const n=Object.entries(acc).filter(([id])=>!id.startsWith('$')).reduce((a,[,q])=>a+q,0);
  return TSRAW[r.id]={acc,n:Math.max(1,n)};
}
/* research projects turn salvage scraps (and spare schematics) into tradeskill XP */
const tsIsResearch=r=>/Research/i.test(r.n)||r.i.some(([id])=>/Scrap|Pattern|Schematic/i.test(id+' '+crName(id)));
function tsRecipes(sk){
  return CR.recipes.filter(r=>r.ts===sk&&r.xp>1&&r.known&&!r.ev&&r.lv!=null&&(TQ.research||!tsIsResearch(r))&&!r.i.some(([id])=>/coin|token/i.test(crName(id))));
}
/* best option at each level, grouped into stretches where the best choice doesn't change */
function tsPlan(opts,from,to,score){
  const out=[]; let cur=null;
  for(let l=from;l<to;l++){
    const ok=opts.filter(o=>(o.lv||0)<=l); if(!ok.length){ if(cur&&cur.o===null){ cur.to=l+1; } else { cur={o:null,from:l,to:l+1}; out.push(cur); } continue; }
    let best=ok[0], bs=score(best); for(const o of ok){ const s=score(o); if(s>bs){ best=o; bs=s; } }
    if(cur&&cur.o===best) cur.to=l+1; else { cur={o:best,from:l,to:l+1}; out.push(cur); }
  }
  return out;
}
function viewTS(){
  if(!TSD){ loadTS(); return `<h1>Tradeskill levelling</h1>${TSERR?`<p class="bad">Couldn't load the tradeskill data: ${esc(TSERR)}</p>`:'<p class="dimtx">Loading&hellip;</p>'}`; }
  const sk=TSD.skills[TQ.sk]?TQ.sk:'Weaponsmithing', S=TSD.skills[sk], cap=TSD.cap;
  if(S.kind!=='gather' && !CR){ loadCrafting(); }
  const from=Math.max(0,Math.min(cap-1,+TQ.from||0)), to=Math.max(from+1,Math.min(cap,+TQ.to||cap));
  const need=tsXp(sk,from,to), total=tsXp(sk,0,cap);
  const pick=TS_GROUPS.map(([g,k])=>`<div class="tsgrp"><span class="fl">${g}</span><div class="tspick">${Object.entries(TSD.skills).filter(([,v])=>v.kind===k).map(([n,v])=>
    `<button type="button" class="tsbtn" data-tssk="${esc(n)}" aria-pressed="${n===sk}">${tsPic(v.icon,30,n)}<span>${esc(n)}</span></button>`).join('')}</div></div>`).join('');
  let body='';
  if(S.kind==='gather') body=tsGatherHTML(sk,from,to);
  else body=CR?tsCraftHTML(sk,from,to):(CRERR?`<p class="bad">Couldn't load the recipes: ${esc(CRERR)}</p>`:'<p class="dimtx">Loading recipes&hellip;</p>');
  return `<h1>Tradeskill levelling</h1>
  <p class="lede">Pick a tradeskill and the levels you're going between. The planner finds the cheapest or fastest thing to do at every level and how many you'll need. <span class="credit">XP values from the game data via <a href="https://nw-buddy.de" target="_blank" rel="noopener">NW Buddy</a>.</span></p>
  <div class="filters tsfilters">${pick}</div>
  <div class="tshead slot">
    <div class="tsname">${tsPic(S.icon,56,sk)}<div><h2>${esc(sk)}</h2><div class="tstool">${tsPic(S.toolIcon,26,S.tool)} ${S.kind==='gather'?'Tool':'Station'}: <b>${esc(S.tool)}</b></div></div></div>
    <div class="tslv">
      <label><span>Current level</span><input type="number" min="0" max="${cap-1}" value="${from}" data-tsl="from"></label>
      <span class="tsarrow">&rarr;</span>
      <label><span>Target level</span><input type="number" min="1" max="${cap}" value="${to}" data-tsl="to"></label>
      <div class="tsquick">${[[0,50],[50,100],[100,150],[150,200],[200,250],[0,250]].map(([a,b])=>`<button class="chip" data-tsq="${a}-${b}">${a}&ndash;${b}</button>`).join('')}</div>
    </div>
    <div class="tsxp"><b>${tsFmt(need)}</b> XP needed<span>${(need/total*100).toFixed(1)}% of the whole 0&ndash;${cap} journey (${tsFmt(total)} XP)</span></div>
  </div>
  ${body}`;
}
function tsCraftHTML(sk,from,to){
  const all=tsRecipes(sk).map(r=>{ const raw=tsRaw(r); return {r, lv:r.lv||0, xp:r.xp, raw:raw.n, per:r.xp/raw.n}; });
  if(!all.length) return '<p class="dimtx">No recipes found for this tradeskill.</p>';
  const score=TQ.mode==='fast'?(o=>o.xp+o.per*1e-6):(o=>o.per+o.xp*1e-9);
  const plan=tsPlan(all,from,to,score);
  let crafts=0, mats={};
  const rows=plan.map(p=>{ const xp=tsXp(sk,p.from,p.to);
    if(!p.o) return `<tr><td>${p.from}&ndash;${p.to}</td><td colspan="5" class="dimtx">Nothing to craft yet at this level</td></tr>`;
    const n=Math.ceil(xp/p.o.xp); crafts+=n; const raw=tsRaw(p.o.r); Object.entries(raw.acc).forEach(([id,q])=>mats[id]=(mats[id]||0)+q*n);
    const top=Object.entries(raw.acc).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([id,q])=>`${+q.toFixed(1)}&times; ${esc(crName(id))}`).join(', ');
    return `<tr><td class="tsband">${p.from}&ndash;${p.to}</td><td><a href="#" class="tsrec" data-crgo="${esc(p.o.r.id)}">${crIcon(p.o.r.o,26)}${esc(p.o.r.n)}</a><div class="dimtx tiny">Needs level ${p.o.lv}${p.o.r.st?' &middot; '+esc(p.o.r.st):''}</div></td>
      <td>${tsFmt(p.o.xp)}</td><td><b>${tsFmt(n)}</b></td><td>${tsFmt(p.o.raw)}</td><td class="small">${top}</td></tr>`; }).join('');
  const shop=Object.entries(mats).sort((a,b)=>b[1]-a[1]).slice(0,12);
  const elig=all.filter(o=>o.lv<=to).sort((a,b)=>TQ.mode==='fast'?b.xp-a.xp:b.per-a.per);
  return `<div class="tsmode"><span class="fl">Plan for</span>
      <button class="chip ${TQ.mode==='cheap'?'on':''}" data-tsm="cheap">&#128176; Cheapest: fewest materials per XP</button>
      <button class="chip ${TQ.mode==='fast'?'on':''}" data-tsm="fast">&#9889; Fastest: most XP per craft</button>
      <label class="tsres"><input type="checkbox" data-tsres ${TQ.research?'checked':''}> Use research projects (they turn salvage scraps into XP)</label></div>
    ${TQ.research&&all.some(o=>tsIsResearch(o.r))?'<div class="callout tip"><span class="ci">&#128161;</span><div><p>Research projects are usually the cheapest way up: salvage gear of that type for its <b>scraps</b> and turn them in at the station. Untick the box above to plan with normal crafts instead.</p></div></div>':''}
    <h2>Your plan</h2>
    <div class="tw"><table><thead><tr><th>Levels</th><th>Craft</th><th>XP each</th><th>How many</th><th>Raw materials each</th><th>Main materials (each)</th></tr></thead><tbody>${rows}</tbody></table></div>
    <div class="tssum slot"><div><b>${tsFmt(crafts)}</b> crafts in total</div>
      <div class="tsshop"><span class="fl">Everything to gather (or buy)</span>${shop.map(([id,q])=>`<div class="crrow">${crIcon(id,22)}<span class="crq">${tsFmt(q)}&times;</span><span class="crn">${esc(crName(id))}</span></div>`).join('')}</div></div>
    <p class="dimtx small">Cheapest counts every raw material each craft needs, with refined materials broken down to what you gather. It doesn't know Trading Post prices, so check those for anything you'd buy. Fastest picks the most XP per craft, which means fewer crafts but usually pricier materials. Only recipes you know without a schematic are used.</p>
    <h2>Every recipe up to level ${to}</h2>
    <div class="tw"><table><thead><tr><th>Recipe</th><th>Level</th><th>XP each</th><th>Raw materials</th><th>XP per material</th></tr></thead><tbody>
    ${elig.slice(0,TQ.all?elig.length:40).map(o=>`<tr><td><a href="#" class="tsrec" data-crgo="${esc(o.r.id)}">${crIcon(o.r.o,22)}${esc(o.r.n)}</a></td><td>${o.lv}</td><td>${tsFmt(o.xp)}</td><td>${tsFmt(o.raw)}</td><td>${o.per.toFixed(1)}</td></tr>`).join('')}
    </tbody></table></div>${elig.length>40&&!TQ.all?`<button class="mini" data-tsall="1">Show all ${elig.length}</button>`:''}`;
}
function tsGatherHTML(sk,from,to){
  if(sk==='Fishing'){
    const xp=tsXp(sk,from,to), f=TSD.fish;
    const best=f.reduce((a,b)=>b.xp>a.xp?b:a,f[0]), low=f.reduce((a,b)=>b.xp<a.xp?b:a,f[0]);
    return `<h2>Your plan</h2>
    <div class="tssum slot"><div>Catching small tier 1 fish (${low.xp} XP): about <b>${tsFmt(xp/low.xp)}</b> catches</div><div>Catching large tier ${best.tier} fish (${best.xp} XP): about <b>${tsFmt(xp/best.xp)}</b> catches</div></div>
    <p class="dimtx small">Hooking a fish also gives a little XP of its own. Fishing hotspots (the bubbling water) roll bigger, higher-tier fish, which is the quickest way up.</p>
    <h2>XP per catch</h2><div class="tw"><table><thead><tr><th>Fish size</th><th>Tier</th><th>XP per catch</th></tr></thead><tbody>
    ${f.map(x=>`<tr><td>${x.size}</td><td>${x.tier}</td><td>${x.xp}</td></tr>`).join('')}</tbody></table></div>`;
  }
  const all=TSD.nodes.filter(n=>n.ts===sk).map(n=>Object.assign({},n));
  const score=TQ.mode==='fast'?(o=>o.xp+Math.min(o.spots,5e4)*1e-6):(o=>Math.log10(1+o.spots)*1000+o.xp*1e-3);
  const plan=tsPlan(all.filter(n=>TQ.mode==='fast'||n.spots>0),from,to,score);
  let total=0;
  const rows=plan.map(p=>{ const xp=tsXp(sk,p.from,p.to);
    if(!p.o) return `<tr><td>${p.from}&ndash;${p.to}</td><td colspan="4" class="dimtx">Nothing to gather yet at this level</td></tr>`;
    const n=Math.ceil(xp/p.o.xp); total+=n;
    return `<tr><td class="tsband">${p.from}&ndash;${p.to}</td><td><span class="tsnode">${tsPic(p.o.icon??TSD.skills[sk].toolIcon,26,p.o.n)}${esc(p.o.n)}</span><div class="dimtx tiny">Needs level ${p.o.lv}</div></td><td>${tsFmt(p.o.xp)}</td><td><b>${tsFmt(n)}</b></td><td>${p.o.spots?tsFmt(p.o.spots):'&ndash;'}</td></tr>`; }).join('');
  const elig=all.filter(n=>n.lv<=to).sort((a,b)=>b.xp-a.xp||b.spots-a.spots);
  return `<div class="tsmode"><span class="fl">Plan for</span>
      <button class="chip ${TQ.mode==='cheap'?'on':''}" data-tsm="cheap">&#127795; Easiest: the most common nodes</button>
      <button class="chip ${TQ.mode==='fast'?'on':''}" data-tsm="fast">&#9889; Fastest: most XP per node</button></div>
    <h2>Your plan</h2>
    <div class="tw"><table><thead><tr><th>Levels</th><th>Gather</th><th>XP each</th><th>How many</th><th>Spots in the world</th></tr></thead><tbody>${rows}</tbody></table></div>
    <div class="tssum slot"><div><b>${tsFmt(total)}</b> gathers in total</div><div class="dimtx small">Where each one is: the <a class="wl" data-note="Where to gather">Where to gather</a> page.</div></div>
    <p class="dimtx small">Easiest sticks to nodes with lots of spots around the map, so you spend less time looking. Fastest picks the most XP per node, which are usually rarer. Gathering gear, food and the trophies in your house add more XP on top.</p>
    <h2>Everything you can gather up to level ${to}</h2>
    <div class="tw"><table><thead><tr><th>Node</th><th>Level</th><th>XP each</th><th>Spots in the world</th><th>Respawn (about)</th></tr></thead><tbody>
    ${elig.slice(0,TQ.all?elig.length:40).map(o=>`<tr><td><span class="tsnode">${tsPic(o.icon??TSD.skills[sk].toolIcon,22,o.n)}${esc(o.n)}</span></td><td>${o.lv}</td><td>${tsFmt(o.xp)}</td><td>${o.spots?tsFmt(o.spots):'&ndash;'}</td><td>${o.respawn?o.respawn+' min':'&ndash;'}</td></tr>`).join('')}
    </tbody></table></div>${elig.length>40&&!TQ.all?`<button class="mini" data-tsall="1">Show all ${elig.length}</button>`:''}`;
}
function tsEvents(){
  const re=()=>openView('tslevel',false);
  document.querySelectorAll('[data-tssk]').forEach(b=>b.onclick=()=>{ TQ.sk=b.dataset.tssk; TQ.all=false; LS.set('nw_ts_sk',TQ.sk); re(); });
  document.querySelectorAll('[data-tsm]').forEach(b=>b.onclick=()=>{ TQ.mode=b.dataset.tsm; LS.set('nw_ts_mode',TQ.mode); re(); });
  document.querySelectorAll('[data-tsl]').forEach(i=>i.onchange=()=>{ const v=Math.max(0,Math.min(250,parseInt(i.value)||0)); TQ[i.dataset.tsl]=v;
    if(TQ.to<=TQ.from) TQ.to=Math.min(250,TQ.from+1); LS.set('nw_ts_from',TQ.from); LS.set('nw_ts_to',TQ.to); re(); });
  document.querySelectorAll('[data-tsq]').forEach(b=>b.onclick=()=>{ const [a,c]=b.dataset.tsq.split('-').map(Number); TQ.from=a; TQ.to=c; LS.set('nw_ts_from',a); LS.set('nw_ts_to',c); re(); });
  document.querySelectorAll('[data-tsres]').forEach(c=>c.onchange=()=>{ TQ.research=c.checked; LS.set('nw_ts_res',TQ.research); re(); });
  document.querySelectorAll('[data-tsall]').forEach(b=>b.onclick=()=>{ TQ.all=true; re(); });
  document.querySelectorAll('[data-crgo]').forEach(a=>a.onclick=e=>{ e.preventDefault(); CQ.sel=a.dataset.crgo; CQ.all=true; LS.set('nw_craft_sel',CQ.sel); openView('craft'); });
}

/* ================= Admin → Security (owner only): settings check, activity log, access list, block list, sign everyone out ================= */
let SECD=null, SECERR='', SECLOAD=false, SECQ={log:'', all:false};
async function secLoad(force){
  if(SECLOAD||(SECD&&!force)) return; SECLOAD=true; SECERR='';
  try{ SECD=await ownerApi('sec_get'); }catch(e){ SECERR=e.message; }
  SECLOAD=false; if(current?.kind==='view'&&current.v==='admin'&&ADMTAB==='security') openView('admin',false);
}
const secWhen=t=>{ const d=new Date(t); return d.toLocaleDateString(undefined,{day:'numeric',month:'short'})+' '+d.toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit'}); };
const SECWHAT={login:'Logged in','owner: roles_set':"Changed an editor's roles",'owner: roledefs_set':'Changed what editor roles can edit','owner: prop_approve':'Approved a suggested change',
  'owner: prop_reject':'Turned down a suggested change','owner: prop_delete':'Deleted a suggested change','owner: publish':'Published a loadout','owner: reject':'Turned down a loadout','owner: remove':'Removed a community loadout',
  'owner: setdocs':'Edited site pages','owner: setbotconfig':'Changed bot settings','owner: botsetup':'Set up the Discord bot','owner: automodset':'Changed AutoMod','owner: advset':'Changed advanced rules','owner: liveset':'Changed live bot settings',
  'owner: rmpost':'Posted a role menu','owner: rmdelete':'Deleted a role menu','owner: announce':'Sent an announcement','owner: sec_block':'Blocked an account','owner: sec_unblock':'Unblocked an account','owner: sec_revoke':"Removed someone's access",
  'owner: sec_signout':'Signed everyone out','owner: sec_clearlog':'Cleared the activity log','editor: suggested a change':'Suggested a change','editor: withdrew a suggestion':'Withdrew a suggestion'};
const secWhat=w=>SECWHAT[w]||w.replace(/^owner: /,'');
const SECBADGE={ok:['&#10003;','ok','Good'],warn:['!','warn','Check this'],missing:['&#10007;','bad','Missing'],optional:['&ndash;','opt','Optional']};
function secHTML(){
  if(!SECD){ secLoad(); return SECERR?`<p class="bad">${esc(SECERR)}${/Unknown request|helper said 400/.test(SECERR)?' Paste the Version 13 helper (worker.js) into Cloudflare and deploy it to turn this tab on.':''}</p>`:'<p class="dimtx">Checking your settings&hellip;</p>'; }
  const H=SECD.health||[], bad=H.filter(h=>h.state==='missing').length, warn=H.filter(h=>h.state==='warn').length;
  const ed=Object.entries(SECD.editors||{}), bl=Object.entries(SECD.blocked||{});
  const q=SECQ.log.trim().toLowerCase();
  const log=(SECD.audit||[]).filter(a=>!q||(a.name+' '+a.id+' '+a.what+' '+secWhat(a.what)+' '+a.detail).toLowerCase().includes(q));
  const logins=(SECD.audit||[]).filter(a=>a.what==='login');
  const people={}; logins.forEach(a=>{ if(!people[a.id]) people[a.id]={name:a.name,last:a.at,n:0}; people[a.id].n++; });
  return `<div class="secgrid">
  <section class="slot secbox"><h3>&#129658; Settings check <span class="secsum ${bad?'bad':warn?'warn':'ok'}">${bad?bad+' missing':warn?warn+' to check':'All good'}</span></h3>
    <p class="dimtx small">What the helper (Version ${SECD.version}) can see in its Cloudflare settings. It shows set or missing only, never the secret values themselves.</p>
    <div class="tw"><table><tbody>${H.map(h=>{ const [ic,cl,tx]=SECBADGE[h.state]||SECBADGE.optional; return `<tr><td><span class="secst ${cl}" title="${tx}">${ic}</span></td><td><b>${esc(h.label)}</b><div class="dimtx tiny">${esc(h.note||'')}</div></td></tr>`; }).join('')}</tbody></table></div>
    <button class="mini" data-sec="refresh">&#8635; Check again</button></section>

  <section class="slot secbox"><h3>&#128101; Who has access</h3>
    <div class="tw"><table><thead><tr><th>Account</th><th>Access</th><th></th></tr></thead><tbody>
      ${(SECD.owners||[]).map(id=>`<tr><td>${esc((people[id]||{}).name||'Site owner')}<div class="dimtx tiny">${esc(id)}</div></td><td><span class="role-o">Owner</span></td><td class="dimtx tiny">Set in Cloudflare (OWNER_DISCORD_ID)</td></tr>`).join('')}
      ${ed.map(([id,v])=>`<tr><td>${esc(v.name||id)}<div class="dimtx tiny">${esc(id)}</div></td><td>Editor: ${esc((v.roles||[]).join(', '))}</td><td><button class="mini danger" data-sec="revoke" data-id="${esc(id)}" data-name="${esc(v.name||id)}">Remove access</button></td></tr>`).join('')}
      ${ed.length?'':'<tr><td colspan="3" class="dimtx">No editors yet. Add them on the Editors tab.</td></tr>'}
    </tbody></table></div></section>

  <section class="slot secbox"><h3>&#128683; Blocked accounts</h3>
    <p class="dimtx small">A blocked Discord account can still read the site, but can't send ideas or problems, suggest changes, submit loadouts or save favourites.</p>
    <div class="secform"><input id="secbid" placeholder="Discord ID (17–20 digits)" inputmode="numeric"><input id="secbname" placeholder="Name (for your reference)"><input id="secbwhy" placeholder="Reason (optional)"><button class="mini go" data-sec="block">Block</button></div>
    <div class="tw"><table><tbody>${bl.length?bl.map(([id,v])=>`<tr><td><b>${esc(v.name||id)}</b><div class="dimtx tiny">${esc(id)} &middot; blocked ${secWhen(v.at)}${v.why?' &middot; '+esc(v.why):''}</div></td><td><button class="mini" data-sec="unblock" data-id="${esc(id)}">Unblock</button></td></tr>`).join(''):'<tr><td class="dimtx">Nobody is blocked.</td></tr>'}</tbody></table></div></section>

  <section class="slot secbox"><h3>&#128682; Sign everyone out</h3>
    <p class="small">Use this if you think someone's login was misused or a secret leaked. Every account, yours too, is logged out at once and has to log in with Discord again. Nothing else is lost: favourites, roles and suggestions stay.</p>
    ${SECD.epoch?`<p class="dimtx tiny">Last used ${secWhen(SECD.epoch)}.</p>`:''}
    <button class="mini danger" data-sec="signout">Sign everyone out</button>
    <h3 style="margin-top:16px">&#9201; Limits on each account</h3>
    <div class="tw"><table><tbody>${Object.entries(SECD.limits||{}).map(([k,[n,s]])=>`<tr><td>${({favs:'Saving favourites',feedback:'Ideas and problems',editor:'Suggested changes',submit:'Loadout submissions'})[k]||k}</td><td>${n} every ${s>=3600?(s/3600)+' hour'+(s>3600?'s':''):(s/60)+' minutes'}</td></tr>`).join('')}</tbody></table></div></section>
  </div>

  <section class="slot secbox"><h3>&#128220; Activity log <span class="dimtx small">(latest ${(SECD.audit||[]).length} of up to 500)</span></h3>
    <p class="dimtx small">Logins, everything you change on the Admin page, and editors' suggestions. ${Object.keys(people).length} different accounts have logged in since the log started.</p>
    <div class="secform"><input id="seclogq" placeholder="Filter by name, Discord ID or action" value="${esc(SECQ.log)}"><button class="mini" data-sec="clearlog">Clear the log</button></div>
    <div class="tw"><table><thead><tr><th>When</th><th>Who</th><th>What</th><th>Details</th></tr></thead><tbody>
    ${log.slice(0,SECQ.all?log.length:60).map(a=>`<tr><td class="nowrap">${secWhen(a.at)}</td><td>${esc(a.name)}<div class="dimtx tiny">${esc(a.id)}</div></td><td>${esc(secWhat(a.what))}</td><td class="small">${esc(a.detail||'')}</td></tr>`).join('')||'<tr><td colspan="4" class="dimtx">Nothing logged yet.</td></tr>'}
    </tbody></table></div>${log.length>60&&!SECQ.all?`<button class="mini" data-sec="logall">Show all ${log.length}</button>`:''}</section>`;
}
function secEvents(){
  const busy=async(fn,okMsg)=>{ try{ await fn(); if(okMsg) toast(okMsg); await secLoad(true); }catch(e){ toast(e.message); } };
  document.querySelectorAll('[data-sec]').forEach(b=>b.onclick=()=>{ const a=b.dataset.sec;
    if(a==='refresh') busy(async()=>{},'Checked');
    if(a==='block'){ const id=document.getElementById('secbid').value.trim(); if(!/^\d{15,22}$/.test(id)){ toast('Enter their Discord ID (17 to 20 digits)'); return; }
      busy(()=>ownerApi('sec_block',{id,name:document.getElementById('secbname').value,why:document.getElementById('secbwhy').value}),'Blocked'); }
    if(a==='unblock') busy(()=>ownerApi('sec_unblock',{id:b.dataset.id}),'Unblocked');
    if(a==='revoke'){ if(!confirmInline(b,`Remove ${b.dataset.name}'s editor access?`)) return; busy(()=>ownerApi('sec_revoke',{id:b.dataset.id}),'Access removed'); }
    if(a==='signout'){ if(!confirmInline(b,'Really sign everyone out, you included?')) return;
      ownerApi('sec_signout').then(()=>{ toast('Everyone has been signed out. Log in again with Discord.'); LS.del('nw_discord'); setTimeout(()=>location.reload(),1500); }).catch(e=>toast(e.message)); }
    if(a==='clearlog'){ if(!confirmInline(b,'Clear the whole activity log?')) return; busy(()=>ownerApi('sec_clearlog'),'Log cleared'); }
    if(a==='logall'){ SECQ.all=true; openView('admin',false); }
  });
  const q=document.getElementById('seclogq'); if(q) q.oninput=()=>{ SECQ.log=q.value; const pos=q.selectionStart; openView('admin',false); const n=document.getElementById('seclogq'); if(n){ n.focus(); n.setSelectionRange(pos,pos); } };
}
/* two-click confirm on the button itself (no pop-up dialogs) */
function confirmInline(btn,msg){
  if(btn.dataset.armed==='1') return true;
  btn.dataset.armed='1'; const old=btn.textContent; btn.textContent=msg+' Click again'; btn.classList.add('armed');
  setTimeout(()=>{ if(btn.isConnected){ btn.dataset.armed=''; btn.textContent=old; btn.classList.remove('armed'); } },5000);
  return false;
}

/* ================= Comments and star ratings (builds and community loadouts), stored by the helper in its D1 database ================= */
let TALKSUM=null, TALKSUMAT=0;
const TALK={};   // target -> loaded data
async function talkApi(body){
  const r=await fetch(CFG.worker+'/talk',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pass:(typeof dPass==='function'&&dPass())||undefined,...body})});
  let d={}; try{ d=await r.json(); }catch(e){}
  if(!r.ok) throw Object.assign(new Error(d.error||('error '+r.status)),{status:r.status});
  return d;
}
const talkOn=()=>typeof CFG!=='undefined'&&!!CFG.worker;
/* star averages for the build browser (refreshed every few minutes) */
function talkSummary(){
  if(!talkOn()||(TALKSUM&&Date.now()-TALKSUMAT<180000)) return;
  TALKSUMAT=Date.now();
  talkApi({op:'summary'}).then(d=>{ TALKSUM=d.items||{}; if(current&&current.kind==='view'&&current.v==='builds') openView('builds',false); }).catch(()=>{ TALKSUM={}; });
}
function talkBadge(target){
  const s=TALKSUM&&TALKSUM[target]; if(!s||(!s.n&&!s.c)) return '';
  return `<span class="talkbadge">${s.n?`<span class="stars-s" title="${s.avg} out of 5 from ${s.n} rating${s.n>1?'s':''}">&#9733; ${(+s.avg).toFixed(1)} <i>(${s.n})</i></span>`:''}${s.c?`<span title="${s.c} comment${s.c>1?'s':''}">&#128172; ${s.c}</span>`:''}</span>`;
}
/* the widget: a placeholder that fills itself in */
function talkSlot(target,title){ return talkOn()?`<section class="talk" data-talk="${esc(target)}" data-talktitle="${esc(title||'')}"><p class="dimtx small">Loading ratings and comments&hellip;</p></section>`:''; }
function talkMount(root){
  (root||document).querySelectorAll('section.talk[data-talk]').forEach(el=>{
    const t=el.dataset.talk; if(el.dataset.mounted===t) return; el.dataset.mounted=t;
    talkApi({op:'get',target:t}).then(d=>{ TALK[t]=d; talkRender(el); }).catch(e=>{ el.innerHTML=e.status===503?'':`<p class="dimtx small">Couldn't load comments (${esc(e.message)}).</p>`; });
  });
}
function talkAgo(t){ const s=(Date.now()-t)/1000; if(s<60) return 'just now'; if(s<3600) return Math.floor(s/60)+' min ago'; if(s<86400) return Math.floor(s/3600)+' h ago'; if(s<86400*30) return Math.floor(s/86400)+' d ago'; return new Date(t).toLocaleDateString(); }
function talkAv(c){ return c.av?`<img class="talkav" src="https://cdn.discordapp.com/avatars/${esc(c.uid)}/${esc(c.av)}.png?size=64" alt="" loading="lazy">`:`<span class="talkav none">${esc((c.name||'?')[0].toUpperCase())}</span>`; }
function talkRender(el){
  const t=el.dataset.talk, d=TALK[t]; if(!d) return;
  const u=typeof dUser==='function'?dUser():null;
  const stars=n=>[1,2,3,4,5].map(i=>`<button type="button" class="star ${i<=n?'on':''}" data-talkrate="${i}" aria-label="${i} star${i>1?'s':''}" title="${u?(d.mine===i?'Click again to remove your rating':'Rate '+i+' out of 5'):'Log in with Discord to rate'}">&#9733;</button>`).join('');
  const avg=d.n?`<span class="stars-big" aria-label="${d.avg} out of 5">${[1,2,3,4,5].map(i=>`<span class="${i<=Math.round(d.avg)?'on':''}">&#9733;</span>`).join('')}</span> <b>${(+d.avg).toFixed(1)}</b> <span class="dimtx">from ${d.n} rating${d.n>1?'s':''}</span>`:'<span class="dimtx">No ratings yet</span>';
  el.innerHTML=`<h2>Ratings and comments</h2>
    <div class="talkrate"><div>${avg}</div><div class="talkmine"><span class="fl">${u?(d.mine?'Your rating':'Rate it'):'Rate it'}</span><span class="starrow">${stars(d.mine||0)}</span></div></div>
    ${u?`<div class="talkform"><textarea maxlength="1000" rows="3" placeholder="Share how it plays, what you changed, or a tip for others…" data-talkbox></textarea>
        <div class="talkfoot"><span class="dimtx tiny" data-talkcount>0 / 1000</span><button class="mini go" data-talkpost>Post comment</button></div></div>`
      :`<div class="talkform guest"><p>Log in with Discord to rate this and join the conversation.</p><a class="dbtn" href="${esc(loginHref())}" data-favlogin="1">Log in with Discord</a></div>`}
    <div class="talklist">${d.comments.length?d.comments.map(c=>`<div class="talkc" data-cid="${c.id}">${talkAv(c)}<div class="talkb">
        <div class="talkh"><b>${esc(c.name)}</b><span class="dimtx tiny">${talkAgo(c.at)}</span>
          <span class="talkact">${u&&(c.uid===u.id||d.owner)?`<button class="linkbtn" data-talkdel="${c.id}">Delete</button>`:''}${u&&c.uid!==u.id?`<button class="linkbtn" data-talkrep="${c.id}">Report</button>`:''}</span></div>
        <div class="talktext">${esc(c.body).replace(/\n/g,'<br>')}</div></div></div>`).join(''):'<p class="dimtx">No comments yet. Be the first.</p>'}</div>
    <p class="dimtx tiny">Comments are public and show your Discord display name and picture. Be kind: the site owner removes anything abusive.</p>`;
  talkEvents(el);
}
function talkEvents(el){
  const t=el.dataset.talk, d=TALK[t];
  const box=el.querySelector('[data-talkbox]'), cnt=el.querySelector('[data-talkcount]');
  if(box) box.oninput=()=>{ cnt.textContent=box.value.length+' / 1000'; };
  const post=el.querySelector('[data-talkpost]');
  if(post) post.onclick=()=>{ const v=box.value.trim(); if(v.length<2){ toast('Write a little more first'); return; } post.disabled=true;
    talkApi({op:'add',target:t,body:v}).then(r=>{ d.comments.unshift(r.comment); talkRender(el); toast('Comment posted'); TALKSUMAT=0; })
      .catch(e=>{ toast(e.message); post.disabled=false; }); };
  el.querySelectorAll('[data-talkrate]').forEach(b=>b.onclick=()=>{
    if(!(typeof dUser==='function'&&dUser())){ toast('Log in with Discord to rate'); return; }
    const n=+b.dataset.talkrate, st=d.mine===n?0:n;
    talkApi({op:'rate',target:t,stars:st}).then(r=>{ Object.assign(d,{avg:r.avg,n:r.n,mine:r.mine}); talkRender(el); toast(st?`Rated ${st} out of 5`:'Rating removed'); TALKSUMAT=0; }).catch(e=>toast(e.message)); });
  el.querySelectorAll('[data-talkdel]').forEach(b=>b.onclick=()=>{
    if(b.dataset.armed!=='1'){ b.dataset.armed='1'; b.textContent='Click again to delete'; return; }
    talkApi({op:'del',id:+b.dataset.talkdel}).then(()=>{ d.comments=d.comments.filter(c=>c.id!==+b.dataset.talkdel); talkRender(el); toast('Comment deleted'); TALKSUMAT=0; }).catch(e=>toast(e.message)); });
  el.querySelectorAll('[data-talkrep]').forEach(b=>b.onclick=()=>{
    if(b.dataset.armed!=='1'){ b.dataset.armed='1'; b.textContent='Report to the site owner?'; return; }
    talkApi({op:'report',id:+b.dataset.talkrep}).then(()=>{ b.replaceWith(Object.assign(document.createElement('span'),{className:'dimtx tiny',textContent:'Reported, thanks'})); }).catch(e=>toast(e.message)); });
}
/* Admin tab: newest and reported comments */
let TALKMOD=null, TALKMODERR='';
function talkModHTML(){
  if(!TALKMOD){ talkApi({op:'mod'}).then(d=>{ TALKMOD=d.comments||[]; }).catch(e=>{ TALKMOD=[]; TALKMODERR=e.message; }).finally(()=>{ if(current?.kind==='view'&&current.v==='admin') openView('admin',false); });
    return '<p class="dimtx">Loading comments&hellip;</p>'; }
  if(TALKMODERR) return `<p class="bad">${esc(TALKMODERR)}${/switched on/.test(TALKMODERR)?' Add the D1 database binding (DB → nw-vault-talk) to the helper in Cloudflare.':''}</p>`;
  const where=t=>t.startsWith('note:')?`<a class="wl" data-note="${esc(t.slice(5))}">${esc(t.slice(5))}</a>`:`Community loadout ${esc(t.slice(3))}`;
  return `<p class="dimtx small">Newest comments first, with anything people reported at the top. Deleting removes it for everyone.</p>
  <div class="tw"><table><thead><tr><th>When</th><th>Who</th><th>Where</th><th>Comment</th><th></th></tr></thead><tbody>
  ${TALKMOD.map(c=>`<tr class="${c.reports?'talkreported':''}"><td class="nowrap">${talkAgo(c.at)}</td><td>${esc(c.name)}<div class="dimtx tiny">${esc(c.uid)}</div></td><td class="small">${where(c.target)}</td>
    <td class="small">${c.reports?`<b class="bad">${c.reports} report${c.reports>1?'s':''}</b> `:''}${esc(c.body)}</td><td><button class="mini danger" data-moddel="${c.id}">Delete</button></td></tr>`).join('')||'<tr><td colspan="5" class="dimtx">No comments yet.</td></tr>'}
  </tbody></table></div>`;
}
function talkModEvents(){
  document.querySelectorAll('[data-moddel]').forEach(b=>b.onclick=()=>{
    if(b.dataset.armed!=='1'){ b.dataset.armed='1'; b.textContent='Click again'; return; }
    talkApi({op:'del',id:+b.dataset.moddel}).then(()=>{ TALKMOD=TALKMOD.filter(c=>c.id!==+b.dataset.moddel); openView('admin',false); toast('Comment deleted'); }).catch(e=>toast(e.message)); });
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
        for(let k=0;k<ITEMDB.sheets;k++) SPRITES.push('items_'+k+'.webp?v='+ITEMDB.tile); } catch(e){ ITEMDB = null; }
  try { PRESETS = await (await fetch('gear_presets.json')).json(); } catch(e){ PRESETS = null; }
  try { NOTEICO = await (await fetch('noteicons.json')).json(); NOTEICO.urls=[]; for(let k=0;k<NOTEICO.sheets;k++) NOTEICO.urls.push('noteicons_'+k+'.webp?v='+NOTEICO.tile); } catch(e){ NOTEICO = null; }
  try{ if(typeof loadTS==='function') await loadTS(); }catch(e){}
  if(typeof loadCommunity==='function') await loadCommunity();
  try { TREES = await (await fetch('trees.json')).json(); } catch(e){ TREES = null; }
  reindex(); topnav(); if(typeof renderAcct==='function') renderAcct();
  const h=(location.hash||'').replace('#','');
  if(typeof handleAuthHash==='function' && handleAuthHash(h)){}
  else if(h.startsWith('lo=') && typeof openSharedLo==='function'){ openView('gear',false); openSharedLo(h.slice(3)); }
  else if(h.startsWith('c=') && typeof openSharedLo==='function'){ const x=(typeof COMMUNITY!=='undefined'?COMMUNITY:[]).find(c=>h32(c.code)===h.slice(2)); openView('gear',false);
    if(x) openSharedLo(x.code); else toast('That loadout was only just published. Give it a minute and reload.'); }
  else if(h.startsWith('craft=')){ CQ.sel=decodeURIComponent(h.slice(6)); CQ.all=true; openView('craft',false); }
  else if(['builds','bosses','calc','gear','items','myloadouts','review','admin','craft','weight','trophyplanner','favs','feedback','editor','changelog','tslevel'].includes(h)) openView(h,false);
  else {
    const hit=Object.keys(NAMES).find(n=>slug(n)===h);
    openNote(hit||((typeof SITE!=='undefined'&&NAMES[SITE.start])?SITE.start:'New World Home'),false);
  }
  initCustom();
  // a copy with env.json {"env":"staging"} is the test copy: say so loudly
  try{ const env=await (await fetch('env.json',{cache:'no-store'})).json();
    if(env&&env.env==='staging'){ document.body.classList.add('staging'); const s=document.createElement('div'); s.id='stagebar'; s.textContent='STAGING COPY: for testing new features. Nothing here is live.'; document.body.prepend(s); } }catch(e){}
})();
