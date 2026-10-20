import fs from 'fs';
import {feature,mesh} from 'topojson-client';
import {geoAlbersUsa,geoPath} from 'd3-geo';
const us=JSON.parse(fs.readFileSync('node_modules/us-atlas/states-10m.json'));
const W=1200,H=720;
const nation=feature(us,us.objects.nation);
const lower48={type:'FeatureCollection',features:feature(us,us.objects.states).features.filter(f=>!['02','15','72','78','60','66','69'].includes(f.id))};
const proj=geoAlbersUsa().fitExtent([[24,24],[W-24,H-24]],lower48);
const path=geoPath(proj).digits(1);
const states=geoPath(proj).digits(1)(mesh(us,us.objects.states,(a,b)=>a!==b&&!['02','15'].includes(a.id)));
const land=path({type:'FeatureCollection',features:lower48.features});
const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"><path d="${land}" fill="#e4e1da" stroke="#c9c5bc" stroke-width="1.5"/><path d="${states}" fill="none" stroke="#d3cfc6" stroke-width="1"/></svg>`;
fs.writeFileSync('us-base.svg',svg);
const pts=JSON.parse(fs.readFileSync('pts.json'));
const out={};for(const [k,lat,lon] of pts){const p=proj([lon,lat]);out[k]=[+p[0].toFixed(1),+p[1].toFixed(1)]}
fs.writeFileSync('xy.json',JSON.stringify(out));console.log('svg',svg.length,'pts',Object.keys(out).length);
