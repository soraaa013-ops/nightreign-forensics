"""Run against npm run serve. Requires Python Playwright and installed browsers."""
import json, os, re
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
ROOT = Path(__file__).resolve().parents[1]
BASE = os.environ.get('TEST_BASE_URL', 'http://localhost:4173')
OUT = Path(os.environ.get('TEST_ARTIFACTS', '/tmp/nightreign-qa-artifacts')); OUT.mkdir(parents=True, exist_ok=True)
maps = json.loads((ROOT / 'data/map-data.json').read_text())
checks = []
def passed(name):
 checks.append(name); print('PASS', name, flush=True)
def ready(page, path='/'):
 page.goto(BASE + path); page.wait_for_load_state('networkidle')
 expect(page.locator('form')).to_have_attribute('aria-busy', 'false')
def no_overflow(page):
 assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'Horizontal overflow'
def fill_values(page, values):
 for i, value in enumerate(values): page.get_by_role('combobox').nth(i+1).fill(value)
 page.locator('#checker-title').click()
with sync_playwright() as p:
 browser_type = os.environ.get('TEST_BROWSER', 'chromium')
 browser = getattr(p, browser_type).launch()
 context = browser.new_context(viewport={'width':1440,'height':1000})
 errors = []
 page = context.new_page(); page.on('pageerror', lambda error: errors.append(str(error)))
 ready(page)
 expect(page.locator('#template option')).to_have_count(4)
 expect(page.locator('#copy-report')).to_be_disabled()
 page.screenshot(path=str(OUT/'relic-desktop.png'),full_page=True)
 # Desktop report must sit alongside inputs, not below them.
 form_box=page.locator('form').bounding_box(); report_box=page.locator('#report').bounding_box()
 assert abs(form_box['y']-report_box['y']) < 2 and report_box['x'] > form_box['x']
 passed('Initial state, four templates, desktop layout')
 inp=page.locator('input[name=effect]').first
 inp.fill('生命'); expect(page.locator('#effect-options-0')).to_be_visible()
 inp.press('ArrowDown'); inp.press('Enter'); assert '#' in inp.input_value()
 inp.fill('不存在的词条'); expect(page.locator('#effect-options-0')).to_contain_text('没有找到')
 inp.press('Escape'); expect(page.locator('#effect-options-0')).to_be_hidden()
 passed('Chinese search, keyboard selection, empty results and Escape')
 for option in page.locator('#template option').evaluate_all('(els)=>els.map(x=>x.value)'):
  page.locator('#template').select_option(option)
  page.get_by_role('button',name='随机装填').click()
  expect(page.locator('#report')).to_have_class('report valid')
  expect(page.locator('#report-probability')).to_be_visible()
 values = page.locator('input[name=effect]').evaluate_all('(els)=>els.map(x=>x.value)')
 share_url = page.url
 passed('All four templates: legal sample and probability')
 ready(page, share_url.removeprefix(BASE))
 expect(page.locator('#report')).to_have_class('report valid')
 assert page.locator('input[name=effect]').evaluate_all('(els)=>els.map(x=>x.value)') == values
 passed('Report URL round trip')
 page.evaluate("() => { navigator.clipboard.writeText = async text => { window.copied = text; }; }")
 page.get_by_role('button',name='复制报告链接').click()
 expect(page.locator('#action-status')).to_contain_text('已复制'); assert page.evaluate('window.copied') == page.url
 page.evaluate("() => { navigator.clipboard.writeText = async () => { throw Error('denied'); }; }")
 page.get_by_role('button',name='复制报告链接').click()
 expect(page.get_by_role('textbox',name='报告链接')).to_have_value(page.url)
 passed('Clipboard success and denied fallback')
 inp.fill('生命'); expect(page.locator('#report')).to_have_class('report'); expect(page.locator('#copy-report')).to_be_disabled(); assert '?' not in page.url
 fill_values(page, list(reversed(values))); page.get_by_role('button',name='签发检测报告').click()
 expect(page.locator('#report')).to_have_class('report reorder')
 fill_values(page, [values[0]]*3); page.get_by_role('button',name='签发检测报告').click()
 expect(page.locator('#report')).to_have_class('report invalid')
 passed('Dirty report invalidation, reorder and duplicate rejection')
 page.get_by_role('button',name='清空',exact=True).click()
 expect(page.locator('#report')).to_have_class('report')
 assert all(not value for value in page.locator('input[name=effect]').evaluate_all('(els)=>els.map(x=>x.value)'))
 page.get_by_role('button',name='随机装填').click(); expect(page.locator('#report')).to_have_class('report valid')
 passed('Reset synchronizes template, candidates, URL and report')
 ready(page,'/?template=oops&effects=1,2,3'); expect(page.locator('#action-status')).to_contain_text('报告链接不完整')
 passed('Malformed share link')
 ready(page,'/map.html'); expect(page.locator('#candidate-count')).to_have_text('320')
 assert not re.search('[A-Za-z]', page.locator('main').inner_text())
 page.locator('#use-clue').click(); expect(page.locator('.slot-value').first).to_be_enabled()
 page.get_by_role('button',name='清空全部条件').click(); expect(page.locator('.slot-value').first).to_be_disabled()
 passed('Map initial catalogue, localized UI and suggested observation shortcut')
 sample=maps['records'][0]
 for field,key in [('nightlord','nightlord'),('map-type','mapType'),('spawn','spawn')]: page.locator('#'+field).select_option(sample[key])
 base=[r for r in maps['records'] if all(r[k]==sample[k] for k in ['nightlord','mapType','spawn'])]
 for index in range(2):
  if len(base)==1:break
  slot=min(sample['slots'], key=lambda s:sum(any(t['key']==s['key'] and t['value']==s['value'] for t in r['slots']) for r in base))
  page.locator('.slot-key').nth(index).select_option(slot['key']); page.locator('.slot-value').nth(index).select_option(slot['value'] or 'empty')
  base=[r for r in base if any(s['key']==slot['key'] and s['value']==slot['value'] for s in r['slots'])]
 expect(page.locator('#candidate-count')).to_have_text('1'); expect(page.locator('#map-result')).to_be_visible()
 expect(page.locator('.poi-list article')).to_have_count(len([s for s in sample['slots'] if s['value']]))
 assert not re.search('[A-Za-z]', page.locator('#map-result').inner_text())
 page.screenshot(path=str(OUT/'map-result-desktop.png'),full_page=True)
 passed('Unique map, all locations (no 24-row truncation), Chinese event/boss/result labels')
 # Keep contradictory evidence visible and offer a clear empty result.
 key=sample['slots'][0]['key']; value=sample['slots'][0]['value'] or 'empty'
 page.locator('.slot-key').first.select_option(key); page.locator('.slot-value').first.select_option(value)
 page.locator('.slot-key').nth(1).select_option(key)
 other=page.locator('.slot-value').nth(1).locator('option').evaluate_all('(els)=>els.map(x=>x.value).filter(Boolean)')
 page.locator('.slot-value').nth(1).select_option(next(x for x in other if x!=value))
 expect(page.locator('#candidate-count')).to_have_text('0'); expect(page.locator('#map-result')).to_be_hidden()
 expect(page.locator('.slot-value').first).to_have_value(value)
 page.get_by_role('button',name='清空全部条件').click(); expect(page.locator('#candidate-count')).to_have_text('320')
 passed('Contradictory observations, zero results, clear all')
 # HTTP errors and recovery on both pages, plus locale failure.
 for route_path, url, retry_name in [('game-data.json','/','重新加载规则'),('map-data.json','/map.html','重新加载地图'),('zh-CN.json','/','重新加载规则')]:
  pattern='**/data/'+route_path
  page.route(pattern, lambda route: route.fulfill(status=503,body='unavailable'))
  ready(page,url); expect(page.get_by_role('button',name=retry_name)).to_be_visible()
  expect(page.locator('form select').first).to_be_disabled()
  page.unroute(pattern); page.get_by_role('button',name=retry_name).click()
  expect(page.get_by_role('button',name=retry_name)).to_be_hidden(); expect(page.locator('form select').first).to_be_enabled()
 passed('Data and locale HTTP failure, disabled controls, retry recovery')
 for width in [320,390,768,1440]:
  page.set_viewport_size({'width':width,'height':900})
  for url,name in [('/','relic'),('/map.html','map')]:
   ready(page,url); no_overflow(page)
   if url=='/':
    page.get_by_role('button',name='随机装填').click(); expect(page.locator('#report')).to_have_class('report valid')
   else:
    page.locator('#nightlord').select_option('Gladius'); expect(page.locator('#candidate-count')).to_have_text('40')
   no_overflow(page)
   if width==390:page.screenshot(path=str(OUT/f'{name}-mobile.png'),full_page=True)
 passed('320/390/768/1440px: no overflow and working primary flows')
 ready(page); page.keyboard.press('Tab'); expect(page.locator('.skip-link')).to_be_focused()
 page.emulate_media(reduced_motion='reduce'); assert page.evaluate("getComputedStyle(document.documentElement).scrollBehavior") == 'auto'
 assert not errors, errors
 passed('Skip link, reduced motion and no uncaught browser exceptions')
 browser.close()
 print(f'{len(checks)} browser groups passed ({browser_type}). Screenshots: {OUT}')
