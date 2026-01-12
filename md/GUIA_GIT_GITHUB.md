# Guía de Git y GitHub - EIPC ERP

Esta guía explica cómo gestionar el código del proyecto con Git y GitHub.

---

## 📍 Repositorio

**URL:** https://github.com/jbasnav/EIPC-ERP

---

## 🔄 Flujo de Trabajo Diario

### 1. Ver el estado actual

```powershell
git status
```

Esto muestra:
- Archivos modificados (en rojo)
- Archivos listos para commit (en verde)
- Archivos nuevos no rastreados

---

### 2. Guardar cambios (Commit)

**Paso a paso:**

```powershell
# 1. Añadir todos los cambios
git add .

# 2. Crear un commit con mensaje descriptivo
git commit -m "Descripción de los cambios realizados"
```

**Ejemplo:**
```powershell
git add .
git commit -m "Añadida sección de inventario"
```

---

### 3. Subir cambios a GitHub (Push)

```powershell
git push
```

Si es la primera vez o hay problemas:
```powershell
git push -u origin main
```

---

### 4. Descargar cambios de GitHub (Pull)

Si trabajas en varios ordenadores:
```powershell
git pull
```

---

## 📝 Comandos Útiles

| Comando | Descripción |
|---------|-------------|
| `git status` | Ver estado actual |
| `git add .` | Añadir todos los cambios |
| `git add archivo.js` | Añadir un archivo específico |
| `git commit -m "mensaje"` | Crear commit |
| `git push` | Subir a GitHub |
| `git pull` | Descargar de GitHub |
| `git log -n 5` | Ver últimos 5 commits |
| `git diff` | Ver diferencias |

---

## 🔴 Deshacer Cambios

### Descartar cambios en un archivo (antes de commit):
```powershell
git checkout -- archivo.js
```

### Descartar TODOS los cambios locales:
```powershell
git checkout -- .
```

### Deshacer el último commit (manteniendo los cambios):
```powershell
git reset --soft HEAD~1
```

---

## 🌿 Trabajar con Ramas (Branches)

### Crear una nueva rama:
```powershell
git checkout -b nombre-nueva-rama
```

### Cambiar a otra rama:
```powershell
git checkout main
git checkout nombre-rama
```

### Ver todas las ramas:
```powershell
git branch
```

### Fusionar rama con main:
```powershell
git checkout main
git merge nombre-rama
```

### Eliminar rama (después de fusionar):
```powershell
git branch -d nombre-rama
```

---

## ⚠️ Resolver Conflictos

Si al hacer `pull` hay conflictos:

1. Git marcará los archivos en conflicto
2. Abre los archivos y busca:
   ```
   <<<<<<< HEAD
   Tu código local
   =======
   Código de GitHub
   >>>>>>> origin/main
   ```
3. Edita el archivo dejando el código correcto
4. Guarda y haz commit:
   ```powershell
   git add .
   git commit -m "Resuelto conflicto en archivo.js"
   git push
   ```

---

## 🔐 Autenticación

### Si te pide usuario/contraseña:

GitHub ya no acepta contraseñas. Usa un **Personal Access Token**:

1. Ve a: https://github.com/settings/tokens
2. Click "Generate new token (classic)"
3. Selecciona permisos: `repo` (todos)
4. Copia el token generado
5. Usa el token como contraseña cuando Git lo pida

### Guardar credenciales (para no repetir):
```powershell
git config --global credential.helper store
```

---

## 📋 Flujo Completo de Ejemplo

```powershell
# 1. Ver qué has cambiado
git status

# 2. Añadir cambios
git add .

# 3. Commit con mensaje
git commit -m "Mejoras en sección Calidad: añadido filtro por tipo de sección"

# 4. Subir a GitHub
git push

# Listo! ✅
```

---

## 🆘 Ayuda Rápida

Si algo sale mal, estos comandos pueden ayudar:

```powershell
# Ver el historial de commits
git log --oneline -10

# Ver diferencias antes de commit
git diff

# Ver qué archivos cambiaron en el último commit
git show --stat

# Verificar la conexión con GitHub
git remote -v
```

---

## 📁 Archivos Ignorados (.gitignore)

El archivo `.gitignore` define qué archivos NO se suben a GitHub:

```
node_modules/
*.log
.env
```

Para añadir algo al gitignore, edita el archivo y añade una línea con el patrón.

---

*Última actualización: 23/12/2024*
