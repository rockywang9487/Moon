uniform float u_time;
uniform float u_tension;
uniform float u_pulse;
uniform vec3  u_cameraPos;

varying vec3  vNormal;
varying vec3  vPosition;
varying vec3  vWorldPos;
varying float vDisplace;

// ── Simplex noise (identical to vert) ────────────────────────────────────────
vec3 mod289v3(vec3 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
vec4 mod289v4(vec4 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
vec4 permute(vec4 x)  { return mod289v4(((x*34.0)+1.0)*x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v) {
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g  = step(x0.yzx, x0.xyz);
  vec3 l  = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289v3(i);
  vec4 p = permute(permute(permute(
    i.z + vec4(0.0, i1.z, i2.z, 1.0))
    + i.y + vec4(0.0, i1.y, i2.y, 1.0))
    + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_  = 0.142857142857;
  vec3 ns   = n_ * D.wyz - D.xzx;
  vec4 j    = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_   = floor(j * ns.z);
  vec4 y_   = floor(j - 7.0 * x_);
  vec4 x    = x_ * ns.x + ns.yyyy;
  vec4 y    = y_ * ns.x + ns.yyyy;
  vec4 h    = 1.0 - abs(x) - abs(y);
  vec4 b0   = vec4(x.xy, y.xy);
  vec4 b1   = vec4(x.zw, y.zw);
  vec4 s0   = floor(b0) * 2.0 + 1.0;
  vec4 s1   = floor(b1) * 2.0 + 1.0;
  vec4 sh   = -step(h, vec4(0.0));
  vec4 a0   = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1   = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0   = vec3(a0.xy, h.x);
  vec3 p1   = vec3(a0.zw, h.y);
  vec3 p2   = vec3(a1.xy, h.z);
  vec3 p3   = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m  = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}

void main() {
  vec3  N       = normalize(vNormal);
  vec3  V       = normalize(u_cameraPos - vWorldPos);
  float fresnel = pow(1.0 - max(dot(N, V), 0.0), 3.2);
  float t2      = u_tension * u_tension;

  // ── Base green palette (her hair / whiskey bar light) ────────────────────
  vec3 deepCore = vec3(0.01, 0.10, 0.08);
  vec3 midGlow  = vec3(0.03, 0.36, 0.24);
  vec3 rimGreen = vec3(0.16, 0.88, 0.52);

  float intN1 = snoise(vPosition * 2.4 + u_time * 0.22) * 0.5 + 0.5;
  float intN2 = snoise(vPosition * 5.2 - u_time * 0.38) * 0.5 + 0.5;

  vec3 baseColor = mix(deepCore, midGlow, intN1);
  baseColor      = mix(baseColor, rimGreen, fresnel * 0.65);

  // Whiskey amber flecks
  float amberN  = snoise(vPosition * 8.0 + u_time * 0.55) * 0.5 + 0.5;
  baseColor    += vec3(0.75, 0.44, 0.04) * pow(amberN, 6.0) * 0.45;

  // ── Specular highlight ────────────────────────────────────────────────────
  vec3  L    = normalize(vec3(1.0, 1.5, 2.0));
  float spec = pow(max(dot(reflect(-L, N), V), 0.0), 72.0);
  baseColor += vec3(0.55, 1.00, 0.70) * spec * 0.85;

  // ── Soft self-shadow ──────────────────────────────────────────────────────
  baseColor *= snoise(vPosition * 2.8 + u_time * 0.09) * 0.12 + 0.88;

  // ── Pulse brightness flash ────────────────────────────────────────────────
  baseColor += vec3(0.08, 0.55, 0.28) * u_pulse * 0.45;
  baseColor *= 0.85 + u_pulse * 0.15;

  // ─────────────────────────────────────────────────────────────────────────
  // TENSION-DRIVEN COLOUR CORRUPTION (Task 2)
  // ─────────────────────────────────────────────────────────────────────────

  // 1. Red vein invasion — crawling across the surface
  //    High-frequency noise thresholded → thin red cracks
  float veinNoise = snoise(vPosition * 9.5 + u_time * 1.8);
  float veinMask  = smoothstep(0.55, 0.72, veinNoise) * u_tension;
  vec3  veinColor = vec3(0.75, 0.01, 0.04);
  baseColor       = mix(baseColor, baseColor + veinColor * 1.2, veinMask);

  // 2. Blood-red edge bleeding — Fresnel rim goes crimson
  float edgeBleeding = fresnel * u_tension * 1.5;
  vec3  bloodEdge    = vec3(0.60, 0.00, 0.03);
  baseColor          = mix(baseColor, bloodEdge, clamp(edgeBleeding * 0.75, 0.0, 0.85));

  // 3. Desaturation + red shift — beauty draining at max tension
  float grey        = dot(baseColor, vec3(0.299, 0.587, 0.114));
  vec3  greyColor   = vec3(grey);
  vec3  redShift    = mix(greyColor, vec3(grey * 0.9, grey * 0.05, grey * 0.05), t2);
  baseColor         = mix(baseColor, redShift, t2 * 0.55);

  // 4. Fake chromatic aberration — offset R/B channel samples along normal
  //    At high tension the surface appears to "bleed" colour out of register
  float caAmount    = u_tension * fresnel * 0.9;
  float noiseR      = snoise(vPosition * 9.0 + N * 0.06 + u_time * 0.7) * 0.5 + 0.5;
  float noiseB      = snoise(vPosition * 9.0 - N * 0.06 + u_time * 0.7) * 0.5 + 0.5;
  baseColor.r      += noiseR * caAmount * 0.35;
  baseColor.b      += noiseB * caAmount * 0.15;
  // Slight green channel drain (the green is being choked out)
  baseColor.g      -= caAmount * 0.20;

  // 5. Glitch scanline flicker at near-max tension
  float glitchLine  = step(0.88, fract(snoise(vec3(vPosition.y * 18.0, u_time * 9.0, 0.5)) * 0.5 + 0.5));
  baseColor        += vec3(0.9, 0.0, 0.0) * glitchLine * t2 * 0.40;

  // ── Final output ──────────────────────────────────────────────────────────
  baseColor = max(baseColor, vec3(0.0));
  gl_FragColor = vec4(baseColor, 0.93);
}
