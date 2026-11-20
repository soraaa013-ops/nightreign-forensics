"""Precise mouse/touch selection, optional type-to-boss continuation, keyboard and undo."""
import json,os
from urllib.parse import urlparse,parse_qs
from playwright.sync_api import sync_playwright,expect
BASE=os.environ.get('TEST_BASE_URL','http://localhost:4173')
def state(page):return json.loads(parse_qs(urlparse(page.url).query)['q'][0])
def ready(page):
 page.goto(BASE+'/map.html');page.evaluate('sessionStorage.clear()');page.goto(BASE+'/map.html');expect(page.locator('[data-point="Castle - Castle"]')).to_be_visible()
def tap(page,locator,touch):
 if touch:
  r=locator.bounding_box();page.touchscreen.tap(r['x']+r['width']/2,r['y']+r['height']/2)
 else:locator.click()
with sync_playwright() as p:
 browser=getattr(p,os.environ.get('TEST_BROWSER','chromium')).launch();errors=[]
 for width,height,touch in [(320,568,True),(390,844,True),(1440,900,False)]:
  page=browser.new_page(viewport={'width':width,'height':height},has_touch=touch);page.on('pageerror',lambda e:errors.append(str(e)));ready(page)
  before=page.locator('#atlas-tiles').get_attribute('style')
  tap(page,page.locator('[data-point="Castle - Castle"]'),touch);expect(page.locator('#atlas-editor')).to_be_visible();assert page.locator('#atlas-tiles').get_attribute('style')==before;assert page.locator('#atlas-viewport').get_attribute('data-zoom')=='1';page.locator('#atlas-editor').get_by_role('button',name='关闭',exact=True).click()
  key='Major Base - Waypoint Ruins';target=page.locator('[data-point="'+key+'"]');tap(page,target,touch)
  page.locator('.atlas-type-options [data-value="Great Church"]').click();expect(page.locator('#atlas-editor')).to_be_visible();expect(page.locator('.atlas-quick-exact')).to_be_visible();assert page.locator('#atlas-tiles').get_attribute('style')==before
  assert len(state(page)['observations'])==1 and state(page)['observations'][0]['match']=='type'
  options=page.locator('.atlas-quick-exact .atlas-option');assert all(v.startswith('Great Church - ') for v in options.evaluate_all('(els)=>els.map(e=>e.dataset.value)'))
  golem=page.locator('.atlas-quick-exact [data-value="Great Church - Guardian Golem"]');expect(golem).to_be_visible();r=golem.bounding_box();pane=page.locator('#atlas-editor').bounding_box();assert r['y']>=pane['y'] and r['y']+r['height']<=pane['y']+pane['height']+1
  page.screenshot(path=f'/tmp/flow-church-{width}.png');golem.click();expect(page.locator('#atlas-editor')).to_be_hidden();assert state(page)['observations']==[{'key':key,'category':'Major Base','value':'Great Church - Guardian Golem'}]
  page.locator('#atlas-undo').click();assert state(page)['observations'][0]['match']=='type';page.locator('#atlas-fit').click();tap(page,target,touch);expect(page.locator('.atlas-quick-exact')).to_be_visible();page.locator('#atlas-editor').get_by_role('button',name='关闭',exact=True).click();assert state(page)['observations'][0]['match']=='type'
  page.reload();expect(page.locator('#candidate-count')).not_to_have_text('520');assert state(page)['observations'][0]['match']=='type'
  page.close()
 page=browser.new_page(viewport={'width':390,'height':844});page.on('pageerror',lambda e:errors.append(str(e)));ready(page)
 page.locator('[data-point="Major Base - Waypoint Ruins"]').focus();page.keyboard.press('Enter');page.locator('.atlas-type-options [data-value="Great Church"]').focus();page.keyboard.press('Enter');expect(page.locator('.atlas-quick-exact .atlas-option').first).to_be_focused();page.keyboard.press('Enter');expect(page.locator('#atlas-editor')).to_be_hidden();assert 'match' not in state(page)['observations'][0];page.close()
 assert not errors,errors;browser.close();print('PASS precise mouse/touch opens without zoom; type continues directly to matching bosses; optional skip, one-slot refinement, undo, restore and short-screen targets')
