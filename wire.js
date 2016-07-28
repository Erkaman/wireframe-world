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

const Z_FAR = 120000
const Z_NEAR = 0.01
const FOV = Math.PI / 4

var x
var z
var y
var r

function makeWireframeTexture () {
  var texData = []

  var lw = 10 // line width
  for (y = 0; y < 256; y++) {
    r = []
    for (x = 0; x < 256; x++) {
      if (y < lw || y > (256 - lw) || x < lw || x > (256 - lw)) {
        r.push([255, 255, 255, 255])
      } else {
        r.push([0, 0, 0, 255])
      }
    }
    texData.push(r)
  }

  // do gaussian blur on the image:

  var tempTexData = []

  for (y = 0; y < 256; y++) {
    r = []
    for (x = 0; x < 256; x++) {
      var c = [0, 0, 0, 0]

      for (var ax = -3; ax <= +3; ax++) {
        for (var ay = -3; ay <= +3; ay++) {
          var wy = y + ay
          var wx = x + ax

          if (wy < 0 || wx < 0 || wy > 255 || wx > 255) {
            continue
          }

          var d = texData[wy][wx]

          c = [
            c[0] + d[0],
            c[1] + d[1],
            c[2] + d[2],
            c[3] + d[3]
          ]
        }
      }
      var u = 49.0
      r.push([c[0] / u, c[1] / u, c[2] / u, c[3] / u])
    }
    tempTexData.push(r)
  }
  texData = tempTexData

  return texData
}

// lerp between two colors
function lerp (c0, c1, x) {
  return [
    c1[0] * x + c0[0] * (1.0 - x),
    c1[1] * x + c0[1] * (1.0 - x),
    c1[2] * x + c0[2] * (1.0 - x),
    c1[3] * x + c0[3] * (1.0 - x)
  ]
}

function makeSunTexture () {
  // make texture.
  var texData = []

  // #F6 7D CA = 246, 125, 202
  // #F73C6F =   247, 27, 111
  var palette = [
    [0.0, [246.0, 125.0, 202.0, 255.0]],
    [0.6, [247.0, 27.0, 111.0, 255.0]],
    [0.9, [247.0, 27.0, 111.0, 255.0]],
    [1.0, [0.0, 0.0, 0.0, 255.0]]
  ]
  //  var ip = 0 // current palette index.

  for (y = 0; y < 256; y++) {
    r = []
    for (x = 0; x < 256; x++) {
      // convert (x,y) to range [-1, +1]
      var ox = (x - 128) / 127
      var oy = (y - 128) / 127

      var R = Math.sqrt(ox * ox + oy * oy)
      var c

      if (R >= 1.0) {
        c = [0.0, 0.0, 0.0, 0.0]
      } else {
        var ip
        for (ip = 0; ip < palette.length - 1; ip++) {
          if (palette[ip][0] <= R && palette[ip + 1][0] >= R) {
            break
          }
        }

        var c0 = palette[ip + 0]
        var c1 = palette[ip + 1]

        c = lerp(c0[1], c1[1], (R - c0[0]) / (c1[0] - c0[0]))
      }
      r.push(c)
    }
    texData.push(r)
  }

  return texData
}

// geometry arrays.
const elements = []
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

function Chunk () {
  this.position = []
  this.positionBuffer = regl.buffer({
    length: (H + 1) * (W + 1) * 3 * 4,
    type: 'float',
    usage: 'dynamic'
  })
}

var chunkPool = []
function freeChunk (chunk) {
  chunkPool.push(chunk)
}

var N = 0

function makeChunk () {
  // retrieve chunk from the pool, or create one if necessary.
  var chunk = chunkPool.pop() || new Chunk()

  var j = 0
  for (row = 0; row <= H; ++row) {
    z = (row / H) * (zmax - zmin) + zmin
    // If N==0, then this is the first chunk that we see.
    // If N==1, it is the second chunk that we see, and so on.
    z += (zmax - zmin) * -N

    for (col = 0; col <= W; ++col) {
      x = (col / W) * (xmax - xmin) + xmin

      var f = 0.0015974
      var amp = 100.0

      var n = 0

      for (var i = 0; i < 2; i++) {
        n += amp * noise2(x * f, z * f)

        amp *= 6.0
        f *= 0.5
      }

      y = Math.round(n / 60) * 60

      chunk.position[j++] = [x, y, z]
    }
  }
  chunk.positionBuffer.subdata(chunk.position)
  chunk.N = N

  N++
  return chunk
}

var chunks = []

var RENDER_N = 10

for (i = 0; i < RENDER_N; i++) {
  chunks[i] = makeChunk()
}

for (row = 0; row <= H; ++row) {
  z = (row)
  for (col = 0; col <= W; ++col) {
    x = (col)
    texCoord.push([x, z])
  }
}

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

const globalScope = regl({
  uniforms: {
    projection: ({viewportWidth, viewportHeight}) => {
      return mat4.perspective([], FOV, viewportWidth / viewportHeight, Z_NEAR, Z_FAR)
    }
  },
  cull: {
    enable: true
  }
})

const chunkScope = regl({
  uniforms: {
    // View Projection matrices.
    view: (_, props) => props.view,

    tex: regl.texture({
      min: 'nearest mipmap linear',
      mag: 'linear',
      wrap: 'repeat',
      data: makeWireframeTexture()
    }),
    cameraPos: (_, props) => {
      return cameraPosFromViewMatrix([], props.view)
    },
    tick: ({tick}) => tick
  },

  frag: `
  precision mediump float;

  varying vec2 vTexCoord;
  varying vec3 vPosition;

  uniform sampler2D tex;

  uniform vec3 cameraPos;
  uniform float tick;

  void main () {
    vec3 p = vPosition;
    vec3 d = vec3(1.0, 0.2, 0.5);

    d = vec3(
      (sin(tick*0.02 + 0.0) + 1.0) * 0.5 + 0.5,
      (sin(tick*0.02 + 2.0) + 1.0) * 0.5 + 0.5,
      (sin(tick*0.01 + 4.0) + 1.0) * 0.5 + 0.5
    );

    vec3 c = texture2D(tex, vTexCoord).x * d;
    gl_FragColor = vec4(c.xyz, 1.0);
  }`,
  vert: `

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
    float curveAmount = 0.5;

    gl_Position = projection * view * vec4(position, 1) -
      vec4( 0.0, dist*curveAmount, 0.0, 0.0 );
  }`,

  attributes: {
    texCoord: texCoord
  },
  elements: elements
})

const drawSun = regl({
  uniforms: {
    view: (_, props) => {
      var m = mat4.copy([], props.view)
      m[12] = 0
      m[13] = 0
      m[14] = 0
      return m
    },
    tex: regl.texture({
      data: makeSunTexture(),
      mag: 'linear'
    })
  },

  frag: `
  precision mediump float;

  varying vec2 vTexCoord;

  uniform sampler2D tex;

  void main () {
    gl_FragColor = vec4(texture2D(tex, vTexCoord).xyz, 1.0);
  }`,
  vert: `
  precision mediump float;

  attribute vec3 position;
  attribute vec2 texCoord;

  uniform mat4 projection, view;
  uniform vec3 cameraPos;

  varying vec2 vTexCoord;

  void main() {
    vec3 q = position;
    q += vec3(0.0, -0.7, 0.0);
    q *= vec3(vec2(0.4), -1.0);
    vec4 p = view * vec4(q, 1);

    vTexCoord = texCoord;
    gl_Position = projection * p;
  }`,

  attributes: {
    position: [
      [-0.5, -0.5, 1.0],
      [+0.5, -0.5, 1.0],
      [+0.5, +0.5, 1.0],

      [+0.5, +0.5, 1.0],
      [-0.5, +0.5, 1.0],
      [-0.5, -0.5, 1.0]
    ],
    texCoord: [
      [0.0, 0.0],
      [1.0, 0.0],
      [1.0, 1.0],

      [1.0, 1.0],
      [0.0, 1.0],
      [0.0, 0.0]
    ]
  },

  count: 6,
  depth: {
    enable: false // the sun will be behind everything else.
  }
})

const drawChunk = regl({
  attributes: {
    position:  regl.prop('pos')
  }
})

regl.frame(({deltaTime, viewportWidth, viewportHeight, tick}) => {
  regl.clear({color: [0.0, 0.0, 0.0, 1.0]})

  var view = camera.view()
  var speed = 40.0
  var startZ = 5100
  var down = -4000
//  var  tick = 0.0

  var cameraPos = [0, 1000, startZ - tick * speed]
  mat4.lookAt(view, cameraPos, [0, down, -startZ - tick * speed], [0, 1, 0])

  globalScope(() => {
    drawSun({view: view})

    chunkScope({view: view}, () => {

      for (i = 0; i < chunks.length; i++) {
        drawChunk({ pos:  {buffer: chunks[i].positionBuffer}  })
      }
    })
  })

  if(chunks.length > 0) {
    /*console.log('N: ', chunks[0].N)
      console.log('camz: ', cameraPos[2])
      console.log('camz: ', cameraPos[2])
    */
    z = zmin + (zmax - zmin) * -chunks[0].N;
    if(cameraPos[2] < z) {
   //   console.log('remove first')
      freeChunk(chunks.shift())
      // console.log('size:', chunks.length)

      chunks.push(makeChunk())

    }
  }

  camera.tick()
})
