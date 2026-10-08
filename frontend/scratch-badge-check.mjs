import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('console', (msg) => { if (msg.type() === 'error') console.log('[console error]', msg.text()); });

await page.goto('http://localhost:5173/votar/7109');
await page.waitForSelector('text=Candidatos a', { timeout: 15000 });
await page.waitForTimeout(400);
await page.screenshot({ path: 'C:/development/urna-eletronica-etapa4/frontend/scratch-badge-01.png' });

await browser.close();
console.log('ok');
