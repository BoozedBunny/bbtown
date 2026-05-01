import asyncio
import os
from playwright.async_api import async_playwright

async def verify_stocks():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()

        await context.add_cookies([{
            'name': 'mock_user',
            'value': 'test-user-123',
            'domain': 'localhost',
            'path': '/'
        }])

        page = await context.new_page()

        print("Navigating to town 1...")
        await page.goto("http://localhost:3004/town/1")

        # Wait for the button
        await page.wait_for_selector("button:has-text('STOCK MARKET')", timeout=15000)

        print("Opening Stock Market...")
        await page.click("button:has-text('STOCK MARKET')")

        # Wait for the modal by looking for ANY unique text
        print("Waiting for modal content...")
        try:
            await page.wait_for_selector("text=AVAILABLE CASH", timeout=15000)
            print("Modal detected via 'AVAILABLE CASH'")
        except Exception as e:
            print(f"Failed to find modal: {e}")
            await page.screenshot(path="debug_timeout.png")
            await browser.close()
            return

        await page.screenshot(path="debug_modal_open.png")

        # Find BANA and click it
        print("Selecting BANA stock...")
        # Try to find a button that contains BANA
        bana_button = page.locator("button:has-text('BANA')").first
        await bana_button.click()

        # Wait for BUY button
        try:
            await page.wait_for_selector("button:has-text('BUY 1 SHARE')", timeout=10000)
            print("Buy button detected")
        except Exception as e:
            print(f"Failed to find BUY button: {e}")
            await page.screenshot(path="debug_detail_failed.png")
            await browser.close()
            return

        # Get initial cash
        # Note: In the UI it's rendered as "$1,500" or similar.
        # We can use a more specific locator
        cash_element = page.locator("div:has-text('AVAILABLE CASH') + div")
        initial_cash = await cash_element.inner_text()
        print(f"Initial cash: {initial_cash}")

        print("Buying 1 share...")
        await page.click("button:has-text('BUY 1 SHARE')")

        # Wait for update
        await asyncio.sleep(2)

        new_cash = await cash_element.inner_text()
        print(f"New cash: {new_cash}")

        # Verify assets changed
        assets_element = page.locator("div:has-text('TOTAL ASSETS') + div")
        assets = await assets_element.inner_text()
        print(f"Assets: {assets}")

        print("Selling 1 share...")
        await page.click("button:has-text('SELL 1 SHARE')")
        await asyncio.sleep(2)

        final_cash = await cash_element.inner_text()
        print(f"Final cash: {final_cash}")

        await page.screenshot(path="debug_final.png")
        await browser.close()
        print("Verification complete.")

if __name__ == "__main__":
    asyncio.run(verify_stocks())
