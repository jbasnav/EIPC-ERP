# Corrección del Bug de Carga de Usuarios en Login

## Descripción del Problema

Los usuarios no se cargan en el dropdown de la pantalla de login. Tras la investigación se ha identificado que:

1. **El backend funciona correctamente**: El endpoint `/api/users` devuelve los usuarios con la estructura `{ success: true, users: [...] }`

2. **Hay código duplicado en `app.js`**: 
   - `loadUsersFromDB()` (línea 3675) - Lee correctamente `result.users`
   - `loadUsers()` (línea 9165) - Lee **incorrectamente** `result.data` (debería ser `result.users`)

3. **Conflicto con endpoints duplicados en `server.js`**: Hay dos definiciones del endpoint `/api/users` (líneas 77 y 1803)

## Causa Raíz

La función `loadUsers()` en la línea 9180 de `app.js` espera recibir `result.data` pero el backend devuelve `result.users`, por lo que la condición `result.success && result.data` siempre falla.

---

## Propuesta de Cambios

### [MODIFY] [app.js](file:///c:/Users/jbasterrika/Desktop/CODING/EIPC/EIPC%20v1/app.js)

Corregir la función `loadUsers()` en la línea 9180 para leer `result.users` en lugar de `result.data`:

```diff
- if (result.success && result.data) {
-     result.data.forEach(user => {
+ if (result.success && result.users) {
+     result.users.forEach(user => {
          const option = document.createElement('option');
          option.value = user.id;
```

> [!NOTE]
> La función `loadUsersFromDB()` en línea 3675 ya está correcta, pero existe código duplicado. En una limpieza posterior se debería unificar ambas funciones.

---

## Plan de Verificación

### Prueba Manual
1. Inicia el servidor Node.js (`node server.js`) 
2. Abre `http://localhost:3001` en el navegador
3. Verifica que el dropdown de usuarios muestre los usuarios (Administrador, etc.) en lugar de "Cargando usuarios..."
4. Haz login con un usuario para confirmar que todo funciona

> [!IMPORTANT]
> Por favor confirma si procedo con este cambio. Si deseas, puedo también unificar el código duplicado de login en una tarea separada.
