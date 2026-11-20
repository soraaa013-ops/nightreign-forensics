"""One marker per divine tower, three floor descriptions and existing filter compatibility."""
import json,os
from pathlib import Path
from urllib.parse import urlencode
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1];BASE=os.environ.get('TEST_BASE_URL','http://localhost:4173');zh=json.loads((ROOT/'data/zh-CN.json').read_text())['map'];data=json.loads((ROOT/'data/map-dlc.json').read_text())['records'];geo=json.loads((ROOT/'data/map-dlc-geometry.json').read_text())['points'];towers=[p for p in geo if p.get('tower')]
expect.set_options(timeout=15000)
with sync_playwright() as p:
 b=getattr(p,os.environ.get('TEST_BROWSER','chromium')).launch();page=b.new_page(viewport={'width':390,'height':844});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 q={'nightlord':'','mapType':'Great Hollow','spawn':'','observations':[]};page.goto(BASE+'/map.html?'+urlencode({'q':json.dumps(q)}));expect(page.locator('#atlas-loading')).to_be_hidden()
 for tower in towers:expect(page.locator('[data-point="'+tower['id']+'"]')).to_have_count(1)
 target=page.locator('[data-point="'+towers[0]['id']+'"]').first;expect(target).to_be_visible();target.focus();page.keyboard.press('Enter');expect(page.locator('.tower-floor')).to_have_count(3);assert page.locator('.tower-floor details').count()>0;assert page.locator('.atlas-option').count()==0
 
 if os.environ.get('AXE_CORE_PATH'):
  page.add_script_tag(path=os.environ['AXE_CORE_PATH']);violations=page.evaluate('async()=> (await axe.run()).violations');assert not violations,json.dumps(violations,ensure_ascii=False)
 page.locator('.tower-floor summary').first.click();assert page.locator('.tower-floor li:visible').count()>0
 page.locator('.tower-description').get_by_role('button',name='记录第三层强敌').click();expect(page.locator('#atlas-editor')).to_contain_text('第三层强敌');page.locator('.atlas-option:visible').first.click();expect(page.locator('#atlas-editor')).to_be_hidden();assert int(page.locator('#candidate-count').inner_text())<80
 page.locator('#atlas-toast').get_by_role('button',name='补充详情').click();expect(page.locator('.tower-floor')).to_have_count(3);assert page.locator('.tower-floor').nth(2).locator('small').inner_text()=='当前候选一致'
 sample=next(r for r in data if r['id']==1005);q={k:sample[k] for k in ['nightlord','mapType','spawn']};q['observations']=[{k:s[k] for k in ['key','category','value']} for s in sample['slots'] if s['value']]
 page.goto(BASE+'/map.html?'+urlencode({'q':json.dumps(q)}));expect(page.locator('#atlas-loading')).to_be_hidden();expect(page.locator('#candidate-count')).to_have_text('1')
 page.set_viewport_size({'width':320,'height':568})
 for tower in towers:
  expect(page.locator('[data-point="'+tower['id']+'"]')).to_be_visible();page.locator('[data-point="'+tower['id']+'"]').focus();page.keyboard.press('Enter');expect(page.locator('.tower-floor')).to_have_count(3)
  slot=next(s for s in sample['slots'] if s['key']==tower['key']);assert page.locator('.tower-floor p').all_text_contents()==[zh[v] for v in slot['floors']]
  assert page.locator('.tower-floor details').count()==0;pane=page.locator('#atlas-editor').bounding_box();last=page.locator('.tower-floor p').last.bounding_box();assert last['y']+last['height']<=pane['y']+pane['height'];page.screenshot(path='/tmp/tower-'+('nw' if tower['location']=='西北神授塔' else 'se')+'.png');page.locator('#atlas-editor').get_by_role('button',name='关闭',exact=True).click()
 page.locator('#open-map-results').click();expect(page.locator('.tower-record-floors')).to_have_count(2);assert page.locator('.tower-record-floors li').count()==6
 assert not errors,errors;b.close();print('PASS two independent towers, three floors each, conditional descriptions, third-floor filtering, saved layouts and complete record details')
