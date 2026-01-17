# Instrucciones para Trabajar con el Asistente de IA

## 🔄 Retomar Tareas Pendientes

### Antes de cerrar la sesión
Cuando vayas a terminar y queden tareas pendientes, dime:
```
Apunta estas tareas pendientes:
1. [descripción de tarea 1]
2. [descripción de tarea 2]
```

### Para retomar en la siguiente sesión
Simplemente escribe:
```
/pendientes
```
O bien:
```
Continúa con las tareas pendientes
```

---

## 📋 Comandos Útiles

| Comando | Descripción |
|---------|-------------|
| `/pendientes` | Ver y retomar tareas pendientes |
| `Revisa el estado del proyecto` | Análisis general del código |
| `¿Qué hicimos en la última sesión?` | Resumen de trabajo anterior |

---

## 💡 Consejos para Mejor Colaboración

1. **Sé específico**: "Arregla el filtro de año en Capa Charge" es mejor que "arregla los filtros"
2. **Proporciona contexto**: Si hay errores, pega el mensaje de error completo
3. **Indica el archivo**: Si sabes qué archivo tiene el problema, menciónalo
4. **Prioriza**: Si hay varias tareas, indica cuál es más urgente

---

## ⚠️ Limitaciones a Tener en Cuenta

- **No tengo memoria entre sesiones** - Cada conversación empieza de cero
- **No veo tu pantalla** - Si algo no funciona, descríbemelo o pega el error
- **Los archivos `.gemini/` son temporales** - Las notas importantes deben guardarse en el proyecto

---

## 📁 Archivos de Referencia del Proyecto

- **Tareas pendientes**: `.agent/workflows/pendientes.md`
- **Este archivo**: `.agent/workflows/instrucciones.md`

---

*Última actualización: Enero 2026*

---

## 📚 Mantenimiento de Documentación (TABLAS_SQL.md)

Cuando se añada o modifique una sección/subsección en la web que use tablas SQL, sigue este protocolo:

### 1. Actualizar `md/TABLAS_SQL.md`
- **Si añades una nueva tabla**:
  1. Añádela en la sección **Listado de Tablas Utilizadas**.
  2. Incluye: Nombre y breve descripción.

- **Si añades una nueva sección en la web**:
  1. Ve a **Detalle por Sección de la Web**.
  2. Añade la sección con su emoji correspondiente (ej. 🏗️).
  3. Lista las tablas, consultas clave y lógica de filtros.

### 2. Formato Estándar
```markdown
### 🏠 NOMBRE SECCIÓN
#### Nombre Subsección
- **Tablas**: `TABLA_A`, `TABLA_B`.
- **Uso**: Descripción breve...
```

### 3. Verificación
- Confirma que los nombres de tablas coinciden exactamente con el `server.js`.
- Verifica si los filtros dependen de tablas maestras (ej. `MAESTRO_CLIENTES`).

