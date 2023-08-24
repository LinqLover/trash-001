
  constructor(options = {}) {
    this.options = options
  }

  defaultStyle = 'flatFDG'

  //#region building
  buildMap(domElement) {
    this.scene = new THREE.Scene()

    this.camera = new THREE.PerspectiveCamera()
    // Bird's eye view
    this.camera.position.set(0, 50, 100)
    // increase the far clipping plane to see the whole plane - TODO: don't hardcode
    this.camera.far = 10000

    this.renderer = new THREE.WebGLRenderer({
      powerPreference: 'high-performance'
    })

    this.window = domElement.ownerDocument.defaultView || domElement.ownerDocument.parentWindow
    this.window.traceMap = this

    const threeElement = domElement.querySelector('#three')
    threeElement.appendChild(this.renderer.domElement)
    new ResizeObserver(() => this.updateViewport()).observe(threeElement)

    this.buildConsoleInterface()
    this.buildControls()
    this.buildScene()
    const playerElement = domElement.querySelector('#player')
    this.buildPlayer(playerElement)

    this.renderer.setAnimationLoop(() => this.render())
  }

  buildConsoleInterface() {
    ;[FlatFDGEntityBuilder].forEach($class => {
      this.window[$class.name] = $class
    })
    console.log("%ctrace4d", 'color: #0000ff; font-size: larger; font-weight: bold')
    console.log("%cAdjust the map like this:", 'color: #0000ff')
    console.log(`
traceMap.entityBuilder.forceWeights.references = 0.5
traceMap.entityBuilder.forceWeights.organization.sameClass = 0.1
traceMap.entityBuilder.excludedObjectNames.push("''")
traceMap.entityBuilder.excludedClassNames.push('ByteString')
traceMap.entityBuilder.excludeClasses = false
traceMap.reloadTrace()
`) // , "color: #0000ff"  // WORKAROUND: formatted newlines are not copyable in Chrome Dev Tools
  }

  buildControls() {
    if ((this.options.countFPS ?? false) !== false) {
      this.buildFPSCounter()
    }

    this.buildMapControls()
    this.buildDragControls()
    this.buildMouseHandler()
  }

  buildFPSCounter() {
    this.stats = new Stats()
    this.stats.showPanel(0) // FPS
    this.window.document.body.appendChild(this.stats.dom)
  }

  buildMapControls() {
    this.mapControls = new MapControls(this.camera, this.renderer.domElement)
    this.mapControls.enableDamping = true
    this.mapControls.dampingFactor = 0.05
    this.mapControls.enablePan = true
    this.mapControls.minDistance = 20
    //this.mapControls.maxDistance = 200
    //this.mapControls.maxDistance = 2000
    this.mapControls.enableRotate = true
    // Enforce the camera to be above the ground plane
    this.mapControls.maxPolarAngle = Math.PI / 2 - 0.1
    this.mapControls.zoomToCursor = true // TODO: requires newer version of THREE.js

    this.mapControls.addEventListener('change', () => this.updateScene())
    this.mapControls.keyPanSpeed = 20
    this.mapControls.listenToKeyEvents(this.window.document)
  }

  buildDragControls() {
    // BUG: Should not be able to drag children of draggable, but DragControls always passes recursive=true to raycaster.
    this.dragControls = new DragControls([], this.camera, this.renderer.domElement)
    this.dragControls.addEventListener('hoveron', (event) => {
      event.object.entity?.onDragStart?.(event)
    })
    this.dragControls.addEventListener('hoveroff', (event) => {
      this.dragEntity = null
      event.object.entity?.onDragEnd?.(event)
    })
    this.dragControls.addEventListener('drag', (event) => {
      this.dragEntity = event.object.entity
      this.lastDragEvent = event
      event.object.entity?.onDrag?.(event)
      this.updateScene()
    })
    this.dragControls.enabled = false
  }

  registerDraggable(object3d) {
    this.dragControls.getObjects().push(object3d)
  }

  unregisterDraggable(object3d) {
    const index = this.dragControls.getObjects().indexOf(object3d)
    if (index >= 0) {
      this.dragControls.getObjects().splice(index, 1)
    }
  }

  buildMouseHandler() {
    const raycaster = new THREE.Raycaster()
    const mouse = new THREE.Vector2()
    this.mouseOverEntities = []
    this.focusEntity = null

    this.renderer.domElement.addEventListener('pointermove', event => {
      // required for updating DragControls, see references
      this.lastPointerMoveEvent = event

      mouse.x = (event.clientX / this.window.innerWidth) * 2 - 1
      mouse.y = -(event.clientY / this.window.innerHeight) * 2 + 1

	    raycaster.setFromCamera(mouse, this.camera)

    	const intersects = raycaster.intersectObjects(this.scene.children, true)

      const oldFocusEntity = this.focusEntity
      const oldMouseOverEntities = this.mouseOverEntities.slice()
      this.mouseOverEntities = intersects.slice().reverse().map(intersect => intersect.object.entity).filter(entity => entity)
      oldMouseOverEntities.forEach(entity => {
        if (!this.mouseOverEntities.includes(entity)) {
          entity.onMouseLeave?.(event)
        }
      })
      this.mouseOverEntities.forEach(entity => {
        if (!oldMouseOverEntities.includes(entity)) {
          entity.onMouseEnter?.(event)
        }
      })

      this.focusEntity = this.mouseOverEntities[this.mouseOverEntities.length - 1]
      if (this.focusEntity !== oldFocusEntity) {
        oldFocusEntity?.onHoverEnd?.(event)
        if (!(event.buttons & MouseButtonFlags.LEFT)) {
          this.focusEntity?.onHoverStart?.(event)
        }
      }

      intersects.some(intersect => {
        intersect.object.entity?.onHover?.(event) !== false
      })

      if (this.dragControls.enabled && !this.dragEntity) {
        // fix dragEntity (might be null when positioning cursor over entity before pressing shift)
        this.dragEntity = this.focusEntity
        this.dragEntity?.onDragStart?.(event)
      }

      this.updateCursor()
      this.updateScene()
    }, { capture: true })
    this.renderer.domElement.parentElement.addEventListener('mousemove', event => {
      // required for updating mouseOverEntities, see references
      this.lastMouseMoveEvent = event
    }, { capture: true })

    let mouseBeforeClick = null
    let isPlainClick = null
    this.renderer.domElement.addEventListener('mousedown', event => {
      mouseBeforeClick = mouse.clone()
      isPlainClick = true
    }, false)
    this.renderer.domElement.addEventListener('mousemove', event => {
      isPlainClick = isPlainClick && mouseBeforeClick.distanceTo(mouse) < 0.01
    }, false)
    this.renderer.domElement.addEventListener('click', event => {
      if (!isPlainClick) return
      isPlainClick = null
      mouseBeforeClick = null

      if (!this.dragEntity && this.focusEntity?.wantsClick?.(event)) {
        this.focusEntity.onClick?.(event)
      }
    }, false)

    this.window.addEventListener('keydown', event => {
      if (event.key === 'Shift') {
        this.mapControls.enabled = false
        this.dragControls.enabled = true

        if (this.dragEntity !== null) return
        if (!this.focusEntity?.wantsDrag?.(event)) return
        this.dragEntity = this.focusEntity
        this.dragEntity?.onDragStart?.(event)

        this.updateCursor(event)
        this.updateScene()
      }
    }, false)
    this.window.addEventListener('keyup', event => {
      if (event.key === 'Shift') {
        this.mapControls.enabled = true
        this.dragControls.enabled = false

        this.dragEntity?.onDragEnd?.(event)
        this.dragEntity = null

        this.updateCursor(event)
        this.updateScene()
      }
    }, false)
  }

  buildScene() {
    // add lights
    const directionalLight1 = new THREE.DirectionalLight(0xffffee)
    // TODO: don't hardcode sizes
    directionalLight1.position.set(250, 300, 200)
    directionalLight1.castShadow = true
    directionalLight1.shadow.camera.left = -400
    directionalLight1.shadow.camera.right = 400
    directionalLight1.shadow.camera.top = 400
    directionalLight1.shadow.camera.bottom = -400
    //directionalLight1.shadow.bias = -0.0000001
    directionalLight1.shadow.mapSize.width = 4096
    directionalLight1.shadow.mapSize.height = 4096
    this.scene.add(directionalLight1)

    const skyColor = 0x87ceeb
    const groundColor = 0xF6D7B0
    const hemisphereLight = new THREE.HemisphereLight(skyColor, groundColor, 0.7)
    this.scene.add(hemisphereLight);

    // add ground
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(100000, 64),
      new THREE.MeshStandardMaterial({ color: groundColor, roughness: 1, metalness: 0, flatShading: true })
    )
    ground.rotation.x = -Math.PI / 2
    ground.position.y = -10
    this.scene.add(ground)

    this.renderer.setClearColor(skyColor)
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap

    this.updateScene()
  }

  buildPlayer(domElement) {
    this.player = new Player(domElement)
    this.player.on('step', () => this.updateScene())
    const timelineElement = domElement.querySelector('#timeline')
    this.timeline = new Timeline(timelineElement)

    this.player.on('step', () => this.timeline.time = this.player.cursor.currentTime)
    {
      let wasPlaying = false
      this.timeline.on('startDrag', () => {
        wasPlaying = this.player.isPlaying
        this.player.pause()
      })
      this.timeline.on('endDrag', () => {
        if (wasPlaying) {
          this.player.resume()
        }
      })
    }
    // NB: if this gets too slow, debounce updates
    this.timeline.on('time', () => this.player.currentTime = this.timeline.time)
  }

  buildTrace(traceObject3d) {
    if (this.traceObject3d) this.scene.remove(this.traceObject3d)

    this.traceObject3d = traceObject3d
    this.scene.add(traceObject3d)

    this.updateScene()
  }
  //#endregion

  //#region loading
  async loadTraceFromServerFile(serverFile, style) {
    return this.loadTrace(await TraceReader.readTraceFromServerFile(serverFile), style)
  }

  async loadTraceFromLocalFile(localFile, style) {
    return this.loadTrace(await TraceReader.readTraceFromLocalFile(localFile), style)
  }

  loadTrace(trace, style = undefined) {
    this.trace = trace

    style ??= this.defaultStyle
    this.entityBuilder = EntityBuilder.newForStyle(style, this.trace)

    this.reloadTrace()
  }

  reloadTrace() {
    if (this.player) {
      this.player.reset()
    }

    const traceObject3d = this.entityBuilder.build(this)

    this.buildTrace(traceObject3d)

    this.reloadPlayer()

    setTimeout(() => this.player.start(), 3000) // TODO: Don't harcode
  }

  reloadPlayer() {
    this.timeline.minTime = this.trace.rootFrame.startTime
    this.timeline.maxTime = this.trace.rootFrame.endTime

    this.player.setToTrace(this.trace, this.traceObject3d.entity)
  }
  //#endregion

  //#region updating
  updateScene() {
    this.renderRequired = true
  }

  render() {
    if (this.renderRequired) {
      this.renderer.render(this.scene, this.camera)
      this.renderRequired = false
    }

    this.mapControls?.update()

    this.stats?.update()
  }

  updateCursor(event) {
    let cursor = 'auto'
    if (this.dragControls.enabled) {
      this.mouseOverEntities.forEach(entity => {
        if (this.dragControls.getObjects().some(object => object === entity.object3d)) {
          cursor = 'move'
          return
        }
      })
    } else {
      this.mouseOverEntities.forEach(entity => {
        if (entity.wantsClick(event)) {
          cursor = 'pointer'
          return
        }
      })
    }
    this.renderer.domElement.style.cursor = cursor
  }

  updateViewport() {
    // NOTE: if this becomes to slow, use throttle
    this.renderer.setSize(this.renderer.domElement.parentElement.clientWidth, this.renderer.domElement.parentElement.clientHeight)

    this.camera.aspect = this.renderer.domElement.clientWidth / this.renderer.domElement.clientHeight
    this.camera.updateProjectionMatrix()

    this.updateScene()
  }
  //#endregion
}
