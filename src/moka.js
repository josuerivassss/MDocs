import { createDefaultCompiler } from 'moka-dsl'

let compiler = null

export async function mokaToDiagram(code) {
  if (!compiler) compiler = createDefaultCompiler()
  const svg = compiler.compile(code, { target: 'svg' })
  if (svg.ok && svg.output) return { svg: svg.output }
  const retry = svg.diagnostics.some((d) => d.code === 'SEM016' || d.code === 'SEM017')
  if (!retry) throw new Error(svg.report())
  const mmd = compiler.compile(code, { target: 'mermaid' })
  if (mmd.ok && mmd.output) return { mermaid: mmd.output }
  throw new Error(mmd.report())
}
