import urllib.request, urllib.parse, json, datetime, pathlib, concurrent.futures, time
ROOT=pathlib.Path(__file__).parent
# Resort base-area coordinates; lodging locations are town centers, not properties.
mountains=[
('Mohawk','Indy',41.838,-73.314,0.65),('Berkshire East','Indy',42.621,-72.878,0.78),('Catamount','Indy',42.170,-73.478,0.70),('Bousquet','Indy',42.420,-73.282,0.65),
('Magic','Indy',43.202,-72.772,0.90),('Bolton Valley','Indy',44.421,-72.850,0.92),('Jay Peak','Indy',44.930,-72.505,1.00),('Cannon','Indy',44.157,-71.699,0.95),('Burke','Indy',44.589,-71.916,0.90),('Waterville Valley','Indy',43.965,-71.528,0.88),('Pats Peak','Indy',43.164,-71.797,0.70),
('Mount Snow','Epic',42.968,-72.895,0.88),('Okemo','Epic',43.403,-72.717,0.92),('Stowe','Epic',44.531,-72.787,1.00),('Mount Sunapee','Epic',43.332,-72.080,0.82),('Crotched','Epic',43.011,-71.879,0.68),('Attitash','Epic',44.083,-71.229,0.85),('Wildcat','Epic',44.264,-71.238,0.94),('Hunter','Epic',42.203,-74.230,0.82)]
hotels=[('Brattleboro',42.850,-72.558,155),('Manchester',43.163,-73.072,205),('Ludlow',43.396,-72.700,230),('Waterbury',44.337,-72.756,190),('Stowe town',44.465,-72.687,285),('Newport',44.936,-72.205,165),('Littleton',44.307,-71.772,165),('North Conway',44.053,-71.128,190),('Concord',43.208,-71.537,150),('Catskill',42.217,-73.865,165),('Pittsfield',42.450,-73.245,150),('Wilmington / West Dover',42.924,-72.860,200),('Newbury',43.322,-72.035,185),('Sunapee town',43.387,-72.088,175),('Hunter town',42.211,-74.214,210),('Tannersville',42.195,-74.134,185),('Waterville Valley town',43.951,-71.501,205),('Plymouth',43.758,-71.688,155)]
ms=[]
for i,(name,p,lat,lon,pref) in enumerate(mountains):
 end='2027-04-18' if name in ['Jay Peak','Stowe','Wildcat','Bolton Valley'] else '2027-03-28' if name in ['Mohawk','Catamount','Bousquet','Pats Peak','Crotched'] else '2027-04-04'
 ms.append(dict(id=i+1,name=name,passType=p,lat=lat,lon=lon,preference=pref,limit=2 if p=='Indy' else 100,enabled=True,open='2026-12-05',close=end,crowd=0.78 if p=='Epic' else 0.90,parking=25 if name=='Stowe' else 10 if p=='Epic' else 0))
hs=[dict(id=len(ms)+i+1,name=x[0],lat=x[1],lon=x[2],nightly=x[3]) for i,x in enumerate(hotels)]
points=[dict(id=0,name='Simsbury, CT',lat=41.908,lon=-72.766)]+ms+hs
def fetch(url):
 req=urllib.request.Request(url,headers={'User-Agent':'ski-season-planner/1.0'})
 for attempt in range(4):
  try:
   with urllib.request.urlopen(req,timeout=60) as r:return json.load(r)
  except urllib.error.HTTPError as e:
   if e.code!=429:raise
   print('rate limit: retrying',attempt,flush=True);time.sleep(20)
 raise RuntimeError('Weather source rate limit')
coords=';'.join(f'{x["lon"]},{x["lat"]}' for x in points)
route=fetch('https://router.project-osrm.org/table/v1/driving/'+coords+'?annotations=duration,distance')
assert route['code']=='Ok'
print('routing',len(route['durations']),flush=True)
(ROOT/'dist/routing.json').write_text(json.dumps(dict(durations=route['durations'],distances=route['distances'],source='OSRM / OpenStreetMap',retrieved='2026-10-02')))
def weather(m):
 path=ROOT/'dist/weather-raw'/f'{m["id"]}.json';path.parent.mkdir(exist_ok=True)
 if path.exists():return m['id'],json.loads(path.read_text())
 query=urllib.parse.urlencode(dict(latitude=m['lat'],longitude=m['lon'],start_date='2016-11-01',end_date='2026-04-30',daily='snowfall_sum,rain_sum,temperature_2m_max',models='era5',timezone='America/New_York'))
 d=fetch('https://archive-api.open-meteo.com/v1/archive?'+query)
 path.write_text(json.dumps(d));print('weather',m['name'],flush=True);return m['id'],d
data={}
with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
 for mid,d in pool.map(weather,ms):
  daily=d['daily'];bins={}
  for k,date in enumerate(daily['time']):
   dt=datetime.date.fromisoformat(date)
   if dt.month not in [12,1,2,3,4] or k<7:continue
   snow=sum(v or 0 for v in daily['snowfall_sum'][k-6:k+1]);rain=sum(v or 0 for v in daily['rain_sum'][k-2:k+1]);temp=daily['temperature_2m_max'][k]
   if temp is None:continue
   # Explicit planning heuristic: not a measured snow-surface rating.
   score=max(.05,min(1,.58+.25*min(snow/25,1)+.12*(temp<1)-.22*min(rain/15,1)-.18*min(max(temp-3,0)/10,1)))
   key=f'{dt.month:02d}-{(dt.day-1)//7}'
   bins.setdefault(key,[]).append(dict(score=score,snow=snow,rain=rain,temp=temp))
  summary={}
  for key,rows in bins.items():
   n=len(rows);avg=lambda f:sum(r[f] for r in rows)/n
   summary[key]=dict(score=avg('score'),snow=avg('snow'),rain=avg('rain'),temp=avg('temp'),bad=sum(r['score']<.45 for r in rows)/n,n=n)
  data[str(mid)]=summary
(ROOT/'dist/data.json').write_text(json.dumps(dict(mountains=ms,hotels=hs,weather=data,weatherSource='Open-Meteo ERA5 reanalysis, winters 2016–17 through 2025–26',home=points[0])))
print('complete',flush=True)
