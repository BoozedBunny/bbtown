import asyncio
import os
from playwright.async_api import async_playwright

async def verify_stocks():
    async with async_playwright() as p:
        # Using a persistent context to keep cookies if needed,
        # but here we just need to set the mock_user cookie.
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()

        # Set mock user cookie to bypass auth/ensure character exists
        await context.add_cookies([{
            'name': 'mock_user',
            'value': 'test-user-123',
            'domain': 'localhost',
            'path': '/'
        }])

        page = await context.new_page()

        # Go to a specific town (e.g., ID 1 which is seeded)
        print("Navigating to town 1...")
        await page.goto("http://localhost:3004/town/1")

        # Wait for the page to load
        await page.wait_for_selector("text=STOCK MARKET", timeout=10000)

        # Click the Stock Market button
        print("Opening Stock Market...")
        await page.get_by_role("button", name="STOCK MARKET").click()

        # Wait for modal to appear
        print("Waiting for Funny Names Exchange modal...")
        await page.wait_for_selector("h2:has-text('Funny Names Exchange')", timeout=10000)

        # Take a screenshot of the market list
        await page.screenshot(path="market_list.png")
        print("Market list screenshot saved.")

        # Find BANA and click it
        print("Selecting BANA stock...")
        # BANA is in a button
        bana_button = page.locator("button").filter(has_text="BANA").first
        await bana_button.click()

        # Wait for the detail view to appear
        await page.wait_for_selector("text=BUY 1 SHARE", timeout=5000)
        await page.screenshot(path="stock_detail.png")
        print("Stock detail screenshot saved.")

        # Get initial cash
        cash_text = await page.locator("text=AVAILABLE CASH").locator("xpath=following-sibling::div").inner_text()
        print(f"Initial cash: {cash_text}")

        # Click BUY 1 SHARE
        print("Buying 1 share of BANA...")
        await page.get_by_role("button", name="BUY 1 SHARE").click()

        # Wait for transaction to process (UI update)
        await asyncio.sleep(2)

        # Get new cash
        new_cash_text = await page.locator("text=AVAILABLE CASH").locator("xpath=following-sibling::div").inner_text()
        print(f"New cash: {new_cash_text}")

        await page.screenshot(path="after_buy.png")

        # Check if "SELL 1 SHARE" is now enabled/visible or if assets changed
        assets_text = await page.locator("text=TOTAL ASSETS").locator("xpath=following-sibling::div").inner_text()
        print(f"Total assets: {assets_text}")

        # Try to sell it back
        print("Selling 1 share of BANA...")
        await page.get_by_role("button", name="SELL 1 SHARE").click()
        await asyncio.sleep(2)

        final_cash_text = await page.locator("text=AVAILABLE CASH").locator("xpath=following-sibling::div").inner_text()
        print(f"Final cash after sell: {final_cash_text}")

        await page.screenshot(path="after_sell.png")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(verify_stocks())
