/* eslint-disable no-alert */
const STORAGE_KEY = "family_tree_demo_v2";
const DEFAULT_CENTER_ON_LOAD = true;
const ENABLE_NODE_DRAG = false;

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
  // - 12 hijos
  // - cada hijo tiene 1 cónyuge
  // - desde el centro de la pareja salen las líneas a los nietos (2 por hijo)
  const nono = {
    id: "p_nono",
    firstName: "Carmelo",
    lastName: "Uzcátegui",
    birthDate: "",
    isAlive: false,
    deathDate: "",
    location: "",
    photos: [],
    email: "",
    instagram: "",
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
  // Paleta más “familiar” (tierra + verde suave + azul grisáceo)
  const palette = [
    "#6FA8A1", // verde agua
    "#8FAE7A", // oliva suave
    "#C8A46A", // arena
    "#B9856B", // terracota suave
    "#9A8FB0", // lavanda gris
    "#7A94B0", // azul pizarra
    "#B7A38F", // taupe
    "#A08D7A", // madera
    "#8E9B86", // salvia
    "#C29C90", // rosa viejo
    "#8798A6", // gris azulado
    "#B2B08A", // caqui suave
  ];

  function addPerson(id, firstName, lastName) {
    peopleById[id] = {
      id,
      firstName,
      lastName,
      birthDate: "",
      isAlive: true,
      deathDate: "",
      location: "",
      photos: [],
      email: "",
      instagram: "",
    };
  }

  // 12 hijos
  for (let i = 1; i <= 12; i += 1) {
    const childId = `p_h${i}`;
    addPerson(childId, `Hijo${i}`, "Uzcátegui Mora");

    const spouseId = `p_h${i}_s`;
    addPerson(spouseId, `Cónyuge${i}`, "—");

    const coupleId = `v_couple_h${i}`;
    couplesById[coupleId] = { a: childId, b: spouseId };
    lineageColorById[coupleId] = palette[(i - 1) % palette.length];
    childrenByParentId[coupleId] = [];
    childrenByParentId[rootCoupleId].push(coupleId);

    // 2 nietos por cada hijo
    for (let j = 1; j <= 2; j += 1) {
      const grandId = `p_h${i}_c${j}`;
      addPerson(grandId, `Nieto${i}.${j}`, "Uzcátegui");
      childrenByParentId[coupleId].push(grandId);
    }
  }

  return {
    adminMode: false,
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
    return {
      ...defaultState(),
      ...parsed,
      peopleById: { ...defaultState().peopleById, ...(parsed.peopleById || {}) },
      childrenByParentId: { ...defaultState().childrenByParentId, ...(parsed.childrenByParentId || {}) },
      roots: Array.isArray(parsed.roots) ? parsed.roots : defaultState().roots,
      requests: Array.isArray(parsed.requests) ? parsed.requests : defaultState().requests,
      couplesById: { ...defaultState().couplesById, ...(parsed.couplesById || {}) },
      lineageColorById: { ...defaultState().lineageColorById, ...(parsed.lineageColorById || {}) },
      nodeOffsets: { ...defaultState().nodeOffsets, ...(parsed.nodeOffsets || {}) },
    };
  } catch {
    return defaultState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function ensureAppliedApprovedAdds() {
  // Aplica automáticamente solicitudes aprobadas tipo add_person que no se hayan aplicado (por si la demo se carga en orden distinto)
  for (const req of state.requests) {
    if (req.status !== "approved") continue;
    if (req.type !== "add_person") continue;
    if (req.applied) continue;
    applyAddPerson(req);
    req.applied = true;
  }
}

function normalizePersonPhotos(person) {
  if (!person) return person;
  // compatibilidad con versiones previas
  const legacy = person.photo ? [person.photo] : [];
  const photos = Array.isArray(person.photos) ? person.photos : legacy;
  return {
    email: "",
    instagram: "",
    ...person,
    photos: photos.filter(Boolean),
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
    photos: Array.isArray(p.photos) ? p.photos.filter(Boolean) : (p.photo ? [p.photo] : []),
    email: "",
    instagram: "",
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
  // spouse_of: por ahora no cambia el gráfico (se modelará mejor con backend)
  state.roots = [...new Set([...(state.roots || []), newId])];
}

function applyEditPerson(req) {
  const p = req.payload || {};
  const objectiveName = safeText(p.objectiveName || "");
  const id = objectiveName ? findPersonIdByName(objectiveName) : "";
  if (!id || !state.peopleById[id]) return;
  const prev = normalizePersonPhotos(state.peopleById[id]);
  const nextPhotos = Array.isArray(p.photos) ? p.photos.filter(Boolean) : prev.photos;
  state.peopleById[id] = {
    ...prev,
    firstName: safeText(p.firstName),
    lastName: safeText(p.lastName),
    birthDate: p.birthDate || "",
    isAlive: Boolean(p.isAlive),
    deathDate: p.isAlive ? "" : (p.deathDate || ""),
    location: safeText(p.location),
    photos: nextPhotos,
  };
}

function normalizePeople() {
  for (const [id, p] of Object.entries(state.peopleById || {})) {
    state.peopleById[id] = normalizePersonPhotos(p);
  }
}

function findCoupleIdByMember(personId) {
  for (const [cid, c] of Object.entries(state.couplesById || {})) {
    if (c?.a === personId || c?.b === personId) return cid;
  }
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
  // - Solo soporta el “modo familia” actual: pareja raíz -> 12 parejas (hijo+cónyuge) -> nietos
  // - Bloques por linaje en grilla: reduce scroll lateral y evita desplazamientos raros
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
  const blockGapY = 40; // espacio extra entre bloques (evita cruces)

  const positions = new Map(); // id -> {x,y}
  const edges = []; // {from,to,color,isSpouse?}

  const rootId = (state.roots || [])[0];
  const rootCouple = rootId ? (state.couplesById || {})[rootId] : null;
  if (!rootId || !rootCouple) {
    return { positions, edges, width: 600, height: 420, nodeW, nodeH };
  }

  const childCoupleIds = (state.childrenByParentId[rootId] || []).filter((cid) => (state.couplesById || {})[cid]);
  // 12 hijos en 3 alturas (4 columnas x 3 filas)
  const colCount = 4; // 4 grupos
  const levelCount = 3; // 3 alturas (hijos)
  const levelStep = 112; // distancia vertical entre alturas de hijos (más pirámide)
  const gridW = colCount * coupleW + Math.max(0, colCount - 1) * gapX;
  const contentW = Math.max(rootCoupleW, gridW);
  const contentH = 740; // se ajusta al final con maxY

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

  // Orden estable por número de hijo: v_couple_h1..v_couple_h12
  const sortedChildCouples = [...childCoupleIds].sort((a, b) => {
    const na = Number(String(a).match(/h(\d+)/)?.[1] || 0);
    const nb = Number(String(b).match(/h(\d+)/)?.[1] || 0);
    return na - nb;
  });

  // Pirámide automática (sin solapes entre HIJOS):
  // - nivel inferior: 6 parejas
  // - nivel medio: 4 parejas (centradas entre las de abajo)
  // - nivel superior: 2 parejas (centradas entre las del medio)
  // Orden por nacimiento:
  // - fila superior: H1–H2
  // - fila media: H3–H6
  // - fila inferior (base): H7–H12
  const level2 = sortedChildCouples.slice(0, 2);
  const level1 = sortedChildCouples.slice(2, 6);
  const level0 = sortedChildCouples.slice(6, 12);

  const baseY2 = rootY + gapY1 + 0 * levelStep; // superior
  const baseY1 = rootY + gapY1 + 1 * levelStep; // medio
  const baseY0 = rootY + gapY1 + 2 * levelStep; // inferior

  const level0W = 6 * coupleW + 5 * gapX;
  const level0X0 = (contentW - level0W) / 2;
  const x0 = level0.map((_, i) => level0X0 + i * (coupleW + gapX));
  // fila media (4) centrada respecto a la base (6)
  const level1W = 4 * coupleW + 3 * gapX;
  const level1X0 = level0X0 + (level0W - level1W) / 2;
  const x1 = level1.map((_, i) => level1X0 + i * (coupleW + gapX));
  // fila superior (2) centrada respecto a la fila media (4)
  const level2W = 2 * coupleW + 1 * gapX;
  const level2X0 = level0X0 + (level0W - level2W) / 2;
  const x2 = level2.map((_, i) => level2X0 + i * (coupleW + gapX));

  // Centrado por niveles:
  // - nivel medio centrado respecto al inferior (nivel 0)
  // - nivel superior centrado respecto al medio (nivel 1)
  // - raíz centrada respecto al nivel inferior (la base más ancha)
  function levelBounds(xs) {
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs) + coupleW;
    return { minX, maxX, center: (minX + maxX) / 2 };
  }

  const b0 = levelBounds(x0);
  const b1raw = levelBounds(x1);
  const shift1 = b0.center - b1raw.center;
  const x1c = x1.map((v) => v + shift1);

  const b1 = levelBounds(x1c);
  const b2raw = levelBounds(x2);
  const shift2 = b1.center - b2raw.center;
  const x2c = x2.map((v) => v + shift2);

  // Raíz centrada respecto a toda la pirámide (base nivel 0)
  const rootCenterX = b0.center;
  const rootLeftX = rootCenterX - rootCoupleW / 2;

  positions.set(rootA, { x: rootLeftX, y: rootY });
  positions.set(rootB, { x: rootLeftX + nodeW + rootSpouseGap, y: rootY });
  positions.set(rootId, { x: rootLeftX + (rootCoupleW / 2) - (nodeW / 2), y: rootY });
  edges.push({ from: rootA, to: rootB, color: "rgba(255,255,255,0.16)", isSpouse: true });

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

    positions.set(couple.a, { x, y });
    positions.set(couple.b, { x: x + nodeW - overlap, y: y + 7 });
    positions.set(cid, { x: x + (coupleW / 2) - (nodeW / 2), y });

    const color = withAlpha((state.lineageColorById || {})[cid], 0.55);
    edges.push({ from: couple.a, to: couple.b, color: "rgba(255,255,255,0.14)", isSpouse: true });
    edges.push({ from: rootId, to: cid, color: "rgba(255,255,255,0.10)" });

    // Nietos en segunda pasada: siempre por debajo de TODOS los hijos
    const kids = (state.childrenByParentId[cid] || []).filter((pid) => (state.peopleById || {})[pid]);
    pendingGrandkids.push({ cid, x, y, kids, color });
  }

  // Segunda pasada: nietos SIEMPRE debajo de todos los hijos (sin superposición con hijos)
  let childrenMaxBottom = 0;
  const childPeopleIds = [];
  for (const cid of sortedChildCouples) {
    const couple = state.couplesById?.[cid];
    if (!couple) continue;
    childPeopleIds.push(couple.a, couple.b);
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
  const grandMinGapX = 22; // separación mínima entre nietos (evita superposición)

  // Nietos en 2 niveles:
  // - nivel 0 (arriba): 8 pares
  // - nivel 1 (abajo): 4 pares
  // Ambos niveles centrados con la pirámide de hijos.
  const topPairs = pendingGrandkids.slice(0, 8);
  const bottomPairs = pendingGrandkids.slice(8, 12);
  const levels = [topPairs, bottomPairs];

  const rowH = nodeH + grandGapY; // 2 filas por nivel (porque son 2 nietos)
  const levelGapY = 32;
  const levelH = rowH * 2 + levelGapY;
  const rowInterleaveX = 18; // intercalado entre las 2 filas

  function placeGrandLevel(pairs, levelIdx) {
    // primero resolvemos X por parejas (no por nieto)
    const desiredPairs = pairs.map((p) => ({
      fromCid: p.cid,
      desiredX: p.x + Math.max(0, (coupleW - nodeW) / 2),
      kids: p.kids,
      color: p.color,
    })).sort((a, b) => a.desiredX - b.desiredX);

    let cursorX = -Infinity;
    const placed = [];
    for (const pair of desiredPairs) {
      const x = Math.max(pair.desiredX, cursorX + nodeW + grandMinGapX);
      cursorX = x;
      placed.push({ ...pair, x });
    }

    // centra este nivel respecto a la base de hijos (b0.center)
    if (placed.length) {
      const minX = Math.min(...placed.map((p) => p.x));
      const maxX = Math.max(...placed.map((p) => p.x + nodeW));
      const center = (minX + maxX) / 2;
      const dx = b0.center - center;
      for (const p of placed) p.x += dx;
    }

    // asigna 2 filas (nieto 1 y 2), intercaladas en X
    const baseY = globalGrandTop + levelIdx * levelH;
    for (const p of placed) {
      const kids = p.kids || [];
      kids.forEach((pid, kIdx) => {
        const rowIdx = Math.min(1, Math.max(0, kIdx));
        const y = baseY + rowIdx * rowH;
        const x = p.x + (rowIdx ? rowInterleaveX : 0);
        positions.set(pid, { x, y });
        edges.push({ from: p.fromCid, to: pid, color: p.color });
      });
    }
  }

  placeGrandLevel(levels[0], 0);
  placeGrandLevel(levels[1], 1);

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

  // Normaliza X a 0..W
  const minX = Math.min(...[...positions.values()].map((p) => p.x), 0);
  if (minX !== 0) {
    for (const [id, p] of positions.entries()) positions.set(id, { x: p.x - minX, y: p.y });
  }

  const maxX = Math.max(...[...positions.values()].map((p) => p.x + nodeW));
  const maxY = Math.max(...[...positions.values()].map((p) => p.y + nodeH));
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
    const b = getPersonRenderBox(couple.b);
    if (!a || !b) return null;
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

    const x1 = fromIsVirtual ? fromAnchor.cx : (fromBox.x + fromBox.w / 2);
    const y1 = fromIsVirtual ? fromAnchor.bottom : (fromBox.y + fromBox.h);
    const x2 = toIsVirtual ? toAnchor.cx : (toBox.x + toBox.w / 2);
    const y2 = toIsVirtual ? toAnchor.top : (toBox.y);

    const midY = (y1 + y2) / 2;
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    const d = e.isSpouse
      ? (() => {
        const y = (fromBox ? (fromBox.y + 18) : (fromAnchor.top + 18));
        return `M ${x1} ${y} C ${(x1 + x2) / 2} ${y - 10}, ${(x1 + x2) / 2} ${y + 10}, ${x2} ${y}`;
      })()
      : `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;
    path.setAttribute("d", d);
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", e.color || "rgba(235, 228, 214, 0.28)");
    path.setAttribute("stroke-width", e.isSpouse ? "2.2" : "2.2");
    path.setAttribute("opacity", e.isSpouse ? "0.34" : "0.70");
    svg.appendChild(path);
  }

  // Limpia y renderiza
  canvas.innerHTML = "";
  canvas.appendChild(svg);

  // Nodos
  let renderedCount = 0;
  for (const [id, p] of positions.entries()) {
    if (String(id).startsWith("v_")) continue; // nodos virtuales no se renderizan
    const person = normalizePersonPhotos(state.peopleById[id]);
    if (!person) continue;
    const node = document.createElement("div");
    const isSpouse = String(id).endsWith("_s") || safeText(person.lastName) === "—";
    node.className = isSpouse ? "node node--spouse" : "node";
    const off = (state.nodeOffsets && state.nodeOffsets[id]) ? state.nodeOffsets[id] : { dx: 0, dy: 0 };
    node.style.left = `${p.x + (Number(off.dx) || 0)}px`;
    node.style.top = `${p.y + (Number(off.dy) || 0)}px`;
    node.dataset.personId = id;

    // Borde por linaje:
    // - hijos/cónyuges: su pareja (coupleId)
    // - nietos: el coupleId padre (childrenByParentId)
    let lineageCoupleId = "";
    const maybeParent = parentByChild[id];
    if (maybeParent && String(maybeParent).startsWith("v_couple_h")) {
      lineageCoupleId = maybeParent;
    } else {
      const c = findCoupleIdByMember(id);
      if (c && String(c).startsWith("v_couple_h")) lineageCoupleId = c;
    }
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
          openProfileModal(id);
        });
      }
    }

    node.addEventListener("click", (e) => {
      const target = e.target;
      if (target && target.closest && target.closest("[data-open-photos='true']")) return;
      openProfileModal(id);
    });

    // Arrastrar sigue disponible, pero con el nuevo layout ya queda ordenado de base.
    if (ENABLE_NODE_DRAG) enableDragForNode(node, id, p);
  }

  if (renderedCount === 0) {
    showTreeError(new Error("No se renderizó ningún perfil. Revisa si el estado guardado (localStorage) está corrupto y presiona “Restablecer datos”."));
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
  return { text: "Pendiente", cls: "status status--pending" };
}

function requestTitle(req) {
  const p = req.payload || {};
  if (req.type === "edit_person") {
    const name = safeText(p.objectiveName) || "persona";
    return `Modificar: ${name}`;
  }
  return `Agregar: ${safeText(p.firstName)} ${safeText(p.lastName)}`.trim();
}

function renderRequests() {
  const list = document.getElementById("requestsList");
  const pending = state.requests.filter((r) => r.status === "pending").length;
  const approved = state.requests.filter((r) => r.status === "approved").length;
  const rejected = state.requests.filter((r) => r.status === "rejected").length;
  document.getElementById("pendingCount").textContent = `Pendientes: ${pending}`;
  document.getElementById("approvedCount").textContent = `Aprobadas: ${approved}`;
  document.getElementById("rejectedCount").textContent = `Rechazadas: ${rejected}`;

  const sorted = [...state.requests].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  list.innerHTML = "";

  if (sorted.length === 0) {
    const empty = document.createElement("div");
    empty.className = "card";
    empty.innerHTML = `<div class="card__title">Sin solicitudes</div><div class="card__meta">Aún no hay envíos.</div>`;
    list.appendChild(empty);
    return;
  }

  for (const req of sorted) {
    const { text, cls } = statusLabel(req.status);
    const card = document.createElement("div");
    card.className = "card";
    card.dataset.requestId = req.id;

    const created = new Date(req.createdAt || Date.now());
    const when = created.toLocaleString(undefined, { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });

    const p = req.payload || {};
    const aliveLine = p.isAlive ? "Vivo" : `Fallecido (${formatDate(p.deathDate)})`;
    const photoLine = (Array.isArray(p.photos) ? p.photos.length : (p.photo ? 1 : 0)) ? "Sí" : "No";
    const relLine = p.relationship ? String(p.relationship) : "—";
    const relNameLine = safeText(p.relatedName) || "—";

    card.innerHTML = `
      <div class="card__top">
        <div class="card__title">${requestTitle(req) || "Solicitud"}</div>
        <div class="${cls}">${text}</div>
      </div>
      <div class="card__meta">
        <div><b>Enviado por:</b> ${safeText(req.requesterName) || "—"} · <b>Fecha:</b> ${when}</div>
        <div><b>Nac.:</b> ${formatDate(p.birthDate)} · <b>Estado:</b> ${aliveLine}</div>
        <div><b>Ubicación:</b> ${safeText(p.location) || "—"} · <b>Foto:</b> ${photoLine}</div>
        ${req.type === "add_person" ? `<div><b>Relación:</b> ${relLine} · <b>Nombre:</b> ${relNameLine}</div>` : ""}
        ${safeText(req.notes) ? `<div><b>Notas:</b> ${safeText(req.notes)}</div>` : ""}
      </div>
    `;

    if (state.adminMode) {
      const actions = document.createElement("div");
      actions.className = "card__actions";

      const approveBtn = document.createElement("button");
      approveBtn.className = "btn btn--primary";
      approveBtn.type = "button";
      approveBtn.textContent = "Aprobar";
      approveBtn.disabled = req.status !== "pending";
      approveBtn.addEventListener("click", () => approveRequest(req.id));

      const rejectBtn = document.createElement("button");
      rejectBtn.className = "btn btn--danger";
      rejectBtn.type = "button";
      rejectBtn.textContent = "Rechazar";
      rejectBtn.disabled = req.status !== "pending";
      rejectBtn.addEventListener("click", () => rejectRequest(req.id));

      actions.appendChild(approveBtn);
      actions.appendChild(rejectBtn);
      card.appendChild(actions);
    }

    list.appendChild(card);
  }
}

function approveRequest(id) {
  const req = state.requests.find((r) => r.id === id);
  if (!req || req.status !== "pending") return;
  req.status = "approved";
  if (req.type === "add_person") {
    applyAddPerson(req);
    req.applied = true;
  } else if (req.type === "edit_person") {
    applyEditPerson(req);
    req.applied = true;
  }
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
  const objectiveWrap = document.getElementById("objectiveWrap");
  const objectiveName = document.getElementById("objectiveName");

  isAlive.addEventListener("change", () => {
    deathDate.disabled = isAlive.checked;
    if (isAlive.checked) deathDate.value = "";
  });

  reqType.addEventListener("change", () => {
    const isEdit = reqType.value === "edit_person";
    objectiveWrap.hidden = !isEdit;
    objectiveName.required = isEdit;
    document.getElementById("relationship").disabled = isEdit;
    document.getElementById("relatedName").disabled = isEdit;
    if (!isEdit) objectiveName.value = "";
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
    const requesterName = safeText(fd.get("requesterName"));
    const notes = safeText(fd.get("notes"));
    const objective = safeText(fd.get("objectiveName"));

    const photoFiles = fd.getAll("photos");
    const photos = [];
    for (const f of photoFiles) {
      if (f && typeof f === "object" && f.size) photos.push(await readFileAsDataUrl(f));
    }

    if (!firstName || !lastName || !birthDate || !requesterName) {
      alert("Por favor completa Nombre, Apellido, Fecha de nacimiento y Quién solicita.");
      return;
    }
    if (!alive && !death) {
      alert("Si no está vivo, selecciona la fecha de deceso.");
      return;
    }

    if (type === "add_person") {
      const rel = String(fd.get("relationship") || "");
      if (!rel) {
        alert("Selecciona la relación.");
        return;
      }
    }
    if (type === "edit_person" && !objective) {
      alert("Escribe la persona objetivo (Nombre y Apellido).");
      return;
    }

    const req = {
      id: uid("r"),
      createdAt: Date.now(),
      type,
      status: "pending",
      requesterName,
      notes,
      payload: {
        ...(type === "edit_person" ? { objectiveName: objective } : {}),
        firstName,
        lastName,
        birthDate,
        isAlive: alive,
        deathDate: alive ? "" : death,
        location,
        photos,
        ...(type === "add_person"
          ? { relationship: String(fd.get("relationship") || ""), relatedName: safeText(fd.get("relatedName")) }
          : {}),
      },
      applied: false,
    };

    state.requests.push(req);
    saveState();
    renderRequests();

    // UX: reset parcial (mantiene solicitante)
    const keepRequester = requesterName;
    form.reset();
    document.getElementById("requesterName").value = keepRequester;
    document.getElementById("isAlive").checked = true;
    document.getElementById("deathDate").disabled = true;
    document.getElementById("reqType").value = "add_person";
    document.getElementById("objectiveWrap").hidden = true;
    document.getElementById("objectiveName").required = false;
    document.getElementById("relationship").disabled = false;
    document.getElementById("relatedName").disabled = false;

    // muestra panel de solicitudes (en mobile, queda debajo; igual sirve)
    document.getElementById("requestsList").scrollIntoView({ behavior: "smooth", block: "nearest" });
  });
}

function wireAdmin() {
  const toggle = document.getElementById("adminToggle");
  toggle.checked = Boolean(state.adminMode);
  toggle.addEventListener("change", () => {
    state.adminMode = toggle.checked;
    saveState();
    renderRequests();
  });

  document.getElementById("resetDemo").addEventListener("click", () => {
    const ok = confirm("¿Restablecer datos? Se borrarán solicitudes y cambios locales de este navegador.");
    if (!ok) return;
    localStorage.removeItem(STORAGE_KEY);
    state = loadState();
    ensureAppliedApprovedAdds();
    saveState();
    init();
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

function syncUI() {
  try {
    ensureAppliedApprovedAdds();
    normalizePeople();
    const { positions, nodeW } = renderTree() || {};
    renderRequests();
    // Ajustes del form según tipo
    const reqType = document.getElementById("reqType");
    const isEdit = reqType.value === "edit_person";
    document.getElementById("objectiveWrap").hidden = !isEdit;
    document.getElementById("objectiveName").required = isEdit;
    document.getElementById("relationship").disabled = isEdit;
    document.getElementById("relatedName").disabled = isEdit;

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
    if (!email && !ig) {
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
  // Asegura que las solicitudes aprobadas de demo se reflejen en el árbol
  ensureAppliedApprovedAdds();
  normalizePeople();
  saveState();
  wireAdmin();
  wireZoom();
  wirePan();
  wireForm();
  setupPhotoModal();
  syncUI();
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

