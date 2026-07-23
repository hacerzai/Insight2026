"use client";

import { useEffect, useRef, useState } from "react";
import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import { QUIZ_QUESTIONS, type QuizCategory, type QuizDifficulty } from "./quiz-data";
import {
  CameraDiagnostics,
  CameraProvider,
  CameraStage as VisionStage,
  useCamera,
  type VisionFrame,
} from "./vision-camera";

type ModuleType = "AI-powered" | "Interactive Simulation" | "AI + Simulation";

interface ModuleInfo {
  id: string;
  priority: 1 | 2 | 3;
  group: "Physics" | "Biology" | "Chemistry" | "Computer Vision";
  title: string;
  classTopic: string;
  description: string;
  technology: string;
  type: ModuleType;
  icon: string;
}

const MODULES: ModuleInfo[] = [
  {id:"finger-counter",priority:1,group:"Computer Vision",title:"Finger Counter",classTopic:"Computer Vision Demo",description:"Count one or two hands, add numbers and explore binary fingers.",technology:"MediaPipe Hand Landmarker",type:"AI-powered",icon:"✋"},
  {id:"hand-explorer",priority:1,group:"Computer Vision",title:"Hand Landmark Explorer",classTopic:"AI & Robotics",description:"Inspect all 21 hand landmarks, joint angles, handedness and pinch distance.",technology:"MediaPipe Hand Landmarker",type:"AI-powered",icon:"⌁"},
  {id:"pose-intelligence",priority:1,group:"Computer Vision",title:"Pose Intelligence",classTopic:"Computer Vision Demo",description:"Copy poses and count squats or jumping jacks with landmark state machines.",technology:"MediaPipe Pose Landmarker",type:"AI-powered",icon:"⛹"},
  {id:"force-motion",priority:2,group:"Physics",title:"Force & Laws of Motion",classTopic:"Class 9 · Force and Laws of Motion",description:"Push a block with a tracked fingertip and compare mass, friction and acceleration.",technology:"Hand tracking + physics",type:"AI + Simulation",icon:"➜"},
  {id:"reflection",priority:2,group:"Physics",title:"Reflection of Light",classTopic:"Class 10 · Light",description:"Aim a ray, rotate a mirror and test the law of reflection with exact geometry.",technology:"Canvas geometry + hand pointer",type:"Interactive Simulation",icon:"◭"},
  {id:"electricity",priority:2,group:"Physics",title:"Electricity & Circuits",classTopic:"Class 10 · Electricity",description:"Build a circuit, place meters and calculate current and power.",technology:"Gesture drag + circuit rules",type:"AI + Simulation",icon:"ϟ"},
  {id:"atomic-structure",priority:2,group:"Chemistry",title:"Atomic Structure",classTopic:"Class 9 · Structure of the Atom",description:"Build the first 20 elements, ions and isotopes using a Bohr-style model.",technology:"Gesture builder + rule engine",type:"AI + Simulation",icon:"⚛"},
  {id:"cell-explorer",priority:2,group:"Biology",title:"Cell Explorer",classTopic:"Class 9 · Fundamental Unit of Life",description:"Point to living organelles, compare plant and animal cells, and answer challenges.",technology:"Hand pointer + interactive diagram",type:"AI + Simulation",icon:"◉"},
  {id:"work-energy",priority:3,group:"Physics",title:"Work, Energy & Power",classTopic:"Class 9 · Work and Energy",description:"Lift a virtual mass and watch potential energy transform into kinetic energy.",technology:"Hand tracking + energy simulation",type:"AI + Simulation",icon:"↥"},
  {id:"human-eye",priority:3,group:"Physics",title:"The Human Eye",classTopic:"Class 10 · Human Eye and Colourful World",description:"Explore eye landmarks, blinks and optical correction for common vision defects.",technology:"Face landmarks + ray simulation",type:"AI + Simulation",icon:"◉"},
  {id:"skeleton",priority:3,group:"Biology",title:"Human Skeleton",classTopic:"Biology · Movement and Joints",description:"Overlay an estimated pose skeleton and discover major bones and joint types.",technology:"MediaPipe Pose Landmarker",type:"AI-powered",icon:"🦴"},
  {id:"digestive",priority:3,group:"Biology",title:"Digestive System",classTopic:"Class 10 · Life Processes",description:"Follow food through the alimentary canal and control the digestive timeline.",technology:"Gesture timeline + animation",type:"AI + Simulation",icon:"⌇"},
  {id:"circulatory",priority:3,group:"Biology",title:"Circulatory System",classTopic:"Class 10 · Transportation",description:"Trace pulmonary and systemic circulation through a four-chambered heart.",technology:"Interactive educational animation",type:"Interactive Simulation",icon:"♥"},
  {id:"respiratory",priority:3,group:"Biology",title:"Respiratory System",classTopic:"Class 10 · Respiration",description:"Raise and lower your hands to control inhalation, exhalation and gas exchange.",technology:"Pose control + animation",type:"AI + Simulation",icon:"♢"},
  {id:"chemical-reactions",priority:3,group:"Chemistry",title:"Chemical Reactions",classTopic:"Class 10 · Chemical Reactions and Equations",description:"Safely combine symbolic reactants and classify balanced reactions.",technology:"Gesture interaction + reaction rules",type:"AI + Simulation",icon:"⚗"},
  {id:"carbon-compounds",priority:3,group:"Chemistry",title:"Carbon Compounds",classTopic:"Class 10 · Carbon and Its Compounds",description:"Build molecules while a valency engine checks every bond.",technology:"Gesture builder + valency rules",type:"AI + Simulation",icon:"⬡"},
  {id:"face-intelligence",priority:3,group:"Computer Vision",title:"Face Intelligence",classTopic:"Computer Vision Demo",description:"Explore face geometry, blinks, mouth movement and head orientation safely.",technology:"MediaPipe Face Landmarker",type:"AI-powered",icon:"◎"},
];

const groups = ["Physics", "Biology", "Chemistry", "Computer Vision"] as const;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const distance = (a: NormalizedLandmark, b: NormalizedLandmark) => Math.hypot(a.x - b.x, a.y - b.y, (a.z ?? 0) - (b.z ?? 0));
const jointAngle = (a: NormalizedLandmark, b: NormalizedLandmark, c: NormalizedLandmark) => {
  const ab = {x:a.x-b.x,y:a.y-b.y,z:(a.z??0)-(b.z??0)};
  const cb = {x:c.x-b.x,y:c.y-b.y,z:(c.z??0)-(b.z??0)};
  const dot = ab.x*cb.x+ab.y*cb.y+ab.z*cb.z;
  const mag = Math.hypot(ab.x,ab.y,ab.z)*Math.hypot(cb.x,cb.y,cb.z);
  return mag ? Math.acos(clamp(dot/mag,-1,1))*180/Math.PI : 0;
};

function countFingers(hand: NormalizedLandmark[]) {
  if (hand.length < 21) return {total:0, count:0, states:[false,false,false,false,false]};
  const palmScale = Math.max(distance(hand[0], hand[9]), .001);
  const extended = (mcp:number,pip:number,tip:number) => jointAngle(hand[mcp],hand[pip],hand[tip]) > 155 && distance(hand[tip],hand[0]) > distance(hand[pip],hand[0]) * 1.08;
  const thumbAngle = jointAngle(hand[1], hand[2], hand[4]);
  const thumb = thumbAngle > 145 && distance(hand[4], hand[5]) > palmScale * .45;
  const states = [thumb, extended(5,6,8), extended(9,10,12), extended(13,14,16), extended(17,18,20)];
  const total = states.filter(Boolean).length;
  return {total, count:total, states};
}

function HandDock({instruction,onFrame}:{instruction:string;onFrame:(frame:VisionFrame)=>void}){
  return <div className="hand-dock"><VisionStage kind="hand" compact onFrame={onFrame} cameraFunction={`Camera function: ${instruction.toLowerCase()}.`}/><div><small>LIVE HAND CONTROL</small><b>{instruction}</b><span>Pinch to grab. Mouse/touch remains available as fallback.</span></div></div>
}

function SciencePlatformContent(){
  const [active,setActive]=useState<string|null>(null);
  const [sound,setSound]=useState(false);
  const [exhibition,setExhibition]=useState(false);
  const [advanced,setAdvanced]=useState(false);
  const [attract,setAttract]=useState(false);
  const idleRef=useRef<ReturnType<typeof setTimeout>|null>(null);

  useEffect(()=>{
    const reset=()=>{if(idleRef.current)clearTimeout(idleRef.current);setAttract(false);if(exhibition)idleRef.current=setTimeout(()=>{setActive(null);setAttract(true);},90000);};
    ["pointerdown","keydown","mousemove"].forEach(e=>window.addEventListener(e,reset,{passive:true})); reset();
    return()=>["pointerdown","keydown","mousemove"].forEach(e=>window.removeEventListener(e,reset));
  },[exhibition]);

  useEffect(()=>{if("serviceWorker" in navigator)navigator.serviceWorker.register("/sw.js").catch(()=>undefined)},[]);

  const toggleExhibition=async()=>{const next=!exhibition;setExhibition(next);if(next&&!document.fullscreenElement)await document.documentElement.requestFullscreen?.();if(!next&&document.fullscreenElement)await document.exitFullscreen?.();};
  const openRobot=()=>document.getElementById("beat-robot")?.scrollIntoView({behavior:"smooth",block:"start"});
  return <section className={`science-platform ${exhibition?"exhibition":""}`} id="science-lab">
    <nav className="lab-nav"><a href="#science-lab" className="lab-brand"><span>V</span><b>VISION AI</b> SCIENCE LAB</a><div className="lab-links"><button onClick={openRobot}>BEAT THE ROBOT</button><a href="#physics">PHYSICS</a><a href="#biology">BIOLOGY</a><a href="#chemistry">CHEMISTRY</a><a href="#computer-vision">AI VISION</a></div><div className="lab-tools"><button onClick={()=>setSound(!sound)} aria-label="Toggle sound">{sound?"🔊":"🔇"}</button><button onClick={toggleExhibition}>⛶ EXHIBITION</button><button onClick={()=>setAdvanced(!advanced)}>⚙</button></div></nav>
    {advanced&&<div className="advanced-panel"><b>ADVANCED STATUS</b><span>Camera: one shared stream across the active module</span><span>Models: on demand · GPU-first · CPU fallback</span><span>Processing: 640 × 480 · local browser inference</span><span>Diagnostics are visible in the lower-left corner</span></div>}
    <header className="lab-hero"><div><p>INSIGHT 2026 · AI CATEGORY</p><h2>Learn science by<br/><em>moving through it.</em></h2><span>Computer vision turns your hands, face and pose into controls for accurate Class 9–10 science experiences.</span><div className="hero-actions"><a href="#priority-one">EXPLORE EXPERIENCES</a><button onClick={openRobot}>BEAT THE ROBOT ↓</button></div></div><div className="hero-orbit" aria-hidden="true"><i/><i/><i/><b>AI</b><span>LANDMARKS</span><span>SIMULATION</span><span>ROBOTICS</span></div></header>
    <section className="featured-strip" id="priority-one"><div className="robot-module-card"><span>01</span><b>Beat the Robot</b><small>MediaPipe hand AI → Arduino servos</small><p>Play Rock–Paper–Scissors against TinyBot and send its move to the physical two-servo hand.</p><button onClick={openRobot}>PLAY MAIN ATTRACTION →</button></div>{MODULES.filter(m=>m.priority===1).map(m=><ModuleCard key={m.id} module={m} onOpen={setActive}/>) }<QuizCard onOpen={()=>setActive("quiz")}/></section>
    {groups.map(group=><section className="module-section" id={group.toLowerCase().replace(" ","-")} key={group}><div className="section-heading"><p>{group.toUpperCase()} AI LAB</p><h3>{group}</h3><span>{group==="Computer Vision"?"See what landmark models estimate—and what they cannot know.":"Explore NCERT science with live controls, exact rules and honest AI labels."}</span></div><div className="module-grid">{MODULES.filter(m=>m.group===group&&m.priority!==1).map(m=><ModuleCard key={m.id} module={m} onOpen={setActive}/>)}</div></section>)}
    <section className="system-section"><div><p>HOW THE SYSTEM WORKS</p><h3>From camera frame to physical robot.</h3></div><div className="pipeline">{["CAMERA","MEDIAPIPE","LANDMARKS","RULES + SIMULATION","ARDUINO","2 SERVOS"].map((x,i)=><span key={x}><b>0{i+1}</b>{x}</span>)}</div><button onClick={()=>setActive("system")}>OPEN SYSTEM EXPLAINER</button></section>
    <footer><b>VISION AI SCIENCE LAB</b><span>Learn Science Through Artificial Intelligence</span><small>Camera frames are processed locally. No identity or emotion recognition.</small></footer>
    {active&&<LabShell id={active} onClose={()=>setActive(null)}/>} 
    {attract&&<AttractScreen onStart={()=>setAttract(false)}/>} 
    <CameraDiagnostics visible={advanced}/>
  </section>;
}

function ModuleCard({module,onOpen}:{module:ModuleInfo;onOpen:(id:string)=>void}){
  return <article className={`module-card priority-${module.priority}`}><div className="card-top"><span>{module.icon}</span><i>{module.type}</i></div><small>{module.classTopic}</small><h4>{module.title}</h4><p>{module.description}</p><div><b>{module.technology}</b><button onClick={()=>onOpen(module.id)}>START EXPERIENCE →</button></div></article>;
}
function QuizCard({onOpen}:{onOpen:()=>void}){return <article className="module-card quiz-card"><div className="card-top"><span>?</span><i>GESTURE QUIZ</i></div><small>CLASS 9–10 · ALL SUBJECTS</small><h4>AI Science Quiz</h4><p>64 original questions with filters, explanations, score, streak and timer.</p><div><b>Hand gestures + quiz engine</b><button onClick={onOpen}>START QUIZ →</button></div></article>}

function LabShell({id,onClose}:{id:string;onClose:()=>void}){
  const selectedModule=MODULES.find(m=>m.id===id);
  const title=id==="quiz"?"AI Science Quiz":id==="system"?"How the System Works":selectedModule?.title??id;
  useEffect(()=>{const key=(e:KeyboardEvent)=>{if(e.key==="Escape")onClose()};window.addEventListener("keydown",key);return()=>window.removeEventListener("keydown",key)},[onClose]);
  return <div className="lab-overlay" role="dialog" aria-modal="true"><header><button onClick={onClose}>← HOME</button><div><small>{selectedModule?.classTopic??"VISION AI SCIENCE LAB"}</small><h2>{title}</h2></div><button onClick={()=>window.location.reload()}>↻ RESTART</button><button onClick={onClose}>EXIT ×</button></header><main><ModuleExperience id={id}/></main></div>;
}

function ModuleExperience({id}:{id:string}){
  if(id==="finger-counter")return <FingerCounter/>;
  if(id==="hand-explorer")return <HandExplorer/>;
  if(id==="pose-intelligence")return <PoseLab mode="intelligence"/>;
  if(id==="force-motion")return <ForceMotion/>;
  if(id==="reflection")return <ReflectionLab/>;
  if(id==="electricity")return <ElectricityLab/>;
  if(id==="atomic-structure")return <AtomicLab/>;
  if(id==="cell-explorer")return <CellLab/>;
  if(id==="work-energy")return <EnergyLab/>;
  if(id==="human-eye")return <EyeLab/>;
  if(id==="skeleton")return <PoseLab mode="skeleton"/>;
  if(id==="digestive")return <DigestiveLab/>;
  if(id==="circulatory")return <CirculatoryLab/>;
  if(id==="respiratory")return <PoseLab mode="respiratory"/>;
  if(id==="chemical-reactions")return <ReactionLab/>;
  if(id==="carbon-compounds")return <CarbonLab/>;
  if(id==="face-intelligence")return <FaceLab/>;
  if(id==="quiz")return <QuizLab/>;
  return <SystemLab/>;
}

function LabIntro({objective,ai,limit,children}:{objective:string;ai:string;limit:string;children?:React.ReactNode}){return <aside className="lab-intro"><div><small>LEARNING OBJECTIVE</small><p>{objective}</p></div><div><small>WHAT AI IS DOING</small><p>{ai}</p></div><div><small>LIMITATION</small><p>{limit}</p></div>{children}</aside>}

function FingerCounter(){
  const [hands,setHands]=useState<{count:number;states:boolean[];handedness?:string}[]>([]);const [mode,setMode]=useState("count");const [target,setTarget]=useState(7);const [seconds,setSeconds]=useState(30);
  useEffect(()=>{if(mode!=="challenge")return;const t=setInterval(()=>setSeconds(s=>Math.max(0,s-1)),1000);return()=>clearInterval(t)},[mode]);
  const total=hands.reduce((s,h)=>s+h.count,0);const binary=hands.flatMap(h=>h.states).reduce((s,on,i)=>s+(on?2**i:0),0);
  return <div className="experience two-column"><div><div className="mode-tabs">{["count","addition","binary","challenge"].map(x=><button className={mode===x?"active":""} onClick={()=>{setMode(x);setSeconds(30);setTarget(Math.floor(Math.random()*10)+1)}} key={x}>{x}</button>)}</div><VisionStage kind="hand" onFrame={f=>setHands(f.landmarks.map((h,i)=>({...countFingers(h),handedness:i===0?f.handedness:undefined})))}/><div className="counter-display"><small>{mode==="binary"?"BINARY VALUE":mode==="challenge"?`SHOW ${target} · ${seconds}s`:"FINGERS RAISED"}</small><strong>{mode==="binary"?binary:total}</strong><span>{hands.map((h,i)=>`${h.handedness??`Hand ${i+1}`}: ${h.count}`).join(" + ")||"Show one or two hands"}</span>{mode==="challenge"&&total===target&&<b className="success">TARGET COMPLETE</b>}</div></div><LabIntro objective="Connect finger geometry with real-time computer-vision output." ai="A pretrained model estimates 21 points per hand. Joint angles—not only vertical positions—determine extended fingers." limit="Rotation, blur and hidden fingers can reduce accuracy. This is not sign-language translation."><div className="finger-states">{["Thumb","Index","Middle","Ring","Little"].map((n,i)=><span key={n} className={hands[0]?.states[i]?"on":""}>{n}</span>)}</div></LabIntro></div>
}

function HandExplorer(){
  const [frame,setFrame]=useState<VisionFrame>({landmarks:[],fps:0});const hand=frame.landmarks[0];const pinch=hand?distance(hand[4],hand[8]):0;
  return <div className="experience two-column"><div><VisionStage kind="hand" onFrame={setFrame}/><div className="metric-grid"><span><small>HANDEDNESS</small><b>{frame.handedness??"—"}</b></span><span><small>PALM ORIENTATION</small><b>{hand?(hand[5].x>hand[17].x?"LEFT-TILTED":"RIGHT-TILTED"):"—"}</b></span><span><small>PINCH DISTANCE</small><b>{hand?pinch.toFixed(3):"—"}</b></span><span><small>LIVE FPS</small><b>{frame.fps}</b></span></div></div><LabIntro objective="Inspect the numerical landmarks used to build gesture interfaces." ai="MediaPipe predicts wrist, palm and finger-joint coordinates; application rules calculate angles and pinch distance." limit="Coordinates describe visible image geometry, not muscle strength or exact physical distance."><div className="coordinate-list">{hand?.slice(0,8).map((p,i)=><code key={i}>{i.toString().padStart(2,"0")} · x {p.x.toFixed(3)} · y {p.y.toFixed(3)} · z {(p.z??0).toFixed(3)}</code>)??<p>Start the camera to inspect coordinates.</p>}</div><KnowledgeCheck questions={["Why are 21 points useful?","What causes occlusion?","Where could pinch detection help?"]}/></LabIntro></div>
}

function ForceMotion(){
  const [mass,setMass]=useState(2);
  const [friction,setFriction]=useState(.15);
  const [x,setX]=useState(12);
  const [velocity,setVelocity]=useState(0);
  const [force,setForce]=useState(0);
  const lastRef=useRef<number|null>(null);
  const grabbedRef=useRef<{offset:number}|null>(null);
  const openPalmFrames=useRef(0);
  const {setGrabbedObject}=useCamera();
  const target=82;
  const moveBlock=(next:number)=>{
    const previous=lastRef.current;
    if(previous!==null){
      const delta=next-previous;
      const nextForce=clamp(delta*18,-55,55);
      setForce(nextForce);
      setVelocity(delta/.032);
    }
    lastRef.current=next;
    setX(clamp(next,4,94));
  };
  const onHandFrame=(frame:VisionFrame)=>{
    const hand=frame.landmarks[0];
    const interaction=frame.interaction;
    if(!hand||!interaction)return;
    if(countFingers(hand).total>=5){
      openPalmFrames.current+=1;
      if(openPalmFrames.current===12){setX(12);setVelocity(0);setForce(0)}
    }else openPalmFrames.current=0;
    const pointer=interaction.x*100;
    if(interaction.phase==="start"&&Math.abs(pointer-x)<13){
      grabbedRef.current={offset:x-pointer};
      setGrabbedObject("force block");
    }
    if(interaction.active&&grabbedRef.current)moveBlock(pointer+grabbedRef.current.offset);
    if(interaction.phase==="end"&&grabbedRef.current){
      grabbedRef.current=null;
      setGrabbedObject("");
    }
    if(!interaction.active&&!grabbedRef.current&&Math.abs(pointer-x)<10){
      const previous=lastRef.current;
      if(previous!==null&&Math.abs(pointer-previous)>0.15)moveBlock(x+(pointer-previous)*.28);
      lastRef.current=pointer;
    }
  };
  useEffect(()=>{
    const timer=setInterval(()=>{
      if(grabbedRef.current)return;
      setVelocity(current=>{
        const next=current*(1-friction*.18);
        setX(position=>clamp(position+next*.0018,4,94));
        return Math.abs(next)<.01?0:next;
      });
      setForce(current=>current*.78);
    },32);
    return()=>clearInterval(timer);
  },[friction]);
  return <div className="experience"><LabIntro objective="Relate force, mass, acceleration, friction and displacement." ai="Camera function: tracks your fingertip to push the block and uses a real pinch lock to pick it up." limit="Force is estimated from screen movement and is not a real measurement in newtons."/><HandDock instruction="Push with your fingertip, or pinch the block to grab and drag it" onFrame={onHandFrame}/><div className="physics-stage" onPointerMove={event=>{if(event.buttons){const rect=event.currentTarget.getBoundingClientRect();moveBlock((event.clientX-rect.left)/rect.width*100)}}}><div className="target-zone" style={{left:`${target}%`}}>TARGET</div><div className={`block ${grabbedRef.current?"grabbed":""}`} style={{left:`${x}%`}}><b>{mass} kg</b></div><i className="force-vector" style={{left:`${x}%`,width:`${Math.abs(force)}px`,transform:`scaleX(${force<0?-1:1})`}}>F</i><div className="surface"/></div><div className="control-grid"><label>Mass <input type="range" min="1" max="10" value={mass} onChange={e=>setMass(+e.target.value)}/><b>{mass} kg</b></label><label>Friction <input type="range" min="0" max="1" step=".05" value={friction} onChange={e=>setFriction(+e.target.value)}/><b>{friction.toFixed(2)}</b></label><span>Estimated force <b>{force.toFixed(1)}</b></span><span>Velocity <b>{velocity.toFixed(2)}</b></span><span>Displacement <b>{(x-12).toFixed(1)}</b></span><span>Acceleration a = F/m <b>{(force/mass).toFixed(2)}</b></span></div><div className="formula-ribbon"><b>F = ma</b><b>p = mv</b><b>Δx = x − x₀</b><span>{Math.abs(x-target)<5?"Challenge complete — target reached":"Open palm for 12 frames to reset"}</span></div></div>
}

function EnergyLab(){const [mass,setMass]=useState(2);const [height,setHeight]=useState(2);const [released,setReleased]=useState(false);const pinchingRef=useRef(false);const g=9.8;const pe=mass*g*height;const ke=released?pe*.82:0;const lift=(f:VisionFrame)=>{const hand=f.landmarks[0];if(!hand)return;const pinching=distance(hand[4],hand[8])<.055;if(pinching){const next=clamp((1-hand[8].y)*5.5,.5,5);setHeight(old=>Math.abs(old-next)>.04?Number(next.toFixed(1)):old);setReleased(false)}else if(pinchingRef.current)setReleased(true);pinchingRef.current=pinching};return <div className="experience"><LabIntro objective="Observe energy transfer during lifting and falling." ai="Hand landmarks estimate pinch and vertical screen displacement; pinch-and-lift directly controls the virtual object." limit="Height and power are screen-space educational estimates, not laboratory measurements."/><HandDock instruction="Pinch the object, lift your hand, then open your fingers to release it" onFrame={lift}/><div className="energy-stage"><div className={`energy-object ${released?"falling":""}`} style={{bottom:`${40+height*45}px`}} onPointerDown={()=>setReleased(false)}>▣</div><div className="height-rule">{height.toFixed(1)} m</div></div><div className="control-grid"><label>Virtual mass<input type="range" min="1" max="10" value={mass} onChange={e=>setMass(+e.target.value)}/><b>{mass} kg</b></label><label>Height<input type="range" min=".5" max="5" step=".1" value={height} onChange={e=>{setHeight(+e.target.value);setReleased(false)}}/><b>{height} m</b></label><button onClick={()=>setReleased(true)}>RELEASE OBJECT</button><span>Work done <b>{pe.toFixed(1)} J</b></span></div><div className="energy-bars"><span style={{"--value":`${released?18:100}%`} as React.CSSProperties}>PE {released?(pe*.18).toFixed(1):pe.toFixed(1)} J</span><span style={{"--value":`${released?82:0}%`} as React.CSSProperties}>KE {ke.toFixed(1)} J</span><span style={{"--value":"8%"} as React.CSSProperties}>AIR RESISTANCE</span></div><div className="formula-ribbon"><b>PE = mgh</b><b>KE = ½mv²</b><b>Power = Work / time</b></div></div>}

function ReflectionLab(){const [angle,setAngle]=useState(35);const [mirror,setMirror]=useState(0);const [normal,setNormal]=useState(true);const [target,setTarget]=useState(45);const a=(angle+mirror)*Math.PI/180;const cx=50,cy=62;const len=43;const ix=cx-Math.sin(a)*len,iy=cy-Math.cos(a)*len;const rx=cx+Math.sin(a)*len,ry=cy-Math.cos(a)*len;return <div className="experience"><LabIntro objective="Verify that incidence angle equals reflection angle." ai="A tracked index fingertip replaces the mouse as the light-source pointer when the camera is active." limit="The ray paths are exact screen geometry; the ray simulation itself is not AI."/><HandDock instruction="Move your index finger left/right to aim the ray" onFrame={f=>{const h=f.landmarks[0];if(h)setAngle(Math.round(5+(1-h[8].x)*75))}}/><div className="ray-stage"><svg viewBox="0 0 100 100"><line x1="8" y1={cy} x2="92" y2={cy} className="mirror-line" transform={`rotate(${mirror} ${cx} ${cy})`}/>{normal&&<line x1={cx} y1="8" x2={cx} y2="95" className="normal-line"/>}<line x1={ix} y1={iy} x2={cx} y2={cy} className="incident-ray"/><line x1={cx} y1={cy} x2={rx} y2={ry} className="reflected-ray"/><circle cx={ix} cy={iy} r="3" className="light-source"/><path d={`M ${cx-10} ${cy-1} A 10 10 0 0 1 ${cx-Math.sin(a)*10} ${cy-Math.cos(a)*10}`} className="angle-arc"/></svg><div className="law-readout"><b>∠i = {angle}°</b><i>=</i><b>∠r = {angle}°</b></div></div><div className="control-grid"><label>Incidence angle<input type="range" min="5" max="80" value={angle} onChange={e=>setAngle(+e.target.value)}/><b>{angle}°</b></label><label>Mirror rotation<input type="range" min="-25" max="25" value={mirror} onChange={e=>setMirror(+e.target.value)}/><b>{mirror}°</b></label><button onClick={()=>setNormal(!normal)}>{normal?"HIDE":"SHOW"} NORMAL</button><button onClick={()=>setTarget([25,35,45,55,65][Math.floor(Math.random()*5)])}>NEW CHALLENGE</button><span>Target <b>{target}°</b></span><span className={angle===target?"success":""}>{angle===target?"ANGLE MATCHED":"Adjust the incident ray"}</span></div></div>}

function ElectricityLab(){const [voltage,setVoltage]=useState(9);const [resistance,setResistance]=useState(6);const [closed,setClosed]=useState(false);const [series,setSeries]=useState(false);const [ammeter,setAmmeter]=useState(false);const [voltmeter,setVoltmeter]=useState(false);const pinchLock=useRef(false);const r=series?resistance*2:resistance;const current=closed?voltage/r:0;const gestureBuild=(f:VisionFrame)=>{const h=f.landmarks[0];if(!h)return;const pinching=distance(h[4],h[8])<.045;if(pinching&&!pinchLock.current){pinchLock.current=true;if(!ammeter)setAmmeter(true);else if(!voltmeter)setVoltmeter(true);else setClosed(v=>!v)}if(!pinching)pinchLock.current=false};return <div className="experience"><LabIntro objective="Build a complete circuit and connect meters correctly." ai="Pinch gestures place the next required component; circuit validity and Ohm’s law are deterministic rules." limit="Displayed voltage and current are simulated values, not physical measurements."/><HandDock instruction="Pinch: place ammeter → place voltmeter → close switch" onFrame={gestureBuild}/><div className={`circuit-board ${closed?"closed":""}`}><button className="cell">+ | | −<small>{voltage} V CELL</small></button><button className="switch" onClick={()=>setClosed(!closed)}>{closed?"CLOSED":"OPEN"}<small>SWITCH</small></button><button className="bulb">💡<small>{current>0?"GLOWING":"OFF"}</small></button><button className="resistor">〰<small>{r} Ω</small></button><button className={ammeter?"meter placed":"meter"} onClick={()=>setAmmeter(!ammeter)}>A<small>SERIES</small></button><button className={voltmeter?"meter placed":"meter"} onClick={()=>setVoltmeter(!voltmeter)}>V<small>PARALLEL</small></button><div className="circuit-wire"><i/><i/><i/><i/></div>{closed&&<div className="electrons">••••••••••</div>}</div><div className="control-grid"><label>Voltage<input type="range" min="1" max="12" value={voltage} onChange={e=>setVoltage(+e.target.value)}/><b>{voltage} V</b></label><label>Resistance<input type="range" min="1" max="20" value={resistance} onChange={e=>setResistance(+e.target.value)}/><b>{resistance} Ω</b></label><button onClick={()=>setSeries(!series)}>{series?"2 RESISTORS SERIES":"1 RESISTOR"}</button><span>Current <b>{current.toFixed(2)} A</b></span><span>Power <b>{(voltage*current).toFixed(2)} W</b></span><span className={closed&&ammeter&&voltmeter?"success":""}>{closed&&ammeter&&voltmeter?"CIRCUIT CHALLENGE COMPLETE":"Place A, V and close switch"}</span></div><div className="formula-ribbon"><b>V = IR</b><b>P = VI</b>{closed&&r<2&&<strong>SHORT-CIRCUIT WARNING</strong>}</div></div>}

const elements=["—","Hydrogen","Helium","Lithium","Beryllium","Boron","Carbon","Nitrogen","Oxygen","Fluorine","Neon","Sodium","Magnesium","Aluminium","Silicon","Phosphorus","Sulfur","Chlorine","Argon","Potassium","Calcium"];
function AtomicLab(){const [p,setP]=useState(6);const [n,setN]=useState(6);const [e,setE]=useState(6);const pinchLock=useRef(false);const shells=[Math.min(e,2),Math.min(Math.max(e-2,0),8),Math.min(Math.max(e-10,0),8),Math.max(e-18,0)];const charge=p-e;const addParticle=(f:VisionFrame)=>{const h=f.landmarks[0];if(!h)return;const pinching=distance(h[4],h[8])<.045;if(pinching&&!pinchLock.current){pinchLock.current=true;const x=1-h[8].x;if(x<.33)setP(v=>Math.min(20,v+1));else if(x<.66)setN(v=>v+1);else setE(v=>v+1)}if(!pinching)pinchLock.current=false};return <div className="experience two-column"><div className="atom-builder"><HandDock instruction="Pinch left: proton · centre: neutron · right: electron" onFrame={addParticle}/><div className="atom"><div className="nucleus"><b>{p}p</b><span>{n}n</span></div>{shells.map((count,s)=><i className={`shell shell-${s+1}`} key={s}>{Array.from({length:count},(_,i)=><em key={i} style={{transform:`rotate(${i/count*360}deg) translateX(${55+s*35}px)`}}>−</em>)}</i>)}</div><div className="particle-controls"><span>Protons <button onClick={()=>setP(Math.max(1,p-1))}>−</button><b>{p}</b><button onClick={()=>setP(Math.min(20,p+1))}>+</button></span><span>Neutrons <button onClick={()=>setN(Math.max(0,n-1))}>−</button><b>{n}</b><button onClick={()=>setN(n+1)}>+</button></span><span>Electrons <button onClick={()=>setE(Math.max(0,e-1))}>−</button><b>{e}</b><button onClick={()=>setE(e+1)}>+</button></span></div></div><LabIntro objective="Relate proton number, mass number, charge and electronic configuration." ai="Hand pinch places particles; the element update uses chemistry rules, not AI." limit="This Bohr-style shell picture is a simplified school model, not a scale drawing of an atom."><div className="element-card"><small>ELEMENT IDENTITY</small><h3>{elements[p]??"Beyond first 20"}</h3><span>Atomic number <b>{p}</b></span><span>Mass number <b>{p+n}</b></span><span>Charge <b>{charge>0?`+${charge}`:charge}</b></span><span>Configuration <b>{shells.filter(x=>x).join(", ")}</b></span></div><div className="challenge-row">{[[6,6,6,"Carbon"],[11,12,11,"Sodium"],[17,18,17,"Chlorine"]].map(([pp,nn,ee,name])=><button key={String(name)} onClick={()=>{setP(Number(pp));setN(Number(nn));setE(Number(ee))}}>BUILD {name}</button>)}</div></LabIntro></div>}

const organelles=[{name:"Nucleus",x:52,y:48,fn:"Controls cell activities and contains genetic material."},{name:"Mitochondria",x:31,y:66,fn:"Release usable energy during aerobic respiration."},{name:"Vacuole",x:68,y:57,fn:"Stores cell sap; usually large and central in plant cells."},{name:"Chloroplast",x:30,y:35,fn:"Contains chlorophyll and carries out photosynthesis."},{name:"Golgi apparatus",x:72,y:32,fn:"Modifies, sorts and packages cell products."},{name:"Ribosomes",x:46,y:73,fn:"Sites of protein synthesis."},{name:"Endoplasmic reticulum",x:54,y:29,fn:"Membrane network that transports materials."},{name:"Cytoplasm",x:42,y:50,fn:"Fluid medium where many chemical reactions occur."}];
function CellLab(){const [plant,setPlant]=useState(true);const [selected,setSelected]=useState(organelles[0]);const [quiz,setQuiz]=useState(false);const [target,setTarget]=useState(organelles[3]);const choose=(o:typeof organelles[number])=>{setSelected(o);if(quiz&&o.name===target.name)setTarget(organelles[Math.floor(Math.random()*organelles.length)])};const point=(f:VisionFrame)=>{const h=f.landmarks[0];if(!h)return;const x=(1-h[8].x)*100,y=h[8].y*100;const candidates=organelles.filter(o=>plant||o.name!=="Chloroplast");const nearest=candidates.reduce((a,b)=>Math.hypot(a.x-x,a.y-y)<Math.hypot(b.x-x,b.y-y)?a:b);if(Math.hypot(nearest.x-x,nearest.y-y)<13)choose(nearest)};return <div className="experience two-column"><div><div className="mode-tabs"><button className={plant?"active":""} onClick={()=>setPlant(true)}>PLANT CELL</button><button className={!plant?"active":""} onClick={()=>setPlant(false)}>ANIMAL CELL</button><button className={quiz?"active":""} onClick={()=>setQuiz(!quiz)}>QUIZ MODE</button></div><HandDock instruction="Point your index finger at an organelle" onFrame={point}/><div className={`cell-diagram ${plant?"plant":"animal"}`}><span className="cell-wall">CELL {plant?"WALL":"MEMBRANE"}</span>{organelles.filter(o=>plant||o.name!=="Chloroplast").map(o=><button key={o.name} style={{left:`${o.x}%`,top:`${o.y}%`}} className={selected.name===o.name?"active":""} onClick={()=>choose(o)} title={o.name}><i/></button>)}</div></div><LabIntro objective="Identify organelles and compare plant and animal cells." ai="A hand landmark pointer selects organelle hotspots; the diagram and facts are authored educational content." limit="Cell structures are stylised and not drawn to microscopic scale."><div className="organelle-readout"><small>{quiz?`POINT TO: ${target.name}`:"SELECTED ORGANELLE"}</small><h3>{selected.name}</h3><p>{selected.fn}</p></div><KnowledgeCheck questions={["Why do plant cells need chloroplasts?","Which structure releases energy?","What protects a plant cell?"]}/></LabIntro></div>}

function PoseLab({mode}:{mode:"intelligence"|"skeleton"|"respiratory"}){
  const [frame,setFrame]=useState<VisionFrame>({landmarks:[],fps:0});
  const [squats,setSquats]=useState(0);
  const [jacks,setJacks]=useState(0);
  const squatState=useRef<"standing"|"down">("standing");
  const jackState=useRef<"closed"|"open">("closed");
  const pose=frame.landmarks[0];
  const visible=(index:number)=>(pose?.[index]?.visibility??0)>.45;
  const leftElbow=pose&&visible(11)&&visible(13)&&visible(15)?jointAngle(pose[11],pose[13],pose[15]):0;
  const rightElbow=pose&&visible(12)&&visible(14)&&visible(16)?jointAngle(pose[12],pose[14],pose[16]):0;
  const knee=pose&&visible(23)&&visible(25)&&visible(27)&&visible(24)&&visible(26)&&visible(28)
    ?(jointAngle(pose[23],pose[25],pose[27])+jointAngle(pose[24],pose[26],pose[28]))/2:0;
  const armsUp=Boolean(pose&&visible(15)&&visible(16)&&pose[15].y<pose[11].y&&pose[16].y<pose[12].y);
  const legsWide=Boolean(pose&&visible(27)&&visible(28)&&Math.abs(pose[27].x-pose[28].x)>.28);
  const tPose=Boolean(pose&&leftElbow>155&&rightElbow>155&&Math.abs(pose[15].y-pose[11].y)<.12&&Math.abs(pose[16].y-pose[12].y)<.12);
  const leftArmRaised=Boolean(pose&&visible(15)&&pose[15].y<pose[11].y-.1);
  const rightArmRaised=Boolean(pose&&visible(16)&&pose[16].y<pose[12].y-.1);
  useEffect(()=>{
    if(!pose||knee===0)return;
    if(squatState.current==="standing"&&knee<112)squatState.current="down";
    else if(squatState.current==="down"&&knee>158){squatState.current="standing";setSquats(value=>value+1)}
    if(jackState.current==="closed"&&armsUp&&legsWide)jackState.current="open";
    else if(jackState.current==="open"&&!armsUp&&!legsWide){jackState.current="closed";setJacks(value=>value+1)}
  },[pose,knee,armsUp,legsWide]);
  const inhaling=armsUp;
  const cameraFunction=mode==="skeleton"
    ?"Camera function: estimates 33 pose landmarks and draws an educational skeleton."
    :mode==="respiratory"
      ?"Camera function: estimates body landmarks; raised hands control inhalation."
      :"Camera function: estimates 33 pose landmarks and measures movement states.";
  return <div className={`experience two-column pose-${mode}`}><div><VisionStage kind="pose" cameraFunction={cameraFunction} onFrame={setFrame}/>{mode==="intelligence"&&<><div className="pose-challenges"><span className={tPose?"complete":""}>T-POSE {tPose?"✓":"—"}</span><span className={leftArmRaised?"complete":""}>LEFT ARM {leftArmRaised?"✓":"—"}</span><span className={rightArmRaised?"complete":""}>RIGHT ARM {rightArmRaised?"✓":"—"}</span></div><div className="metric-grid"><span><small>SQUATS</small><b>{squats}</b></span><span><small>JUMPING JACKS</small><b>{jacks}</b></span><span><small>LEFT / RIGHT ELBOW</small><b>{pose?`${leftElbow.toFixed(0)}° / ${rightElbow.toFixed(0)}°`:"—"}</b></span><span><small>KNEE ANGLE</small><b>{pose?`${knee.toFixed(0)}°`:"—"}</b></span></div></>}{mode==="skeleton"&&pose&&<div className="metric-grid"><span><small>LEFT ELBOW</small><b>{leftElbow.toFixed(0)}°</b></span><span><small>RIGHT ELBOW</small><b>{rightElbow.toFixed(0)}°</b></span><span><small>LEFT ARM</small><b>{leftArmRaised?"RAISED":"LOWERED"}</b></span><span><small>RIGHT ARM</small><b>{rightArmRaised?"RAISED":"LOWERED"}</b></span></div>}{mode==="respiratory"&&<div className={`lungs ${inhaling?"inhale":"exhale"}`}><i/><i/><b>{inhaling?"INHALING":"EXHALING"}</b><span>CO₂ ⇄ O₂ · ALVEOLI GAS EXCHANGE</span></div>}</div><LabIntro objective={mode==="skeleton"?"Connect visible body movement with major bones and joint types.":mode==="respiratory"?"Control a model of inhalation and exhalation with arm movement.":"Measure joint geometry and count movement using separate stable state machines."} ai={cameraFunction} limit={mode==="skeleton"?"Bone positions are educational approximations based on pose landmarks. The camera does not see bones.":mode==="respiratory"?"Arm gestures control the model; lung capacity is not measured.":"This is not medical posture analysis or exercise coaching."}>{mode==="skeleton"?<div className="bone-list">{["Skull · fixed joints","Clavicle · shoulder support","Humerus · upper arm","Radius + Ulna · forearm","Vertebral column · axial support","Pelvis · ball-and-socket hip","Femur · thigh","Patella · kneecap","Tibia + Fibula · lower leg"].map(x=><span key={x}>{x}</span>)}</div>:mode==="respiratory"?<div className="breath-steps"><b>{inhaling?"DIAPHRAGM CONTRACTS ↓":"DIAPHRAGM RELAXES ↑"}</b><span>{inhaling?"Chest volume increases · air enters":"Chest volume decreases · air exits"}</span></div>:<KnowledgeCheck questions={["Hold a T-pose","Raise left arm","Raise right arm","Perform one squat","Perform one jumping jack"]}/>}</LabIntro></div>
}

function EyeLab(){const [frame,setFrame]=useState<VisionFrame>({landmarks:[],fps:0});const [defect,setDefect]=useState("normal");const [power,setPower]=useState(0);const b=frame.blendshapes??{};const blink=((b.eyeBlinkLeft??0)+(b.eyeBlinkRight??0))/2;const gaze=(b.eyeLookOutLeft??0)>.35?"RIGHT":(b.eyeLookOutRight??0)>.35?"LEFT":"CENTRE";return <div className="experience two-column"><div><VisionStage kind="face" onFrame={setFrame}/><div className="metric-grid"><span><small>GAZE ESTIMATE</small><b>{gaze}</b></span><span><small>EYE OPENNESS</small><b>{Math.round((1-blink)*100)}%</b></span><span><small>BLINK</small><b>{blink>.55?"YES":"NO"}</b></span><span><small>STATUS</small><b>NON-MEDICAL</b></span></div></div><LabIntro objective="Link visible eye landmarks with the optics of image formation." ai="Face Landmarker estimates facial geometry and blendshape movement." limit="Gaze and blink values are approximate and not diagnostic or medical-grade."><div className={`eye-model ${defect}`}><div className="cornea"/><div className="iris"/><div className="lens"/><div className="retina"/><div className="optic-nerve"/><i className="eye-ray"/><b>{defect==="normal"?"IMAGE ON RETINA":defect==="myopia"?"IMAGE BEFORE RETINA":defect==="hypermetropia"?"IMAGE BEHIND RETINA":"FOCUS RANGE REDUCED"}</b></div><div className="mode-tabs">{["normal","myopia","hypermetropia","presbyopia"].map(x=><button key={x} className={defect===x?"active":""} onClick={()=>setDefect(x)}>{x}</button>)}</div><label>Corrective lens power <input type="range" min="-5" max="5" step=".25" value={power} onChange={e=>setPower(+e.target.value)}/><b>{power} D</b></label><p>{defect==="myopia"?"Concave lens":defect==="hypermetropia"?"Convex lens":defect==="presbyopia"?"Reading/bifocal correction":"No correction"}</p></LabIntro></div>}

function FaceLab(){const [f,setF]=useState<VisionFrame>({landmarks:[],fps:0});const b=f.blendshapes??{};const blink=((b.eyeBlinkLeft??0)+(b.eyeBlinkRight??0))/2;return <div className="experience two-column"><div><VisionStage kind="face" onFrame={setF}/><div className="metric-grid"><span><small>BLINK</small><b>{blink>.55?"DETECTED":"OPEN"}</b></span><span><small>MOUTH OPEN</small><b>{Math.round((b.jawOpen??0)*100)}%</b></span><span><small>SMILE SHAPE</small><b>{Math.round((((b.mouthSmileLeft??0)+(b.mouthSmileRight??0))/2)*100)}%</b></span><span><small>LIVE FPS</small><b>{f.fps}</b></span></div></div><LabIntro objective="Explore facial geometry and movement without identifying or judging people." ai="A face landmark model estimates mesh points and supported movement blendshapes." limit="Geometry cannot reveal intelligence, honesty, attention, character or true emotion. No identity is stored."><div className="safe-note"><b>RESPONSIBLE FACE AI</b><p>Applications include avatar animation, accessibility, video effects, AR filters and driver-interface research.</p></div><KnowledgeCheck questions={["Can geometry reveal character? No.","Does this identify you? No.","What affects tracking? Light and occlusion."]}/></LabIntro></div>}

const digestiveStages=["Mouth","Oesophagus","Stomach","Small intestine","Large intestine","Rectum"];
function DigestiveLab(){const [stage,setStage]=useState(0);const follow=(f:VisionFrame)=>{const hand=f.landmarks[0];if(hand)setStage(clamp(Math.round(hand[8].y*6-.25),0,5))};return <div className="experience"><LabIntro objective="Follow food and distinguish mechanical digestion, chemical digestion and absorption." ai="Your index fingertip scrubs the digestive path; the organ animation is an educational simulation." limit="The camera cannot see internal organs or diagnose digestion."/><HandDock instruction="Move your index finger from top to bottom to follow the food" onFrame={follow}/><div className="body-system"><div className="digestive-path">{digestiveStages.map((x,i)=><button className={i<=stage?"active":""} onClick={()=>setStage(i)} key={x}><i/>{x}</button>)}</div><div className="food-particle" style={{top:`${12+stage*14}%`}}>●</div></div><input className="timeline" type="range" min="0" max="5" value={stage} onChange={e=>setStage(+e.target.value)}/><div className="system-readout"><h3>{digestiveStages[stage]}</h3><p>{["Chewing begins mechanical digestion; saliva starts starch digestion.","Peristalsis moves the food bolus toward the stomach.","Muscular churning and gastric enzymes act on food.","Enzymes complete digestion; villi absorb most nutrients.","Water and salts are absorbed; remaining material becomes faeces.","Waste is stored briefly before removal."][stage]}</p></div></div>}

function CirculatoryLab(){const [beat,setBeat]=useState(true);const [rate,setRate]=useState(72);const [order,setOrder]=useState<string[]>([]);const palmLock=useRef(false);const stages=["Right atrium","Right ventricle","Lungs","Left atrium","Left ventricle","Body"];const add=(s:string)=>setOrder(o=>o.includes(s)?o:[...o,s]);const palm=(f:VisionFrame)=>{const hand=f.landmarks[0];const open=hand?countFingers(hand).total>=4:false;if(open&&!palmLock.current)setBeat(v=>!v);palmLock.current=open};return <div className="experience"><LabIntro objective="Trace pulmonary and systemic circulation through the four-chambered heart." ai="An open-palm gesture starts or stops the authored blood-flow simulation." limit="This module does not measure real heart rate."/><HandDock instruction="Show an open palm once to start or stop the heart" onFrame={palm}/><div className={`heart-stage ${beat?"beating":""}`} style={{"--beat":`${60/rate}s`} as React.CSSProperties}><div className="heart"><span>RA</span><span>LA</span><span>RV</span><span>LV</span></div><div className="blood-path red">O₂ ● ● ● → AORTA → BODY</div><div className="blood-path blue">CO₂ ● ● ● → LUNGS</div></div><div className="control-grid"><button onClick={()=>setBeat(!beat)}>{beat?"STOP":"START"} HEART</button><label>Simulated rate<input type="range" min="40" max="140" value={rate} onChange={e=>setRate(+e.target.value)}/><b>{rate} bpm</b></label></div><div className="sequence-challenge"><small>ARRANGE BLOOD FLOW</small><div>{stages.map(s=><button disabled={order.includes(s)} onClick={()=>add(s)} key={s}>{s}</button>)}</div><p>{order.join(" → ")||"Select the stages in order"}</p>{order.length===stages.length&&<b className={order.every((x,i)=>x===stages[i])?"success":"warning"}>{order.every((x,i)=>x===stages[i])?"CORRECT FLOW":"TRY AGAIN"}</b>}<button onClick={()=>setOrder([])}>RESET</button></div></div>}

const reactions=[{name:"Combination",eq:"2Mg + O₂ → 2MgO",result:"Bright light and heat; magnesium oxide forms.",effect:"heat"},{name:"Decomposition",eq:"CaCO₃ → CaO + CO₂",result:"A compound splits; carbon dioxide gas is represented.",effect:"gas"},{name:"Displacement",eq:"Zn + CuSO₄ → ZnSO₄ + Cu",result:"Copper deposits while the blue colour fades.",effect:"colour"},{name:"Neutralisation",eq:"HCl + NaOH → NaCl + H₂O",result:"Acid and base form salt and water; heat may be released.",effect:"heat"},{name:"Precipitation",eq:"Na₂SO₄ + BaCl₂ → BaSO₄↓ + 2NaCl",result:"A white insoluble precipitate appears.",effect:"precipitate"}];
function ReactionLab(){const [index,setIndex]=useState(0);const [mixed,setMixed]=useState(false);const pinchLock=useRef(false);const r=reactions[index];const gesture=(f:VisionFrame)=>{const hand=f.landmarks[0];if(!hand)return;const next=clamp(Math.floor((1-hand[8].x)*reactions.length),0,reactions.length-1);setIndex(old=>{if(old!==next)setMixed(false);return next});const pinching=distance(hand[4],hand[8])<.055;if(pinching&&!pinchLock.current)setMixed(true);pinchLock.current=pinching};return <div className="experience two-column"><div><HandDock instruction="Move left/right to choose a reaction, then pinch to combine" onFrame={gesture}/><div className="reaction-bench"><div className={`flask ${mixed?r.effect:""}`}><i/><span>{mixed?"PRODUCTS":"REACTANTS"}</span></div><select value={index} onChange={e=>{setIndex(+e.target.value);setMixed(false)}}>{reactions.map((r,i)=><option value={i} key={r.name}>{r.name}</option>)}</select><button onClick={()=>setMixed(true)}>COMBINE SYMBOLICALLY</button></div></div><LabIntro objective="Classify curriculum reactions and interpret balanced equations." ai="Fingertip position selects the reaction and a pinch combines it; balancing remains rule-based." limit="This is a safe symbolic lab. It gives no quantities or real mixing instructions."><div className="equation-card"><small>BALANCED EQUATION</small><h3>{r.eq}</h3><b>{r.name} reaction</b><p>{mixed?r.result:"Combine the virtual reactants to observe the result."}</p></div></LabIntro></div>}

const molecules=[{name:"Methane",formula:"CH₄",c:1,h:4,o:0,bond:"single",group:"alkane"},{name:"Ethane",formula:"C₂H₆",c:2,h:6,o:0,bond:"single",group:"alkane"},{name:"Ethene",formula:"C₂H₄",c:2,h:4,o:0,bond:"double",group:"alkene"},{name:"Ethyne",formula:"C₂H₂",c:2,h:2,o:0,bond:"triple",group:"alkyne"},{name:"Ethanol",formula:"C₂H₅OH",c:2,h:6,o:1,bond:"single",group:"alcohol · −OH"},{name:"Ethanoic acid",formula:"CH₃COOH",c:2,h:4,o:2,bond:"single",group:"carboxylic acid · −COOH"},{name:"Propane",formula:"C₃H₈",c:3,h:8,o:0,bond:"single",group:"alkane"}];
function CarbonLab(){const [m,setM]=useState(molecules[4]);const choose=(f:VisionFrame)=>{const hand=f.landmarks[0];if(hand)setM(molecules[clamp(Math.floor((1-hand[8].x)*molecules.length),0,molecules.length-1)])};return <div className="experience two-column"><div><HandDock instruction="Move your index finger left/right to build different molecules" onFrame={choose}/><div className="molecule-stage"><div className={`molecule ${m.bond}`}>{Array.from({length:m.c},(_,i)=><span className="atom-c" key={`c${i}`}>C</span>)}{Array.from({length:m.o},(_,i)=><span className="atom-o" key={`o${i}`}>O</span>)}{Array.from({length:Math.min(m.h,8)},(_,i)=><i key={`h${i}`}>H</i>)}</div><div className="molecule-picker">{molecules.map(x=><button className={m.name===x.name?"active":""} onClick={()=>setM(x)} key={x.name}>{x.name}</button>)}</div></div></div><LabIntro objective="Relate carbon valency, bond type, formula and functional groups." ai="Fingertip movement changes the molecule while a valency rule engine checks legal bonding." limit="Flat structural diagrams simplify real three-dimensional molecular shapes."><div className="element-card"><small>VALID MOLECULE</small><h3>{m.name}</h3><span>Molecular formula <b>{m.formula}</b></span><span>C–C bond <b>{m.bond}</b></span><span>Series / group <b>{m.group}</b></span><span>Carbon valency <b>4</b></span></div><KnowledgeCheck questions={["Build ethanol","Build ethene","Identify the functional group"]}/></LabIntro></div>}

function QuizLab(){
  const [category,setCategory]=useState<QuizCategory|"All">("All");const [level,setLevel]=useState<9|10|"All">("All");const [difficulty,setDifficulty]=useState<QuizDifficulty|"All">("All");const [started,setStarted]=useState(false);const [index,setIndex]=useState(0);const [selected,setSelected]=useState<number|null>(null);const [pending,setPending]=useState<number|null>(null);const [gestureHold,setGestureHold]=useState(0);const [score,setScore]=useState(0);const [streak,setStreak]=useState(0);const [seconds,setSeconds]=useState(20);const [order,setOrder]=useState<typeof QUIZ_QUESTIONS>([]);const stableGesture=useRef({key:"",frames:0});
  const begin=()=>{const filtered=QUIZ_QUESTIONS.filter(q=>(category==="All"||q.category===category)&&(level==="All"||q.classLevel===level)&&(difficulty==="All"||q.difficulty===difficulty));setOrder([...filtered].sort(()=>Math.random()-.5));setIndex(0);setScore(0);setStreak(0);setSelected(null);setPending(null);setSeconds(20);setStarted(true)};
  useEffect(()=>{if(!started||selected!==null)return;const t=setInterval(()=>setSeconds(s=>{if(s<=1){setSelected(-1);return 0}return s-1}),1000);return()=>clearInterval(t)},[started,index,selected]);
  useEffect(()=>{const key=(e:KeyboardEvent)=>{if(!started)return;const n=["1","2","3","4"].indexOf(e.key);if(n>=0)answer(n);if(e.key==="Enter"&&selected!==null)next()};window.addEventListener("keydown",key);return()=>window.removeEventListener("keydown",key)});
  const q=order[index];const answer=(n:number)=>{if(selected!==null||!q)return;setSelected(n);setPending(null);if(n===q.answer){setScore(s=>s+1);setStreak(s=>s+1)}else setStreak(0)};const next=()=>{if(index>=order.length-1){setStarted(false);return}setIndex(i=>i+1);setSelected(null);setPending(null);setGestureHold(0);stableGesture.current={key:"",frames:0};setSeconds(20)};
  const gestureFrame=(f:VisionFrame)=>{if(selected!==null)return;const h=f.landmarks[0];if(!h){stableGesture.current={key:"",frames:0};setGestureHold(0);return}const total=countFingers(h).total;const key=total>=1&&total<=4?`option-${total}`:total===5?"confirm":total===0?"cancel":"";if(!key)return;if(stableGesture.current.key===key)stableGesture.current.frames+=1;else stableGesture.current={key,frames:1};setGestureHold(Math.min(100,stableGesture.current.frames/10*100));if(stableGesture.current.frames===10){if(total>=1&&total<=4)setPending(total-1);else if(total===5&&pending!==null)answer(pending);else if(total===0)setPending(null)}};
  if(!started)return <div className="quiz-setup"><p>64 original NCERT-aligned questions · mouse, keyboard and gesture-ready controls</p><div><label>Category<select value={category} onChange={e=>setCategory(e.target.value as typeof category)}><option>All</option>{["Physics","Chemistry","Biology","AI"].map(x=><option key={x}>{x}</option>)}</select></label><label>Class<select value={level} onChange={e=>setLevel(e.target.value==="All"?"All":+e.target.value as 9|10)}><option>All</option><option value="9">Class 9</option><option value="10">Class 10</option></select></label><label>Difficulty<select value={difficulty} onChange={e=>setDifficulty(e.target.value as typeof difficulty)}><option>All</option>{["Easy","Medium","Difficult"].map(x=><option key={x}>{x}</option>)}</select></label></div><div className="quiz-summary"><span><b>{score}</b>LAST SCORE</span><span><b>{QUIZ_QUESTIONS.length}</b>QUESTION BANK</span><span><b>1–4</b>KEYBOARD OPTIONS</span></div><button onClick={begin}>START QUIZ</button></div>;
  if(!q)return <div className="empty-state">No questions match these filters. Change a filter and restart.</div>;
  return <div className="quiz-live"><header><span>QUESTION {index+1} / {order.length}</span><b>{q.category} · CLASS {q.classLevel} · {q.difficulty}</b><i>{seconds}s</i></header><div className="quiz-progress"><i style={{width:`${(index+1)/order.length*100}%`}}/></div><div className="quiz-gesture"><VisionStage kind="hand" compact onFrame={gestureFrame}/><div><b>{pending===null?"SHOW 1–4 FINGERS":`OPTION ${pending+1} READY · OPEN PALM TO CONFIRM`}</b><span><i style={{width:`${gestureHold}%`}}/></span><small>Hold steadily for 10 frames · fist cancels</small></div></div><h3>{q.question}</h3><div className="quiz-options">{q.options.map((o,i)=><button key={o} onClick={()=>answer(i)} className={`${pending===i?"pending ":""}${selected===null?"":i===q.answer?"correct":i===selected?"wrong":""}`}><span>{i+1}</span>{o}</button>)}</div>{selected!==null&&<div className="quiz-explanation"><b>{selected===q.answer?"CORRECT":"ANSWER EXPLAINED"}</b><p>{q.explanation}</p><button onClick={next}>{index===order.length-1?"FINISH":"NEXT QUESTION"}</button></div>}<footer><span>Score <b>{score}</b></span><span>Accuracy <b>{Math.round(score/Math.max(1,index+(selected!==null?1:0))*100)}%</b></span><span>Streak <b>{streak}</b></span><small>Gesture: 1–4 fingers select · open palm confirms · fist cancels</small></footer></div>
}

function SystemLab(){return <div className="system-lab"><div className="big-pipeline">{[{n:"01",t:"Camera",p:"A 640 × 480 frame stays in the browser."},{n:"02",t:"Pretrained model",p:"MediaPipe performs inference on the new frame."},{n:"03",t:"Landmarks",p:"The model estimates hand, face or pose points with confidence."},{n:"04",t:"Rules",p:"Stable geometry becomes a gesture, joint angle or pointer."},{n:"05",t:"Simulation",p:"Physics and science rules update the activity."},{n:"06",t:"Arduino",p:"Beat the Robot sends only R, P or S at 115200 baud."},{n:"07",t:"Two servos",p:"D9 moves index + middle; D10 moves ring + pinky."}].map(x=><article key={x.n}><span>{x.n}</span><h3>{x.t}</h3><p>{x.p}</p></article>)}</div><div className="ethics-grid"><article><b>TRAINING DATA</b><p>Examples used before deployment teach the model visual patterns.</p></article><article><b>INFERENCE</b><p>The already-trained model estimates landmarks from a new frame.</p></article><article><b>BIAS</b><p>Unbalanced training examples may cause uneven performance.</p></article><article><b>LIMITATIONS</b><p>Lighting, blur and occlusion reduce confidence.</p></article><article><b>PRIVACY</b><p>Live frames are processed locally and are not used for identity.</p></article><article><b>AI vs SIMULATION</b><p>AI estimates landmarks. Formulas, diagrams and animations follow authored rules.</p></article></div></div>}

function KnowledgeCheck({questions}:{questions:string[]}){return <div className="knowledge-check"><small>KNOWLEDGE CHECK</small>{questions.map((q,i)=><button key={q}><span>{i+1}</span>{q}</button>)}</div>}
function AttractScreen({onStart}:{onStart:()=>void}){const [i,setI]=useState(0);const lines=["Beat the Robot","Control Science with Your Hands","See How AI Tracks Your Body","Take the Gesture-Controlled Science Quiz"];useEffect(()=>{const t=setInterval(()=>setI(x=>(x+1)%lines.length),2600);return()=>clearInterval(t)},[]);return <button className="attract-screen" onClick={onStart}><span>VISION AI SCIENCE LAB</span><h2>{lines[i]}</h2><b>TOUCH ANYWHERE TO START</b></button>}

export default function SciencePlatform(){
  return <CameraProvider><SciencePlatformContent/></CameraProvider>;
}
