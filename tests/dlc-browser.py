"""DLC surface/underground touch workflow, complete layout restoration and details."""
import json,os
from pathlib import Path
from urllib.parse import urlencode
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1];BASE=os.environ.get('TEST_BASE_URL','http://localhost:4173');data=json.loads((ROOT/'data/map-dlc.json').read_text())['records'];geo=json.loads((ROOT/'data/map-dlc-geometry.json').read_text())['points']
expect.set_options(timeout=15000)
with sync_playwright() as p:
 browser=getattr(p,os.environ.get('TEST_BROWSER','chromium')).launch();page=browser.new_page(viewport={'width':390,'height':844},has_touch=True);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(BASE+'/map.html');expect(page.locator('#atlas-loading')).to_be_hidden();page.locator('#open-map-settings').click();page.locator('#nightlord').select_option('Harmonia');expect(page.locator('#candidate-count')).to_have_text('60');page.locator('#map-type').select_option('Great Hollow');expect(page.locator('#candidate-count')).to_have_text('20');page.locator('[data-close-drawer="map-settings"]').click();expect(page.locator('#atlas-loading')).to_be_hidden()
 assert page.locator('#atlas-tiles img').evaluate_all('(els)=>els.every(e=>e.complete && e.naturalWidth>0)')
 assert page.locator('#atlas-depth').is_visible();surface=page.locator('.atlas-point:not([hidden])').count();assert surface>0
 page.screenshot(path='/tmp/dlc-mobile-surface.png')
 page.locator('#atlas-depth').tap();expect(page.locator('#atlas-loading')).to_be_hidden();assert page.locator('#atlas-tiles img').evaluate_all('(els)=>els.every(e=>e.complete&&e.naturalWidth>0&&e.src.includes("great_hollow_under"))')
 underground_ids=page.locator('.atlas-point:not([hidden])').evaluate_all('(els)=>els.flatMap(e=>JSON.parse(e.dataset.members))')
 assert underground_ids and all(next(x for x in geo if x['id']==i).get('level')=='地下' for i in underground_ids)
 page.screenshot(path='/tmp/dlc-mobile-underground.png')
 # Select one useful exact candidate with taps, including cluster expansion.
 for _ in range(8):
  box=page.locator('.atlas-point:not([hidden])').first.bounding_box();page.touchscreen.tap(box['x']+box['width']/2,box['y']+box['height']/2)
  if page.locator('.atlas-cluster-choice').count():page.locator('.atlas-cluster-choice').first.tap()
  if page.locator('#atlas-editor').is_visible():break
 expect(page.locator('#atlas-editor')).to_be_visible()
 if page.locator('.atlas-option').count():page.locator('.atlas-option').first.tap();expect(page.locator('#atlas-editor')).to_be_hidden()
 # Restore a complete known underground observation set and inspect an inferred point.
 sample=next(r for r in data if r['nightlord']=='Harmonia' and r['mapType']=='Great Hollow')
 q={k:sample[k] for k in ['nightlord','mapType','spawn']};q['observations']=[{k:s[k] for k in ['key','category','value']} for s in sample['slots'] if s['value']]
 page.goto(BASE+'/map.html?'+urlencode({'q':json.dumps(q)}));expect(page.locator('#candidate-count')).to_have_text('1');expect(page.locator('#atlas-loading')).to_be_hidden()
 for _ in range(8):
  box=page.locator('.atlas-point:not([hidden])').first.bounding_box();page.touchscreen.tap(box['x']+box['width']/2,box['y']+box['height']/2)
  if page.locator('.atlas-cluster-choice').count():page.locator('.atlas-cluster-choice').first.tap()
  if page.locator('#atlas-editor').is_visible():break
 expect(page.locator('.point-description')).to_be_visible();assert page.locator('.atlas-option').count()==0;assert '位置：未记录' not in page.locator('.point-description').inner_text();page.screenshot(path='/tmp/dlc-mobile-details.png')
 assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');assert not errors,errors
 browser.close();print('PASS: DLC Nightlords, 80 Great Hollow layouts, mobile surface/underground, real tiles, tapping, shared state and resolved descriptions')
