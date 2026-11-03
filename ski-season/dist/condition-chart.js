import {weatherFor} from './model.js';
const quantile=(a,p)=>{const i=(a.length-1)*p,l=Math.floor(i);return a[l]+(a[Math.ceil(i)]-a[l])*(i-l);};
export function weeklyConditions(data,s){
 const rows=[];
 for(let start=new Date('2026-12-01T12:00:00Z');start<=new Date('2027-04-30T12:00:00Z');start.setUTCDate(start.getUTCDate()+7)){
  const scores=data.mountains.map(m=>{let v=[];for(let j=0;j<7;j++){let d=new Date(start);d.setUTCDate(d.getUTCDate()+j);if(d.toISOString().slice(0,10)>'2027-04-30')break;const wx=weatherFor(data,m,d.toISOString().slice(0,10),s);if(wx)v.push(wx.score*100);}return {id:m.id,score:v.length?v.reduce((a,b)=>a+b,0)/v.length:null};});
  const values=scores.map(x=>x.score).filter(x=>x!==null).sort((a,b)=>a-b);
  rows.push({date:start.toISOString().slice(0,10),median:quantile(values,.5),low:quantile(values,.25),high:quantile(values,.75),magic:scores.find(x=>x.id===5).score,bolton:scores.find(x=>x.id===6).score,jay:scores.find(x=>x.id===7).score,count:values.length});
 }
 return rows;
}
export function chartSVG(rows,s){
 const W=1000,H=550,L=68,R=28,T=70,B=105,iw=W-L-R,ih=H-T-B,x=i=>L+i/(rows.length-1)*iw,y=v=>T+(100-v)/100*ih;
 const label=date=>new Date(date+'T12:00:00Z').toLocaleDateString('en-US',{month:'short',day:'numeric',timeZone:'UTC'});
 const path=key=>rows.map((r,i)=>`${i?'L':'M'}${x(i).toFixed(2)},${y(r[key]).toFixed(2)}`).join(' ');
 const band=rows.map((r,i)=>`${i?'L':'M'}${x(i)},${y(r.high)}`).concat([...rows].reverse().map((r,i)=>`L${x(rows.length-1-i)},${y(r.low)}`)).join(' ')+'Z';
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Weekly modeled historical ski condition index, December through April"><rect width="100%" height="100%" fill="white"/><g font-family="Arial, sans-serif" fill="#102b3a"><text x="${L}" y="25" font-size="21" font-weight="bold">Historical inputs: when do conditions score best?</text><text x="${L}" y="48" font-size="13">Condition index / 100 · ${s.conditionMode==='weather'?'Original weather-only mode':'Snowpack + terrain + weather'} · not a probability or forecast</text>${[0,20,40,60,80,100].map(v=>`<line x1="${L}" y1="${y(v)}" x2="${W-R}" y2="${y(v)}" stroke="#dce5eb"/><text x="${L-12}" y="${y(v)+4}" font-size="13" text-anchor="end">${v}</text>`).join('')}<path d="${band}" fill="#dde7ee"/>${[['median','19-mountain median','#102b3a'],['magic','Magic','#b94c14'],['bolton','Bolton','#167c78'],['jay','Jay','#387ac5']].map(([key,name,color],k)=>`<path d="${path(key)}" fill="none" stroke="${color}" stroke-width="${key==='median'?3:2}"/> <line x1="${L+k*205}" y1="${H-35}" x2="${L+k*205+20}" y2="${H-35}" stroke="${color}" stroke-width="3"/><text x="${L+k*205+28}" y="${H-31}" font-size="14">${name}</text>`).join('')}<line x1="${L}" y1="${y(s.minCondition)}" x2="${W-R}" y2="${y(s.minCondition)}" stroke="#7a5c00" stroke-dasharray="7 5"/><text x="${W-R-5}" y="${y(s.minCondition)-7}" text-anchor="end" fill="#7a5c00" font-size="12">Minimum ${s.minCondition}/100</text>${rows.map((r,i)=>`<text x="${x(i)}" y="${H-B+19}" transform="rotate(-45 ${x(i)} ${H-B+19})" text-anchor="end" font-size="12">${label(r.date)}</text>`).join('')}<text x="${L}" y="${H-8}" font-size="11" fill="#5e7888">Sources: OnTheSnow depths · NewEnglandSkiHistory terrain reports · Open-Meteo ERA5, 2016–26. Band: middle 50% of mountains.</text></g></svg>`;
}
