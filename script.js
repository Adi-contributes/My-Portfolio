// everything the page does, top to bottom in the order it shows up on screen

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const svgNamespace = "http://www.w3.org/2000/svg";

// tiny seeded random so the drawings look hand placed but stay the same on every load
function makeSeededRandom(seed) {
  let state = seed >>> 0;
  return function nextRandom() {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = state;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

// split the name into letters so they can rise in one after another -----
let letterCounter = 0;
document.querySelectorAll(".hero-name-line").forEach((nameLine) => {
  const lineText = nameLine.textContent.trim();
  nameLine.textContent = "";
  for (const character of lineText) {
    const letterSpan = document.createElement("span");
    letterSpan.className = "hero-letter";
    letterSpan.textContent = character;
    letterSpan.setAttribute("aria-hidden", "true");
    letterSpan.style.setProperty("--letter-index", letterCounter);
    letterCounter += 1;
    nameLine.appendChild(letterSpan);
  }
});

// =================================================================
// the orb web in the hero
// it gets built in the same order a garden spider builds one:
// bridge lines, frame, radii, hub, then the sticky spiral winding inward.
// every point is a little spring so dragging the cursor through it plucks the threads
// =================================================================

const orbWebCanvas = document.getElementById("orb-web-canvas");
const orbWebContext = orbWebCanvas.getContext("2d");
let orbWebGeometry = null;
let orbWebSeed = 7;
let orbWebBuildStartTime = performance.now();
let orbWebIsOnScreen = true;
let canvasCssWidth = 0;
let canvasCssHeight = 0;

const pointerState = { x: -9999, y: -9999, velocityX: 0, velocityY: 0, lastX: null, lastY: null, isInside: false };

// timings for each stage of the build, in ms
const buildTimeline = {
  anchorsStart: 0,
  anchorsLength: 500,
  frameStart: 350,
  frameLength: 700,
  radialsStart: 900,
  radialStagger: 45,
  radialLength: 380,
  hubStart: 2450,
  hubLength: 450,
  spiralStart: 2700,
  spiralLength: 2300,
  dewStart: 4700,
  dewLength: 900,
};

function buildOrbWebGeometry(width, height, seed) {
  const random = makeSeededRandom(seed);
  const centerX = width * 0.52;
  const centerY = height * 0.47;
  const baseRadius = Math.min(width, height) * 0.36;
  const nodes = [];

  function addNode(x, y, isPinned) {
    nodes.push({ restX: x, restY: y, offsetX: 0, offsetY: 0, velocityX: 0, velocityY: 0, isPinned: isPinned });
    return nodes.length - 1;
  }

  const hubNodeIndex = addNode(centerX, centerY, false);

  // frame polygon, a bit lopsided like a real one
  const frameCornerCount = 7;
  const rotationOffset = random() * Math.PI * 2;
  const frameCorners = [];
  for (let cornerNumber = 0; cornerNumber < frameCornerCount; cornerNumber++) {
    const angle = rotationOffset + (cornerNumber / frameCornerCount) * Math.PI * 2 + (random() - 0.5) * 0.45;
    const radius = baseRadius * (1.05 + random() * 0.22);
    frameCorners.push({ angle: angle, x: centerX + Math.cos(angle) * radius, y: centerY + Math.sin(angle) * radius });
  }

  // anchor lines run from a few frame corners out past the edge of the canvas
  const anchorLines = [];
  const cornerNodeIndexes = frameCorners.map((corner) => addNode(corner.x, corner.y, false));
  frameCorners.forEach((corner, cornerNumber) => {
    if (cornerNumber % 2 === 1 && cornerNumber !== frameCornerCount - 1) return;
    const directionX = Math.cos(corner.angle + (random() - 0.5) * 0.3);
    const directionY = Math.sin(corner.angle + (random() - 0.5) * 0.3);
    const farNodeIndex = addNode(corner.x + directionX * width, corner.y + directionY * width, true);
    anchorLines.push([farNodeIndex, cornerNodeIndexes[cornerNumber]]);
  });

  // radii. find where each ray from the hub hits the frame polygon
  const radialCount = 30;
  const radials = [];
  for (let radialNumber = 0; radialNumber < radialCount; radialNumber++) {
    const angle = rotationOffset + (radialNumber / radialCount) * Math.PI * 2 + (random() - 0.5) * ((Math.PI * 2) / radialCount) * 0.4;
    const directionX = Math.cos(angle);
    const directionY = Math.sin(angle);
    let closestHitDistance = baseRadius;
    for (let edgeNumber = 0; edgeNumber < frameCornerCount; edgeNumber++) {
      const edgeStart = frameCorners[edgeNumber];
      const edgeEnd = frameCorners[(edgeNumber + 1) % frameCornerCount];
      const edgeX = edgeEnd.x - edgeStart.x;
      const edgeY = edgeEnd.y - edgeStart.y;
      const denominator = directionX * edgeY - directionY * edgeX;
      if (Math.abs(denominator) < 1e-9) continue;
      const startToEdgeX = edgeStart.x - centerX;
      const startToEdgeY = edgeStart.y - centerY;
      const hitDistance = (startToEdgeX * edgeY - startToEdgeY * edgeX) / denominator;
      const edgePosition = (startToEdgeX * directionY - startToEdgeY * directionX) / denominator;
      if (hitDistance > 0 && edgePosition >= 0 && edgePosition <= 1 && hitDistance < closestHitDistance * 10) {
        closestHitDistance = hitDistance;
      }
    }
    const frameNodeIndex = addNode(centerX + directionX * closestHitDistance, centerY + directionY * closestHitDistance, false);
    radials.push({ angle: angle, directionX: directionX, directionY: directionY, length: closestHitDistance, frameNodeIndex: frameNodeIndex, nodesAlongRadial: [] });
  }

  // frame is drawn through the corners and every radial end, in angle order
  const framePoints = [];
  cornerNodeIndexes.forEach((nodeIndex) => {
    const node = nodes[nodeIndex];
    framePoints.push({ nodeIndex: nodeIndex, angle: Math.atan2(node.restY - centerY, node.restX - centerX) });
  });
  radials.forEach((radial) => {
    const node = nodes[radial.frameNodeIndex];
    framePoints.push({ nodeIndex: radial.frameNodeIndex, angle: Math.atan2(node.restY - centerY, node.restX - centerX) });
  });
  framePoints.sort((first, second) => first.angle - second.angle);
  const frameLoop = framePoints.map((point) => point.nodeIndex);
  frameLoop.push(frameLoop[0]);

  // the capture spiral winds inward, a little wider spaced near the outside like the real thing
  const spiralNodeIndexes = [];
  let spiralFraction = 0.9;
  let spiralStep = 0;
  while (spiralFraction > 0.27) {
    const radial = radials[spiralStep % radialCount];
    const wobble = 1 + (random() - 0.5) * 0.02;
    const nodeIndex = addNode(
      centerX + radial.directionX * radial.length * spiralFraction * wobble,
      centerY + radial.directionY * radial.length * spiralFraction * wobble,
      false
    );
    radial.nodesAlongRadial.push({ fraction: spiralFraction, nodeIndex: nodeIndex });
    spiralNodeIndexes.push(nodeIndex);
    const spacingPerTurn = 0.03 + spiralFraction * 0.034;
    spiralFraction -= spacingPerTurn / radialCount;
    spiralStep += 1;
  }

  // the hub is a small tight spiral around the centre
  const hubSpiralNodeIndexes = [];
  let hubFraction = 0.13;
  let hubStep = 0;
  while (hubFraction > 0.035) {
    const radial = radials[hubStep % radialCount];
    const nodeIndex = addNode(
      centerX + radial.directionX * radial.length * hubFraction,
      centerY + radial.directionY * radial.length * hubFraction,
      false
    );
    radial.nodesAlongRadial.push({ fraction: hubFraction, nodeIndex: nodeIndex });
    hubSpiralNodeIndexes.push(nodeIndex);
    hubFraction -= 0.03 / radialCount;
    hubStep += 1;
  }

  // each radial as a polyline: hub, everything that sits on it sorted outward, then the frame
  radials.forEach((radial) => {
    radial.nodesAlongRadial.sort((first, second) => first.fraction - second.fraction);
    radial.polyline = [hubNodeIndex].concat(radial.nodesAlongRadial.map((item) => item.nodeIndex), [radial.frameNodeIndex]);
  });

  // radii go down in a jumbled order, spiders don't lay them in a neat circle
  const radialBuildOrder = radials.map((radial, radialNumber) => radialNumber);
  for (let shuffleIndex = radialBuildOrder.length - 1; shuffleIndex > 0; shuffleIndex--) {
    const swapIndex = Math.floor(random() * (shuffleIndex + 1));
    [radialBuildOrder[shuffleIndex], radialBuildOrder[swapIndex]] = [radialBuildOrder[swapIndex], radialBuildOrder[shuffleIndex]];
  }

  // a few dew drops caught on the sticky spiral
  const dewDrops = [];
  spiralNodeIndexes.forEach((nodeIndex) => {
    if (random() < 0.09) dewDrops.push({ nodeIndex: nodeIndex, radius: 1.3 + random() * 1.9, delay: random() });
  });

  return {
    centerX, centerY, baseRadius, nodes, hubNodeIndex, anchorLines, frameLoop,
    radials, radialBuildOrder, spiralNodeIndexes, hubSpiralNodeIndexes, dewDrops,
  };
}

function resizeOrbWebCanvas() {
  const devicePixelRatioCapped = Math.min(window.devicePixelRatio || 1, 2);
  const canvasBox = orbWebCanvas.getBoundingClientRect();
  canvasCssWidth = canvasBox.width;
  canvasCssHeight = canvasBox.height;
  orbWebCanvas.width = Math.round(canvasCssWidth * devicePixelRatioCapped);
  orbWebCanvas.height = Math.round(canvasCssHeight * devicePixelRatioCapped);
  orbWebContext.setTransform(devicePixelRatioCapped, 0, 0, devicePixelRatioCapped, 0, 0);
  orbWebGeometry = buildOrbWebGeometry(canvasCssWidth, canvasCssHeight, orbWebSeed);
}

function restartOrbWebBuild() {
  orbWebSeed = Math.floor(Math.random() * 100000);
  orbWebGeometry = buildOrbWebGeometry(canvasCssWidth, canvasCssHeight, orbWebSeed);
  orbWebBuildStartTime = performance.now();
}

// draws a polyline through node positions but stops part way along it, for the "being spun" look
function drawPartialPolyline(pointList, fractionToDraw) {
  if (fractionToDraw <= 0 || pointList.length < 2) return;
  let totalLength = 0;
  const segmentLengths = [];
  for (let pointNumber = 1; pointNumber < pointList.length; pointNumber++) {
    const segmentLength = Math.hypot(pointList[pointNumber].x - pointList[pointNumber - 1].x, pointList[pointNumber].y - pointList[pointNumber - 1].y);
    segmentLengths.push(segmentLength);
    totalLength += segmentLength;
  }
  let lengthLeft = totalLength * Math.min(fractionToDraw, 1);
  orbWebContext.beginPath();
  orbWebContext.moveTo(pointList[0].x, pointList[0].y);
  for (let pointNumber = 1; pointNumber < pointList.length; pointNumber++) {
    const segmentLength = segmentLengths[pointNumber - 1];
    if (lengthLeft >= segmentLength) {
      orbWebContext.lineTo(pointList[pointNumber].x, pointList[pointNumber].y);
      lengthLeft -= segmentLength;
    } else {
      const partial = segmentLength === 0 ? 0 : lengthLeft / segmentLength;
      const previousPoint = pointList[pointNumber - 1];
      orbWebContext.lineTo(
        previousPoint.x + (pointList[pointNumber].x - previousPoint.x) * partial,
        previousPoint.y + (pointList[pointNumber].y - previousPoint.y) * partial
      );
      break;
    }
  }
  orbWebContext.stroke();
}

function easeOutCubic(value) {
  const clamped = Math.max(0, Math.min(1, value));
  return 1 - Math.pow(1 - clamped, 3);
}

function drawOrbWebFrame(now) {
  requestAnimationFrame(drawOrbWebFrame);
  if (!orbWebIsOnScreen || !orbWebGeometry) return;

  const web = orbWebGeometry;
  const elapsed = prefersReducedMotion ? 1e9 : now - orbWebBuildStartTime;

  // physics. push nodes near the cursor along its motion, springs pull them home
  pointerState.velocityX *= 0.82;
  pointerState.velocityY *= 0.82;
  const pluckRadius = 90;
  const windTime = now * 0.0006;
  const positions = new Array(web.nodes.length);

  for (let nodeIndex = 0; nodeIndex < web.nodes.length; nodeIndex++) {
    const node = web.nodes[nodeIndex];
    if (!node.isPinned && !prefersReducedMotion) {
      if (pointerState.isInside) {
        const distanceToPointer = Math.hypot(node.restX + node.offsetX - pointerState.x, node.restY + node.offsetY - pointerState.y);
        if (distanceToPointer < pluckRadius) {
          const strength = 1 - distanceToPointer / pluckRadius;
          node.velocityX += pointerState.velocityX * strength * 0.09;
          node.velocityY += pointerState.velocityY * strength * 0.09;
        }
      }
      node.velocityX += -node.offsetX * 0.055;
      node.velocityY += -node.offsetY * 0.055;
      node.velocityX *= 0.9;
      node.velocityY *= 0.9;
      node.offsetX += node.velocityX;
      node.offsetY += node.velocityY;
    }

    // a slow breeze, stronger further from the hub
    let windX = 0;
    let windY = 0;
    if (!node.isPinned && !prefersReducedMotion) {
      const distanceFromHub = Math.hypot(node.restX - web.centerX, node.restY - web.centerY) / web.baseRadius;
      windX = Math.sin(windTime + node.restY * 0.004) * 1.6 * distanceFromHub;
      windY = Math.cos(windTime * 0.8 + node.restX * 0.003) * 1.1 * distanceFromHub;
    }
    positions[nodeIndex] = { x: node.restX + node.offsetX + windX, y: node.restY + node.offsetY + windY };
  }

  orbWebContext.clearRect(0, 0, canvasCssWidth, canvasCssHeight);
  orbWebContext.lineCap = "round";
  orbWebContext.lineJoin = "round";

  // bridge and anchor lines
  const anchorProgress = easeOutCubic((elapsed - buildTimeline.anchorsStart) / buildTimeline.anchorsLength);
  orbWebContext.lineWidth = 0.9;
  web.anchorLines.forEach((anchorLine) => {
    // fade the anchor out toward the far end so it doesn't stop dead at the canvas edge
    const farEnd = positions[anchorLine[0]];
    const cornerEnd = positions[anchorLine[1]];
    const fadingStroke = orbWebContext.createLinearGradient(cornerEnd.x, cornerEnd.y, farEnd.x, farEnd.y);
    fadingStroke.addColorStop(0, "rgba(84, 94, 115, 0.5)");
    fadingStroke.addColorStop(0.35, "rgba(84, 94, 115, 0)");
    orbWebContext.strokeStyle = fadingStroke;
    drawPartialPolyline([cornerEnd, farEnd], anchorProgress);
  });

  // frame
  const frameProgress = easeOutCubic((elapsed - buildTimeline.frameStart) / buildTimeline.frameLength);
  orbWebContext.strokeStyle = "rgba(84, 94, 115, 0.6)";
  orbWebContext.lineWidth = 1.1;
  drawPartialPolyline(web.frameLoop.map((nodeIndex) => positions[nodeIndex]), frameProgress);

  // radii
  orbWebContext.strokeStyle = "rgba(84, 94, 115, 0.5)";
  orbWebContext.lineWidth = 0.8;
  web.radialBuildOrder.forEach((radialNumber, buildPosition) => {
    const radialStart = buildTimeline.radialsStart + buildPosition * buildTimeline.radialStagger;
    const radialProgress = easeOutCubic((elapsed - radialStart) / buildTimeline.radialLength);
    drawPartialPolyline(web.radials[radialNumber].polyline.map((nodeIndex) => positions[nodeIndex]), radialProgress);
  });

  // hub
  const hubProgress = easeOutCubic((elapsed - buildTimeline.hubStart) / buildTimeline.hubLength);
  orbWebContext.strokeStyle = "rgba(26, 34, 51, 0.55)";
  orbWebContext.lineWidth = 0.8;
  drawPartialPolyline(web.hubSpiralNodeIndexes.map((nodeIndex) => positions[nodeIndex]), hubProgress);

  // capture spiral, this is the slow satisfying part
  const spiralProgress = Math.max(0, Math.min(1, (elapsed - buildTimeline.spiralStart) / buildTimeline.spiralLength));
  const spiralEased = 1 - Math.pow(1 - spiralProgress, 1.6);
  orbWebContext.strokeStyle = "rgba(42, 68, 212, 0.55)";
  orbWebContext.lineWidth = 0.75;
  drawPartialPolyline(web.spiralNodeIndexes.map((nodeIndex) => positions[nodeIndex]), spiralEased);

  // dew drops show up once the spiral is done
  const dewProgress = (elapsed - buildTimeline.dewStart) / buildTimeline.dewLength;
  if (dewProgress > 0) {
    web.dewDrops.forEach((dewDrop) => {
      const dropOpacity = easeOutCubic(dewProgress * 1.6 - dewDrop.delay * 0.6);
      if (dropOpacity <= 0) return;
      const dropPosition = positions[dewDrop.nodeIndex];
      orbWebContext.fillStyle = `rgba(42, 68, 212, ${0.28 * dropOpacity})`;
      orbWebContext.beginPath();
      orbWebContext.arc(dropPosition.x, dropPosition.y, dewDrop.radius * dropOpacity, 0, Math.PI * 2);
      orbWebContext.fill();
      orbWebContext.fillStyle = `rgba(255, 255, 255, ${0.9 * dropOpacity})`;
      orbWebContext.beginPath();
      orbWebContext.arc(dropPosition.x - dewDrop.radius * 0.3, dropPosition.y - dewDrop.radius * 0.3, dewDrop.radius * 0.35, 0, Math.PI * 2);
      orbWebContext.fill();
    });
  }

  // a small dot at the hub, stands in for the spider
  if (hubProgress > 0) {
    const hubPosition = positions[web.hubNodeIndex];
    orbWebContext.fillStyle = `rgba(26, 34, 51, ${hubProgress})`;
    orbWebContext.beginPath();
    orbWebContext.arc(hubPosition.x, hubPosition.y, 3.2, 0, Math.PI * 2);
    orbWebContext.fill();
  }
}

orbWebCanvas.addEventListener("pointermove", (event) => {
  const canvasBox = orbWebCanvas.getBoundingClientRect();
  const pointerX = event.clientX - canvasBox.left;
  const pointerY = event.clientY - canvasBox.top;
  if (pointerState.lastX !== null) {
    pointerState.velocityX = Math.max(-40, Math.min(40, pointerX - pointerState.lastX));
    pointerState.velocityY = Math.max(-40, Math.min(40, pointerY - pointerState.lastY));
  }
  pointerState.x = pointerX;
  pointerState.y = pointerY;
  pointerState.lastX = pointerX;
  pointerState.lastY = pointerY;
  pointerState.isInside = true;
});
orbWebCanvas.addEventListener("pointerleave", () => {
  pointerState.isInside = false;
  pointerState.lastX = null;
  pointerState.lastY = null;
});
orbWebCanvas.addEventListener("click", restartOrbWebBuild);
document.getElementById("rebuild-web-button").addEventListener("click", restartOrbWebBuild);

new ResizeObserver(resizeOrbWebCanvas).observe(orbWebCanvas);
new IntersectionObserver((entries) => {
  orbWebIsOnScreen = entries[0].isIntersecting;
}).observe(orbWebCanvas);
resizeOrbWebCanvas();
requestAnimationFrame(drawOrbWebFrame);

// =================================================================
// little drawings on each project card
// all of them are 320 x 180, the css in styles.css does the animating
// =================================================================

function drawCardIllustration(svgElement) {
  const kind = svgElement.dataset.illustration;
  const random = makeSeededRandom(kind.length * 97 + 13);
  let markup = "";

  if (kind === "causal-layers") {
    // six layers like the lighthouse graph: triggers at the top, the crash at the bottom
    const nodeCountPerLayer = [2, 4, 5, 4, 3, 1];
    const layerY = [22, 50, 78, 106, 134, 160];
    const layers = nodeCountPerLayer.map((nodeCount, layerNumber) => {
      const layerNodes = [];
      for (let nodeNumber = 0; nodeNumber < nodeCount; nodeNumber++) {
        const x = 160 + (nodeNumber - (nodeCount - 1) / 2) * (nodeCount > 3 ? 52 : 64) + (random() - 0.5) * 14;
        layerNodes.push({ x: x, y: layerY[layerNumber] });
      }
      return layerNodes;
    });
    let edgeMarkup = "";
    for (let layerNumber = 1; layerNumber < layers.length; layerNumber++) {
      layers[layerNumber].forEach((childNode, childNumber) => {
        const parentLayer = layers[layerNumber - 1];
        const firstParent = parentLayer[Math.min(parentLayer.length - 1, Math.round((childNumber / Math.max(1, layers[layerNumber].length - 1)) * (parentLayer.length - 1)))];
        const secondParent = parentLayer[Math.floor(random() * parentLayer.length)];
        [firstParent, secondParent].forEach((parentNode) => {
          edgeMarkup += `<line class="causal-edge" x1="${parentNode.x.toFixed(1)}" y1="${parentNode.y}" x2="${childNode.x.toFixed(1)}" y2="${childNode.y}" style="--delay:${layerNumber * 140 - 70}ms" />`;
        });
      });
    }
    // two dashed feedback loops curling back up
    const feedbackFrom = layers[3][3];
    const feedbackTo = layers[1][3];
    edgeMarkup += `<path class="causal-feedback" d="M${feedbackFrom.x + 6} ${feedbackFrom.y} C ${feedbackFrom.x + 60} ${feedbackFrom.y - 10}, ${feedbackTo.x + 60} ${feedbackTo.y + 10}, ${feedbackTo.x + 7} ${feedbackTo.y}" />`;
    const secondFrom = layers[4][0];
    const secondTo = layers[2][0];
    edgeMarkup += `<path class="causal-feedback" d="M${secondFrom.x - 6} ${secondFrom.y} C ${secondFrom.x - 60} ${secondFrom.y - 10}, ${secondTo.x - 60} ${secondTo.y + 10}, ${secondTo.x - 7} ${secondTo.y}" />`;
    let nodeMarkup = "";
    layers.forEach((layerNodes, layerNumber) => {
      layerNodes.forEach((node) => {
        const isFailNode = layerNumber === layers.length - 1;
        nodeMarkup += `<circle class="causal-node${isFailNode ? " causal-fail" : ""}" cx="${node.x.toFixed(1)}" cy="${node.y}" r="${isFailNode ? 7 : 5.5}" style="--delay:${layerNumber * 140}ms" />`;
      });
    });
    markup = edgeMarkup + nodeMarkup;
  }

  if (kind === "ego-network") {
    // one account in the middle, its neighbours, their neighbours. three of them share a device
    const centerX = 160;
    const centerY = 90;
    const innerRing = [];
    for (let nodeNumber = 0; nodeNumber < 7; nodeNumber++) {
      const angle = (nodeNumber / 7) * Math.PI * 2 + 0.3;
      innerRing.push({ x: centerX + Math.cos(angle) * 50, y: centerY + Math.sin(angle) * 42 });
    }
    const outerRing = [];
    for (let nodeNumber = 0; nodeNumber < 11; nodeNumber++) {
      const angle = (nodeNumber / 11) * Math.PI * 2 + 0.1 + (random() - 0.5) * 0.3;
      outerRing.push({ x: centerX + Math.cos(angle) * (98 + random() * 22), y: centerY + Math.sin(angle) * (68 + random() * 8), parent: Math.floor((nodeNumber / 11) * 7) });
    }
    const flaggedInner = [1, 2];
    const flaggedOuter = [2];
    let edgeMarkup = "";
    innerRing.forEach((node, nodeNumber) => {
      const isFlagged = flaggedInner.includes(nodeNumber);
      edgeMarkup += `<line class="ego-edge${isFlagged ? " is-flagged" : ""}" x1="${centerX}" y1="${centerY}" x2="${node.x.toFixed(1)}" y2="${node.y.toFixed(1)}" style="--delay:${isFlagged ? 150 : 0}ms" />`;
    });
    outerRing.forEach((node, nodeNumber) => {
      const parentNode = innerRing[node.parent];
      const isFlagged = flaggedOuter.includes(nodeNumber) && flaggedInner.includes(node.parent);
      edgeMarkup += `<line class="ego-edge${isFlagged ? " is-flagged" : ""}" x1="${parentNode.x.toFixed(1)}" y1="${parentNode.y.toFixed(1)}" x2="${node.x.toFixed(1)}" y2="${node.y.toFixed(1)}" style="--delay:300ms" />`;
    });
    // the shared device link that closes the ring
    const ringA = innerRing[flaggedInner[0]];
    const ringB = innerRing[flaggedInner[1]];
    const ringC = outerRing[flaggedOuter[0]];
    edgeMarkup += `<line class="ego-edge is-flagged" x1="${ringA.x.toFixed(1)}" y1="${ringA.y.toFixed(1)}" x2="${ringB.x.toFixed(1)}" y2="${ringB.y.toFixed(1)}" style="--delay:450ms" />`;
    edgeMarkup += `<line class="ego-edge is-flagged" x1="${ringA.x.toFixed(1)}" y1="${ringA.y.toFixed(1)}" x2="${ringC.x.toFixed(1)}" y2="${ringC.y.toFixed(1)}" style="--delay:450ms" />`;
    let nodeMarkup = "";
    outerRing.forEach((node, nodeNumber) => {
      const isFlagged = flaggedOuter.includes(nodeNumber);
      nodeMarkup += `<circle class="ego-node${isFlagged ? " is-flagged" : ""}" cx="${node.x.toFixed(1)}" cy="${node.y.toFixed(1)}" r="4.5" style="--delay:350ms" />`;
    });
    innerRing.forEach((node, nodeNumber) => {
      const isFlagged = flaggedInner.includes(nodeNumber);
      nodeMarkup += `<circle class="ego-node${isFlagged ? " is-flagged" : ""}" cx="${node.x.toFixed(1)}" cy="${node.y.toFixed(1)}" r="6" style="--delay:200ms" />`;
    });
    nodeMarkup += `<circle class="ego-node ego-center" cx="${centerX}" cy="${centerY}" r="8.5" />`;
    markup = `<g class="ego-network-group">${edgeMarkup}${nodeMarkup}</g>`;
  }

  if (kind === "orb-web") {
    const centerX = 160;
    const centerY = 92;
    const radialCount = 16;
    const radialLengths = [];
    let radialMarkup = "";
    let framePointList = [];
    for (let radialNumber = 0; radialNumber < radialCount; radialNumber++) {
      const angle = (radialNumber / radialCount) * Math.PI * 2;
      const length = 68 + random() * 12;
      radialLengths.push(length);
      const endX = centerX + Math.cos(angle) * length * 1.35;
      const endY = centerY + Math.sin(angle) * length;
      framePointList.push(`${endX.toFixed(1)},${endY.toFixed(1)}`);
      radialMarkup += `<line class="mini-web-radial" pathLength="1" x1="${centerX}" y1="${centerY}" x2="${endX.toFixed(1)}" y2="${endY.toFixed(1)}" style="--delay:${radialNumber * 30}ms" />`;
    }
    let spiralPath = "";
    let fraction = 0.9;
    let step = 0;
    while (fraction > 0.2) {
      const radialNumber = step % radialCount;
      const angle = (radialNumber / radialCount) * Math.PI * 2;
      const pointX = centerX + Math.cos(angle) * radialLengths[radialNumber] * 1.35 * fraction;
      const pointY = centerY + Math.sin(angle) * radialLengths[radialNumber] * fraction;
      spiralPath += `${step === 0 ? "M" : "L"}${pointX.toFixed(1)} ${pointY.toFixed(1)} `;
      fraction -= 0.07 / radialCount;
      step += 1;
    }
    markup =
      `<polygon class="mini-web-frame" points="${framePointList.join(" ")}" />` +
      radialMarkup +
      `<path class="mini-web-spiral" pathLength="1" d="${spiralPath}" />` +
      `<circle cx="${centerX}" cy="${centerY}" r="3" fill="var(--ink)" />`;
  }

  if (kind === "video-to-notes") {
    // a video on the left turns into notes and a flashcard on the right
    let noteLines = "";
    const noteWidths = [62, 70, 54, 66, 40, 58];
    noteWidths.forEach((lineWidth, lineNumber) => {
      noteLines += `<rect class="note-line${lineNumber === 0 ? " is-heading" : ""}" x="198" y="${46 + lineNumber * 16}" width="${lineWidth}" height="${lineNumber === 0 ? 7 : 5}" rx="2.5" style="--delay:${400 + lineNumber * 120}ms" />`;
    });
    let flowDots = "";
    for (let dotNumber = 0; dotNumber < 3; dotNumber++) {
      flowDots += `<circle class="flow-dot" cx="148" cy="90" r="3" style="--delay:${dotNumber * 280}ms" />`;
    }
    markup =
      `<rect class="video-frame" x="28" y="44" width="112" height="84" rx="10" />` +
      `<path class="video-play" d="M76 72 L96 86 L76 100 Z" />` +
      `<rect class="video-scrub" x="40" y="114" width="88" height="4" rx="2" />` +
      `<rect class="video-scrub-progress" x="40" y="114" width="88" height="4" rx="2" />` +
      flowDots +
      `<rect class="flash-card" x="214" y="40" width="80" height="104" rx="8" />` +
      `<rect class="note-card" x="186" y="32" width="96" height="120" rx="10" />` +
      noteLines;
  }

  if (kind === "mri-slices") {
    let sliceMarkup = "";
    const sliceCount = 6;
    for (let sliceNumber = 0; sliceNumber < sliceCount; sliceNumber++) {
      const offsetX = 92 + sliceNumber * 12;
      const offsetY = 44 - sliceNumber * 4;
      const fanDistance = (sliceNumber - (sliceCount - 1) / 2) * 16;
      const hasFinding = sliceNumber === 3;
      sliceMarkup +=
        `<g class="mri-slice-group" style="--fan:${fanDistance}px;--delay:${sliceNumber * 40}ms">` +
        `<rect class="mri-slice" x="${offsetX}" y="${offsetY}" width="84" height="100" rx="8" />` +
        `<ellipse class="mri-bone" cx="${offsetX + 42}" cy="${offsetY + 32}" rx="20" ry="16" />` +
        `<ellipse class="mri-bone" cx="${offsetX + 42}" cy="${offsetY + 70}" rx="17" ry="15" />` +
        (hasFinding ? `<circle class="mri-finding" cx="${offsetX + 52}" cy="${offsetY + 51}" r="5" />` : "") +
        `</g>`;
    }
    markup = sliceMarkup;
  }

  if (kind === "form-fill") {
    let fieldMarkup = "";
    const fieldCount = 4;
    for (let fieldNumber = 0; fieldNumber < fieldCount; fieldNumber++) {
      const rowY = 38 + fieldNumber * 24;
      fieldMarkup +=
        `<rect class="form-label" x="78" y="${rowY + 4}" width="${30 + (fieldNumber % 2) * 10}" height="6" rx="3" />` +
        `<rect class="form-field" x="130" y="${rowY}" width="112" height="15" rx="4" />` +
        `<rect class="form-fill" x="133" y="${rowY + 4}" width="${50 + ((fieldNumber * 23) % 45)}" height="7" rx="3" style="--delay:${200 + fieldNumber * 280}ms" />`;
    }
    markup =
      `<rect class="form-sheet" x="62" y="22" width="196" height="140" rx="12" />` +
      fieldMarkup +
      `<g class="form-review-group"><rect class="form-review" x="150" y="134" width="92" height="20" rx="10" />` +
      `<text class="form-review-text" x="196" y="148" text-anchor="middle">Check, then submit</text></g>`;
  }

  if (kind === "documents") {
    // a long article with biased bits highlighted, and the short summary pulled from it
    let longLines = "";
    for (let lineNumber = 0; lineNumber < 8; lineNumber++) {
      const lineWidth = 70 + ((lineNumber * 37) % 30);
      longLines += `<rect class="doc-line" x="66" y="${40 + lineNumber * 13}" width="${lineWidth}" height="5" rx="2.5" />`;
      if (lineNumber === 2 || lineNumber === 5) {
        longLines += `<rect class="doc-highlight" x="64" y="${37 + lineNumber * 13}" width="${lineWidth - 20}" height="11" rx="3" style="--delay:${lineNumber * 90}ms" />`;
      }
    }
    let shortLines = "";
    for (let lineNumber = 0; lineNumber < 3; lineNumber++) {
      shortLines += `<rect class="doc-line" x="${196}" y="${72 + lineNumber * 13}" width="${56 - lineNumber * 10}" height="5" rx="2.5" />`;
    }
    markup =
      `<rect class="doc-sheet" x="52" y="26" width="118" height="132" rx="8" />` +
      longLines +
      `<g class="doc-short"><rect class="doc-sheet" x="184" y="58" width="80" height="64" rx="8" />${shortLines}</g>`;
  }

  svgElement.innerHTML = markup;
}

document.querySelectorAll("svg[data-illustration]").forEach(drawCardIllustration);

// play each drawing once the first time its card scrolls into view
const illustrationObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const illustration = entry.target;
      illustrationObserver.unobserve(illustration);
      illustration.classList.add("is-playing");
      setTimeout(() => illustration.classList.remove("is-playing"), 2600);
    });
  },
  { threshold: 0.6 }
);
document.querySelectorAll(".project-card svg[data-illustration]").forEach((illustration) => illustrationObserver.observe(illustration));

// =================================================================
// project sheet. the card grows into a panel, and shrinks back into the card on close
// =================================================================

const projectSheet = document.querySelector(".project-sheet");
const projectBackdrop = document.querySelector(".project-backdrop");
const projectSheetScroll = projectSheet.querySelector(".project-sheet-scroll");
const projectSheetArt = projectSheet.querySelector(".project-sheet-art");
const projectSheetContext = projectSheet.querySelector(".project-sheet-context");
const projectSheetTitle = projectSheet.querySelector(".project-sheet-title");
const projectSheetBody = projectSheet.querySelector(".project-sheet-body");
const projectSheetCloseButton = projectSheet.querySelector(".project-sheet-close");
let currentlyOpenCard = null;
let sheetIsAnimating = false;

function getSheetTargetBox() {
  if (window.innerWidth < 700) {
    return { top: 0, left: 0, width: window.innerWidth, height: window.innerHeight, radius: 0 };
  }
  const sheetWidth = Math.min(940, window.innerWidth - 48);
  return { top: 24, left: (window.innerWidth - sheetWidth) / 2, width: sheetWidth, height: window.innerHeight - 48, radius: 28 };
}

function openProjectSheet(projectCard) {
  if (sheetIsAnimating || currentlyOpenCard) return;
  const detailTemplate = document.getElementById("project-detail-" + projectCard.dataset.project);
  if (!detailTemplate) return;
  sheetIsAnimating = true;
  currentlyOpenCard = projectCard;

  // fill the sheet with this card's stuff
  projectSheetArt.innerHTML = "";
  const clonedIllustration = projectCard.querySelector("svg[data-illustration]").cloneNode(true);
  clonedIllustration.classList.remove("is-playing");
  projectSheetArt.appendChild(clonedIllustration);
  projectSheetContext.innerHTML = projectCard.querySelector(".project-context").innerHTML;
  projectSheetTitle.textContent = projectCard.querySelector(".project-open").textContent;
  projectSheetBody.innerHTML = "";
  projectSheetBody.appendChild(detailTemplate.content.cloneNode(true));
  Array.from(projectSheet.querySelector(".project-sheet-content").children).forEach((child, childNumber) => child.style.setProperty("--reveal-index", childNumber));
  Array.from(projectSheetBody.children).forEach((child, childNumber) => child.style.setProperty("--reveal-index", childNumber));
  projectSheetScroll.scrollTop = 0;

  const cardBox = projectCard.getBoundingClientRect();
  const cardRadius = getComputedStyle(projectCard).borderTopLeftRadius;
  const targetBox = getSheetTargetBox();

  document.documentElement.style.overflow = "hidden";
  projectSheet.style.top = targetBox.top + "px";
  projectSheet.style.left = targetBox.left + "px";
  projectSheet.style.width = targetBox.width + "px";
  projectSheet.style.height = targetBox.height + "px";
  projectSheet.style.borderRadius = targetBox.radius + "px";
  projectSheet.classList.add("is-open");
  projectBackdrop.classList.add("is-visible");
  projectCard.classList.add("is-hidden-for-sheet");

  const growAnimation = projectSheet.animate(
    [
      { top: cardBox.top + "px", left: cardBox.left + "px", width: cardBox.width + "px", height: cardBox.height + "px", borderRadius: cardRadius },
      { top: targetBox.top + "px", left: targetBox.left + "px", width: targetBox.width + "px", height: targetBox.height + "px", borderRadius: targetBox.radius + "px" },
    ],
    { duration: prefersReducedMotion ? 1 : 560, easing: "cubic-bezier(0.2, 0.85, 0.2, 1)" }
  );

  growAnimation.onfinish = () => {
    projectSheet.classList.add("is-content-visible");
    setTimeout(() => clonedIllustration.classList.add("is-playing"), 200);
    projectSheetCloseButton.focus({ preventScroll: true });
    sheetIsAnimating = false;

    // count the numbers up from zero
    projectSheetBody.querySelectorAll("[data-count-to]").forEach((numberElement) => {
      const targetNumber = parseFloat(numberElement.dataset.countTo);
      const decimalPlaces = parseInt(numberElement.dataset.decimals || "0", 10);
      const prefix = numberElement.dataset.prefix || "";
      const suffix = numberElement.dataset.suffix || "";
      if (prefersReducedMotion) return;
      const countStart = performance.now() + 250;
      const countLength = 1100;
      function stepCount(now) {
        const progress = Math.max(0, Math.min(1, (now - countStart) / countLength));
        const eased = 1 - Math.pow(1 - progress, 3);
        numberElement.textContent = prefix + (targetNumber * eased).toFixed(decimalPlaces) + suffix;
        if (progress < 1) requestAnimationFrame(stepCount);
      }
      numberElement.textContent = prefix + (0).toFixed(decimalPlaces) + suffix;
      requestAnimationFrame(stepCount);
    });
  };
}

function closeProjectSheet() {
  if (sheetIsAnimating || !currentlyOpenCard) return;
  sheetIsAnimating = true;
  const cardToReturnTo = currentlyOpenCard;
  projectSheet.classList.remove("is-content-visible");
  projectBackdrop.classList.remove("is-visible");

  const cardBox = cardToReturnTo.getBoundingClientRect();
  const cardRadius = getComputedStyle(cardToReturnTo).borderTopLeftRadius;
  const sheetBox = projectSheet.getBoundingClientRect();

  const shrinkAnimation = projectSheet.animate(
    [
      { top: sheetBox.top + "px", left: sheetBox.left + "px", width: sheetBox.width + "px", height: sheetBox.height + "px", borderRadius: projectSheet.style.borderRadius },
      { top: cardBox.top + "px", left: cardBox.left + "px", width: cardBox.width + "px", height: cardBox.height + "px", borderRadius: cardRadius },
    ],
    { duration: prefersReducedMotion ? 1 : 460, easing: "cubic-bezier(0.4, 0, 0.2, 1)", delay: prefersReducedMotion ? 0 : 120 }
  );
  shrinkAnimation.onfinish = () => {
    projectSheet.classList.remove("is-open");
    cardToReturnTo.classList.remove("is-hidden-for-sheet");
    document.documentElement.style.overflow = "";
    cardToReturnTo.querySelector(".project-open").focus({ preventScroll: true });
    currentlyOpenCard = null;
    sheetIsAnimating = false;
  };
}

document.querySelectorAll(".project-card").forEach((projectCard) => {
  projectCard.querySelector(".project-open").addEventListener("click", () => openProjectSheet(projectCard));
});
projectSheetCloseButton.addEventListener("click", closeProjectSheet);
projectBackdrop.addEventListener("click", closeProjectSheet);
document.addEventListener("keydown", (event) => {
  if (!currentlyOpenCard) return;
  if (event.key === "Escape") closeProjectSheet();
  // keep tab inside the sheet while it's open
  if (event.key === "Tab") {
    const focusableThings = projectSheet.querySelectorAll("button, a[href]");
    const firstThing = focusableThings[0];
    const lastThing = focusableThings[focusableThings.length - 1];
    if (event.shiftKey && document.activeElement === firstThing) {
      event.preventDefault();
      lastThing.focus();
    } else if (!event.shiftKey && document.activeElement === lastThing) {
      event.preventDefault();
      firstThing.focus();
    }
  }
});
window.addEventListener("resize", () => {
  if (!currentlyOpenCard || sheetIsAnimating) return;
  const targetBox = getSheetTargetBox();
  projectSheet.style.top = targetBox.top + "px";
  projectSheet.style.left = targetBox.left + "px";
  projectSheet.style.width = targetBox.width + "px";
  projectSheet.style.height = targetBox.height + "px";
  projectSheet.style.borderRadius = targetBox.radius + "px";
});

// =================================================================
// scroll stuff: header border, timeline line, nav pill
// =================================================================

const siteHeader = document.querySelector(".site-header");
const timelineWrap = document.querySelector(".timeline-wrap");
const timelineEntries = document.querySelectorAll(".timeline-entry");
const timelineTrack = document.querySelector(".timeline-track");
const navIndicator = document.querySelector(".nav-indicator");
const navLinks = Array.from(document.querySelectorAll(".site-nav a"));
const navSections = navLinks.map((link) => document.querySelector(link.getAttribute("href")));
let scrollUpdateQueued = false;

function updateOnScroll() {
  scrollUpdateQueued = false;
  siteHeader.classList.toggle("is-scrolled", window.scrollY > 8);

  // the timeline line fills as you read down it, and the track stops at the last dot
  const lastTimelineEntry = timelineEntries[timelineEntries.length - 1];
  timelineTrack.style.height = lastTimelineEntry.offsetTop + 8 + "px";
  const readingLine = window.innerHeight * 0.62;
  const timelineBox = timelineWrap.getBoundingClientRect();
  const trackHeight = timelineTrack.offsetHeight;
  const timelineProgress = Math.max(0, Math.min(1, (readingLine - timelineBox.top - 10) / trackHeight));
  timelineWrap.style.setProperty("--timeline-progress", timelineProgress.toFixed(3));
  timelineEntries.forEach((entry) => {
    entry.classList.toggle("is-reached", entry.getBoundingClientRect().top + 14 < readingLine);
  });

  // which section are we in
  let activeLinkIndex = -1;
  navSections.forEach((section, sectionIndex) => {
    if (section && section.getBoundingClientRect().top < window.innerHeight * 0.4) activeLinkIndex = sectionIndex;
  });
  if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) activeLinkIndex = navLinks.length - 1;
  navLinks.forEach((link, linkIndex) => link.classList.toggle("is-active", linkIndex === activeLinkIndex));
  if (activeLinkIndex === -1) {
    navIndicator.style.opacity = "0";
  } else {
    const activeLink = navLinks[activeLinkIndex];
    navIndicator.style.opacity = "1";
    navIndicator.style.width = activeLink.offsetWidth + "px";
    navIndicator.style.transform = `translateX(${activeLink.offsetLeft}px)`;
  }
}

window.addEventListener(
  "scroll",
  () => {
    if (scrollUpdateQueued) return;
    scrollUpdateQueued = true;
    requestAnimationFrame(updateOnScroll);
  },
  { passive: true }
);
window.addEventListener("resize", updateOnScroll);
updateOnScroll();

// =================================================================
// odds and ends
// =================================================================

// copy email, with a quick "copied" so you know it worked
const copyEmailButton = document.getElementById("copy-email-button");
copyEmailButton.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(copyEmailButton.dataset.email);
    copyEmailButton.textContent = "Copied";
  } catch (error) {
    copyEmailButton.textContent = "Couldn't copy, select it instead";
  }
  setTimeout(() => (copyEmailButton.textContent = "Copy"), 1800);
});

// if there's no photo in assets/ yet, drop the photo slot so the layout doesn't look empty
const aboutPhotoImage = document.querySelector(".about-photo img");
function removeAboutPhoto() {
  document.querySelector(".about-photo").remove();
  document.querySelector(".about-layout").classList.add("has-no-photo");
}
if (aboutPhotoImage.complete && aboutPhotoImage.naturalWidth === 0) removeAboutPhoto();
else aboutPhotoImage.addEventListener("error", removeAboutPhoto);

// same idea for the resume link, hide it until the pdf is actually in assets/
const resumeLinkItem = document.querySelector(".resume-link-item");
fetch(resumeLinkItem.querySelector("a").getAttribute("href"), { method: "HEAD" })
  .then((response) => {
    if (!response.ok) resumeLinkItem.remove();
  })
  .catch(() => resumeLinkItem.remove());
