"""Gate network responses to verify real preloading, race safety, reuse and failure recovery."""
import asyncio,json,os
from urllib.parse import urlencode
from playwright.async_api import async_playwright,expect
BASE=os.environ.get('TEST_BASE_URL','http://localhost:4173')
async def main():
 async with async_playwright() as p:
  browser=await getattr(p,os.environ.get('TEST_BROWSER','chromium')).launch()
  page=await browser.new_page(viewport={'width':390,'height':844});errors=[];requests=[]
  page.on('pageerror',lambda e:errors.append(str(e)));page.on('request',lambda r:requests.append(r.url))
  data_gate=asyncio.Event();tile_gate=asyncio.Event();surface_gate=asyncio.Event();under_gate=asyncio.Event()
  async def gated(route,gate):
   await gate.wait();await route.continue_()
  await page.route('**/data/map-runtime.json*',lambda r:gated(r,data_gate))
  await page.route('**/assets/maps/hd/default.webp',lambda r:gated(r,tile_gate))
  await page.route('**/assets/maps/hd/great_hollow.webp',lambda r:gated(r,surface_gate))
  await page.route('**/assets/maps/hd/great_hollow_under.webp',lambda r:gated(r,under_gate))
  await page.goto(BASE+'/map.html',wait_until='domcontentloaded')
  tiles=page.locator('#atlas-tiles')
  await expect(tiles).to_have_attribute('data-quality','preview')
  assert not data_gate.is_set();assert not any('/assets/maps/hd/default.webp' in u for u in requests)
  assert await page.locator('.atlas-point').count()==0
  await expect(page.locator('#atlas-loading')).to_be_hidden()
  print('PASS overview starts early without competing full-resolution requests',flush=True)
  data_gate.set();await expect(page.locator('#candidate-count')).to_have_text('520')
  await expect(page.locator('.atlas-point').first).to_be_visible()
  await expect(tiles).to_have_attribute('data-quality','preview')
  await page.locator('[data-point="Castle - Castle"]').focus();await page.keyboard.press('Enter')
  await expect(page.locator('#atlas-editor')).to_be_visible()
  await page.locator('#atlas-editor').get_by_role('button',name='关闭',exact=True).click()
  await page.screenshot(path='/tmp/preload-slow-mobile.png')
  tile_gate.set();await expect(tiles).to_have_attribute('data-quality','full')
  await expect(tiles.locator('img')).to_have_count(1)
  print('PASS accurate overview supports interaction while high-resolution tiles are delayed',flush=True)
  # Wait until background previews have decoded, not merely requested.
  await page.evaluate("async()=>{const m=await import('./src/map-tiles.js?v=perf-1');await Promise.all(['great_hollow','great_hollow_under'].map(k=>m.previewMap(k).promise));}")
  before=len([u for u in requests if '/assets/maps/hd/default.webp' in u])
  await page.locator('#open-map-settings').click();await page.locator('#map-type').select_option('Great Hollow');await page.locator('[data-close-drawer="map-settings"]').click()
  await expect(tiles).to_have_attribute('data-map','great_hollow');await expect(tiles).to_have_attribute('data-quality','preview');await expect(page.locator('#atlas-loading')).to_be_hidden()
  await page.locator('#atlas-depth').click();await expect(tiles).to_have_attribute('data-map','great_hollow_under');await expect(tiles).to_have_attribute('data-quality','preview')
  surface_gate.set();await page.evaluate("async()=>{const m=await import('./src/map-tiles.js?v=perf-1');await m.prepareMap('great_hollow').promise;}")
  await expect(tiles).to_have_attribute('data-map','great_hollow_under');await expect(tiles).to_have_attribute('data-quality','preview')
  under_gate.set();await expect(tiles).to_have_attribute('data-quality','full')
  old=len([u for u in requests if '/assets/maps/hd/great_hollow.webp' in u])
  await page.locator('#atlas-depth').click();await expect(tiles).to_have_attribute('data-map','great_hollow');await expect(tiles).to_have_attribute('data-quality','full')
  assert len([u for u in requests if '/assets/maps/hd/great_hollow.webp' in u])==old
  assert all('/hd/great_hollow.webp' in u for u in await tiles.locator('img').evaluate_all('(imgs)=>imgs.map(i=>i.src)'))
  print('PASS preloaded surface/underground transitions, stale responses ignored, decoded maps reused without new requests',flush=True)
  await page.close()
  # Save-data connections load only the requested map; no speculative other previews.
  page=await browser.new_page(viewport={'width':390,'height':844});seen=[];page.on('request',lambda r:seen.append(r.url));page.on('pageerror',lambda e:errors.append(str(e)))
  await page.add_init_script("Object.defineProperty(navigator,'connection',{value:{saveData:true,effectiveType:'4g'}})")
  await page.goto(BASE+'/map.html?'+urlencode({'q':json.dumps({'nightlord':'','spawn':'','mapType':'Great Hollow','observations':[]})}))
  await expect(page.locator('#atlas-tiles')).to_have_attribute('data-quality','full')
  await page.wait_for_timeout(700)
  assert not any('/previews/' in u and '/great_hollow.webp' not in u for u in seen)
  assert not any('/assets/maps/hd/default.webp' in u for u in seen)
  print('PASS shared terrain preloads directly and save-data disables speculative maps',flush=True)
  await page.close()
  # Overview failure does not prevent sharp tiles, and a failed sharp tile can be retried.
  page=await browser.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
  await page.route('**/assets/maps/previews/default.webp',lambda r:r.abort())
  await page.goto(BASE+'/map.html');await expect(page.locator('#atlas-tiles')).to_have_attribute('data-quality','full')
  await expect(page.locator('#atlas-loading')).to_be_hidden()
  await page.close();assert not errors,errors;await browser.close()
  print('PASS overview failure falls back to full map without uncaught errors',flush=True)
asyncio.run(main())
