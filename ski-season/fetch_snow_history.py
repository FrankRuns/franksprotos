import urllib.request,re,html,json,pathlib,concurrent.futures,time
root=pathlib.Path(__file__).parent
slugs={1:'connecticut/mohawk-mountain',2:'massachusetts/berkshire-east',3:'new-york/catamount-ski-ride-area',4:'massachusetts/bousquet-ski-area',5:'vermont/magic-mountain',6:'vermont/bolton-valley',7:'vermont/jay-peak',8:'new-hampshire/cannon-mountain',9:'vermont/burke-mountain',10:'new-hampshire/waterville-valley',11:'new-hampshire/pats-peak',12:'vermont/mount-snow',13:'vermont/okemo-mountain-resort',14:'vermont/stowe-mountain-resort',15:'new-hampshire/mount-sunapee',16:'new-hampshire/crotched-mountain',17:'new-hampshire/attitash',18:'new-hampshire/wildcat-mountain',19:'new-york/hunter-mountain'}
names={m['id']:m['name'] for m in json.loads((root/'dist/data.json').read_text())['mountains']}
months={'December':'12','January':'01','February':'02','March':'03','April':'04'}
path=root/'dist/snow-history.json'
data=json.loads(path.read_text()) if path.exists() else {}
def fetch(pair):
 mid,slug=pair
 if str(mid) in data:return str(mid),data[str(mid)]
 url='https://www.onthesnow.com/'+slug+'/historical-snowfall'
 try:
  req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'})
  with urllib.request.urlopen(req,timeout=35) as r:page=r.read().decode()
  clean=lambda s:html.unescape(re.sub('<[^>]+>','',s)).strip()
  stats={}
  for row in re.findall(r'<tr\b[^>]*>(.*?)</tr>',page,re.S):
   cells=[clean(s) for s in re.findall(r'<t[dh]\b[^>]*>(.*?)</t[dh]>',row,re.S)]
   if len(cells)>=4 and cells[0] in months and months[cells[0]] not in stats:
    num=re.search(r'\d+(?:\.\d+)?',cells[3])
    if num:stats[months[cells[0]]]=float(num.group())
  if not stats:raise ValueError('No monthly base-depth table found')
  result=dict(name=names[mid],source=url,retrieved='2026-10-03',baseDepthIn=stats,period='Publisher historical monthly aggregate; period and sample sizes not disclosed')
  print(names[mid],stats,flush=True);return str(mid),result
 except Exception as e:print('FAILED',names[mid],str(e),flush=True);return str(mid),None
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
 for mid,result in pool.map(fetch,slugs.items()):
  if result:data[mid]=result;path.write_text(json.dumps(data,indent=2))
print('Retrieved',len(data),'of',len(slugs),flush=True)
