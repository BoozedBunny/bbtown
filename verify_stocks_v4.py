import asyncio
import os
from playwright.async_api import async_playwright

async def verify_stocks():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()

        # Use Player1 who exists in DB
        await context.add_cookies([{
            'name': 'mock_user',
            'value': 'Player1',
            'domain': 'localhost',
            'path': '/'
        }])

        page = await context.new_page()

        print("Navigating to town 1...")
        await page.goto("http://localhost:3004/town/1")

        # Wait for the button
        print("Waiting for Stock Market button...")
        try:
            await page.wait_for_selector("button:has-text('Stock Market')", timeout=15000)
        except Exception as e:
            print(f"Button not found: {e}")
            await page.screenshot(path="debug_no_button.png")
            await browser.close()
            return

        print("Opening Stock Market...")
        await page.click("button:has-text('Stock Market')")

        # Wait for the modal title
        print("Waiting for modal title...")
        try:
            # Using a more flexible selector for the title
            await page.wait_for_selector("text=Funny Names Exchange", timeout=15000)
            print("Modal detected")
        except Exception as e:
            print(f"Failed to find modal title: {e}")
            # Try to see if it's there but maybe text is different
            await page.screenshot(path="debug_v4_timeout.png")
            content = await page.content()
            with open("debug_v4_content.html", "w") as f:
                f.write(content)
            await browser.close()
            return

        await page.screenshot(path="debug_v4_modal_open.png")

        # Get initial cash
        cash_locator = page.locator("div:has-text('Available Cash')").locator("xpath=following-sibling::div")
        try:
            initial_cash_text = await cash_locator.inner_text()
            print(f"Initial cash text: {initial_cash_text}")
        except Exception as e:
            print(f"Failed to get cash: {e}")
            # Fallback: find any text starting with $ in the modal
            initial_cash_text = await page.locator("div:has-text('$')").first.inner_text()
            print(f"Fallback cash: {initial_cash_text}")

        # Find BANA and click it
        print("Selecting BANA stock...")
        await page.click("button:has-text('BANA')")

        # Wait for BUY button
        print("Waiting for BUY SHARES button...")
        try:
            await page.wait_for_selector("button:has-text('BUY SHARES')", timeout=10000)
            print("Buy button detected")
        except Exception as e:
            print(f"Failed to find BUY button: {e}")
            await page.screenshot(path="debug_v4_detail_failed.png")
            await browser.close()
            return

        print("Buying 1 share...")
        await page.click("button:has-text('BUY SHARES')")

        # Wait for update (Socket.io should trigger it)
        print("Waiting for portfolio update...")
        await asyncio.sleep(3)

        # Check holdings
        holdings_locator = page.locator("div:has-text('Your Holdings')").locator("xpath=following-sibling::div").first
        new_holdings = await holdings_locator.inner_text()
        print(f"New holdings: {new_holdings}")

        # Sell it back
        print("Selling 1 share...")
        await page.click("button:has-text('SELL SHARES')")
        await asyncio.sleep(3)

        final_holdings = await holdings_locator.inner_text()
        print(f"Final holdings: {final_holdings}")

        await page.screenshot(path="debug_v4_final.png")
        await browser.close()
        print("Verification complete.")

if __name__ == "__main__":
    asyncio.run(verify_stocks())
