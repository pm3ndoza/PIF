# Manual de Usuario
## Smart Invoice Processor

**Versión:** 2.0

---

# 1. Introducción

Smart Invoice Processor es una aplicación desarrollada en **Google Apps Script** que automatiza el registro de gastos a partir de fotografías de facturas.

La aplicación utiliza **Google Gemini Vision** para interpretar el contenido de la imagen y generar un registro estructurado listo para ser exportado a Notion.

El objetivo es reducir el trabajo manual y mantener un historial organizado de todos los gastos.

---

# 2. Requisitos

Antes de utilizar la aplicación es necesario contar con:

- Una cuenta de Google.
- Un Google Spreadsheet.
- Dos carpetas en Google Drive:
  - `Facturas_no_procesadas`
  - `Facturas_Procesadas`
- Una API Key de Google Gemini.
- El proyecto de Google Apps Script configurado.

---

# 3. Primer uso

1. Crear las carpetas en Google Drive.
2. Configurar la API Key mediante `setGeminiKey()`.
3. Configurar el Trigger diario de Apps Script.
4. Verificar que las carpetas tengan exactamente los nombres definidos en `CONFIG`.

---

# 4. Flujo de trabajo

## Paso 1 – Tomar la fotografía

Tomar una fotografía legible de la factura.

Recomendaciones:

- Buena iluminación.
- Toda la factura dentro de la imagen.
- Evitar sombras.
- Evitar fotografías borrosas.

La aplicación acepta formatos comunes como JPG, PNG y HEIC.

---

## Paso 2 – Subir la imagen

Mover la fotografía a la carpeta:

`Facturas_no_procesadas`

No es necesario renombrar el archivo.

---

## Paso 3 – Procesamiento

La aplicación puede ejecutarse de dos maneras:

### Manual

Desde Apps Script ejecutar:

`procesarFacturas()`

### Automática

Mediante un Trigger diario.

Durante el procesamiento la aplicación:

1. Busca nuevas facturas.
2. Envía cada imagen a Gemini Vision.
3. Extrae la información relevante.
4. Valida los datos.
5. Detecta duplicados.
6. Registra el gasto.
7. Mueve la imagen a la carpeta de procesadas.

---

# 5. Hojas creadas automáticamente

## gastos <mes año>

Ejemplo:

`gastos julio 2026`

Contiene únicamente los datos necesarios para importar a Notion.

Columnas:

- Objeto
- Monto
- Centro de Costo
- Estados de Cuenta
- Fecha de Compra
- Estado
- Detalle

Esta es la única hoja que debe exportarse como CSV.

---

## logs carga

Contiene información técnica del procesamiento.

Incluye:

- Fecha de carga
- ID único
- Nombre del archivo
- Hoja destino
- Resultado de la validación
- Link al archivo original

Esta hoja sirve para auditoría y diagnóstico.

---

## errores

Registra únicamente errores de procesamiento.

Contiene:

- Fecha
- Archivo
- Mensaje de error
- Link al archivo

Si una factura aparece aquí significa que no pudo procesarse correctamente.

---

## ejecuciones

Registra cada ejecución del sistema.

Ejemplo:

| Fecha | Estado | Procesadas | Duplicadas | Errores |
|-------|---------|------------|------------|----------|
|09/07/2026|OK|5|0|0|

Permite verificar si el Trigger se ejecutó correctamente.

---

# 6. Exportar a Notion

1. Abrir la hoja correspondiente al mes.
2. Archivo → Descargar → CSV.
3. Importar el CSV en la base de datos de Notion.

**No exportar** las hojas:

- logs carga
- errores
- ejecuciones

---

# 7. Resolución de problemas

## No aparecen gastos

Verificar:

- Que la factura esté en `Facturas_no_procesadas`.
- Que el Trigger se haya ejecutado.
- Que exista conexión con Gemini.

---

## La factura no tiene monto

Buscar el registro en:

`logs carga`

Si la validación indica:

`⚠ Revisar`

Abrir el enlace al archivo y verificar la imagen.

---

## La factura no se procesa

Revisar la hoja:

`errores`

Allí se encuentra el detalle del problema.

---

## La factura desapareció

Una vez procesada correctamente, la imagen se mueve automáticamente a:

`Facturas_Procesadas`

---

# 8. Buenas prácticas

- Mantener una fotografía por archivo.
- No modificar manualmente las hojas de logs.
- Exportar únicamente las hojas mensuales.
- Revisar periódicamente la hoja de errores.
- Confirmar que el Trigger diario permanezca habilitado.

---

# 9. Preguntas frecuentes

## ¿La aplicación modifica la factura?

No.

Únicamente lee la imagen.

## ¿Qué ocurre si subo dos veces la misma factura?

El sistema calcula un identificador único (SHA-256) y evita registrar duplicados.

## ¿Qué ocurre si Gemini no reconoce un dato?

La aplicación prioriza dejar el campo vacío antes que inventar información.

## ¿Puedo corregir un gasto?

Sí. El registro puede editarse manualmente en Google Sheets antes de exportarlo a Notion.

---

# 10. Soporte y mantenimiento

Ante cualquier comportamiento inesperado se recomienda revisar, en este orden:

1. Hoja `ejecuciones`.
2. Hoja `errores`.
3. Hoja `logs carga`.

Estas tres hojas contienen toda la información necesaria para diagnosticar el funcionamiento del sistema.
