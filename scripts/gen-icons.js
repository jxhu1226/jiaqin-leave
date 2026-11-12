const fs = require('fs')
const path = require('path')
const zlib = require('zlib')

const SIZE = 81
const SCALE = 4

function createCanvas(w, h) {
  return { w: w, h: h, data: new Uint8Array(w * h * 4) }
}

function setPixel(ctx, x, y, color) {
  const px = Math.round(x)
  const py = Math.round(y)
  if (px < 0 || py < 0 || px >= ctx.w || py >= ctx.h) return
  const i = (py * ctx.w + px) * 4
  const sa = color[3] / 255
  const da = ctx.data[i + 3] / 255
  const outA = sa + da * (1 - sa)
  if (outA <= 0) return
  ctx.data[i] = Math.round((color[0] * sa + ctx.data[i] * da * (1 - sa)) / outA)
  ctx.data[i + 1] = Math.round((color[1] * sa + ctx.data[i + 1] * da * (1 - sa)) / outA)
  ctx.data[i + 2] = Math.round((color[2] * sa + ctx.data[i + 2] * da * (1 - sa)) / outA)
  ctx.data[i + 3] = Math.round(outA * 255)
}

function fill(ctx, x, y, w, h, color, inside) {
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const x1 = Math.ceil(x + w)
  const y1 = Math.ceil(y + h)
  for (let py = y0; py < y1; py += 1) {
    for (let px = x0; px < x1; px += 1) {
      if (inside(px + 0.5, py + 0.5)) setPixel(ctx, px, py, color)
    }
  }
}

function inRoundRect(px, py, x, y, w, h, r) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2))
  const left = x
  const top = y
  const right = x + w
  const bottom = y + h
  if (px < left || py < top || px > right || py > bottom) return false
  let cx = px
  let cy = py
  if (px < left + radius) cx = left + radius
  else if (px > right - radius) cx = right - radius
  if (py < top + radius) cy = top + radius
  else if (py > bottom - radius) cy = bottom - radius
  if (cx === px || cy === py) return true
  const dx = px - cx
  const dy = py - cy
  return dx * dx + dy * dy <= radius * radius
}

function fillRoundRect(ctx, x, y, w, h, r, color) {
  fill(ctx, x, y, w, h, color, (px, py) => inRoundRect(px, py, x, y, w, h, r))
}

function strokeRoundRect(ctx, x, y, w, h, r, width, color) {
  const inset = width
  fill(ctx, x, y, w, h, color, (px, py) => {
    return inRoundRect(px, py, x, y, w, h, r)
      && !inRoundRect(px, py, x + inset, y + inset, w - inset * 2, h - inset * 2, Math.max(0, r - inset))
  })
}

function strokeCircle(ctx, cx, cy, r, width, color, pred) {
  const outer = r + width / 2
  const inner = Math.max(0, r - width / 2)
  fill(ctx, cx - outer, cy - outer, outer * 2, outer * 2, color, (px, py) => {
    const dx = px - cx
    const dy = py - cy
    const dist = dx * dx + dy * dy
    if (dist > outer * outer || dist < inner * inner) return false
    return pred ? pred(px, py) : true
  })
}

function strokePolyline(ctx, points, width, color) {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (let i = 0; i < points.length; i += 1) {
    minX = Math.min(minX, points[i][0])
    minY = Math.min(minY, points[i][1])
    maxX = Math.max(maxX, points[i][0])
    maxY = Math.max(maxY, points[i][1])
  }
  const pad = width
  fill(ctx, minX - pad, minY - pad, maxX - minX + pad * 2, maxY - minY + pad * 2, color, (px, py) => {
    let best = Infinity
    for (let i = 0; i < points.length - 1; i += 1) {
      const x1 = points[i][0]
      const y1 = points[i][1]
      const x2 = points[i + 1][0]
      const y2 = points[i + 1][1]
      const dx = x2 - x1
      const dy = y2 - y1
      const len2 = dx * dx + dy * dy
      let t = 0
      if (len2 > 0) t = ((px - x1) * dx + (py - y1) * dy) / len2
      if (t < 0) t = 0
      if (t > 1) t = 1
      const ex = px - (x1 + t * dx)
      const ey = py - (y1 + t * dy)
      best = Math.min(best, ex * ex + ey * ey)
    }
    return best <= (width / 2) * (width / 2)
  })
}

function downsample(ctx, scale) {
  const w = ctx.w / scale
  const h = ctx.h / scale
  const out = new Uint8Array(w * h * 4)
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      let r = 0
      let g = 0
      let b = 0
      let a = 0
      for (let sy = 0; sy < scale; sy += 1) {
        for (let sx = 0; sx < scale; sx += 1) {
          const i = ((y * scale + sy) * ctx.w + (x * scale + sx)) * 4
          const pa = ctx.data[i + 3] / 255
          r += ctx.data[i] * pa
          g += ctx.data[i + 1] * pa
          b += ctx.data[i + 2] * pa
          a += pa
        }
      }
      const alpha = a / (scale * scale)
      const o = (y * w + x) * 4
      out[o + 3] = Math.round(alpha * 255)
      if (a > 0) {
        out[o] = Math.round(r / a)
        out[o + 1] = Math.round(g / a)
        out[o + 2] = Math.round(b / a)
      }
    }
  }
  return { w: w, h: h, data: out }
}

function crc32(buf) {
  let c = ~0
  for (let i = 0; i < buf.length; i += 1) {
    c ^= buf[i]
    for (let k = 0; k < 8; k += 1) c = (c >>> 1) ^ (0xedb88320 & -(c & 1))
  }
  return ~c >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)
  const name = Buffer.from(type)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([name, data])), 0)
  return Buffer.concat([length, name, data, crc])
}

function encodePNG(image) {
  const raw = Buffer.alloc((image.w * 4 + 1) * image.h)
  for (let y = 0; y < image.h; y += 1) {
    const row = y * (image.w * 4 + 1)
    raw[row] = 0
    for (let x = 0; x < image.w * 4; x += 1) raw[row + 1 + x] = image.data[y * image.w * 4 + x]
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(image.w, 0)
  ihdr.writeUInt32BE(image.h, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

function render(draw) {
  const ctx = createCanvas(SIZE * SCALE, SIZE * SCALE)
  draw(ctx, SCALE)
  return downsample(ctx, SCALE)
}

function calendar(ctx, s, color) {
  const u = (n) => n * s
  fillRoundRect(ctx, u(27), u(14), u(6), u(16), u(3), color)
  fillRoundRect(ctx, u(48), u(14), u(6), u(16), u(3), color)
  strokeRoundRect(ctx, u(16), u(22), u(49), u(44), u(8), u(3.2), color)
  fillRoundRect(ctx, u(16), u(34), u(49), u(3.2), 0, color)
}

function leave(ctx, s, color) {
  const u = (n) => n * s
  strokeRoundRect(ctx, u(22), u(14), u(37), u(52), u(7), u(3.2), color)
  fillRoundRect(ctx, u(30), u(28), u(21), u(3), u(1.5), color)
  fillRoundRect(ctx, u(30), u(38), u(21), u(3), u(1.5), color)
  fillRoundRect(ctx, u(30), u(48), u(14), u(3), u(1.5), color)
}

function approval(ctx, s, color) {
  const u = (n) => n * s
  strokeCircle(ctx, u(40.5), u(40.5), u(20), u(3.2), color)
  strokePolyline(ctx, [[u(30), u(41.5)], [u(37.5), u(49)], [u(52.5), u(33)]], u(3.4), color)
}

function profile(ctx, s, color) {
  const u = (n) => n * s
  strokeCircle(ctx, u(40.5), u(28), u(9), u(3.2), color)
  strokeCircle(ctx, u(40.5), u(64), u(16), u(3.2), color, (px, py) => py < u(56) && py > u(42))
}

const ICONS = {
  calendar: calendar,
  leave: leave,
  approval: approval,
  profile: profile,
}

const COLORS = {
  '': [109, 103, 95, 255],
  '-on': [15, 110, 86, 255],
}

const outDir = path.join(__dirname, '..', 'miniprogram', 'assets', 'tab')
fs.mkdirSync(outDir, { recursive: true })

Object.keys(ICONS).forEach((name) => {
  Object.keys(COLORS).forEach((suffix) => {
    const png = encodePNG(render((ctx, scale) => ICONS[name](ctx, scale, COLORS[suffix])))
    fs.writeFileSync(path.join(outDir, name + suffix + '.png'), png)
  })
})

console.log('wrote tab icons to ' + outDir)
