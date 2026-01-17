# Documentación de Datos SQL Server

Este documento referencia las tablas, vistas y consultadas utilizadas en la aplicación, organizadas según la estructura de navegación de la web.

> [!NOTE]
> **Sincronización Web-Documentación**: Actualmente este archivo es descriptivo.

---

## 1. Listado de Tablas Utilizadas (Resumen)

### `Fw_EIPC` (Principal)
#### Maestros (maestros y no maestros)
- `USUARIOS_APP`
- `MAESTRO ARTICULOS`
- `MAESTRO FAMILIAS`
- `MAESTRO SUBFAMILIAS`
- `MAESTRO CLIENTES`
- `PROVEEDORES MAESTRO`
- `MAESTRO SECCIONES`
- `MAESTRO ZONAS ACTIVOS`
- `MAESTRO ACTIVOS`
- `MAESTRO UTILLAJES`
- `MAESTRO SITUACION UTILLAJES`
- `MAESTRO GRUPOS CALCULO`
- `MAESTRO AMBITOS ESPECIFICACIONES COMPRA`
- `MAESTRO TIPO ESPECIFICACIONES COMPRA`
- `OPERARIOS`
- `OPERACIONES`
- `MAQUINAS`
- `RUTAS`
- `CAUSAS RECHAZO`
- `INCIDENCIAS`
- `NORMASN`

#### Transaccionales
- `REGISTRO TRABAJOS`
- `ORDENES DE FABRICACION`
- `FACTURAS VENTA CABECERAS` / `FACTURAS VENTA LINEAS`
- `FACTURAS CABECERA` / `FACTURAS LINEAS` (Compras)
- `LISTADO ESPECIFICACIONES`
- `ENSAYOS_DUREZA`
- `ENSAYOS_TRACCION`
- `ENSAYOS_METALOGRAFIA`
- `RX_X_INFORME RX LOTE`
- `RX_X_INFORME VIS LOTE`
- `RX_X_INFORME LP LOTE`
- `RX_LIST-CERTIFICADOS END`

### `Fw_Comunes` (Externa)
- `CALIBRACIONES`
- `CALIBRACIONES DETALLE`
- `PERIODOS`

---

## 2. Detalle por Sección de la Web

### 🛠️ MAESTRO
#### Artículos
- **Tabla Principal**: `MAESTRO ARTICULOS`
- **Relaciones (Joins)**:
  - `MAESTRO FAMILIAS` (por `codigo familia`)
  - `MAESTRO SUBFAMILIAS` (por `codigo subfamilia`)
  - `MAESTRO TIPO ARTICULOS` (por `codigo tipo`)
  - `MAESTRO REFERENCIAS CLIENTE` (para filtrar por cliente)

#### Centros
- **Tabla Principal**: `MAQUINAS`

#### Especificaciones
- **Tabla Principal**: `LISTADO ESPECIFICACIONES`
- **Relaciones**:
  - `MAESTRO AMBITOS ESPECIFICACIONES COMPRA`
  - `MAESTRO TIPO ESPECIFICACIONES COMPRA`

#### Proveedores
- **Tabla Principal**: `PROVEEDORES MAESTRO`

#### Clientes
- **Tabla Principal**: `MAESTRO CLIENTES`

#### Códigos rechazo
- **Tabla Principal**: `CAUSAS RECHAZO`

#### Incidencias
- **Tabla Principal**: `INCIDENCIAS`
- **Relaciones**: `MAESTRO SECCIONES`

#### Utillajes
- **Tabla Principal**: `MAESTRO UTILLAJES`
- **Relaciones**:
  - `MAESTRO FAMILIAS`
  - `MAESTRO SITUACION UTILLAJES`
  - `MAESTRO TIPO ARTICULOS`

#### Ausencias
- **Tabla Principal**: `REGISTRO TRABAJOS` / `OPERARIOS` (Pendiente de confirmación final)

#### Materiales
- **Origen**: `MAESTRO ARTICULOS` (Select DISTINCT `material`)

#### Normas
- **Tabla Principal**: `NORMASN`

#### Rutas
- **Tabla Principal**: `RUTAS`
- **Relaciones**:
  - `MAESTRO ARTICULOS` (Datos del artículo asociado)
  - `MAQUINAS` (Centro de trabajo)
  - `OPERACIONES` (Descripción de operación)

#### Operarios
- **Tabla Principal**: `OPERARIOS`
- **Relaciones**: `MAESTRO SECCIONES`

#### Operaciones
- **Tabla Principal**: `OPERACIONES`
- **Tabla Detalle**: `OPERACIONES DETALLE`
- **Relaciones**: `MAESTRO SECCIONES`

#### Grupos Cálculo
- **Tabla Principal**: `MAESTRO GRUPOS CALCULO`
- **Relaciones**: `OPERACIONES POR GRUPO CALCULO` (Tabla intermedia M:N)

---

### 🔥 HEATTREAT
#### Coladas-TT
- **Vista Principal**: `Qry_Lotes_ColadaTT_Pivotado`
- **Relaciones**: No aplica (Vista plana)

---

### 🛡️ CALIDAD
#### Rechazos
- **Vista Principal**: `Qry_RankingRechazos`
- **Tablas Auxiliares**:
  - `CAUSAS RECHAZO` (Descripciones)
  - `ORDENES DE FABRICACION` (Para calcular totales fabricados y %)

---

### 👥 PERSONAL
#### Bonos
- **Vista Principal**: `qry_DiarioHorasTrabajo+HorasAusencia`
- **Relaciones**: `OPERARIOS` (Nombre), `MAESTRO SECCIONES` (Sección)

#### Formación / Polivalencias / Capacitaciones / Certificaciones
- *(Secciones en desarrollo / Datos pendientes de análisis)*

---

### 🔬 ENSAYOS
#### Informes VT (Visual Testing)
- **Tabla Principal**: `RX_X_INFORME VIS LOTE`
- **Relaciones**: `RX_LIST-CERTIFICADOS END` (Inspectores)

#### Informes PT (Penetrant Testing)
- **Tabla Principal**: `RX_X_INFORME LP LOTE`
- **Relaciones**: `RX_LIST-CERTIFICADOS END` (Inspectores)

#### Informes RT (Radiographic Testing)
- **Tabla Principal**: `RX_X_INFORME RX LOTE`
- **Relaciones**: `RX_LIST-CERTIFICADOS END` (Inspectores)

#### Informes Dureza
- **Tabla Principal**: `ENSAYOS_DUREZA`

#### Informes Tracción
- **Tabla Principal**: `ENSAYOS_TRACCION`

#### Informes Metalografía
- **Tabla Principal**: `ENSAYOS_METALOGRAFIA`

#### Informes Fugas
- *(No existe tabla actualmente)*

---

### 🔧 MANTENIMIENTO
#### Activos
- **Tabla Principal**: `MAESTRO ACTIVOS`
- **Relaciones**: `MAESTRO ZONAS ACTIVOS`

#### Ordenes
- **Tabla Principal**: `MANTENIMIENTO_ORDENES` (Nombre a confirmar)
- **Relaciones**: `MAESTRO ACTIVOS`

---

### 📏 CALIBRACIONES
#### Equipos
- **Tablas**: `CALIBRACIONES` (Cabecera), `CALIBRACIONES DETALLE` (Historial)
- **Relaciones**: `PERIODOS` (Frecuencias de calibración)
- **Base de Datos**: `Fw_Comunes`

---

### 🏭 PRODUCCION
#### OEE
- **Tablas Principales**: `REGISTRO TRABAJOS`, `OPERACIONES`
- **Filtros Clave**: `OPERACIONES.[ComputoOEE] = 1`
- **Relaciones**: `MAESTRO SECCIONES` (Agrupación)

#### Ordenes
- **Tabla Principal**: `ORDENES DE FABRICACION`
- **Relaciones**:
  - `MAESTRO ARTICULOS` (Descripción)
  - `MAESTRO CLIENTES` (Nombre cliente)

---

### 🛒 COMPRAS
#### Solicitante Compras
- *(Pendiente)*

#### Pedidos
- *(Pendiente: `PEDIDOS COMPRA CABECERA` / `LINEAS`)*

#### Albaranes
- *(Pendiente: `ALBARANES COMPRA CABECERA` / `LINEAS`)*

#### Facturas
- **Tablas**: `FACTURAS CABECERA`, `FACTURAS LINEAS`
- **Relaciones**: `PROVEEDORES MAESTRO`

---

### 💼 COMERCIAL
#### OTD (On Time Delivery)
- **Vista**: `Qry_Estadistica_Cumplimiento_Entregas`
- **Detalle**: `Qry_Estadisticas_Albaranes_Lineas`

#### Capa Charge
- **Fuente**: Misma vista `Qry_Estadistica_Cumplimiento_Entregas`

---

## 3. Relaciones Generales en Filtros
Esta sección explica de dónde salen los datos de los desplegables comunes en toda la web.

- **Filtro Sección**:
  - Fuente: `MAESTRO SECCIONES`
  - Campo ID: `seccion`
  - Campo Texto: `denominacion`

- **Filtro Familia**:
  - Fuente: `MAESTRO FAMILIAS`
  - Relación: A menudo se filtra por `Tipo = '02'` (Producción).

- **Filtro Cliente**:
  - Fuente: `MAESTRO CLIENTES`
  - Campo ID: `codigo cliente`
  - Campo Texto: `nombre`

- **Filtro Proveedor**:
  - Fuente: `PROVEEDORES MAESTRO`
