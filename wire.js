/*

  This examples demonstrates how we can render a height map, how to place out several models(using the batching feature), and how to
  implement a simple fullscreen post-process effect(using the framebuffer feature) in REGL. The post-process effect is a simple box filter blur.
*/

const canvas = document.body.appendChild(document.createElement('canvas'))
const fit = require('canvas-fit')
const regl = require('../regl')(canvas)
const mat4 = require('gl-mat4')
const noise2 = require('./noise.js')
var camera = require('canvas-orbit-camera')(canvas)
window.addEventListener('resize', fit(canvas), false)
var cameraPosFromViewMatrix = require('gl-camera-pos-from-view-matrix')

// configure intial camera view.
camera.rotate([0.0, 0.0], [0.0, -0.4])
camera.zoom(2000.0)

const Z_FAR = 10000
const Z_NEAR = 0.01


// make texture.
var texData = []

var x
var z
var y
// line width
var lw = 10
for (y = 0; y < 256; y++) {
  var r = []
  for (x = 0; x < 256; x++) {
    if (y < lw || y > (256 - lw) || x < lw || x > (256 - lw)) {
      r.push([255, 255, 255, 255])
    } else {
      r.push([0, 0, 0, 255])
    }
  }
  texData.push(r)
}

// geometry arrays.
const elements = []
var position = []
var texCoord = []

const H = 80 // height. row
const W = 60 // width. col

var size = 100.0
var xmin = -(W / 2.0) * size
var xmax = +(W / 2.0) * size
var zmin = -(H / 2.0) * size
var zmax = +(H / 2.0) * size

var row
var col

for (row = 0; row <= H; ++row) {
  z = (row / H) * (zmax - zmin) + zmin
  for (col = 0; col <= W; ++col) {
    x = (col / W) * (xmax - xmin) + xmin

    var f = 0.10974
    var amp = 100.0

    var n = 0

    for (var i = 0; i < 2; i++) {
      n += amp * noise2(col * f, row * f)

      amp *= 6.0
      f *= 0.8
    }

    n = Math.round(n / 60) * 60
//    console.log('n: ', n)

    position.push([x, n, z])
  }
}

for (row = 0; row <= H; ++row) {
  z = (row / H)

  for (col = 0; col <= W; ++col) {
    x = (col / W)

    texCoord.push([x, z])
  }
}

/*
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
*/
for (row = 0; row <= (H - 1); ++row) {
  for (col = 0; col <= (W - 1); ++col) {
    i = row * (W + 1) + col

    var i0 = i + 0
    var i1 = i + 1
    var i2 = i + (W + 1) + 0
    var i3 = i + (W + 1) + 1

    elements.push([i3, i1, i0])
    elements.push([i0, i2, i3])
  }
}

const drawTerrain = regl({

  cull: {
    enable: true
  },

  uniforms: {
    // View Projection matrices.
    view: (_, props) => props.view,
    projection: ({viewportWidth, viewportHeight}) =>
      mat4.perspective([],
                       Math.PI / 4,
                       viewportWidth / viewportHeight,
                       Z_NEAR,
                       Z_FAR),

    tex: regl.texture({
      min: 'nearest mipmap linear',
      mag: 'linear',
      wrap: 'repeat',
      data: texData
    }),
    cameraPos: (_, props) => {
      return cameraPosFromViewMatrix([], props.view)
    }
  },

  frag: `
  precision mediump float;

  varying vec2 vTexCoord;
  varying vec3 vPosition;

  uniform sampler2D tex;

#define H int(${H})
#define W int(${W})

  uniform vec3 cameraPos;

  void main () {
    float dist = distance(cameraPos.xz, vPosition.xz);

    vec3 d = mix(vec3(1.0, 0.2, 0.5), vec3(1.0, 1.0, 1.0), dist / 1000.0);
    d = vec3(1.0, 0.2, 0.5);

    vec3 c = texture2D(tex, vTexCoord * vec2(W, H)).x * d;
    gl_FragColor = vec4(c.xyz, 1.0);
  }`,
  vert: `
  uniform sampler2D heightTexture;

  precision mediump float;

  attribute vec3 position;
  attribute vec2 texCoord;

  uniform mat4 projection, view;

  varying vec2 vTexCoord;
  varying vec3 vPosition;

  uniform vec3 cameraPos;

  void main() {
    vTexCoord = texCoord;
    vPosition = position.xyz;

    float dist = distance(cameraPos.xz, vPosition.xz);
    float curveAmount = 0.4;

    gl_Position = projection * view * vec4(position, 1) -
      vec4( 0.0, dist*curveAmount, 0.0, 0.0 );
  }`,

  attributes: {
    position: regl.prop('position'),
    texCoord: regl.prop('texCoord')

  },
  elements: regl.prop('elements'),
  primitive: 'triangles'
})

regl.frame(({deltaTime, viewportWidth, viewportHeight, tick}) => {
  regl.clear({color: [0.0, 0.0, 0.0, 1.0]})

  var view = camera.view()
  //  tick = 0
  var speed = 8.0
  var startZ = 5100
  var down = -4000

  mat4.lookAt(view, [0, 1000, startZ - tick * speed], [0, down, -startZ - tick * speed], [0, 1, 0])
  drawTerrain({elements, position, texCoord,
               view: view

              })

  camera.tick()
})
//    gl_Position = planetCurvedVertex(positionIn.xyz, 0.003, mvp, posRelativeToCamera);
