"""Prepare an allow-listed, private test seed. Never copy the source CSV into the repository."""
import csv,json,math,pathlib,sys
source=pathlib.Path(sys.argv[1]);target=pathlib.Path(sys.argv[2]);target.mkdir(exist_ok=True)
excluded={'':'Unnamed location','Childrens Home':'Sensitive residential site','Guildcare':'Care-related site, scope unconfirmed','Phoenix House External':'Ownership and public-facing status unconfirmed','BnB External':'Residential/business distinction unconfirmed','Palm Court':'Ownership and public-facing status unconfirmed','Sion School':'Sensitive site; public-facing scope unconfirmed','Worthing Implant Centre':'Healthcare site; public-facing scope unconfirmed','Guildbourne Internal':'Internal-only camera'}
rows=list(csv.DictReader(source.open(encoding='utf-8-sig')));out=[];held=[]
for r in rows:
 name=r['Name'].strip()
 if name in excluded:held.append({'reason':excluded[name]});continue
 if r['Type'] not in ['cctv','police_council','pfs']:held.append({'reason':'Unsupported camera type'});continue
 try:
  lat,lng=float(r['Latitude']),float(r['Longitude'])
  if not (49<=lat<=61 and -9<=lng<=3):raise ValueError()
 except ValueError:held.append({'reason':'Invalid coordinates'});continue
 def number(field,default,low,high):
  try: v=float(r[field]);return min(high,max(low,v)) if math.isfinite(v) else default
  except ValueError:return default
 i=len(out)+1
 out.append({'id':f'test-{i:03d}','kind':'council' if r['Type']=='police_council' else 'business','name':name,'address':'','publicPhone':'','contactSource':'','assetReference':'','lat':lat,'lng':lng,'direction':number('Direction',0,0,359),'fieldOfView':number('Field of View',90,1,360),'viewDistance':number('View Distance',30,1,300),'retentionDays':None,'verifiedAt':None,'createdAt':'2026-10-10T08:00:00.000Z','updatedAt':'2026-10-10T08:00:00.000Z','hasPhoto':False,'source':'Supplied CSV · 10 Oct 2026 · unverified','revision':1})
(target/'seed.json').write_text(json.dumps(out,ensure_ascii=False))
sql="\n".join("INSERT OR IGNORE INTO cameras (id,data,revision) VALUES ('%s','%s',1);"%(c['id'],json.dumps(c,ensure_ascii=False).replace("'","''")) for c in out)
(target/'seed.sql').write_text(sql)
from collections import Counter
report={'source_rows':len(rows),'imported':len(out),'held_out':len(held),'reasons':dict(Counter(h['reason'] for h in held)),'excluded_columns':['Added By','Creator Email','Police Reference','original ID','original timestamps'],'missing_addresses':sum(not c['address'] for c in out),'verified_records':0}
(target/'import-report.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
