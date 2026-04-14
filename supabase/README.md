## Supabase setup (Admin + Solicitudes)

### 1) Crea el schema
- En tu proyecto Supabase, abre **SQL Editor**
- Pega y ejecuta el contenido de `supabase/schema.sql`

### 2) Crea el usuario admin
Tienes 2 caminos (elige uno):

**A) Desde la web (`admin.html`)**
- Abre `admin.html`
- Pulsa **Crear cuenta (1ª vez)** con tu email + contraseña
- Si tu proyecto Supabase exige **confirmación por email**, revisa el correo y luego pulsa **Entrar**

**B) Desde el panel de Supabase**
En **Authentication → Users**, crea el usuario con email/contraseña.

### 3) Marca `is_admin` (obligatorio para ver el panel)
El schema crea `public.profiles` y (si aplica el trigger) inserta una fila por usuario con `is_admin=false`.
Debes promover tu correo a admin **una sola vez**:

```sql
insert into public.profiles (id, email, is_admin)
select u.id, u.email, true
from auth.users u
where u.email = 'samuel.galviz@gmail.com'
on conflict (id) do update set is_admin = true, email = excluded.email;
```

### 4) Llaves en frontend
En `supabaseClient.js` y `admin.js` está el URL y la publishable key del proyecto.

### 5) Dashboard de admin
Abre `admin.html`, entra con **email + contraseña**. Cuando ya hayas aplicado los cambios del árbol a mano, pulsa **Aprobar**: la solicitud se borra de la base y desaparece del panel de solicitudes en la web pública (solo se listan pendientes).

