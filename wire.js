/*

  This examples demonstrates how we can render a height map, how to place out several models(using the batching feature), and how to
  implement a simple fullscreen post-process effect(using the framebuffer feature) in REGL. The post-process effect is a simple box filter blur.
*/

const canvas = document.body.appendChild(document.createElement('canvas'))
const fit = require('canvas-fit')
const regl = require('../regl')(canvas)
const mat4 = require('gl-mat4')
const noise2 = require('./noise.js')
const camera = require('canvas-orbit-camera')(canvas)
window.addEventListener('resize', fit(canvas), false)

// configure intial camera view.
camera.rotate([0.0, 0.0], [0.0, -0.4])
camera.zoom(700.0)

// geometry arrays.
const elements = []
var position = []

const H = 85 // height. row
const W = 70 // width. col

var size = 120.0
var xmin = -(W / 2.0) * size
var xmax = +(W / 2.0) * size
var zmin = -(H / 2.0) * size
var zmax = +(H / 2.0) * size

var row
var col
for (row = 0; row <= H; ++row) {
  var z = (row / H) * (zmax - zmin) + zmin
  for (col = 0; col <= W; ++col) {
    var x = (col / W) * (xmax - xmin) + xmin

    var f = 0.374
    var amp = 80.0

    var n = 0

    for (var i = 0; i < 2; i++) {
      n += amp * noise2(col * f, row * f)

      amp *= 10.0
      f *= 0.2
    }

    position.push([x, n, z])
  }
}

console.log('data: ', position)

var i0
var i1
for (row = 0; row <= (H - 1); ++row) {
  for (col = 0; col < (W - 1); ++col) {
    i = row * (W + 1) + col

    i0 = i + 0
    i1 = i + 1

    elements.push([i0, i1])
  }
}

for (row = 0; row < (H - 1); ++row) {
  for (col = 0; col <= (W - 1); ++col) {
    i = row * (W + 1) + col

    i0 = i + 0
    i1 = i + (W + 1)

    elements.push([i0, i1])
  }
}

const drawTerrain = regl({

  cull: {
    enable: true
  },
  uniforms: {
    // View Projection matrices.
    view: () => camera.view(),
    projection: ({viewportWidth, viewportHeight}) =>
      mat4.perspective([],
                       Math.PI / 4,
                       viewportWidth / viewportHeight,
                       0.01,
                       10000)
  },

  frag: `
  precision mediump float;

  void main () {
    gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
  }`,
  vert: `
  uniform sampler2D heightTexture;

  precision mediump float;

  attribute vec3 position;
  uniform mat4 projection, view;

  void main() {
    gl_Position = projection * view * vec4(position, 1);
  }`,

  attributes: {
    position: regl.prop('position')
  },
  elements: regl.prop('elements'),
  primitive: 'lines'
})

regl.frame(({deltaTime, viewportWidth, viewportHeight}) => {
  regl.clear({color: [0.0, 0.0, 0.0, 1.0]})
  drawTerrain({elements, position})

  camera.tick()
})
