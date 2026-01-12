# Tablas SQL Server Utilizadas

Este documento lista todas las tablas, vistas y procedimientos almacenados de SQL Server utilizados en la aplicación EIPC v1, organizados por categoría y función.

## Base de Datos: `Fw_EIPC` (Principal)

### Tablas Maestras (Datos Estáticos/Configuración)
| Tabla | Descripción | Uso Principal |
|-------|-------------|---------------|
| `USUARIOS_APP` | Usuarios de la aplicación, contraseñas y roles | Autenticación y control de acceso |
| `MAESTRO ARTICULOS` | Catálogo maestro de artículos | Información general de artículos |
| `MAESTRO ARTICULOS PLANOS` | Rutas de planos e imágenes asociadas a artículos | Visualización de planos/imágenes |
| `MAESTRO TIPO ARTICULOS` | Tipos de artículos (ej. '02') | Clasificación y filtros |
| `MAESTRO FAMILIAS` | Familias de artículos | Clasificación y filtros |
| `MAESTRO SUBFAMILIAS` | Subfamilias de artículos | Clasificación y filtros |
| `MAESTRO CLIENTES` | Información de clientes | Filtros por cliente, dashboards comerciales |
| `MAESTRO REFERENCIAS CLIENTE` | Relación entre artículos internos y referencias de cliente | Búsquedas por referencia cliente |
| `PROVEEDORES MAESTRO` | Información de proveedores | Filtros y dashboards de compras |
| `MAESTRO SECCIONES` | Secciones de la planta | Filtros por sección (Producción, OEE) |
| `MAESTRO ZONAS ACTIVOS` | Zonas de ubicación de activos | Gestión de activos |
| `MAESTRO ACTIVOS` | Catálogo de activos fijos | Gestión de activos |
| `MAESTRO AMBITOS ESPECIFICACIONES COMPRA` | Ámbitos para especificaciones | Filtros en módulo de Especificaciones |
| `MAESTRO TIPO ESPECIFICACIONES COMPRA` | Tipos de especificaciones | Filtros en módulo de Especificaciones |
| `OPERARIOS` | Listado de operarios | Control de personal, bonos |
| `OPERACIONES` | Operaciones de fabricación | Rutas, OEE, Producción |
| `MAQUINAS` | Centros de trabajo / Máquinas | Gestión de planta |
| `RUTAS` | Definición de procesos productivos | Rutas de fabricación |
| `CAUSAS RECHAZO` | Catálogo de motivos de rechazo | Dashboard de Calidad/Rechazos |
| `INCIDENCIAS` | Tipos de incidencias de producción | Dashboard OEE |
| `NORMASN` | Normas y especificaciones técnicas | Consulta de normas |

### Tablas Transaccionales (Datos Dinámicos)
| Tabla | Descripción | Uso Principal |
|-------|-------------|---------------|
| `REGISTRO TRABAJOS` | Registro de actividad en planta (tiempos, piezas) | Cálculo de OEE, Producción |
| `FACTURAS VENTA CABECERAS` | Cabeceras de facturas de venta | Dashboard Comercial |
| `FACTURAS VENTA LINEAS` | Líneas de detalle de facturas de venta | Dashboard Comercial |
| `FACTURAS CABECERA` | Cabeceras de facturas de compra | Dashboard Compras |
| `FACTURAS LINEAS` | Líneas de detalle de facturas de compra | Dashboard Compras |
| `LISTADO ESPECIFICACIONES` | Registro de especificaciones técnicas | Módulo de Especificaciones |
| `ENSAYOS_DUREZA` | Resultados de ensayos de dureza | Módulo de Ensayos (Laboratorio) |
| `ENSAYOS_TRACCION` | Resultados de ensayos de tracción | Módulo de Ensayos (Laboratorio) |
| `ENSAYOS_METALOGRAFIA` | Resultados de ensayos metalográficos | Módulo de Ensayos (Laboratorio) |
| `RX_X_INFORME RX LOTE` | Informes de ensayos RX (Radiografía) | Dashboard Ensayos (RT) |
| `RX_LIST-CERTIFICADOS END` | Certificados de ensayos no destructivos | Dashboard Ensayos |
| `RX_X_INFORME VIS LOTE` | Informes de ensayos Visuales | Dashboard Ensayos (VT) |
| `RX_X_INFORME LP LOTE` | Informes de ensayos Líquidos Penetrantes | Dashboard Ensayos (PT) |

### Vistas (Views)
| Vista | Descripción | Uso Principal |
|-------|-------------|---------------|
| `Qry_Lotes_ColadaTT_Pivotado` | Datos pivotados de tratamientos térmicos | Listado principal de tratamientos |
| `qry_DiarioHorasTrabajo+HorasAusencia` | Vista consolidada horas trabajo vs ausencia | Dashboard Personal (Bonos) |
| `Qry_RankingRechazos` | Estadísticas detalladas de rechazos | Dashboard Calidad |
| `Qry_Estadistica_Cumplimiento_Entregas` | Análisis de entregas vs fechas prometidas | Dashboard OTD (Comercial) |
| `Qry_Estadisticas_Albaranes_Lineas` | Detalle de líneas de albarán | Análisis de rechazos vs entregas |

### Procedimientos Almacenados
| Procedimiento | Descripción | Uso Principal |
|---------------|-------------|---------------|
| `sp_VistaTratamientosDinamica` | Obtención dinámica de tratamientos | Dashboard Tratamientos |

---

## Base de Datos: `Fw_Comunes` (Externa)

| Tabla | Descripción | Uso Principal |
|-------|-------------|---------------|
| `CALIBRACIONES` | Registro de calibraciones de equipos | Gestión de Equipos |
