# Documentación de Datos SQL Server

Este documento referencia las tablas, vistas y consultas utilizadas en la aplicación, organizadas según la estructura de navegación de la web.

> [!NOTE]
> **Sincronización Web-Documentación**: Actualmente este archivo es descriptivo. Para que la estructura de la web dependa de un archivo de configuración, se requeriría refactorizar el menú lateral (`app.js` / HTML) para leer de un JSON de configuración.

---

## 1. Listado de Tablas Utilizadas (Resumen)

### `Fw_EIPC` (Principal)
`USUARIOS_APP`, `MAESTRO ARTICULOS`, `MAESTRO FAMILIAS`, `MAESTRO SUBFAMILIAS`, `MAESTRO CLIENTES`, `PROVEEDORES MAESTRO`, `MAESTRO SECCIONES`, `MAESTRO ZONAS ACTIVOS`, `MAESTRO ACTIVOS`, `OPERARIOS`, `OPERACIONES`, `MAQUINAS`, `RUTAS`, `CAUSAS RECHAZO`, `INCIDENCIAS`, `NORMASN`, `REGISTRO TRABAJOS`, `ORDENES DE FABRICACION`, `FACTURAS VENTA CABECERAS/LINEAS`, `FACTURAS CABECERA/LINEAS`, `LISTADO ESPECIFICACIONES`, `ENSAYOS_...`, `RX_X_INFORME...`.

### `Fw_Comunes` (Externa)
`CALIBRACIONES`, `CALIBRACIONES DETALLE`, `PERIODOS`.

---

## 2. Detalle por Sección de la Web

### 🛠️ MAESTRO
#### Artículos
- **Tablas**: `MAESTRO ARTICULOS`.
- **Relaciones**: `MAESTRO FAMILIAS`, `MAESTRO SUBFAMILIAS`, `MAESTRO TIPO ARTICULOS`.

#### Centros
- **Tablas**: `MAQUINAS` (Centros de trabajo).

#### Especificaciones
- **Tablas**: `LISTADO ESPECIFICACIONES`.
- **Maestros**: `MAESTRO AMBITOS...`, `MAESTRO TIPO...`.

#### Proveedores
- **Tablas**: `PROVEEDORES MAESTRO`.

#### Clientes
- **Tablas**: `MAESTRO CLIENTES`.

#### Códigos rechazo
- **Tablas**: `CAUSAS RECHAZO`.

#### Incidencias
- **Tablas**: `INCIDENCIAS`.

#### Utillajes
- **Tablas**: `MAESTRO UTILLAJES`.
- **Relaciones**: `MAESTRO FAMILIAS`, `MAESTRO SITUACION UTILLAJES`.

#### Ausencias
- **Tablas**: *(Pendiente de verificar origen exacto, posiblemente `REGISTRO TRABAJOS` o tabla específica de RH)*.

#### Materiales
- **Tablas**: `MAESTRO ARTICULOS` (Campo `material`).

#### Normas
- **Tablas**: `NORMASN`.

#### Rutas
- **Tablas**: `RUTAS`.
- **Relaciones**: `MAESTRO ARTICULOS`, `MAQUINAS`, `OPERACIONES`.

#### Operarios
- **Tablas**: `OPERARIOS`.
- **Relaciones**: `MAESTRO SECCIONES`.

#### Operaciones
- **Tablas**: `OPERACIONES`.
- **Detalle**: `OPERACIONES DETALLE`.

#### Grupos Cálculo
- **Tablas**: `MAESTRO GRUPOS CALCULO`.
- **Relaciones**: `OPERACIONES POR GRUPO CALCULO`.

---

### 🔥 HEATTREAT
#### Coladas-TT
- **Vista**: `Qry_Lotes_ColadaTT_Pivotado`.
- **Uso**: Visualización de tratamientos térmicos por colada.

---

### 🛡️ CALIDAD
#### Rechazos
- **Vista Key**: `Qry_RankingRechazos`.
- **Tablas**: `CAUSAS RECHAZO`, `ORDENES DE FABRICACION` (para totales).

---

### 👥 PERSONAL
#### Bonos
- **Vista**: `qry_DiarioHorasTrabajo+HorasAusencia`.

#### Formación
- *(Sección informativa, datos pendientes de análisis)*.

#### Matriz de Polivalencias
- *(Sección informativa, datos pendientes de análisis)*.

#### Capacitaciones
- *(Sección informativa, datos pendientes de análisis)*.

#### Certificaciones
- *(Sección informativa, datos pendientes de análisis)*.

---

### 🔬 ENSAYOS
#### Informes VT (Visual Testing)
- **Tablas**: `RX_X_INFORME VIS LOTE`.

#### Informes PT (Penetrant Testing)
- **Tablas**: `RX_X_INFORME LP LOTE`.

#### Informes RT (Radiographic Testing)
- **Tablas**: `RX_X_INFORME RX LOTE`.

#### Informes Dureza
- **Tablas**: `ENSAYOS_DUREZA`.

#### Informes Tracción
- **Tablas**: `ENSAYOS_TRACCION`.

#### Informes Metalografía
- **Tablas**: `ENSAYOS_METALOGRAFIA`.

#### Informes Fugas
- *(No existe todavía)*.

---

### 🔧 MANTENIMIENTO
*Gestión de activos y órdenes de trabajo.*
- **Tablas**: `MAESTRO ACTIVOS`, `MAESTRO ZONAS ACTIVOS`.
- **Ordenes**: Probablemente `MANTENIMIENTO_ORDENES` (A verificar nombre exacto en backend si existe).

---

### 📏 CALIBRACIONES
*Gestión de equipos (Fw_Comunes).*
- **Tablas**: `CALIBRACIONES`, `CALIBRACIONES DETALLE`, `PERIODOS`.

---

### 🏭 PRODUCCION
#### OEE
- **Tablas**: `REGISTRO TRABAJOS`, `OPERACIONES` (Campo `ComputoOEE`).
- **Cálculo**: Rendimiento x Disponibilidad x Calidad.

#### Ordenes
- **Tablas**: `ORDENES DE FABRICACION`.
- **Relaciones**: `MAESTRO ARTICULOS`, `MAESTRO CLIENTES`.

---

### 🛒 COMPRAS
#### Solicitante Compras
- *(Pendiente de asignar tabla específica)*.

#### Pedidos
- *(Pendiente de asignar tabla específica, posiblemente `PEDIDOS COMPRA CABECERA`)*.

#### Albaranes
- *(Posiblemente `ALBARANES COMPRA CABECERA`)*.

#### Facturas
- **Tablas**: `FACTURAS CABECERA`, `FACTURAS LINEAS`.

---

### 💼 COMERCIAL
#### OTD (On Time Delivery)
- **Vista**: `Qry_Estadistica_Cumplimiento_Entregas`.
- **Detalle**: `Qry_Estadisticas_Albaranes_Lineas`.

#### Capa Charge
- **Vista**: `Qry_Estadistica_Cumplimiento_Entregas` (Utiliza misma fuente para analizar carga).

---

## 3. Relaciones Generales

### Filtros Comunes
- **Sección**: `MAESTRO SECCIONES`.
- **Familia**: `MAESTRO FAMILIAS`.
- **Cliente**: `MAESTRO CLIENTES`.
- **Proveedor**: `PROVEEDORES MAESTRO`.
