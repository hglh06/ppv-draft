/* PPV Draft League · app del rediseno conectada a Supabase.
   Los datos llegan en window.PPV (ver src/data.js) con las mismas formas que usaba el prototipo. */
const PPV=window.PPV;
const safe=(f,name)=>{try{return f();}catch(e){console.warn("[PPV] seccion "+(name||"")+":",e);}};
const SEASON_N=PPV.SEASON.number,SEASON_LABEL=`Temporada ${PPV.SEASON.number}${PPV.SEASON.subtitle?" · "+PPV.SEASON.subtitle:""}`;
const MAXP=PPV.RULES.max_points,PO_PER_CONF=Math.max(1,Math.round((PPV.RULES.playoff_teams||8)/2));
// Datos reales de la fase regular (ppvdraftleague.com/standings).
const TEAMS=PPV.TEAMS;
const MONS=PPV.MONS;
// Sprites de 5.a generacion (Black/White) de PokeAPI: sprites fijos
const SPR_BASE="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/";
const SPR_IDS={"Mantine":226,"Totodile":158,"Rillaboom":812,"Ninetales":38,"Cloyster":91,"Typhlosion":157,"Rhyhorn":111,"Wobbuffet":202,"Dialga":483,"Rowlet":722,"Maushold":925,"Paldean Tauros Aqua":10252,"Bellibolt":939,"Ceruledge":937,"Basculegion-Female":10248,"Palafin":964,"Paldean Tauros Blaze":10251,"Hydrapple":1019,"Kingambit":983,"Archaludon":1018,"Armarouge":936,"Glimmora":970,"Scovillain":952,"Skeledirge":911,"Runerigus":867,"Wyrdeer":899,"Kleavor":900,"Ditto":132,"Basculegion-Male":902,"Tinkaton":959,"Sinistcha":1013,"Espathra":956,"Garganacl":934,"Orthworm":968,"Sneasler":903,"Hisuian Zoroark":10239,"Hisuian Typhlosion":10233,"Dragapult":887,"Hisuian Goodra":10242,"Hatterene":858,"Mr. Rime":866,"Corviknight":823,"Hisuian Samurott":10236,"Meowscarada":908,"Morpeko":877,"Floette":670,"Araquanid":752,"Mudsdale":750,"Toucannon":733,"Aegislash":681,"Toxapex":748,"Farigiraf":981,"Hisuian Arcanine":10230,"Tsareena":763,"Vivillon":666,"Primarina":730,"Galarian Slowbro":10165,"Galarian Slowking":10172,"Alolan Ninetales":10104,"Mimikyu":778,"Heliolisk":695,"Talonflame":663,"Klefki":707,"Alolan Raichu":10100,"Vanilluxe":584,"Oranguru":765,"Incineroar":727,"Drampa":780,"Whimsicott":547,"Salazzle":758,"Chandelure":609,"Meowstic Female":10025,"Kommo-o":784,"Greninja":658,"Sylveon":700,"Aurorus":699,"Meowstic Male":678,"Chesnaught":652,"Excadrill":530,"Liepard":510,"Delphox":655,"Rotom-Wash":10009,"Volcarona":637,"Rotom-Heat":10008,"Rotom-Fan":10011,"Conkeldurr":534,"Emboar":500,"Hawlucha":701,"Noivern":715,"Golurk":623,"Reuniclus":579,"Rotom-Mow":10012,"Rotom-Frost":10010,"Hydreigon":635,"Krookodile":553,"Hippowdon":450,"Mamoswine":473,"Rampardos":409,"Manectric":310,"Lopunny":428,"Pidgeot":18,"Garchomp":445,"Ariados":168,"Gliscor":472,"Pelipper":279,"Milotic":350,"Empoleon":395,"Froslass":478,"Infernape":392,"Banette":354,"Politoed":186,"Arcanine":59,"Umbreon":197,"Toxicroak":454,"Torkoal":324,"Skarmory":227,"Starmie":121,"Meganium":154,"Chimecho":358,"Scizor":212,"Raichu":26,"Jolteon":135,"Rhyperior":464,"Altaria":334,"Azumarill":184,"Gardevoir":282,"Gallade":475,"Aerodactyl":142,"Pikachu":25,"Heracross":214,"Gyarados":130,"Sableye":302,"Aggron":306,"Venusaur":3,"Slowking":199,"Alakazam":65,"Gengar":94,"Tyranitar":248,"Blastoise":9,"Charizard":6,"Clefable":36,"Kangaskhan":115,"Dragonite":149,"Slowbro":80,"Snorlax":143};
const spr=(n,cls="spr")=>SPR_IDS[n]?`<img class="${cls}" src="${SPR_BASE}${SPR_IDS[n]}.png" alt="" loading="lazy" decoding="async">`:(PPV.SPRITE[n]?`<img class="${cls} boxi" src="${PPV.SPRITE[n]}" alt="" loading="lazy" decoding="async">`:"");
// Sprites de caja (PC) para los lugares pequeños: Autumnchi/coloured-box-sprites
const BOX_BASE="https://raw.githubusercontent.com/Autumnchi/coloured-box-sprites/main/";
const BOX={"Charizard":"charizard","Floette":"floette","Gengar":"gengar","Incineroar":"incineroar","Tyranitar":"tyranitar","Whimsicott":"whimsicott","Dragonite":"dragonite","Garchomp":"garchomp","Gardevoir":"gardevoir","Kangaskhan":"kangaskhan","Kingambit":"kingambit","Pelipper":"pelipper","Sinistcha":"sinistcha","Sneasler":"sneasler","Volcarona":"volcarona","Aegislash":"aegislash","Aerodactyl":"aerodactyl","Archaludon":"archaludon","Clefable":"clefable","Excadrill":"excadrill","Farigiraf":"farigiraf","Froslass":"froslass","Gallade":"gallade","Glimmora":"glimmora","Gyarados":"gyarados","Starmie":"starmie","Venusaur":"venusaur","Alolan Ninetales":"ninetales-alola","Arcanine":"arcanine","Basculegion-Male":"basculegion","Dragapult":"dragapult","Hisuian Typhlosion":"typhlosion-hisui","Maushold":"maushold","Meganium":"meganium","Palafin":"palafin","Primarina":"primarina","Talonflame":"talonflame","Banette":"banette","Blastoise":"blastoise","Chandelure":"chandelure","Delphox":"delphox","Drampa":"drampa","Feraligatr":"feraligatr","Greninja":"greninja","Heracross":"heracross","Hisuian Zoroark":"zoroark-hisui","Lopunny":"lopunny","Lucario":"lucario","Manectric":"manectric","Medicham":"medicham","Milotic":"milotic","Politoed":"politoed","Rotom-Wash":"rotom-wash","Scizor":"scizor","Sharpedo":"sharpedo","Slowbro":"slowbro","Torkoal":"torkoal","Corviknight":"corviknight","Hatterene":"hatterene","Hisuian Arcanine":"arcanine-hisui","Mamoswine":"mamoswine","Meowscarada":"meowscarada","Mimikyu":"mimikyu","Rotom-Heat":"rotom-heat","Sylveon":"sylveon","Vivillon":"vivillon","Abomasnow":"abomasnow","Aggron":"aggron","Alakazam":"alakazam","Altaria":"altaria","Ampharos":"ampharos","Azumarill":"azumarill","Beedrill":"beedrill","Camerupt":"camerupt","Conkeldurr":"conkeldurr","Crabominable":"crabominable","Ditto":"ditto","Empoleon":"empoleon","Galarian Slowbro":"slowbro-galar","Galarian Slowking":"slowking-galar","Garganacl":"garganacl","Golurk":"golurk","Hawlucha":"hawlucha","Hippowdon":"hippowdon","Hisuian Goodra":"goodra-hisui","Houndoom":"houndoom","Hydreigon":"hydreigon","Klefki":"klefki","Liepard":"liepard","Meowstic Male":"meowstic","Oranguru":"oranguru","Orthworm":"orthworm","Pinsir":"pinsir","Sableye":"sableye","Serperior":"serperior","Weavile":"weavile","Araquanid":"araquanid","Armarouge":"armarouge","Basculegion-Female":"basculegion-f","Kommo-o":"kommo-o","Meowstic Female":"meowstic-f","Paldean Tauros Aqua":"tauros-paldea-water","Paldean Tauros Blaze":"tauros-paldea-fire","Scovillain":"scovillain","Slowking":"slowking","Snorlax":"snorlax","Tsareena":"tsareena","Umbreon":"umbreon","Wyrdeer":"wyrdeer","Absol":"absol","Alcremie":"alcremie","Beartic":"beartic","Ceruledge":"ceruledge","Chesnaught":"chesnaught","Chimecho":"chimecho","Clawitzer":"clawitzer","Emboar":"emboar","Espathra":"espathra","Glalie":"glalie","Goodra":"goodra","Hisuian Decidueye":"decidueye-hisui","Hydrapple":"hydrapple","Infernape":"infernape","Kleavor":"kleavor","Krookodile":"krookodile","Machamp":"machamp","Ninetales":"ninetales","Noivern":"noivern","Pidgeot":"pidgeot","Raichu":"raichu","Reuniclus":"reuniclus","Rhyperior":"rhyperior","Rotom-Mow":"rotom-mow","Salazzle":"salazzle","Skarmory":"skarmory","Skeledirge":"skeledirge","Steelix":"steelix","Tinkaton":"tinkaton","Toxicroak":"toxicroak","Vanilluxe":"vanilluxe","Victreebel":"victreebel","Zoroark":"zoroark","Alolan Raichu":"raichu-alola","Audino":"audino","Diggersby":"diggersby","Glaceon":"glaceon","Hisuian Samurott":"samurott-hisui","Leafeon":"leafeon","Mudsdale":"mudsdale","Pangoro":"pangoro","Passimian":"passimian","Quaquaval":"quaquaval","Rotom-Frost":"rotom-frost","Toxapex":"toxapex","Typhlosion":"typhlosion","Aromatisse":"aromatisse","Hisuian Avalugg":"avalugg-hisui","Jolteon":"jolteon","Luxray":"luxray","Lycanroc (Midday)":"lycanroc","Lycanroc (Midnight)":"lycanroc-midnight","Pikachu":"pikachu","Polteageist":"polteageist","Runerigus":"runerigus","Simipour":"simipour","Simisage":"simisage","Simisear":"simisear","Toucannon":"toucannon","Trevenant":"trevenant","Vaporeon":"vaporeon","Appletun":"appletun","Arbok":"arbok","Aurorus":"aurorus","Avalugg":"avalugg","Bastiodon":"bastiodon","Bellibolt":"bellibolt","Cofagrigus":"cofagrigus","Decidueye":"decidueye","Espeon":"espeon","Flapple":"flapple","Flareon":"flareon","Florges":"florges","Furfrou":"furfrou","Gliscor":"gliscor","Gourgeist":"gourgeist","Heliolisk":"heliolisk","Lycanroc (Dusk)":"lycanroc-dusk","Morpeko":"morpeko","Mr. Rime":"mr-rime","Rampardos":"rampardos","Roserade":"roserade","Rotom-Fan":"rotom-fan","Samurott":"samurott","Sandaconda":"sandaconda","Tauros":"tauros","Torterra":"torterra","Tyrantrum":"tyrantrum","Ariados":"ariados","Castform":"castform","Dedenne":"dedenne","Emolga":"emolga","Forretress":"forretress","Galarian Stunfisk":"stunfisk-galar","Garbodor":"garbodor","Rotom":"rotom","Slurpuff":"slurpuff","Spiritomb":"spiritomb","Stunfisk":"stunfisk","Watchog":"watchog"};
const BOX_DATA={};
const box=(n,cls="")=>BOX[n]?`<img class="${cls} boxi" src="${BOX_DATA[BOX[n]]||BOX_BASE+BOX[n]+".png"}" alt="" loading="lazy" decoding="async">`:spr(n,cls);
document.addEventListener("error",e=>{const t=e.target;if(t&&t.tagName==="IMG"&&/spr|mvp-art|boxi/.test(t.className))t.remove();},true);
const CONF=PPV.CONF;

const ME=PPV.ME;
if(ME<0)TEAMS[-1]={n:"Invitado",c:"rojo",w:0,l:0,d:0,h:[0,0],ph:true,id:null};
// abreviaciones: primeras 3 consonantes; si el nombre empieza con vocal, esa vocal es la inicial (de palabras cortas como Los/La/Di solo la inicial; si se repite, se usa la siguiente consonante)
const ABBR=PPV.ABBR;
TEAMS.forEach((t,i)=>{t.pts=t.w*PPV.RULES.points_win+t.l*PPV.RULES.points_loss;t.ab=ABBR[i];});if(ME<0){TEAMS[-1].pts=0;TEAMS[-1].ab="";}
["rojo","azul"].forEach(c=>TEAMS.filter(t=>t.c===c).forEach((t,i)=>{t.rank=i+1;t.q=PPV.HAS_GAMES&&i<PO_PER_CONF;}));

const esc=s=>s.replace(/[&<>"]/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[m]));
const initials=n=>n.ph?"?":n.n.replace(/^(Los|Las|La|El)\s+/i,"").split(/\s+/).slice(0,2).map(w=>w[0]).join("").toUpperCase();
const slug=t=>t.n.toLowerCase().replace(/\s+/g,"-");
const LOGO_FILE={"richampions-vgc":"richampions-vgc.png","los-diggers":"diggers.webp"}; // logos que no son .webp
const LOGOS={};TEAMS.forEach(t=>{LOGOS[slug(t)]=t.logoLocal?"logos/"+t.logoLocal:t.logo;});
const crest=t=>!t?"":t.ph||!LOGOS[slug(t)]?hexCrest(t):`<span class="logo lg-${slug(t)}" aria-hidden="true"><img src="${LOGOS[slug(t)]}" alt="" loading="lazy" decoding="async"></span>`;window.__crest=crest;
const hexCrest=t=>`<span class="crest" style="--h1:hsl(${t.h[0]} 85% 62%);--h2:hsl(${t.h[1]} 80% 42%)" aria-hidden="true">${initials(t)}</span>`;
const by=c=>TEAMS.filter(t=>t.c===c);

/* ---------- explicaciones de stats (tooltips) ---------- */
const TIPS={
  diff:"Balance de KOs: Pokemon rivales derrotados menos Pokemon propios perdidos en toda la temporada. Sirve como desempate.",
  pts:"Puntos de liga: 3 por cada serie ganada.",
  wl:"Series ganadas y perdidas. Cada serie es al mejor de 3 juegos.",
  pj:"Series jugadas.",
  wp:"Porcentaje de series ganadas.",
  gw:"Juegos individuales ganados y perdidos dentro de las series.",
  kd:"K/D: KOs hechos entre las veces que cayo. Mas de 1 significa que derrota mas de lo que cae.",
  kills:"Total de KOs que han hecho los Pokemon del roster actual.",
  draftpts:`Puntos usados del presupuesto de ${PPV.RULES.max_points} para armar el roster.`,
  power:"Power ranking: 3 por serie ganada, 0.6 por cada juego de diferencia, 1.5 por victoria en las ultimas 3 semanas y hasta 4 por la fuerza de los rivales enfrentados.",
  cover:"Cobertura: cuantos Pokemon del roster golpean con ventaja (2x o mas) a cada tipo usando sus propios tipos (STAB).",
  adv:"Ventaja de tipos: porcentaje de duelos uno a uno en los que el Pokemon golpea con ventaja al rival usando sus propios tipos."
};
/* proximo evento de la liga (cuenta regresiva en Home y en el ticker): editar nombre y fecha */
const NEXT_EVENT=PPV.NEXT_EVENT||{label:SEASON_LABEL,at:null};
const MES=["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
const fmtEvent=()=>{if(!NEXT_EVENT.at)return "Fecha por anunciar";const d=new Date(NEXT_EVENT.at);return `${d.getDate()} ${MES[d.getMonth()]} · ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")} hrs`;};
const tipEl=document.createElement("div");tipEl.className="tipbox";tipEl.hidden=true;tipEl.setAttribute("role","tooltip");document.body.appendChild(tipEl);
let tipT;
function showTip(el){const k=el.dataset.tip;tipEl.textContent=TIPS[k]||k;tipEl.hidden=false;
  const r=el.getBoundingClientRect(),w=tipEl.offsetWidth,h=tipEl.offsetHeight;
  const x=Math.max(8,Math.min(innerWidth-w-8,r.left+r.width/2-w/2));let y=r.top-h-10;if(y<72)y=r.bottom+10;
  tipEl.style.left=x+"px";tipEl.style.top=y+"px";}
const hideTip=()=>{tipEl.hidden=true;};
const TOUCH=matchMedia("(hover:none)");
document.addEventListener("pointerover",e=>{if(e.pointerType==="touch")return;const el=e.target.closest("[data-tip]");if(el)showTip(el);});
document.addEventListener("pointerout",e=>{const el=e.target.closest("[data-tip]");if(el&&!el.contains(e.relatedTarget))hideTip();});
document.addEventListener("focusin",e=>{const el=e.target.closest("[data-tip]");if(el&&!TOUCH.matches)showTip(el);});
document.addEventListener("focusout",hideTip);
document.addEventListener("click",e=>{const el=e.target.closest("[data-tip]");if(!el||!TOUCH.matches)return;showTip(el);clearTimeout(tipT);tipT=setTimeout(hideTip,3200);});
addEventListener("scroll",hideTip,{passive:true});

const STIP={pj:"pj",d:"diff",wp:"wp",pts:"pts"};

/* ticker */
const tk=TEAMS.filter(t=>t.q).map(t=>`<span><b>#${t.ab}</b> ${CONF[t.c].name} ${t.rank}º · ${t.w}-${t.l} · ${t.d>0?"+":""}${t.d}</span>`).join("")+MONS.slice(0,3).map(m=>`<span>Leaderboard · <b>${m[0]}</b> ${m[1]} KOs</span>`).join("");
const tkE=PPV.IS_ARCHIVE?"":`<span>Proximo · <b>${esc(NEXT_EVENT.label)}</b> · ${fmtEvent()}</span>`;document.getElementById("ticker").innerHTML=tkE+tk+tkE+tk;


/* standings */
document.getElementById("tables").innerHTML=["rojo","azul"].map(c=>`
 <div class="table" style="--c:${CONF[c].v}">
  <div class="th"><h3>${CONF[c].name}</h3><span class="label">Conferencia</span></div>
  <div class="rows">
   <div class="row hd"><span>#</span><span>Equipo</span><span data-tip="wl" tabindex="0">W-L</span><span data-tip="diff" tabindex="0">Diff</span><span style="text-align:right"><span data-tip="pts" tabindex="0">Pts</span></span></div>
   ${by(c).map(t=>`<div class="row ${t.q?"in":"out"} ${t.rank===5?"cut":""}">
     <span class="pos num">${t.rank}</span>
     <span class="tm">${crest(t)}<span class="full">${esc(t.n)}</span><span class="short">#${t.ab}</span></span>
     <span class="num">${t.w}-${t.l}</span>
     <span class="num">${t.d>0?"+":""}${t.d}</span>
     <span class="pts num">${t.pts}</span></div>`).join("")}
  </div></div>`).join("");

/* bars */
const max=(MONS[0]||[0,1])[1]||1;
document.getElementById("bars").innerHTML=MONS.map((m,i)=>`<div class="bar ${i===0?"top":""}"><span class="i num">${i+1}</span><span class="p">${box(m[0],"spr-s")}${m[0]}</span><span class="t"><i style="width:${m[1]/max*100}%;animation-delay:${i*.06}s"></i></span><span class="v num">${m[1]}</span></div>`).join("")+`<div class="note">Mejor K/D de la temporada: <strong style="color:var(--volt)">Ceruledge, 8.00</strong> (16 KOs, 2 caidas)</div>`;

/* teams page */
safe(()=>document.getElementById("confsum").innerHTML=["rojo","azul"].map(c=>{const l=by(c)[0]||{n:"Por definir",w:0,l:0,pts:0,d:0,ph:true,h:[0,0]};return `<div class="cs" style="--c:${CONF[c].v}"><div><span class="label">Conferencia</span><b style="color:${CONF[c].v}">${CONF[c].name}</b></div><div class="lead-t"><span class="label">${by(c).length} equipos · Lider</span><div>${esc(l.n)} ${l.w}-${l.l}</div></div></div>`}).join(""),"confsum");

let filter="all";
const q=document.getElementById("q"),sortSel=document.getElementById("sort");
function card(t){
  const form=Array.from({length:8},(_,i)=>`<i class="${i<t.w?"w":""}"></i>`).join("");
  return `<button type="button" class="card ${t.q?"":"out"} ${TEAMS.indexOf(t)===ME?"mine":""}" data-i="${TEAMS.indexOf(t)}" data-rank="${t.rank}" style="--cc:${CONF[t.c].v}" aria-label="${esc(t.n)}, ${t.w} ganados, ${t.l} perdidos">
   <div class="top">${crest(t)}<div style="min-width:0"><h3>${esc(t.n)}</h3><div class="chips"><span class="chip ab"><i>#${t.ab}</i></span><span class="chip cf"><i>${CONF[t.c].name} #${t.rank}</i></span>${TEAMS.indexOf(t)===ME?'<span class="chip me"><i>Tu equipo</i></span>':""}${t.q?`<span class="chip q"><i>Playoffs</i></span>`:`<span class="chip x"><i>${PPV.HAS_GAMES?"Eliminado":"Por jugar"}</i></span>`}</div></div></div>
   <div class="form" aria-hidden="true" title="Victorias sobre 8 semanas">${form}</div>
   <div class="nums"><div><b class="num">${t.w}-${t.l}</b><span>Record</span></div><div><b class="num">${t.d>0?"+":""}${t.d}</b><span>Diff</span></div><div><b class="num">${t.pts}</b><span>Pts</span></div></div>
  </button>`;
}
function renderTeams(){
  const term=q.value.trim().toLowerCase();
  const s=sortSel.value;
  const sorter=s==="az"?(a,b)=>a.n.localeCompare(b.n):s==="diff"?(a,b)=>b.d-a.d:(a,b)=>a.rank-b.rank;
  const confs=filter==="all"?["rojo","azul"]:[filter];
  let total=0;
  const html=confs.map(c=>{
    const list=by(c).filter(t=>t.n.toLowerCase().includes(term)).sort(sorter);
    total+=list.length;
    if(!list.length)return "";
    return `<section style="--c:${CONF[c].v}"><div class="conf-title"><h2 style="color:${CONF[c].v}">${CONF[c].name}</h2><span class="label">${list.length} equipos</span><span class="rule"></span></div><div class="cards">${list.map(card).join("")}</div></section>`;
  }).join("");
  document.getElementById("grid").innerHTML=html||`<div class="empty">Ningun equipo coincide con “${esc(q.value)}”. Prueba con otro nombre.</div>`;
  document.getElementById("count").textContent=`${total} de ${TEAMS.length} equipos`;
}
document.querySelectorAll("#page-teams .seg button").forEach(b=>b.addEventListener("click",()=>{filter=b.dataset.f;document.querySelectorAll("#page-teams .seg button").forEach(x=>x.setAttribute("aria-pressed",x===b));renderTeams();}));
q.addEventListener("input",renderTeams);sortSel.addEventListener("change",renderTeams);
safe(()=>renderTeams(),"renderTeams");

/* drawer */
const drawer=document.getElementById("drawer");
document.getElementById("grid").addEventListener("click",e=>{const cc=e.target.closest(".card");if(cc){location.hash="team-"+slug(TEAMS[+cc.dataset.i]);return;}
  const c=e.target.closest(".card");if(!c)return;
  const t=TEAMS[+c.dataset.i];
  drawer.innerHTML=`<div class="panel" style="--cc:${CONF[t.c].v}" role="dialog" aria-modal="true" aria-label="${esc(t.n)}">
    <button type="button" class="close" id="closeD">Cerrar</button>
    <div style="display:flex;gap:18px;align-items:center">${crest(t)}<div><div class="label" style="color:${CONF[t.c].v}">${CONF[t.c].name} · #${t.rank}</div><h2>${esc(t.n)}</h2></div></div>
    <div class="dstats"><div><b class="num">${t.w}</b><span>W</span></div><div><b class="num">${t.l}</b><span>L</span></div><div><b class="num">${t.d>0?"+":""}${t.d}</b><span>Diff</span></div><div><b class="num">${t.pts}</b><span>Pts</span></div></div>
    <div><div class="label" style="margin-bottom:10px">Roster drafteado</div><div class="roster">${Array.from({length:12},(_,i)=>`<div>Pick ${i+1}</div>`).join("")}</div></div>
    <p style="color:var(--mute);margin:0;font-size:.9rem">En el sitio real, aqui van el trainer, los sprites del roster y los resultados semana a semana.</p>
  </div>`;
  drawer.hidden=false;document.getElementById("closeD").focus();
});
const closeD=()=>{drawer.hidden=true;drawer.innerHTML="";};
drawer.addEventListener("click",e=>{if(e.target===drawer||e.target.id==="closeD")closeD();});
addEventListener("keydown",e=>{if(e.key==="Escape"&&!drawer.hidden)closeD();});

/* standings */
const sign=x=>x>0?"+"+x:""+x;
TEAMS.slice().sort((a,b)=>b.pts-a.pts||b.d-a.d||a.n.localeCompare(b.n)).forEach((t,i)=>t.gr=i+1);
const MONS_FULL=PPV.MONS_FULL.map(([n,g,k,d])=>({n,g,k,d,kd:k/(d||1)}));
const SDEF={rank:1,n:1,w:-1,l:1,d:-1,pts:-1};
let sView="conf",sKey="rank",sDir=1;
const sortBy=(list,key,dir,tie)=>list.slice().sort((a,b)=>{const x=a[key],y=b[key];const r=typeof x==="string"?x.localeCompare(y):x-y;return (dir===1?r:-r)||tie(a,b);});
const sth=(k,label,cls="")=>SDEF[k]?`<th class="${cls}"${STIP[k]?` data-tip="${STIP[k]}"`:""} aria-sort="${sKey===k?(sDir===1?"ascending":"descending"):"none"}"><button type="button" data-k="${k}">${label}</button></th>`:`<th class="${cls}"${STIP[k]?` data-tip="${STIP[k]}" tabindex="0"`:""}>${label}</th>`;
const shead=()=>`<thead><tr>${sth("rank","#","l")}${sth("n","Equipo","l")}${sth("pj","PJ")}${sth("w","W")}${sth("l","L")}${sth("d","Diff")}${sth("wp","% Victorias")}${sth("pts","Pts")}${sth("st","Estado")}</tr></thead>`;
function srow(t,cut){
  const pj=t.w+t.l,pct=pj?Math.round(t.w/pj*100):0;
  return `<tr class="${t.q?"in":"out"}${cut&&t.rank===5?" cut":""}${t.n===TEAMS[ME].n?" mine":""}" style="--c:${CONF[t.c].v}">
   <td class="pos l">${sView==="conf"?t.rank:t.gr}</td>
   <td class="l"><span class="tm">${crest(t)}<a class="nm" href="#team-${slug(t)}"><span class="full">${esc(t.n)}</span><span class="short">#${t.ab}</span></a>${t.n===TEAMS[ME].n?'<span class="you">Tu</span>':""}${sView==="all"?`<span class="chip cf" style="--cc:${CONF[t.c].v}"><i>${CONF[t.c].name} #${t.rank}</i></span>`:""}</span></td>
   <td>${pj}</td><td>${t.w}</td><td>${t.l}</td>
   <td class="${t.d>0?"up":""}">${sign(t.d)}</td>
   <td><span class="wp" aria-hidden="true"><i style="width:${pct}%"></i></span><span class="wpn">${pct}%</span></td>
   <td class="pts">${t.pts}</td>
   <td>${t.q?'<span class="chip q"><i>Playoffs</i></span>':'<span class="chip x"><i>'+(PPV.HAS_GAMES?'Eliminado':'Por jugar')+'</i></span>'}</td></tr>`;
}
function renderStandings(){
  const box=document.getElementById("stables");
  if(sView==="power"){box.innerHTML=powerHTML(pWeek);return;}
  const rk=sView==="conf"?"rank":"gr";
  const list=l=>sortBy(l.map(t=>({...t,rank_:t[rk]})),sKey==="rank"?"rank_":sKey,sDir,(a,b)=>a[rk]-b[rk]);
  const tbl=(title,sub,color,l,cut)=>`<div class="table" style="--c:${color}"><div class="th"><h3>${title}</h3><span class="label">${sub}</span></div><div class="rows"><table class="st">${shead()}<tbody>${list(l).map(t=>srow(t,cut)).join("")}</tbody></table></div></div>`;
  const cut=sKey==="rank"&&sDir===1;
  box.innerHTML=sView==="conf"
    ?["rojo","azul"].map(c=>tbl(CONF[c].name,`${by(c).length} equipos · 4 a playoffs`,CONF[c].v,by(c),cut)).join("")
    :tbl("General","18 equipos · ambas conferencias","var(--volt)",TEAMS,false);
}
document.getElementById("stables").addEventListener("click",e=>{
  const b=e.target.closest("button[data-k]");if(!b)return;
  const k=b.dataset.k;
  if(sKey===k)sDir=-sDir;else{sKey=k;sDir=SDEF[k];}
  renderStandings();
  const nb=document.querySelector(`#stables button[data-k="${k}"]`);if(nb)nb.focus();
});
document.querySelectorAll("#sview button").forEach(b=>b.addEventListener("click",()=>{
  sView=b.dataset.v;sKey="rank";sDir=1;
  document.querySelectorAll("#sview button").forEach(x=>x.setAttribute("aria-pressed",x===b));
  renderStandings();
}));
document.getElementById("toMons").addEventListener("click",()=>document.getElementById("mons-sec").scrollIntoView({behavior:"smooth"}));

const bestDiff=TEAMS.slice().sort((a,b)=>b.d-a.d)[0];
safe(()=>document.getElementById("leaders").innerHTML=[
  [`Lider ${CONF.rojo.name}`,by("rojo")[0],`${by("rojo")[0].pts}`,CONF.rojo.v],
  [`Lider ${CONF.azul.name}`,by("azul")[0],`${by("azul")[0].pts}`,CONF.azul.v],
  ["Mejor diff",bestDiff,sign(bestDiff.d),CONF[bestDiff.c].v]
].map(([lab,t,val,c])=>`<div class="ld" style="--c:${c}">${crest(t)}<div><span class="label">${lab}</span><strong>${esc(t.n)}</strong></div><b class="num">${val}</b></div>`).join(""),"leaders");

const topBy=k=>MONS_FULL.slice().sort((a,b)=>b[k]-a[k])[0];
const tk_=topBy("k")||{n:"—",k:0,kd:0,g:0},tkd=topBy("kd")||{n:"—",kd:0},tg=topBy("g")||{n:"—",g:0};
document.getElementById("mtiles").innerHTML=[
  ["Mas KOs",tk_.n,tk_.k,"var(--volt)"],
  ["Mejor K/D",tkd.n,tkd.kd.toFixed(2),"var(--good)"],
  ["Mas partidas",tg.n,tg.g,"var(--verde)"]
].map(([lab,n,v,c])=>`<div class="mt" style="--c:${c}"><div><span class="label">${lab}</span><strong>${n}</strong></div><b class="num">${v}</b></div>`).join("");

const MDEF={n:1,g:-1,k:-1,d:1,kd:-1};
let mKey="k",mDir=-1;
const maxK=Math.max(...MONS_FULL.map(m=>m.k)),bestKd=tkd.kd;
function renderMons(){
  const mth=(k,l,c="")=>`<th class="${c}" aria-sort="${mKey===k?(mDir===1?"ascending":"descending"):"none"}"><button type="button" data-mk="${k}">${l}</button></th>`;
  const list=sortBy(MONS_FULL,mKey,mDir,(a,b)=>b.k-a.k||a.n.localeCompare(b.n));
  document.getElementById("mtable").innerHTML=`<thead><tr><th class="l">#</th>${mth("n","Pokemon","l")}${mth("k","Kills","l")}${mth("d","Deaths")}${mth("g","Partidas")}${mth("kd","K/D")}</tr></thead><tbody>${list.map((m,i)=>`
   <tr class="in" style="--c:var(--volt)"><td class="pos l">${i+1}</td><td class="l"><span class="nm">${box(m.n,"spr-s")}${m.n}</span></td>
   <td class="l"><span class="kc"><span class="kb" aria-hidden="true"><i style="width:${m.k/maxK*100}%;${monConf(m.n)?"--bc:"+monConf(m.n):""}"></i></span><b>${m.k}</b></span></td>
   <td>${m.d}</td><td>${m.g}</td><td class="${m.kd===bestKd?"best":""}">${m.kd.toFixed(2)}</td></tr>`).join("")}</tbody>`;
}
document.getElementById("mtable").addEventListener("click",e=>{
  const b=e.target.closest("button[data-mk]");if(!b)return;
  const k=b.dataset.mk;
  if(mKey===k)mDir=-mDir;else{mKey=k;mDir=MDEF[k];}
  renderMons();
  const nb=document.querySelector(`#mtable button[data-mk="${k}"]`);if(nb)nb.focus();
});
safe(()=>renderStandings(),"renderStandings");safe(()=>renderMons(),"renderMons");

/* matches — [semana, equipo A, equipo B, ganador de cada juego (a/b), ids de replay en YouTube] */
const RAW_MATCHES=PPV.RAW_MATCHES;
const MATCHES=RAW_MATCHES.map(([w,a,b,seq,ids])=>{const ga=[...seq].filter(x=>x==="a").length;return {w,a,b,seq,ids,ga,gb:seq.length-ga,c:TEAMS[a].c};});
MATCHES.forEach((m,i)=>{m.i=i;m.id=PPV.MATCH_IDS[i];});
const WEEKS=Math.max(1,PPV.WEEKS||0,...MATCHES.map(m=>m.w));
let mWeek=(PPV.PENDING.length?Math.min(...PPV.PENDING.map(p=>p.w)):WEEKS),mConf="all",mTeam="";
const ytu=id=>`https://www.youtube.com/watch?v=${id}`;
function mside(m,s){
  const t=TEAMS[m[s]],g=s==="a"?m.ga:m.gb,win=g>(s==="a"?m.gb:m.ga);
  return `<div class="side ${win?"win":"lose"}">${crest(t)}<a class="nm" href="#team-${slug(t)}"><span class="full">${esc(t.n)}</span><span class="short">#${t.ab}</span></a><span class="gd" aria-hidden="true">${[...m.seq].map(x=>`<i class="${x===s?"w":""}"></i>`).join("")}</span><span class="sc num">${g}</span></div>`;
}
function mcard(m,top){
  const reps=!m.ids.length?`<span class="none">Sin replay</span>`
    :m.ids.length===1?`<a class="rp" href="${ytu(m.ids[0])}" target="_blank" rel="noopener">▶ Replay</a>`
    :m.ids.map((id,i)=>`<a class="rp" href="${ytu(id)}" target="_blank" rel="noopener" aria-label="Replay del juego ${i+1}">G${i+1}</a>`).join("");
  let res="";
  if(top!==undefined){const mine=m.a===top?"a":"b";const won=(mine==="a"?m.ga:m.gb)===2;res=`<span class="res ${won?"w":"l"}">${won?"W":"L"}</span>`;}
  const lab=top!==undefined?`Semana ${m.w}`:(m.seq.length===3?"Final · 3 juegos":"Final · 2-0");
  return `<article class="mc ${top===undefined&&(m.a===ME||m.b===ME)?"mine":""}" data-mi="${m.i}" tabindex="0" style="--c:${CONF[m.c].v}" aria-label="Ver detalle de la serie: ${esc(TEAMS[m.a].n)} ${m.ga}, ${esc(TEAMS[m.b].n)} ${m.gb}"><div class="sides">${mside(m,"a")}${mside(m,"b")}</div><div class="meta">${res}<span class="label">${lab}</span><div class="rps">${reps}</div></div></article>`;
}
document.getElementById("weeks").innerHTML=Array.from({length:WEEKS},(_,i)=>`<button type="button" data-w="${i+1}"><small>Semana</small>${i+1}</button>`).join("");
const mteam=document.getElementById("mteam");
mteam.innerHTML+=["rojo","azul"].map(c=>`<optgroup label="${CONF[c].name}">${TEAMS.map((t,i)=>[t,i]).filter(([t])=>t.c===c).sort((x,y)=>x[0].n.localeCompare(y[0].n)).map(([t,i])=>`<option value="${i}">${esc(t.n)}</option>`).join("")}</optgroup>`).join("");
function renderMatches(){
  const box=document.getElementById("mbody"),cnt=document.getElementById("mcount");
  document.querySelectorAll("#weeks button").forEach(b=>b.setAttribute("aria-pressed",mTeam===""&&+b.dataset.w===mWeek));
  document.getElementById("mconf").style.visibility=mTeam===""?"visible":"hidden";
  if(mTeam!==""){
    const ti=+mTeam,t=TEAMS[ti];
    const ms=MATCHES.filter(m=>m.a===ti||m.b===ti).sort((x,y)=>x.w-y.w).map(m=>m.a===ti?m:{...m,a:m.b,b:m.a,ga:m.gb,gb:m.ga,seq:[...m.seq].map(x=>x==="a"?"b":"a").join("")});
    let gw=0,gl=0;ms.forEach(m=>{gw+=m.ga;gl+=m.gb;});
    const bye=Array.from({length:WEEKS},(_,i)=>i+1).find(w=>!ms.some(m=>m.w===w));
    box.innerHTML=`<div class="tsum" style="--c:${CONF[t.c].v}">${crest(t)}<div><span class="label" style="color:${CONF[t.c].v}">${CONF[t.c].name} · #${t.rank}</span><h2>${esc(t.n)}</h2></div>
      <div class="kv"><span class="label">Series</span><b class="num">${t.w}-${t.l}</b></div>
      <div class="kv"><span class="label">Juegos</span><b class="num">${gw}-${gl}</b></div>
      <div class="kv"><span class="label">Descanso</span><b class="num">Sem ${bye}</b></div>
      <button type="button" class="btn ghost clear" id="mclear">Ver por semana</button></div>
      <div class="mcols one"><div class="mlist">${ms.map(m=>mcard(m,ti)).join("")}</div></div>`;
    cnt.textContent=`${ms.length} series`;
    return;
  }
  const wk=MATCHES.filter(m=>m.w===mWeek);
  const confs=mConf==="all"?["rojo","azul"]:[mConf];
  const shown=wk.filter(m=>confs.includes(m.c));
  const three=shown.filter(m=>m.seq.length===3).length;
  const games=shown.reduce((s,m)=>s+m.seq.length,0);
  const col=c=>{
    const list=wk.filter(m=>m.c===c);
    const pend=PPV.PENDING.filter(p=>p.w===mWeek&&p.c===c);
    const playing=new Set(list.flatMap(m=>[m.a,m.b]).concat(pend.flatMap(p=>[p.a,p.b])));
    const byes=TEAMS.map((t,i)=>[t,i]).filter(([t,i])=>t.c===c&&!playing.has(i));
    return `<div class="mcol"><div class="conf-title" style="--c:${CONF[c].v}"><h2 style="color:${CONF[c].v}">${CONF[c].name}</h2><span class="label">${list.length} series</span><span class="rule"></span></div>
      <div class="mlist">${list.map(m=>mcard(m)).join("")}${pend.map(PPV.hooks.pendingCard).join("")}${byes.map(([t])=>`<div class="bye">${crest(t)}<span><strong>${esc(t.n)}</strong> descansa esta semana</span></div>`).join("")}</div></div>`;
  };
  box.innerHTML=`<div class="wsum"><h2>Semana ${mWeek}</h2>
     <div><b class="num">${shown.length}</b><span class="label">Series</span></div>
     <div><b class="num">${shown.length-three}</b><span class="label">Series 2-0</span></div>
     <div><b class="num">${three}</b><span class="label">Series a 3 juegos</span></div>
     <div><b class="num">${games}</b><span class="label">Juegos</span></div><button type="button" class="btn ghost sh-sm" data-sharek="week" data-arg="${mWeek}" style="margin-left:auto">⤴ Compartir semana</button></div>
    ${potwMini(mWeek)}<div class="mcols ${confs.length===1?"one":""}">${confs.map(col).join("")}</div>`;
  cnt.textContent=`Semana ${mWeek} de ${WEEKS}`+(PPV.PENDING.length?` · ${PPV.PENDING.filter(p=>p.w===mWeek).length} por jugar`:MATCHES.length?" · fase regular terminada":" · calendario por publicar");
}
document.getElementById("weeks").addEventListener("click",e=>{const b=e.target.closest("button[data-w]");if(!b)return;mWeek=+b.dataset.w;mTeam="";mteam.value="";renderMatches();});
document.querySelectorAll("#mconf button").forEach(b=>b.addEventListener("click",()=>{mConf=b.dataset.mc;document.querySelectorAll("#mconf button").forEach(x=>x.setAttribute("aria-pressed",x===b));renderMatches();}));
mteam.addEventListener("change",()=>{mTeam=mteam.value;renderMatches();});
document.getElementById("mbody").addEventListener("click",e=>{if(e.target.id==="mclear"){mTeam="";mteam.value="";renderMatches();}});
safe(()=>renderMatches(),"renderMatches");

/* team profiles — de ppvdraftleague.com/teams: [coach, titulo, puntos de draft, movimientos FA, favorito, roster: [pokemon, costo, tipos, habilidades, obtenido, partidas, kills, deaths]] */
const PROFILES=PPV.PROFILES;
if(ME<0)PROFILES[-1]=["Invitado","-",`0/${MAXP}`,0,"-",[]];
// Champions ID por equipo (indice en TEAMS); los que no tienen se muestran como "Por registrar"
const CHAMPIONS_ID=PPV.CHAMPIONS_ID;
const fmtCid=id=>id.replace(/(\d{4})(?=\d)/g,"$1 ");
const TYPE={normal:["Normal","#A8A77A"],fire:["Fuego","#EE8130"],water:["Agua","#6390F0"],electric:["Electrico","#F7D02C"],grass:["Planta","#7AC74C"],ice:["Hielo","#96D9D6"],fighting:["Lucha","#D04A44"],poison:["Veneno","#B159AF"],ground:["Tierra","#E2BF65"],flying:["Volador","#A98FF3"],psychic:["Psiquico","#F95587"],bug:["Bicho","#A6B91A"],rock:["Roca","#B6A136"],ghost:["Fantasma","#8C6DB8"],dragon:["Dragon","#8A5CFF"],dark:["Siniestro","#9A7C68"],steel:["Acero","#B7B7CE"],fairy:["Hada","#E39BC0"]};
const PROFILE_ORDER=["rojo","azul"].flatMap(c=>TEAMS.map((t,i)=>[t,i]).filter(([t])=>t.c===c).sort((a,b)=>a[0].rank-b[0].rank).map(([,i])=>i));
function seriesFor(ti){
  return MATCHES.filter(m=>m.a===ti||m.b===ti).sort((x,y)=>x.w-y.w)
    .map(m=>m.a===ti?m:{...m,a:m.b,b:m.a,ga:m.gb,gb:m.ga,seq:[...m.seq].map(x=>x==="a"?"b":"a").join("")});
}
/* tabla de tipos: multiplicador de daño de cada tipo atacante contra cada Pokemon (solo por tipos, sin habilidades) */
const TYPE_ORDER=["normal","fire","water","electric","grass","ice","fighting","poison","ground","flying","psychic","bug","rock","ghost","dragon","dark","steel","fairy"];
const TYPE_ABBR={normal:"NOR",fire:"FUE",water:"AGU",electric:"ELE",grass:"PLA",ice:"HIE",fighting:"LUC",poison:"VEN",ground:"TIE",flying:"VOL",psychic:"PSI",bug:"BIC",rock:"ROC",ghost:"FAN",dragon:"DRA",dark:"SIN",steel:"ACE",fairy:"HAD"};
const CHART={
 normal:{rock:.5,ghost:0,steel:.5},
 fire:{fire:.5,water:.5,grass:2,ice:2,bug:2,rock:.5,dragon:.5,steel:2},
 water:{fire:2,water:.5,grass:.5,ground:2,rock:2,dragon:.5},
 electric:{water:2,electric:.5,grass:.5,ground:0,flying:2,dragon:.5},
 grass:{fire:.5,water:2,grass:.5,poison:.5,ground:2,flying:.5,bug:.5,rock:2,dragon:.5,steel:.5},
 ice:{fire:.5,water:.5,grass:2,ice:.5,ground:2,flying:2,dragon:2,steel:.5},
 fighting:{normal:2,ice:2,poison:.5,flying:.5,psychic:.5,bug:.5,rock:2,ghost:0,dark:2,steel:2,fairy:.5},
 poison:{grass:2,poison:.5,ground:.5,rock:.5,ghost:.5,steel:0,fairy:2},
 ground:{fire:2,electric:2,grass:.5,poison:2,flying:0,bug:.5,rock:2,steel:2},
 flying:{electric:.5,grass:2,fighting:2,bug:2,rock:.5,steel:.5},
 psychic:{fighting:2,poison:2,psychic:.5,dark:0,steel:.5},
 bug:{fire:.5,grass:2,fighting:.5,poison:.5,flying:.5,psychic:2,ghost:.5,dark:2,steel:.5,fairy:.5},
 rock:{fire:2,ice:2,fighting:.5,ground:.5,flying:2,bug:2,steel:.5},
 ghost:{normal:0,psychic:2,ghost:2,dark:.5},
 dragon:{dragon:2,steel:.5,fairy:0},
 dark:{fighting:.5,psychic:2,ghost:2,dark:.5,fairy:.5},
 steel:{fire:.5,water:.5,electric:.5,ice:2,rock:2,steel:.5,fairy:2},
 fairy:{fire:.5,fighting:2,poison:.5,dragon:2,dark:2,steel:.5}
};
const mult=(atk,defs)=>defs.reduce((m,d)=>m*(CHART[atk][d]??1),1);
const CELL={4:["x4","4×"],2:["x2","2×"],0.5:["r2","½"],0.25:["r4","¼"],0:["im","INM"]};
function typeChart(roster){
  const rows=roster.map(r=>({n:r[0],ts:r[2].split("/")}));
  const weak=TYPE_ORDER.map(a=>rows.filter(p=>mult(a,p.ts)>1).length);
  const res=TYPE_ORDER.map(a=>rows.filter(p=>mult(a,p.ts)<1).length);
  const head=`<thead><tr><th class="pkn" scope="col">Pokemon</th>${TYPE_ORDER.map(t=>`<th scope="col" title="${TYPE[t][0]}"><span class="tyh" style="--tc:${TYPE[t][1]}"><i>${TYPE_ABBR[t]}</i></span></th>`).join("")}</tr></thead>`;
  const body=rows.map(p=>`<tr><th class="pkn" scope="row">${box(p.n,"spr-s")}${esc(p.n)}</th>${TYPE_ORDER.map(a=>{const m=mult(a,p.ts),c=CELL[m];return c?`<td class="${c[0]}" title="${TYPE[a][0]}: x${m}">${c[1]}</td>`:"<td></td>";}).join("")}</tr>`).join("");
  const foot=`<tfoot><tr><th class="pkn" scope="row">Debiles</th>${weak.map((w,i)=>`<td class="${w>=3||w-res[i]>=2?"hot":w?"":"zero"}">${w}</td>`).join("")}</tr>
    <tr><th class="pkn" scope="row">Resisten</th>${res.map(r=>`<td class="${r?"cool":"zero"}">${r}</td>`).join("")}</tr></tfoot>`;
  return `<div class="tchart-w"><table class="tc">${head}<tbody>${body}</tbody>${foot}</table></div>
   <div class="tlegend"><span><i class="x4">4×</i>Muy debil</span><span><i class="x2">2×</i>Debil</span><span><i class="r2">½</i>Resiste</span><span><i class="r4">¼</i>Resiste mucho</span><span><i class="im">INM</i>Inmune</span><span><i class="hot">3</i>Punto debil del equipo</span><span>Calculado solo por tipos, sin contar habilidades.</span></div>`;
}
/* perfiles: al pasar el mouse por una tarjeta del roster, el sprite pasa a su version animada (5.a gen, PokeAPI) */
const ANIM_IDS=new Set([3,6,9,15,18,24,25,26,36,38,59,65,68,71,80,91,94,111,115,121,127,128,130,132,134,135,136,142,143,149,154,157,158,160,168,181,184,186,196,197,199,202,205,208,212,214,226,227,229,248,279,282,302,306,308,310,319,323,324,334,350,351,354,358,359,362,389,392,395,405,407,409,411,428,442,445,448,450,454,460,461,464,470,471,472,473,475,478,479,483,497,500,503,505,510,512,514,516,530,531,534,547,553,563,569,571,579,584,587,609,614,618,623,635,637,652,658,663,666,670,671,675,681,685,693,697,700,702,706,707,709,713,715,722,727,730,733,740,745,748,750,752,778,780,784,823,844,858,866,867,869,877,887,899,902,925,1019,10008,10009,10010,10011,10012,10100,10104,10126,10152,10165,10172,10236,10239,10242,10248]);
const animUrl=n=>ANIM_IDS.has(SPR_IDS[n])?SPR_BASE+"animated/"+SPR_IDS[n]+".gif":"";
const NO_MOTION=matchMedia("(prefers-reduced-motion: reduce)").matches;
function wireRosterAnim(root){
  if(NO_MOTION)return;
  root.querySelectorAll(".pk").forEach(card=>{
    const img=card.querySelector("img.spr");if(!img)return;
    const url=animUrl(card.dataset.mon);if(!url)return;
    const still=img.src;
    card.addEventListener("mouseenter",()=>{img.src=url;img.classList.add("anim");});
    card.addEventListener("mouseleave",()=>{img.src=still;img.classList.remove("anim");});
  });
}
/* apodo de un Pokemon segun su dueño actual (seguro aunque OWNER/getNick aun no existan al cargar) */
/* color de la conferencia del equipo dueño de un Pokemon (vacio si aun no se puede saber o es agente libre) */
function monConf(n){try{const o=OWNER[n];return o!=null?CONF[TEAMS[o].c].v:"";}catch(e){return "";}}
function nickOf(n){try{const o=OWNER[n];return o!=null?getNick(o,n):"";}catch(e){return "";}}
function refreshLeaderNicks(){
  const h=document.querySelector(".mvp h3");if(h){const nk=nickOf("Blastoise");h.innerHTML=nk?`${esc(nk)}<small class="sp-mvp">Blastoise</small>`:"Blastoise";}
  const mt=document.getElementById("mvpTeam");if(mt){let o=null;try{o=OWNER[MONS[0][0]];}catch(e){}mt.innerHTML=o!=null?`${crest(TEAMS[o])}<div><small>Equipo actual</small><a href="#team-${slug(TEAMS[o])}">${esc(TEAMS[o].n)}</a></div>`:"<div><small>Equipo actual</small><span>Agente libre</span></div>";}
}
/* apodos de Pokemon (demo: se guardan en este navegador; en el sitio real irian a la base de datos) */
let NICKS=PPV.NICKS||{};
const getNick=(ti,n)=>(NICKS[ti]&&NICKS[ti][n])||"";
function setNick(ti,n,v){v=(v||"").replace(/[<>]/g,"").replace(/\s+/g," ").trim().slice(0,16);NICKS[ti]=NICKS[ti]||{};if(v)NICKS[ti][n]=v;else delete NICKS[ti][n];PPV.hooks.saveNick(n,v);return v;}
function openNick(n){
  const cur=getNick(ME,n);
  drawer.innerHTML=`<div class="panel nk-panel" role="dialog" aria-modal="true" aria-label="Apodo para ${esc(n)}" style="--cc:${CONF[TEAMS[ME].c].v}">
    <button type="button" class="close" id="closeD">Cerrar</button>
    <div class="nk-head">${spr(n,"nk-spr")}<div><span class="label">Apodo para</span><h2>${esc(n)}</h2></div></div>
    <form class="nk-form" id="nkForm" autocomplete="off">
      <label class="label" for="nkIn">Apodo (maximo 16 caracteres)</label>
      <input id="nkIn" type="text" maxlength="16" value="${esc(cur)}" placeholder="Ej. El Tanque">
      <div class="sh-actions"><button type="submit" class="btn">Guardar apodo</button>${cur?'<button type="button" class="btn ghost" id="nkDel">Quitar apodo</button>':""}</div>
      <p class="sc-note">El apodo lo ve todo el que visite el perfil de tu equipo.</p>
    </form></div>`;
  drawer.hidden=false;const inp=document.getElementById("nkIn");inp.focus();inp.select();
  const done=v=>{setNick(ME,n,v);closeD();refreshLeaderNicks();if(location.hash==="#team-"+slug(TEAMS[ME]))renderProfile(ME);toastMsg(v?`${n} ahora se llama “${getNick(ME,n)}”.`:`Quitaste el apodo de ${n}.`);};
  document.getElementById("nkForm").addEventListener("submit",e=>{e.preventDefault();done(inp.value);});
  const del=document.getElementById("nkDel");if(del)del.addEventListener("click",()=>done(""));
}
document.addEventListener("click",e=>{const b=e.target.closest("[data-nick]");if(!b)return;e.stopPropagation();openNick(b.dataset.nick);});
function renderProfile(ti){
  const t=TEAMS[ti],[coach,title,draftPts,fa,fav,roster]=PROFILES[ti],C=CONF[t.c].v;
  const ms=seriesFor(ti);
  let gw=0,gl=0;ms.forEach(m=>{gw+=m.ga;gl+=m.gb;});
  const kills=roster.reduce((s,r)=>s+r[6],0),deaths=roster.reduce((s,r)=>s+r[7],0);
  const mvp=roster.length?roster.reduce((a,b)=>b[6]>a[6]?b:a):null;
  const pos=PROFILE_ORDER.indexOf(ti),L=PROFILE_ORDER.length;
  const prev=TEAMS[PROFILE_ORDER[(pos-1+L)%L]],next=TEAMS[PROFILE_ORDER[(pos+1)%L]];
  const path=Array.from({length:WEEKS},(_,i)=>{
    const w=i+1,m=ms.find(x=>x.w===w);
    if(!m)return `<div class="wk b"><span class="label">Sem ${w}</span><span class="r">—</span><span class="op">Descanso</span></div>`;
    const won=m.ga>m.gb,o=TEAMS[m.b];
    return `<div class="wk ${won?"w":"l"}" title="vs ${esc(o.n)}"><span class="label">Sem ${w}</span><span class="r">${won?"W":"L"}</span><a class="op" href="#team-${slug(o)}"><span class="full">${esc(o.n)}</span><span class="short">#${o.ab}</span></a><span class="s num">${m.ga}-${m.gb}</span></div>`;
  }).join("");
  const pk=r=>{
    const [n,cost,types,ab,obt,g,k,d]=r,ts=types.split("/"),c1=TYPE[ts[0]][1],c2=TYPE[ts[1]||ts[0]][1];
    return `<article class="pk ${r===mvp?"star":""}" data-mon="${esc(n)}" style="--t1:${c1};--t2:${c2}">${r===mvp?`<span class="tag">MVP del equipo</span>`:""}
      <div class="hd"><div><h3>${getNick(ti,n)?esc(getNick(ti,n)):esc(n)}</h3>${getNick(ti,n)?`<span class="species">${esc(n)}</span>`:""}<div class="cost num">${cost}<small>pts de draft</small></div></div>${spr(n)}</div>
      <div class="types">${ts.map(x=>`<span class="ty" style="--tc:${TYPE[x][1]}"><i>${TYPE[x][0]}</i></span>`).join("")}</div>
      <p class="ab">${esc(ab)}</p>${ti===ME?`<button type="button" class="nick-btn" data-nick="${esc(n)}">✎ ${getNick(ti,n)?"Editar apodo":"Poner apodo"}</button>`:""}
      <div class="gkd"><div><b class="num">${g}</b><span>Partidas</span></div><div><b class="num">${k}</b><span>Kills</span></div><div><b class="num">${d}</b><span>Deaths</span></div><div><b class="num">${d?(k/d).toFixed(2):k?"∞":"—"}</b><span data-tip="kd">K/D</span></div></div>
    </article>`;
  };
  const navLink=(o,cls,lab)=>`<a class="${cls}" href="#team-${slug(o)}" style="--c:${CONF[o.c].v}">${cls==="nx"?"":crest(o)}<div><span class="label">${lab}</span><strong>${esc(o.n)}</strong></div>${cls==="nx"?crest(o):""}</a>`;
  document.getElementById("page-profile").innerHTML=`
  <section class="p-hero" style="--c:${C}">
    <span class="p-rank" aria-hidden="true">#${t.rank}</span>
    <div class="wrap">
      <a class="back" href="#teams">← Teams</a>
      <div class="p-id">${crest(t)}
        <div>
          <div class="chips">${ti===ME?'<span class="chip me"><i>Tu equipo</i></span>':""}<span class="chip cf" style="--cc:${C}"><i>${CONF[t.c].name} · #${t.rank}</i></span>${t.q?`<span class="chip q"><i>Clasificado a playoffs</i></span>`:`<span class="chip x"><i>${PPV.HAS_GAMES?"Eliminado":"Por jugar"}</i></span>`}</div>
          <h1>${esc(t.n)}<small class="p-ab">#${t.ab}</small></h1>
          <div class="p-coach"><span class="label">Trainer</span><strong>${esc(coach)}</strong>${title&&title!=="-"?`<span class="p-title">“${esc(title)}”</span>`:""}</div>
          <div class="p-cid"><span class="label">Champions ID</span>${CHAMPIONS_ID[ti]?`<code class="cid num">${fmtCid(CHAMPIONS_ID[ti])}</code><button type="button" class="cid-copy" data-cid="${CHAMPIONS_ID[ti]}">Copiar</button>`:`<span class="cid none">Por registrar</span>`}</div>
          <div class="p-cid"><span class="label">Pokemon favorito</span><span class="cid fav-up">${fav&&fav!=="-"?esc(fav):"Sin definir"}</span></div>
          <div class="p-share"><button type="button" class="btn" data-share="${ti}">⤴ Compartir perfil</button><a class="btn ghost" href="#h2h-${ti===ME?ME+"-9":ME+"-"+ti}">⚔ ${ti===ME?"Cara a cara":"Comparar con mi equipo"}</a></div>
        </div>
      </div>
    </div>
  </section>
  <div class="strip p-strip" style="--c:${C}"><div class="wrap">
    <div class="stat"><b class="num">${t.w}-${t.l}</b><span data-tip="wl" tabindex="0">Record en series</span></div>
    <div class="stat"><b class="num">${gw}-${gl}</b><span data-tip="gw" tabindex="0">Juegos ganados</span></div>
    <div class="stat"><b class="num">${sign(t.d)}</b><span data-tip="diff" tabindex="0">Balance de KOs</span></div>
    <div class="stat"><b class="num">${t.pts}</b><span data-tip="pts" tabindex="0">Puntos de liga</span></div>
    <div class="stat"><b class="num">${kills}</b><span data-tip="kills" tabindex="0">KOs del roster</span></div>
    <div class="stat"><b class="num">${esc(draftPts)}</b><span data-tip="draftpts" tabindex="0">Puntos de draft</span></div>
  </div></div>
  <div class="wrap s-body p-body" style="--c:${C}">
    <section>
      <div class="sec-head"><div><div class="label">Fase regular · ${WEEKS} semanas</div><h2>Semana a <em>semana</em></h2></div></div>
      <div class="path-w"><div class="path" style="--c:${C}">${path}</div></div>
    </section>
    <section>
      <div class="sec-head"><div><div class="label">${roster.length} Pokemon · ${kills} KOs · ${deaths} caidas</div><h2>El <em>roster</em></h2></div><button type="button" class="btn ghost sh-sm" data-sharek="roster" data-arg="${ti}">⤴ Compartir roster</button></div>
      <div class="p-note"><span>Movimientos de free agency: <strong>${fa}</strong></span><span>Todos obtenidos en el <strong>draft</strong></span></div>
      <div class="roster-g">${roster.slice().sort((a,b)=>b[1]-a[1]).map(pk).join("")}</div>
    </section>
    <section>
      <div class="sec-head"><div><div class="label">Debilidades y resistencias del roster</div><h2>Analisis de <em>tipos</em></h2></div></div>
      ${typeChart(roster)}${coverageHTML(roster)}
    </section>
    ${txTeamHTML(ti)}
    <section>
      <div class="sec-head"><div><div class="label">Series al mejor de 3</div><h2>Resultados de la <em>temporada</em></h2></div></div>
      <div class="p-series">${ms.map(m=>mcard(m,ti)).join("")}</div>
    </section>
    <nav class="p-nav" aria-label="Otros equipos">${navLink(prev,"pv","← Equipo anterior")}${navLink(next,"nx","Equipo siguiente →")}</nav>
  </div>`;
  wireRosterAnim(document.getElementById("page-profile"));
}

/* hero video: se muestra solo cuando el archivo existe y empieza a reproducirse */
(()=>{
  const v=document.getElementById("heroVideo"),box=document.getElementById("heroMedia");
  if(!v)return;
  const reduce=matchMedia("(prefers-reduced-motion: reduce)").matches;
  v.addEventListener("playing",()=>box.classList.add("is-ready"));
  if(reduce){v.addEventListener("loadeddata",()=>box.classList.add("is-ready"),{once:true});v.load();}
  else v.play().catch(()=>{});
})();
document.getElementById("page-profile").addEventListener("click",e=>{
  const b=e.target.closest(".cid-copy");if(!b)return;
  const done=()=>{b.textContent="Copiado";setTimeout(()=>b.textContent="Copiar",1600);};
  const sel=()=>{const c=b.previousElementSibling;const r=document.createRange();r.selectNodeContents(c);const s=getSelection();s.removeAllRanges();s.addRange(r);b.textContent="Seleccionalo y copia";};
  if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(b.dataset.cid).then(done,sel);else sel();
});
/* playoffs — formato escalera de ppvdraftleague.com/playoffs (indices de TEAMS).
   Resultado: w = "a" o "b" (quien gano la serie). Si se conoce el marcador, agrega seq con el ganador de cada juego ("aba"). */
const PLAYOFFS=PPV.PLAYOFFS;
const RNAME={wc:"Wild Card",qf:"Cuartos de final",sf:"Semifinal",final:"Gran Final"};
const winnerOf=m=>{if(m.a==null||m.b==null)return null;if(m.w&&!m.seq)return m.w==="a"?m.a:m.b;if(!m.seq)return null;const ga=[...m.seq].filter(x=>x==="a").length,gb=m.seq.length-ga;return ga===2?m.a:gb===2?m.b:null;};
function resolvePlayoffs(){
  const P=JSON.parse(JSON.stringify(PLAYOFFS));
  ["A","B"].forEach(k=>{const s=P[k];s.qf.b=winnerOf(s.wc);s.sf.b=winnerOf(s.qf);});
  P.final.a=winnerOf(P.A.sf);P.final.b=winnerOf(P.B.sf);
  return P;
}
function pslot(ti,from,score,state){
  if(ti==null)return `<div class="ps tbd"><span class="q" aria-hidden="true">?</span><span class="nm"><span>${from}</span></span><b class="sc"></b></div>`;
  const t=TEAMS[ti];
  return `<div class="ps ${state||""}" style="--c:${CONF[t.c].v}">${crest(t)}<span class="nm"><a href="#team-${slug(t)}">${esc(t.n)}</a><small>${CONF[t.c].name} #${t.rank} · ${t.w}-${t.l}</small></span><b class="sc num">${score??""}</b></div>`;
}
function pmatch(m,title,fromA,fromB,cls,style,extra=""){
  const w=winnerOf(m);let ga=m.seq?[...m.seq].filter(x=>x==="a").length:null,gb=m.seq?m.seq.length-ga:null;if(!m.seq&&w!=null){ga=w===m.a?"W":"";gb=w===m.b?"W":"";}
  const st=w!=null?"Final":m.seq?"En juego":(m.a!=null&&m.b!=null)?"Por jugar":"Pendiente";
  const sa=w==null?"":w===m.a?"win":"lose",sb=w==null?"":w===m.b?"win":"lose";
  return `<article class="pm ${cls}" style="${style}"><header><span class="label">${title}</span><span class="st ${m.seq&&w==null?"live":""}">${st}</span></header>${extra}${pslot(m.a,fromA,ga,sa)}${pslot(m.b,fromB,gb,sb)}</article>`;
}
const TROPHY=`<svg viewBox="0 0 64 72" aria-hidden="true"><path d="M16 4h32v14c0 10-7 18-16 18S16 28 16 18z" fill="var(--volt)"/><path d="M16 9H6v5c0 7 5 12 11 12M48 9h10v5c0 7-5 12-11 12" fill="none" stroke="var(--volt)" stroke-width="4"/><rect x="28" y="36" width="8" height="14" fill="var(--volt)"/><path d="M18 50h28l4 10H14z" fill="var(--volt)"/><rect x="12" y="60" width="40" height="8" fill="var(--chalk)"/><path d="M26 12l4 8M38 12l-2 6" stroke="var(--ink)" stroke-width="2.5" opacity=".35"/></svg>`;
function renderPlayoffs(){
  const P=resolvePlayoffs();
  const all=[["A","wc"],["A","qf"],["A","sf"],["B","wc"],["B","qf"],["B","sf"]].map(([k,r])=>P[k][r]).concat(P.final);
  const done=all.filter(m=>winnerOf(m)!=null).length;
  const next=["wc","qf","sf"].find(r=>winnerOf(P.A[r])==null||winnerOf(P.B[r])==null)||"final";
  const champ=winnerOf(P.final);
  document.getElementById("po-status").innerHTML=`
    <div><b class="num">8</b><span class="label">Equipos</span></div>
    <div><b class="num">${done}/7</b><span class="label">Series jugadas</span></div>
    <div><b>${champ!=null?esc(TEAMS[champ].n):RNAME[next]}</b><span class="label">${champ!=null?"Campeon":"Ronda actual"}</span></div>`;
  const A=P.A,B=P.B;
  document.getElementById("bracket").innerHTML=`<div class="bk">
    <span class="rl" style="grid-column:1">Wild Card</span><span class="rl" style="grid-column:2">Cuartos de final</span><span class="rl" style="grid-column:3">Semifinal</span><span class="rl fin" style="grid-column:4">Gran Final</span>
    <span class="side-h" style="--o:0">Lado A</span>
    ${pmatch(A.wc,"Wild Card 1 · Lado A","","","to-r","grid-column:1;grid-row:2;--o:1")}
    ${pmatch(A.qf,"Cuartos · Lado A","","Ganador Wild Card 1","to-r","grid-column:2;grid-row:2;--o:2")}
    ${pmatch(A.sf,"Semifinal · Lado A","","Ganador Cuartos A","to-fd","grid-column:3;grid-row:2;--o:3")}
    <span class="side-h" style="--o:4">Lado B</span>
    ${pmatch(B.wc,"Wild Card 2 · Lado B","","","to-r","grid-column:1;grid-row:3;--o:5")}
    ${pmatch(B.qf,"Cuartos · Lado B","","Ganador Wild Card 2","to-r","grid-column:2;grid-row:3;--o:6")}
    ${pmatch(B.sf,"Semifinal · Lado B","","Ganador Cuartos B","to-fu","grid-column:3;grid-row:3;--o:7")}
    <div class="fin" style="--o:98">${pmatch(P.final,"Gran Final","Ganador Semifinal A","Ganador Semifinal B","final","",
      `<div class="champ ${champ!=null?"":"tbd"}">${champ!=null?crest(TEAMS[champ]):""}<div><span class="label">Campeon Temporada ${SEASON_N}</span><strong>${champ!=null?esc(TEAMS[champ].n):"Por definir"}</strong></div></div>`)}</div>
  </div>`;
  const entry=t=>t.rank===1?["Semifinal","doble bye"]:t.rank===2?["Cuartos de final","bye en Wild Card"]:["Wild Card","juega desde la primera ronda"];
  const seeds=PPV.SEEDS;
  document.getElementById("po-seeds").innerHTML=seeds.map(i=>{const t=TEAMS[i],[r,why]=entry(t);return `<a class="sd" href="#team-${slug(t)}" style="--c:${CONF[t.c].v}">${crest(t)}<div><span class="chip cf" style="--cc:${CONF[t.c].v}"><i>${CONF[t.c].name} #${t.rank}</i></span><strong>${esc(t.n)}</strong></div><div class="entry">${t.w}-${t.l} · Entra en <b>${r}</b> (${why})</div></a>`;}).join("");
  document.querySelectorAll("#po-format .step").forEach(s=>s.classList.toggle("now",s.dataset.r===(champ!=null?"":next)));
}
safe(()=>renderPlayoffs(),"renderPlayoffs");

/* footer: campeon y volver arriba */
(()=>{const c=winnerOf(resolvePlayoffs().final),el=document.getElementById("fChamp");if(el)el.textContent=c!=null?TEAMS[c].n:"Por definir";
  const up=document.getElementById("fUp");if(up)up.addEventListener("click",()=>scrollTo({top:0,behavior:"smooth"}));})();
/* ---------- sesion simulada (demo) ---------- */
const toastMsg=m=>{const t=document.getElementById("toast");t.textContent=m;t.hidden=false;clearTimeout(toastMsg.t);toastMsg.t=setTimeout(()=>t.hidden=true,2800);};
(()=>{const chip0=document.getElementById("meChip"),out0=document.getElementById("meOut");
  if(ME<0){chip0.href="#login";chip0.innerHTML=PPV.USER?`<span><b>Sin equipo</b><small>${esc(PPV.USER.email||"")}</small></span>`:`<span><b>Entrar</b><small>Trainers y admin</small></span>`;out0.hidden=!PPV.USER;return;}
  const t=TEAMS[ME],chip=chip0;
  chip.href="#mi-equipo";chip.style.setProperty("--c",CONF[t.c].v);
  chip.innerHTML=`${crest(t)}<span><b>${esc(PROFILES[ME][0])}</b><small>${esc(t.n)}</small></span>`;
  chip.setAttribute("aria-label",`Sesion iniciada: ${PROFILES[ME][0]}, ${t.n}. Ir a mi panel`);
  const fl=document.getElementById("fMine");if(fl)fl.href="#mi-equipo";})();

/* ---------- Pokedex: pool del draft (ppvdraftleague.com/pokedex) — [pokemon, costo, tipos, id PokeAPI] ---------- */
const POOL=PPV.POOL;
POOL.forEach(p=>{SPR_IDS[p[0]]=p[3];});
const OWNER={};PROFILES.forEach((p,i)=>p[5].forEach(r=>{OWNER[r[0]]=i;}));
let dxS="all",dxT=[];
const dxQ=document.getElementById("dxQ"),dxType=document.getElementById("dxType");
const TYPE_ICON=t=>`https://raw.githubusercontent.com/partywhale/pokemon-type-icons/fcbe6978c61c359680bc07636c3f9bdc0f346b43/icons/${t}.svg`;
function paintTypes(){dxType.innerHTML=`<span class="dx-tlab sr-only">Tipo</span>`+TYPE_ORDER.map(t=>{const on=dxT.includes(t);return `<button type="button" data-ty="${t}" aria-pressed="${on}" title="${TYPE[t][0]}" aria-label="${TYPE[t][0]}" style="--c:${TYPE[t][1]}" ${!on&&dxT.length>=2?"disabled":""}><img src="${TYPE_ICON(t)}" alt="" loading="lazy"></button>`;}).join("")+`<button type="button" class="dx-tclear" data-ty="" title="Quitar tipos" aria-label="Quitar tipos" ${dxT.length?"":"style='visibility:hidden'"}>✕</button>`;}
paintTypes();
const ownersOf=n=>(PPV.OWNERS[n]||[]),copiesOf=n=>(PPV.COPIES[n]||{max:1,surcharge:0,next:0}),dxFree=n=>ownersOf(n).length<copiesOf(n).max,nextCost=n=>copiesOf(n).next??(POOL.find(p=>p[0]===n)||[0,0])[1];
const owned=POOL.filter(p=>ownersOf(p[0]).length).length;
document.getElementById("dxStats").innerHTML=`
  <div><b class="num">${POOL.length}</b><span class="label">Pokemon en el pool</span></div>
  <div><b class="num">${owned}</b><span class="label">Con dueño</span></div>
  <div><b class="num">${POOL.length-owned}</b><span class="label">Libres</span></div>
  <div><b class="num">${new Set(POOL.map(p=>p[1])).size}</b><span class="label">Niveles (15 a 1 pts)</span></div>`;
function dxCard(p){
  const [n,pts,types]=p,ts=types.split("/"),owns=ownersOf(n),own=owns.includes(ME)?ME:owns[0],cp=copiesOf(n),left=cp.max-owns.length;
  const c1=TYPE[ts[0]][1],c2=TYPE[ts[1]||ts[0]][1];
  const owner=owns.map(o=>`<a href="#team-${slug(TEAMS[o])}" style="--c:${CONF[TEAMS[o].c].v}">${crest(TEAMS[o])}<span title="${esc(TEAMS[o].n)}">#${TEAMS[o].ab}</span></a>`).join("")+(left>0?`<span class="chip lib"><i>${owns.length?`${left} copia${left>1?"s":""} · ${cp.next} pts`:cp.max>1?`Libre · ${cp.max} copias`:"Libre"}</i></span>`:"");
  return `<article class="dx ${left>0?"free":""} ${owns.includes(ME)?"mine":""}" style="--t1:${c1};--t2:${c2}">${own===ME?'<span class="mine-tag">Tu equipo</span>':""}
    ${spr(n,"dx-spr")}<h3>${esc(n)}</h3>
    <div class="types">${ts.map(x=>`<span class="ty" style="--tc:${TYPE[x][1]}"><i>${TYPE[x][0]}</i></span>`).join("")}</div>
    <div class="own">${owner}</div></article>`;
}
function renderDex(){
  const q=dxQ.value.trim().toLowerCase();
  const list=POOL.filter(p=>{const owns=ownersOf(p[0]),own=owns.includes(ME)?ME:owns.length?owns[0]:null;
    if(q&&!p[0].toLowerCase().includes(q))return false;
    if(dxT.length&&!dxT.every(t=>p[2].split("/").includes(t)))return false;
    if(dxS==="free"&&!dxFree(p[0]))return false;
    if(dxS==="owned"&&own==null)return false;
    if(dxS==="mine"&&own!==ME)return false;
    return true;});
  const tiers=[...new Set(list.map(p=>p[1]))].sort((a,b)=>b-a);
  document.getElementById("dxBody").innerHTML=tiers.length?tiers.map(t=>{const g=list.filter(p=>p[1]===t),fr=g.filter(p=>dxFree(p[0])).length;
    return `<section class="tier"><div class="tier-h"><h2 class="num">${t}<small>pts</small></h2><span class="label">${g.length} Pokemon · ${fr} libres</span><span class="rule"></span></div><div class="dx-g">${g.map(dxCard).join("")}</div></section>`;}).join("")
    :`<div class="empty">Ningun Pokemon coincide con esos filtros. Prueba con otro nombre o tipo.</div>`;
  document.getElementById("dxCount").textContent=`${list.length} de ${POOL.length}`;
}
document.querySelectorAll("#dxSeg button").forEach(b=>b.addEventListener("click",()=>{dxS=b.dataset.s;document.querySelectorAll("#dxSeg button").forEach(x=>x.setAttribute("aria-pressed",x===b));renderDex();}));
dxQ.addEventListener("input",renderDex);dxType.addEventListener("click",e=>{const b=e.target.closest("[data-ty]");if(!b||b.disabled)return;const t=b.dataset.ty;if(!t)dxT=[];else if(dxT.includes(t))dxT=dxT.filter(x=>x!==t);else if(dxT.length<2)dxT=[...dxT,t];paintTypes();renderDex();});
safe(()=>renderDex(),"renderDex");

/* ---------- Draft: tablero snake (ppvdraftleague.com/draft). Cada ronda va en el orden de columnas de DRAFT_ORDER. ---------- */
const DRAFT_ORDER=PPV.DRAFT_ORDER;
const DRAFT_ROUNDS=PPV.DRAFT_ROUNDS;
const PTS=Object.fromEntries(POOL.map(p=>[p[0],p[1]]));
const pickNo=(ri,ci)=>ri%2===0?ci+1:DRAFT_ORDER.length-ci;
function renderDraft(){
  const N=DRAFT_ORDER.length,made=DRAFT_ROUNDS.flat().filter(Boolean).length;
  document.getElementById("drStats").innerHTML=`
    <div><b class="num">${N}</b><span class="label">Entrenadores</span></div>
    <div><b class="num">${DRAFT_ROUNDS.length}</b><span class="label">Rondas</span></div>
    <div><b class="num">${made}</b><span class="label">Picks hechos</span></div>
    <div><b class="num">${MAXP}</b><span class="label">Puntos por equipo</span></div>`;
  // mi draft
  const t=TEAMS[ME],col=DRAFT_ORDER.indexOf(ME),roster=PROFILES[ME][5].map(r=>r[0]);
  const mine=DRAFT_ROUNDS.map((row,ri)=>({r:ri+1,k:pickNo(ri,col),g:ri*N+pickNo(ri,col),n:row[col]}));
  const spent=mine.reduce((s,m)=>s+(m.n?PTS[m.n]||0:0),0),kept=mine.filter(m=>m.n&&roster.includes(m.n)).length;
  document.getElementById("drMineSum").innerHTML=`<span>Draftaste <b>${mine.filter(m=>m.n).length} Pokemon</b> por <b>${spent} pts</b></span><span><b>${kept}</b> siguen en tu roster</span><span>Roster actual: <b>${PROFILES[ME][2]} pts</b></span>`;
  document.getElementById("drMine").innerHTML=mine.map(m=>m.n
    ?`<article class="mp ${roster.includes(m.n)?"":"gone"}" style="--c:${CONF[t.c].v}">${spr(m.n,"")}<span class="label">Ronda ${m.r} · Pick ${m.r}.${m.k} · #${m.g} global</span><strong>${esc(m.n)}</strong><span class="meta"><b>${PTS[m.n]} pts</b> · ${roster.includes(m.n)?"En tu roster":"Ya no esta en tu roster"}</span></article>`
    :`<article class="mp empty"><span class="label">Ronda ${m.r} · Pick ${m.r}.${m.k}</span><strong>Sin pick</strong></article>`).join("");
  // tablero
  document.getElementById("drBoard").innerHTML=`<table class="db v"><colgroup><col class="c-tm">${DRAFT_ROUNDS.map(()=>"<col>").join("")}</colgroup>
    <thead><tr><th class="tmh" scope="col">Equipo</th>${DRAFT_ROUNDS.map((_,ri)=>`<th scope="col">Ronda ${ri+1}<span aria-label="${ri%2?"de abajo hacia arriba":"de arriba hacia abajo"}">${ri%2?"↑":"↓"}</span></th>`).join("")}</tr></thead>
    <tbody>${DRAFT_ORDER.map((ti,ci)=>{const T=TEAMS[ti];return `<tr class="${ti===ME?"mine":""}" style="--c:${CONF[T.c].v}"><th class="tm" scope="row"><a href="#team-${slug(T)}"><span class="dpos num">${ci+1}</span>${crest(T)}<span class="tn"><b class="ab">#${T.ab}</b><small>${esc(T.n)}</small></span>${ti===ME?'<span class="you">Tu</span>':""}</a></th>${DRAFT_ROUNDS.map((row,ri)=>{const n=row[ci];return `<td><div class="${n?"":"empty"}">${n?`${box(n,"db-spr")}<b>${esc(n)}</b><small>${PTS[n]??"?"} pts · ${ri+1}.${pickNo(ri,ci)}</small>`:`<b>Sin pick</b><small>${ri+1}.${pickNo(ri,ci)}</small>`}</div></td>`;}).join("")}</tr>`;}).join("")}</tbody></table>`;
  // free agency
  const free=POOL.filter(p=>dxFree(p[0])&&!ownersOf(p[0]).includes(ME)).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));
  const left=MAXP-PROFILES[ME][5].reduce((s,r)=>s+r[1],0);
  document.getElementById("drFaNote").innerHTML=`<span>Te quedan <b>${left} pts</b> de presupuesto.</span><span>${left>0?"Puedes fichar Pokemon que cuesten hasta "+left+" pts.":"Para fichar a alguien tendrias que liberar primero a un Pokemon de tu roster."}</span>`;
  document.getElementById("drFa").innerHTML=`<thead><tr><th>Pokemon</th><th>Tipos</th><th>Costo</th><th></th></tr></thead><tbody>${free.map(p=>`<tr><td><span class="fa-n">${box(p[0],"")}${esc(p[0])}</span></td><td><div class="types">${p[2].split("/").map(x=>`<span class="ty" style="--tc:${TYPE[x][1]}"><i>${TYPE[x][0]}</i></span>`).join("")}</div></td><td class="pts num">${nextCost(p[0])}${ownersOf(p[0]).length?`<small> copia ${ownersOf(p[0]).length+1}</small>`:""}</td><td><button type="button" class="fa-btn" data-fa="${esc(p[0])}">Solicitar</button></td></tr>`).join("")}</tbody>`;
  document.getElementById("drFaCount").textContent=`${free.length} Pokemon libres`;
}
document.getElementById("drFa").addEventListener("click",e=>{const b=e.target.closest("[data-fa]");if(!b)return;PPV.hooks.requestFA(b.dataset.fa);});
document.getElementById("meOut").addEventListener("click",()=>PPV.hooks.logout());
safe(()=>renderDraft(),"renderDraft");

/* tablero del draft: todas las filas toman la altura de la celda mas alta */
function equalizeBoard(){
  const t=document.querySelector("#drBoard table.db.v");if(!t||!t.offsetParent)return;
  t.style.removeProperty("--cellh");
  const cells=[...t.querySelectorAll("td>div, th.tm a")];
  const h=Math.ceil(Math.max(...cells.map(c=>c.getBoundingClientRect().height)));
  if(h>0)t.style.setProperty("--cellh",h+"px");
}
if(document.fonts)document.fonts.ready.then(equalizeBoard);
let eqT;addEventListener("resize",()=>{clearTimeout(eqT);eqT=setTimeout(equalizeBoard,120);});
/* menu movil */
(()=>{const b=document.getElementById("navToggle"),n=document.getElementById("mainNav");if(!b||!n)return;
  const set=o=>{n.classList.toggle("open",o);b.setAttribute("aria-expanded",o);b.setAttribute("aria-label",o?"Cerrar menu":"Abrir menu");};
  b.addEventListener("click",()=>set(!n.classList.contains("open")));
  n.addEventListener("click",e=>{if(e.target.closest("a"))set(false);});
  addEventListener("keydown",e=>{if(e.key==="Escape"&&n.classList.contains("open")){set(false);b.focus();}});
  addEventListener("hashchange",()=>set(false));
  document.addEventListener("click",e=>{if(n.classList.contains("open")&&!e.target.closest("header.nav"))set(false);});})();
/* ---------- detalle de serie: Pokemon usados en cada juego (ppvdraftleague.com/matches) — [serie][juego][lado A, lado B] ---------- */
const GAMES=PPV.GAMES;
const gameSide=(gi,ti)=>{const m=MATCHES[gi];return m.a===ti?0:m.b===ti?1:-1;};
function openSeries(i){
  const m=MATCHES[i],A=TEAMS[m.a],B=TEAMS[m.b],g=GAMES[i]||[];
  const side=(t,list,won)=>`<div class="sg-side ${won?"won":""}"><div class="sg-t">${crest(t)}<b>#${t.ab}</b></div><div class="sg-mons">${list.length?list.map(n=>`<span class="sg-m">${box(n,"sg-spr")}<small>${esc(n)}</small></span>`).join(""):"<em>Sin registro</em>"}</div></div>`;
  const any=g.some(x=>x&&(x[0].length||x[1].length));
  const games=[...m.seq].map((x,gi)=>{const [la,lb]=g[gi]||[[],[]];const id=m.ids.length>1?m.ids[gi]:null;const W=x==="a"?A:B;
    return `<section class="sg"><header><span class="label">Juego ${gi+1}</span><span class="sg-w">Gana #${W.ab}</span>${id?`<a class="rp" href="${ytu(id)}" target="_blank" rel="noopener">▶ Replay</a>`:""}</header>${any?side(A,la,x==="a")+side(B,lb,x==="b"):""}</section>`;}).join("");
  const one=m.ids.length===1?`<a class="rp" href="${ytu(m.ids[0])}" target="_blank" rel="noopener">▶ Replay de la serie</a>`:"";
  drawer.innerHTML=`<div class="panel sd-panel" role="dialog" aria-modal="true" aria-label="Detalle de la serie ${esc(A.n)} contra ${esc(B.n)}" style="--cc:${CONF[m.c].v}">
    <button type="button" class="close" id="closeD">Cerrar</button>
    <div class="label">Semana ${m.w} · Serie al mejor de 3</div>
    <div class="sd-score"><a href="#team-${slug(A)}">${crest(A)}<span>${esc(A.n)}</span></a><b class="num">${m.ga}<i>-</i>${m.gb}</b><a href="#team-${slug(B)}">${crest(B)}<span>${esc(B.n)}</span></a></div>
    <div class="sh-btns"><button type="button" class="btn sh-sm" data-sharek="series" data-arg="${i}">⤴ Compartir resultado</button></div>
    <section class="sd-obs"><header><span class="label">Transmision · OBS</span></header>
      <div class="obs-prev" id="sdObsPrev" data-mi="${i}"><span class="label">Generando overlay…</span></div>
      <div class="md-acts"><button type="button" class="btn sh-sm" data-obs="${i}" data-k="ov">⤓ Overlay</button><button type="button" class="btn ghost sh-sm" data-obs="${i}" data-k="in" hidden>⤓ Pantalla de inicio</button><!-- oculto por ahora --></div>
      <p class="obs-tip">PNG de 1920×1080. En OBS pon la captura del juego en x 160, y 120 con tamaño 1600×900 y el overlay encima: el centro es transparente.</p>
    </section>
    ${one}${games}${any?"":'<p class="sd-none">Esta serie no tiene registrados los Pokemon de cada juego.</p>'}
  </div>`;
  drawer.hidden=false;document.getElementById("closeD").focus();renderSdObs(i);
}
document.addEventListener("click",e=>{const c=e.target.closest(".mc[data-mi]");if(!c||e.target.closest("a"))return;openSeries(+c.dataset.mi);});
document.addEventListener("keydown",e=>{if(e.key!=="Enter"&&e.key!==" ")return;const c=e.target;if(!c.matches||!c.matches(".mc[data-mi]"))return;e.preventDefault();openSeries(+c.dataset.mi);});
addEventListener("hashchange",()=>{if(!drawer.hidden)closeD();});

/* uso de Pokemon por equipo (juegos registrados) */
function usage(ti){const c={};MATCHES.forEach((m,i)=>{const s=gameSide(i,ti);if(s<0)return;(GAMES[i]||[]).forEach(gm=>(gm[s]||[]).forEach(n=>{c[n]=(c[n]||0)+1;}));});return Object.entries(c).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));}
const ROSTER=ti=>PROFILES[ti][5];
const typesOf=n=>{const r=PROFILES.flatMap(p=>p[5]).find(x=>x[0]===n);if(r)return r[2].split("/");const p=POOL.find(x=>x[0]===n);return p?p[2].split("/"):[];};

/* ---------- Mi equipo (sesion simulada) ---------- */
function playoffRun(ti){
  const P=resolvePlayoffs(),seq=[];["A","B"].forEach(k=>["wc","qf","sf"].forEach(r=>{const m=P[k][r];if(m.a===ti||m.b===ti)seq.push([r,m]);}));
  if(P.final.a===ti||P.final.b===ti)seq.push(["final",P.final]);
  if(!seq.length)return null;
  const [r,m]=seq[seq.length-1],w=winnerOf(m);
  if(w==null)return {txt:`Juega ${RNAME[r]}`};
  if(w===ti)return {txt:r==="final"?"Campeon de la temporada":`Gano ${RNAME[r]}`,opp:null};
  return {txt:`Eliminado en ${RNAME[r]}`,opp:m.a===ti?m.b:m.a};
}
function renderMine(){
  const t=TEAMS[ME],C=CONF[t.c].v,[coach,title,draftPts,fa]=PROFILES[ME],run=playoffRun(ME);
  const left=MAXP-ROSTER(ME).reduce((s,r)=>s+r[1],0);
  const lastOpp=run&&run.opp!=null?run.opp:null;
  document.getElementById("page-mi-equipo").innerHTML=`
  <section class="p-hero mine-hero" style="--c:${C}">
    <div class="wrap">
      <div class="label">Panel del trainer</div>
      <div class="mine-id">${crest(t)}<div><h1 style="font-family:var(--f-display);font-weight:900;text-transform:uppercase;font-size:clamp(2.6rem,7vw,5rem);line-height:.9">Hola, ${esc(coach)}</h1>
        <div class="chips"><span class="chip ab"><i>#${t.ab}</i></span><span class="chip cf" style="--cc:${C}"><i>${CONF[t.c].name} · #${t.rank}</i></span><span class="chip x"><i>${t.w}-${t.l} · ${t.pts} pts</i></span></div></div>
        <a class="btn ghost" href="#team-${slug(t)}" style="margin-left:auto">Ver perfil de ${esc(t.n)}</a></div>
      ${run?`<div class="mine-res"><span class="label">Temporada ${SEASON_N}</span><span><b>${run.txt}</b>${run.opp!=null?` por <a class="nm" href="#team-${slug(TEAMS[run.opp])}"><b>${esc(TEAMS[run.opp].n)}</b></a>`:""}</span></div>`:""}
    </div>
  </section>
  <div class="wrap s-body">
    <section>
      <div class="sec-head"><div><div class="label">${esc(SEASON_LABEL)}</div><h2>Tu <em>semana</em></h2></div></div>
      <div class="m-cards">
        <div class="m-card" style="--c:${C}"><span class="label">Proxima serie</span>${PPV.hooks.nextSeries()}</div>
        <div class="m-card" style="--c:var(--volt)"><span class="label">Presupuesto</span><span class="big num">${esc(draftPts)}</span><p>${left>0?`Te quedan ${left} pts para fichar.`:"No te quedan puntos libres: para fichar tendrias que liberar a un Pokemon."} Movimientos de free agency usados: ${fa}.</p></div>
        <div class="m-card"><span class="label">Pendientes</span>${PPV.hooks.pendingSummary()}</div>
      </div>
    </section>
    <section>
      <div class="sec-head"><div><div class="label">Preparate para tu rival</div><h2><em>Scouting</em></h2></div></div>
      <div class="sc-bar"><label class="label" for="scRival">Rival</label><select id="scRival">${["rojo","azul"].map(c=>`<optgroup label="${CONF[c].name}">${TEAMS.map((x,i)=>[x,i]).filter(([x,i])=>x.c===c&&i!==ME).map(([x,i])=>`<option value="${i}" ${i===lastOpp?"selected":""}>${esc(x.n)}</option>`).join("")}</optgroup>`).join("")}</select>${lastOpp!=null?`<span class="sc-note">Seleccionado: tu ultimo rival en playoffs.</span>`:""}</div>
      <div id="scOut"></div>
    </section>
  </div>`;
  const sel=document.getElementById("scRival");sel.addEventListener("change",()=>renderScout(+sel.value));renderScout(+sel.value);
}
function renderScout(ri){
  const R=TEAMS[ri],RC=CONF[R.c].v,my=ROSTER(ME),rv=ROSTER(ri);
  const h2h=MATCHES.filter(m=>(m.a===ME&&m.b===ri)||(m.a===ri&&m.b===ME));
  const P=resolvePlayoffs(),po=[...["A","B"].flatMap(k=>["wc","qf","sf"].map(r=>[RNAME[r],P[k][r]])),["Gran Final",P.final]].filter(([,m])=>(m.a===ME&&m.b===ri)||(m.a===ri&&m.b===ME));
  let w=0,l=0;h2h.forEach(m=>{const mine=m.a===ME?m.ga:m.gb;mine===2?w++:l++;});po.forEach(([,m])=>{winnerOf(m)===ME?w++:l++;});
  const used=usage(ri).slice(0,6);
  const threats=rv.slice().sort((a,b)=>b[6]-a[6]).slice(0,4);
  const atk=[...new Set(rv.flatMap(r=>r[2].split("/")))];
  const cover=atk.map(a=>[a,my.filter(r=>mult(a,r[2].split("/"))>1).length]).filter(x=>x[1]>0).sort((a,b)=>b[1]-a[1]);
  const answers=my.map(r=>{const ts=r[2].split("/");const hits=rv.filter(o=>ts.some(a=>mult(a,o[2].split("/"))>1)).length;return [r[0],hits];}).sort((a,b)=>b[1]-a[1]).slice(0,4);
  const row=(n,right)=>`<div class="sc-row">${box(n,"")}<b>${esc(n)}</b><span>${right}</span></div>`;
  document.getElementById("scOut").innerHTML=`
    <div class="sc-head" style="--c:${RC}">${crest(R)}<div><span class="label">${CONF[R.c].name} · #${R.rank} · ${R.w}-${R.l}</span><strong>${esc(R.n)}</strong></div><a class="btn ghost" href="#team-${slug(R)}">Ver perfil</a></div>
    <div class="sc-g">
      <div class="sc-box"><h3>Historial entre ustedes</h3>${h2h.length||po.length?`<div class="big num" style="font-family:var(--f-display);font-weight:900;font-size:2rem">${w}-${l} <span class="label">en series</span></div><div class="sc-h2h">${h2h.map(m=>mcard(m.a===ME?m:{...m,a:m.b,b:m.a,ga:m.gb,gb:m.ga,seq:[...m.seq].map(x=>x==="a"?"b":"a").join("")},ME)).join("")}</div>${po.map(([r,m])=>`<p class="sc-note">${r} de playoffs: gano <b>${esc(TEAMS[winnerOf(m)].n)}</b></p>`).join("")}`:`<p class="sc-note">No se han enfrentado esta temporada (estan en conferencias distintas o aun no se cruzan).</p>`}</div>
      <div class="sc-box"><h3>Lo que mas usa</h3>${used.length?`<div class="sc-list">${used.map(([n,c])=>row(n,c+" juegos")).join("")}</div>`:`<p class="sc-note">No hay juegos registrados con sus equipos.</p>`}</div>
      <div class="sc-box"><h3>Sus amenazas (mas KOs)</h3><div class="sc-list">${threats.map(r=>row(r[0],`${r[6]} KOs · ${r[7]?(r[6]/r[7]).toFixed(2):r[6]} K/D`)).join("")}</div></div>
      <div class="sc-box"><h3>Sus tipos contra tu roster</h3>${cover.length?`<div class="sc-types">${cover.map(([a,c])=>`<span class="ty" style="--tc:${TYPE[a][1]}"><i>${TYPE[a][0]}<b>${c}</b></i></span>`).join("")}</div><p class="sc-note">Cuantos de tus Pokemon son debiles a cada tipo que tiene en su roster.</p>`:`<p class="sc-note">Ninguno de sus tipos te pega super efectivo.</p>`}</div>
      <div class="sc-box"><h3>Tus mejores respuestas</h3><div class="sc-list">${answers.map(([n,c])=>row(n,`super efectivo vs ${c} de ${rv.length}`)).join("")}</div><p class="sc-note">Calculado solo por tipos, sin contar habilidades ni movimientos.</p></div>
    </div>`;
}
safe(()=>renderMine(),"renderMine");

/* ---------- Salon de la Fama ---------- */
function renderHof(){
  const champ4=winnerOf(resolvePlayoffs().final);
  const C=PPV.HOF.filter(([s,ti])=>TEAMS[ti]&&ti>=0).concat(champ4!=null&&!PPV.HOF.some(h=>h[0]===SEASON_N)&&PPV.SEASON.status==="finished"?[[SEASON_N,champ4,"Campeon de los playoffs"]]:[]);
  document.getElementById("hofChamps").innerHTML=C.map(([s,ti,src])=>{const t=TEAMS[ti];return `<a class="champ-c" data-s="${s}" href="#team-${slug(t)}" style="--c:${CONF[t.c].v}"><span class="label">Temporada ${s}</span>${crest(t)}<strong>${esc(PROFILES[ti][0])}</strong><p>${esc(t.n)}</p></a>`;}).join("")+
    `<div class="champ-c now" data-s="5"><span class="label">${esc(SEASON_LABEL)}</span><span class="crest" style="--sz:84px;--h1:hsl(40 10% 40%);--h2:hsl(40 10% 25%)">?</span><strong>En juego</strong><p>El proximo nombre del Hall of Fame</p></div>`;
  const best=TEAMS.slice().sort((a,b)=>b.w-a.w||b.d-a.d)[0],bestD=TEAMS.slice().sort((a,b)=>b.d-a.d)[0];
  const all=PROFILES.flatMap((p,i)=>p[5].map(r=>[r,i]));
  const mk=all.slice().sort((a,b)=>b[0][6]-a[0][6])[0],kd=all.filter(x=>x[0][6]>=8).sort((a,b)=>(b[0][6]/(b[0][7]||1))-(a[0][6]/(a[0][7]||1)))[0]||mk;
  const cnt={};GAMES.forEach(g=>g.forEach(gm=>gm.forEach(side=>side.forEach(n=>{cnt[n]=(cnt[n]||0)+1;}))));const top=Object.entries(cnt).sort((a,b)=>b[1]-a[1])[0]||["—",0];
  const sweeps=MATCHES.filter(m=>m.seq.length===2).length,threes=MATCHES.length-sweeps;
  const rec=(ic,lab,name,val,href,rc)=>`<div class="hof-r"${rc?` style="--rc:${rc}"`:""}><span class="ic">${ic}</span><span class="label">${lab}</span><strong>${href?`<a class="nm" href="${href}">${name}</a>`:name}</strong><b class="num">${val}</b></div>`;
  if(!MATCHES.length||!mk){document.getElementById("hofRecords").innerHTML=`<div class="empty">Los records de la temporada aparecen cuando se juegue la primera serie.</div>`;return;}
  document.getElementById("hofRecords").innerHTML=[
    champ4!=null?rec(crest(TEAMS[champ4]),"Campeon",esc(TEAMS[champ4].n),"🏆","#team-"+slug(TEAMS[champ4])):"",
    rec(crest(best),"Mejor record",esc(best.n),`${best.w}-${best.l}`,"#team-"+slug(best),CONF[best.c].v),
    rec(crest(bestD),"Mejor balance de KOs",esc(bestD.n),sign(bestD.d),"#team-"+slug(bestD),CONF[bestD.c].v),
    rec(box(mk[0][0],""),"Mas KOs",`${esc(mk[0][0])} · #${TEAMS[mk[1]].ab}`,mk[0][6],"#team-"+slug(TEAMS[mk[1]]),CONF[TEAMS[mk[1]].c].v),
    rec(box(kd[0][0],""),"Mejor K/D (8+ KOs)",`${esc(kd[0][0])} · #${TEAMS[kd[1]].ab}`,(kd[0][6]/(kd[0][7]||1)).toFixed(2),"#team-"+slug(TEAMS[kd[1]]),CONF[TEAMS[kd[1]].c].v),
    rec(box(top[0],""),"Pokemon mas usado",esc(top[0]),`${top[1]} juegos`,"",OWNER[top[0]]!=null?CONF[TEAMS[OWNER[top[0]]].c].v:""),
    rec('<span class="crest" style="--sz:52px;--h1:hsl(45 90% 55%);--h2:hsl(35 90% 40%)">2-0</span>',"Series 2-0","Ganadas sin perder un juego",sweeps,""),
    rec('<span class="crest" style="--sz:52px;--h1:hsl(200 80% 55%);--h2:hsl(220 80% 40%)">3</span>',"Series a 3 juegos","Las mas peleadas",threes,"")
  ].join("");
}
safe(()=>renderHof(),"renderHof");

/* ---------- Movimientos desde el draft (tablero vs rosters actuales) ---------- */
function renderMoves(){
  const drafted={};DRAFT_ORDER.forEach((ti,ci)=>{drafted[ti]=DRAFT_ROUNDS.map(r=>r[ci]).filter(Boolean);});
  const draftedBy={};Object.entries(drafted).forEach(([ti,l])=>l.forEach(n=>{draftedBy[n]=+ti;}));
  const cards=DRAFT_ORDER.map(ti=>{
    const roster=ROSTER(ti).map(r=>r[0]),d=drafted[ti];
    const out=d.filter(n=>!roster.includes(n)).map(n=>({n,to:OWNER[n]}));
    const inn=roster.filter(n=>!d.includes(n)).map(n=>({n,from:draftedBy[n]}));
    return {ti,out,inn};
  }).filter(c=>c.out.length||c.inn.length).sort((a,b)=>(b.out.length+b.inn.length)-(a.out.length+a.inn.length));
  const tn=i=>`<a class="nm" href="#team-${slug(TEAMS[i])}">${esc(TEAMS[i].n)}</a>`;
  document.getElementById("drMoves").innerHTML=cards.map(({ti,out,inn})=>{const t=TEAMS[ti];
    return `<article class="mv ${ti===ME?"mine":""}" style="--c:${CONF[t.c].v}"><header>${crest(t)}<a href="#team-${slug(t)}">${esc(t.n)}</a><span>${inn.length} llegan · ${out.length} salen</span></header>
      ${inn.map(x=>`<div class="mv-row in"><i>+</i>${box(x.n,"")}<div><b>${esc(x.n)}</b><small>${x.from!=null&&x.from!==ti?"Llego de "+tn(x.from):"Fichado como agente libre"}</small></div></div>`).join("")}
      ${out.map(x=>`<div class="mv-row out"><i>−</i>${box(x.n,"")}<div><b>${esc(x.n)}</b><small>${x.to!=null?"Ahora en "+tn(x.to):"Liberado"}</small></div></div>`).join("")}
    </article>`;}).join("");
  document.getElementById("drMovesCount").textContent=`${cards.length} equipos con cambios`;
}
safe(()=>renderMoves(),"renderMoves");

/* ---------- compartir perfil: imagen para Instagram (historia 1080x1920 o post 1080x1350) ---------- */
const SHARE_URL="ppvdraftleague.com"; // direccion que aparece en la imagen y en el texto al compartir
const loadImg=(src,cors)=>new Promise(res=>{if(!src)return res(null);const i=new Image();if(cors)i.crossOrigin="anonymous";i.onload=()=>res(i);i.onerror=()=>res(null);i.src=src;});
const cssVar=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();
function wrapLines(x,text,maxW){const words=text.split(" "),lines=[];let cur="";words.forEach(w=>{const t=cur?cur+" "+w:w;if(x.measureText(t).width>maxW&&cur){lines.push(cur);cur=w;}else cur=t;});if(cur)lines.push(cur);return lines;}
function chip(x,cx,y,h,text,bg,fg,stroke){x.font=`700 ${Math.round(h*.5)}px "Barlow Condensed", sans-serif`;const w=x.measureText(text).width+h*.9,sk=h*.22;
  x.beginPath();x.moveTo(cx+sk,y);x.lineTo(cx+w+sk,y);x.lineTo(cx+w-sk,y+h);x.lineTo(cx-sk,y+h);x.closePath();
  if(bg){x.fillStyle=bg;x.fill();}if(stroke){x.strokeStyle=stroke;x.lineWidth=3;x.stroke();}
  x.fillStyle=fg;x.textAlign="left";x.textBaseline="middle";x.fillText(text,cx+h*.45,y+h/2+2);return w;}
async function shareLogo(){ // logo de la liga (archivo en blanco)
  const img=await loadImg(document.querySelector(".brand .mark img")?.src);if(!img)return null;
  const c=document.createElement("canvas");c.width=img.naturalWidth;c.height=img.naturalHeight;const g=c.getContext("2d");g.drawImage(img,0,0);
  return c;
}
async function makeShareImage(ti,fmt){
  const story=fmt==="story",W=1080,H=story?1920:1350;
  const cv=document.createElement("canvas");cv.width=W;cv.height=H;const x=cv.getContext("2d");
  if(document.fonts)await document.fonts.ready;
  const t=TEAMS[ti],[coach,title]=PROFILES[ti],roster=PROFILES[ti][5];
  const C=cssVar(t.c==="rojo"?"--rojo":"--verde")||"#FF4B2B",INK=cssVar("--ink")||"#0B0B0C",INK2=cssVar("--ink-2")||"#151517",LINE=cssVar("--line")||"#2F2F35",CH=cssVar("--chalk")||"#F2F2F0",MU=cssVar("--mute")||"#9C9CA4",VO=cssVar("--volt")||"#FFB62E";
  const mvp=roster.length?roster.reduce((a,b)=>b[6]>a[6]?b:a):null;
  const [logo,lg,spr]=await Promise.all([loadImg(document.querySelector(`.lg-${slug(t)} img`)?.src||(typeof LOGOS!=="undefined"?LOGOS[slug(t)]:`logos/${(typeof LOGO_FILE!=="undefined"&&LOGO_FILE[slug(t)])||slug(t)+".webp"}`)),shareLogo(),
    loadImg((typeof SPR_DATA!=="undefined"&&SPR_DATA[SPR_IDS[mvp[0]]])||SPR_BASE+SPR_IDS[mvp[0]]+".png",true)]);
  // fondo
  x.fillStyle=INK;x.fillRect(0,0,W,H);
  const bandH=story?1150:760;
  x.save();x.beginPath();x.moveTo(0,0);x.lineTo(W,0);x.lineTo(W,bandH*.72);x.lineTo(0,bandH);x.closePath();x.clip();
  const gr=x.createLinearGradient(0,0,W,bandH);gr.addColorStop(0,C+"66");gr.addColorStop(1,C+"14");x.fillStyle=gr;x.fillRect(0,0,W,bandH);
  x.globalAlpha=.08;x.strokeStyle=CH;x.lineWidth=2;for(let i=-H;i<W;i+=70){x.beginPath();x.moveTo(i,0);x.lineTo(i+bandH,bandH);x.stroke();}x.globalAlpha=1;
  x.font=`900 ${story?620:460}px "Big Shoulders Display", Impact, sans-serif`;x.textAlign="right";x.textBaseline="alphabetic";x.strokeStyle=C+"55";x.lineWidth=5;x.strokeText("#"+t.rank,W+30,bandH*.86);
  x.restore();
  // cabecera
  const top=story?110:64;
  const f1=`900 ${story?52:44}px "Big Shoulders Display", Impact, sans-serif`,f2=`700 ${story?30:26}px "Barlow Condensed", sans-serif`;
  x.textAlign="center";x.textBaseline="alphabetic";x.fillStyle=CH;x.font=f1;x.fillText("PPV DRAFT LEAGUE",W/2,top+(story?50:42));
  x.fillStyle=VO;x.font=f2;x.fillText("TEMPORADA 5 · EVOLUTION",W/2,top+(story?92:78));
  // logo del equipo
  x.font=`900 ${story?132:104}px "Big Shoulders Display", Impact, sans-serif`;const preLines=wrapLines(x,t.n.toUpperCase(),920).length;
  const ls=story?(preLines>1?300:400):(preLines>1?200:270),ly=story?250:150;
  if(logo){const r=Math.min(ls/logo.naturalWidth,ls/logo.naturalHeight),w=logo.naturalWidth*r,h=logo.naturalHeight*r;x.save();x.shadowColor="#000c";x.shadowBlur=40;x.shadowOffsetY=16;x.drawImage(logo,(W-w)/2,ly+(ls-h)/2,w,h);x.restore();}
  // nombre
  let y=ly+ls+(story?130:100);
  x.textAlign="center";x.fillStyle=CH;let fs=story?132:104;x.font=`900 ${fs}px "Big Shoulders Display", Impact, sans-serif`;
  let lines=wrapLines(x,t.n.toUpperCase(),920);if(lines.length>2){fs=Math.round(fs*.78);x.font=`900 ${fs}px "Big Shoulders Display", Impact, sans-serif`;lines=wrapLines(x,t.n.toUpperCase(),940);}
  lines.forEach(l=>{x.fillText(l,W/2,y);y+=fs*.92;});
  // etiquetas
  const ch=story?58:50;y+=story?10:0;
  const labels=[["#"+t.ab,null,CH,CH+"88"],[CONF[t.c].name.toUpperCase()+" #"+t.rank,C,"#16161a",null],[t.q?"PLAYOFFS":"ELIMINADO",t.q?VO:"#2a2a30",t.q?"#16161a":MU,null]];
  x.font=`700 ${Math.round(ch*.5)}px "Barlow Condensed", sans-serif`;
  const tw=labels.reduce((s,l)=>s+x.measureText(l[0]).width+ch*.9+16,-16);let cx=(W-tw)/2;
  labels.forEach(l=>{cx+=chip(x,cx,y,ch,l[0],l[1],l[2],l[3])+16;});
  y+=ch+(story?70:52);
  // coach
  x.textAlign="center";x.textBaseline="alphabetic";x.fillStyle=MU;x.font=`600 ${story?30:26}px "Barlow Condensed", sans-serif`;x.fillText("TRAINER",W/2,y);
  y+=story?66:54;x.fillStyle=CH;x.font=`800 ${story?52:44}px "Big Shoulders Display", Impact, sans-serif`;x.fillText((coach+(title&&title!=="-"?`  ·  “${title}”`:"")).toUpperCase(),W/2,y);
  y+=story?66:44;
  // cifras
  let gw=0,gl=0;seriesFor(ti).forEach(m=>{gw+=m.ga;gl+=m.gb;});
  const stats=[[`${t.w}-${t.l}`,"RECORD"],[`${gw}-${gl}`,"JUEGOS"],[sign(t.d),"DIFF"],[String(t.pts),"PUNTOS"]];
  const bw=(W-160-3*16)/4,bh=story?190:160;
  stats.forEach(([v,l],i)=>{const bx=80+i*(bw+16);x.fillStyle=INK2;x.fillRect(bx,y,bw,bh);x.fillStyle=C;x.fillRect(bx,y,bw,6);
    x.fillStyle=CH;x.font=`900 ${story?84:70}px "Big Shoulders Display", Impact, sans-serif`;x.textAlign="center";x.fillText(v,bx+bw/2,y+bh*.62);
    x.fillStyle=MU;x.font=`700 ${story?26:22}px "Barlow Condensed", sans-serif`;x.fillText(l,bx+bw/2,y+bh*.86);});
  y+=bh+(story?40:28);
  // MVP
  const mh=story?240:180;x.fillStyle=INK2;x.fillRect(80,y,W-160,mh);x.strokeStyle=VO;x.lineWidth=4;x.strokeRect(80,y,W-160,mh);
  if(spr){x.imageSmoothingEnabled=false;const s=story?230:180;x.drawImage(spr,100,y+(mh-s)/2,s,s);x.imageSmoothingEnabled=true;}
  const tx=story?360:310;x.textAlign="left";x.fillStyle=VO;x.font=`700 ${story?30:26}px "Barlow Condensed", sans-serif`;x.fillText("MVP DEL EQUIPO",tx,y+mh*.3);
  x.fillStyle=CH;x.font=`900 ${story?76:60}px "Big Shoulders Display", Impact, sans-serif`;x.fillText((getNick(ti,mvp[0])||mvp[0]).toUpperCase(),tx,y+mh*.62);
  x.fillStyle=MU;x.font=`600 ${story?32:26}px "Barlow", sans-serif`;x.fillText(`${getNick(ti,mvp[0])?mvp[0]+" · ":""}${mvp[6]} KOs · ${mvp[7]} caidas · ${mvp[5]} partidas`,tx,y+mh*.86);
  // pie
  if(lg){const h=story?100:56,w=lg.width*h/lg.height;x.drawImage(lg,(W-w)/2,H-(story?70:50)-(story?50:34)-h,w,h);}
  x.textAlign="center";x.fillStyle=MU;x.font=`600 ${story?30:26}px "Barlow", sans-serif`;x.fillText(SHARE_URL,W/2,H-(story?70:50));
  const rojo=cssVar("--rojo")||"#FF4B2B",verde=cssVar("--verde")||"#7ED13A";x.fillStyle=rojo;x.fillRect(0,H-14,W/2,14);x.fillStyle=verde;x.fillRect(W/2,H-14,W/2,14);
  return cv;
}
/* ---------- panel de compartir (general) ---------- */
let shareState={fmt:"story",blob:null,opts:null};
function openShareWith(opts){
  shareState.opts=opts;shareState.blob=null;
  drawer.innerHTML=`<div class="panel sh-panel" role="dialog" aria-modal="true" aria-label="Compartir: ${esc(opts.title)}" style="--cc:${opts.accent||"var(--volt)"}">
    <button type="button" class="close" id="closeD">Cerrar</button>
    <div><span class="label">Compartir en Instagram · ${esc(opts.kind)}</span><h2 style="font-family:var(--f-display);font-weight:900;text-transform:uppercase;font-size:2rem;line-height:1;margin:6px 0 0">${esc(opts.title)}</h2></div>
    <div class="seg" role="group" aria-label="Formato" id="shFmt"><button type="button" data-f="story" aria-pressed="${shareState.fmt==="story"}">Historia 9:16</button><button type="button" data-f="post" aria-pressed="${shareState.fmt==="post"}">Post 4:5</button></div>
    <div class="sh-prev" id="shPrev"><span class="label">Generando imagen…</span></div>
    <div class="sh-actions"><button type="button" class="btn" id="shGo">Compartir</button><button type="button" class="btn ghost" id="shDl">Descargar</button></div>
    <p class="sc-note" id="shMsg">En el telefono, “Compartir” abre las apps instaladas (Instagram, WhatsApp…). En computadora, descarga la imagen y subela desde la app.</p>
  </div>`;
  drawer.hidden=false;
  document.querySelectorAll("#shFmt button").forEach(b=>b.addEventListener("click",()=>{shareState.fmt=b.dataset.f;document.querySelectorAll("#shFmt button").forEach(z=>z.setAttribute("aria-pressed",z===b));renderSharePreview();}));
  document.getElementById("shGo").addEventListener("click",doShare);
  document.getElementById("shDl").addEventListener("click",()=>doDownload());
  renderSharePreview();
}
async function renderSharePreview(){
  const box=document.getElementById("shPrev");if(!box)return;box.innerHTML='<span class="label">Generando imagen…</span>';
  const want=shareState.fmt,opts=shareState.opts;
  const cv=await opts.draw(want);
  if(shareState.opts!==opts||shareState.fmt!==want)return;
  shareState.blob=await new Promise(r=>{try{cv.toBlob(b=>r(b),"image/png");}catch(e){r(null);}});
  box.innerHTML="";cv.className="sh-cv";box.appendChild(cv);
  if(!shareState.blob)document.getElementById("shMsg").textContent=location.protocol==="file:"?"Abriste el archivo desde tu computadora: así el navegador no deja exportar la imagen. Ábrelo desde el sitio publicado (GitHub Pages) para compartir o descargar.":"No se pudo preparar el archivo en este navegador. Puedes tomar una captura de la vista previa.";
}
const shareName=()=>`ppv-${shareState.opts.file}-${shareState.fmt==="story"?"historia":"post"}.png`;
async function doShare(){
  const b=shareState.blob,msg=document.getElementById("shMsg");if(!b)return;
  const file=new File([b],shareName(),{type:"image/png"});
  if(navigator.canShare&&navigator.canShare({files:[file]})){try{await navigator.share({files:[file],title:`${shareState.opts.title} · PPV Draft League`,text:`${shareState.opts.text||shareState.opts.title} · ${SHARE_URL}`});}catch(e){if(e.name!=="AbortError")msg.textContent="No se pudo abrir el menu para compartir. Usa “Descargar”.";}}
  else{await doDownload();if(!/cancelada|pendiente|No se pudo/.test(msg.textContent))msg.textContent="Este navegador no permite compartir archivos directamente: descarga la imagen y subela desde Instagram.";}
}
let dlCap;const getDl=async()=>{if(dlCap!==undefined)return dlCap;try{dlCap=(window.claude&&window.claude.use)?await window.claude.use("downloads"):null;}catch(e){dlCap=null;}return dlCap;};
async function doDownload(){
  const b=shareState.blob,msg=document.getElementById("shMsg");if(!b)return;
  const dl=await getDl();
  if(dl){try{await dl.save({filename:shareName(),data:b});msg.textContent="Imagen guardada.";}
    catch(e){msg.textContent=e&&e.code==="declined"?"Descarga cancelada.":e&&e.code==="rate_limited"?"Ya hay una descarga pendiente; espera un momento.":"No se pudo guardar aqui. Abre el sitio en tu navegador para descargarla.";}return;}
  const a=document.createElement("a");a.href=URL.createObjectURL(b);a.download=shareName();document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),4000);
  msg.textContent="Si la descarga no empezo, manten presionada la imagen para guardarla.";
}

/* ---------- utilidades de dibujo ---------- */
const FD='"Big Shoulders Display", Impact, sans-serif',FL='"Barlow Condensed", sans-serif',FB='"Barlow", sans-serif';
const sharePal=()=>({INK:cssVar("--ink")||"#0B0B0C",INK2:cssVar("--ink-2")||"#151517",INK3:cssVar("--ink-3")||"#202024",LINE:cssVar("--line")||"#2F2F35",CH:cssVar("--chalk")||"#F2F2F0",MU:cssVar("--mute")||"#9C9CA4",VO:cssVar("--volt")||"#FFB62E",RO:cssVar("--rojo")||"#FF4B2B",VE:cssVar("--verde")||"#7ED13A",GO:cssVar("--good")||"#36E3A0"});
const confHex=c=>c==="rojo"?(cssVar("--rojo")||"#FF4B2B"):(cssVar("--verde")||"#7ED13A");
const logoSrcOf=t=>t.ph?null:(typeof LOGOS!=="undefined"?LOGOS[slug(t)]:`logos/${(typeof LOGO_FILE!=="undefined"&&LOGO_FILE[slug(t)])||slug(t)+".webp"}`);
const teamImg=t=>loadImg(logoSrcOf(t));
const boxImg=n=>BOX[n]?loadImg(BOX_DATA[BOX[n]]||BOX_BASE+BOX[n]+".png",true):Promise.resolve(null);
const sprImg=n=>SPR_IDS[n]?loadImg((typeof SPR_DATA!=="undefined"&&SPR_DATA[SPR_IDS[n]])||SPR_BASE+SPR_IDS[n]+".png",true):Promise.resolve(null);
function txt(x,s,font,color,align,px,py){x.font=font;x.fillStyle=color;x.textAlign=align;x.textBaseline="alphabetic";x.fillText(s,px,py);}
function fit(x,img,cx,cy,size,pixel){if(!img){x.save();x.fillStyle="#2a2a30";x.beginPath();x.arc(cx,cy,size*.42,0,7);x.fill();x.fillStyle="#9C9CA4";x.font=`900 ${Math.round(size*.4)}px ${FD}`;x.textAlign="center";x.textBaseline="middle";x.fillText("?",cx,cy+2);x.restore();return;}
  const w=img.naturalWidth||img.width,h=img.naturalHeight||img.height,r=Math.min(size/w,size/h);if(pixel)x.imageSmoothingEnabled=false;x.drawImage(img,cx-w*r/2,cy-h*r/2,w*r,h*r);x.imageSmoothingEnabled=true;}
function ell(x,s,maxW){if(x.measureText(s).width<=maxW)return s;while(s.length>1&&x.measureText(s+"…").width>maxW)s=s.slice(0,-1);return s+"…";}
async function shareFrame(fmt,accent,label){
  const story=fmt==="story",W=1080,H=story?1920:1350,P=sharePal();
  const cv=document.createElement("canvas");cv.width=W;cv.height=H;const x=cv.getContext("2d");
  if(document.fonts)await document.fonts.ready;
  const lg=await shareLogo();
  x.fillStyle=P.INK;x.fillRect(0,0,W,H);
  const bandH=story?820:560;x.save();x.beginPath();x.moveTo(0,0);x.lineTo(W,0);x.lineTo(W,bandH*.7);x.lineTo(0,bandH);x.closePath();x.clip();
  const gr=x.createLinearGradient(0,0,W,bandH);gr.addColorStop(0,accent+"55");gr.addColorStop(1,accent+"10");x.fillStyle=gr;x.fillRect(0,0,W,bandH);
  x.globalAlpha=.07;x.strokeStyle=P.CH;x.lineWidth=2;for(let i=-H;i<W;i+=70){x.beginPath();x.moveTo(i,0);x.lineTo(i+bandH,bandH);x.stroke();}x.globalAlpha=1;x.restore();
  const top=story?110:64;
  txt(x,"PPV DRAFT LEAGUE",`900 ${story?52:44}px ${FD}`,P.CH,"center",W/2,top+(story?50:42));
  txt(x,"TEMPORADA 5 · EVOLUTION",`700 ${story?30:26}px ${FL}`,P.VO,"center",W/2,top+(story?92:78));
  if(label){txt(x,label,`900 ${story?92:72}px ${FD}`,P.CH,"center",W/2,top+(story?220:170));}
  if(lg){const h=story?100:56,w=lg.width*h/lg.height;x.drawImage(lg,(W-w)/2,H-(story?70:50)-(story?50:34)-h,w,h);}
  txt(x,SHARE_URL,`600 ${story?30:26}px ${FB}`,P.MU,"center",W/2,H-(story?70:50));
  x.fillStyle=P.RO;x.fillRect(0,H-14,W/2,14);x.fillStyle=P.VE;x.fillRect(W/2,H-14,W/2,14);
  return {cv,x,W,H,story,P,y0:top+(label?(story?290:220):(story?150:120)),y1:H-(story?250:150)};
}
function chipAt(x,cx,y,h,text,bg,fg,stroke,center){x.font=`700 ${Math.round(h*.5)}px ${FL}`;const w=x.measureText(text).width+h*.9;return chip(x,center?cx-w/2:cx,y,h,text,bg,fg,stroke);}

/* 1. resultado de una serie */
async function drawSeries(i,fmt){
  const m=MATCHES[i],A=TEAMS[m.a],B=TEAMS[m.b],C=confHex(m.c);
  const f=await shareFrame(fmt,C,"RESULTADO");const {x,W,story,P}=f;let y=f.y0;
  const g=GAMES[i]||[],names=[...new Set(g.flat(2))];
  const [la,lb,...sp]=await Promise.all([teamImg(A),teamImg(B),...names.map(boxImg)]);const SP=Object.fromEntries(names.map((n,k)=>[n,sp[k]]));
  txt(x,`SEMANA ${m.w} · SERIE AL MEJOR DE 3`,`700 ${story?32:26}px ${FL}`,P.VO,"center",W/2,y);y+=story?40:28;
  const ls=story?280:200,wA=m.ga>m.gb;
  [[A,la,W*.25,wA],[B,lb,W*.75,!wA]].forEach(([t,img,cx,won])=>{x.save();if(!won)x.globalAlpha=.45;fit(x,img,cx,y+ls/2,ls);x.restore();
    txt(x,"#"+t.ab,`900 ${story?60:48}px ${FD}`,won?P.CH:P.MU,"center",cx,y+ls+(story?66:52));
    x.font=`700 ${story?28:22}px ${FL}`;txt(x,ell(x,t.n.toUpperCase(),420),`700 ${story?28:22}px ${FL}`,P.MU,"center",cx,y+ls+(story?104:82));
    if(won)chipAt(x,cx,y+ls+(story?124:98),story?50:40,"GANADOR",P.VO,"#16161a",null,true);});
  txt(x,`${m.ga}-${m.gb}`,`900 ${story?190:150}px ${FD}`,P.CH,"center",W/2,y+ls*.66);
  y+=ls+(story?220:170);
  const rh=story?200:140;
  [...m.seq].forEach((s,gi)=>{const [ga,gb]=g[gi]||[[],[]];x.fillStyle=P.INK2;x.fillRect(80,y,W-160,rh-14);x.fillStyle=s==="a"?confHex(A.c):confHex(B.c);x.fillRect(80,y,6,rh-14);
    txt(x,`JUEGO ${gi+1}`,`700 ${story?28:24}px ${FL}`,P.MU,"left",110,y+(story?42:34));
    txt(x,`GANA #${(s==="a"?A:B).ab}`,`700 ${story?28:24}px ${FL}`,P.VO,"right",W-110,y+(story?42:34));
    const sz=story?96:70,cy=y+(story?120:88);
    const row=(list,x0,dir,won)=>{if(!list.length){txt(x,"Sin registro",`600 ${story?26:22}px ${FB}`,P.MU,dir>0?"left":"right",x0,cy+8);return;}list.slice(0,4).forEach((n,k)=>{x.save();if(!won)x.globalAlpha=.55;fit(x,SP[n],x0+dir*(k*(sz+8)+sz/2),cy,sz,true);x.restore();});};
    row(ga,110,1,s==="a");row(gb,W-110,-1,s==="b");txt(x,"VS",`900 ${story?34:28}px ${FD}`,P.MU,"center",W/2,cy+12);
    y+=rh;});
  return f.cv;
}
/* 2. campeon */
async function drawChampion(fmt){
  const P0=resolvePlayoffs(),ci=winnerOf(P0.final);const f=await shareFrame(fmt,cssVar("--volt")||"#FFB62E","CAMPEON");const {x,W,story,P}=f;let y=f.y0;
  if(ci==null){txt(x,"POR DEFINIR",`900 120px ${FD}`,P.CH,"center",W/2,y+200);return f.cv;}
  const t=TEAMS[ci],[coach]=PROFILES[ci];
  const svg=TROPHY.replace(/var\(--volt\)/g,P.VO).replace(/var\(--chalk\)/g,P.CH).replace(/var\(--ink\)/g,P.INK).replace("<svg ",'<svg xmlns="http://www.w3.org/2000/svg" width="128" height="144" ');
  const [tr,lo]=await Promise.all([loadImg("data:image/svg+xml;charset=utf-8,"+encodeURIComponent(svg)),teamImg(t)]);
  txt(x,"PLAYOFFS · TEMPORADA 4",`700 ${story?32:26}px ${FL}`,P.VO,"center",W/2,y);y+=story?30:20;
  y+=story?50:30;
  const ls=story?480:320;x.save();x.shadowColor=P.VO+"88";x.shadowBlur=60;fit(x,lo,W/2,y+ls/2,ls);x.restore();y+=ls+(story?120:90);
  let fs=story?120:92;x.font=`900 ${fs}px ${FD}`;let lines=wrapLines(x,t.n.toUpperCase(),940);
  lines.forEach(l=>{txt(x,l,`900 ${fs}px ${FD}`,P.VO,"center",W/2,y);y+=fs*.9;});
  txt(x,"TRAINER "+coach.toUpperCase(),`800 ${story?44:36}px ${FD}`,P.CH,"center",W/2,y+(story?20:10));y+=story?90:64;
  const path=[];["A","B"].forEach(k=>["wc","qf","sf"].forEach(r=>{const m=P0[k][r];if(m.a===ci||m.b===ci)path.push([RNAME[r],m]);}));path.push(["Gran Final",P0.final]);
  const rh=story?84:64;path.forEach(([r,m])=>{const o=TEAMS[m.a===ci?m.b:m.a];x.fillStyle=P.INK2;x.fillRect(140,y,W-280,rh-12);
    txt(x,r.toUpperCase(),`700 ${story?28:22}px ${FL}`,P.MU,"left",170,y+rh*.55);txt(x,"vs #"+o.ab,`800 ${story?40:32}px ${FD}`,P.CH,"right",W-170,y+rh*.58);y+=rh;});
  return f.cv;
}
/* 3. tabla de posiciones */
async function drawTable(fmt,view){
  const general=view==="all";
  const f=await shareFrame(fmt,cssVar("--volt")||"#FFB62E",general?"TABLA GENERAL":"POSICIONES");const {x,W,story,P}=f;let y=f.y0;
  const imgs=await Promise.all(TEAMS.map(teamImg));
  txt(x,general?"FASE REGULAR · 18 EQUIPOS":"FASE REGULAR · POR CONFERENCIA",`700 ${story?32:26}px ${FL}`,P.VO,"center",W/2,y);y+=story?36:24;
  const rh=story?56:40,hh=story?62:44,L=80,R=W-80,colX=k=>R-20-(2-k)*(story?150:130);
  const head=(label,bg,fg)=>{x.fillStyle=bg;x.fillRect(L,y,R-L,hh);txt(x,label,`900 ${story?40:32}px ${FD}`,fg,"left",L+20,y+hh*.72);
    ["W-L","DIFF","PTS"].forEach((h,k)=>txt(x,h,`700 ${story?24:20}px ${FL}`,fg,"right",colX(k),y+hh*.68));y+=hh;};
  const row=(t,k,pos,cut,C)=>{x.fillStyle=k%2?P.INK2:P.INK3;x.fillRect(L,y,R-L,rh);
    if(cut){x.save();x.strokeStyle=C;x.lineWidth=3;x.setLineDash([12,8]);x.beginPath();x.moveTo(L,y);x.lineTo(R,y);x.stroke();x.restore();}
    if(general){x.fillStyle=confHex(t.c);x.fillRect(L,y,6,rh);}
    const cy=y+rh/2,col=t.q?P.CH:P.MU;txt(x,String(pos),`900 ${story?40:32}px ${FD}`,t.q?(general?P.CH:C):P.MU,"left",L+20,cy+(story?14:11));
    fit(x,imgs[TEAMS.indexOf(t)],L+(story?110:96),cy,rh-10);
    x.font=`800 ${story?34:28}px ${FD}`;txt(x,ell(x,t.n.toUpperCase(),story?380:330),`800 ${story?34:28}px ${FD}`,col,"left",L+(story?160:136),cy+(story?12:10));
    [`${t.w}-${t.l}`,sign(t.d),String(t.pts)].forEach((v,j)=>txt(x,v,`${j===2?900:700} ${story?36:30}px ${FD}`,j===2?P.CH:col,"right",colX(j),cy+(story?13:11)));
    y+=rh;};
  if(general){
    head("GENERAL",P.VO,"#16161a");
    TEAMS.slice().sort((a,b)=>a.gr-b.gr).forEach((t,k)=>row(t,k,t.gr,false));
    y+=story?36:22;
    x.fillStyle=P.RO;x.fillRect(W/2-(story?250:220),y-(story?8:6),16,16);x.fillStyle=P.VE;x.fillRect(W/2-(story?230:200),y-(story?8:6),16,16);
    txt(x,"color de conferencia · en blanco: clasificados a playoffs",`600 ${story?24:20}px ${FB}`,P.MU,"left",W/2-(story?200:172),y+(story?6:5));
  }else{
    ["rojo","azul"].forEach(c=>{const C=confHex(c);head(CONF[c].name.toUpperCase(),C,"#16161a");by(c).forEach((t,k)=>row(t,k,t.rank,t.rank===5,C));y+=story?36:22;});
    txt(x,"- - -  linea de playoffs: top 4 de cada conferencia",`600 ${story?24:20}px ${FB}`,P.MU,"center",W/2,y+(story?10:4));
  }
  return f.cv;
}
/* 4. leaderboard */
async function drawLeaders(fmt){
  const f=await shareFrame(fmt,cssVar("--volt")||"#FFB62E","LIDERES EN KOS");const {x,W,story,P}=f;let y=f.y0;
  const N=7,list=MONS_FULL.slice().sort((a,b)=>b.k-a.k).slice(0,N+1),top=list[0];
  const [big,...bx]=await Promise.all([sprImg(top.n),...list.slice(1).map(m=>boxImg(m.n))]);
  txt(x,"POKEMON LEADERBOARD · KOs",`700 ${story?32:26}px ${FL}`,P.VO,"center",W/2,y);y+=story?30:20;
  const bh=story?320:230;x.fillStyle=P.INK2;x.fillRect(80,y,W-160,bh);x.strokeStyle=P.VO;x.lineWidth=4;x.strokeRect(80,y,W-160,bh);
  fit(x,big,80+bh/2+10,y+bh/2,bh-20,true);const tx=80+bh+30,ow=OWNER[top.n];
  txt(x,"#1 · MVP DE LA TEMPORADA",`700 ${story?28:22}px ${FL}`,P.VO,"left",tx,y+bh*.22);
  txt(x,(nickOf(top.n)||top.n).toUpperCase(),`900 ${story?84:62}px ${FD}`,P.CH,"left",tx,y+bh*.48);
  txt(x,`${nickOf(top.n)?top.n+" · ":""}${top.k} KOs · ${(top.k/top.d).toFixed(2)} K/D`,`600 ${story?32:26}px ${FB}`,P.MU,"left",tx,y+bh*.66);
  x.font=`800 ${story?36:28}px ${FD}`;txt(x,ow!=null?ell(x,"EN #"+TEAMS[ow].ab+" · "+TEAMS[ow].n.toUpperCase(),W-80-tx-20):"AGENTE LIBRE",`800 ${story?36:28}px ${FD}`,ow!=null?confHex(TEAMS[ow].c):P.MU,"left",tx,y+bh*.86);
  y+=bh+(story?30:20);
  const rh=story?120:86,mx=list[0].k;
  list.slice(1).forEach((m,k)=>{x.fillStyle=k%2?P.INK2:P.INK3;x.fillRect(80,y,W-160,rh-8);const cy=y+(rh-8)/2;
    txt(x,String(k+2),`900 ${story?40:34}px ${FD}`,P.MU,"left",104,cy+13);fit(x,bx[k],190,cy,rh-20,true);
    const o=OWNER[m.n];txt(x,m.n.toUpperCase(),`800 ${story?38:32}px ${FD}`,P.CH,"left",250,cy+(o!=null?2:12));if(o!=null)txt(x,"#"+TEAMS[o].ab,`700 ${story?24:20}px ${FL}`,P.MU,"left",250,cy+(story?32:28));
    const bx0=story?620:600,bw=(story?280:290)*m.k/mx;const gr=x.createLinearGradient(bx0,0,bx0+bw,0);gr.addColorStop(0,P.RO);gr.addColorStop(1,P.VE);x.fillStyle=gr;x.fillRect(bx0,cy-8,bw,16);
    txt(x,String(m.k),`900 ${story?44:36}px ${FD}`,P.CH,"right",W-104,cy+15);y+=rh;});
  return f.cv;
}
/* 5. bracket */
async function drawBracket(fmt){
  const P0=resolvePlayoffs();const f=await shareFrame(fmt,cssVar("--volt")||"#FFB62E","PLAYOFFS");const {x,W,story,P}=f;let y=f.y0;
  const imgs=await Promise.all(TEAMS.map(teamImg));
  txt(x,"FORMATO ESCALERA · SERIES AL MEJOR DE 3",`700 ${story?32:26}px ${FL}`,P.VO,"center",W/2,y);y+=story?30:18;
  const rh=story?140:104,hh=story?54:40;
  const match=(lab,m,isFinal)=>{const w=winnerOf(m);x.fillStyle=isFinal?P.VO+"22":P.INK2;x.fillRect(80,y,W-160,rh-12);if(isFinal){x.strokeStyle=P.VO;x.lineWidth=3;x.strokeRect(80,y,W-160,rh-12);}
    const cy=y+(rh-12)/2;txt(x,lab.toUpperCase(),`700 ${story?22:18}px ${FL}`,P.MU,"center",W/2,y+(story?30:24));
    const side=(ti,cx,align)=>{if(ti==null){txt(x,"POR DEFINIR",`700 ${story?28:22}px ${FL}`,P.MU,align,cx,cy+10);return;}const t=TEAMS[ti],won=w===ti;x.save();if(w!=null&&!won)x.globalAlpha=.45;
      const ls=rh-(story?46:34),lx=align==="left"?cx+ls/2:cx-ls/2;fit(x,imgs[ti],lx,cy+(story?8:6),ls);
      const ax=align==="left"?cx+ls+16:cx-ls-16;txt(x,"#"+t.ab,`900 ${story?46:36}px ${FD}`,won?P.CH:P.MU,align,ax,cy+(story?22:16));if(won){x.font=`900 ${story?46:36}px ${FD}`;const tw=x.measureText("#"+t.ab).width;x.fillStyle=P.VO;x.fillRect(align==="left"?ax:ax-tw,cy+(story?32:24),tw,5);}x.restore();};
    side(m.a,110,"left");side(m.b,W-110,"right");
    txt(x,"VS",`900 ${story?36:28}px ${FD}`,P.MU,"center",W/2,cy+(story?24:18));y+=rh;};
  [["A","LADO A"],["B","LADO B"]].forEach(([k,lab])=>{txt(x,lab,`900 ${story?36:28}px ${FD}`,P.CH,"left",84,y+hh*.7);y+=hh;match("Wild Card",P0[k].wc);match("Cuartos de final",P0[k].qf);match("Semifinal",P0[k].sf);});
  y+=story?10:4;match("Gran Final",P0.final,true);
  return f.cv;
}
/* encabezado de equipo centrado (logo + nombre + línea secundaria) */
function teamHeaderCentered(x,lo,name,line2,C,y,story,W,P){
  const th=story?150:100,gap=24,f1=`900 ${story?64:50}px ${FD}`,f2=`700 ${story?28:22}px ${FL}`,maxT=W-160-th-gap;
  x.font=f1;const n1=ell(x,name,maxT),w1=x.measureText(n1).width;x.font=f2;const n2=ell(x,line2,maxT),w2=x.measureText(n2).width;
  const total=th+gap+Math.max(w1,w2),sx=(W-total)/2,tx=sx+th+gap;
  fit(x,lo,sx+th/2,y+th/2,th);txt(x,n1,f1,P.CH,"left",tx,y+th*.52);txt(x,n2,f2,C,"left",tx+2,y+th*.84);
  return th;
}
/* 6. mi draft */
async function drawMyDraft(fmt){
  const t=TEAMS[ME],C=confHex(t.c),col=DRAFT_ORDER.indexOf(ME),N=DRAFT_ORDER.length,roster=ROSTER(ME).map(r=>r[0]);
  const picks=DRAFT_ROUNDS.map((row,ri)=>({r:ri+1,k:pickNo(ri,col),n:row[col]}));
  const f=await shareFrame(fmt,C,"MI DRAFT");const {x,W,story,P}=f;let y=f.y0;
  const [lo,...sp]=await Promise.all([teamImg(t),...picks.map(p=>p.n?sprImg(p.n):Promise.resolve(null))]);
  const spent=picks.reduce((s,p)=>s+(p.n?PTS[p.n]||0:0),0);
  const th=teamHeaderCentered(x,lo,t.n.toUpperCase(),`#${t.ab} · TRAINER ${PROFILES[ME][0].toUpperCase()} · ${spent} PTS`,C,y,story,W,P);y+=th+(story?36:22);
  const cw=(W-160-20)/2,ch=story?250:180;
  picks.forEach((p,k)=>{const cx=80+(k%2)*(cw+20),cy=y+Math.floor(k/2)*(ch+14);const gone=p.n&&!roster.includes(p.n);
    x.fillStyle=P.INK2;x.fillRect(cx,cy,cw,ch);x.fillStyle=gone?P.LINE:C;x.fillRect(cx,cy,cw,5);
    txt(x,`RONDA ${p.r} · PICK ${p.r}.${p.k}`,`700 ${story?24:20}px ${FL}`,P.MU,"left",cx+18,cy+(story?40:32));
    if(!p.n){txt(x,"SIN PICK",`800 ${story?40:32}px ${FD}`,P.MU,"left",cx+18,cy+ch*.6);return;}
    const s=story?170:120;x.save();if(gone)x.globalAlpha=.5;fit(x,sp[k],cx+cw-s/2-6,cy+ch*.56,s,true);x.restore();
    x.font=`900 ${story?44:34}px ${FD}`;txt(x,ell(x,p.n.toUpperCase(),cw-s-30),`900 ${story?44:34}px ${FD}`,gone?P.MU:P.CH,"left",cx+18,cy+ch*.58);
    txt(x,`${PTS[p.n]} pts${gone?" · ya no esta":""}`,`700 ${story?28:22}px ${FL}`,gone?P.MU:P.VO,"left",cx+18,cy+ch*.8);});
  return f.cv;
}

/* 7. roster actual */
async function drawRoster(ti,fmt){
  const t=TEAMS[ti],C=confHex(t.c),[coach,,draftPts]=PROFILES[ti],roster=ROSTER(ti).slice().sort((a,b)=>b[1]-a[1]);
  const f=await shareFrame(fmt,C,"ROSTER");const {x,W,story,P}=f;let y=f.y0;
  const [lo,...sp]=await Promise.all([teamImg(t),...roster.map(r=>sprImg(r[0]))]);
  const kills=roster.reduce((s,r)=>s+r[6],0);
  const th=teamHeaderCentered(x,lo,t.n.toUpperCase(),`#${t.ab} · ${CONF[t.c].name.toUpperCase()} #${t.rank} · ${draftPts} PTS · ${kills} KOs`,C,y,story,W,P);
  y+=th+(story?36:22);
  const mvp=roster.length?roster.reduce((a,b)=>b[6]>a[6]?b:a):null;
  const cw=(W-160-20)/2,ch=story?250:180;
  roster.slice(0,8).forEach((r,k)=>{const [n,cost,types,,,g,kk,d]=r,cx=80+(k%2)*(cw+20),cy=y+Math.floor(k/2)*(ch+14),ts=types.split("/");
    x.fillStyle=P.INK2;x.fillRect(cx,cy,cw,ch);
    const bhh=ch*.42,tc1=TYPE[ts[0]][1],tc2=TYPE[ts[1]||ts[0]][1];x.fillStyle=tc1+"70";x.beginPath();x.moveTo(cx,cy);x.lineTo(cx+cw*.58,cy);x.lineTo(cx+cw*.48,cy+bhh);x.lineTo(cx,cy+bhh);x.closePath();x.fill();x.fillStyle=tc2+"70";x.beginPath();x.moveTo(cx+cw*.58,cy);x.lineTo(cx+cw,cy);x.lineTo(cx+cw,cy+bhh);x.lineTo(cx+cw*.48,cy+bhh);x.closePath();x.fill();
    if(r===mvp){x.strokeStyle=P.VO;x.lineWidth=4;x.strokeRect(cx+2,cy+2,cw-4,ch-4);chip(x,cx+cw-(story?140:118),cy+10,story?34:28,"MVP",P.VO,"#16161a",null);}
    const s=story?170:120;fit(x,sp[k],cx+cw-s/2-6,cy+ch*.58,s,true);
    x.font=`900 ${story?40:30}px ${FD}`;txt(x,ell(x,(getNick(ti,n)||n).toUpperCase(),cw-s-24),`900 ${story?40:30}px ${FD}`,P.CH,"left",cx+18,cy+(story?56:44));
    let tx=cx+18;const chh=story?32:26;ts.forEach(ty=>{tx+=chip(x,tx,cy+ch*.42-chh/2,chh,TYPE[ty][0].toUpperCase(),TYPE[ty][1],"#16161a",null)+8;});
    txt(x,`${cost} PTS`,`900 ${story?44:34}px ${FD}`,P.VO,"left",cx+18,cy+ch*(story?.74:.76));
    txt(x,`${getNick(ti,n)?n+" · ":""}${kk} KOs · ${d} caidas · ${g} partidas`,`600 ${story?24:19}px ${FB}`,P.MU,"left",cx+18,cy+ch*.9);});
  return f.cv;
}
/* 8. juegos de la semana */
async function drawWeek(w,fmt,sched){
  const wk=MATCHES.filter(m=>m.w===w);
  const f=await shareFrame(fmt,cssVar("--volt")||"#FFB62E",sched?`CALENDARIO`:`SEMANA ${w}`);const {x,W,story,P}=f;let y=f.y0;
  const imgs=await Promise.all(TEAMS.map(teamImg));
  const sweeps=wk.filter(m=>m.seq.length===2).length;
  txt(x,sched?`SEMANA ${w} · ${wk.length} SERIES AL MEJOR DE 3`:`${wk.length} SERIES · ${sweeps} EN 2-0 · ${wk.length-sweeps} A 3 JUEGOS`,`700 ${story?32:26}px ${FL}`,P.VO,"center",W/2,y);y+=story?30:20;
  const hh=story?56:44,rh=story?124:92,L=80,R=W-80;
  ["rojo","azul"].forEach(c=>{const C=confHex(c),list=wk.filter(m=>m.c===c);
    x.fillStyle=C;x.fillRect(L,y,R-L,hh);txt(x,CONF[c].name.toUpperCase(),`900 ${story?38:30}px ${FD}`,"#16161a","left",L+20,y+hh*.72);y+=hh;
    list.forEach((m,k)=>{x.fillStyle=k%2?P.INK2:P.INK3;x.fillRect(L,y,R-L,rh);const cy=y+rh/2,wA=m.ga>m.gb,ls=rh-(story?30:22);
      const side=(ti,won,left)=>{const t=TEAMS[ti];x.save();if(!won)x.globalAlpha=.45;const lx=left?L+20+ls/2:R-20-ls/2;fit(x,imgs[ti],lx,cy,ls);
        const ax=left?L+20+ls+16:R-20-ls-16;txt(x,"#"+t.ab,`900 ${story?50:38}px ${FD}`,won?P.CH:P.MU,left?"left":"right",ax,cy+(story?10:8));
        x.font=`600 ${story?22:18}px ${FL}`;txt(x,ell(x,t.n.toUpperCase(),story?260:220),`600 ${story?22:18}px ${FL}`,P.MU,left?"left":"right",ax,cy+(story?38:30));x.restore();};
      side(m.a,sched||wA,true);side(m.b,sched||!wA,false);
      txt(x,sched?"VS":`${m.ga} - ${m.gb}`,`900 ${story?64:50}px ${FD}`,P.CH,"center",W/2,cy+(story?22:17));y+=rh;});
    const playing=new Set(list.flatMap(m=>[m.a,m.b])),byes=TEAMS.map((t,i)=>[t,i]).filter(([t,i])=>t.c===c&&!playing.has(i));
    txt(x,byes.length?"Descansa: "+byes.map(([t])=>"#"+t.ab+" "+t.n).join(", "):"",`600 ${story?24:20}px ${FB}`,P.MU,"left",L+4,y+(story?32:26));
    y+=story?52:38;});
  return f.cv;
}

/* 9. power ranking */
async function drawPower(w,fmt){
  const rows=powerTable(w);
  const f=await shareFrame(fmt,cssVar("--volt")||"#FFB62E","POWER RANKING");const {x,W,story,P}=f;let y=f.y0;
  const imgs=await Promise.all(TEAMS.map(teamImg));
  txt(x,`SEMANA ${w} DE ${WEEKS} · FASE REGULAR`,`700 ${story?32:26}px ${FL}`,P.VO,"center",W/2,y);y+=story?40:28;
  const rh=story?64:46,L=80,R=W-80;
  rows.forEach((r,k)=>{const t=r.t,cy=y+rh/2,fs=story?34:26;x.fillStyle=k%2?P.INK2:P.INK3;x.fillRect(L,y,R-L,rh);x.fillStyle=confHex(t.c);x.fillRect(L,y,6,rh);
    txt(x,String(r.pos),`900 ${story?40:30}px ${FD}`,P.CH,"left",L+22,cy+(story?14:10));
    const mv=r.move;txt(x,mv>0?"▲"+mv:mv<0?"▼"+(-mv):"–",`700 ${story?24:19}px ${FL}`,mv>0?P.GO:mv<0?P.RO:P.MU,"left",L+(story?84:70),cy+(story?8:7));
    fit(x,imgs[r.i],L+(story?160:130),cy,rh-12);
    x.font=`800 ${fs}px ${FD}`;txt(x,ell(x,t.n.toUpperCase(),story?470:440),`800 ${fs}px ${FD}`,P.CH,"left",L+(story?200:164),cy+(story?12:9));
    txt(x,`${r.wins}-${r.losses}`,`700 ${story?30:24}px ${FD}`,P.MU,"right",R-(story?130:110),cy+(story?11:8));
    txt(x,r.score.toFixed(1),`900 ${story?36:28}px ${FD}`,P.VO,"right",R-20,cy+(story?13:10));
    y+=rh;});
  return f.cv;
}
/* 10. Pokemon de la semana */
async function drawPotw(w,fmt){
  const p=potwOf(w),t=p?TEAMS[p.ti]:null,C=t?confHex(t.c):(cssVar("--volt")||"#FFB62E");
  const f=await shareFrame(fmt,C,"POKEMON DE LA SEMANA");const {x,W,story,P}=f;let y=f.y0;
  txt(x,`SEMANA ${w} · FASE REGULAR`,`700 ${story?32:26}px ${FL}`,P.VO,"center",W/2,y);y+=story?20:10;
  if(!p){txt(x,"SIN DATOS",`900 100px ${FD}`,P.MU,"center",W/2,y+200);return f.cv;}
  const [sp,lo]=await Promise.all([sprImg(p.n),teamImg(t)]);
  const ss=story?560:380;x.save();x.globalAlpha=.18;x.fillStyle=C;x.beginPath();x.arc(W/2,y+ss/2,ss*.42,0,7);x.fill();x.restore();fit(x,sp,W/2,y+ss/2,ss,true);y+=ss+(story?10:0);
  const nk=getNick(p.ti,p.n),nf=`900 ${story?110:84}px ${FD}`;x.font=nf;txt(x,ell(x,(nk||p.n).toUpperCase(),W-160),nf,P.CH,"center",W/2,y+(story?90:70));y+=story?110:84;
  if(nk){txt(x,p.n.toUpperCase(),`700 ${story?34:28}px ${FL}`,P.MU,"center",W/2,y+(story?30:24));y+=story?50:36;}
  y+=story?30:16;
  const th=teamHeaderCentered(x,lo,t.n.toUpperCase(),`#${t.ab} · ${CONF[t.c].name.toUpperCase()}`,C,y,story,W,P);y+=th+(story?50:28);
  const stats=[[p.w,"VICTORIAS"],[p.g,"JUEGOS"],[p.k,"KOS EN LA TEMPORADA"]],bw=(W-160-40)/3,bh=story?150:110;
  stats.forEach(([v,l],k)=>{const bx=80+k*(bw+20);x.fillStyle=P.INK3;x.fillRect(bx,y,bw,bh);x.fillStyle=C;x.fillRect(bx,y,bw,6);
    txt(x,String(v),`900 ${story?80:60}px ${FD}`,P.CH,"center",bx+bw/2,y+bh*.6);const lf=`700 ${story?24:19}px ${FL}`;x.font=lf;txt(x,ell(x,l,bw-20),lf,P.MU,"center",bx+bw/2,y+bh*.86);});
  return f.cv;
}
/* 11. cara a cara */
async function drawH2H(a,b,fmt){
  const A=TEAMS[a],B=TEAMS[b],CA=confHex(A.c),CB=confHex(B.c),H=h2hData(a,b);
  const f=await shareFrame(fmt,CA,"CARA A CARA");const {x,W,story,P}=f;let y=f.y0;
  const [la,lb]=await Promise.all([teamImg(A),teamImg(B)]);
  const ls=story?260:190;fit(x,la,W*.25,y+ls/2,ls);fit(x,lb,W*.75,y+ls/2,ls);
  txt(x,"VS",`900 ${story?120:90}px ${FD}`,P.VO,"center",W/2,y+ls/2+(story?40:30));y+=ls+(story?60:44);
  const nm=(t,cx,C)=>{const nf=`900 ${story?54:42}px ${FD}`;x.font=nf;txt(x,ell(x,t.n.toUpperCase(),W/2-100),nf,P.CH,"center",cx,y);txt(x,`#${t.ab} · ${CONF[t.c].name.toUpperCase()}`,`700 ${story?26:21}px ${FL}`,C,"center",cx,y+(story?38:30));};
  nm(A,W*.25,CA);nm(B,W*.75,CB);y+=story?90:66;
  const rh=story?96:70;
  H.rows.forEach((r,k)=>{x.fillStyle=k%2?P.INK2:P.INK3;x.fillRect(80,y,W-160,rh);const cy=y+rh/2;
    if(r.win==="a"){x.fillStyle=CA;x.fillRect(80,y,8,rh);}if(r.win==="b"){x.fillStyle=CB;x.fillRect(W-88,y,8,rh);}
    txt(x,r.fa,`900 ${story?46:36}px ${FD}`,r.win==="a"?P.CH:P.MU,"left",108,cy+(story?16:12));
    txt(x,r.fb,`900 ${story?46:36}px ${FD}`,r.win==="b"?P.CH:P.MU,"right",W-108,cy+(story?16:12));
    txt(x,r.lab.toUpperCase(),`700 ${story?26:21}px ${FL}`,P.MU,"center",W/2,cy+(story?9:7));y+=rh;});
  y+=story?56:40;txt(x,H.histTxt.toUpperCase(),`700 ${story?30:24}px ${FL}`,P.VO,"center",W/2,y);
  return f.cv;
}

/* 12. mis pronosticos de la semana */
async function drawPicks(w,fmt){
  const wk=MATCHES.filter(m=>m.w===w),st=prState(w),rev=st.rev,hits=wk.filter(m=>st.p[m.i]===winSide(m)).length;
  const f=await shareFrame(fmt,cssVar("--volt")||"#FFB62E","PRONOSTICOS");const {x,W,story,P}=f;let y=f.y0;
  const imgs=await Promise.all(TEAMS.map(teamImg));
  txt(x,`SEMANA ${w} · TRAINER ${PROFILES[ME][0].toUpperCase()}`,`700 ${story?32:26}px ${FL}`,P.VO,"center",W/2,y);y+=story?24:14;
  if(rev){txt(x,`${hits}/${wk.length}`,`900 ${story?110:80}px ${FD}`,P.CH,"center",W/2,y+(story?100:72));
    txt(x,"ACIERTOS",`700 ${story?28:22}px ${FL}`,P.MU,"center",W/2,y+(story?140:100));y+=story?170:118;}
  else y+=story?20:10;
  const rh=story?130:(rev?78:88),L=80,R=W-80,ls=rh-(story?40:24);
  wk.forEach((m,k)=>{const cy=y+rh/2,pk=st.p[m.i],ws=winSide(m);x.fillStyle=k%2?P.INK2:P.INK3;x.fillRect(L,y,R-L,rh);
    const side=(s,left)=>{const ti=s==="a"?m.a:m.b,t=TEAMS[ti],on=pk===s,C=confHex(t.c);x.save();if(pk&&!on)x.globalAlpha=.4;
      if(on){x.fillStyle=C;x.fillRect(left?L:R-8,y,8,rh);}
      fit(x,imgs[ti],left?L+28+ls/2:R-28-ls/2,cy,ls);
      const ax=left?L+28+ls+16:R-28-ls-16;
      txt(x,"#"+t.ab,`900 ${story?50:38}px ${FD}`,on?P.CH:P.MU,left?"left":"right",ax,cy+(on?(story?2:1):(story?16:12)));
      if(on)txt(x,"MI PICK",`700 ${story?22:18}px ${FL}`,C,left?"left":"right",ax,cy+(story?32:26));
      x.restore();};
    side("a",true);side("b",false);
    if(rev){const ok=pk===ws;txt(x,`${m.ga} - ${m.gb}`,`900 ${story?54:42}px ${FD}`,P.CH,"center",W/2,cy+(story?6:4));
      txt(x,pk?(ok?"ACIERTO":"FALLO"):"SIN PICK",`700 ${story?22:18}px ${FL}`,pk?(ok?P.GO:P.RO):P.MU,"center",W/2,cy+(story?36:28));}
    else txt(x,"VS",`900 ${story?44:34}px ${FD}`,P.MU,"center",W/2,cy+(story?14:11));
    y+=rh;});
  return f.cv;
}

/* 13. tabla de aciertos de pronosticos */
async function drawPickTable(fmt){
  const {ms,rows,lab}=pickRows();
  const f=await shareFrame(fmt,cssVar("--volt")||"#FFB62E","TABLA DE ACIERTOS");const {x,W,story,P}=f;let y=f.y0;
  const imgs=await Promise.all(TEAMS.map(teamImg));
  txt(x,"PRONOSTICOS · "+lab.toUpperCase(),`700 ${story?32:26}px ${FL}`,P.VO,"center",W/2,y);y+=story?40:28;
  const rh=story?64:46,L=80,R=W-80;
  rows.forEach((r,k)=>{const t=r.t,cy=y+rh/2,me=r.ti===ME,fs=story?34:26;
    x.fillStyle=me?"#2a2614":k%2?P.INK2:P.INK3;x.fillRect(L,y,R-L,rh);x.fillStyle=me?P.VO:confHex(t.c);x.fillRect(L,y,6,rh);
    txt(x,String(r.pos),`900 ${story?40:30}px ${FD}`,r.pos<=3?P.VO:P.CH,"left",L+22,cy+(story?14:10));
    fit(x,imgs[r.ti],L+(story?120:100),cy,rh-12);
    const nf=`800 ${fs}px ${FD}`;x.font=nf;const nm=ell(x,PROFILES[r.ti][0].toUpperCase()+(me?" (TU)":""),story?440:420);
    txt(x,nm,nf,P.CH,"left",L+(story?164:136),cy+(story?12:9));x.font=nf;const nw=x.measureText(nm).width;
    txt(x,"#"+t.ab,`700 ${story?22:18}px ${FL}`,P.MU,"left",L+(story?164:136)+nw+12,cy+(story?10:8));
    txt(x,`${r.ok}/${ms.length}`,`900 ${story?36:28}px ${FD}`,P.CH,"right",R-(story?140:120),cy+(story?13:10));
    txt(x,Math.round(r.ok/ms.length*100)+"%",`700 ${story?30:24}px ${FD}`,P.MU,"right",R-20,cy+(story?11:8));
    y+=rh;});
  return f.cv;
}

/* 14. equipos por conferencia */
async function drawConfs(fmt,view){
  const confs=view==="all"?["rojo","azul"]:[view],one=confs.length===1;
  const f=await shareFrame(fmt,one?confHex(confs[0]):(cssVar("--volt")||"#FFB62E"),one?CONF[confs[0]].name.toUpperCase():"CONFERENCIAS");const {x,W,story,P}=f;let y=f.y0;
  const imgs=await Promise.all(TEAMS.map(teamImg));
  txt(x,one?`CONFERENCIA · ${by(confs[0]).length} EQUIPOS`:`${TEAMS.length} EQUIPOS · DOS CONFERENCIAS`,`700 ${story?32:26}px ${FL}`,P.VO,"center",W/2,y);y+=story?36:22;
  const L=80,R=W-80,gap=story?14:10,hh=story?60:44,sep=story?30:20,rows=3;
  const avail=f.y1-y-(confs.length-1)*sep,ch=Math.floor((avail/confs.length-hh-gap*rows)/rows),cw=(R-L-2*gap)/3;
  confs.forEach(c=>{const C=confHex(c);
    x.fillStyle=C;x.fillRect(L,y,R-L,hh);txt(x,CONF[c].name.toUpperCase(),`900 ${story?40:32}px ${FD}`,"#16161a","left",L+20,y+hh*.72);
    txt(x,`${by(c).length} EQUIPOS`,`700 ${story?24:20}px ${FL}`,"#16161a","right",R-20,y+hh*.68);y+=hh+gap;
    by(c).slice().sort((a,b)=>a.rank-b.rank).forEach((t,k)=>{const cx=L+(k%3)*(cw+gap),cy=y+Math.floor(k/3)*(ch+gap),ls=Math.min(ch*.5,cw*.45);
      x.fillStyle=P.INK3;x.fillRect(cx,cy,cw,ch);x.fillStyle=C;x.fillRect(cx,cy,cw,5);
      fit(x,imgs[TEAMS.indexOf(t)],cx+cw/2,cy+12+ls/2,ls);
      txt(x,"#"+t.rank,`900 ${story?30:22}px ${FD}`,t.q?C:P.MU,"left",cx+12,cy+(story?40:30));
      let fz=Math.round(ch*.15);const N=t.n.toUpperCase();x.font=`800 ${fz}px ${FD}`;while(fz>ch*.1&&x.measureText(N).width>cw-20){fz--;x.font=`800 ${fz}px ${FD}`;}const nf=`800 ${fz}px ${FD}`;txt(x,ell(x,N,cw-20),nf,P.CH,"center",cx+cw/2,cy+12+ls+ch*.19);
      txt(x,"#"+t.ab,`700 ${Math.round(ch*.1)}px ${FL}`,P.MU,"center",cx+cw/2,cy+12+ls+ch*.19+ch*.13);});
    y+=rows*(ch+gap)-gap+sep;});
  return f.cv;
}

/* 15. mercado: trades y fichajes */
async function drawMarket(fmt){
  const {trades,fas}=TX(),all=[...trades.map(t=>({tr:t})),...fas.map(t=>({fa:t}))];
  const f=await shareFrame(fmt,cssVar("--volt")||"#FFB62E","MERCADO");const {x,W,story,P}=f;let y=f.y0;
  const imgs=await Promise.all(TEAMS.map(teamImg));
  txt(x,`${trades.length} TRADES · ${fas.length} EQUIPOS EN FREE AGENCY`,`700 ${story?32:26}px ${FL}`,P.VO,"center",W/2,y);y+=story?30:20;
  const rh=story?108:84,L=80,R=W-80,room=Math.floor((f.y1-y-(story?50:40))/rh),list=all.slice(0,room),ls=rh-(story?40:30);
  const ab=i=>"#"+TEAMS[i].ab,join=a=>a.join(", ");
  list.forEach((e,k)=>{const cy=y+rh/2;x.fillStyle=k%2?P.INK2:P.INK3;x.fillRect(L,y,R-L,rh);
    const lf=`900 ${story?36:28}px ${FD}`,sf=`600 ${story?24:19}px ${FB}`,tx=L+(e.tr?ls*2+44:ls+30),mw=R-20-tx;
    if(e.tr){const t=e.tr;x.fillStyle=confHex(TEAMS[t.a].c);x.fillRect(L,y,6,rh);fit(x,imgs[t.a],L+18+ls/2,cy,ls);fit(x,imgs[t.b],L+30+ls*1.5,cy,ls);
      txt(x,`${ab(t.a)} ⇄ ${ab(t.b)}`,lf,P.CH,"left",tx,cy-(story?6:4));
      const parts=[t.ba.length?`${ab(t.a)} recibe ${join(t.ba)}`:"",t.ab.length?`${ab(t.b)} recibe ${join(t.ab)}`:""].filter(Boolean).join(" · ");
      x.font=sf;txt(x,ell(x,parts,mw),sf,P.MU,"left",tx,cy+(story?30:24));}
    else{const t=e.fa;x.fillStyle=confHex(TEAMS[t.ti].c);x.fillRect(L,y,6,rh);fit(x,imgs[t.ti],L+18+ls/2,cy,ls);
      txt(x,`${ab(t.ti)} · FREE AGENCY`,lf,P.CH,"left",tx,cy-(story?6:4));
      const parts=[t.inn.length?`Ficha ${join(t.inn)}`:"",t.out.length?`Libera ${join(t.out)}`:""].filter(Boolean).join(" · ");
      x.font=sf;txt(x,ell(x,parts,mw),sf,P.MU,"left",tx,cy+(story?30:24));}
    y+=rh;});
  if(all.length>list.length)txt(x,`+${all.length-list.length} movimientos mas en ${SHARE_URL}`,`600 ${story?26:21}px ${FB}`,P.MU,"center",W/2,y+(story?40:32));
  return f.cv;
}

/* renders 3D de Pokemon HOME (PokeAPI) para los overlays de OBS */
const HOME_BASE="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/home/";
const homeImg=n=>SPR_IDS[n]?loadImg((typeof HOME_DATA!=="undefined"&&HOME_DATA[SPR_IDS[n]])||HOME_BASE+SPR_IDS[n]+".png",true).then(i=>i||sprImg(n)):sprImg(n);
/* 16. overlays de OBS (1920x1080) */
const OBS_GAME={x:160,y:120,w:1600,h:900}; // recuadro transparente para la captura del juego (16:9)
async function obsBase(){const W=1920,H=1080,cv=document.createElement("canvas");cv.width=W;cv.height=H;const x=cv.getContext("2d");if(document.fonts)await document.fonts.ready;return {cv,x,W,H,P:sharePal()};}
async function drawOverlay(mi){
  const m=MATCHES[mi],A=TEAMS[m.a],B=TEAMS[m.b],{cv,x,W,H,P}=await obsBase(),CA=confHex(A.c),CB=confHex(B.c),G=OBS_GAME;
  const [la,lb,lg]=await Promise.all([teamImg(A),teamImg(B),shareLogo()]);
  const poly=(pts,fill)=>{x.beginPath();pts.forEach(([px,py],k)=>k?x.lineTo(px,py):x.moveTo(px,py));x.closePath();x.fillStyle=fill;x.fill();};
  const cap=f=>{x.font=f;return x.measureText("H").actualBoundingBoxAscent;}; // altura real de las mayusculas
  // degradado suave para dar volumen a las barras
  const shade=(x0,y0,w,h,down)=>{const g=x.createLinearGradient(0,y0,0,y0+h);g.addColorStop(0,down?"rgba(255,255,255,.07)":"rgba(255,255,255,0)");g.addColorStop(1,down?"rgba(255,255,255,0)":"rgba(255,255,255,.07)"); /* termina en el mismo tono de las columnas */x.fillStyle=g;x.fillRect(x0,y0,w,h);};
  // medidas de referencia: margen exterior unico y zonas visibles (sin la linea del borde del juego, 4px)
  const M=26,BW=4,topH=G.y-BW,topC=topH/2,footY=G.y+G.h+BW,footC=footY+(H-footY)/2,colW=G.x-BW,colLC=colW/2,colRC=W-colW/2;
  x.fillStyle=P.INK;x.fillRect(0,0,W,H);
  x.fillStyle=P.INK2;x.fillRect(0,G.y,G.x,G.h);x.fillRect(W-G.x,G.y,G.x,G.h);
  // roster: casillas cuadradas del mismo ancho, centradas en su columna y en la altura del juego
  const col=async(ti,cx,C)=>{const ro=ROSTER(ti).slice().sort((a,b)=>b[1]-a[1]),imgs=await Promise.all(ro.map(r=>homeImg(r[0]))),n=ro.length,gap=8;
    const slots=Math.max(8,n),q=Math.min(colW-2*M,Math.floor((G.h-(slots-1)*gap)/slots)),tot=slots*q+(slots-1)*gap,y0=G.y+(G.h-tot)/2; // mismas filas en ambos lados
    ro.forEach((r,k)=>{const top=y0+k*(q+gap);x.fillStyle=P.INK3;x.fillRect(cx-q/2,top,q,q);x.fillStyle=C;x.fillRect(cx-q/2,top+q-BW,q,BW);
      fit(x,imgs[k],cx,top+(q-BW)/2,q-14);});};
  await col(m.a,colLC,CA);await col(m.b,colRC,CB);
  // barra superior
  x.fillStyle=P.INK2;x.fillRect(0,0,W,G.y);shade(0,0,W,G.y,true);
  const sw=BW/Math.cos(Math.atan(46/G.y)); // ancho horizontal para que la franja inclinada mida BW de grosor
  poly([[712-sw,0],[712,0],[666,G.y],[666-sw,G.y]],CA);poly([[W-712,0],[W-712+sw,0],[W-666+sw,G.y],[W-666,G.y]],CB);
  const f1=`900 42px ${FD}`,f2=`900 30px ${FD}`,f3=`600 17px ${FL}`,a1=cap(f1),a2=cap(f2),a3=cap(f3),lg1=9,lg2=9,blk=a1+lg1+a2+lg2+a3,b1=topC-blk/2+a1,b2=b1+lg1+a2,b3=b2+lg2+a3;
  // logo del mismo ancho y centro que las casillas del roster; texto alineado con el inicio del borde del juego
  const qLogo=Math.min(colW-2*M,Math.floor((G.h-7*8)/8));
  const side=(t,lo,C,left)=>{const ti=TEAMS.indexOf(t),ls=qLogo;fit(x,lo,left?colLC:colRC,topC,ls);const tx=left?G.x-BW:G.x+G.w+BW,al=left?"left":"right";
    // dibuja el texto con su borde real (sin el espacio lateral de la letra) justo en tx
    const edge=(str,font,col,y)=>{x.font=font;x.textAlign=al;const mt=x.measureText(str);txt(x,str,font,col,al,left?tx+mt.actualBoundingBoxLeft:tx-mt.actualBoundingBoxRight,y);return mt;};
    x.font=f1;edge(ell(x,t.n.toUpperCase(),520),f1,P.CH,b1);
    const tn=PROFILES[ti][0].toUpperCase();x.font=f2;const tw=x.measureText(tn).width;
    edge(tn,f2,C,b2);txt(x,"TRAINER",`700 15px ${FL}`,P.MU,al,left?tx+tw+10:tx-tw-10,b2);
    edge(`${CONF[t.c].name.toUpperCase()} #${t.rank} · ${t.w}-${t.l} · ${sign(t.d)} KOS`,f3,P.MU,b3);};
  side(A,la,CA,true);side(B,lb,CB,false);
  // marcador: cuadros + linea "semana" como un solo bloque centrado en la barra; VS centrado con los cuadros
  const cx=W/2,bs=64,so=196,fv=`900 44px ${FD}`,fs=`700 17px ${FL}`,as=cap(fs),sg=12,grp=bs+sg+as,by=topC-grp/2;
  poly([[712,0],[W-712,0],[W-666,G.y],[666,G.y]],P.INK);
  x.fillStyle=P.INK3;x.fillRect(cx-so,by,bs,bs);x.fillRect(cx+so-bs,by,bs,bs);
  x.fillStyle=CA;x.fillRect(cx-so,by+bs-BW,bs,BW);x.fillStyle=CB;x.fillRect(cx+so-bs,by+bs-BW,bs,BW);
  txt(x,"VS",fv,P.VO,"center",cx,by+bs/2+cap(fv)/2);txt(x,`SEMANA ${m.w} · AL MEJOR DE 3`,fs,P.MU,"center",cx,by+bs+sg+as);
  // barra inferior: todo centrado en la misma linea
  x.fillStyle=P.INK2;x.fillRect(0,G.y+G.h,W,H-G.y-G.h);shade(0,G.y+G.h,W,H-G.y-G.h,false);
  const ft=`700 20px ${FL}`,at=cap(ft);
  txt(x,"TEMPORADA 5 · EVOLUTION",ft,P.VO,"left",M,footC+at/2);
  txt(x,SHARE_URL.toUpperCase(),ft,P.VO,"right",W-M,footC+at/2);
  {const nf=`900 28px ${FD}`,an=cap(nf),lh=34,lw=lg?lg.width*lh/lg.height:0,gp=lg?12:0;x.font=nf;const nw=x.measureText("PPV DRAFT LEAGUE").width,sx=(W-(lw+gp+nw))/2;
    if(lg)x.drawImage(lg,sx,footC-lh/2,lw,lh);txt(x,"PPV DRAFT LEAGUE",nf,P.CH,"left",sx+lw+gp,footC+an/2);}
  // ventana del juego: transparente con borde del color de cada conferencia
  x.clearRect(G.x,G.y,G.w,G.h);x.lineWidth=BW;
  x.strokeStyle=CA;x.beginPath();x.moveTo(G.x+G.w/2,G.y-2);x.lineTo(G.x-2,G.y-2);x.lineTo(G.x-2,G.y+G.h+2);x.lineTo(G.x+G.w/2,G.y+G.h+2);x.stroke();
  x.strokeStyle=CB;x.beginPath();x.moveTo(G.x+G.w/2,G.y-2);x.lineTo(G.x+G.w+2,G.y-2);x.lineTo(G.x+G.w+2,G.y+G.h+2);x.lineTo(G.x+G.w/2,G.y+G.h+2);x.stroke();
  return cv;
}
async function drawIntro(mi){
  const m=MATCHES[mi],A=TEAMS[m.a],B=TEAMS[m.b],{cv,x,W,H,P}=await obsBase(),CA=confHex(A.c),CB=confHex(B.c);
  const [la,lb,lg]=await Promise.all([teamImg(A),teamImg(B),shareLogo()]);
  x.fillStyle=P.INK;x.fillRect(0,0,W,H);
  const band=(pts,c)=>{x.beginPath();pts.forEach(([px,py],k)=>k?x.lineTo(px,py):x.moveTo(px,py));x.closePath();x.fillStyle=c;x.fill();};
  x.fillStyle=P.INK2;x.fillRect(0,0,W,H);
  x.save();x.beginPath();x.rect(0,200,W,720);x.clip();band([[W*.56-26,0],[W*.56-12,0],[W*.44-12,H],[W*.44-26,H]],CA);band([[W*.56+12,0],[W*.56+26,0],[W*.44+26,H],[W*.44+12,H]],CB);x.restore();
  band([[0,0],[180,0],[0,180]],CA+"cc");band([[W,H],[W-180,H],[W,H-180]],CB+"cc");
  x.save();x.globalAlpha=.05;x.strokeStyle=P.CH;x.lineWidth=2;for(let i=-H;i<W;i+=60){x.beginPath();x.moveTo(i,H);x.lineTo(i+H*.27,0);x.stroke();}x.restore();
  if(lg){const h=70,w=lg.width*h/lg.height;x.drawImage(lg,(W-w)/2,48,w,h);}
  txt(x,`PPV DRAFT LEAGUE · SEMANA ${m.w} · AL MEJOR DE 3`,`700 30px ${FL}`,P.VO,"center",W/2,160);
  const card=async(t,lo,C,cx)=>{const ti=TEAMS.indexOf(t);fit(x,lo,cx,330,250);const nf=`900 70px ${FD}`;x.font=nf;txt(x,ell(x,t.n.toUpperCase(),780),nf,P.CH,"center",cx,530);
    txt(x,`TRAINER ${PROFILES[ti][0].toUpperCase()}`,`800 32px ${FD}`,C,"center",cx,574);
    txt(x,`${CONF[t.c].name.toUpperCase()} #${t.rank} · ${t.w}-${t.l} · ${sign(t.d)} KOS`,`700 24px ${FL}`,P.MU,"center",cx,610);
    // roster: 4 columnas x 2 filas, ordenado por costo de draft
    const ro=ROSTER(ti).slice().sort((a,b)=>b[1]-a[1]),imgs=await Promise.all(ro.map(r=>homeImg(r[0]))),cw=150,chh=150,gx=12,cols=4,y0=640;
    ro.forEach((r,k)=>{const rows=Math.ceil(ro.length/cols),row=Math.floor(k/cols),inRow=row<rows-1?cols:ro.length-cols*(rows-1),rw=inRow*cw+(inRow-1)*gx;
      const bx=cx-rw/2+(k%cols)*(cw+gx),by=y0+row*(chh+gx);x.fillStyle=P.INK3;x.fillRect(bx,by,cw,chh);
      fit(x,imgs[k],bx+cw/2,by+54,96);const nk=getNick(ti,r[0]),lf=`700 22px ${FL}`;x.font=lf;txt(x,ell(x,(nk||r[0]).toUpperCase(),cw-16),lf,P.CH,"center",bx+cw/2,by+chh-32);
      txt(x,nk?r[0].toUpperCase():`${r[1]} PTS`,`600 16px ${FL}`,P.MU,"center",bx+cw/2,by+chh-12);});};
  await card(A,la,CA,W*.25);await card(B,lb,CB,W*.75);
  txt(x,"VS",`900 200px ${FD}`,P.VO,"center",W/2,420);
  txt(x,"LA SERIE EMPIEZA EN BREVE",`900 40px ${FD}`,P.CH,"center",W/2,1004);txt(x,SHARE_URL,`600 22px ${FB}`,P.MU,"center",W/2,1040);
  x.fillStyle=CA;x.fillRect(0,H-14,W/2,14);x.fillStyle=CB;x.fillRect(W/2,H-14,W/2,14);
  return cv;
}

/* botones */
const SHARE_KINDS={
  profile:a=>{const t=TEAMS[a];return {kind:"Perfil",title:t.n,file:slug(t),accent:CONF[t.c].v,text:`${t.n} en la PPV Draft League`,draw:f=>makeShareImage(a,f)};},
  series:a=>{const m=MATCHES[a],A=TEAMS[m.a],B=TEAMS[m.b];return {kind:"Resultado",title:`${A.ab} ${m.ga}-${m.gb} ${B.ab}`,file:`serie-s${m.w}-${A.ab}-${B.ab}`.toLowerCase(),accent:CONF[m.c].v,text:`${A.n} ${m.ga}-${m.gb} ${B.n} · Semana ${m.w}`,draw:f=>drawSeries(a,f)};},
  champ:()=>{const c=winnerOf(resolvePlayoffs().final);return {kind:"Campeon",title:c!=null?TEAMS[c].n:"Campeon",file:"campeon",accent:"var(--volt)",text:c!=null?`${TEAMS[c].n}, campeon de la PPV Draft League`:"Campeon de la PPV Draft League",draw:drawChampion};},
  table:()=>{const v=sView;if(v==="power")return SHARE_KINDS.power(pWeek);return {kind:"Tabla",title:v==="all"?"Tabla general":"Tabla por conferencia",file:v==="all"?"tabla-general":"tabla-conferencias",accent:"var(--volt)",text:"Tabla de posiciones de la PPV Draft League",draw:f=>drawTable(f,v)};},
  leaders:()=>({kind:"Leaderboard",title:"Lideres en KOs",file:"leaderboard",accent:"var(--volt)",text:"Los lideres en KOs de la PPV Draft League",draw:drawLeaders}),
  bracket:()=>({kind:"Bracket",title:"Playoffs",file:"bracket",accent:"var(--volt)",text:"Bracket de playoffs de la PPV Draft League",draw:drawBracket}),
  roster:a=>{const t=TEAMS[a];return {kind:"Roster",title:`Roster de ${t.n}`,file:`roster-${slug(t)}`,accent:CONF[t.c].v,text:`El roster de ${t.n}`,draw:f=>drawRoster(a,f)};},
  week:a=>({kind:"Semana",title:`Semana ${a}`,file:`semana-${a}`,accent:"var(--volt)",text:`Resultados de la semana ${a} en la PPV Draft League`,draw:f=>drawWeek(a,f)}),
  power:a=>{const w=a||pWeek;return {kind:"Power ranking",title:`Power ranking · Semana ${w}`,file:`power-ranking-s${w}`,accent:"var(--volt)",text:`Power ranking de la semana ${w} en la PPV Draft League`,draw:f=>drawPower(w,f)};},
  potw:a=>{const w=a||WEEKS,p=potwOf(w);return {kind:"Pokemon de la semana",title:p?p.n:`Semana ${w}`,file:`pokemon-semana-${w}`,accent:p?CONF[TEAMS[p.ti].c].v:"var(--volt)",text:p?`${p.n} de ${TEAMS[p.ti].n}, Pokemon de la semana ${w} en la PPV Draft League`:"Pokemon de la semana",draw:f=>drawPotw(w,f)};},
  h2h:()=>{const [a,b]=h2;return {kind:"Cara a cara",title:`${TEAMS[a].ab} vs ${TEAMS[b].ab}`,file:`h2h-${TEAMS[a].ab}-${TEAMS[b].ab}`.toLowerCase(),accent:CONF[TEAMS[a].c].v,text:`${TEAMS[a].n} vs ${TEAMS[b].n} en la PPV Draft League`,draw:f=>drawH2H(a,b,f)};},
  picks:a=>{const w=a||prWeek,wk=MATCHES.filter(m=>m.w===w),st=prState(w),h=wk.filter(m=>st.p[m.i]===winSide(m)).length;return {kind:"Pronosticos",title:`Mis pronosticos · Semana ${w}`,file:`pronosticos-s${w}`,accent:"var(--volt)",text:st.rev?`Atine ${h} de ${wk.length} en la semana ${w} de la PPV Draft League`:`Mis pronosticos de la semana ${w} en la PPV Draft League`,draw:f=>drawPicks(w,f)};},
  pickTable:()=>{const {rows}=pickRows(),me=rows.find(r=>r.ti===ME);return {kind:"Pronosticos",title:"Tabla de aciertos",file:"pronosticos-tabla",accent:"var(--volt)",text:me?`Voy #${me.pos} en los pronosticos de la PPV Draft League`:"Tabla de aciertos de los pronosticos de la PPV Draft League",draw:drawPickTable};},
  confs:()=>{const v=filter,one=v!=="all";return {kind:"Conferencias",title:one?`Conferencia ${CONF[v].name}`:"Las conferencias",file:one?`conferencia-${CONF[v].name.toLowerCase().replace(/\s+/g,"-")}`:"conferencias",accent:one?CONF[v].v:"var(--volt)",text:one?`Los equipos de la conferencia ${CONF[v].name} en la PPV Draft League`:"Los equipos de cada conferencia de la PPV Draft League",draw:fm=>drawConfs(fm,v)};},
  schedule:a=>({kind:"Calendario",title:`Calendario · Semana ${a}`,file:`calendario-${a}`,accent:"var(--volt)",text:`Los cruces de la semana ${a} en la PPV Draft League`,draw:f=>drawWeek(a,f,true)}),
  market:()=>({kind:"Mercado",title:"Trades y fichajes",file:"mercado",accent:"var(--volt)",text:"Los trades y fichajes de la PPV Draft League",draw:drawMarket}),
  draft:()=>{const t=TEAMS[ME];return {kind:"Mi draft",title:`Draft de ${t.n}`,file:`draft-${slug(t)}`,accent:CONF[t.c].v,text:`Asi quedo el draft de ${t.n}`,draw:drawMyDraft};}
};
document.addEventListener("click",e=>{const b=e.target.closest("[data-sharek],[data-share]");if(!b)return;e.stopPropagation();
  if(b.dataset.share!=null)return openShareWith(SHARE_KINDS.profile(+b.dataset.share));
  const k=b.dataset.sharek;if(SHARE_KINDS[k])openShareWith(SHARE_KINDS[k](b.dataset.arg!=null?+b.dataset.arg:undefined));});


/* ---------- cuenta regresiva al proximo evento ---------- */
function renderCountdown(){const el=document.getElementById("countdown");if(!el)return;if(!NEXT_EVENT.at){el.innerHTML=`<div class="cd-t"><span class="label">${esc(SEASON_LABEL)}</span><b>${esc(NEXT_EVENT.label)}</b></div>`;return;}const ms=new Date(NEXT_EVENT.at)-Date.now();
  if(ms<=0){el.innerHTML=`<div class="cd-t"><span class="label">Ahora</span><b>${esc(NEXT_EVENT.label)}</b></div><span class="cd-live">● En curso</span>`;return;}
  const p=n=>String(n).padStart(2,"0"),d=Math.floor(ms/864e5),h=Math.floor(ms/36e5)%24,m=Math.floor(ms/6e4)%60,s=Math.floor(ms/1e3)%60;
  el.innerHTML=`<div class="cd-t"><span class="label">Proximo evento</span><b>${esc(NEXT_EVENT.label)}</b><small>${fmtEvent()}</small></div><div class="cd-n">${[[d,"dias"],[h,"hrs"],[m,"min"],[s,"seg"]].map(([v,l])=>`<span><b class="num">${p(v)}</b><small>${l}</small></span>`).join("")}</div>`;}
renderCountdown();setInterval(renderCountdown,1000);

/* ---------- power ranking semanal (calculado con las series hasta esa semana) ---------- */
let pWeek=WEEKS;
const _pw={};
function powerAt(w){if(_pw[w])return _pw[w];
  const rows=TEAMS.map((t,i)=>{const ms=seriesFor(i).filter(m=>m.w<=w);const res=ms.map(m=>m.ga>m.gb?"W":"L");
    const wins=res.filter(x=>x==="W").length,gd=ms.reduce((s,m)=>s+m.ga-m.gb,0),last=res.slice(-3),form=last.filter(x=>x==="W").length;
    const sos=ms.length?ms.reduce((s,m)=>{const o=seriesFor(m.b).filter(x=>x.w<=w);return s+(o.length?o.filter(x=>x.ga>x.gb).length/o.length:0);},0)/ms.length:0;
    let st=0;for(let k=res.length-1;k>=0&&res[k]===res[res.length-1];k--)st++;
    return {i,t,wins,losses:res.length-wins,gd,form,sos,last,streak:res.length?[res[res.length-1],st]:null,score:wins*3+gd*.6+form*1.5+sos*4};});
  rows.sort((a,b)=>b.score-a.score||b.gd-a.gd||a.t.n.localeCompare(b.t.n));rows.forEach((r,k)=>r.pos=k+1);
  return _pw[w]=rows;}
function powerBlurb(r,w){const t=r.t,[sr,sn]=r.streak||["",0];
  if(w===WEEKS&&t.rank===1)return `Cerro la fase regular como #1 de ${CONF[t.c].name}.`;
  if(sr==="W"&&sn>=3)return `${sn} victorias seguidas.`;
  if(sr==="L"&&sn>=3)return `${sn} derrotas seguidas.`;
  if(r.move>=3)return `Sube ${r.move} lugares esta semana.`;
  if(r.move<=-3)return `Cae ${-r.move} lugares esta semana.`;
  if(r.form===3)return "Invicto en las ultimas 3 semanas.";
  if(r.form===0&&r.last.length===3)return "Sin ganar en las ultimas 3 semanas.";
  if(r.gd>=6)return `Diferencia de juegos de ${sign(r.gd)}.`;
  if(r.sos>=.6)return "Ha enfrentado a los rivales mas fuertes.";
  return `${r.wins}-${r.losses} en series y ${sign(r.gd)} en juegos.`;}
function powerTable(w){const rows=powerAt(w),prev=w>1?powerAt(w-1):null;
  return rows.map(r=>{const o={...r};o.move=prev?prev.find(x=>x.i===r.i).pos-r.pos:0;o.blurb=powerBlurb(o,w);return o;});}
function pwRow(r){const t=r.t,mv=r.move;
  return `<li class="pw ${r.i===ME?"mine":""}" style="--c:${CONF[t.c].v}"><span class="pw-pos num">${r.pos}</span><span class="pw-mv ${mv>0?"up":mv<0?"dn":""}" aria-label="${mv>0?"Sube "+mv:mv<0?"Baja "+(-mv):"Sin cambio"}">${mv>0?"▲ "+mv:mv<0?"▼ "+(-mv):"—"}</span>${crest(t)}<div class="pw-t"><a class="nm" href="#team-${slug(t)}"><span class="full">${esc(t.n)}</span><span class="short">#${t.ab}</span></a><p>${esc(r.blurb)}</p></div><span class="pw-form" aria-label="Ultimas series: ${r.last.join(" ")}">${r.last.map(x=>`<i class="${x==="W"?"w":"l"}">${x}</i>`).join("")}</span><span class="pw-rec num">${r.wins}-${r.losses}</span><b class="pw-sc num" data-tip="power" tabindex="0">${r.score.toFixed(1)}</b></li>`;}
function powerHTML(w){
  return `<div class="pw-bar"><span class="label">Semana</span><div class="seg pw-weeks" role="group" aria-label="Semana del power ranking">${Array.from({length:WEEKS},(_,i)=>`<button type="button" data-pw="${i+1}" aria-pressed="${i+1===w}">${i+1}</button>`).join("")}</div><span class="label pw-how" data-tip="power" tabindex="0">Como se calcula</span></div>
  <div class="table" style="--c:var(--volt)"><div class="th"><h3>Power ranking</h3><span class="label">Semana ${w} de ${WEEKS} · ▲▼ cambio contra la semana anterior</span></div><ol class="pw-list">${powerTable(w).map(pwRow).join("")}</ol></div>`;}
function setSView(v){sView=v;sKey="rank";sDir=1;document.querySelectorAll("#sview button").forEach(x=>x.setAttribute("aria-pressed",x.dataset.v===v));renderStandings();}
document.getElementById("stables").addEventListener("click",e=>{const b=e.target.closest("[data-pw]");if(!b)return;pWeek=+b.dataset.pw;renderStandings();const nb=document.querySelector(`#stables [data-pw="${pWeek}"]`);if(nb)nb.focus();});
document.addEventListener("click",e=>{const a=e.target.closest("[data-goview]");if(a)setSView(a.dataset.goview);});
/* al cambiar de vista, si la tabla ya quedo arriba de la pantalla, regresar al inicio de la tabla */
document.querySelectorAll("#sview button").forEach(b=>b.addEventListener("click",()=>{const tb=document.querySelector("#page-standings .toolbar").getBoundingClientRect().bottom,t=document.getElementById("stables").getBoundingClientRect().top;if(t<tb+16)scrollTo({top:scrollY+t-tb-16,behavior:NO_MOTION?"auto":"smooth"});}));
document.addEventListener("click",e=>{const a=e.target.closest("[data-goto]");if(!a)return;const id=a.dataset.goto;setTimeout(()=>{const el=document.getElementById(id);if(el)el.scrollIntoView({behavior:"smooth",block:"start"});},120);});

/* ---------- Pokemon de la semana: el que estuvo en mas juegos ganados (desempata el total de KOs) ---------- */
const _potw={};
function potwOf(w){if(w in _potw)return _potw[w];const apps={},wins={};
  MATCHES.forEach((m,i)=>{if(m.w!==w)return;(GAMES[i]||[]).forEach((gm,gi)=>{const win=m.seq[gi];[0,1].forEach(s=>{const ti=s?m.b:m.a;(gm[s]||[]).forEach(n=>{const k=n+"|"+ti;apps[k]=(apps[k]||0)+1;if((win==="a")===(s===0))wins[k]=(wins[k]||0)+1;});});});});
  const list=Object.keys(apps).map(k=>{const [n,ti]=k.split("|"),r=PROFILES[+ti][5].find(x=>x[0]===n);return {n,ti:+ti,w:wins[k]||0,g:apps[k],k:r?r[6]:0};});
  list.sort((a,b)=>b.w-a.w||(b.w/b.g)-(a.w/a.g)||b.k-a.k||a.n.localeCompare(b.n));
  return _potw[w]=list[0]||null;}
function potwCard(w){const p=potwOf(w);if(!p)return "";const t=TEAMS[p.ti],nk=getNick(p.ti,p.n);
  return `<article class="potw" style="--c:${CONF[t.c].v}"><div class="potw-h"><span class="label">Pokemon de la semana · Semana ${w}</span><button type="button" class="btn ghost sh-sm" data-sharek="potw" data-arg="${w}" aria-label="Compartir Pokemon de la semana">⤴</button></div>
    <div class="potw-b">${spr(p.n,"potw-spr")}<div><h3>${esc(nk||p.n)}</h3>${nk?`<span class="species">${esc(p.n)}</span>`:""}<a class="potw-t" href="#team-${slug(t)}">${crest(t)}<span>${esc(t.n)}</span></a></div></div>
    <div class="potw-s"><div><b class="num">${p.w}</b><span>Victorias</span></div><div><b class="num">${p.g}</b><span>Juegos</span></div><div><b class="num">${p.k}</b><span data-tip="kills" tabindex="0">KOs temporada</span></div></div>
    <p class="potw-note">Gana el Pokemon que estuvo en mas victorias de la semana. Desempata su total de KOs.</p></article>`;}
function potwMini(w){try{const p=potwOf(w);if(!p)return "";const t=TEAMS[p.ti],nk=getNick(p.ti,p.n);
  return `<div class="potw-mini" style="--c:${CONF[t.c].v}"><span class="label">Pokemon de la semana</span>${box(p.n,"spr-s")}<b>${esc(nk||p.n)}</b><span>de <a class="nm" href="#team-${slug(t)}">#${t.ab}</a> · ${p.w} victorias en ${p.g} juegos</span><button type="button" class="btn ghost sh-sm" data-sharek="potw" data-arg="${w}">⤴ Compartir</button></div>`;}catch(e){return "";}}

/* ---------- cobertura ofensiva del roster (por tipos propios) ---------- */
function coverage(roster){return TYPE_ORDER.map(d=>{const hit=roster.filter(r=>r[2].split("/").some(a=>(CHART[a][d]??1)>=2));
  const best=Math.max(...roster.map(r=>Math.max(...r[2].split("/").map(a=>CHART[a][d]??1))));return {d,hit,best};});}
function coverageHTML(roster){const cv=coverage(roster),good=cv.filter(c=>c.hit.length).length,holes=cv.filter(c=>!c.hit.length);
  return `<div class="cov-h"><h3>Cobertura <em>ofensiva</em></h3><span class="label" data-tip="cover" tabindex="0">Golpea con ventaja a ${good} de 18 tipos</span></div>
  <div class="cov">${cv.map(c=>`<div class="cv ${c.hit.length>=3?"g3":c.hit.length?"g1":c.best<1?"wall":"hole"}" style="--tc:${TYPE[c.d][1]}" title="${TYPE[c.d][0]}: ${c.hit.length?esc(c.hit.map(r=>r[0]).join(", ")):"nadie le pega con ventaja"}"><span class="cv-t">${TYPE[c.d][0]}</span><b class="num">${c.hit.length}</b><span class="cv-m">${c.hit.slice(0,3).map(r=>box(r[0],"")).join("")}</span></div>`).join("")}</div>
  <p class="cov-note">${holes.length?`Huecos: <strong>${holes.map(c=>TYPE[c.d][0]).join(", ")}</strong>.${holes.some(c=>c.best<1)?" En gris, tipos que resisten a todo el roster.":""}`:"Sin huecos: el roster golpea con ventaja a todos los tipos."} El numero indica cuantos Pokemon del roster le pegan con ventaja. Calculado con los tipos de cada Pokemon, sin contar movimientos.</p>`;}

/* ---------- trades y fichajes (deducidos del tablero del draft contra los rosters actuales) ---------- */
let _tx=null;
function TX(){if(_tx)return _tx;
  const drafted={};DRAFT_ORDER.forEach((ti,ci)=>{drafted[ti]=DRAFT_ROUNDS.map(r=>r[ci]).filter(Boolean);});
  const draftedBy={};Object.entries(drafted).forEach(([ti,l])=>l.forEach(n=>{draftedBy[n]=+ti;}));
  const pairs={},fa={},F=ti=>fa[ti]=fa[ti]||{inn:[],out:[]};
  TEAMS.forEach((t,ti)=>{const ro=ROSTER(ti).map(r=>r[0]),d=drafted[ti]||[];
    d.filter(n=>!ro.includes(n)).forEach(n=>{const to=OWNER[n];if(to==null)F(ti).out.push(n);else{const k=[ti,to].sort((a,b)=>a-b).join("-");(pairs[k]=pairs[k]||[]).push({n,from:ti});}});
    ro.filter(n=>!d.includes(n)&&draftedBy[n]==null).forEach(n=>F(ti).inn.push(n));});
  const trades=Object.entries(pairs).map(([k,l])=>{const [a,b]=k.split("-").map(Number);return {a,b,ab:l.filter(x=>x.from===a).map(x=>x.n),ba:l.filter(x=>x.from===b).map(x=>x.n)};}).sort((x,y)=>(y.ab.length+y.ba.length)-(x.ab.length+x.ba.length)||TEAMS[x.a].n.localeCompare(TEAMS[y.a].n));
  const fas=Object.entries(fa).map(([ti,v])=>({ti:+ti,...v})).sort((x,y)=>(y.inn.length+y.out.length)-(x.inn.length+x.out.length));
  return _tx={trades,fas};}
const txMon=(n,cls)=>`<div class="tx-mon ${cls}"><i>${cls==="in"?"+":"−"}</i>${box(n,"")}<span>${esc(n)}</span></div>`;
const txHead=t=>`<header>${crest(t)}<a href="#team-${slug(t)}">${esc(t.n)}</a></header>`;
function txTrade(x){const A=TEAMS[x.a],B=TEAMS[x.b];
  const side=(t,gets)=>`<div class="tx-side" style="--c:${CONF[t.c].v}">${txHead(t)}<small>Recibe</small>${gets.length?gets.map(n=>txMon(n,"in")).join(""):'<p class="tx-empty">Sin contraparte directa</p>'}</div>`;
  return `<article class="tx"><div class="tx-top"><span class="tx-kind">Trade</span><span class="tx-date">Fecha por registrar</span></div><div class="tx-sides">${side(A,x.ba)}<span class="tx-arrow" aria-hidden="true">⇄</span>${side(B,x.ab)}</div></article>`;}
function txFa(x){const t=TEAMS[x.ti];
  return `<article class="tx"><div class="tx-top"><span class="tx-kind k-fa">Free agency</span><span class="tx-date">Fecha por registrar</span></div><div class="tx-side" style="--c:${CONF[t.c].v}">${txHead(t)}${x.inn.length?`<small>Ficha</small>${x.inn.map(n=>txMon(n,"in")).join("")}`:""}${x.out.length?`<small>Libera</small>${x.out.map(n=>txMon(n,"out")).join("")}`:""}</div></article>`;}
function txTeamHTML(ti){const {trades,fas}=TX(),tr=trades.filter(x=>x.a===ti||x.b===ti),fa=fas.filter(x=>x.ti===ti);if(!tr.length&&!fa.length)return "";
  return `<section><div class="sec-head"><div><div class="label">${tr.length} ${tr.length===1?"trade":"trades"}${fa.length?" · free agency":""} desde el draft</div><h2>Trades y <em>fichajes</em></h2></div><a class="link" href="#draft" data-goto="txSec">Ver todo el mercado</a></div><div class="tx-g">${tr.map(txTrade).join("")}${fa.map(txFa).join("")}</div></section>`;}
let txF="all";
function renderTx(){const {trades,fas}=TX();
  document.getElementById("txFeed").innerHTML=[...(txF!=="fa"?trades.map(txTrade):[]),...(txF!=="trade"?fas.map(txFa):[])].join("");
  document.getElementById("txCount").textContent=`${trades.length} trades · ${fas.length} equipos en free agency`;}
document.querySelectorAll("#txSeg button").forEach(b=>b.addEventListener("click",()=>{txF=b.dataset.tx;document.querySelectorAll("#txSeg button").forEach(x=>x.setAttribute("aria-pressed",x===b));renderTx();}));
safe(()=>renderTx(),"renderTx");

/* ---------- cara a cara ---------- */
let h2=[ME>=0?ME:0,ME===1||ME<0?(TEAMS.length>1?1:0):1];
function advantage(A,B){let se=0;const per=A.map(r=>{const ts=r[2].split("/"),tg=B.filter(o=>ts.some(a=>mult(a,o[2].split("/"))>=2));se+=tg.length;return {r,tg};});
  return {pct:A.length&&B.length?se/(A.length*B.length):0,per:per.sort((x,y)=>y.tg.length-x.tg.length||y.r[1]-x.r[1])};}
function h2hData(a,b){const A=TEAMS[a],B=TEAMS[b];
  const st=ti=>{let gw=0,gl=0;seriesFor(ti).forEach(m=>{gw+=m.ga;gl+=m.gb;});return {gw,gl,kills:ROSTER(ti).reduce((s,r)=>s+r[6],0)};};
  const sa=st(a),sb=st(b),adA=advantage(ROSTER(a),ROSTER(b)),adB=advantage(ROSTER(b),ROSTER(a));
  const R=(lab,va,vb,fa,fb,tip,lower)=>({lab,va,vb,fa,fb,tip,lower,win:va===vb?"":((va>vb)!==!!lower)?"a":"b"});
  const rows=[R("Record en series",A.w,B.w,`${A.w}-${A.l}`,`${B.w}-${B.l}`,"wl"),R("Juegos ganados",sa.gw,sb.gw,`${sa.gw}-${sa.gl}`,`${sb.gw}-${sb.gl}`,"gw"),
    R("Balance de KOs",A.d,B.d,sign(A.d),sign(B.d),"diff"),R("Puntos de liga",A.pts,B.pts,String(A.pts),String(B.pts),"pts"),
    R("KOs del roster",sa.kills,sb.kills,String(sa.kills),String(sb.kills),"kills"),R("Posicion general",A.gr,B.gr,"#"+A.gr,"#"+B.gr,"",true),
    R("Ventaja de tipos",adA.pct,adB.pct,Math.round(adA.pct*100)+"%",Math.round(adB.pct*100)+"%","adv")];
  const vs=m=>(m.a===a&&m.b===b)||(m.a===b&&m.b===a),hist=[];
  MATCHES.forEach(m=>{if(vs(m))hist.push({kind:"reg",m,w:m.ga>m.gb?m.a:m.b});});
  const PO=resolvePlayoffs();[...["A","B"].flatMap(k=>["wc","qf","sf"].map(r=>[r,PO[k][r]])),["final",PO.final]].forEach(([r,m])=>{if(m.a!=null&&m.b!=null&&vs(m))hist.push({kind:"po",r,m,w:winnerOf(m)});});
  const wa=hist.filter(h=>h.w===a).length,wb=hist.filter(h=>h.w===b).length;
  return {rows,hist,wa,wb,adA,adB,histTxt:hist.length?`Historial directo: #${A.ab} ${wa}-${wb} #${B.ab}`:"No se enfrentaron esta temporada"};}
function renderH2H(){const [a,b]=h2,A=TEAMS[a],B=TEAMS[b],H=h2hData(a,b),CA=CONF[A.c].v,CB=CONF[B.c].v;
  document.getElementById("h2A").value=a;document.getElementById("h2B").value=b;
  const side=(t,ti,cls,C)=>`<div class="h2-side ${cls}" style="--c:${C}">${crest(t)}<div><span class="label" style="color:${C}">${CONF[t.c].name} · #${t.rank}${t.q?" · Playoffs":""}</span><h2><a href="#team-${slug(t)}">${esc(t.n)}</a></h2><p>Trainer ${esc(PROFILES[ti][0])} · #${t.ab}</p></div></div>`;
  const bar=(r,s)=>{let va=r.va,vb=r.vb;if(r.lower){va=1/va;vb=1/vb;}const lo=Math.min(va,vb,0);va-=lo;vb-=lo;const tot=va+vb;const w=tot?(s==="a"?va:vb)/tot*100:50;
    return `<span class="h2-bar ${s}" style="--c:${s==="a"?CA:CB}" aria-hidden="true"><i class="${r.win&&r.win!==s?"lo":""}" style="width:${w.toFixed(1)}%"></i></span>`;};
  const rows=H.rows.map(r=>`<div class="h2-r"><span class="v a ${r.win==="a"?"win":""} num">${r.fa}</span>${bar(r,"a")}<span class="lab"${r.tip?` data-tip="${r.tip}" tabindex="0"`:""}>${r.lab}</span>${bar(r,"b")}<span class="v b ${r.win==="b"?"win":""} num">${r.fb}</span></div>`).join("");
  const hist=H.hist.length?H.hist.map(h=>h.kind==="reg"?mcard(h.m,a):h.w==null?`<div class="h2-po" style="--c:var(--volt)"><span class="label">Playoffs · ${RNAME[h.r]}</span><span>Por jugar</span></div>`
    :`<div class="h2-po" style="--c:${CONF[TEAMS[h.w].c].v}"><span class="label">Playoffs · ${RNAME[h.r]}</span>${crest(TEAMS[h.w])}<span>Gana <a class="nm" href="#team-${slug(TEAMS[h.w])}"><b>${esc(TEAMS[h.w].n)}</b></a></span></div>`).join("")
    :`<div class="empty">No se enfrentaron esta temporada, ni en fase regular ni en playoffs.</div>`;
  const adv=(t,ad,C,o)=>`<div class="adv" style="--c:${C}"><div class="adv-top"><span class="label">#${t.ab} golpea con ventaja</span><b class="num" data-tip="adv" tabindex="0">${Math.round(ad.pct*100)}%</b></div><p class="adv-sub">de los duelos uno a uno contra el roster de ${esc(o.n)}. Sus mejores cartas:</p>
    ${ad.per.slice(0,4).map(p=>`<div class="adv-row">${box(p.r[0],"")}<strong>${esc(p.r[0])}</strong><span class="tg" title="${esc(p.tg.map(x=>x[0]).join(", "))}">${p.tg.length?p.tg.map(x=>box(x[0],"")).join(""):'<em class="tx-empty">Sin ventaja directa</em>'}</span></div>`).join("")}</div>`;
  const dv=H.adA.pct-H.adB.pct,verdict=Math.abs(dv)<.04?"Por tipos el duelo esta parejo.":`Por tipos, <strong>${esc((dv>0?A:B).n)}</strong> llega con ventaja.`;
  const ros=(ti,C)=>`<div style="--c:${C}"><h3 class="h2-rt">${esc(TEAMS[ti].n)}</h3><ul>${ROSTER(ti).slice().sort((x,y)=>y[1]-x[1]).map(r=>`<li>${box(r[0],"")}<span>${esc(getNick(ti,r[0])||r[0])}</span><small class="num">${r[1]}</small></li>`).join("")}</ul></div>`;
  document.getElementById("h2Body").innerHTML=`<div class="h2-head">${side(A,a,"a",CA)}<div class="h2-mid"><span class="label">Historial directo</span><b class="num">${H.wa}-${H.wb}</b></div>${side(B,b,"b",CB)}</div>
  <section><div class="sec-head"><div><div class="label">${esc(SEASON_LABEL)}</div><h2>Los <em>numeros</em></h2></div><button type="button" class="btn ghost sh-sm" data-sharek="h2h">⤴ Compartir cara a cara</button></div><div class="h2-rows">${rows}</div></section>
  <section><div class="sec-head"><div><div class="label">Fase regular y playoffs</div><h2>Historial <em>directo</em></h2></div></div><div class="h2-hist">${hist}</div></section>
  <section><div class="sec-head"><div><div class="label">Calculado solo por tipos, sin movimientos ni habilidades</div><h2>Ventaja de <em>tipos</em></h2></div></div><p class="h2-verdict">${verdict}</p><div class="h2-adv">${adv(A,H.adA,CA,B)}${adv(B,H.adB,CB,A)}</div></section>
  <section><div class="sec-head"><div><div class="label">Ordenados por costo de draft</div><h2>Los <em>rosters</em></h2></div></div><div class="h2-ros">${ros(a,CA)}${ros(b,CB)}</div></section>`;
}
(()=>{const opts=["rojo","azul"].map(c=>`<optgroup label="${CONF[c].name}">${TEAMS.map((t,i)=>[t,i]).filter(([t])=>t.c===c).sort((x,y)=>x[0].rank-y[0].rank).map(([t,i])=>`<option value="${i}">${esc(t.n)}</option>`).join("")}</optgroup>`).join("");
  const sA=document.getElementById("h2A"),sB=document.getElementById("h2B");sA.innerHTML=opts;sB.innerHTML=opts;
  const go=()=>{history.replaceState(null,"",`#h2h-${h2[0]}-${h2[1]}`);renderH2H();};
  sA.addEventListener("change",()=>{const v=+sA.value;h2=[v,v===h2[1]?h2[0]:h2[1]];go();});
  sB.addEventListener("change",()=>{const v=+sB.value;h2=[v===h2[0]?h2[1]:h2[0],v];go();});
  document.getElementById("h2Swap").addEventListener("click",()=>{h2=[h2[1],h2[0]];go();});})();

/* ---------- pronosticos (Supabase: cada trainer guarda los suyos; los de los demas se ven al terminar cada serie) ---------- */
const MYPICK={};(PPV.PREDS||[]).forEach(p=>{if(PPV.USER&&p.user_id===PPV.USER.id)MYPICK[p.match_id]=p.pick;});
const PICKS={};
const winSide=m=>m.ga>m.gb?"a":"b";
const prState=w=>{const s=PICKS[w]=PICKS[w]||{p:{},rev:true};MATCHES.filter(m=>m.w===w).forEach(m=>{if(MYPICK[m.id])s.p[m.i]=MYPICK[m.id];});return s;};
let prWeek=(PPV.PENDING.length?Math.min(...PPV.PENDING.map(p=>p.w)):WEEKS);
const canPick=()=>!!PPV.USER&&!PPV.IS_ARCHIVE&&(PPV.PERMS.includes("all")||PPV.PERMS.includes("predictions.play"));
function prOpen(p){const pk=MYPICK[p.id],dis=canPick()?"":"disabled";
  const opt=(s,ti)=>{const t=TEAMS[ti];return `<button type="button" class="pr-opt ${pk===s?"on":""}" data-pid="${p.id}" data-ps="${s}" aria-pressed="${pk===s}" style="--c:${CONF[t.c].v}" ${dis}>${crest(t)}<span class="full">${esc(t.n)}</span><span class="short">#${t.ab}</span></button>`;};
  return `<article class="pr">${opt("a",p.a)}<span class="pr-vs">VS</span>${opt("b",p.b)}</article>`;}
function prCard(m){const pk=MYPICK[m.id],ws=winSide(m);
  const opt=(s,t)=>`<button type="button" class="pr-opt ${pk===s?"on":""} ${ws===s?"won":"lost"}" disabled aria-pressed="${pk===s}" style="--c:${CONF[t.c].v}">${crest(t)}<span class="full">${esc(t.n)}</span><span class="short">#${t.ab}</span><b class="num">${s==="a"?m.ga:m.gb}</b></button>`;
  return `<article class="pr ${pk?(pk===ws?"hit":"miss"):""}">${opt("a",TEAMS[m.a])}<span class="pr-vs">${pk?(pk===ws?"✓":"✗"):"VS"}</span>${opt("b",TEAMS[m.b])}</article>`;}
function renderPicks(){
  document.querySelectorAll("#prWeeks button").forEach(b=>{const w=+b.dataset.w;b.setAttribute("aria-pressed",w===prWeek);b.querySelector("small").textContent=PPV.PENDING.some(p=>p.w===w)?"Abierta":"Semana";});
  const done=MATCHES.filter(m=>m.w===prWeek),open=PPV.PENDING.filter(p=>p.w===prWeek);
  const made=done.filter(m=>MYPICK[m.id]).length,hits=done.filter(m=>MYPICK[m.id]&&MYPICK[m.id]===winSide(m)).length;
  const intro=!PPV.USER?`Entra con tu cuenta para hacer tus pronosticos. <a href="#login">Entrar</a>`:PPV.IS_ARCHIVE?"Esta temporada ya termino: aqui ves como te fue.":canPick()?"Elige quien gana cada serie antes de que se juegue. Se cierra cuando se reporta el resultado. Los picks de los demas se ven al terminar cada serie.":"Tu rol no puede hacer pronosticos.";
  document.getElementById("prBody").innerHTML=`<p class="pr-intro">${intro}</p>
    ${done.length?`<div class="pr-bar"><span class="pr-score num">${hits}<small>/ ${made} aciertos</small></span><div class="pr-acts"><button type="button" class="btn ghost sh-sm" data-sharek="picks" data-arg="${prWeek}" ${made?"":"disabled"}>⤴ Compartir mis pronosticos</button></div></div>`:""}
    ${open.length?`<div class="label" style="margin:14px 0 8px">Por jugar · ${open.filter(p=>MYPICK[p.id]).length}/${open.length} elegidos</div><div class="pr-g">${open.map(prOpen).join("")}</div>`:""}
    ${done.length?`<div class="label" style="margin:18px 0 8px">Resultados</div><div class="pr-g">${done.map(prCard).join("")}</div>`:""}
    ${!open.length&&!done.length?`<div class="empty">No hay series en esta semana.</div>`:""}`;
  renderPickTable();}
function pickRows(){const ms=MATCHES;
  const rows=(PPV.PRED_TABLE||[]).map(r=>{let ti=TEAMS.findIndex(t=>t.id===r.team_id);const t=ti>=0?TEAMS[ti]:{n:r.label,c:"rojo",ph:true,h:[200,230],ab:"",w:0,l:0,d:0};if(ti<0)ti=-100-Math.random();return {t,ti,ok:r.hits,tot:r.total,uid:r.user_id};})
    .sort((a,b)=>b.ok-a.ok||(a.tot?a.ok/a.tot:0)-(b.tot?b.ok/b.tot:0)||a.t.n.localeCompare(b.t.n));
  rows.forEach((r,k)=>r.pos=k&&rows[k-1].ok===r.ok?rows[k-1].pos:k+1);
  return {revW:[],ms,rows,lab:`${rows.length} participantes · ${ms.length} series jugadas`};}
function renderPickTable(){const {ms,rows,lab:tabLab}=pickRows();
  const lab=document.getElementById("prTabLabel"),box_=document.getElementById("prTable");
  document.getElementById("prTabShare").hidden=!rows.length;
  if(!rows.length){lab.textContent="Aun sin aciertos";box_.innerHTML=`<div class="empty">Cuando termine la primera serie con pronosticos, aqui aparece la tabla de aciertos.</div>`;return;}
  lab.textContent=tabLab;const me=PPV.USER?PPV.USER.id:null;
  box_.innerHTML=`<div class="table" style="--c:var(--volt)"><div class="rows"><table class="st pr-st"><thead><tr><th class="l">#</th><th class="l">Trainer</th><th>Aciertos</th><th>%</th></tr></thead><tbody>${rows.map(r=>`<tr class="${r.pos<=3?"in":"out"}${r.uid===me?" mine":""}" style="--c:${CONF[r.t.c].v}"><td class="pos l">${r.pos}</td><td class="l"><span class="tm">${crest(r.t)}<span class="nm"><span class="full">${esc(r.t.n)}</span></span>${r.uid===me?'<span class="you">Tu</span>':""}</span></td><td>${r.ok}/${r.tot}</td><td>${r.tot?Math.round(r.ok/r.tot*100):0}%</td></tr>`).join("")}</tbody></table></div></div>`;}
document.getElementById("prWeeks").innerHTML=Array.from({length:WEEKS},(_,i)=>`<button type="button" data-w="${i+1}"><small>Semana</small>${i+1}</button>`).join("");
document.getElementById("prWeeks").addEventListener("click",e=>{const b=e.target.closest("button[data-w]");if(!b)return;prWeek=+b.dataset.w;renderPicks();});
document.getElementById("prBody").addEventListener("click",async e=>{const o=e.target.closest("[data-pid]");if(!o||!canPick())return;
  const id=o.dataset.pid,s=MYPICK[id]===o.dataset.ps?null:o.dataset.ps;
  try{await PPV.hooks.savePick(id,s);if(s)MYPICK[id]=s;else delete MYPICK[id];renderPicks();const nb=document.querySelector(`#prBody [data-pid="${id}"][data-ps="${o.dataset.ps}"]`);if(nb)nb.focus();}
  catch(err){toastMsg(err.message||"No se pudo guardar el pronostico.");}});
safe(()=>renderPicks(),"renderPicks");

/* ---------- buscador global ---------- */
const srch=document.getElementById("srch"),srchQ=document.getElementById("srchQ"),srchRes=document.getElementById("srchRes");
let srchList=[],srchAct=0,srchBack=null;
const norm=s=>s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
function searchIndex(){const out=[],ic=s=>`<span class="srch-ic" aria-hidden="true">${s}</span>`;
  [["Home","home","Inicio"],["Standings","standings","Tabla de posiciones"],["Power ranking","standings","Ranking semanal"],["Matches","matches","Resultados por semana"],["Cara a cara","h2h","H2H, comparar equipos"],["Pronosticos","pronosticos","Quiniela de la semana"],["Playoffs","playoffs","Bracket"],["Teams","teams","Equipos"],["Draft","draft","Tablero, trades y fichajes"],["Pokedex","pokedex","Pool del draft"],["Hall of Fame","salon","H.O.F., campeones y records"],["Mi equipo","mi-equipo","Panel del trainer"]]
    .forEach(([n,h,sub])=>out.push({k:"Seccion",n,sub,h:"#"+h,s:n+" "+sub,ico:ic("#"),view:n==="Power ranking"?"power":null}));
  TEAMS.forEach((t,i)=>out.push({k:"Equipo",n:t.n,sub:`#${t.ab} · Trainer ${PROFILES[i][0]} · ${CONF[t.c].name}`,h:"#team-"+slug(t),s:`${t.n} ${t.ab} ${PROFILES[i][0]}`,ico:crest(t)}));
  const seen=new Set();[...POOL.map(p=>p[0]),...Object.keys(OWNER)].forEach(n=>{if(seen.has(n))return;seen.add(n);const o=OWNER[n],nk=o!=null?getNick(o,n):"";
    out.push({k:"Pokemon",n:nk?`${nk} (${n})`:n,sub:o!=null?`En #${TEAMS[o].ab} · ${TEAMS[o].n}`:"Agente libre · ver en la Pokedex",h:o!=null?"#team-"+slug(TEAMS[o]):"#pokedex",mon:n,s:`${n} ${nk}`,ico:box(n,"")||ic("?")});});
  return out;}
function runSearch(){const q=norm(srchQ.value.trim());let idx=searchIndex();
  if(q){idx=idx.map(r=>{const s=norm(r.s),n=norm(r.n);const sc=n.startsWith(q)?4:s.split(/\s+/).some(w=>w.startsWith(q))?3:s.includes(q)?1:0;return [r,sc];}).filter(x=>x[1]).sort((a,b)=>b[1]-a[1]||a[0].n.localeCompare(b[0].n)).map(x=>x[0]);}
  else idx=idx.filter(r=>r.k==="Seccion");
  srchList=idx.slice(0,12);srchAct=0;
  srchRes.innerHTML=srchList.length?srchList.map((r,i)=>`<a class="srch-it ${i===0?"act":""}" href="${r.h}" data-si="${i}" role="option" aria-selected="${i===0}">${r.ico}<div><b>${esc(r.n)}</b><small>${esc(r.sub)}</small></div><span class="k">${r.k}</span></a>`).join(""):`<div class="srch-none">Nada coincide con "${esc(srchQ.value)}". Prueba con un equipo, un trainer o un Pokemon.</div>`;}
function setAct(i){if(!srchList.length)return;srchAct=(i+srchList.length)%srchList.length;srchRes.querySelectorAll(".srch-it").forEach((a,k)=>{a.classList.toggle("act",k===srchAct);a.setAttribute("aria-selected",k===srchAct);if(k===srchAct)a.scrollIntoView({block:"nearest"});});}
function openSearch(){srchBack=document.activeElement;srch.hidden=false;srchQ.value="";runSearch();srchQ.focus();}
function closeSearch(){srch.hidden=true;if(srchBack&&srchBack.focus)srchBack.focus();}
function goSearch(r){closeSearch();
  if(r.mon&&r.h==="#pokedex"){dxQ.value=r.mon;renderDex();}
  if(r.view)setSView(r.view);
  if(location.hash===r.h)route();else location.hash=r.h;
  if(r.mon&&r.h!=="#pokedex")setTimeout(()=>{const el=document.querySelector(`#page-profile .pk[data-mon="${CSS.escape(r.mon)}"]`);if(el){el.scrollIntoView({behavior:"smooth",block:"center"});el.classList.add("flash");setTimeout(()=>el.classList.remove("flash"),1800);}},150);}
document.getElementById("searchBtn").addEventListener("click",openSearch);
srchQ.addEventListener("input",runSearch);
srchQ.addEventListener("keydown",e=>{if(e.key==="ArrowDown"){e.preventDefault();setAct(srchAct+1);}else if(e.key==="ArrowUp"){e.preventDefault();setAct(srchAct-1);}else if(e.key==="Enter"){e.preventDefault();if(srchList[srchAct])goSearch(srchList[srchAct]);}});
srchRes.addEventListener("click",e=>{const a=e.target.closest("[data-si]");if(!a)return;e.preventDefault();goSearch(srchList[+a.dataset.si]);});
srch.addEventListener("click",e=>{if(e.target===srch)closeSearch();});
document.addEventListener("keydown",e=>{
  if(!srch.hidden&&e.key==="Escape"){e.preventDefault();closeSearch();return;}
  const typing=e.target.closest&&e.target.closest("input,textarea,select,[contenteditable]");
  if(srch.hidden&&((e.key==="/"&&!typing)||((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="k"))){e.preventDefault();openSearch();}});

/* ---------- Home: power ranking y Pokemon de la semana ---------- */
function renderHomeExtras(){document.getElementById("homePower").innerHTML=powerTable(WEEKS).slice(0,5).map(pwRow).join("");
  document.getElementById("hpLabel").textContent=`Semana ${WEEKS} de ${WEEKS} · top 5 de 18`;document.getElementById("homePotw").innerHTML=potwCard(WEEKS);}
safe(()=>renderHomeExtras(),"renderHomeExtras");
/* leaderboard: cada Pokemon destacado toma el color de la conferencia de su equipo */
(()=>{const cc=n=>{const o=OWNER[n];return o!=null?CONF[TEAMS[o].c].v:null;};
  const kdN=(MONS_FULL.slice().sort((a,b)=>b.kd-a.kd)[0]||{}).n,st=document.querySelector("#bars .note strong");if(st&&cc(kdN))st.style.color=cc(kdN);
  document.querySelectorAll("#mtiles .mt").forEach(t=>{const c=cc(t.querySelector("strong").textContent.trim());if(c)t.style.setProperty("--c",c);});
  document.querySelectorAll("#bars .bar").forEach((b,i)=>{const c=MONS[i]&&cc(MONS[i][0]);const t=b.querySelector(".t i");if(c&&t)t.style.setProperty("--bc",c);});
  const tp=document.querySelector("#bars .bar.top .p");if(tp&&MONS[0]&&cc(MONS[0][0]))tp.style.color=cc(MONS[0][0]);})();
renderMons(); // vuelve a pintar el leaderboard con el color de cada equipo
renderMatches(); // vuelve a pintar Matches ahora que el Pokemon de la semana ya se puede calcular

/* ---------- roles (demo) y pagina Media del community manager ---------- */
const ROLES=PPV.ROLES;
const hasRole=r=>(ROLES[ME]||[]).includes(r);
if(hasRole("cm")){document.getElementById("navMedia").hidden=false;document.getElementById("cmBtn").hidden=false;}
async function saveBlob(b,name){const dl=await getDl();
  if(dl){try{await dl.save({filename:name,data:b});return "ok";}catch(e){return e&&e.code==="declined"?"declined":e&&e.code==="rate_limited"?"rate":"err";}}
  const a=document.createElement("a");a.href=URL.createObjectURL(b);a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),4000);return "ok";}
let mdWeek=WEEKS,mdFmt="post",mdJob=0,mdItems=[],mdFiles=[];
function mediaItems(w){return [
  {tag:`Semana ${w}`,t:"Calendario de la semana",d:`Los cruces de la semana ${w}, sin resultados.`,o:()=>SHARE_KINDS.schedule(w)},
  {tag:`Semana ${w}`,t:"Resultados de la semana",d:`Las series de la semana ${w} con su marcador.`,o:()=>SHARE_KINDS.week(w)},
  {tag:`Semana ${w}`,t:"Power ranking",d:`Los 18 equipos despues de la semana ${w}.`,o:()=>SHARE_KINDS.power(w)},
  {tag:`Semana ${w}`,t:"Pokemon de la semana",d:"El Pokemon con mas victorias de la semana.",o:()=>SHARE_KINDS.potw(w)},
  {tag:"Temporada",t:"Standings por conferencia",d:"Las dos tablas con la linea de playoffs.",o:()=>({kind:"Tabla",title:"Standings por conferencia",file:"tabla-conferencias",accent:"var(--volt)",draw:f=>drawTable(f,"conf")})},
  {tag:"Temporada",t:"Tabla general",d:"Los 18 equipos en una sola tabla.",o:()=>({kind:"Tabla",title:"Tabla general",file:"tabla-general",accent:"var(--volt)",draw:f=>drawTable(f,"all")})},
  {tag:"Temporada",t:"Lideres en KOs",d:"El leaderboard de Pokemon.",o:()=>SHARE_KINDS.leaders()},
  {tag:"Mercado",t:"Trades y fichajes",d:"Los movimientos de la temporada.",o:()=>SHARE_KINDS.market()},
  {tag:"Playoffs",t:"Bracket",d:"El cuadro de playoffs con resultados.",o:()=>SHARE_KINDS.bracket()}];}
async function renderMedia(){const box=document.getElementById("mdGrid");
  if(!hasRole("cm")){box.innerHTML='<div class="empty">Esta pagina es solo para el rol de community manager.</div>';return;}
  document.querySelectorAll("#mdWeeks button").forEach(b=>b.setAttribute("aria-pressed",+b.dataset.w===mdWeek));
  document.querySelectorAll("#mdFmt button").forEach(b=>b.setAttribute("aria-pressed",b.dataset.fm===mdFmt));
  const job=++mdJob,all=document.getElementById("mdAll");mdItems=mediaItems(mdWeek);mdFiles=[];all.disabled=true;
  document.getElementById("mdCount").textContent=`${mdItems.length} imagenes · semana ${mdWeek} · ${mdFmt==="story"?"historia":"post"}`;
  box.innerHTML=mdItems.map((it,i)=>`<article class="md-c"><div class="md-prev ${mdFmt}" id="mdP${i}"><span class="label">Generando…</span></div><div class="md-b"><span class="md-tag">${esc(it.tag)}</span><h3>${esc(it.t)}</h3><p>${esc(it.d)}</p><div class="md-acts"><button type="button" class="btn sh-sm" data-mdl="${i}" disabled>⤓ Descargar</button><button type="button" class="btn ghost sh-sm" data-mds="${i}">⤴ Compartir</button></div></div></article>`).join("");
  for(let i=0;i<mdItems.length;i++){const o=mdItems[i].o();let cv;try{cv=await o.draw(mdFmt);}catch(e){cv=null;}if(job!==mdJob)return;
    const p=document.getElementById("mdP"+i);if(!cv){p.innerHTML='<span class="label">No disponible</span>';continue;}p.innerHTML="";p.appendChild(cv);
    const blob=await new Promise(r=>{try{cv.toBlob(b=>r(b),"image/png");}catch(e){r(null);}});if(job!==mdJob)return;
    mdFiles[i]=blob?{blob,name:`ppv-${/d/.test(o.file)?o.file:`s${mdWeek}-${o.file}`}-${mdFmt==="story"?"historia":"post"}.png`}:null;
    const b=document.querySelector(`[data-mdl="${i}"]`);if(b)b.disabled=!blob;}
  all.disabled=!mdFiles.some(Boolean);}
/* overlays de OBS: en el detalle de cada serie (Matches), para cualquier jugador */
const obsName=(mi,k)=>{const m=MATCHES[mi];return `ppv-obs-s${m.w}-${TEAMS[m.a].ab}-vs-${TEAMS[m.b].ab}-${k==="ov"?"overlay":"inicio"}.png`.toLowerCase();};
const cvBlob=cv=>new Promise(r=>{try{cv.toBlob(b=>r(b),"image/png");}catch(e){r(null);}});
async function renderSdObs(mi){const p=document.getElementById("sdObsPrev");if(!p)return;const cv=await drawOverlay(mi);const q=document.getElementById("sdObsPrev");if(!q||q.dataset.mi!==String(mi))return;q.innerHTML="";q.appendChild(cv);}
document.addEventListener("click",async e=>{const b=e.target.closest("[data-obs]");if(!b)return;const mi=+b.dataset.obs,k=b.dataset.k;b.disabled=true;
  const blob=await cvBlob(await (k==="ov"?drawOverlay(mi):drawIntro(mi)));const r=blob?await saveBlob(blob,obsName(mi,k)):"err";b.disabled=false;
  toastMsg(r==="ok"?"Archivo guardado.":r==="declined"?"Descarga cancelada.":r==="rate"?"Hay una descarga pendiente; intenta en un momento.":"No se pudo guardar el archivo.");});
document.getElementById("mdWeeks").innerHTML=Array.from({length:WEEKS},(_,i)=>`<button type="button" data-w="${i+1}"><small>Semana</small>${i+1}</button>`).join("");
document.getElementById("mdWeeks").addEventListener("click",e=>{const b=e.target.closest("button[data-w]");if(!b)return;mdWeek=+b.dataset.w;renderMedia();});
document.querySelectorAll("#mdFmt button").forEach(b=>b.addEventListener("click",()=>{mdFmt=b.dataset.fm;renderMedia();}));
document.getElementById("mdGrid").addEventListener("click",async e=>{
  const d=e.target.closest("[data-mdl]");if(d){const fl=mdFiles[+d.dataset.mdl];if(!fl)return;d.disabled=true;const r=await saveBlob(fl.blob,fl.name);d.disabled=false;toastMsg(r==="ok"?"Imagen guardada.":r==="declined"?"Descarga cancelada.":r==="rate"?"Hay una descarga pendiente; intenta en un momento.":"No se pudo guardar la imagen.");return;}
  const s=e.target.closest("[data-mds]");if(s)openShareWith({...mdItems[+s.dataset.mds].o()});});
document.getElementById("mdAll").addEventListener("click",async()=>{const btn=document.getElementById("mdAll"),files=mdFiles.filter(Boolean);btn.disabled=true;let ok=0;
  for(let i=0;i<files.length;i++){btn.textContent=`⤓ Descargando ${i+1} de ${files.length}…`;let r=await saveBlob(files[i].blob,files[i].name);
    if(r==="rate"){await new Promise(z=>setTimeout(z,1500));r=await saveBlob(files[i].blob,files[i].name);}
    if(r==="declined")break;if(r==="ok")ok++;await new Promise(z=>setTimeout(z,350));}
  btn.textContent="⤓ Descargar todas";btn.disabled=false;toastMsg(`${ok} de ${files.length} imagenes guardadas.`);});

safe(()=>refreshLeaderNicks(),"refreshLeaderNicks");
/* routing */
function route(){
  const h=location.hash.slice(1);
  const PAGES=["home","teams","standings","matches","h2h","pronosticos","playoffs","draft","pokedex","mi-equipo","salon","media","admin","login","temporadas"];
  const ti=h.startsWith("team-")?TEAMS.findIndex(t=>"team-"+slug(t)===h):-1;
  const hm=h.match(/^h2h-(\d+)-(\d+)$/);if(hm&&TEAMS[+hm[1]]&&TEAMS[+hm[2]]&&hm[1]!==hm[2])h2=[+hm[1],+hm[2]];
  const p=ti>=0?"profile":hm?"h2h":PAGES.includes(h)?h:"home";
  if(ti>=0)safe(()=>renderProfile(ti),"profile");
  if(p==="h2h")safe(()=>renderH2H(),"h2h");
  if(p==="pronosticos")safe(()=>renderPicks(),"picks");
  if(p==="media")safe(()=>renderMedia(),"media");
  if(PPV.hooks.pages[p])safe(()=>PPV.hooks.pages[p](),p);
  if(p==="mi-equipo"&&ME<0)safe(()=>PPV.hooks.pages.mine(),"mine");
  {const cb=document.getElementById("cmBtn");if(cb)cb.classList.toggle("on",p==="media");}
  [...PAGES,"profile"].forEach(x=>document.getElementById("page-"+x).hidden=p!==x);
  if(p==="draft")requestAnimationFrame(equalizeBoard);
  if(p==="matches"){const W=document.getElementById("weeks");W.scrollLeft=W.scrollWidth;}
  document.querySelectorAll(".nav nav a[data-page]").forEach(a=>a.classList.toggle("on",a.dataset.page===(p==="profile"?"teams":p==="pronosticos"?"matches":p)));
  scrollTo(0,0);
}
addEventListener("hashchange",route);route();window.PPV_ROUTE=route;
/* ---------- app instalable (PWA) ---------- */
let deferredInstall=null;
if("serviceWorker" in navigator&&location.protocol==="https:")addEventListener("load",()=>navigator.serviceWorker.register("sw.js").catch(()=>{}));
addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferredInstall=e;const b=document.getElementById("installBtn");if(b)b.hidden=false;});
document.getElementById("installBtn").addEventListener("click",async()=>{if(!deferredInstall)return;deferredInstall.prompt();try{await deferredInstall.userChoice;}catch(e){}deferredInstall=null;document.getElementById("installBtn").hidden=true;});
addEventListener("appinstalled",()=>{document.getElementById("installBtn").hidden=true;toastMsg("Listo: la PPV Draft League ya esta en tu pantalla de inicio.");});


/* placeholder links */
const toast=document.getElementById("toast");let tt;
document.addEventListener("click",e=>{const a=e.target.closest("[data-soon]");if(!a)return;e.preventDefault();toast.textContent="Esta seccion no esta incluida en el mockup (no esta incluida en el mockup).";toast.hidden=false;clearTimeout(tt);tt=setTimeout(()=>toast.hidden=true,2400);});
