/* eslint-disable no-alert */
const STORAGE_KEY = "family_tree_familia_v5";
const DEFAULT_CENTER_ON_LOAD = true;

/** Móvil táctil: 1er toque en persona con linaje = resaltar; 2º toque en la misma = abrir perfil */
let mobileTreeLineagePrimeId = null;

function treeIsCoarsePointer() {
  return window.matchMedia("(hover: none) and (pointer: coarse)").matches;
}

let treeLineageOutsideClickBound = false;
function bindTreeLineageOutsideClickOnce() {
  if (treeLineageOutsideClickBound) return;
  treeLineageOutsideClickBound = true;
  document.addEventListener(
    "click",
    (e) => {
      if (!treeIsCoarsePointer()) return;
      const vp = document.getElementById("treeViewport");
      if (!vp || vp.contains(e.target)) return;
      mobileTreeLineagePrimeId = null;
      const c = document.getElementById("treeCanvas");
      if (c && typeof c._clearLineageFocus === "function") c._clearLineageFocus();
    },
    true,
  );
}
/** Línea “hijo de afecto” (trazo discontinuo; tono distinto al de sangre) */
const PUTATIVE_EDGE_STROKE = "rgba(230, 188, 118, 0.92)";
const ENABLE_NODE_DRAG = false;
let sb = null;

function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

function formatDate(iso) {
  if (!iso) return "—";
  try {
    const [y, m, d] = iso.split("-").map((x) => Number(x));
    if (!y || !m || !d) return iso;
    return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
  } catch {
    return iso;
  }
}

function safeText(s) {
  return String(s ?? "").trim();
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

function isSafePhotoUrl(url) {
  const u = String(url || "");
  return u.startsWith("data:image/") || u.startsWith("https://") || u.startsWith("http://");
}

/** Miniaturas para tarjetas de solicitud (máx. 5). */
function requestPhotosThumbsHtml(photos) {
  const arr = (Array.isArray(photos) ? photos : []).filter((u) => isSafePhotoUrl(u)).slice(0, 5);
  if (!arr.length) return "";
  const imgs = arr
    .map((url) => `<img class="requestCard__thumb" src="${escapeHtml(url)}" alt="" loading="lazy" />`)
    .join("");
  return `<div class="requestCard__photos" role="group" aria-label="Fotos adjuntas">${imgs}</div>`;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve("");
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function defaultState() {
  // Base: Carmelo Uzcátegui (Nono) + Albina Mora (Nona)
  // - 12 hijos con nombres reales + nietos por rama
  // - hijo de afecto: sale del lado del hijo (ver leyenda en index)
  const nono = {
    id: "p_nono",
    firstName: "Carmen Antonio (Carmelo)",
    lastName: "Uzcátegui",
    birthDate: "",
    isAlive: false,
    deathDate: "",
    location: "",
    photos: [],
    email: "",
    instagram: "",
    tiktok: "",
  };
  const nona = {
    id: "p_nona",
    firstName: "Albina",
    lastName: "Mora",
    birthDate: "",
    isAlive: false,
    deathDate: "",
    location: "",
    photos: [],
    email: "",
    instagram: "",
    tiktok: "",
  };

  const peopleById = {
    [nono.id]: nono,
    [nona.id]: nona,
  };
  const rootCoupleId = "v_couple_root";
  const couplesById = {
    [rootCoupleId]: { a: nono.id, b: nona.id },
  };

  const childrenByParentId = {
    [rootCoupleId]: [],
  };

  const lineageColorById = {};
  // Paleta más viva (mejor contraste entre linajes)
  const palette = [
    "#14b8a6",
    "#22c55e",
    "#eab308",
    "#f97316",
    "#ec4899",
    "#6366f1",
    "#06b6d4",
    "#a855f7",
    "#ef4444",
    "#3b82f6",
    "#84cc16",
    "#f43f5e",
  ];

  function addPerson(id, firstName, lastName, opts = {}) {
    peopleById[id] = {
      id,
      firstName,
      lastName,
      birthDate: "",
      isAlive: opts.isAlive !== false,
      deathDate: opts.deathDate || "",
      location: "",
      photos: [],
      email: "",
      instagram: "",
      tiktok: "",
      putative: Boolean(opts.putative),
      spouseId: opts.spouseId || "",
    };
  }

  const hijos = [
    { firstName: "Teodulfo Antonio", lastName: "Uzcátegui Mora", isAlive: false, grandchildren: [] },
    { firstName: "Luis Eudoro", lastName: "Uzcátegui Mora", isAlive: true, grandchildren: [] },
    {
      firstName: "José Ricardo",
      lastName: "Uzcátegui Mora",
      isAlive: true,
      grandchildren: ["Eddy", "Ricardo", "Freddy", "Gerson", "Ender", "Nubia"],
    },
    {
      firstName: "Alida Cecilia",
      lastName: "Uzcátegui Mora",
      isAlive: true,
      grandchildren: ["Yadelsy Mariana", "Alexander José"],
    },
    {
      firstName: "Ana Edita",
      lastName: "Uzcátegui Mora",
      isAlive: true,
      grandchildren: ["Francisco Javier", "Luisana Priscila", "Anyi Gustavo", "César David", "Antony José"],
    },
    {
      firstName: "Eudes Marino",
      lastName: "Uzcátegui Mora",
      isAlive: true,
      grandchildren: ["Wilmer", "Richar", "Karina", "Yilver"],
    },
    {
      firstName: "Carmen Alicia",
      lastName: "Uzcátegui Mora",
      isAlive: true,
      grandchildren: ["Carlos Eduardo", "Carmen Abileny"],
    },
    {
      firstName: "Tarcisio de la Cruz",
      lastName: "Uzcátegui Mora",
      isAlive: true,
      grandchildren: ["Flor María", "Jhon David", "Marcos"],
    },
    {
      firstName: "Rosa Emilda",
      lastName: "Uzcátegui Mora",
      isAlive: true,
      grandchildren: ["Daniel Alfredo", "José Gregorio"],
    },
    {
      firstName: "Daniel Alfredo",
      lastName: "Uzcátegui Mora",
      isAlive: true,
      grandchildren: ["Jesús", "Fabiana Carolina", "Anthony"],
    },
    {
      firstName: "Olga María",
      lastName: "Uzcátegui Mora",
      isAlive: true,
      grandchildren: [
        { name: "Samuel Dario A." },
        { name: "Gerardo José" },
        { name: "Rosa Emilia", putative: true },
      ],
    },
    {
      firstName: "Carlos Alfonso",
      lastName: "Uzcátegui Mora",
      isAlive: true,
      grandchildren: ["Samuel", "Génesis", "Nicol"],
    },
  ];

  const sinConyuge = new Set([1, 2, 4]); // Teodulfo, Luis Eudoro, Alida Cecilia
  const rotuloConyuge = ["Cónyuge", "Pareja", "Papá"];
  let idxConyuge = 0;

  for (let i = 0; i < hijos.length; i += 1) {
    const hi = i + 1;
    const childId = `p_h${hi}`;
    addPerson(childId, hijos[i].firstName, hijos[i].lastName, {
      isAlive: hijos[i].isAlive,
      deathDate: hijos[i].isAlive ? "" : (hijos[i].deathDate || ""),
    });

    const coupleId = `v_couple_h${hi}`;
    if (sinConyuge.has(hi)) {
      couplesById[coupleId] = { a: childId, b: null };
    } else {
      const spouseId = `p_h${hi}_s`;
      const etiqueta = rotuloConyuge[idxConyuge % rotuloConyuge.length];
      idxConyuge += 1;
      addPerson(spouseId, etiqueta, "—");
      couplesById[coupleId] = { a: childId, b: spouseId };
    }
    lineageColorById[coupleId] = palette[i % palette.length];
    childrenByParentId[coupleId] = [];
    childrenByParentId[rootCoupleId].push(coupleId);

    const grands = hijos[i].grandchildren || [];
    for (let j = 0; j < grands.length; j += 1) {
      const g = grands[j];
      const nm = typeof g === "string" ? g : g?.name;
      const put = typeof g === "object" && g ? Boolean(g.putative) : false;
      const grandId = `p_h${hi}_c${j + 1}`;
      // Correcciones puntuales de nombres + caso especial con bisnietos.
      if (safeText(nm) === "Daniel Alfredo") {
        addPerson(grandId, "Daniel Alberto", "Moreno Uzcátegui", { putative: put });
      } else if (safeText(nm) === "José Gregorio" || safeText(nm) === "Jose Gregorio") {
        addPerson(grandId, "José Gregorio", "Moreno Uzcátegui", { putative: put });

        // Pareja al lado (placeholder) + hijo en nuevo nivel (bisnietos).
        const spouseId = `${grandId}_s`;
        addPerson(spouseId, "Pareja", "—");
        peopleById[grandId].spouseId = spouseId;

        const bisnietoId = `${grandId}_c1`;
        addPerson(bisnietoId, "Liam Gabriel", "Moreno Roa");
        childrenByParentId[grandId] = [bisnietoId];
      } else {
        addPerson(grandId, nm || "—", "Uzcátegui", { putative: put });
      }
      childrenByParentId[coupleId].push(grandId);
    }
  }

  return {
    zoom: 0.7,
    peopleById,
    // Relación simple para el prototipo: parentId -> childIds
    childrenByParentId,
    couplesById,
    lineageColorById,
    roots: [rootCoupleId],
    nodeOffsets: {},
    requests: [],
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    // merge defensivo con defaults
    const merged = {
      ...defaultState(),
      ...parsed,
      peopleById: { ...defaultState().peopleById, ...(parsed.peopleById || {}) },
      childrenByParentId: { ...defaultState().childrenByParentId, ...(parsed.childrenByParentId || {}) },
      roots: Array.isArray(parsed.roots) ? parsed.roots : defaultState().roots,
      requests: Array.isArray(parsed.requests)
        ? parsed.requests.filter((r) => String(r.status || "pending") === "pending")
        : defaultState().requests,
      couplesById: { ...defaultState().couplesById, ...(parsed.couplesById || {}) },
      lineageColorById: { ...defaultState().lineageColorById, ...(parsed.lineageColorById || {}) },
      nodeOffsets: { ...defaultState().nodeOffsets, ...(parsed.nodeOffsets || {}) },
    };
    applyHardcodedMigrations(merged);
    return merged;
  } catch {
    return defaultState();
  }
}

function applyHardcodedMigrations(nextState) {
  // Mantiene el árbol “fijo” aunque exista estado guardado de versiones previas.
  if (!nextState || !nextState.peopleById) return;
  const p = nextState.peopleById;
  const kidsMap = nextState.childrenByParentId || {};

  // Rama de Rosa Emilda: v_couple_h9 (ver defaultState: orden de hijos).
  const rosaCoupleId = "v_couple_h9";
  const rosaKids = (kidsMap[rosaCoupleId] || []).filter((id) => p[id]);
  const parentByChild = buildParentMap(kidsMap);

  for (const id of rosaKids) {
    const person = p[id];
    if (!person) continue;
    const fn = safeText(person.firstName);
    const ln = safeText(person.lastName);

    // Daniel Alfredo -> Daniel Alberto Moreno Uzcátegui
    if (fn === "Daniel Alfredo" && /uzc/i.test(ln)) {
      person.firstName = "Daniel Alberto";
      person.lastName = "Moreno Uzcátegui";
    }

    // José Gregorio -> José Gregorio Moreno Uzcátegui + pareja + bisnieto
    if ((fn === "José Gregorio" || fn === "Jose Gregorio") && /uzc/i.test(ln)) {
      person.firstName = "José Gregorio";
      person.lastName = "Moreno Uzcátegui";

      // Pareja al lado (placeholder)
      const spouseId = safeText(person.spouseId) || `${id}_s`;
      person.spouseId = spouseId;
      if (!p[spouseId]) {
        p[spouseId] = {
          id: spouseId,
          firstName: "Pareja",
          lastName: "—",
          birthDate: "",
          isAlive: true,
          deathDate: "",
          location: "",
          photos: [],
          email: "",
          instagram: "",
          tiktok: "",
          putative: false,
          spouseId: "",
        };
      }

      // Bisnieto: Liam Gabriel Moreno Roa (nuevo nivel)
      const bisId = `${id}_c1`;
      if (!p[bisId]) {
        p[bisId] = {
          id: bisId,
          firstName: "Liam Gabriel",
          lastName: "Moreno Roa",
          birthDate: "",
          isAlive: true,
          deathDate: "",
          location: "",
          photos: [],
          email: "",
          instagram: "",
          tiktok: "",
          putative: false,
          spouseId: "",
        };
      }
      const arr = Array.isArray(kidsMap[id]) ? kidsMap[id] : [];
      if (!arr.includes(bisId)) kidsMap[id] = [...arr, bisId];
    }
  }

  // Limpieza: si por alguna razón alguien quedó colgando sin padre, no hacemos nada destructivo.
  void parentByChild;

  // Olga María: actualizar Samuel Dario Abraham Galviz Uzcategui (nieto) con datos de contacto.
  const olgaCoupleId = "v_couple_h11";
  for (const id of (kidsMap[olgaCoupleId] || []).filter((x) => p[x])) {
    const person = p[id];
    const fn = safeText(person?.firstName);
    if (!person) continue;
    if (fn === "Samuel Dario A." || fn === "Samuel Dario Abraham") {
      person.firstName = "Samuel Dario Abraham";
      person.lastName = "Galviz Uzcategui";
      person.birthDate = "1989-10-07";
      person.isAlive = true;
      person.deathDate = "";
      person.location = "New York, Estados Unidos";
      person.email = "samuel.galviz@gmail.com";
      person.instagram = "drsamuelgalviz";
      person.tiktok = "";
    }
  }

  // Carmen Alicia: actualizar Carmen Abileny Pulido Uzcategui con datos.
  const carmenAliciaCoupleId = "v_couple_h7";
  for (const id of (kidsMap[carmenAliciaCoupleId] || []).filter((x) => p[x])) {
    const person = p[id];
    if (!person) continue;
    if (safeText(person.firstName) === "Carmen Abileny") {
      person.lastName = "Pulido Uzcategui";
      person.birthDate = "1989-08-14";
      person.isAlive = true;
      person.deathDate = "";
      person.location = "Alaska, Estados Unidos";
      person.email = "abypulido24@gmail.com";
      person.instagram = "@carmenabileny";
      person.tiktok = "@carmen.abileny";
    }
  }

  // Eudes Marino (h6): bisnietos para Wilmer y Karina + pareja de Karina.
  const eudesCoupleId = "v_couple_h6";
  const eudesKids = (kidsMap[eudesCoupleId] || []).filter((x) => p[x]);
  const wilmerId = eudesKids.find((id) => safeText(p[id]?.firstName) === "Wilmer");
  const karinaId = eudesKids.find((id) => safeText(p[id]?.firstName) === "Karina");

  if (wilmerId) {
    const wilmaryId = `${wilmerId}_c1`;
    if (!p[wilmaryId]) {
      p[wilmaryId] = {
        id: wilmaryId,
        firstName: "Wilmary Analía",
        lastName: "Uzcátegui Mora",
        birthDate: "2016-05-16",
        isAlive: true,
        deathDate: "",
        location: "Venezuela",
        photos: [],
        email: "",
        instagram: "",
        tiktok: "",
        putative: false,
        spouseId: "",
      };
    }
    const arr = Array.isArray(kidsMap[wilmerId]) ? kidsMap[wilmerId] : [];
    if (!arr.includes(wilmaryId)) kidsMap[wilmerId] = [...arr, wilmaryId];
  }

  if (karinaId) {
    const spouseId = safeText(p[karinaId]?.spouseId) || `${karinaId}_s`;
    p[karinaId].spouseId = spouseId;
    if (!p[spouseId]) {
      p[spouseId] = {
        id: spouseId,
        firstName: "Pareja",
        lastName: "—",
        birthDate: "",
        isAlive: true,
        deathDate: "",
        location: "",
        photos: [],
        email: "",
        instagram: "",
        tiktok: "",
        putative: false,
        spouseId: "",
      };
    }

    const valeryId = `${karinaId}_c1`;
    if (!p[valeryId]) {
      p[valeryId] = {
        id: valeryId,
        firstName: "Valery Katherina",
        lastName: "Arambula Uzcategui",
        birthDate: "2010-11-22",
        isAlive: true,
        deathDate: "",
        location: "Concepción Chile",
        photos: [],
        email: "",
        instagram: "",
        tiktok: "",
        putative: false,
        spouseId: "",
      };
    }
    const arr = Array.isArray(kidsMap[karinaId]) ? kidsMap[karinaId] : [];
    if (!arr.includes(valeryId)) kidsMap[karinaId] = [...arr, valeryId];
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function normalizePersonPhotos(person) {
  if (!person) return person;
  // compatibilidad con versiones previas
  const legacy = person.photo ? [person.photo] : [];
  const photos = Array.isArray(person.photos) ? person.photos : legacy;
  return {
    email: "",
    instagram: "",
    tiktok: "",
    ...person,
    photos: photos.filter(Boolean).slice(0, 5),
    putative: Boolean(person.putative),
  };
}

function applyAddPerson(req) {
  const p = req.payload || {};
  const newId = uid("p");
  const person = {
    id: newId,
    firstName: safeText(p.firstName),
    lastName: safeText(p.lastName),
    birthDate: p.birthDate || "",
    isAlive: Boolean(p.isAlive),
    deathDate: p.isAlive ? "" : (p.deathDate || ""),
    location: safeText(p.location),
    photos: (Array.isArray(p.photos) ? p.photos.filter(Boolean) : (p.photo ? [p.photo] : [])).slice(0, 5),
    email: safeText(p.email),
    instagram: safeText(p.instagram),
    tiktok: safeText(p.tiktok),
  };
  state.peopleById[newId] = person;
  // Ubicación por relación (best-effort en frontend)
  const rel = String(p.relationship || "");
  const relatedName = safeText(p.relatedName || "");
  const relatedId = relatedName ? findPersonIdByName(relatedName) : "";
  const relatedCoupleId = relatedId ? findCoupleIdByMember(relatedId) : "";

  if (rel === "child_of" && (relatedCoupleId || relatedId)) {
    const parentKey = relatedCoupleId || relatedId;
    const arr = state.childrenByParentId[parentKey] || [];
    state.childrenByParentId[parentKey] = [...arr, newId];
    return;
  }
  if (rel === "parent_of" && relatedId) {
    const arr = state.childrenByParentId[newId] || [];
    state.childrenByParentId[newId] = arr;
    const kids = state.childrenByParentId[newId] || [];
    if (!kids.includes(relatedId)) state.childrenByParentId[newId] = [...kids, relatedId];
    return;
  }
  if (rel === "sibling_of" && relatedId) {
    // comparte los mismos padres encontrados
    const parentIds = Object.entries(state.childrenByParentId || {})
      .filter(([, kids]) => (kids || []).includes(relatedId))
      .map(([pid]) => pid);
    for (const pid of parentIds) {
      const arr = state.childrenByParentId[pid] || [];
      if (!arr.includes(newId)) state.childrenByParentId[pid] = [...arr, newId];
    }
    if (parentIds.length) return;
  }
  if (rel === "other") {
    state.roots = [...new Set([...(state.roots || []), newId])];
    return;
  }
  // spouse_of: por ahora no cambia el gráfico (se modelará mejor con backend)
  state.roots = [...new Set([...(state.roots || []), newId])];
}

function applyEditPerson(req) {
  const p = req.payload || {};
  const fullName = `${safeText(p.firstName)} ${safeText(p.lastName)}`.trim();
  const legacy = safeText(p.objectiveName || "");
  const id = findPersonIdByName(fullName) || (legacy ? findPersonIdByName(legacy) : "");
  if (!id || !state.peopleById[id]) return;
  const prev = normalizePersonPhotos(state.peopleById[id]);
  const nextPhotos = (Array.isArray(p.photos) ? p.photos.filter(Boolean) : prev.photos).slice(0, 5);
  state.peopleById[id] = {
    ...prev,
    firstName: safeText(p.firstName),
    lastName: safeText(p.lastName),
    birthDate: p.birthDate || "",
    isAlive: Boolean(p.isAlive),
    deathDate: p.isAlive ? "" : (p.deathDate || ""),
    location: safeText(p.location),
    photos: nextPhotos,
    email: safeText(p.email) || prev.email || "",
    instagram: safeText(p.instagram) || prev.instagram || "",
    tiktok: safeText(p.tiktok) || prev.tiktok || "",
  };
}

function normalizePeople() {
  for (const [id, p] of Object.entries(state.peopleById || {})) {
    state.peopleById[id] = normalizePersonPhotos(p);
  }
}

function findCoupleIdByMember(personId) {
  for (const [cid, c] of Object.entries(state.couplesById || {})) {
    if (c?.a === personId || (c?.b != null && c.b === personId)) return cid;
  }
  return "";
}

/** Linaje hijo+nietos (v_couple_hN); vacío en abuelos raíz. */
function lineageKeyForPerson(personId) {
  if (!personId || personId === "p_nono" || personId === "p_nona") return "";
  const pc = buildParentMap(state.childrenByParentId || {});
  let cur = pc[personId];
  while (cur) {
    if (String(cur).startsWith("v_couple_h")) return cur;
    cur = pc[cur];
  }
  const cid = findCoupleIdByMember(personId);
  if (cid && String(cid).startsWith("v_couple_h")) return cid;
  return "";
}

function findPersonIdByName(fullName) {
  const q = safeText(fullName).toLowerCase();
  if (!q) return "";
  const entries = Object.entries(state.peopleById || {});
  for (const [id, p] of entries) {
    const name = `${safeText(p.firstName)} ${safeText(p.lastName)}`.trim().toLowerCase();
    if (name === q) return id;
  }
  return "";
}

function descendantsOf(rootId, visited = new Set()) {
  if (visited.has(rootId)) return [];
  visited.add(rootId);
  const kids = state.childrenByParentId[rootId] || [];
  const all = [...kids];
  for (const k of kids) all.push(...descendantsOf(k, visited));
  return all;
}

function buildForest() {
  // En este prototipo, dibujamos desde las raíces (abuelos) hacia abajo.
  const roots = (state.roots || []).filter((id) => state.peopleById[id]);
  return roots.map((id) => buildSubtree(id, new Set()));
}

function buildSubtree(personId, pathSet) {
  if (pathSet.has(personId)) return { id: personId, children: [] };
  const nextPath = new Set(pathSet);
  nextPath.add(personId);
  const kids = (state.childrenByParentId[personId] || []).filter((id) => state.peopleById[id]);
  return { id: personId, children: kids.map((k) => buildSubtree(k, nextPath)) };
}

function layoutTree() {
  // Layout NUEVO (compacto y estable):
  // - Pareja raíz -> 12 ramas (hijo, opcional cónyuge) -> nietos en 3 bandas (4+4+4)
  const nodeW = 190;
  const nodeH = 66;
  const spouseW = 120;
  const spouseH = 52;
  const overlap = 28; // cuánto se sobrepone el cónyuge sobre el hijo (menos para no tapar nombres)
  const coupleW = nodeW + spouseW - overlap;
  const gapX = 34;
  const rootSpouseGap = 12;
  const rootCoupleW = nodeW * 2 + rootSpouseGap;
  const gapY1 = 126; // raíz -> hijos (más aire para líneas)
  const gapY2 = 72; // hijos -> nietos (más aire para líneas)
  const positions = new Map(); // id -> {x,y}
  const edges = []; // {from,to,color,isSpouse?, lineage?, isPutative?}

  const rootId = (state.roots || [])[0];
  const rootCouple = rootId ? (state.couplesById || {})[rootId] : null;
  if (!rootId || !rootCouple) {
    return { positions, edges, width: 600, height: 420, nodeW, nodeH };
  }

  const childCoupleIds = (state.childrenByParentId[rootId] || []).filter((cid) => (state.couplesById || {})[cid]);
  const levelStep = 112; // distancia vertical entre alturas de hijos (pirámide)

  // Raíz centrada
  const rootY = 14;
  const rootA = rootCouple.a;
  const rootB = rootCouple.b;

  function withAlpha(hex, alpha) {
    const h = String(hex || "").replace("#", "").trim();
    if (h.length !== 6) return "rgba(180, 200, 230, 0.18)";
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function coupleSlotW(cid) {
    const c = (state.couplesById || {})[cid];
    if (!c?.a) return coupleW;
    return c.b ? coupleW : nodeW;
  }

  function rowWidthFor(ids) {
    if (!ids.length) return 0;
    return ids.reduce((acc, idci, i) => acc + coupleSlotW(idci) + (i < ids.length - 1 ? gapX : 0), 0);
  }

  function rowXsFor(ids, startX) {
    let cur = startX;
    return ids.map((idci) => {
      const xa = cur;
      cur += coupleSlotW(idci) + gapX;
      return xa;
    });
  }

  function rowCenterAndWidth(xs, ids) {
    if (!ids.length) return { minX: 0, maxX: 0, center: 0 };
    let minX = Infinity;
    let maxX = -Infinity;
    ids.forEach((idci, i) => {
      const xa = xs[i];
      const w = coupleSlotW(idci);
      minX = Math.min(minX, xa);
      maxX = Math.max(maxX, xa + w);
    });
    return { minX, maxX, center: (minX + maxX) / 2 };
  }

  // Orden estable por número de hijo: v_couple_h1..v_couple_h12
  const sortedChildCouples = [...childCoupleIds].sort((a, b) => {
    const na = Number(String(a).match(/h(\d+)/)?.[1] || 0);
    const nb = Number(String(b).match(/h(\d+)/)?.[1] || 0);
    return na - nb;
  });

  // Pirámide: H1–H2 arriba, H3–H6 medio, H7–H12 base (anchos variables si no hay cónyuge)
  const level2 = sortedChildCouples.slice(0, 2);
  const level1 = sortedChildCouples.slice(2, 6);
  const level0 = sortedChildCouples.slice(6, 12);

  const baseY2 = rootY + gapY1 + 0 * levelStep; // superior
  const baseY1 = rootY + gapY1 + 1 * levelStep; // medio
  const baseY0 = rootY + gapY1 + 2 * levelStep; // inferior

  const level0W = rowWidthFor(level0);
  const contentW = Math.max(rootCoupleW + 48, level0W + 120, 760);
  const level0X0 = (contentW - level0W) / 2;
  const x0 = rowXsFor(level0, level0X0);

  const level1W = rowWidthFor(level1);
  const level1X0 = level0X0 + (level0W - level1W) / 2;
  const x1 = rowXsFor(level1, level1X0);

  const level2W = rowWidthFor(level2);
  const level2X0 = level0X0 + (level0W - level2W) / 2;
  const x2 = rowXsFor(level2, level2X0);

  const b0 = rowCenterAndWidth(x0, level0);
  const b1raw = rowCenterAndWidth(x1, level1);
  const shift1 = b0.center - b1raw.center;
  const x1c = x1.map((v) => v + shift1);

  const b1 = rowCenterAndWidth(x1c, level1);
  const b2raw = rowCenterAndWidth(x2, level2);
  const shift2 = b1.center - b2raw.center;
  const x2c = x2.map((v) => v + shift2);

  // Raíz centrada respecto a toda la pirámide (base nivel 0)
  const rootCenterX = b0.center;
  const rootLeftX = rootCenterX - rootCoupleW / 2;

  positions.set(rootA, { x: rootLeftX, y: rootY });
  positions.set(rootB, { x: rootLeftX + nodeW + rootSpouseGap, y: rootY });
  positions.set(rootId, { x: rootLeftX + (rootCoupleW / 2) - (nodeW / 2), y: rootY });
  edges.push({
    from: rootA,
    to: rootB,
    color: "rgba(255,255,255,0.16)",
    isSpouse: true,
    lineage: "__root__",
  });

  const couplePos = new Map(); // coupleId -> {x,y}
  level0.forEach((cid, i) => couplePos.set(cid, { x: x0[i], y: baseY0 }));
  level1.forEach((cid, i) => couplePos.set(cid, { x: x1c[i], y: baseY1 }));
  level2.forEach((cid, i) => couplePos.set(cid, { x: x2c[i], y: baseY2 }));

  // Coloca parejas y conecta (primera pasada: hijos)
  const pendingGrandkids = [];
  for (const cid of sortedChildCouples) {
    const couple = (state.couplesById || {})[cid];
    const pos = couplePos.get(cid);
    if (!couple || !pos) continue;
    const x = pos.x;
    const y = pos.y;
    const slotW = coupleSlotW(cid);

    positions.set(couple.a, { x, y });
    if (couple.b) {
      positions.set(couple.b, { x: x + nodeW - overlap, y: y + 7 });
      positions.set(cid, { x: x + slotW / 2 - nodeW / 2, y });
      edges.push({
        from: couple.a,
        to: couple.b,
        color: "rgba(255,255,255,0.14)",
        isSpouse: true,
        lineage: cid,
      });
    } else {
      positions.set(cid, { x, y });
    }

    const lineHex = (state.lineageColorById || {})[cid];
    const color = withAlpha(lineHex, 0.82);
    edges.push({
      from: rootId,
      to: cid,
      color: withAlpha(lineHex, 0.38),
      lineage: cid,
    });

    // Nietos en segunda pasada: siempre por debajo de TODOS los hijos
    const kids = (state.childrenByParentId[cid] || []).filter((pid) => (state.peopleById || {})[pid]);
    pendingGrandkids.push({ cid, x, y, kids, color, slotW });
  }

  // Segunda pasada: nietos SIEMPRE debajo de todos los hijos (sin superposición con hijos)
  let childrenMaxBottom = 0;
  const childPeopleIds = [];
  for (const cid of sortedChildCouples) {
    const couple = state.couplesById?.[cid];
    if (!couple) continue;
    childPeopleIds.push(couple.a);
    if (couple.b) childPeopleIds.push(couple.b);
  }
  childPeopleIds.push(rootA, rootB);
  for (const pid of childPeopleIds) {
    const p = positions.get(pid);
    if (!p) continue;
    const isSpouse = String(pid).endsWith("_s") || safeText(state.peopleById?.[pid]?.lastName) === "—";
    const h = isSpouse ? spouseH : nodeH;
    childrenMaxBottom = Math.max(childrenMaxBottom, p.y + h);
  }

  const globalGrandTop = childrenMaxBottom + gapY2 + 26;
  const grandGapY = 18;
  const grandMinGapX = 18; // separación mínima entre nietos (evita superposición)
  const grandBandGapY = 40; // espacio entre las 3 filas de nietos (4+4+4)
  const grandColsPerRow = 6; // máx. nietos por fila bajo cada pareja

  function hasSpouseNode(pid) {
    const spouseId = safeText(state.peopleById?.[pid]?.spouseId);
    return Boolean(spouseId && state.peopleById?.[spouseId]);
  }

  function grandKidSlotW(pid) {
    return hasSpouseNode(pid) ? coupleW : nodeW;
  }

  function layoutGrandBlock(kids) {
    if (!kids.length) return { rows: [], blockW: 0, blockH: 0, rowH: nodeH + grandGapY };
    const rows = [];
    for (let i = 0; i < kids.length; i += grandColsPerRow) {
      rows.push(kids.slice(i, i + grandColsPerRow));
    }
    const rowH = nodeH + grandGapY;
    const rowWidths = rows.map((row) => {
      if (!row.length) return 0;
      return row.reduce((acc, pid, idx) => acc + grandKidSlotW(pid) + (idx < row.length - 1 ? grandMinGapX : 0), 0);
    });
    const blockW = Math.max(...rowWidths, nodeW);
    const blockH = rows.length * rowH - grandGapY;
    return { rows, blockW, blockH, rowH };
  }

  /**
   * Coloca nietos en una banda (varios por pareja, varias filas si hace falta).
   * Aristas: linaje normal desde el centro virtual de la pareja; putativo desde el hijo (couple.a), lado izquierdo.
   */
  function placeGrandBand(pairs, baseY) {
    let bandBottom = baseY;
    const blocks = [];
    for (const p of pairs) {
      const kids = (p.kids || []).filter((pid) => (state.peopleById || {})[pid]);
      const layout = layoutGrandBlock(kids);
      const slotW = p.slotW != null ? p.slotW : coupleW;
      const centerX = p.x + slotW / 2;
      blocks.push({
        fromCid: p.cid,
        centerX,
        kids,
        color: p.color,
        ...layout,
      });
    }

    blocks.sort((a, b) => a.centerX - b.centerX);

    let cursorRight = -Infinity;
    const placed = [];
    for (const b of blocks) {
      if (!b.rows.length) continue;
      let left = b.centerX - b.blockW / 2;
      left = Math.max(left, cursorRight + grandMinGapX);
      cursorRight = left + b.blockW;
      placed.push({ ...b, left });
    }

    if (placed.length) {
      const minX = Math.min(...placed.map((p) => p.left));
      const maxX = Math.max(...placed.map((p) => p.left + p.blockW));
      const center = (minX + maxX) / 2;
      const dx = b0.center - center;
      for (const p of placed) p.left += dx;
    }

    if (!placed.length) return bandBottom;

    for (const blk of placed) {
      let y = baseY;
      for (const row of blk.rows) {
        const rowW = row.reduce((acc, pid, idx) => acc + grandKidSlotW(pid) + (idx < row.length - 1 ? grandMinGapX : 0), 0);
        let x = blk.left + Math.max(0, (blk.blockW - rowW) / 2);
        for (const pid of row) {
          positions.set(pid, { x, y });
          const couple = (state.couplesById || {})[blk.fromCid];
          const hijoId = couple?.a;
          const isPut = Boolean(hijoId && state.peopleById?.[pid]?.putative);
          if (isPut && hijoId) {
            edges.push({
              from: hijoId,
              to: pid,
              color: PUTATIVE_EDGE_STROKE,
              isPutative: true,
              lineage: blk.fromCid,
            });
          } else {
            edges.push({ from: blk.fromCid, to: pid, color: blk.color, lineage: blk.fromCid });
          }
          x += grandKidSlotW(pid) + grandMinGapX;
        }
        y += blk.rowH;
      }
      bandBottom = Math.max(bandBottom, baseY + blk.blockH);
    }
    return bandBottom;
  }

  const band1 = pendingGrandkids.slice(0, 4);
  const band2 = pendingGrandkids.slice(4, 8);
  const band3 = pendingGrandkids.slice(8, 12);
  let nextGrandY = globalGrandTop;
  nextGrandY = placeGrandBand(band1, nextGrandY) + grandBandGapY;
  nextGrandY = placeGrandBand(band2, nextGrandY) + grandBandGapY;
  placeGrandBand(band3, nextGrandY);

  // Coloca pareja (si existe) para nietos específicos (p.ej. José Gregorio).
  for (const [pid, ppos] of positions.entries()) {
    if (String(pid).startsWith("v_")) continue;
    const spouseId = safeText(state.peopleById?.[pid]?.spouseId);
    if (!spouseId) continue;
    if (!state.peopleById?.[spouseId]) continue;
    if (positions.has(spouseId)) continue;
    positions.set(spouseId, { x: ppos.x + nodeW - overlap, y: ppos.y + 7 });
    edges.push({
      from: pid,
      to: spouseId,
      color: "rgba(255,255,255,0.14)",
      isSpouse: true,
      lineage: lineageKeyForPerson(pid) || "",
    });
  }

  // Centra el bloque completo de nietos respecto a la base (nivel 0)
  const grandIds = pendingGrandkids.flatMap((g) => g.kids);
  const placedGrand = grandIds.map((id) => positions.get(id)).filter(Boolean);
  if (placedGrand.length) {
    const minGX = Math.min(...placedGrand.map((p) => p.x));
    const maxGX = Math.max(...placedGrand.map((p) => p.x + nodeW));
    const gCenter = (minGX + maxGX) / 2;
    const targetCenter = b0.center; // centro de la base de la pirámide
    const dx = targetCenter - gCenter;
    if (Math.abs(dx) > 0.5) {
      for (const id of grandIds) {
        const p = positions.get(id);
        if (p) positions.set(id, { x: p.x + dx, y: p.y });
      }
    }
  }

  // Bisnietos: un nivel extra debajo de los nietos (solo si algún nieto tiene hijos).
  const greatBlocks = [];
  const lineageHexFor = (pid) => {
    const lk = lineageKeyForPerson(pid);
    return lk ? (state.lineageColorById?.[lk] || "") : "";
  };
  const greatMinGapX = 16;
  const greatGapY = 18;
  const greatColsPerRow = 6;
  const greatBandGapY = 48;

  function layoutGreatBlock(kids) {
    if (!kids.length) return { rows: [], blockW: 0, blockH: 0, rowH: nodeH + greatGapY };
    const rows = [];
    for (let i = 0; i < kids.length; i += greatColsPerRow) rows.push(kids.slice(i, i + greatColsPerRow));
    const rowH = nodeH + greatGapY;
    const rowWidths = rows.map((row) => row.length * nodeW + Math.max(0, row.length - 1) * greatMinGapX);
    const blockW = Math.max(...rowWidths, nodeW);
    const blockH = rows.length * rowH - greatGapY;
    return { rows, blockW, blockH, rowH };
  }

  let grandMaxBottom = 0;
  for (const gid of grandIds) {
    const gp = positions.get(gid);
    if (!gp) continue;
    grandMaxBottom = Math.max(grandMaxBottom, gp.y + nodeH);
    const spouseId = safeText(state.peopleById?.[gid]?.spouseId);
    if (spouseId && positions.has(spouseId)) grandMaxBottom = Math.max(grandMaxBottom, positions.get(spouseId).y + spouseH);
  }
  for (const pid of grandIds) {
    const parentPos = positions.get(pid);
    if (!parentPos) continue;
    const kids = (state.childrenByParentId?.[pid] || []).filter((id) => state.peopleById?.[id]);
    if (!kids.length) continue;
    const { rows, blockW, blockH, rowH } = layoutGreatBlock(kids);
    if (!rows.length) continue;
    const centerX = parentPos.x + nodeW / 2;
    const hex = lineageHexFor(pid);
    const color = hex ? withAlpha(hex, 0.78) : "rgba(235, 228, 214, 0.28)";
    greatBlocks.push({ pid, centerX, kids, rows, blockW, blockH, rowH, color });
  }

  if (greatBlocks.length) {
    greatBlocks.sort((a, b) => a.centerX - b.centerX);
    let cursorRight = -Infinity;
    const placed = [];
    for (const b of greatBlocks) {
      let left = b.centerX - b.blockW / 2;
      left = Math.max(left, cursorRight + greatMinGapX);
      cursorRight = left + b.blockW;
      placed.push({ ...b, left });
    }
    // recentra toda la banda respecto a la base
    const minXg = Math.min(...placed.map((p) => p.left));
    const maxXg = Math.max(...placed.map((p) => p.left + p.blockW));
    const center = (minXg + maxXg) / 2;
    const dx = b0.center - center;
    for (const p of placed) p.left += dx;

    const baseY = grandMaxBottom + 26; // más compacto: bisnietos más cerca de nietos
    let bandBottom = baseY;
    for (const blk of placed) {
      let y = baseY;
      for (const row of blk.rows) {
        const rowW = row.length * nodeW + Math.max(0, row.length - 1) * greatMinGapX;
        let x = blk.left + Math.max(0, (blk.blockW - rowW) / 2);
        for (const kidId of row) {
          positions.set(kidId, { x, y });
          edges.push({ from: blk.pid, to: kidId, color: blk.color, lineage: lineageKeyForPerson(blk.pid) || "" });
          x += nodeW + greatMinGapX;
        }
        y += blk.rowH;
      }
      bandBottom = Math.max(bandBottom, baseY + blk.blockH);
    }
    // (si en el futuro hay más niveles, usar bandBottom + greatBandGapY)
    void greatBandGapY;
  }

  // Normaliza X a 0..W
  const minX = Math.min(...[...positions.values()].map((p) => p.x), 0);
  if (minX !== 0) {
    for (const [id, p] of positions.entries()) positions.set(id, { x: p.x - minX, y: p.y });
  }

  const maxX = Math.max(
    ...[...positions.entries()].map(([id, p]) => p.x + (String(id).endsWith("_s") ? spouseW : nodeW)),
  );
  const maxY = Math.max(
    ...[...positions.entries()].map(([id, p]) => p.y + (String(id).endsWith("_s") ? spouseH : nodeH)),
  );
  const width = Math.max(520, maxX + 30);
  const height = Math.max(420, maxY + 50);

  return { positions, edges, width, height, nodeW, nodeH, spouseW, spouseH };
}

function buildForest2() {
  const roots = (state.roots || []).filter((id) => id && (state.peopleById[id] || (state.couplesById || {})[id]));
  return roots.map((id) => buildSubtree2(id, new Set()));
}

function buildSubtree2(nodeId, pathSet) {
  if (pathSet.has(nodeId)) return { id: nodeId, children: [] };
  const nextPath = new Set(pathSet);
  nextPath.add(nodeId);
  const kids = (state.childrenByParentId[nodeId] || []).filter((id) => id && (state.peopleById[id] || (state.couplesById || {})[id]));
  return { id: nodeId, children: kids.map((k) => buildSubtree2(k, nextPath)) };
}

function buildParentMap(childrenByParentId) {
  const parentByChild = {};
  for (const [pid, kids] of Object.entries(childrenByParentId || {})) {
    for (const kid of kids || []) {
      parentByChild[kid] = pid;
    }
  }
  return parentByChild;
}

function renderTree() {
  mobileTreeLineagePrimeId = null;
  const canvas = document.getElementById("treeCanvas");
  const viewport = document.getElementById("treeViewport");
  const { positions, edges, width, height, nodeW, nodeH, spouseW, spouseH } = layoutTree();
  const parentByChild = buildParentMap(state.childrenByParentId || {});

  canvas.style.minWidth = `${Math.ceil(width)}px`;
  canvas.style.width = `${Math.ceil(width)}px`;
  canvas.style.minHeight = `${Math.max(520, Math.ceil(height))}px`;
  canvas.style.transform = `scale(${state.zoom})`;

  // Centrado real: centra por scroll cuando hay overflow, y por márgenes cuando no hay.
  if (viewport) {
    const zoom = state.zoom || 1;
    const scaledW = width * zoom;
    const extra = Math.max(0, (viewport.clientWidth - scaledW) / 2);
    canvas.style.marginLeft = `${extra}px`;
    canvas.style.marginRight = `${extra}px`;
  }

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "treeSvg");
  svg.setAttribute("width", String(Math.ceil(width)));
  svg.setAttribute("height", String(Math.ceil(height)));
  svg.setAttribute("viewBox", `0 0 ${Math.ceil(width)} ${Math.ceil(height)}`);

  const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
  const grad = document.createElementNS("http://www.w3.org/2000/svg", "linearGradient");
  grad.setAttribute("id", "edgeGrad");
  grad.setAttribute("x1", "0");
  grad.setAttribute("y1", "0");
  grad.setAttribute("x2", "1");
  grad.setAttribute("y2", "1");
  const s1 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
  s1.setAttribute("offset", "0%");
  s1.setAttribute("stop-color", "rgba(121,168,255,0.9)");
  const s2 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
  s2.setAttribute("offset", "100%");
  s2.setAttribute("stop-color", "rgba(139,240,194,0.9)");
  grad.appendChild(s1);
  grad.appendChild(s2);
  defs.appendChild(grad);
  svg.appendChild(defs);

  const getPersonRenderBox = (pid) => {
    const base = positions.get(pid);
    if (!base) return null;
    const person = state.peopleById?.[pid];
    const isSpouse = String(pid).endsWith("_s") || safeText(person?.lastName) === "—";
    const w = isSpouse ? spouseW : nodeW;
    const h = isSpouse ? spouseH : nodeH;
    const off = (state.nodeOffsets && state.nodeOffsets[pid]) ? state.nodeOffsets[pid] : { dx: 0, dy: 0 };
    return { x: base.x + (Number(off.dx) || 0), y: base.y + (Number(off.dy) || 0), w, h };
  };

  const getVirtualAnchor = (vid) => {
    const couple = state.couplesById?.[vid];
    if (!couple) {
      const base = positions.get(vid);
      if (!base) return null;
      return { cx: base.x + nodeW / 2, top: base.y, bottom: base.y + nodeH };
    }
    const a = getPersonRenderBox(couple.a);
    if (!a) return null;
    if (!couple.b) {
      return { cx: a.x + a.w / 2, top: a.y, bottom: a.y + a.h };
    }
    const b = getPersonRenderBox(couple.b);
    if (!b) return null;
    const aCx = a.x + a.w / 2;
    const bCx = b.x + b.w / 2;
    const cx = (aCx + bCx) / 2;
    const top = Math.min(a.y, b.y);
    const bottom = Math.max(a.y + a.h, b.y + b.h);
    return { cx, top, bottom };
  };

  for (const e of edges) {
    const fromIsVirtual = String(e.from).startsWith("v_");
    const toIsVirtual = String(e.to).startsWith("v_");

    const fromAnchor = fromIsVirtual ? getVirtualAnchor(e.from) : null;
    const toAnchor = toIsVirtual ? getVirtualAnchor(e.to) : null;
    const fromBox = !fromIsVirtual ? getPersonRenderBox(e.from) : null;
    const toBox = !toIsVirtual ? getPersonRenderBox(e.to) : null;

    if ((fromIsVirtual && !fromAnchor) || (!fromIsVirtual && !fromBox)) continue;
    if ((toIsVirtual && !toAnchor) || (!toIsVirtual && !toBox)) continue;

    let x1 = fromIsVirtual ? fromAnchor.cx : (fromBox.x + fromBox.w / 2);
    let y1 = fromIsVirtual ? fromAnchor.bottom : (fromBox.y + fromBox.h);
    let x2 = toIsVirtual ? toAnchor.cx : (toBox.x + toBox.w / 2);
    let y2 = toIsVirtual ? toAnchor.top : (toBox.y);

    const midY = (y1 + y2) / 2;
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    let d = "";
    if (e.isSpouse) {
      const y = (fromBox ? (fromBox.y + 18) : (fromAnchor.top + 18));
      d = `M ${x1} ${y} C ${(x1 + x2) / 2} ${y - 10}, ${(x1 + x2) / 2} ${y + 10}, ${x2} ${y}`;
    } else if (e.isPutative && fromBox && toBox) {
      // Desde el costado del hijo (no del centro pareja–cónyuge)
      x1 = fromBox.x - 3;
      y1 = fromBox.y + fromBox.h * 0.42;
      x2 = toBox.x + toBox.w * 0.22;
      y2 = toBox.y + 4;
      const my = (y1 + y2) / 2;
      d = `M ${x1} ${y1} C ${x1 - 36} ${my}, ${x2 - 30} ${my}, ${x2} ${y2}`;
    } else {
      d = `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;
    }
    path.setAttribute("d", d);
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", e.color || "rgba(235, 228, 214, 0.28)");
    path.setAttribute("stroke-width", e.isSpouse ? "2.2" : (e.isPutative ? "2.35" : "2.2"));
    path.setAttribute("opacity", e.isSpouse ? "0.34" : (e.isPutative ? "0.88" : "0.70"));
    if (e.isPutative) path.setAttribute("stroke-dasharray", "9 6");
    path.classList.add("treeEdge");
    if (e.lineage) path.setAttribute("data-lineage", e.lineage);
    svg.appendChild(path);
  }

  // Limpia y renderiza
  canvas.innerHTML = "";
  canvas.appendChild(svg);

  // Nodos
  let renderedCount = 0;
  const spouseOwnerById = {};
  for (const [pid, pp] of Object.entries(state.peopleById || {})) {
    const sid = safeText(pp?.spouseId);
    if (sid) spouseOwnerById[sid] = pid;
  }

  function lineageForNodeId(nodeId) {
    const person = state.peopleById?.[nodeId];
    const isSpouse = String(nodeId).endsWith("_s") || safeText(person?.lastName) === "—";
    const ownerId = isSpouse ? (spouseOwnerById[nodeId] || "") : "";
    return lineageKeyForPerson(ownerId || nodeId);
  }
  for (const [id, p] of positions.entries()) {
    if (String(id).startsWith("v_")) continue; // nodos virtuales no se renderizan
    const person = normalizePersonPhotos(state.peopleById[id]);
    if (!person) continue;
    const node = document.createElement("div");
    const isSpouse = String(id).endsWith("_s") || safeText(person.lastName) === "—";
    const putCls = person.putative ? " node--afecto" : "";
    node.className = isSpouse ? "node node--spouse" : `node${putCls}`;
    const off = (state.nodeOffsets && state.nodeOffsets[id]) ? state.nodeOffsets[id] : { dx: 0, dy: 0 };
    node.style.left = `${p.x + (Number(off.dx) || 0)}px`;
    node.style.top = `${p.y + (Number(off.dy) || 0)}px`;
    node.dataset.personId = id;

    // Borde por linaje:
    // - cualquier descendiente: se calcula subiendo hasta v_couple_hN
    // - nodos de pareja manual (id *_s o lastName "—"): heredan del titular
    const ownerId = isSpouse ? (spouseOwnerById[id] || "") : "";
    const lineageCoupleId = lineageKeyForPerson(ownerId || id);
    const lineageHex = lineageCoupleId ? state.lineageColorById?.[lineageCoupleId] : "";
    if (lineageHex) {
      node.style.borderColor = `${lineageHex}B3`; // ~70% alpha
      node.style.boxShadow = `0 16px 34px rgba(0,0,0,0.32), 0 0 0 1px ${lineageHex}33`;
    }

    const firstName = safeText(person.firstName);
    const lastName = safeText(person.lastName);
    const badgeText = person.isAlive ? "Vivo" : "Fallecido";
    const badgeClass = person.isAlive ? "badge badge--alive" : "badge badge--deceased";
    const mainPhoto = (person.photos || [])[0] || "";
    const avatar = mainPhoto
      ? `<div class="avatar" data-open-photos="true" title="Ver fotos"><img src="${mainPhoto}" alt="Foto" /></div>`
      : `<div class="avatar avatar--empty" aria-hidden="true"></div>`;

    node.innerHTML = `
      <div class="node__head">
        ${avatar}
        <div class="node__title">
          <div class="node__first">${firstName || "Sin nombre"}</div>
          <div class="node__last">${lastName || ""}</div>
        </div>
      </div>
      <div class="node__status">
        <span class="${badgeClass}">${badgeText}</span>
      </div>
    `;
    canvas.appendChild(node);
    renderedCount += 1;

    if (mainPhoto) {
      const av = node.querySelector('[data-open-photos="true"]');
      if (av) {
        av.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          openProfileModal(id);
        });
      }
    }

    node.addEventListener("click", (e) => {
      const target = e.target;
      if (target && target.closest && target.closest("[data-open-photos='true']")) return;
      const lkNode = lineageForNodeId(id);
      if (treeIsCoarsePointer() && lkNode) {
        if (mobileTreeLineagePrimeId === id) {
          mobileTreeLineagePrimeId = null;
          clearLineageFocus();
          openProfileModal(id);
        } else {
          mobileTreeLineagePrimeId = id;
          clearTimeout(clearHoverT);
          setLineageFocus(lkNode);
        }
        return;
      }
      mobileTreeLineagePrimeId = null;
      openProfileModal(id);
    });

    // Arrastrar sigue disponible, pero con el nuevo layout ya queda ordenado de base.
    if (ENABLE_NODE_DRAG) enableDragForNode(node, id, p);
  }

  const paths = [...svg.querySelectorAll("path.treeEdge")];
  let clearHoverT = 0;
  function clearLineageFocus() {
    canvas.classList.remove("treeCanvas--lineageFocus");
    for (const pth of paths) {
      pth.classList.remove("treeEdge--focus", "treeEdge--dim");
    }
    canvas.querySelectorAll(".node").forEach((n) => {
      n.classList.remove("node--lineageFocus", "node--lineageDim");
    });
  }
  function setLineageFocus(lineage) {
    clearLineageFocus();
    if (!lineage) return;
    canvas.classList.add("treeCanvas--lineageFocus");
    for (const pth of paths) {
      const dl = pth.getAttribute("data-lineage") || "";
      if (dl === lineage) pth.classList.add("treeEdge--focus");
      else pth.classList.add("treeEdge--dim");
    }
    canvas.querySelectorAll(".node").forEach((n) => {
      const nl = n.dataset.lineage || "";
      if (nl === lineage) n.classList.add("node--lineageFocus");
      else if (nl) n.classList.add("node--lineageDim");
    });
  }
  function scheduleClearLineageFocus() {
    clearTimeout(clearHoverT);
    clearHoverT = window.setTimeout(() => clearLineageFocus(), 42);
  }
  for (const n of canvas.querySelectorAll(".node")) {
    const pid = n.dataset.personId || "";
    const lk = lineageForNodeId(pid);
    n.dataset.lineage = lk;
    if (!lk) continue;
    if (!treeIsCoarsePointer()) {
      n.addEventListener("mouseenter", () => {
        clearTimeout(clearHoverT);
        setLineageFocus(lk);
      });
      n.addEventListener("mouseleave", scheduleClearLineageFocus);
    }
  }

  canvas._clearLineageFocus = clearLineageFocus;
  if (renderedCount === 0) {
    showTreeError(new Error("No se renderizó ningún perfil. Revisa si el estado guardado (localStorage) está corrupto. Si necesitas, borra el localStorage del sitio y recarga."));
  }

  return { positions, nodeW, nodeH };
}

function enableDragForNode(nodeEl, personId, basePos) {
  if (!ENABLE_NODE_DRAG) return;
  if (!nodeEl) return;
  let startX = 0;
  let startY = 0;
  let originDx = 0;
  let originDy = 0;
  let dragging = false;
  let moved = false;

  nodeEl.style.cursor = "grab";

  nodeEl.addEventListener("pointerdown", (e) => {
    // solo botón principal
    if (e.button !== 0) return;
    // evita iniciar drag en inputs (por si en el futuro hay)
    if (e.target && e.target.closest && e.target.closest("a, button, input, select, textarea")) return;
    dragging = true;
    moved = false;
    nodeEl.setPointerCapture(e.pointerId);
    nodeEl.style.cursor = "grabbing";
    startX = e.clientX;
    startY = e.clientY;
    const off = (state.nodeOffsets && state.nodeOffsets[personId]) ? state.nodeOffsets[personId] : { dx: 0, dy: 0 };
    originDx = Number(off.dx) || 0;
    originDy = Number(off.dy) || 0;
    e.preventDefault();
  });

  nodeEl.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const dx = (e.clientX - startX) / (state.zoom || 1);
    const dy = (e.clientY - startY) / (state.zoom || 1);
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved = true;

    const nextDx = originDx + dx;
    const nextDy = originDy + dy;
    if (!state.nodeOffsets) state.nodeOffsets = {};
    state.nodeOffsets[personId] = { dx: nextDx, dy: nextDy };
    // aplica inmediatamente (sin recalcular layout)
    nodeEl.style.left = `${basePos.x + nextDx}px`;
    nodeEl.style.top = `${basePos.y + nextDy}px`;
  });

  nodeEl.addEventListener("pointerup", (e) => {
    if (!dragging) return;
    dragging = false;
    nodeEl.style.cursor = "grab";
    try { nodeEl.releasePointerCapture(e.pointerId); } catch { /* noop */ }
    saveState();
    // si se movió, evita que se dispare el click que abre el perfil
    if (moved) {
      const stop = (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
      };
      // captura el click inmediato post-drag
      nodeEl.addEventListener("click", stop, { once: true, capture: true });
    }
  });

  nodeEl.addEventListener("pointercancel", () => {
    dragging = false;
    nodeEl.style.cursor = "grab";
  });
}

function statusLabel(status) {
  if (status === "approved") return { text: "Aprobado", cls: "status status--approved" };
  if (status === "rejected") return { text: "Rechazado", cls: "status status--rejected" };
  return { text: "Pendiente por aprobar", cls: "status status--pending" };
}

function requestTitle(req) {
  const p = req.payload || {};
  if (req.type === "edit_person") {
    const nm = `${safeText(p.firstName)} ${safeText(p.lastName)}`.trim();
    return `Modificar: ${nm || "persona"}`;
  }
  return `Agregar: ${safeText(p.firstName)} ${safeText(p.lastName)}`.trim();
}

function renderRequests() {
  const list = document.getElementById("requestsList");
  const pendingOnly = (state.requests || []).filter((r) => String(r.status || "pending") === "pending");
  const sorted = [...pendingOnly].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  list.innerHTML = "";

  if (sorted.length === 0) {
    const empty = document.createElement("div");
    empty.className = "card";
    empty.innerHTML = `<div class="card__title">Sin solicitudes</div><div class="card__meta">Aún no hay envíos.</div>`;
    list.appendChild(empty);
    return;
  }

  for (const req of sorted) {
    const card = document.createElement("div");
    card.className = "card";
    card.dataset.requestId = req.id;

    const created = new Date(req.createdAt || req.created_at || Date.now());
    const when = created.toLocaleString(undefined, { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });

    const p = req.payload || req.payload_json || {};
    const aliveLine = p.isAlive ? "Vivo" : `Fallecido (${formatDate(p.deathDate)})`;
    const relNameLine = escapeHtml(safeText(p.relatedName) || "—");
    const relLine = escapeHtml(relationshipLabel(p.relationship));
    const typeLine = req.type === "edit_person" ? "Modificar persona" : "Agregar persona";
    const thumbs = requestPhotosThumbsHtml(p.photos);

    const st = String(req.status || "pending");
    const stInfo = statusLabel(st);
    const statusHtml = st === "approved" ? "" : `<span class="${stInfo.cls}">${stInfo.text}</span>`;

    card.innerHTML = `
      <div class="card__top">
        <div class="card__title">${escapeHtml(requestTitle(req) || "Solicitud")}</div>
        ${statusHtml}
      </div>
      <div class="card__meta">
        <div><b>Tipo:</b> ${escapeHtml(typeLine)}</div>
        <div><b>Nombre completo:</b> ${escapeHtml(safeText(p.firstName))} · <b>Apellido completo:</b> ${escapeHtml(safeText(p.lastName))}</div>
        <div><b>Nac.:</b> ${escapeHtml(formatDate(p.birthDate))} · <b>Estado:</b> ${escapeHtml(aliveLine)}</div>
        <div><b>Ubicación:</b> ${escapeHtml(safeText(p.location) || "—")}</div>
        <div><b>Correo:</b> ${escapeHtml(safeText(p.email) || "—")} · <b>Instagram:</b> ${escapeHtml(safeText(p.instagram) || "—")} · <b>TikTok:</b> ${escapeHtml(safeText(p.tiktok) || "—")}</div>
        <div><b>Relación:</b> ${relLine} · <b>Nombre (relación):</b> ${relNameLine}</div>
        <div><b>Enviado por:</b> ${escapeHtml(safeText(req.requesterName) || "—")} · <b>Fecha:</b> ${escapeHtml(when)}</div>
        ${safeText(req.notes) ? `<div><b>Notas:</b> ${escapeHtml(safeText(req.notes))}</div>` : ""}
        ${thumbs}
      </div>
    `;

    list.appendChild(card);
  }
}

async function refreshRequestsFromDb() {
  if (!sb) return;
  const { data, error } = await sb
    .from("requests")
    .select("id, created_at, requester_name, type, notes, payload, status")
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  if (error) return;
  state.requests = (data || []).map((r) => ({
    id: r.id,
    createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
    requesterName: r.requester_name,
    type: r.type,
    notes: r.notes || "",
    payload: r.payload || {},
    status: r.status || "pending",
  }));
  saveState();
  renderRequests();
}

/** Solo modo local sin Supabase: el admin ya aplicó los cambios a mano; aquí solo se quita de la cola. */
function approveRequest(id) {
  const idx = state.requests.findIndex((r) => r.id === id && String(r.status || "pending") === "pending");
  if (idx === -1) return;
  state.requests.splice(idx, 1);
  saveState();
  syncUI();
}

function rejectRequest(id) {
  const req = state.requests.find((r) => r.id === id);
  if (!req || req.status !== "pending") return;
  req.status = "rejected";
  saveState();
  syncUI();
}

function syncPersonSelects() {
  // (antes: selects de persona). Ahora todo es texto libre.
}

function wireForm() {
  const form = document.getElementById("requestForm");
  const isAlive = document.getElementById("isAlive");
  const deathDate = document.getElementById("deathDate");
  const reqType = document.getElementById("reqType");
  const photosInput = document.getElementById("photos");
  const relationshipEl = document.getElementById("relationship");

  isAlive.addEventListener("change", () => {
    deathDate.disabled = isAlive.checked;
    if (isAlive.checked) deathDate.value = "";
  });

  reqType.addEventListener("change", () => {
    const isEdit = reqType.value === "edit_person";
    if (relationshipEl) relationshipEl.required = !isEdit;
  });

  const MAX_PHOTOS = 5;
  photosInput.addEventListener("change", () => {
    const files = photosInput.files;
    if (!files || files.length <= MAX_PHOTOS) return;
    const dt = new DataTransfer();
    for (let i = 0; i < MAX_PHOTOS; i += 1) dt.items.add(files[i]);
    photosInput.files = dt.files;
    alert(`Solo se permiten ${MAX_PHOTOS} fotos. Se mantienen las primeras ${MAX_PHOTOS}.`);
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(form);

    const type = String(fd.get("reqType") || "add_person");
    const firstName = safeText(fd.get("firstName"));
    const lastName = safeText(fd.get("lastName"));
    const birthDate = String(fd.get("birthDate") || "");
    const alive = Boolean(fd.get("isAlive"));
    const death = String(fd.get("deathDate") || "");
    const location = safeText(fd.get("location"));
    const email = safeText(fd.get("contactEmail"));
    const instagram = safeText(fd.get("instagram"));
    const tiktok = safeText(fd.get("tiktok"));
    const requesterName = safeText(fd.get("requesterName"));
    const notes = safeText(fd.get("notes"));
    const relationship = String(fd.get("relationship") || "");
    const relatedName = safeText(fd.get("relatedName"));

    const photoFiles = fd.getAll("photos").filter((f) => f && typeof f === "object" && f.size);
    if (photoFiles.length > MAX_PHOTOS) {
      alert(`Máximo ${MAX_PHOTOS} fotos por solicitud.`);
      return;
    }
    const photos = [];
    for (const f of photoFiles) {
      photos.push(await readFileAsDataUrl(f));
    }

    if (!firstName || !lastName || !birthDate || !requesterName) {
      alert("Por favor completa nombre completo, apellido completo, fecha de nacimiento y Quién solicita.");
      return;
    }
    if (!alive && !death) {
      alert("Si no está vivo, selecciona la fecha de deceso.");
      return;
    }

    if (type === "add_person") {
      if (!relationship) {
        alert("Selecciona la relación.");
        return;
      }
    }

    const req = {
      id: uid("r"),
      createdAt: Date.now(),
      type,
      status: "pending",
      requesterName,
      notes,
      payload: {
        firstName,
        lastName,
        birthDate,
        isAlive: alive,
        deathDate: alive ? "" : death,
        location,
        email,
        instagram,
        tiktok,
        photos,
        relationship,
        relatedName,
      },
      applied: false,
    };

    if (sb) {
      const { error } = await sb.from("requests").insert({
        requester_name: requesterName,
        type,
        notes,
        payload: req.payload,
        status: "pending",
      });
      if (!error) await refreshRequestsFromDb();
    } else {
      state.requests.push(req);
      saveState();
      renderRequests();
    }

    // UX: reset parcial (mantiene solicitante)
    const keepRequester = requesterName;
    form.reset();
    document.getElementById("requesterName").value = keepRequester;
    document.getElementById("isAlive").checked = true;
    document.getElementById("deathDate").disabled = true;
    document.getElementById("reqType").value = "add_person";
    if (relationshipEl) relationshipEl.required = true;

    // muestra panel de solicitudes (en mobile, queda debajo; igual sirve)
    document.getElementById("requestsList").scrollIntoView({ behavior: "smooth", block: "nearest" });
  });
}

function wireZoom() {
  const out = document.getElementById("zoomOut");
  const inp = document.getElementById("zoomIn");
  const reset = document.getElementById("zoomReset");
  const clamp = (z) => Math.max(0.45, Math.min(1.35, z));

  function updateLabel() {
    reset.textContent = `${Math.round(state.zoom * 100)}%`;
  }

  out.addEventListener("click", () => {
    state.zoom = clamp((state.zoom || 1) - 0.1);
    saveState();
    renderTree();
    updateLabel();
  });
  inp.addEventListener("click", () => {
    state.zoom = clamp((state.zoom || 1) + 0.1);
    saveState();
    renderTree();
    updateLabel();
  });
  reset.addEventListener("click", () => {
    state.zoom = 0.7;
    saveState();
    renderTree();
    updateLabel();
  });

  updateLabel();
}

function wirePan() {
  const viewport = document.getElementById("treeViewport");
  if (!viewport) return;

  let panning = false;
  let startX = 0;
  let startY = 0;
  let startLeft = 0;
  let startTop = 0;

  viewport.style.cursor = "grab";

  viewport.addEventListener("pointerdown", (e) => {
    // Solo si haces click en el “fondo” del árbol (no sobre un perfil)
    if (e.button !== 0) return;
    const t = e.target;
    if (t && t.closest && t.closest(".node")) return;
    panning = true;
    viewport.classList.add("is-panning");
    viewport.setPointerCapture(e.pointerId);
    viewport.style.cursor = "grabbing";
    startX = e.clientX;
    startY = e.clientY;
    startLeft = viewport.scrollLeft;
    startTop = viewport.scrollTop;
    e.preventDefault();
  });

  viewport.addEventListener("pointermove", (e) => {
    if (!panning) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    viewport.scrollLeft = startLeft - dx;
    viewport.scrollTop = startTop - dy;
  });

  function stop(e) {
    if (!panning) return;
    panning = false;
    viewport.classList.remove("is-panning");
    viewport.style.cursor = "grab";
    try { viewport.releasePointerCapture(e.pointerId); } catch { /* noop */ }
  }

  viewport.addEventListener("pointerup", stop);
  viewport.addEventListener("pointercancel", stop);
}

function wireAddDataButton() {
  const btn = document.getElementById("addData");
  const panel = document.getElementById("sendRequest");
  if (!btn || !panel) return;
  btn.addEventListener("click", () => {
    panel.scrollIntoView({ behavior: "smooth", block: "start" });
    const first = document.getElementById("reqType") || document.getElementById("firstName");
    if (first && typeof first.focus === "function") {
      setTimeout(() => first.focus(), 250);
    }
  });
}

function syncUI() {
  try {
    normalizePeople();
    const { positions, nodeW } = renderTree() || {};
    renderRequests();
    // Ajustes del form según tipo
    const reqType = document.getElementById("reqType");
    const isEdit = reqType && reqType.value === "edit_person";
    const relEl = document.getElementById("relationship");
    if (relEl) relEl.required = !isEdit;

    if (DEFAULT_CENTER_ON_LOAD && !hasCentered && positions && nodeW) {
      centerOnRoots(positions, nodeW);
      hasCentered = true;
    }
  } catch (err) {
    showTreeError(err);
    // re-throw para que también aparezca en consola
    throw err;
  }
}

function showTreeError(err) {
  const canvas = document.getElementById("treeCanvas");
  if (!canvas) return;
  const msg = (err && (err.stack || err.message)) ? String(err.stack || err.message) : String(err);
  canvas.innerHTML = `
    <div class="card" style="max-width: 820px;">
      <div class="card__title">Error renderizando el árbol</div>
      <div class="card__meta">
        <div class="muted">Copia este mensaje y me lo envías:</div>
        <pre style="white-space: pre-wrap; margin: 10px 0 0; color: rgba(255,255,255,0.85);">${escapeHtml(msg)}</pre>
      </div>
    </div>
  `;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function centerOnRoots(positions, nodeW) {
  const viewport = document.getElementById("treeViewport");
  if (!viewport) return;
  const root = (state.roots || [])[0];
  if (!root) return;
  // centra en el “centro” de la pareja raíz si existe
  const couple = (state.couplesById || {})[root];
  let xs = [];
  if (couple && positions.has(couple.a) && positions.has(couple.b)) {
    xs = [
      positions.get(couple.a).x + nodeW / 2,
      positions.get(couple.b).x + nodeW / 2,
    ];
  } else if (positions.has(root)) {
    xs = [positions.get(root).x + nodeW / 2];
  }
  if (xs.length === 0) return;
  const centerX = xs.reduce((a, b) => a + b, 0) / xs.length;

  // scrollLeft debe considerar el zoom actual porque el contenido está escalado
  const scaledCenterX = centerX * (state.zoom || 1);
  const targetLeft = Math.max(0, scaledCenterX - viewport.clientWidth / 2);
  viewport.scrollLeft = targetLeft;
  viewport.scrollTop = 0;
}

function setupPhotoModal() {
  const modal = document.getElementById("photoModal");
  const closeBtn = document.getElementById("closeModal");
  const backdrop = modal?.querySelector("[data-close='true']");
  const main = document.getElementById("modalMainImg");
  const thumbs = document.getElementById("modalThumbs");
  const profileName = document.getElementById("profileName");
  const profileMeta = document.getElementById("profileMeta");
  const profileLinks = document.getElementById("profileLinks");

  function close() {
    if (!modal) return;
    modal.setAttribute("aria-hidden", "true");
    if (main) main.src = "";
    if (thumbs) thumbs.innerHTML = "";
    if (profileName) profileName.textContent = "—";
    if (profileMeta) profileMeta.innerHTML = "";
    if (profileLinks) profileLinks.innerHTML = "";
  }

  closeBtn?.addEventListener("click", close);
  backdrop?.addEventListener("click", close);
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });

  photoModalApi = { open: openProfileModal, close };
}

function openProfileModal(personId) {
  const modal = document.getElementById("photoModal");
  const title = document.getElementById("modalTitle");
  const main = document.getElementById("modalMainImg");
  const thumbs = document.getElementById("modalThumbs");
  const profileName = document.getElementById("profileName");
  const profileMeta = document.getElementById("profileMeta");
  const profileLinks = document.getElementById("profileLinks");
  const person = normalizePersonPhotos(state.peopleById[personId]);
  if (!modal || !main || !thumbs || !person) return;
  const photos = (person.photos || []).filter(Boolean);

  const fullName = `${safeText(person.firstName)} ${safeText(person.lastName)}`.trim();
  title.textContent = fullName || "Fotos";
  if (profileName) profileName.textContent = fullName || "—";
  if (profileMeta) {
    profileMeta.innerHTML = `
      <div><b>Nac.</b> ${formatDate(person.birthDate)}</div>
      <div><b>Dec.</b> ${person.isAlive ? "—" : formatDate(person.deathDate)}</div>
      <div><b>Ubicación</b> ${safeText(person.location) || "—"}</div>
    `;
  }
  if (profileLinks) {
    profileLinks.innerHTML = "";
    const email = safeText(person.email);
    const ig = safeText(person.instagram);
    const tt = safeText(person.tiktok);
    if (email) {
      const a = document.createElement("a");
      a.className = "linkPill";
      a.href = `mailto:${email}`;
      a.textContent = `Email: ${email}`;
      profileLinks.appendChild(a);
    }
    if (ig) {
      const clean = ig.replace(/^@/, "");
      const a = document.createElement("a");
      a.className = "linkPill";
      a.href = `https://instagram.com/${encodeURIComponent(clean)}`;
      a.target = "_blank";
      a.rel = "noreferrer";
      a.textContent = `Instagram: @${clean}`;
      profileLinks.appendChild(a);
    }
    if (tt) {
      const cleanTt = tt.replace(/^@/, "");
      const a = document.createElement("a");
      a.className = "linkPill";
      a.href = `https://www.tiktok.com/@${encodeURIComponent(cleanTt)}`;
      a.target = "_blank";
      a.rel = "noreferrer";
      a.textContent = `TikTok: @${cleanTt}`;
      profileLinks.appendChild(a);
    }
    if (!email && !ig && !tt) {
      const span = document.createElement("span");
      span.className = "muted";
      span.textContent = "Sin redes/correo aún.";
      profileLinks.appendChild(span);
    }
  }

  function setMain(url) {
    main.src = url;
    for (const el of thumbs.querySelectorAll(".thumb")) {
      el.setAttribute("aria-current", el.dataset.url === url ? "true" : "false");
    }
  }

  thumbs.innerHTML = "";
  if (photos.length) {
    for (const url of photos) {
      const t = document.createElement("div");
      t.className = "thumb";
      t.dataset.url = url;
      t.setAttribute("aria-current", "false");
      t.innerHTML = `<img src="${url}" alt="Miniatura" />`;
      t.addEventListener("click", () => setMain(url));
      thumbs.appendChild(t);
    }
    setMain(photos[0]);
  } else {
    main.src = "";
    thumbs.innerHTML = `<div class="muted">Sin fotos.</div>`;
  }
  modal.setAttribute("aria-hidden", "false");
}

function init() {
  normalizePeople();
  saveState();
  sb = window.getSupabase ? window.getSupabase() : null;
  wireZoom();
  wirePan();
  wireAddDataButton();
  wireForm();
  setupPhotoModal();
  bindTreeLineageOutsideClickOnce();
  syncUI();
  refreshRequestsFromDb();
}

let state = loadState();
let hasCentered = false;
let photoModalApi = null;
try {
  init();
} catch (err) {
  try { showTreeError(err); } catch { /* noop */ }
  throw err;
}

