# 🔐 SISTEMA DE CONTROL DE PERMISOS POR ROLES - GUÍA DE IMPLEMENTACIÓN

## ✅ PASOS COMPLETADOS (Backend y Frontend)

### Backend (server.js):
- ✅ Endpoint `/api/login` modificado para devolver rol del usuario
- ✅ Endpoint `/api/operaciones/:codigo/computo-oee` con verificación de permisos
  - Solo usuarios con rol 'admin' o 'supervisor' pueden editar ComputoOEE
  - Devuelve error 403 (Forbidden) si el usuario no tiene permisos

### Frontend (app.js):
- ✅ Login guarda rol del usuario en localStorage y appData.currentUser
- ✅ toggleComputoOEE() verifica autenticación y envía userId
- ✅ Mensajes de error específicos según el problema (sin permisos, no autenticado, etc.)

## 🔧 PASOS PENDIENTES (SQL - DEBES EJECUTAR TÚ)

### Paso 1: Dar permisos UPDATE a api_user

**Ejecuta en SQL Server Management Studio:**

```sql
USE Fw_EIPC;
GO

-- Dar permisos UPDATE en la tabla OPERACIONES
GRANT UPDATE ON dbo.OPERACIONES TO api_user;
GO

-- Verificar permisos
SELECT 
    permission_name,
    state_desc
FROM sys.database_permissions p
JOIN sys.database_principals dp ON p.grantee_principal_id = dp.principal_id
WHERE dp.name = 'api_user'
    AND p.major_id = OBJECT_ID('dbo.OPERACIONES');
GO
```

### Paso 2: Añadir campo de rol y asignar roles

```sql
USE Fw_EIPC;
GO

-- 1. Añadir columna rol
ALTER TABLE USUARIOS_APP ADD rol NVARCHAR(50) NULL;
GO

-- 2. Asignar roles a tus usuarios
-- AJUSTA ESTOS NOMBRES SEGÚN TUS USUARIOS REALES:

UPDATE USUARIOS_APP 
SET rol = 'admin' 
WHERE username = 'jbasterrika';  -- Usuario administrador principal

UPDATE USUARIOS_APP 
SET rol = 'supervisor' 
WHERE username = 'jmerino';  -- Usuario supervisor

UPDATE USUARIOS_APP 
SET rol = 'operario' 
WHERE username = 'aarmenteros';  -- Usuario operario (sin edición)

-- Para todos los demás usuarios que puedan existir:
UPDATE USUARIOS_APP 
SET rol = 'operario' 
WHERE rol IS NULL;
GO

-- 3. Verificar la asignación de roles
SELECT 
    id_usuario,
    username,
    nombre_completo,
    rol,
    activo
FROM USUARIOS_APP
ORDER BY id_usuario;
GO
```

## 📊 ROLES Y PERMISOS

| Rol         | Puede Ver Operaciones | Puede Editar ComputoOEE |
|-------------|----------------------|-------------------------|
| **admin**      | ✅ Sí                 | ✅ Sí                    |
| **supervisor** | ✅ Sí                 | ✅ Sí                    |
| **operario**   | ✅ Sí                 | ❌ No                    |

## 🧪 PRUEBAS

### Test 1: Verificar permisos de base de datos
```bash
node test_update_permissions.js
```

**Resultado esperado:**
```
✅ TODAS LAS PRUEBAS PASARON - Los permisos están correctos
```

### Test 2: Probar en la aplicación

1. **Reiniciar el servidor:**
   ```bash
   # Detener servidor actual (Ctrl+C)
   node server.js
   ```

2. **Refrescar la página** del navegador (F5)

3. **Hacer login** con diferentes usuarios:
   - **Como admin o supervisor**: Deberías poder cambiar ComputoOEE (click en la celda)
   - **Como operario**: Saldrá mensaje "No tienes permisos para editar ComputoOEE"

4. **Ver logs en consola** (F12):
   ```
   [LOGIN] Login successful - User: Julio Basterrika Role: admin
   [toggleComputo OEE] Intentando cambiar: {...}
   ```

## 🚨 SOLUCIÓN DE PROBLEMAS

### Error: "UPDATE permission was denied"
**Causa:** No ejecutaste el Paso 1 del SQL
**Solución:** Ejecuta el GRANT UPDATE del Paso 1

### Error: "Usuario no autenticado"
**Causa:** No has hecho login o el localStorage fue borrado
**Solución:** Haz login de nuevo

### Error: "No tienes permisos para editar ComputoOEE"
**Causa:** Tu usuario tiene rol 'operario'
**Solución:** 
- Pide a un administrador que cambie tu rol
- O ejecuta: `UPDATE USUARIOS_APP SET rol = 'admin' WHERE username = 'tu_usuario';`

### El filtro "Activo" no funciona
**Causa:** Puede ser problema de mayúsculas/minúsculas
**Solución:** Verifica que el valor de 'activo' sea boolean (bit) en la base de datos

## 📋 CHECKLIST FINAL

- [ ] Ejecuté el SQL del Paso 1 (GRANT UPDATE)
- [ ] Ejecuté el SQL del Paso 2 (ALTER TABLE + UPDATE roles)
- [ ] Verifiqué los roles con el SELECT final
- [ ] Reinicié el servidor Node.js
- [ ] Refresqué la página del navegador
- [ ] Hice login y veo mi rol en la consola
- [ ] Probé cambiar ComputoOEE
- [ ] Si soy operario, sale mensaje de "sin permisos" ✅
- [ ] Si soy admin/supervisor, puedo cambiar el valor ✅

## 🎯 PRÓXIMOS PASOS (OPCIONAL)

Si quieres extender el sistema de permisos:

1. **Añadir más roles:**
   ```sql
   -- Ejemplo: rol 'gerente' con permisos similares a supervisor
   UPDATE USUARIOS_APP SET rol = 'gerente' WHERE username = 'xxx';
   ```
   
   Luego en server.js línea ~868:
   ```javascript
   if (userRole !== 'admin' && userRole !== 'supervisor' && userRole !== 'gerente') {
   ```

2. **Aplicar control de permisos a otras acciones:** 
   - Editar otros campos de operaciones
   - Eliminar registros
   - Acceder a ciertas vistas

3. **Añadir auditoría:**
   ```sql
   CREATE TABLE AUDITORIA_CAMBIOS (
       id INT IDENTITY PRIMARY KEY,
       tabla NVARCHAR(100),
      campo NVARCHAR(100),
       registro_id NVARCHAR(100),
       valor_anterior NVARCHAR(MAX),
       valor_nuevo NVARCHAR(MAX),
       usuario_id INT,
       fecha DATETIME DEFAULT GETDATE()
   );
   ```

## 📞 SOPORTE

Si encuentras algún problema:
1. Revisa la consola del navegador (F12)
2. Revisa los logs del servidor
3. Verifica que ejecutaste TODOS los SQLs
4. Asegúrate de haber reiniciado el servidor

¡Feliz coding! 🚀
