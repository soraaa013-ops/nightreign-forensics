"""Spatial-map end-to-end checks, on local or deployed assets."""
import json,os,re
from pathlib import Path
from urllib.parse import urlparse,parse_qs,urlencode
from playwright.sync_api import sync_playwright,expect
BASE=os.environ.get('TEST_BASE_URL','http://localhost:4173');OUT=Path(os.environ.get('TEST_ARTIFACTS','/tmp/nightreign-atlas'));OUT.mkdir(parents=True,exist_ok=True)
checks=[]
def passed(s):checks.append(s);print('PASS',s,flush=True)
def ready(page):
 if page.url.startswith(BASE):page.evaluate('sessionStorage.clear()')
 page.goto(BASE+'/map.html');page.wait_for_load_state('networkidle');expect(page.locator('#map-form')).to_have_attribute('aria-busy','false')
def marker(page,key):return page.locator('[data-point='+json.dumps(key)+']')
def close(page):page.locator('#atlas-editor').get_by_role('button',name='关闭',exact=True).click()
def state(page):return json.loads(parse_qs(urlparse(page.url).query)['q'][0])
with sync_playwright() as p:
 name=os.environ.get('TEST_BROWSER','chromium');browser=getattr(p,name).launch();page=browser.new_page(viewport={'width':1440,'height':1000});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 ready(page);expect(page.locator('#text-search')).not_to_have_attribute('open','');assert page.locator('.atlas-point').count()==56
 assert page.locator('#atlas-viewport').bounding_box()['y']<450
 expect(page.locator('#atlas-loading')).to_be_hidden();assert page.locator('#atlas-tiles img').evaluate_all('(els)=>els.every(e=>e.complete&&e.naturalWidth>0)')
 assert page.locator('#atlas-tiles img').first.get_attribute('src').endswith('/0-5.webp')
 page.screenshot(path=str(OUT/'atlas-desktop.png'),full_page=True)
 passed('First-screen full map, correct tile grid orientation, all images loaded')
 # Click close to a point rather than on its button, and reject distant blank space.
 target=marker(page,'Major Base - South Lake');box=target.bounding_box();page.mouse.click(box['x']+box['width']/2+19,box['y']+box['height']/2)
 expect(page.locator('#atlas-point-title')).to_contain_text('湖泊南部');close(page)
 v=page.locator('#atlas-viewport').bounding_box();page.mouse.click(v['x']+10,v['y']+10);expect(page.locator('#atlas-editor')).to_be_hidden();expect(page.locator('#atlas-status')).to_contain_text('附近没有')
 target.click();page.locator('.atlas-option[data-match="type"][data-value="Camp"]').click();q=state(page);assert q['observations'][0]['match']=='type';coarse=int(page.locator('#candidate-count').inner_text());assert 0<coarse<320
 assert 'observed' in target.get_attribute('class');close(page);page.reload();page.wait_for_load_state('networkidle');assert state(page)==q
 marker(page,'Major Base - South Lake').click();page.locator('#atlas-editor input').fill('营地');exact=page.locator('.atlas-options .atlas-option').first;exact.click();assert len(state(page)['observations'])==1;assert 'match' not in state(page)['observations'][0];assert int(page.locator('#candidate-count').inner_text())<=coarse;close(page)
 page.locator('#undo-map').click();assert state(page)['observations'][0]['match']=='type'
 passed('Near-point snap, blank-space rejection, coarse/exact replacement, reload and undo')
 ready(page);marker(page,'spawn:East of Cavalry Bridge').click();page.locator('.atlas-spawn').click();assert state(page)['spawn']=='East of Cavalry Bridge';close(page)
 marker(page,'spawn:East of Cavalry Bridge').click();page.locator('.atlas-neighbors').get_by_role('button',name='小型据点 · 骑兵桥东侧',exact=True).click();assert page.locator('.atlas-neighbors button').count()>=2;page.locator('.atlas-option[data-match="exact"]').filter(has_text='小型营地').first.click();assert state(page)['spawn']=='East of Cavalry Bridge';assert len(state(page)['observations'])==1;close(page)
 shared=page.url;other=browser.new_page();other.goto(shared);other.wait_for_load_state('networkidle');assert state(other)==state(page);assert other.locator('.atlas-point.observed').count()==2;other.close()
 page.get_by_role('button',name='清空全部条件').click();expect(page.locator('#candidate-count')).to_have_text('320');page.locator('#undo-map').click();assert state(page)['spawn']=='East of Cavalry Bridge'
 passed('Nearby point switching, independent spawn/content, shared-link restoration and reset undo')
 ready(page)
 for terrain in ['Default','Crater','Mountaintop','Noklateo','Rotted Woods']:
  page.locator('#map-type').select_option(terrain);page.wait_for_load_state('networkidle');expect(page.locator('#atlas-loading')).to_be_hidden();assert page.locator('#atlas-tiles img').evaluate_all('(els)=>els.length===36&&els.every(e=>e.complete&&e.naturalWidth>0)');assert page.locator('.atlas-point').count()>20
  page.screenshot(path=str(OUT/(terrain.replace(' ','-')+'.png')))
 page.get_by_role('button',name='清空全部条件').click();expect(page.locator('#map-type')).to_have_value('')
 passed('Five terrain backgrounds and point sets, reset of external form controls')
 data=json.loads((Path(__file__).resolve().parents[1]/'data/map-data.json').read_text());sample=next(r for r in data['records'] if r['mapType']=='Rotted Woods')
 inferred={'nightlord':sample['nightlord'],'mapType':'','spawn':sample['spawn'],'observations':[{'key':slot['key'],'category':slot['category'],'value':slot['value']} for slot in sample['slots'] if slot['value'] and slot['category']=='Rotted Woods'][:1]}
 page.goto(BASE+'/map.html?'+urlencode({'q':json.dumps(inferred)}));page.wait_for_load_state('networkidle');expect(page.locator('#map-type')).to_have_value('');expect(page.locator('#atlas-hint')).to_contain_text('由候选推测地形');assert 'the_rotten_woods_shifted' in page.locator('#atlas-tiles img').first.get_attribute('src');assert page.locator('.atlas-point.inferred').count()>0
 passed('Inferred terrain changes the background without fabricating a user observation')

 ready(page);before=page.locator('#atlas-tiles').bounding_box();page.locator('#atlas-in').click();after=page.locator('#atlas-tiles').bounding_box();assert after['width']>before['width']
 v=page.locator('#atlas-viewport').bounding_box();x,y=v['x']+30,v['y']+30;page.mouse.move(x,y);page.mouse.down();page.mouse.move(x+80,y+35,steps=10);page.mouse.up();assert page.locator('#atlas-tiles').bounding_box()['x']>after['x'];expect(page.locator('#atlas-editor')).to_be_hidden()
 page.locator('#atlas-fit').click();assert abs(page.locator('#atlas-tiles').bounding_box()['width']-before['width'])<1
 page.locator('#atlas-viewport').focus();page.keyboard.press('+');assert page.locator('#atlas-tiles').bounding_box()['width']>before['width'];page.locator('#atlas-fit').click()
 marker(page,'Major Base - South Lake').focus();page.keyboard.press('Enter');expect(page.locator('#atlas-editor')).to_be_visible();page.keyboard.press('Escape');expect(marker(page,'Major Base - South Lake')).to_be_focused()
 box=marker(page,'Major Base - South Lake').bounding_box();page.mouse.move(box['x']+13,box['y']+13);page.mouse.down();page.mouse.move(box['x']+80,box['y']+40,steps=10);page.mouse.up();expect(page.locator('#atlas-editor')).to_be_hidden()
 passed('Zoom, pan without accidental marking, reset view and keyboard point interaction')
 ready(page);page.locator('#nightlord').select_option('Gladius');marker(page,'Castle - Castle').click()
 # Find a combination that genuinely conflicts, rather than mocking the query result.
 opts=page.locator('.atlas-options .atlas-option');conflict=opts.filter(has_text='无匹配').first
 if not conflict.count():
  opts.first.click();close(page);marker(page,'Major Base - South Lake').click();conflict=page.locator('.atlas-options .atlas-option').filter(has_text='无匹配').first
 assert conflict.count();conflict.click();expect(page.locator('#candidate-count')).to_have_text('0');expect(page.locator('.atlas-conflict')).to_be_visible();close(page);page.locator('#undo-map').click();assert int(page.locator('#candidate-count').inner_text())>0
 passed('Conflicting evidence remains editable, explicit warning and undo recovery')
 for width in [320,390,768]:
  page.set_viewport_size({'width':width,'height':844});ready(page);assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');assert page.locator('#atlas-viewport').bounding_box()['y']<450
  marker(page,'Major Base - South Lake').click();expect(page.locator('#atlas-editor')).to_be_visible();assert page.locator('#atlas-editor').bounding_box()['height']<844*.51
  page.locator('.atlas-option[data-match="type"]').first.click();assert page.locator('.atlas-point.observed').count()==1
  if width==390:page.screenshot(path=str(OUT/'atlas-mobile-editor.png'))
  close(page);assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  if width==390:page.screenshot(path=str(OUT/'atlas-mobile.png'))
 passed('320/390/768px point picking, bottom panel, marking and no horizontal overflow')
 if name=='chromium':
  touch=browser.new_page(viewport={'width':390,'height':844},has_touch=True,is_mobile=True);ready(touch)
  # Chromium's input dispatch exercises real two-finger pointer handling.
  touch.locator('#atlas-viewport').scroll_into_view_if_needed();v=touch.locator('#atlas-viewport').bounding_box();cx=v['x']+v['width']/2;cy=v['y']+v['height']/2
  session=touch.context.new_cdp_session(touch);before=touch.locator('#atlas-tiles').bounding_box()['width']
  session.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':cx-35,'y':cy,'id':1},{'x':cx+35,'y':cy,'id':2}]})
  session.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':cx-85,'y':cy,'id':1},{'x':cx+85,'y':cy,'id':2}]})
  session.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});assert touch.locator('#atlas-tiles').bounding_box()['width']>before;expect(touch.locator('#atlas-editor')).to_be_hidden()
  touch.locator('#atlas-fit').click();box=marker(touch,'Major Base - South Lake').bounding_box();touch.touchscreen.tap(box['x']+13,box['y']+13);expect(touch.locator('#atlas-editor')).to_be_visible();touch.close()
  passed('Touch pinch zoom, no accidental marking during pinch, and tap-to-select')
 # Failure of spatial assets must not prevent use of the existing query tool.
 page.route('**/data/map-geometry.json',lambda route:route.fulfill(status=503,body='unavailable'));ready(page);expect(page.get_by_role('button',name='重试交互地图')).to_be_visible();expect(page.locator('#clue-search')).to_be_visible();page.unroute('**/data/map-geometry.json');page.get_by_role('button',name='重试交互地图').click();expect(page.locator('.atlas-point')).to_have_count(56)
 page.route('**/assets/maps/default/0-5.webp',lambda route:route.fulfill(status=503,body='unavailable'));ready(page);expect(page.get_by_role('button',name='重试底图')).to_be_visible();page.unroute('**/assets/maps/default/0-5.webp');page.get_by_role('button',name='重试底图').click();expect(page.locator('#atlas-loading')).to_be_hidden()
 assert not errors,errors
 passed('Geometry/tile errors, retry, text-search fallback and no uncaught errors')
 browser.close();print(f'{len(checks)} atlas browser groups passed ({name}).')
