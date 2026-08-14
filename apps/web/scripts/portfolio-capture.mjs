/**
 * Utilitário permanente para captura de screenshots de portfólio - existe
 * porque um script descartável de sessão anterior corrompeu 3 screenshots
 * silenciosamente (token de acesso expirou no meio de um lote longo, as
 * últimas capturas salvaram a tela de login sem nenhum erro) e outro
 * esqueceu de forçar tema escuro (todo screenshot do portfólio é dark mode -
 * ver docs/screenshots/*.png - mas o app resolve "system" via
 * prefers-color-scheme, e o Chromium headless do Playwright abre em light
 * por padrão). Achado 2026-08-15, ver docs/changelog/2026-08.md. Um script
 * novo por feature ainda é o padrão (mesma convenção de sempre), mas ele
 * agora IMPORTA daqui em vez de reimplementar login/tema/asserção do zero -
 * as duas causas raiz viram impossíveis de esquecer, não apenas uma
 * instrução de checklist pra lembrar toda vez.
 *
 * Uso típico:
 *   import { launchPortfolioPage, loginAsAdmin, assertPageContains,
 *     shootFullHeight, checkForDuplicateScreenshots } from "../scripts/portfolio-capture.mjs";
 *
 *   const { browser, page } = await launchPortfolioPage();
 *   let loginState = await loginAsAdmin(page, "pt-BR");
 *   for (const target of targets) {
 *     loginState = await reloginIfStale(page, loginState, "pt-BR");
 *     await page.goto(`http://localhost:3000${target.url}`);
 *     await assertPageContains(page, target.mustContain, target.file);
 *     await shootFullHeight(page, path.join(SHOT_DIR, target.file));
 *   }
 *   await browser.close();
 *   checkForDuplicateScreenshots(SHOT_DIR); // roda no fim de todo lote
 */
import { chromium } from "@playwright/test";
import { readdirSync, statSync } from "node:fs";
import path from "node:path";

const THEME_STORAGE_KEY = "morpheus-theme";
const LOGIN_STALE_AFTER_MS = 10 * 60 * 1000; // margem de segurança sob o token de 15min

/**
 * Abre um browser+página já com tema escuro forçado via localStorage (a
 * mesma chave que apps/web/src/lib/theme-constants.ts define) - aplicado
 * ANTES de qualquer navegação via addInitScript, então nunca depende de
 * emulateMedia nem do prefers-color-scheme do ambiente de captura.
 */
export async function launchPortfolioPage(viewport = { width: 1280, height: 900 }) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport });
  page.setDefaultTimeout(60000);
  await page.addInitScript((key) => {
    window.localStorage.setItem(key, "dark");
  }, THEME_STORAGE_KEY);
  return { browser, page };
}

/** Login real via UI (credenciais do tenant demo) - devolve o timestamp pra reloginIfStale rastrear. */
export async function loginAsAdmin(page, locale, credentials = {}) {
  const email = credentials.email ?? "admin@morpheus.demo";
  const password = credentials.password ?? "Demo@12345";
  await page.goto(`http://localhost:3000/${locale}/login`);
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/dashboard/, { timeout: 60000 });
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(800);
  return { loggedInAt: Date.now() };
}

/**
 * Relogin automático se o login estiver perto de expirar - mesma causa raiz
 * do incidente de 2026-08-13 (token de 15min expirando no meio de um lote
 * longo). Chamar antes de cada captura num lote com muitos alvos.
 */
export async function reloginIfStale(page, loginState, locale, credentials) {
  if (Date.now() - loginState.loggedInAt < LOGIN_STALE_AFTER_MS) return loginState;
  console.log("Reautenticando (login perto de expirar)...");
  return loginAsAdmin(page, locale, credentials);
}

/**
 * Nunca confiar cegamente que a navegação foi pro lugar certo - falha alta
 * e visível em vez de salvar silenciosamente uma imagem errada (foi
 * exatamente assim que admin-auditoria.png/admin-papeis.png/
 * admin-platform-policy.png viraram screenshots da tela de login sem
 * nenhum erro em 2026-08-13).
 */
export async function assertPageContains(page, expectedText, label) {
  const bodyText = await page.evaluate(() => document.body.innerText);
  if (!bodyText.includes(expectedText)) {
    throw new Error(
      `Captura de "${label}" abortada: página não contém "${expectedText}" ` +
        `(possível redirecionamento pro login ou erro de navegação). URL atual: ${page.url()}`,
    );
  }
}

/**
 * Captura segura de página que pode rolar - nunca usar `fullPage: true`
 * (quebra `position: sticky` da sidebar, ver feedback_morpheus_workflow).
 * Mede a altura real, redimensiona o viewport pra caber tudo numa passada
 * só, tira o screenshot normal (sem stitching), volta o viewport ao padrão.
 */
export async function shootFullHeight(page, filePath, baseViewport = { width: 1280, height: 900 }) {
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.setViewportSize({ width: baseViewport.width, height });
  await page.waitForTimeout(200);
  await page.screenshot({ path: filePath });
  await page.setViewportSize(baseViewport);
}

/**
 * Sanity check pós-lote: screenshots de páginas diferentes nunca deveriam
 * ter o MESMO tamanho de arquivo em bytes - foi exatamente esse padrão
 * (3 arquivos, todos com 95854 bytes) que expôs o incidente de 2026-08-13,
 * só que só foi notado meses depois, numa revisão manual do usuário. Rodar
 * isto no fim de todo lote de captura, não só quando algo já pareceu errado.
 * Lança erro se achar colisão - não é um "warning" pra ignorar.
 */
export function checkForDuplicateScreenshots(shotDir) {
  const bySize = new Map();
  for (const file of readdirSync(shotDir)) {
    if (!file.endsWith(".png")) continue;
    const size = statSync(path.join(shotDir, file)).size;
    if (!bySize.has(size)) bySize.set(size, []);
    bySize.get(size).push(file);
  }
  const collisions = [...bySize.values()].filter((files) => files.length > 1);
  if (collisions.length > 0) {
    const details = collisions.map((files) => `  - ${files.join(", ")}`).join("\n");
    throw new Error(
      `Screenshots com tamanho de arquivo idêntico (suspeito de serem a mesma imagem ` +
        `salva sob nomes diferentes - ex.: todas caíram na tela de login):\n${details}`,
    );
  }
  console.log(`OK: nenhuma colisão de tamanho entre ${[...bySize.values()].flat().length} screenshots.`);
}
