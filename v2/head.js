// Miranda's head, lit by your cursor.
//
// Recreates MIRANDA (WEB).blend in the browser (a copy of MIRANDA (FINAL).blend with shorter,
// glossier hair and the web camera):
//   - a 50 mm camera 4.5 m back, looking ~2° down onto the face (a closer, wider lens
//     stretches the features)
//   - Blender's lights as they are: HDRI world at 0.6, Point.003, Sun.002 at 20, AgX
//   - the face is lit exactly as in Blender and never changes
//   - the round catchlight in each eye follows the cursor: the eye shader draws the
//     reflection of a 0.3 m sphere light placed under the cursor (light that nothing else sees)
//   - the head turns and tilts toward the cursor too, under the same fixed lights
//
// Values marked "Blender:" come straight from the .blend — change them there first.

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { HDRLoader } from "three/addons/loaders/HDRLoader.js";

const headEl = document.querySelector(".head");
const canvas = headEl.querySelector(".head-canvas");
// The cursor-following motion runs even with Reduce Motion on (by choice: it is small and
// only follows the pointer). styles.css still drops the fade-in for those visitors.
const isTouchOnly = matchMedia("(hover: none)").matches;

// ---- tweakables -----------------------------------------------------------
const LIGHT = {
  // Blender: Point.003, 100 W, radius 0.3. three.js candela = W / 4π
  intensity: 100 / (4 * Math.PI),
  radius: 0.3,
  follow: 0.12,   // 0–1, how snappily the eye highlight chases the cursor (per 60 fps frame)
  range: 30,      // degrees across the eyeball the highlight travels when the cursor hits a
                  // screen edge (the black of the eye reaches ~37°, so 30 keeps it inside)
};
const CATCHLIGHT = { softness: 0.35, strength: 1.0 };
const TURN = {
  yaw: 14,        // degrees the head turns left/right when the cursor hits a screen edge
  pitch: 9,       // degrees it tips up/down
  roll: 6,        // degrees it tilts its ear toward the shoulder on the cursor's side
  follow: 0.05,   // 0–1, slower than the highlight so the head lags behind the eyes
};

// ---- scene constants (glTF Y-up coordinates) ------------------------------
// Camera: MIRANDA (WEB).blend's "Camera". In Blender: location (4.4286, 0, -0.3618),
// rotation (87.72°, -0.05°, 90.57°), focal length 50 mm, looking ~2° down onto the face.
// (Its lens shift is replaced by the framing below, which centres the head on any screen.)
const CAM = {
  pos: [4.42861, -0.36178, 0],
  fwd: [-0.99916, -0.03972, 0.00992],
  up: [-0.03971, 0.99921, 0.00127],
};
const EYE_MID = [0.5593, 0.1828, -0.02205];                // halfway between the eyeballs
const NECK = [0.05, -0.25, -0.02];                         // the point the head turns around
// Where the head sits in the camera's view, in tangent units. Measured from the model's
// vertices once it loads (see measureHead); used to size and centre it on any screen.
// If the camera moves, update --head-aspect in styles.css and re-shoot assets/miranda-render.webp.
const HEAD = { tanW: 0.28885, cx: 0.01564, cy: 0.15808, aspect: 1.1436 };
const HDRI_STRENGTH = 0.6;                                  // Blender: world Background strength
const SUN = {                                               // Blender: Sun.002
  dir: [0.0421, -0.63997, 0.76724],
  color: [1, 0.29567, 0.00936],
  strength: 20,
};
const HAIR_ENV = 0.25;                                      // share of HDRI light the hair gets
const POINT_POS = [2.10208, 0.41842, 0.67265];              // Blender: Point.003 (resting spot)

// ---- renderer / scene -----------------------------------------------------
const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.AgXToneMapping;                // Blender: View Transform = AgX
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

const scene = new THREE.Scene();
// Blender's equirect faces the opposite way to three.js's, hence the half turn.
scene.environmentRotation.set(0, Math.PI, 0);
scene.environmentIntensity = HDRI_STRENGTH;

const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 50);
camera.position.fromArray(CAM.pos);
camera.up.fromArray(CAM.up);
camera.lookAt(new THREE.Vector3().fromArray(CAM.pos).add(new THREE.Vector3().fromArray(CAM.fwd)));
camera.updateMatrixWorld();

const sun = new THREE.DirectionalLight(new THREE.Color().setRGB(...SUN.color), SUN.strength);
sun.position.fromArray(SUN.dir).multiplyScalar(-4);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -1.2, right: 1.2, top: 1.2, bottom: -1.2, near: 0.1, far: 10 });
// Small biases so the eyeballs pick up the socket's shadow (bigger values leak light
// into the gap between eye and face).
sun.shadow.bias = -0.0002;
sun.shadow.normalBias = 0.002;
scene.add(sun, sun.target);

const light = new THREE.PointLight(0xffffff, LIGHT.intensity, 0, 2);
light.position.fromArray(POINT_POS);
light.castShadow = true;
light.shadow.mapSize.set(1024, 1024);
light.shadow.camera.near = 0.05;
light.shadow.bias = -0.0004;
light.shadow.normalBias = 0.003;
light.shadow.radius = 3;
scene.add(light);

// ---- eye material ---------------------------------------------------------
// Blender "eyes": Generated.x → ramp (0.1035 black → 0.1372 white), roughness 0.128, IOR 1.6.
// Generated coords = position normalised to the mesh's bounding box.
// Where the eye-only "cursor light" is. Starts at Point.003 so the resting look matches Blender.
const catchPos = new THREE.Vector3().fromArray(POINT_POS);
const lightUniform = { value: catchPos };
function makeEyeMaterial(geometry) {
  geometry.computeBoundingBox();
  const { min, max } = geometry.boundingBox;
  const mat = new THREE.MeshPhysicalMaterial({ roughness: 0.128, ior: 1.6, metalness: 0 });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uLight = lightUniform;
    shader.uniforms.uLightRadius = { value: LIGHT.radius };
    shader.uniforms.uLightColor = { value: light.color };
    shader.uniforms.uCatch = { value: new THREE.Vector2(CATCHLIGHT.softness, CATCHLIGHT.strength) };
    shader.uniforms.uGenMinX = { value: min.x };
    shader.uniforms.uGenSizeX = { value: max.x - min.x };

    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying float vGenX;\nvarying vec3 vWorldN;\nvarying vec3 vWorldP;")
      .replace("#include <beginnormal_vertex>", "#include <beginnormal_vertex>\nvWorldN = normalize(mat3(modelMatrix) * objectNormal);")
      .replace("#include <project_vertex>", "#include <project_vertex>\nvGenX = position.x;\nvWorldP = (modelMatrix * vec4(transformed, 1.0)).xyz;");

    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>
        uniform vec3 uLight; uniform float uLightRadius; uniform vec3 uLightColor; uniform vec2 uCatch;
        uniform float uGenMinX; uniform float uGenSizeX;
        varying float vGenX; varying vec3 vWorldN; varying vec3 vWorldP;`)
      .replace("#include <color_fragment>", `#include <color_fragment>
        float gen = (vGenX - uGenMinX) / uGenSizeX;
        diffuseColor.rgb = vec3(clamp((gen - 0.1035) / (0.1372 - 0.1035), 0.0, 1.0));`)
      // Drop the real lights' glossy highlights on the eyes: the only highlight should be
      // the cursor one below. (Diffuse shading and HDRI reflections stay.)
      .replace("#include <lights_fragment_end>", `#include <lights_fragment_end>
        reflectedLight.directSpecular = vec3(0.0);`)
      // A 0.3 m sphere light reflects in a glossy eye as a bright round disc. Draw that
      // disc where the reflected view ray hits the cursor light.
      .replace("#include <opaque_fragment>", `
        vec3 V = normalize(cameraPosition - vWorldP);
        vec3 R = reflect(-V, normalize(vWorldN));
        vec3 toL = uLight - vWorldP;
        float dist = length(toL);
        float ang = asin(clamp(uLightRadius / dist, 0.0, 1.0));
        float d = dot(R, toL / dist);
        float disc = smoothstep(cos(ang * (1.0 + uCatch.x)), cos(ang * (1.0 - uCatch.x)), d);
        outgoingLight += uLightColor * disc * uCatch.y;
        #include <opaque_fragment>`);
  };
  return mat;
}

// ---- framing --------------------------------------------------------------
// Same rule as .head-fallback in styles.css: the head fills the .head box, less --head-pad
// on every side (room for it to turn), and is centred.
// The page scales the whole stage with a CSS transform, so the canvas is drawn at its
// on-screen size (not its layout size) to stay sharp.
function resize() {
  const vw = canvas.clientWidth, vh = canvas.clientHeight;
  if (!vw || !vh) return;
  const shown = canvas.getBoundingClientRect().width / vw;
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2) * shown);
  renderer.setSize(vw, vh, false);

  const pad = parseFloat(getComputedStyle(headEl).getPropertyValue("--head-pad")) || 0;
  const headPx = Math.min(vw - 2 * pad, (vh - 2 * pad) * HEAD.aspect);
  const tanPerPx = HEAD.tanW / headPx;
  const halfW = (vw / 2) * tanPerPx;              // viewport half-size in tangent units
  const halfH = (vh / 2) * tanPerPx;
  camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(halfH));
  camera.aspect = vw / vh;
  camera.updateProjectionMatrix();
  // Lens shift so the head (not the camera axis) lands in the middle of the screen.
  camera.projectionMatrix.elements[8] = HEAD.cx / halfW;
  camera.projectionMatrix.elements[9] = HEAD.cy / halfH;
  camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  dirty = true;
}

// The head's outline in the camera's view, in tangent units.
function measureHead(root) {
  root.updateMatrixWorld(true);
  const v = new THREE.Vector3();
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  root.traverse((o) => {
    if (!o.isMesh) return;
    const p = o.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld).applyMatrix4(camera.matrixWorldInverse);
      const tx = v.x / -v.z, ty = v.y / -v.z;
      x0 = Math.min(x0, tx); x1 = Math.max(x1, tx);
      y0 = Math.min(y0, ty); y1 = Math.max(y1, ty);
    }
  });
  Object.assign(HEAD, { tanW: x1 - x0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, aspect: (x1 - x0) / (y1 - y0) });
}

// The head hangs off this pivot so it can turn around the neck.
const neck = new THREE.Group();
neck.position.fromArray(NECK);
scene.add(neck);

// ---- load ----------------------------------------------------------------
const draco = new DRACOLoader().setDecoderPath("https://cdn.jsdelivr.net/npm/three@0.186.1/examples/jsm/libs/draco/gltf/");
const gltfLoader = new GLTFLoader().setDRACOLoader(draco);
const asset = (p) => new URL(p, import.meta.url).href;

let ready = false;
let dirty = true;

Promise.all([
  gltfLoader.loadAsync(asset("assets/miranda-head.glb")),
  new HDRLoader().loadAsync(asset("assets/museum_of_ethnography_1k.hdr")),
]).then(([gltf, hdr]) => {
  hdr.mapping = THREE.EquirectangularReflectionMapping;
  scene.environment = hdr;

  const root = gltf.scene;
  const exportedLights = [];
  root.traverse((o) => {
    if (o.isLight) exportedLights.push(o);   // recreated above with Blender's real values
    if (!o.isMesh) return;
    o.castShadow = o.receiveShadow = true;
    if (o.material.name === "eyes") o.material = makeEyeMaterial(o.geometry);
    // The 1k HDRI reflects as blotches in the hair; keep only a little of it so the hair
    // reads smooth, with the lights' clean shine on top.
    if (o.material.name === "Hair") o.material.envMapIntensity = HAIR_ENV;
  });
  exportedLights.forEach((l) => l.parent.remove(l));
  root.position.sub(neck.position);
  neck.add(root);
  measureHead(neck);

  resize();
  renderer.render(scene, camera);
  sun.shadow.autoUpdate = false;              // redrawn only while the head is turning
  light.shadow.autoUpdate = false;
  headEl.classList.add("is-live");
  ready = true;
  start();
}).catch((err) => console.warn("3D head failed to load; keeping the static render.", err));

new ResizeObserver(resize).observe(canvas);
addEventListener("resize", resize);            // the stage's scale changes without a layout change

// ---- cursor -> eye highlight + head turn -------------------------------------
// The cursor picks the spot on the eyeball where the highlight should sit: the screen centre
// is the middle of the eye, a screen edge is LIGHT.range degrees out (measured on the
// eyeball, so it turns with the head). The eye-only light is then placed where it reflects
// into the camera from that spot, at Point.003's distance so the highlight keeps its size.
// Until the mouse moves, the head faces front and the light sits where Blender put Point.003.
const target = new THREE.Vector3().fromArray(POINT_POS);
const eyeMid0 = new THREE.Vector3().fromArray(EYE_MID);
const lightDist = eyeMid0.distanceTo(target);
const toCam0 = camera.position.clone().sub(eyeMid0).normalize();
const camRight = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
const eyeRight = camRight.clone().addScaledVector(toCam0, -camRight.dot(toCam0)).normalize();
const eyeUp = new THREE.Vector3().crossVectors(toCam0, eyeRight);
const eyeMid = new THREE.Vector3(), toCam = new THREE.Vector3(), spot = new THREE.Vector3();

let aim = null;                                            // cursor in -1…1, once it has moved
const turn = { yaw: 0, pitch: 0, roll: 0 };                         // current head angles, radians

function setTarget(nx, ny) {
  const len = Math.hypot(nx, ny);
  if (len > 1) { nx /= len; ny /= len; }                  // corners stop at the edge circle
  aim = { x: nx, y: ny, len: Math.min(len, 1) };
  dirty = true;
}

// Where the eye-only light goes for the current aim and head pose.
function updateTarget() {
  if (!aim) return;
  const a = THREE.MathUtils.degToRad(LIGHT.range) * aim.len;
  const s = aim.len > 1e-6 ? Math.sin(a) / aim.len : 0;
  spot.copy(toCam0).multiplyScalar(Math.cos(a))            // surface normal at the highlight
    .addScaledVector(eyeRight, aim.x * s).addScaledVector(eyeUp, aim.y * s)
    .applyQuaternion(neck.quaternion);
  eyeMid.copy(eyeMid0).sub(neck.position).applyQuaternion(neck.quaternion).add(neck.position);
  toCam.copy(camera.position).sub(eyeMid).normalize();
  // Mirror the view direction about that normal to find where the light must be.
  target.copy(spot).multiplyScalar(2 * spot.dot(toCam)).sub(toCam)
    .multiplyScalar(lightDist).add(eyeMid);
}

// Ease the head toward the cursor. Returns true while it is still moving.
function turnHead(k) {
  if (!aim) return false;
  const yaw = THREE.MathUtils.degToRad(TURN.yaw) * aim.x;  // + turns the face to screen-right
  const pitch = THREE.MathUtils.degToRad(TURN.pitch) * aim.y;
  const roll = THREE.MathUtils.degToRad(TURN.roll) * aim.x;
  const dy = yaw - turn.yaw, dp = pitch - turn.pitch, dr = roll - turn.roll;
  if (Math.abs(dy) + Math.abs(dp) + Math.abs(dr) < 1e-5) return false;
  turn.yaw += dy * k;
  turn.pitch += dp * k;
  turn.roll += dr * k;
  // The face looks down +x; a +y turn swings it toward −z (screen-right), +z tips it up,
  // and −x tilts the crown toward screen-right.
  neck.rotation.set(-turn.roll, turn.yaw, turn.pitch);
  neck.updateMatrixWorld(true);
  sun.shadow.needsUpdate = light.shadow.needsUpdate = true;
  return true;
}

let lastPointer = 0;
window.addEventListener("pointermove", (e) => {
  lastPointer = performance.now();
  setTarget((e.clientX / innerWidth) * 2 - 1, -((e.clientY / innerHeight) * 2 - 1));
}, { passive: true });

// ---- loop -----------------------------------------------------------------
let visible = true;
let running = false;
function start() {
  if (running || !visible || !ready) return;
  running = true;
  requestAnimationFrame(tick);
}
new IntersectionObserver(([entry]) => {
  visible = entry.isIntersecting;
  start();
}).observe(canvas);

function render() {
  renderer.render(scene, camera);
  dirty = false;
}

// Per-frame easing tuned at 60 fps, scaled so it feels the same at any frame rate.
const ease = (follow, frames) => 1 - Math.pow(1 - follow, frames);
let lastTick = 0;

function tick(now) {
  if (!visible) { running = false; lastTick = 0; return; }
  const frames = lastTick ? Math.min((now - lastTick) / (1000 / 60), 4) : 1;
  lastTick = now;

  // No cursor on touch screens: the highlight drifts on its own between drags.
  if (isTouchOnly && now - lastPointer > 2500) {
    const t = now / 1000;
    setTarget(Math.sin(t * 0.5) * 0.8, Math.sin(t * 0.8) * 0.5);
  }

  if (turnHead(ease(TURN.follow, frames))) dirty = true;
  updateTarget();
  if (catchPos.distanceToSquared(target) > 1e-7) {
    catchPos.lerp(target, ease(LIGHT.follow, frames));
    dirty = true;
  }
  if (dirty) render();
  requestAnimationFrame(tick);
}

// Visit /v2/?debug to poke at the scene from the console: __head.light, __head.sun…
if (new URLSearchParams(location.search).has("debug")) {
  window.__head = { THREE, renderer, scene, camera, light, sun, LIGHT, CATCHLIGHT, render, setTarget, target, catchPos, HEAD, neck, TURN, turn, updateTarget };
}
