"use client";

import { useEffect, useRef, type MutableRefObject } from "react";
import * as THREE from "three";

// Interactive 3D core: a wireframe icosahedron + orbiting ring + a plexus
// particle network. Reacts to the mouse and "charges" when activeRef is true.
// Isolated client leaf with full WebGL cleanup.
export function Geode({ activeRef }: { activeRef: MutableRefObject<boolean> }) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let w = mount.clientWidth, h = mount.clientHeight || 1;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 100);
    camera.position.z = 4.6;
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h);
    mount.appendChild(renderer.domElement);

    const CYAN = 0x22d3ee, VIOLET = 0x8b5cf6;
    const group = new THREE.Group();
    scene.add(group);

    // Core geode
    const ico = new THREE.IcosahedronGeometry(1.5, 1);
    const innerMesh = new THREE.Mesh(ico, new THREE.MeshBasicMaterial({ color: 0x0b2b33, transparent: true, opacity: 0.4 }));
    const wire = new THREE.LineSegments(new THREE.WireframeGeometry(ico), new THREE.LineBasicMaterial({ color: CYAN, transparent: true, opacity: 0.9 }));
    // Vertices as glowing points
    const vmat = new THREE.PointsMaterial({ color: 0xbdf4ff, size: 0.07, transparent: true, opacity: 0.95 });
    const vpts = new THREE.Points(ico, vmat);
    group.add(innerMesh, wire, vpts);

    // Orbiting ring
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.3, 0.01, 8, 140), new THREE.MeshBasicMaterial({ color: VIOLET, transparent: true, opacity: 0.7 }));
    ring.rotation.x = Math.PI / 2.3;
    group.add(ring);

    // Plexus network
    const N = 90, R = 6;
    const pos = new Float32Array(N * 3), vel: number[] = [];
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (Math.random() - 0.5) * R * 2;
      pos[i * 3 + 1] = (Math.random() - 0.5) * R * 2;
      pos[i * 3 + 2] = (Math.random() - 0.5) * R;
      vel.push((Math.random() - 0.5) * 0.004, (Math.random() - 0.5) * 0.004, (Math.random() - 0.5) * 0.004);
    }
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const plexusPts = new THREE.Points(pGeo, new THREE.PointsMaterial({ color: CYAN, size: 0.04, transparent: true, opacity: 0.7 }));
    const lineGeo = new THREE.BufferGeometry();
    const linePos = new Float32Array(N * N * 3);
    lineGeo.setAttribute("position", new THREE.BufferAttribute(linePos, 3));
    const lines = new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({ color: CYAN, transparent: true, opacity: 0.16 }));
    scene.add(plexusPts, lines);

    const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
    const onMove = (e: MouseEvent) => {
      mouse.tx = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.ty = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("mousemove", onMove);

    let raf = 0;
    const animate = () => {
      const active = activeRef.current;
      const base = reduce ? 0 : active ? 0.012 : 0.0035;
      group.rotation.y += base;
      group.rotation.z += base * 0.3;
      mouse.x += (mouse.tx - mouse.x) * 0.05;
      mouse.y += (mouse.ty - mouse.y) * 0.05;
      group.rotation.x = mouse.y * 0.4 + 0.1;
      group.rotation.y += mouse.x * 0.0015;
      ring.rotation.z += active ? 0.03 : 0.006;
      const scale = active ? 1.08 : 1;
      group.scale.setScalar(scale + Math.sin(Date.now() * 0.001) * 0.02);
      (wire.material as THREE.LineBasicMaterial).color.setHex(active ? 0x7df0ff : CYAN);

      // drift plexus + rebuild near-lines
      const p = pGeo.attributes.position.array as Float32Array;
      for (let i = 0; i < N; i++) {
        for (let k = 0; k < 3; k++) { const idx = i * 3 + k; p[idx] += vel[idx]; if (p[idx] > R || p[idx] < -R) vel[idx] *= -1; }
      }
      let li = 0;
      const maxD = 1.7;
      for (let i = 0; i < N; i++) {
        for (let j = i + 1; j < N; j++) {
          const dx = p[i * 3] - p[j * 3], dy = p[i * 3 + 1] - p[j * 3 + 1], dz = p[i * 3 + 2] - p[j * 3 + 2];
          if (dx * dx + dy * dy + dz * dz < maxD * maxD) {
            linePos[li++] = p[i * 3]; linePos[li++] = p[i * 3 + 1]; linePos[li++] = p[i * 3 + 2];
            linePos[li++] = p[j * 3]; linePos[li++] = p[j * 3 + 1]; linePos[li++] = p[j * 3 + 2];
          }
        }
      }
      lineGeo.setDrawRange(0, li / 3);
      lineGeo.attributes.position.needsUpdate = true;
      pGeo.attributes.position.needsUpdate = true;
      plexusPts.rotation.y = group.rotation.y * 0.2;
      lines.rotation.y = plexusPts.rotation.y;

      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };
    animate();

    const ro = new ResizeObserver(() => {
      w = mount.clientWidth; h = mount.clientHeight || 1;
      camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h);
    });
    ro.observe(mount);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMove);
      ro.disconnect();
      renderer.dispose();
      ico.dispose(); pGeo.dispose(); lineGeo.dispose();
      scene.traverse((o) => { const m = (o as THREE.Mesh).material; if (m) (Array.isArray(m) ? m : [m]).forEach((x) => x.dispose()); });
      if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
    };
  }, [activeRef]);

  return <div ref={mountRef} style={{ position: "absolute", inset: 0, pointerEvents: "none" }} aria-hidden />;
}
