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

async function checkData() {
    try {
        await sql.connect(sqlConfig);
        console.log('Connected to Fw_Comunes');

        console.log('\n--- Sample Data in CALIBRACIONES ---');
        const result = await sql.query("SELECT TOP 5 [AREA], [Seccion], [SUBAREA], [Subseccion] FROM [CALIBRACIONES] WHERE [AREA] IS NOT NULL");
        console.table(result.recordset);

        console.log('\n--- Distinct Seccions ---');
        const result2 = await sql.query("SELECT DISTINCT [Seccion] FROM [CALIBRACIONES] WHERE [Seccion] IS NOT NULL");
        console.table(result2.recordset);

        sql.close();
    } catch (err) {
        console.error('Error:', err);
    }
}

checkData();
