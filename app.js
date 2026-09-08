(function(){
"use strict";

/* board data is fetched at start-up, then cached offline by the service worker */
let BOARDS=null, DAILY=null;
const E=-1, $=s=>document.querySelector(s);
const PALETTE=["#6831D7","#9A5FA9","#D73147","#BBA0E3","#D7AB31","#C5E7E5","#5FA995","#EAF1BA"];
const PATTERNS=[
 "repeating-linear-gradient(45deg,#0003 0 4px,transparent 4px 9px)",
 "repeating-linear-gradient(-45deg,#0003 0 4px,transparent 4px 9px)",
 "repeating-linear-gradient(0deg,#0003 0 3px,transparent 3px 9px)",
 "repeating-linear-gradient(90deg,#0003 0 3px,transparent 3px 9px)",
 "radial-gradient(#0004 1.8px,transparent 2px) 0 0/8px 8px",
 "radial-gradient(#0004 1.8px,transparent 2px) 0 0/13px 13px",
 "repeating-linear-gradient(45deg,#0003 0 2px,transparent 2px 12px)",
 "repeating-linear-gradient(135deg,#0003 0 6px,transparent 6px 12px)"];

let game="tango", size={tango:6,crown:6,path:5,patch:5}, showPat=false, patchLevel=2;
/* Each game gets its own colour and its own mark. Checked against all three
   kinds of colour blindness (worst pair 21.7 apart) and white text stays
   readable on every one of them. */
const GAMES={
  tango:{name:"Suns",  col:"#966F0C", dark:"#AB821B", soft:"#F7EEDA"},
  crown:{name:"Crowns",col:"#460DA9", dark:"#9A6EE7", soft:"#ECE7FA"},
  path: {name:"Path",  col:"#3D7DA2", dark:"#458EB9", soft:"#E6F0F6"},
  patch:{name:"Plots", col:"#701D1D", dark:"#D76565", soft:"#F7E9E9"}
};
function theme(){
  const g=GAMES[game], root=document.getElementById("root");
  document.body.style.background = state.dark ? "#0e1319" : "#f4f7fb";
  const home = !$("#play") || $("#play").hidden;
  /* --accent paints blocks of colour; --ink is the readable version for text,
     lifted in dark mode so a deep violet or brick never sinks into the page. */
  root.style.setProperty("--accent", home ? "#3F5570" : g.col);
  root.style.setProperty("--ink",   home ? (state.dark?"#9FB2C9":"#3F5570")
                                         : (state.dark? g.dark : g.col));
  root.style.setProperty("--soft", g.soft);
}
let cur=null, t0=0, tick=null, solved=false;
let errs=new Set(), tips=new Set(), area=new Set(), errTimer=null;
let entering=false, touched=null, winning=false, shookFor="";
function animate(d,r,c,key){
  if(entering){ d.style.animation="cellEnter .28s "+((r+c)*20)+"ms both"; return; }
  if(winning){ d.style.animation="winWave .5s "+((r+c)*40)+"ms both"; return; }
  if(touched===key) d.classList.add("pop");     // one square, one time
}
function celebrate(){
  markSolved();
  blip(660,.1,"triangle"); setTimeout(()=>blip(880,.14,"triangle"),110);
  winning=true; redraw();
  const g=document.querySelector(".grid"); if(g) g.classList.add("won");
  setTimeout(()=>{ winning=false; }, 1200);
}
function shakeBoard(tag){
  if(shookFor===tag) return;   // one shake per mistake, not one per redraw
  shookFor=tag;
  const g=document.querySelector(".grid");
  if(g){ g.classList.remove("shake"); void g.offsetWidth; g.classList.add("shake"); }
  blip(180,.09,"sawtooth");
}
const GRACE=750;
function clearErrors(){ errs=new Set(); area=new Set(); }
function winLine(){
  const s=((Date.now()-t0)/1000)|0;
  const m=((s/60)|0)+":"+String(s%60).padStart(2,"0");
  return "Solved in "+m+".";
}
function setMsg(t,cls){ const m=$("#msg"); m.textContent=t||""; m.className=cls||""; }
function deferCheck(fn){ clearTimeout(errTimer); clearErrors();
  errTimer=setTimeout(()=>{ fn(); redraw(); }, GRACE); }
function redraw(){ ({tango:drawTango,crown:drawCrown,path:drawPath,patch:drawPatch})[game]();
  requestAnimationFrame(()=>{ touched=null; }); }
function cellPx(cols){ const w=Math.min(392, window.innerWidth-28); return Math.floor((w-2*(cols+1))/cols); }
function startTimer(){ t0=Date.now(); clearInterval(tick);
  tick=setInterval(()=>{ if(solved) return; const s=((Date.now()-t0)/1000)|0;
    $("#timer").textContent=((s/60)|0)+":"+String(s%60).padStart(2,"0"); },250);
  $("#timer").textContent="0:00"; }
/* draws a hard outline round the outside of a marked area */
function edgeStyle(d,key,set){
  if(!set.has(key)) return;
  const [r,c]=key.split(",").map(Number);
  const B="4px solid #7a1610";
  if(!set.has((r-1)+","+c)) d.style.borderTop=B;
  if(!set.has((r+1)+","+c)) d.style.borderBottom=B;
  if(!set.has(r+","+(c-1))) d.style.borderLeft=B;
  if(!set.has(r+","+(c+1))) d.style.borderRight=B;
}

/* ==================================================================
   SUNS  —  real rules: equal suns and moons per row and column,
   never three of a kind in a row, plus = and x links between
   neighbouring squares. (No "rows must differ" rule — that was wrong.)
   ================================================================== */
function ekey(r1,c1,r2,c2){ return r1+","+c1+"|"+r2+","+c2; }
function tangoLegal(g,cons,n,r,c){
  const row=g[r], col=[]; for(let i=0;i<n;i++) col.push(g[i][c]);
  for(const line of [row,col]){
    let run=1;
    for(let i=1;i<n;i++){ if(line[i]!==E&&line[i]===line[i-1]){run++; if(run>2) return false;} else run=1; }
    let z=0,o=0; for(const v of line){ if(v===0)z++; else if(v===1)o++; }
    if(z>n/2||o>n/2) return false;
  }
  for(const [k,t] of Object.entries(cons)){
    const [a,b]=k.split("|"), [r1,c1]=a.split(",").map(Number), [r2,c2]=b.split(",").map(Number);
    const v1=g[r1][c1], v2=g[r2][c2];
    if(v1===E||v2===E) continue;
    if(t==="=" && v1!==v2) return false;
    if(t==="x" && v1===v2) return false;
  }
  return true;
}
function tangoFull(n){
  const g=Array.from({length:n},()=>Array(n).fill(E));
  const cells=[]; for(let r=0;r<n;r++)for(let c=0;c<n;c++) cells.push([r,c]);
  function bt(i){
    if(i===cells.length) return true;
    const [r,c]=cells[i];
    for(const v of (Math.random()<.5?[0,1]:[1,0])){
      g[r][c]=v;
      if(tangoLegal(g,{},n,r,c)&&bt(i+1)) return true;
      g[r][c]=E;
    }
    return false;
  }
  return bt(0)?g:null;
}
/* one deduction step, with the reason */
function tangoStep(g,cons,n){
  // 1. a link with one side known
  for(const [k,t] of Object.entries(cons)){
    const [a,b]=k.split("|"), [r1,c1]=a.split(",").map(Number), [r2,c2]=b.split(",").map(Number);
    const v1=g[r1][c1], v2=g[r2][c2];
    if(v1!==E&&v2===E) return {r:r2,c:c2,v:(t==="="?v1:1-v1),why:"the "+(t==="="?"=":"×")+" link"};
    if(v2!==E&&v1===E) return {r:r1,c:c1,v:(t==="="?v2:1-v2),why:"the "+(t==="="?"=":"×")+" link"};
  }
  // 2. no three of a kind
  for(const isRow of [true,false]) for(let k=0;k<n;k++){
    const line = isRow? g[k].slice() : g.map(r=>r[k]);
    for(let i=0;i<n;i++){
      if(line[i]!==E) continue;
      let v=null;
      if(i>=2&&line[i-1]!==E&&line[i-1]===line[i-2]) v=1-line[i-1];
      else if(i+2<n&&line[i+1]!==E&&line[i+1]===line[i+2]) v=1-line[i+1];
      else if(i>0&&i<n-1&&line[i-1]!==E&&line[i-1]===line[i+1]) v=1-line[i-1];
      if(v!==null) return {r:isRow?k:i, c:isRow?i:k, v, why:"no three of a kind in a row"};
    }
  }
  // 3. the line already has its full share of one symbol
  for(const isRow of [true,false]) for(let k=0;k<n;k++){
    const line = isRow? g[k].slice() : g.map(r=>r[k]);
    if(!line.includes(E)) continue;
    for(const v of [0,1]){
      let cnt=0; for(const x of line) if(x===v) cnt++;
      if(cnt===n/2){
        for(let i=0;i<n;i++) if(line[i]===E)
          return {r:isRow?k:i,c:isRow?i:k,v:1-v,
            why:"this "+(isRow?"row":"column")+" already has all its "+(v===1?"suns":"stars")};
      }
    }
  }
  return null;
}
function tangoSolvable(g,cons,n){
  const t=g.map(r=>r.slice()); let guard=0;
  while(t.some(r=>r.includes(E))){
    if(++guard>500) return false;
    const st=tangoStep(t,cons,n); if(!st) return false;
    t[st.r][st.c]=st.v;
  }
  return true;
}
function makeTango(n){
  for(let attempt=0;attempt<60;attempt++){
    const full=tangoFull(n); if(!full) continue;
    // sprinkle = and x links taken from the finished grid
    const pairs=[];
    for(let r=0;r<n;r++)for(let c=0;c<n;c++){
      if(c+1<n) pairs.push([r,c,r,c+1]);
      if(r+1<n) pairs.push([r,c,r+1,c]);
    }
    for(let i=pairs.length-1;i>0;i--){const j=(Math.random()*(i+1))|0;[pairs[i],pairs[j]]=[pairs[j],pairs[i]];}
    const cons={};
    const want=4+((Math.random()*4)|0);
    for(const [r1,c1,r2,c2] of pairs.slice(0,want))
      cons[ekey(r1,c1,r2,c2)] = full[r1][c1]===full[r2][c2] ? "=" : "x";
    // strip squares while a human can still finish it
    const g=full.map(r=>r.slice());
    const cells=[]; for(let r=0;r<n;r++)for(let c=0;c<n;c++) cells.push([r,c]);
    for(let i=cells.length-1;i>0;i--){const j=(Math.random()*(i+1))|0;[cells[i],cells[j]]=[cells[j],cells[i]];}
    for(const [r,c] of cells){
      const keep=g[r][c]; g[r][c]=E;
      if(!tangoSolvable(g,cons,n)) g[r][c]=keep;
    }
    let given=0; for(let r=0;r<n;r++)for(let c=0;c<n;c++) if(g[r][c]!==E) given++;
    if(given<=n*n*0.5) return {puzzle:g,solution:full,cons,n};
  }
  return null;
}
function newTango(){
  const n=size.tango, t=performance.now();
  if(mode==="daily"){
    const b=DAILY.tango[slot()];
    cur={n:b.n,puzzle:b.puzzle.map(r=>r.slice()),solution:b.sol,cons:b.cons};
  } else cur=makeTango(n);
  const ms=Math.round(performance.now()-t);
  cur.state=cur.puzzle.map(r=>r.slice());
  let links=Object.keys(cur.cons).length;
  $("#label").textContent=(mode==="daily"?dayName()+" · Suns":"Suns "+cur.n+"×"+cur.n)+" · "+links+" links";
  $("#hint").textContent="Equal suns and stars per row and column · never three in a row";
  drawTango();
}
function tangoErrors(){
  const n=cur.n,g=cur.state,bad=new Set(),zone=new Set(); let why="";
  const lines=[];
  for(let r=0;r<n;r++) lines.push({cells:Array.from({length:n},(_,c)=>[r,c]),name:"row "+(r+1)});
  for(let c=0;c<n;c++) lines.push({cells:Array.from({length:n},(_,r)=>[r,c]),name:"column "+(c+1)});
  for(const L of lines){
    const vals=L.cells.map(([r,c])=>g[r][c]);
    for(let i=0;i+2<n;i++) if(vals[i]!==E&&vals[i]===vals[i+1]&&vals[i]===vals[i+2]){
      [i,i+1,i+2].forEach(k=>bad.add(L.cells[k].join(",")));
      L.cells.forEach(x=>zone.add(x.join(",")));
      if(!why) why="Three of a kind in "+L.name+".";
    }
    for(const v of [0,1]){
      let cnt=0; for(const x of vals) if(x===v) cnt++;
      if(cnt>n/2){
        L.cells.forEach(([r,c],i)=>{ if(vals[i]===v) bad.add(r+","+c); });
        L.cells.forEach(x=>zone.add(x.join(",")));
        if(!why) why="Too many "+(v===1?"suns":"stars")+" in "+L.name+".";
      }
    }
  }
  for(const [k,t] of Object.entries(cur.cons)){
    const [a,b]=k.split("|"),[r1,c1]=a.split(",").map(Number),[r2,c2]=b.split(",").map(Number);
    const v1=g[r1][c1],v2=g[r2][c2];
    if(v1===E||v2===E) continue;
    if((t==="="&&v1!==v2)||(t==="x"&&v1===v2)){
      bad.add(r1+","+c1); bad.add(r2+","+c2);
      zone.add(r1+","+c1); zone.add(r2+","+c2);
      if(!why) why = t==="=" ? "These two are linked with = — they must match."
                             : "These two are linked with × — they must differ.";
    }
  }
  return {bad,zone,why};
}
function drawTango(){
  const n=cur.n,px=cellPx(n),b=$("#board");
  b.innerHTML=""; b.className="";
  const g=document.createElement("div");
  g.className="grid"; g.style.gridTemplateColumns=`repeat(${n},${px}px)`;
  b.style.width=(n*px+2*(n+1))+"px";
  const cells={};
  for(let r=0;r<n;r++)for(let c=0;c<n;c++){
    const key=r+","+c;
    const d=document.createElement("div");
    cells[key]=d;
    d.className="cell"+(cur.puzzle[r][c]!==E?" given":"")
      +(errs.has(key)?" err":"")+(area.has(key)?" area":"")+(tips.has(key)?" tip":"");
    d.style.height=px+"px";
    edgeStyle(d,key,area); animate(d,r,c,key);
    const v=cur.state[r][c];
    if(v!==E) d.appendChild(mark(v,px));
    if(cur.puzzle[r][c]===E) d.onclick=()=>{
      const x=cur.state[r][c];
      cur.state[r][c]= x===E?1 : x===1?0 : E;
      touched=key; tips=new Set(); setMsg(""); deferCheck(checkTango); drawTango();
    };
    g.appendChild(d);
  }
  b.appendChild(g);
  /* Measure where the squares actually landed and drop each badge exactly on the
     line between its two squares. No arithmetic guessing about gaps or padding. */
  const layer=document.createElement("div"); layer.className="edges";
  b.appendChild(layer);
  const boardBox=b.getBoundingClientRect();
  for(const [k,t] of Object.entries(cur.cons)){
    const [a,bb]=k.split("|"),[r1,c1]=a.split(",").map(Number),[r2,c2]=bb.split(",").map(Number);
    const A=cells[r1+","+c1], B2=cells[r2+","+c2];
    if(!A||!B2) continue;
    const ra=A.getBoundingClientRect(), rb=B2.getBoundingClientRect();
    const x=((ra.left+ra.right)/2 + (rb.left+rb.right)/2)/2 - boardBox.left;
    const y=((ra.top+ra.bottom)/2 + (rb.top+rb.bottom)/2)/2 - boardBox.top;
    const e=document.createElement("div"); e.className="edge";
    e.style.left=x+"px"; e.style.top=y+"px";
    e.textContent = t==="="?"=":"×";
    layer.appendChild(e);
  }
}
function checkTango(){
  const {bad,zone,why}=tangoErrors();
  errs=bad; area=zone;
  if(bad.size){ setMsg(why,"err"); shakeBoard(why); return; }
  if(cur.state.some(r=>r.includes(E))){ setMsg(""); return; }
  if(!solved){ solved=true; setMsg(winLine()); celebrate(); }
}
function hintTango(){
  const n=cur.n;
  for(let r=0;r<n;r++)for(let c=0;c<n;c++)
    if(cur.puzzle[r][c]===E&&cur.state[r][c]!==E&&cur.state[r][c]!==cur.solution[r][c]){
      errs=new Set([r+","+c]); area=new Set([r+","+c]); tips=new Set();
      setMsg("This square is wrong — that's what's blocking you.","err"); drawTango(); return; }
  const st=tangoStep(cur.state,cur.cons,n);
  if(!st){ setMsg("Nothing forced left to find.","tip"); return; }
  cur.state[st.r][st.c]=st.v; tips=new Set([st.r+","+st.c]); clearErrors();
  setMsg("Filled one in — because "+st.why+".","tip");
  drawTango(); if(!cur.state.some(r=>r.includes(E))) checkTango();
}


/* Two marks that stay apart at any size: a round radiating sun and a
   sharp five-pointed star. Different silhouette, different fill, so they
   never depend on colour to be told apart. */
function mark(v,px){
  const NS="http://www.w3.org/2000/svg", s=Math.round(px*0.62);
  const svg=document.createElementNS(NS,"svg");
  svg.setAttribute("viewBox","0 0 40 40");
  svg.setAttribute("width",s); svg.setAttribute("height",s);
  svg.style.zIndex="3";
  if(v===1){                                   // sun
    const c=document.createElementNS(NS,"circle");
    c.setAttribute("cx","20"); c.setAttribute("cy","20"); c.setAttribute("r","10");
    c.setAttribute("fill","#E8A317"); c.setAttribute("stroke","#8A5D06"); c.setAttribute("stroke-width","2");
    svg.appendChild(c);
    for(let i=0;i<8;i++){
      const a=i*Math.PI/4, ray=document.createElementNS(NS,"line");
      ray.setAttribute("x1",20+Math.cos(a)*13.5); ray.setAttribute("y1",20+Math.sin(a)*13.5);
      ray.setAttribute("x2",20+Math.cos(a)*18);   ray.setAttribute("y2",20+Math.sin(a)*18);
      ray.setAttribute("stroke","#8A5D06"); ray.setAttribute("stroke-width","2.6");
      ray.setAttribute("stroke-linecap","round");
      svg.appendChild(ray);
    }
  } else {                                     // star
    let d="";
    for(let i=0;i<10;i++){
      const a=-Math.PI/2 + i*Math.PI/5, rr = i%2? 7.5 : 17.5;
      d += (i?"L":"M") + (20+Math.cos(a)*rr).toFixed(2) + " " + (20+Math.sin(a)*rr).toFixed(2) + " ";
    }
    const p=document.createElementNS(NS,"path");
    p.setAttribute("d",d+"Z"); p.setAttribute("fill","#3E4C63");
    p.setAttribute("stroke","#1D2837"); p.setAttribute("stroke-width","2");
    p.setAttribute("stroke-linejoin","round");
    svg.appendChild(p);
  }
  return svg;
}


/* an actual crown — reads on any colour, in either theme */
function crownIcon(px){
  const NS="http://www.w3.org/2000/svg";
  const svg=document.createElementNS(NS,"svg");
  svg.setAttribute("viewBox","0 0 40 40");
  const s=Math.round(px*0.62);
  svg.setAttribute("width",s); svg.setAttribute("height",s);
  svg.style.zIndex="3";
  const p=document.createElementNS(NS,"path");
  p.setAttribute("d","M7 27 L7 13 L14 19 L20 9 L26 19 L33 13 L33 27 Z");
  p.setAttribute("fill","#0C1118"); p.setAttribute("stroke","#FFFFFF");
  p.setAttribute("stroke-width","2.4"); p.setAttribute("stroke-linejoin","round");
  svg.appendChild(p);
  const b=document.createElementNS(NS,"rect");
  b.setAttribute("x","7"); b.setAttribute("y","28"); b.setAttribute("width","26");
  b.setAttribute("height","5"); b.setAttribute("rx","2");
  b.setAttribute("fill","#0C1118"); b.setAttribute("stroke","#FFFFFF"); b.setAttribute("stroke-width","2.4");
  svg.appendChild(b);
  return svg;
}
/* thick line wherever two different colours meet, like a real region map */
function regionEdge(d,r,c,reg,n){
  const B="3px solid #10151C", T="1px solid rgba(0,0,0,.16)";
  d.style.borderTop    = (r===0   || reg[r-1][c]!==reg[r][c]) ? B : T;
  d.style.borderBottom = (r===n-1 || reg[r+1][c]!==reg[r][c]) ? B : T;
  d.style.borderLeft   = (c===0   || reg[r][c-1]!==reg[r][c]) ? B : T;
  d.style.borderRight  = (c===n-1 || reg[r][c+1]!==reg[r][c]) ? B : T;
}

/* ================= CROWNS ================= */
function newCrown(){
  let b;
  if(mode==="daily"){ b=DAILY.crown[slot()]; size.crown=b.n; }
  else { const pool=BOARDS.crown[String(size.crown)]; b=pool[(Math.random()*pool.length)|0]; }
  const n=b.n;
  cur={n,regions:b.regions,sol:b.sol,tier:b.tier,marks:Array.from({length:n},()=>Array(n).fill(0))};
  $("#label").textContent=(mode==="daily"?dayName()+" · Crowns":"Crowns "+n+"×"+n)+" · level "+b.tier;
  $("#hint").textContent="One crown per row, column and colour · none touching";
  drawCrown();
}
function crownErrors(){
  const n=cur.n,cw=[],bad=new Set(),zone=new Set(); let why="";
  const addRow=r=>{for(let c=0;c<n;c++) zone.add(r+","+c);};
  const addCol=c=>{for(let r=0;r<n;r++) zone.add(r+","+c);};
  const addReg=k=>{for(let r=0;r<n;r++)for(let c=0;c<n;c++) if(cur.regions[r][c]===k) zone.add(r+","+c);};
  const addBox=(r,c)=>{for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){
    const rr=r+dr,cc=c+dc; if(rr>=0&&rr<n&&cc>=0&&cc<n) zone.add(rr+","+cc);}};
  for(let r=0;r<n;r++)for(let c=0;c<n;c++) if(cur.marks[r][c]===2) cw.push([r,c]);
  for(let i=0;i<cw.length;i++)for(let j=i+1;j<cw.length;j++){
    const [r1,c1]=cw[i],[r2,c2]=cw[j]; let hit="";
    if(r1===r2){ hit="Two crowns in row "+(r1+1)+"."; addRow(r1); }
    else if(c1===c2){ hit="Two crowns in column "+(c1+1)+"."; addCol(c1); }
    else if(cur.regions[r1][c1]===cur.regions[r2][c2]){ hit="Two crowns in this colour."; addReg(cur.regions[r1][c1]); }
    else if(Math.abs(r1-r2)<=1&&Math.abs(c1-c2)<=1){ hit="These two crowns are touching."; addBox(r1,c1); addBox(r2,c2); }
    if(hit){ bad.add(r1+","+c1); bad.add(r2+","+c2); if(!why) why=hit; }
  }
  if(cw.length>n&&!why){ why="That's "+cw.length+" crowns — only "+n+" fit."; cw.forEach(x=>bad.add(x.join(","))); }
  return {bad,zone,why,count:cw.length};
}
function drawCrown(){
  const n=cur.n,px=cellPx(n),b=$("#board");
  b.innerHTML=""; b.className=showPat?"showpat":"";
  const g=document.createElement("div");
  g.className="grid airy"; g.style.gridTemplateColumns=`repeat(${n},${px}px)`;
  b.style.width=(n*px+3)+"px";
  for(let r=0;r<n;r++)for(let c=0;c<n;c++){
    const key=r+","+c;
    const d=document.createElement("div");
    d.className="cell"+(errs.has(key)?" err":"")+(area.has(key)?" area":"")+(tips.has(key)?" tip":"");
    d.style.height=px+"px";
    const base=PALETTE[cur.regions[r][c]%8];
    d.style.background = base;                       // works everywhere
    if(state.dark) d.style.background = "color-mix(in srgb,"+base+" 72%, #0E1319)";
    regionEdge(d,r,c,cur.regions,n);
    edgeStyle(d,key,area); animate(d,r,c,key);
    const pat=document.createElement("div");
    pat.className="pat"; pat.style.background=PATTERNS[cur.regions[r][c]%8];
    d.appendChild(pat);
    const m=cur.marks[r][c];
    if(m===1){ const x=document.createElement("div"); x.className="xmark"; x.textContent="•"; d.appendChild(x); }
    if(m===2) d.appendChild(crownIcon(px));
    d.onclick=()=>{ cur.marks[r][c]=(cur.marks[r][c]+1)%3; touched=key; tips=new Set(); setMsg("");
      deferCheck(checkCrown); drawCrown(); };
    g.appendChild(d);
  }
  b.appendChild(g);
}
function checkCrown(){
  const n=cur.n,{bad,zone,why,count}=crownErrors();
  errs=bad; area=zone;
  if(why){ setMsg(why,"err"); shakeBoard(why); return; }
  if(count<n){ setMsg(count>0?count+" of "+n+" placed.":""); return; }
  if(!solved){ solved=true; setMsg(winLine()); celebrate(); }
}
function hintCrown(){
  const n=cur.n;
  for(let r=0;r<n;r++)for(let c=0;c<n;c++) if(cur.marks[r][c]===2&&cur.sol[r]!==c){
    errs=new Set([r+","+c]); area=new Set([r+","+c]); tips=new Set();
    setMsg("This crown can't be right.","err"); drawCrown(); return; }
  const cand=Array.from({length:n},()=>Array(n).fill(true));
  const pr=new Set(),pc=new Set(),pg=new Set();
  for(let r=0;r<n;r++)for(let c=0;c<n;c++) if(cur.marks[r][c]===2){
    pr.add(r); pc.add(c); pg.add(cur.regions[r][c]);
    for(let i=0;i<n;i++){ cand[r][i]=false; cand[i][c]=false; }
    for(let rr=0;rr<n;rr++)for(let cc=0;cc<n;cc++){
      if(cur.regions[rr][cc]===cur.regions[r][c]) cand[rr][cc]=false;
      if(Math.abs(rr-r)<=1&&Math.abs(cc-c)<=1) cand[rr][cc]=false; }
  }
  const groups=[];
  for(let r=0;r<n;r++) if(!pr.has(r)) groups.push({name:"Row "+(r+1),
    cells:Array.from({length:n},(_,c)=>[r,c]).filter(([a,b])=>cand[a][b])});
  for(let c=0;c<n;c++) if(!pc.has(c)) groups.push({name:"Column "+(c+1),
    cells:Array.from({length:n},(_,r)=>[r,c]).filter(([a,b])=>cand[a][b])});
  for(let k=0;k<n;k++) if(!pg.has(k)){
    const cells=[]; for(let r=0;r<n;r++)for(let c=0;c<n;c++) if(cur.regions[r][c]===k&&cand[r][c]) cells.push([r,c]);
    groups.push({name:"This colour",cells}); }
  const s=groups.find(x=>x.cells.length===1);
  if(s){ const [r,c]=s.cells[0]; tips=new Set([r+","+c]); clearErrors();
    setMsg(s.name+" has only one square left.","tip"); drawCrown(); return; }
  for(let r=0;r<n;r++) if(cur.marks[r][cur.sol[r]]!==2){
    tips=new Set([r+","+cur.sol[r]]); clearErrors();
    setMsg("A crown belongs here.","tip"); drawCrown(); return; }
  setMsg("Nothing left to hint.","tip");
}

/* ================= PATH ================= */
function newPath(){
  let b;
  if(mode==="daily"){ b=DAILY.path[slot()]; size.path=b.h; }
  else { const pool=BOARDS.path[size.path+"x"+size.path]; b=pool[(Math.random()*pool.length)|0]; }
  cur={h:b.h,w:b.w,cps:b.cps.map(p=>p.slice()),sol:b.sol.map(p=>p.slice()),path:[],drag:false};
  $("#label").textContent=(mode==="daily"?dayName()+" · Path":"Path "+b.h+"×"+b.w)+" · "+b.cps.length+" stops";
  $("#hint").textContent="One line through every square, numbers in order";
  drawPath();
}
function cpIndex(r,c){ return cur.cps.findIndex(p=>p[0]===r&&p[1]===c); }
function drawPath(){
  const n=cur.w,px=cellPx(n),b=$("#board");
  b.innerHTML=""; b.className="";
  const g=document.createElement("div");
  g.className="grid"; g.style.gridTemplateColumns=`repeat(${n},${px}px)`;
  b.style.width=(n*px+2*(n+1))+"px";
  const inPath=new Set(cur.path.map(p=>p[0]+","+p[1]));
  for(let r=0;r<cur.h;r++)for(let c=0;c<n;c++){
    const key=r+","+c;
    const d=document.createElement("div");
    d.className="cell"+(inPath.has(key)?" oncell":"")+(errs.has(key)?" err":"")
      +(area.has(key)?" area":"")+(tips.has(key)?" tip":"");
    d.style.height=px+"px"; d.dataset.r=r; d.dataset.c=c;
    animate(d,r,c,key);
    const i=cpIndex(r,c);
    if(i>=0){ const k=document.createElement("div"); k.className="cp"; k.textContent=i+1; d.appendChild(k); }
    g.appendChild(d);
  }
  b.appendChild(g);
  const svg=document.createElementNS("http://www.w3.org/2000/svg","svg");
  svg.id="svg"; svg.setAttribute("width","100%"); svg.setAttribute("height","100%");
  if(cur.path.length>1){
    const pts=cur.path.map(([r,c])=>((c*(px+2))+2+px/2)+","+((r*(px+2))+2+px/2)).join(" ");
    const pl=document.createElementNS("http://www.w3.org/2000/svg","polyline");
    pl.setAttribute("points",pts); pl.setAttribute("fill","none");
    pl.setAttribute("stroke","#3a6ea5"); pl.setAttribute("stroke-width",Math.max(6,px*0.28));
    pl.setAttribute("stroke-linecap","round"); pl.setAttribute("stroke-linejoin","round");
    pl.setAttribute("opacity",".85"); svg.appendChild(pl);
  }
  b.appendChild(svg);
}
function rewindTo(r,c){
  const i=cur.path.findIndex(q=>q[0]===r&&q[1]===c);
  if(i<0) return false;
  cur.path=cur.path.slice(0,i+1); clearErrors(); tips=new Set();
  drawPath(); checkPath(); return true;
}
function extend(r,c){
  const p=cur.path;
  if(p.length===0){ if(cpIndex(r,c)===0){ p.push([r,c]); tips=new Set(); drawPath(); }
    else setMsg("Start at 1.","err"); return; }
  const last=p[p.length-1];
  if(last[0]===r&&last[1]===c) return;
  const already=p.findIndex(q=>q[0]===r&&q[1]===c);
  if(already>=0){ cur.path=p.slice(0,already+1); clearErrors(); drawPath(); checkPath(); return; }
  if(Math.abs(last[0]-r)+Math.abs(last[1]-c)!==1) return;
  const i=cpIndex(r,c);
  if(i>=0){ let hit=0; for(const q of p) if(cpIndex(q[0],q[1])>=0) hit++;
    if(i!==hit){ errs=new Set([r+","+c]);
      const need=cur.cps[hit]; if(need) area=new Set([need.join(",")]);
      setMsg("That's stop "+(i+1)+" — you need "+(hit+1)+" next.","err"); drawPath(); return; } }
  clearErrors(); tips=new Set(); touched=r+","+c; p.push([r,c]); drawPath(); checkPath();
}
function checkPath(){
  const total=cur.h*cur.w; clearErrors();
  if(cur.path.length<total){ setMsg(cur.path.length+" of "+total+" squares."); return; }
  let hit=0; for(const q of cur.path) if(cpIndex(q[0],q[1])>=0) hit++;
  const last=cur.path[cur.path.length-1],lastCp=cur.cps[cur.cps.length-1];
  if(hit===cur.cps.length&&last[0]===lastCp[0]&&last[1]===lastCp[1]){
    if(!solved){ solved=true; setMsg(winLine()); celebrate(); } }
  else setMsg("Every square covered, but it doesn't end on the last number.","err");
}
function hintPath(){
  const sol=cur.sol;
  for(let i=0;i<cur.path.length;i++)
    if(cur.path[i][0]!==sol[i][0]||cur.path[i][1]!==sol[i][1]){
      errs=new Set([cur.path[i].join(",")]); tips=new Set();
      setMsg("The line goes wrong here — tap this square to jump back.","err"); drawPath(); return; }
  const nxt=sol[cur.path.length];
  if(!nxt){ setMsg("Nothing left to hint.","tip"); return; }
  tips=new Set([nxt.join(",")]); clearErrors();
  setMsg("The line goes here next.","tip"); drawPath();
}

/* ==================================================================
   PATCHES  —  real rules: split the grid into rectangles, one clue
   per rectangle, the number = how many squares it covers, and the
   shape word says square / wide / tall.
   ================================================================== */
const SQ="square",WD="wide",TL="tall",AN="any";
function shapeOf(h,w){ return h===w?SQ:(w>h?WD:TL); }
function partition(H,W,minA,maxA){
  for(let attempt=0;attempt<400;attempt++){
    const grid=Array.from({length:H},()=>Array(W).fill(-1)), rects=[];
    let ok=true;
    while(true){
      let spot=null;
      for(let r=0;r<H&&!spot;r++)for(let c=0;c<W;c++) if(grid[r][c]===-1){ spot=[r,c]; break; }
      if(!spot) break;
      const [r0,c0]=spot, opts=[];
      for(let h=1;h<=H-r0;h++)for(let w=1;w<=W-c0;w++){
        const a=h*w; if(a<minA||a>maxA) continue;
        let free=true;
        for(let r=r0;r<r0+h&&free;r++)for(let c=c0;c<c0+w;c++) if(grid[r][c]!==-1){ free=false; break; }
        if(free) opts.push([h,w]);
      }
      if(!opts.length){ ok=false; break; }
      const [h,w]=opts[(Math.random()*opts.length)|0], idx=rects.length;
      for(let r=r0;r<r0+h;r++)for(let c=c0;c<c0+w;c++) grid[r][c]=idx;
      rects.push([r0,c0,h,w]);
    }
    if(ok&&rects.length>=3) return rects;
  }
  return null;
}
/* a clue may carry a number, a shape, or both. n===null means the size is
   part of the puzzle — that's the hard clue type. */
function candidatesFor(H,W,cl,clues){
  const opts=[];
  for(let h=1;h<=H;h++)for(let w=1;w<=W;w++){
    if(cl.n!==null && h*w!==cl.n) continue;
    if(cl.shape!==AN && shapeOf(h,w)!==cl.shape) continue;
    for(let r0=Math.max(0,cl.r-h+1);r0<=Math.min(cl.r,H-h);r0++)
      for(let c0=Math.max(0,cl.c-w+1);c0<=Math.min(cl.c,W-w);c0++){
        let bad=false;
        for(const o of clues){ if(o===cl) continue;
          if(r0<=o.r&&o.r<r0+h&&c0<=o.c&&o.c<c0+w){ bad=true; break; } }
        if(!bad) opts.push([r0,c0,h,w]);
      }
  }
  return opts;
}
function countPatch(H,W,clues,limit){
  const cands=[];
  for(const cl of clues){
    const o=candidatesFor(H,W,cl,clues);
    if(!o.length) return 0;
    cands.push(o);
  }
  const order=cands.map((o,i)=>i).sort((a,b)=>cands[a].length-cands[b].length);
  const grid=Array.from({length:H},()=>Array(W).fill(-1));
  let found=0, steps=0;
  function bt(k){
    if(found>=limit||steps>200000) return;
    if(k===order.length){
      for(let r=0;r<H;r++)for(let c=0;c<W;c++) if(grid[r][c]===-1) return;
      found++; return;
    }
    const i=order[k];
    for(const [r0,c0,h,w] of cands[i]){
      steps++;
      let free=true;
      for(let r=r0;r<r0+h&&free;r++)for(let c=c0;c<c0+w;c++) if(grid[r][c]!==-1){ free=false; break; }
      if(!free) continue;
      for(let r=r0;r<r0+h;r++)for(let c=c0;c<c0+w;c++) grid[r][c]=i;
      bt(k+1);
      for(let r=r0;r<r0+h;r++)for(let c=c0;c<c0+w;c++) grid[r][c]=-1;
      if(found>=limit) return;
    }
  }
  bt(0);
  return found;
}
/* Difficulty is set on purpose, not discovered afterwards.
   Start with every clue fully spelled out, then rub information out for as long
   as the board can STILL be finished by forced moves at the target level.
   Level 1 = every step is "this clue has only one legal spot".
   Level 2 = you also need "only one clue can reach this square".
   Nothing is ever left needing a guess. */
function patchCands(n,cl,clues,grid){
  const out=[];
  for(let h=1;h<=n;h++)for(let w=1;w<=n;w++){
    if(cl.n!==null&&h*w!==cl.n) continue;
    if(cl.shape!==AN&&shapeOf(h,w)!==cl.shape) continue;
    for(let r0=Math.max(0,cl.r-h+1);r0<=Math.min(cl.r,n-h);r0++)
      for(let c0=Math.max(0,cl.c-w+1);c0<=Math.min(cl.c,n-w);c0++){
        let bad=false;
        for(const o of clues){ if(o===cl) continue;
          if(r0<=o.r&&o.r<r0+h&&c0<=o.c&&o.c<c0+w){ bad=true; break; } }
        if(bad) continue;
        for(let r=r0;r<r0+h&&!bad;r++)for(let c=c0;c<c0+w;c++) if(grid[r][c]!==-1){ bad=true; break; }
        if(!bad) out.push([r0,c0,h,w]);
      }
  }
  return out;
}
function patchGrade(n,clues){
  const grid=Array.from({length:n},()=>Array(n).fill(-1));
  const done=new Set(); let hardest=0,guard=0;
  while(done.size<clues.length){
    if(++guard>500) return null;
    let moved=false;
    for(let i=0;i<clues.length;i++){
      if(done.has(i)) continue;
      const o=patchCands(n,clues[i],clues,grid);
      if(!o.length) return null;
      if(o.length===1){
        const [r0,c0,h,w]=o[0];
        for(let r=r0;r<r0+h;r++)for(let c=c0;c<c0+w;c++) grid[r][c]=i;
        done.add(i); hardest=Math.max(hardest,1); moved=true; break;
      }
    }
    if(moved) continue;
    const owner={};
    for(let i=0;i<clues.length;i++){
      if(done.has(i)) continue;
      for(const [r0,c0,h,w] of patchCands(n,clues[i],clues,grid))
        for(let r=r0;r<r0+h;r++)for(let c=c0;c<c0+w;c++){
          const k=r+","+c; (owner[k]=owner[k]||new Set()).add(i);
        }
    }
    for(let r=0;r<n&&!moved;r++)for(let c=0;c<n;c++){
      if(grid[r][c]!==-1) continue;
      const set=owner[r+","+c];
      if(!set) return null;
      if(set.size===1){
        const i=[...set][0];
        const os=patchCands(n,clues[i],clues,grid)
          .filter(([r0,c0,h,w])=>r0<=r&&r<r0+h&&c0<=c&&c<c0+w);
        if(os.length===1){
          const [r0,c0,h,w]=os[0];
          for(let rr=r0;rr<r0+h;rr++)for(let cc=c0;cc<c0+w;cc++) grid[rr][cc]=i;
          done.add(i); hardest=Math.max(hardest,2); moved=true; break;
        }
      }
    }
    if(!moved) return null;
  }
  return hardest;
}
function makePatch(n,maxTier){
  maxTier = maxTier||2;
  for(let attempt=0;attempt<150;attempt++){
    const rects=partition(n,n,2,n+3);
    if(!rects) continue;
    const clues=rects.map(([r0,c0,h,w],i)=>({
      r:r0+((Math.random()*h)|0), c:c0+((Math.random()*w)|0),
      n:h*w, shape:shapeOf(h,w), col:PATCHCOLS[i%PATCHCOLS.length] }));
    if(countPatch(n,n,clues,2)!==1) continue;
    const t0=patchGrade(n,clues);
    if(t0===null||t0>maxTier) continue;
    const ops=[];
    clues.forEach((cl,i)=>{ ops.push([i,"n"]); ops.push([i,"s"]); });
    for(let i=ops.length-1;i>0;i--){const j=(Math.random()*(i+1))|0;[ops[i],ops[j]]=[ops[j],ops[i]];}
    const minNumbered = Math.max(2, Math.ceil(clues.length*0.4));
    for(const [i,what] of ops){
      const cl=clues[i];
      if(what==="n"&&cl.n===null) continue;
      if(what==="s"&&cl.shape===AN) continue;
      if(what==="n" && clues.filter(c=>c.n!==null).length<=minNumbered) continue;
      const keep = what==="n"?cl.n:cl.shape;
      if(what==="n") cl.n=null; else cl.shape=AN;
      const t=patchGrade(n,clues);
      if(t===null||t>maxTier||countPatch(n,n,clues,2)!==1){
        if(what==="n") cl.n=keep; else cl.shape=keep;
      }
    }
    return {n,clues,rects,tier:patchGrade(n,clues)};
  }
  return null;
}
const PATCHCOLS=["#E4572E","#17A398","#3A7CA5","#8E5572","#E8A33D","#5B8C5A",
                 "#8E5DE5","#D81E5B","#2A9D8F","#C97B27","#4361EE","#7A9E3F",
                 "#B5651D","#00798C","#6A4C93","#BC4749","#468FAF","#A47148"];
function shapeBadge(shape,label,col,px){
  const S=Math.max(24,Math.min(44, Math.round((px||60)*0.72)));
  const NS="http://www.w3.org/2000/svg";
  const svg=document.createElementNS(NS,"svg");
  svg.setAttribute("viewBox","0 0 44 44");
  svg.setAttribute("width",S); svg.setAttribute("height",S);
  svg.style.position="relative"; svg.style.zIndex="4";
  svg.style.filter="drop-shadow(0 2px 3px rgba(0,0,0,.32))";
  let el;
  if(shape===AN){
    /* clipped corners = no shape rule. Centred on 22,22 like the others,
       so the number always sits dead middle. */
    const k=8, a=22-15, b=22+15;
    el=document.createElementNS(NS,"path");
    el.setAttribute("d",
      "M"+(a+k)+" "+a+" H"+(b-k)+" L"+b+" "+(a+k)+" V"+(b-k)+" L"+(b-k)+" "+b+
      " H"+(a+k)+" L"+a+" "+(b-k)+" V"+(a+k)+" Z");
    el.setAttribute("stroke-linejoin","round"); el.setAttribute("stroke",col);
    el.setAttribute("stroke-width","3");
  } else {
    const d={square:[30,30],wide:[38,24],tall:[24,38]}[shape];
    el=document.createElementNS(NS,"rect");
    el.setAttribute("width",d[0]); el.setAttribute("height",d[1]);
    el.setAttribute("x",22-d[0]/2); el.setAttribute("y",22-d[1]/2);
    el.setAttribute("rx","6");
  }
  el.setAttribute("fill",col);
  svg.appendChild(el);
  if(label!==""&&label!==null&&label!==undefined){
    const t=document.createElementNS(NS,"text");
    t.setAttribute("x","22"); t.setAttribute("y","22");
    t.setAttribute("text-anchor","middle"); t.setAttribute("dominant-baseline","central");
    t.setAttribute("font-size","18"); t.setAttribute("font-weight","800");
    t.setAttribute("font-family","system-ui,sans-serif"); t.setAttribute("fill","#FFFFFF");
    t.textContent=label; svg.appendChild(t);
  }
  return svg;
}
function newPatch(){
  let n=size.patch; const t=performance.now();
  let p;
  if(mode==="daily"){ const b=DAILY.patch[slot()]; n=b.n; size.patch=n;
    p={n,clues:b.clues.map((c,i)=>Object.assign({},c,{col:PATCHCOLS[i%PATCHCOLS.length]})),
       rects:b.rects,tier:b.tier}; }
  else p=makePatch(n, patchLevel);
  const ms=Math.round(performance.now()-t);
  cur={n,h:n,w:n,clues:p.clues,rects:p.rects,drawn:[],
       placed:Array.from({length:n},()=>Array(n).fill(-1)),drag:null};
  const blanks=p.clues.filter(c=>c.n===null).length;
  $("#label").textContent=(mode==="daily"?dayName()+" · Plots":"Plots "+n+"×"+n)+" · level "+p.tier;
  $("#hint").textContent="Split the grid into rectangles, one badge each";
  drawPatch();
}
function clueAt(r,c){ return cur.clues.findIndex(x=>x.r===r&&x.c===c); }
function drawPatch(){
  const n=cur.w,px=cellPx(n),b=$("#board");
  b.innerHTML=""; b.className="";
  const g=document.createElement("div");
  g.className="grid airy"; g.style.gridTemplateColumns=`repeat(${n},${px}px)`;
  b.style.width=(n*px+3)+"px";
  for(let r=0;r<cur.h;r++)for(let c=0;c<n;c++){
    const key=r+","+c, pi=cur.placed[r][c];
    const d=document.createElement("div");
    d.className="cell"+(errs.has(key)?" err":"")+(area.has(key)?" area":"")+(tips.has(key)?" tip":"");
    d.style.height=px+"px"; d.dataset.r=r; d.dataset.c=c;
    if(pi>=0){
      const owner=cur.drawn[pi][4];
      d.style.background=cur.clues[owner].col+"33";
    }
    edgeStyle(d,key,area); animate(d,r,c,key);
    const ci=clueAt(r,c);
    if(ci>=0){ const cl=cur.clues[ci]; d.appendChild(shapeBadge(cl.shape, cl.n===null?"":cl.n, cl.col, px)); }
    g.appendChild(d);
  }
  b.appendChild(g);
  cur.drawn.forEach((R)=>{
    if(!R[2]) return;
    const [r0,c0,h,w,owner]=R;
    const el=document.createElement("div");
    el.className="rect"+(cur.freshRect===cur.drawn.indexOf(R)?" fresh":"");
    el.style.borderColor=cur.clues[owner].col;
    el.style.left=(c0*(px+2)+2)+"px"; el.style.top=(r0*(px+2)+2)+"px";
    el.style.width=(w*px+(w-1)*2)+"px"; el.style.height=(h*px+(h-1)*2)+"px";
    b.appendChild(el);
  });
  if(cur.drag&&cur.drag.cur){
    const [r1,c1]=cur.drag.start,[r2,c2]=cur.drag.cur;
    const r0=Math.min(r1,r2),c0=Math.min(c1,c2),h=Math.abs(r1-r2)+1,w=Math.abs(c1-c2)+1;
    const el=document.createElement("div"); el.className="sel";
    el.style.left=(c0*(px+2)+2)+"px"; el.style.top=(r0*(px+2)+2)+"px";
    el.style.width=(w*px+(w-1)*2)+"px"; el.style.height=(h*px+(h-1)*2)+"px";
    b.appendChild(el);
  }
}
function flashErr(){ drawPatch(); shakeBoard(String(Math.random())); setTimeout(()=>{clearErrors(); drawPatch();},1300); }
function commitRect(r1,c1,r2,c2){
  const r0=Math.min(r1,r2),c0=Math.min(c1,c2);
  const h=Math.abs(r1-r2)+1,w=Math.abs(c1-c2)+1;
  const cells=[]; for(let r=r0;r<r0+h;r++)for(let c=c0;c<c0+w;c++) cells.push([r,c]);
  const overlap=cells.filter(([r,c])=>cur.placed[r][c]>=0);
  if(overlap.length){ errs=new Set(overlap.map(x=>x.join(","))); area=new Set(cells.map(x=>x.join(",")));
    setMsg("That overlaps a rectangle already on the board.","err"); return flashErr(); }
  area=new Set(cells.map(x=>x.join(",")));
  const inside=cells.map(([r,c])=>clueAt(r,c)).filter(i=>i>=0);
  if(inside.length===0){ setMsg("A rectangle must hold one clue.","err"); return flashErr(); }
  if(inside.length>1){ setMsg("That covers "+inside.length+" clues — one per rectangle.","err"); return flashErr(); }
  const cl=cur.clues[inside[0]];
  if(cl.n!==null&&h*w!==cl.n){ setMsg("That's "+(h*w)+" squares — the clue says "+cl.n+".","err"); return flashErr(); }
  if(cl.shape!==AN&&shapeOf(h,w)!==cl.shape){
    setMsg("That's "+shapeOf(h,w)+" — the badge says "+cl.shape+".","err"); return flashErr(); }
  const idx=cur.drawn.length;
  cur.freshRect=idx;
  cur.drawn.push([r0,c0,h,w,inside[0]]);
  cells.forEach(([r,c])=>{ cur.placed[r][c]=idx; });
  clearErrors(); drawPatch(); checkPatch();
}
function checkPatch(){
  let empty=0;
  for(let r=0;r<cur.h;r++)for(let c=0;c<cur.w;c++) if(cur.placed[r][c]<0) empty++;
  if(empty===0){ if(!solved){ solved=true; setMsg(winLine()); celebrate(); } }
  else setMsg(empty+" squares left.");
}
function hintPatch(){
  for(const [r0,c0,h,w] of cur.rects){
    let free=true;
    for(let r=r0;r<r0+h&&free;r++)for(let c=c0;c<c0+w;c++) if(cur.placed[r][c]>=0){ free=false; break; }
    if(!free) continue;
    let owner=-1;
    for(let r=r0;r<r0+h;r++)for(let c=c0;c<c0+w;c++){ const ci=clueAt(r,c); if(ci>=0) owner=ci; }
    const idx=cur.drawn.length;
    cur.freshRect=idx;
    cur.drawn.push([r0,c0,h,w,owner]);
    const cells=[];
    for(let r=r0;r<r0+h;r++)for(let c=c0;c<c0+w;c++){ cur.placed[r][c]=idx; cells.push(r+","+c); }
    tips=new Set(cells); clearErrors();
    setMsg("Drew one for you.","tip"); drawPatch(); checkPatch(); return;
  }
  setMsg("A rectangle you've drawn is in the way — rub one out.","err");
}
function patchCellAt(x,y){
  const el=document.elementFromPoint(x,y); if(!el) return null;
  const c=el.closest(".cell");
  return c&&c.dataset.r!==undefined?[+c.dataset.r,+c.dataset.c]:null;
}

/* ================= INPUT ================= */
$("#board").addEventListener("pointerdown",e=>{
  if(game==="path"){
    const p=patchCellAt(e.clientX,e.clientY); if(!p) return;
    cur.drag=true; if(!rewindTo(p[0],p[1])) extend(p[0],p[1]); e.preventDefault(); return;
  }
  if(game==="patch"){
    const p=patchCellAt(e.clientX,e.clientY); if(!p) return;
    const pi=cur.placed[p[0]][p[1]];
    if(pi>=0){   // rub out a rectangle
      const R=cur.drawn[pi];
      for(let r=R[0];r<R[0]+R[2];r++)for(let c=R[1];c<R[1]+R[3];c++) cur.placed[r][c]=-1;
      cur.drawn[pi]=[0,0,0,0,-1];
      clearErrors(); setMsg(""); drawPatch(); return;
    }
    cur.drag={start:p,cur:p}; drawPatch(); e.preventDefault();
  }
});
$("#board").addEventListener("pointermove",e=>{
  if(game==="path"&&cur.drag){ const p=patchCellAt(e.clientX,e.clientY); if(p) extend(p[0],p[1]); e.preventDefault(); }
  if(game==="patch"&&cur.drag){ const p=patchCellAt(e.clientX,e.clientY);
    if(p){ cur.drag.cur=p; drawPatch(); } e.preventDefault(); }
});
window.addEventListener("pointerup",()=>{
  if(!cur) return;
  if(game==="patch"&&cur.drag){
    const {start,cur:end}=cur.drag; cur.drag=null;
    commitRect(start[0],start[1],end[0],end[1]); return;
  }
  cur.drag=false;
});


/* ================= home, settings, sound ================= */
const state={streak:0,best:0,done:{},results:{},sound:true,dark:null,stats:false,code:"—",log:[],lastDay:null,creditedDay:null};
const SAVE_KEY="quadle_v1";
let memSave=null;
function saveState(){
  const blob=JSON.stringify(state);
  memSave=blob;
  try{ localStorage.setItem(SAVE_KEY, blob); }catch(e){}
}
async function loadState(){
  let raw=null;
  try{ raw=localStorage.getItem(SAVE_KEY); }catch(e){}
  if(!raw) raw=memSave;
  if(raw){ try{ Object.assign(state, JSON.parse(raw)); }catch(e){} }
}
function makeCode(){
  const A="ABCDEFGHJKMNPQRSTUVWXYZ23456789"; let s="";
  for(let i=0;i<9;i++){ s+=A[(Math.random()*A.length)|0]; if(i%3===2&&i<8) s+="-"; }
  return s;
}
function blip(f,d,type){
  if(!state.sound) return;
  try{
    const C=window.AudioContext||window.webkitAudioContext; if(!C) return;
    window._ac=window._ac||new C();
    const ac=window._ac,o=ac.createOscillator(),g=ac.createGain();
    o.type=type||"sine"; o.frequency.value=f;
    g.gain.setValueAtTime(.05,ac.currentTime);
    g.gain.exponentialRampToValueAtTime(.0001,ac.currentTime+d);
    o.connect(g); g.connect(ac.destination); o.start(); o.stop(ac.currentTime+d);
  }catch(e){}
}
function preview(key){
  const NS="http://www.w3.org/2000/svg", col=state.dark?GAMES[key].dark:GAMES[key].col;
  const svg=document.createElementNS(NS,"svg");
  svg.setAttribute("viewBox","0 0 100 74"); svg.setAttribute("class","prev");
  const add=(t,a)=>{const e=document.createElementNS(NS,t);
    for(const k in a) e.setAttribute(k,a[k]); svg.appendChild(e); return e;};
  const G=(x,y,w,h,cols,rows)=>{
    add("rect",{x,y,width:w,height:h,rx:5,fill:"none",stroke:"var(--line)","stroke-width":"1.4"});
    for(let i=1;i<cols;i++) add("line",{x1:x+w*i/cols,y1:y,x2:x+w*i/cols,y2:y+h,
      stroke:"var(--line)","stroke-width":".9"});
    for(let i=1;i<rows;i++) add("line",{x1:x,y1:y+h*i/rows,x2:x+w,y2:y+h*i/rows,
      stroke:"var(--line)","stroke-width":".9"});
  };
  if(key==="tango"){
    G(24,5,52,64,4,4);
    const cw=13, ch=16;
    const sun=(cx,cy)=>{ add("circle",{cx,cy,r:4.2,fill:col});
      for(let i=0;i<8;i++){const a=i*Math.PI/4;
        add("line",{x1:cx+Math.cos(a)*5.6,y1:cy+Math.sin(a)*5.6,x2:cx+Math.cos(a)*7.4,
          y2:cy+Math.sin(a)*7.4,stroke:col,"stroke-width":"1.5","stroke-linecap":"round"});}};
    const star=(cx,cy)=>{let d="";for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,rr=i%2?3:7;
      d+=(i?"L":"M")+(cx+Math.cos(a)*rr).toFixed(1)+" "+(cy+Math.sin(a)*rr).toFixed(1)+" ";}
      add("path",{d:d+"Z",fill:"#4A5A72"});};
    sun(24+cw*0.5,5+ch*0.5); star(24+cw*1.5,5+ch*0.5);
    star(24+cw*0.5,5+ch*1.5); sun(24+cw*2.5,5+ch*1.5);
    sun(24+cw*1.5,5+ch*2.5); star(24+cw*3.5,5+ch*2.5);
  }
  if(key==="crown"){
    const cw=13,ch=16,x0=24,y0=5;
    const regs=[[0,0,0,1],[0,2,2,1],[3,2,1,1],[3,3,3,3]];
    const tints=["55","33","22","44"];
    for(let r=0;r<4;r++)for(let c=0;c<4;c++)
      add("rect",{x:x0+c*cw,y:y0+r*ch,width:cw,height:ch,fill:col,
        "fill-opacity":(0.12+0.09*regs[r][c]).toFixed(2)});
    G(x0,y0,52,64,4,4);
    [[1,0],[3,1],[0,2],[2,3]].forEach(([c,r])=>{
      const cx=x0+c*cw+cw/2, cy=y0+r*ch+ch/2;
      add("path",{d:"M"+(cx-5)+" "+(cy+4)+" L"+(cx-5)+" "+(cy-3)+" L"+(cx-2)+" "+cy+
        " L"+cx+" "+(cy-5)+" L"+(cx+2)+" "+cy+" L"+(cx+5)+" "+(cy-3)+" L"+(cx+5)+" "+(cy+4)+" Z",
        fill:col});
    });
  }
  if(key==="path"){
    G(24,5,52,64,4,4);
    add("polyline",{points:"30,13 56,13 56,29 43,29 43,45 69,45 69,61 30,61",
      fill:"none",stroke:col,"stroke-width":"5","stroke-linecap":"round","stroke-linejoin":"round",
      "stroke-opacity":".9"});
    [[30,13],[69,45],[30,61]].forEach(([cx,cy],i)=>{
      add("circle",{cx,cy,r:6,fill:"var(--surface)",stroke:col,"stroke-width":"2"});
      const t=add("text",{x:cx,y:cy+.5,"text-anchor":"middle","dominant-baseline":"central",
        "font-size":"7","font-weight":"800","font-family":"system-ui",fill:col});
      t.textContent=String(i+1);
    });
  }
  if(key==="patch"){
    const R=[[24,5,26,32],[50,5,26,16],[50,21,26,16],[24,37,52,16],[24,53,26,16],[50,53,26,16]];
    R.forEach((r,i)=>add("rect",{x:r[0]+1.5,y:r[1]+1.5,width:r[2]-3,height:r[3]-3,rx:4,
      fill:col,"fill-opacity":(0.22+0.12*(i%4)).toFixed(2),stroke:col,"stroke-width":"1.4"}));
    [[37,21,"6"],[63,13,"4"],[50,45,"8"]].forEach(([x,y,n])=>{
      add("rect",{x:x-7,y:y-7,width:14,height:14,rx:3.5,fill:col});
      const t=add("text",{x,y:y+.5,"text-anchor":"middle","dominant-baseline":"central",
        "font-size":"9","font-weight":"800","font-family":"system-ui",fill:"#fff"});
      t.textContent=n;
    });
  }
  return svg;
}
const BLURB={tango:"Balance suns and stars",crown:"One crown per colour",
             path:"One line, every square",patch:"Cut the grid into plots"};
function renderHome(){
  const done=["tango","crown","path","patch"].filter(isDone).length;
  $("#streakBig").textContent=state.streak;
  $("#streakLbl").textContent = state.streak===1?"day streak":"day streak";
  $("#dayLabel").textContent = dayName()+" · board "+(slot()+1)+" of "+DAILY.days;
  $("#streakSub").textContent = done===4 ? "All four done today"
                              : done ? done+" of 4 done today" : "Nothing played today";
  const dots=$("#streakDots"); dots.innerHTML="";
  ["M","T","W","T","F","S","S"].forEach((d,i)=>{
    const el=document.createElement("i");
    el.textContent=d;
    if(i < Math.min(state.streak,7)) el.className="on";
    dots.appendChild(el);
  });
  const wrap=$("#cards"); wrap.innerHTML="";
  for(const key of ["tango","crown","path","patch"]){
    const g=GAMES[key];
    const card=document.createElement("div");
    card.className="gcard"+(isDone(key)?" done":"");
    card.style.setProperty("--gcol", state.dark? g.dark : g.col);
    card.appendChild(preview(key));
    const nm=document.createElement("div"); nm.className="gname"; nm.textContent=g.name;
    const sb=document.createElement("div"); sb.className="gsub"; sb.textContent=BLURB[key];
    const tk=document.createElement("div"); tk.className="gtick"; tk.textContent="✓";
    card.append(nm,sb,tk);
    card.onclick=()=>{ blip(660,.07,"triangle"); openGame(key,"daily"); };
    wrap.appendChild(card);
  }
}
function markSolved(){
  const s=((Date.now()-t0)/1000)|0;
  logStop(true);
  if(mode!=="daily") return;                 // practice never touches the streak
  state.results=state.results||{};
  state.results[game]=((s/60)|0)+":"+String(s%60).padStart(2,"0");
  if(state.done[game]) return;
  state.done[game]=true;
  if(allDone() && state.creditedDay!==todayIndex()){
    state.creditedDay=todayIndex();
    state.lastCompleted=todayIndex();
    state.streak++; state.best=Math.max(state.best,state.streak);
  }
  saveState();
}
/* settings */
$("#openSet").onclick=()=>{ $("#setWrap").hidden=false; blip(520,.06); };
$("#closeSet").onclick=()=>{ $("#setWrap").hidden=true; };
$("#setWrap").addEventListener("click",e=>{ if(e.target.id==="setWrap") $("#setWrap").hidden=true; });
$("#optDark").onchange=e=>{
  state.dark=e.target.checked; state.darkChosen=true; saveState();
  document.getElementById("root").toggleAttribute("data-dark", state.dark);
  theme();
  if(!$("#play").hidden) redraw();
};
$("#optSound").onchange=e=>{ state.sound=e.target.checked; saveState(); if(state.sound) blip(700,.07); };
$("#optMotion").onchange=e=>{
  state.motion=e.target.checked; saveState();
  document.getElementById("root").classList.toggle("nomotion", !state.motion);
};
$("#optPat").onchange=e=>{ showPat=e.target.checked; syncPat(); if(!$("#play").hidden) redraw(); };
function syncPat(){
  $("#optPat").checked=showPat;
  $("#cbBtn").textContent = showPat ? "Pattern on" : "Pattern";
}
$("#optStats").onchange=e=>{ state.stats=e.target.checked; saveState();
  toast(state.stats?"Thanks — only stop points are recorded":"Turned off"); };
$("#copyCode").onclick=async()=>{
  try{ await navigator.clipboard.writeText(state.code); toast("Backup code copied"); }
  catch(e){ toast("Couldn't copy — write it down instead"); }
};
$("#restoreCode").onclick=()=>{
  const v=prompt("Enter a backup code from your old phone:");
  if(!v) return;
  if(!/^[A-Z0-9]{3}-[A-Z0-9]{3}-[A-Z0-9]{3}$/.test(v.trim().toUpperCase()))
    return toast("That doesn't look like a backup code");
  toast("In the real app this pulls your streak back from the cloud");
};
$("#shareBtn").onclick=()=>{ blip(600,.07,"triangle"); openShare(); };
$("#practiceBtn").onclick=()=>{
  const panel=document.createElement("div"); panel.id="setWrap";
  panel.innerHTML='<div class="panel"><div class="panelhead"><h2>Practice</h2>'+
    '<button class="icon" id="closeP">✕</button></div>'+
    '<p class="pnote">Endless boards, any size, any level. Nothing here counts '+
    'toward your streak — today\'s four are separate.</p><div id="pcards"></div></div>';
  document.getElementById("root").appendChild(panel);
  panel.querySelector("#closeP").onclick=()=>panel.remove();
  panel.onclick=e=>{ if(e.target===panel) panel.remove(); };
  const w=panel.querySelector("#pcards");
  for(const k of ["tango","crown","path","patch"]){
    const b=document.createElement("button");
    b.className="ghost"; b.style.width="100%"; b.style.marginTop="8px";
    b.textContent=GAMES[k].name;
    b.onclick=()=>{ panel.remove(); openGame(k,"practice"); };
    w.appendChild(b);
  }
};

function panel(title, build){
  const p=document.createElement("div"); p.id="setWrap";
  p.innerHTML='<div class="panel"><div class="panelhead"><h2></h2>'+
    '<button class="icon">✕</button></div><div class="pbody"></div></div>';
  p.querySelector("h2").textContent=title;
  p.querySelector(".icon").onclick=()=>p.remove();
  p.onclick=e=>{ if(e.target===p) p.remove(); };
  document.getElementById("root").appendChild(p);
  build(p.querySelector(".pbody"), p);
  return p;
}
$("#openArchive").onclick=()=>{
  const today=todayIndex();
  if(today<1) return toast("Nothing in the archive yet — come back tomorrow.");
  panel("Archive", (body,p)=>{
    const note=document.createElement("p"); note.className="pnote";
    note.textContent="Every past day, exactly as it was. Playing these does not change your streak.";
    body.appendChild(note);
    const first=Math.max(0, today-60);
    for(let d=today-1; d>=first; d--){
      const row=document.createElement("button");
      row.className="ghost"; row.style.width="100%"; row.style.marginTop="7px";
      row.style.textAlign="left";
      const dt=new Date(Date.UTC(2026,8,7)+d*86400000);
      row.textContent = dt.toLocaleDateString(undefined,{weekday:"short",day:"numeric",month:"short"})
                        + "  ·  board " + (d+1);
      row.onclick=()=>{ p.remove(); pickGameFor(d); };
      body.appendChild(row);
    }
  });
};
function pickGameFor(day){
  panel("Pick a puzzle", (body,p)=>{
    for(const k of ["tango","crown","path","patch"]){
      const b=document.createElement("button");
      b.className="ghost"; b.style.width="100%"; b.style.marginTop="8px";
      b.textContent=GAMES[k].name;
      b.onclick=()=>{ p.remove(); archiveDay=day; openGame(k,"archive"); };
      body.appendChild(b);
    }
  });
}



/* ================= DAILY =================
   One board per game per day, the same board for everyone. Boards are baked
   into the app, so this works with no server and no internet. The date on the
   phone picks the board; nothing is fetched or synced. */
const EPOCH = Date.UTC(2026,8,7);            // a Monday, so index%7===0 is Monday
let mode="daily", dayOffset=0, archiveDay=null;
function todayIndex(){
  const now=new Date();
  const local=Date.UTC(now.getFullYear(),now.getMonth(),now.getDate());
  return Math.max(0, Math.floor((local-EPOCH)/86400000)) + dayOffset;
}
function slot(){
  const i = (mode==="archive" && archiveDay!==null) ? archiveDay : todayIndex();
  return ((i%DAILY.days)+DAILY.days)%DAILY.days;
}
const DAYNAMES=["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
function dayName(){ return DAYNAMES[slot()%7]; }
function isDone(g){ return !!(state.done && state.done[g]); }
function allDone(){ return ["tango","crown","path","patch"].every(isDone); }

function rollOverDay(){
  const t=todayIndex();
  if(state.lastDay===t) return;
  // A streak is a run of days where all four were finished. Miss one and it
  // goes back to zero. Finishing yesterday and playing today keeps it alive.
  if(state.lastCompleted===null || state.lastCompleted===undefined) state.streak=0;
  else if(t - state.lastCompleted > 1) state.streak=0;
  state.lastDay=t; state.done={}; state.results={};
  saveState();
}


/* ================= how to play ================= */
const RULES={
  tango:{title:"Suns",lines:[
    "Fill every square with a sun or a star.",
    "Each row and each column needs the same number of suns as stars.",
    "Never three of the same in a row, across or down.",
    "= between two squares means they must match.",
    "× between two squares means they must differ.",
    "Tap a square to cycle: empty → sun → star."]},
  crown:{title:"Crowns",lines:[
    "Place one crown in every row, every column, and every colour.",
    "No two crowns may touch — not even diagonally at a corner.",
    "Tap a square to cycle: empty → dot → crown.",
    "Use dots to mark squares you have ruled out.",
    "Turn on Pattern if the colours are hard to tell apart."]},
  path:{title:"Path",lines:[
    "Draw one unbroken line that covers every square.",
    "It must pass through the numbers in order, 1 then 2 then 3.",
    "Drag from the 1 to start.",
    "Tap any square already on the line to jump back to it."]},
  patch:{title:"Plots",lines:[
    "Split the whole grid into rectangles, no gaps and no overlaps.",
    "Each rectangle holds exactly one badge.",
    "The number is how many squares that rectangle covers.",
    "The badge shape is the shape it must be: square, wide, or tall.",
    "A badge with clipped corners means any shape will do.",
    "A badge with no number means you work the size out yourself.",
    "Drag across the board to draw. Tap a rectangle to rub it out."]}
};
function showRules(){
  const r=RULES[game];
  panel("How to play · "+r.title, body=>{
    const ul=document.createElement("ul"); ul.className="rules";
    r.lines.forEach(t=>{ const li=document.createElement("li"); li.textContent=t; ul.appendChild(li); });
    body.appendChild(ul);
  });
}

/* ================= toast ================= */
function toast(msg){
  const old=document.getElementById("toast"); if(old) old.remove();
  const t=document.createElement("div"); t.id="toast"; t.textContent=msg;
  document.getElementById("root").appendChild(t);
  setTimeout(()=>{ t.remove(); }, 2200);
}

/* ================= the one measurement that matters =================
   Decant shipped without this and never learned where players gave up.
   Records only: which game, which size, which level, and whether the board
   was finished or abandoned. Off until the player turns it on. */
function logStop(finished){
  if(!state.stats || !cur) return;
  const row={g:game, size:size[game], lvl:(cur.tier!==undefined?cur.tier:null),
             sec:((Date.now()-t0)/1000)|0, done:!!finished,
             hints:cur.hintsUsed||0, d:new Date().toISOString().slice(0,10)};
  state.log=(state.log||[]); state.log.push(row);
  if(state.log.length>400) state.log=state.log.slice(-400);
  saveState();
}

/* ================= share card ================= */
const SQUARES={tango:"🟨",crown:"🟪",path:"🟦",patch:"🟥"};
function shareText(){
  const day=todayIndex()+1;
  let out="Quadle #"+day+"\n";
  for(const k of ["tango","crown","path","patch"]){
    const r=(state.results||{})[k];
    out += SQUARES[k]+" "+GAMES[k].name.padEnd(7," ")+" "+(r? r : "—")+"\n";
  }
  out += "\n🔥 "+state.streak+" day streak";
  return out;
}
function openShare(){
  const panel=document.createElement("div"); panel.id="setWrap";
  panel.innerHTML='<div class="panel"><div class="panelhead"><h2>Today</h2>'+
    '<button class="icon" id="closeShare">✕</button></div>'+
    '<div id="shareCard"></div>'+
    '<div class="minirow"><button class="ghost sm" id="copyShare">Copy result</button></div></div>';
  document.getElementById("root").appendChild(panel);
  panel.querySelector("#shareCard").textContent=shareText();
  panel.querySelector("#closeShare").onclick=()=>panel.remove();
  panel.onclick=e=>{ if(e.target===panel) panel.remove(); };
  panel.querySelector("#copyShare").onclick=async()=>{
    try{ await navigator.clipboard.writeText(shareText()); toast("Result copied"); }
    catch(e){ toast("Couldn't copy — select the text instead"); }
  };
}

/* ================= WIRING ================= */
function newPuzzle(){
  solved=false; clearErrors(); tips=new Set(); setMsg(""); clearTimeout(errTimer);
  $("#board").innerHTML=""; $("#board").className="";
  theme();
  entering=true; touched=null; winning=false; shookFor="";
  ({tango:newTango,crown:newCrown,path:newPath,patch:newPatch})[game]();
  if(cur) cur.hintsUsed=0;
  paintHintBtn();
  setTimeout(()=>{ entering=false; }, 60+ (size[game]||6)*2*22);
  startTimer();
}
function resetPuzzle(){
  if(!cur) return;
  solved=false; clearErrors(); tips=new Set(); setMsg(""); clearTimeout(errTimer);
  if(game==="tango") cur.state=cur.puzzle.map(r=>r.slice());
  if(game==="crown") cur.marks=Array.from({length:cur.n},()=>Array(cur.n).fill(0));
  if(game==="path")  cur.path=[];
  if(game==="patch"){ cur.drawn=[]; cur.placed=Array.from({length:cur.n},()=>Array(cur.n).fill(-1)); }
  entering=true; touched=null; winning=false; shookFor="";
  startTimer(); redraw();
  setTimeout(()=>{ entering=false; }, 60+(size[game]||6)*2*22);
}
const HINT_BUDGET=3;
function openGame(g,m){
  game=g; mode=m||"daily"; theme();
  $("#home").hidden=true; $("#play").hidden=false;
  const fixed = (mode!=="practice");
  $("#newBtn").hidden=fixed; $("#sizeBtn").hidden=fixed;
  $("#cbBtn").hidden = (g!=="crown");
  $("#modeTag").textContent = mode==="daily" ? "Today" : (mode==="archive" ? "Archive" : "Practice");
  $("#modeTag").className = mode==="daily" ? "tag" : "tag alt";
  newPuzzle();
  if(mode==="daily" && isDone(game)) lockDone();
}
function hintsLeft(){
  if(mode==="practice") return Infinity;
  return Math.max(0, HINT_BUDGET - (cur && cur.hintsUsed || 0));
}
function paintHintBtn(){
  const b=$("#hintBtn");
  const n=hintsLeft();
  b.textContent = (n===Infinity) ? "Hint" : "Hint ("+n+")";
  b.disabled = solved || n===0;
}
function lockDone(){
  solved=true;
  setMsg("Done for today. Come back tomorrow — or try Practice.");
  paintHintBtn();
}
function goHome(){
  $("#play").hidden=true; $("#home").hidden=false;
  theme(); renderHome();
}
$("#backBtn").onclick=()=>{ if(!solved) logStop(false); goHome(); };
$("#helpBtn").onclick=showRules;
$("#newBtn").onclick=newPuzzle;
$("#resetBtn").onclick=resetPuzzle;
$("#hintBtn").onclick=()=>{
  if(solved) return;
  if(hintsLeft()===0){ toast("No hints left on today's board."); return; }
  if(cur) cur.hintsUsed=(cur.hintsUsed||0)+1;
  ({tango:hintTango,crown:hintCrown,path:hintPath,patch:hintPatch})[game]();
  paintHintBtn();
};
$("#sizeBtn").onclick=()=>{
  if(game==="tango") size.tango = size.tango===6?8:6;
  if(game==="crown") size.crown = size.crown===6?7:(size.crown===7?8:6);
  if(game==="path")  size.path  = size.path===5?6:5;
  if(game==="patch") size.patch = size.patch===5?6:(size.patch===6?7:5);
  newPuzzle();
};
$("#cbBtn").onclick=()=>{ showPat=!showPat; syncPat(); if(game==="crown") drawCrown(); };
window.addEventListener("resize",()=>{ if(cur) redraw(); });
(async function boot(){
  try{
    const [b,d]=await Promise.all([
      fetch("data/practice-boards.json").then(r=>r.json()),
      fetch("data/daily-boards.json").then(r=>r.json())
    ]);
    BOARDS=b; DAILY=d;
  }catch(e){
    document.getElementById("root").innerHTML=
      '<p style="padding:40px;text-align:center;font:600 14px system-ui;color:#5d6b7c">'+
      'Could not load the puzzles. Refresh once while online.</p>';
    return;
  }
  await loadState();
  if(state.darkChosen!==true){
    try{ state.dark = window.matchMedia("(prefers-color-scheme: dark)").matches; }catch(e){}
  }
  if(!state.code||state.code==="—") { state.code=makeCode(); saveState(); }
  $("#backupCode").textContent=state.code;
  if(state.dark===null||state.dark===undefined){
    state.dark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  }
  $("#optDark").checked=state.dark;
  $("#optSound").checked=state.sound;
  $("#optStats").checked=!!state.stats;
  $("#optMotion").checked = state.motion!==false;
  document.getElementById("root").classList.toggle("nomotion", state.motion===false);
  document.getElementById("root").toggleAttribute("data-dark", state.dark);
  rollOverDay();
  theme(); renderHome();
})();
})();
