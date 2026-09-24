export const proceduralBrowserRuntime = `
const SVG_NS = 'http://www.w3.org/2000/svg';
const avatarInstanceId = () => typeof globalThis.crypto?.randomUUID === 'function'
  ? globalThis.crypto.randomUUID()
  : Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
const clamp01 = value => Math.max(0, Math.min(1, value));
const easeProgress = (progress, transition) => transition === 'smooth'
  ? progress * progress * (3 - 2 * progress)
  : transition === 'snappy'
    ? 1 - (1 - progress) ** 3
    : 1 - Math.exp(-6 * progress) * Math.cos(8 * progress);
const nearestAngle = (target, current) => {
  let resolved = target;
  while (resolved - current > 180) resolved -= 360;
  while (resolved - current < -180) resolved += 360;
  return resolved;
};
const resolvedTargetExpression = (target, current) => ({
  ...target,
  headX: nearestAngle(target.headX, current.headX),
  headY: nearestAngle(target.headY, current.headY),
  headZ: nearestAngle(target.headZ, current.headZ),
  leftAngle: nearestAngle(target.leftAngle, current.leftAngle),
  rightAngle: nearestAngle(target.rightAngle, current.rightAngle),
});
const colorChannels = color => {
  const value = color.replace('#', '');
  const hex = value.length === 3 ? value.split('').map(channel => channel + channel).join('') : value;
  const numeric = Number.parseInt(hex, 16);
  return [(numeric >> 16) & 255, (numeric >> 8) & 255, numeric & 255];
};
const interpolateColor = (from, to, progress) => {
  const left = colorChannels(from);
  const right = colorChannels(to);
  const value = left.map((channel, index) => Math.round(channel + (right[index] - channel) * progress));
  return '#' + value.map(channel => channel.toString(16).padStart(2, '0')).join('');
};
const mixHex = (from, to, amount) => interpolateColor(from, to, Math.max(0, Math.min(1, amount)));
const hexLuminance = color => {
  const [red, green, blue] = colorChannels(color);
  return (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
};
const resolveExportMaterial = (style, bodyColor) => {
  const type = style && style.type;
  const strength = typeof style?.strength === 'number' ? style.strength : 55;
  const amount = Math.max(0, Math.min(1, strength / 100));
  const isInk = type === 'borderlands';
  const outlineWidth = typeof style?.width === 'number' ? style.width : isInk ? 12 : 8;
  const wobble = typeof style?.wobble === 'number' ? style.wobble : 6;
  const inkColor = typeof style?.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(style.color)
    ? style.color.toLowerCase()
    : '#1a140c';
  return {
    type,
    useShade: type === 'softShade',
    showOutline: type === 'outline' || isInk,
    showGlow: type === 'glow',
    showBorderlands: isInk,
    highlight: mixHex(bodyColor, '#ffffff', 0.16 + amount * 0.42),
    mid: bodyColor,
    shadow: mixHex(bodyColor, '#0b1020', 0.2 + amount * 0.4),
    outlineColor: isInk ? inkColor : hexLuminance(bodyColor) < 0.28 ? mixHex(bodyColor, '#f4f7fb', 0.42) : mixHex(bodyColor, '#0b0d10', 0.64),
    outlineWidth,
    eyeOutlineWidth: outlineWidth * (isInk ? 0.42 : 0.45),
    glowColor: mixHex(bodyColor, '#ffffff', 0.38),
    glowSize: typeof style?.size === 'number' ? style.size : 10,
    wobble,
  };
};
const paintInkStroke = (node, path, color, width, opacity, dash) => {
  node.setAttribute('d', path || '');
  node.setAttribute('fill', 'none');
  node.setAttribute('stroke', color);
  node.setAttribute('stroke-width', String(width));
  node.setAttribute('stroke-linejoin', 'round');
  node.setAttribute('stroke-linecap', 'round');
  node.style.opacity = opacity <= 0 ? '0' : String(opacity);
  if (dash) node.setAttribute('stroke-dasharray', dash);
  else node.removeAttribute('stroke-dasharray');
};
const paintPathStyle = (node, fill, material, forEye) => {
  node.setAttribute('fill', fill);
  if (material.showOutline) {
    node.setAttribute('stroke', material.outlineColor);
    node.setAttribute('stroke-width', String(forEye ? material.eyeOutlineWidth : material.outlineWidth));
    node.setAttribute('stroke-linejoin', 'round');
    node.setAttribute('stroke-linecap', 'round');
    node.style.paintOrder = 'stroke fill';
  } else {
    node.removeAttribute('stroke');
    node.removeAttribute('stroke-width');
    node.style.paintOrder = '';
  }
};
const resolveColors = expression => ({
  body: expression.bodyColor || DATA.avatar.colors.body,
  eyes: expression.eyeColor || DATA.avatar.colors.eyes,
});
const svgElement = name => document.createElementNS(SVG_NS, name);
const avatarLook = {
  palette: DATA.avatar.palette || { accent: DATA.avatar.colors.body, accent2: DATA.avatar.colors.body },
  shading: DATA.avatar.shading || { amount: 0, size: 16, angle: 135, highlight: 0, color: '#1d1b3f' },
};
const pixelFrame = (geometry, offset, colors) => ({
  headPath: geometry.headPath,
  backPaths: geometry.backPaths.filter(Boolean),
  frontPaths: geometry.frontPaths.filter(Boolean),
  leftPath: geometry.leftPath,
  rightPath: geometry.rightPath,
  leftOpacity: geometry.leftVisible ? 1 : 0,
  rightOpacity: geometry.rightVisible ? 1 : 0,
  offsetX: offset.x,
  offsetY: offset.y,
  bodyColor: colors.body,
  eyeColor: colors.eyes,
  paint: geometry,
  look: avatarLook,
});

function mountAvatar(target, options = {}) {
  const host = typeof target === 'string' ? document.querySelector(target) : target;
  if (!host) throw new Error('Avatar target was not found.');
  const animationNames = Object.keys(DATA.animations);
  if (!animationNames.length) throw new Error('The avatar export contains no animations.');
  const instanceId = avatarInstanceId();
  const clipId = 'avatar-procedural-clip-' + instanceId;
  const svg = svgElement('svg');
  svg.setAttribute('viewBox', '-150 -150 300 300');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', DATA.avatar.name);
  svg.style.width = typeof options.size === 'number' ? options.size + 'px' : options.size || '100%';
  svg.style.height = typeof options.size === 'number' ? options.size + 'px' : options.size || '100%';
  svg.style.display = 'block';
  svg.style.overflow = 'visible';
  const renderStyle = DATA.avatar.renderStyle || { type: 'vector' };
  const pixelStyle = renderStyle.type === 'pixel' ? renderStyle : null;
  const canvas = document.createElement('canvas');
  const pixelResolution = pixelStyle ? Math.max(8, Math.min(192, Math.round(pixelStyle.resolution))) : 64;
  canvas.width = pixelResolution;
  canvas.height = pixelResolution;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', DATA.avatar.name);
  canvas.style.width = typeof options.size === 'number' ? options.size + 'px' : options.size || '100%';
  canvas.style.height = typeof options.size === 'number' ? options.size + 'px' : options.size || '100%';
  canvas.style.display = 'block';
  canvas.style.imageRendering = 'pixelated';
  const pixelContext = canvas.getContext('2d', { willReadFrequently: true });
  const defs = svgElement('defs');
  const clipPath = svgElement('clipPath');
  const clipHead = svgElement('path');
  clipPath.id = clipId;
  clipPath.append(clipHead);
  defs.append(clipPath);
  const shadeId = 'avatar-procedural-shade-' + instanceId;
  const glowId = 'avatar-procedural-glow-' + instanceId;
  const inkId = 'avatar-procedural-ink-' + instanceId;
  const shadeGradient = svgElement('radialGradient');
  shadeGradient.id = shadeId;
  shadeGradient.setAttribute('cx', '36%');
  shadeGradient.setAttribute('cy', '30%');
  shadeGradient.setAttribute('r', '72%');
  const shadeStops = [svgElement('stop'), svgElement('stop'), svgElement('stop')];
  shadeStops[0].setAttribute('offset', '0');
  shadeStops[1].setAttribute('offset', '0.48');
  shadeStops[2].setAttribute('offset', '1');
  shadeStops.forEach(stop => shadeGradient.append(stop));
  const glowFilter = svgElement('filter');
  glowFilter.id = glowId;
  glowFilter.setAttribute('x', '-60%');
  glowFilter.setAttribute('y', '-60%');
  glowFilter.setAttribute('width', '220%');
  glowFilter.setAttribute('height', '220%');
  const glowBlur = svgElement('feGaussianBlur');
  glowBlur.setAttribute('in', 'SourceGraphic');
  glowFilter.append(glowBlur);
  const inkFilter = svgElement('filter');
  inkFilter.id = inkId;
  inkFilter.setAttribute('x', '-45%');
  inkFilter.setAttribute('y', '-45%');
  inkFilter.setAttribute('width', '190%');
  inkFilter.setAttribute('height', '190%');
  inkFilter.setAttribute('color-interpolation-filters', 'sRGB');
  const inkNoise = svgElement('feTurbulence');
  inkNoise.setAttribute('type', 'fractalNoise');
  inkNoise.setAttribute('numOctaves', '2');
  inkNoise.setAttribute('seed', '4');
  inkNoise.setAttribute('result', 'noise');
  const inkDisplace = svgElement('feDisplacementMap');
  inkDisplace.setAttribute('in', 'SourceGraphic');
  inkDisplace.setAttribute('in2', 'noise');
  inkDisplace.setAttribute('xChannelSelector', 'R');
  inkDisplace.setAttribute('yChannelSelector', 'G');
  inkFilter.append(inkNoise, inkDisplace);
  const inkErodeId = inkId + '-erode';
  const inkErodeFilter = svgElement('filter');
  inkErodeFilter.id = inkErodeId;
  const inkErode = svgElement('feMorphology');
  inkErode.setAttribute('operator', 'erode');
  inkErodeFilter.append(inkErode);
  const inkRimId = inkId + '-rim';
  const inkRimMask = svgElement('mask');
  inkRimMask.id = inkRimId;
  inkRimMask.setAttribute('maskUnits', 'userSpaceOnUse');
  inkRimMask.setAttribute('x', '-200');
  inkRimMask.setAttribute('y', '-200');
  inkRimMask.setAttribute('width', '400');
  inkRimMask.setAttribute('height', '400');
  const inkRimFull = svgElement('path');
  inkRimFull.setAttribute('fill', '#fff');
  const inkRimCoreGroup = svgElement('g');
  inkRimCoreGroup.setAttribute('filter', 'url(#' + inkErodeId + ')');
  const inkRimCore = svgElement('path');
  inkRimCore.setAttribute('fill', '#000');
  inkRimCoreGroup.append(inkRimCore);
  inkRimMask.append(inkRimFull, inkRimCoreGroup);
  defs.append(shadeGradient, glowFilter, inkFilter, inkErodeFilter, inkRimMask);
  svg.append(defs);
  const motionLayer = svgElement('g');
  const finishLayer = svgElement('g');
  const glowLayer = svgElement('g');
  glowLayer.setAttribute('filter', 'url(#' + glowId + ')');
  glowLayer.style.pointerEvents = 'none';
  const backLayer = svgElement('g');
  const head = svgElement('path');
  const eyesLayer = svgElement('g');
  const leftEye = svgElement('path');
  const rightEye = svgElement('path');
  const frontLayer = svgElement('g');
  const inkLayer = svgElement('g');
  inkLayer.setAttribute('mask', 'url(#' + inkRimId + ')');
  inkLayer.style.pointerEvents = 'none';
  const inkInner = svgElement('path');
  inkLayer.append(inkInner);
  const paintLayer = svgElement('g');
  paintLayer.style.pointerEvents = 'none';
  const shadeNodes = AvatarProceduralEngine.createSvgShadeNodes(document, defs, 'avatar-procedural-shade-layer-' + instanceId);
  eyesLayer.setAttribute('clip-path', 'url(#' + clipId + ')');
  eyesLayer.append(leftEye, rightEye);
  finishLayer.append(glowLayer, backLayer, head, paintLayer, shadeNodes.layer, eyesLayer, frontLayer, inkLayer);
  motionLayer.append(finishLayer);
  svg.append(motionLayer);
  const renderElement = pixelStyle ? canvas : svg;
  host.replaceChildren(renderElement);

  const ensurePaths = (group, paths, fill, material) => {
    while (group.children.length < paths.length) group.append(svgElement('path'));
    while (group.children.length > paths.length) group.lastElementChild.remove();
    paths.forEach((path, index) => {
      group.children[index].setAttribute('d', path);
      paintPathStyle(group.children[index], fill, material, false);
    });
  };
  let currentAnimation = options.animation && DATA.animations[options.animation] ? options.animation : animationNames[0];
  const initialStep = DATA.animations[currentAnimation].steps[0];
  const initialExpression = DATA.expressions[initialStep.expressionId];
  let currentPose = AvatarProceduralEngine.poseFromExpression(initialExpression);
  let currentColors = resolveColors(initialExpression);
  let blinkAmount = 1;
  let transitionState = null;
  let blinkState = null;
  let frameRequest = null;
  let stepTimer = null;
  let blinkTimer = null;
  let blinkDueAt = null;
  let stepIndex = 0;
  let direction = 1;
  let playing = false;
  let paused = false;
  let pausedRemainingMs = 0;
  let pausedTransition = null;
  let pausedBlink = null;
  let pausedBlinkDelay = 0;
  let stepDueAt = null;
  let eyeAmbientStartedAt = performance.now();
  let bodyAmbientStartedAt = performance.now();
  let eyeAmbientSignature = initialExpression.eyeMotion;
  let bodyAmbientSignature = initialExpression.bodyMotion;
  let ambientStrength = 1;
  let lastAmbientFrame = 0;

  const applyMotion = expression => {
    const now = performance.now();
    if (expression.eyeMotion !== eyeAmbientSignature) {
      eyeAmbientSignature = expression.eyeMotion;
      eyeAmbientStartedAt = now;
    }
    if (expression.bodyMotion !== bodyAmbientSignature) {
      bodyAmbientSignature = expression.bodyMotion;
      bodyAmbientStartedAt = now;
    }
  };
  const render = (time = performance.now()) => {
    const eyeElapsed = time - eyeAmbientStartedAt;
    const bodyElapsed = time - bodyAmbientStartedAt;
    const expression = currentPose.expression.bodyMotion !== 'none'
      ? AvatarProceduralEngine.applyAmbientBodyMotion(currentPose.expression, bodyElapsed, ambientStrength)
      : currentPose.expression;
    const eyeOffset = AvatarProceduralEngine.ambientEyeOffset(currentPose.expression, eyeElapsed, ambientStrength);
    const renderedPose = AvatarProceduralEngine.poseFromExpression(expression);
    const geometry = AvatarProceduralEngine.renderAvatar(renderedPose, DATA.avatar.surface, blinkAmount, {
      includeWire: false,
      bodyNodes: DATA.avatar.bodyNodes,
      limbs: DATA.avatar.limbs,
      markings: DATA.avatar.markings || [],
      eyeOffset,
    });
    const offset = AvatarProceduralEngine.ambientBodyOffset(currentPose.expression, bodyElapsed, ambientStrength);
    if (pixelStyle && pixelContext) {
      AvatarProceduralEngine.paintPixelAvatar(
        pixelContext,
        pixelFrame(geometry, offset, currentColors),
        { type: 'pixel', resolution: pixelResolution }
      );
      return;
    }
    const material = resolveExportMaterial(renderStyle, currentColors.body);
    const bodyFill = material.useShade ? 'url(#' + shadeId + ')' : currentColors.body;
    shadeStops[0].setAttribute('stop-color', material.highlight);
    shadeStops[1].setAttribute('stop-color', material.mid);
    shadeStops[2].setAttribute('stop-color', material.shadow);
    glowBlur.setAttribute('stdDeviation', String(material.glowSize));
    glowLayer.style.display = material.showGlow ? '' : 'none';
    inkNoise.setAttribute('baseFrequency', String(Math.max(0.018, 0.056 - material.wobble * 0.002)));
    inkDisplace.setAttribute('scale', String(2 + material.wobble * 0.85));
    if (material.showBorderlands) finishLayer.setAttribute('filter', 'url(#' + inkId + ')');
    else finishLayer.removeAttribute('filter');
    motionLayer.setAttribute('transform', 'translate(' + offset.x + ' ' + offset.y + ')');
    ensurePaths(glowLayer, material.showGlow ? [geometry.bodyFillPath || geometry.headPath] : [], material.glowColor, { showOutline: false });
    ensurePaths(backLayer, [], bodyFill, material);
    ensurePaths(frontLayer, [], bodyFill, material);
    head.setAttribute('d', geometry.bodyFillPath || geometry.headPath);
    paintPathStyle(head, bodyFill, material, false);
    clipHead.setAttribute('d', geometry.headPath);
    AvatarProceduralEngine.syncSvgPaintOps(
      paintLayer,
      AvatarProceduralEngine.buildPaintPlan(
        geometry,
        AvatarProceduralEngine.paintColorsOf(currentColors, avatarLook.palette),
        bodyFill
      ),
      'url(#' + clipId + ')'
    );
    AvatarProceduralEngine.syncSvgShadeLayers(
      shadeNodes,
      geometry.bodyFillPath || geometry.headPath,
      AvatarProceduralEngine.shadeLayers(avatarLook.shading)
    );
    leftEye.setAttribute('d', geometry.leftPath);
    rightEye.setAttribute('d', geometry.rightPath);
    paintPathStyle(leftEye, currentColors.eyes, material, true);
    paintPathStyle(rightEye, currentColors.eyes, material, true);
    leftEye.style.display = geometry.leftVisible ? '' : 'none';
    rightEye.style.display = geometry.rightVisible ? '' : 'none';
    if (material.showBorderlands) {
      const inkBody = geometry.bodyFillPath || geometry.headPath;
      inkErode.setAttribute('radius', String(Math.max(1.5, material.outlineWidth * 0.45)));
      inkRimFull.setAttribute('d', inkBody);
      inkRimCore.setAttribute('d', inkBody);
      paintInkStroke(
        inkInner,
        inkBody,
        material.outlineColor,
        material.outlineWidth * 0.28,
        1,
        '16 22 9 18 13 26'
      );
    } else {
      inkInner.setAttribute('d', '');
    }
  };
  const tick = time => {
    frameRequest = null;
    if (transitionState) {
      const linear = clamp01((time - transitionState.startedAt) / transitionState.durationMs);
      const eased = easeProgress(linear, transitionState.transition);
      ambientStrength = clamp01(eased);
      const expression = { ...transitionState.fromPose.expression };
      AvatarProceduralEngine.expressionFields.forEach(field => {
        expression[field] = transitionState.fromPose.expression[field] +
          (transitionState.toPose.expression[field] - transitionState.fromPose.expression[field]) * eased;
      });
      expression.eyeMotion = transitionState.toPose.expression.eyeMotion;
      expression.bodyMotion = transitionState.toPose.expression.bodyMotion;
      currentPose = AvatarProceduralEngine.poseFromExpression(expression);
      currentColors = {
        body: interpolateColor(transitionState.fromColors.body, transitionState.toColors.body, clamp01(eased)),
        eyes: interpolateColor(transitionState.fromColors.eyes, transitionState.toColors.eyes, clamp01(eased)),
      };
      if (linear >= 1) {
        currentPose = transitionState.toPose;
        currentColors = transitionState.toColors;
        transitionState = null;
        ambientStrength = 1;
      }
    }
    if (blinkState) {
      const progress = clamp01((time - blinkState.startedAt) / blinkState.durationMs);
      if (progress <= 0.42) {
        const closeProgress = progress / 0.42;
        blinkAmount = 1 - closeProgress * closeProgress;
      } else {
        const openProgress = (progress - 0.42) / 0.58;
        blinkAmount = 1 - (1 - openProgress) ** 2;
      }
      if (progress >= 1) {
        blinkAmount = 1;
        blinkState = null;
      }
    }
    const ambientActive = AvatarProceduralEngine.hasAmbientMotion(currentPose.expression);
    if (transitionState || blinkState || !ambientActive || time - lastAmbientFrame >= 1000 / 30) {
      render(time);
      if (ambientActive) lastAmbientFrame = time;
    }
    if (transitionState || blinkState || ambientActive) frameRequest = requestAnimationFrame(tick);
  };
  const requestTick = () => {
    if (frameRequest === null) frameRequest = requestAnimationFrame(tick);
  };
  const animateTo = (expressionId, durationMs, transition) => {
    const target = DATA.expressions[expressionId];
    if (!target) return;
    applyMotion(target);
    const resolved = resolvedTargetExpression(target, currentPose.expression);
    const targetPose = AvatarProceduralEngine.poseFromExpression(resolved);
    const targetColors = resolveColors(target);
    if (durationMs <= 0) {
      ambientStrength = 1;
      transitionState = null;
      currentPose = targetPose;
      currentColors = targetColors;
      render();
      if (AvatarProceduralEngine.hasAmbientMotion(currentPose.expression)) requestTick();
      return;
    }
    transitionState = {
      fromPose: currentPose,
      toPose: targetPose,
      fromColors: currentColors,
      toColors: targetColors,
      startedAt: performance.now(),
      durationMs,
      transition,
      expressionId,
    };
    ambientStrength = 0;
    requestTick();
  };
  const clearSchedule = () => {
    if (stepTimer !== null) clearTimeout(stepTimer);
    if (blinkTimer !== null) clearTimeout(blinkTimer);
    stepTimer = null;
    blinkTimer = null;
    blinkDueAt = null;
    stepDueAt = null;
  };
  const scheduleBlink = (animation, delay) => {
    if (!animation.blink.enabled) return;
    blinkDueAt = performance.now() + delay;
    blinkTimer = setTimeout(() => {
      blinkDueAt = null;
      blinkState = { startedAt: performance.now(), durationMs: animation.blink.durationMs };
      requestTick();
      const range = animation.blink.maxIntervalMs - animation.blink.minIntervalMs;
      scheduleBlink(animation, animation.blink.durationMs + animation.blink.minIntervalMs + Math.random() * range);
    }, delay);
  };
  const advance = animation => {
    const last = animation.steps.length - 1;
    const playbackMode = options.loop === true ? 'loop' : options.loop === false ? 'once' : animation.playbackMode;
    if (playbackMode === 'once' && stepIndex >= last) {
      playing = false;
      options.onAnimationEnd?.(currentAnimation);
      return;
    }
    if (playbackMode === 'pingPong' && last > 0) {
      if (stepIndex >= last) direction = -1;
      else if (stepIndex <= 0) direction = 1;
      stepIndex += direction;
    } else stepIndex = (stepIndex + 1) % (last + 1);
    runStep(animation);
  };
  const runStep = animation => {
    if (!playing || !animation.steps.length) return;
    const step = animation.steps[stepIndex];
    animateTo(step.expressionId, step.transitionMs, step.transition);
    const duration = step.transitionMs + step.holdMs;
    stepDueAt = performance.now() + duration;
    stepTimer = setTimeout(() => advance(animation), duration);
  };
  const api = {
    element: renderElement,
    get animation() { return currentAnimation; },
    get playing() { return playing; },
    play(animationName) {
      animationName = animationName || currentAnimation;
      if (!DATA.animations[animationName]) throw new Error('Unknown animation: ' + animationName);
      clearSchedule();
      if (animationName === currentAnimation && paused) {
        paused = false;
        playing = true;
        if (pausedTransition) animateTo(pausedTransition.expressionId, pausedTransition.durationMs, pausedTransition.transition);
        if (pausedBlink) {
          blinkState = {
            startedAt: performance.now() - pausedBlink.progress * pausedBlink.durationMs,
            durationMs: pausedBlink.durationMs,
          };
          requestTick();
        }
        stepDueAt = performance.now() + pausedRemainingMs;
        stepTimer = setTimeout(() => advance(DATA.animations[currentAnimation]), pausedRemainingMs);
        scheduleBlink(
          DATA.animations[currentAnimation],
          pausedBlinkDelay || DATA.animations[currentAnimation].blink.minIntervalMs
        );
        pausedTransition = null;
        pausedBlink = null;
        pausedBlinkDelay = 0;
        return api;
      }
      currentAnimation = animationName;
      stepIndex = 0;
      direction = 1;
      paused = false;
      playing = true;
      runStep(DATA.animations[currentAnimation]);
      scheduleBlink(DATA.animations[currentAnimation], DATA.animations[currentAnimation].blink.initialDelayMs);
      return api;
    },
    pause() {
      const now = performance.now();
      if (playing && stepDueAt !== null) pausedRemainingMs = Math.max(stepDueAt - now, 0);
      pausedBlinkDelay = blinkDueAt === null ? 0 : Math.max(blinkDueAt - now, 0);
      if (transitionState) {
        const elapsed = now - transitionState.startedAt;
        pausedTransition = {
          expressionId: transitionState.expressionId,
          durationMs: Math.max(transitionState.durationMs - elapsed, 0),
          transition: transitionState.transition,
        };
      }
      if (blinkState) {
        pausedBlink = {
          progress: clamp01((now - blinkState.startedAt) / blinkState.durationMs),
          durationMs: blinkState.durationMs,
        };
      }
      clearSchedule();
      transitionState = null;
      blinkState = null;
      paused = true;
      playing = false;
      render();
      return api;
    },
    stop() {
      clearSchedule();
      transitionState = null;
      blinkState = null;
      blinkAmount = 1;
      pausedBlink = null;
      pausedBlinkDelay = 0;
      paused = false;
      playing = false;
      stepIndex = 0;
      direction = 1;
      const first = DATA.animations[currentAnimation].steps[0];
      if (first) animateTo(first.expressionId, 0, first.transition);
      return api;
    },
    destroy() {
      clearSchedule();
      if (frameRequest !== null) cancelAnimationFrame(frameRequest);
      renderElement.remove();
    },
  };
  applyMotion(initialExpression);
  render();
  if (AvatarProceduralEngine.hasAmbientMotion(initialExpression)) requestTick();
  if (options.autoplay !== false) api.play(currentAnimation);
  return api;
}
`
