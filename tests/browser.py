"""Real browser flows against local or deployed pages. See docs/EXPERIENCE_QA.md."""
import json, os, re
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
ROOT=Path(__file__).resolve().parents[1]
BASE=os.environ.get('TEST_BASE_URL','http://localhost:4173')
OUT=Path(os.environ.get('TEST_ARTIFACTS','/tmp/nightreign-qa-artifacts'));OUT.mkdir(parents=True,exist_ok=True)
maps=json.loads((ROOT/'data/map-data.json').read_text())
locale=json.loads((ROOT/'data/zh-CN.json').read_text())
checks=[]
def passed(name):checks.append(name);print('PASS',name,flush=True)
def ready(page,path='/'):
 page.goto(BASE+path);page.wait_for_load_state('networkidle');expect(page.locator('form')).to_have_attribute('aria-busy','false')
def no_overflow(page):assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
def choose(page,index,id):
 page.locator('.choose-effect').nth(index).click();page.locator('#effect-query').fill(str(id));page.locator(f'[data-effect-id="{id}"]').click()
def add_clue(page,slot):
 page.locator('#clue-category').select_option(slot['category']);page.locator('#clue-location').select_option(slot['key'])
 text=locale['map'][slot['value']] if slot['value'] else '此处为空'
 page.locator('#clue-search').fill(text)
 page.locator('.clue-option').filter(has=page.get_by_text(text,exact=True)).click()
with sync_playwright() as p:
 browser_type=os.environ.get('TEST_BROWSER','chromium');browser=getattr(p,browser_type).launch()
 page=browser.new_page(viewport={'width':1440,'height':1000});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 ready(page);expect(page.locator('#template option')).to_have_count(4);expect(page.locator('#copy-report')).to_be_disabled()
 page.screenshot(path=str(OUT/'relic-desktop.png'),full_page=True)
 page.locator('.choose-effect').first.click();expect(page.get_by_role('dialog')).to_be_visible();expect(page.locator('#effect-query')).to_be_focused()
 page.locator('#effect-query').fill('回血');assert page.locator('.effect-option').count()>0
 assert all('血量' in x for x in page.locator('.effect-option>span').all_text_contents())
 page.locator('#effect-query').fill('追踪者 大招');assert page.locator('.effect-option').count()>0
 page.locator('#effect-character').select_option('追踪者');page.locator('#effect-category').select_option('角色专属')
 assert all('【追踪者】' in x and '绝招' in x for x in page.locator('.effect-option>span').all_text_contents())
 page.locator('#effect-query').fill('回血');page.locator('#effect-character').select_option('守护者');page.locator('#effect-category').select_option('恢复与续航');assert page.locator('.effect-option').count()>0
 page.locator('#effect-query').fill('完全不存在的词');expect(page.locator('.empty-state')).to_be_visible()
 page.locator('#reset-effect-filters').click();expect(page.locator('.effect-option')).to_have_count(340)
 page.locator('#effect-query').fill('回蓝');page.screenshot(path=str(OUT/'picker-desktop.png'))
 page.keyboard.press('Escape');expect(page.get_by_role('dialog')).not_to_be_visible();expect(page.locator('.choose-effect').first).to_be_focused()
 passed('Picker: aliases, multiple keywords, category + character, reset, Escape and focus restoration')
 # Full keyboard selection without typing internal IDs.
 page.locator('.choose-effect').first.click();page.locator('#effect-query').fill('追踪者 大招')

 for _ in range(8):
  page.keyboard.press('Tab')
  if page.locator('.effect-option').first.evaluate('(el)=>el===document.activeElement'):break
 expect(page.locator('.effect-option').first).to_be_focused();page.keyboard.press('Enter')
 expect(page.get_by_role('dialog')).not_to_be_visible();expect(page.locator('#report-title')).to_have_text('已选 1 / 3 条')
 passed('Keyboard-only selection and partial selection feedback')
 for option in page.locator('#template option').evaluate_all('(els)=>els.map(x=>x.value)'):
  page.locator('#template').select_option(option);page.get_by_role('button',name='填入示例').click();expect(page.locator('#report')).to_have_class('report valid')
  expect(page.locator('#report-probability')).to_be_visible()
 share=page.url;ids=[int(x) for x in share.split('effects=')[1].replace('%2C',',').split(',')]
 assert all('#' not in x for x in page.locator('.choose-effect').all_text_contents())
 passed('Four templates, automatic reports, probabilities, no IDs in selected display')
 ready(page,share.removeprefix(BASE));expect(page.locator('#report')).to_have_class('report valid')
 page.locator('.effect-slot').nth(0).get_by_role('button',name='下移').click();expect(page.locator('#report')).to_have_class('report reorder')
 page.get_by_role('button',name='按游戏顺序排列').click();expect(page.locator('#report')).to_have_class('report valid')
 choose(page,1,ids[0]);expect(page.locator('#report')).to_have_class('report invalid')
 passed('Share roundtrip, move, one-click canonical order, duplicate detection retained')
 page.locator('.effect-slot').first.get_by_role('button',name='移除').click();expect(page.locator('#report-title')).to_have_text('已选 2 / 3 条');expect(page.locator('#copy-report')).to_be_disabled();assert '?' not in page.url
 page.get_by_role('button',name='清空',exact=True).click();expect(page.locator('#report-title')).to_have_text('已选 0 / 3 条')
 page.get_by_role('button',name='填入示例').click()
 page.evaluate("() => {navigator.clipboard.writeText = async text => {window.copied=text;};}")
 page.get_by_role('button',name='复制报告链接').click();assert page.evaluate('window.copied')==page.url
 page.evaluate("() => {navigator.clipboard.writeText = async () => {throw Error('denied');};}")
 page.get_by_role('button',name='复制报告链接').click();expect(page.get_by_role('textbox',name='报告链接')).to_have_value(page.url)
 passed('Remove/reset clear stale report and URL; clipboard success and failure')
 ready(page,'/?template=oops&effects=1,2,3');expect(page.locator('#action-status')).to_contain_text('报告链接不完整')
 # All effects remain selectable: invalid templates must still be diagnosable.
 ready(page);page.locator('.choose-effect').first.click();page.locator('#effect-query').fill('');page.locator('#include-unsupported').check()
 unsupported=page.locator('.effect-option').filter(has_text='当前模板无法抽取');assert unsupported.count()>0
 unsupported.first.click();expect(page.locator('#report-title')).to_have_text('已选 1 / 3 条')
 passed('Malformed links and out-of-template effects remain inspectable')
 ready(page,'/map.html');expect(page.locator('#candidate-count')).to_have_text('320')
 page.locator('#clue-search').fill('魔像');expect(page.locator('.clue-option')).to_have_count(2)
 count=int(page.locator('.clue-option small').first.inner_text().split()[0]);page.locator('.clue-option').first.click()
 expect(page.locator('#candidate-count')).to_have_text(str(count));expect(page.locator('#filter-chips')).to_contain_text('位置不限')
 page.locator('.filter-chip').click();expect(page.locator('#candidate-count')).to_have_text('320')
 passed('Search enemies without location, count prediction and per-clue undo')
 page.locator('#nightlord').select_option('Gladius');expect(page.locator('#candidate-count')).to_have_text('40')
 page.locator('.candidate-card').first.click();expect(page.locator('#map-result')).to_be_visible();page.get_by_role('button',name='关闭预览').click();expect(page.locator('#map-result')).to_be_hidden()
 page.locator('#use-clue').click();assert page.locator('#clue-location').input_value()
 assert page.locator('.clue-option:not([disabled])').count()>1
 page.get_by_role('button',name='清空全部条件').click();expect(page.locator('#candidate-count')).to_have_text('320')
 passed('Facet counts, candidate preview, recommended position and full reset')
 # More than two observations can be added and independently removed.
 sample=maps['records'][0]
 for slot in sample['slots'][:4]:add_clue(page,slot)
 expect(page.locator('.filter-chip')).to_have_count(4)
 expected=[record for record in maps['records'] if all(any(s['key']==slot['key'] and s['value']==slot['value'] for s in record['slots']) for slot in sample['slots'][:4])]
 expect(page.locator('#candidate-count')).to_have_text(str(len(expected)))
 page.locator('.filter-chip').nth(1).click();expect(page.locator('.filter-chip')).to_have_count(3)
 passed('Four observations, exact intersection and individual removal')
 page.get_by_role('button',name='清空全部条件').click()
 for field,key in [('nightlord','nightlord'),('map-type','mapType'),('spawn','spawn')]:page.locator('#'+field).select_option(sample[key])
 remaining=[r for r in maps['records'] if all(r[k]==sample[k] for k in ['nightlord','mapType','spawn'])]
 for slot in sample['slots']:
  if len(remaining)==1:break
  narrowed=[r for r in remaining if any(s['key']==slot['key'] and s['value']==slot['value'] for s in r['slots'])]
  if len(narrowed)<len(remaining):add_clue(page,slot);remaining=narrowed
 expect(page.locator('#candidate-count')).to_have_text('1');expect(page.locator('#map-result')).to_be_visible()
 expect(page.locator('.poi-list article')).to_have_count(len([s for s in sample['slots'] if s['value']]))
 assert not re.search('[A-Za-zＡ-Ｚａ-ｚ]|绝活',page.locator('main').inner_text())
 page.screenshot(path=str(OUT/'map-result-desktop.png'),full_page=True)
 passed('Unique result, complete location details and Chinese-only visible text')
 # Zero-count options cannot be accidentally added; existing evidence stays visible.
 page.locator('#clue-search').fill('');assert page.locator('.clue-option[disabled]').count()>=0
 chips=page.locator('.filter-chip').all_text_contents()
 page.locator('#clue-category').select_option('Castle');page.locator('#clue-location').select_option('Castle - Castle')
 assert page.locator('.clue-option[disabled]').count()>0
 assert page.locator('.filter-chip').all_text_contents()==chips
 page.get_by_role('button',name='清空全部条件').click();expect(page.locator('#candidate-count')).to_have_text('320')
 passed('Unavailable observations disabled without silently discarding selected evidence')
 for filename,path,retry in [('game-data.json','/','重新加载规则'),('map-data.json','/map.html','重新加载地图'),('zh-CN.json','/','重新加载规则')]:
  pattern='**/data/'+filename;page.route(pattern,lambda route:route.fulfill(status=503,body='unavailable'))
  ready(page,path);expect(page.get_by_role('button',name=retry)).to_be_visible();expect(page.locator('form select').first).to_be_disabled()
  page.unroute(pattern);page.get_by_role('button',name=retry).click();expect(page.get_by_role('button',name=retry)).to_be_hidden();expect(page.locator('form select').first).to_be_enabled()
 passed('Rule/map/locale failure and retry recovery')
 for width in [320,390,768,1440]:
  page.set_viewport_size({'width':width,'height':900})
  ready(page);page.get_by_role('button',name='填入示例').click();no_overflow(page)
  if width==390:page.screenshot(path=str(OUT/'relic-mobile.png'),full_page=True)
  page.locator('.choose-effect').first.click();page.locator('#effect-query').fill('回血');no_overflow(page)
  assert page.locator('#effect-results').bounding_box()['height']>90
  if width==390:page.screenshot(path=str(OUT/'picker-mobile.png'))
  page.locator('.effect-option').first.click();expect(page.get_by_role('dialog')).not_to_be_visible()
  ready(page,'/map.html');page.locator('#clue-search').fill('教堂');page.locator('.clue-option:not([disabled])').first.click();no_overflow(page)
  if width==390:page.screenshot(path=str(OUT/'map-mobile.png'),full_page=True)
 passed('320/390/768/1440px: modal selection, map search and no horizontal overflow')
 ready(page);page.keyboard.press('Tab');expect(page.locator('.skip-link')).to_be_focused();page.emulate_media(reduced_motion='reduce');assert page.evaluate('getComputedStyle(document.documentElement).scrollBehavior')=='auto'
 assert not errors,errors;passed('Keyboard skip link, reduced motion and no uncaught exceptions')
 browser.close();print(f'{len(checks)} browser groups passed ({browser_type}). Screenshots: {OUT}')
