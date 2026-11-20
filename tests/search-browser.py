"""Check shared search through real mobile/desktop controls."""
import os
from playwright.sync_api import sync_playwright, expect
BASE = os.environ.get('TEST_BASE_URL', 'http://localhost:4173')
with sync_playwright() as p:
    browser = p.chromium.launch()
    for width in [390, 1440]:
        page = browser.new_page(viewport={'width': width, 'height': 900})
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto(BASE + '/map.html')
        expect(page.locator('.atlas-point').first).to_be_visible()
        page.locator('#open-map-settings').click()
        for query in ['lsz', 'LSZ', '老狮']:
            page.locator('#clue-search').fill(query)
            expect(page.locator('#clue-results')).to_contain_text('老狮子')
        page.locator('#clue-search').fill('不存在的敌人')
        expect(page.locator('.clue-option')).to_have_count(0)
        page.goto(BASE + '/map.html')
        page.evaluate('sessionStorage.clear()')
        page.goto(BASE + '/map.html')
        point = page.locator('[data-point="Major Base - Waypoint Ruins"]')
        expect(point).to_be_visible()
        point.click()
        # The expanded list has its own search input; it must use the same matcher.
        details = page.locator('#atlas-editor .atlas-exact')
        details.locator('summary').click()
        search = page.get_by_role('searchbox', name='搜索这个点位的内容')
        search.fill('lsz')
        expect(details).to_contain_text('老狮子')
        expect(details.locator('.atlas-option')).not_to_have_count(0)
        search.fill('不存在的敌人')
        expect(details.locator('.atlas-option')).to_have_count(0)
        page.goto(BASE + '/index.html')
        search = page.locator('#effect-query')
        expect(search).to_be_enabled()
        search.fill('hf xl')
        expect(page.locator('.effect-option').first).to_be_visible()
        search.fill('不存在的词条')
        expect(page.locator('.effect-option')).to_have_count(0)
        assert not errors, errors
        page.close()
    browser.close()
print('PASS mobile/desktop map search, point search, relic initials and empty results')
