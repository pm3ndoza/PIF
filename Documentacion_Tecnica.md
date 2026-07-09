# Documentación Técnica
## Smart Invoice Processor

**Versión:** 2.0

---

# 1. Objetivo

Este documento describe el funcionamiento interno de la aplicación y sirve como guía para cualquier desarrollador que necesite mantener, extender o modificar el proyecto.

No pretende explicar Google Apps Script ni Google Sheets; se centra en cómo fue diseñado este sistema.

---

# 2. Arquitectura lógica

```text
Facturas_no_procesadas
          │
          ▼
procesarFacturas()
          │
          ▼
extraerGastoConGemini_()
          │
          ▼
JSON estructurado
          │
          ▼
validarGasto_()
          │
          ▼
construirIdGasto_()
          │
          ▼
existeIdEnLogs_()
          │
          ▼
Google Sheets
 ├── gastos <mes año>
 ├── logs carga
 ├── errores
 └── ejecuciones
```

---

# 3. Filosofía del diseño

Durante el desarrollo se tomaron algunas decisiones importantes:

- La IA nunca debe inventar información.
- Es preferible un campo vacío a un dato incorrecto.
- La lógica de negocio debe estar en Apps Script, no en Gemini.
- La hoja de gastos contiene únicamente información de negocio.
- Las hojas de logs contienen información técnica.
- Las facturas procesadas se archivan para evitar reprocesamientos.

---

# 4. CONFIG

## Responsabilidad

Centralizar toda la configuración de la aplicación.

## Contiene

- Nombres de carpetas.
- Estado por defecto.
- Nombre de hojas.
- Encabezados.

## Modificaciones habituales

Si cambia el nombre de una carpeta de Drive o una hoja de cálculo, únicamente debe modificarse CONFIG.

No es recomendable escribir estos nombres directamente dentro del código.

---

# 5. procesarFacturas()

## Responsabilidad

Es la función principal del sistema.

Orquesta todo el flujo de procesamiento.

## Parámetros

No recibe parámetros.

## Retorno

No devuelve información.

Su responsabilidad es producir efectos:

- Leer imágenes.
- Crear registros.
- Escribir hojas.
- Mover archivos.

## Flujo interno

1. Obtiene las carpetas de Drive.
2. Verifica si existen archivos pendientes.
3. Registra la ejecución si no hay trabajo.
4. Recorre cada imagen.
5. Envía la imagen a Gemini.
6. Valida la respuesta.
7. Genera un ID único.
8. Verifica duplicados.
9. Inserta el gasto.
10. Registra logs.
11. Mueve la imagen.
12. Registra el resumen de la ejecución.

## Dependencias

- extraerGastoConGemini_()
- validarGasto_()
- construirIdGasto_()
- existeIdEnLogs_()
- getOrCreateSheet_()
- obtenerEstadoCuenta_()
- normalizarMonto_()

## Posibles errores

- Carpeta inexistente.
- API Key inválida.
- Error de Gemini.
- JSON inválido.
- Error de escritura en Sheets.

## Cómo modificarla

Toda nueva funcionalidad del pipeline debería incorporarse aquí.

Ejemplo:

Agregar envío de información a Notion.

---

# 6. extraerGastoConGemini_()

## Responsabilidad

Enviar la imagen directamente a Gemini Vision y obtener un JSON estructurado.

## Parámetros

file (Drive File)

## Retorno

Objeto JavaScript con la información de la factura.

## Flujo

1. Obtiene la API Key.
2. Convierte la imagen en Base64.
3. Construye el Prompt.
4. Llama a Gemini.
5. Interpreta la respuesta.
6. Convierte el JSON a objeto.

## Dependencias

- UrlFetchApp
- PropertiesService
- Utilities

## Posibles errores

- API Key inexistente.
- Timeout.
- Error HTTP.
- JSON mal formado.

## Cómo modificarla

Si se desea utilizar otro modelo de Gemini, únicamente debe modificarse la URL del endpoint y, si corresponde, el payload.

---

# 7. El Prompt

El prompt forma parte de la lógica del sistema.

No debe considerarse un simple texto.

## ¿Por qué "No inventes datos"?

Porque los gastos representan información financiera.

Un dato incorrecto es más peligroso que un dato faltante.

## ¿Por qué devolver JSON?

Porque elimina la necesidad de interpretar lenguaje natural.

Apps Script únicamente convierte el JSON en un objeto.

## ¿Por qué dejar campos vacíos?

Porque permite que el usuario revise únicamente los casos ambiguos.

Evita registrar información falsa.

## ¿Por qué temperatura = 0?

Para maximizar la consistencia y reducir respuestas variables.

---

# 8. validarGasto_()

## Responsabilidad

Verificar que existan los datos mínimos necesarios.

## Campos obligatorios

- Objeto
- Monto
- Fecha
- Centro de Costo

## Resultado

Devuelve:

- ✅ Correcto
- ⚠ Revisar

## Cómo extenderla

Agregar nuevas reglas de validación sin modificar el resto del sistema.

---

# 9. construirIdGasto_()

## Responsabilidad

Generar un identificador único y determinístico.

## Datos utilizados

- Comercio
- Fecha
- Monto
- Detalle

## ¿Por qué SHA-256?

Porque genera un identificador estable.

La misma factura siempre genera el mismo ID.

## Objetivo

Evitar duplicados incluso si la misma imagen se carga desde dispositivos diferentes.

---

# 10. normalizarMonto_()

## Responsabilidad

Convertir el monto recibido por Gemini en un número compatible con Google Sheets.

Elimina:

- Símbolos
- Monedas
- Caracteres innecesarios

---

# 11. obtenerEstadoCuenta_()

## Responsabilidad

Construir automáticamente la etiqueta:

"mes año"

Ejemplo:

julio 2026

La aplicación no depende de Gemini para este dato.

---

# 12. getFolderByName_()

## Responsabilidad

Buscar una carpeta por nombre.

## Error esperado

Si la carpeta no existe se lanza una excepción para detener el proceso.

---

# 13. Logs

## gastos <mes año>

Información de negocio.

## logs carga

Auditoría.

Permite conocer:

- Qué imagen se procesó.
- Qué ID recibió.
- Qué validación obtuvo.
- En qué hoja quedó.

## errores

Errores técnicos.

## ejecuciones

Historial de ejecución del proceso programado.

---

# 14. Cómo agregar un nuevo campo

Ejemplo: agregar "Moneda".

Debe modificarse:

1. Prompt de Gemini.
2. CONFIG (encabezados).
3. extraerGastoConGemini_().
4. appendRow() correspondiente.
5. Exportación a Notion (si aplica).

Modificar un único punto no es suficiente.

---

# 15. Mantenimiento recomendado

Antes de cambiar código:

1. Revisar este documento.
2. Comprender el flujo completo.
3. Mantener la separación entre lógica de negocio y lógica técnica.
4. Evitar mover responsabilidades al prompt si pueden resolverse en Apps Script.

---

# 16. Resumen

El proyecto se diseñó siguiendo cuatro principios:

- Simplicidad.
- Trazabilidad.
- Repetibilidad.
- Seguridad de los datos.

La IA interpreta documentos.

Apps Script implementa la lógica de negocio.

Google Sheets almacena la información.

Notion consume el resultado final.
