const CONFIG = {
  FOLDER_NO_PROCESADAS: 'Facturas_no_procesadas',
  FOLDER_PROCESADAS: 'Facturas_Procesadas',
  ESTADO_DEFAULT: 'Comprado',
  LOG_SHEET_NAME: 'logs carga',
  ERROR_SHEET_NAME: 'errores',
  EXECUTION_SHEET_NAME: 'ejecuciones',

  NOTION_HEADERS: [
    'Objeto',
    'Monto',
    'Centro de Costo',
    'Estados de Cuenta',
    'Fecha de Compra',
    'Estado',
    'Detalle'
  ],

  LOG_HEADERS: [
    'Fecha carga',
    'ID',
    'Archivo',
    'Hoja destino',
    'Objeto',
    'Monto',
    'Centro de Costo',
    'Estados de Cuenta',
    'Fecha de Compra',
    'Estado',
    'Detalle',
    'Validación',
    'Link archivo'
  ],

  ERROR_HEADERS: [
    'Fecha error',
    'Archivo',
    'Error',
    'Link archivo'
  ],

  EXECUTION_HEADERS: [
    'Fecha ejecución',
    'Estado',
    'Facturas procesadas',
    'Facturas duplicadas',
    'Errores',
    'Detalle'
  ],
};

function setGeminiKey() {
  // Configurar manualmente en Script Properties:
  // GEMINI_API_KEY=<tu_api_key>
}
function procesarFacturas() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const inputFolder = getFolderByName_(CONFIG.FOLDER_NO_PROCESADAS);
  const doneFolder = getFolderByName_(CONFIG.FOLDER_PROCESADAS);

  const executionSheet = getOrCreateSheet_(
    ss,
    CONFIG.EXECUTION_SHEET_NAME,
    CONFIG.EXECUTION_HEADERS
  );

  let procesadas = 0;
  let duplicadas = 0;
  let errores = 0;
  let detalles = [];

  const files = inputFolder.getFiles();

  if (!files.hasNext()) {
    executionSheet.appendRow([
      new Date(),
      'Sin archivos',
      0,
      0,
      0,
      'No había facturas en la carpeta de entrada'
    ]);
    return;
  }

  while (files.hasNext()) {
    const file = files.next();

    try {
      const gasto = extraerGastoConGemini_(file);
      const fecha = gasto['Fecha de Compra'];
      const sheetName = obtenerNombreHojaPorFecha_(fecha);
      const id = construirIdGasto_(gasto);
      const validacion = validarGasto_(gasto);

      if (existeIdEnLogs_(ss, id)) {
        duplicadas++;
        detalles.push('Duplicada: ' + file.getName());

        doneFolder.addFile(file);
        inputFolder.removeFile(file);
        continue;
      }

      const notionSheet = getOrCreateSheet_(
        ss,
        sheetName,
        CONFIG.NOTION_HEADERS
      );

      const logSheet = getOrCreateSheet_(
        ss,
        CONFIG.LOG_SHEET_NAME,
        CONFIG.LOG_HEADERS
      );

      const filaNotion = [
        gasto.Objeto || '',
        normalizarMonto_(gasto.Monto),
        gasto['Centro de Costo'] || '',
        gasto['Estados de Cuenta'] || obtenerEstadoCuenta_(fecha),
        fecha || '',
        CONFIG.ESTADO_DEFAULT,
        gasto.Detalle || ''
      ];

      notionSheet.appendRow(filaNotion);

      logSheet.appendRow([
        new Date(),
        id,
        file.getName(),
        sheetName,
        gasto.Objeto || '',
        normalizarMonto_(gasto.Monto),
        gasto['Centro de Costo'] || '',
        gasto['Estados de Cuenta'] || obtenerEstadoCuenta_(fecha),
        fecha || '',
        CONFIG.ESTADO_DEFAULT,
        gasto.Detalle || '',
        validacion,
        file.getUrl()
      ]);

      procesadas++;

      doneFolder.addFile(file);
      inputFolder.removeFile(file);

    } catch (err) {
      errores++;
      detalles.push('Error en ' + file.getName() + ': ' + err.message);

      const errorSheet = getOrCreateSheet_(
        ss,
        CONFIG.ERROR_SHEET_NAME,
        CONFIG.ERROR_HEADERS
      );

      errorSheet.appendRow([
        new Date(),
        file.getName(),
        err.message,
        file.getUrl()
      ]);
    }
  }

  let estado = 'OK';

  if (errores > 0 && procesadas > 0) {
    estado = 'OK con errores';
  } else if (errores > 0 && procesadas === 0) {
    estado = 'Error';
  }

  executionSheet.appendRow([
    new Date(),
    estado,
    procesadas,
    duplicadas,
    errores,
    detalles.join(' | ')
  ]);
}

function extraerGastoConGemini_(file) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!apiKey) throw new Error('Falta GEMINI_API_KEY. Ejecutá setGeminiKey primero.');

  const blob = file.getBlob();
  const base64 = Utilities.base64Encode(blob.getBytes());
  const mimeType = blob.getContentType();

  const prompt = `
Analiza esta factura/ticket/recibo y genera un registro de gasto para Notion.

Devuelve SOLO JSON válido. No uses markdown. No expliques nada.

Formato exacto:
{
  "Objeto": "",
  "Monto": "",
  "Centro de Costo": "",
  "Estados de Cuenta": "",
  "Fecha de Compra": "",
  "Estado": "Comprado",
  "Detalle": ""
}

Reglas estrictas:
- No inventes datos.
- Si no estás seguro, deja el campo vacío.
- "Objeto" debe ser el comercio/proveedor, no una frase larga.
- "Monto" debe ser solo número decimal, sin moneda. Ejemplo: 649.00
- "Fecha de Compra" debe ser ISO YYYY-MM-DD.
- "Estados de Cuenta" debe ser mes y año en español. Ejemplo: julio 2026.
- "Estado" siempre debe ser "Comprado".
- "Detalle" debe resumir productos o servicios comprados.
- El monto debe ser el importe final cobrado/pagado.
- Ignora subtotal, IVA, redondeos, CAE, RUT, vencimiento y números internos.
- Si aparece EFECTIVO, VISA, Mastercard o similar, no lo uses como Estado de Cuenta.
- Centro de Costo debe ser una categoría corta, por ejemplo:
  Alimentación, Ferias, Impuestos, Plataformas, Transporte, Salud, Servicios, Hogar, Otros.
`;

  const payload = {
    contents: [
      {
        parts: [
          { text: prompt },
          {
            inline_data: {
              mime_type: mimeType,
              data: base64
            }
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0,
      responseMimeType: 'application/json'
    }
  };

  const url =
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' +
    apiKey;

  const res = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  const raw = res.getContentText();
  const body = JSON.parse(raw);

  if (!body.candidates || !body.candidates.length) {
    throw new Error('Gemini no devolvió candidates: ' + raw);
  }

  const jsonText = body.candidates[0].content.parts[0].text;
  const gasto = JSON.parse(jsonText);

  gasto.Estado = CONFIG.ESTADO_DEFAULT;

  if (!gasto['Estados de Cuenta'] && gasto['Fecha de Compra']) {
    gasto['Estados de Cuenta'] = obtenerEstadoCuenta_(gasto['Fecha de Compra']);
  }

  return gasto;
}

function getOrCreateSheet_(ss, name, headers) {
  let sheet = ss.getSheetByName(name);

  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    return sheet;
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
  }

  return sheet;
}

function obtenerNombreHojaPorFecha_(fechaIso) {
  if (!fechaIso) return 'gastos sin fecha';
  return 'gastos ' + obtenerEstadoCuenta_(fechaIso);
}

function obtenerEstadoCuenta_(fechaIso) {
  const meses = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
  ];

  const parts = String(fechaIso || '').split('-');
  if (parts.length !== 3) return '';

  const year = parts[0];
  const monthIndex = Number(parts[1]) - 1;

  if (monthIndex < 0 || monthIndex > 11) return '';

  return meses[monthIndex] + ' ' + year;
}

function normalizarMonto_(monto) {
  if (monto === null || monto === undefined) return '';

  const value = String(monto)
    .replace(/[^\d,.-]/g, '')
    .replace(',', '.');

  const number = Number(value);
  if (isNaN(number)) return '';

  return number;
}

function validarGasto_(gasto) {
  const faltantes = [];

  if (!gasto.Objeto) faltantes.push('Objeto');

  if (
    gasto.Monto === '' ||
    gasto.Monto === null ||
    gasto.Monto === undefined
  ) {
    faltantes.push('Monto');
  }

  if (!gasto['Fecha de Compra']) faltantes.push('Fecha de Compra');
  if (!gasto['Centro de Costo']) faltantes.push('Centro de Costo');

  if (faltantes.length > 0) {
    return '⚠ Revisar: falta ' + faltantes.join(', ');
  }

  return '✅ Correcto';
}

function construirIdGasto_(gasto) {
  const base = [
    limpiarId_(gasto.Objeto || ''),
    limpiarId_(gasto['Fecha de Compra'] || ''),
    limpiarId_(String(normalizarMonto_(gasto.Monto) || '')),
    limpiarId_(gasto.Detalle || '')
  ].join('|');

  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    base
  );

  return digest
    .map(function(byte) {
      return ('0' + (byte & 0xff).toString(16)).slice(-2);
    })
    .join('')
    .substring(0, 16);
}

function existeIdEnLogs_(ss, id) {
  const sheet = ss.getSheetByName(CONFIG.LOG_SHEET_NAME);
  if (!sheet) return false;

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return false;

  const ids = sheet.getRange(2, 2, lastRow - 1, 1).getValues().flat();
  return ids.includes(id);
}

function limpiarId_(value) {
  return String(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function getFolderByName_(name) {
  const folders = DriveApp.getFoldersByName(name);
  if (!folders.hasNext()) {
    throw new Error('No existe la carpeta: ' + name);
  }
  return folders.next();
}
