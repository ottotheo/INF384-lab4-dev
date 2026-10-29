
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { handler } = require('../../src/handler');

async function llamar(metodo, ruta, cuerpo) {
  const r = await handler({
    rawPath: ruta,
    requestContext: { http: { method: metodo } },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });

  return { status: r.statusCode, cuerpo: JSON.parse(r.body) };
}

test('transferencia de ana a beto y validación de saldos e historial', async () => {
  const r = await llamar('POST', '/transferir', {
    origen: 'ana',
    destino: 'beto',
    monto: 100,
  });

  assert.equal(r.status, 200);
  assert.equal(r.cuerpo.saldoOrigen, 900);

  const ana = await llamar('GET', '/saldo/ana');
  assert.deepEqual(ana.cuerpo, { usuario: 'ana', saldo: 900 });

  const beto = await llamar('GET', '/saldo/beto');
  assert.deepEqual(beto.cuerpo, { usuario: 'beto', saldo: 600 });

  const historial = await llamar('GET', '/historial/ana');
  assert.equal(historial.status, 200);
  assert.equal(historial.cuerpo.length, 1);
  assert.equal(historial.cuerpo[0].destino, 'beto');
  assert.equal(historial.cuerpo[0].monto, 100);

  const rechazo = await llamar('POST', '/transferir', {
    origen: 'ana',
    destino: 'carla',
    monto: 950,
  });

  assert.equal(rechazo.status, 400);
  assert.equal(rechazo.cuerpo.error, 'saldo insuficiente');

  const anaDespues = await llamar('GET', '/saldo/ana');
  const carla = await llamar('GET', '/saldo/carla');

  assert.equal(anaDespues.cuerpo.saldo, 900);
  assert.equal(carla.cuerpo.saldo, 750);
});

test('transferencia de diego a elena y validación de saldo insuficiente', async () => {
  const r = await llamar('POST', '/transferir', {
    origen: 'diego',
    destino: 'elena',
    monto: 300,
  });

  assert.equal(r.status, 200);

  const elena = await llamar('GET', '/saldo/elena');
  assert.equal(elena.cuerpo.saldo, 1500);

  const rechazo = await llamar('POST', '/transferir', {
    origen: 'diego',
    destino: 'ana',
    monto: 0.01,
  });

  assert.equal(rechazo.status, 400);

  const historial = await llamar('GET', '/historial/elena');
  assert.equal(historial.cuerpo.length, 1);
  assert.equal(historial.cuerpo[0].origen, 'diego');
});

test('transferir al mismo usuario es 422', async () => {
  const r = await llamar('POST', '/transferir', {
    origen: 'beto',
    destino: 'beto',
    monto: 1,
  });

  assert.equal(r.status, 422);
});

test('transferir a un usuario inexistente es 400', async () => {
  const r = await llamar('POST', '/transferir', {
    origen: 'beto',
    destino: 'zoe',
    monto: 1,
  });

  assert.equal(r.status, 400);
});

test('un cuerpo que no es JSON es 400', async () => {
  const r = await handler({
    rawPath: '/transferir',
    requestContext: { http: { method: 'POST' } },
    body: 'monto=1',
  });

  assert.equal(r.statusCode, 400);
});
