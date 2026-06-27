uniform float u_time;
uniform float u_tension;
uniform float u_opacity;

varying float vProgress;
varying vec3 vPosition;

void main() {
  // Pulsing hot red glow
  float pulse = sin(u_time * 4.0 + vProgress * 6.28) * 0.5 + 0.5;
  float pulse2 = sin(u_time * 7.0 - vProgress * 3.14) * 0.5 + 0.5;

  // Deep crimson to bright red based on tension
  vec3 crimson  = vec3(0.55, 0.00, 0.03);
  vec3 hotRed   = vec3(0.95, 0.05, 0.08);
  vec3 glowCore = vec3(1.00, 0.30, 0.10);

  vec3 col = mix(crimson, hotRed, u_tension);
  col = mix(col, glowCore, pulse * u_tension * 0.5);
  col += glowCore * pulse2 * u_tension * 0.3;

  // Fade at thread ends
  float endFade = smoothstep(0.0, 0.04, vProgress) * smoothstep(1.0, 0.96, vProgress);

  float alpha = u_opacity * endFade;
  gl_FragColor = vec4(col, alpha);
}
