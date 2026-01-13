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

async function checkSchema() {
    try {
        await sql.connect(sqlConfig);
        console.log('Connected to Fw_Comunes');

        console.log('\n--- Columns in CALIBRACIONES ---');
        const result1 = await sql.query("SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'CALIBRACIONES' ORDER BY COLUMN_NAME");
        result1.recordset.forEach(row => console.log(`${row.COLUMN_NAME} (${row.DATA_TYPE})`));

        console.log('\n--- Columns in CALIBRACIONES DETALLE ---');
        const result2 = await sql.query("SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'CALIBRACIONES DETALLE' ORDER BY COLUMN_NAME");
        result2.recordset.forEach(row => console.log(`${row.COLUMN_NAME} (${row.DATA_TYPE})`));

        console.log('\n--- Columns in PERIODOS ---');
        const result3 = await sql.query("SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'PERIODOS' ORDER BY COLUMN_NAME");
        result3.recordset.forEach(row => console.log(`${row.COLUMN_NAME} (${row.DATA_TYPE})`));

        sql.close();
    } catch (err) {
        console.error('Error:', err);
    }
}

checkSchema();
