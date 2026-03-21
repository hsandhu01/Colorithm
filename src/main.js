import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { AudioEngine } from "./audio.js";

const ROWS = 10;
const COLS = 7;
const CELL_SIZE = 1.12;
const BOARD_WIDTH = COLS * CELL_SIZE;
const BOARD_HEIGHT = ROWS * CELL_SIZE;
const BLOCK_DEPTH = 0.74;
const STORAGE_KEY = "colorithm-best-score";

const COLORS = [
  { id: "dragonfruit", label: "Dragonfruit", hex: 0xff4da6, emissive: 0x631340, css: "#ff4da6" },
  { id: "citrine", label: "Citrine", hex: 0xffbd3d, emissive: 0x6b4210, css: "#ffbd3d" },
  { id: "mint", label: "Mint Nova", hex: 0x56f0d6, emissive: 0x145248, css: "#56f0d6" },
  { id: "azure", label: "Azure Pop", hex: 0x54a8ff, emissive: 0x173f78, css: "#54a8ff" },
  { id: "grape", label: "Grape Flux", hex: 0xc276ff, emissive: 0x4f1f7c, css: "#c276ff" },
  { id: "lime", label: "Lime Shock", hex: 0xc1ff5b, emissive: 0x486715, css: "#c1ff5b" }
];

const SHAPES = [
  { id: "dot", name: "Pulse", copy: "Single spark", cells: [[0, 0]] },
  { id: "duo", name: "Ribbon", copy: "Tight link", cells: [[0, 0], [1, 0]] },
  { id: "line3", name: "Comet", copy: "Long setup", cells: [[0, 0], [1, 0], [2, 0]] },
  { id: "line4", name: "Laser", copy: "Big sweep", cells: [[0, 0], [1, 0], [2, 0], [3, 0]] },
  { id: "square", name: "Prism", copy: "Compact burst", cells: [[0, 0], [1, 0], [0, 1], [1, 1]] },
  { id: "corner", name: "Hook", copy: "Sharp pivot", cells: [[0, 0], [0, 1], [1, 1]] },
  { id: "step", name: "Glide", copy: "Staggered line", cells: [[0, 0], [1, 0], [1, 1], [2, 1]] },
  { id: "tee", name: "Crown", copy: "Cluster bait", cells: [[0, 0], [1, 0], [2, 0], [1, 1]] },
  { id: "l4", name: "Jolt", copy: "Corner sweep", cells: [[0, 0], [0, 1], [0, 2], [1, 2]] },
  { id: "fork", name: "Bloom", copy: "Split pressure", cells: [[1, 0], [0, 1], [1, 1], [2, 1]] }
];

const canvas = document.querySelector("#app");
const topUi = document.querySelector(".top-ui");
const lowerUi = document.querySelector(".lower-ui");
const scoreValue = document.querySelector("#scoreValue");
const bestValue = document.querySelector("#bestValue");
const comboValue = document.querySelector("#comboValue");
const pieceTray = document.querySelector("#pieceTray");
const statusText = document.querySelector("#statusText");
const heroPanel = document.querySelector(".hero");
const scoreboardPanel = document.querySelector(".scoreboard");
const trayPanel = document.querySelector(".tray-panel");
const sidePanel = document.querySelector(".side-panel");
const rotateLeftButton = document.querySelector("#rotateLeftButton");
const rotateRightButton = document.querySelector("#rotateRightButton");
const soundButton = document.querySelector("#soundButton");
const newRunButton = document.querySelector("#newRunButton");
const startButton = document.querySelector("#startButton");
const startModal = document.querySelector("#startModal");

const audio = new AudioEngine();
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const searchParams = new URL(window.location.href).searchParams;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x060d17);
scene.fog = new THREE.FogExp2(0x050912, 0.045);

const camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(0.26, 2.12, 17.2);

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true,
  powerPreference: "high-performance"
});
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.18;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(
  new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.65, 0.9, 0.18)
);

const boardGroup = new THREE.Group();
boardGroup.position.set(0.68, -0.96, 0);
boardGroup.rotation.x = -0.28;
scene.add(boardGroup);

const floatingGroup = new THREE.Group();
scene.add(floatingGroup);

const particleGroup = new THREE.Group();
scene.add(particleGroup);

const backgroundRing = new THREE.Mesh(
  new THREE.TorusGeometry(9.5, 0.28, 24, 200),
  new THREE.MeshBasicMaterial({
    color: 0x2de7d9,
    transparent: true,
    opacity: 0.08
  })
);
backgroundRing.rotation.x = Math.PI * 0.42;
backgroundRing.rotation.y = Math.PI * 0.15;
backgroundRing.position.set(4.1, 0.28, -12);
backgroundRing.scale.setScalar(1.16);
scene.add(backgroundRing);

const blockGeometry = new RoundedBoxGeometry(0.88, 0.88, BLOCK_DEPTH, 6, 0.18);
const coreGeometry = new RoundedBoxGeometry(0.54, 0.54, BLOCK_DEPTH * 0.6, 4, 0.12);
const ghostGeometry = new RoundedBoxGeometry(0.88, 0.88, BLOCK_DEPTH * 0.92, 6, 0.18);
const cellWellGeometry = new RoundedBoxGeometry(0.97, 0.97, 0.08, 4, 0.14);
const sparkleGeometry = new THREE.IcosahedronGeometry(0.08, 0);
const shardGeometry = new THREE.OctahedronGeometry(0.38, 0);
const boardOverlayTexture = createBoardOverlayTexture();

const ghostGroup = new THREE.Group();
boardGroup.add(ghostGroup);

const hoverPlate = new THREE.Mesh(
  new THREE.PlaneGeometry(BOARD_WIDTH, BOARD_HEIGHT),
  new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 })
);
hoverPlate.position.z = BLOCK_DEPTH * 0.75;
boardGroup.add(hoverPlate);

const ambient = new THREE.AmbientLight(0xfff6ee, 1.2);
scene.add(ambient);

const keyLight = new THREE.DirectionalLight(0xffe6b8, 2.1);
keyLight.position.set(5, 10, 10);
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0x5eddf5, 1.4);
fillLight.position.set(-8, 4, 7);
scene.add(fillLight);

const rimLight = new THREE.PointLight(0xff56b0, 3.2, 30, 2.1);
rimLight.position.set(0, 3, 7);
scene.add(rimLight);

const boardFrame = new THREE.Mesh(
  new RoundedBoxGeometry(BOARD_WIDTH + 1.1, BOARD_HEIGHT + 1.1, 0.9, 10, 0.24),
  new THREE.MeshPhysicalMaterial({
    color: 0x0b1425,
    transparent: true,
    opacity: 0.92,
    roughness: 0.25,
    metalness: 0.3,
    transmission: 0.05,
    emissive: 0x0b1f3a,
    emissiveIntensity: 0.9
  })
);
boardFrame.position.z = -0.38;
boardGroup.add(boardFrame);

const boardBack = new THREE.Mesh(
  new RoundedBoxGeometry(BOARD_WIDTH + 0.15, BOARD_HEIGHT + 0.15, 0.1, 8, 0.12),
  new THREE.MeshStandardMaterial({
    color: 0x0d1930,
    emissive: 0x18385f,
    emissiveIntensity: 0.7,
    roughness: 0.32,
    metalness: 0.28
  })
);
boardBack.position.z = -0.02;
boardGroup.add(boardBack);

const boardOverlay = new THREE.Mesh(
  new THREE.PlaneGeometry(BOARD_WIDTH, BOARD_HEIGHT),
  new THREE.MeshBasicMaterial({
    map: boardOverlayTexture,
    transparent: true,
    opacity: 0.92,
    depthWrite: false
  })
);
boardOverlay.position.z = 0.18;
boardGroup.add(boardOverlay);

const cellWells = new THREE.Group();
const cellWellMaterials = [
  new THREE.MeshPhysicalMaterial({
    color: 0x11233c,
    emissive: 0x1d436f,
    emissiveIntensity: 0.5,
    roughness: 0.5,
    metalness: 0.12,
    clearcoat: 0.42,
    transparent: true,
    opacity: 0.94
  }),
  new THREE.MeshPhysicalMaterial({
    color: 0x0c1b31,
    emissive: 0x14304f,
    emissiveIntensity: 0.36,
    roughness: 0.56,
    metalness: 0.1,
    clearcoat: 0.34,
    transparent: true,
    opacity: 0.9
  })
];

for (let row = 0; row < ROWS; row += 1) {
  for (let col = 0; col < COLS; col += 1) {
    const well = new THREE.Mesh(cellWellGeometry, cellWellMaterials[(row + col) % 2]);
    well.position.copy(cellToLocal(row, col)).setZ(0.1);
    cellWells.add(well);
  }
}

boardGroup.add(cellWells);

const gridLines = new THREE.Group();
const lineMaterial = new THREE.MeshBasicMaterial({
  color: 0x9cdcff,
  transparent: true,
  opacity: 0.22
});

for (let c = 0; c <= COLS; c += 1) {
  const line = new THREE.Mesh(new THREE.BoxGeometry(0.04, BOARD_HEIGHT, 0.02), lineMaterial);
  line.position.set(-BOARD_WIDTH / 2 + c * CELL_SIZE, 0, 0.05);
  gridLines.add(line);
}

for (let r = 0; r <= ROWS; r += 1) {
  const line = new THREE.Mesh(new THREE.BoxGeometry(BOARD_WIDTH, 0.04, 0.02), lineMaterial);
  line.position.set(0, BOARD_HEIGHT / 2 - r * CELL_SIZE, 0.05);
  gridLines.add(line);
}

boardGroup.add(gridLines);

const boardEdgeMaterial = new THREE.MeshBasicMaterial({
  color: 0xb4e8ff,
  transparent: true,
  opacity: 0.36
});

const edgeTop = new THREE.Mesh(new THREE.BoxGeometry(BOARD_WIDTH + 0.18, 0.07, 0.03), boardEdgeMaterial);
edgeTop.position.set(0, BOARD_HEIGHT / 2, 0.08);
gridLines.add(edgeTop);

const edgeBottom = edgeTop.clone();
edgeBottom.position.set(0, -BOARD_HEIGHT / 2, 0.08);
gridLines.add(edgeBottom);

const edgeLeft = new THREE.Mesh(new THREE.BoxGeometry(0.07, BOARD_HEIGHT + 0.18, 0.03), boardEdgeMaterial);
edgeLeft.position.set(-BOARD_WIDTH / 2, 0, 0.08);
gridLines.add(edgeLeft);

const edgeRight = edgeLeft.clone();
edgeRight.position.set(BOARD_WIDTH / 2, 0, 0.08);
gridLines.add(edgeRight);

for (let i = 0; i < 24; i += 1) {
  const color = COLORS[i % COLORS.length];
  const material = new THREE.MeshStandardMaterial({
    color: color.hex,
    emissive: color.hex,
    emissiveIntensity: 0.35,
    roughness: 0.2,
    metalness: 0.3,
    transparent: true,
    opacity: 0.68
  });
  const shard = new THREE.Mesh(shardGeometry, material);
  const angle = (i / 24) * Math.PI * 2;
  const radius = 10 + Math.random() * 4.4;
  shard.position.set(Math.cos(angle) * radius, Math.sin(angle * 1.8) * 4.5, -8 - Math.random() * 8);
  shard.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
  shard.scale.setScalar(0.6 + Math.random() * 0.9);
  shard.userData.spin = new THREE.Vector3(
    (Math.random() - 0.5) * 0.4,
    (Math.random() - 0.5) * 0.4,
    (Math.random() - 0.5) * 0.4
  );
  shard.userData.floatOffset = Math.random() * Math.PI * 2;
  floatingGroup.add(shard);
}

const clock = new THREE.Clock();

const state = {
  board: createEmptyBoard(),
  pieces: [],
  selectedPieceId: null,
  hover: null,
  touchPointerId: null,
  touchPlacementArmed: false,
  touchPlacementKey: null,
  resolving: false,
  gameOver: false,
  score: 0,
  best: Number.parseInt(localStorage.getItem(STORAGE_KEY) ?? "0", 10),
  lastCombo: 1,
  nextBlockId: 1,
  blockRegistry: new Map(),
  particles: [],
  lineFlashes: [],
  statusTimeout: null,
  shake: 0,
  runId: 0
};

const uniqueRotations = new Map();
const sceneLayout = {
  boardX: 0.68,
  boardY: -0.96,
  boardScale: 1,
  cameraBaseX: 0.26,
  cameraBaseY: 2.12,
  cameraBaseZ: 17.2,
  targetX: 0.34,
  targetY: -0.12,
  ringX: 4.1,
  ringY: 0.28
};

bestValue.textContent = formatNumber(state.best);

resetGame();
attachEvents();
updateViewportCssVars();
updateSceneLayout();
maybeAutoStart();
animate();

function attachEvents() {
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerleave", () => {
    if (state.touchPointerId != null) {
      return;
    }
    state.hover = null;
    updateGhost();
  });
  canvas.addEventListener("pointerdown", onCanvasPointerDown, { passive: false });
  canvas.addEventListener("pointerup", onCanvasPointerUp, { passive: false });
  canvas.addEventListener("pointercancel", onCanvasPointerCancel);

  rotateLeftButton.addEventListener("click", () => rotateSelected(-1));
  rotateRightButton.addEventListener("click", () => rotateSelected(1));
  newRunButton.addEventListener("click", resetGame);
  soundButton.addEventListener("click", async () => {
    await audio.unlock();
    const enabled = audio.toggle();
    syncResponsiveLabels(enabled);
    setStatus(enabled ? "Sound restored." : "Sound muted.");
  });
  startButton.addEventListener("click", async () => {
    await audio.unlock();
    startModal.classList.add("hidden");
    setStatus("Audio unlocked. Make something impossible.");
  });

  window.addEventListener("resize", onResize);
  window.visualViewport?.addEventListener("resize", onResize);
  window.visualViewport?.addEventListener("scroll", onResize);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("pointerdown", unlockOnFirstInput, { once: true });
}

function maybeAutoStart() {
  if (!searchParams.has("autostart")) {
    return;
  }

  startModal.classList.add("hidden");
  setStatus("Dev autostart enabled.");
}

function unlockOnFirstInput() {
  audio.unlock().catch(() => {});
}

function onResize() {
  const viewport = getViewportSize();
  camera.aspect = viewport.width / viewport.height;
  camera.updateProjectionMatrix();

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(viewport.width, viewport.height);
  composer.setSize(viewport.width, viewport.height);
  updateViewportCssVars();
  syncResponsiveLabels(audio.enabled);
  updateSceneLayout();
}

function onKeyDown(event) {
  if (event.repeat) {
    return;
  }

  if (event.key === "q" || event.key === "Q") {
    rotateSelected(-1);
  } else if (event.key === "e" || event.key === "E" || event.key === "r" || event.key === "R") {
    rotateSelected(1);
  }
}

function onPointerMove(event) {
  if (!getSelectedPiece() || state.resolving || state.gameOver) {
    state.hover = null;
    updateGhost();
    return;
  }

  if (state.touchPointerId != null && event.pointerId !== state.touchPointerId) {
    return;
  }

  const nextHover = getHoverCellFromEvent(event);
  if (state.touchPointerId != null) {
    if (nextHover) {
      if (!isSameHover(nextHover, state.hover)) {
        clearTouchPlacementArm();
      }
      state.hover = nextHover;
    }
  } else {
    state.hover = nextHover;
  }

  updateGhost();
}

async function onCanvasPointerDown(event) {
  if (startModal && !startModal.classList.contains("hidden")) {
    return;
  }

  if (state.resolving || state.gameOver) {
    return;
  }

  const piece = getSelectedPiece();
  const directHover = getHoverCellFromEvent(event);
  if (isTouchInteraction(event) && !directHover) {
    return;
  }

  const hover = directHover ?? state.hover;
  state.hover = hover;
  updateGhost();

  if (!piece || !hover) {
    return;
  }

  event.preventDefault();
  if (isTouchInteraction(event)) {
    state.touchPointerId = event.pointerId;
    canvas.setPointerCapture?.(event.pointerId);
    setStatus("Drag on the grid, then lift to preview.");
    return;
  }

  await placePieceAtHover(piece, hover);
}

async function onCanvasPointerUp(event) {
  if (state.touchPointerId == null || event.pointerId !== state.touchPointerId) {
    return;
  }

  event.preventDefault();
  canvas.releasePointerCapture?.(event.pointerId);
  state.touchPointerId = null;

  if (startModal && !startModal.classList.contains("hidden")) {
    return;
  }

  if (state.resolving || state.gameOver) {
    return;
  }

  const piece = getSelectedPiece();
  const hover = getHoverCellFromEvent(event) ?? state.hover;
  state.hover = hover;
  updateGhost();

  if (!piece || !hover) {
    return;
  }

  const hoverKey = getHoverKey(hover);
  if (!state.touchPlacementArmed || state.touchPlacementKey !== hoverKey) {
    state.touchPlacementArmed = true;
    state.touchPlacementKey = hoverKey;
    setStatus("Preview locked. Tap the highlighted spot again to place.");
    return;
  }

  await placePieceAtHover(piece, hover);
}

function onCanvasPointerCancel(event) {
  if (state.touchPointerId == null || event.pointerId !== state.touchPointerId) {
    return;
  }

  canvas.releasePointerCapture?.(event.pointerId);
  state.touchPointerId = null;
}

async function placePieceAtHover(piece, hover) {
  const placement = getPlacementCells(piece, hover.row, hover.col);
  if (!placement.valid) {
    state.shake = 0.16;
    audio.playReject();
    setStatus("That shard does not fit there.");
    return;
  }

  await audio.unlock().catch(() => {});
  await placeSelectedPiece(piece, placement.cells);
}

function rotateSelected(direction) {
  const piece = getSelectedPiece();
  if (!piece || state.resolving || state.gameOver) {
    return;
  }

  clearTouchPlacementArm();
  piece.rotation = mod(piece.rotation + direction, 4);
  renderTray();
  updateGhost();
  audio.playSelect();
}

function resetGame() {
  state.runId += 1;
  state.board = createEmptyBoard();
  state.score = 0;
  state.lastCombo = 1;
  state.gameOver = false;
  state.resolving = false;
  state.hover = null;
  state.touchPointerId = null;
  clearTouchPlacementArm();
  state.selectedPieceId = null;
  state.shake = 0;
  if (state.statusTimeout) {
    clearTimeout(state.statusTimeout);
    state.statusTimeout = null;
  }
  clearBoardMeshes();
  refillPieces();
  updateScoreboard();
  renderTray();
  updateGhost();
  syncResponsiveLabels(audio.enabled);
  setStatus("Pick a shard and work toward a full row or column.");
}

function clearBoardMeshes() {
  for (const block of state.blockRegistry.values()) {
    disposeBlock(block);
  }
  state.blockRegistry.clear();
  for (const particle of state.particles) {
    particleGroup.remove(particle.mesh);
    particle.mesh.material.dispose();
  }
  state.particles = [];
  for (const flash of state.lineFlashes) {
    boardGroup.remove(flash.mesh);
    flash.mesh.material.dispose();
  }
  state.lineFlashes = [];
}

function refillPieces() {
  state.pieces = Array.from({ length: 3 }, () => createPiece());
  state.selectedPieceId = state.pieces[0]?.id ?? null;
}

function createPiece() {
  const shape = SHAPES[Math.floor(Math.random() * SHAPES.length)];
  const colorIndex = Math.floor(Math.random() * COLORS.length);
  return {
    id: crypto.randomUUID(),
    shapeId: shape.id,
    name: shape.name,
    copy: shape.copy,
    baseCells: shape.cells.map(([x, y]) => [x, y]),
    colorIndex,
    rotation: Math.floor(Math.random() * 4)
  };
}

function getSelectedPiece() {
  return state.pieces.find((piece) => piece.id === state.selectedPieceId) ?? null;
}

function renderTray() {
  pieceTray.innerHTML = "";

  for (const piece of state.pieces) {
    const button = document.createElement("button");
    const color = COLORS[piece.colorIndex];
    const rotated = getRotatedCells(piece);
    const bounds = getBounds(rotated);
    button.type = "button";
    button.className = "piece-card";
    button.style.setProperty("--piece-color", color.css);

    if (piece.id === state.selectedPieceId) {
      button.classList.add("selected");
    }

    if (state.resolving || state.gameOver) {
      button.classList.add("disabled");
      button.disabled = true;
    }

    const meta = document.createElement("div");
    meta.className = "piece-meta";
    meta.innerHTML = `
      <div>
        <p class="piece-name">${piece.name}</p>
        <p class="piece-copy">${piece.copy}</p>
      </div>
      <span class="piece-rot">${rotationLabel(piece.rotation)}</span>
    `;

    const miniGrid = document.createElement("div");
    miniGrid.className = "mini-grid";
    miniGrid.style.gridTemplateColumns = `repeat(${bounds.width}, 22px)`;
    miniGrid.style.gridTemplateRows = `repeat(${bounds.height}, 22px)`;

    const lookup = new Set(rotated.map(([x, y]) => `${x},${y}`));
    for (let row = 0; row < bounds.height; row += 1) {
      for (let col = 0; col < bounds.width; col += 1) {
        const cell = document.createElement("span");
        if (lookup.has(`${col},${row}`)) {
          cell.className = "mini-cell";
        }
        miniGrid.append(cell);
      }
    }

    button.append(meta, miniGrid);
    button.addEventListener("click", () => {
      if (state.resolving || state.gameOver) {
        return;
      }

      state.selectedPieceId = piece.id;
      clearTouchPlacementArm();
      renderTray();
      updateGhost();
      audio.playSelect();
      setStatus(
        window.innerWidth <= 720
          ? `${piece.name} primed. Drag on the grid, then lift to preview.`
          : `${piece.name} primed. Tap or click a cell to place it.`
      );
    });

    pieceTray.append(button);
  }

  updateSceneLayout();
}

function getViewportSize() {
  return {
    width: window.visualViewport?.width ?? window.innerWidth,
    height: window.visualViewport?.height ?? window.innerHeight
  };
}

function updateViewportCssVars() {
  const viewport = window.visualViewport;
  const topOffset = viewport ? Math.max(0, viewport.offsetTop) : 0;
  const bottomOffset = viewport
    ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)
    : 0;
  document.documentElement.style.setProperty("--viewport-offset-top", `${topOffset}px`);
  document.documentElement.style.setProperty("--viewport-offset-bottom", `${bottomOffset}px`);
}

function clearTouchPlacementArm() {
  state.touchPlacementArmed = false;
  state.touchPlacementKey = null;
}

function updatePointerFromEvent(event) {
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
}

function getHoverCellFromEvent(event) {
  updatePointerFromEvent(event);
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObject(hoverPlate, false)[0];
  if (!hit) {
    return null;
  }

  const localPoint = boardGroup.worldToLocal(hit.point.clone());
  const col = Math.floor((localPoint.x + BOARD_WIDTH / 2) / CELL_SIZE);
  const row = Math.floor((BOARD_HEIGHT / 2 - localPoint.y) / CELL_SIZE);

  if (!isInside(row, col)) {
    return null;
  }

  return { row, col };
}

function getHoverKey(cell) {
  return cell ? `${cell.row},${cell.col}` : null;
}

function isSameHover(a, b) {
  return Boolean(a && b && a.row === b.row && a.col === b.col);
}

function isTouchInteraction(event) {
  return event.pointerType === "touch" || event.pointerType === "pen";
}

function syncResponsiveLabels(soundEnabled) {
  if (window.innerWidth <= 720) {
    rotateLeftButton.textContent = "Turn L";
    rotateRightButton.textContent = "Turn R";
    soundButton.textContent = soundEnabled ? "Audio On" : "Audio Off";
    newRunButton.textContent = "Reset";
    return;
  }

  rotateLeftButton.textContent = "Rotate Left";
  rotateRightButton.textContent = "Rotate Right";
  soundButton.textContent = soundEnabled ? "Sound: On" : "Sound: Off";
  newRunButton.textContent = "New Run";
}

async function placeSelectedPiece(piece, placementCells) {
  const runId = state.runId;
  state.resolving = true;
  clearTouchPlacementArm();
  const color = COLORS[piece.colorIndex];

  for (const { row, col } of placementCells) {
    const block = createBoardBlock(piece.colorIndex);
    const target = cellToLocal(row, col);
    block.target.copy(target);
    block.group.position.copy(target).add(new THREE.Vector3(0, 0.8, 2.2));
    block.group.scale.setScalar(0.01);
    block.scaleTarget = 1;
    boardGroup.add(block.group);
    state.blockRegistry.set(block.id, block);
    state.board[row][col] = block;
  }

  state.pieces = state.pieces.filter((candidate) => candidate.id !== piece.id);
  state.selectedPieceId = state.pieces[0]?.id ?? null;
  updateGhost();
  renderTray();
  updateScoreboard();
  setStatus(`${color.label} shard locked. Complete the line to clear it.`);
  audio.playPlace();

  await wait(180);
  if (runId !== state.runId) {
    return;
  }

  await resolveBoard(runId);
  if (runId !== state.runId) {
    return;
  }

  if (state.pieces.length === 0 && !state.gameOver) {
    refillPieces();
    renderTray();
  }

  if (!state.gameOver && !hasAnyMoves()) {
    state.gameOver = true;
    state.selectedPieceId = null;
    renderTray();
    updateGhost();
    setStatus("No legal moves left. Tap New Run and go again.");
    audio.playGameOver();
  } else if (!state.gameOver && state.selectedPieceId == null && state.pieces.length > 0) {
    state.selectedPieceId = state.pieces[0].id;
    renderTray();
    updateGhost();
  }

  state.resolving = false;
}

async function resolveBoard(runId) {
  let comboDepth = 0;

  while (true) {
    if (runId !== state.runId) {
      return;
    }

    const clearState = findClearTargets();
    const targets = clearState.cells;
    if (targets.length === 0) {
      break;
    }

    comboDepth += 1;
    const totalCleared = targets.length;
    const clearedLines = clearState.rows.length + clearState.cols.length;
    const scoreGain = totalCleared * 125 * comboDepth;
    state.score += scoreGain;
    state.lastCombo = comboDepth;
    state.best = Math.max(state.best, state.score);
    localStorage.setItem(STORAGE_KEY, String(state.best));
    updateScoreboard();
    spawnLineFlashes(clearState.rows, clearState.cols);

    for (const { row, col } of targets) {
      const block = state.board[row][col];
      if (!block) {
        continue;
      }

      spawnBurst(block.target, COLORS[block.colorIndex]);
      disposeBlock(block);
      state.blockRegistry.delete(block.id);
      state.board[row][col] = null;
    }

    state.shake = Math.min(0.34, 0.1 + comboDepth * 0.05);
    const lineLabel = clearedLines === 1 ? "1 line" : `${clearedLines} lines`;
    setStatus(
      comboDepth > 1
        ? `Combo x${comboDepth}. ${lineLabel} shattered for ${formatNumber(scoreGain)}.`
        : `${lineLabel} shattered for ${formatNumber(scoreGain)}.`
    );
    audio.playClear(clearedLines, comboDepth);
    await wait(180);
    if (runId !== state.runId) {
      return;
    }

    collapseBoard();
    syncBoardVisuals();
    audio.playCascade(comboDepth);
    await wait(240);
  }

  if (comboDepth > 1) {
    audio.playCombo(comboDepth);
  }

  if (comboDepth === 0) {
    state.lastCombo = 1;
    updateScoreboard();
  }
}

function collapseBoard() {
  for (let col = 0; col < COLS; col += 1) {
    let writeRow = ROWS - 1;
    for (let row = ROWS - 1; row >= 0; row -= 1) {
      const block = state.board[row][col];
      if (!block) {
        continue;
      }
      if (row !== writeRow) {
        state.board[writeRow][col] = block;
        state.board[row][col] = null;
      }
      writeRow -= 1;
    }

    for (let row = writeRow; row >= 0; row -= 1) {
      state.board[row][col] = null;
    }
  }
}

function syncBoardVisuals() {
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const block = state.board[row][col];
      if (block) {
        block.target.copy(cellToLocal(row, col));
      }
    }
  }
}

function findClearTargets() {
  const marked = new Map();
  const rows = [];
  const cols = [];

  for (let row = 0; row < ROWS; row += 1) {
    let full = true;
    for (let col = 0; col < COLS; col += 1) {
      if (!state.board[row][col]) {
        full = false;
        break;
      }
    }
    if (full) {
      rows.push(row);
      for (let col = 0; col < COLS; col += 1) {
        marked.set(`${row},${col}`, { row, col });
      }
    }
  }

  for (let col = 0; col < COLS; col += 1) {
    let full = true;
    for (let row = 0; row < ROWS; row += 1) {
      if (!state.board[row][col]) {
        full = false;
        break;
      }
    }
    if (full) {
      cols.push(col);
      for (let row = 0; row < ROWS; row += 1) {
        marked.set(`${row},${col}`, { row, col });
      }
    }
  }

  return {
    cells: [...marked.values()],
    rows,
    cols
  };
}

function hasAnyMoves() {
  return state.pieces.some((piece) => pieceHasAnyMove(piece));
}

function pieceHasAnyMove(piece) {
  const rotations = getUniqueRotations(piece.baseCells);
  for (const rotated of rotations) {
    for (let row = 0; row < ROWS; row += 1) {
      for (let col = 0; col < COLS; col += 1) {
        const placement = getPlacementCells(piece, row, col, rotated);
        if (placement.valid) {
          return true;
        }
      }
    }
  }
  return false;
}

function updateGhost() {
  clearGhost();
  const piece = getSelectedPiece();

  if (!piece || !state.hover || state.resolving || state.gameOver) {
    return;
  }

  const placement = getPlacementCells(piece, state.hover.row, state.hover.col);
  for (const cell of placement.cells) {
    const color = placement.valid ? COLORS[piece.colorIndex] : { hex: 0xff5964, emissive: 0x5d0f14 };
    const shell = new THREE.Mesh(
      ghostGeometry,
      new THREE.MeshStandardMaterial({
        color: color.hex,
        emissive: color.emissive,
        emissiveIntensity: placement.valid ? 1.15 : 0.92,
        transparent: true,
        opacity: placement.valid ? 0.42 : 0.36,
        roughness: 0.18,
        metalness: 0.28
      })
    );
    const core = new THREE.Mesh(
      coreGeometry,
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: placement.valid ? 0.2 : 0.14
      })
    );
    const group = new THREE.Group();
    group.add(shell, core);
    group.position.copy(cellToLocal(cell.row, cell.col)).setZ(BLOCK_DEPTH * 0.86);
    ghostGroup.add(group);
  }
}

function getPlacementCells(piece, anchorRow, anchorCol, overrideCells = null) {
  const cells = overrideCells ?? getRotatedCells(piece);
  const placement = [];
  let valid = true;

  for (const [x, y] of cells) {
    const row = anchorRow + y;
    const col = anchorCol + x;
    if (!isInside(row, col) || state.board[row][col]) {
      valid = false;
    }
    placement.push({ row, col });
  }

  return { valid, cells: placement };
}

function createBoardBlock(colorIndex) {
  const color = COLORS[colorIndex];
  const shellMaterial = new THREE.MeshStandardMaterial({
    color: color.hex,
    emissive: color.emissive,
    emissiveIntensity: 0.95,
    roughness: 0.18,
    metalness: 0.32
  });
  const coreMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.17
  });

  const shell = new THREE.Mesh(blockGeometry, shellMaterial);
  const core = new THREE.Mesh(coreGeometry, coreMaterial);
  const group = new THREE.Group();
  group.add(shell, core);

  return {
    id: state.nextBlockId++,
    colorIndex,
    group,
    shell,
    target: new THREE.Vector3(),
    wobble: Math.random() * Math.PI * 2,
    scaleTarget: 1
  };
}

function disposeBlock(block) {
  boardGroup.remove(block.group);
  block.group.traverse((node) => {
    if (node.material) {
      node.material.dispose();
    }
  });
}

function spawnBurst(position, color) {
  const count = 10;
  for (let i = 0; i < count; i += 1) {
    const material = new THREE.MeshBasicMaterial({
      color: color.hex,
      transparent: true,
      opacity: 0.86
    });
    const mesh = new THREE.Mesh(sparkleGeometry, material);
    mesh.position.copy(boardGroup.localToWorld(position.clone()));
    mesh.scale.setScalar(0.6 + Math.random() * 0.6);
    particleGroup.add(mesh);

    state.particles.push({
      mesh,
      velocity: new THREE.Vector3(
        (Math.random() - 0.5) * 0.08,
        (Math.random() - 0.5) * 0.08 + 0.03,
        (Math.random() - 0.5) * 0.08
      ),
      life: 0.45 + Math.random() * 0.28
    });
  }
}

function spawnLineFlashes(rows, cols) {
  for (const row of rows) {
    const material = new THREE.MeshBasicMaterial({
      color: 0xbaf6ff,
      transparent: true,
      opacity: 0.36
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(BOARD_WIDTH * 0.99, CELL_SIZE * 0.88), material);
    mesh.position.set(0, BOARD_HEIGHT / 2 - CELL_SIZE / 2 - row * CELL_SIZE, BLOCK_DEPTH * 0.9);
    boardGroup.add(mesh);
    state.lineFlashes.push({ mesh, life: 0.2, axis: "row" });
  }

  for (const col of cols) {
    const material = new THREE.MeshBasicMaterial({
      color: 0xbaf6ff,
      transparent: true,
      opacity: 0.36
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(CELL_SIZE * 0.88, BOARD_HEIGHT * 0.99), material);
    mesh.position.set(-BOARD_WIDTH / 2 + CELL_SIZE / 2 + col * CELL_SIZE, 0, BLOCK_DEPTH * 0.9);
    boardGroup.add(mesh);
    state.lineFlashes.push({ mesh, life: 0.2, axis: "col" });
  }
}

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.032);
  const elapsed = clock.elapsedTime;

  const shakeAmount = state.shake;
  state.shake = Math.max(0, state.shake - delta * 0.9);
  camera.position.x =
    sceneLayout.cameraBaseX + Math.sin(elapsed * 1.8) * 0.08 + (Math.random() - 0.5) * shakeAmount;
  camera.position.y =
    sceneLayout.cameraBaseY + Math.cos(elapsed * 1.2) * 0.12 + (Math.random() - 0.5) * shakeAmount;
  camera.position.z = sceneLayout.cameraBaseZ;
  camera.lookAt(sceneLayout.targetX, sceneLayout.targetY, 0);

  backgroundRing.rotation.z += delta * 0.04;

  for (const shard of floatingGroup.children) {
    shard.rotation.x += shard.userData.spin.x * delta;
    shard.rotation.y += shard.userData.spin.y * delta;
    shard.rotation.z += shard.userData.spin.z * delta;
    shard.position.y += Math.sin(elapsed + shard.userData.floatOffset) * 0.002;
  }

  for (const block of state.blockRegistry.values()) {
    block.group.position.lerp(block.target, 1 - Math.exp(-delta * 14));
    const scale = THREE.MathUtils.lerp(block.group.scale.x, block.scaleTarget, 1 - Math.exp(-delta * 14));
    block.group.scale.setScalar(scale);
    block.group.rotation.y = Math.sin(elapsed * 1.4 + block.wobble) * 0.05;
    block.group.rotation.x = Math.cos(elapsed * 1.2 + block.wobble) * 0.03;
    block.shell.material.emissiveIntensity = 0.86 + Math.sin(elapsed * 2.4 + block.wobble) * 0.14;
  }

  state.particles = state.particles.filter((particle) => {
    particle.life -= delta;
    if (particle.life <= 0) {
      particleGroup.remove(particle.mesh);
      particle.mesh.material.dispose();
      return false;
    }

    particle.mesh.position.addScaledVector(particle.velocity, delta * 10);
    particle.mesh.scale.multiplyScalar(0.985);
    particle.mesh.material.opacity = particle.life * 1.6;
    return true;
  });

  state.lineFlashes = state.lineFlashes.filter((flash) => {
    flash.life -= delta;
    if (flash.life <= 0) {
      boardGroup.remove(flash.mesh);
      flash.mesh.material.dispose();
      return false;
    }

    flash.mesh.material.opacity = flash.life * 1.8;
    flash.mesh.scale.set(
      flash.axis === "row" ? 1 : 0.92 + (0.2 - flash.life) * 1.6,
      flash.axis === "row" ? 0.92 + (0.2 - flash.life) * 1.6 : 1,
      1
    );
    return true;
  });

  composer.render();
}

function clearGhost() {
  for (const child of ghostGroup.children) {
    child.traverse((node) => {
      if (node.material) {
        node.material.dispose();
      }
    });
  }
  ghostGroup.clear();
}

function updateSceneLayout() {
  const viewport = getViewportSize();
  const phone = viewport.width <= 720;
  const stacked = viewport.width <= 1080;
  if (phone) {
    const topRail = topUi?.offsetHeight ?? 0;
    const bottomRail = lowerUi?.offsetHeight ?? 0;
    const availableWidth = viewport.width - 24;
    const availableHeight = viewport.height - topRail - bottomRail - 44;
    const widthSqueeze = THREE.MathUtils.clamp((390 - availableWidth) / 120, 0, 1);
    const heightSqueeze = THREE.MathUtils.clamp((460 - availableHeight) / 180, 0, 1);
    const laneBias = THREE.MathUtils.clamp((bottomRail - topRail) / Math.max(viewport.height, 1), -0.18, 0.18);

    sceneLayout.boardX = 0;
    sceneLayout.boardY = 0.06 + laneBias * 0.52 - heightSqueeze * 0.06;
    sceneLayout.boardScale = 0.79 - heightSqueeze * 0.06 - widthSqueeze * 0.03;
    sceneLayout.cameraBaseX = 0;
    sceneLayout.cameraBaseY = 2.08 + heightSqueeze * 0.08;
    sceneLayout.cameraBaseZ = 20 + heightSqueeze * 1.4 + widthSqueeze * 0.6;
    sceneLayout.targetX = 0;
    sceneLayout.targetY = 0.12 + laneBias * 0.16;
    sceneLayout.ringX = 2.9;
    sceneLayout.ringY = 0.86;
  } else if (stacked) {
    sceneLayout.boardX = 0;
    sceneLayout.boardY = -0.72;
    sceneLayout.boardScale = 0.9;
    sceneLayout.cameraBaseX = 0;
    sceneLayout.cameraBaseY = 2.16;
    sceneLayout.cameraBaseZ = 17.1;
    sceneLayout.targetX = 0;
    sceneLayout.targetY = -0.1;
    sceneLayout.ringX = 3.2;
    sceneLayout.ringY = 0.4;
  } else {
    const leftRail = Math.max(heroPanel?.offsetWidth ?? 0, trayPanel?.offsetWidth ?? 0);
    const rightRail = Math.max(scoreboardPanel?.offsetWidth ?? 0, sidePanel?.offsetWidth ?? 0);
    const topRail = Math.max(heroPanel?.offsetHeight ?? 0, scoreboardPanel?.offsetHeight ?? 0);
    const bottomRail = Math.max(trayPanel?.offsetHeight ?? 0, sidePanel?.offsetHeight ?? 0);
    const railImbalance = (leftRail - rightRail) / Math.max(window.innerWidth, 1);
    const availableCenter = window.innerWidth - leftRail - rightRail - 96;
    const availableHeight = window.innerHeight - topRail - bottomRail - 92;
    const squeeze = THREE.MathUtils.clamp((860 - availableCenter) / 340, 0, 1);
    const verticalSqueeze = THREE.MathUtils.clamp((700 - availableHeight) / 260, 0, 1);

    sceneLayout.boardX = THREE.MathUtils.clamp(0.62 + railImbalance * 1.6, 0.42, 0.92);
    sceneLayout.boardY = -0.96 + verticalSqueeze * 0.52;
    sceneLayout.boardScale = 1 - verticalSqueeze * 0.12 - squeeze * 0.03;
    sceneLayout.cameraBaseX = sceneLayout.boardX * 0.38;
    sceneLayout.cameraBaseY = 2.1 + verticalSqueeze * 0.02;
    sceneLayout.cameraBaseZ = 17.2 + squeeze * 1.2 + verticalSqueeze * 1.5;
    sceneLayout.targetX = sceneLayout.boardX * 0.5;
    sceneLayout.targetY = -0.12 + verticalSqueeze * 0.18;
    sceneLayout.ringX = 4 + sceneLayout.boardX * 0.35;
    sceneLayout.ringY = 0.28;
  }

  syncResponsiveLabels(audio.enabled);
  boardGroup.position.set(sceneLayout.boardX, sceneLayout.boardY, 0);
  boardGroup.scale.setScalar(sceneLayout.boardScale);
  backgroundRing.position.set(sceneLayout.ringX, sceneLayout.ringY, -12);
}

function updateScoreboard() {
  scoreValue.textContent = formatNumber(state.score);
  bestValue.textContent = formatNumber(state.best);
  comboValue.textContent = `x${state.lastCombo}`;
}

function setStatus(message) {
  statusText.textContent = message;
  if (state.statusTimeout) {
    clearTimeout(state.statusTimeout);
  }
  state.statusTimeout = window.setTimeout(() => {
    if (!state.resolving && !state.gameOver) {
      statusText.textContent = "Complete a full horizontal row or vertical column.";
    }
  }, 2800);
}

function createBoardOverlayTexture() {
  const size = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = "#071224";
  ctx.fillRect(0, 0, size, size);

  const cellWidth = size / COLS;
  const cellHeight = size / ROWS;

  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const x = col * cellWidth;
      const y = row * cellHeight;
      const inset = Math.min(cellWidth, cellHeight) * 0.07;
      const width = cellWidth - inset * 2;
      const height = cellHeight - inset * 2;
      const gradient = ctx.createLinearGradient(x + inset, y + inset, x + inset, y + inset + height);
      gradient.addColorStop(0, row % 2 === col % 2 ? "rgba(42, 72, 122, 0.86)" : "rgba(28, 42, 70, 0.82)");
      gradient.addColorStop(1, row % 2 === col % 2 ? "rgba(24, 38, 66, 0.9)" : "rgba(16, 25, 45, 0.9)");
      ctx.fillStyle = gradient;
      roundRect(ctx, x + inset, y + inset, width, height, Math.min(width, height) * 0.12);
      ctx.fill();

      ctx.strokeStyle = "rgba(77, 160, 255, 0.2)";
      ctx.lineWidth = Math.max(1.5, cellWidth * 0.018);
      roundRect(ctx, x + inset, y + inset, width, height, Math.min(width, height) * 0.12);
      ctx.stroke();
    }
  }

  ctx.strokeStyle = "rgba(180, 232, 255, 0.34)";
  ctx.lineWidth = Math.max(2, size * 0.004);
  for (let row = 0; row <= ROWS; row += 1) {
    const y = row * cellHeight;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size, y);
    ctx.stroke();
  }

  for (let col = 0; col <= COLS; col += 1) {
    const x = col * cellWidth;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, size);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return texture;
}

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

function cellToLocal(row, col) {
  return new THREE.Vector3(
    -BOARD_WIDTH / 2 + CELL_SIZE / 2 + col * CELL_SIZE,
    BOARD_HEIGHT / 2 - CELL_SIZE / 2 - row * CELL_SIZE,
    BLOCK_DEPTH * 0.52
  );
}

function getRotatedCells(piece) {
  let cells = piece.baseCells.map(([x, y]) => [x, y]);
  for (let i = 0; i < piece.rotation; i += 1) {
    cells = rotateClockwise(cells);
  }
  return cells;
}

function getUniqueRotations(baseCells) {
  const cacheKey = JSON.stringify(baseCells);
  if (uniqueRotations.has(cacheKey)) {
    return uniqueRotations.get(cacheKey);
  }

  const rotations = [];
  let cells = baseCells.map(([x, y]) => [x, y]);
  for (let i = 0; i < 4; i += 1) {
    const normalized = normalizeCells(cells);
    const key = JSON.stringify(normalized);
    if (!rotations.some((existing) => JSON.stringify(existing) === key)) {
      rotations.push(normalized);
    }
    cells = rotateClockwise(cells);
  }

  uniqueRotations.set(cacheKey, rotations);
  return rotations;
}

function rotateClockwise(cells) {
  return normalizeCells(cells.map(([x, y]) => [y, -x]));
}

function normalizeCells(cells) {
  const minX = Math.min(...cells.map(([x]) => x));
  const minY = Math.min(...cells.map(([, y]) => y));
  return cells.map(([x, y]) => [x - minX, y - minY]);
}

function getBounds(cells) {
  return {
    width: Math.max(...cells.map(([x]) => x)) + 1,
    height: Math.max(...cells.map(([, y]) => y)) + 1
  };
}

function createEmptyBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function isInside(row, col) {
  return row >= 0 && row < ROWS && col >= 0 && col < COLS;
}

function mod(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}

function rotationLabel(rotation) {
  const labels = ["0°", "90°", "180°", "270°"];
  return labels[rotation] ?? "0°";
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(value);
}
