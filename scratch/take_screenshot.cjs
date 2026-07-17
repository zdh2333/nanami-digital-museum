const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });
  
  // Listen to console and page error events
  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));
  
  console.log("Navigating to https://2cb1ba45.nanami-digital-museum.pages.dev...");
  await page.goto('https://2cb1ba45.nanami-digital-museum.pages.dev/', { waitUntil: 'load' });
  
  console.log("Scrolling to guestbook...");
  const guestbook = page.locator('#guestbook');
  await guestbook.scrollIntoViewIfNeeded();
  await page.waitForTimeout(2000);
  
  console.log("Filling nickname and message...");
  await page.fill('#guestbook-nickname', 'TestUser');
  await page.fill('#guestbook-message', 'Hello Nanami, this is a test message!');
  
  console.log("Waiting for Turnstile widget to appear...");
  await page.waitForTimeout(5000);
  
  console.log("Taking screenshot of guestbook...");
  await guestbook.screenshot({ path: '/Users/zdh/.gemini/antigravity/brain/ad10a793-a89d-4c53-bf00-c97c02173a48/guestbook_final.png' });
  
  await browser.close();
  console.log("Done!");
})().catch(err => {
  console.error("Error running script:", err);
  process.exit(1);
});
