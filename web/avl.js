"use strict";
console.log("Adaptive AVL JavaScript connected!");
/* ==========================================================
   Adaptive AVL Tree – browser demo
   Sections: constants, Node, AVL utilities, rotations,
   AdaptiveAVL class (insert / delete / search / adaptive),
   validation, SVG rendering, UI handlers, activity log.
   ========================================================== */

// ---------- Fixed project rules ----------
const WINDOW_SIZE = 10;     // successful searches per monitoring window
const HIGH_THRESHOLD = 5;   // "highly accessed" means windowFrequency > 5

// ---------- Node ----------
class Node {
  constructor(key) {
    this.key = key;
    this.left = null;
    this.right = null;
    this.height = 1;          // leaf = 1, empty = 0
    this.totalFrequency = 0;  // successful searches this session
    this.windowFrequency = 0; // successful searches in current window
  }
}

// ---------- AVL utilities ----------
const height = (n) => (n ? n.height : 0);
const updateHeight = (n) => { n.height = 1 + Math.max(height(n.left), height(n.right)); };
const balanceFactor = (n) => (n ? height(n.left) - height(n.right) : 0);

// ---------- Rotations (each returns the new subtree root) ----------
function rotateRight(y) {
  const x = y.left;
  y.left = x.right;
  x.right = y;
  updateHeight(y);
  updateHeight(x);
  return x;
}

function rotateLeft(x) {
  const y = x.right;
  x.right = y.left;
  y.left = x;
  updateHeight(x);
  updateHeight(y);
  return y;
}

// Normal AVL rebalancing. Pushes a description of any rotation into `events`.
function rebalance(node, events) {
  updateHeight(node);
  const bf = balanceFactor(node);

  if (bf > 1) {
    if (balanceFactor(node.left) >= 0) {
      events.push(`LL case at ${node.key} → right rotation`);
      return rotateRight(node);
    }
    events.push(`LR case at ${node.key} → left rotation on ${node.left.key}, then right rotation`);
    node.left = rotateLeft(node.left);
    return rotateRight(node);
  }
  if (bf < -1) {
    if (balanceFactor(node.right) <= 0) {
      events.push(`RR case at ${node.key} → left rotation`);
      return rotateLeft(node);
    }
    events.push(`RL case at ${node.key} → right rotation on ${node.right.key}, then left rotation`);
    node.right = rotateRight(node.right);
    return rotateLeft(node);
  }
  return node;
}

// ---------- Safe promotion check (adaptive part) ----------
// Would rotating `parent` so that its child `node` takes its place be AVL-safe?
// Safe only if (1) both changed nodes stay within balance factor -1..+1 and
// (2) the new subtree height equals the old one, so ancestors are untouched.
// This only *computes*; it never changes the tree.
function evaluatePromotion(parent, node) {
  const isLeft = parent.left === node;
  const inner = isLeft ? node.right : node.left;   // subtree that changes parent
  const outer = isLeft ? node.left : node.right;   // subtree that stays with node
  const parentOther = isLeft ? parent.right : parent.left;

  const newParentHeight = 1 + Math.max(height(inner), height(parentOther));
  const newParentBF = height(inner) - height(parentOther);
  const newNodeHeight = 1 + Math.max(height(outer), newParentHeight);
  const newNodeBF = height(outer) - newParentHeight;

  if (Math.abs(newParentBF) > 1 || Math.abs(newNodeBF) > 1) {
    return { safe: false, reason: "balance", detail: `moving ${node.key} up would leave a node with balance factor ${Math.abs(newParentBF) > 1 ? newParentBF : newNodeBF}` };
  }
  if (newNodeHeight !== parent.height) {
    return { safe: false, reason: "height", detail: `the subtree height would change from ${parent.height} to ${newNodeHeight}, which could disturb ancestors` };
  }
  return { safe: true, reason: "ok", detail: "balance preserved and subtree height unchanged" };
}

// ---------- The Adaptive AVL tree ----------
class AdaptiveAVL {
  constructor() { this.reset(); }

  reset() {
    this.root = null;
    this.windowCount = 0; // successful searches in current window
  }

  // --- insertion (real AVL insertion into the existing tree) ---
  insert(key) {
    const events = [];
    const ctx = { inserted: false };
    const insertRec = (node) => {
      if (!node) { ctx.inserted = true; return new Node(key); }
      if (key < node.key) node.left = insertRec(node.left);
      else if (key > node.key) node.right = insertRec(node.right);
      else return node; // duplicate
      return rebalance(node, events);
    };
    this.root = insertRec(this.root);
    return { ok: ctx.inserted, events };
  }

  // --- deletion ---
  remove(key) {
    const events = [];
    const ctx = { removed: false };
    const minNode = (n) => { while (n.left) n = n.left; return n; };
    const removeRec = (node, k) => {
      if (!node) return null;
      if (k < node.key) node.left = removeRec(node.left, k);
      else if (k > node.key) node.right = removeRec(node.right, k);
      else {
        ctx.removed = true;
        if (!node.left || !node.right) return node.left || node.right; // leaf or one child
        // two children: copy in-order successor's data, then delete the successor
        const succ = minNode(node.right);
        node.key = succ.key;
        node.totalFrequency = succ.totalFrequency;
        node.windowFrequency = succ.windowFrequency;
        node.right = removeRec(node.right, succ.key);
      }
      return rebalance(node, events);
    };
    this.root = removeRec(this.root, key);
    return { ok: ctx.removed, events };
  }

  // --- search with step counting and frequency tracking ---
  search(key) {
    const path = [];
    let cur = this.root;
    while (cur) {
      path.push(cur.key);
      if (key === cur.key) break;
      cur = key < cur.key ? cur.left : cur.right;
    }
    const found = cur !== null;
    const result = { found, path, steps: path.length, node: cur, windowComplete: false };
    if (found) { // only successful searches count
      cur.totalFrequency++;
      cur.windowFrequency++;
      this.windowCount++;
      result.windowComplete = this.windowCount >= WINDOW_SIZE;
    }
    return result;
  }

  // --- adaptive check: run after exactly WINDOW_SIZE successful searches ---
  runAdaptiveCheck() {
    // 1. highest window frequency wins (never total frequency)
    let best = null;
    this.inorder((n) => { if (!best || n.windowFrequency > best.windowFrequency) best = n; });

    const result = { status: "none", key: null, frequency: 0, detail: "" };
    if (best) { result.key = best.key; result.frequency = best.windowFrequency; }

    if (!best || best.windowFrequency <= HIGH_THRESHOLD) {
      result.status = "none";
    } else {
      // 2. find parent and grandparent of the priority node
      const ancestors = [];
      let cur = this.root;
      while (cur && cur.key !== best.key) {
        ancestors.push(cur);
        cur = best.key < cur.key ? cur.left : cur.right;
      }
      const parent = ancestors[ancestors.length - 1];
      const grand = ancestors[ancestors.length - 2];

      if (!parent) {
        result.status = "root";
      } else {
        // 3. one-level promotion only if it is AVL-safe
        const check = evaluatePromotion(parent, best);
        result.detail = check.detail;
        if (!check.safe) {
          result.status = "unsafe";
        } else {
          const top = parent.left === best ? rotateRight(parent) : rotateLeft(parent);
          if (!grand) this.root = top;
          else if (grand.left === parent) grand.left = top;
          else grand.right = top;
          result.status = "safe";
        }
      }
    }

    // 4. new window: reset window frequencies only (totals stay)
    this.inorder((n) => { n.windowFrequency = 0; });
    this.windowCount = 0;
    return result;
  }

  inorder(visit, node = this.root) {
    if (!node) return;
    this.inorder(visit, node.left);
    visit(node);
    this.inorder(visit, node.right);
  }
}

// ---------- Validation: BST order, heights, balance ----------
function checkAVL(root) {
  let prev = null;
  function walk(n) {
    if (!n) return { h: 0, error: null };
    const l = walk(n.left);
    if (l.error) return l;
    if (prev !== null && n.key <= prev) return { h: 0, error: `BST order broken at ${n.key}` };
    prev = n.key;
    const r = walk(n.right);
    if (r.error) return r;
    const h = 1 + Math.max(l.h, r.h);
    if (h !== n.height) return { h, error: `stored height wrong at ${n.key}` };
    if (Math.abs(l.h - r.h) > 1) return { h, error: `node ${n.key} is unbalanced` };
    return { h, error: null };
  }
  return walk(root).error;
}

/* ==========================================================
   UI (only runs in a browser)
   ========================================================== */
function initUI() {
  const $ = (id) => document.getElementById(id);
  const SVG_NS = "http://www.w3.org/2000/svg";
  const X_GAP = 56, Y_GAP = 78, PAD = 40;

  const tree = new AdaptiveAVL();
  let busy = false;
  let selectedKey = null;
  let flashKey = null;
  let highlight = emptyHighlight();
  const logEntries = [];

  function emptyHighlight() { return { nodes: new Set(), edges: new Set(), found: null, missed: null }; }

  // ----- activity log -----
  function log(text, kind = "info") {
    logEntries.unshift({ text, kind });
    if (logEntries.length > 60) logEntries.pop();
    $("log").innerHTML = logEntries.map((e) => `<li class="${e.kind}">${e.text}</li>`).join("");
  }

  function say(text, type = "info") {
    const box = $("message");
    box.textContent = text;
    box.className = "message " + type;
  }

  // ----- SVG rendering -----
  function svgEl(name, attrs, parent) {
    const el = document.createElementNS(SVG_NS, name);
    for (const k in attrs) el.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(el);
    return el;
  }

  // in-order x position, depth as y → no overlapping nodes
  function layout(root) {
    const pos = new Map();
    let i = 0;
    (function walk(n, d) {
      if (!n) return;
      walk(n.left, d + 1);
      pos.set(n, { x: PAD + i++ * X_GAP, y: PAD + d * Y_GAP });
      walk(n.right, d + 1);
    })(root, 0);
    return pos;
  }

  function render() {
    const svg = $("tree-svg");
    svg.innerHTML = "";
    if (!tree.root) {
      svg.setAttribute("viewBox", "0 0 600 260");
      const t = svgEl("text", { x: 300, y: 130, class: "empty-text", "text-anchor": "middle" }, svg);
      t.textContent = "Your tree is empty — add some values to begin 🌱";
    } else {
      const pos = layout(tree.root);
      let maxX = 0, maxY = 0;
      pos.forEach((p) => { maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y); });
      svg.setAttribute("viewBox", `0 0 ${maxX + PAD} ${maxY + PAD}`);
      svg.style.minWidth = Math.min(maxX + PAD, 900) * 0.7 + "px";

      // edges first so nodes draw on top
      pos.forEach((p, n) => {
        [n.left, n.right].forEach((c) => {
          if (!c) return;
          const q = pos.get(c);
          const active = highlight.edges.has(n.key + ">" + c.key);
          svgEl("line", { x1: p.x, y1: p.y, x2: q.x, y2: q.y, class: "edge" + (active ? " active" : "") }, svg);
        });
      });

      pos.forEach((p, n) => {
        const cls = ["node"];
        if (n.windowFrequency > HIGH_THRESHOLD) cls.push("hot");
        if (highlight.nodes.has(n.key)) cls.push("visiting");
        if (highlight.found === n.key) cls.push("found");
        if (highlight.missed === n.key) cls.push("missed");
        if (flashKey === n.key) cls.push("promoted");
        if (selectedKey === n.key) cls.push("selected");
        const g = svgEl("g", { class: cls.join(" "), transform: `translate(${p.x},${p.y})` }, svg);
        g.addEventListener("click", () => { selectedKey = n.key; render(); });
        svgEl("circle", { r: 22, class: "node-circle" }, g);
        svgEl("text", { y: 5, "text-anchor": "middle", class: "node-key" }, g).textContent = n.key;
        if (n.windowFrequency > 0) {
          svgEl("circle", { cx: 18, cy: -18, r: 10, class: "badge" }, g);
          svgEl("text", { x: 18, y: -14, "text-anchor": "middle", class: "badge-text" }, g).textContent = n.windowFrequency;
        }
      });
    }
    updateNodeInfo();
    updateWindowUI();
    const err = checkAVL(tree.root);
    const badge = $("avl-badge");
    badge.textContent = err ? "✗ AVL broken: " + err : "✓ Valid AVL tree";
    badge.className = "badge-status " + (err ? "bad" : "good");
  }

  function findNode(key) {
    let c = tree.root;
    while (c && c.key !== key) c = key < c.key ? c.left : c.right;
    return c;
  }

  function updateNodeInfo() {
    const n = selectedKey === null ? null : findNode(selectedKey);
    if (!n) {
      selectedKey = null;
      $("node-info").innerHTML = '<p class="muted">Click a node in the tree to inspect it.</p>';
      return;
    }
    $("node-info").innerHTML = `<dl>
      <dt>Node</dt><dd>${n.key}</dd>
      <dt>Height</dt><dd>${n.height}</dd>
      <dt>Balance factor</dt><dd>${balanceFactor(n)}</dd>
      <dt>Total frequency</dt><dd>${n.totalFrequency}</dd>
      <dt>Window frequency</dt><dd>${n.windowFrequency}</dd>
    </dl>`;
  }

  function updateWindowUI() {
    $("window-count").textContent = `${tree.windowCount} / ${WINDOW_SIZE}`;
    let dots = "";
    for (let i = 0; i < WINDOW_SIZE; i++) dots += `<span class="dot${i < tree.windowCount ? " on" : ""}"></span>`;
    $("window-dots").innerHTML = dots;
  }

  function setControlsDisabled(flag) {
    busy = flag;
    document.querySelectorAll("button").forEach((b) => { b.disabled = flag; });
  }

  // ----- input helpers -----
  function parseInt10(text) {
    const t = text.trim();
    return /^-?\d+$/.test(t) ? Number(t) : null;
  }

  function parseList(text) {
    const tokens = text.split(/[\s,]+/).filter(Boolean);
    const values = [], bad = [];
    tokens.forEach((t) => (/^-?\d+$/.test(t) ? values.push(Number(t)) : bad.push(t)));
    return { values, bad };
  }

  function clearHighlight() { highlight = emptyHighlight(); flashKey = null; }

  // ----- insert (used by Build and Insert) -----
  function insertValue(key) {
    const r = tree.insert(key);
    if (!r.ok) { log(`${key} is already in the tree.`, "warn"); return false; }
    log(`✓ Inserted ${key}`, "ok");
    r.events.forEach((e) => { log(`⟳ AVL rotation: ${e}`, "avl"); $("last-rotation").textContent = e; });
    return true;
  }

  // ----- button handlers -----
  function onBuild() {
    const { values, bad } = parseList($("build-input").value);
    if (!values.length) { say("Enter some whole numbers, like 50, 30, 70, 20, 40.", "warn"); return; }
    tree.reset();
    selectedKey = null; clearHighlight();
    $("last-rotation").textContent = "—";
    log("🌱 Building a new tree", "ok");
    const dups = [];
    values.forEach((v) => { if (!insertValue(v)) dups.push(v); });
    let msg = `Built a tree with ${values.length - dups.length} node(s).`;
    if (dups.length) msg += ` ${dups.join(", ")} ${dups.length > 1 ? "were" : "was"} already in the tree.`;
    if (bad.length) msg += ` Skipped: ${bad.join(", ")}.`;
    say(msg, "ok");
    $("build-input").value = "";
    render();
  }

  function onExample() { $("build-input").value = "50, 30, 70, 20, 40, 60, 80, 10, 25"; onBuild(); }

  function onInsert() {
    const key = parseInt10($("insert-input").value);
    if (key === null) { say("Please enter a whole number to insert.", "warn"); return; }
    clearHighlight();
    if (insertValue(key)) {
      say(`Inserted ${key} into the existing tree.`, "ok");
      flashKey = key; render(); flashKey = null;
    } else say(`${key} is already in the tree.`, "warn");
    $("insert-input").value = "";
    render();
  }

  function onDelete() {
    const key = parseInt10($("delete-input").value);
    if (key === null) { say("Please enter a whole number to delete.", "warn"); return; }
    clearHighlight();
    const r = tree.remove(key);
    if (!r.ok) { say(`${key} isn't in this tree.`, "warn"); log(`${key} isn't in this tree.`, "warn"); return; }
    log(`✓ Deleted ${key}`, "ok");
    r.events.forEach((e) => { log(`⟳ AVL rotation: ${e}`, "avl"); $("last-rotation").textContent = e; });
    say(`Deleted ${key}.` + (r.events.length ? " The tree rebalanced itself." : ""), "ok");
    $("delete-input").value = "";
    render();
  }

  function onSearch() {
    const key = parseInt10($("search-input").value);
    if (key === null) { say("Please enter a whole number to search.", "warn"); return; }
    if (!tree.root) { say("The tree is empty — build it first.", "warn"); return; }
    clearHighlight();
    const r = tree.search(key);
    const pathText = r.path.join(" → ");
    log(`→ Searched ${key}`, "search");

    let html = `<dl><dt>Target</dt><dd>${key}</dd><dt>Path</dt><dd>${pathText}</dd><dt>Search steps</dt><dd>${r.steps}</dd>`;
    if (r.found) {
      html += `<dt>Total frequency</dt><dd>${r.node.totalFrequency}</dd><dt>Window frequency</dt><dd>${r.node.windowFrequency}</dd></dl>`;
      html += `<p class="result good">✓ ${key} found!</p>`;
      log(`→ ${key} found in ${r.steps} step${r.steps > 1 ? "s" : ""}`, "search");
      log(`→ Search window: ${tree.windowCount}/${WINDOW_SIZE}`, "search");
      say(`✓ ${key} found! Search steps: ${r.steps}`, "ok");
    } else {
      html += `</dl><p class="result bad">✗ ${key} not found.</p><p class="muted">Not-found searches don't count toward the window.</p>`;
      log(`→ ${key} not found after ${r.steps} step${r.steps > 1 ? "s" : ""}`, "warn");
      say(`✗ ${key} not found. Search steps: ${r.steps}`, "warn");
    }
    $("search-result").innerHTML = html;
    $("search-input").value = "";

    // animate the path one node at a time, then (if needed) run the adaptive check
    setControlsDisabled(true);
    let i = 0;
    (function step() {
      highlight.nodes.add(r.path[i]);
      if (i > 0) highlight.edges.add(r.path[i - 1] + ">" + r.path[i]);
      if (i === r.path.length - 1) { if (r.found) highlight.found = key; else highlight.missed = r.path[i]; }
      render();
      i++;
      if (i < r.path.length) setTimeout(step, 380);
      else setTimeout(() => finishSearch(r), 500);
    })();
  }

  function finishSearch(r) {
    if (r.windowComplete) doAdaptiveCheck();
    setControlsDisabled(false);
  }

  // ----- adaptive check presentation -----
  function doAdaptiveCheck() {
    clearHighlight();
    log("→ Monitoring window completed", "adaptive");
    const res = tree.runAdaptiveCheck();
    const lines = ["🔎 Time for a quick usage check!"];
    if (res.status === "none") {
      lines.push(`No node has window frequency > ${HIGH_THRESHOLD}. Tree unchanged.`);
      log("→ No node above threshold; tree unchanged", "adaptive");
    } else {
      lines.push(`👀 ${res.key} is getting a lot of attention!`, `Window frequency: ${res.frequency}`);
      log(`→ Node ${res.key} selected for adaptive check (window frequency ${res.frequency})`, "adaptive");
      if (res.status === "root") {
        lines.push(`👑 ${res.key} is already the root. Nothing to move.`);
        log(`→ ${res.key} already at root`, "adaptive");
      } else {
        lines.push(`⚖️ Checking whether ${res.key} can move upward safely...`);
        if (res.status === "safe") {
          lines.push("🚀 Safe move!", `${res.key} moved one level closer to the root while keeping the AVL tree balanced.`);
          log("→ Safe restructuring performed (adaptive rotation)", "adaptive");
          $("last-rotation").textContent = `Adaptive promotion of ${res.key}`;
          flashKey = res.key;
        } else {
          lines.push(`🛑 ${res.key} is popular, but moving it would disturb the AVL balance.`, "The tree stays unchanged.", `(${res.detail})`);
          log(`→ Unsafe: tree unchanged (${res.detail})`, "adaptive");
        }
      }
    }
    lines.push("Window frequencies reset. New window: 0/10.");
    log(`→ Search window reset to 0/${WINDOW_SIZE}`, "adaptive");
    $("adaptive-box").innerHTML = lines.map((l) => `<p>${l}</p>`).join("");
    render();
    if (flashKey !== null) setTimeout(() => { flashKey = null; render(); }, 1800);
  }

  function onReset() {
    tree.reset();
    selectedKey = null; clearHighlight();
    logEntries.length = 0;
    $("log").innerHTML = "";
    ["build-input", "insert-input", "search-input", "delete-input"].forEach((id) => { $(id).value = ""; });
    $("search-result").innerHTML = '<p class="muted">Search for a value to see its path and step count.</p>';
    $("adaptive-box").innerHTML = '<p class="muted">Waiting for 10 successful searches…</p>';
    $("last-rotation").textContent = "—";
    say("Tree reset. Start by building a new one!", "info");
    render();
  }

  // wire up
  $("build-btn").addEventListener("click", onBuild);
  $("example-btn").addEventListener("click", onExample);
  $("insert-btn").addEventListener("click", onInsert);
  $("search-btn").addEventListener("click", onSearch);
  $("delete-btn").addEventListener("click", onDelete);
  $("reset-btn").addEventListener("click", onReset);
  [["build-input", onBuild], ["insert-input", onInsert], ["search-input", onSearch], ["delete-input", onDelete]]
    .forEach(([id, fn]) => $(id).addEventListener("keydown", (e) => { if (e.key === "Enter" && !busy) fn(); }));

  onReset();
}

if (typeof document !== "undefined") initUI();
if (typeof module !== "undefined") module.exports = { AdaptiveAVL, Node, checkAVL, evaluatePromotion, WINDOW_SIZE };