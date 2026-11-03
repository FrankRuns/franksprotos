import urllib.request,re,html,json,pathlib,concurrent.futures
root=pathlib.Path(__file__).parent
paths={1:'Connecticut/mohawk.php',2:'Massachusetts/berkshireeast.php',3:'Massachusetts/catamount.php',4:'Massachusetts/bousquet.php',5:'Vermont/magicmtn.php',6:'Vermont/boltonvalley.php',7:'Vermont/jaypeak.php',8:'NewHampshire/cannonmtn.php',9:'Vermont/burkemtn.php',10:'NewHampshire/watervillevalley.php',11:'NewHampshire/patspeak.php',12:'Vermont/mtsnow.php',13:'Vermont/okemo.php',14:'Vermont/stowe.php',15:'NewHampshire/sunapee.php',16:'NewHampshire/crotchedmtn.php',17:'NewHampshire/attitash.php',18:'NewHampshire/wildcatmtn.php'}
months={'December':'12','January':'01','February':'02','March':'03','April':'04'}
target=root/'dist/terrain-history.json';data=json.loads(target.read_text()) if target.exists() else {}
def fetch(pair):
 mid,path=pair
 if str(mid) in data:return str(mid),data[str(mid)]
 url='https://www.newenglandskihistory.com/'+path
 try:
  with urllib.request.urlopen(url,timeout=30) as r:page=r.read().decode(errors='replace')
  clean=lambda s:html.unescape(re.sub('<[^>]+>',' ',s)).strip()
  terrain={};seasons=[]
  for row in re.findall(r'<tr\b[^>]*>(.*?)</tr>',page,re.S|re.I):
   cells=[clean(c) for c in re.findall(r'<t[dh]\b[^>]*>(.*?)</t[dh]>',row,re.S|re.I)]
   if not cells:continue
   if cells[0] in months and len(cells)>1:
    match=re.search(r'(\d+)%.*?\((\d+) reports?\)',cells[1],re.S)
    if match:terrain[months[cells[0]]]=dict(percent=int(match[1]),reports=int(match[2]))
   if re.fullmatch(r'20(?:1[6-9]|2[0-5])-\d\d',cells[0]):
    dates=[c for c in cells[1:] if re.fullmatch(r'(?:January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}',c)]
    if dates:seasons.append(dict(season=cells[0],opening=dates[0],closing=dates[1] if len(dates)>1 else None))
  if not terrain and not seasons:raise ValueError('No terrain or season observations')
  result=dict(source=url,retrieved='2026-10-03',terrain=terrain,seasons=seasons,period='Volunteer observations across unspecified years; report counts shown. Not a random or daily sample.')
  print(mid,'terrain months',len(terrain),'seasons',len(seasons),flush=True);return str(mid),result
 except Exception as e:print('FAILED',mid,str(e),flush=True);return str(mid),None
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
 for mid,result in pool.map(fetch,paths.items()):
  if result:data[mid]=result;target.write_text(json.dumps(data,indent=2))
print('Retrieved',len(data),'terrain histories',flush=True)
