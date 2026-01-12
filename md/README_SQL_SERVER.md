# Guía de Configuración: Conexión a SQL Server

## Cambios Realizados

### ✅ 1. Corrección de Ordenamiento por Fechas

He mejorado la lógica de ordenamiento de tratamientos para que siempre ordene correctamente por fecha:

- Añadida función `parseDateRobust()` que maneja múltiples formatos de fecha (DD/MM/YYYY, YYYY-MM-DD, etc.)
- Validación de fechas antes de comparar
- Ordenamiento de fallback por tipo de tratamiento si las fechas no son válidas
- Implementado en `app.js` líneas 120-165

### ✅ 2. Backend para SQL Server

He creado un sistema backend con Node.js para conectar directamente a SQL Server:

**Archivos creados**:
- `server.js` - API RESTful con Express
- `package.json` - Dependencias del proyecto

## Instalación del Backend

### Paso 1: Instalar Node.js

Si no tienes Node.js instalado:
1. Descarga desde https://nodejs.org
2. Instala la versión LTS (recomendada)
3. Verifica la instalación: abre CMD y ejecuta `node --version`

### Paso 2: Instalar Dependencias

Abre un terminal en la carpeta `ANTIGRAVITY` y ejecuta:

```powershell
npm install
```

Esto instalará automáticamente:
- `express` - Framework web
- `mssql` - Controlador de SQL Server
- `cors` - Para permitir conexiones desde el navegador

### Paso 3: Configurar Conexión a SQL Server

Edita el archivo `server.js` y actualiza estas líneas con tus credenciales:

```javascript
const sqlConfig = {
    user: 'TU_USUARIO',              // ← Cambia esto
    password: 'TU_CONTRASEÑA',       // ← Cambia esto
    database: 'TU_BASE_DE_DATOS',    // ← Cambia esto
    server: 'localhost',              // ← O la IP de tu servidor SQL
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
    },
    options: {
        encrypt: true,
        trustServerCertificate: true  // Cambia a false en producción
    }
};
```

### Paso 4: Ajustar la Consulta SQL

En `server.js`, línea ~30, ajusta la consulta según tu esquema:

```javascript
const result = await sql.query`
    SELECT 
        Articulo,
        Numero_Orden,
        Lingote,
        Colada,
        Cantidad_Colada,
        Tratamiento_T4,
        Piezas_T4,
        Fecha_T4,
        Tratamiento_T6,
        Piezas_T6,
        Fecha_T6,
        Tratamiento_T4R1,
        Piezas_T4R1,
        Fecha_T4R1,
        Tratamiento_T6R1,
        Piezas_T6R1,
        Fecha_T6R1
        -- Añade más columnas según tu estructura
    FROM TuTablaOVista                    // ← Cambia esto por tu tabla/vista
    ORDER BY Numero_Orden
`;
```

## Uso

### Iniciar el Backend

En un terminal, ejecuta:

```powershell
npm start
```

Deberías ver:
```
Servidor backend corriendo en http://localhost:3000
Endpoint de tratamientos: http://localhost:3000/api/tratamientos
Health check: http://localhost:3000/api/health
```

### Usar la Aplicación

1. **Mantén el backend corriendo** en una ventana de terminal
2. **Abre `index.html`** en tu navegador
3. **Click en el botón "🗄️ Cargar desde SQL Server"**
4. Los datos se cargarán automáticamente desde la base de datos

Los datos se actualizarán en tiempo real desde SQL Server cada vez que hagas click.

## Endpoints Disponibles

### 1. Obtener Todos los Tratamientos
```
GET http://localhost:3000/api/tratamientos
```

### 2. Filtrar Datos
```
GET http://localhost:3000/api/tratamientos/filtros?fechaInicio=2024-01-01&fechaFin=2024-12-31
```

Parámetros disponibles:
- `fechaInicio` - Fecha de inicio (formato YYYY-MM-DD)
- `fechaFin` - Fecha de fin (formato YYYY-MM-DD)
- `articulo` - Filtrar por artículo específico
- `lingote` - Filtrar por lingote específico

### 3. Health Check
```
GET http://localhost:3000/api/health
```

Prueba la conexión a SQL Server

## Solución de Problemas

### Error: "Cannot connect to SQL Server"

**Posibles causas**:
1. Credenciales incorrectas
2. SQL Server no está accesible
3. No SQL Server está en escucha en el puerto especificado

**Soluciones**:
- Verifica usuario y contraseña
- Abre SQL Server Configuration Manager → SQL Server Network Configuration → Protocols → TCP/IP debe estar habilitado
- Verifica que SQL Server Browser esté ejecutándose

### Error: "ECONNREFUSED"

El backend no está corriendo. Asegúrate de ejecutar `npm start` en una ventana de terminal.

### Error: "Invalid object name"

El nombre de la tabla/vista es incorrecto. Verifica `FROM TuTablaOVista` en server.js

### Los datos no se ordenan correctamente

Las fechas en SQL podrían estar en formato incompatible. Asegúrate de que las fechas se devuelven en formato ISO (YYYY-MM-DD) o actualiza la función `parseDateRobust()` en app.js.

## Arquitectura

```
┌─────────────┐         HTTP          ┌──────────────┐         SQL          ┌───────────────┐
│   Browser   │  ────────────────────▶ │   Node.js    │  ──────────────────▶ │  SQL Server   │
│ (index.html)│  ◀────────────────────  │  (server.js) │  ◀──────────────────  │   Database    │
└─────────────┘       JSON Data        └──────────────┘      Result Set      └───────────────┘
```

1. El navegador hace petición HTTP a `localhost:3000`
2. Node.js recibe la petición y conecta a SQL Server
3. SQL Server devuelve los datos
4. Node.js envía los datos como JSON al navegador
5. El navegador procesa y visualiza los datos

## Ventajas vs Carga de Archivos

✅ **Datos en tiempo real** - Siempre ve los datos más recientes  
✅ **Sin exportación manual** - No necesitas exportar Excel cada vez  
✅ **Filtros dinámicos** - Puedes filtrar por fecha, artículo, etc.  
✅ **Escalable** - Funciona con grandes volúmenes de datos  
✅ **Automatizable** - Puedes programar actualizaciones automáticas  

## Próximos Pasos

Si quieres expandir el backend:

1. **Autenticación**: Añadir login de usuarios
2. **Más filtros**: Añadir filtros por colada, lote, etc.
3. **Caché**: Implementar caché para mejorar rendimiento
4. **WebSockets**: Actualizar datos en tiempo real sin reload
5. **Deploy**: Desplegar en un servidor para acceso remoto

## Contacto

Si tienes problemas con la configuración, revisa los logs en la consola del terminal donde corre el backend.
