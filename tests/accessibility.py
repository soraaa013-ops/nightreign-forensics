import json, os
from pathlib import Path
BASE = os.environ.get("TEST_BASE_URL", "http://localhost:4173")
OUT = Path(os.environ.get("TEST_ARTIFACTS", "/tmp/nightreign-qa-artifacts"))
OUT.mkdir(parents=True, exist_ok=True)
AXE = os.environ["AXE_CORE_PATH"]
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
 b=p.chromium.launch();page=b.new_page()
 results=[]
 for path in ['','map.html','merchant.html']:
  page.goto(BASE+'/'+path);page.wait_for_load_state('networkidle')
  for state in ['initial','active']:
   if state=='active':
    if not path:
     page.get_by_role('button',name='填入示例').click();page.locator('.slot-tab').first.click();page.locator('#effect-query').fill('回血')
    elif path=='map.html':page.locator('#open-map-results').click();page.locator('#use-clue').click()
    else:
     page.locator('#merchant-search').fill('wsjj');page.locator('.merchant-suggestion').first.click();page.locator('[data-shop=large]').click();page.locator('.merchant-stock-row summary').first.click()
   page.add_script_tag(path=AXE)
   result=page.evaluate("async () => (await axe.run(document, {runOnly: {type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}})).violations")
   results.append({'page':path,'state':state,'violations':result})
   print(path,state,[(x['id'],[n['target'] for n in x['nodes']]) for x in result])
 for dialog in ['map-settings','map-results-dialog']:
  page.goto(BASE+'/map.html');page.wait_for_load_state('networkidle');page.locator('#open-map-settings' if dialog=='map-settings' else '#open-map-results').click();page.add_script_tag(path=AXE)
  result=page.evaluate("async () => (await axe.run(document, {runOnly: {type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}})).violations")
  results.append({'page':'map.html','state':dialog,'violations':result});print(dialog,[(x['id'],[n['target'] for n in x['nodes']]) for x in result])
 open(OUT/'accessibility.json','w').write(json.dumps(results,ensure_ascii=False,indent=2))
 assert all(not x['violations'] for x in results)
 b.close()
