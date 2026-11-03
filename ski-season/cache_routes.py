import json, pathlib, urllib.request, time
root=pathlib.Path(__file__).parent
d=json.loads((root/'dist/data.json').read_text())
points={p['id']:p for p in [d['home']]+d['mountains']+d['hotels']}
result=json.loads((root/'sample-result.json').read_text())
path=root/'dist/road-routes.json'
cache=json.loads(path.read_text()) if path.exists() else {}
legs={tuple(leg) for t in result['selected'] for leg in t.get('legs',[])}
for a,b in sorted(legs):
 key=f'{a}_{b}'
 if key in cache:continue
 p,q=points[a],points[b]
 url=f'https://router.project-osrm.org/route/v1/driving/{p["lon"]},{p["lat"]};{q["lon"]},{q["lat"]}?overview=full&geometries=geojson&steps=false'
 with urllib.request.urlopen(url,timeout=45) as response:r=json.load(response)
 assert r['code']=='Ok'
 cache[key]=r['routes'][0]['geometry']['coordinates']
 path.write_text(json.dumps(cache));print('cached',key,flush=True);time.sleep(1)
print('complete',len(cache),'road legs',flush=True)
