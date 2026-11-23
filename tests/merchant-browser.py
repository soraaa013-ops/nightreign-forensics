"""Real merchant evidence, mobile layout, restore/share and map emphasis."""
import json, os
from pathlib import Path
from urllib.parse import urlencode, urlparse, parse_qs
from playwright.sync_api import sync_playwright, expect
BASE=os.environ.get('TEST_BASE_URL','http://localhost:4180')
data=json.loads(Path('data/merchants.json').read_text())
def getstate(page):return json.loads(parse_qs(urlparse(page.url).query).get('merchant',parse_qs(urlparse(page.url).query).get('q'))[0])
with sync_playwright() as p:
 browser=p.chromium.launch()
 for width,height in [(320,568),(390,844),(1440,900)]:
  page=browser.new_page(viewport={'width':width,'height':height});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(BASE+'/merchant.html');expect(page.locator('#merchant-count')).to_have_text('21 组候选')
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),width
  page.locator('#merchant-search').fill('wsjj')
  expect(page.locator('.merchant-suggestion').filter(has_text='王室巨剑')).to_have_count(1)
  page.locator('.merchant-suggestion').filter(has_text='王室巨剑').click()
  expect(page.locator('#merchant-count')).to_have_text('2 组候选')
  page.locator('[data-shop="large"]').click()
  expect(page.locator('#merchant-stock')).to_contain_text('黄金律法圣印记')
  page.locator('#pattern-preview').select_option('1')
  expect(page.locator('#inventory-status')).to_contain_text('尚有 2 组候选')
  page.locator('#pattern-preview').select_option('')
  page.locator('#merchant-search').fill('搏击手套')
  page.locator('.merchant-suggestion').filter(has_text='搏击手套').click()
  expect(page.locator('#merchant-count')).to_have_text('已确定 #1')
  page.locator('[data-shop="normal"]').click()
  expect(page.locator('.merchant-stock-row')).to_have_count(11)
  row=page.locator('.merchant-stock-row').filter(has=page.locator('summary',has_text='王室巨剑'))
  row.locator('summary').click();expect(row.locator('.merchant-variant')).to_be_visible()
  if row.locator('.effect-confirm').count():row.locator('.effect-confirm').first.click()
  assert any(o.get('effect') for o in getstate(page)['observations'])
  page.locator('#merchant-mode').select_option('deep')
  assert not any(o.get('effect') for o in getstate(page)['observations'])
  expect(page.locator('#merchant-feedback')).to_contain_text('重新确认')
  page.reload();expect(page.locator('#merchant-mode')).to_have_value('deep');expect(page.locator('#merchant-count')).to_have_text('已确定 #1')
  page.locator('[data-shop="legendary"]').click();expect(page.locator('.merchant-stock-row')).to_have_count(4)
  expect(page.locator('#merchant-stock')).to_contain_text('剑骸大剑')
  page.screenshot(path=f'/tmp/merchant-{width}.png',full_page=True)
  page.locator('#merchant-clear').click();expect(page.locator('#merchant-count')).to_have_text('21 组候选')
  page.locator('#merchant-undo').click();expect(page.locator('#merchant-count')).to_have_text('已确定 #1')
  page.locator('#merchant-share').click();expect(page.locator('#merchant-feedback')).to_contain_text('链接')
  # Sharing opens the same evidence in a fresh context.
  shared=browser.new_page();shared.goto(page.url);expect(shared.locator('#merchant-count')).to_have_text('已确定 #1');shared.close()
  page.locator('#merchant-clear').click();page.locator('#merchant-search').fill('不存在的商品');expect(page.locator('.merchant-suggestion')).to_have_count(0)
  assert not errors,errors;page.close()
 # Data failure has a retry and recovers.
 page=browser.new_page();page.route('**/data/merchants.json*',lambda r:r.abort());page.goto(BASE+'/merchant.html');expect(page.locator('#merchant-error')).to_be_visible();page.unroute('**/data/merchants.json*');page.locator('#merchant-retry').click();expect(page.locator('#merchant-count')).to_have_text('21 组候选');page.close()
 # Valid but conflicting evidence returns zero rather than displaying unrelated stock.
 page=browser.new_page();state={'mode':'normal','observations':[{'shop':'normal','name':'王室巨剑'},{'shop':'normal','name':'维克的战矛'}]};page.goto(BASE+'/merchant.html?'+urlencode({'q':json.dumps(state)}));expect(page.locator('#merchant-count')).to_have_text('0 组候选');expect(page.locator('.merchant-stock-row')).to_have_count(0);page.locator('#merchant-clear').click();expect(page.locator('#merchant-count')).to_have_text('21 组候选');page.close()
 # A known township is emphasized and links to the large merchant tab.
 page=browser.new_page(viewport={'width':390,'height':844})
 maps=json.loads(Path('data/map-data.json').read_text());r=next(r for r in maps['records'] if any(s['value']=='Township - Township' for s in r['slots']));obs=[{'key':s['key'],'category':s['category'],'value':s['value']} for s in r['slots'] if s['value']]
 page.goto(BASE+'/map.html?'+urlencode({'q':json.dumps({'nightlord':r['nightlord'],'mapType':r['mapType'],'spawn':r['spawn'],'observations':obs})}))
 marker=page.locator('[data-merchant="large"]').first;expect(marker).to_be_visible();assert marker.evaluate('(e)=>getComputedStyle(e).borderTopColor')=='rgb(255, 221, 124)';marker.click();expect(page.locator('#atlas-point-title')).to_have_text('大商店');page.get_by_role('link',name='检索商人货物').click();expect(page.locator('#observation-shop')).to_have_value('large');expect(page.locator('[data-shop="large"]')).to_have_attribute('aria-pressed','true');page.close()
 # Great Hollow legendary merchant uses its own emphasis and links to its stock.
 page=browser.new_page(viewport={'width':390,'height':844});dlc=json.loads(Path('data/map-dlc.json').read_text());r=next(r for r in dlc['records'] if r['id']==1005)
 obs=[{'key':s['key'],'category':s['category'],'value':s['value']} for s in r['slots'] if s['value']]
 page.goto(BASE+'/map.html?'+urlencode({'q':json.dumps({'nightlord':r['nightlord'],'mapType':r['mapType'],'spawn':r['spawn'],'observations':obs})}))
 marker=page.locator('[data-merchant="legendary"]').first;expect(marker).to_be_visible();page.screenshot(path='/tmp/merchant-map.png');marker.click();expect(page.locator('#atlas-point-title')).to_have_text('传奇商店');page.get_by_role('link',name='检索商人货物').click();expect(page.locator('#observation-shop')).to_have_value('legendary');page.close()
 browser.close()
print('PASS merchant evidence, normal/deep effects, all shop types, zero-results, restore/share/retry and highlighted map link at mobile/desktop widths')
