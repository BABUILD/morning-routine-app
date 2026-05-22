"use client";

import { useState, useEffect, useRef } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// STATIC DATA
// ─────────────────────────────────────────────────────────────────────────────
const DEFAULT_COLORS = {
  "寝室":"#dbeafe","洗面所":"#e0f2fe","トイレ":"#e5e7eb","寝室／脱衣所":"#ede9fe",
  "キッチン":"#ffedd5","ベランダ":"#dcfce7","外／室内":"#ecfccb","風呂場":"#ccfbf1",
  "浴室":"#ccfbf1","脱衣所":"#ede9fe","室内":"#fef9c3",
  "リビング":"#fef3c7","ダイニング":"#fefce8","デスク":"#e0e7ff",
};
const LOC_TEXT = {
  "寝室":"#1e40af","洗面所":"#0369a1","トイレ":"#374151","寝室／脱衣所":"#5b21b6",
  "キッチン":"#c2410c","ベランダ":"#15803d","外／室内":"#3f6212","風呂場":"#0f766e",
  "浴室":"#0f766e","脱衣所":"#5b21b6","室内":"#92400e",
  "リビング":"#92400e","ダイニング":"#a16207","デスク":"#3730a3",
};

// ── Routine A (通常) ──
const INIT_ITEMS_A = [
  {id:"a1", time:"5:05〜6:00", location:"寝室",         label:"5:05に起床する"},
  {id:"a2", time:"5:05〜6:00", location:"寝室",         label:"スマホを触らない"},
  {id:"a3", time:"5:05〜6:00", location:"洗面所",       label:"歯磨き"},
  {id:"a4", time:"5:05〜6:00", location:"洗面所",       label:"顔洗い"},
  {id:"a5", time:"5:05〜6:00", location:"洗面所",       label:"軽く保湿"},
  {id:"a6", time:"5:05〜6:00", location:"トイレ",       label:"トイレ"},
  {id:"a7", time:"5:05〜6:00", location:"寝室／脱衣所", label:"運動着に着替える"},
  {id:"a8", time:"5:05〜6:00", location:"キッチン",     label:"水を飲む"},
  {id:"a9", time:"5:05〜6:00", location:"キッチン",     label:"サプリを飲む"},
  {id:"a10",time:"5:05〜6:00", location:"ベランダ",     label:"天気を確認する"},
  {id:"a11",time:"5:05〜6:00", location:"ベランダ",     label:"外気を吸う"},
  {id:"a12",time:"5:05〜6:00", location:"外／室内",     label:"晴れ：散歩 or 軽いラン"},
  {id:"a13",time:"5:05〜6:00", location:"外／室内",     label:"雨：ストレッチ・体幹・自重・ダンベル"},
  {id:"a14",time:"5:05〜6:00", location:"外／室内",     label:"6:00までに帰宅／運動終了"},
  {id:"a15",time:"6:00〜6:20", location:"風呂場",       label:"6:00にシャワー開始", anchor:true},
  {id:"a16",time:"6:00〜6:20", location:"風呂場",       label:"シャワー"},
  {id:"a17",time:"6:00〜6:20", location:"風呂場",       label:"シャワー中に軽く掃除"},
  {id:"a18",time:"6:00〜6:20", location:"風呂場",       label:"シャワー中に歯磨き"},
  {id:"a19",time:"6:00〜6:20", location:"風呂場",       label:"鼻毛処理"},
  {id:"a20",time:"6:00〜6:20", location:"風呂場",       label:"顔剃り"},
  {id:"a21",time:"6:00〜6:20", location:"風呂場",       label:"髭剃り"},
  {id:"a22",time:"6:20〜6:30", location:"洗面所",       label:"スキンケア"},
  {id:"a23",time:"6:20〜6:30", location:"洗面所",       label:"身だしなみを整える"},
  {id:"a24",time:"6:30〜6:40", location:"リビング",     label:"日めくりカレンダーをめくる"},
  {id:"a25",time:"6:30〜6:40", location:"リビング",     label:"お香を焚く"},
  {id:"a26",time:"6:30〜6:40", location:"リビング",     label:"軽く部屋を整える"},
  {id:"a27",time:"6:40〜6:55", location:"キッチン",     label:"朝食を作る"},
  {id:"a28",time:"6:40〜6:55", location:"キッチン",     label:"スムージーを作る"},
  {id:"a29",time:"6:40〜6:55", location:"ダイニング",   label:"朝食をとる"},
  {id:"a30",time:"7:00〜",     location:"デスク",       label:"7:00に机に座る", anchor:true},
  {id:"a31",time:"7:00〜",     location:"デスク",       label:"AIに10分触る"},
  {id:"a32",time:"7:00〜",     location:"デスク",       label:"SNS発信 or 投稿メモを作る"},
  {id:"a33",time:"7:00〜",     location:"デスク",       label:"集中作業に入る"},
];

// ── Routine B (バックアップ) ──
const INIT_ITEMS_B = [
  {id:"b1", time:"起床直後",   location:"浴室",         label:"起床後すぐシャワーを浴びる", anchor:true},
  {id:"b2", time:"起床直後",   location:"浴室",         label:"シャワー中に歯磨き"},
  {id:"b4", time:"起床直後",   location:"浴室",         label:"シャワー中に軽く掃除"},
  {id:"b5", time:"起床直後",   location:"浴室",         label:"必要なら髭剃り・顔剃り・鼻毛処理"},
  {id:"b7", time:"シャワー後", location:"洗面所",       label:"スキンケア"},
  {id:"b8", time:"シャワー後", location:"洗面所",       label:"身だしなみを整える"},
  {id:"b9", time:"シャワー後", location:"寝室／脱衣所", label:"着替える"},
  {id:"b10",time:"シャワー後", location:"キッチン",     label:"水を飲む"},
  {id:"b11",time:"シャワー後", location:"キッチン",     label:"サプリを飲む"},
  {id:"b12",time:"シャワー後", location:"ベランダ",     label:"天気を確認する"},
  {id:"b13",time:"シャワー後", location:"ベランダ",     label:"外気を吸う"},
  {id:"b14",time:"立て直し",   location:"室内",         label:"余裕があれば5分だけストレッチ"},
  {id:"b15",time:"立て直し",   location:"室内",         label:"日めくりカレンダーをめくる"},
  {id:"b16",time:"立て直し",   location:"室内",         label:"お香を焚く"},
  {id:"b17",time:"立て直し",   location:"キッチン",     label:"朝食・スムージーを作る"},
  {id:"b18",time:"7:00〜",     location:"デスク",       label:"7:00に机に座る", anchor:true},
  {id:"b19",time:"7:00〜",     location:"デスク",       label:"AIに10分触る"},
  {id:"b20",time:"7:00〜",     location:"デスク",       label:"SNS発信 or 投稿メモを作る"},
  {id:"b21",time:"7:00〜",     location:"デスク",       label:"集中作業に入る"},
];

const TIME_GROUPS_A = ["5:05〜6:00","6:00〜6:20","6:20〜6:30","6:30〜6:40","6:40〜6:55","7:00〜"];
const TIME_LABELS_A = {
  "5:05〜6:00":"起床・準備・運動","6:00〜6:20":"シャワー・清潔",
  "6:20〜6:30":"身だしなみ","6:30〜6:40":"空間・気持ちの準備",
  "6:40〜6:55":"食事","7:00〜":"仕事スタート",
};
const TIME_GROUPS_B = ["起床直後","シャワー後","立て直し","7:00〜"];
const TIME_LABELS_B = {
  "起床直後":"シャワー〜清潔","シャワー後":"身だしなみ・準備",
  "立て直し":"気持ちの準備","7:00〜":"仕事スタート",
};

const ANCHORS_A = [
  {id:"wakeup", time:"5:05", label:"起きる",           emoji:"👁"},
  {id:"a15",    time:"6:00", label:"シャワーを開始する", emoji:"🚿"},
  {id:"a30",    time:"7:00", label:"机に座る",          emoji:"💻"},
];
const ANCHORS_B = [
  {id:"wakeup", time:"起床", label:"WAKEUPする",    emoji:"👁"},
  {id:"b1",     time:"即",   label:"シャワーを浴びる", emoji:"🚿"},
  {id:"b18",    time:"7:00", label:"机に座る",       emoji:"💻"},
];

const WD = ["日","月","火","水","木","金","土"];
const TODAY = () => new Date().toLocaleDateString("ja-JP");

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const rgb = h => {
  if (!h||h.length<7) return "200,200,200";
  return parseInt(h.slice(1,3),16)+","+parseInt(h.slice(3,5),16)+","+parseInt(h.slice(5,7),16);
};
const darken = (h,a=40) => {
  if (!h||h.length<7) return "#aaa";
  const c=v=>Math.max(0,Math.min(255,v));
  return "#"+[c(parseInt(h.slice(1,3),16)-a),c(parseInt(h.slice(3,5),16)-a),c(parseInt(h.slice(5,7),16)-a)].map(x=>x.toString(16).padStart(2,"0")).join("");
};
const uid = () => Date.now().toString(36)+Math.random().toString(36).slice(2);
const fmt = d => d.getHours().toString().padStart(2,"0")+":"+d.getMinutes().toString().padStart(2,"0");
const loadHist = () => { try{return JSON.parse(localStorage.getItem("mbr_hist")||"{}");}catch{return{};} };
const saveHist = (k,v) => {
  const h=loadHist(); h[k]=v;
  const keys=Object.keys(h).sort();
  if(keys.length>90) delete h[keys[0]];
  localStorage.setItem("mbr_hist",JSON.stringify(h));
};


// ─────────────────────────────────────────────────────────────────────────────
// NOTION
// ─────────────────────────────────────────────────────────────────────────────
async function pushToNotion({apiKey,dbId,payload}) {
  const res=await fetch("https://api.notion.com/v1/pages",{method:"POST",headers:{"Authorization":"Bearer "+apiKey,"Content-Type":"application/json","Notion-Version":"2022-06-28"},
    body:JSON.stringify({parent:{database_id:dbId},properties:{
      "日付":{date:{start:new Date().toISOString().slice(0,10)}},
      "達成率":{number:payload.progress},"完了数":{number:payload.checkedCount},
      "全項目数":{number:payload.totalItems},"アンカー達成":{number:payload.anchorCount},
      "起床時刻":{rich_text:[{text:{content:payload.wakeupTime||"未記録"}}]},
      "ルーティン種別":{rich_text:[{text:{content:payload.routineType==="B"?"B バックアップルーティン":"A 通常ルーティン"}}]},
      "ノート":{rich_text:[{text:{content:payload.note||""}}]},
    }})});
  if(!res.ok){const e=await res.json().catch(()=>({}));throw new Error(e.message||"HTTP "+res.status);}
  return res.json();
}

// ─────────────────────────────────────────────────────────────────────────────
// EYE CHARACTER
// ─────────────────────────────────────────────────────────────────────────────
function EyeChar({isDone,holding,holdPct}) {
  const irisCol = isDone?"#f97316":holding?"#16a34a":"#3b82f6";
  const glowCol = isDone?"#fb923c":holding?"#4ade80":"#60a5fa";
  const scleraC = isDone?"#fff7ed":holding?"#f0fdf4":"#eff6ff";
  const lashCol = isDone?"#c2410c":holding?"#15803d":"#1d4ed8";
  const ringR=54, circum=2*Math.PI*ringR;
  return (
    <svg width="160" height="160" viewBox="0 0 160 160" style={{overflow:"visible"}}>
      <defs>
        <radialGradient id="eg" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={glowCol} stopOpacity="0.55"/>
          <stop offset="100%" stopColor={glowCol} stopOpacity="0"/>
        </radialGradient>
        <radialGradient id="ei" cx="30%" cy="28%" r="65%">
          <stop offset="0%" stopColor="white" stopOpacity="0.35"/>
          <stop offset="100%" stopColor={irisCol}/>
        </radialGradient>
        <filter id="eb"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>
      <ellipse cx="80" cy="80" rx="74" ry="74" fill="url(#eg)" style={{animation:"mbr-glow-pulse 3.5s ease-in-out infinite"}}/>
      <ellipse cx="80" cy="150" rx="38" ry="6" fill="rgba(0,0,0,0.07)"/>
      <path d="M6,80 Q80,12 154,80 Q80,148 6,80 Z" fill={scleraC} filter="url(#eb)"
        style={{animation:!isDone?"mbr-eye-blink 5s ease-in-out infinite":"none",transformOrigin:"80px 80px",transformBox:"fill-box"}}/>
      <circle cx="80" cy="80" r="30" fill="url(#ei)"
        style={{filter:"drop-shadow(0 0 6px "+glowCol+")",animation:!isDone?"mbr-iris-in 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards":"none",transformOrigin:"80px 80px",transformBox:"fill-box"}}/>
      <circle cx="80" cy="80" r="22" fill="none" stroke={irisCol} strokeWidth="1" opacity="0.25"/>
      <circle cx="80" cy="80" r="14" fill="none" stroke={irisCol} strokeWidth="0.5" opacity="0.15"/>
      <circle cx={holding?77:80} cy={isDone?77:80} r="13" fill="#0f172a"/>
      <circle cx={holding?84:88} cy={isDone?71:72} r="6" fill="white" opacity="0.85"/>
      <circle cx={holding?74:72} cy={isDone?84:87} r="3" fill="white" opacity="0.45"/>
      {holding&&<line x1="52" y1="80" x2="108" y2="80" stroke={irisCol} strokeWidth="1.5" opacity="0.4"
        style={{animation:"mbr-scan 1.4s ease-in-out infinite",transformOrigin:"80px 80px",transformBox:"fill-box"}}/>}
      {[-36,-18,0,18,36].map((o,i)=>{
        const r=(o-90)*Math.PI/180;
        return <line key={i} x1={80+Math.cos(r)*32} y1={80+Math.sin(r)*18} x2={80+Math.cos(r)*44} y2={80+Math.sin(r)*25}
          stroke={lashCol} strokeWidth="2" strokeLinecap="round"
          style={{animation:!isDone?"mbr-eye-blink 5s ease-in-out infinite":"none",transformOrigin:"80px 80px",transformBox:"fill-box"}}/>;
      })}
      {isDone&&<path d="M63,80 L74,91 L98,62" stroke="#9a3412" strokeWidth="4.5" fill="none" strokeLinecap="round" strokeLinejoin="round" style={{filter:"drop-shadow(0 0 4px rgba(249,115,22,0.5))"}}/>}
      {/* Done: 6 subtle dot accents — no sparkle shapes, just clean dots */}
      {isDone&&[0,60,120,180,240,300].map((deg,i)=>{
        const r2=82,rad=deg*Math.PI/180,sx=80+Math.cos(rad)*r2,sy=80+Math.sin(rad)*r2;
        const dotC=["rgba(249,115,22,0.6)","rgba(251,146,60,0.4)","rgba(253,186,116,0.5)","rgba(249,115,22,0.5)","rgba(251,146,60,0.35)","rgba(253,186,116,0.45)"][i];
        return <circle key={i} cx={sx} cy={sy} r={3-i%2} fill={dotC}
          style={{animation:"mbr-glow-pulse "+(2+i*0.3)+"s ease-in-out "+(i*200)+"ms infinite"}}/>;
      })}
      {holding&&holdPct>0&&<circle cx="80" cy="80" r={ringR} fill="none" stroke={glowCol} strokeWidth="3" strokeLinecap="round"
        strokeDasharray={circum.toFixed(2)} strokeDashoffset={(circum*(1-holdPct/100)).toFixed(2)}
        transform="rotate(-90 80 80)" style={{transition:"stroke-dashoffset 0.04s linear",filter:"drop-shadow(0 0 4px "+glowCol+")"}}/>}
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// WAKEUP COMPLETION EFFECT  — Apple-quality ripple system
// Philosophy: restraint. A single luminous moment, not a fireworks show.
// Three layers only: soft radial bloom → concentric precise rings → drifting light dots
// ─────────────────────────────────────────────────────────────────────────────
function RippleExplosion({active,onDone}) {
  const [rings,  setRings]  = useState([]);
  const [bloom,  setBloom]  = useState(false);
  const [dots,   setDots]   = useState([]);
  const [launched,setLaunched]=useState(false);

  useEffect(()=>{
    if(!active||launched) return;
    setLaunched(true);

    // 1. Soft radial bloom — one single white-orange light expanding
    setBloom(true);
    setTimeout(()=>setBloom(false), 1800);

    // 2. Four concentric rings, staggered 200ms apart — thin, precise, single color
    setRings([0,1,2,3].map(i=>({id:i, delay:i*210, size:240+i*160})));
    setTimeout(()=>setRings([]), 2600);

    // 3. 16 light dots drifting cleanly outward — no rotation, no random shapes
    //    Equally spaced around a circle, uniform size, single accent color
    const angles = Array.from({length:16},(_,i)=>(i/16)*Math.PI*2);
    setDots(angles.map((a,i)=>{
      const dist = 120 + (i%3)*40;
      return {
        id:i,
        dx:(Math.cos(a)*dist).toFixed(1)+"px",
        dy:(Math.sin(a)*dist).toFixed(1)+"px",
        delay:(i*30)+"ms",
        size: i%4===0 ? 6 : i%4===1 ? 4 : i%4===2 ? 5 : 3,
        opacity: i%2===0 ? 0.9 : 0.6,
      };
    }));
    setTimeout(()=>setDots([]), 1600);

    setTimeout(()=>{ onDone(); setLaunched(false); }, 2700);
  },[active]);

  if(!active&&!rings.length&&!bloom&&!dots.length) return null;

  return (
    <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:9999,overflow:"hidden"}}>
      {/* Bloom: soft gaussian-like radial gradient, warm white → transparent */}
      {bloom&&(
        <div style={{
          position:"absolute", top:"42%", left:"50%",
          width:"90vw", height:"90vw", maxWidth:640, maxHeight:640,
          background:"radial-gradient(circle, rgba(255,247,237,0.55) 0%, rgba(253,186,116,0.18) 35%, transparent 70%)",
          animation:"mbr-bloom 1.8s cubic-bezier(0.16,1,0.3,1) forwards",
          borderRadius:"50%",
        }}/>
      )}
      {/* Rings: concentric, thin, single warm accent color */}
      {rings.map(r=>(
        <div key={r.id} style={{
          position:"absolute", top:"42%", left:"50%",
          width:r.size, height:r.size,
          border:"1.5px solid rgba(249,115,22,0.45)",
          borderRadius:"50%",
          animation:"mbr-wave 1.4s cubic-bezier(0.16,1,0.3,1) "+r.delay+"ms forwards",
        }}/>
      ))}
      {/* Dots: small, uniform, drifting cleanly — like iOS haptic visual feedback */}
      {dots.map(d=>(
        <div key={d.id} style={{
          position:"absolute", top:"42%", left:"50%",
          width:d.size, height:d.size, borderRadius:"50%",
          background:"#f97316",
          marginLeft:-d.size/2, marginTop:-d.size/2,
          opacity:d.opacity,
          animation:"mbr-drift 1.1s cubic-bezier(0.16,1,0.3,1) "+d.delay+"ms both",
          "--dx":d.dx, "--dy":d.dy,
        }}/>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// WAKEUP BUTTON
// ─────────────────────────────────────────────────────────────────────────────
function WakeupButton({wakeupTime,onWakeup}) {
  const [holding,   setHolding]   = useState(false);
  const [holdPct,   setHoldPct]   = useState(0);
  const [exploding, setExploding] = useState(false);
  const animRef=useRef(null), startRef=useRef(null);
  const isDone=!!wakeupTime;

  const startHold=()=>{
    if(isDone) return;
    setHolding(true); startRef.current=Date.now();
    animRef.current=setInterval(()=>{
      const pct=Math.min(100,(Date.now()-startRef.current)/1500*100);
      setHoldPct(pct);
      if(pct>=100){clearInterval(animRef.current);fire();}
    },16);
  };
  const cancelHold=()=>{clearInterval(animRef.current);setHolding(false);setHoldPct(0);};
  const fire=()=>{setHolding(false);setHoldPct(0);setExploding(true);onWakeup();};

  // Colors: navy(idle) → deep green(holding) → warm(done) — all desaturated, premium
  const btnBg = isDone
    ? "radial-gradient(circle at 45% 30%, #1c1917, #292524)"
    : holding
    ? "radial-gradient(circle at 45% 30%, #052e16, #14532d)"
    : "radial-gradient(circle at 45% 30%, #0f172a, #1e3a8a)";

  // Shadow: minimal, deep — no neon
  const btnShadow = isDone
    ? "0 0 0 1px rgba(249,115,22,0.3), 0 20px 60px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)"
    : holding
    ? "0 0 0 1px rgba(34,197,94,0.25), 0 20px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)"
    : "0 0 0 1px rgba(59,130,246,0.2), 0 20px 60px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.08)";

  // Hold rings: single thin ring, not three loud ones
  const ringColor = holding ? "rgba(74,222,128,0.4)" : "rgba(96,165,250,0.3)";

  return (
    <>
      <RippleExplosion active={exploding} onDone={()=>setExploding(false)}/>
      <div style={{display:"flex",flexDirection:"column",alignItems:"center",position:"relative",paddingBottom:4}}>

        {/* Single expanding ring on hold — clean, not multiple */}
        {holding && (
          <div style={{
            position:"absolute", top:"50%", left:"50%",
            width:240, height:240,
            border:"1px solid "+ringColor,
            borderRadius:"50%",
            animation:"mbr-wave 1.8s cubic-bezier(0.16,1,0.3,1) infinite",
            pointerEvents:"none",
          }}/>
        )}

        {/* Button */}
        <div
          onMouseDown={startHold} onMouseUp={cancelHold} onMouseLeave={cancelHold}
          onTouchStart={e=>{e.preventDefault();startHold();}}
          onTouchEnd={e=>{e.preventDefault();cancelHold();}}
          style={{
            width:200, height:200, borderRadius:"50%",
            background:btnBg,
            display:"flex", alignItems:"center", justifyContent:"center",
            cursor:isDone?"default":"pointer",
            userSelect:"none", WebkitTapHighlightColor:"transparent",
            boxShadow:btnShadow,
            transform:holding?"scale(0.94)":"scale(1)",
            transition:holding?"transform 0.15s cubic-bezier(0.4,0,0.2,1)":"all 0.5s cubic-bezier(0.4,0,0.2,1)",
            animation:!isDone&&!holding?"mbr-float 4s ease-in-out infinite":"none",
            position:"relative",
            // Subtle inner border for glass effect
            outline:"1px solid rgba(255,255,255,0.07)",
            outlineOffset:"-1px",
          }}
        >
          <EyeChar isDone={isDone} holding={holding} holdPct={holdPct}/>
        </div>

        {/* Label */}
        <div style={{marginTop:20,textAlign:"center"}}>
          {isDone ? (
            <div>
              <div style={{
                fontSize:11, fontWeight:600, color:"#f97316",
                letterSpacing:"0.14em", textTransform:"uppercase", opacity:0.9,
              }}>Good Morning</div>
              <div style={{
                fontSize:24, fontWeight:700, color:"#1f2937",
                marginTop:4, letterSpacing:"-0.02em",
              }}>{wakeupTime}</div>
              <div style={{fontSize:11,color:"#9ca3af",marginTop:3,letterSpacing:"0.02em"}}>起床しました</div>
            </div>
          ) : (
            <div>
              <div style={{
                fontSize:13, fontWeight:600, letterSpacing:"0.16em",
                textTransform:"uppercase",
                background:"linear-gradient(90deg,#94a3b8,#cbd5e1,#94a3b8)",
                backgroundSize:"200% auto",
                WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent",
                animation:"mbr-shimmer 3.5s linear infinite",
              }}>Wake Up</div>
              <div style={{
                fontSize:11,
                color:holding?"#86efac":"#94a3b8",
                marginTop:5,
                letterSpacing:"0.02em",
                transition:"color 0.3s ease",
              }}>
                {holding
                  ? Math.round(holdPct)+"% — そのまま"
                  : "長押し 1.5秒"}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CHECK RIPPLE  — single expanding dot ring, iOS-style tap feedback
// ─────────────────────────────────────────────────────────────────────────────
function Burst({x,y,color,onDone}) {
  useEffect(()=>{const t=setTimeout(onDone,600);return()=>clearTimeout(t);},[]);
  // 8 small dots drifting outward in a clean circle — monochromatic, no chaos
  const dots=Array.from({length:8},(_,i)=>{
    const a=(i/8)*Math.PI*2;
    const d=28+Math.floor(i/4)*8;
    return{id:i,dx:(Math.cos(a)*d).toFixed(1)+"px",dy:(Math.sin(a)*d).toFixed(1)+"px",delay:(i*18)+"ms"};
  });
  return (
    <div style={{position:"fixed",left:x,top:y,pointerEvents:"none",zIndex:9999}}>
      {/* Single expanding ring */}
      <div style={{
        position:"absolute", top:0, left:0,
        width:36, height:36, borderRadius:"50%",
        border:"1.5px solid "+color,
        marginLeft:-18, marginTop:-18,
        animation:"mbr-dot-ripple 0.55s cubic-bezier(0.16,1,0.3,1) both",
      }}/>
      {/* 8 micro dots */}
      {dots.map(d=>(
        <div key={d.id} style={{
          position:"absolute",width:3.5,height:3.5,borderRadius:"50%",
          background:color,left:-1.75,top:-1.75,
          animation:"mbr-drift 0.5s cubic-bezier(0.16,1,0.3,1) "+d.delay+" both",
          "--dx":d.dx,"--dy":d.dy,
          opacity:0.75,
        }}/>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LIVE CLOCK
// ─────────────────────────────────────────────────────────────────────────────
function LiveClock() {
  const [now,setNow]=useState(new Date());
  useEffect(()=>{const t=setInterval(()=>setNow(new Date()),1000);return()=>clearInterval(t);},[]);
  const H=now.getHours().toString().padStart(2,"0"),M=now.getMinutes().toString().padStart(2,"0"),S=now.getSeconds().toString().padStart(2,"0");
  const total=now.getHours()*60+now.getMinutes();
  const PHASES=[{from:305,to:360,label:"起床・運動フェーズ",color:"#60a5fa",bg:"#eff6ff"},{from:360,to:380,label:"シャワーフェーズ",color:"#34d399",bg:"#f0fdf4"},{from:380,to:395,label:"身だしなみフェーズ",color:"#a78bfa",bg:"#f5f3ff"},{from:395,to:415,label:"食事フェーズ",color:"#f59e0b",bg:"#fffbeb"},{from:415,to:420,label:"出発準備",color:"#f97316",bg:"#fff7ed"},{from:420,to:999,label:"仕事スタート！",color:"#8b5cf6",bg:"#faf5ff"}];
  const zone=PHASES.find(p=>total>=p.from&&total<p.to)||null;
  const nextAnch=[305,360,420].find(t=>t>total);const rem=nextAnch?nextAnch-total:null;
  return (
    <div style={{textAlign:"center"}}>
      <div style={{fontSize:52,fontWeight:800,color:"#1f2937",fontVariantNumeric:"tabular-nums",letterSpacing:"-0.05em",lineHeight:1}}>
        {H}<span style={{animation:"mbr-blink 1s step-end infinite",display:"inline-block"}}>:</span>{M}
        <span style={{fontSize:22,color:"#9ca3af",marginLeft:6,fontWeight:400}}>{S}</span>
      </div>
      {zone?(<div style={{display:"inline-flex",alignItems:"center",gap:7,marginTop:10,background:zone.bg,borderRadius:99,padding:"6px 16px"}}><div style={{width:7,height:7,borderRadius:"50%",background:zone.color,animation:"mbr-breathe 2s ease-in-out infinite"}}/><span style={{fontSize:12,color:zone.color,fontWeight:700}}>{zone.label}</span></div>):<div style={{fontSize:12,color:"#d1d5db",marginTop:10}}>ルーティーン開始前</div>}
      {rem!==null&&rem<=20&&<div style={{fontSize:11,color:"#9ca3af",marginTop:6}}>次のアンカーまで <span style={{fontWeight:700,color:"#f59e0b"}}>{rem}分</span></div>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HISTORY CHART (A/B 対応)
// ─────────────────────────────────────────────────────────────────────────────
function HistoryChart({history}) {
  const days=Array.from({length:7},(_,i)=>{
    const d=new Date();d.setDate(d.getDate()-(6-i));
    const key=d.toLocaleDateString("ja-JP");
    const entry=history[key];
    const pct=entry?(typeof entry==="number"?entry:entry.progress):null;
    const rt=entry?.routineType||null;
    return{key,wd:WD[d.getDay()],pct,rt,wt:entry?.wakeupTime||null,isToday:i===6};
  });
  let streak=0;
  for(let i=days.length-1;i>=0;i--){if(days[i].pct!==null&&days[i].pct>=50)streak++;else break;}
  const hd=days.filter(d=>d.pct!==null);
  const avg=hd.length?Math.round(hd.reduce((s,d)=>s+d.pct,0)/hd.length):0;
  return (
    <div style={{background:"white",borderRadius:20,padding:"16px 18px",marginBottom:14,boxShadow:"0 1px 6px rgba(0,0,0,0.05)"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
        <div style={{fontSize:10,fontWeight:700,color:"#9ca3af",letterSpacing:"0.12em"}}>WEEKLY STREAK</div>
        <div style={{display:"flex",gap:10,alignItems:"center"}}>
          {streak>0&&<div style={{fontSize:12,fontWeight:700,color:"#f59e0b"}}>🔥 {streak}日連続</div>}
          <div style={{fontSize:11,color:"#9ca3af"}}>週平均 <span style={{fontWeight:700,color:"#6b7280"}}>{avg}%</span></div>
        </div>
      </div>
      <div style={{display:"flex",gap:5,alignItems:"flex-end",height:80,marginTop:8}}>
        {days.map(d=>{
          const bh=d.pct!=null?Math.max(6,(d.pct/100)*62):4;
          const bg=d.pct==null?"#f3f4f6":d.rt==="B"?(d.pct>=100?"#34d399":d.pct>=50?"#a78bfa":"#e9d5ff"):(d.pct>=100?"#10b981":d.pct>=80?"#34d399":d.pct>=50?"#60a5fa":"#e5e7eb");
          return (
            <div key={d.key} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
              <div style={{fontSize:9,color:d.pct!=null?"#6b7280":"transparent",fontWeight:600,height:13}}>{d.pct!=null?d.pct+"%":""}</div>
              <div style={{flex:1,display:"flex",alignItems:"flex-end",width:"100%"}}>
                <div style={{width:"100%",height:bh,background:bg,borderRadius:5,outline:d.isToday?"2.5px solid #3b82f6":"none",outlineOffset:2,transition:"height 0.5s ease"}} title={d.wt?"起床 "+d.wt:""}/>
              </div>
              <div style={{fontSize:11,color:d.isToday?"#3b82f6":"#9ca3af",fontWeight:d.isToday?700:400}}>{d.wd}</div>
              {/* A/B badge */}
              {d.rt&&<div style={{fontSize:8,fontWeight:800,color:d.rt==="B"?"#7c3aed":"#1d4ed8",background:d.rt==="B"?"#f5f3ff":"#eff6ff",borderRadius:4,padding:"1px 4px",lineHeight:1.2}}>{d.rt}</div>}
            </div>
          );
        })}
      </div>
      {/* legend */}
      <div style={{display:"flex",gap:12,marginTop:10,justifyContent:"flex-end"}}>
        <div style={{display:"flex",alignItems:"center",gap:4}}>
          <div style={{width:10,height:10,borderRadius:2,background:"#60a5fa"}}/><span style={{fontSize:10,color:"#9ca3af"}}>A 通常</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:4}}>
          <div style={{width:10,height:10,borderRadius:2,background:"#a78bfa"}}/><span style={{fontSize:10,color:"#9ca3af"}}>B バックアップ</span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// NOTIFICATION PANEL
// ─────────────────────────────────────────────────────────────────────────────
function NotificationPanel({notifEnabled,onToggle,notifStatus}) {
  const isOn=notifEnabled&&notifStatus==="granted";
  const disabled=notifStatus==="denied"||notifStatus==="unsupported";
  const txt=notifStatus==="unsupported"?"このブラウザは通知をサポートしていません":notifStatus==="denied"?"❌ ブロックされています。ブラウザ設定から許可してください":isOn?"✅ 毎朝 5:05 にリマインダーを送ります":"オンにすると毎朝 5:05 にリマインダーを送ります";
  const col=notifStatus==="unsupported"?"#9ca3af":notifStatus==="denied"?"#ef4444":isOn?"#10b981":"#6b7280";
  return (
    <div style={{background:"white",borderRadius:20,padding:"14px 18px",marginBottom:14,boxShadow:"0 1px 6px rgba(0,0,0,0.05)"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:13,fontWeight:700,color:"#1f2937"}}>🔔 朝のリマインダー <span style={{fontWeight:800,color:"#3b82f6"}}>5:05</span></div>
          <div style={{fontSize:11,color:col,marginTop:3,lineHeight:1.5}}>{txt}</div>
        </div>
        <button onClick={disabled?undefined:onToggle} style={{width:50,height:30,borderRadius:99,border:"none",background:isOn?"#3b82f6":"#e5e7eb",cursor:disabled?"not-allowed":"pointer",position:"relative",transition:"background 0.25s",flexShrink:0,opacity:disabled?0.5:1}}>
          <div style={{width:24,height:24,borderRadius:"50%",background:"white",position:"absolute",top:3,left:isOn?23:3,transition:"left 0.22s",boxShadow:"0 1px 4px rgba(0,0,0,0.2)"}}/>
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// NOTION PANEL
// ─────────────────────────────────────────────────────────────────────────────
function NotionPanel({notionConfig,onSave,onSync,syncState}) {
  const [open,setOpen]=useState(false);
  const [apiKey,setApiKey]=useState(notionConfig.apiKey||"");
  const [dbId,setDbId]=useState(notionConfig.dbId||"");
  const [saved,setSaved]=useState(false);
  const isCfg=!!(notionConfig.apiKey&&notionConfig.dbId);
  const handleSave=()=>{onSave({apiKey:apiKey.trim(),dbId:dbId.trim()});setSaved(true);setTimeout(()=>setSaved(false),2000);};
  return (
    <div style={{background:"white",borderRadius:20,padding:"14px 18px",marginBottom:14,boxShadow:"0 1px 6px rgba(0,0,0,0.05)"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer"}} onClick={()=>setOpen(v=>!v)}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:32,height:32,borderRadius:8,background:"#1f2937",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="2" y="2" width="14" height="14" rx="2" fill="#1f2937" stroke="white" strokeWidth="1.2"/><path d="M5 6h8M5 9h6M5 12h4" stroke="white" strokeWidth="1.4" strokeLinecap="round"/></svg>
          </div>
          <div>
            <div style={{fontSize:13,fontWeight:700,color:"#1f2937"}}>Notion カレンダー連携{isCfg&&<span style={{marginLeft:8,fontSize:10,background:"#dcfce7",color:"#16a34a",padding:"2px 7px",borderRadius:99,fontWeight:600}}>設定済み</span>}</div>
            <div style={{fontSize:11,color:"#9ca3af",marginTop:1}}>{isCfg?"今日の達成記録をNotionに送信（A/B種別も記録）":"APIキーとDB IDを設定"}</div>
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          {isCfg&&<button onClick={e=>{e.stopPropagation();onSync();}} disabled={syncState==="syncing"} style={{height:32,padding:"0 14px",borderRadius:99,border:"none",background:syncState==="success"?"#dcfce7":syncState==="error"?"#fee2e2":syncState==="syncing"?"#f3f4f6":"#1f2937",color:syncState==="success"?"#16a34a":syncState==="error"?"#ef4444":syncState==="syncing"?"#9ca3af":"white",fontSize:12,fontWeight:700,cursor:syncState==="syncing"?"not-allowed":"pointer"}}>{syncState==="syncing"?"送信中…":syncState==="success"?"✓ 送信済み":syncState==="error"?"✗ 失敗":"今日を送信"}</button>}
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{transform:open?"rotate(180deg)":"rotate(0deg)",transition:"transform 0.2s"}}><path d="M2 5L7 10L12 5" stroke="#9ca3af" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
      </div>
      {open&&(
        <div style={{marginTop:14,paddingTop:14,borderTop:"1px solid #f3f4f6"}}>
          <div style={{fontSize:11,color:"#9ca3af",marginBottom:12,lineHeight:1.8,background:"#f9fafb",borderRadius:10,padding:"10px 12px"}}>
            <strong style={{color:"#374151"}}>セットアップ手順</strong><br/>
            1. Notion → 設定 → インテグレーション → 新規作成<br/>
            2. トークン（secret_xxx）をコピー<br/>
            3. 送信先DBを開きインテグレーションに接続を許可<br/>
            4. DBのURLから32文字のIDをコピー<br/>
            5. DBに以下の列を作成：日付(Date), 達成率(Number), 完了数(Number), 全項目数(Number), アンカー達成(Number), 起床時刻(Text), ルーティン種別(Text), ノート(Text)
          </div>
          <div style={{marginBottom:10}}><div style={{fontSize:12,fontWeight:600,color:"#374151",marginBottom:4}}>API Integration Token</div><input value={apiKey} onChange={e=>setApiKey(e.target.value)} type="password" placeholder="secret_xxxxxxxxxxxxxx" style={{width:"100%",fontSize:13,border:"1.5px solid #e5e7eb",borderRadius:10,padding:"8px 12px",outline:"none",boxSizing:"border-box",fontFamily:"monospace"}}/></div>
          <div style={{marginBottom:12}}><div style={{fontSize:12,fontWeight:600,color:"#374151",marginBottom:4}}>Database ID</div><input value={dbId} onChange={e=>setDbId(e.target.value)} placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" style={{width:"100%",fontSize:13,border:"1.5px solid #e5e7eb",borderRadius:10,padding:"8px 12px",outline:"none",boxSizing:"border-box",fontFamily:"monospace"}}/></div>
          <button onClick={handleSave} style={{width:"100%",padding:"10px",borderRadius:12,background:saved?"#dcfce7":"#1f2937",border:"none",fontSize:13,color:saved?"#16a34a":"white",fontWeight:700,cursor:"pointer"}}>{saved?"✓ 保存しました":"設定を保存"}</button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CHECK ITEM
// ─────────────────────────────────────────────────────────────────────────────
function CheckItem({item,checked,onToggle,onEdit,onDelete,color,textColor,editMode}) {
  const [editing,setEditing]=useState(false);
  const [val,setVal]=useState(item.label);
  const ref=useRef(null);
  useEffect(()=>{if(editing)ref.current?.focus();},[editing]);
  const commit=()=>{const t=val.trim();if(t&&t!==item.label)onEdit(item.id,t);else setVal(item.label);setEditing(false);};
  return (
    <div onClick={editMode?undefined:onToggle}
      style={{background:checked&&!editMode?"transparent":"rgba("+rgb(color)+",0.28)",borderLeft:"3px solid "+(checked&&!editMode?"#d1d5db":color),display:"flex",alignItems:"center",gap:10,padding:"10px 10px 10px 12px",borderRadius:12,marginBottom:5,cursor:editMode?"default":"pointer",transition:"all 0.22s ease",userSelect:"none"}}>
      {!editMode&&(
        <div style={{width:22,height:22,flexShrink:0,borderRadius:"50%",border:"2px solid "+(checked?"#d1d5db":darken(color,50)),background:checked?darken(color,30):"white",display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.2s"}}>
          {checked&&<svg width="11" height="9" viewBox="0 0 11 9" fill="none"><path d="M1 4L4 7.5L10 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
        </div>
      )}
      {editMode&&editing?(<input ref={ref} value={val} onChange={e=>setVal(e.target.value)} onBlur={commit}
        onKeyDown={e=>{if(e.key==="Enter")commit();if(e.key==="Escape"){setVal(item.label);setEditing(false);}}} onClick={e=>e.stopPropagation()}
        style={{flex:1,fontSize:14,color:"#1f2937",border:"1.5px solid #93c5fd",borderRadius:8,padding:"4px 8px",outline:"none",background:"white"}}/>):(
        <span onDoubleClick={editMode?()=>setEditing(true):undefined}
          style={{flex:1,fontSize:14,lineHeight:1.4,color:checked&&!editMode?"#9ca3af":(textColor||"#374151"),textDecoration:checked&&!editMode?"line-through":"none",fontWeight:item.anchor?600:400,transition:"all 0.2s"}}>{item.label}</span>
      )}
      <span style={{fontSize:10,color:checked&&!editMode?"#d1d5db":"#9ca3af",background:checked&&!editMode?"transparent":"rgba("+rgb(color)+",0.3)",padding:"2px 7px",borderRadius:99,flexShrink:0,whiteSpace:"nowrap"}}>{item.location}</span>
      {editMode&&(
        <div style={{display:"flex",gap:4,flexShrink:0}}>
          <button onClick={e=>{e.stopPropagation();setEditing(true);}} style={{width:26,height:26,borderRadius:"50%",border:"none",background:"#dbeafe",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}><svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M1 11L4.5 10L10.5 4L8 1.5L2 7.5L1 11Z" stroke="#3b82f6" strokeWidth="1.5" strokeLinejoin="round"/></svg></button>
          <button onClick={e=>{e.stopPropagation();onDelete(item.id);}} style={{width:26,height:26,borderRadius:"50%",border:"none",background:"#fee2e2",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}><svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1 1L9 9M9 1L1 9" stroke="#ef4444" strokeWidth="1.8" strokeLinecap="round"/></svg></button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ANCHOR CARD
// ─────────────────────────────────────────────────────────────────────────────
function AnchorCard({anchor,checked,onToggle,colorSet}) {
  const cs=colorSet||["#34d399","#f59e0b"];
  const bgs=colorSet?["#f0fdf4","#fffbeb"]:["#f0fdf4","#fffbeb"];
  const idx=[0,1];const i=idx[0]||0;
  const c=cs[0]||"#34d399",bg=bgs[0]||"#f0fdf4";
  return (
    <div onClick={onToggle} style={{background:checked?"#f9fafb":bg,border:"2px solid "+(checked?"#e5e7eb":c),boxShadow:checked?"none":"0 4px 18px rgba("+rgb(c)+",0.18)",borderRadius:18,padding:"14px 12px",cursor:"pointer",userSelect:"none",transition:"all 0.28s ease",display:"flex",flexDirection:"column",gap:4}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span style={{fontSize:20}}>{anchor.emoji}</span>
        <div style={{width:26,height:26,borderRadius:"50%",border:"2px solid "+(checked?"#d1d5db":c),background:checked?c:"white",display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.25s"}}>
          {checked&&<svg width="11" height="9" viewBox="0 0 11 9" fill="none"><path d="M1 4L4 7.5L10 1" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
        </div>
      </div>
      <div style={{fontSize:20,fontWeight:800,color:checked?"#9ca3af":"#1f2937",lineHeight:1}}>{anchor.time}</div>
      <div style={{fontSize:11,color:checked?"#9ca3af":"#6b7280",lineHeight:1.35}}>{anchor.label}</div>
    </div>
  );
}

function ProgressBar({value,color}) {
  const bg=color||(value>=100?"linear-gradient(90deg,#34d399,#10b981)":"linear-gradient(90deg,#60a5fa,#3b82f6)");
  return (
    <div style={{height:8,background:"#e5e7eb",borderRadius:99,overflow:"hidden"}}>
      <div style={{height:"100%",width:value+"%",background:bg,borderRadius:99,transition:"width 0.5s ease"}}/>
    </div>
  );
}

function AddItemForm({locations,defaultTime,timeOptions,onAdd,onCancel}) {
  const [label,setLabel]=useState("");const [loc,setLoc]=useState(locations[0]||"");const [time,setTime]=useState(defaultTime||timeOptions[0]);
  const ref=useRef(null);useEffect(()=>{ref.current?.focus();},[]);
  const submit=()=>{if(!label.trim())return;onAdd({label:label.trim(),location:loc,time});setLabel("");};
  return (
    <div style={{background:"#f0f9ff",border:"1.5px solid #bae6fd",borderRadius:14,padding:14,marginBottom:6}}>
      <div style={{fontSize:12,fontWeight:700,color:"#0369a1",marginBottom:10}}>＋ 新しい項目を追加</div>
      <input ref={ref} value={label} onChange={e=>setLabel(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()} placeholder="項目名を入力..." style={{width:"100%",fontSize:14,border:"1.5px solid #e0f2fe",borderRadius:10,padding:"8px 12px",outline:"none",marginBottom:8,boxSizing:"border-box"}}/>
      <div style={{display:"flex",gap:8,marginBottom:10}}>
        <select value={loc} onChange={e=>setLoc(e.target.value)} style={{flex:1,fontSize:13,border:"1.5px solid #e0f2fe",borderRadius:10,padding:"6px 8px",outline:"none"}}>{locations.map(l=><option key={l}>{l}</option>)}</select>
        <select value={time} onChange={e=>setTime(e.target.value)} style={{flex:1,fontSize:13,border:"1.5px solid #e0f2fe",borderRadius:10,padding:"6px 8px",outline:"none"}}>{timeOptions.map(g=><option key={g}>{g}</option>)}</select>
      </div>
      <div style={{display:"flex",gap:8}}>
        <button onClick={onCancel} style={{flex:1,padding:"9px",borderRadius:10,background:"white",border:"1.5px solid #e5e7eb",fontSize:13,color:"#6b7280",cursor:"pointer"}}>キャンセル</button>
        <button onClick={submit}   style={{flex:2,padding:"9px",borderRadius:10,background:"#3b82f6",border:"none",fontSize:13,color:"white",fontWeight:700,cursor:"pointer"}}>追加する</button>
      </div>
    </div>
  );
}

function AddLocationForm({onAdd,onCancel,existingLocations}) {
  const [name,setName]=useState("");const [color,setColor]=useState("#fce7f3");
  const ref=useRef(null);useEffect(()=>{ref.current?.focus();},[]);
  const submit=()=>{const n=name.trim();if(!n||existingLocations.includes(n))return;onAdd(n,color);};
  return (
    <div style={{background:"#fdf4ff",border:"1.5px solid #e9d5ff",borderRadius:14,padding:14,marginBottom:8}}>
      <div style={{fontSize:12,fontWeight:700,color:"#7c3aed",marginBottom:10}}>＋ 新しい場所を追加</div>
      <input ref={ref} value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()} placeholder="場所名を入力..." style={{width:"100%",fontSize:14,border:"1.5px solid #e9d5ff",borderRadius:10,padding:"8px 12px",outline:"none",marginBottom:8,boxSizing:"border-box"}}/>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
        <span style={{fontSize:13,color:"#6b7280"}}>カラー</span>
        <label style={{cursor:"pointer",display:"flex",alignItems:"center",gap:8}}>
          <div style={{width:32,height:32,borderRadius:8,background:color,border:"1px solid rgba(0,0,0,0.1)"}}/>
          <input type="color" value={color} onChange={e=>setColor(e.target.value)} style={{width:0,height:0,opacity:0,position:"absolute"}}/>
          <span style={{fontSize:12,color:"#9ca3af"}}>タップして変更</span>
        </label>
      </div>
      <div style={{display:"flex",gap:8}}>
        <button onClick={onCancel} style={{flex:1,padding:"9px",borderRadius:10,background:"white",border:"1.5px solid #e5e7eb",fontSize:13,color:"#6b7280",cursor:"pointer"}}>キャンセル</button>
        <button onClick={submit}   style={{flex:2,padding:"9px",borderRadius:10,background:"#7c3aed",border:"none",fontSize:13,color:"white",fontWeight:700,cursor:"pointer"}}>追加する</button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ROUTINE TAB SWITCHER
// ─────────────────────────────────────────────────────────────────────────────
function RoutineSwitcher({activeTab,onSwitch}) {
  const isA=activeTab==="A";
  return (
    <div style={{display:"flex",gap:6,background:"#f1f5f9",borderRadius:14,padding:4,marginBottom:16}}>
      <button onClick={()=>onSwitch("A")} style={{flex:1,padding:"9px 8px",borderRadius:10,border:"none",background:isA?"white":"transparent",color:isA?"#1d4ed8":"#64748b",fontWeight:isA?700:400,fontSize:13,cursor:"pointer",boxShadow:isA?"0 1px 6px rgba(0,0,0,0.1)":"none",transition:"all 0.2s",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
        <span style={{width:20,height:20,borderRadius:6,background:isA?"#1d4ed8":"#94a3b8",color:"white",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800,flexShrink:0}}>A</span>
        通常ルーティン
      </button>
      <button onClick={()=>onSwitch("B")} style={{flex:1,padding:"9px 8px",borderRadius:10,border:"none",background:!isA?"white":"transparent",color:!isA?"#7c3aed":"#64748b",fontWeight:!isA?700:400,fontSize:13,cursor:"pointer",boxShadow:!isA?"0 1px 6px rgba(0,0,0,0.1)":"none",transition:"all 0.2s",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
        <span style={{width:20,height:20,borderRadius:6,background:!isA?"#7c3aed":"#94a3b8",color:"white",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800,flexShrink:0}}>B</span>
        バックアップ
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ROUTINE VIEW (shared between A and B)
// ─────────────────────────────────────────────────────────────────────────────
function RoutineView({items,checked,colors,editMode,onToggle,onEdit,onDelete,onAdd,showAdd,onSetShowAdd,timeGroups,timeLabels,anchors,anchorColors,routineType}) {
  const nonWakeupAnchors=anchors.filter(a=>a.id!=="wakeup");
  const locations=[...new Set(items.map(i=>i.location))];
  const achorC = routineType==="B" ? ["#a78bfa","#f59e0b"] : ["#34d399","#f59e0b"];
  const anchorBg = routineType==="B" ? ["#f5f3ff","#fffbeb"] : ["#f0fdf4","#fffbeb"];

  return (
    <div>
      {/* Anchors */}
      <div style={{marginBottom:20}}>
        <div style={{fontSize:10,fontWeight:700,color:"#9ca3af",letterSpacing:"0.14em",marginBottom:10}}>
          {routineType==="B"?"BACKUP ANCHORS":"ANCHORS"}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          {nonWakeupAnchors.map((a,i)=>{
            const c=achorC[i]||"#34d399",bg=anchorBg[i]||"#f0fdf4";
            const isChecked=!!checked[a.id];
            return (
              <div key={a.id} onClick={()=>onToggle(a.id,null)}
                style={{background:isChecked?"#f9fafb":bg,border:"2px solid "+(isChecked?"#e5e7eb":c),boxShadow:isChecked?"none":"0 4px 18px rgba("+rgb(c)+",0.18)",borderRadius:18,padding:"14px 12px",cursor:"pointer",userSelect:"none",transition:"all 0.28s ease",display:"flex",flexDirection:"column",gap:4}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span style={{fontSize:20}}>{a.emoji}</span>
                  <div style={{width:26,height:26,borderRadius:"50%",border:"2px solid "+(isChecked?"#d1d5db":c),background:isChecked?c:"white",display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.25s"}}>
                    {isChecked&&<svg width="11" height="9" viewBox="0 0 11 9" fill="none"><path d="M1 4L4 7.5L10 1" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </div>
                </div>
                <div style={{fontSize:20,fontWeight:800,color:isChecked?"#9ca3af":"#1f2937",lineHeight:1}}>{a.time}</div>
                <div style={{fontSize:11,color:isChecked?"#9ca3af":"#6b7280",lineHeight:1.35}}>{a.label}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Checklist by time group */}
      {timeGroups.map(group=>{
        const gi=items.filter(i=>i.time===group);
        if(!gi.length&&!editMode) return null;
        const done=gi.filter(i=>checked[i.id]).length;
        const allDone=gi.length>0&&done===gi.length;
        const grpColor = routineType==="B" ? (allDone?"#a78bfa":"#d1d5db") : (allDone?"#10b981":"#d1d5db");
        return (
          <div key={group} style={{marginBottom:18}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
              <div style={{width:8,height:8,borderRadius:"50%",background:grpColor,flexShrink:0}}/>
              <div style={{fontSize:12,fontWeight:700,color:allDone?"#9ca3af":"#374151"}}>{group}</div>
              <div style={{fontSize:11,color:"#9ca3af"}}>{timeLabels[group]}</div>
              <div style={{marginLeft:"auto",fontSize:12,fontWeight:600,color:allDone?(routineType==="B"?"#7c3aed":"#10b981"):"#6b7280"}}>{gi.length>0?done+"/"+gi.length:""}</div>
            </div>
            <div style={{background:"white",borderRadius:20,padding:"10px 8px 6px",boxShadow:"0 1px 6px rgba(0,0,0,0.05)",opacity:allDone&&!editMode?0.72:1,transition:"opacity 0.3s"}}>
              {gi.map(item=>(
                <CheckItem key={item.id} item={item} checked={!!checked[item.id]}
                  onToggle={e=>onToggle(item.id,e)} onEdit={onEdit} onDelete={onDelete}
                  color={colors[item.location]||"#dbeafe"} textColor={LOC_TEXT[item.location]}
                  editMode={editMode}/>
              ))}
              {editMode&&showAdd===group&&<AddItemForm locations={locations} defaultTime={group} timeOptions={timeGroups} onAdd={onAdd} onCancel={()=>onSetShowAdd(null)}/>}
              {editMode&&showAdd!==group&&<button onClick={()=>onSetShowAdd(group)} style={{width:"100%",padding:"9px",marginBottom:4,borderRadius:10,border:"1.5px dashed #d1d5db",background:"transparent",fontSize:13,color:"#9ca3af",cursor:"pointer"}}>＋ この時間帯に追加</button>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────────────────────────────────────
export default function MorningBaseRoutine() {
  const FONT="'Hiragino Kaku Gothic ProN','Hiragino Sans',sans-serif";

  // ── State ──
  const [routineTab,   setRoutineTab]   = useState("A");            // "A" | "B"
  const [itemsA,       setItemsA]       = useState(INIT_ITEMS_A);
  const [itemsB,       setItemsB]       = useState(INIT_ITEMS_B);
  const [checkedA,     setCheckedA]     = useState({});
  const [checkedB,     setCheckedB]     = useState({});
  const [colors,       setColors]       = useState(DEFAULT_COLORS);
  const [wakeupTime,   setWakeupTime]   = useState(null);
  const [view,         setView]         = useState("home");
  const [editMode,     setEditMode]     = useState(false);
  const [showReset,    setShowReset]    = useState(false);
  const [showAddA,     setShowAddA]     = useState(null);
  const [showAddB,     setShowAddB]     = useState(null);
  const [showAddLoc,   setShowAddLoc]   = useState(false);
  const [bursts,       setBursts]       = useState([]);
  const [history,      setHistory]      = useState({});
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [notifStatus,  setNotifStatus]  = useState("default");
  const [notionConfig, setNotionConfig] = useState({apiKey:"",dbId:""});
  const [syncState,    setSyncState]    = useState("idle");
  const notifRef=useRef(null);

  // Swipe support
  const touchStartX=useRef(null);
  const handleTouchStart=e=>{touchStartX.current=e.touches[0].clientX;};
  const handleTouchEnd=e=>{
    if(touchStartX.current===null) return;
    const dx=e.changedTouches[0].clientX-touchStartX.current;
    if(Math.abs(dx)>60){setRoutineTab(dx<0?"B":"A");}
    touchStartX.current=null;
  };

  // Active data derived
  const isA=routineTab==="A";
  const items=isA?itemsA:itemsB;
  const checked=isA?checkedA:checkedB;
  const setChecked=isA?setCheckedA:setCheckedB;
  const timeGroups=isA?TIME_GROUPS_A:TIME_GROUPS_B;
  const timeLabels=isA?TIME_LABELS_A:TIME_LABELS_B;
  const anchors=isA?ANCHORS_A:ANCHORS_B;

  // ── Load ──
  useEffect(()=>{
    try{
      const raw=localStorage.getItem("mbr_data");
      if(raw){
        const d=JSON.parse(raw);
        if(d.date===TODAY()){
          setCheckedA(d.checkedA||{});setCheckedB(d.checkedB||{});
          setWakeupTime(d.wakeupTime||null);
          if(d.routineTab) setRoutineTab(d.routineTab);
        }
        if(d.colors)    setColors({...DEFAULT_COLORS,...d.colors});
        if(d.itemsA?.length) setItemsA(d.itemsA);
        if(d.itemsB?.length) setItemsB(d.itemsB);
        if(d.notifEnabled!==undefined) setNotifEnabled(!!d.notifEnabled);
        if(d.notionConfig) setNotionConfig(d.notionConfig);
      }
    }catch{}
    setHistory(loadHist());
    if(!("Notification" in window)){setNotifStatus("unsupported");return;}
    if(Notification.permission==="granted") setNotifStatus("granted");
    else if(Notification.permission==="denied") setNotifStatus("denied");
  },[]);

  // ── Save ──
  useEffect(()=>{
    const activeItems=isA?itemsA:itemsB;
    const activeChecked=isA?checkedA:checkedB;
    const pct=activeItems.length?Math.round((Object.values(activeChecked).filter(Boolean).length/activeItems.length)*100):0;
    saveHist(TODAY(),{progress:pct,wakeupTime,routineType:routineTab});
    setHistory(loadHist());
    localStorage.setItem("mbr_data",JSON.stringify({date:TODAY(),checkedA,checkedB,colors,itemsA,itemsB,notifEnabled,wakeupTime,notionConfig,routineTab}));
  },[checkedA,checkedB,colors,itemsA,itemsB,notifEnabled,wakeupTime,notionConfig,routineTab]);

  // ── Notification ──
  useEffect(()=>{
    if(notifRef.current) clearInterval(notifRef.current);
    if(!notifEnabled||notifStatus!=="granted") return;
    notifRef.current=setInterval(()=>{
      const n=new Date();
      if(n.getHours()===5&&n.getMinutes()===5&&n.getSeconds()===0){
        try{new Notification("Morning Base Routine 🌅",{body:"おはようございます！PCを開いてWAKEUPボタンを押しましょう。"});}catch{}
      }
    },1000);
    return()=>clearInterval(notifRef.current);
  },[notifEnabled,notifStatus]);

  // ── Handlers ──
  const toggle=(id,e)=>{
    const willCheck=!checked[id];
    setChecked(prev=>({...prev,[id]:!prev[id]}));
    if(willCheck&&e){
      const rect=e.currentTarget.getBoundingClientRect();
      const it=items.find(i=>i.id===id)||anchors.find(a=>a.id===id);
      const col=it?.location?(colors[it.location]||"#60a5fa"):"#60a5fa";
      setBursts(b=>[...b,{id:uid(),x:rect.left+rect.width/2,y:rect.top+rect.height/2,color:darken(col,20)}]);
    }
  };
  const handleWakeup=()=>{setWakeupTime(fmt(new Date()));setChecked(p=>({...p,wakeup:true}));};
  const editItemA=(id,label)=>setItemsA(p=>p.map(i=>i.id===id?{...i,label}:i));
  const editItemB=(id,label)=>setItemsB(p=>p.map(i=>i.id===id?{...i,label}:i));
  const deleteItemA=(id)=>{setItemsA(p=>p.filter(i=>i.id!==id));setCheckedA(p=>{const n={...p};delete n[id];return n;});};
  const deleteItemB=(id)=>{setItemsB(p=>p.filter(i=>i.id!==id));setCheckedB(p=>{const n={...p};delete n[id];return n;});};
  const addItemA=({label,location,time})=>{setItemsA(p=>[...p,{id:uid(),time,location,label}]);setShowAddA(null);};
  const addItemB=({label,location,time})=>{setItemsB(p=>[...p,{id:uid(),time,location,label}]);setShowAddB(null);};
  const addLocation=(name,color)=>{setColors(p=>({...p,[name]:color}));setShowAddLoc(false);};
  const reset=()=>{setCheckedA({});setCheckedB({});setWakeupTime(null);setShowReset(false);};
  const toggleNotif=async()=>{
    if(notifStatus==="denied"||notifStatus==="unsupported") return;
    if(!("Notification" in window)){setNotifStatus("unsupported");return;}
    if(Notification.permission!=="granted"){const res=await Notification.requestPermission();setNotifStatus(res==="granted"?"granted":"denied");if(res==="granted")setNotifEnabled(true);return;}
    setNotifEnabled(v=>!v);
  };

  // Stats
  const totalItems=items.length;
  const checkedCount=Object.values(checked).filter(Boolean).length;
  const progress=totalItems?Math.round((checkedCount/totalItems)*100):0;
  const anchorCount=[checked["wakeup"],...anchors.filter(a=>a.id!=="wakeup").map(a=>checked[a.id])].filter(Boolean).length;
  const locationProgress=Object.keys(colors).map(loc=>{const li=items.filter(i=>i.location===loc);return{loc,done:li.filter(i=>checked[i.id]).length,total:li.length};}).filter(l=>l.total>0);
  const getMessage=()=>{
    if(!wakeupTime) return "👁 WAKEUPボタンを押して始めよう";
    if(progress>=100) return isA?"🎉 完璧な朝！今日も最高の一日を。":"🌿 立て直し完了！今日も継続成功。";
    if(progress>=80) return "✨ あと少し！ゴールは目の前。";
    if(progress>=50) return "💪 折り返し。流れに乗ってる。";
    if(progress>=20) return "🌱 いい感じ。次のアンカーへ。";
    return isA?"☀️ 今日もここから始めよう。":"🌿 無理せず、最低限のリズムで。";
  };

  const handleNotionSync=async()=>{
    if(!notionConfig.apiKey||!notionConfig.dbId) return;
    setSyncState("syncing");
    try{
      await pushToNotion({apiKey:notionConfig.apiKey,dbId:notionConfig.dbId,payload:{progress,checkedCount,totalItems,anchorCount,wakeupTime:wakeupTime||"",routineType:routineTab,note:""}});
      setSyncState("success");setTimeout(()=>setSyncState("idle"),3000);
    }catch(err){console.error(err);setSyncState("error");setTimeout(()=>setSyncState("idle"),4000);}
  };

  // ── Settings View ──
  if(view==="settings") return (
    <div style={{minHeight:"100vh",background:"#f8fafc",fontFamily:FONT}}>
      <div style={{maxWidth:480,margin:"0 auto",padding:"0 16px 60px"}}>
        <div style={{display:"flex",alignItems:"center",gap:12,padding:"20px 0 16px"}}>
          <button onClick={()=>setView("home")} style={{width:36,height:36,borderRadius:"50%",background:"white",border:"1.5px solid #e5e7eb",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}><svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M9 3L4 7.5L9 12" stroke="#374151" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
          <h1 style={{fontSize:18,fontWeight:700,color:"#1f2937",margin:0}}>場所の色設定</h1>
        </div>
        {Object.entries(colors).map(([loc,color])=>(
          <div key={loc} style={{background:"white",borderRadius:16,padding:"13px 16px",marginBottom:8,display:"flex",alignItems:"center",gap:12,boxShadow:"0 1px 4px rgba(0,0,0,0.05)"}}>
            <div style={{width:34,height:34,borderRadius:10,background:color,border:"1px solid rgba(0,0,0,0.07)",flexShrink:0}}/>
            <div style={{flex:1}}><div style={{fontSize:14,fontWeight:600,color:"#1f2937"}}>{loc}</div><div style={{fontSize:11,color:"#9ca3af"}}>{[...itemsA,...itemsB].filter(i=>i.location===loc).length}項目</div></div>
            <label style={{cursor:"pointer"}}><input type="color" value={color} onChange={e=>setColors(p=>({...p,[loc]:e.target.value}))} style={{width:38,height:38,cursor:"pointer",borderRadius:8,border:"none",background:"none",padding:0}}/></label>
          </div>
        ))}
        {showAddLoc?<AddLocationForm onAdd={addLocation} onCancel={()=>setShowAddLoc(false)} existingLocations={Object.keys(colors)}/>:<button onClick={()=>setShowAddLoc(true)} style={{width:"100%",marginTop:4,padding:"12px",borderRadius:14,background:"white",border:"1.5px dashed #d8b4fe",fontSize:14,color:"#7c3aed",cursor:"pointer",fontWeight:600}}>＋ 場所を追加</button>}
        <button onClick={()=>setColors(DEFAULT_COLORS)} style={{width:"100%",marginTop:10,padding:"13px",borderRadius:14,background:"white",border:"1.5px solid #e5e7eb",fontSize:14,color:"#6b7280",cursor:"pointer",fontWeight:500}}>デフォルトカラーに戻す</button>
      </div>
    </div>
  );

  // ── Home View ──
  const isB=!isA;
  const progressBg=isB?"linear-gradient(90deg,#a78bfa,#7c3aed)":undefined;

  return (
    <div style={{minHeight:"100vh",background:"#f8fafc",fontFamily:FONT}}
      onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      {bursts.map(b=><Burst key={b.id} x={b.x} y={b.y} color={b.color} onDone={()=>setBursts(p=>p.filter(x=>x.id!==b.id))}/>)}

      <div style={{maxWidth:480,margin:"0 auto",padding:"0 16px 100px"}}>

        {/* Header */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"20px 0 12px"}}>
          <div>
            <div style={{fontSize:10,fontWeight:700,color:"#9ca3af",letterSpacing:"0.16em",textTransform:"uppercase"}}>Morning Base</div>
            <h1 style={{fontSize:22,fontWeight:800,color:"#1f2937",margin:0}}>Routine</h1>
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <button onClick={()=>setEditMode(v=>!v)} style={{height:34,padding:"0 14px",borderRadius:99,background:editMode?"#3b82f6":"white",border:"1.5px solid "+(editMode?"#3b82f6":"#e5e7eb"),color:editMode?"white":"#6b7280",fontSize:12,fontWeight:600,cursor:"pointer",transition:"all 0.2s"}}>{editMode?"✓ 完了":"編集"}</button>
            <button onClick={()=>setView("settings")} style={{width:36,height:36,borderRadius:"50%",background:"white",border:"1.5px solid #e5e7eb",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="3" stroke="#6b7280" strokeWidth="1.8"/><path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.22 4.22l1.42 1.42M14.36 14.36l1.42 1.42M4.22 15.78l1.42-1.42M14.36 5.64l1.42-1.42" stroke="#6b7280" strokeWidth="1.8" strokeLinecap="round"/></svg>
            </button>
          </div>
        </div>

        {/* WAKEUP */}
        <div style={{background:"white",borderRadius:28,padding:"32px 20px 28px",marginBottom:14,boxShadow:"0 2px 24px rgba(0,0,0,0.08)",position:"relative",overflow:"visible"}}>
          <WakeupButton wakeupTime={wakeupTime} onWakeup={handleWakeup}/>
        </div>

        {/* Clock */}
        <div style={{background:"white",borderRadius:24,padding:"22px 18px 18px",marginBottom:14,boxShadow:"0 1px 8px rgba(0,0,0,0.06)"}}>
          <LiveClock/>
          <div style={{textAlign:"center",fontSize:12,color:"#9ca3af",marginTop:10}}>{new Date().toLocaleDateString("ja-JP",{year:"numeric",month:"long",day:"numeric",weekday:"long"})}</div>
        </div>

        {/* A/B Switcher */}
        <RoutineSwitcher activeTab={routineTab} onSwitch={tab=>{setRoutineTab(tab);setEditMode(false);}}/>

        {/* B mode banner */}
        {isB&&(
          <div style={{background:"linear-gradient(135deg,#f5f3ff,#ede9fe)",border:"1.5px solid #c4b5fd",borderRadius:16,padding:"12px 16px",marginBottom:14}}>
            <div style={{fontSize:13,fontWeight:700,color:"#5b21b6",marginBottom:2}}>🌿 バックアップルーティン</div>
            <div style={{fontSize:11,color:"#7c3aed",lineHeight:1.6}}>今日はここから立て直そう。Bを完了すれば継続成功として記録されます。</div>
          </div>
        )}

        {/* Progress */}
        <div style={{background:"white",borderRadius:20,padding:"16px 18px",marginBottom:14,boxShadow:"0 1px 6px rgba(0,0,0,0.05)"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
            <div style={{fontSize:14,color:"#374151",fontWeight:500,paddingTop:6,flex:1,lineHeight:1.4}}>{getMessage()}</div>
            <div style={{textAlign:"right",flexShrink:0,marginLeft:14}}>
              <div style={{fontSize:34,fontWeight:800,color:isB?"#7c3aed":"#1f2937",lineHeight:1}}>{progress}<span style={{fontSize:15,fontWeight:600,color:"#9ca3af"}}>%</span></div>
              <div style={{fontSize:11,color:"#9ca3af"}}>{checkedCount} / {totalItems}</div>
            </div>
          </div>
          <ProgressBar value={progress} color={isB?"linear-gradient(90deg,#a78bfa,#7c3aed)":undefined}/>
          <div style={{display:"flex",gap:6,marginTop:10}}>
            <div style={{flex:1.2,background:"#f9fafb",borderRadius:10,padding:"8px 10px",textAlign:"center"}}>
              <div style={{fontSize:17,fontWeight:700,color:"#1f2937"}}>{anchorCount}<span style={{fontSize:11,color:"#9ca3af"}}>/3</span></div>
              <div style={{fontSize:10,color:"#9ca3af"}}>アンカー</div>
            </div>
            {locationProgress.slice(0,3).map(l=>(
              <div key={l.loc} style={{flex:1,background:"#f9fafb",borderRadius:10,padding:"8px 6px",textAlign:"center"}}>
                <div style={{fontSize:17,fontWeight:700,color:"#1f2937"}}>{l.done}<span style={{fontSize:11,color:"#9ca3af"}}>/{l.total}</span></div>
                <div style={{fontSize:9,color:"#9ca3af",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{l.loc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* History */}
        <HistoryChart history={history}/>

        {/* Notion */}
        <NotionPanel notionConfig={notionConfig} onSave={cfg=>setNotionConfig(cfg)} onSync={handleNotionSync} syncState={syncState}/>

        {/* Notification */}
        <NotificationPanel notifEnabled={notifEnabled} onToggle={toggleNotif} notifStatus={notifStatus}/>

        {/* Routine content (swipeable area) */}
        <div key={routineTab} style={{animation:"mbr-slide-in 0.3s cubic-bezier(0.16,1,0.3,1)"}}>
          {isA?(
            <RoutineView items={itemsA} checked={checkedA} colors={colors} editMode={editMode}
              onToggle={toggle} onEdit={editItemA} onDelete={deleteItemA} onAdd={addItemA}
              showAdd={showAddA} onSetShowAdd={setShowAddA}
              timeGroups={TIME_GROUPS_A} timeLabels={TIME_LABELS_A}
              anchors={ANCHORS_A} routineType="A"/>
          ):(
            <RoutineView items={itemsB} checked={checkedB} colors={colors} editMode={editMode}
              onToggle={(id,e)=>{
                const willCheck=!checkedB[id];
                setCheckedB(prev=>({...prev,[id]:!prev[id]}));
                if(willCheck&&e){
                  const rect=e.currentTarget.getBoundingClientRect();
                  const it=itemsB.find(i=>i.id===id)||ANCHORS_B.find(a=>a.id===id);
                  const col=it?.location?(colors[it.location]||"#a78bfa"):"#a78bfa";
                  setBursts(b=>[...b,{id:uid(),x:rect.left+rect.width/2,y:rect.top+rect.height/2,color:darken(col,20)}]);
                }
              }}
              onEdit={editItemB} onDelete={deleteItemB} onAdd={addItemB}
              showAdd={showAddB} onSetShowAdd={setShowAddB}
              timeGroups={TIME_GROUPS_B} timeLabels={TIME_LABELS_B}
              anchors={ANCHORS_B} routineType="B"/>
          )}
        </div>

        {/* Location Progress */}
        <div style={{background:"white",borderRadius:20,padding:"16px 18px",marginBottom:18,boxShadow:"0 1px 6px rgba(0,0,0,0.05)"}}>
          <div style={{fontSize:10,fontWeight:700,color:"#9ca3af",letterSpacing:"0.12em",marginBottom:12}}>LOCATION PROGRESS</div>
          <div style={{display:"flex",flexDirection:"column",gap:9}}>
            {locationProgress.map(l=>{
              const pct=l.total?Math.round((l.done/l.total)*100):0;
              const c=colors[l.loc]||"#dbeafe";
              const barC=isB&&pct>=100?"#7c3aed":pct>=100?"#10b981":darken(c,30);
              return (
                <div key={l.loc}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                    <span style={{fontSize:13,color:"#374151"}}>{l.loc}</span>
                    <span style={{fontSize:12,color:pct>=100?(isB?"#7c3aed":"#10b981"):"#9ca3af",fontWeight:pct>=100?700:400}}>{pct>=100?"✓ 完了":l.done+"/"+l.total}</span>
                  </div>
                  <div style={{height:6,background:"#f3f4f6",borderRadius:99,overflow:"hidden"}}><div style={{height:"100%",width:pct+"%",background:barC,borderRadius:99,transition:"width 0.4s ease"}}/></div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Reset */}
        {!showReset?(
          <button onClick={()=>setShowReset(true)} style={{width:"100%",padding:"13px",borderRadius:16,background:"white",border:"1.5px solid #fee2e2",color:"#f87171",fontSize:14,fontWeight:600,cursor:"pointer"}}>今日のチェックをリセット</button>
        ):(
          <div style={{background:"#fff1f2",borderRadius:16,padding:"16px",display:"flex",gap:10,alignItems:"center"}}>
            <div style={{flex:1}}><div style={{fontSize:14,fontWeight:600,color:"#374151",marginBottom:3}}>本当にリセットしますか？</div><div style={{fontSize:12,color:"#9ca3af"}}>A・B両方のチェックとWAKEUPが消えます</div></div>
            <button onClick={()=>setShowReset(false)} style={{padding:"9px 14px",borderRadius:12,background:"white",border:"1.5px solid #e5e7eb",fontSize:13,color:"#6b7280",cursor:"pointer"}}>やめる</button>
            <button onClick={reset} style={{padding:"9px 14px",borderRadius:12,background:"#ef4444",border:"none",fontSize:13,color:"white",fontWeight:700,cursor:"pointer"}}>リセット</button>
          </div>
        )}

        <div style={{textAlign:"center",marginTop:32,color:"#d1d5db",fontSize:12}}>スマホを置いて、流れに乗ろう 🌿</div>
      </div>
    </div>
  );
}
