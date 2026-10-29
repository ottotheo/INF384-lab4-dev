# INF384 — Laboratorio 4: Resolución y evidencias

**Fecha:** 29 de octubre de 2026  
**Proyecto:** Monedero Andino  
**Repositorio:** [ottotheo/INF384-lab4-dev](https://github.com/ottotheo/INF384-lab4-dev)  
**Rama principal:** `main`  
**Workflow:** `.github/workflows/ci.yml`

## Resumen ejecutivo

Se desarrollaron las tres partes del laboratorio:

1. Diagnóstico y corrección de cinco problemas relacionados con el pipeline y sus pruebas.
2. Verificación de un pipeline exitoso y demostración de detección de un defecto funcional mediante un Pull Request.
3. Optimización del pipeline bajo una restricción de tiempo, definición de un SLO de latencia y análisis de riesgos mediante una métrica DORA.

### Resultados principales

| Indicador | Resultado |
|---|---|
| Cambios independientes en la Parte 1 | 5 commits |
| Pipeline de referencia | Run #6 — Success |
| Defecto intencional detectado | Error en el cálculo del saldo |
| Job que detectó el defecto | `unit` |
| Pipeline optimizado | Run #9 — Success |
| Duración acumulada inicial | 14 min 59 s |
| Duración acumulada final | 7 min 09 s |
| Reducción observada | 7 min 50 s (52,3 %) |
| SLO configurado | p95 menor a 150 ms |
| p95 observado en el run final | 54,76 ms |
| Decisión sobre SAST | Mantenerlo bloqueante en `pre-build` |

> **Alcance y limitaciones:** Los cinco cambios de la Parte 1 están implementados y documentados, pero no se ha confirmado que correspondan exactamente a los cinco defectos introducidos intencionalmente en el repositorio original. Los cambios 3, 4 y 5 son mejoras verificadas de las pruebas, con limitaciones específicas que se detallan más adelante.
>
> Para la Parte 3 se utilizó un presupuesto **provisional de ocho minutos** y la métrica DORA **Change Failure Rate (CFR)** como supuestos de trabajo, sin considerarlos valores asignados oficialmente.

---

# Parte 1 — Diagnóstico y corrección de problemas

## 1.1. Smoke test sin dependencia del despliegue

**Job:** `smoke`  
**Etapa:** Post-deploy  
**Clasificación:** Corrección de dependencia entre jobs.

### Problema identificado

El job `smoke` tenía como dependencia:

```yaml
needs: build-push
```

Esta configuración permitía que la verificación de la aplicación comenzara después de construir la imagen, pero antes de que el job `deploy` terminara de actualizar el servicio.

Por tanto, el smoke test podía ejecutarse contra una versión anterior de la aplicación y producir un resultado aparentemente satisfactorio.

### Corrección implementada

Se modificó la dependencia del job:

```yaml
needs: deploy
```

De esta manera, el smoke test solamente puede comenzar después de finalizar correctamente el despliegue.

### Evidencia

- **Commit:** [`2a361642ee5e0fdb70ba7b9b570bff7aa1693b60`](https://github.com/ottotheo/INF384-lab4-dev/commit/2a361642ee5e0fdb70ba7b9b570bff7aa1693b60)
- **Resultado:** Ejecución satisfactoria.
- **Secuencia verificada:** `build-push → deploy → smoke`.

**Conclusión:** Se corrigió un problema de orden de ejecución que podía generar falsos positivos al validar una versión desactualizada.

## 1.2. Smoke test sin verificación del commit desplegado

**Job:** `smoke`  
**Etapa:** Post-deploy  
**Clasificación:** Corrección de configuración.

### Problema identificado

El script `test/smoke/smoke.sh` permitía comprobar si el commit de la aplicación desplegada coincidía con el commit del pipeline mediante la variable `EXPECTED_COMMIT`.

Sin embargo, el workflow no proporcionaba dicha variable al ejecutar el script.

Por ello, la comprobación de correspondencia entre el código construido y el código desplegado quedaba omitida.

### Corrección implementada

Se agregó la variable al entorno del paso de smoke test:

```yaml
env:
  EXPECTED_COMMIT: ${{ github.sha }}
```

### Evidencia

- **Commit:** [`99b733ed893d6a9baa38c86fecf79b08df45764c`](https://github.com/ottotheo/INF384-lab4-dev/commit/99b733ed893d6a9baa38c86fecf79b08df45764c)
- **Resultado:** La verificación mostró el mismo SHA en el endpoint `/salud` y en el commit esperado.
- **Comprobación adicional:** Consulta de saldo satisfactoria.

**Conclusión:** El smoke test pasó de verificar únicamente la disponibilidad de la aplicación a comprobar también la identidad de la versión desplegada.

## 1.3. Dependencia del orden en las pruebas de integración

**Job:** `integration`  
**Etapa:** Pre-build  
**Archivo:** `test/integration/transferir.test.js`  
**Clasificación:** Modificación de pruebas.

### Problema identificado

Existían doce pruebas de integración que compartían estado y dependían de la secuencia de ejecución.

Esta organización dificultaba identificar la causa de los fallos y podía generar resultados sensibles al orden de ejecución.

### Corrección implementada

Se reorganizaron los escenarios en cinco pruebas, agrupando las comprobaciones relacionadas.

### Evidencia

- **Commit:** [`799ff5c814644c4edce23ac6c8cd8d8deb35ef48`](https://github.com/ottotheo/INF384-lab4-dev/commit/799ff5c814644c4edce23ac6c8cd8d8deb35ef48)

Resultado observado:

```text
# tests 5
# pass 5
# fail 0
```

### Limitación

La agrupación mejora la organización de las pruebas, pero no garantiza su independencia.

Para resolver completamente la dependencia del estado sería necesario asegurar que cada escenario disponga de datos iniciales controlados, mediante reinicialización de la base de datos, fixtures aislados u otro mecanismo equivalente.

**Conclusión:** Se mejoró la estructura y legibilidad de las pruebas, aunque el aislamiento completo del estado sigue siendo una oportunidad de mejora.

## 1.4. Validación incompleta del saldo resultante en E2E

**Job:** `e2e`  
**Etapa:** Post-deploy  
**Clasificación:** Modificación de pruebas.

### Problema identificado

La prueba de transferencia comprobaba la respuesta HTTP 200, los participantes, el monto y el identificador de la operación.

Sin embargo, no validaba el campo `saldoOrigen` devuelto por el servicio.

Por tanto, una respuesta con un saldo ausente, no numérico o inválido podía superar las verificaciones existentes.

### Corrección implementada

Se incorporaron aserciones para comprobar que `saldoOrigen` fuera:

- Numérico.
- Finito.
- Mayor o igual a cero.

### Evidencia

- **Commit:** [`9cf7abd7fe82a7fa82e2df21cdb3d4b0fa0d31e7`](https://github.com/ottotheo/INF384-lab4-dev/commit/9cf7abd7fe82a7fa82e2df21cdb3d4b0fa0d31e7)

Resultado observado:

```text
10 passed (4.4s)
```

### Limitación

La prueba comprueba el formato y rango del saldo, pero no demuestra que el descuento realizado sea matemáticamente correcto.

Además, una consulta independiente del saldo puede no observar el mismo estado si las solicitudes llegan a instancias Lambda con bases SQLite independientes.

**Conclusión:** Se fortaleció la validación de la respuesta, aunque permanece pendiente una verificación funcional más estricta del cálculo del saldo.

## 1.5. Clasificación insuficiente de respuestas HTTP en la prueba de carga

**Job:** `load`  
**Etapa:** Post-deploy  
**Archivo:** `test/load/transferir.js`  
**Clasificación:** Modificación de pruebas y observabilidad.

### Problema identificado

La prueba de carga aceptaba respuestas HTTP 200 y 400 mediante:

```javascript
http.setResponseCallback(http.expectedStatuses(200, 400));
```

Sin una comprobación adicional, un HTTP 400 producido por un error inesperado podía considerarse equivalente a un rechazo de negocio legítimo.

### Corrección implementada

Se incorporaron contadores personalizados:

```javascript
const transferenciasExitosas =
  new Counter('transferencias_exitosas');

const transferenciasRechazadas =
  new Counter('transferencias_rechazadas');

const respuestasInesperadas =
  new Counter('respuestas_inesperadas');
```

La clasificación aplicada fue:

- HTTP 200: transferencia exitosa.
- HTTP 400 con `error: "saldo insuficiente"`: rechazo esperado.
- Cualquier otra respuesta: respuesta inesperada.

El check funcional también fue actualizado para aceptar únicamente las dos primeras situaciones.

### Evidencia

- **Commit:** [`87b8d61ab3d8e3b1b2903c1ffc8408bb0847fb0f`](https://github.com/ottotheo/INF384-lab4-dev/commit/87b8d61ab3d8e3b1b2903c1ffc8408bb0847fb0f)
- **Run:** [GitHub Actions #6](https://github.com/ottotheo/INF384-lab4-dev/actions/runs/40912168861)

Resultados observados:

| Métrica | Valor |
|---|---:|
| Transferencias exitosas | 17 112 |
| Solicitudes HTTP | 34 224 |
| Checks exitosos | 100 % |
| `http_req_failed` | 0 % |
| Latencia p95 | 86,84 ms |

### Limitación

La configuración de `http.expectedStatuses(200, 400)` se conservó.

Por ello, la métrica `http_req_failed` continúa considerando esperado cualquier HTTP 400. La clasificación más estricta se realiza mediante los checks y los contadores personalizados.

Asimismo, los contadores con valor cero pueden no aparecer en el resumen de k6; su ausencia no constituye por sí sola una medición independiente.

**Conclusión:** Se mejoró la capacidad de distinguir resultados funcionales esperados de respuestas inesperadas, sin modificar la duración de la prueba en esta parte.

## 1.6. Verificación consolidada de la Parte 1

**Run:** [GitHub Actions #6](https://github.com/ottotheo/INF384-lab4-dev/actions/runs/40912168861)  
**Commit:** `87b8d61ab3d8e3b1b2903c1ffc8408bb0847fb0f`  
**Rama:** `main`  
**Resultado:** `Success`

Los nueve jobs terminaron correctamente:

| Job | Resultado |
|---|---|
| `unit` | Success |
| `integration` | Success |
| `sast` | Success |
| `sca` | Success |
| `build-push` | Success |
| `deploy` | Success |
| `smoke` | Success |
| `e2e` | Success |
| `load` | Success |

El tiempo transcurrido del workflow fue de **14 min 04 s**.

El escaneo Trivy de la imagen registró hallazgos HIGH/CRITICAL tratados como informativos según la política del caso. El resultado exitoso del pipeline no significa que la imagen esté libre de vulnerabilidades.

Durante esta parte no se modificaron los archivos de `src/` ni el job `deploy`.

---

# Parte 2 — Implementación y validación

## 2.1. Pipeline exitoso con los cinco cambios

Se utilizó la ejecución exitosa del run #6 como evidencia de integración de los cinco commits de la Parte 1.

- **Run:** [GitHub Actions #6](https://github.com/ottotheo/INF384-lab4-dev/actions/runs/40912168861)
- **Rama:** `main`
- **Resultado:** `Success`
- **Jobs exitosos:** 9 de 9.

Esta ejecución demuestra que los cambios incorporados no provocaron fallos en los controles del pipeline bajo los escenarios ejecutados.

## 2.2. Introducción de un defecto funcional mediante Pull Request

Se creó una rama independiente denominada `prueba-deteccion-defecto` y se abrió un Pull Request hacia `main`.

**Pull Request:** [PR #1 — Introducir defecto intencional en cálculo de saldo](https://github.com/ottotheo/INF384-lab4-dev/pull/1)  
**Commit del defecto:** `04ee40e`  
**Archivo modificado:** `src/wallet.js`

### Defecto introducido

Se alteró deliberadamente la función `saldo()` para devolver una unidad adicional al saldo real:

```javascript
return {
  usuario: encontrado.id,
  saldo: aSoles(encontrado.saldo) + 1
};
```

El cambio constituye un defecto funcional porque modifica el resultado esperado del cálculo del saldo sin alterar los datos almacenados.

### Resultado del pipeline

El job `unit`, ejecutado en la etapa `pre-build`, detectó el defecto.

Fragmento relevante del log:

```text
not ok 16 - saldo devuelve el saldo en soles

Actual:   1501.5
Expected: 1500.5

# tests 28
# pass 27
# fail 1

Error: Process completed with exit code 1.
```

El pipeline no obtuvo un resultado exitoso porque la prueba unitaria detectó la discrepancia entre el saldo calculado y el saldo esperado.

### Interpretación

La detección confirma que el control unitario puede identificar un error funcional antes de que el cambio avance hacia el despliegue.

La ejecución también registró una cobertura del 100 % en líneas y ramas. Esto no implica ausencia de defectos: la cobertura indica qué código se ejecutó, mientras que las aserciones determinan si el comportamiento observado es correcto.

### Estado del Pull Request

El PR #1 se mantuvo abierto y **no fue fusionado** con `main`.

**Conclusión:** Se demostró la capacidad del pipeline para detectar un defecto funcional introducido deliberadamente, manteniendo intacta la rama principal.

---

# Parte 3 — Decisión bajo restricción

## 3.1. Contexto y restricciones

Para desarrollar el ejercicio se utilizaron los siguientes supuestos:

| Parámetro | Valor |
|---|---|
| Presupuesto acumulado de jobs | 8 minutos |
| Métrica DORA | Change Failure Rate (CFR) |
| SLO inicial configurado | p95 menor a 500 ms |
| Duración inicial de carga | 12 minutos |
| Duración mínima de carga constante | 4 minutos |

**Nota:** El presupuesto y la métrica DORA son supuestos provisionales utilizados para resolver el caso.

Se respetaron las siguientes restricciones técnicas:

- No modificar el job `deploy`.
- Mantener la ejecución de `load` en cada pipeline de `main`.
- Conservar al menos cuatro minutos de carga constante.
- Configurar el umbral del SLO mediante `SLO_P95` en `ci.yml`.
- Evaluar la duración como suma de los tiempos individuales de todos los jobs.

## 3.2. Línea base del pipeline

Se utilizó el [run #6](https://github.com/ottotheo/INF384-lab4-dev/actions/runs/40912168861) como referencia inicial.

| Job | Duración |
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
| **Total acumulado** | **14 min 59 s** |

La suma fue de **899 segundos**, superando el presupuesto provisional de 480 segundos en 419 segundos (6 min 59 s).

La duración transcurrida del workflow fue de 14 min 04 s, pero no se utilizó como medida presupuestaria porque algunos jobs se ejecutan en paralelo.

### Diagnóstico

El job `load` representaba aproximadamente el **81,6 %** de la duración acumulada inicial.

Por ello, era el principal candidato para una optimización con impacto significativo sobre el presupuesto.

## 3.3. Métricas iniciales de rendimiento

La prueba de carga inicial tuvo una duración configurada de doce minutos, con treinta usuarios virtuales como objetivo de carga constante.

| Métrica | Resultado |
|---|---:|
| Solicitudes HTTP | 34 224 |
| Transferencias exitosas | 17 112 |
| Latencia promedio | 79,3 ms |
| Latencia p90 | 83,97 ms |
| Latencia p95 | 86,84 ms |
| Latencia máxima | 492,78 ms |
| Rendimiento | 47,53 req/s |
| `http_req_failed` | 0 % |
| Checks exitosos | 100 % |
| Usuarios virtuales máximos | 30 |

La latencia p95 cumplía ampliamente el umbral original de 500 ms.

Sin embargo, mantener una prueba de doce minutos en cada ejecución impedía satisfacer el presupuesto propuesto.

## 3.4. Optimización de la prueba de carga

Se modificó `test/load/transferir.js`.

### Configuración original

```javascript
stages: [
  { duration: '1m', target: 30 },
  { duration: '10m', target: 30 },
  { duration: '1m', target: 0 },
],
```

### Configuración optimizada

```javascript
stages: [
  { duration: '30s', target: 30 },
  { duration: '4m', target: 30 },
  { duration: '30s', target: 0 },
],
```

### Justificación

La modificación redujo la duración nominal de la prueba de doce a cinco minutos:

- 30 segundos de incremento progresivo de carga.
- 4 minutos de carga constante con 30 usuarios virtuales.
- 30 segundos de reducción progresiva de carga.

Se mantuvo la cantidad máxima de usuarios virtuales y el periodo mínimo de carga constante.

La reducción afecta principalmente a la capacidad de detectar degradaciones que requieren más tiempo para manifestarse.

## 3.5. Definición y configuración del SLO

Se estableció el siguiente objetivo técnico:

**SLO:** El percentil 95 de la latencia HTTP debe ser inferior a 150 ms durante cada ejecución de cinco minutos de la prueba de carga en CI.

| Elemento | Definición |
|---|---|
| Indicador | `http_req_duration` |
| Percentil | p95 |
| Umbral | Menor a 150 ms |
| Ventana | Cada ejecución de carga de 5 minutos |
| Configuración | `SLO_P95: 150` |

### Configuración en el workflow

En `.github/workflows/ci.yml`:

```yaml
SLO_P95: 150
```

El script k6 utiliza esta variable para configurar el umbral:

```javascript
thresholds: {
  http_req_duration: [`p(95)<${SLO_P95}`],
  http_req_failed: ['rate<0.01'],
  checks: ['rate>0.99'],
},
```

### Justificación del umbral

El p95 inicial fue de 86,84 ms. Se eligió un umbral de 150 ms para mantener un margen frente a la variabilidad de ejecución sin conservar un límite tan permisivo como los 500 ms originales.

El objetivo se aplica al escenario de carga configurado en CI y no constituye por sí solo una garantía de rendimiento mensual en producción.

## 3.6. Resultados finales de la optimización

La ejecución final fue el **run #9**, que terminó con los nueve jobs exitosos.

**Commit:** `cfa285b`  
**Resultado:** `Success`  
**Tiempo transcurrido del workflow:** 6 min 58 s.

### Comparación de duraciones

| Job | Run #6 | Run #9 | Variación |
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

### Evaluación del presupuesto

| Indicador | Valor |
|---|---:|
| Presupuesto provisional | 8 min |
| Duración inicial | 14 min 59 s |
| Duración final | 7 min 09 s |
| Reducción observada | 7 min 50 s |
| Reducción porcentual | 52,3 % |
| Margen final disponible | 51 s |

La optimización cumplió el presupuesto provisional.

El principal ahorro se obtuvo al reducir la duración del job `load`, de 12 min 14 s a 5 min 09 s.

Las variaciones en los demás jobs corresponden a diferencias observadas entre ejecuciones. No se consideran optimizaciones adicionales atribuibles al cambio implementado.

## 3.7. Validación final del SLO

El run #9 produjo los siguientes resultados de k6:

| Métrica | Resultado |
|---|---:|
| Solicitudes HTTP | 14 872 |
| Transferencias exitosas | 7 436 |
| Latencia promedio | 46,42 ms |
| Latencia p90 | 52,57 ms |
| Latencia p95 | 54,76 ms |
| Latencia máxima | 470,42 ms |
| Rendimiento | 49,41 req/s |
| `http_req_failed` | 0 % |
| Checks exitosos | 100 % |
| Usuarios virtuales máximos | 30 |

### Evaluación

```text
SLO configurado:  p95 < 150 ms
p95 observado:    54,76 ms
Margen:           95,24 ms
Resultado:        CUMPLIDO
```

La latencia máxima de 470,42 ms no contradice el cumplimiento del SLO, porque el objetivo se define sobre el percentil 95 y no sobre el máximo de todas las solicitudes.

También se cumplieron los umbrales de checks exitosos y tasa de errores configurados en k6.

**Conclusión:** El pipeline optimizado cumplió el presupuesto provisional y el SLO de latencia bajo el escenario evaluado.

## 3.8. Propuesta de SLA

Se propone el siguiente compromiso de servicio:

**SLA:** El percentil 95 de la latencia HTTP será inferior a 300 ms, evaluado mensualmente para las solicitudes de los clientes de Monedero Andino, bajo condiciones contractuales de medición y exclusiones previamente definidas.

### Diferencia entre SLO y SLA

| Aspecto | SLO | SLA |
|---|---|---|
| Propósito | Objetivo técnico interno | Compromiso con el cliente |
| Latencia p95 | Menor a 150 ms | Menor a 300 ms |
| Ventana | Cada prueba de CI de 5 min | Mensual |
| Consecuencia | Fallo del control de calidad | Consecuencias contractuales definidas |
| Ámbito | Escenario de carga del pipeline | Servicio ofrecido al cliente |

El SLO es más exigente para facilitar la detección temprana de degradaciones.

El SLA propuesto mantiene un margen operativo para absorber variaciones de infraestructura y tráfico.

La propuesta requeriría mediciones de producción y condiciones contractuales completas antes de convertirse en una garantía real.

## 3.9. Riesgo aceptado y efecto sobre DORA

### Riesgo identificado

La reducción de la prueba de carga disminuye la ventana de observación del comportamiento sostenido.

Un defecto que podría pasar inadvertido es una degradación progresiva del endpoint `/transferir`, causada, por ejemplo, por acumulación de conexiones, consumo creciente de memoria o recursos no liberados.

Este problema podría manifestarse después de varios minutos de carga constante.

La prueba optimizada podría finalizar correctamente antes de que la degradación se vuelva significativa.

### Relación con Change Failure Rate

La métrica **Change Failure Rate (CFR)** representa la proporción de despliegues que provocan fallos en producción y requieren intervención correctiva.

Si una degradación no detectada llega a producción y ocasiona una intervención correctiva, el CFR podría aumentar.

**Dirección del riesgo:** Potencial aumento del CFR.

No se dispone de mediciones históricas de despliegues fallidos para afirmar que el CFR haya aumentado efectivamente.

### Justificación de la decisión

Se aceptó el riesgo porque la optimización:

- Mantiene cuatro minutos de carga constante.
- Conserva treinta usuarios virtuales como carga objetivo.
- Mantiene los checks funcionales y los umbrales de k6.
- Permite cumplir el presupuesto provisional.
- No elimina las pruebas unitarias, de integración, E2E ni smoke.

El compromiso consiste en reducir el tiempo de observación, no en eliminar completamente la verificación de rendimiento.

## 3.10. Decisión sobre SAST

**Decisión:** Mantener el job `sast` en `pre-build`, con comportamiento bloqueante.

### Justificación

El job utiliza Semgrep para analizar el código fuente antes de la construcción y despliegue.

Su configuración bloqueante permite detener el pipeline ante hallazgos de la severidad configurada.

En el run #9, `sast` consumió **23 segundos**.

Se ejecuta en paralelo con `unit`, `integration` y `sca`, por lo que su duración individual no se traduce necesariamente en el mismo incremento del tiempo transcurrido del workflow.

### Alternativas consideradas

| Alternativa | Ventaja | Riesgo o desventaja |
|---|---|---|
| Mantener SAST bloqueante en pre-build | Detección temprana | Conserva su costo temporal |
| Mover SAST después del despliegue | Podría adelantar otras etapas | Detectaría problemas demasiado tarde |
| Convertir SAST en informativo | Evitaría bloqueos por hallazgos | Permitiría avanzar cambios con problemas detectados |

### Efecto sobre el presupuesto

Se mantiene el costo observado de 23 segundos.

No se atribuye ahorro de tiempo a SAST porque su configuración no fue modificada.

### Efecto sobre CFR

Mantener SAST bloqueante contribuye a prevenir el despliegue de cambios con problemas de seguridad detectables por la herramienta.

Convertirlo en informativo podría aumentar el riesgo de desplegar cambios problemáticos y, en ciertos escenarios, incrementar el CFR.

No existe evidencia suficiente para cuantificar una variación real de esa métrica.

**Conclusión:** Se mantiene SAST como control preventivo, priorizando la detección temprana frente a un ahorro temporal limitado.

---

# Conclusiones generales

1. **Dependencias del pipeline:** La relación entre `build-push`, `deploy` y `smoke` debe representar correctamente el orden requerido para evitar verificaciones sobre versiones anteriores.

2. **Identidad del despliegue:** Un smoke test debe comprobar no solamente que el servicio responde, sino también que corresponde a la versión esperada.

3. **Calidad de las pruebas:** Una ejecución exitosa no demuestra por sí sola independencia entre pruebas ni cobertura completa de los comportamientos funcionales.

4. **Detección temprana:** El Pull Request con un error intencional en el cálculo del saldo demostró la utilidad del job `unit` como control previo al despliegue.

5. **Optimización basada en mediciones:** La revisión de las duraciones individuales permitió identificar a `load` como el principal consumidor de tiempo y reducir la duración acumulada del pipeline en 52,3 %.

6. **Objetivos verificables:** La definición de un SLO cuantificable, configurado en `ci.yml` y evaluado mediante k6, permitió comprobar el rendimiento de forma automatizada.

7. **Gestión del riesgo:** Reducir la duración de una prueba puede mejorar la eficiencia del pipeline, pero también disminuir su capacidad de detectar defectos que se manifiestan después de periodos prolongados.

8. **Seguridad:** Mantener SAST bloqueante antes del despliegue preserva un control preventivo cuyo costo observado es reducido en relación con el tiempo total del pipeline.

## Limitaciones y trabajo pendiente

- Confirmar si los cinco cambios de la Parte 1 corresponden exactamente a los cinco defectos intencionales del repositorio original.
- Mejorar el aislamiento del estado de las pruebas de integración.
- Incorporar una aserción E2E que verifique el saldo resultante exacto, siempre que exista una forma fiable de controlar el estado inicial.
- Revisar la clasificación de respuestas HTTP 400 en `http_req_failed` para alinearla con los rechazos funcionales esperados.
- Evaluar pruebas de carga prolongadas fuera del pipeline principal para detectar degradaciones que se manifiestan después de varios minutos.
- Revisar los hallazgos de seguridad de la imagen registrados por Trivy.

---

# Declaración de uso de inteligencia artificial generativa

Se utilizó **ChatGPT (OpenAI)** como herramienta de apoyo durante la resolución del laboratorio.

Su participación comprendió:

- Interpretación de los requisitos del ejercicio.
- Análisis de la configuración del pipeline.
- Revisión de pruebas y logs de GitHub Actions.
- Propuesta de modificaciones en el workflow y los scripts de prueba.
- Interpretación de métricas de k6.
- Cálculo y comparación de duraciones.
- Discusión de riesgos asociados a la optimización.
- Organización y redacción de la documentación.

Las modificaciones se aplicaron en el repositorio y los resultados se contrastaron con las ejecuciones observadas en GitHub Actions.

Las conclusiones distinguen los resultados comprobados de los supuestos y riesgos potenciales.

---

**Estado de la resolución:** Tres partes desarrolladas, con ejecución final exitosa y limitaciones técnicas documentadas.
