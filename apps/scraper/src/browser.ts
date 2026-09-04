import puppeteer, { type Browser, type Page } from "puppeteer";
import { scraperConfig } from "./config.js";

export async function launchBrowser(): Promise<Browser> {
  return puppeteer.launch({
    headless: scraperConfig.headless,
    executablePath: scraperConfig.chromePath,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--disable-blink-features=AutomationControlled",
    ],
  });
}

export async function openSakusPage(browser: Browser): Promise<Page> {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.setUserAgent(
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  );
  page.setDefaultTimeout(45_000);
  return page;
}
