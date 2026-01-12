# Panel de Administración y Correcciones UI

## Correcciones Menores

### 1. Iniciales del usuario (muestra 'U')

**Causa**: `app.js` línea 9244 lee `result.user.iniciales` pero el backend devuelve `initials`.

#### [MODIFY] [app.js](file:///c:/Users/jbasterrika/Desktop/CODING/EIPC/EIPC%20v1/app.js)
```diff
- if (avatar) avatar.textContent = result.user.iniciales || 'U';
+ if (avatar) avatar.textContent = result.user.initials || 'U';
```

---

### 2. Texto "Contr ol" en KPI MAESTROS

**Causa**: Salto de línea incorrecto en HTML.

#### [MODIFY] [index.html](file:///c:/Users/jbasterrika/Desktop/CODING/EIPC/EIPC%20v1/index.html)
```diff
- <p class="kpi-value">Contr
-
-                                     ol</p>
+ <p class="kpi-value">Control</p>
```

---

### 3. Año 2026 en desplegables

#### [MODIFY] [index.html](file:///c:/Users/jbasterrika/Desktop/CODING/EIPC/EIPC%20v1/index.html)
Añadir opción 2026 en `dashboardYearFilter` (línea ~599):
```html
<option value="2026">2026</option>
```

---

## Panel de Administración de Usuarios

### Backend - Nuevos Endpoints

#### [MODIFY] [server.js](file:///c:/Users/jbasterrika/Desktop/CODING/EIPC/EIPC%20v1/server.js)

Añadir endpoints:
- `GET /api/admin/users` - Listar todos los usuarios
- `POST /api/admin/users` - Crear nuevo usuario  
- `PUT /api/admin/users/:username` - Actualizar usuario (rol, password)
- `DELETE /api/admin/users/:username` - Eliminar usuario

---

### Frontend

#### [MODIFY] [index.html](file:///c:/Users/jbasterrika/Desktop/CODING/EIPC/EIPC%20v1/index.html)

1. Añadir enlace "Panel de Administración" bajo el formulario de login
2. Crear nueva vista `adminView` con tabla de usuarios y formularios CRUD

#### [MODIFY] [app.js](file:///c:/Users/jbasterrika/Desktop/CODING/EIPC/EIPC%20v1/app.js)

1. Añadir funciones para gestión de usuarios admin
2. Validar que solo usuarios con `rol === 'admin'` pueden acceder

---

## Verificación

1. Login y verificar iniciales correctas en header
2. Verificar texto "Control" en KPI
3. Verificar desplegable muestra 2026
4. Login como admin y acceder al panel de administración
5. CRUD de usuarios funcional
