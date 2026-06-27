// ── Uniforms ──────────────────────────────────────────────────────────────────
uniform float u_time;
uniform float u_tension;
uniform float u_pulse;
uniform float u_morphPhase;
uniform vec3  u_cameraPos;

varying vec3  vNormal;
varying vec3  vPosition;
varying vec3  vWorldPos;

// ── Simplex 3D noise ──────────────────────────────────────────────────────────
vec3 _m3(vec3 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
vec4 _m4(vec4 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
vec4 _perm(vec4 x) { return _m4(((x*34.0)+1.0)*x); }
vec4 _tis(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0);
  const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy));
  vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g;
  vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
  i=_m3(i);
  vec4 p=_perm(_perm(_perm(i.z+vec4(0,i1.z,i2.z,1))+i.y+vec4(0,i1.y,i2.y,1))+i.x+vec4(0,i1.x,i2.x,1));
  float n_=0.142857142857; vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_);
  vec4 xv=x_*ns.x+ns.yyyy; vec4 yv=y_*ns.x+ns.yyyy;
  vec4 h=1.0-abs(xv)-abs(yv);
  vec4 b0=vec4(xv.xy,yv.xy); vec4 b1=vec4(xv.zw,yv.zw);
  vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0;
  vec4 sh=-step(h,vec4(0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y);
  vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
  vec4 nm=_tis(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=nm.x;p1*=nm.y;p2*=nm.z;p3*=nm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);
  m=m*m; return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,p2),dot(p3,x3)));
}

// ── State weights ─────────────────────────────────────────────────────────────
vec3 stateWeights() {
  float TWO_PI_3 = 2.0943951;
  float wIce   = (cos(u_morphPhase)               + 1.0) * 0.5;
  float wFluid = (cos(u_morphPhase - TWO_PI_3)    + 1.0) * 0.5;
  float wPulse = (cos(u_morphPhase - 2.0*TWO_PI_3)+ 1.0) * 0.5;
  float s = wIce + wFluid + wPulse + 0.001;
  return vec3(wIce, wFluid, wPulse) / s;
}

void main() {
  vec3  N     = normalize(vNormal);
  vec3  V     = normalize(u_cameraPos - vWorldPos);
  float NdotV = max(dot(N, V), 0.0);

  // Fresnel — steeper exponent for glass-like rim
  float fresnel3 = pow(1.0 - NdotV, 3.2);
  float fresnel5 = pow(1.0 - NdotV, 5.5);

  vec3 sw = stateWeights(); // x=ice, y=fluid, z=pulse

  // ════════════════════════════════════════════════════════════════════════════
  // STATE 1 · ICE / CRYSTAL  (reference: img 1, img 2)
  // Goal: dark core, cold blue Fresnel edge, amber/gold caustic fan-streaks,
  //       crisp bright specular — the whiskey sphere refraction look
  // ════════════════════════════════════════════════════════════════════════════

  // Main directional light (warm bar light from upper-right)
  vec3  Lice = normalize(vec3(0.55, 1.10, 0.75));
  vec3  Hice = normalize(Lice + V);

  // ── Caustic fan-streaks (img 2: golden rays spreading like a fan) ──────────
  // Build a coordinate frame perpendicular to the light direction.
  // The caustic bands are sinusoidal strips in this frame — they produce
  // the characteristic "fan of rays converging at the lit pole" look.
  vec3  tangL  = normalize(cross(Lice, vec3(0,1,0.1)));
  vec3  bitangL = normalize(cross(Lice, tangL));
  float cx      = dot(normalize(vPosition), tangL);
  float cy      = dot(normalize(vPosition), bitangL);
  float cAngle  = atan(cy, cx);                       // angular position in caustic plane
  float cRadius = length(vec2(cx, cy));               // radial in caustic plane

  // High-frequency angular bands + radial modulation → fan pattern
  float causticBand =
    sin(cAngle * 11.0 + cRadius * 5.0 - u_time * 0.18) * 0.5 + 0.5;
  causticBand = pow(causticBand, 3.5);
  // Second harmonics for richness
  causticBand += (sin(cAngle * 7.0 - cRadius * 3.0 + u_time * 0.10) * 0.5 + 0.5) * 0.35;
  causticBand = clamp(causticBand, 0.0, 1.5);

  // Caustic is only visible on the lit hemisphere
  float litMask = smoothstep(-0.1, 0.5, dot(N, Lice));
  // Also stronger near the "equator" of the light direction (where refraction
  // concentrates most energy)
  float eqMask  = 1.0 - abs(dot(N, Lice) - 0.5) * 2.0;
  eqMask        = max(0.0, eqMask);

  vec3 amber    = vec3(0.92, 0.68, 0.18);
  vec3 goldRay  = mix(amber * 0.4, amber * 1.6, causticBand) * litMask * eqMask * 0.9;

  // ── Rainbow fringe along caustic edges (thin iridescent rim) ──────────────
  float rainbowMask = pow(causticBand, 6.0) * litMask * eqMask;
  vec3  rainbow     = vec3(
    sin(cAngle * 4.0 + u_time * 0.3) * 0.5 + 0.5,
    sin(cAngle * 4.0 + u_time * 0.3 + 2.09) * 0.5 + 0.5,
    sin(cAngle * 4.0 + u_time * 0.3 + 4.19) * 0.5 + 0.5
  ) * rainbowMask * 0.5;

  // ── Cold Fresnel rim (blue-white, like ice edge) ───────────────────────────
  vec3 iceFresnel = mix(vec3(0.6,0.75,1.0), vec3(0.9,0.95,1.0), fresnel5) * fresnel3 * 1.8;

  // ── Very dark refractive core + subtle internal haze ──────────────────────
  float intHaze   = snoise(vPosition * 1.5 + u_time * 0.06) * 0.5 + 0.5;
  vec3  iceCore   = mix(vec3(0.01, 0.02, 0.06), vec3(0.05, 0.08, 0.14), intHaze * (1.0-fresnel3));

  // ── Glass specular: two lobes — primary sharp, secondary diffuse ──────────
  float specSharp = pow(max(dot(N, Hice), 0.0), 180.0);
  float specSoft  = pow(max(dot(N, Hice), 0.0),  12.0) * 0.18;
  vec3  iceSpec   = (vec3(0.95, 0.97, 1.00) * specSharp
                   + vec3(0.80, 0.85, 0.90) * specSoft);

  vec3 iceColor = iceCore + goldRay + rainbow + iceFresnel + iceSpec;

  // ════════════════════════════════════════════════════════════════════════════
  // STATE 2 · FLUID / PEARLESCENT  (reference: img 3)
  // Goal: milky white-cream surface, warm amber interior light, organic folds
  //       expressed as soft shadow/highlight variation across the surface
  // ════════════════════════════════════════════════════════════════════════════

  vec3  Lfluid   = normalize(vec3(0.4, 0.9, 0.6));
  vec3  Hfluid   = normalize(Lfluid + V);

  // Fold shadow: low-freq noise on the surface → valleys darker
  float foldN1   = snoise(vPosition * 1.6 + u_time * 0.07) * 0.5 + 0.5;
  float foldN2   = snoise(vPosition * 3.2 - u_time * 0.04) * 0.5 + 0.5;
  float foldShadow = mix(0.50, 1.0, foldN1 * 0.6 + foldN2 * 0.4);

  // Base milky-pearl surface (slightly warm, slightly golden at center)
  vec3  milkyRim = vec3(0.90, 0.88, 0.84);
  vec3  milkyCore= vec3(0.55, 0.48, 0.35);   // amber-beige core
  vec3  fluidBase = mix(milkyCore, milkyRim, fresnel3 * 0.7 + 0.3);

  // Internal amber glow (the "whiskey" warmth inside)
  float amberGlowN = snoise(vPosition * 2.2 + u_time * 0.09) * 0.5 + 0.5;
  vec3  amberInner = vec3(0.72, 0.48, 0.14) * amberGlowN * 0.45 * (1.0 - fresnel3);
  fluidBase += amberInner;

  // Soft diffuse + broad specular (not glassy, more like silicone/gel)
  float diffFluid  = max(0.0, dot(N, Lfluid)) * 0.55;
  float specFluid  = pow(max(dot(N, Hfluid), 0.0), 18.0) * 0.45;
  fluidBase = fluidBase * (0.45 + diffFluid) * foldShadow;
  fluidBase += vec3(0.95, 0.92, 0.85) * specFluid;

  // Subtle coloured Fresnel (very thin gold-green rim)
  fluidBase += mix(vec3(0.60, 0.52, 0.22), vec3(0.90, 0.88, 0.78), fresnel5) * fresnel3 * 0.5;

  vec3 fluidColor = fluidBase;

  // ════════════════════════════════════════════════════════════════════════════
  // STATE 3 · INNER PULSE / GLOW  (reference: img 4)
  // Goal: dark sphere shell, concentric glow rings rising from inside,
  //       colour cycling slowly between emerald green and blush pink,
  //       the rings travel outward like a heartbeat
  // ════════════════════════════════════════════════════════════════════════════

  // ── Concentric ring system ─────────────────────────────────────────────────
  // Use two ring drivers: horizontal bands (Y) and equatorial rings (XZ dist)
  // to match the dual-band pattern in the reference image
  float ringY  = vPosition.y;
  float ringXZ = length(vPosition.xz);

  // Primary: slow expanding concentric rings from vertical centre
  float ring1 = sin(ringY  * 7.0  - u_time * 1.60) * 0.5 + 0.5;
  float ring2 = sin(ringXZ * 9.0  - u_time * 2.10) * 0.5 + 0.5;
  float ring3 = sin(ringY  * 12.0 - u_time * 2.80 + 0.8) * 0.5 + 0.5;

  // Sharpen the ring edges (smooth bands → thin bright lines)
  ring1 = smoothstep(0.38, 0.72, ring1);
  ring2 = smoothstep(0.42, 0.70, ring2);
  ring3 = smoothstep(0.45, 0.68, ring3) * 0.6;

  float rings = ring1 * 0.55 + ring2 * 0.35 + ring3 * 0.25;
  rings = clamp(rings, 0.0, 1.2);

  // ── Colour cycle: emerald ↔ blush pink (very slow, 25s period) ─────────────
  float colorPhase = sin(u_time * 0.12) * 0.5 + 0.5;   // 0-1 over ~26s
  vec3  emerald    = vec3(0.08, 0.82, 0.50);
  vec3  blush      = vec3(0.88, 0.48, 0.58);
  vec3  ringHue    = mix(emerald, blush, colorPhase);

  // Secondary hue variation along latitude (like refracted colour in glass)
  vec3  ringHue2   = mix(blush, emerald, colorPhase);
  ringHue = mix(ringHue, ringHue2, ringY * 0.3 + 0.5);

  // ── Very dark shell (only the rings glow) ─────────────────────────────────
  vec3  pulseCore = vec3(0.008, 0.008, 0.015);
  vec3  pulseGlow = ringHue * rings * 0.95;

  // Fresnel rim in the ring colour (like the glow seeping out to the edges)
  vec3  pulseFresnel = ringHue * fresnel3 * 0.55 * (0.5 + rings * 0.5);

  vec3 pulseColor = pulseCore + pulseGlow + pulseFresnel;

  // ════════════════════════════════════════════════════════════════════════════
  // BLEND: weighted sum of all three states
  // ════════════════════════════════════════════════════════════════════════════

  vec3 finalColor = iceColor   * sw.x
                  + fluidColor * sw.y
                  + pulseColor * sw.z;

  // ── Pulse brightness flash (from heartbeat system) ────────────────────────
  finalColor += vec3(0.10, 0.55, 0.28) * u_pulse * 0.45;
  finalColor *= 0.85 + u_pulse * 0.15;

  // ── TENSION colour corruption (act 2) ────────────────────────────────────
  float t2 = u_tension * u_tension;

  // Red vein crawl
  float veinN = snoise(vPosition * 9.5 + u_time * 1.8);
  float veinMask = smoothstep(0.55, 0.72, veinN) * u_tension;
  finalColor = mix(finalColor, finalColor + vec3(0.75, 0.01, 0.04) * 1.2, veinMask);

  // Blood Fresnel edge
  float edgeBleeding = fresnel3 * u_tension * 1.5;
  finalColor = mix(finalColor, vec3(0.55, 0.0, 0.03), clamp(edgeBleeding * 0.75, 0.0, 0.85));

  // Desaturation + red shift
  float grey = dot(finalColor, vec3(0.299, 0.587, 0.114));
  vec3 redShift = vec3(grey * 0.9, grey * 0.05, grey * 0.05);
  finalColor = mix(finalColor, redShift, t2 * 0.5);

  // Fake CA — offset R/B
  finalColor.r += snoise(vPosition * 9.0 + N * 0.06 + u_time * 0.7) * 0.5 * u_tension * fresnel3 * 0.35;
  finalColor.g -= u_tension * fresnel3 * 0.20;
  finalColor.b += snoise(vPosition * 9.0 - N * 0.06 + u_time * 0.7) * 0.5 * u_tension * fresnel3 * 0.15;

  // Glitch scanline flicker
  float glitch = step(0.88, fract(snoise(vec3(vPosition.y * 18.0, u_time * 9.0, 0.5)) * 0.5 + 0.5));
  finalColor += vec3(0.9, 0.0, 0.0) * glitch * t2 * 0.35;

  // ── Final output ──────────────────────────────────────────────────────────
  finalColor = max(finalColor, vec3(0.0));
  gl_FragColor = vec4(finalColor, 0.94);
}
