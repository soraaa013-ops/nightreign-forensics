"""End-to-end interaction tests against local or deployed pages."""
import json, os, re
from pathlib import Path
from urllib.parse import urlparse,parse_qs,urlencode
from playwright.sync_api import sync_playwright, expect
ROOT=Path(__file__).resolve().parents[1];BASE=os.environ.get('TEST_BASE_URL','http://localhost:4173')
OUT=Path(os.environ.get('TEST_ARTIFACTS','/tmp/nightreign-qa-artifacts'));OUT.mkdir(parents=True,exist_ok=True)
maps=json.loads((ROOT/'data/map-data.json').read_text());locale=json.loads((ROOT/'data/zh-CN.json').read_text());checks=[]
maps['records'] += json.loads((ROOT/'data/map-dlc.json').read_text())['records']

def passed(name):checks.append(name);print('PASS',name,flush=True)
def ready(page,path='/',fresh=True):
 if fresh and page.url.startswith(BASE):page.evaluate('sessionStorage.clear()')
 page.goto(BASE+path);page.wait_for_load_state('networkidle');expect(page.locator('form')).to_have_attribute('aria-busy','false')
def no_overflow(page):assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
def choose(page,index,id):
 page.locator('.slot-tab').nth(index).click();page.locator('#reset-effect-filters').click();page.locator('#effect-query').fill(str(id));page.locator(f'[data-effect-id="{id}"]').click()
def settings(page):
 if not page.locator('#map-settings').is_visible():page.locator('#open-map-settings').click()
def results(page):
 if page.locator('#map-settings').is_visible():page.locator('[data-close-drawer="map-settings"]').click()
 if not page.locator('#map-results-dialog').is_visible():page.locator('#open-map-results').click()
def open_details(page,id):
 if id in ['text-search','base-filters','location-details']:settings(page)
 page.locator('#'+id).evaluate('(el)=>el.open=true')
def add_clue(page,slot):
 open_details(page,'text-search')
 open_details(page,'location-details');page.locator('#clue-category').select_option(slot['category']);page.locator('#clue-location').select_option(slot['key'])
 text=locale['map'][slot['value']] if slot['value'] else '此处为空';page.locator('#clue-search').fill(text)
 page.locator('.clue-option').filter(has=page.get_by_text(text,exact=True)).click()
def ids_from_url(page):return [int(x) for x in parse_qs(urlparse(page.url).query)['effects'][0].split(',')]
with sync_playwright() as p:
 browser_type=os.environ.get('TEST_BROWSER','chromium');browser=getattr(p,browser_type).launch();page=browser.new_page(viewport={'width':1440,'height':1000});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 ready(page);expect(page.locator('#template option')).to_have_count(4);expect(page.locator('#effect-query')).to_be_visible();expect(page.locator('#copy-report')).to_be_disabled()
 assert page.locator('#effect-query').bounding_box()['y']<450
 page.screenshot(path=str(OUT/'relic-desktop.png'),full_page=True)
 page.locator('#effect-query').fill('回血');assert page.locator('.effect-option').count()>0
 assert all('恢复' in x and '血量' in x for x in page.locator('.effect-option>span').all_text_contents())
 page.locator('#effect-query').fill('追踪者大招');assert page.locator('.effect-option').count()>0
 page.locator('#effect-query').fill('回血');page.locator('#effect-character').select_option('守护者');page.locator('#effect-category').select_option('恢复与续航');assert page.locator('.effect-option').count()>0
 page.locator('#effect-query').fill('完全不存在的词');expect(page.locator('.empty-state')).to_be_visible()
 page.locator('#reset-effect-filters').click();expect(page.locator('.effect-option')).to_have_count(40);page.locator('#more-effects').click();expect(page.locator('.effect-option')).to_have_count(80)
 passed('Search visible immediately; aliases, punctuation, cross filters, empty state and pagination')
 page.locator('#effect-query').fill('追踪者');page.locator('#effect-character').select_option('追踪者')
 names=page.locator('.effect-option>span').all_text_contents();assert len(names)>=3
 for name in names[:3]:
  page.locator('.effect-option').filter(has=page.get_by_text(name,exact=True)).click()
  expect(page.locator('#effect-query')).to_have_value('追踪者');expect(page.locator('#effect-character')).to_have_value('追踪者')
 expect(page.locator('#report-stamp')).not_to_have_text('待检');expect(page.locator('.slot-tab')).to_have_count(3)
 assert page.locator('.effect-option:not([disabled])').count()==0
 assert page.locator('.choose-effect').all_text_contents()==names[:3]
 page.locator('#undo-relic').click();expect(page.locator('#report-title')).to_have_text('已选 2 / 3 条')
 page.reload();page.wait_for_load_state('networkidle');expect(page.locator('#report-title')).to_have_text('已选 2 / 3 条')
 passed('Continuous three-slot selection preserves filters, blocks accidental fourth choice, undo and partial refresh restore')
 ready(page);page.locator('#effect-query').fill('守护者回血');page.locator('#effect-query').focus()
 for _ in range(20):
  page.keyboard.press('Tab')
  if page.locator('.effect-option').first.evaluate('(el)=>el===document.activeElement'):break
 expect(page.locator('.effect-option').first).to_be_focused();page.keyboard.press('Enter');expect(page.locator('#report-title')).to_have_text('已选 1 / 3 条');expect(page.locator('#effect-query')).to_be_focused()
 passed('Keyboard-only selection returns to search for the next slot')
 ready(page)
 for option in page.locator('#template option').evaluate_all('(els)=>els.map(x=>x.value)'):
  page.locator('#template').select_option(option);page.get_by_role('button',name='填入示例').click();expect(page.locator('#report')).to_have_class('report valid');expect(page.locator('#report-probability')).to_be_visible()
 share=page.url;ids=ids_from_url(page);ready(page,share.removeprefix(BASE));expect(page.locator('#report')).to_have_class('report valid');assert ids_from_url(page)==ids
 page.locator('.effect-slot').first.get_by_role('button',name='下移').click();expect(page.locator('#report')).to_have_class('report reorder')
 page.get_by_role('button',name='按游戏顺序排列').click();expect(page.locator('#report')).to_have_class('report valid')
 choose(page,1,ids[0]);expect(page.locator('#report')).to_have_class('report invalid')
 page.locator('.effect-slot').first.get_by_role('button',name='移除').click();expect(page.locator('#copy-report')).to_be_disabled();assert '?' not in page.url
 page.get_by_role('button',name='清空',exact=True).click();expect(page.locator('#report-title')).to_have_text('已选 0 / 3 条')
 page.locator('#undo-relic').click();expect(page.locator('#report-title')).to_have_text('已选 2 / 3 条')
 passed('Four templates, probability, sharing, reorder, duplicate detection, remove, reset and undo reset')
 page.get_by_role('button',name='填入示例').click();page.evaluate("() => {navigator.clipboard.writeText=async text=>{window.copied=text;};}")
 page.get_by_role('button',name='复制报告链接').click();assert page.evaluate('window.copied')==page.url
 page.evaluate("() => {navigator.clipboard.writeText=async()=>{throw Error('denied');};}");page.get_by_role('button',name='复制报告链接').click();expect(page.get_by_role('textbox',name='报告链接')).to_have_value(page.url)
 ready(page,'/?template=oops&effects=1,2,3');expect(page.locator('#action-status')).to_contain_text('报告链接不完整')
 ready(page);page.locator('#include-unsupported').check();page.locator('#effect-query').fill('10000');page.locator('.effect-option').filter(has_text='当前模板无法抽取').first.click();expect(page.locator('#report-title')).to_have_text('已选 1 / 3 条')
 passed('Clipboard fallback, malformed links and unsupported effect selection')
 ready(page,'/map.html');expect(page.locator('#candidate-count')).to_have_text('520');assert page.locator('#atlas-viewport').bounding_box()['y']<450
 page.screenshot(path=str(OUT/'map-desktop.png'),full_page=True)
 open_details(page,'text-search');page.locator('#quick-clues').get_by_role('button',name='魔像',exact=True).click();expect(page.locator('#clue-search')).to_have_value('魔像');expect(page.locator('.clue-option')).to_have_count(2)
 count=int(re.search(r'\d+',page.locator('.clue-option small').first.inner_text()).group());page.locator('.clue-option').first.click();expect(page.locator('#candidate-count')).to_have_text(str(count));expect(page.locator('#map-feedback')).to_contain_text('已添加')
 mapshare=page.url;page.reload();page.wait_for_load_state('networkidle');expect(page.locator('#candidate-count')).to_have_text(str(count))
 ready(page,'/',fresh=False);ready(page,'/map.html',fresh=False);expect(page.locator('#candidate-count')).to_have_text(str(count))
 # Independently restore the shared link in a fresh tab.
 other=browser.new_page();ready(other,mapshare.removeprefix(BASE));expect(other.locator('#candidate-count')).to_have_text(str(count));other.close()
 ready(page,mapshare.removeprefix(BASE));settings(page);page.locator('.filter-chip').click();expect(page.locator('#candidate-count')).to_have_text('520');page.locator('#undo-map').click();expect(page.locator('#candidate-count')).to_have_text(str(count))
 passed('Map first-screen atlas, shortcut, predicted counts, URL restore in fresh tab and undo condition removal')
 settings(page);page.get_by_role('button',name='清空全部条件').click();expect(page.locator('#candidate-count')).to_have_text('520');page.locator('#undo-map').click();expect(page.locator('#candidate-count')).to_have_text(str(count))
 page.evaluate("() => {navigator.clipboard.writeText=async text=>{window.copied=text;};}");page.locator('#share-map').click();assert page.evaluate('window.copied')==page.url
 page.evaluate("() => {navigator.clipboard.writeText=async()=>{throw Error('denied');};}");page.locator('#share-map').click();expect(page.get_by_role('textbox',name='地图筛选链接')).to_have_value(page.url)
 ready(page,'/map.html?q=bad');expect(page.locator('#candidate-count')).to_have_text('520');expect(page.locator('#map-feedback')).to_contain_text('筛选链接无效')
 passed('Map undo reset, share clipboard paths and invalid query recovery')
 ready(page,'/map.html');open_details(page,'base-filters');page.locator('#nightlord').select_option('Gladius');expect(page.locator('#candidate-count')).to_have_text('50')
 results(page);page.locator('.candidate-card').first.click();expect(page.locator('#map-result')).to_contain_text('候选地图预览');page.get_by_role('button',name='关闭预览').click();expect(page.locator('#map-result')).to_be_hidden()
 page.locator('#use-clue').click();expect(page.locator('#atlas-editor')).to_be_visible();assert page.locator('.atlas-option').count()>1;page.locator('#atlas-editor').get_by_role('button',name='关闭',exact=True).click()
 settings(page);page.get_by_role('button',name='清空全部条件').click();expect(page.locator('#candidate-count')).to_have_text('520')
 sample=maps['records'][0]
 for slot in sample['slots'][:2]:add_clue(page,slot)
 expect(page.locator('#candidate-count')).to_have_text('1');expect(page.locator('.clue-option')).to_have_count(0)
 saved={'nightlord':'','mapType':'','spawn':'','observations':[{k:slot[k] for k in ['key','category','value']} for slot in sample['slots'][:4]]}
 ready(page,'/map.html?'+urlencode({'q':json.dumps(saved)}));settings(page);expect(page.locator('.filter-chip')).to_have_count(4)
 expected=[r for r in maps['records'] if all(any(s['key']==slot['key'] and s['value']==slot['value'] for s in r['slots']) for slot in sample['slots'][:4])]
 expect(page.locator('#candidate-count')).to_have_text(str(len(expected)));page.locator('.filter-chip').nth(1).click();expect(page.locator('.filter-chip')).to_have_count(3)
 passed('Facets, preview, recommendation, redundant options hidden, multi-observation restoration and removal')
 settings(page);page.get_by_role('button',name='清空全部条件').click();open_details(page,'base-filters')
 for field,key in [('nightlord','nightlord'),('map-type','mapType'),('spawn','spawn')]:page.locator('#'+field).select_option(sample[key])
 remaining=[r for r in maps['records'] if all(r[k]==sample[k] for k in ['nightlord','mapType','spawn'])]
 for slot in sample['slots']:
  if len(remaining)==1:break
  narrowed=[r for r in remaining if any(s['key']==slot['key'] and s['value']==slot['value'] for s in r['slots'])]
  if len(narrowed)<len(remaining):add_clue(page,slot);remaining=narrowed
 results(page);expect(page.locator('#candidate-count')).to_have_text('1');expect(page.locator('#map-result')).to_contain_text('已锁定地图布局')
 expect(page.locator('.poi-list article')).to_have_count(len([s for s in sample['slots'] if s['value']]))
 assert page.locator('.location-group').count()>1;page.locator('.location-group').nth(1).locator('summary').click()
 assert not re.search('[A-Za-zＡ-Ｚａ-ｚ]|绝活|对著',page.locator('main').inner_text())
 page.screenshot(path=str(OUT/'map-result-desktop.png'),full_page=True)
 passed('Unique match, grouped complete details, Chinese-only content')
 for filename,path,retry in [('game-data.json','/','重新加载规则'),('map-data.json','/map.html','重新加载地图'),('zh-CN.json','/','重新加载规则')]:
  pattern='**/data/'+filename;page.route(pattern,lambda route:route.fulfill(status=503,body='unavailable'));ready(page,path);expect(page.get_by_role('button',name=retry)).to_be_visible()
  expect(page.locator('#effect-query' if path=='/' else '#clue-search')).to_be_disabled();page.unroute(pattern);page.get_by_role('button',name=retry).click();expect(page.get_by_role('button',name=retry)).to_be_hidden()
 passed('Rule/map/locale loading failure and retry')
 for width in [320,390,768,1440]:
  page.set_viewport_size({'width':width,'height':844})
  for path,search,name in [('/','#effect-query','relic'),('/map.html','#clue-search','map')]:
   ready(page,path);no_overflow(page);assert page.locator(search if path=='/' else '#atlas-viewport').bounding_box()['y']<450
   if path!='/':open_details(page,'text-search')
   page.locator(search).fill('回血' if path=='/' else '魔像')
   page.locator('.effect-option' if path=='/' else '.clue-option').first.click();no_overflow(page)
   if path=='/map.html':
    page.locator('[data-close-drawer="map-settings"]').click();page.locator('#open-map-results').click();expect(page.locator('#map-output')).to_be_visible();page.locator('[data-close-drawer="map-results-dialog"]').click()
   elif width<801:
    link=page.locator('#relic-result-link');expect(link).to_be_visible();link.click();page.wait_for_function('document.querySelector("#selected-panel").getBoundingClientRect().top<300');page.locator(search).scroll_into_view_if_needed()
   if width==390:page.screenshot(path=str(OUT/f'{name}-mobile.png'),full_page=True)
 passed('320/390/768/1440px: first-screen input, primary flow, fixed result links and no overflow')
 # Storage access may fail on privacy-restricted browsers.
 restricted=browser.new_page();restricted.add_init_script("Storage.prototype.setItem=()=>{throw Error('blocked')};Storage.prototype.getItem=()=>{throw Error('blocked')}")
 ready(restricted);restricted.get_by_role('button',name='填入示例').click();expect(restricted.locator('#report')).to_have_class('report valid');ready(restricted,'/map.html');expect(restricted.locator('#candidate-count')).to_have_text('520');restricted.close()
 passed('Blocked browser storage does not prevent either tool from working')
 ready(page);page.keyboard.press('Tab');expect(page.locator('.skip-link')).to_be_focused();page.emulate_media(reduced_motion='reduce');assert page.evaluate('getComputedStyle(document.documentElement).scrollBehavior')=='auto';assert not errors,errors
 passed('Skip link, reduced motion and no uncaught exceptions')
 browser.close();print(f'{len(checks)} browser groups passed ({browser_type}). Screenshots: {OUT}')
