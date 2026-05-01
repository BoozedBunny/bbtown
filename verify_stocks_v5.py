import asyncio
from playwright.async_api import async_playwright
import os

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        # Set cookie for Player1
        context = await browser.new_context()
        await context.add_cookies([{
            "name": "mock_user",
            "value": "Player1",
            "domain": "localhost",
            "path": "/"
        }])

        page = await context.new_page()

        print("Navigating to town page...")
        await page.goto("http://localhost:3004/town/1")

        # Wait for page load
        await page.wait_for_load_state("networkidle")

        print("Clicking 'Stock Market' button...")
        # Use a more specific selector for the button
        market_btn = page.locator("button", has_text="Stock Market")
        await market_btn.click()

        print("Waiting for modal...")
        # Use a flexible locator for the header
        modal_header = page.locator("h2", has_text="Funny Names Exchange")
        await modal_header.wait_for(state="visible", timeout=15000)
        print("Modal opened successfully.")

        # Verify wallet
        wallet_text = page.locator("div", has_text="Available Cash").locator("..").locator("div.text-lg").first
        cash = await wallet_text.inner_text()
        print(f"Initial Cash: {cash}")

        # Buy BANA
        print("Buying BANA...")
        bana_row = page.locator("button", has_text="BANA")
        await bana_row.click()

        # Wait for Detail View
        await page.get_by_text("Market Price").wait_for(state="visible")

        buy_tab = page.get_by_role("tab", name="Buy")
        await buy_tab.click()

        # Increase quantity to 10
        plus_btn = page.locator("button").filter(has=page.locator("svg.lucide-plus"))
        for _ in range(9):
            await plus_btn.click()

        print("Clicking Buy button...")
        confirm_buy = page.get_by_role("button", name="Buy 10 Shares")
        await confirm_buy.click()

        # Wait for toast or UI update
        await asyncio.sleep(2)

        # Check assets
        assets_text = page.locator("div", has_text="Total Assets").locator("..").locator("div.text-lg").first
        assets = await assets_text.inner_text()
        print(f"Assets after buy: {assets}")

        # Go back to list and check Owned badge
        back_btn = page.locator("button").filter(has=page.locator("svg.lucide-arrow-left"))
        await back_btn.click()

        owned_badge = page.locator("span", has_text="10 Owned")
        await owned_badge.wait_for(state="visible")
        print("Owned badge verified.")

        # Sell BANA
        print("Selling BANA...")
        await bana_row.click()
        sell_tab = page.get_by_role("tab", name="Sell")
        await sell_tab.click()

        confirm_sell = page.get_by_role("button", name="Sell 10 Shares")
        await confirm_sell.click()

        await asyncio.sleep(2)
        assets = await assets_text.inner_text()
        print(f"Assets after sell: {assets}")

        await browser.close()
        print("Verification complete.")

if __name__ == "__main__":
    asyncio.run(run())
