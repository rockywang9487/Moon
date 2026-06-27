uniform float u_time;
uniform float u_tension;

varying float vProgress;
varying vec3 vPosition;

void main() {
  vProgress = uv.x;
  vPosition = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
