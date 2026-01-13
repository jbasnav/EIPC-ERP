const express = require('express');
const sql = require('mssql');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

// Enable CORS and JSON body parser
app.use(cors());
app.use(express.json());
// Servir archivos estáticos (frontend)
app.use(express.static(__dirname));

// SQL Server configuration
const sqlConfig = {
    server: 'FW2022',
    database: 'Fw_EIPC',
    user: 'api_user',
    password: 'Cobalto564',
    options: {
        encrypt: true,
        trustServerCertificate: true,
        enableArithAbort: true
    },
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
    }
};

// Conectar al pool al inicio
sql.connect(sqlConfig)
    .then(pool => {
        console.log('? Conectado al pool de SQL Server.');
        app.locals.db = pool;
        initializeDatabase(pool);
    })
    .catch(err => {
        console.error('? Error al conectar al pool de SQL Server:', err.message);
    });

async function initializeDatabase(pool) {
    try {
        // Create USUARIOS_APP table if not exists
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='USUARIOS_APP' AND xtype='U')
            BEGIN
                CREATE TABLE [USUARIOS_APP] (
                    [id] INT IDENTITY(1,1) PRIMARY KEY,
                    [username] NVARCHAR(50) NOT NULL UNIQUE,
                    [password] NVARCHAR(100) NOT NULL,
                    [nombre_completo] NVARCHAR(100),
                    [iniciales] NVARCHAR(10),
                    [activo] BIT DEFAULT 1,
                    [fecha_creacion] DATETIME DEFAULT GETDATE()
                );
                
                -- Insert default admin user
                INSERT INTO [USUARIOS_APP] ([username], [password], [nombre_completo], [iniciales], [activo])
                VALUES ('admin', 'admin123', 'Administrador', 'ADM', 1);

                -- Insert default user
                INSERT INTO [USUARIOS_APP] ([username], [password], [nombre_completo], [iniciales], [activo])
                VALUES ('jbasterrika', 'jb123', 'Jon Basterrika', 'JB', 1);
            END
        `);
        console.log('? Base de datos inicializada (Tabla USUARIOS_APP verificada)');
    } catch (err) {
        console.error('? Error inicializando base de datos:', err);
    }
}



// Health check endpoint - checks SQL Server connection status
app.get('/api/health', async (req, res) => {
    try {
        // Try a simple query to verify the connection is alive
        await sql.query`SELECT 1 as test`;
        res.json({ database: 'connected' });
    } catch (error) {
        console.error('Health check failed:', error.message);
        res.status(503).json({ database: 'disconnected', error: error.message });
    }
});

// Endpoint para obtener todos los usuarios (para el login)
app.get('/api/users', async (req, res) => {
    try {
        const result = await sql.query`
            SELECT [username], [nombre_completo], [iniciales]
            FROM [USUARIOS_APP] 
            WHERE [activo] = 1
            ORDER BY [nombre_completo]
        `;

        res.json({
            success: true,
            users: result.recordset,
            count: result.recordset.length
        });
    } catch (err) {
        console.error('Error en /api/users:', err);
        res.status(500).json({
            success: false,
            error: 'Error al obtener usuarios'
        });
    }
});

// Endpoint para login
app.post('/api/login', async (req, res) => {
    try {
        const { userId, username, password } = req.body;
        const loginUser = userId || username;  // Support both field names

        const request = new sql.Request();
        request.input('username', sql.NVarChar, loginUser);
        request.input('password', sql.NVarChar, password);

        const result = await request.query(`
            SELECT [username], [nombre_completo], [iniciales], [rol]
            FROM [USUARIOS_APP] 
            WHERE [username] = @username AND [password] = @password AND [activo] = 1
        `);

        if (result.recordset.length > 0) {
            const user = result.recordset[0];
            res.json({
                success: true,
                user: {
                    id: user.username,
                    name: user.nombre_completo,
                    initials: user.iniciales,
                    rol: user.rol || 'operario'
                }
            });
        } else {
            res.status(401).json({
                success: false,
                error: 'Contraseña incorrecta'
            });
        }
    } catch (err) {
        console.error('Error en /api/login:', err);
        res.status(500).json({
            success: false,
            error: 'Error en el servidor'
        });
    }
});

// ============================================
// ADMIN ENDPOINTS - User Management
// ============================================

// GET all users (admin only)
app.get('/api/admin/users', async (req, res) => {
    try {
        const result = await sql.query`
            SELECT [username], [nombre_completo], [iniciales], [password], [rol], [activo], [fecha_creacion]
            FROM [USUARIOS_APP]
            ORDER BY [nombre_completo]
        `;

        res.json({
            success: true,
            users: result.recordset,
            count: result.recordset.length
        });
    } catch (err) {
        console.error('Error en /api/admin/users:', err);
        res.status(500).json({
            success: false,
            error: 'Error al obtener usuarios'
        });
    }
});

// CREATE new user (admin only)
app.post('/api/admin/users', async (req, res) => {
    try {
        const { username, password, nombre_completo, iniciales, rol } = req.body;

        if (!username || !password || !nombre_completo) {
            return res.status(400).json({
                success: false,
                error: 'Username, password y nombre_completo son requeridos'
            });
        }

        const request = new sql.Request();
        request.input('username', sql.NVarChar, username);
        request.input('password', sql.NVarChar, password);
        request.input('nombre_completo', sql.NVarChar, nombre_completo);
        request.input('iniciales', sql.NVarChar, iniciales || username.substring(0, 2).toUpperCase());
        request.input('rol', sql.NVarChar, rol || 'operario');

        await request.query(`
            INSERT INTO [USUARIOS_APP] ([username], [password], [nombre_completo], [iniciales], [rol], [activo])
            VALUES (@username, @password, @nombre_completo, @iniciales, @rol, 1)
        `);

        res.json({
            success: true,
            message: 'Usuario creado correctamente'
        });
    } catch (err) {
        console.error('Error en POST /api/admin/users:', err);
        if (err.message.includes('UNIQUE') || err.message.includes('duplicate')) {
            res.status(400).json({
                success: false,
                error: 'El username ya existe'
            });
        } else {
            res.status(500).json({
                success: false,
                error: 'Error al crear usuario'
            });
        }
    }
});

// UPDATE user (admin only)
app.put('/api/admin/users/:username', async (req, res) => {
    try {
        const { username } = req.params;
        const { password, nombre_completo, iniciales, rol, activo } = req.body;

        const request = new sql.Request();
        request.input('username', sql.NVarChar, username);

        let updateFields = [];

        if (password) {
            request.input('password', sql.NVarChar, password);
            updateFields.push('[password] = @password');
        }
        if (nombre_completo) {
            request.input('nombre_completo', sql.NVarChar, nombre_completo);
            updateFields.push('[nombre_completo] = @nombre_completo');
        }
        if (iniciales) {
            request.input('iniciales', sql.NVarChar, iniciales);
            updateFields.push('[iniciales] = @iniciales');
        }
        if (rol) {
            request.input('rol', sql.NVarChar, rol);
            updateFields.push('[rol] = @rol');
        }
        if (activo !== undefined) {
            request.input('activo', sql.Bit, activo ? 1 : 0);
            updateFields.push('[activo] = @activo');
        }

        if (updateFields.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No hay campos para actualizar'
            });
        }

        await request.query(`
            UPDATE [USUARIOS_APP]
            SET ${updateFields.join(', ')}
            WHERE [username] = @username
        `);

        res.json({
            success: true,
            message: 'Usuario actualizado correctamente'
        });
    } catch (err) {
        console.error('Error en PUT /api/admin/users:', err);
        res.status(500).json({
            success: false,
            error: 'Error al actualizar usuario'
        });
    }
});

// DELETE user (admin only)
app.delete('/api/admin/users/:username', async (req, res) => {
    try {
        const { username } = req.params;

        const request = new sql.Request();
        request.input('username', sql.NVarChar, username);

        await request.query(`
            DELETE FROM [USUARIOS_APP]
            WHERE [username] = @username
        `);

        res.json({
            success: true,
            message: 'Usuario eliminado correctamente'
        });
    } catch (err) {
        console.error('Error en DELETE /api/admin/users:', err);
        res.status(500).json({
            success: false,
            error: 'Error al eliminar usuario'
        });
    }
});

// Main endpoint to get all treatment data
app.get('/api/tratamientos', async (req, res) => {
    try {
        const result = await sql.query`
            SELECT *
            FROM Qry_Lotes_ColadaTT_Pivotado
            ORDER BY [numero orden] DESC
        `;

        res.json({
            success: true,
            data: result.recordset,
            count: result.recordset.length,
            timestamp: new Date()
        });

    } catch (err) {
        console.error('Error SQL en /api/tratamientos:', err);
        res.status(500).json({
            success: false,
            error: 'Error en la consulta a la base de datos.',
            details: err.message
        });
    }
});

// Endpoint para obtener el maestro de materiales (TABLA MATERIALES)
app.get('/api/materiales', async (req, res) => {
    try {
        // En este caso, si no existe una tabla MAESTRO MATERIALES explícita, 
        // podemos obtener los materiales distintos de la tabla MAESTRO ARTICULOS
        // O si el usuario se refiere a una tabla específica, deberíamos usar esa.
        // Asumiremos que quiere un listado de los materiales únicos que existen en los artículos.
        // Si existe una tabla [MAESTRO MATERIALES], la usaremos. Vamos a intentar consultar [MAESTRO ARTICULOS] distinct material primero
        // ya que vimos en la consulta de articulos que saca el material de ahí.

        const request = new sql.Request();
        const { codigo, descripcion } = req.query;

        let whereConditions = ["material IS NOT NULL", "material <> ''"];
        if (codigo) {
            request.input('codigo', sql.NVarChar, `%${codigo}%`);
            whereConditions.push("material LIKE @codigo");
        }

        const query = `
            SELECT DISTINCT
                material as codigo,
                material as descripcion -- Asumimos que el código y la descripción son lo mismo por ahora si no hay tabla separada
            FROM [MAESTRO ARTICULOS]
            WHERE ${whereConditions.join(' AND ')}
            ORDER BY material
        `;

        const result = await request.query(query);

        res.json({
            success: true,
            data: result.recordset,
            count: result.recordset.length
        });

    } catch (err) {
        console.error('Error SQL en /api/materiales:', err);
        res.status(500).json({
            success: false,
            error: 'Error al obtener materiales.',
            details: err.message
        });
    }
});

// Endpoint para obtener el maestro de utillajes (TABLA MAESTRO UTILLAJES)
app.get('/api/utillajes', async (req, res) => {
    try {
        const request = new sql.Request();
        const maxLimit = 1000;
        const { codigo, tipo, familia, activo, situacion, sortBy, sortDir } = req.query;

        let whereConditions = [];

        if (codigo) {
            request.input('codigo', sql.NVarChar, `%${codigo}%`);
            whereConditions.push("u.[codigo utillaje] LIKE @codigo");
        }
        if (tipo) {
            request.input('tipo', sql.NVarChar, tipo);
            whereConditions.push("u.[tipo utillaje] = @tipo");
        }
        if (familia) {
            request.input('familia', sql.NVarChar, familia);
            whereConditions.push("u.[familia] = @familia");
        }
        if (activo && activo !== '') {
            request.input('activo', sql.Int, parseInt(activo));
            whereConditions.push("u.[activo] = @activo");
        }
        if (situacion) {
            request.input('situacion', sql.NVarChar, situacion);
            whereConditions.push("u.[situacion] = @situacion");
        }

        request.input('maxLimit', sql.Int, maxLimit);

        const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

        // Dynamic sorting
        const validSortCols = {
            'codigo utillaje': 'u.[codigo utillaje]',
            'tipo utillaje': 'u.[tipo utillaje]',
            'familia': 'u.[familia]',
            'situacion': 'u.[situacion]',
            'activo': 'u.[activo]',
            'estanteria': 'u.[estanteria]'
        };
        const sortCol = validSortCols[sortBy] || 'u.[codigo utillaje]';
        const sortDirection = sortDir?.toLowerCase() === 'desc' ? 'DESC' : 'ASC';

        const query = `
            SELECT TOP (@maxLimit) 
                u.[codigo utillaje], 
                u.[tipo utillaje], 
                u.[familia], 
                u.[activo], 
                u.[estanteria],
                u.[situacion],
                F.[denominacion familia] as [descripcion familia],
                T.[denominacion tipo] as [descripcion tipo],
                S.[denominacion situacion utillaje] as [descripcion situacion]
            FROM [MAESTRO UTILLAJES] u
            LEFT JOIN [MAESTRO FAMILIAS] F 
                ON u.[familia] = F.[codigo familia] 
                AND F.[codigo tipo] = '06'
            LEFT JOIN [MAESTRO TIPO ARTICULOS] T 
                ON T.[codigo tipo] = '06'
            LEFT JOIN [MAESTRO SITUACION UTILLAJES] S 
                ON u.[situacion] = S.[codigo situacion]
            ${whereClause}
            ORDER BY ${sortCol} ${sortDirection}
        `;

        console.log('Utillajes query:', query);
        const result = await request.query(query);

        res.json({
            success: true,
            data: result.recordset,
            count: result.recordset.length
        });

    } catch (err) {
        console.error('Error SQL en /api/utillajes:', err);
        res.status(500).json({
            success: false,
            error: 'Error al obtener utillajes.',
            details: err.message
        });
    }
});

// Endpoint para obtener filtros de utillajes
app.get('/api/utillajes-filtros', async (req, res) => {
    console.log('[UTILLAJES-FILTROS] Endpoint called');
    try {
        // Get Tipo 06 from MAESTRO TIPO ARTICULOS (fixed for utillajes)
        const tiposResult = await sql.query`
            SELECT [codigo tipo], [denominacion tipo]
            FROM [MAESTRO TIPO ARTICULOS]
            WHERE [codigo tipo] = '06'
        `;

        // Get Familias from MAESTRO FAMILIAS where codigo tipo = '06'
        const familiasResult = await sql.query`
            SELECT [codigo familia], [denominacion familia]
            FROM [MAESTRO FAMILIAS]
            WHERE [codigo tipo] = '06'
            ORDER BY [codigo familia]
        `;

        // Get Situaciones from MAESTRO SITUACION UTILLAJES
        const situacionesResult = await sql.query`
            SELECT [codigo situacion], [denominacion situacion utillaje]
            FROM [MAESTRO SITUACION UTILLAJES]
            ORDER BY [codigo situacion]
        `;

        console.log('[UTILLAJES-FILTROS] Tipos:', tiposResult.recordset.length);
        console.log('[UTILLAJES-FILTROS] Familias:', familiasResult.recordset.length);
        console.log('[UTILLAJES-FILTROS] Situaciones:', situacionesResult.recordset.length);

        res.json({
            success: true,
            tipos: tiposResult.recordset,
            familias: familiasResult.recordset,
            situaciones: situacionesResult.recordset
        });

    } catch (err) {
        console.error('Error SQL en /api/utillajes-filtros:', err);
        res.status(500).json({
            success: false,
            error: 'Error al obtener filtros de utillajes.',
            details: err.message
        });
    }
});

// Endpoint para obtener el maestro de artículos (solo tipo 02)
app.get('/api/articulos', async (req, res) => {
    try {
        const { tipo, familia, subfamilia, material, cliente } = req.query;

        const request = new sql.Request();
        let whereConditions = [];

        // Always filter by tipo (default to '02' if not specified)
        const tipoValue = tipo || '02';
        request.input('tipo', sql.NVarChar, tipoValue);
        whereConditions.push('A.[codigo tipo] = @tipo');

        if (familia) {
            request.input('familia', sql.NVarChar, familia);
            whereConditions.push('A.[codigo familia] = @familia');
        }
        if (subfamilia) {
            request.input('subfamilia', sql.NVarChar, subfamilia);
            whereConditions.push('A.[codigo subfamilia] = @subfamilia');
        }
        if (material) {
            request.input('material', sql.NVarChar, material);
            whereConditions.push('A.[material] = @material');
        }

        // Filter by cliente using MAESTRO REFERENCIAS CLIENTE
        let clienteJoin = '';
        if (cliente) {
            request.input('cliente', sql.NVarChar, cliente);
            clienteJoin = `
                INNER JOIN [MAESTRO REFERENCIAS CLIENTE] RC 
                    ON A.[codigo articulo] = RC.[codigo articulo]
            `;
            whereConditions.push('RC.[codigo cliente] = @cliente');
        }

        let query = `
            SELECT DISTINCT
                A.[codigo articulo],
                A.[denominacion articulo],
                A.[codigo tipo],
                A.[codigo familia],
                A.[codigo subfamilia],
                A.[material],
                T.[denominacion tipo],
                F.[denominacion familia],
                S.[denominacion subfamilia]
            FROM
                [MAESTRO ARTICULOS] A
            ${clienteJoin}
            LEFT JOIN
                [MAESTRO TIPO ARTICULOS] T ON A.[codigo tipo] = T.[codigo tipo]
            LEFT JOIN
                [MAESTRO FAMILIAS] F ON A.[codigo tipo] = F.[codigo tipo] 
                                     AND A.[codigo familia] = F.[codigo familia]
            LEFT JOIN
                [MAESTRO SUBFAMILIAS] S ON A.[codigo tipo] = S.[codigo tipo] 
                                        AND A.[codigo familia] = S.[codigo familia]
                                        AND A.[codigo subfamilia] = S.[codigo subfamilia]
            WHERE ${whereConditions.join(' AND ')}
            ORDER BY A.[codigo articulo]
        `;

        const result = await request.query(query);

        // Get all tipos
        const tiposQuery = await sql.query`
            SELECT DISTINCT T.[codigo tipo], T.[denominacion tipo]
            FROM [MAESTRO TIPO ARTICULOS] T
            ORDER BY T.[codigo tipo]
        `;
        const tipos = tiposQuery.recordset;

        // Get familias for selected tipo
        const familiasRequest = new sql.Request();
        familiasRequest.input('tipo', sql.NVarChar, tipoValue);
        const familiasResult = await familiasRequest.query(`
            SELECT DISTINCT F.[codigo familia], F.[denominacion familia]
            FROM [MAESTRO FAMILIAS] F
            WHERE F.[codigo tipo] = @tipo
            ORDER BY F.[codigo familia]
        `);
        const familias = familiasResult.recordset;

        // Get subfamilias for selected tipo and familia
        let subfamilias = [];
        if (familia) {
            const subfamiliasRequest = new sql.Request();
            subfamiliasRequest.input('tipo', sql.NVarChar, tipoValue);
            subfamiliasRequest.input('familia', sql.NVarChar, familia);
            const subfamiliasResult = await subfamiliasRequest.query(`
                SELECT DISTINCT S.[codigo subfamilia], S.[denominacion subfamilia]
                FROM [MAESTRO SUBFAMILIAS] S
                WHERE S.[codigo tipo] = @tipo AND S.[codigo familia] = @familia
                ORDER BY S.[codigo subfamilia]
            `);
            subfamilias = subfamiliasResult.recordset;
        }

        // Get materiales for current filter selection (considering cliente filter)
        const materialesRequest = new sql.Request();
        let materialWhereConditions = ['A.[codigo tipo] = @tipo', 'A.[material] IS NOT NULL', "A.[material] <> ''"];
        materialesRequest.input('tipo', sql.NVarChar, tipoValue);

        let materialClienteJoin = '';
        if (cliente) {
            materialesRequest.input('cliente', sql.NVarChar, cliente);
            materialClienteJoin = `
                INNER JOIN [MAESTRO REFERENCIAS CLIENTE] RC 
                    ON A.[codigo articulo] = RC.[codigo articulo]
            `;
            materialWhereConditions.push('RC.[codigo cliente] = @cliente');
        }

        if (familia) {
            materialesRequest.input('familia', sql.NVarChar, familia);
            materialWhereConditions.push('A.[codigo familia] = @familia');
        }
        if (subfamilia) {
            materialesRequest.input('subfamilia', sql.NVarChar, subfamilia);
            materialWhereConditions.push('A.[codigo subfamilia] = @subfamilia');
        }

        const materialesResult = await materialesRequest.query(`
            SELECT DISTINCT A.[material]
            FROM [MAESTRO ARTICULOS] A
            ${materialClienteJoin}
            WHERE ${materialWhereConditions.join(' AND ')}
            ORDER BY A.[material]
        `);
        const materiales = materialesResult.recordset.map(r => r.material);

        // Get clientes that have references to articles of this tipo
        const clientesRequest = new sql.Request();
        clientesRequest.input('tipo', sql.NVarChar, tipoValue);
        const clientesResult = await clientesRequest.query(`
            SELECT DISTINCT C.[codigo cliente], C.[nombre empresa]
            FROM [MAESTRO CLIENTES] C
            INNER JOIN [MAESTRO REFERENCIAS CLIENTE] RC ON C.[codigo cliente] = RC.[codigo cliente]
            INNER JOIN [MAESTRO ARTICULOS] A ON RC.[codigo articulo] = A.[codigo articulo]
            WHERE A.[codigo tipo] = @tipo
            ORDER BY C.[codigo cliente]
        `);
        const clientes = clientesResult.recordset;

        res.json({
            success: true,
            data: result.recordset,
            count: result.recordset.length,
            tipos: tipos,
            clientes: clientes,
            familias: familias,
            subfamilias: subfamilias,
            materiales: materiales,
            timestamp: new Date()
        });

    } catch (err) {
        console.error('Error SQL en /api/articulos:', err);
        res.status(500).json({
            success: false,
            error: 'Error al obtener el maestro de artículos.',
            details: err.message
        });
    }
});



// Endpoint para obtener detalle de un artículo específico
app.get('/api/articulo-detalle', async (req, res) => {
    try {
        const { articulo } = req.query;

        if (!articulo) {
            return res.status(400).json({
                success: false,
                error: 'El parámetro articulo es requerido.'
            });
        }

        const request = new sql.Request();
        request.input('articulo', sql.NVarChar, articulo);

        const result = await request.query(`
            SELECT A.*, P.RutaImagen
            FROM [MAESTRO ARTICULOS] A
            LEFT JOIN [MAESTRO ARTICULOS PLANOS] P ON A.[codigo articulo] = P.articulo
            WHERE A.[codigo articulo] = @articulo
        `);

        if (result.recordset.length === 0) {
            return res.json({
                success: true,
                data: null,
                message: 'Artículo no encontrado'
            });
        }

        res.json({
            success: true,
            data: result.recordset[0],
            timestamp: new Date()
        });

    } catch (err) {
        console.error('Error SQL en /api/articulo-detalle:', err);
        res.status(500).json({
            success: false,
            error: 'Error al obtener el detalle del artículo.',
            details: err.message
        });
    }
});

// Endpoint para servir la imagen del artículo
app.get('/api/articulo-imagen', async (req, res) => {
    try {
        const { articulo } = req.query;
        if (!articulo) return res.status(400).send('Falta el parámetro articulo');

        console.log(`[TAG:IMAGEN] Solicitando imagen para articulo: ${articulo}`);

        const request = new sql.Request();
        request.input('articulo', sql.NVarChar, articulo);

        const result = await request.query(`
            SELECT RutaImagen
            FROM [MAESTRO ARTICULOS PLANOS]
            WHERE articulo = @articulo
        `);

        if (result.recordset.length === 0 || !result.recordset[0].RutaImagen) {
            console.log(`[TAG:IMAGEN] No hay registro en BD para: ${articulo}`);
            return res.status(404).send('Imagen no encontrada');
        }

        const imagePath = result.recordset[0].RutaImagen;
        console.log(`[TAG:IMAGEN] Ruta en BD: ${imagePath}`);

        const fs = require('fs');
        const path = require('path');

        if (!fs.existsSync(imagePath)) {
            console.error(`[TAG:IMAGEN] ? Imagen no encontrada en disco: ${imagePath}`);
            return res.status(404).send('Archivo de imagen no encontrado');
        }

        console.log(`[TAG:IMAGEN] ? Sirviendo imagen: ${imagePath}`);
        res.sendFile(imagePath);

    } catch (err) {
        console.error('[TAG:IMAGEN] Error sirviendo imagen:', err);
        res.status(500).send('Error interno');
    }
});

// Endpoint para obtener familias (solo tipo 02)
app.get('/api/familias', async (req, res) => {
    try {
        const result = await sql.query`
            SELECT
                [codigo familia],
                [denominacion familia]
            FROM
                [MAESTRO FAMILIAS]
            WHERE
                [codigo tipo] = '02'
            ORDER BY
                [denominacion familia]
        `;

        res.json({
            success: true,
            data: result.recordset,
            count: result.recordset.length
        });

    } catch (err) {
        console.error('Error SQL en /api/familias:', err);
        res.status(500).json({
            success: false,
            error: 'Error al obtener familias.',
            details: err.message
        });
    }
});

// Endpoint para obtener subfamilias (solo tipo 02)
app.get('/api/subfamilias', async (req, res) => {
    try {
        const { familia } = req.query;

        let query;
        if (familia) {
            const request = new sql.Request();
            request.input('familia', sql.NVarChar, familia);
            query = await request.query(`
                SELECT
                    [codigo subfamilia],
                    [denominacion subfamilia]
                FROM
                    [MAESTRO SUBFAMILIAS]
                WHERE
                    [codigo tipo] = '02'
                    AND [codigo familia] = @familia
                ORDER BY
                    [denominacion subfamilia]
            `);
        } else {
            query = await sql.query`
                SELECT
                    [codigo familia],
                    [codigo subfamilia],
                    [denominacion subfamilia]
                FROM
                    [MAESTRO SUBFAMILIAS]
                WHERE
                    [codigo tipo] = '02'
                ORDER BY
                    [denominacion subfamilia]
            `;
        }

        res.json({
            success: true,
            data: query.recordset,
            count: query.recordset.length
        });

    } catch (err) {
        console.error('Error SQL en /api/subfamilias:', err);
        res.status(500).json({
            success: false,
            error: 'Error al obtener subfamilias.',
            details: err.message
        });
    }
});

// Endpoint para obtener fases distintas
app.get('/api/fases', async (req, res) => {
    try {
        const result = await sql.query`
            SELECT DISTINCT [fase] 
            FROM [RUTAS] 
            WHERE [fase] IS NOT NULL AND [fase] <> ''
            ORDER BY [fase]
        `;

        const fases = result.recordset.map(r => r.fase);
        res.json({
            success: true,
            fases: fases
        });
    } catch (err) {
        console.error('Error SQL en /api/fases:', err);
        res.status(500).json({
            success: false,
            error: 'Error al obtener fases.',
            details: err.message
        });
    }
});

// Endpoint para obtener filtros de rutas (familias y clasificaciones para tipo 02)
app.get('/api/rutas-filtros', async (req, res) => {
    try {
        // Get familias for tipo 02 that have rutas
        const familiasResult = await sql.query`
            SELECT DISTINCT 
                MA.[codigo familia],
                F.[denominacion familia]
            FROM [RUTAS] R
            INNER JOIN [MAESTRO ARTICULOS] MA ON R.[cod de articulo] = MA.[codigo articulo]
            LEFT JOIN [MAESTRO FAMILIAS] F ON MA.[codigo tipo] = F.[codigo tipo] AND MA.[codigo familia] = F.[codigo familia]
            WHERE MA.[codigo tipo] = '02' 
              AND MA.[codigo familia] IS NOT NULL 
              AND MA.[codigo familia] <> ''
            ORDER BY MA.[codigo familia]
        `;

        // Get clasificaciones for tipo 02 that have rutas
        const clasificacionesResult = await sql.query`
            SELECT DISTINCT MA.[clasificacion]
            FROM [RUTAS] R
            INNER JOIN [MAESTRO ARTICULOS] MA ON R.[cod de articulo] = MA.[codigo articulo]
            WHERE MA.[codigo tipo] = '02'
              AND MA.[clasificacion] IS NOT NULL 
              AND MA.[clasificacion] <> ''
            ORDER BY MA.[clasificacion]
        `;

        res.json({
            success: true,
            familias: familiasResult.recordset,
            clasificaciones: clasificacionesResult.recordset.map(r => r.clasificacion)
        });
    } catch (err) {
        console.error('Error SQL en /api/rutas-filtros:', err);
        res.status(500).json({
            success: false,
            error: 'Error al obtener filtros de rutas.',
            details: err.message
        });
    }
});

// Endpoint para obtener rutas de artículos
app.get('/api/rutas', async (req, res) => {
    try {
        const { articulo, operacion, fase, ruta, tipo, controlProduccion, familia, clasificacion } = req.query;

        const request = new sql.Request();
        let whereConditions = [];

        if (articulo) {
            request.input('articulo', sql.NVarChar, articulo);
            whereConditions.push('R.[cod de articulo] = @articulo');
        }

        if (operacion) {
            request.input('operacion', sql.NVarChar, operacion);
            whereConditions.push('R.[codigo operacion] = @operacion');
        }

        if (fase) {
            request.input('fase', sql.NVarChar, fase);
            whereConditions.push('R.[fase] = @fase');
        }

        if (ruta) {
            request.input('ruta', sql.NVarChar, ruta);
            whereConditions.push('R.[ruta] = @ruta');
        }

        if (tipo) {
            request.input('tipo', sql.NVarChar, tipo);
            whereConditions.push('R.[tipo] = @tipo');
        }

        if (controlProduccion !== undefined && controlProduccion !== '') {
            const cpValue = controlProduccion === 'true' || controlProduccion === '1';
            request.input('controlProduccion', sql.Bit, cpValue);
            whereConditions.push('R.[ControlProduccion] = @controlProduccion');
        }

        let query = `
            SELECT
                R.[cod de articulo],
                R.[secuencia],
                R.[codigo operacion],
                R.[descripcion],
                R.[descripcion2],
                R.[fase],
                R.[tipo],
                R.[centro],
                M.[descripcion] as centroDescripcion,
                R.[tiempo ejecucion unitario],
                R.[ControlProduccion],
                MA.[codigo familia] as codigoFamilia,
                MA.[clasificacion] as clasificacion
            FROM
                [RUTAS] R
            LEFT JOIN
                [MAQUINAS] M ON R.[centro] = M.[cod de maquina]
            LEFT JOIN
                [MAESTRO ARTICULOS] MA ON R.[cod de articulo] = MA.[codigo articulo]
        `;

        // Add familia filter
        if (familia) {
            request.input('familia', sql.NVarChar, familia);
            whereConditions.push('MA.[codigo familia] = @familia');
        }

        // Add clasificacion filter
        if (clasificacion) {
            request.input('clasificacion', sql.NVarChar, clasificacion);
            whereConditions.push('MA.[clasificacion] = @clasificacion');
        }

        if (whereConditions.length > 0) {
            query += ' WHERE ' + whereConditions.join(' AND ');
        }

        query += ' ORDER BY R.[secuencia]';

        const result = await request.query(query);

        // Calculate total time when filtering by article
        let tiempoTotal = null;
        if (articulo) {
            const tiempoRequest = new sql.Request();
            tiempoRequest.input('articulo', sql.NVarChar, articulo);
            let tiempoQuery = `
                SELECT SUM(ISNULL([tiempo ejecucion unitario], 0)) as tiempoTotal
                FROM [RUTAS]
                WHERE [cod de articulo] = @articulo
            `;
            if (fase) {
                tiempoRequest.input('fase', sql.NVarChar, fase);
                tiempoQuery = `
                    SELECT SUM(ISNULL([tiempo ejecucion unitario], 0)) as tiempoTotal
                    FROM [RUTAS]
                    WHERE [cod de articulo] = @articulo AND [fase] = @fase
                `;
            }
            const tiempoResult = await tiempoRequest.query(tiempoQuery);
            tiempoTotal = tiempoResult.recordset[0]?.tiempoTotal || 0;
        }

        // Get TOP 10 articles with highest total time
        const top10Query = `
            SELECT TOP 10
                R.[cod de articulo] as articulo,
                MA.[denominacion articulo] as denominacion,
                SUM(ISNULL(R.[tiempo ejecucion unitario], 0)) as tiempoTotalArticulo
            FROM [RUTAS] R
            LEFT JOIN [MAESTRO ARTICULOS] MA ON R.[cod de articulo] = MA.[codigo articulo]
            GROUP BY R.[cod de articulo], MA.[denominacion articulo]
            HAVING SUM(ISNULL(R.[tiempo ejecucion unitario], 0)) > 0
            ORDER BY tiempoTotalArticulo DESC
        `;
        const top10Result = await sql.query(top10Query);

        // Get distinct tipos and fases based on search criteria
        let tiposResult = [];
        let fasesResult = [];
        if (articulo || operacion) {
            const tiposRequest = new sql.Request();
            let tiposQuery = `SELECT DISTINCT [tipo] FROM [RUTAS] WHERE 1=1`;
            if (articulo) {
                tiposRequest.input('articulo', sql.NVarChar, articulo);
                tiposQuery += ` AND [cod de articulo] = @articulo`;
            }
            if (operacion) {
                tiposRequest.input('operacion', sql.NVarChar, operacion);
                tiposQuery += ` AND [codigo operacion] = @operacion`;
            }
            if (ruta) {
                tiposRequest.input('ruta', sql.NVarChar, ruta);
                tiposQuery += ` AND [ruta] = @ruta`;
            }
            tiposQuery += ` ORDER BY [tipo]`;
            const tiposQueryResult = await tiposRequest.query(tiposQuery);
            tiposResult = tiposQueryResult.recordset.map(r => r.tipo).filter(t => t);

            // Get distinct fases
            const fasesRequest = new sql.Request();
            let fasesQuery = `SELECT DISTINCT [fase] FROM [RUTAS] WHERE 1=1`;
            if (articulo) {
                fasesRequest.input('articulo', sql.NVarChar, articulo);
                fasesQuery += ` AND [cod de articulo] = @articulo`;
            }
            if (operacion) {
                fasesRequest.input('operacion', sql.NVarChar, operacion);
                fasesQuery += ` AND [codigo operacion] = @operacion`;
            }
            if (ruta) {
                fasesRequest.input('ruta', sql.NVarChar, ruta);
                fasesQuery += ` AND [ruta] = @ruta`;
            }
            fasesQuery += ` ORDER BY [fase]`;
            const fasesQueryResult = await fasesRequest.query(fasesQuery);
            fasesResult = fasesQueryResult.recordset.map(r => r.fase).filter(f => f);
        }

        // Get available familias for rutas filter
        const familiasResult = await sql.query`
            SELECT DISTINCT 
                MA.[codigo familia],
                F.[denominacion familia]
            FROM [RUTAS] R
            INNER JOIN [MAESTRO ARTICULOS] MA ON R.[cod de articulo] = MA.[codigo articulo]
            LEFT JOIN [MAESTRO FAMILIAS] F ON MA.[codigo tipo] = F.[codigo tipo] AND MA.[codigo familia] = F.[codigo familia]
            WHERE MA.[codigo familia] IS NOT NULL AND MA.[codigo familia] <> ''
            ORDER BY MA.[codigo familia]
        `;
        const familias = familiasResult.recordset;

        // Get available clasificaciones for rutas filter
        const clasificacionesResult = await sql.query`
            SELECT DISTINCT MA.[clasificacion]
            FROM [RUTAS] R
            INNER JOIN [MAESTRO ARTICULOS] MA ON R.[cod de articulo] = MA.[codigo articulo]
            WHERE MA.[clasificacion] IS NOT NULL AND MA.[clasificacion] <> ''
            ORDER BY MA.[clasificacion]
        `;
        const clasificaciones = clasificacionesResult.recordset.map(r => r.clasificacion);

        // Get TOP 10 articles with most operations (per article+ruta combination)
        const top10OperacionesQuery = `
            SELECT TOP 10
                R.[cod de articulo] as articulo,
                R.[ruta] as ruta,
                MA.[denominacion articulo] as denominacion,
                COUNT(*) as numOperaciones
            FROM [RUTAS] R
            LEFT JOIN [MAESTRO ARTICULOS] MA ON R.[cod de articulo] = MA.[codigo articulo]
            GROUP BY R.[cod de articulo], R.[ruta], MA.[denominacion articulo]
            ORDER BY numOperaciones DESC
        `;
        const top10OperacionesResult = await sql.query(top10OperacionesQuery);

        res.json({
            success: true,
            data: result.recordset,
            count: result.recordset.length,
            tipos: tiposResult,
            fases: fasesResult,
            familias: familias,
            clasificaciones: clasificaciones,
            tiempoTotal: tiempoTotal,
            top10Articulos: top10Result.recordset,
            top10Operaciones: top10OperacionesResult.recordset,
            timestamp: new Date()
        });

    } catch (err) {
        console.error('Error SQL en /api/rutas:', err);
        res.status(500).json({
            success: false,
            error: 'Error al obtener las rutas.',
            details: err.message
        });
    }
});

// Endpoint para obtener operarios
app.get('/api/operarios', async (req, res) => {
    try {
        const { seccion, activo, aCalculo } = req.query;

        const request = new sql.Request();
        let whereConditions = [];

        if (seccion) {
            request.input('seccion', sql.NVarChar, seccion);
            whereConditions.push('[seccion] = @seccion');
        }

        if (activo !== undefined && activo !== '') {
            const activoValue = activo === 'true' || activo === '1';
            request.input('activo', sql.Bit, activoValue);
            whereConditions.push('[activo] = @activo');
        }

        if (aCalculo !== undefined && aCalculo !== '') {
            const aCalculoValue = aCalculo === 'true' || aCalculo === '1';
            request.input('aCalculo', sql.Bit, aCalculoValue);
            whereConditions.push('[a calculo] = @aCalculo');
        }

        let query = `
            SELECT
                [operario],
                [nombre],
                [fecha alta],
                [activo],
                [a calculo]
            FROM
                [OPERARIOS]
        `;

        if (whereConditions.length > 0) {
            query += ' WHERE ' + whereConditions.join(' AND ');
        }

        query += ' ORDER BY [nombre]';

        const result = await request.query(query);

        // Get distinct secciones with denominacion from MAESTRO SECCIONES
        const seccionesQuery = await sql.query`
            SELECT DISTINCT 
                O.[seccion],
                S.[denominacion]
            FROM [OPERARIOS] O
            LEFT JOIN [MAESTRO SECCIONES] S ON O.[seccion] = S.[seccion]
            WHERE O.[seccion] IS NOT NULL
            ORDER BY O.[seccion]
        `;
        const secciones = seccionesQuery.recordset.map(r => ({
            codigo: r.seccion,
            denominacion: r.denominacion || ''
        })).filter(s => s.codigo);

        res.json({
            success: true,
            data: result.recordset,
            count: result.recordset.length,
            secciones: secciones,
            timestamp: new Date()
        });

    } catch (err) {
        console.error('Error SQL en /api/operarios:', err);
        res.status(500).json({
            success: false,
            error: 'Error al obtener los operarios.',
            details: err.message
        });
    }
});

// Endpoint para obtener operaciones
app.get('/api/operaciones', async (req, res) => {
    try {
        const { operacion, seccion, fase, computoOEE, activo } = req.query;

        const request = new sql.Request();
        let whereConditions = [];

        if (operacion) {
            request.input('operacion', sql.NVarChar, operacion);
            whereConditions.push('O.[codigo operacion] = @operacion');
        }

        if (seccion) {
            request.input('seccion', sql.NVarChar, seccion);
            whereConditions.push('O.[seccion] = @seccion');
        }

        // If fase is provided, filter operations that exist in RUTAS with that fase
        if (fase) {
            request.input('fase', sql.NVarChar, fase);
            whereConditions.push('O.[codigo operacion] IN (SELECT DISTINCT [codigo operacion] FROM [RUTAS] WHERE [fase] = @fase)');
        }

        // Filter by activo (1 or -1 = "SÍ", 0 = "No")
        if (activo !== undefined && activo !== '') {
            const activoValue = parseInt(activo);
            if (activoValue === 1) {
                // For "SÍ", accept both 1 and -1 (SQL Server bit true value)
                whereConditions.push('(O.[activo] = 1 OR O.[activo] = -1)');
            } else {
                // For "No" (0)
                request.input('activo', sql.Bit, activoValue);
                whereConditions.push('O.[activo] = @activo');
            }
        }

        // Filter by ComputoOEE (1 = "SÍ", 0 = "No")
        if (computoOEE !== undefined && computoOEE !== '') {
            const computoValue = parseInt(computoOEE);
            request.input('computoOEE', sql.Int, computoValue);
            whereConditions.push('O.[ComputoOEE] = @computoOEE');
        }

        let query = `
            SELECT
                O.[codigo operacion],
                O.[descripcion 1],
                O.[activo],
                O.[grupo operaciones],
                O.[PlazoStandard],
                O.[seccion],
                S.[denominacion] as seccionDescripcion,
                O.[ComputoOEE],
                (SELECT COUNT(*) FROM [RUTAS] R WHERE R.[codigo operacion] = O.[codigo operacion]) as rutasCount
            FROM
                [OPERACIONES] O
            LEFT JOIN
                [MAESTRO SECCIONES] S ON O.[seccion] = S.[seccion]
        `;

        if (whereConditions.length > 0) {
            query += ' WHERE ' + whereConditions.join(' AND ');
        }

        query += ' ORDER BY [codigo operacion]';

        const result = await request.query(query);

        // Get distinct secciones for the dropdown
        const seccionesQuery = await sql.query`
            SELECT DISTINCT 
                O.[seccion],
                S.[denominacion]
            FROM [OPERACIONES] O
            LEFT JOIN [MAESTRO SECCIONES] S ON O.[seccion] = S.[seccion]
            WHERE O.[seccion] IS NOT NULL
            ORDER BY O.[seccion]
        `;
        const secciones = seccionesQuery.recordset.map(r => ({
            codigo: r.seccion,
            denominacion: r.denominacion || ''
        })).filter(s => s.codigo);

        // Get all operaciones for dropdown
        const operacionesListQuery = await sql.query`
            SELECT [codigo operacion], [descripcion 1]
            FROM [OPERACIONES]
            ORDER BY [codigo operacion]
        `;
        const operacionesList = operacionesListQuery.recordset.map(r => ({
            codigo: r['codigo operacion'],
            descripcion: r['descripcion 1'] || ''
        }));

        res.json({
            success: true,
            data: result.recordset,
            count: result.recordset.length,
            secciones: secciones,
            operacionesList: operacionesList,
            timestamp: new Date()
        });

    } catch (err) {
        console.error('Error SQL en /api/operaciones:', err);
        res.status(500).json({
            success: false,
            error: 'Error al obtener las operaciones.',
            details: err.message
        });
    }
});

// Endpoint para obtener artículos que usan una operación
app.get('/api/operaciones/:codigo/rutas', async (req, res) => {
    try {
        const { codigo } = req.params;

        const request = new sql.Request();
        request.input('codigo', sql.NVarChar, codigo);

        const result = await request.query(`
            SELECT DISTINCT
                R.[cod de articulo] as articulo,
                ISNULL(MA.[denominacion articulo], '') as denominacion
            FROM [RUTAS] R
            LEFT JOIN [MAESTRO ARTICULOS] MA ON R.[cod de articulo] = MA.[codigo articulo]
            WHERE R.[codigo operacion] = @codigo
            ORDER BY R.[cod de articulo]
        `);

        res.json({
            success: true,
            data: result.recordset,
            count: result.recordset.length,
            operacion: codigo
        });

    } catch (err) {
        console.error('Error SQL en /api/operaciones/:codigo/rutas:', err);
        res.status(500).json({
            success: false,
            error: 'Error al obtener los artículos.',
            details: err.message
        });
    }
});

// Endpoint para actualizar ComputoOEE de una operación
app.put('/api/operaciones/:codigo/computo-oee', async (req, res) => {
    try {
        const { codigo } = req.params;
        const { computoOEE, userId } = req.body;

        // Validate computoOEE value
        if (computoOEE === undefined || (computoOEE !== 0 && computoOEE !== 1)) {
            return res.status(400).json({
                success: false,
                error: 'El valor de ComputoOEE debe ser 0 o 1'
            });
        }

        // Verify user permissions
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Usuario no autenticado'
            });
        }

        // Get user role
        const userResult = await sql.query`
            SELECT rol FROM USUARIOS_APP WHERE id_usuario = ${userId}
        `;

        if (userResult.recordset.length === 0) {
            return res.status(401).json({
                success: false,
                error: 'Usuario no encontrado'
            });
        }

        const userRole = userResult.recordset[0].rol;

        // Only admin and supervisor can edit ComputoOEE
        if (userRole !== 'admin' && userRole !== 'supervisor') {
            return res.status(403).json({
                success: false,
                error: 'No tienes permisos para editar ComputoOEE. Contacta con un administrador.'
            });
        }

        // Update ComputoOEE
        const request = new sql.Request();
        request.input('codigo', sql.NVarChar, codigo);
        request.input('computoOEE', sql.Int, computoOEE);

        const result = await request.query(`
            UPDATE [OPERACIONES]
            SET [ComputoOEE] = @computoOEE
            WHERE [codigo operacion] = @codigo
        `);

        if (result.rowsAffected[0] > 0) {
            res.json({
                success: true,
                message: 'ComputoOEE actualizado correctamente'
            });
        } else {
            res.status(404).json({
                success: false,
                error: 'Operación no encontrada'
            });
        }

    } catch (err) {
        console.error('Error SQL en /api/operaciones/:codigo/computo-oee:', err);
        res.status(500).json({
            success: false,
            error: 'Error al actualizar ComputoOEE.',
            details: err.message
        });
    }
});

// Endpoint para obtener activos
app.get('/api/activos', async (req, res) => {
    try {
        const { activo, zona } = req.query;

        const request = new sql.Request();
        let whereConditions = [];

        if (activo) {
            request.input('activo', sql.NVarChar, activo);
            whereConditions.push('A.[codigo activo] = @activo');
        }

        if (zona) {
            request.input('zona', sql.NVarChar, zona);
            whereConditions.push('A.[codigo zona] = @zona');
        }

        let query = `
            SELECT
                A.[codigo activo],
                A.[denominacion activo],
                
                
                A.[codigo zona],
                Z.[denominacion zona]
            FROM [MAESTRO ACTIVOS] A
            LEFT JOIN [MAESTRO ZONAS ACTIVOS] Z ON A.[codigo zona] = Z.[codigo zona]
        `;

        if (whereConditions.length > 0) {
            query += ' WHERE ' + whereConditions.join(' AND ');
        }

        query += ' ORDER BY A.[codigo activo]';

        const result = await request.query(query);

        // Get all activos for dropdown
        const activosListQuery = await sql.query`
            SELECT [codigo activo], [denominacion activo]
            FROM [MAESTRO ACTIVOS]
            ORDER BY [codigo activo]
        `;
        const activosList = activosListQuery.recordset.map(r => ({
            codigo: r['codigo activo'],
            denominacion: r['denominacion activo'] || ''
        }));

        // Get all zonas directly from MAESTRO ZONAS ACTIVOS
        const zonasQuery = await sql.query`
            SELECT [codigo zona], [denominacion zona]
            FROM [MAESTRO ZONAS ACTIVOS]
            ORDER BY [codigo zona]
        `;
        const zonas = zonasQuery.recordset.map(r => ({
            codigo: r['codigo zona'],
            denominacion: r['denominacion zona'] || ''
        })).filter(z => z.codigo);

        res.json({
            success: true,
            data: result.recordset,
            count: result.recordset.length,
            activosList: activosList,
            zonas: zonas,
            timestamp: new Date()
        });

    } catch (err) {
        console.error('Error SQL en /api/activos:', err);
        res.status(500).json({
            success: false,
            error: 'Error al obtener los activos.',
            details: err.message
        });
    }
});

// Endpoint para obtener centros (MAQUINAS)
app.get('/api/centros', async (req, res) => {
    try {
        const { seccion, tipo, estado } = req.query;

        const request = new sql.Request();
        let whereConditions = [];

        if (seccion) {
            request.input('seccion', sql.NVarChar, seccion);
            whereConditions.push('[seccion] = @seccion');
        }

        if (tipo) {
            request.input('tipo', sql.NVarChar, tipo);
            whereConditions.push('[tipo] = @tipo');
        }

        if (estado) {
            // Convert 'si'/'no' to database values
            if (estado === 'si') {
                whereConditions.push('([Estado] = -1 OR [Estado] = 1)');
            } else if (estado === 'no') {
                whereConditions.push('([Estado] = 0 OR [Estado] IS NULL)');
            } else {
                request.input('estado', sql.Int, parseInt(estado));
                whereConditions.push('[Estado] = @estado');
            }
        }

        let query = `
            SELECT
                [cod de maquina] as codMaquina,
                [descripcion],
                [tipo],
                [seccion],
                [Estado] as estado
            FROM [MAQUINAS]
        `;

        if (whereConditions.length > 0) {
            query += ' WHERE ' + whereConditions.join(' AND ');
        }

        query += ' ORDER BY [cod de maquina]';

        const result = await request.query(query);

        // Get distinct values for filters
        const seccionesQuery = await sql.query`
            SELECT DISTINCT [seccion]
            FROM [MAQUINAS]
            WHERE [seccion] IS NOT NULL AND [seccion] <> ''
            ORDER BY [seccion]
        `;
        const secciones = seccionesQuery.recordset.map(r => r.seccion);

        const tiposQuery = await sql.query`
            SELECT DISTINCT [tipo]
            FROM [MAQUINAS]
            WHERE [tipo] IS NOT NULL AND [tipo] <> ''
            ORDER BY [tipo]
        `;
        const tipos = tiposQuery.recordset.map(r => r.tipo);

        const estadosQuery = await sql.query`
            SELECT DISTINCT [Estado]
            FROM [MAQUINAS]
            WHERE [Estado] IS NOT NULL AND [Estado] <> ''
            ORDER BY [Estado]
        `;
        const estados = estadosQuery.recordset.map(r => r.Estado);

        res.json({
            success: true,
            data: result.recordset,
            count: result.recordset.length,
            secciones: secciones,
            tipos: tipos,
            estados: estados,
            timestamp: new Date()
        });

    } catch (err) {
        console.error('Error SQL en /api/centros:', err);
        res.status(500).json({
            success: false,
            error: 'Error al obtener los centros.',
            details: err.message
        });
    }
});

// Endpoint para obtener equipos (CALIBRACIONES from Fw_Comunes database)
app.get('/api/equipos', async (req, res) => {
    try {
        const { equipo, empresa, area, subarea, page = 1, pageSize = 50, sortBy, sortOrder } = req.query;
        console.log('API EQUIPOS CALLED - v2 (Fixed Columns)'); // DEBUG LOG
        const offset = (parseInt(page) - 1) * parseInt(pageSize);

        // Connect to Fw_Comunes database
        const comunesConfig = {
            ...sqlConfig,
            database: 'Fw_Comunes'
        };

        const pool = await sql.connect(comunesConfig);

        // 1. Get Distinct values for filters (Empresa, Area, Subarea)
        const filtersQuery = `
            SELECT DISTINCT [EMPRESA] FROM [CALIBRACIONES] WHERE [EMPRESA] IS NOT NULL AND [EMPRESA] <> '' ORDER BY [EMPRESA];
            SELECT DISTINCT [AREA] FROM [CALIBRACIONES] WHERE [AREA] IS NOT NULL AND [AREA] <> '' ORDER BY [AREA];
            SELECT DISTINCT [Subarea] FROM [CALIBRACIONES] WHERE [Subarea] IS NOT NULL AND [Subarea] <> '' ORDER BY [Subarea];
        `;
        const filtersResult = await pool.request().query(filtersQuery);
        const empresas = filtersResult.recordsets[0].map(r => r.EMPRESA);
        const areas = filtersResult.recordsets[1].map(r => r.AREA);
        const subareas = filtersResult.recordsets[2].map(r => r.Subarea);

        // 2. Main Data Query Setup
        const request = pool.request();
        let whereConditions = [];

        // Note: Using aliases C for CALIBRACIONES, P for PERIODOS, D for CALIBRACIONES DETALLE
        if (equipo) {
            request.input('equipo', sql.NVarChar, `%${equipo}%`);
            whereConditions.push('C.[Nº REF] LIKE @equipo');
        }
        if (empresa) {
            request.input('empresa', sql.NVarChar, empresa);
            whereConditions.push('C.[EMPRESA] = @empresa');
        }
        if (area) {
            request.input('area', sql.NVarChar, area);
            whereConditions.push('C.[AREA] = @area');
        }
        if (subarea) {
            request.input('subarea', sql.NVarChar, subarea);
            whereConditions.push('C.[Subarea] = @subarea');
        }

        // Retirado filter
        // Logic: Active if Fecha Retirada is NULL. Retired if NOT NULL.
        // Values: '0' = Activos (active), '1' = Retirados (retired)
        if (req.query.retirado) {
            if (req.query.retirado === '1') {
                whereConditions.push('(C.[Fecha Retirada] IS NOT NULL OR C.[RETIRADO] = -1)');
            } else if (req.query.retirado === '0') {
                whereConditions.push('(C.[Fecha Retirada] IS NULL AND (C.[RETIRADO] = 0 OR C.[RETIRADO] IS NULL))');
            }
        }

        const whereClause = whereConditions.length > 0 ? ' WHERE ' + whereConditions.join(' AND ') : '';

        // Sorting map
        const validSortColumns = {
            'Nº REF': 'C.[Nº REF]',
            'NOMBRE INSTRUMENTO': 'C.[NOMBRE INSTRUMENTO]',
            'EMPRESA': 'C.[EMPRESA]',
            'AREA': 'C.[AREA]',
            'Subarea': 'C.[Subarea]',
            'NºEC': 'C.[NºEC]',
            'PERIODICIDAD': 'C.[PERIODICIDAD]',
            'ORGANISMO': 'C.[ORGANISMO EXTERIOR DE CALIBRACION]',
            'proxima': 'proxima',
            'apto': 'apto',
            'Fecha Retirada': 'C.[Fecha Retirada]',
            'inicial': 'inicial'
        };
        const sortCol = validSortColumns[sortBy] || 'C.[Nº REF]';
        const sortDir = sortOrder === 'DESC' ? 'DESC' : 'ASC';

        // Count Query (Total items matching filter)
        const countQuery = `SELECT COUNT(DISTINCT C.[Nº REF]) as total FROM [CALIBRACIONES] C ${whereClause}`;
        const countResult = await request.query(countQuery);
        const total = countResult.recordset[0].total;

        // KPI: Total Active Equipment (Filtered)
        // Active logic: Fecha Retirada IS NULL AND RETIRADO Is Not 'Si'
        // Filter logic: Apply all current filters EXCEPT 'retirado' because we want to count actives regardless of if user is looking at retireds?
        // Actually, usually "Active Equipment" KPI on the dashboard shows the count of active equipment that match the other criteria (Activity/Area/etc).
        let activeWhereConditions = whereConditions.filter(c => !c.includes('Fecha Retirada') && !c.includes('RETIRADO'));
        activeWhereConditions.push('(C.[Fecha Retirada] IS NULL AND (C.[RETIRADO] = 0 OR C.[RETIRADO] IS NULL))');
        const activeWhereClause = activeWhereConditions.length > 0 ? ' WHERE ' + activeWhereConditions.join(' AND ') : '';

        const activeCountQuery = `SELECT COUNT(DISTINCT C.[Nº REF]) as totalActive FROM [CALIBRACIONES] C ${activeWhereClause}`;
        const activeCountResult = await request.query(activeCountQuery);
        const totalActive = activeCountResult.recordset[0].totalActive;

        // KPI: Total Inactive (Retirado)
        const inactiveCountQuery = `SELECT COUNT(DISTINCT C.[Nº REF]) as totalInactive FROM [CALIBRACIONES] C WHERE (C.[Fecha Retirada] IS NOT NULL OR C.[RETIRADO] = -1)`;
        const inactiveCountResult = await request.query(inactiveCountQuery);
        const totalInactive = inactiveCountResult.recordset[0].totalInactive;

        // KPI: Count by Empresa
        const empresaCountQuery = `SELECT C.[EMPRESA], COUNT(DISTINCT C.[Nº REF]) as count FROM [CALIBRACIONES] C GROUP BY C.[EMPRESA] ORDER BY count DESC`;
        const empresaCountResult = await request.query(empresaCountQuery);
        const empresaCounts = empresaCountResult.recordset;

        // KPI: Count by Area
        // KPI: Count by Area
        const areaCountQuery = `SELECT C.[AREA], COUNT(DISTINCT C.[Nº REF]) as count FROM [CALIBRACIONES] C GROUP BY C.[AREA] ORDER BY count DESC`;
        const areaCountResult = await request.query(areaCountQuery);
        const areaCounts = areaCountResult.recordset;

        // KPI: Count by Subarea
        const subareaCountQuery = `SELECT C.[Subarea], COUNT(DISTINCT C.[Nº REF]) as count FROM [CALIBRACIONES] C WHERE C.[Subarea] IS NOT NULL AND C.[Subarea] <> '' GROUP BY C.[Subarea] ORDER BY count DESC`;
        const subareaCountResult = await request.query(subareaCountQuery);
        const subareaCounts = subareaCountResult.recordset;

        // Data Query
        const query = `
            SELECT
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
                C.[NOMBRE INSTRUMENTO],
                C.[ORGANISMO EXTERIOR DE CALIBRACION],
                C.FAMILIA,
                C.PERIODICIDAD,
                C.[INTERNO/EXTERNO],
                C.[CAMPO MEDIDA],
                C.OBSERVACIONES,
                C.[MARCA/FABRICANTE],
                C.[MODELO/TIPO],
                C.[Nº DE SERIE],
                C.[DIVISION DE ESCALA],
                C.[FECHA DE RECEPCION],
                C.[PROCEDIMIENTO CALIBRACION],
                C.[CRITERIO DE ACEPTACION Y RECHAZO],
                CASE WHEN ISNULL(C.PERIODICIDAD, 'X') = 'INICIAL' THEN -1 ELSE 0 END AS inicial,
                C.[NºEC],
                C.[Subarea],
                C.[Fecha Retirada],
                C.[Fecha Apertura/Instalacion]
            FROM [CALIBRACIONES] C
            LEFT JOIN [CALIBRACIONES DETALLE] D ON C.[Nº REF] = D.[Nº REF]
            LEFT JOIN [PERIODOS] P ON C.PERIODICIDAD = P.periodo
            ${whereClause}
            GROUP BY 
                C.EMPRESA, C.AREA, C.[Nº REF], C.[NOMBRE INSTRUMENTO], 
                C.[ORGANISMO EXTERIOR DE CALIBRACION], C.FAMILIA, C.PERIODICIDAD, 
                C.[INTERNO/EXTERNO], C.[CAMPO MEDIDA], C.OBSERVACIONES, 
                C.[MARCA/FABRICANTE], C.[MODELO/TIPO], C.[Nº DE SERIE], 
                C.[DIVISION DE ESCALA], C.[FECHA DE RECEPCION], C.[PROCEDIMIENTO CALIBRACION], 
                C.[CRITERIO DE ACEPTACION Y RECHAZO], 
                CASE WHEN ISNULL(C.PERIODICIDAD, 'X') = 'INICIAL' THEN -1 ELSE 0 END, 
                C.[NºEC], C.[Subarea], C.[Fecha Retirada], C.[Fecha Apertura/Instalacion]
            ORDER BY ${sortCol} ${sortDir}
            OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
        `;

        request.input('offset', sql.Int, offset);
        request.input('pageSize', sql.Int, parseInt(pageSize));

        const result = await request.query(query);

        // Reconnect to main database
        await sql.connect(sqlConfig);

        res.json({
            success: true,
            data: result.recordset,
            total: total,
            totalActive: totalActive,
            totalInactive: totalInactive,
            kpiEmpresa: empresaCounts,
            kpiEmpresa: empresaCounts,
            kpiArea: areaCounts,
            kpiSubarea: subareaCounts,
            page: parseInt(page),
            pageSize: parseInt(pageSize),
            totalPages: Math.ceil(total / parseInt(pageSize)),
            empresas: empresas,
            areas: areas,
            subareas: subareas,
            timestamp: new Date()
        });

    } catch (err) {
        console.error('Error SQL en /api/equipos:', err);
        // Try to reconnect to main database in case of error
        try { await sql.connect(sqlConfig); } catch (e) { }
        res.status(500).json({
            success: false,
            error: 'Error al obtener los equipos.',
            details: err.message
        });
    }
});

// Endpoint para obtener próximas calibraciones (próximo mes)
app.get('/api/equipos/proximas', async (req, res) => {
    try {
        const comunesConfig = { ...sqlConfig, database: 'Fw_Comunes' };
        const pool = await sql.connect(comunesConfig);

        // Logic: Calculate 'proxima', filtering for range [Now, Now + 1 Month]
        // See implementation_plan.md for calculating 'proxima' logic re-use or simplication
        const query = `
            WITH CalibracionesCalculadas AS (
                SELECT
                    C.[Nº REF],
                    C.[NOMBRE INSTRUMENTO],
                    C.EMPRESA,
                    C.AREA,
                    MAX(CASE 
                        WHEN P.tipo IS NULL THEN NULL
                        WHEN P.tipo = 'd' THEN DATEADD(day, P.cantidad, D.[Fecha - F])
                        WHEN P.tipo = 'm' THEN DATEADD(month, P.cantidad, D.[Fecha - F])
                        WHEN P.tipo = 'yyyy' THEN DATEADD(year, P.cantidad, D.[Fecha - F])
                        ELSE NULL 
                    END) AS proxima
                FROM [CALIBRACIONES] C
                LEFT JOIN [CALIBRACIONES DETALLE] D ON C.[Nº REF] = D.[Nº REF]
                LEFT JOIN [PERIODOS] P ON C.PERIODICIDAD = P.periodo
                WHERE (C.[Fecha Retirada] IS NULL AND (C.[RETIRADO] = 0 OR C.[RETIRADO] IS NULL))
                GROUP BY C.[Nº REF], C.[NOMBRE INSTRUMENTO], C.EMPRESA, C.AREA
            )
            SELECT TOP 50 *
            FROM CalibracionesCalculadas
            WHERE proxima BETWEEN GETDATE() AND DATEADD(month, 1, GETDATE())
            ORDER BY proxima ASC
        `;

        const result = await pool.request().query(query);

        // Reconnect to main database
        await sql.connect(sqlConfig);

        res.json({
            success: true,
            data: result.recordset,
            timestamp: new Date()
        });

    } catch (err) {
        console.error('Error SQL en /api/equipos/proximas:', err);
        try { await sql.connect(sqlConfig); } catch (e) { }
        res.status(500).json({ success: false, error: err.message });
    }
});

// Endpoint para obtener calibraciones caducadas (anteriores a hoy)
app.get('/api/equipos/caducadas', async (req, res) => {
    try {
        const comunesConfig = { ...sqlConfig, database: 'Fw_Comunes' };
        const pool = await sql.connect(comunesConfig);

        const query = `
            WITH CalibracionesCalculadas AS (
                SELECT
                    C.[Nº REF],
                    C.[NOMBRE INSTRUMENTO],
                    C.EMPRESA,
                    C.AREA,
                    MAX(CASE 
                        WHEN P.tipo IS NULL THEN NULL
                        WHEN P.tipo = 'd' THEN DATEADD(day, P.cantidad, D.[Fecha - F])
                        WHEN P.tipo = 'm' THEN DATEADD(month, P.cantidad, D.[Fecha - F])
                        WHEN P.tipo = 'yyyy' THEN DATEADD(year, P.cantidad, D.[Fecha - F])
                        ELSE NULL 
                    END) AS proxima
                FROM [CALIBRACIONES] C
                LEFT JOIN [CALIBRACIONES DETALLE] D ON C.[Nº REF] = D.[Nº REF]
                LEFT JOIN [PERIODOS] P ON C.PERIODICIDAD = P.periodo
                WHERE (C.[Fecha Retirada] IS NULL AND (C.[RETIRADO] = 0 OR C.[RETIRADO] IS NULL))
                GROUP BY C.[Nº REF], C.[NOMBRE INSTRUMENTO], C.EMPRESA, C.AREA
            )
            SELECT TOP 50 *
            FROM CalibracionesCalculadas
            WHERE proxima < GETDATE()
            ORDER BY proxima ASC
        `;

        const result = await pool.request().query(query);

        // Reconnect to main database
        await sql.connect(sqlConfig);

        res.json({
            success: true,
            data: result.recordset,
            timestamp: new Date()
        });

    } catch (err) {
        console.error('Error SQL en /api/equipos/caducadas:', err);
        try { await sql.connect(sqlConfig); } catch (e) { }
        res.status(500).json({ success: false, error: err.message });
    }
});

// Endpoint para obtener detalle de un equipo (Modal)
app.get('/api/equipos/:id', async (req, res) => {
    try {
        const { id } = req.params; // id is Nº REF, decoded

        const comuniConfig = { ...sqlConfig, database: 'Fw_Comunes' };
        const pool = await sql.connect(comuniConfig);

        const request = pool.request();
        request.input('id', sql.NVarChar, id);

        // Fetch Main Info
        const queryMain = `
            SELECT TOP 1 C.*, 
            MAX(CASE 
                    WHEN P.tipo IS NULL THEN NULL
                    WHEN P.tipo = 'd' THEN DATEADD(day, P.cantidad, D.[Fecha - F])
                    WHEN P.tipo = 'm' THEN DATEADD(month, P.cantidad, D.[Fecha - F])
                    WHEN P.tipo = 'yyyy' THEN DATEADD(year, P.cantidad, D.[Fecha - F])
                    ELSE NULL 
                END) AS proxima
            FROM [CALIBRACIONES] C
            LEFT JOIN [PERIODOS] P ON C.PERIODICIDAD = P.periodo
            LEFT JOIN [CALIBRACIONES DETALLE] D ON C.[Nº REF] = D.[Nº REF]
            WHERE C.[Nº REF] = @id
            GROUP BY 
                C.EMPRESA, C.AREA, C.Subarea, C.[Nº REF], C.[NOMBRE INSTRUMENTO], C.[Nº REF PAREJA],
                C.[Nº DE SERIE], C.[MODELO/TIPO], C.[MARCA/FABRICANTE], C.OBSERVACIONES,
                C.[CAMPO MEDIDA], C.[CRITERIO DE ACEPTACION Y RECHAZO], C.FAMILIA,
                C.[DIVISION DE ESCALA], C.[FECHA DE RECEPCION], C.[PROCEDIMIENTO CALIBRACION],
                C.[ORGANISMO EXTERIOR DE CALIBRACION], C.PERIODICIDAD, C.[INTERNO/EXTERNO],
                C.RETIRADO, C.Etiqueta, C.INCIDENCIAS, C.IdEspecificacion, C.[ACCEPTANCE CRITERIA],
                C.FechaCreacionAudi, C.tm, C.[activo asociado], C.NºEC, C.[meses apto],
                C.solicitada, C.[codigo tipo], C.[codigo familia], C.[codigo subfamilia],
                C.descripcion, C.[Fecha Retirada], C.[Fecha Apertura/Instalacion]
        `;
        const resultMain = await request.query(queryMain);

        // Fetch Details (History)
        const queryDetails = `
            SELECT D.* 
            FROM [CALIBRACIONES DETALLE] D
            WHERE D.[Nº REF] = @id
            ORDER BY D.[Fecha - F] DESC
        `;
        const resultDetails = await request.query(queryDetails);

        await sql.connect(sqlConfig);

        if (resultMain.recordset.length === 0) {
            return res.status(404).json({ success: false, error: 'Equipo no encontrado' });
        }

        res.json({
            success: true,
            data: resultMain.recordset[0],
            history: resultDetails.recordset
        });

    } catch (err) {
        console.error('Error SQL en /api/equipos/:id:', err);
        try { await sql.connect(sqlConfig); } catch (e) { }
        res.status(500).json({ success: false, error: err.message });
    }
});

// Endpoint para obtener proveedores
app.get('/api/proveedores', async (req, res) => {
    try {
        const { proveedor } = req.query;

        const request = new sql.Request();
        let whereConditions = [];

        if (proveedor) {
            request.input('proveedor', sql.NVarChar, `%${proveedor}%`);
            whereConditions.push('([codigo proveedor] LIKE @proveedor OR [denominacion proveedor] LIKE @proveedor)');
        }

        let query = `
            SELECT
                [codigo proveedor],
                [denominacion proveedor],
                [email],
                [telefono1],
                [telefono2]
            FROM [PROVEEDORES MAESTRO]
        `;

        if (whereConditions.length > 0) {
            query += ' WHERE ' + whereConditions.join(' AND ');
        }

        query += ' ORDER BY [denominacion proveedor]';

        const result = await request.query(query);

        res.json({
            success: true,
            data: result.recordset,
            count: result.recordset.length,
            timestamp: new Date()
        });

    } catch (err) {
        console.error('Error SQL en /api/proveedores:', err);
        res.status(500).json({
            success: false,
            error: 'Error al obtener los proveedores.',
            details: err.message
        });
    }
});

// Endpoint para obtener clientes
app.get('/api/clientes-maestro', async (req, res) => {
    try {
        const { cliente } = req.query;

        const request = new sql.Request();
        let whereConditions = [];

        if (cliente) {
            request.input('cliente', sql.NVarChar, `%${cliente}%`);
            whereConditions.push('([codigo cliente] LIKE @cliente OR [nombre empresa] LIKE @cliente)');
        }

        let query = `
            SELECT
                [codigo cliente],
                [nombre empresa],
                [Email],
                [telefono],
                [Codigo Estado]
            FROM [MAESTRO CLIENTES]
        `;

        if (whereConditions.length > 0) {
            query += ' WHERE ' + whereConditions.join(' AND ');
        }

        query += ' ORDER BY [nombre empresa]';

        const result = await request.query(query);

        res.json({
            success: true,
            data: result.recordset,
            count: result.recordset.length,
            timestamp: new Date()
        });

    } catch (err) {
        console.error('Error SQL en /api/clientes-maestro:', err);
        res.status(500).json({
            success: false,
            error: 'Error al obtener los clientes.',
            details: err.message
        });
    }
});

// Endpoint para obtener normas
app.get('/api/normas', async (req, res) => {
    try {
        const { tipoNorma, normaCliente, control, actual } = req.query;

        const request = new sql.Request();
        let whereConditions = [];

        if (tipoNorma) {
            request.input('tipoNorma', sql.NVarChar, tipoNorma);
            whereConditions.push('[Tipo Norma] = @tipoNorma');
        }

        if (normaCliente) {
            request.input('normaCliente', sql.NVarChar, `%${normaCliente}%`);
            whereConditions.push('[Norma/Cliente] LIKE @normaCliente');
        }

        if (control) {
            request.input('control', sql.NVarChar, control);
            whereConditions.push('[Control] = @control');
        }

        if (actual) {
            if (actual === 'si') {
                whereConditions.push('([Actual] = 1 AND [Actual] IS NOT NULL)');
            } else if (actual === 'no') {
                whereConditions.push('([Actual] = 0 OR [Actual] IS NULL)');
            }
        }

        let query = `
            SELECT
                [Tipo/Referencia],
                [Edición],
                [Fecha Norma],
                [Estado],
                [Designación],
                [Tipo Norma],
                [Norma/Cliente],
                [Norma/Cliente],
                [Control],
                [Actual]
            FROM [NORMASN]
        `;

        if (whereConditions.length > 0) {
            query += ' WHERE ' + whereConditions.join(' AND ');
        }

        query += ' ORDER BY [Tipo/Referencia]';

        console.log('Query Normas:', query); // Debug log

        const result = await request.query(query);

        // Get distinct values using the same request methodology (create new request to clear params if needed, or just run query)
        // It is safer to create a new request for clean slate
        const requestDistinct = new sql.Request();

        const tipoNormasQuery = `
            SELECT DISTINCT [Tipo Norma]
            FROM [NORMASN]
            WHERE [Tipo Norma] IS NOT NULL AND [Tipo Norma] <> ''
            ORDER BY [Tipo Norma]
        `;
        const resultTipo = await requestDistinct.query(tipoNormasQuery);
        const tipoNormas = resultTipo.recordset.map(r => r['Tipo Norma']);

        const controlesQuery = `
            SELECT DISTINCT [Control]
            FROM [NORMASN]
            WHERE [Control] IS NOT NULL AND [Control] <> ''
            ORDER BY [Control]
        `;
        const resultControl = await requestDistinct.query(controlesQuery);
        const controles = resultControl.recordset.map(r => r.Control);

        res.json({
            success: true,
            data: result.recordset,
            count: result.recordset.length,
            tipoNormas: tipoNormas,
            controles: controles,
            timestamp: new Date()
        });

    } catch (err) {
        console.error('Error SQL en /api/normas:', err);
        res.status(500).json({
            success: false,
            error: 'Error al obtener las normas.',
            details: err.message
        });
    }
});

// Endpoint que ejecuta el SP dinámico de tratamientos
app.get('/api/tratamientos-dinamicos', async (req, res) => {
    try {
        const pool = app.locals.db;
        const result = await pool.request().execute('sp_VistaTratamientosDinamica');

        res.json({
            success: true,
            data: result.recordset,
            count: result.recordset.length,
            timestamp: new Date()
        });

    } catch (err) {
        console.error('? Error SQL en /api/tratamientos-dinamicos:', err);
        res.status(500).json({
            success: false,
            error: 'Error al ejecutar el procedimiento almacenado.',
            details: err.message
        });
    }
});

// ============================================
// USER AUTHENTICATION ENDPOINTS
// ============================================

// Endpoint para obtener lista de usuarios (para dropdown de login)
app.get('/api/users', async (req, res) => {
    try {
        const result = await sql.query`
            SELECT [username], [nombre_completo], [iniciales]
            FROM [USUARIOS_APP]
            WHERE [activo] = 1
            ORDER BY [nombre_completo]
        `;

        res.json({
            success: true,
            users: result.recordset,
            count: result.recordset.length
        });

    } catch (err) {
        console.error('Error SQL en /api/users:', err);
        res.status(500).json({
            success: false,
            error: 'Error al obtener la lista de usuarios.',
            details: err.message
        });
    }
});

// Endpoint para autenticación de login
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                success: false,
                error: 'Usuario y contraseña son requeridos.'
            });
        }

        const request = new sql.Request();
        request.input('username', sql.NVarChar, username);
        request.input('password', sql.NVarChar, password);

        const result = await request.query(`
            SELECT [username], [nombre_completo], [iniciales], [rol]
            FROM [USUARIOS_APP]
            WHERE [username] = @username AND [password] = @password AND [activo] = 1
        `);

        if (result.recordset.length > 0) {
            const user = result.recordset[0];
            res.json({
                success: true,
                user: {
                    id: user.username,
                    name: user.nombre_completo,
                    initials: user.iniciales,
                    rol: user.rol || 'usuario'
                }
            });
        } else {
            res.status(401).json({
                success: false,
                error: 'Credenciales inválidas.'
            });
        }

    } catch (err) {
        console.error('Error SQL en /api/login:', err);
        res.status(500).json({
            success: false,
            error: 'Error al autenticar usuario.',
            details: err.message
        });
    }
});

// Health check
app.get('/api/health', async (req, res) => {
    if (sql.connected) {
        res.json({ status: 'online', database: 'connected' });
    } else {
        res.status(503).json({ status: 'offline', error: 'Database connection pool is not active.' });
    }
});

// --- API ENSAYOS ---

// Dashboard Ensayos
app.get('/api/ensayos/dashboard', async (req, res) => {
    try {
        const { year, month } = req.query;
        const request = new sql.Request();
        if (year) request.input('year', sql.Int, parseInt(year));

        let yearClause = year ? 'WHERE YEAR(T.Fecha) = @year' : '';

        // Add month filter if provided
        if (month) {
            request.input('month', sql.Int, parseInt(month));
            if (yearClause) {
                yearClause += ' AND MONTH(T.Fecha) = @month';
            } else {
                yearClause = 'WHERE MONTH(T.Fecha) = @month';
            }
        }

        const fullQuery = `
             WITH Combined AS (
                SELECT 'RT' as Type, T.Fecha, ISNULL(C.Nombre, T.[Inspeccionado Por]) as Inspector, T.Referencia 
                FROM [RX_X_INFORME RX LOTE] T LEFT JOIN [RX_LIST-CERTIFICADOS END] C ON T.[Inspeccionado Por] = C.Id ${yearClause}
                UNION ALL
                SELECT 'VT' as Type, T.Fecha, ISNULL(C.Nombre, T.[Inspeccionado Por]) as Inspector, T.Referencia 
                FROM [RX_X_INFORME VIS LOTE] T LEFT JOIN [RX_LIST-CERTIFICADOS END] C ON T.[Inspeccionado Por] = C.Id ${yearClause}
                UNION ALL
                SELECT 'PT' as Type, T.Fecha, ISNULL(C.Nombre, T.[Inspeccionado Por]) as Inspector, T.Referencia 
                FROM [RX_X_INFORME LP LOTE] T LEFT JOIN [RX_LIST-CERTIFICADOS END] C ON T.[Inspeccionado Por] = C.Id ${yearClause}
             )
             SELECT Type, COUNT(*) as Total FROM Combined GROUP BY Type;
             
             WITH Combined AS (
                SELECT 'RT' as Type, T.Fecha, ISNULL(C.Nombre, T.[Inspeccionado Por]) as Inspector, T.Referencia 
                FROM [RX_X_INFORME RX LOTE] T LEFT JOIN [RX_LIST-CERTIFICADOS END] C ON T.[Inspeccionado Por] = C.Id ${yearClause}
                UNION ALL
                SELECT 'VT' as Type, T.Fecha, ISNULL(C.Nombre, T.[Inspeccionado Por]) as Inspector, T.Referencia 
                FROM [RX_X_INFORME VIS LOTE] T LEFT JOIN [RX_LIST-CERTIFICADOS END] C ON T.[Inspeccionado Por] = C.Id ${yearClause}
                UNION ALL
                SELECT 'PT' as Type, T.Fecha, ISNULL(C.Nombre, T.[Inspeccionado Por]) as Inspector, T.Referencia 
                FROM [RX_X_INFORME LP LOTE] T LEFT JOIN [RX_LIST-CERTIFICADOS END] C ON T.[Inspeccionado Por] = C.Id ${yearClause}
             )
             SELECT MONTH(Fecha) as Month, Type, COUNT(*) as Total FROM Combined GROUP BY MONTH(Fecha), Type ORDER BY Month;

             WITH Combined AS (
                SELECT 'RT' as Type, T.Fecha, ISNULL(C.Nombre, T.[Inspeccionado Por]) as Inspector, T.Referencia 
                FROM [RX_X_INFORME RX LOTE] T LEFT JOIN [RX_LIST-CERTIFICADOS END] C ON T.[Inspeccionado Por] = C.Id ${yearClause}
                UNION ALL
                SELECT 'VT' as Type, T.Fecha, ISNULL(C.Nombre, T.[Inspeccionado Por]) as Inspector, T.Referencia 
                FROM [RX_X_INFORME VIS LOTE] T LEFT JOIN [RX_LIST-CERTIFICADOS END] C ON T.[Inspeccionado Por] = C.Id ${yearClause}
                UNION ALL
                SELECT 'PT' as Type, T.Fecha, ISNULL(C.Nombre, T.[Inspeccionado Por]) as Inspector, T.Referencia 
                FROM [RX_X_INFORME LP LOTE] T LEFT JOIN [RX_LIST-CERTIFICADOS END] C ON T.[Inspeccionado Por] = C.Id ${yearClause}
             )
             SELECT TOP 10 Inspector, Type, COUNT(*) as Total 
             FROM Combined 
             GROUP BY Inspector, Type 
             ORDER BY SUM(COUNT(*)) OVER (PARTITION BY Inspector) DESC, Inspector, Type;

             WITH Combined AS (
                SELECT 'RT' as Type, T.Fecha, ISNULL(C.Nombre, T.[Inspeccionado Por]) as Inspector, T.Referencia 
                FROM [RX_X_INFORME RX LOTE] T LEFT JOIN [RX_LIST-CERTIFICADOS END] C ON T.[Inspeccionado Por] = C.Id ${yearClause}
                UNION ALL
                SELECT 'VT' as Type, T.Fecha, ISNULL(C.Nombre, T.[Inspeccionado Por]) as Inspector, T.Referencia 
                FROM [RX_X_INFORME VIS LOTE] T LEFT JOIN [RX_LIST-CERTIFICADOS END] C ON T.[Inspeccionado Por] = C.Id ${yearClause}
                UNION ALL
                SELECT 'PT' as Type, T.Fecha, ISNULL(C.Nombre, T.[Inspeccionado Por]) as Inspector, T.Referencia 
                FROM [RX_X_INFORME LP LOTE] T LEFT JOIN [RX_LIST-CERTIFICADOS END] C ON T.[Inspeccionado Por] = C.Id ${yearClause}
             )
             SELECT TOP 10 
                Referencia as Articulo, 
                COUNT(*) as Total,
                SUM(CASE WHEN Type = 'RT' THEN 1 ELSE 0 END) as RT,
                SUM(CASE WHEN Type = 'VT' THEN 1 ELSE 0 END) as VT,
                SUM(CASE WHEN Type = 'PT' THEN 1 ELSE 0 END) as PT
             FROM Combined GROUP BY Referencia ORDER BY Total DESC;
        `;

        const result = await request.query(fullQuery);
        res.json({
            counts: result.recordsets[0],
            trend: result.recordsets[1],
            inspectors: result.recordsets[2],
            articles: result.recordsets[3]
        });
    } catch (err) {
        console.error('Error en /api/ensayos/dashboard:', err);
        res.status(500).json({ error: 'Error al obtener datos del dashboard de ensayos.' });
    }
});

// RT
app.get('/api/ensayos/rt', async (req, res) => {
    try {
        const { articulo, tratamiento, page = 1, pageSize = 50, sortBy, sortOrder } = req.query;
        const pageNum = parseInt(page) || 1;
        const pageSizeNum = parseInt(pageSize) || 50;
        const offset = Math.max(0, (pageNum - 1) * pageSizeNum);
        const request = new sql.Request();
        let whereConditions = [];


        if (articulo) {
            request.input('articulo', sql.NVarChar, articulo);
            whereConditions.push("Referencia LIKE '%' + @articulo + '%'");
        }
        if (tratamiento) {
            request.input('tratamiento', sql.NVarChar, tratamiento);
            whereConditions.push("Tratamiento = @tratamiento");
        }

        let whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

        // Sorting
        let orderByClause = 'ORDER BY Fecha DESC';
        if (sortBy) {
            const colMap = { 'Inspector': '[Inspeccionado Por]', 'Artículo': 'Referencia', 'Tratamiento': 'Tratamiento', 'Colada': 'Colada', 'Lingote': 'Lingote', 'Informe': 'Informe', 'Fecha': 'Fecha' };
            const col = colMap[sortBy] || 'Fecha';
            const direction = sortOrder === 'ASC' ? 'ASC' : 'DESC';
            orderByClause = `ORDER BY ${col} ${direction}`;
        }

        // Get total count
        const countQuery = `SELECT COUNT(*) as total FROM [RX_X_INFORME RX LOTE] ${whereClause}`;
        const countResult = await request.query(countQuery);
        const total = countResult.recordset[0].total;

        // Get distinct treatments for filter
        const treatmentsQuery = `SELECT DISTINCT Tratamiento FROM [RX_X_INFORME RX LOTE] WHERE Tratamiento IS NOT NULL ORDER BY Tratamiento`;
        const treatmentsResult = await new sql.Request().query(treatmentsQuery);
        const tratamientos = treatmentsResult.recordset.map(r => r.Tratamiento);

        // Get paginated data
        const request2 = new sql.Request();
        if (articulo) request2.input('articulo', sql.NVarChar, articulo);
        if (tratamiento) request2.input('tratamiento', sql.NVarChar, tratamiento);
        request2.input('offset', sql.Int, offset);
        request2.input('pageSize', sql.Int, pageSizeNum);

        const dataQuery = `
            SELECT T.Fecha, T.Referencia, T.Informe, T.Colada, T.Lingote, T.Tratamiento, ISNULL(C.Nombre, T.[Inspeccionado Por]) as Inspector
            FROM [RX_X_INFORME RX LOTE] T
            LEFT JOIN [RX_LIST-CERTIFICADOS END] C ON T.[Inspeccionado Por] = C.Id
            ${whereClause}
            ${orderByClause}
            OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
        `;

        const result = await request2.query(dataQuery);
        res.json({
            data: result.recordset,
            total: total,
            page: pageNum,
            pageSize: pageSizeNum,
            totalPages: Math.ceil(total / pageSizeNum),
            tratamientos: tratamientos
        });
    } catch (err) {
        console.error('Error en /api/ensayos/rt:', err);
        res.status(500).json({ error: 'Error al obtener datos de ensayos RT.' });
    }
});

// VT
app.get('/api/ensayos/vt', async (req, res) => {
    try {
        const { articulo, tratamiento, page = 1, pageSize = 50, sortBy, sortOrder } = req.query;
        const pageNum = parseInt(page) || 1;
        const pageSizeNum = parseInt(pageSize) || 50;
        const offset = Math.max(0, (pageNum - 1) * pageSizeNum);
        const request = new sql.Request();
        let whereConditions = [];


        if (articulo) {
            request.input('articulo', sql.NVarChar, articulo);
            whereConditions.push("Referencia LIKE '%' + @articulo + '%'");
        }
        if (tratamiento) {
            request.input('tratamiento', sql.NVarChar, tratamiento);
            whereConditions.push("Tratamiento = @tratamiento");
        }

        let whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

        // Sorting
        let orderByClause = 'ORDER BY Fecha DESC';
        if (sortBy) {
            const colMap = { 'Inspector': '[Inspeccionado Por]', 'Artículo': 'Referencia', 'Tratamiento': 'Tratamiento', 'Colada': 'Colada', 'Lingote': 'Lingote', 'Informe': 'Informe', 'Fecha': 'Fecha' };
            const col = colMap[sortBy] || 'Fecha';
            const direction = sortOrder === 'ASC' ? 'ASC' : 'DESC';
            orderByClause = `ORDER BY ${col} ${direction}`;
        }

        // Get total count
        const countQuery = `SELECT COUNT(*) as total FROM [RX_X_INFORME VIS LOTE] ${whereClause}`;
        const countResult = await request.query(countQuery);
        const total = countResult.recordset[0].total;

        // Get distinct treatments for filter
        const treatmentsQuery = `SELECT DISTINCT Tratamiento FROM [RX_X_INFORME VIS LOTE] WHERE Tratamiento IS NOT NULL ORDER BY Tratamiento`;
        const treatmentsResult = await new sql.Request().query(treatmentsQuery);
        const tratamientos = treatmentsResult.recordset.map(r => r.Tratamiento);

        // Get paginated data
        const request2 = new sql.Request();
        if (articulo) request2.input('articulo', sql.NVarChar, articulo);
        if (tratamiento) request2.input('tratamiento', sql.NVarChar, tratamiento);
        request2.input('offset', sql.Int, offset);
        request2.input('pageSize', sql.Int, pageSizeNum);

        const dataQuery = `
            SELECT T.Fecha, T.Referencia, T.Informe, T.Colada, T.Lingote, T.Tratamiento, ISNULL(C.Nombre, T.[Inspeccionado Por]) as Inspector
            FROM [RX_X_INFORME VIS LOTE] T
            LEFT JOIN [RX_LIST-CERTIFICADOS END] C ON T.[Inspeccionado Por] = C.Id
            ${whereClause}
            ${orderByClause}
            OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
        `;

        const result = await request2.query(dataQuery);
        res.json({
            data: result.recordset,
            total: total,
            page: pageNum,
            pageSize: pageSizeNum,
            totalPages: Math.ceil(total / pageSizeNum),
            tratamientos: tratamientos
        });
    } catch (err) {
        console.error('Error en /api/ensayos/vt:', err);
        res.status(500).json({ error: 'Error al obtener datos de ensayos VT.' });
    }
});

// PT
app.get('/api/ensayos/pt', async (req, res) => {
    try {
        const { articulo, tratamiento, page = 1, pageSize = 50, sortBy, sortOrder } = req.query;
        const pageNum = parseInt(page) || 1;
        const pageSizeNum = parseInt(pageSize) || 50;
        const offset = Math.max(0, (pageNum - 1) * pageSizeNum);
        const request = new sql.Request();
        let whereConditions = [];


        if (articulo) {
            request.input('articulo', sql.NVarChar, articulo);
            whereConditions.push("Referencia LIKE '%' + @articulo + '%'");
        }
        if (tratamiento) {
            request.input('tratamiento', sql.NVarChar, tratamiento);
            whereConditions.push("Tratamiento = @tratamiento");
        }

        let whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

        // Sorting
        let orderByClause = 'ORDER BY Fecha DESC';
        if (sortBy) {
            const colMap = { 'Inspector': '[Inspeccionado Por]', 'Artículo': 'Referencia', 'Tratamiento': 'Tratamiento', 'Colada': 'Colada', 'Lingote': 'Lingote', 'Informe': 'Informe', 'Fecha': 'Fecha' };
            const col = colMap[sortBy] || 'Fecha';
            const direction = sortOrder === 'ASC' ? 'ASC' : 'DESC';
            orderByClause = `ORDER BY ${col} ${direction}`;
        }

        // Get total count
        const countQuery = `SELECT COUNT(*) as total FROM [RX_X_INFORME LP LOTE] ${whereClause}`;
        const countResult = await request.query(countQuery);
        const total = countResult.recordset[0].total;

        // Get distinct treatments for filter
        const treatmentsQuery = `SELECT DISTINCT Tratamiento FROM [RX_X_INFORME LP LOTE] WHERE Tratamiento IS NOT NULL ORDER BY Tratamiento`;
        const treatmentsResult = await new sql.Request().query(treatmentsQuery);
        const tratamientos = treatmentsResult.recordset.map(r => r.Tratamiento);

        // Get paginated data
        const request2 = new sql.Request();
        if (articulo) request2.input('articulo', sql.NVarChar, articulo);
        if (tratamiento) request2.input('tratamiento', sql.NVarChar, tratamiento);
        request2.input('offset', sql.Int, offset);
        request2.input('pageSize', sql.Int, pageSizeNum);

        const dataQuery = `
            SELECT T.Fecha, T.Referencia, T.Informe, T.Colada, T.Lingote, T.Tratamiento, ISNULL(C.Nombre, T.[Inspeccionado Por]) as Inspector
            FROM [RX_X_INFORME LP LOTE] T
            LEFT JOIN [RX_LIST-CERTIFICADOS END] C ON T.[Inspeccionado Por] = C.Id
            ${whereClause}
            ${orderByClause}
            OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
        `;

        const result = await request2.query(dataQuery);
        res.json({
            data: result.recordset,
            total: total,
            page: pageNum,
            pageSize: pageSizeNum,
            totalPages: Math.ceil(total / pageSizeNum),
            tratamientos: tratamientos
        });
    } catch (err) {
        console.error('Error en /api/ensayos/pt:', err);
        res.status(500).json({ error: 'Error al obtener datos de ensayos PT.' });
    }
});

// Dureza
app.get('/api/ensayos/dureza', async (req, res) => {
    try {
        const { articulo, tratamiento } = req.query;
        const request = new sql.Request();
        let whereConditions = [];

        if (articulo) {
            request.input('articulo', sql.NVarChar, articulo);
            whereConditions.push("Referencia LIKE '%' + @articulo + '%'");
        }
        if (tratamiento) {
            request.input('tratamiento', sql.NVarChar, tratamiento);
            whereConditions.push("Tratamiento LIKE '%' + @tratamiento + '%'");
        }

        let whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

        const query = `
            SELECT TOP 50 *
            FROM [ENSAYOS_DUREZA]
            ${whereClause}
            ORDER BY Fecha DESC
        `;

        const result = await request.query(query);
        res.json(result.recordset);
    } catch (err) {
        console.error('Error en /api/ensayos/dureza:', err);
        res.status(500).json({ error: 'Error al obtener datos de ensayos Dureza.' });
    }
});

// Traccion
app.get('/api/ensayos/traccion', async (req, res) => {
    try {
        const { articulo, tratamiento } = req.query;
        const request = new sql.Request();
        let whereConditions = [];

        if (articulo) {
            request.input('articulo', sql.NVarChar, articulo);
            whereConditions.push("Referencia LIKE '%' + @articulo + '%'");
        }
        if (tratamiento) {
            request.input('tratamiento', sql.NVarChar, tratamiento);
            whereConditions.push("Tratamiento LIKE '%' + @tratamiento + '%'");
        }

        let whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

        const query = `
            SELECT TOP 50 *
            FROM [ENSAYOS_TRACCION]
            ${whereClause}
            ORDER BY Fecha DESC
        `;

        const result = await request.query(query);
        res.json(result.recordset);
    } catch (err) {
        console.error('Error en /api/ensayos/traccion:', err);
        res.status(500).json({ error: 'Error al obtener datos de ensayos Traccion.' });
    }
});

// Metalografia
app.get('/api/ensayos/metalografia', async (req, res) => {
    try {
        const { articulo, tratamiento } = req.query;
        const request = new sql.Request();
        let whereConditions = [];

        if (articulo) {
            request.input('articulo', sql.NVarChar, articulo);
            whereConditions.push("Referencia LIKE '%' + @articulo + '%'");
        }
        if (tratamiento) {
            request.input('tratamiento', sql.NVarChar, tratamiento);
            whereConditions.push("Tratamiento LIKE '%' + @tratamiento + '%'");
        }

        let whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

        const query = `
            SELECT TOP 50 *
            FROM [ENSAYOS_METALOGRAFIA]
            ${whereClause}
            ORDER BY Fecha DESC
        `;

        const result = await request.query(query);
        res.json(result.recordset);
    } catch (err) {
        console.error('Error en /api/ensayos/metalografia:', err);
        res.status(500).json({ error: 'Error al obtener datos de ensayos Metalografia.' });
    }
});

// Endpoint para obtener bonos (Horas Trabajo + Ausencia)
app.get('/api/bonos', async (req, res) => {
    try {
        console.log('[API] /api/bonos requested', req.query);
        const { nombre, fechaDesde, fechaHasta, seccion, page = 1, pageSize = 50, sortBy = 'fecha', sortOrder = 'DESC', outliers } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(pageSize);

        const request = new sql.Request();
        let whereConditions = [];

        if (nombre) {
            request.input('nombre', sql.NVarChar, `%${nombre}%`);
            whereConditions.push('[Nombre] LIKE @nombre');
        }

        // Date range filter
        if (fechaDesde) {
            request.input('fechaDesde', sql.Date, fechaDesde);
            whereConditions.push('CAST([fecha] AS DATE) >= @fechaDesde');
        }
        if (fechaHasta) {
            request.input('fechaHasta', sql.Date, fechaHasta);
            whereConditions.push('CAST([fecha] AS DATE) <= @fechaHasta');
        }

        if (seccion) {
            request.input('seccion', sql.NVarChar, seccion);
            whereConditions.push('[NombreSeccion] = @seccion');
        }

        // Outliers filter: show only records outside the normal range
        if (outliers === 'true') {
            whereConditions.push('([TotalHoras] < 7.75 OR [TotalHoras] > 8.25)');
        }

        let whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

        // Sorting map
        const sortMap = {
            'operario': '[Operario]',
            'nombre': '[Nombre]',
            'seccion': '[Seccion]',
            'nombreSeccion': '[NombreSeccion]',
            'fecha': '[fecha]',
            'horasTrabajo': '[HorasTrabajo]',
            'horasAusencia': '[HorasAusencia]',
            'totalHoras': '[TotalHoras]'
        };

        const sortColumn = sortMap[sortBy] || '[fecha]';
        const order = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

        // Get total count first
        const countQuery = `SELECT COUNT(*) as total FROM [qry_DiarioHorasTrabajo+HorasAusencia] ${whereClause}`;
        const countResult = await request.query(countQuery);
        const total = countResult.recordset[0].total;

        let query = `
            SELECT
                [Operario],
                [Nombre],
                [Seccion],
                [NombreSeccion],
                [fecha],
                [HorasTrabajo],
                [HorasAusencia],
                [TotalHoras]
            FROM
                [qry_DiarioHorasTrabajo+HorasAusencia]
            ${whereClause}
            ORDER BY ${sortColumn} ${order}
            OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
        `;

        console.log('[API] Bonos Query:', query);
        console.log('[API] Sort params:', { sortBy, sortOrder, sortColumn, order });

        request.input('offset', sql.Int, offset);
        request.input('pageSize', sql.Int, parseInt(pageSize));

        const result = await request.query(query);

        // Get distinct sections for filter
        const seccionesQuery = await sql.query`
            SELECT DISTINCT [NombreSeccion]
            FROM [qry_DiarioHorasTrabajo+HorasAusencia]
            WHERE [NombreSeccion] IS NOT NULL
            ORDER BY [NombreSeccion]
        `;
        const secciones = seccionesQuery.recordset.map(r => r.NombreSeccion);

        // Get distinct names for autocomplete
        const nombresQuery = await sql.query`
            SELECT DISTINCT [Nombre]
            FROM [qry_DiarioHorasTrabajo+HorasAusencia]
            WHERE [Nombre] IS NOT NULL
            ORDER BY [Nombre]
        `;
        const nombres = nombresQuery.recordset.map(r => r.Nombre);

        res.json({
            success: true,
            data: result.recordset,
            total: total,
            page: parseInt(page),
            pageSize: parseInt(pageSize),
            totalPages: Math.ceil(total / parseInt(pageSize)),
            secciones: secciones,
            nombres: nombres,
            timestamp: new Date()
        });

    } catch (err) {
        console.error('Error SQL en /api/bonos:', err);
        res.status(500).json({
            success: false,
            error: 'Error al obtener datos de bonos.',
            details: err.message
        });
    }
});

// Personal Dashboard API endpoint
app.get('/api/personal-dashboard', async (req, res) => {
    try {
        console.log('[API] /api/personal-dashboard requested', req.query);

        const { year, month, seccion } = req.query;
        const selectedYear = parseInt(year) || new Date().getFullYear();
        const selectedMonth = month ? parseInt(month) : null;

        const request = new sql.Request();
        request.input('selectedYear', sql.Int, selectedYear);

        let seccionCondition = '';
        if (seccion) {
            request.input('seccion', sql.NVarChar, seccion);
            seccionCondition = ' AND [NombreSeccion] = @seccion';
        }

        // KPI 1: Total distinct employees (for selected year, optionally filtered by month)
        let empleadosMonthCondition = '';
        if (selectedMonth) {
            request.input('selectedMonth', sql.Int, selectedMonth);
            empleadosMonthCondition = ' AND [Mes] = @selectedMonth';
        }
        const empleadosQuery = `
            SELECT COUNT(DISTINCT [Operario]) as total 
            FROM [qry_DiarioHorasTrabajo+HorasAusencia]
            WHERE [Anio] = @selectedYear ${empleadosMonthCondition} ${seccionCondition}
        `;
        const empleadosResult = await request.query(empleadosQuery);
        const totalEmpleados = empleadosResult.recordset[0].total;

        // KPI 2: Total hours (for selected year, optionally filtered by month - entire year if no month)
        const request2 = new sql.Request();
        request2.input('selectedYear', sql.Int, selectedYear);
        let horasMonthCondition = '';
        if (selectedMonth) {
            request2.input('selectedMonth', sql.Int, selectedMonth);
            horasMonthCondition = ' AND [Mes] = @selectedMonth';
        }
        if (seccion) request2.input('seccion', sql.NVarChar, seccion);

        const horasMesQuery = `
            SELECT 
                SUM([TotalHoras]) as total,
                SUM([HorasTrabajo]) as horasTrabajo,
                SUM([HorasAusencia]) as horasAusencia
            FROM [qry_DiarioHorasTrabajo+HorasAusencia]
            WHERE [Anio] = @selectedYear ${horasMonthCondition} ${seccionCondition}
        `;
        const horasMesResult = await request2.query(horasMesQuery);
        const horasMes = horasMesResult.recordset[0].total || 0;
        const horasTrabajo = horasMesResult.recordset[0].horasTrabajo || 0;
        const horasAusencia = horasMesResult.recordset[0].horasAusencia || 0;

        // KPI 3: Outliers count (for selected year, optionally filtered by month)
        const request3 = new sql.Request();
        request3.input('selectedYear', sql.Int, selectedYear);
        let outliersMonthCondition = '';
        if (selectedMonth) {
            request3.input('selectedMonth', sql.Int, selectedMonth);
            outliersMonthCondition = ' AND [Mes] = @selectedMonth';
        }
        if (seccion) request3.input('seccion', sql.NVarChar, seccion);

        const outliersQuery = `
            SELECT COUNT(*) as total 
            FROM [qry_DiarioHorasTrabajo+HorasAusencia]
            WHERE [Anio] = @selectedYear ${outliersMonthCondition}
            AND ([TotalHoras] < 7.75 OR [TotalHoras] > 8.25) ${seccionCondition}
        `;
        const outliersResult = await request3.query(outliersQuery);
        const outliersCount = outliersResult.recordset[0].total;

        // KPI 4: Average hours per day (for selected year, optionally filtered by month)
        const request4 = new sql.Request();
        request4.input('selectedYear', sql.Int, selectedYear);
        let mediaMonthCondition = '';
        if (selectedMonth) {
            request4.input('selectedMonth', sql.Int, selectedMonth);
            mediaMonthCondition = ' AND [Mes] = @selectedMonth';
        }
        if (seccion) request4.input('seccion', sql.NVarChar, seccion);

        const mediaQuery = `
            SELECT AVG([TotalHoras]) as media 
            FROM [qry_DiarioHorasTrabajo+HorasAusencia]
            WHERE [Anio] = @selectedYear ${mediaMonthCondition}
            AND [TotalHoras] > 0 ${seccionCondition}
        `;
        const mediaResult = await request4.query(mediaQuery);
        const mediaHoras = mediaResult.recordset[0].media || 0;

        // Section summary (for selected year, optionally filtered by month)
        const request5 = new sql.Request();
        request5.input('selectedYear', sql.Int, selectedYear);
        let seccionesMonthCondition = '';
        if (selectedMonth) {
            request5.input('selectedMonth', sql.Int, selectedMonth);
            seccionesMonthCondition = ' AND [Mes] = @selectedMonth';
        }
        if (seccion) request5.input('seccion', sql.NVarChar, seccion);

        const seccionesQuery = `
            SELECT 
                [NombreSeccion],
                COUNT(DISTINCT [Operario]) as empleados,
                SUM([HorasTrabajo]) as horasTrabajo,
                SUM([HorasAusencia]) as horasAusencia,
                SUM([TotalHoras]) as totalHoras
            FROM [qry_DiarioHorasTrabajo+HorasAusencia]
            WHERE [Anio] = @selectedYear ${seccionesMonthCondition} ${seccionCondition}
            GROUP BY [NombreSeccion]
            ORDER BY totalHoras DESC
        `;
        const seccionesResult = await request5.query(seccionesQuery);

        // Monthly evolution for selected year
        const request6 = new sql.Request();
        request6.input('selectedYear', sql.Int, selectedYear);
        if (seccion) request6.input('seccion', sql.NVarChar, seccion);

        const evolucionQuery = `
            SELECT 
                [Anio], [Mes], [NombreSeccion] as seccion,
                SUM([HorasTrabajo]) as horasTrabajo,
                SUM([HorasAusencia]) as horasAusencia
            FROM [qry_DiarioHorasTrabajo+HorasAusencia]
            WHERE [Anio] = @selectedYear AND [NombreSeccion] IS NOT NULL
            GROUP BY [Anio], [Mes], [NombreSeccion]
            ORDER BY [Mes] ASC, [NombreSeccion]
        `;
        const evolucionResult = await request6.query(evolucionQuery);

        // Get all distinct sections for filter dropdown
        const allSeccionesResult = await sql.query`
            SELECT DISTINCT [NombreSeccion]
            FROM [qry_DiarioHorasTrabajo+HorasAusencia]
            WHERE [NombreSeccion] IS NOT NULL
            ORDER BY [NombreSeccion]
        `;
        const allSecciones = allSeccionesResult.recordset.map(r => r.NombreSeccion);

        res.json({
            success: true,
            kpis: {
                totalEmpleados,
                horasMes: parseFloat(horasMes).toFixed(2),
                horasTrabajo: parseFloat(horasTrabajo).toFixed(2),
                horasAusencia: parseFloat(horasAusencia).toFixed(2),
                outliersCount,
                mediaHoras: parseFloat(mediaHoras).toFixed(2)
            },
            secciones: seccionesResult.recordset,
            evolucion: evolucionResult.recordset,
            allSecciones: allSecciones,
            timestamp: new Date()
        });

    } catch (err) {
        console.error('Error SQL en /api/personal-dashboard:', err);
        res.status(500).json({
            success: false,
            error: 'Error al obtener datos del dashboard de personal.',
            details: err.message
        });
    }
});

// ============================================
// CALIDAD - RECHAZOS API ENDPOINT
// ============================================
app.get('/api/calidad-dashboard', async (req, res) => {
    try {
        console.log('[API] /api/calidad-dashboard requested', req.query);

        const { year, month, seccion, tipoSeccion } = req.query;
        const currentDate = new Date();
        const selectedYear = parseInt(year) || currentDate.getFullYear();
        const selectedMonth = month ? parseInt(month) : null;
        const selectedTipoSeccion = tipoSeccion || 'causa'; // 'causa' = por causa origen, 'deteccion' = por operación

        const request = new sql.Request();
        request.input('year', sql.Int, selectedYear);

        // Month condition - only apply if a specific month is selected
        let monthCondition = '';
        if (selectedMonth) {
            request.input('month', sql.Int, selectedMonth);
            monthCondition = ' AND MONTH(R.[fecha inicio]) = @month';
        }

        // Sección condition - depende del tipo seleccionado
        let seccionCondition = '';
        let seccionJoin = 'INNER JOIN [CAUSAS RECHAZO] CR ON R.[causa rechazo] = CR.[codigo causa]';

        if (seccion) {
            request.input('seccion', sql.NVarChar, seccion);
            if (selectedTipoSeccion === 'deteccion') {
                // Filtrar por sección de la operación (donde se detecta)
                seccionJoin = `INNER JOIN [CAUSAS RECHAZO] CR ON R.[causa rechazo] = CR.[codigo causa]
                               LEFT JOIN [OPERACIONES] OP ON R.[codigo operacion] = OP.[codigo operacion]`;
                seccionCondition = ' AND OP.[seccion] = @seccion';
            } else {
                // Filtrar por sección de la causa (origen)
                seccionCondition = ' AND CR.Seccion = @seccion';
            }
        }

        // Query 1: Causes data with aggregation
        const causesQuery = `
            SELECT 
                R.[causa rechazo] as causaRechazo,
                R.[descripcion causa] as descripcionCausa,
                SUM(ISNULL(R.PiezasRc, 0)) as PiezasRc,
                SUM(ISNULL(R.ImporteRcPvpOp, 0)) as ImporteRcPvpOp
            FROM Qry_RankingRechazos R
            ${seccionJoin}
            WHERE YEAR(R.[fecha inicio]) = @year 
                ${monthCondition}
                ${seccionCondition}
            GROUP BY R.[causa rechazo], R.[descripcion causa]
            ORDER BY ImporteRcPvpOp DESC
        `;
        const causesResult = await request.query(causesQuery);
        const causes = causesResult.recordset;

        // Query 2: Top 10 articles by importe
        const request2 = new sql.Request();
        request2.input('year', sql.Int, selectedYear);
        if (selectedMonth) request2.input('month', sql.Int, selectedMonth);
        if (seccion) request2.input('seccion', sql.NVarChar, seccion);

        const articlesQuery = `
            SELECT TOP 10
                R.[codigo articulo] as codigoArticulo,
                SUM(ISNULL(R.ImporteRcPvpOp, 0)) as ImporteRcPvpOp
            FROM Qry_RankingRechazos R
            ${seccionJoin}
            WHERE YEAR(R.[fecha inicio]) = @year 
                ${monthCondition}
                ${seccionCondition}
            GROUP BY R.[codigo articulo]
            ORDER BY ImporteRcPvpOp DESC
        `;
        const articlesResult = await request2.query(articlesQuery);
        const articles = articlesResult.recordset;

        // Query 3: KPIs totals
        const request3 = new sql.Request();
        request3.input('year', sql.Int, selectedYear);
        if (selectedMonth) request3.input('month', sql.Int, selectedMonth);
        if (seccion) request3.input('seccion', sql.NVarChar, seccion);

        const kpisQuery = `
            SELECT 
                SUM(ISNULL(R.PiezasRc, 0)) as totalPiezas,
                SUM(ISNULL(R.ImporteRcPvpOp, 0)) as totalImporte,
                COUNT(DISTINCT R.[causa rechazo]) as totalCausas,
                COUNT(DISTINCT R.[codigo articulo]) as totalArticulos
            FROM Qry_RankingRechazos R
            ${seccionJoin}
            WHERE YEAR(R.[fecha inicio]) = @year 
                ${monthCondition}
                ${seccionCondition}
        `;
        const kpisResult = await request3.query(kpisQuery);
        const kpisRaw = kpisResult.recordset[0] || { totalPiezas: 0, totalImporte: 0, totalCausas: 0, totalArticulos: 0 };

        // Query adicional: Obtener total piezas fabricadas de las órdenes que tuvieron rechazos
        // Relacionamos por [numero orden] = Nrorden
        const request4Fab = new sql.Request();
        request4Fab.input('year', sql.Int, selectedYear);
        if (selectedMonth) request4Fab.input('month', sql.Int, selectedMonth);
        if (seccion) request4Fab.input('seccion', sql.NVarChar, seccion);

        // Subconsulta simplificada para obtener los Nrorden
        let fabricadasSubquery = `
            SELECT DISTINCT R.Nrorden
            FROM Qry_RankingRechazos R
            INNER JOIN [CAUSAS RECHAZO] CR ON R.[causa rechazo] = CR.[codigo causa]
            WHERE YEAR(R.[fecha inicio]) = @year
                ${monthCondition}
        `;

        // Añadir filtro de sección si aplica
        if (seccion) {
            if (selectedTipoSeccion === 'deteccion') {
                fabricadasSubquery = `
                    SELECT DISTINCT R.Nrorden
                    FROM Qry_RankingRechazos R
                    INNER JOIN [CAUSAS RECHAZO] CR ON R.[causa rechazo] = CR.[codigo causa]
                    LEFT JOIN [OPERACIONES] OP ON R.[codigo operacion] = OP.[codigo operacion]
                    WHERE YEAR(R.[fecha inicio]) = @year
                        ${monthCondition}
                        AND OP.[seccion] = @seccion
                `;
            } else {
                fabricadasSubquery = `
                    SELECT DISTINCT R.Nrorden
                    FROM Qry_RankingRechazos R
                    INNER JOIN [CAUSAS RECHAZO] CR ON R.[causa rechazo] = CR.[codigo causa]
                    WHERE YEAR(R.[fecha inicio]) = @year
                        ${monthCondition}
                        AND CR.Seccion = @seccion
                `;
            }
        }

        const fabricadasQuery = `
            SELECT 
                SUM(ISNULL(OrdenFab.[cantidad fabricada], 0)) as totalProducidas
            FROM [ORDENES DE FABRICACION] OrdenFab
            WHERE OrdenFab.[numero orden] IN (${fabricadasSubquery})
        `;

        console.log('[CALIDAD] Fabricadas query subquery:', fabricadasSubquery.substring(0, 100));

        let totalProducidas = 0;
        try {
            const fabricadasResult = await request4Fab.query(fabricadasQuery);
            totalProducidas = parseFloat(fabricadasResult.recordset[0]?.totalProducidas) || 0;
            console.log('[CALIDAD] Total producidas:', totalProducidas);
        } catch (e) {
            console.log('[CALIDAD] Warning: Could not get fabricadas data:', e.message);
        }

        // Calcular porcentaje de rechazo
        const totalPiezasRechazadas = parseFloat(kpisRaw.totalPiezas) || 0;
        const porcentajeRechazo = totalProducidas > 0 ? (totalPiezasRechazadas / totalProducidas) * 100 : 0;

        const kpis = {
            ...kpisRaw,
            totalProducidas: totalProducidas,
            porcentajeRechazo: parseFloat(porcentajeRechazo.toFixed(2))
        };
        console.log('[CALIDAD] Final kpis object:', JSON.stringify(kpis));

        // Query 4: Get all distinct sections for filter dropdown
        const seccionesResult = await sql.query`
            SELECT DISTINCT Seccion
            FROM [CAUSAS RECHAZO]
            WHERE Seccion IS NOT NULL AND Seccion <> ''
            ORDER BY Seccion
        `;
        const secciones = seccionesResult.recordset.map(r => r.Seccion);

        // Query 5: Get available years for filter
        const yearsResult = await sql.query`
            SELECT DISTINCT YEAR([fecha inicio]) as year
            FROM Qry_RankingRechazos
            WHERE [fecha inicio] IS NOT NULL
            ORDER BY year DESC
        `;
        const years = yearsResult.recordset.map(r => r.year);

        // Query 6: Monthly evolution by section for the selected year
        const request4 = new sql.Request();
        request4.input('year', sql.Int, selectedYear);

        const evolutionQuery = `
            SELECT 
                MONTH(R.[fecha inicio]) as Mes,
                CR.Seccion,
                SUM(ISNULL(R.PiezasRc, 0)) as PiezasRc,
                SUM(ISNULL(R.ImporteRcPvpOp, 0)) as ImporteRcPvpOp
            FROM Qry_RankingRechazos R
            INNER JOIN [CAUSAS RECHAZO] CR ON R.[causa rechazo] = CR.[codigo causa]
            WHERE YEAR(R.[fecha inicio]) = @year 
                AND CR.Seccion IS NOT NULL AND CR.Seccion <> ''
            GROUP BY MONTH(R.[fecha inicio]), CR.Seccion
            ORDER BY Mes, CR.Seccion
        `;
        const evolutionResult = await request4.query(evolutionQuery);
        const evolution = evolutionResult.recordset;

        res.json({
            success: true,
            kpis: {
                totalPiezas: kpis.totalPiezas || 0,
                totalImporte: parseFloat(kpis.totalImporte || 0).toFixed(2),
                totalCausas: kpis.totalCausas || 0,
                totalArticulos: kpis.totalArticulos || 0,
                totalProducidas: kpis.totalProducidas || 0,
                porcentajeRechazo: kpis.porcentajeRechazo || 0
            },
            causes: causes,
            articles: articles,
            secciones: secciones,
            years: years,
            evolution: evolution,
            filters: {
                year: selectedYear,
                month: selectedMonth,
                seccion: seccion || null
            },
            timestamp: new Date()
        });

    } catch (err) {
        console.error('Error SQL en /api/calidad-dashboard:', err);
        res.status(500).json({
            success: false,
            error: 'Error al obtener datos del dashboard de calidad.',
            details: err.message
        });
    }
});



// ============================================
// COMERCIAL - OTD (On-Time Delivery) API ENDPOINTS
// ============================================

// OTD Dashboard - Estadísticas de cumplimiento de entregas
app.get('/api/otd-estadisticas', async (req, res) => {
    try {
        console.log('[API] /api/otd-estadisticas requested', req.query);

        const { ano, cliente, familia, articulo } = req.query;
        const currentYear = new Date().getFullYear();
        const selectedYear = parseInt(ano) || currentYear;

        const request = new sql.Request();
        request.input('ano', sql.Int, selectedYear);

        // Base query with joins for client and family names
        let baseJoin = `
            FROM Qry_Estadistica_Cumplimiento_Entregas T
            LEFT JOIN [MAESTRO CLIENTES] C ON T.[cliente] = C.[codigo cliente]
        `;

        // Use [fecha albaran] for year filtering
        let whereConditions = ['YEAR(T.[fecha albaran]) = @ano'];

        if (cliente) {
            request.input('cliente', sql.NVarChar, `%${cliente}%`);
            whereConditions.push('C.[nombre empresa] LIKE @cliente');
        }
        if (familia) {
            const familiaArr = familia.split(',');
            const famParams = familiaArr.map((f, i) => `@fam${i}`);
            familiaArr.forEach((f, i) => request.input(`fam${i}`, sql.NVarChar, f));
            whereConditions.push(`T.[codigo familia] IN (${famParams.join(',')})`);
        }
        if (articulo) {
            request.input('articulo', sql.NVarChar, articulo);
            whereConditions.push('T.[articulo] = @articulo');
        }

        const whereClause = 'WHERE ' + whereConditions.join(' AND ');

        // Query 1: Monthly metrics
        const monthlyMetricsQuery = `
            SELECT 
                DATENAME(month, T.[fecha albaran]) as mes,
                MONTH(T.[fecha albaran]) as mesNumero,
                COUNT(*) as lineasEntregadas,
                SUM(CASE WHEN T.[DiferenciaDias] <= 0 THEN 1 ELSE 0 END) as lineasATiempo,
                SUM(CASE WHEN T.[DiferenciaDias] > 0 THEN 1 ELSE 0 END) as lineasRetrasadas,
                AVG(CAST(T.[DiferenciaDias] AS FLOAT)) as diasRetraso,
                SUM(CAST(T.[CantidadAlbaran] AS FLOAT)) as pzasEntregadas
            ${baseJoin}
            ${whereClause}
            GROUP BY DATENAME(month, T.[fecha albaran]), MONTH(T.[fecha albaran])
            ORDER BY mesNumero
        `;
        const monthlyResult = await request.query(monthlyMetricsQuery);

        // Query 2: Totals for the year
        const request2 = new sql.Request();
        request2.input('ano', sql.Int, selectedYear);
        if (cliente) request2.input('cliente', sql.NVarChar, `%${cliente}%`);
        if (familia) {
            const familiaArr = familia.split(',');
            familiaArr.forEach((f, i) => request2.input(`fam${i}`, sql.NVarChar, f));
        }
        if (articulo) request2.input('articulo', sql.NVarChar, articulo);

        const totalsQuery = `
            SELECT 
                COUNT(*) as totalLineasEntregadas,
                SUM(CASE WHEN T.[DiferenciaDias] <= 0 THEN 1 ELSE 0 END) as totalLineasATiempo,
                SUM(CASE WHEN T.[DiferenciaDias] > 0 THEN 1 ELSE 0 END) as totalLineasRetrasadas,
                AVG(CAST(T.[DiferenciaDias] AS FLOAT)) as avgDiasRetraso,
                SUM(CAST(T.[CantidadAlbaran] AS FLOAT)) as totalPzasEntregadas
            ${baseJoin}
            ${whereClause}
        `;
        const totalsResult = await request2.query(totalsQuery);
        const totals = totalsResult.recordset[0] || {};

        // Query 3: Years from [fecha albaran]
        const yearsResult = await sql.query`
            SELECT DISTINCT YEAR([fecha albaran]) as ano
            FROM Qry_Estadistica_Cumplimiento_Entregas
            WHERE [fecha albaran] IS NOT NULL
            ORDER BY ano DESC
        `;
        const years = yearsResult.recordset.map(r => r.ano);

        // Query 4: Clients
        const clientesResult = await sql.query`
            SELECT DISTINCT 
                C.[codigo cliente] as codigo,
                C.[nombre empresa] as nombre
            FROM Qry_Estadistica_Cumplimiento_Entregas T
            INNER JOIN [MAESTRO CLIENTES] C ON T.[cliente] = C.[codigo cliente]
            WHERE C.[nombre empresa] IS NOT NULL
            ORDER BY C.[nombre empresa]
        `;
        const clientes = clientesResult.recordset.map(r => ({
            codigo: r.codigo,
            nombre: r.nombre
        }));

        // Query 5: Families (only tipo '02')
        const familiasResult = await sql.query`
            SELECT DISTINCT 
                F.[codigo familia] as codigo,
                F.[denominacion familia] as denominacion
            FROM Qry_Estadistica_Cumplimiento_Entregas T
            INNER JOIN [MAESTRO FAMILIAS] F ON T.[codigo familia] = F.[codigo familia]
            WHERE F.[codigo familia] IS NOT NULL AND F.[codigo tipo] = '02'
            ORDER BY F.[codigo familia]
        `;
        const familias = familiasResult.recordset.map(r => ({
            codigo: r.codigo,
            denominacion: r.denominacion || ''
        }));

        // Query 6: Top Articles
        const request3 = new sql.Request();
        request3.input('ano', sql.Int, selectedYear);
        if (cliente) request3.input('cliente', sql.NVarChar, `%${cliente}%`);
        if (familia) {
            const familiaArr = familia.split(',');
            familiaArr.forEach((f, i) => request3.input(`fam${i}`, sql.NVarChar, f));
        }
        if (articulo) request3.input('articulo', sql.NVarChar, articulo);

        const topArticlesQuery = `
            SELECT TOP 15
                T.[articulo],
                SUM(CAST(T.[CantidadAlbaran] AS INT)) as cantidad
            ${baseJoin}
            ${whereClause}
            GROUP BY T.[articulo]
            ORDER BY cantidad DESC
        `;
        const topArticlesResult = await request3.query(topArticlesQuery);

        const cumplimiento = (totals.totalLineasEntregadas || 0) > 0
            ? ((totals.totalLineasATiempo || 0) / totals.totalLineasEntregadas * 100).toFixed(1)
            : '0.0';

        res.json({
            success: true,
            monthlyMetrics: monthlyResult.recordset,
            totals: {
                lineasEntregadas: totals.totalLineasEntregadas || 0,
                lineasATiempo: totals.totalLineasATiempo || 0,
                lineasRetrasadas: totals.totalLineasRetrasadas || 0,
                diasRetraso: parseFloat(totals.avgDiasRetraso || 0).toFixed(1),
                pzasEntregadas: totals.totalPzasEntregadas || 0,
                cumplimiento: cumplimiento
            },
            topArticles: topArticlesResult.recordset,
            filters: {
                years: years,
                clientes: clientes,
                familias: familias
            },
            selectedFilters: {
                ano: selectedYear,
                cliente: cliente || null,
                familia: familia || null,
                articulo: articulo || null
            },
            timestamp: new Date()
        });

    } catch (err) {
        console.error('Error SQL en /api/otd-estadisticas:', err);
        res.status(500).json({
            success: false,
            error: 'Error al obtener estadísticas OTD.',
            details: err.message
        });
    }
});

// OTD Dashboard - Rechazos vs Entregas
app.get('/api/otd-rechazos', async (req, res) => {
    try {
        console.log('[API] /api/otd-rechazos requested', req.query);

        const { ano, cliente, familia, articulo } = req.query;
        const currentYear = new Date().getFullYear();
        const selectedYear = parseInt(ano) || currentYear;

        const request = new sql.Request();
        request.input('ano', sql.Int, selectedYear);

        // Qry_Estadisticas_Albaranes_Lineas has precomputed [Año] column
        let whereConditions = ['[Año] = @ano'];

        if (cliente) {
            request.input('cliente', sql.NVarChar, `%${cliente}%`);
            whereConditions.push('[nombre empresa] LIKE @cliente');
        }
        if (familia) {
            const familiaArr = familia.split(',');
            const famParams = familiaArr.map((f, i) => `@fam${i}`);
            familiaArr.forEach((f, i) => request.input(`fam${i}`, sql.NVarChar, f));
            whereConditions.push(`[codigo familia] IN (${famParams.join(',')})`);
        }
        if (articulo) {
            request.input('articulo', sql.NVarChar, articulo);
            whereConditions.push('[articulo] = @articulo');
        }

        const whereClause = 'WHERE ' + whereConditions.join(' AND ');

        // Query 1: Monthly metrics using precomputed [Mes]
        const monthlyRechazosQuery = `
            SELECT 
                DATENAME(MONTH, [fecha albaran]) as mes,
                [Mes] as mesNumero,
                SUM(CAST([cantidad servida] AS FLOAT)) as pzasEntregadas,
                SUM(CASE WHEN [ImportePts] < 0 THEN ABS(CAST([cantidad servida] AS FLOAT)) ELSE 0 END) as pzasRechazadas
            FROM Qry_Estadisticas_Albaranes_Lineas
            ${whereClause}
            GROUP BY [Mes], DATENAME(MONTH, [fecha albaran])
            ORDER BY mesNumero
        `;
        const monthlyResult = await request.query(monthlyRechazosQuery);

        // Yearly totals
        const request2 = new sql.Request();
        request2.input('ano', sql.Int, selectedYear);
        if (cliente) request2.input('cliente', sql.NVarChar, `%${cliente}%`);
        if (familia) {
            const familiaArr = familia.split(',');
            familiaArr.forEach((f, i) => request2.input(`fam${i}`, sql.NVarChar, f));
        }
        if (articulo) request2.input('articulo', sql.NVarChar, articulo);

        const totalsQuery = `
            SELECT 
                SUM(CAST([cantidad servida] AS FLOAT)) as totalPzasEntregadas,
                SUM(CASE WHEN [ImportePts] < 0 THEN ABS(CAST([cantidad servida] AS FLOAT)) ELSE 0 END) as totalPzasRechazadas
            FROM Qry_Estadisticas_Albaranes_Lineas
            ${whereClause}
        `;
        const totalsResult = await request2.query(totalsQuery);
        const totals = totalsResult.recordset[0] || {};

        // Top Rechazados
        const request3 = new sql.Request();
        request3.input('ano', sql.Int, selectedYear);
        if (cliente) request3.input('cliente', sql.NVarChar, `%${cliente}%`);
        if (familia) {
            const familiaArr = familia.split(',');
            familiaArr.forEach((f, i) => request3.input(`fam${i}`, sql.NVarChar, f));
        }
        if (articulo) request3.input('articulo', sql.NVarChar, articulo);

        const topRechazadosQuery = `
            SELECT TOP 10
                [articulo],
                SUM(ABS(CAST([cantidad servida] AS FLOAT))) as cantidadRechazada
            FROM Qry_Estadisticas_Albaranes_Lineas
            ${whereClause} AND [ImportePts] < 0
            GROUP BY [articulo]
            ORDER BY cantidadRechazada DESC
        `;
        const topRechazadosResult = await request3.query(topRechazadosQuery);

        const porcentajeRechazo = (totals.totalPzasEntregadas || 0) > 0
            ? (totals.totalPzasRechazadas / totals.totalPzasEntregadas * 100).toFixed(2)
            : '0.00';

        res.json({
            success: true,
            monthlyRechazos: monthlyResult.recordset,
            totals: {
                pzasEntregadas: totals.totalPzasEntregadas || 0,
                pzasRechazadas: totals.totalPzasRechazadas || 0,
                porcentajeRechazo: porcentajeRechazo
            },
            topRechazados: topRechazadosResult.recordset
        });

    } catch (err) {
        console.error('Error SQL en /api/otd-rechazos:', err);
        res.status(500).json({
            success: false,
            error: 'Error al obtener estadísticas de rechazos.',
            details: err.message
        });
    }
});

// ============================================
// PRODUCCION - OEE API ENDPOINT
// ============================================

app.get('/api/produccion/oee', async (req, res) => {
    try {
        const { year, month, seccion, familia } = req.query;
        const currentYear = new Date().getFullYear();
        const selectedYear = parseInt(year) || currentYear;

        console.log('[API] /api/produccion/oee requested', { year: selectedYear, month, seccion, familia });

        // First, let's verify data exists
        const testResult = await sql.query`
            SELECT TOP 1 * FROM [REGISTRO TRABAJOS] ORDER BY [fecha inicio] DESC
        `;
        console.log('[OEE] Sample record from REGISTRO TRABAJOS:', testResult.recordset[0] ? 'Found' : 'Empty table');

        // Build base query with JOINs
        // RT = REGISTRO TRABAJOS
        // OP = OPERACIONES (for seccion)
        // MS = MAESTRO SECCIONES (for seccion denominacion)
        // MA = MAESTRO ARTICULOS (for familia)
        const baseFrom = `
            FROM [REGISTRO TRABAJOS] RT
            LEFT JOIN [OPERACIONES] OP ON RT.[codigo operacion] = OP.[codigo operacion]
            LEFT JOIN [MAESTRO SECCIONES] MS ON OP.[seccion] = MS.[seccion]
            LEFT JOIN [MAESTRO ARTICULOS] MA ON RT.[Articulo] = MA.[codigo articulo]
        `;

        // Build WHERE conditions
        let whereConditions = ['OP.[ComputoOEE] = 1'];
        const request = new sql.Request();

        // Year filter - make it optional to see if there's any data
        if (selectedYear) {
            request.input('year', sql.Int, selectedYear);
            whereConditions.push('YEAR(RT.[fecha inicio]) = @year');
        }

        if (month && month !== '') {
            request.input('month', sql.Int, parseInt(month));
            whereConditions.push('MONTH(RT.[fecha inicio]) = @month');
        }

        if (seccion && seccion !== '') {
            request.input('seccion', sql.NVarChar, seccion);
            whereConditions.push('OP.[seccion] = @seccion');
        }

        if (familia && familia !== '') {
            request.input('familia', sql.NVarChar, familia);
            whereConditions.push('MA.[codigo familia] = @familia');
        }

        const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

        // Query 1: OEE metrics grouped by [codigo operacion] & [descripcion]
        const operationsQuery = `
            SELECT 
                RT.[codigo operacion] as codigoOperacion,
                MAX(OP.[descripcion 1]) as descripcion,
                MAX(MS.[denominacion]) as seccionNombre,
                SUM(ISNULL(RT.[piezas ok], 0)) as piezasOk,
                SUM(ISNULL(RT.[piezas rc], 0)) as piezasRc,
                SUM((ISNULL(RT.[piezas ok], 0) + ISNULL(RT.[piezas rc], 0)) * ISNULL(RT.[tiempo teorico], 0) / 60.0) as horasTeoricas,
                SUM(CASE WHEN ISNULL(RT.[actividad asignada], 0) = 0 THEN ISNULL(RT.[tiempo], 0) ELSE 0 END) as horasDisponibles,
                SUM(ISNULL(RT.[tiempo], 0)) as horasPlanificadas
            ${baseFrom}
            ${whereClause}
            GROUP BY RT.[codigo operacion]
            ORDER BY RT.[codigo operacion]
        `;

        console.log('[OEE] Operations query:', operationsQuery.substring(0, 200) + '...');
        const operationsResult = await request.query(operationsQuery);
        console.log('[OEE] Operations found:', operationsResult.recordset.length);

        // Calculate OEE metrics for each operation
        const operations = operationsResult.recordset.map(op => {
            const horasTeoricas = parseFloat(op.horasTeoricas) || 0;
            const horasDisponibles = parseFloat(op.horasDisponibles) || 0;
            const horasPlanificadas = parseFloat(op.horasPlanificadas) || 0;
            const piezasOk = parseInt(op.piezasOk) || 0;
            const piezasRc = parseInt(op.piezasRc) || 0;
            const totalPiezas = piezasOk + piezasRc;

            // OEED = Horas Disponibles / Horas Planificadas
            const oeed = horasPlanificadas > 0 ? (horasDisponibles / horasPlanificadas) * 100 : 0;

            // OEEQ = piezas ok / (piezas rc + piezas ok)
            const oeeq = totalPiezas > 0 ? (piezasOk / totalPiezas) * 100 : 0;

            // OEER = Horas Teóricas / Horas Disponibles
            const oeer = horasDisponibles > 0 ? (horasTeoricas / horasDisponibles) * 100 : 0;

            // OEE = OEED * OEER * OEEQ (as percentages, need to divide by 10000)
            const oee = (oeed * oeer * oeeq) / 10000;

            return {
                codigoOperacion: op.codigoOperacion || '-',
                descripcion: op.descripcion || '-',
                seccionNombre: op.seccionNombre || '-',
                piezasOk,
                piezasRc,
                totalPiezas,
                horasTeoricas: parseFloat(horasTeoricas.toFixed(2)),
                horasDisponibles: parseFloat(horasDisponibles.toFixed(2)),
                horasPlanificadas: parseFloat(horasPlanificadas.toFixed(2)),
                oeed: parseFloat(oeed.toFixed(1)),
                oeeq: parseFloat(oeeq.toFixed(1)),
                oeer: parseFloat(oeer.toFixed(1)),
                oee: parseFloat(oee.toFixed(1))
            };
        });

        // Query 2: Global KPIs (totals)
        const request2 = new sql.Request();
        if (selectedYear) request2.input('year', sql.Int, selectedYear);
        if (month && month !== '') request2.input('month', sql.Int, parseInt(month));
        if (seccion && seccion !== '') request2.input('seccion', sql.NVarChar, seccion);
        if (familia && familia !== '') request2.input('familia', sql.NVarChar, familia);

        const globalsQuery = `
            SELECT 
                SUM(ISNULL(RT.[piezas ok], 0)) as totalPiezasOk,
                SUM(ISNULL(RT.[piezas rc], 0)) as totalPiezasRc,
                SUM((ISNULL(RT.[piezas ok], 0) + ISNULL(RT.[piezas rc], 0)) * ISNULL(RT.[tiempo teorico], 0) / 60.0) as totalHorasTeoricas,
                SUM(CASE WHEN ISNULL(RT.[actividad asignada], 0) = 0 THEN ISNULL(RT.[tiempo], 0) ELSE 0 END) as totalHorasDisponibles,
                SUM(ISNULL(RT.[tiempo], 0)) as totalHorasPlanificadas
            ${baseFrom}
            ${whereClause}
        `;

        const globalsResult = await request2.query(globalsQuery);
        const globals = globalsResult.recordset[0] || {};

        const totalHorasTeoricas = parseFloat(globals.totalHorasTeoricas) || 0;
        const totalHorasDisponibles = parseFloat(globals.totalHorasDisponibles) || 0;
        const totalHorasPlanificadas = parseFloat(globals.totalHorasPlanificadas) || 0;
        const totalPiezasOk = parseInt(globals.totalPiezasOk) || 0;
        const totalPiezasRc = parseInt(globals.totalPiezasRc) || 0;
        const totalPiezas = totalPiezasOk + totalPiezasRc;

        const globalOeed = totalHorasPlanificadas > 0 ? (totalHorasDisponibles / totalHorasPlanificadas) * 100 : 0;
        const globalOeeq = totalPiezas > 0 ? (totalPiezasOk / totalPiezas) * 100 : 0;
        const globalOeer = totalHorasDisponibles > 0 ? (totalHorasTeoricas / totalHorasDisponibles) * 100 : 0;
        const globalOee = (globalOeed * globalOeer * globalOeeq) / 10000;

        // Query 3: Monthly trend for the selected year
        const request3 = new sql.Request();
        if (selectedYear) request3.input('year', sql.Int, selectedYear);
        if (seccion && seccion !== '') request3.input('seccion', sql.NVarChar, seccion);
        if (familia && familia !== '') request3.input('familia', sql.NVarChar, familia);

        let trendWhereConditions = ['OP.[ComputoOEE] = 1'];
        if (selectedYear) trendWhereConditions.push('YEAR(RT.[fecha inicio]) = @year');
        if (seccion && seccion !== '') trendWhereConditions.push('OP.[seccion] = @seccion');
        if (familia && familia !== '') trendWhereConditions.push('MA.[codigo familia] = @familia');
        const trendWhereClause = trendWhereConditions.length > 0 ? 'WHERE ' + trendWhereConditions.join(' AND ') : '';

        const trendQuery = `
            SELECT 
                MONTH(RT.[fecha inicio]) as mes,
                SUM(ISNULL(RT.[piezas ok], 0)) as piezasOk,
                SUM(ISNULL(RT.[piezas rc], 0)) as piezasRc,
                SUM((ISNULL(RT.[piezas ok], 0) + ISNULL(RT.[piezas rc], 0)) * ISNULL(RT.[tiempo teorico], 0) / 60.0) as horasTeoricas,
                SUM(CASE WHEN ISNULL(RT.[actividad asignada], 0) = 0 THEN ISNULL(RT.[tiempo], 0) ELSE 0 END) as horasDisponibles,
                SUM(ISNULL(RT.[tiempo], 0)) as horasPlanificadas
            ${baseFrom}
            ${trendWhereClause}
            GROUP BY MONTH(RT.[fecha inicio])
            ORDER BY mes
        `;

        const trendResult = await request3.query(trendQuery);

        const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
            'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

        const trend = trendResult.recordset.map(row => {
            const horasTeoricas = parseFloat(row.horasTeoricas) || 0;
            const horasDisponibles = parseFloat(row.horasDisponibles) || 0;
            const horasPlanificadas = parseFloat(row.horasPlanificadas) || 0;
            const piezasOk = parseInt(row.piezasOk) || 0;
            const piezasRc = parseInt(row.piezasRc) || 0;
            const totalPiezas = piezasOk + piezasRc;

            const oeed = horasPlanificadas > 0 ? (horasDisponibles / horasPlanificadas) * 100 : 0;
            const oeeq = totalPiezas > 0 ? (piezasOk / totalPiezas) * 100 : 0;
            const oeer = horasDisponibles > 0 ? (horasTeoricas / horasDisponibles) * 100 : 0;
            const oee = (oeed * oeer * oeeq) / 10000;

            return {
                mes: row.mes,
                monthName: monthNames[row.mes - 1] || `Mes ${row.mes}`,
                oee: parseFloat(oee.toFixed(1)),
                oeed: parseFloat(oeed.toFixed(1)),
                oeeq: parseFloat(oeeq.toFixed(1)),
                oeer: parseFloat(oeer.toFixed(1))
            };
        });

        // Query 4: Get distinct secciones for filter dropdown
        const seccionesResult = await sql.query`
            SELECT DISTINCT 
                MS.[seccion] as codigo,
                MS.[denominacion]
            FROM [OPERACIONES] OP
            INNER JOIN [MAESTRO SECCIONES] MS ON OP.[seccion] = MS.[seccion]
            WHERE MS.[seccion] IS NOT NULL AND OP.[ComputoOEE] = 1
            ORDER BY MS.[seccion]
        `;
        const secciones = seccionesResult.recordset.map(r => ({
            codigo: r.codigo,
            denominacion: r.denominacion || ''
        }));

        // Query 5: Get distinct familias for filter dropdown
        const familiasResult = await sql.query`
            SELECT DISTINCT 
                MF.[codigo familia] as codigo,
                MF.[denominacion familia] as denominacion
            FROM [REGISTRO TRABAJOS] RT
            INNER JOIN [MAESTRO ARTICULOS] MA ON RT.[Articulo] = MA.[codigo articulo]
            INNER JOIN [MAESTRO FAMILIAS] MF ON MA.[codigo familia] = MF.[codigo familia] AND MA.[codigo tipo] = MF.[codigo tipo]
            WHERE MA.[codigo familia] IS NOT NULL AND MA.[codigo familia] <> ''
            ORDER BY MF.[codigo familia]
        `;
        const familias = familiasResult.recordset.map(r => ({
            codigo: r.codigo,
            denominacion: r.denominacion || ''
        }));

        // Query 6: Get available years
        const yearsResult = await sql.query`
            SELECT DISTINCT YEAR([fecha inicio]) as year
            FROM [REGISTRO TRABAJOS]
            WHERE [fecha inicio] IS NOT NULL
            ORDER BY year DESC
        `;
        const years = yearsResult.recordset.map(r => r.year);
        console.log('[OEE] Available years:', years);

        // Query 7: Get incidencias (active ones)
        const incidenciasResult = await sql.query`
            SELECT 
                [incidencia] as codigo,
                [descripcion],
                [actividad asignada] as actividadAsignada,
                [tipo_vinculacion] as tipoVinculacion
            FROM [INCIDENCIAS]
            WHERE [activo] = 1 OR [activo] = -1
            ORDER BY [incidencia]
        `;
        const incidencias = incidenciasResult.recordset;

        res.json({
            success: true,
            kpis: {
                oee: parseFloat(globalOee.toFixed(1)),
                oeed: parseFloat(globalOeed.toFixed(1)),
                oeeq: parseFloat(globalOeeq.toFixed(1)),
                oeer: parseFloat(globalOeer.toFixed(1)),
                totalPiezasOk,
                totalPiezasRc,
                totalHorasTeoricas: parseFloat(totalHorasTeoricas.toFixed(2)),
                totalHorasDisponibles: parseFloat(totalHorasDisponibles.toFixed(2)),
                totalHorasPlanificadas: parseFloat(totalHorasPlanificadas.toFixed(2))
            },
            operations: operations,
            trend: trend,
            filters: {
                secciones: secciones,
                familias: familias,
                years: years
            },
            incidencias: incidencias,
            selectedFilters: {
                year: selectedYear,
                month: month || null,
                seccion: seccion || null,
                familia: familia || null
            },
            timestamp: new Date()
        });

    } catch (err) {
        console.error('Error in /api/produccion/oee:', err);
        res.status(500).json({
            success: false,
            error: 'Error obtaining OEE data',
            details: err.message
        });
    }
});

// OTD Detalle
app.get('/api/otd-detalle', async (req, res) => {
    try {
        console.log('[API] /api/otd-detalle requested', req.query);

        const { ano, mes, cliente, familia, articulo, page = 1, pageSize = 50, sortBy, sortOrder } = req.query;
        const currentYear = new Date().getFullYear();
        const selectedYear = parseInt(ano) || currentYear;
        const offset = (parseInt(page) - 1) * parseInt(pageSize);

        const request = new sql.Request();
        request.input('ano', sql.Int, selectedYear);

        let baseJoin = `
            FROM Qry_Estadistica_Cumplimiento_Entregas T
            LEFT JOIN [MAESTRO CLIENTES] C ON T.[cliente] = C.[codigo cliente]
        `;

        let whereConditions = ['YEAR(T.[fecha albaran]) = @ano'];

        if (mes) {
            request.input('mes', sql.NVarChar, mes);
            whereConditions.push('DATENAME(month, T.[fecha albaran]) = @mes');
        }

        // Add support for numeric month (more reliable)
        const { month, estado } = req.query;
        if (month) {
            request.input('month', sql.Int, parseInt(month));
            whereConditions.push('MONTH(T.[fecha albaran]) = @month');
        }

        // Add support for delivery status
        if (estado === 'retrasado') {
            whereConditions.push('T.[DiferenciaDias] > 0');
        } else if (estado === 'a_tiempo') {
            whereConditions.push('T.[DiferenciaDias] <= 0');
        }
        if (cliente) {
            request.input('cliente', sql.NVarChar, `%${cliente}%`);
            whereConditions.push('C.[nombre empresa] LIKE @cliente');
        }
        if (familia) {
            const familiaArr = familia.split(',');
            const famParams = familiaArr.map((f, i) => `@fam${i}`);
            familiaArr.forEach((f, i) => request.input(`fam${i}`, sql.NVarChar, f));
            whereConditions.push(`T.[codigo familia] IN (${famParams.join(',')})`);
        }
        if (articulo) {
            request.input('articulo', sql.NVarChar, articulo);
            whereConditions.push('T.[articulo] = @articulo');
        }

        const whereClause = 'WHERE ' + whereConditions.join(' AND ');

        // Sorting - using verified column names
        const sortMap = {
            'numAlbaran': 'T.[numero albaran]',
            'articulo': 'T.[articulo]',
            'cantidadPedida': 'T.[cantidad pedida]',
            'cantidadServida': 'T.[CantidadAlbaran]',
            'fechaAlbaran': 'T.[fecha albaran]',
            'fechaEntrega': 'T.[fecha entrega]',
            'cliente': 'C.[nombre empresa]',
            'diferenciaDias': 'T.[DiferenciaDias]'
        };
        const sortColumn = sortMap[sortBy] || 'T.[fecha albaran]';
        const dir = sortOrder === 'ASC' ? 'ASC' : 'DESC';

        const dataQuery = `
            SELECT 
                T.[numero albaran] as numAlbaran,
                T.[articulo],
                T.[cantidad pedida] as cantidadPedida,
                T.[CantidadAlbaran] as cantidadServida,
                T.[fecha albaran] as fechaAlbaran,
                T.[fecha entrega] as fechaEntrega,
                C.[nombre empresa] as cliente,
                T.[DiferenciaDias] as diferenciaDias,
                CASE WHEN T.[DiferenciaDias] <= 0 THEN 'A tiempo' ELSE 'Retrasado' END as estado
            ${baseJoin}
            ${whereClause}
            ORDER BY ${sortColumn} ${dir}
            OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
        `;

        request.input('offset', sql.Int, offset);
        request.input('pageSize', sql.Int, parseInt(pageSize));

        const dataResult = await request.query(dataQuery);

        // Count total
        // Reuse request object to keep parameters (including @month which was missing in request2)
        const countQuery = `
            SELECT COUNT(*) as total
            ${baseJoin}
            ${whereClause}
        `;
        const countResult = await request.query(countQuery);
        const total = countResult.recordset[0].total;

        res.json({
            success: true,
            data: dataResult.recordset,
            total: total,
            page: parseInt(page),
            pageSize: parseInt(pageSize),
            totalPages: Math.ceil(total / parseInt(pageSize)),
            timestamp: new Date()
        });

    } catch (err) {
        console.error('Error SQL en /api/otd-detalle:', err);
        res.status(500).json({
            success: false,
            error: 'Error al obtener detalle OTD.',
            details: err.message
        });
    }
});

// =====================================================
// COMERCIAL DASHBOARD API
// =====================================================

// Endpoint para obtener datos del dashboard comercial
app.get('/api/comercial/dashboard', async (req, res) => {
    try {
        const { year, tipos, familias, subfamilias } = req.query;

        if (!year) {
            return res.status(400).json({
                success: false,
                error: 'El parámetro year es requerido.'
            });
        }

        // Parse filter arrays
        const tiposArr = tipos ? tipos.split(',').filter(t => t) : [];
        const familiasArr = familias ? familias.split(',').filter(f => f) : [];
        const subfamiliasArr = subfamilias ? subfamilias.split(',').filter(s => s) : [];

        // Build filter conditions
        let filterConditions = '';
        if (tiposArr.length > 0) {
            filterConditions += ` AND MA.[codigo tipo] IN (${tiposArr.map(t => `'${t.replace(/'/g, "''")}'`).join(',')})`;
        }
        if (familiasArr.length > 0) {
            filterConditions += ` AND MA.[codigo familia] IN (${familiasArr.map(f => `'${f.replace(/'/g, "''")}'`).join(',')})`;
        }
        if (subfamiliasArr.length > 0) {
            filterConditions += ` AND MA.[codigo subfamilia] IN (${subfamiliasArr.map(s => `'${s.replace(/'/g, "''")}'`).join(',')})`;
        }

        const request = new sql.Request();
        request.input('year', sql.Int, parseInt(year));

        // 1. Ventas mensuales del año (LINE LEVEL with FAMILY for chart breakdown)
        // Ensure codigoFamilia is trimmed to avoid whitespace issues
        const ventasMensualesResult = await request.query(`
            SELECT 
                MONTH(FC.[fecha factura]) as mes,
                CASE MONTH(FC.[fecha factura])
                    WHEN 1 THEN 'Enero'
                    WHEN 2 THEN 'Febrero'
                    WHEN 3 THEN 'Marzo'
                    WHEN 4 THEN 'Abril'
                    WHEN 5 THEN 'Mayo'
                    WHEN 6 THEN 'Junio'
                    WHEN 7 THEN 'Julio'
                    WHEN 8 THEN 'Agosto'
                    WHEN 9 THEN 'Septiembre'
                    WHEN 10 THEN 'Octubre'
                    WHEN 11 THEN 'Noviembre'
                    WHEN 12 THEN 'Diciembre'
                END as nombreMes,
                SUM(FL.[importe parcial euro]) as ventasEuro,
                COUNT(DISTINCT FC.IDCAB) as numFacturas,
                LTRIM(RTRIM(MA.[codigo familia])) as codigoFamilia
            FROM [FACTURAS VENTA LINEAS] FL
            INNER JOIN [FACTURAS VENTA CABECERAS] FC ON FL.IDCAB = FC.IDCAB
            LEFT JOIN [MAESTRO ARTICULOS] MA ON FL.articulo = MA.[codigo articulo]
            WHERE YEAR(FC.[fecha factura]) = @year
            ${filterConditions}
            GROUP BY MONTH(FC.[fecha factura]), MA.[codigo familia]
            ORDER BY mes
        `);

        // 2. Top 10 Clientes (LINE LEVEL)
        const request2 = new sql.Request();
        request2.input('year', sql.Int, parseInt(year));
        const topClientesResult = await request2.query(`
            SELECT TOP 10
                FC.cliente,
                MC.[nombre empresa] as nombreCliente,
                SUM(FL.[importe parcial euro]) as ventasEuro,
                COUNT(DISTINCT FC.IDCAB) as numFacturas
            FROM [FACTURAS VENTA LINEAS] FL
            INNER JOIN [FACTURAS VENTA CABECERAS] FC ON FL.IDCAB = FC.IDCAB
            LEFT JOIN [MAESTRO CLIENTES] MC ON FC.cliente = MC.[codigo cliente]
            LEFT JOIN [MAESTRO ARTICULOS] MA ON FL.articulo = MA.[codigo articulo]
            WHERE YEAR(FC.[fecha factura]) = @year
            ${filterConditions}
            GROUP BY FC.cliente, MC.[nombre empresa]
            ORDER BY ventasEuro DESC
        `);

        // 3. Top 10 Artículos (LINE LEVEL)
        const request3 = new sql.Request();
        request3.input('year', sql.Int, parseInt(year));
        const topArticulosResult = await request3.query(`
            SELECT TOP 10
                FL.articulo,
                MC.[nombre empresa] as cliente,
                SUM(FL.cantidad) as cantidadTotal,
                SUM(FL.[importe parcial euro]) as ventasEuro
            FROM [FACTURAS VENTA LINEAS] FL
            INNER JOIN [FACTURAS VENTA CABECERAS] FC ON FL.IDCAB = FC.IDCAB
            LEFT JOIN [MAESTRO CLIENTES] MC ON FC.cliente = MC.[codigo cliente]
            LEFT JOIN [MAESTRO ARTICULOS] MA ON FL.articulo = MA.[codigo articulo]
            WHERE YEAR(FC.[fecha factura]) = @year
            ${filterConditions}
            GROUP BY FL.articulo, MC.[nombre empresa]
            ORDER BY ventasEuro DESC
        `);

        // 3b. Top 10 Tipos
        const request3b = new sql.Request();
        request3b.input('year', sql.Int, parseInt(year));
        const topTiposResult = await request3b.query(`
            SELECT TOP 10
                MA.[codigo tipo] as codigo,
                MT.[denominacion tipo] as denominacion,
                SUM(FL.[importe parcial euro]) as ventasEuro
            FROM [FACTURAS VENTA LINEAS] FL
            INNER JOIN [FACTURAS VENTA CABECERAS] FC ON FL.IDCAB = FC.IDCAB
            LEFT JOIN [MAESTRO ARTICULOS] MA ON FL.articulo = MA.[codigo articulo]
            LEFT JOIN [MAESTRO TIPO ARTICULOS] MT ON MA.[codigo tipo] = MT.[codigo tipo]
            WHERE YEAR(FC.[fecha factura]) = @year
            ${filterConditions}
            GROUP BY MA.[codigo tipo], MT.[denominacion tipo]
            ORDER BY ventasEuro DESC
        `);

        // 3c. Top 10 Familias
        const request3c = new sql.Request();
        request3c.input('year', sql.Int, parseInt(year));
        const topFamiliasResult = await request3c.query(`
            SELECT TOP 10
                MA.[codigo familia] as codigo,
                MF.[denominacion familia] as denominacion,
                SUM(FL.[importe parcial euro]) as ventasEuro
            FROM [FACTURAS VENTA LINEAS] FL
            INNER JOIN [FACTURAS VENTA CABECERAS] FC ON FL.IDCAB = FC.IDCAB
            LEFT JOIN [MAESTRO ARTICULOS] MA ON FL.articulo = MA.[codigo articulo]
            LEFT JOIN [MAESTRO FAMILIAS] MF ON MA.[codigo familia] = MF.[codigo familia] AND MA.[codigo tipo] = MF.[codigo tipo]
            WHERE YEAR(FC.[fecha factura]) = @year
            ${filterConditions}
            GROUP BY MA.[codigo familia], MF.[denominacion familia]
            ORDER BY ventasEuro DESC
        `);

        // 4. KPIs generales (LINE LEVEL)
        const request4 = new sql.Request();
        request4.input('year', sql.Int, parseInt(year));
        const kpisResult = await request4.query(`
            SELECT 
                SUM(FL.[importe parcial euro]) as ventasTotales,
                COUNT(DISTINCT FC.IDCAB) as numFacturas,
                COUNT(DISTINCT FC.cliente) as numClientes,
                COUNT(DISTINCT FL.articulo) as numArticulos
            FROM [FACTURAS VENTA LINEAS] FL
            INNER JOIN [FACTURAS VENTA CABECERAS] FC ON FL.IDCAB = FC.IDCAB
            LEFT JOIN [MAESTRO ARTICULOS] MA ON FL.articulo = MA.[codigo articulo]
            WHERE YEAR(FC.[fecha factura]) = @year
            ${filterConditions}
        `);

        const kpis = kpisResult.recordset[0] || {};
        // Calculate ticket medio manually based on filtered totals
        kpis.ticketMedio = kpis.numFacturas > 0 ? kpis.ventasTotales / kpis.numFacturas : 0;

        // 5. Años disponibles (Global - no filters needed typically, or maybe yes? keeping global for now)
        const añosResult = await sql.query`
            SELECT DISTINCT YEAR([fecha factura]) as anio
            FROM [FACTURAS VENTA CABECERAS]
            WHERE [fecha factura] IS NOT NULL
            ORDER BY anio DESC
        `;

        // 6. Totales por año (Filtered)
        const totalesAnualesResult = await sql.query(`
            SELECT 
                YEAR(FC.[fecha factura]) as anio,
                SUM(FL.[importe parcial euro]) as ventasTotales
            FROM [FACTURAS VENTA LINEAS] FL
            INNER JOIN [FACTURAS VENTA CABECERAS] FC ON FL.IDCAB = FC.IDCAB
            LEFT JOIN [MAESTRO ARTICULOS] MA ON FL.articulo = MA.[codigo articulo]
            WHERE FC.[fecha factura] IS NOT NULL
            ${filterConditions}
            GROUP BY YEAR(FC.[fecha factura])
            ORDER BY anio DESC
        `);

        // 7. Get filter options: Tipos
        const tiposResult = await sql.query(`
            SELECT DISTINCT
                MA.[codigo tipo] as codigo,
                MT.[denominacion tipo] as denominacion
            FROM [FACTURAS VENTA LINEAS] FL
            INNER JOIN [MAESTRO ARTICULOS] MA ON FL.articulo = MA.[codigo articulo]
            LEFT JOIN [MAESTRO TIPO ARTICULOS] MT ON MA.[codigo tipo] = MT.[codigo tipo]
            WHERE MA.[codigo tipo] IS NOT NULL AND MA.[codigo tipo] <> ''
            ORDER BY MA.[codigo tipo]
        `);

        // 8. Get filter options: Familias
        let familiasQuery = `
            SELECT DISTINCT
                MA.[codigo familia] as codigo,
                MF.[denominacion familia] as denominacion
            FROM [FACTURAS VENTA LINEAS] FL
            INNER JOIN [MAESTRO ARTICULOS] MA ON FL.articulo = MA.[codigo articulo]
            LEFT JOIN [MAESTRO FAMILIAS] MF ON MA.[codigo familia] = MF.[codigo familia] AND MA.[codigo tipo] = MF.[codigo tipo]
            WHERE MA.[codigo familia] IS NOT NULL AND MA.[codigo familia] <> ''
        `;
        if (tiposArr.length > 0) {
            familiasQuery += ` AND MA.[codigo tipo] IN (${tiposArr.map(t => `'${t.replace(/'/g, "''")}'`).join(',')})`;
        }
        familiasQuery += ` ORDER BY MA.[codigo familia]`;
        const familiasResult = await sql.query(familiasQuery);

        // 9. Get filter options: Subfamilias
        let subfamiliasQuery = `
            SELECT DISTINCT
                MA.[codigo subfamilia] as codigo,
                MS.[denominacion subfamilia] as denominacion
            FROM [FACTURAS VENTA LINEAS] FL
            INNER JOIN [MAESTRO ARTICULOS] MA ON FL.articulo = MA.[codigo articulo]
            LEFT JOIN [MAESTRO SUBFAMILIAS] MS ON MA.[codigo subfamilia] = MS.[codigo subfamilia] AND MA.[codigo familia] = MS.[codigo familia] AND MA.[codigo tipo] = MS.[codigo tipo]
            WHERE MA.[codigo subfamilia] IS NOT NULL AND MA.[codigo subfamilia] <> ''
        `;
        if (tiposArr.length > 0) {
            subfamiliasQuery += ` AND MA.[codigo tipo] IN (${tiposArr.map(t => `'${t.replace(/'/g, "''")}'`).join(',')})`;
        }
        if (familiasArr.length > 0) {
            subfamiliasQuery += ` AND MA.[codigo familia] IN (${familiasArr.map(f => `'${f.replace(/'/g, "''")}'`).join(',')})`;
        }
        subfamiliasQuery += ` ORDER BY MA.[codigo subfamilia]`;
        const subfamiliasResult = await sql.query(subfamiliasQuery);

        res.json({
            success: true,
            ventasMensuales: ventasMensualesResult.recordset,
            topClientes: topClientesResult.recordset,
            topArticulos: topArticulosResult.recordset,
            topTipos: topTiposResult.recordset,
            topFamilias: topFamiliasResult.recordset,
            kpis: {
                ventasTotales: kpis.ventasTotales || 0,
                numFacturas: kpis.numFacturas || 0,
                numClientes: kpis.numClientes || 0,
                numArticulos: kpis.numArticulos || 0,
                ticketMedio: kpis.ticketMedio || 0
            },
            anosDisponibles: añosResult.recordset.map(r => r.anio),
            totalesAnuales: totalesAnualesResult.recordset,
            filtros: {
                tipos: tiposResult.recordset.map(r => ({ codigo: r.codigo, denominacion: r.denominacion || '' })),
                familias: familiasResult.recordset.map(r => ({ codigo: r.codigo, denominacion: r.denominacion || '' })),
                subfamilias: subfamiliasResult.recordset.map(r => ({ codigo: r.codigo, denominacion: r.denominacion || '' }))
            },
            selectedFilters: {
                tipos: tiposArr,
                familias: familiasArr,
                subfamilias: subfamiliasArr
            },
            timestamp: new Date()
        });

    } catch (err) {
        console.error('Error SQL en /api/comercial/dashboard:', err);
        res.status(500).json({
            success: false,
            error: 'Error al obtener datos del dashboard comercial.',
            details: err.message
        });
    }
});

// =====================================================
// COMPRAS DASHBOARD API
// =====================================================

app.get('/api/compras/dashboard', async (req, res) => {
    try {
        const { year, tipos, familias, subfamilias } = req.query;

        if (!year) {
            return res.status(400).json({
                success: false,
                error: 'El parámetro year es requerido.'
            });
        }

        // Parse filter arrays
        const tiposArr = tipos ? tipos.split(',').filter(t => t) : [];
        const familiasArr = familias ? familias.split(',').filter(f => f) : [];
        const subfamiliasArr = subfamilias ? subfamilias.split(',').filter(s => s) : [];

        // Build filter conditions for queries that join with MAESTRO ARTICULOS
        let filterConditions = '';
        if (tiposArr.length > 0) {
            filterConditions += ` AND MA.[codigo tipo] IN (${tiposArr.map(t => `'${t.replace(/'/g, "''")}'`).join(',')})`;
        }
        if (familiasArr.length > 0) {
            filterConditions += ` AND MA.[codigo familia] IN (${familiasArr.map(f => `'${f.replace(/'/g, "''")}'`).join(',')})`;
        }
        if (subfamiliasArr.length > 0) {
            filterConditions += ` AND MA.[codigo subfamilia] IN (${subfamiliasArr.map(s => `'${s.replace(/'/g, "''")}'`).join(',')})`;
        }

        const request = new sql.Request();
        request.input('year', sql.Int, parseInt(year));

        // 1. Compras mensuales del año (with filters if applied)
        let comprasMensualesQuery = `
            SELECT
        MONTH(FC.[fecha factura]) as mes,
            ISNULL(MF.[denominacion familia], 'OTROS') as familia,
            SUM(FL.[importe parcial]) as comprasEuro
        FROM[FACTURAS CABECERA]FC
            INNER JOIN[FACTURAS LINEAS] FL ON FC.[numero factura] = FL.[numero factura]
            LEFT JOIN[MAESTRO ARTICULOS] MA ON FL.[codigo material] = MA.[codigo articulo]
            LEFT JOIN[MAESTRO FAMILIAS] MF ON MA.[codigo familia] = MF.[codigo familia] AND MA.[codigo tipo] = MF.[codigo tipo]
            WHERE YEAR(FC.[fecha factura]) = @year
            ${filterConditions}
            GROUP BY MONTH(FC.[fecha factura]), MF.[denominacion familia]
            ORDER BY mes
            `;
        const comprasMensualesResult = await request.query(comprasMensualesQuery);

        // 2. Top 10 Proveedores (include codigo proveedor)
        const request2 = new sql.Request();
        request2.input('year', sql.Int, parseInt(year));
        let topProveedoresQuery = `
            SELECT TOP 10
        FC.[codigo proveedor] as codigoProveedor,
            MP.[denominacion proveedor] as nombreProveedor,
                SUM(FL.[importe parcial]) as comprasEuro,
                COUNT(DISTINCT FC.[numero factura]) as numFacturas
        FROM[FACTURAS CABECERA]FC
            INNER JOIN[FACTURAS LINEAS] FL ON FC.[numero factura] = FL.[numero factura]
            LEFT JOIN[PROVEEDORES MAESTRO] MP ON FC.[codigo proveedor] = MP.[codigo proveedor]
            LEFT JOIN[MAESTRO ARTICULOS] MA ON FL.[codigo material] = MA.[codigo articulo]
            WHERE YEAR(FC.[fecha factura]) = @year
            ${filterConditions}
            GROUP BY FC.[codigo proveedor], MP.[denominacion proveedor]
            ORDER BY comprasEuro DESC
            `;
        const topProveedoresResult = await request2.query(topProveedoresQuery);

        // 3. Top 10 Artículos with importe parcial and denominacion
        const request3 = new sql.Request();
        request3.input('year', sql.Int, parseInt(year));
        let topArticulosQuery = `
            SELECT TOP 10
        FL.[codigo material] as articulo,
            FL.[denominacion material] as denominacion,
                MP.[denominacion proveedor] as proveedor,
                    SUM(FL.cantidad) as cantidadTotal,
                    SUM(FL.[importe parcial]) as comprasEuro
        FROM[FACTURAS LINEAS]FL
            INNER JOIN[FACTURAS CABECERA] FC ON FL.[numero factura] = FC.[numero factura]
            LEFT JOIN[PROVEEDORES MAESTRO] MP ON FC.[codigo proveedor] = MP.[codigo proveedor]
            LEFT JOIN[MAESTRO ARTICULOS] MA ON FL.[codigo material] = MA.[codigo articulo]
            WHERE YEAR(FC.[fecha factura]) = @year
            ${filterConditions}
            GROUP BY FL.[codigo material], FL.[denominacion material], MP.[denominacion proveedor]
            ORDER BY comprasEuro DESC
            `;
        const topArticulosResult = await request3.query(topArticulosQuery);

        // 3b. Top 10 Tipos
        const request3b = new sql.Request();
        request3b.input('year', sql.Int, parseInt(year));
        let topTiposQuery = `
            SELECT TOP 10
                MT.[codigo tipo] as codigo,
                MT.[denominacion tipo] as denominacion,
                SUM(FL.[importe parcial]) as comprasEuro
            FROM [FACTURAS LINEAS] FL
            INNER JOIN [FACTURAS CABECERA] FC ON FL.[numero factura] = FC.[numero factura]
            INNER JOIN [MAESTRO ARTICULOS] MA ON FL.[codigo material] = MA.[codigo articulo]
            LEFT JOIN [MAESTRO TIPO ARTICULOS] MT ON MA.[codigo tipo] = MT.[codigo tipo]
            WHERE YEAR(FC.[fecha factura]) = @year
            ${filterConditions}
            GROUP BY MT.[codigo tipo], MT.[denominacion tipo]
            ORDER BY comprasEuro DESC
        `;
        const topTiposResult = await request3b.query(topTiposQuery);

        // 3c. Top 10 Familias
        const request3c = new sql.Request();
        request3c.input('year', sql.Int, parseInt(year));
        let topFamiliasQuery = `
            SELECT TOP 10
                MF.[codigo familia] as codigo,
                MF.[denominacion familia] as denominacion,
                SUM(FL.[importe parcial]) as comprasEuro
            FROM [FACTURAS LINEAS] FL
            INNER JOIN [FACTURAS CABECERA] FC ON FL.[numero factura] = FC.[numero factura]
            INNER JOIN [MAESTRO ARTICULOS] MA ON FL.[codigo material] = MA.[codigo articulo]
            LEFT JOIN [MAESTRO FAMILIAS] MF ON MA.[codigo familia] = MF.[codigo familia] AND MA.[codigo tipo] = MF.[codigo tipo]
            WHERE YEAR(FC.[fecha factura]) = @year
            ${filterConditions}
            GROUP BY MF.[codigo familia], MF.[denominacion familia]
            ORDER BY comprasEuro DESC
        `;
        const topFamiliasResult = await request3c.query(topFamiliasQuery);

        // 4. KPIs generales (with filters)
        const request4 = new sql.Request();
        request4.input('year', sql.Int, parseInt(year));
        let kpisQuery = `
        SELECT
            SUM(FL.[importe parcial]) as comprasSeleccion,
            COUNT(DISTINCT FC.[numero factura]) as numFacturas,
            COUNT(DISTINCT FC.[codigo proveedor]) as numProveedores,
            AVG(FL.[importe parcial]) as ticketMedio
        FROM [FACTURAS CABECERA] FC
            INNER JOIN [FACTURAS LINEAS] FL ON FC.[numero factura] = FL.[numero factura]
            LEFT JOIN [MAESTRO ARTICULOS] MA ON FL.[codigo material] = MA.[codigo articulo]
            WHERE YEAR(FC.[fecha factura]) = @year
            ${filterConditions}
        `;
        const kpisResult = await request4.query(kpisQuery);

        // 4b. KPI Totales Año (Fixed, ignoring filters)
        const request4b = new sql.Request();
        request4b.input('year', sql.Int, parseInt(year));
        let kpisFixedQuery = `
        SELECT SUM(FL.[importe parcial]) as comprasTotalesSinFiltro
        FROM [FACTURAS CABECERA] FC
            INNER JOIN [FACTURAS LINEAS] FL ON FC.[numero factura] = FL.[numero factura]
        WHERE YEAR(FC.[fecha factura]) = @year
        `;
        const kpisFixedResult = await request4b.query(kpisFixedQuery);

        // 5. Años disponibles
        const añosResult = await sql.query`
            SELECT DISTINCT YEAR([fecha factura]) as anio
        FROM [FACTURAS CABECERA]
        WHERE [fecha factura] IS NOT NULL
            ORDER BY anio DESC
            `;

        // 6. Totales por año (para gráfico comparativo) - filtered based on current filters (excluding year)
        const totalesAnualesResult = await sql.query(`
        SELECT
        YEAR(FC.[fecha factura]) as anio,
            SUM(FL.[importe parcial]) as comprasTotales
        FROM[FACTURAS CABECERA]FC
            INNER JOIN[FACTURAS LINEAS] FL ON FC.[numero factura] = FL.[numero factura]
            LEFT JOIN[MAESTRO ARTICULOS] MA ON FL.[codigo material] = MA.[codigo articulo]
            WHERE FC.[fecha factura] IS NOT NULL
            ${filterConditions}
            GROUP BY YEAR(FC.[fecha factura])
            ORDER BY anio DESC
            `);

        // 7. Get filter options: Tipos (with denomination from MAESTRO TIPO ARTICULOS)
        const tiposResult = await sql.query`
            SELECT DISTINCT
        MA.[codigo tipo] as codigo,
            MT.[denominacion tipo] as denominacion
        FROM[FACTURAS LINEAS]FL
            INNER JOIN[FACTURAS CABECERA] FC ON FL.[numero factura] = FC.[numero factura]
            INNER JOIN[MAESTRO ARTICULOS] MA ON FL.[codigo material] = MA.[codigo articulo]
            LEFT JOIN[MAESTRO TIPO ARTICULOS] MT ON MA.[codigo tipo] = MT.[codigo tipo]
            WHERE MA.[codigo tipo] IS NOT NULL AND MA.[codigo tipo] <> ''
            ORDER BY MA.[codigo tipo]
            `;

        // 8. Get filter options: Familias - filtered by selected tipos
        let familiasQuery = `
            SELECT DISTINCT
            MA.[codigo familia] as codigo,
            MF.[denominacion familia] as denominacion
            FROM [FACTURAS LINEAS] FL
            INNER JOIN [FACTURAS CABECERA] FC ON FL.[numero factura] = FC.[numero factura]
            INNER JOIN [MAESTRO ARTICULOS] MA ON FL.[codigo material] = MA.[codigo articulo]
            LEFT JOIN [MAESTRO FAMILIAS] MF ON MA.[codigo familia] = MF.[codigo familia] AND MA.[codigo tipo] = MF.[codigo tipo]
            WHERE MA.[codigo familia] IS NOT NULL AND MA.[codigo familia] <> ''
                `;
        if (tiposArr.length > 0) {
            familiasQuery += ` AND MA.[codigo tipo] IN (${tiposArr.map(t => `'${t.replace(/'/g, "''")}'`).join(',')})`;
        }
        familiasQuery += ` ORDER BY MA.[codigo familia]`;
        const familiasResult = await sql.query(familiasQuery);

        // 9. Get filter options: Subfamilias - filtered by selected familias (and tipos)
        let subfamiliasQuery = `
                SELECT DISTINCT
                MA.[codigo subfamilia] as codigo,
                MS.[denominacion subfamilia] as denominacion
                FROM [FACTURAS LINEAS] FL
                INNER JOIN [FACTURAS CABECERA] FC ON FL.[numero factura] = FC.[numero factura]
                INNER JOIN [MAESTRO ARTICULOS] MA ON FL.[codigo material] = MA.[codigo articulo]
                LEFT JOIN [MAESTRO SUBFAMILIAS] MS ON MA.[codigo subfamilia] = MS.[codigo subfamilia] AND MA.[codigo familia] = MS.[codigo familia] AND MA.[codigo tipo] = MS.[codigo tipo]
                WHERE MA.[codigo subfamilia] IS NOT NULL AND MA.[codigo subfamilia] <> ''
                    `;
        if (tiposArr.length > 0) {
            subfamiliasQuery += ` AND MA.[codigo tipo] IN (${tiposArr.map(t => `'${t.replace(/'/g, "''")}'`).join(',')})`;
        }
        if (familiasArr.length > 0) {
            subfamiliasQuery += ` AND MA.[codigo familia] IN (${familiasArr.map(f => `'${f.replace(/'/g, "''")}'`).join(',')})`;
        }
        subfamiliasQuery += ` ORDER BY MA.[codigo subfamilia]`;
        const subfamiliasResult = await sql.query(subfamiliasQuery);

        const kpis = kpisResult.recordset[0] || {};
        const kpisFixed = kpisFixedResult.recordset[0] || {};

        res.json({
            success: true,
            comprasMensuales: comprasMensualesResult.recordset,
            topProveedores: topProveedoresResult.recordset,
            topArticulos: topArticulosResult.recordset,
            topTipos: topTiposResult.recordset,
            topFamilias: topFamiliasResult.recordset,
            kpis: {
                comprasTotales: kpisFixed.comprasTotalesSinFiltro || 0,
                comprasSeleccion: kpis.comprasSeleccion || 0,
                numFacturas: kpis.numFacturas || 0,
                numProveedores: kpis.numProveedores || 0,
                ticketMedio: kpis.ticketMedio || 0
            },
            anosDisponibles: añosResult.recordset.map(r => r.anio),
            totalesAnuales: totalesAnualesResult.recordset,
            filtros: {
                tipos: tiposResult.recordset.map(r => ({ codigo: r.codigo, denominacion: r.denominacion || '' })),
                familias: familiasResult.recordset.map(r => ({ codigo: r.codigo, denominacion: r.denominacion || '' })),
                subfamilias: subfamiliasResult.recordset.map(r => ({ codigo: r.codigo, denominacion: r.denominacion || '' }))
            },
            selectedFilters: {
                tipos: tiposArr,
                familias: familiasArr,
                subfamilias: subfamiliasArr
            },
            timestamp: new Date()
        });

    } catch (err) {
        console.error('Error SQL en /api/compras/dashboard:', err);
        res.status(500).json({
            success: false,
            error: 'Error al obtener datos del dashboard de compras.',
            details: err.message
        });
    }
});

// =====================================================
// ESPECIFICACIONES API (MAESTROS)
// =====================================================

app.get('/api/especificaciones', async (req, res) => {
    try {
        const { nec, estado, ambito, tipo, page = 1, pageSize = 50 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(pageSize);

        const request = new sql.Request();

        let whereConditions = [];

        // Filter by NºEC
        if (nec) {
            request.input('nec', sql.NVarChar, `%${nec}%`);
            whereConditions.push('E.[NºEC] LIKE @nec');
        }

        // Filter by Estado (-1 = Sí, 0 = No)
        if (estado !== undefined && estado !== '') {
            request.input('estado', sql.Int, parseInt(estado));
            whereConditions.push('E.[Estado] = @estado');
        }

        // Filter by Ámbito
        if (ambito) {
            request.input('ambito', sql.NVarChar, ambito);
            whereConditions.push('E.[Ambito] = @ambito');
        }

        // Filter by Tipo
        if (tipo) {
            request.input('tipo', sql.NVarChar, tipo);
            whereConditions.push('E.[TIPO] = @tipo');
        }

        const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

        // Main query with JOINs to get descriptions
        const dataQuery = `
            SELECT 
                E.[IdEspecificacion],
                E.[NºEC] as NEC,
                E.[Revisión] as Revision,
                E.[Nombre],
                E.[Fecha],
                E.[Estado],
                E.[Ambito] as ambitoCodigo,
                ISNULL(A.[descripcion ambito], '') as ambitoDescripcion,
                E.[TIPO] as tipoCodigo,
                ISNULL(T.[descripcion escpecificacion], '') as tipoDescripcion
            FROM [LISTADO ESPECIFICACIONES] E
            LEFT JOIN [MAESTRO AMBITOS ESPECIFICACIONES COMPRA] A ON E.[Ambito] = A.[tipo ambito]
            LEFT JOIN [MAESTRO TIPO ESPECIFICACIONES COMPRA] T ON E.[TIPO] = T.[tipo especificacion]
            ${whereClause}
            ORDER BY E.[NºEC] DESC
            OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
        `;

        request.input('offset', sql.Int, offset);
        request.input('pageSize', sql.Int, parseInt(pageSize));

        const dataResult = await request.query(dataQuery);

        // Count total records
        const request2 = new sql.Request();
        if (nec) request2.input('nec', sql.NVarChar, `%${nec}%`);
        if (estado !== undefined && estado !== '') request2.input('estado', sql.Int, parseInt(estado));
        if (ambito) request2.input('ambito', sql.NVarChar, ambito);
        if (tipo) request2.input('tipo', sql.NVarChar, tipo);

        const countQuery = `
            SELECT COUNT(*) as total
            FROM [LISTADO ESPECIFICACIONES] E
            LEFT JOIN [MAESTRO AMBITOS ESPECIFICACIONES COMPRA] A ON E.[Ambito] = A.[tipo ambito]
            LEFT JOIN [MAESTRO TIPO ESPECIFICACIONES COMPRA] T ON E.[TIPO] = T.[tipo especificacion]
            ${whereClause}
        `;
        const countResult = await request2.query(countQuery);
        const total = countResult.recordset[0].total;

        // Get filter options: Ámbitos
        const ambitosResult = await sql.query`
            SELECT [tipo ambito] as codigo, [descripcion ambito] as descripcion
            FROM [MAESTRO AMBITOS ESPECIFICACIONES COMPRA]
            ORDER BY [tipo ambito]
        `;

        // Get filter options: Tipos
        const tiposResult = await sql.query`
            SELECT [tipo especificacion] as codigo, [descripcion escpecificacion] as descripcion
            FROM [MAESTRO TIPO ESPECIFICACIONES COMPRA]
            ORDER BY [tipo especificacion]
        `;

        res.json({
            success: true,
            data: dataResult.recordset,
            total: total,
            page: parseInt(page),
            pageSize: parseInt(pageSize),
            totalPages: Math.ceil(total / parseInt(pageSize)),
            filtros: {
                ambitos: ambitosResult.recordset,
                tipos: tiposResult.recordset
            },
            timestamp: new Date()
        });

    } catch (err) {
        console.error('Error SQL en /api/especificaciones:', err.message);
        console.error('Stack:', err.stack);
        res.status(500).json({
            success: false,
            error: 'Error al obtener especificaciones.',
            details: err.message
        });
    }
});

// Endpoint para OEE Dashboard (ProductionSection)


// =====================================================
// INCIDENCIAS API (MAESTROS)
// =====================================================

app.get('/api/incidencias', async (req, res) => {
    try {
        const { seccion, actividadAsignada, activo, tipoVinculacion, busqueda } = req.query;

        const request = new sql.Request();
        let whereConditions = [];

        // Filter by búsqueda (código incidencia o descripción)
        if (busqueda) {
            request.input('busqueda', sql.NVarChar, `%${busqueda}%`);
            whereConditions.push('(I.[incidencia] LIKE @busqueda OR I.[descripcion] LIKE @busqueda)');
        }

        // Filter by sección
        if (seccion) {
            request.input('seccion', sql.NVarChar, seccion);
            whereConditions.push('I.[seccion] = @seccion');
        }

        // Filter by actividad asignada
        if (actividadAsignada) {
            request.input('actividadAsignada', sql.NVarChar, actividadAsignada);
            whereConditions.push('I.[actividad asignada] = @actividadAsignada');
        }

        // Filter by activo (1 = Sí, 0 = No)
        if (activo !== undefined && activo !== '') {
            request.input('activo', sql.Int, parseInt(activo));
            whereConditions.push('I.[activo] = @activo');
        }

        // Filter by tipo_vinculacion
        if (tipoVinculacion) {
            request.input('tipoVinculacion', sql.NVarChar, tipoVinculacion);
            whereConditions.push('I.[tipo_vinculacion] = @tipoVinculacion');
        }

        const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

        // Main data query
        const dataQuery = `
            SELECT
                I.[incidencia],
                I.[descripcion],
                I.[remunerada],
                I.[a prima],
                I.[actividad asignada],
                I.[seccion],
                MS.[denominacion] as seccion_nombre,
                I.[activo],
                I.[tipo_vinculacion]
            FROM [INCIDENCIAS] I
            LEFT JOIN [MAESTRO SECCIONES] MS ON I.[seccion] = MS.[seccion]
            ${whereClause}
            ORDER BY I.[incidencia]
        `;

        const dataResult = await request.query(dataQuery);

        // Get distinct secciones for filter dropdown
        const seccionesResult = await sql.query`
            SELECT DISTINCT 
                I.[seccion] as codigo,
                MS.[denominacion] as nombre
            FROM [INCIDENCIAS] I
            LEFT JOIN [MAESTRO SECCIONES] MS ON I.[seccion] = MS.[seccion]
            WHERE I.[seccion] IS NOT NULL AND I.[seccion] <> ''
            ORDER BY MS.[denominacion]
        `;

        // Get distinct actividades asignadas for filter dropdown
        const actividadesResult = await sql.query`
            SELECT DISTINCT [actividad asignada] as actividad
            FROM [INCIDENCIAS]
            WHERE [actividad asignada] IS NOT NULL AND [actividad asignada] <> ''
            ORDER BY [actividad asignada]
        `;

        // Get distinct tipos de vinculación for filter dropdown
        const tiposVinculacionResult = await sql.query`
            SELECT DISTINCT [tipo_vinculacion] as tipo
            FROM [INCIDENCIAS]
            WHERE [tipo_vinculacion] IS NOT NULL AND [tipo_vinculacion] <> ''
            ORDER BY [tipo_vinculacion]
        `;

        res.json({
            success: true,
            data: dataResult.recordset,
            count: dataResult.recordset.length,
            filtros: {
                secciones: seccionesResult.recordset.map(r => ({
                    codigo: r.codigo,
                    nombre: r.nombre || r.codigo
                })),
                actividades: actividadesResult.recordset.map(r => r.actividad),
                tiposVinculacion: tiposVinculacionResult.recordset.map(r => r.tipo)
            },
            timestamp: new Date()
        });

    } catch (err) {
        console.error('Error SQL en /api/incidencias:', err);
        res.status(500).json({
            success: false,
            error: 'Error al obtener incidencias.',
            details: err.message
        });
    }
});

// =====================================================
// AUSENCIAS API (MAESTROS)
// =====================================================

app.get('/api/ausencias', async (req, res) => {
    try {
        const { codigo, denominacion, absentismo } = req.query;

        const request = new sql.Request();
        let whereConditions = [];

        // Filter by código
        if (codigo) {
            request.input('codigo', sql.NVarChar, `%${codigo}%`);
            whereConditions.push('[Codigo] LIKE @codigo');
        }

        // Filter by denominación
        if (denominacion) {
            request.input('denominacion', sql.NVarChar, `%${denominacion}%`);
            whereConditions.push('[Denominacion] LIKE @denominacion');
        }

        // Filter by absentismo (Sí/No -> -1/0)
        if (absentismo !== undefined && absentismo !== '') {
            const absentismoValue = parseInt(absentismo);
            request.input('absentismo', sql.Int, absentismoValue);
            whereConditions.push('[absentismo] = @absentismo');
        }

        const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

        // Main data query
        const dataQuery = `
            SELECT
                [Codigo],
                [Denominacion],
                [absentismo]
            FROM [MAESTRO AUSENCIAS]
            ${whereClause}
            ORDER BY [Codigo]
        `;

        const dataResult = await request.query(dataQuery);

        res.json({
            success: true,
            data: dataResult.recordset,
            count: dataResult.recordset.length,
            timestamp: new Date()
        });

    } catch (err) {
        console.error('Error SQL en /api/ausencias:', err);
        res.status(500).json({
            success: false,
            error: 'Error al obtener ausencias.',
            details: err.message
        });
    }
});

// =====================================================
// SECCIONES API (MAESTROS)
// =====================================================

app.get('/api/secciones', async (req, res) => {
    try {
        const { seccion, denominacion } = req.query;

        const request = new sql.Request();
        let whereConditions = [];

        // Filter by sección
        if (seccion) {
            request.input('seccion', sql.NVarChar, `%${seccion}%`);
            whereConditions.push('[seccion] LIKE @seccion');
        }

        // Filter by denominación
        if (denominacion) {
            request.input('denominacion', sql.NVarChar, `%${denominacion}%`);
            whereConditions.push('[denominacion] LIKE @denominacion');
        }

        const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

        // Main data query
        const dataQuery = `
            SELECT
                [seccion],
                [denominacion]
            FROM [MAESTRO SECCIONES]
            ${whereClause}
            ORDER BY [seccion]
        `;

        const dataResult = await request.query(dataQuery);

        res.json({
            success: true,
            data: dataResult.recordset,
            count: dataResult.recordset.length,
            timestamp: new Date()
        });

    } catch (err) {
        console.error('Error SQL en /api/secciones:', err);
        res.status(500).json({
            success: false,
            error: 'Error al obtener secciones.',
            details: err.message
        });
    }
});

// =====================================================
// ESTRUCTURAS API (MAESTROS)
// =====================================================

// Endpoint para obtener filtros de estructuras (componentes y operaciones)
app.get('/api/estructuras-filtros', async (req, res) => {
    try {
        const { articulo } = req.query;

        let componentesResult, operacionesResult;

        if (articulo) {
            // If article is specified, get only components and operations for that article
            const request = new sql.Request();
            request.input('articulo', sql.NVarChar, articulo);

            componentesResult = await request.query(`
                SELECT DISTINCT E.[componente], A.[denominacion articulo]
                FROM [ESTRUCTURAS] E
                LEFT JOIN [MAESTRO ARTICULOS] A ON E.[componente] = A.[codigo articulo]
                WHERE E.[articulo] = @articulo
                  AND E.[componente] IS NOT NULL 
                  AND E.[componente] <> ''
                ORDER BY E.[componente]
            `);

            const request2 = new sql.Request();
            request2.input('articulo', sql.NVarChar, articulo);
            operacionesResult = await request2.query(`
                SELECT DISTINCT E.[operacion], O.[denominacion operacion]
                FROM [ESTRUCTURAS] E
                LEFT JOIN [MAESTRO OPERACIONES] O ON E.[operacion] = O.[codigo operacion]
                WHERE E.[articulo] = @articulo
                  AND E.[operacion] IS NOT NULL
                ORDER BY E.[operacion]
            `);
        } else {
            // If no article, return empty (filters depend on article selection)
            componentesResult = { recordset: [] };
            operacionesResult = { recordset: [] };
        }

        res.json({
            success: true,
            componentes: componentesResult.recordset.map(c => ({
                codigo: c.componente,
                descripcion: c['denominacion articulo'] || c.componente
            })),
            operaciones: operacionesResult.recordset.map(o => ({
                codigo: o.operacion,
                descripcion: o['denominacion operacion'] || o.operacion
            }))
        });

    } catch (err) {
        console.error('Error SQL en /api/estructuras-filtros:', err);
        res.status(500).json({
            success: false,
            error: 'Error al obtener filtros de estructuras.',
            details: err.message
        });
    }
});

app.get('/api/estructuras', async (req, res) => {
    try {
        const { articulo, componente, operacion, page = 1, pageSize = 50 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(pageSize);

        const request = new sql.Request();
        let whereConditions = [];

        // Filter by artículo (con alias E.)
        if (articulo) {
            request.input('articulo', sql.NVarChar, `%${articulo}%`);
            whereConditions.push('E.[cod de articulo] LIKE @articulo');
        }

        // Filter by componente (con alias E.)
        if (componente) {
            request.input('componente', sql.NVarChar, `%${componente}%`);
            whereConditions.push('E.[componente] LIKE @componente');
        }

        // Filter by operación (con alias E.)
        if (operacion) {
            request.input('operacion', sql.Int, parseInt(operacion));
            whereConditions.push('E.[operacion] = @operacion');
        }

        const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

        // Count total records
        const countRequest = new sql.Request();
        if (articulo) countRequest.input('articulo', sql.NVarChar, `%${articulo}%`);
        if (componente) countRequest.input('componente', sql.NVarChar, `%${componente}%`);
        if (operacion) countRequest.input('operacion', sql.Int, parseInt(operacion));

        const countQuery = `
            SELECT COUNT(*) as total
            FROM [ESTRUCTURAS] E
            LEFT JOIN [MAESTRO ARTICULOS] MA ON E.[componente] = MA.[codigo articulo]
            LEFT JOIN [RUTAS] R ON E.[cod de articulo] = R.[cod de articulo] AND E.[operacion] = R.[secuencia]
            ${whereClause}
        `;
        const countResult = await countRequest.query(countQuery);
        const total = countResult.recordset[0].total;

        // Main data query with JOINs for descriptions and pagination
        request.input('offset', sql.Int, offset);
        request.input('pageSize', sql.Int, parseInt(pageSize));

        const dataQuery = `
            SELECT
                E.[ID],
                E.[cod de articulo],
                E.[componente],
                MA.[denominacion articulo] as componenteDescripcion,
                E.[operacion],
                R.[descripcion] as operacionDescripcion,
                E.[OperacionInventario],
                E.[cantidad],
                E.[CantidadProduccion],
                MA.[precio ultimo] as precioUltimo,
                ISNULL(E.[cantidad], 0) * ISNULL(MA.[precio ultimo], 0) as coste
            FROM [ESTRUCTURAS] E
            LEFT JOIN [MAESTRO ARTICULOS] MA ON E.[componente] = MA.[codigo articulo]
            LEFT JOIN [RUTAS] R ON E.[cod de articulo] = R.[cod de articulo] AND E.[operacion] = R.[secuencia]
            ${whereClause}
            ORDER BY E.[cod de articulo], E.[operacion]
            OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
        `;

        const dataResult = await request.query(dataQuery);

        // Calculate total cost when filtering by article
        let costeTotal = null;
        if (articulo) {
            const costRequest = new sql.Request();
            costRequest.input('articulo', sql.NVarChar, `%${articulo}%`);
            if (componente) costRequest.input('componente', sql.NVarChar, `%${componente}%`);
            if (operacion) costRequest.input('operacion', sql.Int, parseInt(operacion));

            const costQuery = `
                SELECT SUM(ISNULL(E.[cantidad], 0) * ISNULL(MA.[precio ultimo], 0)) as costeTotal
                FROM [ESTRUCTURAS] E
                LEFT JOIN [MAESTRO ARTICULOS] MA ON E.[componente] = MA.[codigo articulo]
                ${whereClause}
            `;
            const costResult = await costRequest.query(costQuery);
            costeTotal = costResult.recordset[0]?.costeTotal || 0;
        }

        // Get TOP 10 articles with highest cost
        const top10Query = `
            SELECT TOP 10
                E.[cod de articulo] as articulo,
                MA2.[denominacion articulo] as denominacion,
                SUM(ISNULL(E.[cantidad], 0) * ISNULL(MA.[precio ultimo], 0)) as costeTotalArticulo
            FROM [ESTRUCTURAS] E
            LEFT JOIN [MAESTRO ARTICULOS] MA ON E.[componente] = MA.[codigo articulo]
            LEFT JOIN [MAESTRO ARTICULOS] MA2 ON E.[cod de articulo] = MA2.[codigo articulo]
            GROUP BY E.[cod de articulo], MA2.[denominacion articulo]
            HAVING SUM(ISNULL(E.[cantidad], 0) * ISNULL(MA.[precio ultimo], 0)) > 0
            ORDER BY costeTotalArticulo DESC
        `;
        const top10Result = await sql.query(top10Query);

        res.json({
            success: true,
            data: dataResult.recordset,
            count: dataResult.recordset.length,
            total: total,
            page: parseInt(page),
            pageSize: parseInt(pageSize),
            totalPages: Math.ceil(total / parseInt(pageSize)),
            costeTotal: costeTotal,
            top10Articulos: top10Result.recordset,
            timestamp: new Date()
        });

    } catch (err) {
        console.error('Error SQL en /api/estructuras:', err);
        res.status(500).json({
            success: false,
            error: 'Error al obtener estructuras.',
            details: err.message
        });
    }
});

// Endpoint para obtener imagen de artículo (devuelve la ruta)
app.get('/api/articulo-imagen/:articulo', async (req, res) => {
    try {
        const { articulo } = req.params;

        const request = new sql.Request();
        request.input('articulo', sql.NVarChar, articulo);

        const query = `
            SELECT [RutaImagen]
            FROM [MAESTRO ARTICULOS PLANOS]
            WHERE [articulo] = @articulo
        `;

        const result = await request.query(query);

        if (result.recordset.length > 0 && result.recordset[0].RutaImagen) {
            const rutaImagen = result.recordset[0].RutaImagen;
            console.log('Ruta imagen desde BD:', rutaImagen);
            res.json({
                success: true,
                rutaImagen: rutaImagen
            });
        } else {
            res.json({
                success: false,
                error: 'No se encontró imagen para este artículo'
            });
        }

    } catch (err) {
        console.error('Error SQL en /api/articulo-imagen:', err);
        res.status(500).json({
            success: false,
            error: 'Error al obtener imagen.',
            details: err.message
        });
    }
});

// Endpoint para servir imagen de artículo directamente
app.get('/api/articulo-imagen-file/:articulo', async (req, res) => {
    try {
        const { articulo } = req.params;
        const fs = require('fs');
        const path = require('path');

        const request = new sql.Request();
        request.input('articulo', sql.NVarChar, articulo);

        const query = `
            SELECT [RutaImagen]
            FROM [MAESTRO ARTICULOS PLANOS]
            WHERE [articulo] = @articulo
        `;

        const result = await request.query(query);

        if (result.recordset.length > 0 && result.recordset[0].RutaImagen) {
            const rutaImagen = result.recordset[0].RutaImagen;
            console.log('Sirviendo imagen:', rutaImagen);

            // Verificar si el archivo existe
            if (fs.existsSync(rutaImagen)) {
                res.sendFile(rutaImagen);
            } else {
                console.log('Archivo no encontrado:', rutaImagen);
                res.status(404).json({
                    success: false,
                    error: 'Archivo no encontrado',
                    ruta: rutaImagen
                });
            }
        } else {
            res.status(404).json({
                success: false,
                error: 'No se encontró imagen para este artículo'
            });
        }

    } catch (err) {
        console.error('Error en /api/articulo-imagen-file:', err);
        res.status(500).json({
            success: false,
            error: 'Error al obtener imagen.',
            details: err.message
        });
    }
});

// ============================================
// RUTAS API (MAESTROS)
// ============================================

app.get('/api/rutas', async (req, res) => {
    try {
        const { articulo, operacion, fase, ruta, tipo, control, page = 1, pageSize = 50 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(pageSize);

        const request = new sql.Request();
        let whereConditions = [];

        if (articulo) {
            request.input('articulo', sql.NVarChar, `%${articulo}%`);
            whereConditions.push('R.[cod de articulo] LIKE @articulo');
        }

        if (operacion) {
            request.input('operacion', sql.NVarChar, operacion);
            whereConditions.push('R.[codigo] = @operacion');
        }

        if (fase) {
            request.input('fase', sql.NVarChar, fase);
            whereConditions.push('R.[Fase] = @fase');
        }

        if (ruta) {
            request.input('ruta', sql.NVarChar, ruta);
            whereConditions.push('R.[Ruta] = @ruta');
        }

        if (tipo) {
            request.input('tipo', sql.NVarChar, tipo);
            whereConditions.push('R.[tipo] = @tipo');
        }

        if (control !== undefined && control !== '') {
            const controlValue = control === 'true' || control === '1';
            request.input('control', sql.Bit, controlValue);
            whereConditions.push('R.[control produccion] = @control');
        }

        const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

        // Count Total
        const countQuery = `SELECT COUNT(*) as total FROM [RUTAS] R ${whereClause}`;
        const countResult = await request.query(countQuery);
        const total = countResult.recordset[0].total;

        // Main Query
        request.input('offset', sql.Int, offset);
        request.input('pageSize', sql.Int, parseInt(pageSize));

        const query = `
            SELECT
                R.[cod de articulo] as articulo,
                R.[secuencia],
                R.[codigo] as operacionCodigo,
                R.[descripcion] as operacionDescripcion,
                R.[tipo],
                R.[centro],
                R.[Tiempo Preparacion],
                R.[Tiempo Operacion],
                R.[control produccion],
                R.[Fase],
                R.[Ruta]
            FROM [RUTAS] R
            ${whereClause}
            ORDER BY R.[cod de articulo], R.[secuencia]
            OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
        `;
        const result = await request.query(query);

        // Calculate Total Time if filtering by article
        let tiempoTotal = 0;
        if (articulo) {
            const timeQuery = `
                SELECT SUM(ISNULL(R.[Tiempo Preparacion], 0) + ISNULL(R.[Tiempo Operacion], 0)) as totalTime
                FROM [RUTAS] R
                ${whereClause}
             `;
            const timeResult = await request.query(timeQuery);
            tiempoTotal = timeResult.recordset[0].totalTime || 0;
        }

        // Top 10 Articles by Execution Time (Global)
        const top10Query = `
            SELECT TOP 10
                R.[cod de articulo] as articulo,
                SUM(ISNULL(R.[Tiempo Preparacion], 0) + ISNULL(R.[Tiempo Operacion], 0)) as totalTime
            FROM [RUTAS] R
            GROUP BY R.[cod de articulo]
            HAVING SUM(ISNULL(R.[Tiempo Preparacion], 0) + ISNULL(R.[Tiempo Operacion], 0)) > 0
            ORDER BY totalTime DESC
        `;
        const top10Result = await sql.query(top10Query);

        // Filters
        // Use separate query calls to avoid open request conflict if any
        // Actually we can reuse 'request' if we redefine inputs, but cleaner to use sql.query for independent lists

        // distinct types
        const tiposResult = await sql.query`SELECT DISTINCT [tipo] FROM [RUTAS] WHERE [tipo] IS NOT NULL ORDER BY [tipo]`;

        // distinct phases
        const fasesResult = await sql.query`SELECT DISTINCT [Fase] FROM [RUTAS] WHERE [Fase] IS NOT NULL ORDER BY [Fase]`;

        // distinct operations (codigo + descripcion) - limit to 500 to avoid huge payload
        const opsResult = await sql.query`SELECT DISTINCT TOP 500 [codigo], [descripcion] FROM [RUTAS] WHERE [codigo] IS NOT NULL ORDER BY [codigo]`;

        res.json({
            success: true,
            data: result.recordset,
            total: total,
            page: parseInt(page),
            pageSize: parseInt(pageSize),
            totalPages: Math.ceil(total / parseInt(pageSize)),
            tiempoTotal: tiempoTotal,
            top10Articulos: top10Result.recordset,
            filtros: {
                tipos: tiposResult.recordset.map(r => r.tipo),
                fases: fasesResult.recordset.map(r => r.Fase),
                operaciones: opsResult.recordset
            }
        });

    } catch (err) {
        console.error('Error in /api/rutas:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Endpoint para obtener códigos de rechazo
app.get('/api/codigos-rechazo', async (req, res) => {
    try {
        const { codigo, seccion, controlProduccion } = req.query;

        const request = new sql.Request();
        let whereConditions = [];

        if (codigo) {
            request.input('codigo', sql.NVarChar, `%${codigo}%`);
            whereConditions.push('(CR.[codigo causa] LIKE @codigo OR CR.[descripcion causa] LIKE @codigo)');
        }

        if (seccion) {
            request.input('seccion', sql.NVarChar, seccion);
            whereConditions.push('MS.[seccion] = @seccion');
        }

        if (controlProduccion !== undefined && controlProduccion !== '') {
            const cpValue = controlProduccion === 'true' || controlProduccion === '1';
            request.input('controlProduccion', sql.Bit, cpValue);
            whereConditions.push('CR.[control produccion] = @controlProduccion');
        }

        let query = `
            SELECT DISTINCT
                CR.[codigo causa] as codigo,
                CR.[descripcion causa] as descripcion,
                MS.[denominacion] as seccion_nombre,
                MS.[seccion] as seccion_codigo,
                CR.[control produccion] as control_produccion
            FROM
                [CAUSAS RECHAZO] CR
            LEFT JOIN
                [RECHAZOS POR SECCION] RS ON CR.[codigo causa] = RS.[rechazo]
            LEFT JOIN
                [MAESTRO SECCIONES] MS ON RS.[seccion] = MS.[seccion]
        `;

        if (whereConditions.length > 0) {
            query += ' WHERE ' + whereConditions.join(' AND ');
        }

        query += ' ORDER BY CR.[codigo causa]';

        const result = await request.query(query);

        // Get distinct sections for filter
        const seccionesQuery = await sql.query`
            SELECT DISTINCT 
                MS.[seccion],
                MS.[denominacion]
            FROM [MAESTRO SECCIONES] MS
            INNER JOIN [RECHAZOS POR SECCION] RS ON MS.[seccion] = RS.[seccion]
            ORDER BY MS.[denominacion]
        `;

        const secciones = seccionesQuery.recordset.map(r => ({
            codigo: r.seccion,
            nombre: r.denominacion
        }));

        res.json({
            success: true,
            data: result.recordset,
            secciones: secciones,
            count: result.recordset.length
        });

    } catch (err) {
        console.error('Error SQL en /api/codigos-rechazo:', err);
        res.status(500).json({
            success: false,
            error: 'Error al obtener códigos de rechazo.',
            details: err.message
        });
    }
});

// ============================
// CAPACIDAD PRODUCTIVA ENDPOINTS
// ============================

// Endpoint para obtener/guardar configuración de capacidad
app.get('/api/capacidad/configuracion', async (req, res) => {
    console.log('[CAPACIDAD] Endpoint /configuracion GET called');
    try {
        const { ano } = req.query;
        const request = new sql.Request();

        let query = `SELECT * FROM [CAPA_CHARGE_CONFIGURACION]`;
        if (ano) {
            request.input('ano', sql.Int, parseInt(ano));
            query += ` WHERE [ano] = @ano`;
        }
        query += ` ORDER BY [ano] DESC`;

        const result = await request.query(query);

        res.json({
            success: true,
            data: result.recordset
        });
    } catch (err) {
        console.error('Error SQL en /api/capacidad/configuracion:', err);
        res.status(500).json({
            success: false,
            error: 'Error al obtener configuración de capacidad.',
            details: err.message
        });
    }
});

// Actualizar o insertar configuración de capacidad
app.post('/api/capacidad/configuracion', async (req, res) => {
    console.log('[CAPACIDAD] Endpoint /configuracion POST called', req.body);
    try {
        const { ano, dias_max, dias_disponibles } = req.body;

        if (!ano) {
            return res.status(400).json({
                success: false,
                error: 'El año es requerido.'
            });
        }

        const request = new sql.Request();
        request.input('ano', sql.Int, parseInt(ano));
        request.input('dias_max', sql.Int, parseInt(dias_max) || 365);
        request.input('dias_disponibles', sql.Int, parseInt(dias_disponibles) || 250);

        // UPSERT: Update if exists, else insert
        // Primero intentamos update, si no existe hacemos insert
        const updateResult = await request.query(`
            UPDATE [CAPA_CHARGE_CONFIGURACION] 
            SET [dias_max] = @dias_max, 
                [dias_disponibles] = @dias_disponibles
            WHERE [ano] = @ano
        `);

        // Si no se actualizó ninguna fila, insertamos
        if (updateResult.rowsAffected[0] === 0) {
            const request2 = new sql.Request();
            request2.input('ano', sql.Int, parseInt(ano));
            request2.input('dias_max', sql.Int, parseInt(dias_max) || 365);
            request2.input('dias_disponibles', sql.Int, parseInt(dias_disponibles) || 250);

            await request2.query(`
                INSERT INTO [CAPA_CHARGE_CONFIGURACION] ([ano], [dias_max], [dias_disponibles])
                VALUES (@ano, @dias_max, @dias_disponibles)
            `);
        }

        res.json({
            success: true,
            message: 'Configuración guardada correctamente.'
        });
    } catch (err) {
        console.error('Error SQL en /api/capacidad/configuracion POST:', err);
        res.status(500).json({
            success: false,
            error: 'Error al guardar configuración de capacidad.',
            details: err.message
        });
    }
});

// Endpoint principal de cálculo de capacidad
app.get('/api/capacidad/datos', async (req, res) => {
    console.log('[CAPACIDAD] Endpoint /datos called', req.query);
    try {
        const { ano, seccion } = req.query;
        const selectedYear = parseInt(ano) || new Date().getFullYear();

        const request = new sql.Request();
        request.input('year', sql.Int, selectedYear);

        // 1. Obtener configuración del año (Días Max, Días Disponibles)
        const configResult = await request.query(`
            SELECT [dias_max], [dias_disponibles]
            FROM [CAPA_CHARGE_CONFIGURACION]
            WHERE [ano] = @year
        `);

        let diasMax = 365;
        let diasDisponibles = 250;
        if (configResult.recordset.length > 0) {
            diasMax = configResult.recordset[0].dias_max || 365;
            diasDisponibles = configResult.recordset[0].dias_disponibles || 250;
        }

        // 2. Obtener Horas Convenio: Contar días laborables en CALENDARIO para el año × 8
        const request2 = new sql.Request();
        request2.input('year', sql.Int, selectedYear);

        const calendarioResult = await request2.query(`
            SELECT COUNT(*) as diasLaborables
            FROM [CALENDARIO]
            WHERE YEAR([fecha]) = @year
        `);
        const diasLaborables = calendarioResult.recordset[0]?.diasLaborables || 0;
        const horasConvenio = diasLaborables * 8;

        // 3. Obtener Plantilla por sección: operarios activos y a_calculo agrupados por sección
        let seccionCondition = '';
        const request3 = new sql.Request();
        if (seccion) {
            request3.input('seccion', sql.NVarChar, seccion);
            seccionCondition = ' AND O.[seccion] = @seccion';
        }

        const plantillaResult = await request3.query(`
            SELECT 
                O.[seccion],
                MS.[denominacion] as seccionNombre,
                COUNT(*) as plantilla
            FROM [OPERARIOS] O
            LEFT JOIN [MAESTRO SECCIONES] MS ON O.[seccion] = MS.[seccion]
            WHERE O.[activo] = 1 AND ISNULL(O.[a calculo], 0) <> 0 ${seccionCondition}
            GROUP BY O.[seccion], MS.[denominacion]
            ORDER BY O.[seccion]
        `);

        // 4. Calcular OEE por sección (desde REGISTRO TRABAJOS)
        const request4 = new sql.Request();
        request4.input('year', sql.Int, selectedYear);
        if (seccion) request4.input('seccion', sql.NVarChar, seccion);

        let oeeSeccionCondition = seccion ? ' AND OP.[seccion] = @seccion' : '';

        const oeeQuery = `
            SELECT 
                OP.[seccion],
                MS.[denominacion] as seccionNombre,
                SUM(ISNULL(RT.[piezas ok], 0)) as piezasOk,
                SUM(ISNULL(RT.[piezas rc], 0)) as piezasRc,
                SUM((ISNULL(RT.[piezas ok], 0) + ISNULL(RT.[piezas rc], 0)) * ISNULL(RT.[tiempo teorico], 0) / 60.0) as horasTeoricas,
                SUM(CASE WHEN ISNULL(RT.[actividad asignada], 0) = 0 THEN ISNULL(RT.[tiempo], 0) ELSE 0 END) as horasDisponibles,
                SUM(ISNULL(RT.[tiempo], 0)) as horasPlanificadas
            FROM [REGISTRO TRABAJOS] RT
            INNER JOIN [OPERACIONES] OP ON RT.[codigo operacion] = OP.[codigo operacion]
            LEFT JOIN [MAESTRO SECCIONES] MS ON OP.[seccion] = MS.[seccion]
            WHERE OP.[ComputoOEE] = 1 
                AND YEAR(RT.[fecha inicio]) = @year
                ${oeeSeccionCondition}
            GROUP BY OP.[seccion], MS.[denominacion]
        `;

        const oeeResult = await request4.query(oeeQuery);

        // Calcular OEE para cada sección
        const oeeBySeccion = {};
        oeeResult.recordset.forEach(row => {
            const horasTeoricas = parseFloat(row.horasTeoricas) || 0;
            const horasDisponibles = parseFloat(row.horasDisponibles) || 0;
            const horasPlanificadas = parseFloat(row.horasPlanificadas) || 0;
            const piezasOk = parseInt(row.piezasOk) || 0;
            const piezasRc = parseInt(row.piezasRc) || 0;
            const totalPiezas = piezasOk + piezasRc;

            const oeed = horasPlanificadas > 0 ? (horasDisponibles / horasPlanificadas) : 0;
            const oeeq = totalPiezas > 0 ? (piezasOk / totalPiezas) : 0;
            const oeer = horasDisponibles > 0 ? (horasTeoricas / horasDisponibles) : 0;
            const oee = oeed * oeer * oeeq;

            oeeBySeccion[row.seccion] = {
                oee: parseFloat((oee * 100).toFixed(2)),
                oeed: parseFloat((oeed * 100).toFixed(2)),
                oeeq: parseFloat((oeeq * 100).toFixed(2)),
                oeer: parseFloat((oeer * 100).toFixed(2)),
                seccionNombre: row.seccionNombre
            };
        });

        // 5. Calcular Absentismo por sección (HorasAusencia / TotalHoras)
        const request5 = new sql.Request();
        request5.input('year', sql.Int, selectedYear);

        const absentismoQuery = `
            SELECT 
                [NombreSeccion],
                SUM([HorasAusencia]) as horasAusencia,
                SUM([TotalHoras]) as totalHoras
            FROM [qry_DiarioHorasTrabajo+HorasAusencia]
            WHERE [Anio] = @year AND [NombreSeccion] IS NOT NULL
            GROUP BY [NombreSeccion]
        `;

        const absentismoResult = await request5.query(absentismoQuery);

        const absentismoBySeccion = {};
        absentismoResult.recordset.forEach(row => {
            const horasAusencia = parseFloat(row.horasAusencia) || 0;
            const totalHoras = parseFloat(row.totalHoras) || 0;
            const absentismo = totalHoras > 0 ? (horasAusencia / totalHoras) : 0;
            absentismoBySeccion[row.NombreSeccion] = parseFloat((absentismo * 100).toFixed(2));
        });

        // 6. Calcular Rechazo Acumulado por sección (PiezasRc / TotalProducidas)
        const request6 = new sql.Request();
        request6.input('year', sql.Int, selectedYear);

        const rechazoQuery = `
            SELECT 
                CR.[Seccion] as seccion,
                SUM(ISNULL(R.[piezas rc], 0)) as piezasRechazadas,
                SUM(ISNULL(R.[piezas ok], 0) + ISNULL(R.[piezas rc], 0) + ISNULL(R.[piezas rep], 0)) as piezasProducidas
            FROM Qry_RankingRechazos R
            INNER JOIN [CAUSAS RECHAZO] CR ON R.[causa rechazo] = CR.[codigo causa]
            WHERE YEAR(R.[fecha inicio]) = @year AND CR.[Seccion] IS NOT NULL
            GROUP BY CR.[Seccion]
        `;

        let rechazoBySeccion = {};
        try {
            const rechazoResult = await request6.query(rechazoQuery);
            rechazoResult.recordset.forEach(row => {
                const piezasRechazadas = parseFloat(row.piezasRechazadas) || 0;
                const piezasProducidas = parseFloat(row.piezasProducidas) || 0;
                const rechazo = piezasProducidas > 0 ? (piezasRechazadas / piezasProducidas) : 0;
                rechazoBySeccion[row.seccion] = parseFloat((rechazo * 100).toFixed(2));
            });
        } catch (e) {
            console.log('[CAPACIDAD] Warning: Could not get rechazo data:', e.message);
        }

        // 7. Consolidar datos por sección y calcular capacidades
        const capacidadPorSeccion = [];

        plantillaResult.recordset.forEach(row => {
            const seccionCodigo = row.seccion;
            const seccionNombre = row.seccionNombre || seccionCodigo;
            const plantilla = row.plantilla || 0;

            // Buscar OEE para esta sección (puede estar por código o por nombre)
            const oeeData = oeeBySeccion[seccionCodigo] || { oee: 0, oeed: 0, oeeq: 0, oeer: 0 };
            const oee = oeeData.oee / 100; // Convertir a decimal para cálculos

            // Buscar Absentismo para esta sección (puede estar por nombre)
            const absentismo = (absentismoBySeccion[seccionNombre] || absentismoBySeccion[seccionCodigo] || 0) / 100;

            // Buscar Rechazo para esta sección
            const rechazo = (rechazoBySeccion[seccionNombre] || rechazoBySeccion[seccionCodigo] || 0) / 100;

            // CAPACIDAD DEMOSTRADA = Plantilla * Horas Convenio * OEE * (1-Absentismo) * (1-Rechazo)
            const capacidadDemostrada = plantilla * horasConvenio * oee * (1 - absentismo) * (1 - rechazo);

            // CAPACIDAD MÁXIMA = Capacidad demostrada + (60 * Plantilla) + Horas Convenio
            const capacidadMaxima = capacidadDemostrada + (60 * plantilla) + horasConvenio;

            // CAPACIDAD INSTALACIÓN = Días Max * 36 * 8 * OEE
            const capacidadInstalacion = diasMax * 36 * 8 * oee;

            capacidadPorSeccion.push({
                seccion: seccionCodigo,
                seccionNombre: seccionNombre,
                plantilla: plantilla,
                horasConvenio: horasConvenio,
                oee: parseFloat((oee * 100).toFixed(2)),
                oeed: oeeData.oeed,
                oeeq: oeeData.oeeq,
                oeer: oeeData.oeer,
                absentismo: parseFloat((absentismo * 100).toFixed(2)),
                rechazo: parseFloat((rechazo * 100).toFixed(2)),
                capacidadDemostrada: parseFloat(capacidadDemostrada.toFixed(2)),
                capacidadMaxima: parseFloat(capacidadMaxima.toFixed(2)),
                capacidadInstalacion: parseFloat(capacidadInstalacion.toFixed(2))
            });
        });

        // 8. Calcular totales globales
        const totalPlantilla = capacidadPorSeccion.reduce((sum, s) => sum + s.plantilla, 0);
        const totalCapacidadDemostrada = capacidadPorSeccion.reduce((sum, s) => sum + s.capacidadDemostrada, 0);
        const totalCapacidadMaxima = capacidadPorSeccion.reduce((sum, s) => sum + s.capacidadMaxima, 0);
        const totalCapacidadInstalacion = capacidadPorSeccion.reduce((sum, s) => sum + s.capacidadInstalacion, 0);

        // OEE promedio ponderado
        const avgOee = capacidadPorSeccion.length > 0
            ? capacidadPorSeccion.reduce((sum, s) => sum + s.oee * s.plantilla, 0) / totalPlantilla
            : 0;

        // Absentismo promedio
        const avgAbsentismo = capacidadPorSeccion.length > 0
            ? capacidadPorSeccion.reduce((sum, s) => sum + s.absentismo, 0) / capacidadPorSeccion.length
            : 0;

        // Rechazo promedio
        const avgRechazo = capacidadPorSeccion.length > 0
            ? capacidadPorSeccion.reduce((sum, s) => sum + s.rechazo, 0) / capacidadPorSeccion.length
            : 0;

        // 9. Obtener secciones disponibles para filtro (directamente de MAESTRO SECCIONES)
        const seccionesResult = await sql.query`
            SELECT [seccion] as codigo, [denominacion]
            FROM [MAESTRO SECCIONES]
            WHERE [seccion] IS NOT NULL
            ORDER BY [seccion]
        `;
        const secciones = seccionesResult.recordset.map(r => ({
            codigo: r.codigo,
            denominacion: r.denominacion || r.codigo
        }));
        console.log('[CAPACIDAD] Secciones encontradas:', secciones.length);

        // 10. Obtener años disponibles
        const yearsResult = await sql.query`
            SELECT DISTINCT YEAR([fecha]) as ano
            FROM [CALENDARIO]
            ORDER BY ano DESC
        `;
        const years = yearsResult.recordset.map(r => r.ano);

        res.json({
            success: true,
            ano: selectedYear,
            configuracion: {
                diasMax,
                diasDisponibles,
                diasLaborables,
                horasConvenio
            },
            kpis: {
                totalPlantilla,
                horasConvenio,
                avgOee: parseFloat(avgOee.toFixed(2)),
                avgAbsentismo: parseFloat(avgAbsentismo.toFixed(2)),
                avgRechazo: parseFloat(avgRechazo.toFixed(2)),
                capacidadDemostrada: parseFloat(totalCapacidadDemostrada.toFixed(2)),
                capacidadMaxima: parseFloat(totalCapacidadMaxima.toFixed(2)),
                capacidadInstalacion: parseFloat(totalCapacidadInstalacion.toFixed(2))
            },
            detalleSecciones: capacidadPorSeccion,
            filtros: {
                secciones,
                years
            }
        });

    } catch (err) {
        console.error('Error SQL en /api/capacidad/datos:', err);
        res.status(500).json({
            success: false,
            error: 'Error al calcular capacidad.',
            details: err.message
        });
    }
});

// ============================
// CAPA CHARGE ENDPOINTS (Cartera Pedidos)
// ============================

// Endpoint para obtener filtros de Capa Charge (clientes y familias)
app.get('/api/capa-charge/filtros', async (req, res) => {
    console.log('[CAPA-CHARGE] Endpoint /filtros called');
    try {
        // Get clientes with pending orders
        const clientesResult = await sql.query`
            SELECT DISTINCT 
                C.[codigo cliente], 
                C.[nombre empresa]
            FROM [MAESTRO CLIENTES] C
            INNER JOIN [PEDIDOS VENTA CABECERAS] PVC ON C.[codigo cliente] = PVC.[cliente]
            INNER JOIN [PEDIDOS VENTA LINEAS] PVL ON PVC.[numero pedido] = PVL.[numero pedido]
            WHERE PVL.[cantidad pendiente] > 0
            ORDER BY C.[nombre empresa]
        `;

        // Get familias for articles with pending orders
        const familiasResult = await sql.query`
            SELECT DISTINCT 
                F.[codigo familia], 
                F.[denominacion familia]
            FROM [MAESTRO FAMILIAS] F
            INNER JOIN [MAESTRO ARTICULOS] MA ON F.[codigo tipo] = MA.[codigo tipo] AND F.[codigo familia] = MA.[codigo familia]
            INNER JOIN [PEDIDOS VENTA LINEAS] PVL ON MA.[codigo articulo] = PVL.[articulo]
            WHERE PVL.[cantidad pendiente] > 0
                AND MA.[codigo tipo] = '02'
            ORDER BY F.[denominacion familia]
        `;

        // Get available years
        const yearsResult = await sql.query`
            SELECT DISTINCT YEAR([fecha entrega]) as año
            FROM [PEDIDOS VENTA LINEAS]
            WHERE [fecha entrega] IS NOT NULL
            ORDER BY año DESC
        `;

        res.json({
            success: true,
            clientes: clientesResult.recordset,
            familias: familiasResult.recordset,
            years: yearsResult.recordset.map(r => r.año)
        });

    } catch (err) {
        console.error('Error SQL en /api/capa-charge/filtros:', err);
        res.status(500).json({
            success: false,
            error: 'Error al obtener filtros de Capa Charge.',
            details: err.message
        });
    }
});

// Endpoint principal de Capa Charge - KPIs and summary data
app.get('/api/capa-charge/datos', async (req, res) => {
    console.log('[CAPA-CHARGE] Endpoint /datos called');
    try {
        const { year, cliente, familia } = req.query;
        const request = new sql.Request();

        let whereConditions = ["PVL.[cantidad pendiente] > 0"];

        if (year) {
            request.input('year', sql.Int, parseInt(year));
            whereConditions.push("YEAR(PVL.[fecha entrega]) = @year");
        }

        if (cliente) {
            request.input('cliente', sql.NVarChar, cliente);
            whereConditions.push("PVC.[cliente] = @cliente");
        }

        if (familia) {
            request.input('familia', sql.NVarChar, familia);
            whereConditions.push("MA.[codigo familia] = @familia");
        }

        const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

        // KPIs Query
        const kpisQuery = `
            SELECT 
                COUNT(DISTINCT PVL.[numero pedido]) as pedidosPendientes,
                SUM(PVL.[cantidad pendiente]) as cantidadTotalPendiente,
                SUM(PVL.[cantidad pendiente] * PVL.[precio unitario]) as importePendiente,
                COUNT(DISTINCT PVC.[cliente]) as clientesActivos,
                AVG(DATEDIFF(day, GETDATE(), PVL.[fecha entrega])) as leadTimePromedio
            FROM [PEDIDOS VENTA LINEAS] PVL
            INNER JOIN [PEDIDOS VENTA CABECERAS] PVC ON PVL.[numero pedido] = PVC.[numero pedido]
            LEFT JOIN [MAESTRO ARTICULOS] MA ON PVL.[articulo] = MA.[codigo articulo]
            ${whereClause}
        `;

        const kpisResult = await request.query(kpisQuery);
        const kpis = kpisResult.recordset[0];

        // Monthly evolution
        const request2 = new sql.Request();
        if (year) request2.input('year', sql.Int, parseInt(year));
        if (cliente) request2.input('cliente', sql.NVarChar, cliente);
        if (familia) request2.input('familia', sql.NVarChar, familia);

        const evolucionQuery = `
            SELECT 
                MONTH(PVL.[fecha entrega]) as mes,
                SUM(PVL.[cantidad pendiente]) as cantidad,
                SUM(PVL.[cantidad pendiente] * PVL.[precio unitario]) as importe
            FROM [PEDIDOS VENTA LINEAS] PVL
            INNER JOIN [PEDIDOS VENTA CABECERAS] PVC ON PVL.[numero pedido] = PVC.[numero pedido]
            LEFT JOIN [MAESTRO ARTICULOS] MA ON PVL.[articulo] = MA.[codigo articulo]
            ${whereClause}
            GROUP BY MONTH(PVL.[fecha entrega])
            ORDER BY mes
        `;

        const evolucionResult = await request2.query(evolucionQuery);

        // Distribution by family
        const request3 = new sql.Request();
        if (year) request3.input('year', sql.Int, parseInt(year));
        if (cliente) request3.input('cliente', sql.NVarChar, cliente);
        if (familia) request3.input('familia', sql.NVarChar, familia);

        const distribucionQuery = `
            SELECT TOP 10
                MA.[codigo familia],
                F.[denominacion familia],
                SUM(PVL.[cantidad pendiente]) as cantidad,
                SUM(PVL.[cantidad pendiente] * PVL.[precio unitario]) as importe
            FROM [PEDIDOS VENTA LINEAS] PVL
            INNER JOIN [PEDIDOS VENTA CABECERAS] PVC ON PVL.[numero pedido] = PVC.[numero pedido]
            LEFT JOIN [MAESTRO ARTICULOS] MA ON PVL.[articulo] = MA.[codigo articulo]
            LEFT JOIN [MAESTRO FAMILIAS] F ON MA.[codigo tipo] = F.[codigo tipo] AND MA.[codigo familia] = F.[codigo familia]
            ${whereClause}
            GROUP BY MA.[codigo familia], F.[denominacion familia]
            ORDER BY importe DESC
        `;

        const distribucionResult = await request3.query(distribucionQuery);

        res.json({
            success: true,
            kpis: {
                pedidosPendientes: kpis.pedidosPendientes || 0,
                cantidadTotalPendiente: kpis.cantidadTotalPendiente || 0,
                importePendiente: kpis.importePendiente || 0,
                clientesActivos: kpis.clientesActivos || 0,
                leadTimePromedio: Math.round(kpis.leadTimePromedio) || 0
            },
            evolucionMensual: evolucionResult.recordset,
            distribucionFamilias: distribucionResult.recordset
        });

    } catch (err) {
        console.error('Error SQL en /api/capa-charge/datos:', err);
        res.status(500).json({
            success: false,
            error: 'Error al obtener datos de Capa Charge.',
            details: err.message
        });
    }
});

// Endpoint para obtener detalle de pedidos pendientes
app.get('/api/capa-charge/detalle', async (req, res) => {
    console.log('[CAPA-CHARGE] Endpoint /detalle called');
    try {
        const { year, cliente, familia } = req.query;
        const request = new sql.Request();

        let whereConditions = ["PVL.[cantidad pendiente] > 0"];

        if (year) {
            request.input('year', sql.Int, parseInt(year));
            whereConditions.push("YEAR(PVL.[fecha entrega]) = @year");
        }

        if (cliente) {
            request.input('cliente', sql.NVarChar, cliente);
            whereConditions.push("PVC.[cliente] = @cliente");
        }

        if (familia) {
            request.input('familia', sql.NVarChar, familia);
            whereConditions.push("MA.[codigo familia] = @familia");
        }

        const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

        const query = `
            SELECT TOP 200
                PVL.[numero pedido],
                PVC.[fecha pedido],
                C.[codigo cliente],
                C.[nombre empresa] as cliente,
                PVL.[articulo],
                MA.[denominacion articulo],
                F.[denominacion familia] as familia,
                PVL.[cantidad pedida],
                PVL.[cantidad servida],
                PVL.[cantidad pendiente],
                PVL.[fecha entrega],
                PVL.[precio unitario],
                (PVL.[cantidad pendiente] * PVL.[precio unitario]) as importe_pendiente,
                PVL.[estado linea],
                DATEDIFF(day, GETDATE(), PVL.[fecha entrega]) as dias_para_entrega
            FROM [PEDIDOS VENTA LINEAS] PVL
            INNER JOIN [PEDIDOS VENTA CABECERAS] PVC ON PVL.[numero pedido] = PVC.[numero pedido]
            LEFT JOIN [MAESTRO CLIENTES] C ON PVC.[cliente] = C.[codigo cliente]
            LEFT JOIN [MAESTRO ARTICULOS] MA ON PVL.[articulo] = MA.[codigo articulo]
            LEFT JOIN [MAESTRO FAMILIAS] F ON MA.[codigo tipo] = F.[codigo tipo] AND MA.[codigo familia] = F.[codigo familia]
            ${whereClause}
            ORDER BY PVL.[fecha entrega] ASC
        `;

        const result = await request.query(query);

        res.json({
            success: true,
            data: result.recordset,
            count: result.recordset.length
        });

    } catch (err) {
        console.error('Error SQL en /api/capa-charge/detalle:', err);
        res.status(500).json({
            success: false,
            error: 'Error al obtener detalle de Capa Charge.',
            details: err.message
        });
    }
});

// ============================================
// ENSAYOS ENDPOINTS (VT, PT, RT)
// ============================================

app.get('/api/ensayos/:type', async (req, res) => {
    try {
        const { type } = req.params;
        const validTypes = ['vt', 'pt', 'rt'];

        if (!validTypes.includes(type.toLowerCase())) {
            return res.status(400).json({ success: false, error: 'Tipo de ensayo no válido (vt, pt, rt)' });
        }

        const tableName = `[ENSAYOS ${type.toUpperCase()}]`; // Assumption: Table names are [ENSAYOS VT], etc.
        const { page = 1, pageSize = 50, sortBy = 'Fecha', sortOrder = 'DESC', articulo, tratamiento } = req.query;

        const request = new sql.Request();
        let whereConditions = [];

        if (articulo) {
            request.input('articulo', sql.NVarChar, `%${articulo}%`);
            whereConditions.push("([Referencia] LIKE @articulo OR [Colada] LIKE @articulo OR [Informe] LIKE @articulo)");
        }

        if (tratamiento) {
            request.input('tratamiento', sql.NVarChar, tratamiento);
            whereConditions.push("[Tratamiento] = @tratamiento");
        }

        const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
        const offset = (parseInt(page) - 1) * parseInt(pageSize);

        // Count total
        const countQuery = `SELECT COUNT(*) as total FROM ${tableName} ${whereClause}`;
        const countResult = await request.query(countQuery);
        const total = countResult.recordset[0].total;

        // Data query
        const query = `
            SELECT * FROM ${tableName}
            ${whereClause}
            ORDER BY [${sortBy}] ${sortOrder}
            OFFSET ${offset} ROWS FETCH NEXT ${parseInt(pageSize)} ROWS ONLY
        `;

        const result = await request.query(query);

        // Get unique tratamientos for filter
        const tratamientosQuery = `SELECT DISTINCT [Tratamiento] FROM ${tableName} WHERE [Tratamiento] IS NOT NULL ORDER BY [Tratamiento]`;
        const tratamientosResult = await new sql.Request().query(tratamientosQuery);
        const tratamientos = tratamientosResult.recordset.map(r => r.Tratamiento);

        res.json({
            success: true,
            data: result.recordset,
            total: total,
            page: parseInt(page),
            pageSize: parseInt(pageSize),
            totalPages: Math.ceil(total / parseInt(pageSize)),
            tratamientos: tratamientos
        });

    } catch (err) {
        console.error(`Error en /api/ensayos/${req.params.type}:`, err);
        res.status(500).json({
            success: false,
            error: 'Error al obtener datos de ensayos',
            details: err.message
        });
    }
});

// Serve index.html for any unmatched routes (SPA fallback)
app.get('*', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

// Inicia el servidor
app.listen(PORT, () => {
    console.log(`?? Server running on http://localhost:${PORT}`);
});




