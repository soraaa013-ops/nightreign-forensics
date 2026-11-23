"""Combined workspace preserves independent evidence, viewport and shared URLs."""
import json,os
from urllib.parse import urlparse,parse_qs
from playwright.sync_api import sync_playwright,expect
BASE=os.environ.get('TEST_BASE_URL','http://localhost:4180')
with sync_playwright() as p:
 browser=p.chromium.launch()
 for width,height in [(320,568),(390,844),(1440,900)]:
  page=browser.new_page(viewport={'width':width,'height':height});errors=[];requests=[]
  page.on('pageerror',lambda e:errors.append(str(e)));page.on('request',lambda r:requests.append(r.url))
  page.goto(BASE+'/map.html');expect(page.locator('.atlas-point').first).to_be_visible()
  assert not any('/data/merchants.json' in u for u in requests)
  page.locator('#open-map-settings').click();page.locator('#nightlord').select_option('Gladius');page.locator('[data-close-drawer="map-settings"]').click()
  mapq=parse_qs(urlparse(page.url).query)['q'][0]
  page.locator('#atlas-in').click()
  viewport=page.locator('#atlas-tiles').get_attribute('style');page.evaluate('window.originalAtlas=document.querySelector("#atlas-tiles")')
  page.locator('#open-merchant').click();expect(page.locator('#merchant-count')).to_have_text('21 组候选')
  assert page.locator('#merchant-panel').bounding_box()['width']<=width
  page.locator('#merchant-search').fill('wsjj');page.locator('.merchant-suggestion').filter(has_text='王室巨剑').click();expect(page.locator('#merchant-count')).to_have_text('2 组候选')
  params=parse_qs(urlparse(page.url).query);assert params['q'][0]==mapq;assert 'merchant' in params;shared=page.url
  page.locator('#close-merchant').click();expect(page.locator('#merchant-panel')).not_to_be_visible();expect(page.locator('#open-merchant')).to_be_focused()
  assert page.locator('#atlas-tiles').get_attribute('style')==viewport
  assert page.evaluate('window.originalAtlas===document.querySelector("#atlas-tiles")')
  page.locator('#open-map-settings').click();page.locator('#nightlord').select_option('Adel');page.locator('[data-close-drawer="map-settings"]').click()
  assert 'merchant' in parse_qs(urlparse(page.url).query)
  page.locator('#open-merchant').click();expect(page.locator('#merchant-count')).to_have_text('2 组候选');expect(page.locator('#merchant-search')).to_have_value('')
  assert len([u for u in requests if '/data/merchants.json' in u])==1
  page.keyboard.press('Escape');expect(page.locator('#merchant-panel')).not_to_be_visible()
  page.goto(shared);expect(page.locator('#merchant-count')).to_have_text('2 组候选');assert json.loads(parse_qs(urlparse(page.url).query)['q'][0])['nightlord']=='Gladius'
  page.screenshot(path=f'/tmp/integrated-{width}.png');assert not errors,errors;page.close()
 # Panel-shell failure retries without losing the map.
 page=browser.new_page();page.route('**/merchant.html?*',lambda r:r.abort());page.goto(BASE+'/map.html');expect(page.locator('.atlas-point').first).to_be_visible();page.locator('#open-merchant').click();expect(page.locator('#merchant-panel-body')).to_contain_text('加载失败');page.unroute('**/merchant.html?*');page.locator('#merchant-panel-body').get_by_role('button',name='重试').click();expect(page.locator('#merchant-count')).to_have_text('21 组候选');page.close()
 browser.close()
print('PASS same-page map/merchant flow, lazy loading, independent state, shared restore, close/escape focus, viewport preservation and retry')
