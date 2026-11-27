"""Exercise the public map UI with actual clicks/touches, with individual, unclustered markers."""
import json,os
from pathlib import Path
from urllib.parse import urlparse,parse_qs,urlencode
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1];BASE=os.environ.get('TEST_BASE_URL','http://localhost:4173');OUT=Path(os.environ.get('TEST_ARTIFACTS','/tmp/nightreign-fast-atlas'));OUT.mkdir(parents=True,exist_ok=True)
geo=json.loads((ROOT/'data/map-geometry.json').read_text());data=json.loads((ROOT/'data/map-data.json').read_text());zh=json.loads((ROOT/'data/zh-CN.json').read_text())['map'];checks=[]
def passed(s):checks.append(s);print('PASS',s,flush=True)
def ready(page):
 if page.url.startswith(BASE):page.evaluate('sessionStorage.clear()')
 page.goto(BASE+'/map.html');page.wait_for_load_state('networkidle');expect(page.locator('#map-form')).to_have_attribute('aria-busy','false')
def state(page):return json.loads(parse_qs(urlparse(page.url).query).get('q',['{"observations":[],"spawn":""}'])[0])
def settings(page):
 if not page.locator('#map-settings').is_visible():page.locator('#open-map-settings').click()
def dismiss_settings(page):page.locator('[data-close-drawer="map-settings"]').click()
def layer(page,mode):
 page.locator('#atlas-layer-menu').evaluate('(el)=>el.open=true');page.locator('[data-layer='+mode+']').click()
def facet(page,key,value):
 settings(page);page.locator('#'+key).select_option(value);dismiss_settings(page)
def choose(page,key):
 point=next(p for p in geo['points'] if p['id']==key)
 mode='spawn' if point.get('spawn') else 'base' if point['category'] in ['Major Base','Minor Base','Castle'] else 'gaol' if point['category']=='Evergaol' else 'boss'
 layer(page,mode)
 for _ in range(6):
  groups=page.locator('.atlas-point').evaluate_all('(els)=>els.map(e=>({id:e.dataset.group,points:JSON.parse(e.dataset.members),hidden:e.hidden}))')
  group=next(g for g in groups if key in g['points']);target=page.locator('[data-group="'+group['id']+'"]')
  if group['hidden']:page.locator('#atlas-fit').click();continue
  target.click()
  if page.locator('#atlas-editor').is_visible() or (point.get('spawn') and state(page).get('spawn')==point['spawn']):return
 raise AssertionError('Could not reach independent point after focus: '+key)

def close(page):
 if page.locator('#atlas-editor').is_visible():page.locator('#atlas-editor').get_by_role('button',name='关闭',exact=True).click()
def no_overlap(page):
 # User explicitly wants every point directly visible, without clustering.
 assert page.locator('.atlas-cluster').count()==0
 groups=page.locator('.atlas-point').evaluate_all('(els)=>els.map(e=>JSON.parse(e.dataset.members))')
 assert all(len(g)==1 for g in groups)
with sync_playwright() as p:
 name=os.environ.get('TEST_BROWSER','chromium');browser=getattr(p,name).launch();page=browser.new_page(viewport={'width':1440,'height':1000});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 ready(page);expect(page.locator('#map-settings')).to_be_hidden();expect(page.locator('#map-results-dialog')).to_be_hidden();expect(page.locator('[data-layer=all]')).to_have_attribute('aria-pressed','true');expect(page.locator('#atlas-loading')).to_be_hidden();assert page.locator('#atlas-tiles img').evaluate_all('(els)=>els.length===1&&els.every(e=>e.complete&&e.naturalWidth>0)');assert page.locator('#atlas-tiles img').first.get_attribute('src').endswith('/hd/default.webp');no_overlap(page)
 page.screenshot(path=str(OUT/'desktop.png'))
 passed('First-screen map, default all-points layer, correct tiles, individual markers without aggregation')
 for day in (1,2):
  layer(page,f'day{day}')
  expect(page.locator('#atlas-circles span').first).to_be_visible()
  expect(page.locator('.atlas-point')).to_have_count(0)
  page.locator('#atlas-in').click()
  assert page.locator('#atlas-tiles').bounding_box()==page.locator('#atlas-circles').bounding_box()
  page.locator('#atlas-fit').click()
 layer(page,'all')
 for symbol in ['1','2','event']:
  expect(page.locator(f'#atlas-circles [data-symbol="{symbol}"]').first).to_be_visible()
 passed('Both final-circle layers follow map zoom and appear together with invasion marks on return to all points')
 choose(page,'Major Base - South Lake');expect(page.locator('#atlas-editor')).to_be_visible();expect(page.locator('.atlas-exact')).not_to_have_attribute('open','');types=page.locator('.atlas-type-options .atlas-option');assert types.count()>1;assert all('无匹配' not in t for t in page.locator('.atlas-option').all_text_contents())
 scroll=page.evaluate('scrollY');transform=page.locator('#atlas-tiles').get_attribute('style')
 page.locator('.atlas-type-options [data-value=Camp]').click();expect(page.locator('#atlas-editor')).to_be_visible();assert state(page)['observations'][0]['match']=='type';coarse=int(page.locator('#candidate-count').inner_text());assert 0<coarse<320
 assert abs(page.evaluate('scrollY')-scroll)<2;assert page.locator('#atlas-tiles').get_attribute('style')==transform
 expect(page.locator('.atlas-quick-exact')).to_be_visible();page.locator('.atlas-quick-exact .atlas-option').first.click();expect(page.locator('#atlas-editor')).to_be_hidden();assert 'match' not in state(page)['observations'][0];assert len(state(page)['observations'])==1
 page.locator('#atlas-toast').get_by_role('button',name='撤销',exact=True).click();assert state(page)['observations'][0]['match']=='type';page.reload();page.wait_for_load_state('networkidle');assert state(page)['observations'][0]['match']=='type'
 passed('Two-tap building mark, continuous boss selection, stable viewport, immediate refinement and undo')
 ready(page);layer(page,'spawn');single=page.locator('.atlas-point:not(.atlas-cluster):visible').first;key=json.loads(single.get_attribute('data-members'))[0];single.click();expect(page.locator('#atlas-editor')).to_be_hidden();assert state(page)['spawn']==key.removeprefix('spawn:');expect(page.locator('.atlas-point')).to_have_count(1)
 choose(page,'Minor Base - East of Cavalry Bridge');page.locator('.atlas-option:visible').first.click();assert state(page)['spawn']==key.removeprefix('spawn:');assert len(state(page)['observations'])==1
 shared=page.url;other=browser.new_page();other.goto(shared);other.wait_for_load_state('networkidle');assert state(other)==state(page);other.close()
 settings(page);page.get_by_role('button',name='清空全部条件').click();dismiss_settings(page);expect(page.locator('#candidate-count')).to_have_text('520');page.locator('#atlas-undo').click();assert len(state(page)['observations'])==1
 passed('One-tap birth mode, independent base evidence, sharing, reset and undo')
 ready(page)
 for terrain in ['Default','Crater','Mountaintop','Noklateo','Rotted Woods']:
  facet(page,'map-type',terrain);page.wait_for_load_state('networkidle');expect(page.locator('#atlas-loading')).to_be_hidden();assert page.locator('#atlas-tiles img').evaluate_all('(els)=>els.every(e=>e.complete&&e.naturalWidth>0)')
  for mode in ['base','spawn','boss','gaol','all']:
   layer(page,mode);no_overlap(page)
 settings(page);page.get_by_role('button',name='清空全部条件').click();dismiss_settings(page);expect(page.locator('#map-type')).to_have_value('')
 sample=next(r for r in data['records'] if r['mapType']=='Rotted Woods');obs=next(s for s in sample['slots'] if s['category']=='Rotted Woods' and s['value']);q={'nightlord':sample['nightlord'],'mapType':'','spawn':sample['spawn'],'observations':[{k:obs[k] for k in ['key','category','value']}]}
 page.goto(BASE+'/map.html?'+urlencode({'q':json.dumps(q)}));page.wait_for_load_state('networkidle');expect(page.locator('#atlas-hint')).to_contain_text('由候选推测地形');assert 'the_rotten_woods_shifted' in page.locator('#atlas-tiles img').first.get_attribute('src');expect(page.locator('#map-type')).to_have_value('')
 passed('Five terrains and all layers, individual points, inferred terrain and shared state')
 ready(page);before=page.locator('#atlas-tiles').bounding_box();page.locator('#atlas-in').click();assert page.locator('#atlas-tiles').bounding_box()['width']>before['width'];v=page.locator('#atlas-viewport').bounding_box();page.mouse.move(v['x']+30,v['y']+30);page.mouse.down();page.mouse.move(v['x']+90,v['y']+50,steps=8);page.mouse.up();expect(page.locator('#atlas-editor')).to_be_hidden();page.locator('#atlas-fit').click();assert abs(page.locator('#atlas-tiles').bounding_box()['width']-before['width'])<1
 # Dragging from a marker must also avoid triggering it.
 box=page.locator('.atlas-point:visible').first.bounding_box();page.mouse.move(box['x']+box['width']/2,box['y']+box['height']/2);page.mouse.down();page.mouse.move(box['x']+90,box['y']+45,steps=8);page.mouse.up();expect(page.locator('#atlas-editor')).to_be_hidden();page.locator('#atlas-fit').click()
 page.locator('#atlas-viewport').focus();page.keyboard.press('+');assert page.locator('#atlas-tiles').bounding_box()['width']>before['width'];page.locator('#atlas-fit').click()
 single=page.locator('.atlas-point:not(.atlas-cluster):visible').first;single.focus();page.keyboard.press('Enter');expect(page.locator('#atlas-editor')).to_be_visible();page.keyboard.press('Escape');expect(page.locator('#atlas-editor')).to_be_hidden()
 v=page.locator('#atlas-viewport').bounding_box();page.mouse.click(v['x']+5,v['y']+5);expect(page.locator('#atlas-editor')).to_be_hidden()
 passed('Zoom, keyboard, pan from a marker, blank-space rejection and dismissal')
 # Determined content opens a description; editing is an explicit action.
 ready(page);choose(page,'Castle - Castle');page.locator('.atlas-quick-exact .atlas-option').first.click();q=state(page);choose(page,'Castle - Castle');expect(page.locator('.point-description')).to_be_visible();expect(page.locator('.atlas-option')).to_have_count(0);assert state(page)==q;page.screenshot(path=str(OUT/'point-description.png'))
 page.get_by_role('button',name='修改这处信息',exact=True).click();assert page.locator('.atlas-option').count()>1;assert all('无匹配' not in text for text in page.locator('.atlas-option').all_text_contents());close(page)
 # Build an independently inferred layout and verify a point with no direct mark is read-only.
 sample=data['records'][0];q={'nightlord':sample['nightlord'],'mapType':sample['mapType'],'spawn':sample['spawn'],'observations':[{'key':s['key'],'category':s['category'],'value':s['value']} for s in sample['slots'] if s['value'] and s['key']!='Castle - Castle']}
 page.goto(BASE+'/map.html?'+urlencode({'q':json.dumps(q)}));page.wait_for_load_state('networkidle');before=state(page);choose(page,'Castle - Castle');expect(page.locator('.point-description')).to_be_visible();expect(page.locator('.point-certainty')).to_have_text('候选档案一致');expect(page.locator('.atlas-option')).to_have_count(0);assert state(page)==before;close(page)
 settings(page);page.locator('#text-search').evaluate('(el)=>el.open=true');expect(page.locator('.clue-option')).to_have_count(0);assert not page.locator('#nightlord option[disabled]').count();dismiss_settings(page)
 page.locator('#open-map-results').click();expect(page.locator('#map-results-dialog')).to_be_visible();page.keyboard.press('Escape');expect(page.locator('#map-results-dialog')).to_be_hidden();assert state(page)==before
 passed('Determined points show descriptions, explicit editing, inferred facts and no redundant candidates')
 for width,height in [(320,568),(320,844),(390,844),(768,844)]:
  page.set_viewport_size({'width':width,'height':height});ready(page);assert page.locator('#atlas-viewport').bounding_box()['y']<=240;assert page.locator('#atlas-viewport').bounding_box()['height']>=height-240;expect(page.locator('#map-settings')).to_be_hidden();expect(page.locator('#map-results-dialog')).to_be_hidden();assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  for mode in ['base','spawn','boss','gaol','all']:
   layer(page,mode);no_overlap(page);page.locator('#atlas-in').click();no_overlap(page);page.locator('#atlas-fit').click()
  layer(page,'base')
  if width==390:page.screenshot(path=str(OUT/'mobile.png'))
  choose(page,'Major Base - South Lake');assert page.locator('#atlas-editor').bounding_box()['height']<=height*(.67 if height<650 else .49)
  options=page.locator('.atlas-type-options .atlas-option');pane=page.locator('#atlas-editor').bounding_box()
  for option in options.all():
   rect=option.bounding_box();assert rect['y']>=pane['y'] and rect['y']+rect['height']<=pane['y']+pane['height']+1
  if width==390:page.screenshot(path=str(OUT/'mobile-quick-actions.png'))
  options.first.click();expect(page.locator('#atlas-editor')).to_be_visible();close(page);assert state(page)['observations'];assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  # Continue marking a second location without a manual close.
  choose(page,'Major Base - Groveside');page.locator('.atlas-option:visible').first.click();assert len(state(page)['observations'])==2
 passed('320/390/768px: no aggregation, first-screen quick actions and consecutive marks without closing')
 if name=='chromium':
  touch=browser.new_page(viewport={'width':390,'height':844},has_touch=True,is_mobile=True);ready(touch);touch.locator('#atlas-viewport').scroll_into_view_if_needed();v=touch.locator('#atlas-viewport').bounding_box();cx=v['x']+v['width']/2;cy=v['y']+v['height']/2
  session=touch.context.new_cdp_session(touch);before=touch.locator('#atlas-tiles').bounding_box()['width'];session.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':cx-35,'y':cy,'id':1},{'x':cx+35,'y':cy,'id':2}]});session.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':cx-85,'y':cy,'id':1},{'x':cx+85,'y':cy,'id':2}]});session.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});assert touch.locator('#atlas-tiles').bounding_box()['width']>before;expect(touch.locator('#atlas-editor')).to_be_hidden();no_overlap(touch)
  touch.locator('#atlas-fit').click();layer(touch,'spawn');box=touch.locator('.atlas-point:not(.atlas-cluster):visible').first.bounding_box();touch.touchscreen.tap(box['x']+box['width']/2,box['y']+box['height']/2);assert state(touch)['spawn'];expect(touch.locator('#atlas-editor')).to_be_hidden();touch.close()
  passed('Real browser touch dispatch: pinch, individual marker layout, one-tap spawn and no accidental marking')
 page.route('**/data/map-geometry.json',lambda route:route.fulfill(status=503,body='unavailable'));ready(page);expect(page.get_by_role('button',name='重试交互地图')).to_be_visible();expect(page.locator('#clue-search')).to_be_visible();page.unroute('**/data/map-geometry.json');dismiss_settings(page);page.get_by_role('button',name='重试交互地图').click();expect(page.locator('#atlas-layers button')).to_have_count(7)
 page.route('**/assets/maps/hd/default.webp',lambda route:route.fulfill(status=503,body='unavailable'));ready(page);expect(page.get_by_role('button',name='重试底图')).to_be_visible();page.unroute('**/assets/maps/hd/default.webp');page.get_by_role('button',name='重试底图').click();expect(page.locator('#atlas-loading')).to_be_hidden();assert not errors,errors
 passed('Asset failures, retry, text fallback and no uncaught errors')
 browser.close();print(f'{len(checks)} atlas browser groups passed ({name}).')
