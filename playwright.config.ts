import { defineConfig, devices } from '@playwright/test'

/**
 * E2E contra el build de producción (`npm run build` antes). Se sirve con `vite preview` respetando
 * BASE_PATH, igual que en GitHub Pages. WebGL2 por software (SwiftShader) para CI sin GPU.
 */
const PORT = 4173
const BASE_PATH = process.env.BASE_PATH ?? '/'
const baseURL = `http://localhost:${PORT}${BASE_PATH}`
/** WebGL2 por software para Chromium en CI sin GPU. */
const chromiumSoftwareGl = {
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
}

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 90_000,
  expect: { timeout: 20_000 },
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : 3,
  /*
   * Tope de toda la ejecución, solo en CI. Playwright pide ponerlo siempre ahí
   * (https://playwright.dev/docs/ci): sin él, si algo se cuelga, el trabajo se queda esperando hasta que
   * GitHub lo cancela y no deja informe. Con él, Playwright se detiene antes, escribe el informe y la
   * ejecución falla con un motivo. Tiene que ser menor que el límite del paso y del trabajo en
   * .github/workflows/ci.yml (50 y 60 minutos), para que sea Playwright quien corte primero.
   */
  globalTimeout: process.env.CI ? 45 * 60_000 : undefined,
  reporter: process.env.CI
    ? [
        ['github'],
        ['html', { open: 'never' }],
        // Los tiempos de cada archivo, para repartir las pruebas con datos (scripts/ci/resumen-tiempos.ts).
        ['json', { outputFile: 'test-results/informe.json' }],
      ]
    : [['list']],
  use: {
    baseURL,
    locale: 'es-MX',
    timezoneId: 'America/Mexico_City',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        launchOptions: chromiumSoftwareGl,
      },
    },
    { name: 'mobile', use: { ...devices['Pixel 7'], launchOptions: chromiumSoftwareGl } },
    // Tableta táctil en vertical (Chromium con pantalla y eventos táctiles de iPad).
    {
      name: 'tablet',
      use: {
        ...devices['iPad (gen 7)'],
        defaultBrowserType: 'chromium',
        launchOptions: chromiumSoftwareGl,
      },
    },
    // Motor WebKit (el de Safari) con la emulación de iPhone de Playwright. No sustituye a un iPhone
    // real: no reproduce Safari de iOS, su GPU ni sus barras dinámicas (ver docs/TESTING.md).
    { name: 'webkit-iphone', use: { ...devices['iPhone 13'] } },
  ],
  webServer: {
    command: `npm run preview -- --port ${PORT} --strictPort`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
