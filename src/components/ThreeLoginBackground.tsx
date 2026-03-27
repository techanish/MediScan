import { useEffect, useRef } from 'react';
import * as THREE from 'three';

const TOPO_PERFORMANCE = {
  pixelRatioCap: 1.15,
  renderScale: 0.82,
  frameIntervalMs: 1000 / 42,
};

export function ThreeLoginBackground() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, TOPO_PERFORMANCE.pixelRatioCap));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    const geometry = new THREE.PlaneGeometry(2, 2);
    const material = new THREE.ShaderMaterial({
      transparent: true,
      uniforms: {
        uTime: { value: 0 },
        uResolution: { value: new THREE.Vector2(1, 1) },
        uMouse: { value: new THREE.Vector2(0.5, 0.5) },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        precision highp float;

        uniform float uTime;
        uniform vec2 uResolution;
        uniform vec2 uMouse;
        varying vec2 vUv;

        mat2 rotate2d(float a) {
          float s = sin(a);
          float c = cos(a);
          return mat2(c, -s, s, c);
        }

        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
        }

        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);

          float a = hash(i);
          float b = hash(i + vec2(1.0, 0.0));
          float c = hash(i + vec2(0.0, 1.0));
          float d = hash(i + vec2(1.0, 1.0));

          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(a, b, u.x) +
                 (c - a) * u.y * (1.0 - u.x) +
                 (d - b) * u.x * u.y;
        }

        float fbm(vec2 p) {
          float value = 0.0;
          float amplitude = 0.5;
          for (int i = 0; i < 6; i++) {
            value += amplitude * noise(p);
            p = rotate2d(0.45) * p * 2.03 + vec2(13.7, -9.2);
            amplitude *= 0.53;
          }
          return value;
        }

        void main() {
          float aspect = uResolution.x / max(uResolution.y, 1.0);
          vec2 uv = vUv;
          vec2 p = vec2((uv.x - 0.5) * aspect, uv.y - 0.5);

          vec2 mouse = vec2((uMouse.x - 0.5) * aspect, uMouse.y - 0.5);
          float t = uTime * 0.22;
          float height = fbm(p * 1.95 + vec2(t * 0.27, -t * 0.14));
          height += noise(p * 5.8 - vec2(t * 0.2, t * 0.16)) * 0.2;

          float contours = smoothstep(0.88, 1.0, abs(sin(height * 38.0)));
          float shading = smoothstep(0.2, 0.9, height);
          float cursorDist = distance(p, mouse);
          float cursorIsoline = smoothstep(0.82, 1.0, abs(sin(cursorDist * 23.0 - t * 5.0)));
          cursorIsoline *= exp(-cursorDist * 4.2) * 0.33;

          vec3 base = vec3(0.93, 1.0, 0.96);
          vec3 fill = vec3(0.56, 0.9, 0.78);
          vec3 line = vec3(0.07, 0.52, 0.38);

          vec3 color = mix(base, fill, shading * 0.56);
          color = mix(color, line, contours * 0.7 + cursorIsoline);
          float alpha = 0.79;

          float centerSoft = smoothstep(0.12, 0.7, length(p));
          color *= mix(1.0, 0.93, (1.0 - centerSoft) * 0.35);

          gl_FragColor = vec4(color, alpha);
        }
      `,
    });

    const topoPlane = new THREE.Mesh(geometry, material);
    scene.add(topoPlane);

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let rafId = 0;
    let lastFrameTime = 0;
    const mouseTarget = new THREE.Vector2(0.5, 0.5);
    const mouseSmooth = new THREE.Vector2(0.5, 0.5);

    const onPointerMove = (event: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      const x = (event.clientX - rect.left) / Math.max(rect.width, 1);
      const y = 1 - (event.clientY - rect.top) / Math.max(rect.height, 1);
      mouseTarget.set(
        THREE.MathUtils.clamp(x, 0, 1),
        THREE.MathUtils.clamp(y, 0, 1),
      );
    };

    const onPointerLeave = () => {
      mouseTarget.set(0.5, 0.5);
    };

    const resize = () => {
      const { clientWidth, clientHeight } = container;
      const width = Math.max(clientWidth, 1);
      const height = Math.max(clientHeight, 1);
      const internalWidth = Math.max(Math.floor(width * TOPO_PERFORMANCE.renderScale), 1);
      const internalHeight = Math.max(Math.floor(height * TOPO_PERFORMANCE.renderScale), 1);

      renderer.setSize(internalWidth, internalHeight, false);
      renderer.domElement.style.width = `${width}px`;
      renderer.domElement.style.height = `${height}px`;
      material.uniforms.uResolution.value.set(internalWidth, internalHeight);
    };

    const animate = (now: number) => {
      if (now - lastFrameTime < TOPO_PERFORMANCE.frameIntervalMs) {
        rafId = window.requestAnimationFrame(animate);
        return;
      }
      lastFrameTime = now;

      mouseSmooth.lerp(mouseTarget, 0.055);
      material.uniforms.uMouse.value.copy(mouseSmooth);
      material.uniforms.uTime.value = now * 0.001;

      renderer.render(scene, camera);
      rafId = window.requestAnimationFrame(animate);
    };

    resize();
    window.addEventListener('resize', resize);
    container.addEventListener('pointermove', onPointerMove);
    container.addEventListener('pointerleave', onPointerLeave);

    if (reducedMotion) {
      material.uniforms.uTime.value = 12.0;
      renderer.render(scene, camera);
    } else {
      rafId = window.requestAnimationFrame(animate);
    }

    return () => {
      window.removeEventListener('resize', resize);
      container.removeEventListener('pointermove', onPointerMove);
      container.removeEventListener('pointerleave', onPointerLeave);
      if (rafId) window.cancelAnimationFrame(rafId);

      geometry.dispose();
      material.dispose();
      renderer.dispose();

      if (renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return <div ref={containerRef} className="absolute inset-0" aria-hidden="true" />;
}
