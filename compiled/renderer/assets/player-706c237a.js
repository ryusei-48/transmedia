import{J as y,W as g,f as s,k as e,a0 as b,a1 as j,a2 as a,a4 as m,v as w}from"./appBar-f1be1bb1.js";const c=y(g)(({theme:t})=>({...t.typography.body2,padding:t.spacing(1),color:t.palette.text.secondary}));function R(){const t=s.useRef(null),o=s.useRef(null),[l,d]=s.useState(""),[u,x]=s.useState("");let i=!1;s.useEffect(()=>{async function n(){i||(window.electron.ipcRenderer.once("media-stream",(f,r)=>{const h=new Blob([r.buffer],{type:r.mime});t.current.src=window.URL.createObjectURL(h),x(r.title)}),window.electron.ipcRenderer.once("subtitle-json",(f,r)=>{o.current=r,console.log(r),o.current?.reverse()}))}return n(),()=>{i=!0}},[]);const p=()=>{for(const n of o.current)if(n.start<=t.current.currentTime){d(n.translated_texts.ja);break}};return e.jsxs(b,{children:[e.jsx(j,{useType:"player"}),e.jsx(a,{sx:{display:"flex",width:"100%",height:"calc( 100vh - 25.6px )",alignItems:"stretch",backgroundColor:"transparent"},children:e.jsxs(a,{sx:{display:"flex",flexDirection:"column",alignItems:"stretch",backgroundColor:"transparent",width:"100%",height:"100%"},children:[e.jsxs(c,{sx:{width:"100%",backgroundColor:"transparent"},children:[e.jsx("h1",{style:{padding:"5px",fontSize:"15pt"},children:u}),e.jsx("video",{controls:!0,style:{width:"100%",aspectRatio:"16 / 9"},ref:t,onTimeUpdate:p})]}),e.jsx(a,{sx:{display:"flex",flexBasis:"100%",flex:1},children:e.jsx(c,{sx:{fontSize:"15pt",flex:1,textAlign:"center"},"aria-live":"assertive",children:l})})]})})]})}m.createRoot(document.getElementById("root")).render(e.jsx(w.StrictMode,{children:e.jsx(R,{})}));
