import json,os
from pathlib import Path
from urllib.parse import urlencode
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1];BASE=os.environ.get('TEST_BASE_URL','http://localhost:4173');data=json.loads((ROOT/'data/map-data.json').read_text());zh=json.loads((ROOT/'data/zh-CN.json').read_text())['map'];sample=data['records'][0];slot=next(s for s in sample['slots'] if s['key']=='Major Base - South Lake')
q={k:sample[k] for k in ['nightlord','mapType','spawn']};q['observations']=[{k:s[k] for k in ['key','category','value']} for s in sample['slots'] if s['value']]
expect.set_options(timeout=15000)
with sync_playwright() as p:
 b=getattr(p,os.environ.get('TEST_BROWSER','chromium')).launch();page=b.new_page(viewport={'width':390,'height':844});errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto(BASE+'/map.html');expect(page.locator('#atlas-loading')).to_be_hidden()
 page.locator('#open-map-settings').click();page.locator('#settings-display-tab').click();page.locator('[data-close-drawer="map-settings"]').click()
 for _ in range(5):page.locator('#atlas-in').click()
 expect(page.locator('.atlas-map-label[data-for="Major Base - South Lake"]')).to_have_count(0)
 assert all(word not in ' '.join(page.locator('.atlas-map-label').all_text_contents()) for word in ['小型据点','大型据点','待观察','候选：'])
 page.goto(BASE+'/map.html?'+urlencode({'q':json.dumps(q)}));expect(page.locator('#atlas-loading')).to_be_hidden()
 page.locator('#open-map-settings').click();page.locator('#settings-display-tab').click();page.locator('[data-close-drawer="map-settings"]').click()
 expect(page.locator('.atlas-map-label')).to_have_count(0);assert all(not t.strip() for t in page.locator('.atlas-point').all_text_contents())
 target=page.locator('[data-point="'+slot['key']+'"]');assert zh[slot['location']] not in target.get_attribute('aria-label');target.focus();page.keyboard.press('Enter');expect(page.locator('#atlas-point-title')).to_have_text(zh[slot['value']].split(' · ')[-1].split(' - ')[-1]);expect(page.locator('#atlas-editor .point-reference p').first).to_be_hidden();assert zh[slot['location']] not in page.locator('#atlas-editor').inner_text()
 page.screenshot(path='/tmp/content-priority-mobile.png');page.locator('#atlas-editor .point-reference summary').click();expect(page.locator('#atlas-editor .point-reference')).to_contain_text(zh[slot['location']]);expect(page.locator('#atlas-editor .point-reference p').first).to_be_visible()
 page.locator('#atlas-editor').get_by_role('button',name='关闭',exact=True).click();target.focus();page.keyboard.press('Enter');expect(page.locator('#atlas-editor .point-reference p').first).to_be_hidden()
 page.locator('#atlas-editor').get_by_role('button',name='关闭',exact=True).click();page.locator('#open-map-results').click();assert zh[slot['location']] not in page.locator('#map-result').inner_text();assert zh[sample['spawn']] not in page.locator('#map-result').inner_text();page.locator('#map-result > .point-reference summary').click();expect(page.locator('#map-result > .point-reference')).to_contain_text(zh[sample['spawn']])
 if os.environ.get('AXE_CORE_PATH'):
  page.add_script_tag(path=os.environ['AXE_CORE_PATH']);v=page.evaluate('async()=> (await axe.run()).violations');assert not v,json.dumps(v)
 assert not errors,errors;b.close();print('PASS content-first map labels and headings, hidden geographic details, deliberate disclosure and record hierarchy')
