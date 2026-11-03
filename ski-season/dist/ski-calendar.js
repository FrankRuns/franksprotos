import {weekends,nextDay} from './model.js';
export function calendarHTML(data,trips,settings,active={},selectedWeek='all'){
 const byWeek=new Map(trips.map(t=>[t.w,t])),mountain=id=>data.mountains.find(m=>m.id===id)?.name||'Home';
 const short=name=>({'Waterville Valley':'Waterville','Berkshire East':'Berkshire E.','Mount Sunapee':'Sunapee','Mount Snow':'Mt. Snow','Bolton Valley':'Bolton'}[name]||name);
 const groups=new Map();for(const w of weekends(settings)){const key=w.slice(0,7);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(w);}
 if(!groups.size)return '<p class="note">No weekends in this date range.</p>';
 const rows=Math.max(...[...groups.values()].map(v=>v.length));
 return `<div class="season-board" style="--months:${groups.size};--week-rows:${rows}">${[...groups].map(([month,dates])=>`<div class="season-column"><h4>${new Date(month+'-01T12:00:00Z').toLocaleDateString('en-US',{month:'short',timeZone:'UTC'})}<span>${month.slice(0,4)}</span></h4><div class="season-weekends">${dates.map(w=>{
  const t=byWeek.get(w),inactive=active[w]===false,planned=!!t?.days,chosen=planned&&w===selectedWeek,a=mountain(t?.sat),b=mountain(t?.sun),sun=nextDay(w),dateLabel=w.slice(8).replace(/^0/,'')+'–'+(w.slice(5,7)!==sun.slice(5,7)?new Date(sun+'T12:00:00Z').toLocaleDateString('en-US',{month:'short',timeZone:'UTC'})+' ':'')+sun.slice(8).replace(/^0/,''),hotel=data.hotels.find(h=>h.id===t?.hotel),footer=hotel?'2 nights · '+hotel.name:planned?'Day trips · sleep at home':inactive?'Unavailable':'No qualifying trip',content=`<span class="board-week-date">${dateLabel}${chosen?'<span class="board-selected">Selected</span>':''}</span>${planned?`<span class="board-day saturday"><small>Sat</small><b title="${a}">${short(a)}</b></span><span class="board-day sunday"><small>Sun</small><b title="${b}">${short(b)}</b></span>`:`<span class="board-off">${inactive?'Inactive':'Stay home'}</span>`}<span class="board-footer" title="${footer}">${footer}</span>`;
  return planned?`<button type="button" class="board-week planned${chosen?' chosen':''}" data-calendar-week="${w}" aria-pressed="${chosen}" aria-label="Weekend ${w}: Saturday ${a}, Sunday ${b}. Show route.">${content}</button>`:`<div class="board-week off${inactive?' inactive':''}">${content}</div>`;
 }).join('')}</div></div>`).join('')}</div>`;
}
