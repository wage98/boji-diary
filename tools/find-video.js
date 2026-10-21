'use strict';
/* 针对性找视频：给定关键词/包含词/排除词，打印 ≤95s 候选（经 view 接口复核真实时长+活性） */
const { execFileSync } = require('child_process');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';
function sleep(ms){ try { execFileSync('powershell', ['-nop','-c',`Start-Sleep -Milliseconds ${ms}`]); } catch(e){} }
function curl(url){
  for (let t=0;t<4;t++){
    try { const r=execFileSync('curl',['-s','-m','25','-A',UA,url],{encoding:'utf8',maxBuffer:8*1024*1024}); if(r&&r.length>50) return r; } catch(e){}
    sleep(400);
  }
  return '';
}
function search(kw){
  const html=curl('https://search.bilibili.com/all?keyword='+encodeURIComponent(kw));
  const parts=html.split('bili-video-card__info--tit');
  const out=[];
  for(let i=1;i<parts.length;i++){
    const chunk=parts[i-1];
    const bvm=chunk.match(/BV[0-9A-Za-z]{10}/);
    if(!bvm) continue;
    const dm=chunk.match(/(\d{1,2}):(\d{2})/);
    const secs=dm?(+dm[1])*60+(+dm[2]):9999;
    const tm=parts[i].match(/title="([^"]*)"/);
    out.push({bv:bvm[0],title:tm?tm[1]:'',secs});
  }
  return out;
}
function view(bv){
  for(let t=0;t<4;t++){
    let raw='';
    try{ raw=curl('https://api.bilibili.com/x/web-interface/view?bvid='+bv); }catch(e){raw='';}
    if(!raw){sleep(400);continue;}
    try{ const j=JSON.parse(raw); if(j.code!==0) return null; return {title:j.data.title,secs:j.data.duration}; }catch(e){sleep(400);}
  }
  return null;
}
const SIG=[['标准',6],['细节',6],['要点',6],['避坑',7],['纠错',7],['新手',6],['保姆级',5],['逐帧',6],['正确',3],['教学',3],['怎么做',3],['教程',3],['分解',4],['一分钟',2],['干货',2],['精讲',3],['完整',3],['学会',2],['护腰',6],['不废腰',7],['腰不',6],['腰先',6]];
const BAD=['跟练','合集','系列','计划','挑战','打卡','游戏','混剪','训练营','直播'];
function score(t){ if(!t) return -1e9; let s=0; for(const [k,v] of SIG) if(t.indexOf(k)>=0) s+=v; for(const b of BAD) if(t.indexOf(b)>=0) s-=100; if(/第\s*\d+\s*天/.test(t)) s-=100; return s; }
function durAdj(secs){ if(secs<30) return -10; if(secs<35) return -4; if(secs<=95) return 8; return 0; }

const kw=process.argv[2]||'';
const incl=(process.argv[3]||'').split(',').filter(Boolean);
const excl=(process.argv[4]||'').split(',').filter(Boolean);
if(!kw){ console.error('用法: node tools/find-video.js "关键词" "包含词,逗号" "排除词,逗号"'); process.exit(1); }
console.log('搜索:',kw,'包含:',incl,'排除:',excl);
const cands=search(kw).filter(c=>c.secs<=95 && incl.every(k=>c.title.indexOf(k)>=0) && !excl.some(k=>c.title.indexOf(k)>=0));
const withV=[];
for(const c of cands.slice(0,15)){
  const v=view(c.bv);
  if(v && v.secs<=95){ withV.push({bv:c.bv,title:v.title,secs:v.secs,total:score(v.title)+durAdj(v.secs)}); }
  sleep(550);
}
withV.sort((a,b)=>b.total-a.total);
console.log('\n候选（按评分排序，已 view 复核）：');
for(const c of withV.slice(0,10)){
  console.log(`  ${c.bv}  ${c.secs}s  评分${c.total}  ${c.title}`);
}
if(!withV.length) console.log('  无符合候选，放宽包含/排除词再试。');
