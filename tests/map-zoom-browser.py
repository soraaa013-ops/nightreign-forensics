"""Independent pins, dense-area focus, scale disclosure and configurable touch behavior."""
import os,json
from pathlib import Path
from urllib.parse import urlencode
from playwright.sync_api import sync_playwright,expect
BASE=os.environ.get('TEST_BASE_URL','http://localhost:4173');ROOT=Path(__file__).resolve().parents[1]
expect.set_options(timeout=15000)
def tap(page,locator):
 r=locator.bounding_box();assert r;page.touchscreen.tap(r['x']+r['width']/2,r['y']+r['height']/2)
def clean(page):
 page.goto(BASE+'/map.html');page.evaluate('sessionStorage.clear()');page.reload();expect(page.locator('#atlas-loading')).to_be_hidden()
def disjoint(page):
 assert page.locator('.atlas-cluster').count()==0
 rects=page.locator('.atlas-point:visible, .atlas-map-label').evaluate_all('(els)=>els.map(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}})')
 for i,a in enumerate(rects):
  for b in rects[i+1:]:assert a['x']+a['w']<=b['x']+.2 or b['x']+b['w']<=a['x']+.2 or a['y']+a['h']<=b['y']+.2 or b['y']+b['h']<=a['y']+.2,(a,b)
 assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
def settings(page):
 page.locator('#open-map-settings').click();page.locator('#atlas-display-settings').evaluate('(el)=>el.open=true')
def back(page):page.locator('[data-close-drawer="map-settings"]').click()
with sync_playwright() as p:
 browser=getattr(p,os.environ.get('TEST_BROWSER','chromium')).launch();page=browser.new_page(viewport={'width':390,'height':844},has_touch=True);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 for width,height in [(320,568),(390,844),(844,390),(768,1024),(1440,900)]:
  page.set_viewport_size({'width':width,'height':height});clean(page);disjoint(page)
  for _ in range(5):page.locator('#atlas-in').click();disjoint(page)
  assert page.locator('#atlas-viewport').get_attribute('data-detail')=='2'
  assert page.locator('.atlas-map-label span').count()>0
  page.locator('#atlas-fit').click();disjoint(page)
 print('PASS independent pins and label avoidance at five screen sizes and six zoom scales',flush=True)
 page.set_viewport_size({'width':390,'height':844});clean(page)
 # The castle and its courtyard/roof/basement are a known dense region.
 target=page.locator('[data-point="Castle - Castle"]');tap(page,target)
 assert float(page.locator('#atlas-viewport').get_attribute('data-zoom'))>1
 expect(page.locator('#atlas-editor')).to_be_hidden();expect(page.locator('#candidate-count')).to_have_text('520');expect(page.locator('#atlas-back')).to_be_visible();disjoint(page)
 page.screenshot(path='/tmp/zoom-mobile-focus.png')
 tap(page,target);expect(page.locator('#atlas-editor')).to_be_visible();page.locator('#atlas-editor').get_by_role('button',name='关闭',exact=True).click()
 page.locator('#atlas-back').click();assert page.locator('#atlas-viewport').get_attribute('data-zoom')=='1';expect(page.locator('#atlas-back')).to_be_hidden()
 page.locator('[data-point="Castle - Castle"]').focus();page.keyboard.press('Enter');expect(page.locator('#atlas-editor')).to_be_visible();assert page.locator('#atlas-viewport').get_attribute('data-zoom')=='1';page.locator('#atlas-editor').get_by_role('button',name='关闭',exact=True).click()
 settings(page);page.locator('#atlas-detail').select_option('details');page.locator('#atlas-autozoom').uncheck();back(page);assert page.locator('#atlas-viewport').get_attribute('data-detail')=='2';disjoint(page)
 tap(page,page.locator('[data-point="Castle - Castle"]'));expect(page.locator('#atlas-editor')).to_be_visible();assert page.locator('#atlas-viewport').get_attribute('data-zoom')=='1';page.locator('#atlas-editor').get_by_role('button',name='关闭',exact=True).click()
 page.reload();expect(page.locator('#atlas-loading')).to_be_hidden();assert page.locator('#atlas-viewport').get_attribute('data-detail')=='2';settings(page);assert not page.locator('#atlas-autozoom').is_checked();page.locator('#atlas-detail').select_option('none');back(page);expect(page.locator('.atlas-map-label')).to_have_count(0)
 print('PASS dense-area auto focus, second-tap access, back, explicit display settings and persistence',flush=True)
 # A determined point still opens its description directly, even when zooming for context.
 sample=json.loads((ROOT/'data/map-data.json').read_text())['records'][0]
 q={k:sample[k] for k in ['nightlord','mapType','spawn']};q['observations']=[{k:s[k] for k in ['key','category','value']} for s in sample['slots'] if s['value']]
 page.evaluate('sessionStorage.clear()');page.goto(BASE+'/map.html?'+urlencode({'q':json.dumps(q)}));expect(page.locator('#atlas-loading')).to_be_hidden();tap(page,page.locator('[data-point="Castle - Castle"]'));expect(page.locator('.point-description')).to_be_visible();assert page.locator('.atlas-option').count()==0
 assert not errors,errors
 print('PASS determined descriptions and no browser errors',flush=True);browser.close()
