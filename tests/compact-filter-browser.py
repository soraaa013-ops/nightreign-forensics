"""Compact mobile filtering, fixed actions, small viewport and direct result/filter navigation."""
import os,json
from playwright.sync_api import sync_playwright,expect
BASE=os.environ.get('TEST_BASE_URL','http://localhost:4173');expect.set_options(timeout=15000)
def visible_inside(page,selector):
 r=page.locator(selector).bounding_box();assert r and r['y']>=0 and r['y']+r['height']<=page.viewport_size['height']+1,(selector,r)
with sync_playwright() as p:
 b=getattr(p,os.environ.get('TEST_BROWSER','chromium')).launch();page=b.new_page(viewport={'width':390,'height':844});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 for width,height in [(320,568),(390,844),(768,900)]:
  page.goto(BASE+'/map.html?v=compact-1');page.evaluate('sessionStorage.clear()');page.set_viewport_size({'width':width,'height':height});page.reload();expect(page.locator('#atlas-loading')).to_be_hidden();page.locator('#open-map-settings').click()
  for selector in ['#nightlord','#map-type','#spawn','#clue-search','.settings-actions','#more-clues']:visible_inside(page,selector)
  assert page.locator('.settings-scroll').evaluate('(el)=>el.scrollTop')==0
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  page.screenshot(path=f'/tmp/compact-filter-{width}.png')
 print('PASS primary filters, search, first choices and actions in one screen at 320/390/768px',flush=True)
 page.set_viewport_size({'width':390,'height':844});page.locator('#nightlord').select_option('Harmonia');page.locator('#map-type').select_option('Great Hollow');expect(page.locator('#settings-count')).to_have_text('20 份');expect(page.locator('#settings-results')).to_have_text('结果 20')
 page.locator('#clue-search').fill('教堂');expect(page.locator('.clue-option')).not_to_have_count(0);page.locator('.clue-option').first.click();expect(page.locator('#clue-search')).to_be_focused();saved=page.locator('#settings-count').inner_text();page.locator('#undo-map').click();expect(page.locator('#settings-count')).to_have_text('20 份')
 page.locator('#settings-results').click();expect(page.locator('#map-settings')).to_be_hidden();expect(page.locator('#map-results-dialog')).to_be_visible();page.locator('#results-filters').click();expect(page.locator('#map-settings')).to_be_visible();expect(page.locator('#nightlord')).to_have_value('Harmonia')
 page.locator('#settings-display-tab').click();expect(page.locator('#settings-filter-pane')).to_be_hidden();expect(page.locator('#atlas-detail')).to_be_visible();assert '细线连接' not in page.locator('#map-settings').inner_text();page.locator('#atlas-detail').select_option('names');page.locator('#settings-filter-tab').click();expect(page.locator('#map-type')).to_have_value('Great Hollow')
 page.locator('#clue-search').focus();page.set_viewport_size({'width':390,'height':360});page.wait_for_timeout(150)
 visible_inside(page,'#clue-search');visible_inside(page,'.settings-actions');visible_inside(page,'#map-settings .drawer-heading')
 page.locator('[aria-label="清空全部条件"]').click();expect(page.locator('#settings-count')).to_have_text('520 份');page.locator('#undo-map').click();expect(page.locator('#nightlord')).to_have_value('Harmonia')
 page.set_viewport_size({'width':390,'height':844});page.evaluate("() => {navigator.clipboard.writeText=async()=>{throw Error('blocked')};}");page.locator('#share-map').click();expect(page.get_by_role('textbox',name='地图筛选链接')).to_be_visible()
 if os.environ.get('AXE_CORE_PATH'):
  page.add_script_tag(path=os.environ['AXE_CORE_PATH']);v=page.evaluate('async()=> (await axe.run()).violations');assert not v,json.dumps(v)
 assert not errors,errors;b.close();print('PASS DLC filters, continuous search, undo/reset, direct results, display tabs, reduced viewport and visible share fallback',flush=True)
