"""Reproducible cold-load benchmark; CPU x4, optional 100 ms / 250 KB/s network. Timings are measurements, not flaky pass/fail thresholds."""
import json,os,time
from playwright.sync_api import sync_playwright,expect
BASE=os.environ.get('TEST_BASE_URL','http://localhost:4173');slow=os.environ.get('SLOW')=='1';legacy=os.environ.get('ALLOW_LEGACY')=='1'
with sync_playwright() as p:
 b=p.chromium.launch();page=b.new_page(viewport={'width':390,'height':844});cdp=page.context.new_cdp_session(page);cdp.send('Emulation.setCPUThrottlingRate',{'rate':4});cdp.send('Network.enable');cdp.send('Network.setCacheDisabled',{'cacheDisabled':True})
 if slow:cdp.send('Network.emulateNetworkConditions',{'offline':False,'latency':100,'downloadThroughput':250000,'uploadThroughput':125000})
 page.add_init_script("window.tasks=[];new PerformanceObserver(l=>tasks.push(...l.getEntries().map(e=>({start:e.startTime,duration:e.duration})))).observe({type:'longtask',buffered:true})")
 page.goto(BASE+'/map.html',wait_until='domcontentloaded',timeout=90000);expect(page.locator('.atlas-point').first).to_be_visible(timeout=90000)
 interactive=page.evaluate('performance.now()');expect(page.locator('#atlas-tiles')).to_have_attribute('data-quality','full',timeout=90000);sharp=page.evaluate('performance.now()')
 page.evaluate("window.originalCastleIcon=document.querySelector('[data-point=\"Castle - Castle\"] img')");page.locator('#open-map-settings').click();response=page.evaluate("async()=>{let t=performance.now();let e=document.querySelector('#nightlord');e.value='Gladius';e.dispatchEvent(new Event('change',{bubbles:true}));await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));return performance.now()-t}")
 if not legacy:assert page.evaluate("window.originalCastleIcon===document.querySelector('[data-point=\"Castle - Castle\"] img')")
 if not legacy:assert page.locator('#atlas-tiles img').count()==1
 if not legacy:assert page.locator('#atlas-tiles img').first.evaluate('(i)=>i.naturalWidth===1536&&i.naturalHeight===1536')
 data=page.evaluate("({resources:performance.getEntriesByType('resource').map(r=>({url:r.name,bytes:r.encodedBodySize,start:r.startTime,end:r.responseEnd})),tasks})")
 if not legacy:assert not any('/data/'+name in r['url'] for r in data['resources'] for name in ['map-data.json','map-dlc.json','map-icons.json'])
 result={'base':BASE,'slow':slow,'interactive_ms':round(interactive),'sharp_ms':round(sharp),'filter_ms':round(response),'bytes':sum(r['bytes'] for r in data['resources']),'requests':len(data['resources']),'long_tasks_ms':round(sum(t['duration'] for t in data['tasks'])),'resources':data['resources']};print(json.dumps(result));b.close()
