/**
 * garmentGeometry.ts
 * Accurate procedural 3D garment silhouettes for:
 * - T-Shirt / Hoodie  → shirt body with sleeves using ShapeGeometry
 * - Cap               → dome + brim + button
 * - Beanie/Toque      → ribbed cylinder + rounded crown + cuff
 *
 * All geometries use UV coordinates compatible with product front/back images.
 */
import * as THREE from 'three';

// ─── T-Shirt / Hoodie silhouette ────────────────────────────────────────────
/**
 * Creates an accurate shirt silhouette as a flat Shape,
 * then extrudes it slightly for depth.
 * UV maps the full image across the body (ignoring sleeves for texture).
 */
export function createShirtShape(withHood = false): THREE.BufferGeometry {
  const shape = new THREE.Shape();

  // Start bottom-left, go clockwise
  shape.moveTo(-0.44, -1.15);
  shape.lineTo(-0.44, 0.38);

  // Left shoulder curve
  shape.bezierCurveTo(-0.44, 0.48, -0.58, 0.52, -0.65, 0.54);

  // Left sleeve — horizontal
  shape.lineTo(-0.9, 0.59);
  shape.lineTo(-0.9, 0.28);

  // Left armhole curve
  shape.bezierCurveTo(-0.72, 0.32, -0.56, 0.22, -0.48, 0.12);

  if (withHood) {
    // Hood — rises above neckline
    shape.lineTo(-0.18, 0.72);
    shape.bezierCurveTo(-0.18, 1.18, 0.18, 1.18, 0.18, 0.72);
    shape.lineTo(0.48, 0.12);
  } else {
    // Crew neck dip
    shape.bezierCurveTo(-0.26, 0.62, 0.26, 0.62, 0.48, 0.12);
  }

  // Right armhole
  shape.bezierCurveTo(0.56, 0.22, 0.72, 0.32, 0.9, 0.28);

  // Right sleeve
  shape.lineTo(0.9, 0.59);
  shape.lineTo(0.65, 0.54);

  // Right shoulder
  shape.bezierCurveTo(0.58, 0.52, 0.44, 0.48, 0.44, 0.38);
  shape.lineTo(0.44, -1.15);
  shape.lineTo(-0.44, -1.15);

  // Extrude very slightly for depth (gives PBR shading)
  const geo = new THREE.ShapeGeometry(shape, 64);

  // Build proper UV from bounding box
  geo.computeBoundingBox();
  const bbox = geo.boundingBox!;
  const W = bbox.max.x - bbox.min.x;
  const H = bbox.max.y - bbox.min.y;
  const pos = geo.attributes.position;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = (pos.getX(i) - bbox.min.x) / W;
    uv[i * 2 + 1] = (pos.getY(i) - bbox.min.y) / H;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.computeVertexNormals();

  // Add subtle fabric wave via vertex Z displacement
  const positions = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const y = positions.getY(i);
    const z = Math.sin(x * 5.2 + 0.3) * 0.018
            + Math.sin(y * 3.8 - 0.5) * 0.024
            + Math.cos(x * 2.1 + y * 1.7) * 0.01;
    positions.setZ(i, z);
  }
  positions.needsUpdate = true;
  geo.computeVertexNormals();

  return geo;
}

// ─── Cap geometry ─────────────────────────────────────────────────────────────
export interface CapParts {
  dome: THREE.BufferGeometry;
  brim: THREE.BufferGeometry;
  button: THREE.BufferGeometry;
  sweatband: THREE.BufferGeometry;
}

export function createCapParts(): CapParts {
  const dome = new THREE.SphereGeometry(0.9, 64, 32, 0, Math.PI * 2, 0, Math.PI / 2);

  // Brim — thin cylinder disk
  const brim = new THREE.CylinderGeometry(1.35, 1.3, 0.05, 64, 1, false);
  brim.translate(0, -0.02, 0.1);
  brim.rotateX(-0.12); // slight forward tilt

  // Button top
  const button = new THREE.SphereGeometry(0.065, 16, 10);
  button.translate(0, 0.9, 0);

  // Sweatband — inner ring at base of dome
  const sweatband = new THREE.TorusGeometry(0.88, 0.045, 12, 64);
  sweatband.rotateX(Math.PI / 2);
  sweatband.translate(0, 0.02, 0);

  return { dome, brim, button, sweatband };
}

// ─── Beanie geometry ──────────────────────────────────────────────────────────
export interface BeanieParts {
  body: THREE.BufferGeometry;
  crown: THREE.BufferGeometry;
  cuff: THREE.BufferGeometry;
  pompom: THREE.BufferGeometry;
}

export function createBeanieParts(): BeanieParts {
  // Ribbed body — add vertical rib displacement
  const body = new THREE.CylinderGeometry(0.72, 0.67, 1.35, 72, 28, false);
  const bodyPos = body.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < bodyPos.count; i++) {
    const angle = Math.atan2(bodyPos.getZ(i), bodyPos.getX(i));
    const y = bodyPos.getY(i);
    // Vertical rib
    const rib = Math.sin(angle * 18) * 0.014;
    // Horizontal knit texture
    const knit = Math.sin(y * 22) * 0.006;
    const r = Math.sqrt(bodyPos.getX(i) ** 2 + bodyPos.getZ(i) ** 2);
    const nr = r + rib + knit;
    bodyPos.setX(i, Math.cos(angle) * nr);
    bodyPos.setZ(i, Math.sin(angle) * nr);
    // Slight taper toward top
    bodyPos.setX(i, bodyPos.getX(i) * (1 - (y + 0.675) * 0.03));
    bodyPos.setZ(i, bodyPos.getZ(i) * (1 - (y + 0.675) * 0.03));
  }
  bodyPos.needsUpdate = true;
  body.computeVertexNormals();

  // Rounded crown — hemisphere
  const crown = new THREE.SphereGeometry(0.72, 64, 20, 0, Math.PI * 2, 0, Math.PI / 2);
  crown.translate(0, 0.675, 0);

  // Rolled cuff at bottom
  const cuff = new THREE.TorusGeometry(0.68, 0.1, 18, 72);
  cuff.rotateX(Math.PI / 2);
  cuff.translate(0, -0.62, 0);

  // Pompom
  const pompom = new THREE.SphereGeometry(0.11, 16, 12);
  pompom.translate(0, 1.05, 0);

  return { body, crown, cuff, pompom };
}

// ─── Material helpers ─────────────────────────────────────────────────────────
export function createFabricMaterial(
  texture: THREE.Texture,
  colorHex: string,
  roughness = 0.86,
): THREE.MeshStandardMaterial {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.needsUpdate = true;

  const isNeutral = ['#f5f5f0','#ffffff','#f5f5f5','#fafafa'].includes(colorHex.toLowerCase());
  const color = isNeutral
    ? new THREE.Color(1, 1, 1)
    : new THREE.Color(colorHex).lerp(new THREE.Color('#ffffff'), 0.7);

  return new THREE.MeshStandardMaterial({
    map: texture,
    color,
    side: THREE.DoubleSide,
    roughness,
    metalness: 0,
    transparent: false,
  });
}

export function isNeutralColor(hex: string) {
  return ['#f5f5f0','#ffffff','#f5f5f5','#fafafa','#fffff0'].includes(hex.toLowerCase());
}
