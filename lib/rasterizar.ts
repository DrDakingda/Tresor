import 'server-only'
import path from 'node:path'
import { Resvg } from '@resvg/resvg-js'

const FUENTES = ['Inter_400Regular.ttf', 'Inter_500Medium.ttf'].map((f) => path.join(process.cwd(), 'assets', 'fonts', f))

// SVG → PNG a doble resolución para que se vea nítido en Excel.
export function svgAPng(svg: string, ancho: number) {
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: ancho * 2 },
    font: { fontFiles: FUENTES, loadSystemFonts: false, defaultFontFamily: 'Inter' },
  })
  return resvg.render().asPng()
}
