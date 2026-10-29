import { test, expect } from '@playwright/test';

test('salud responde ok con version y commit', async ({ page }) => {
  const r = await page.request.get('/salud');
  expect(r.status()).toBe(200);
  const cuerpo = await r.json();
  expect(cuerpo.ok).toBe(true);
  expect(typeof cuerpo.version).toBe('string');
  expect(typeof cuerpo.commit).toBe('string');
});

test('version coincide con salud', async ({ page }) => {
  const salud = await (await page.request.get('/salud')).json();
  const version = await (await page.request.get('/version')).json();
  expect(version).toEqual({ version: salud.version, commit: salud.commit });
});

test('las respuestas son JSON', async ({ page }) => {
  const r = await page.request.get('/saldo/ana');
  expect(r.headers()['content-type']).toContain('application/json');
});

test('el navegador muestra el saldo de un usuario semilla', async ({ page }) => {
  await page.goto('/saldo/carla');
  const cuerpo = JSON.parse(await page.locator('body').innerText());
  expect(cuerpo.usuario).toBe('carla');
  expect(typeof cuerpo.saldo).toBe('number');
});

test('cada usuario semilla tiene saldo', async ({ page }) => {
  for (const usuario of ['ana', 'beto', 'carla', 'diego', 'elena']) {
    const r = await page.request.get(`/saldo/${usuario}`);
    expect(r.status()).toBe(200);
    expect((await r.json()).saldo).toBeGreaterThanOrEqual(0);
  }
});

test('historial devuelve una lista', async ({ page }) => {
  const r = await page.request.get('/historial/elena');
  expect(r.status()).toBe(200);
  expect(Array.isArray(await r.json())).toBe(true);
});

test('una transferencia valida el saldo resultante por la URL publica', async ({ page }) => {
  const r = await page.request.post('/transferir', {
    data: { origen: 'elena', destino: 'ana', monto: 0.01 },
  });

  expect(r.status()).toBe(200);

  const cuerpo = await r.json();

  expect(cuerpo).toMatchObject({
    origen: 'elena',
    destino: 'ana',
    monto: 0.01,
  });

  expect(typeof cuerpo.id).toBe('number');

  // Verificar que la respuesta incluya un saldo resultante válido.
  expect(typeof cuerpo.saldoOrigen).toBe('number');
  expect(Number.isFinite(cuerpo.saldoOrigen)).toBe(true);
  expect(cuerpo.saldoOrigen).toBeGreaterThanOrEqual(0);
});

test('cada movimiento del historial involucra al usuario', async ({ page }) => {
  const historial = await (await page.request.get('/historial/beto')).json();
  for (const m of historial) {
    expect([m.origen, m.destino]).toContain('beto');
    expect(m.monto).toBeGreaterThan(0);
  }
});

test('transferir con monto negativo es 400', async ({ page }) => {
  const r = await page.request.post('/transferir', {
    data: { origen: 'elena', destino: 'ana', monto: -10 },
  });
  expect(r.status()).toBe(400);
});

test('una ruta desconocida es 404', async ({ page }) => {
  const r = await page.request.get('/cuentas');
  expect(r.status()).toBe(404);
});
