// client.js

// ─── Global State and References ───────────────────────────────────────────────

let allFiles = [];
let currentPage = 1;
const pageSize = 10;

let rawFlat = null; // full ConvertFlat graph object { nodes: [...], edges: [...] }
let rawFiltered = null; // full FilterFlat graph object { nodes: [...], edges: [...] }

let undirectedAdjFlat = null; // Map<nodeId, Set<neighborIds>> for rawFlat
let undirectedAdjFiltered = null; // Map<nodeId, Set<neighborIds>> for rawFiltered
let directedChildrenFlat = null; // Map<nodeId, Array<childIds>> for rawFlat
let directedChildrenFiltered = null; // Map<nodeId, Array<childIds>> for rawFiltered
let directedParentsFlat = null; // Map<nodeId, Array<parentIds>> for rawFlat (if needed)

let removedNodeIds = []; // node IDs present in rawFlat but missing in rawFiltered
let removedEdges = []; // edges present in rawFlat but missing in rawFiltered

let cy1 = null,
  cy2 = null,
  cy3 = null; // Cytoscape instances

let selectedFunctionId = null; // function selected from dropdown, or null for full file
let selectedNodeId = null; // node clicked in graph
let lastHoveredId = null; // string like "n12"

// DOM elements
const searchInput = document.getElementById("search");
const btnSearch = document.getElementById("btnSearch");
const resultsList = document.getElementById("results");
const pagination = document.getElementById("pagination");
const infoDiv = document.getElementById("info");
const dropdownWrapper = document.getElementById("functionDropdownWrapper");

// Cytoscape base style
const baseStyle = [
  {
    selector: "node[deleted = 'true'], edge[deleted = 'true']",
    style: { "pointer-events": "none", opacity: 0.3 },
  },
  {
    selector: "node",
    style: {
      "background-color": (ele) => (ele.data("deleted") ? "salmon" : "lightblue"),
      "border-color": (ele) => (ele.data("deleted") ? "red" : "black"),
      "border-width": 2,
      label: "data(label)",
      "font-size": 6,
      "text-valign": "center",
      "text-halign": "center",
      width: 15,
      height: 15,
      opacity: 1,
    },
  },
  {
    selector: "edge",
    style: {
      "line-color": (ele) => (ele.data("deleted") ? "red" : "gray"),
      "line-style": (ele) => (ele.data("deleted") ? "dashed" : "solid"),
      width: 1,
      opacity: 1,
    },
  },
  {
    selector: "node.dimmed, edge.dimmed",
    style: { opacity: 0.2 },
  },
  {
    selector: "node.highlighted",
    style: {
      "background-color": "#8f8",
      "border-color": "green",
    },
  },
  {
    selector: "edge.highlighted",
    style: {
      "line-color": "green",
      "line-style": "solid",
    },
  },
  {
    selector: "node.hover-info",
    style: {
      "background-color": "#ffff99",
      "border-color": "#cccc00",
      "border-width": 3,
    },
  },
];

// ─── Initialization ────────────────────────────────────────────────────────────

function init() {
  btnSearch.addEventListener("click", fetchAndRenderPage);
  searchInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      fetchAndRenderPage();
    }
  });
  renderPage(); // initial empty
}

document.addEventListener("DOMContentLoaded", init);

// ─── Search & Pagination ───────────────────────────────────────────────────────

function fetchAndRenderPage() {
  const q = searchInput.value.trim();
  fetch(`/api/search?q=${encodeURIComponent(q)}`)
    .then((res) => {
      if (!res.ok) throw new Error(`Search failed: ${res.status}`);
      return res.json();
    })
    .then(({ files }) => {
      if (!Array.isArray(files)) throw new Error("Invalid response: expected { files: [...] }");
      allFiles = files;
      currentPage = 1;
      renderPage();
    })
    .catch((err) => {
      console.error("Search error:", err);
      resultsList.innerHTML = "<li>Error fetching results</li>";
      pagination.innerHTML = "";
    });
}

function renderPage() {
  const start = (currentPage - 1) * pageSize;
  const pageFiles = allFiles.slice(start, start + pageSize);

  if (pageFiles.length) {
    resultsList.innerHTML = pageFiles.map((fn) => `<li class="item">${fn}</li>`).join("");
  } else {
    resultsList.innerHTML = "<li>No results</li>";
  }

  document.querySelectorAll("#results .item").forEach((el, i) => {
    el.onclick = () => loadAndRender(pageFiles[i]);
  });

  const total = Math.ceil(allFiles.length / pageSize);
  if (total > 1) {
    pagination.innerHTML = `
      <button id="prev" ${currentPage === 1 ? "disabled" : ""}>Prev</button>
      <span> Page ${currentPage} of ${total} </span>
      <button id="next" ${currentPage === total ? "disabled" : ""}>Next</button>
    `;
    pagination.querySelector("#prev").onclick = () => {
      if (currentPage > 1) {
        currentPage--;
        renderPage();
      }
    };
    pagination.querySelector("#next").onclick = () => {
      if (currentPage < total) {
        currentPage++;
        renderPage();
      }
    };
  } else {
    pagination.innerHTML = "";
  }

  clearAllGraphsAndInfo();
}

function clearAllGraphsAndInfo() {
  ["graph1", "graph2", "graph3"].forEach((id) => {
    const ctr = document.getElementById(id);
    if (ctr) ctr.innerHTML = "";
  });
  infoDiv.textContent = "";
  selectedFunctionId = null;
  selectedNodeId = null;
  lastHoveredId = null;
  if (dropdownWrapper) dropdownWrapper.innerHTML = "";
}

// ─── Load & Render Graphs for a Selected File ─────────────────────────────────

async function loadAndRender(base) {
  // Reset state
  rawFlat = null;
  rawFiltered = null;
  undirectedAdjFlat = null;
  undirectedAdjFiltered = null;
  directedChildrenFlat = null;
  directedChildrenFiltered = null;
  directedParentsFlat = null;
  removedNodeIds = [];
  removedEdges = [];
  selectedFunctionId = null;
  selectedNodeId = null;
  lastHoveredId = null;
  infoDiv.textContent = "";
  if (dropdownWrapper) dropdownWrapper.innerHTML = "";

  // Fetch graphs
  let res;
  try {
    res = await fetch(`/api/graphs/${encodeURIComponent(base)}`);
    if (!res.ok) throw new Error(`Failed to load graphs: ${res.status}`);
  } catch (err) {
    alert(`Error fetching graphs: ${err}`);
    return;
  }
  let data;
  try {
    data = await res.json();
  } catch (err) {
    console.error("Invalid JSON:", err);
    alert("Server returned invalid data");
    return;
  }
  const { convertFlat: flatObj, filterFlat: filteredObj } = data;
  if (!flatObj || !filteredObj || !Array.isArray(flatObj.nodes) || !Array.isArray(filteredObj.nodes)) {
    console.error("Unexpected graph data:", data);
    alert("Server returned invalid graph structure");
    return;
  }
  rawFlat = flatObj;
  rawFiltered = filteredObj;

  // Build adjacency maps:
  undirectedAdjFlat = buildUndirectedAdjacencyMap(rawFlat.nodes, rawFlat.edges);
  undirectedAdjFiltered = buildUndirectedAdjacencyMap(rawFiltered.nodes, rawFiltered.edges);
  directedChildrenFlat = buildDirectedChildrenMap(rawFlat.nodes, rawFlat.edges);
  directedChildrenFiltered = buildDirectedChildrenMap(rawFiltered.nodes, rawFiltered.edges);
  directedParentsFlat = buildDirectedParentMap(rawFlat.nodes, rawFlat.edges);

  // Compute deletions: nodes in flat but not in filtered
  {
    const flatSet = new Set(rawFlat.nodes.map((n) => n.id));
    const filtSet = new Set(rawFiltered.nodes.map((n) => n.id));
    removedNodeIds = [...flatSet].filter((id) => !filtSet.has(id));
    const filtEdgeSet = new Set(rawFiltered.edges.map((e) => `${e.from},${e.to}`));
    removedEdges = rawFlat.edges.filter((e) => !filtEdgeSet.has(`${e.from},${e.to}`));
  }

  // Initialize Cytoscape instances empty
  ["graph1", "graph2", "graph3"].forEach((id) => {
    const ctr = document.getElementById(id);
    if (ctr) ctr.innerHTML = "";
  });
  const layoutOpts = { name: "breadthfirst", directed: true, padding: 10, spacingFactor: 1.5 };
  cy1 = cytoscape({
    container: document.getElementById("graph1"),
    elements: [],
    layout: layoutOpts,
    style: baseStyle,
  });
  cy2 = cytoscape({
    container: document.getElementById("graph2"),
    elements: [],
    layout: layoutOpts,
    style: baseStyle,
  });
  cy3 = cytoscape({
    container: document.getElementById("graph3"),
    elements: [],
    layout: layoutOpts,
    style: baseStyle.map((rule) => {
      if (rule.selector === "node") {
        return {
          selector: "node",
          style: { ...rule.style, width: 30, height: 30, "font-size": 10 },
        };
      }
      return rule;
    }),
  });

  // Attach event handlers
  attachGraphEventHandlers();

  // Detect TranslationUnit and its FunctionDefinition children
  let functionNodes = [];
  try {
    const tuNodes = rawFlat.nodes.filter((n) => n.nodeType === "TranslationUnit");
    let candidates = [];
    if (tuNodes.length > 0) {
      const tu = tuNodes[0];
      const neigh = undirectedAdjFlat.get(tu.id) || new Set();
      candidates = rawFlat.nodes.filter((n) => neigh.has(n.id) && n.nodeType === "FunctionDefinition");
    }
    if (candidates.length === 0) {
      candidates = rawFlat.nodes.filter((n) => n.nodeType === "FunctionDefinition");
    }
    functionNodes = candidates;
  } catch (err) {
    console.warn("Error detecting functions:", err);
    functionNodes = rawFlat.nodes.filter((n) => n.nodeType === "FunctionDefinition");
  }

  // Populate dropdown if functions exist
  if (functionNodes.length > 0) {
    populateFunctionDropdown(functionNodes, (fid) => {
      // === NEW: skip if same as current to avoid unnecessary re-render/shrink ===
      if (fid === selectedFunctionId) {
        return;
      }
      selectedFunctionId = fid;
      selectedNodeId = null;
      lastHoveredId = null;
      infoDiv.textContent = "";
      renderConvertFlat(fid);
      renderFilterFlat(fid);
      // clear zoom panel
      if (cy3) cy3.elements().remove();
    });
  } else {
    if (dropdownWrapper) dropdownWrapper.innerHTML = "";
  }

  // Initial render: full graphs
  renderConvertFlat(null);
  renderFilterFlat(null);
  if (cy3) cy3.elements().remove();
}

// ─── Build adjacency maps ────────────────────────────────────────────────────────

function buildUndirectedAdjacencyMap(nodesArr, edgesArr) {
  const map = new Map();
  for (const n of nodesArr) {
    map.set(n.id, new Set());
  }
  for (const e of edgesArr) {
    if (map.has(e.from) && map.has(e.to)) {
      map.get(e.from).add(e.to);
      map.get(e.to).add(e.from);
    }
  }
  return map;
}

function buildDirectedChildrenMap(nodesArr, edgesArr) {
  const map = new Map();
  for (const n of nodesArr) {
    map.set(n.id, []);
  }
  for (const e of edgesArr) {
    if (map.has(e.from) && map.has(e.to)) {
      map.get(e.from).push(e.to);
    }
  }
  return map;
}

function buildDirectedParentMap(nodesArr, edgesArr) {
  const map = new Map();
  for (const n of nodesArr) {
    map.set(n.id, []);
  }
  for (const e of edgesArr) {
    if (map.has(e.to) && map.has(e.from)) {
      map.get(e.to).push(e.from);
    }
  }
  return map;
}

// ─── Extract directed subgraph (all descendants) ────────────────────────────────

function extractDirectedSubgraph(rawObj, childrenMap, rootId) {
  if (rootId == null) {
    return {
      nodes: rawObj.nodes.slice(),
      edges: rawObj.edges.slice(),
    };
  }
  const visited = new Set([rootId]);
  const stack = [rootId];
  while (stack.length > 0) {
    const u = stack.pop();
    const children = childrenMap.get(u) || [];
    for (const v of children) {
      if (!visited.has(v)) {
        visited.add(v);
        stack.push(v);
      }
    }
  }
  const subNodes = rawObj.nodes.filter((n) => visited.has(n.id));
  const subEdges = rawObj.edges.filter((e) => visited.has(e.from) && visited.has(e.to));
  return { nodes: subNodes, edges: subEdges };
}

// ─── Make Cytoscape elements from nodes & edges ────────────────────────────────

function makeElements(nodesArr, edgesArr) {
  const elements = [];
  for (const n of nodesArr) {
    elements.push({
      data: {
        id: `n${n.id}`,
        label: `${n.id}:${n.nodeType}`,
        info: n,
        deleted: removedNodeIds.includes(n.id),
      },
    });
  }
  for (const e of edgesArr) {
    elements.push({
      data: {
        id: `e${e.from}_${e.to}`,
        source: `n${e.from}`,
        target: `n${e.to}`,
        deleted: removedEdges.some((r) => r.from === e.from && r.to === e.to),
      },
    });
  }
  return elements;
}

// ─── Render ConvertFlat ────────────────────────────────────────────────────────

function renderConvertFlat(funcId) {
  if (!cy1 || !rawFlat) return;
  cy1.elements().remove();
  let toShow;
  if (funcId == null) {
    toShow = { nodes: rawFlat.nodes.slice(), edges: rawFlat.edges.slice() };
  } else {
    toShow = extractDirectedSubgraph(rawFlat, directedChildrenFlat, funcId);
  }
  const elems = makeElements(toShow.nodes, toShow.edges);
  cy1.add(elems);
  cy1.layout({ name: "breadthfirst", directed: true, padding: 10, spacingFactor: 1.5 }).run();
  cy1.fit();

  // If a function subtree is shown, enlarge node sizes:
  if (funcId != null) {
    cy1.nodes().forEach((ele) => {
      ele.style({
        width: 30,
        height: 30,
        "font-size": 10,
      });
    });
  } else {
    // restore default small size
    cy1.nodes().forEach((ele) => {
      ele.style({
        width: 15,
        height: 15,
        "font-size": 6,
      });
    });
  }
}

// ─── Render FilterFlat ─────────────────────────────────────────────────────────

function renderFilterFlat(funcId) {
  if (!cy2 || !rawFiltered) return;
  cy2.elements().remove();
  let toShow;
  if (funcId == null) {
    toShow = { nodes: rawFiltered.nodes.slice(), edges: rawFiltered.edges.slice() };
  } else {
    // First get the full descendant set from rawFlat
    const descRaw = extractDirectedSubgraph(rawFlat, directedChildrenFlat, funcId);
    const descIds = new Set(descRaw.nodes.map((n) => n.id));
    // Now pick from rawFiltered only those nodes in descIds
    const nodesToShow = rawFiltered.nodes.filter((n) => descIds.has(n.id));
    // For edges, include only those in rawFiltered whose endpoints are both in descIds
    const edgesToShow = rawFiltered.edges.filter((e) => descIds.has(e.from) && descIds.has(e.to));
    toShow = { nodes: nodesToShow, edges: edgesToShow };
  }
  const elems = makeElements(toShow.nodes, toShow.edges);
  cy2.add(elems);
  cy2.layout({ name: "breadthfirst", directed: true, padding: 10, spacingFactor: 1.5 }).run();
  cy2.fit();

  // Optionally: enlarge node sizes in FilterFlat as well when a function is selected
  if (funcId != null) {
    cy2.nodes().forEach((ele) => {
      ele.style({
        width: 30,
        height: 30,
        "font-size": 10,
      });
    });
  } else {
    cy2.nodes().forEach((ele) => {
      ele.style({
        width: 15,
        height: 15,
        "font-size": 6,
      });
    });
  }
}

// ─── Render Zoomed Subgraph (filtered connected component) ────────────────────

function renderZoomedFilteredComponent(nodeIds) {
  if (!cy3 || !rawFiltered) return;
  cy3.elements().remove();
  if (!nodeIds || nodeIds.length === 0) {
    return;
  }
  const s = new Set(nodeIds);
  // Use rawFiltered.nodes/edges
  const nodesToShow = rawFiltered.nodes.filter((n) => s.has(n.id));
  const edgesToShow = rawFiltered.edges.filter((e) => s.has(e.from) && s.has(e.to));
  const elems = makeElements(nodesToShow, edgesToShow);
  cy3.add(elems);
  cy3.layout({ name: "breadthfirst", directed: true, padding: 10, spacingFactor: 1.5 }).run();
  cy3.fit();
}

// ─── Populate Function Dropdown ─────────────────────────────────────────────────

function populateFunctionDropdown(functionNodes, onChangeCallback) {
  if (!dropdownWrapper) {
    console.error("Dropdown wrapper (#functionDropdownWrapper) not found");
    return;
  }
  dropdownWrapper.innerHTML = "";

  const label = document.createElement("label");
  label.textContent = "Function: ";
  label.setAttribute("for", "functionDropdown");
  label.style.marginRight = "0.5rem";
  dropdownWrapper.appendChild(label);

  const select = document.createElement("select");
  select.id = "functionDropdown";

  // Option: Full Graph
  const optFull = document.createElement("option");
  optFull.value = "";
  optFull.textContent = "Full Graph";
  select.appendChild(optFull);

  // Each function
  functionNodes.forEach((fnNode) => {
    const opt = document.createElement("option");
    opt.value = String(fnNode.id);
    let disp = `id:${fnNode.id}`;
    // try to show a name if available
    if (fnNode.name) {
      disp += ` (${fnNode.name})`;
    } else if (fnNode.info && fnNode.info.name) {
      disp += ` (${fnNode.info.name})`;
    } else if (fnNode.info && fnNode.info.declname) {
      disp += ` (${fnNode.info.declname})`;
    }
    opt.textContent = disp;
    select.appendChild(opt);
  });

  dropdownWrapper.appendChild(select);

  select.addEventListener("change", () => {
    const val = select.value;
    let fid = null;
    if (val !== "") {
      const num = parseInt(val, 10);
      if (!isNaN(num)) fid = num;
    }
    onChangeCallback(fid);
  });
}

// ─── Attach Cytoscape Event Handlers ────────────────────────────────────────────

function attachGraphEventHandlers() {
  function resetCyClasses(cy) {
    if (!cy) return;
    cy.elements().removeClass("hover-info highlighted dimmed");
  }

  // Highlight in cy1 or cy2: undirected BFS on filtered adjacency, restricted to displayed nodes
  // Returns an array of numeric node IDs in that connected component
  function highlightFilteredComponent(cy, rootNumId) {
    resetCyClasses(cy);
    // Determine displayed node IDs in this cy instance
    const displayedIds = new Set(cy.nodes().map((ele) => parseInt(ele.id().slice(1), 10)));
    // BFS on undirectedAdjFiltered, restricted to displayedIds
    const visited = new Set([rootNumId]);
    const queue = [rootNumId];
    while (queue.length > 0) {
      const u = queue.shift();
      const neigh = undirectedAdjFiltered.get(u) || new Set();
      for (const v of neigh) {
        if (!visited.has(v) && displayedIds.has(v)) {
          visited.add(v);
          queue.push(v);
        }
      }
    }
    // Apply highlight/dimmed classes
    const keepIds = new Set(Array.from(visited).map((id) => `n${id}`));
    cy.elements().forEach((ele) => {
      if (keepIds.has(ele.id())) ele.addClass("highlighted");
      else ele.addClass("dimmed");
    });
    return Array.from(visited);
  }

  function clearSelection() {
    selectedNodeId = null;
    lastHoveredId = null;
    [cy1, cy2, cy3].forEach((cy) => {
      if (cy) cy.elements().removeClass("hover-info highlighted dimmed");
    });
    if (cy3) cy3.elements().remove();
    infoDiv.textContent = "";
  }

  function selectNode(numId) {
    selectedNodeId = numId;
    lastHoveredId = null;
    [cy1, cy2, cy3].forEach((cy) => {
      if (cy) cy.elements().removeClass("hover-info");
    });
    // Highlight in cy1 & cy2 based on filtered adjacency
    let componentIds = [];
    if (cy1) {
      componentIds = highlightFilteredComponent(cy1, numId);
    }
    if (cy2) {
      highlightFilteredComponent(cy2, numId);
    }
    // Render Zoomed Subgraph as that filtered component
    renderZoomedFilteredComponent(componentIds);
    // Render Node Info
    renderNodeInfo(numId);
  }

  function renderNodeInfo(numId) {
    if (!rawFlat) {
      infoDiv.textContent = "";
      return;
    }
    const nodeInfo = rawFlat.nodes.find((n) => n.id === numId);
    if (nodeInfo) {
      const { children, ...props } = nodeInfo;
      infoDiv.textContent = JSON.stringify(props, null, 2);
    } else {
      infoDiv.textContent = "";
    }
  }

  function handleMainTap(evt) {
    const ele = evt.target;
    const d = ele.data();
    // clear previous hover highlight
    if (lastHoveredId) {
      [cy1, cy2, cy3].forEach((cy) => {
        if (!cy) return;
        const prev = cy.$(`#${lastHoveredId}`);
        if (prev) prev.removeClass("hover-info");
      });
      lastHoveredId = null;
    }
    // If background or deleted, clear selection
    if (!d || d.deleted) {
      return clearSelection();
    }
    // If already selected subtree: clear
    if (selectedNodeId !== null && (ele.hasClass("highlighted") || ele.isEdge())) {
      return clearSelection();
    }
    // Otherwise new select
    let idStr;
    if (ele.isEdge && ele.isEdge()) {
      idStr = d.source; // edge tapped: take source
    } else {
      idStr = ele.id();
    }
    const numId = parseInt(idStr.slice(1), 10);
    if (!isNaN(numId)) {
      selectNode(numId);
    }
  }

  function handleZoomTap(evt) {
    const ele = evt.target;
    const d = ele.data();
    if (!d || d.deleted) return;
    const numId = parseInt(d.id.slice(1), 10);
    if (!isNaN(numId)) {
      // Only render Node Info; zoom handled by selectNode
      renderNodeInfo(numId);
    }
  }

  function handleHover(evt) {
    const ele = evt.target;
    const dInfo = ele.data().info;
    if (!dInfo) return;
    if (lastHoveredId) {
      [cy1, cy2, cy3].forEach((cy) => {
        if (!cy) return;
        const prev = cy.$(`#${lastHoveredId}`);
        if (prev) prev.removeClass("hover-info");
      });
    }
    lastHoveredId = ele.id();
    [cy1, cy2, cy3].forEach((cy) => {
      if (!cy) return;
      const cur = cy.$(`#${lastHoveredId}`);
      if (cur) cur.addClass("hover-info");
    });
    const { children, ...props } = dInfo;
    infoDiv.textContent = JSON.stringify(props, null, 2);
  }

  function handleHoverOut() {
    if (lastHoveredId) {
      [cy1, cy2, cy3].forEach((cy) => {
        if (!cy) return;
        const prev = cy.$(`#${lastHoveredId}`);
        if (prev) prev.removeClass("hover-info");
      });
      lastHoveredId = null;
    }
    if (selectedNodeId === null) {
      infoDiv.textContent = "";
    }
  }

  // Attach to cy1 & cy2
  [cy1, cy2].forEach((cy) => {
    if (cy) {
      cy.on("tap", "node, edge", handleMainTap).on("mouseover", "node", handleHover).on("mouseout", "node", handleHoverOut);
    }
  });
  // Attach to cy3
  if (cy3) {
    cy3.on("tap", "node", handleZoomTap).on("mouseover", "node", handleHover).on("mouseout", "node", handleHoverOut);
  }
}
