// ── Uniforms ──────────────────────────────────────────────────────────────────
uniform float u_time;
uniform float u_tension;
uniform float u_pulse;
uniform float u_morphPhase;   // 0 → 2π,  drives the 3-state cycle

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

// ── State weights (three cosine lobes, normalised to sum ≈ 1) ─────────────────
vec3 stateWeights() {
  float TWO_PI_3 = 2.0943951;
  float wIce   = (cos(u_morphPhase)               + 1.0) * 0.5;
  float wFluid = (cos(u_morphPhase - TWO_PI_3)    + 1.0) * 0.5;
  float wPulse = (cos(u_morphPhase - 2.0*TWO_PI_3)+ 1.0) * 0.5;
  float s = wIce + wFluid + wPulse + 0.001;
  return vec3(wIce, wFluid, wPulse) / s;
}

void main() {
  vec3 sw = stateWeights(); // x=ice, y=fluid, z=pulse

  // ── ICE displacement: barely any, just micro-crystalline shimmer ──────────
  float iceD = snoise(position * 2.8 + u_time * 0.10) * 0.018;

  // ── FLUID displacement: very low-freq, large-amplitude lazy folds ─────────
  float fd1 = snoise(position * 0.55 + u_time * 0.055) * 0.13;
  float fd2 = snoise(position * 1.10 - u_time * 0.038) * 0.07;
  float fd3 = snoise(position * 2.20 + u_time * 0.022) * 0.035;
  float fluidD = fd1 + fd2 + fd3;

  // ── PULSE displacement: gentle radial breathing ────────────────────────────
  float pulseBreath = sin(u_time * 0.65) * 0.025 + sin(u_time * 1.30) * 0.012;

  float morphD = iceD * sw.x + fluidD * sw.y + pulseBreath * sw.z;

  // ── TENSION layers (act 2 deformation) ────────────────────────────────────
  float t2 = u_tension * u_tension;
  float tensD = snoise(position * 3.8 + u_time * 0.85) * u_tension * 0.16
              + snoise(position * 6.5 - u_time * 1.30) * u_tension * 0.10;
  float spikes = abs(snoise(position * 16.0 + u_time * 7.0)) * t2 * 0.18
               + abs(snoise(position * 22.0 - u_time * 11.0)) * t2 * 0.10;
  float bands  = -abs(sin(position.y * (5.5 + u_tension * 3.0) + u_time * 1.5)) * u_tension * 0.07;
  float tremble = snoise(position * 28.0 + u_time * 14.0) * t2 * 0.05;

  float totalD = morphD + tensD + spikes + bands + tremble + u_pulse * 0.26;

  vNormal   = normalize(normalMatrix * normal);
  vPosition = position;
  vec3 displaced = position + normal * totalD;
  vWorldPos = (modelMatrix * vec4(displaced, 1.0)).xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
}
