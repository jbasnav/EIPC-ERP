# Documentación de Origen de Datos - EIPC v1

Este documento describe el origen de datos, tablas SQL y fórmulas de cálculo para cada sección de la aplicación.

---

## 📊 COMERCIAL

### OTD (On-Time Delivery)

**Endpoint:** `/api/otd-estadisticas`

**Tablas:**
| Tabla | Uso |
|-------|-----|
| `Qry_Estadistica_Cumplimiento_Entregas` | Vista principal con datos de entregas |
| `MAESTRO CLIENTES` | Nombres de clientes para filtros |
| `MAESTRO FAMILIAS` | Familias de artículos para filtros |

**Campos principales de la vista:**
- `Cliente`, `Nombre Cliente`
- `Articulo`, `Familia`
- `Cantidad Entregada`, `Cantidad Pedida`
- `Fecha Entrega`, `Fecha Prometida`
- `Estado` (A tiempo/Retrasado)

**Métricas calculadas:**
```
OTD % = (Entregas a tiempo / Total entregas) × 100
```

---

### Capa Charge (Capacidad Productiva)

**Endpoint:** `/api/capacidad/datos`

**Tablas:**
| Tabla | Uso |
|-------|-----|
| `CAPA_CHARGE_CONFIGURACION` | Días máximos y días disponibles por año |
| `CALENDARIO` | Días laborables del año |
| `OPERARIOS` | Plantilla por sección |
| `REGISTRO TRABAJOS` | Datos de producción para OEE |
| `qry_DiarioHorasTrabajo+HorasAusencia` | Horas trabajo y ausencia para absentismo |
| `Qry_RankingRechazos` | Piezas rechazadas |
| `CAUSAS RECHAZO` | Sección de origen del rechazo |
| `ORDENES DE FABRICACION` | Cantidad fabricada por orden |
| `MAESTRO SECCIONES` | Listado de secciones |

**Fórmulas de cálculo:**

```
HORAS CONVENIO = Días Laborables × 8

PLANTILLA = COUNT(OPERARIOS) WHERE activo=1 AND a_calculo ≠ 0

OEE = (Piezas OK × Tiempo Ciclo) / Tiempo Total Disponible × 100

ABSENTISMO % = Horas Ausencia / Total Horas × 100

RECHAZO % = Piezas Rechazadas / (Piezas OK + Piezas RC + Piezas Rep) × 100

CAPACIDAD DEMOSTRADA = Plantilla × Horas Convenio × OEE × (1 - Absentismo) × (1 - Rechazo)

CAPACIDAD MÁXIMA = Capacidad Demostrada + (60 × Plantilla) + Horas Convenio

CAPACIDAD INSTALACIÓN = Días Max × 36 × 8 × OEE
```

---

## 🔧 CALIDAD

### Rechazos

**Endpoint:** `/api/calidad-dashboard`

**Tablas:**
| Tabla | Uso |
|-------|-----|
| `Qry_RankingRechazos` | Vista principal de rechazos |
| `CAUSAS RECHAZO` | Códigos y sección origen de causas |
| `OPERACIONES` | Sección de detección (operación) |
| `ORDENES DE FABRICACION` | Cantidad fabricada por orden |

**Campos de Qry_RankingRechazos:**
- `causa rechazo`, `descripcion causa`
- `PiezasRc` - Piezas rechazadas
- `ImporteRcPvpOp` - Importe del rechazo
- `codigo articulo`, `codigo operacion`
- `fecha inicio`
- `Nrorden` - Número de orden (relación con ORDENES DE FABRICACION)

**Tipos de filtro por sección:**
1. **Por Causa (Origen):** Filtra por `CAUSAS RECHAZO.Seccion`
2. **Por Detección (Operación):** Filtra por `OPERACIONES.seccion`

**Fórmulas de cálculo:**
```sql
-- Total Piezas Rechazadas
SUM(PiezasRc)

-- Importe Total
SUM(ImporteRcPvpOp)

-- Causas Diferentes
COUNT(DISTINCT causa_rechazo)

-- Artículos Afectados
COUNT(DISTINCT codigo_articulo)

-- Total Piezas Fabricadas (de órdenes con rechazos)
SELECT SUM(cantidad_fabricada)
FROM ORDENES_DE_FABRICACION
WHERE numero_orden IN (SELECT DISTINCT Nrorden FROM Qry_RankingRechazos WHERE ...)

-- % Rechazo
% Rechazo = (Total Piezas Rechazadas / Total Piezas Fabricadas) × 100
```

---

## 👥 PERSONAL

### Bonos

**Endpoint:** `/api/bonos`

**Tablas:**
| Tabla | Uso |
|-------|-----|
| `qry_DiarioHorasTrabajo+HorasAusencia` | Horas trabajadas y ausencias por operario |
| `OPERARIOS` | Información de operarios |
| `MAESTRO SECCIONES` | Secciones productivas |

**Campos principales:**
- `NombreOperario`, `NombreSeccion`
- `TotalHorasTrabajo`, `HorasAusencia`
- `Fecha`

---

## 🏭 PRODUCCIÓN

### Rutas

**Endpoint:** `/api/rutas`

**Tablas:**
| Tabla | Uso |
|-------|-----|
| `RUTAS` | Definición de rutas de fabricación |
| `OPERACIONES` | Operaciones de cada ruta |
| `MAESTRO ARTICULOS` | Información del artículo |
| `MAESTRO FAMILIAS` | Familia del artículo |

**Campos principales:**
- `codigo articulo`, `numero secuencia`
- `codigo operacion`, `descripcion`
- `tiempo preparacion`, `tiempo ciclo`
- `seccion`

---

## 📦 UTILLAJES

**Endpoint:** `/api/utillajes`

**Tablas:**
| Tabla | Uso |
|-------|-----|
| `MAESTRO UTILLAJES` | Listado de utillajes |
| `MAESTRO TIPO ARTICULOS` | Tipos de utillajes |
| `MAESTRO FAMILIAS` | Familias de utillajes |
| `MAESTRO SITUACION UTILLAJES` | Estados de utillajes |

---

## 🔬 LABORATORIO

### Ensayos

**Tablas:**
| Tabla | Uso |
|-------|-----|
| `ENSAYOS_DUREZA` | Resultados de dureza |
| `ENSAYOS_TRACCION` | Resultados de tracción |
| `ENSAYOS_METALOGRAFIA` | Resultados metalográficos |
| `RX_X_INFORME RX LOTE` | Informes de radiografía |

---

## 📋 ESPECIFICACIONES

**Endpoint:** `/api/especificaciones`

**Tablas:**
| Tabla | Uso |
|-------|-----|
| `LISTADO ESPECIFICACIONES` | Registro de especificaciones |
| `MAESTRO AMBITOS ESPECIFICACIONES COMPRA` | Ámbitos |
| `MAESTRO TIPO ESPECIFICACIONES COMPRA` | Tipos |

---

## 🔧 EQUIPOS (Calibraciones)

**Endpoint:** `/api/calibraciones`

**Base de datos:** `Fw_Comunes`

**Tablas:**
| Tabla | Uso |
|-------|-----|
| `CALIBRACIONES` | Registro de calibraciones de equipos |

---

## 💰 COMPRAS

### Dashboard Compras

**Endpoint:** `/api/compras-dashboard`

**Tablas:**
| Tabla | Uso |
|-------|-----|
| `FACTURAS CABECERA` | Cabeceras de facturas de compra |
| `FACTURAS LINEAS` | Líneas de detalle |
| `PROVEEDORES MAESTRO` | Información de proveedores |

---

## 📈 DASHBOARD PRINCIPAL

### Tratamientos

**Endpoint:** `/api/tratamientos`

**Tablas:**
| Tabla | Uso |
|-------|-----|
| `Qry_Lotes_ColadaTT_Pivotado` | Vista pivotada de tratamientos térmicos |

**Campos:**
- Tipo tratamiento (T4, T6, T4R1, T6R1, etc.)
- Piezas por tratamiento
- Fechas de tratamiento

---

## 🔐 AUTENTICACIÓN

**Tabla:** `USUARIOS_APP`

**Campos:**
- `id_usuario`, `username`, `password`
- `nombre_completo`, `iniciales`
- `email`, `activo`, `rol`

**Roles disponibles:**
- `admin` - Acceso completo
- `supervisor` - Acceso a dashboards y reportes
- `operario` - Acceso limitado

---

## ⚙️ CONFIGURACIÓN

### Tabla de Configuración de Capacidad

**Tabla:** `CAPA_CHARGE_CONFIGURACION`

```sql
CREATE TABLE CAPA_CHARGE_CONFIGURACION (
    id INT IDENTITY(1,1) PRIMARY KEY,
    ano INT NOT NULL UNIQUE,
    dias_max INT DEFAULT 365,
    dias_disponibles INT DEFAULT 250,
    fecha_actualizacion DATETIME DEFAULT GETDATE()
);
```

---

## 📝 Notas Adicionales

### Conexión a Base de Datos
- **Servidor:** FW2022
- **Base de datos principal:** Fw_EIPC
- **Base de datos secundaria:** Fw_Comunes (para Calibraciones)

### Formato de Fechas
- Las consultas SQL usan `YEAR(fecha)` y `MONTH(fecha)` para filtrar
- Las fechas se muestran en formato español (DD/MM/YYYY)

### Formato de Números
- Los importes usan formato español: punto para millares, coma para decimales
- Ejemplo: 1.234,56 €

---

*Última actualización: 23/12/2024*
