---
description: Actualizar TABLAS_SQL.md con las tablas usadas en nuevas secciones
---

# Actualizar Documento de Tablas SQL

Cuando se añada o modifique una sección/subsección en la web que use tablas SQL:

## 1. Actualizar el archivo `md/TABLAS_SQL.md`

### Si añades una nueva tabla:
1. Añádela en la sección correspondiente de **Tablas Maestras** o **Tablas Transaccionales**
2. Incluye: Nombre de tabla, Descripción, Uso Principal

### Si añades una nueva sección/subsección en la web:
1. Ve a la sección "**Mapeo de Tablas por Sección/Subsección de la Web**"
2. Añade la nueva sección con su emoji correspondiente
3. Lista todas las tablas que utiliza esa sección

## 2. Formato a seguir

```markdown
### 🏠 NOMBRE DE SECCIÓN
#### Nombre de Subsección
- `NOMBRE_TABLA` - Descripción breve del uso
- `OTRA_TABLA` (Fw_Comunes) - Si es de otra BD, indicarlo
```

## 3. Bases de datos disponibles

- **Fw_EIPC**: Base de datos principal
- **Fw_Comunes**: Base de datos compartida (calibraciones, etc.)

## 4. Verificación

Después de actualizar:
1. Verifica que la tabla existe en el servidor SQL
2. Confirma que los campos usados coinciden con los del código
3. Actualiza la fecha de última actualización al final del documento

---

*Este workflow asegura que el documento TABLAS_SQL.md se mantenga sincronizado con la evolución de la aplicación.*
