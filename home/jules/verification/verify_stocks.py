from playwright.sync_api import Page, expect, sync_playwright
import time

def test_stock_market(page: Page):
    # 1. Arrange: Go to the town page
    print("Navigating to town page...")
    page.goto("http://localhost:3004/town/1")

    # Wait for the page and components to load
    page.wait_for_selector("button:has-text('Stock Market')", timeout=30000)
    print("Page loaded.")

    # 2. Act: Open Stock Market
    print("Opening Stock Market...")
    stock_button = page.get_by_role("button", name="📈 Stock Market")
    stock_button.click(force=True)

    # 3. Verify: Check if the modal is open
    expect(page.get_by_text("Funny Names Exchange")).to_be_visible(timeout=10000)
    print("Stock Market modal opened.")

    # 4. Act: Click on BANA stock row
    print("Finding BANA row...")
    bana_row = page.get_by_role("button").filter(has_text="BANA").first
    expect(bana_row).to_be_visible(timeout=10000)

    # Take a screenshot before clicking
    page.screenshot(path="/home/jules/verification/stock_list_before_click.png")

    # Click it
    print("Clicking BANA row...")
    bana_row.click(force=True)

    # 5. Verify: Check if the chart and trading UI are visible
    print("Waiting for detail view...")
    expect(page.get_by_text("Current Price")).to_be_visible(timeout=15000)
    buy_button = page.get_by_role("button", name="BUY SHARES")
    expect(buy_button).to_be_visible(timeout=10000)

    # Take a screenshot of the detail view
    page.screenshot(path="/home/jules/verification/stock_market_detail.png")
    print("Detail view visible. Screenshot saved.")

    # 6. Act: Try to buy some shares
    print("Clicking BUY SHARES...")
    # Use force=True as Radix Dialog might have invisible overlays/animations
    buy_button.click(force=True)
    print("BUY SHARES clicked.")

    # 7. Verify: Success state
    # The app reloads on success.
    print("Waiting for page reload...")
    try:
        page.wait_for_url("**/town/1", timeout=15000)
        print("Reload detected via URL change/navigation.")
    except:
        print("Timeout waiting for URL, maybe it just refreshed the same URL.")

    page.wait_for_load_state("networkidle")
    print("Page idle after reload.")

    # Open stock market again to see holdings
    print("Re-opening Stock Market to verify holdings...")
    page.wait_for_selector("button:has-text('Stock Market')", timeout=30000)
    page.get_by_role("button", name="📈 Stock Market").click(force=True)

    print("Opening BANA detail view again...")
    bana_row_after = page.get_by_role("button").filter(has_text="BANA").first
    bana_row_after.click(force=True)

    print("Checking for '1 Shares'...")
    expect(page.get_by_text("1 Shares")).to_be_visible(timeout=15000)
    print("Success! 1 Shares found.")

    # Take a final screenshot
    page.screenshot(path="/home/jules/verification/stock_market_bought.png")
    print("Final screenshot saved to /home/jules/verification/stock_market_bought.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Use a larger viewport to ensure elements aren't off-screen
        page = browser.new_page(viewport={"width": 1280, "height": 800})
        # Set cookie for Player1
        page.context.add_cookies([{
            "name": "mock_user",
            "value": "Player1",
            "domain": "localhost",
            "path": "/"
        }])
        try:
            test_stock_market(page)
        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="/home/jules/verification/error_detail.png")
            print("Error screenshot saved to /home/jules/verification/error_detail.png")
        finally:
            browser.close()
