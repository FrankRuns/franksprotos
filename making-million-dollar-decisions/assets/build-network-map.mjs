import fs from 'fs';
import {feature,mesh} from 'topojson-client';
import {geoAlbersUsa,geoPath} from 'd3-geo';
const us=JSON.parse(fs.readFileSync('node_modules/us-atlas/states-10m.json'));
const W=1200,H=720;
const nation=feature(us,us.objects.nation);
const proj=geoAlbersUsa().fitExtent([[20,20],[W-20,H-20]],nation);
const path=geoPath(proj);
const borders=path(mesh(us,us.objects.states,(a,b)=>a!==b));
const stores=[
['Chicago',41.88,-87.63,110],['Naperville',41.75,-88.15,55],['Rockford',42.27,-89.09,40],['Peoria',40.69,-89.59,40],['Springfield IL',39.78,-89.65,35],
['Milwaukee',43.04,-87.91,75],['Madison',43.07,-89.4,50],['Green Bay',44.51,-88.01,35],['Duluth',46.79,-92.1,25],['Minneapolis',44.98,-93.27,95],['Rochester MN',44.02,-92.47,30],
['Fargo',46.88,-96.79,30],['Sioux Falls',43.54,-96.73,30],['Des Moines',41.59,-93.62,55],['Cedar Rapids',41.98,-91.67,35],['Omaha',41.26,-95.93,55],['Lincoln',40.81,-96.7,35],
['Kansas City',39.1,-94.58,75],['Wichita',37.69,-97.34,40],['St Louis',38.63,-90.2,85],['Springfield MO',37.21,-93.29,35],['Indianapolis',39.77,-86.16,80],['Fort Wayne',41.08,-85.14,40],
['Evansville',37.97,-87.57,30],['Detroit',42.33,-83.05,95],['Grand Rapids',42.96,-85.67,50],['Lansing',42.73,-84.56,35],['Toledo',41.65,-83.54,40],['Columbus',39.96,-83,75],
['Cleveland',41.5,-81.69,70],['Cincinnati',39.1,-84.51,65],['Dayton',39.76,-84.19,40],['Louisville',38.25,-85.76,55],
['Seattle',47.61,-122.33,40],['Portland',45.52,-122.68,30],['San Francisco',37.77,-122.42,40],['Sacramento',38.58,-121.49,25],['Los Angeles',34.05,-118.24,45],['San Diego',32.72,-117.16,25],
['Boston',42.36,-71.06,35],['New York',40.71,-74.01,45],['Philadelphia',39.95,-75.17,35],['Baltimore',39.29,-76.61,25],['Washington DC',38.9,-77.04,35],['Charlotte',35.23,-80.84,25]];
const sites=[['Reno',39.53,-119.81],['Salt Lake City',40.76,-111.89],['Phoenix',33.45,-112.07],['Denver',39.74,-104.99],['Dallas',32.78,-96.8],['Atlanta',33.75,-84.39],['Allentown',40.6,-75.47],['Richmond',37.54,-77.44]];
const P=(lat,lon)=>proj([lon,lat]);
const chi=P(41.88,-87.63);
const arc=(a,b,bend=.18)=>{const mx=(a[0]+b[0])/2,my=(a[1]+b[1])/2,dx=b[0]-a[0],dy=b[1]-a[1];const cx=mx-dy*bend,cy=my+dx*bend;return `M${a[0].toFixed(1)} ${a[1].toFixed(1)}Q${cx.toFixed(1)} ${cy.toFixed(1)} ${b[0].toFixed(1)} ${b[1].toFixed(1)}`};
let o=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">
<defs><radialGradient id="g" cx="50%" cy="45%" r="60%"><stop offset="0" stop-color="#c8102e" stop-opacity=".16"/><stop offset="1" stop-color="#c8102e" stop-opacity="0"/></radialGradient>
<filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="5"/></filter></defs>
<rect width="${W}" height="${H}" fill="#0d0f14"/><rect width="${W}" height="${H}" fill="url(#g)"/>
<path d="${path(nation)}" fill="#171a22" stroke="#3a3f4c" stroke-width="1.5"/>
<path d="${borders}" fill="none" stroke="#2a2e38" stroke-width="1"/>`;
// candidate-to-store web (the "what if" network)
for(const s of sites){const a=P(s[1],s[2]);for(const t of stores){const b=P(t[1],t[2]);const d=Math.hypot(a[0]-b[0],a[1]-b[1]);if(d<260&&d>4)o+=`<path d="${arc(a,b,.12)}" fill="none" stroke="#f0b632" stroke-opacity=".16" stroke-width="1" stroke-dasharray="3 4"/>`}}
// Chicago flows today
for(const t of stores){const b=P(t[1],t[2]);if(Math.hypot(chi[0]-b[0],chi[1]-b[1])<5)continue;const w=(0.6+t[3]/60).toFixed(2);o+=`<path d="${arc(chi,b)}" fill="none" stroke="#c8102e" stroke-opacity=".7" stroke-width="${w}"/>`}
for(const t of stores){const b=P(t[1],t[2]);const r=(3.5+t[3]/20).toFixed(1);o+=`<circle cx="${b[0].toFixed(1)}" cy="${b[1].toFixed(1)}" r="${r}" fill="#3478c9" fill-opacity=".9" stroke="#0d0f14" stroke-width="2"/>`}
for(const s of sites){const a=P(s[1],s[2]);const x=a[0].toFixed(1),y=a[1].toFixed(1);o+=`<circle cx="${x}" cy="${y}" r="13" fill="#0d0f14" stroke="#f0b632" stroke-width="2.5"/><text x="${x}" y="${(a[1]+6.5).toFixed(1)}" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-size="19" font-weight="900" fill="#f0b632">?</text>`}
o+=`<circle cx="${chi[0]}" cy="${chi[1]}" r="26" fill="#c8102e" filter="url(#glow)" opacity=".8"/><circle cx="${chi[0]}" cy="${chi[1]}" r="14" fill="#c8102e" stroke="#fff" stroke-width="3"/>`;
{const lx=chi[0]+150,ly=chi[1]-112;o+=`<path d="M${chi[0]+12} ${chi[1]-10}L${lx-40} ${ly+15}" stroke="#ffffff" stroke-opacity=".7" stroke-width="1.5" fill="none"/><rect x="${lx-62}" y="${ly}" width="124" height="30" rx="15" fill="#0d0f14" stroke="#c8102e" stroke-width="1.5"/><text x="${lx}" y="${ly+20.5}" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-size="15" font-weight="800" fill="#fff" letter-spacing="1.5">CHICAGO DC</text>`;}
o+=`</svg>`;
fs.writeFileSync('network-map.svg',o);console.log('ok',o.length);
