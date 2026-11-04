// Erzeugt die PNG-Icons (iOS braucht PNG) aus public/icon.svg.
import sharp from 'sharp'

const sizes = { 'icon-192.png': 192, 'icon-512.png': 512, 'apple-touch-icon.png': 180 }
for (const [file, size] of Object.entries(sizes)) {
  await sharp('public/icon.svg').resize(size, size).png().toFile(`public/${file}`)
  console.log('erstellt', file)
}
