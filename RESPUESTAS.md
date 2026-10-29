# INF384 — Laboratorio 4: Respuestas y evidencias

**Fecha:** 29 de octubre de 2026  
**Repositorio:** https://github.com/ottotheo/INF384-lab4-dev  
**Rama:** `main`  
**Ejecución final de la Parte 1:** https://github.com/ottotheo/INF384-lab4-dev/actions/runs/40912168861  
**Estado observado:** `Success` (14 min 04 s; nueve jobs exitosos).

> **Alcance:** Se documentan cinco cambios independientes realizados en `ci.yml` y `test/`. Los cambios 3, 4 y 5 mejoran pruebas u observabilidad, pero no existe evidencia concluyente de que correspondan exactamente a los cinco defectos intencionales del repositorio original. No se modificó `src/` ni el job `deploy` durante esta parte.

## Parte 1 — Diagnóstico y corrección de cinco problemas

### 1. El smoke test no esperaba al despliegue

**a) Job, etapa y efecto.** Job `smoke`, etapa posterior a la construcción/despliegue. La dependencia inicial era `needs: build-push`, por lo que el smoke test podía comenzar sin esperar a que `deploy` actualizara Lambda. Esto permitía probar una versión anterior de la aplicación.

**b) Commit.** [2a361642ee5e0fdb70ba7b9b570bff7aa1693b60](https://github.com/ottotheo/INF384-lab4-dev/commit/2a361642ee5e0fdb70ba7b9b570bff7aa1693b60).

**c) Clasificación.** Mover/corregir dependencia entre etapas. Se cambió `smoke.needs` de `build-push` a `deploy`.

**d) Evidencia.** [Ejecución observada del primer cambio](https://github.com/ottotheo/INF384-lab4-dev/actions/runs/40897323752), con resultado satisfactorio. La ejecución final confirma la secuencia `build-push → deploy → smoke`.

### 2. El smoke test no recibía el commit esperado

**a) Job, etapa y efecto.** Job `smoke`, etapa de verificación posterior al despliegue. El script `test/smoke/smoke.sh` ya podía comparar la versión desplegada con `EXPECTED_COMMIT`, pero el workflow no suministraba esa variable. Por ello, la comprobación de correspondencia con el commit del pipeline quedaba omitida.

**b) Commit.** [99b733ed893d6a9baa38c86fecf79b08df45764c](https://github.com/ottotheo/INF384-lab4-dev/commit/99b733ed893d6a9baa38c86fecf79b08df45764c).

**c) Clasificación.** Corregir configuración. Se agregó `EXPECTED_COMMIT: ${{ github.sha }}` al entorno del paso `Smoke`.

**d) Evidencia.** El log observado mostró `/salud` con el commit `99b733ed893d6a9baa38c86fecf79b08df45764c`, el mismo valor en la comprobación `commit:` y una consulta de saldo satisfactoria. Esto respalda que el smoke test verificó la revisión desplegada.

### 3. Pruebas de integración con dependencia del orden

**a) Job, etapa y efecto.** Job `integration`, etapa previa a `build-push`. El archivo `test/integration/transferir.test.js` tenía 12 pruebas que compartían estado y dependían de la secuencia de ejecución. Esa organización dificultaba interpretar los fallos y podía generar resultados sensibles al orden.

**b) Commit.** [799ff5c814644c4edce23ac6c8cd8d8deb35ef48](https://github.com/ottotheo/INF384-lab4-dev/commit/799ff5c814644c4edce23ac6c8cd8d8deb35ef48).

**c) Clasificación.** Modificar pruebas. Se reagruparon los escenarios de integración en cinco pruebas.

**d) Evidencia.** El log observado del job `integration` mostró `# tests 5`, `# pass 5`, `# fail 0` y `duration_ms 126` (aproximadamente). **Limitación:** la agrupación reduce la fragmentación, pero no demuestra aislamiento completo de la base de datos entre pruebas.

### 4. Validación incompleta de la respuesta de transferencia en E2E

**a) Job, etapa y efecto.** Job `e2e`, etapa posterior al smoke test. La prueba de `POST /transferir` comprobaba el HTTP 200, los participantes, el monto y el identificador, pero no validaba `saldoOrigen`, campo devuelto por el servicio. Una respuesta con ese campo ausente o no numérico podía superar la prueba anterior.

**b) Commit.** [9cf7abd7fe82a7fa82e2df21cdb3d4b0fa0d31e7](https://github.com/ottotheo/INF384-lab4-dev/commit/9cf7abd7fe82a7fa82e2df21cdb3d4b0fa0d31e7).

**c) Clasificación.** Modificar pruebas. Se añadieron aserciones para verificar que `saldoOrigen` sea numérico, finito y no negativo.

**d) Evidencia.** El log de Playwright mostró la prueba `una transferencia valida el saldo resultante por la URL publica` como exitosa y el resumen `10 passed (4.4s)`. **Limitación:** se valida el formato y rango del saldo, no la exactitud matemática del descuento. Consultas separadas podrían llegar a instancias Lambda con bases SQLite independientes.

### 5. La prueba de carga no distinguía rechazos de negocio de otros HTTP 400

**a) Job, etapa y efecto.** Job `load`, etapa posterior al smoke test. El script aceptaba indistintamente HTTP 200 y 400 mediante `http.expectedStatuses(200, 400)` y un check equivalente. Por tanto, una respuesta 400 por una causa distinta de `saldo insuficiente` también podía computarse como esperada.

**b) Commit.** [87b8d61ab3d8e3b1b2903c1ffc8408bb0847fb0f](https://github.com/ottotheo/INF384-lab4-dev/commit/87b8d61ab3d8e3b1b2903c1ffc8408bb0847fb0f).

**c) Clasificación.** Modificar pruebas/observabilidad. Se agregaron los contadores `transferencias_exitosas`, `transferencias_rechazadas` y `respuestas_inesperadas`; el check ahora admite HTTP 200 o HTTP 400 únicamente cuando el JSON contiene `error: "saldo insuficiente"`. Se conservaron las etapas de 1 + 10 + 1 minutos y los umbrales existentes.

**d) Evidencia.** [Job `load` del run final](https://github.com/ottotheo/INF384-lab4-dev/actions/runs/40912168861/job/123583829472). El log observado mostró 17 112 transferencias exitosas, 34 224 solicitudes HTTP, `checks` al 100 %, `http_req_failed` al 0 % y p95 de 86,84 ms. Los contadores con valor cero pueden omitirse del resumen de k6; por ello, la ausencia de otros contadores no se interpreta como una medición independiente. **Limitación:** `http_req_failed` todavía trata todo HTTP 400 como esperado por la configuración original; la distinción más precisa se realiza en el check y los contadores personalizados.

## Verificación consolidada de `main`

- **Run:** https://github.com/ottotheo/INF384-lab4-dev/actions/runs/40912168861
- **Commit:** `87b8d61ab3d8e3b1b2903c1ffc8408bb0847fb0f`.
- **Disparador:** `push` a `main`, 29 de octubre de 2026.
- **Resultado:** `Success`.
- **Duración total del workflow:** 14 min 04 s.
- **Jobs exitosos:** `unit`, `integration`, `sast`, `sca`, `build-push`, `deploy`, `smoke`, `e2e`, `load`.
- **Seguridad de la imagen:** el escaneo Trivy registró 219 hallazgos HIGH/CRITICAL, tratados como **informativos**, de acuerdo con la política del caso. Esto **no significa** que la imagen carezca de vulnerabilidades.

### Resultados observados de la carga final

| Métrica | Resultado |
|---|---:|
| Duración configurada de la prueba | 12 min |
| Solicitudes HTTP | 34 224 |
| Transferencias exitosas | 17 112 |
| Checks exitosos | 100 % (34 224 / 34 224) |
| `http_req_failed` | 0 % |
| Latencia promedio | 79,3 ms |
| Latencia p90 | 83,97 ms |
| Latencia p95 | 86,84 ms |
| Latencia máxima | 492,78 ms |
| Rendimiento HTTP | 47,53 req/s |
| Usuarios virtuales máximos | 30 |

**Evaluación del SLO de latencia:** el p95 observado (86,84 ms) cumple el umbral configurado de 500 ms. La tasa de checks cumple el umbral mayor a 99 % y la tasa `http_req_failed` cumple el umbral menor a 1 %. Esto corresponde a una ejecución de laboratorio y no demuestra por sí solo el cumplimiento sostenido de un SLA de producción.

## Parte 2 — Implementación y validación

### 2.1. Pipeline exitoso en `main`

Se obtuvo una ejecución exitosa del pipeline que contiene los cinco commits correspondientes a las correcciones de la Parte 1.

- **Run:** [GitHub Actions #6](https://github.com/ottotheo/INF384-lab4-dev/actions/runs/40912168861)
- **Rama:** `main`
- **Commit:** `87b8d61ab3d8e3b1b2903c1ffc8408bb0847fb0f`
- **Resultado:** Success.
- **Jobs exitosos:** `unit`, `integration`, `sast`, `sca`, `build-push`, `deploy`, `smoke`, `e2e` y `load`.

### 2.2. Detección de un defecto funcional

Se creó el [Pull Request #1](https://github.com/ottotheo/INF384-lab4-dev/pull/1) desde la rama `prueba-deteccion-defecto` hacia `main`, sin fusionarlo.

**Archivo modificado:** `src/wallet.js`.

**Defecto introducido:** Se alteró deliberadamente la función `saldo()` para devolver una unidad adicional al saldo real:

```javascript
return {
  usuario: encontrado.id,
  saldo: aSoles(encontrado.saldo) + 1
};
```

**Job que debe detectar el defecto:** `unit`, durante la etapa `pre-build`.

**Evidencia observada:**

```text
not ok 16 - saldo devuelve el saldo en soles

Actual:   1501.5
Expected: 1500.5

# tests 28
# pass 27
# fail 1

Error: Process completed with exit code 1.
```

El job `unit` detectó correctamente el defecto y terminó con código de salida 1. La cobertura de líneas y ramas fue del 100 %, lo que demuestra que una cobertura elevada no garantiza la ausencia de errores funcionales.

**Run fallido:** Agregar aquí el enlace directo al run del Pull Request #1 cuyo job `unit` aparece en rojo.

**Conclusión:** El pipeline detectó el defecto funcional introducido y evitó que la ejecución fuera considerada exitosa. El Pull Request se mantuvo sin fusionar.

---

## Parte 3 — Decisión bajo restricción

### 3.1. Presupuesto y métrica DORA

- **Presupuesto de duración:** 8 minutos (supuesto provisional; pendiente de confirmar la asignación oficial).
- **Métrica DORA:** Change Failure Rate — CFR (supuesto provisional; pendiente de confirmar la asignación oficial).

### 3.2. Duración inicial de los jobs

Se utilizó como referencia el [run #6](https://github.com/ottotheo/INF384-lab4-dev/actions/runs/40912168861), ejecutado exitosamente en `main`.

| Job | Etapa | Duración |
|---|---|---:|
| `unit` | Pre-build | 13 s |
| `integration` | Pre-build | 12 s |
| `sast` | Pre-build | 17 s |
| `sca` | Pre-build | 24 s |
| `build-push` | Build | 39 s |
| `deploy` | Deploy | 24 s |
| `smoke` | Post-deploy | 13 s |
| `e2e` | Post-deploy | 43 s |
| `load` | Post-deploy | 12 min 14 s |
| **Total acumulado** | | **14 min 59 s** |

La duración del pipeline se calculó sumando las duraciones individuales de todos los jobs, según la definición del enunciado, sin confundirla con el tiempo transcurrido de ejecución paralela.

### 3.3. Resultados iniciales de carga

En el run #6 se observaron los siguientes resultados:

| Métrica | Valor |
|---|---:|
| Latencia p90 | 83,97 ms |
| Latencia p95 | 86,84 ms |
| Latencia máxima | 492,78 ms |
| Tasa de errores según k6 | 0 % |
| Rendimiento | 47,53 solicitudes/s |
| Solicitudes HTTP | 34 224 |
| Checks exitosos | 100 % |
| Transferencias exitosas | 17 112 |

**Interpretación:** Bajo la carga aplicada, Monedero Andino mantuvo una latencia p95 inferior a 100 ms y no presentó errores registrados por los controles de k6. Sin embargo, los resultados corresponden únicamente al escenario y duración evaluados; no permiten garantizar el comportamiento ante cargas superiores.

### 3.4. SLO de latencia propuesto

Se propone el siguiente objetivo técnico:

- **Indicador:** percentil 95 de la latencia HTTP.
- **Objetivo:** p95 inferior a 150 ms.
- **Ventana de medición:** cada ejecución de la prueba de carga de cinco minutos en CI.
- **Configuración:** `SLO_P95: 150` en `.github/workflows/ci.yml`.

El umbral se seleccionó considerando las latencias observadas y un margen para la variación entre ejecuciones. Se evita establecer un límite excesivamente cercano al valor medido, que podría provocar fallos intermitentes del pipeline.

**Evidencia de cumplimiento en el run #9:**

| Métrica | Valor |
|---|---:|
| Latencia p90 | 52,57 ms |
| Latencia p95 | 54,76 ms |
| Latencia máxima | 470,42 ms |
| Rendimiento | 49,41 solicitudes/s |
| Tasa de errores según k6 | 0 % |
| Checks exitosos | 100 % |

El SLO se cumplió, con un margen de 95,24 ms entre el p95 observado y el umbral configurado.

### 3.5. SLA propuesto

Se propone un **SLA de latencia p95 inferior a 300 ms**, medido mensualmente para las solicitudes HTTP de los clientes de Monedero Andino, sujeto a condiciones contractuales de medición, exclusiones y compensaciones.

El **SLO** es un objetivo técnico interno utilizado para orientar la calidad y detectar degradaciones tempranamente. El **SLA** es un compromiso formal con los clientes y puede incluir consecuencias por incumplimiento.

El SLA propuesto es menos exigente que el SLO para mantener un margen operativo ante variaciones de infraestructura y tráfico. Este valor es una propuesta, no una garantía respaldada todavía por mediciones mensuales de producción.

### 3.6. Optimización del pipeline

Se identificó que el job `load` representaba el mayor consumo de tiempo acumulado.

Se modificó `test/load/transferir.js` para reducir la duración nominal de 12 a 5 minutos:

**Configuración anterior:**

```javascript
stages: [
  { duration: '1m', target: 30 },
  { duration: '10m', target: 30 },
  { duration: '1m', target: 0 },
],
```

**Configuración optimizada:**

```javascript
stages: [
  { duration: '30s', target: 30 },
  { duration: '4m', target: 30 },
  { duration: '30s', target: 0 },
],
```

La nueva configuración conserva cuatro minutos de carga constante con 30 usuarios virtuales, respetando la restricción del enunciado. El job `load` continúa ejecutándose en cada pipeline de `main`.

**Comparación de resultados:**

| Job | Run #6 | Run #9 | Diferencia |
|---|---:|---:|---:|
| `unit` | 13 s | 10 s | −3 s |
| `integration` | 12 s | 14 s | +2 s |
| `sast` | 17 s | 23 s | +6 s |
| `sca` | 24 s | 16 s | −8 s |
| `build-push` | 39 s | 49 s | +10 s |
| `deploy` | 24 s | 16 s | −8 s |
| `smoke` | 13 s | 10 s | −3 s |
| `e2e` | 43 s | 42 s | −1 s |
| `load` | 12m 14s | 5m 09s | −7m 05s |
| **Total** | **14m 59s** | **7m 09s** | **−7m 50s** |

**Resultado:**

- Presupuesto provisional: 8 min.
- Duración acumulada final: 7 min 09 s.
- Margen disponible: 51 s.
- Reducción total observada: 7 min 50 s.

La reducción atribuible directamente al cambio de configuración corresponde al job `load`. Las diferencias de los demás jobs son variaciones observadas entre ejecuciones, no optimizaciones adicionales implementadas.

**Run optimizado:** Agregar aquí el enlace directo al run #9.

### 3.7. Riesgo aceptado y efecto en DORA

**Riesgo aceptado:** La reducción de la duración de la prueba de carga disminuye el tiempo durante el cual se observa el comportamiento del sistema bajo carga sostenida.

Un defecto concreto que podría detectarse más tarde es una degradación progresiva del endpoint `/transferir`, causada, por ejemplo, por una acumulación de recursos que solo se manifieste después de varios minutos de operación continua.

Una prueba de cinco minutos podría terminar correctamente antes de que aparezca esa degradación, mientras que una prueba de doce minutos tendría una ventana de observación más amplia.

**Efecto en Change Failure Rate (CFR):**

Si ese defecto no se detecta en CI y llega a producción, podría provocar un despliegue que requiera intervención correctiva. En ese escenario, el CFR **podría aumentar**.

No se afirma que el CFR haya aumentado efectivamente; se identifica el riesgo potencial asociado a la decisión de optimización.

### 3.8. Decisión sobre SAST

**Decisión:** Mantener el job `sast` en la etapa `pre-build`, con comportamiento bloqueante.

**Justificación:**

- En el run #9, `sast` consumió 23 segundos.
- Se ejecuta en paralelo con `unit`, `integration` y `sca`.
- Detecta hallazgos de seguridad de severidad ERROR antes de construir y desplegar la aplicación.
- Pasarlo a informativo permitiría que cambios con hallazgos de esa severidad continuaran hacia el despliegue.
- Moverlo después de `deploy` retrasaría la detección de riesgos de seguridad.

**Efecto sobre el presupuesto:** Se conserva el costo observado de 23 segundos de `sast`. Como no se elimina ni se modifica su configuración, no se atribuye ningún ahorro de tiempo a este job.

**Efecto sobre CFR:** Mantener el control bloqueante contribuye a reducir el riesgo de desplegar cambios con problemas de seguridad detectables por SAST. Su eliminación podría aumentar el riesgo de fallos derivados de esos cambios, aunque no existe evidencia suficiente para cuantificar un cambio real en el CFR.

### 3.9. Conclusión

Se optimizó el pipeline de Monedero Andino reduciendo el tiempo acumulado de 14 min 59 s a 7 min 09 s, sin modificar `deploy`, sin eliminar `load` y manteniendo cuatro minutos de carga constante.

La ejecución final terminó correctamente y cumplió el SLO de latencia p95 inferior a 150 ms.

La optimización acepta una menor ventana de observación del rendimiento sostenido, pero conserva las pruebas unitarias, de integración, E2E, smoke y los controles de seguridad.

---

## Declaración de uso de inteligencia artificial generativa

Se utilizó **ChatGPT (OpenAI)** como apoyo para analizar el enunciado, revisar la configuración del pipeline, interpretar los logs de GitHub Actions y k6, proponer cambios, calcular las duraciones acumuladas y estructurar las respuestas del laboratorio.

Las modificaciones fueron aplicadas en el repositorio y sus resultados contrastados con las ejecuciones reales de GitHub Actions. Las métricas consignadas corresponden a los logs observados durante la sesión.
