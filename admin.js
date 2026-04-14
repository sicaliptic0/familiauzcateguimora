const SUPABASE_URL = "https://rbmepxgqzcdlrmaiyvyy.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_kNQ1h9gKz4ZvFQ6wJldizg_Eefd51mV";

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function el(id) {
  return document.getElementById(id);
}

/**
 * Comprueba sesión + fila profiles.is_admin y devuelve motivo legible si falla.
 */
async function getAdminAccessStatus() {
  const { data: { user }, error: userErr } = await sb.auth.getUser();
  if (userErr) return { ok: false, reason: `Sesión: ${userErr.message}` };
  if (!user) return { ok: false, reason: "No hay sesión activa." };

  const { data, error } = await sb.from("profiles").select("is_admin").eq("id", user.id).maybeSingle();
  if (error) {
    return {
      ok: false,
      reason: `No se pudo leer public.profiles (${error.message}). ¿Ejecutaste supabase/schema.sql y existe tu fila de perfil?`,
    };
  }
  if (!data) {
    return {
      ok: false,
      reason:
        "No hay fila en public.profiles para tu usuario. En Supabase SQL: insert/update profiles con tu id de auth.users o crea de nuevo la cuenta con el trigger handle_new_user.",
    };
  }
  if (!data.is_admin) {
    return {
      ok: false,
      reason:
        "Tu cuenta está confirmada, pero aún no es administrador (is_admin = false). En Supabase abre SQL Editor (rol de servicio del proyecto) y ejecuta, sustituyendo tu correo: update public.profiles set is_admin = true where email = 'tu_correo@ejemplo.com';",
    };
  }
  return { ok: true };
}

function requestCard(req) {
  const p = req.payload || {};
  const title = req.type === "edit_person"
    ? `Modificar: ${String(p.objectiveName || "persona")}`
    : `Agregar: ${String(p.firstName || "")} ${String(p.lastName || "")}`.trim();
  const created = new Date(req.created_at || Date.now()).toLocaleString();
  return `
    <div class="card" data-req="${req.id}">
      <div class="card__top">
        <div class="card__title">${title || "Solicitud"}</div>
        <div class="status status--pending">Pendiente por aprobar</div>
      </div>
      <div class="card__meta">
        <div><b>Enviado por:</b> ${req.requester_name || "—"} · <b>Fecha:</b> ${created}</div>
        ${req.notes ? `<div><b>Notas:</b> ${req.notes}</div>` : ""}
      </div>
      <div class="card__actions">
        <button class="btn btn--primary" type="button" data-approve="${req.id}">Aprobar</button>
      </div>
    </div>
  `;
}

async function loadPending() {
  const list = el("adminRequests");
  list.innerHTML = "";
  const { data, error } = await sb
    .from("requests")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  if (error) {
    list.innerHTML = `<div class="card"><div class="card__title">Error</div><div class="card__meta">${error.message}</div></div>`;
    return;
  }
  if (!data || data.length === 0) {
    list.innerHTML = `<div class="card"><div class="card__title">Sin solicitudes</div><div class="card__meta">No hay pendientes.</div></div>`;
    return;
  }
  list.innerHTML = data.map(requestCard).join("");
  for (const btn of list.querySelectorAll("[data-approve]")) {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-approve");
      btn.disabled = true;
      await sb.rpc("approve_request", { req_id: id });
      const card = list.querySelector(`[data-req="${id}"]`);
      if (card) card.remove();
    });
  }
}

async function showAdminUI() {
  el("authBox").style.display = "none";
  el("adminBox").style.display = "block";
  el("authMsg").textContent = "";
  await loadPending();
}

async function showAuthUI(msg) {
  el("adminBox").style.display = "none";
  el("authBox").style.display = "block";
  if (msg != null && msg !== "") el("authMsg").textContent = msg;
}

function readCreds() {
  const email = el("adminEmail").value.trim();
  const password = el("adminPassword").value;
  return { email, password };
}

el("signInBtn").addEventListener("click", async () => {
  const btn = el("signInBtn");
  const { email, password } = readCreds();
  if (!email || !password) {
    el("authMsg").textContent = "Completa email y contraseña.";
    return;
  }
  btn.disabled = true;
  el("authMsg").textContent = "Entrando...";
  try {
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) {
      el("authMsg").textContent = error.message;
      return;
    }
    if (!data.session) {
      el("authMsg").textContent =
        "No se obtuvo sesión. Si Supabase exige confirmar el correo, revisa tu bandeja y vuelve a intentar.";
      return;
    }

    await new Promise((r) => setTimeout(r, 80));
    const access = await getAdminAccessStatus();
    if (!access.ok) {
      el("adminBox").style.display = "none";
      el("authBox").style.display = "block";
      await sb.auth.signOut();
      el("authMsg").textContent = access.reason;
      return;
    }
    await showAdminUI();
  } catch (err) {
    el("authMsg").textContent = err?.message || "Error de red. Comprueba conexión y la URL/clave de Supabase.";
  } finally {
    btn.disabled = false;
  }
});

el("signUpBtn").addEventListener("click", async () => {
  const { email, password } = readCreds();
  if (!email || !password) {
    el("authMsg").textContent = "Completa email y contraseña para crear la cuenta.";
    return;
  }
  if (password.length < 6) {
    el("authMsg").textContent = "La contraseña debe tener al menos 6 caracteres (límite típico de Supabase).";
    return;
  }
  el("authMsg").textContent = "Creando cuenta...";
  const { data, error } = await sb.auth.signUp({ email, password });
  if (error) {
    el("authMsg").textContent = error.message;
    return;
  }

  if (!data.session) {
    el("authMsg").textContent =
      "Cuenta creada. Si Supabase pide confirmar email, revisa tu bandeja y luego pulsa Entrar. Después marca is_admin=true en public.profiles para tu correo.";
    return;
  }

  el("authMsg").textContent =
    "Cuenta creada. Marca tu usuario como admin en SQL (una vez): update public.profiles set is_admin = true where email = tu@correo;";
});

el("signOut").addEventListener("click", async () => {
  await sb.auth.signOut();
  await showAuthUI("Sesión cerrada.");
});

(async () => {
  const access = await getAdminAccessStatus();
  if (access.ok) await showAdminUI();
  else await showAuthUI("Entra con email y contraseña.");
})();
