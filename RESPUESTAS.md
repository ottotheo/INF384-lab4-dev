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

## Parte 2 — Validación de detección de defectos mediante Pull Request

**Estado: pendiente de ejecución y evidencia.** Para completar esta parte falta crear una rama, introducir deliberadamente un defecto en `src/`, abrir un Pull Request y registrar el job que falla, con enlace al PR y al run. El defecto no debe incorporarse a `main`.

| Evidencia requerida | Estado |
|---|---|
| Enlace al Pull Request con defecto deliberado | Pendiente |
| Descripción exacta del defecto en `src/` | Pendiente |
| Job que detecta el defecto y log de fallo | Pendiente |
| Explicación de por qué bloquea la integración | Pendiente |

## Parte 3 — Optimización y análisis del pipeline

**Estado: parcialmente documentado; optimización pendiente.** La ejecución final ofrece una línea base para analizar duración y carga, pero no se ha registrado una modificación de optimización ni una ejecución posterior que demuestre el ahorro.

### Línea base de duración por job

| Job | Duración mostrada en el run |
|---|---:|
| `unit` | 13 s |
| `integration` | 12 s |
| `sast` | 17 s |
| `sca` | 24 s |
| `build-push` | 39 s |
| `deploy` | 24 s |
| `smoke` | 13 s |
| `e2e` | 43 s |
| `load` | 12 min 14 s |
| **Suma de duraciones** | **15 min 59 s** |

**Nota:** la suma de duraciones (15 min 59 s) no equivale a la duración total del workflow (14 min 04 s), porque algunos jobs se ejecutan en paralelo. La suma es el valor relevante cuando el presupuesto del enunciado se define como acumulación de duraciones por job. Debe contrastarse con el límite exacto asignado al equipo.

### SLO, SLA, DORA y SAST

- **SLO observado:** p95 de latencia menor que 500 ms; resultado 86,84 ms, conforme en esta ejecución.
- **SLA:** no es posible declarar cumplimiento contractual con una sola prueba de 12 minutos. Haría falta definir periodo de observación, disponibilidad y consecuencias del incumplimiento.
- **DORA:** el pipeline aporta evidencia de automatización, pero un único run no permite calcular de forma fiable frecuencia de despliegue, lead time de cambios, tasa de fallos de cambios ni tiempo de recuperación.
- **SAST:** `semgrep` ejecuta análisis estático de `src/` con severidad ERROR y `--error`, por lo que los hallazgos ERROR bloquean el pipeline. La decisión de mantenerlo bloqueante responde al riesgo de desplegar vulnerabilidades detectadas.
- **SCA:** Trivy analiza dependencias con umbral HIGH/CRITICAL y código de salida 1; por tanto, esos hallazgos son bloqueantes.
- **Escaneo de imagen:** los 219 hallazgos HIGH/CRITICAL son informativos por la regla del caso y no bloquean `build-push`.
- **Optimización pendiente:** seleccionar una modificación permitida, medir una nueva ejecución y comparar la suma de duraciones; mantener `load` en todos los pushes a `main` y una fase de carga constante de al menos cuatro minutos.

## Declaración de uso de inteligencia artificial

Se utilizó **ChatGPT (OpenAI)** como apoyo para interpretar el enunciado, analizar la configuración del pipeline, proponer cambios en pruebas y workflow, revisar logs y redactar este documento. Las modificaciones se realizaron en el repositorio GitHub y las verificaciones se sustentan en ejecuciones observadas de GitHub Actions. Las decisiones y la validación final de la entrega corresponden al estudiante.

---

**Advertencia de integridad de la entrega:** Este archivo documenta de manera completa la evidencia disponible de la **Parte 1** y prepara las secciones restantes. No debe presentarse como evidencia de ejecución de las Partes 2 y 3 hasta completarlas. Además, cinco commits no garantizan por sí solos que se hayan identificado exactamente los cinco defectos sembrados originalmente.
