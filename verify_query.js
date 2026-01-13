const sql = require('mssql');

const sqlConfig = {
    server: 'FW2022',
    database: 'Fw_Comunes',
    user: 'api_user',
    password: 'Cobalto564',
    options: {
        encrypt: true,
        trustServerCertificate: true,
        enableArithAbort: true
    }
};

async function verifyQuery() {
    try {
        await sql.connect(sqlConfig);
        console.log('Connected to Fw_Comunes');

        const query = `
            SELECT TOP 5
                C.EMPRESA,
                C.AREA,
                C.[Nº REF],
                MAX(CASE 
                    WHEN P.tipo IS NULL THEN NULL
                    WHEN P.tipo = 'd' THEN DATEADD(day, P.cantidad, D.[Fecha - F])
                    WHEN P.tipo = 'm' THEN DATEADD(month, P.cantidad, D.[Fecha - F])
                    WHEN P.tipo = 'yyyy' THEN DATEADD(year, P.cantidad, D.[Fecha - F])
                    ELSE NULL 
                END) AS proxima,
                MAX(CASE 
                    WHEN [meses apto] IS NULL THEN NULL 
                    ELSE DATEADD(month, [meses apto], D.[Fecha - F]) 
                END) AS apto,
                C.[NOMBRE INSTRUMENTO]
            FROM [CALIBRACIONES] C
            LEFT JOIN [CALIBRACIONES DETALLE] D ON C.[Nº REF] = D.[Nº REF]
            LEFT JOIN [PERIODOS] P ON C.PERIODICIDAD = P.periodo
            GROUP BY 
                C.EMPRESA, C.AREA, C.[Nº REF], C.[NOMBRE INSTRUMENTO], 
                C.[ORGANISMO EXTERIOR DE CALIBRACION], C.FAMILIA, C.PERIODICIDAD, 
                C.[INTERNO/EXTERNO], C.[CAMPO MEDIDA], C.OBSERVACIONES, 
                C.[MARCA/FABRICANTE], C.[MODELO/TIPO], C.[Nº DE SERIE], 
                C.[DIVISION DE ESCALA], C.[FECHA DE RECEPCION], C.[PROCEDIMIENTO CALIBRACION], 
                C.[CRITERIO DE ACEPTACION Y RECHAZO], 
                C.NºEC, C.SUBAREA, C.[Fecha Retirada], C.[Fecha Apertura/Instalacion]
            ORDER BY C.[Nº REF]
        `;

        const result = await sql.query(query);
        console.log('Query executed successfully!');
        console.log('Result count:', result.recordset.length);
        if (result.recordset.length > 0) {
            console.log('First row proxima:', result.recordset[0].proxima);
        }

        sql.close();
    } catch (err) {
        console.error('Error executing query:', err);
    }
}

verifyQuery();
