import WebGL from 'three/addons/capabilities/WebGL.js'

import { TraceMap } from './map.js'


if (!WebGL.isWebGLAvailable()) {
	const warning = WebGL.getWebGLErrorMessage()
	document.getElementById( 'container' ).appendChild( warning )
  throw new Error('WebGL is not available')
}


async function init() {
  const traceMap = new TraceMap()

  const defaultTraceUrl = 'traces/regexParse.json'
  const defaultStyle = 'flatFDG'

  const params = new URLSearchParams(window.location.search)
  const traceUrl = params.get('trace') ?? defaultTraceUrl
  const style = params.get('style') ?? defaultStyle

  const options = Object.fromEntries(params.entries())
  delete options.trace
  delete options.style
  Object.assign(traceMap.options, options)

  traceMap.buildMap(document.querySelector('#container'))
  await traceMap.loadTraceFromServerFile(traceUrl, style)
}

await init()
