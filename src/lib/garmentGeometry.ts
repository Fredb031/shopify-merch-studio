/**
 * garmentGeometry.ts
 * Procedural 3D garment shapes using Three.js BufferGeometry.
 * Each function returns a geometry that closely matches the real product silhouette.
 */
import * as THREE from 'three';

// ── Utility: apply subtle fabric-wave displacement ─────────────────────────
function waveFabric(geo: THREE.BufferGeometry, intensity = 0.03) {
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z =
      Math.sin(x * 4.2 + 0.4) * intensity * 0.5 +
      Math.sin(y * 3.1 - 0.6) * intensity * 0.7 +
      Math.cos((x + y) * 2.3) * intensity * 0.3;
    pos.setZ(i, z);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

/**
 * T-Shirt / Hoodie — high-res fabric plane
 * 1.8 × 2.4 world units, 64×80 subdivisions for smooth waves
 */
export function createShirtGeometry(): THREE.BufferGeometry {
  const geo = new THREE.PlaneGeometry(1.8, 2.4, 64, 80);
  return waveFabric(geo, 0.028);
}

/**
 * Cap — dome (top half sphere) + brim (flat disk)
 * Returns a merged geometry with distinct UV regions
 */
export function createCapGeometry(): { dome: THREE.BufferGeometry; brim: THREE.BufferGeometry; button: THREE.BufferGeometry } {
  const dome = new THREE.SphereGeometry(0.88, 64, 28, 0, Math.PI * 2, 0, Math.PI / 2);

  // Brim: flat ring in XZ plane, translated down
  const brim = new THREE.CylinderGeometry(1.32, 1.28, 0.04, 64, 1, false);
  // Move down to sit at dome base
  brim.translate(0, -0.02, 0);

  // Tiny button on top
  const button = new THREE.SphereGeometry(0.062, 12, 8);
  button.translate(0, 0.88, 0);

  return { dome, brim, button };
}

/**
 * Beanie/Toque — cylinder body + rounded crown
 */
export function createBeanieGeometry(): { body: THREE.BufferGeometry; crown: THREE.BufferGeometry; cuff: THREE.BufferGeometry } {
  const body = new THREE.CylinderGeometry(0.74, 0.68, 1.4, 64, 24, false);
  // Add subtle vertical ribbing via vertex displacement
  const bodyPos = body.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < bodyPos.count; i++) {
    const y = bodyPos.getY(i);
    const angle = Math.atan2(bodyPos.getZ(i), bodyPos.getX(i));
    const rib = Math.sin(angle * 16) * 0.012;
    bodyPos.setX(i, bodyPos.getX(i) * (1 + rib * 0.3));
    bodyPos.setZ(i, bodyPos.getZ(i) * (1 + rib * 0.3));
    // Slight taper upward
    const taper = 1 - (y + 0.7) * 0.04;
    bodyPos.setX(i, bodyPos.getX(i) * taper);
    bodyPos.setZ(i, bodyPos.getZ(i) * taper);
  }
  bodyPos.needsUpdate = true;
  body.computeVertexNormals();

  // Rounded crown — hemisphere on top
  const crown = new THREE.SphereGeometry(0.74, 64, 16, 0, Math.PI * 2, 0, Math.PI / 2);
  crown.translate(0, 0.7, 0);

  // Rolled cuff at bottom
  const cuff = new THREE.TorusGeometry(0.69, 0.095, 16, 64);
  cuff.rotateX(Math.PI / 2);
  cuff.translate(0, -0.65, 0);

  return { body, crown, cuff };
}

/**
 * Creates a MeshStandardMaterial with correct color handling.
 * Uses white base + semi-transparent color overlay to preserve texture detail.
 */
export function makeFabricMaterial(
  texture: THREE.Texture,
  colorHex: string,
  roughness = 0.84
): THREE.MeshStandardMaterial {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  const isNeutral = colorHex === '#f5f5f0' || colorHex === '#ffffff' || colorHex === '#f5f5f5';
  return new THREE.MeshStandardMaterial({
    map: texture,
    color: isNeutral ? new THREE.Color(1, 1, 1) : new THREE.Color(colorHex).lerp(new THREE.Color('#ffffff'), 0.72),
    transparent: false,
    side: THREE.DoubleSide,
    roughness,
    metalness: 0,
  });
}

/** Transparent overlay plane for color tinting non-white products */
export function makeColorOverlay(colorHex: string, width: number, height: number): THREE.Mesh | null {
  if (colorHex === '#f5f5f0' || colorHex === '#ffffff' || colorHex === '#f5f5f5') return null;
  const geo = new THREE.PlaneGeometry(width * 0.9, height * 0.9);
  const mat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(colorHex),
    transparent: true,
    opacity: 0.17,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.z = 0.005;
  return mesh;
}

/** Logo overlay plane — for flat surfaces (shirt, hoodie) */
export function makeLogoPlane(
  logoTexture: THREE.Texture,
  x: number, y: number, width: number, rotation = 0
): THREE.Mesh {
  logoTexture.colorSpace = THREE.SRGBColorSpace;
  logoTexture.premultiplyAlpha = false;
  logoTexture.needsUpdate = true;
  const geo = new THREE.PlaneGeometry(width, width * 0.6);
  const mat = new THREE.MeshBasicMaterial({
    map: logoTexture,
    transparent: true,
    alphaTest: 0.01,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, 0.022);
  mesh.rotation.z = (rotation * Math.PI) / 180;
  return mesh;
}
