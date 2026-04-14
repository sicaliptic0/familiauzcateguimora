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

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function relationshipLabel(rel) {
  const m = {
    child_of: "Hijo/a de",
    spouse_of: "Esposo/a de",
    sibling_of: "Hermano/a de",
    parent_of: "Papá o mamá de",
    other: "Otro",
  };
  return m[String(rel || "")] || (rel ? String(rel) : "—");
}

function formatDateShort(iso) {
  if (!iso) return "—";
  try {
    const [y, m, d] = String(iso).split("-").map((x) => Number(x));
    if (!y || !m || !d) return String(iso);
    return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
  } catch {
    return String(iso);
  }
}

function isSafePhotoUrl(url) {
  const u = String(url || "");
  return u.startsWith("data:image/") || u.startsWith("https://") || u.startsWith("http://");
}

function requestPhotosThumbsHtml(photos) {
  const arr = (Array.isArray(photos) ? photos : []).filter((u) => isSafePhotoUrl(u)).slice(0, 5);
  if (!arr.length) return "";
  return `<div class="requestCard__photos">${arr.map((url) => `<img class="requestCard__thumb" src="${escapeHtml(url)}" alt="" loading="lazy" />`).join("")}</div>`;
}

function requestCard(req) {
  const p = req.payload || {};
  const title = req.type === "edit_person"
    ? `Modificar: ${String(p.firstName || "").trim()} ${String(p.lastName || "").trim()}`.trim() || "persona"
    : `Agregar: ${String(p.firstName || "").trim()} ${String(p.lastName || "").trim()}`.trim();
  const created = new Date(req.created_at || Date.now()).toLocaleString();
  const aliveLine = p.isAlive ? "Vivo" : `Fallecido (${formatDateShort(p.deathDate)})`;
  const typeLine = req.type === "edit_person" ? "Modificar persona" : "Agregar persona";
  const thumbs = requestPhotosThumbsHtml(p.photos);
  return `
    <div class="card" data-req="${req.id}">
      <div class="card__top">
        <div class="card__title">${escapeHtml(title || "Solicitud")}</div>
        <div class="status status--pending">Pendiente por aprobar</div>
      </div>
      <div class="card__meta">
        <div><b>Tipo:</b> ${escapeHtml(typeLine)}</div>
        <div><b>Nombre completo:</b> ${escapeHtml(String(p.firstName || "").trim())} · <b>Apellido completo:</b> ${escapeHtml(String(p.lastName || "").trim())}</div>
        <div><b>Nac.:</b> ${escapeHtml(formatDateShort(p.birthDate))} · <b>Estado:</b> ${escapeHtml(aliveLine)}</div>
        <div><b>Ubicación:</b> ${escapeHtml(String(p.location || "").trim() || "—")}</div>
        <div><b>Relación:</b> ${escapeHtml(relationshipLabel(p.relationship))} · <b>Nombre (relación):</b> ${escapeHtml(String(p.relatedName || "").trim() || "—")}</div>
        <div><b>Enviado por:</b> ${escapeHtml(String(req.requester_name || "").trim() || "—")} · <b>Fecha:</b> ${escapeHtml(created)}</div>
        ${req.notes ? `<div><b>Notas:</b> ${escapeHtml(String(req.notes))}</div>` : ""}
        ${thumbs}
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
      const { error } = await sb.rpc("approve_request", { req_id: id });
      if (error) {
        btn.disabled = false;
        alert(error.message || "No se pudo aprobar.");
        return;
      }
      const card = list.querySelector(`[data-req="${id}"]`);
      if (card) card.remove();
      if (!list.querySelector("[data-req]")) {
        list.innerHTML = `<div class="card"><div class="card__title">Sin solicitudes</div><div class="card__meta">No hay pendientes.</div></div>`;
      }
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
