import * as THREE from "/vendor/three.module.js";

const canvas = document.getElementById("showcaseScene");
const hero = document.getElementById("shop");

if (canvas && hero) {
  let renderer;

  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: "low-power",
    });
  } catch {
    canvas.classList.add("scene-fallback");
  }

  if (renderer) {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 80);
    const clock = new THREE.Clock();
    const products = [];
    const pointer = { x: 0, y: 0 };
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let lookTargetY = 0;
    let lookTargetX = 0;

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    scene.add(new THREE.HemisphereLight(0xdce9dc, 0x18211d, 2.2));
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));

    const keyLight = new THREE.DirectionalLight(0xffdfc4, 4.2);
    keyLight.position.set(-4, 7, 8);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    scene.add(keyLight);

    const greenLight = new THREE.PointLight(0x72c49b, 35, 18);
    greenLight.position.set(5, 2, -2);
    scene.add(greenLight);

    const warmLight = new THREE.PointLight(0xf17e50, 28, 16);
    warmLight.position.set(-6, 1, 1);
    scene.add(warmLight);

    const stage = new THREE.Group();
    scene.add(stage);

    const floor = new THREE.Mesh(
      new THREE.CylinderGeometry(7, 7.3, 0.16, 96),
      new THREE.MeshStandardMaterial({ color: 0x18211d, roughness: 0.34, metalness: 0.42 }),
    );
    floor.position.y = -1.24;
    floor.receiveShadow = true;
    stage.add(floor);

    const stageRing = new THREE.Mesh(
      new THREE.TorusGeometry(6.8, 0.025, 8, 120),
      new THREE.MeshStandardMaterial({ color: 0x88b89b, roughness: 0.3, metalness: 0.72 }),
    );
    stageRing.rotation.x = Math.PI / 2;
    stageRing.position.y = -1.14;
    stage.add(stageRing);

    const productMats = {
      coral: material(0xd77750, 0.34, 0.08),
      cream: material(0xe4dbc7, 0.4, 0.04),
      forest: material(0x497b61, 0.36, 0.12),
      dark: material(0x202a28, 0.32, 0.36),
      gold: material(0xd3a66b, 0.28, 0.62),
      label: material(0xf2eee3, 0.58, 0),
      screen: material(0x101715, 0.18, 0.24),
    };

    products.push(createDisplay(createTote, productMats.coral, -5.4, 0.1, 0, 0.5));
    products.push(createDisplay(createBottle, productMats.forest, -1.8, 0.46, -0.55, 1.4));
    products.push(createDisplay(createHeadphones, productMats.cream, 1.8, -0.18, 0.25, 2.4));
    products.push(createDisplay(createMug, productMats.coral, 5.4, 0.42, -0.35, 3.2));

    camera.position.set(0, 1.25, 12.5);
    camera.lookAt(0, 0, 0);

    function material(color, roughness, metalness) {
      return new THREE.MeshStandardMaterial({ color, roughness, metalness });
    }

    function mesh(parent, geometry, mat, x, y, z) {
      const object = new THREE.Mesh(geometry, mat);
      object.position.set(x, y, z);
      object.castShadow = true;
      object.receiveShadow = true;
      parent.add(object);
      return object;
    }

    function createDisplay(createProduct, bodyMaterial, x, y, z, phase) {
      const group = new THREE.Group();
      group.scale.setScalar(1.22);
      group.position.set(x, y, z);

      mesh(group, new THREE.CylinderGeometry(0.72, 0.82, 0.18, 48), productMats.dark, 0, -0.62, 0);
      const trim = mesh(group, new THREE.TorusGeometry(0.72, 0.018, 8, 48), productMats.gold, 0, -0.51, 0);
      trim.rotation.x = Math.PI / 2;
      createProduct(group, bodyMaterial, productMats);
      stage.add(group);

      return { group, x, y, z, phase };
    }

    function createTote(group, bodyMaterial, mats) {
      mesh(group, new THREE.BoxGeometry(1.02, 0.9, 0.42), bodyMaterial, 0, -0.02, 0);
      const handle = mesh(group, new THREE.TorusGeometry(0.27, 0.045, 12, 36, Math.PI), mats.gold, 0, 0.53, 0.02);
      handle.rotation.z = Math.PI;
      mesh(group, new THREE.BoxGeometry(0.34, 0.2, 0.025), mats.cream, 0, -0.08, 0.225);
    }

    function createBottle(group, bodyMaterial, mats) {
      mesh(group, new THREE.CylinderGeometry(0.29, 0.36, 0.92, 36), bodyMaterial, 0, 0, 0);
      mesh(group, new THREE.CylinderGeometry(0.15, 0.15, 0.15, 28), mats.cream, 0, 0.52, 0);
      mesh(group, new THREE.CylinderGeometry(0.14, 0.16, 0.25, 28), mats.gold, 0, 0.72, 0);
      mesh(group, new THREE.BoxGeometry(0.28, 0.22, 0.025), mats.label, 0, -0.05, 0.33);
    }

    function createHeadphones(group, bodyMaterial, mats) {
      const band = mesh(group, new THREE.TorusGeometry(0.43, 0.065, 14, 48, Math.PI), bodyMaterial, 0, 0.15, 0);
      band.rotation.z = Math.PI;
      const left = mesh(group, new THREE.CylinderGeometry(0.19, 0.19, 0.28, 32), mats.dark, -0.43, -0.2, 0.04);
      const right = mesh(group, new THREE.CylinderGeometry(0.19, 0.19, 0.28, 32), mats.dark, 0.43, -0.2, 0.04);
      left.rotation.x = Math.PI / 2;
      right.rotation.x = Math.PI / 2;
      mesh(group, new THREE.CylinderGeometry(0.12, 0.12, 0.02, 28), mats.gold, -0.43, -0.2, 0.19).rotation.x = Math.PI / 2;
      mesh(group, new THREE.CylinderGeometry(0.12, 0.12, 0.02, 28), mats.gold, 0.43, -0.2, 0.19).rotation.x = Math.PI / 2;
    }

    function createMug(group, bodyMaterial, mats) {
      mesh(group, new THREE.CylinderGeometry(0.34, 0.29, 0.72, 36), bodyMaterial, 0, 0, 0);
      const handle = mesh(group, new THREE.TorusGeometry(0.23, 0.055, 12, 36), mats.cream, 0.34, 0.02, 0);
      handle.scale.set(0.8, 1.1, 0.7);
      mesh(group, new THREE.CylinderGeometry(0.22, 0.22, 0.025, 36), mats.cream, 0, 0.37, 0);
    }

    function resize() {
      const bounds = canvas.getBoundingClientRect();
      const width = Math.max(1, bounds.width);
      const height = Math.max(1, bounds.height);
      const mobileStage = width < 720 && height < 360;
      const narrowStage = width / height < 1;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      lookTargetY = 0;
      lookTargetX = 0;
      camera.position.set(lookTargetX, 1.25, mobileStage || narrowStage ? 7.2 : 8.5);
      camera.lookAt(lookTargetX, lookTargetY, 0);

      const mobileLayout = [
        [-2.3, -0.1, 0.1],
        [-0.75, 0.55, -0.5],
        [0.75, -0.25, 0.2],
        [2.3, 0.42, -0.45],
      ];
      const narrowLayout = [
        [0, 1.1, 0.1],
        [0, 0.3, -0.5],
        [0, -0.5, 0.2],
        [0, -1.3, -0.45],
      ];
      const desktopLayout = [
        [-2.8, 0.1, 0],
        [-0.95, 0.46, -0.55],
        [0.95, -0.18, 0.25],
        [2.8, 0.42, -0.35],
      ];

      products.forEach((product, index) => {
        product.group.visible = true;
        product.group.scale.setScalar(mobileStage ? 1.22 : narrowStage ? 0.82 : 1);
        const layout = mobileStage ? mobileLayout : narrowStage ? narrowLayout : desktopLayout;
        const [x, y, z] = layout[index];
        product.x = x;
        product.y = y;
        product.z = z;
        product.group.position.set(x, y, z);
      });

      if (reducedMotion.matches) {
        renderer.render(scene, camera);
      }
    }

    function render(time) {
      const elapsed = time / 1000 || clock.getElapsedTime();
      camera.position.x += (lookTargetX + pointer.x * 0.5 - camera.position.x) * 0.025;
      camera.position.y += (lookTargetY + 1.25 - pointer.y * 0.22 - camera.position.y) * 0.025;
      camera.lookAt(lookTargetX, lookTargetY, 0);

      products.forEach((product) => {
        product.group.position.y = product.y + Math.sin(elapsed * 0.7 + product.phase) * 0.08;
        product.group.rotation.y = Math.sin(elapsed * 0.35 + product.phase) * 0.14;
        product.group.rotation.x = Math.cos(elapsed * 0.28 + product.phase) * 0.025;
      });

      stageRing.rotation.z = elapsed * 0.035;
      renderer.render(scene, camera);
    }

    canvas.addEventListener("pointermove", (event) => {
      const bounds = canvas.getBoundingClientRect();
      pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
      pointer.y = ((event.clientY - bounds.top) / bounds.height) * 2 - 1;
    });
    canvas.addEventListener("pointerleave", () => {
      pointer.x = 0;
      pointer.y = 0;
    });

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(hero);
    resizeObserver.observe(canvas);
    resize();

    if (!reducedMotion.matches) {
      renderer.setAnimationLoop(render);
    }

    reducedMotion.addEventListener("change", () => {
      renderer.setAnimationLoop(reducedMotion.matches ? null : render);
      if (reducedMotion.matches) {
        renderer.render(scene, camera);
      }
    });
  }
}