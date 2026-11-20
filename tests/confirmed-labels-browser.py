"""Confirm a boss through the actual map UI, retaining building icons and safe labels."""
import os,json
from pathlib import Path
from urllib.parse import urlencode
from playwright.sync_api import sync_playwright,expect
BASE=os.environ.get('TEST_BASE_URL','http://localhost:4173');ROOT=Path(__file__).resolve().parents[1]
def disjoint(page):
 rects=page.locator('.atlas-point:visible, .atlas-map-label').evaluate_all('(els)=>els.map(e=>{let r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}})')
 for i,a in enumerate(rects):
  for b in rects[i+1:]:assert a['x']+a['w']<=b['x']+.2 or b['x']+b['w']<=a['x']+.2 or a['y']+a['h']<=b['y']+.2 or b['y']+b['h']<=a['y']+.2,(a,b)
def mark(page,key,value):
 page.locator('[data-point="'+key+'"]').focus();page.keyboard.press('Enter')
 page.locator('.atlas-exact').evaluate('(e)=>e.open=true');page.locator('.atlas-options [data-value="'+value+'"]').click()
 expect(page.locator('#atlas-editor')).to_be_hidden()
with sync_playwright() as p:
 b=getattr(p,os.environ.get('TEST_BROWSER','chromium')).launch();page=b.new_page(viewport={'width':390,'height':844});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(BASE+'/map.html');expect(page.locator('[data-point="Field Boss - East of Murkwater Terminus"]')).to_be_visible()
 key='Field Boss - East of Murkwater Terminus';label=page.locator('.atlas-map-label[data-for="'+key+'"]')
 expect(label).to_have_count(0);mark(page,key,'Black Knife Assassin');expect(label).to_have_text('黑刀刺客');expect(page.locator('[data-point="'+key+'"]')).to_have_attribute('data-icon','boss');disjoint(page)
 page.locator('#atlas-undo').click();expect(label).to_have_count(0);page.locator('#atlas-fit').click()
 key='Major Base - Waypoint Ruins';label=page.locator('.atlas-map-label[data-for="'+key+'"]');mark(page,key,'Great Church - Guardian Golem');expect(label).to_have_text('魔像守卫');expect(page.locator('[data-point="'+key+'"]')).to_have_attribute('data-icon','temple');disjoint(page);page.screenshot(path='/tmp/confirmed-golem-mobile.png')
 page.locator('#atlas-undo').click();page.locator('[data-point="'+key+'"]').focus();page.keyboard.press('Enter');page.locator('.atlas-type-options [data-value="Great Church"]').click();expect(label).to_have_count(0);expect(page.locator('[data-point="'+key+'"]')).to_have_attribute('data-icon','temple')
 # A uniquely inferred layout has enemy names too; ensure dense labels never overlap pins.
 sample=json.loads((ROOT/'data/map-data.json').read_text())['records'][0];q={k:sample[k] for k in ['nightlord','mapType','spawn']};q['observations']=[{k:s[k] for k in ['key','category','value']} for s in sample['slots'] if s['value']]
 for width,height in [(320,568),(390,844),(1440,900)]:
  page.set_viewport_size({'width':width,'height':height});page.goto(BASE+'/map.html?'+urlencode({'q':json.dumps(q)}));expect(page.locator('.atlas-map-label').first).to_be_visible()
  for _ in range(4):disjoint(page);page.locator('#atlas-in').click()
  disjoint(page)
  assert all(not any(t in text for t in ['小型据点','大型据点','圣人桥','候选：']) for text in page.locator('.atlas-map-label').all_text_contents())
 assert not errors,errors;b.close();print('PASS confirmed boss plus icon, church icon plus golem, type-only silence, undo, inference and multi-screen collision avoidance')
