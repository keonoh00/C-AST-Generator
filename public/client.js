// public/client.js

const searchInput = document.getElementById("search");
const btnSearch = document.getElementById("btnSearch");
const resultsList = document.getElementById("results");
const pagination = document.getElementById("pagination");
const infoDiv = document.getElementById("info");

let allFiles = [];
let currentPage = 1;
const pageSize = 10;

let selectedId = null;
let lastHoveredId = null;

// Cytoscape instances
let cy1, cy2, cy3;

btnSearch.addEventListener("click", fetchAndRenderPage);

function fetchAndRenderPage() {
  const q = searchInput.value.trim();
  fetch(`/api/search?q=${encodeURIComponent(q)}`)
    .then((r) => r.json())
    .then(({ files }) => {
      allFiles = files;
      currentPage = 1;
      renderPage();
    })
    .catch((err) => {
      console.error(err);
      resultsList.innerHTML = "<li>Error fetching results</li>";
      pagination.innerHTML = "";
    });
}

function renderPage() {
  const start = (currentPage - 1) * pageSize;
  const pageFiles = allFiles.slice(start, start + pageSize);

  resultsList.innerHTML = pageFiles.length ? pageFiles.map((fn) => `<li class="item">${fn}</li>`).join("") : "<li>No results</li>";

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
      currentPage--;
      renderPage();
    };
    pagination.querySelector("#next").onclick = () => {
      currentPage++;
      renderPage();
    };
  } else {
    pagination.innerHTML = "";
  }

  ["graph1", "graph2", "graph3"].forEach((id) => {
    const ctr = document.getElementById(id);
    if (ctr) ctr.innerHTML = "";
  });
  infoDiv.textContent = "";
  selectedId = null;
  lastHoveredId = null;
}

async function loadAndRender(base) {
  const resp = await fetch(`/api/graphs/${encodeURIComponent(base)}`);
  if (!resp.ok) {
    alert(`Failed to load graphs: ${resp.status}`);
    return;
  }
  const { convertFlat: flat, filterFlat: filtered } = await resp.json();

  // detect deletions
  const flatIds = new Set(flat.nodes.map((n) => n.id));
  const filtIds = new Set(filtered.nodes.map((n) => n.id));
  const removedNodeIds = [...flatIds].filter((id) => !filtIds.has(id));
  const filtEdgeSet = new Set(filtered.edges.map((e) => `${e.from},${e.to}`));
  const removedEdges = flat.edges.filter((e) => !filtEdgeSet.has(`${e.from},${e.to}`));

  function makeElements(nodes, edges) {
    return [
      ...nodes.map((n) => ({
        data: {
          id: `n${n.id}`,
          label: `${n.id}:${n.nodeType}`,
          info: n,
          deleted: removedNodeIds.includes(n.id),
        },
      })),
      ...edges.map((e) => ({
        data: {
          id: `e${e.from}_${e.to}`,
          source: `n${e.from}`,
          target: `n${e.to}`,
          deleted: removedEdges.some((r) => r.from === e.from && r.to === e.to),
        },
      })),
    ];
  }

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

  ["graph1", "graph2", "graph3"].forEach((id) => {
    const ctr = document.getElementById(id);
    if (ctr) ctr.innerHTML = "";
  });
  infoDiv.textContent = "";

  cy1 = cytoscape({
    container: document.getElementById("graph1"),
    elements: makeElements(flat.nodes, flat.edges),
    layout: { name: "breadthfirst", directed: true, padding: 10 },
    style: baseStyle,
  });
  cy2 = cytoscape({
    container: document.getElementById("graph2"),
    elements: makeElements(filtered.nodes, filtered.edges),
    layout: { name: "breadthfirst", directed: true, padding: 10 },
    style: baseStyle,
  });
  cy3 = cytoscape({
    container: document.getElementById("graph3"),
    elements: [],
    layout: { name: "breadthfirst", directed: true, padding: 10 },
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

  function resetCy(cy) {
    cy.elements().removeClass("hover-info highlighted dimmed");
  }

  function highlightSubgraph(cy, rootId) {
    resetCy(cy);
    const live = cy.elements().filter((ele) => !ele.data("deleted"));
    const bfs = live.bfs({ root: `#n${rootId}`, visit: () => {}, directed: false });
    const keep = new Set(bfs.path.map((ele) => ele.id()));
    cy.elements().forEach((ele) => {
      if (keep.has(ele.id())) ele.addClass("highlighted");
      else ele.addClass("dimmed");
    });
    return bfs.path;
  }

  function clearSelection() {
    selectedId = null;
    lastHoveredId = null;
    [cy1, cy2, cy3].forEach((cy) => {
      resetCy(cy);
      cy.elements().removeClass("hover-info");
    });
    cy3.elements().remove();
    infoDiv.textContent = "";
  }

  function selectNode(numId) {
    lastHoveredId = null;
    [cy1, cy2, cy3].forEach((cy) => cy.elements().removeClass("hover-info"));

    selectedId = numId;
    const path1 = highlightSubgraph(cy1, numId);
    highlightSubgraph(cy2, numId);

    cy3.elements().remove();
    cy3.add(path1.map((ele) => ele.json()));
    cy3.layout({ name: "breadthfirst", directed: true, padding: 10 }).run();
    cy3.fit();

    const nodeInfo = flat.nodes.find((n) => n.id === numId);
    const { children, ...props } = nodeInfo;
    infoDiv.textContent = JSON.stringify(props, null, 2);
  }

  // ←─── **UPDATED** ───→
  function handleMainTap(evt) {
    const ele = evt.target;
    const d = ele.data();

    // clear any hover highlight
    if (lastHoveredId) {
      [cy1, cy2, cy3].forEach((cy) => cy.$(`#${lastHoveredId}`).removeClass("hover-info"));
      lastHoveredId = null;
    }

    // if nothing or deleted tapped → clear
    if (!d || d.deleted) {
      return clearSelection();
    }

    // if we already have a selection, and the tapped element is part of that highlighted subgraph,
    // then *clear* the selection
    if (selectedId !== null && (ele.hasClass("highlighted") || ele.isEdge())) {
      return clearSelection();
    }

    // otherwise treat as a new select
    const idStr = ele.isEdge() ? d.source : d.id;
    const numId = parseInt(idStr.slice(1), 10);
    selectNode(numId);
  }
  // ←─── **END UPDATE** ───→

  function handleZoomTap(evt) {
    const d = evt.target.data();
    if (!d || d.deleted) return;
    const numId = parseInt(d.id.slice(1), 10);
    const nodeInfo = flat.nodes.find((n) => n.id === numId);
    const { children, ...props } = nodeInfo;
    infoDiv.textContent = JSON.stringify(props, null, 2);
  }

  function handleHover(evt) {
    const ele = evt.target;
    const d = ele.data().info;
    if (!d) return;
    if (lastHoveredId) {
      [cy1, cy2, cy3].forEach((cy) => cy.$(`#${lastHoveredId}`).removeClass("hover-info"));
    }
    lastHoveredId = ele.id();
    [cy1, cy2, cy3].forEach((cy) => cy.$(`#${lastHoveredId}`).addClass("hover-info"));
    const { children, ...props } = d;
    infoDiv.textContent = JSON.stringify(props, null, 2);
  }

  function handleHoverOut() {
    if (lastHoveredId) {
      [cy1, cy2, cy3].forEach((cy) => cy.$(`#${lastHoveredId}`).removeClass("hover-info"));
      lastHoveredId = null;
    }
    if (selectedId === null) infoDiv.textContent = "";
  }

  [cy1, cy2].forEach((cy) => {
    cy.on("tap", "node, edge", handleMainTap).on("mouseover", "node", handleHover).on("mouseout", "node", handleHoverOut);
  });
  cy3.on("tap", "node", handleZoomTap).on("mouseover", "node", handleHover).on("mouseout", "node", handleHoverOut);
}
