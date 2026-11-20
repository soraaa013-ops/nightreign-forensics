"""No text on the map; real icons resolve independently from boss identities."""
import os,json
from pathlib import Path
from urllib.parse import urlencode
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1];BASE=os.environ.get('TEST_BASE_URL','http://localhost:4173')
data=json.loads((ROOT/'data/map-data.json').read_text());sample=data['records'][0]
def ready(page,url='/map.html'):
 page.goto(BASE+url);expect(page.locator('#atlas-loading')).to_be_hidden()
def no_text(page):
 expect(page.locator('.atlas-map-label')).to_have_count(0)
 assert all(not t.strip() for t in page.locator('.atlas-point').all_text_contents())
 assert page.locator('.atlas-point[title]').count()==0
with sync_playwright() as p:
 b=getattr(p,os.environ.get('TEST_BROWSER','chromium')).launch();page=b.new_page(viewport={'width':390,'height':844},has_touch=True);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 # Former text settings must not restore textual labels.
 ready(page);page.evaluate("sessionStorage.setItem('nightreign-atlas-view-v1',JSON.stringify({detail:'details'}))");page.reload();expect(page.locator('#atlas-loading')).to_be_hidden();no_text(page)
 target=page.locator('[data-point="Major Base - South Lake"]');target.focus();page.keyboard.press('Enter')
 choice=page.locator('.atlas-type-options .atlas-option[data-value="Ruins"]');expect(choice).to_be_visible();assert choice.inner_text()=='';expect(choice.locator('img')).to_have_attribute('src','assets/map-icons/ruins.png');choice.click()
 expect(target).to_have_attribute('data-icon','ruins');assert int(page.locator('#candidate-count').inner_text())>1
 no_text(page);expect(page.locator('#atlas-editor')).to_be_hidden();page.screenshot(path='/tmp/icons-type-mobile.png')
 q={k:sample[k] for k in ['nightlord','mapType','spawn']};q['observations']=[{k:s[k] for k in ['key','category','value']} for s in sample['slots'] if s['value']]
 ready(page,'/map.html?'+urlencode({'q':json.dumps(q)}));no_text(page)
 expect(page.locator('[data-point="Field Boss - Northwest Stormhill Cliffside"]')).to_have_attribute('data-icon','boss')
 expect(page.locator('[data-point="Field Boss - Lake"]')).to_have_attribute('data-icon','danger-boss')
 page.wait_for_function("Array.from(document.querySelectorAll('.atlas-point img')).every(i=>i.complete && i.naturalWidth>0)")
 for _ in range(4):page.locator('#atlas-in').click();no_text(page)
 page.screenshot(path='/tmp/icons-zoom-mobile.png');page.locator('#atlas-fit').click();page.screenshot(path='/tmp/icons-mobile.png')
 page.set_viewport_size({'width':1440,'height':900});no_text(page);page.screenshot(path='/tmp/icons-desktop.png')
 assert not errors,errors;b.close();print('PASS game pictograms, type-only inference, icon-only choices, red/white source facts, no text at any zoom, adaptive icon sizes and assets')
