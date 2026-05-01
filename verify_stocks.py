import asyncio
from playwright.async_api import async_playwright, expect
import os

async def run_verification():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        # Use a realistic viewport
        context = await browser.new_context(viewport={'width': 1280, 'height': 720})

        # Set mock_user cookie
        await context.add_cookies([{
            'name': 'mock_user',
            'value': 'Player1',
            'domain': 'localhost',
            'path': '/'
        }])

        page = await context.new_page()

        # Monitor console logs
        page.on("console", lambda msg: print(f"PAGE LOG: {msg.text}"))
        page.on("pageerror", lambda err: print(f"PAGE ERROR: {err}"))

        print("Navigating to town page...")
        try:
            await page.goto("http://localhost:3004/town/test-town", wait_until="networkidle", timeout=60000)
        except Exception as e:
            print(f"Navigation failed: {e}")
            await page.screenshot(path="nav_failed.png")
            await browser.close()
            return

        print("Waiting for game canvas...")
        await page.wait_for_selector("canvas", timeout=30000)
        await page.screenshot(path="page_loaded_v2.png")

        # Open Stock Market
        print("Clicking Stock Market button...")
        # Try to find the button by text specifically
        market_button = page.get_by_role("button", name="STOCK MARKET")
        await market_button.wait_for(state="visible")
        await market_button.click()
        print("Clicked MARKET button")

        # Wait for the modal to appear - looking for BANA which is distinct
        print("Waiting for BANA in modal...")
        try:
            # Using locator instead of expect to be more flexible
            bana_item = page.get_by_text("BANA", exact=True).first
            await bana_item.wait_for(state="visible", timeout=30000)
            print("Modal visible (found BANA)!")
        except Exception as e:
            print(f"Modal not found or BANA not visible: {e}")
            await page.screenshot(path="modal_not_found_v2.png")
            # print(await page.content())
            await browser.close()
            return

        await page.screenshot(path="modal_open.png")

        # Click on BANA to see details
        print("Clicking on BANA...")
        await page.get_by_text("BANA").first.click()

        # Wait for chart and buy button
        print("Waiting for Buy button...")
        buy_button = page.get_by_role("button", name="BUY SHARES")
        await buy_button.wait_for(state="visible")

        await page.screenshot(path="bana_details.png")

        # Check initial balance
        balance_text = await page.get_by_text("$1,500").first.inner_text()
        print(f"Initial balance: {balance_text}")

        # Buy 1 share
        print("Buying 1 share of BANA...")
        await buy_button.click()

        # Wait for toast or balance update
        print("Waiting for balance update...")
        await asyncio.sleep(2) # Give it some time for state update
        await page.screenshot(path="after_buy.png")

        # Check if portfolio updated
        print("Checking portfolio...")
        await page.get_by_text("Back to Market").click()
        await page.get_by_text("1 Shares").wait_for(state="visible")
        print("Portfolio verified: 1 share of BANA found.")

        # Sell the share
        print("Selling the share...")
        await page.get_by_text("BANA").first.click()
        sell_button = page.get_by_role("button", name="SELL SHARES")
        await sell_button.wait_for(state="visible")
        await sell_button.click()

        await asyncio.sleep(2)
        await page.screenshot(path="after_sell.png")

        print("Verification complete!")
        await browser.close()

if __name__ == "__main__":
    asyncio.run(run_verification())
