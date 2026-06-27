import * as THREE from 'three';
import { AppState } from '../state.js';
import waterMoonVert from '../shaders/waterMoon.vert?raw';
import waterMoonFrag from '../shaders/waterMoon.frag?raw';

// ── Layout constants (must match LiquidMoon.js) ───────────────────────────────
const SPHERE_Y  =  0.75;   // main sphere center
const WATER_Y   = -0.55;   // water surface level
const REFLECT_Y = 2 * WATER_Y - SPHERE_Y;  // = -1.85, mirror position

// ── Water plane inline shaders ────────────────────────────────────────────────

const WATER_VERT = /* glsl */`
  uniform float u_time;
  varying vec3  vWorldPos;

  // compact simplex noise
  vec3 _m3(vec3 x){return x-floor(x*(1./289.))*289.;}
  vec4 _m4(vec4 x){return x-floor(x*(1./289.))*289.;}
  vec4 _p(vec4 x){return _m4(((x*34.)+1.)*x);}
  float snoise(vec3 v){
    const vec2 C=vec2(1./6.,1./3.);const vec4 D=vec4(0.,.5,1.,2.);
    vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);
    vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.-g;
    vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);
    vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;
    i=_m3(i);
    vec4 p=_p(_p(_p(i.z+vec4(0,i1.z,i2.z,1))+i.y+vec4(0,i1.y,i2.y,1))+i.x+vec4(0,i1.x,i2.x,1));
    float n_=.142857142857;vec3 ns=n_*D.wyz-D.xzx;
    vec4 j=p-49.*floor(p*ns.z*ns.z);vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.*x_);
    vec4 xv=x_*ns.x+ns.yyyy;vec4 yv=y_*ns.x+ns.yyyy;vec4 h=1.-abs(xv)-abs(yv);
    vec4 b0=vec4(xv.xy,yv.xy);vec4 b1=vec4(xv.zw,yv.zw);
    vec4 s0=floor(b0)*2.+1.;vec4 s1=floor(b1)*2.+1.;vec4 sh=-step(h,vec4(0));
    vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
    vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);
    vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);
    vec4 nm=1.79284291400159-.85373472095314*vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3));
    p0*=nm.x;p1*=nm.y;p2*=nm.z;p3*=nm.w;
    vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.);
    m=m*m;return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,p2),dot(p3,x3)));
  }

  void main() {
    // Gentle surface wave (Y = up in world after rotation)
    float wave = snoise(vec3(position.x * 2.2, position.y * 2.8, u_time * 0.55)) * 0.018
               + snoise(vec3(position.x * 4.5, position.y * 3.5, u_time * 0.80)) * 0.008;
    vec3 displaced = position + normal * wave;
    vWorldPos = (modelMatrix * vec4(displaced, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
  }
`;

const WATER_FRAG = /* glsl */`
  uniform float u_time;
  uniform float u_morphPhase;
  varying vec3  vWorldPos;

  // compact snoise
  vec3 _m3(vec3 x){return x-floor(x*(1./289.))*289.;}
  vec4 _m4(vec4 x){return x-floor(x*(1./289.))*289.;}
  vec4 _p(vec4 x){return _m4(((x*34.)+1.)*x);}
  float snoise(vec3 v){
    const vec2 C=vec2(1./6.,1./3.);const vec4 D=vec4(0.,.5,1.,2.);
    vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);
    vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.-g;
    vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);
    vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;
    i=_m3(i);
    vec4 p=_p(_p(_p(i.z+vec4(0,i1.z,i2.z,1))+i.y+vec4(0,i1.y,i2.y,1))+i.x+vec4(0,i1.x,i2.x,1));
    float n_=.142857142857;vec3 ns=n_*D.wyz-D.xzx;
    vec4 j=p-49.*floor(p*ns.z*ns.z);vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.*x_);
    vec4 xv=x_*ns.x+ns.yyyy;vec4 yv=y_*ns.x+ns.yyyy;vec4 h=1.-abs(xv)-abs(yv);
    vec4 b0=vec4(xv.xy,yv.xy);vec4 b1=vec4(xv.zw,yv.zw);
    vec4 s0=floor(b0)*2.+1.;vec4 s1=floor(b1)*2.+1.;vec4 sh=-step(h,vec4(0));
    vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
    vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);
    vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);
    vec4 nm=1.79284291400159-.85373472095314*vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3));
    p0*=nm.x;p1*=nm.y;p2*=nm.z;p3*=nm.w;
    vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.);
    m=m*m;return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,p2),dot(p3,x3)));
  }

  // State-based moonlight colour (ice=cold white, fluid=amber, pulse=green/pink)
  vec3 moonlightColor() {
    float T3 = 2.0943951;
    float wI = (cos(u_morphPhase)       + 1.0) * 0.5;
    float wF = (cos(u_morphPhase - T3)  + 1.0) * 0.5;
    float wP = (cos(u_morphPhase-2.*T3) + 1.0) * 0.5;
    float s  = wI + wF + wP + 0.001;
    wI /= s; wF /= s; wP /= s;
    float colorCycle = sin(u_time * 0.12) * 0.5 + 0.5;
    vec3 cI = vec3(0.82, 0.88, 1.00);                              // cold blue-white
    vec3 cF = vec3(0.95, 0.78, 0.45);                              // warm amber
    vec3 cP = mix(vec3(0.10,0.84,0.52), vec3(0.90,0.48,0.60), colorCycle); // green↔pink
    return cI * wI + cF * wF + cP * wP;
  }

  void main() {
    float wx = vWorldPos.x;
    float wz = vWorldPos.z; // positive = toward camera

    // ── Ripple-distorted horizontal position ──────────────────────────────
    float rip1 = snoise(vec3(wx * 2.0, wz * 1.5, u_time * 0.40)) * 0.14;
    float rip2 = snoise(vec3(wx * 4.5, wz * 3.0, u_time * 0.65)) * 0.06;
    float distX = wx + (rip1 + rip2) * sign(wx + 0.0001);

    // ── Moonlight streak: bright column along center (x≈0) ───────────────
    // Width is constant in world space; perspective makes it look wider near cam
    float streakW  = 0.32;
    float streak   = exp(-(distX * distX) / (streakW * streakW));
    // Attenuate the streak going far behind the reflection point
    streak        *= exp(-max(0.0, -wz) * 0.10);
    // Also fade the portion extremely close to camera (avoid clipping artifacts)
    streak        *= smoothstep(3.8, 2.5, wz);

    // ── Secondary wide soft glow around the streak ────────────────────────
    float softGlowW = 1.2;
    float softGlow  = exp(-(wx * wx) / (softGlowW * softGlowW)) * 0.18;
    softGlow       *= exp(-max(0.0, -wz) * 0.06);

    // ── Sparkle highlights scattered in the streak ────────────────────────
    float sp1 = pow(snoise(vec3(wx * 9.0,  wz * 8.0,  u_time * 0.80)) * 0.5 + 0.5, 7.0);
    float sp2 = pow(snoise(vec3(wx * 14.0, wz * 13.0, u_time * 1.10)) * 0.5 + 0.5, 9.0);
    float sparkles = (sp1 * 0.9 + sp2 * 0.6) * streak * 2.5;
    // Scatter a few dim sparkles beyond the streak edge
    float sp3 = pow(snoise(vec3(wx * 11.0, wz * 9.0, u_time * 0.60)) * 0.5 + 0.5, 11.0);
    sparkles += sp3 * softGlow * 0.8;

    // ── Moon state drives the reflection colour ───────────────────────────
    vec3 moonCol = moonlightColor();

    // ── Dark green-black water base ───────────────────────────────────────
    float depthFade = exp(-max(0.0, -wz) * 0.10);
    // Slight green tint in the foreground water (like the reference photo)
    float greenNear = exp(-abs(wz) * 0.25) * exp(-abs(wx) * 0.4);
    vec3 waterBase = vec3(0.004, 0.012, 0.008) * depthFade
                   + vec3(0.000, 0.022, 0.010) * greenNear;

    // ── Combine ───────────────────────────────────────────────────────────
    vec3 reflLight  = moonCol * (streak + softGlow);
    vec3 sparkLight = moonCol * sparkles;
    vec3 finalColor = waterBase + reflLight + sparkLight;

    // Keep it very subtle — just a hint of reflection
    float alpha = 0.10 * (0.5 + streak * 0.5 + sparkles * 0.3);
    gl_FragColor = vec4(finalColor, clamp(alpha, 0.0, 0.12));
  }
`;

// ── WaterSurface class ────────────────────────────────────────────────────────

export class WaterSurface {
  constructor(scene, camera) {
    this.scene  = scene;
    this.camera = camera;

    // Clip plane: hides the reflection sphere above water level
    this._clipPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -WATER_Y);

    this._buildWater();
    this._buildReflection();
  }

  // ── Water surface plane ───────────────────────────────────────────────────

  _buildWater() {
    // Small plane — just the reflection pool directly under the sphere
    const geo = new THREE.PlaneGeometry(4, 5, 32, 32);

    const mat = new THREE.ShaderMaterial({
      vertexShader:   WATER_VERT,
      fragmentShader: WATER_FRAG,
      uniforms: {
        u_time:       { value: 0 },
        u_morphPhase: { value: 0 },
      },
      transparent: true,
      depthWrite:  false,
    });

    this.waterMesh = new THREE.Mesh(geo, mat);
    this.waterMesh.rotation.x = -Math.PI / 2;
    // Centred directly under the sphere (x=0, z=0)
    this.waterMesh.position.set(0, WATER_Y, -0.5);
    this.waterMesh.renderOrder = 1;
    this.scene.add(this.waterMesh);
  }

  // ── Reflection sphere (same waterMoon shader, clipped above water) ────────

  _buildReflection() {
    const geo = new THREE.SphereGeometry(1.0, 96, 96);

    const mat = new THREE.ShaderMaterial({
      vertexShader:   waterMoonVert,
      fragmentShader: waterMoonFrag,
      uniforms: {
        u_time:         { value: 0 },
        u_tension:      { value: 0 },
        u_pulse:        { value: 0 },
        u_morphPhase:   { value: 0 },
        u_cameraPos:    { value: new THREE.Vector3() },
        u_isReflection: { value: 1.0 },
      },
      transparent:    true,
      depthWrite:     false,
      clippingPlanes: [this._clipPlane],
    });

    this.reflMesh = new THREE.Mesh(geo, mat);
    this.reflMesh.scale.setScalar(0.8);
    this.reflMesh.position.set(0, REFLECT_Y, 0);
    this.reflMesh.renderOrder = 0;   // render before water
    this.scene.add(this.reflMesh);
  }

  // ── Called each frame from main.js to sync moon state ─────────────────────

  syncMoon(morphPhase, tension, pulse) {
    this.reflMesh.material.uniforms.u_morphPhase.value = morphPhase;
    this.reflMesh.material.uniforms.u_tension.value    = tension;
    this.reflMesh.material.uniforms.u_pulse.value      = pulse;
    this.reflMesh.material.uniforms.u_cameraPos.value.copy(this.camera.position);
    this.waterMesh.material.uniforms.u_morphPhase.value = morphPhase;
  }

  // ── Per-frame update ──────────────────────────────────────────────────────

  update(dt) {
    const t = AppState.time;
    this.waterMesh.material.uniforms.u_time.value = t;
    this.reflMesh.material.uniforms.u_time.value  = t;

    // Show during acts 1 & 2; fade out during the cut sequence
    const show = AppState.scene <= 2
              || (AppState.scene === 3 && AppState.cutProgress < 0.55);
    this.waterMesh.visible = show;
    this.reflMesh.visible  = show;
  }

  dispose() {
    [this.waterMesh, this.reflMesh].forEach(m => {
      this.scene.remove(m);
      m.geometry.dispose();
      m.material.dispose();
    });
  }
}
