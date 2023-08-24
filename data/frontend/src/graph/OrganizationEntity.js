
  children = []
  childConnections = []

  static colors = {
    default: { h: 0.333, s: 1, l: 0.25 },
    hover: { h: 0.333, s: 1, l: 0.5 }
  }

  constructor(organization) {
    super()
    this.organization = organization
  }

  //#region accessors
  get name() {
    return this.organization?.name
  }
  //#endregion

  //#region composition
  addChild(child) {
    this.children.push(child)
    child.parent = this
  }

  removeChild(child) {
    this.children.splice(this.children.indexOf(child), 1)
    child.parent = null
  }

  sortAllChildren() {
    this.children.forEach(child => child.sortAllChildren())
    this.children.sort((a, b) => a.name.localeCompare(b.name))
  }

  allEntities(predicate = null) {
    const entities = []
    if (predicate == null || predicate(this)) {
      entities.push(this)
    }
    this.children.forEach(child => {
      entities.push(...child.allEntities(predicate))
    })
    return entities
  }
  //#endregion

  //#region building
  build(traceMap, options = {}) {
    this.buildObject3d(traceMap, options)
    this.cuboid.entity = this

    this.buildChildren(traceMap, { deferLabels: true, ...options })
    this.layoutChildren()

    if (!(options.deferLabels ?? false)) {
      this.buildAllLabels()
    }

    this.buildChildConnections(traceMap)

    if (this.wantsDrag()) {
      traceMap.registerDraggable(this.cuboid)
    }
    return this.cuboid
  }

  buildAllLabels() {
    super.buildAllLabels()

    this.children.forEach(child => {
      child.buildAllLabels()
    })
  }

  buildChildren(traceMap, options = {}) {
    let i = 0
    const n = this.children.length
    const childObjects = this.children.map(child => {
      //if (i++ % 100 == 0) console.log(`${i} / ${n}`)
      return child.build(traceMap, options)
    })
    if (childObjects.length == 0) return

    this.object3d.add(...childObjects)
  }

  buildChildConnections(traceMap) {
    this.childConnections.forEach(connection => {
      this.object3d.add(connection.build())
    })
  }

  addChildConnection(source, target, strength) {
    const connection = new Connection(source, target, strength)
    ;(Array.isArray(source) ? source : [source]).forEach(entity => {
      entity.connections.push(connection)
    })
    target.connections.push(connection)
    this.childConnections.push(connection)
    return connection
  }
  //#endregion

  //#region layout
  get height() {
    return 10
  }

  adoptSize(width, depth) {
    this.cuboid.geometry = BoxGeometryExtension.copyWith(this.cuboid.geometry, width, this.height, depth)
  }

  layoutChildren() {
    this.layoutChildrenOnGrid({
      resizeMode: 'shrinkWrap',
      offset: 10 * .5 ** (this.path.length - 1),
      margin: {
        absolute: 10
        /* relative: 1.5 */
      }
    })
  }

  // TODO: maybe extract each layout method as a method object in the future. would also make generic queries easier.
  layoutChildrenOnGrid(options = {}) {
    const childObjects = options.childObjects ?? this.object3d.children
    if (childObjects.length == 0) return

    const groupBy = options.groupBy
    if (groupBy != null) {
      const { groupBy: _, groupExtract, ...groupOptions } = options
      return collect(childObjects)
        .groupBy((object3d) => object3d.entity?.[groupBy])
        .map((groupChildObjects, key) => this.layoutChildrenOnGrid({
          childObjects: groupChildObjects.all(),
          ...(groupExtract ? { [groupExtract]: key } : {}),
          ...groupOptions
        }))
        .all()
    }


    // read options
    const resizeMode = options.resizeMode ?? 'spaceFill'
    const side = options.side ?? 'top'
    const idealCellRatio = options.idealCellRatio ?? 1
    const childExtentW = options.childExtentW
    const query = options.query ?? null
    const dryRun = options.dryRun ?? false

    const offset = typeof options.offset === 'number' ? options.offset : 0
    const offsetU = options.offset?.u ?? offset
    const offsetV = options.offset?.v ?? offset
    const offsetLeft = options.offset?.left ?? offsetU
    const offsetTop = options.offset?.top ?? offsetV
    const offsetRight = options.offset?.right ?? offsetU
    const offsetBottom = options.offset?.bottom ?? offsetV

    const marginAbsolute = options.margin?.absolute ?? 0
    const marginAbsoluteU = options.margin?.absoluteU ?? marginAbsolute
    const marginAbsoluteV = options.margin?.absoluteV ?? marginAbsolute
    const marginRelative = options.margin?.relative ?? 0
    const marginRelativeU = options.margin?.relativeU ?? marginRelative
    const marginRelativeV = options.margin?.relativeV ?? marginRelative

    const baseObject3d = this.object3d

    // compute layout
    // TODO: Honor v/w for non-square objects? On the other hand, this would lead to asymmetric layouts for different sides.
    const gridCountU = Math.ceil(Math.sqrt(childObjects.length) / idealCellRatio)
    const gridCountV = Math.ceil(childObjects.length / gridCountU)

    if (query === 'gridCountU') {
      return gridCountU
    } else if (query === 'gridCountV') {
      return gridCountV
    }

    let originOffset = new THREE.Vector3(offsetLeft, 0, offsetTop)
    let cornerOffset = new THREE.Vector3(offsetRight, 0, offsetBottom)
    // apply reverse rotation, as offsets are given in target orientation
    let oneVector = new THREE.Vector3(1, 1, 1)
    rotate(null, oneVector)
    originOffset.divide(oneVector)
    cornerOffset.divide(oneVector)
    const originOffsetU = originOffset.x
    const originOffsetV = originOffset.z
    const cornerOffsetU = cornerOffset.x
    const cornerOffsetV = cornerOffset.z

    const extentW = this[getGeometryKey('w')] ?? getGeometryParameter(this.object3d, 'w')
    const globalW = extentW / 2

    const { marginU, marginV, cellExtentU, cellExtentV } = {
      shrinkWrap: () => {
        const cellExtentU = collect(childObjects).map(child => getGeometryParameter(child, 'u')).max()
        const cellExtentV = collect(childObjects).map(child => getGeometryParameter(child, 'v')).max()

        const marginU = marginAbsoluteU + cellExtentU * marginRelativeU
        const marginV = marginAbsoluteV + cellExtentV * marginRelativeV
        return { marginU, marginV, cellExtentU, cellExtentV }
      },
      spaceFill: () => {
        const marginU = marginAbsoluteU
        const marginV = marginAbsoluteV

        const fullExtentU = this[getGeometryKey('u')] ?? getGeometryParameter(this.object3d, 'u')
        const fullExtentV = (this[getGeometryKey('v')] ?? getGeometryParameter(this.object3d, 'v'))
        const extentU = fullExtentU - originOffsetU - cornerOffsetU
        const extentV = fullExtentV - originOffsetV - cornerOffsetV

        const cellExtentU = (extentU - marginU * (gridCountU - 1)) / gridCountU
        const cellExtentV = (extentV - marginV * (gridCountV - 1)) / gridCountV

        return { marginU, marginV, cellExtentU, cellExtentV, originOffsetU, originOffsetV, cornerOffsetU, cornerOffsetV }
      }
    }[resizeMode]()

    if (dryRun) {
      return
    }


    // apply layout
    childObjects.forEach((child, i) => {
      const indexU = i % gridCountU
      const indexV = Math.floor(i / gridCountU)
      const u = originOffsetU / 2 + (indexU - (gridCountU / 2 - .5)) * (cellExtentU + marginU)
      const v = originOffsetV / 2 + (indexV - (gridCountV / 2 - .5)) * (cellExtentV + marginV)
      const w = (globalW + (childExtentW ?? getGeometryParameter(child, 'w')) / 2)
      const [x, y, z] = [u, w, v]
      child.position.set(x, y, z)

      if (resizeMode === 'spaceFill') {
        child.entity?.adoptSize(cellExtentU, cellExtentV)
      }

      if (side === 'top') return
      const dir = child.position.clone()
      child.translateX(-dir.x)
      child.translateY(-dir.y)
      child.translateZ(-dir.z)
      rotate(child, dir)
      child.translateX(dir.x)
      child.translateY(dir.y)
      child.translateZ(dir.z)
    })

    if (resizeMode === 'shrinkWrap') {
      this.adoptSize(
        cellExtentU * gridCountU + marginU * (gridCountU - 1) + originOffsetU + cornerOffsetU,
        cellExtentV * gridCountV + marginV * (gridCountV - 1) + originOffsetV + cornerOffsetV
      )
    }


    function getGeometryKey(dimension) {
      return ['width', 'depth', 'height'][
        'uvw'.indexOf(dimension)
      ]
    }
    function getGeometryParameter(object3d, dimension) {
      return object3d.geometry.parameters[getGeometryKey(dimension)]
    }

    /** Rotate arguments around the geometry of the receiver, scaling them as necessary. Arguments are assumed to be in the receiver's top side. */
    function rotate(object3d, vector) {
      // First step: rotate around x axis
      object3d?.rotateX(Math.PI * (
        { top: 0, bottom: 1 }[side] ?? .5
      ))
      if (side === 'top' || side === 'bottom') {
        return
      }

      const baseGeometry = baseObject3d.geometry

      // Scale top -> front
      const xRatio = baseGeometry.parameters.height / baseGeometry.parameters.depth
      vector.y /= xRatio
      vector.z *= xRatio
      if (object3d != null) {
        object3d.geometry = BoxGeometryExtension.copyWith(object3d.geometry, object3d.geometry.parameters.width, object3d.geometry.parameters.height, object3d.geometry.parameters.depth * xRatio)

        // Second step: rotate around z axis
        object3d.rotateZ(Math.PI * (
          { back: 1, right: .5, left: -.5 }[side] ?? 0
        ))
      }
      if (!(side === 'left' || side === 'right')) {
        return
      }

      // Scale front -> left/right
      const zRatio = baseGeometry.parameters.depth / baseGeometry.parameters.width
      vector.x *= zRatio
      vector.y /= zRatio
      if (object3d != null) {
        object3d.geometry = BoxGeometryExtension.copyWith(object3d.geometry, object3d.geometry.parameters.width * zRatio, object3d.geometry.parameters.height, object3d.geometry.parameters.depth)
      }
    }
  }

  layoutChildrenOnGridQuery(query, options = {}) {
    return this.layoutChildrenOnGrid({
      query,
      dryRun: true,
      ...options
    })
  }

  layoutFDG(traceMap, computeForces, options = {}) {
    const centripetalForce = 0.001
    const individualForceWeight = 0.1
    const collisionIterations = 10

    const d3Nodes = this.children.map((child, index) => {
      return child.d3Node = {
        index,
        entity: child,
        x: child.object3d.position.x,
        y: child.object3d.position.z,
        radius: new THREE.Box3().setFromObject(child.object3d).getSize(new THREE.Vector3()).setY(0).length() / 2
      }
    })

    const forces = []
    computeForces(this.children, (source, target, strength) => {
      forces.push({
        source: source.d3Node,
        target: target.d3Node,
        strength: strength * individualForceWeight
      })
    })


    // first layout pass: no collision yet
    this.simulation = d3.forceSimulation(d3Nodes)
    this.simulation
      // strive to center
      .force('x', d3.forceX().strength(centripetalForce))
      .force('y', d3.forceY().strength(centripetalForce))

      // individual forces
      .force('link', d3.forceLink(forces)
        .id(d3Node => d3Node.index)
        .strength(force => force.strength))

      // repulsion
      .force('charge', d3.forceManyBody().strength(-.2))

    this.simulation
      .alpha(1)
      .alphaDecay(0)
      //.tick(ticks[0])

    // second pass: fix collisions
    this.simulation
      .force('collide', d3.forceCollide()
        .strength(1)
        .radius(d3Node => d3Node.radius)
        .iterations(collisionIterations))
    this.simulation
      .alpha(1)
      .alphaDecay(0.0001)
      //.tick(1000)
      .on('tick', () => {
        // Is this a beautiful control flow? Probably not. Is JavaScript a beautiful language? Absolutely not.

        // Accelerate simulation.
        // Con: Dropped nodes move too fast. TODO: reset ticks after dropping?
        // TODO: dynamic speed to maintain enough FPS. might not need animation at all for small traces.
        this.simulation.tick(100)

        const y = this.height / 2
        this.children.forEach(child => {
          child.moveTo(child.d3Node.x, y + child.object3d.geometry.parameters.height / 2, child.d3Node.y)
        })

        /** Dispatch event without capturing/bubbling */
        function processEvent(domElement, event) {
          const dummy = document.createElement('div')
          // WORKAROUND: Must not unhang three.js container
          //domElement.replaceWith(dummy)
          event.isT4dSimulated = true
          try {
            domElement.dispatchEvent(event)
          } finally {
            //dummy.replaceWith(domElement)
            delete event.isT4dSimulated
          }
        }

        // Update DragControls to override forced position of dragged node
        // HACKED: simulate drag (onpointermove) if currently dragging
        if (traceMap.lastMouseMoveEvent != null) {
          Promise.resolve().then(() => {
            // TODO: updateCursor() is reached but cursor is not updated
            processEvent(traceMap.renderer.domElement, traceMap.lastMouseMoveEvent)
          })
        }
        if (traceMap.lastPointerMoveEvent != null) {
          Promise.resolve().then(() => {
            processEvent(traceMap.renderer.domElement, traceMap.lastPointerMoveEvent)
          })
        }

        // update size
        const offset = options.offset ?? 20
        const width = Math.max(collect(d3Nodes).map(d3Node => d3Node.x).max(), -collect(d3Nodes).map(d3Node => d3Node.x).min()) * 2
        const depth = Math.max(collect(d3Nodes).map(d3Node => d3Node.y).max(), -collect(d3Nodes).map(d3Node => d3Node.y).min()) * 2
        this.adoptSize(width + offset, depth + offset)

        traceMap.updateScene()
      })
      .restart()


    // center nodes
    const dx = (collect(d3Nodes).map(d3Node => d3Node.x).min() + collect(d3Nodes).map(d3Node => d3Node.x).max()) / 2
    const dy = (collect(d3Nodes).map(d3Node => d3Node.y).min() + collect(d3Nodes).map(d3Node => d3Node.y).max()) / 2
    d3Nodes.forEach(d3Node => {
      d3Node.x -= dx
      d3Node.y -= dy
    })

    // apply positions
    this.children.forEach(child => {
      child.moveTo(child.d3Node.x, child.object3d.geometry.parameters.height, child.d3Node.y)
    })

    const size = new THREE.Box3().setFromObject(this.object3d).getSize(new THREE.Vector3())
    const margin = 10
    this.adoptSize(size.x + margin, size.z + margin)
  }
  //#endregion

  //#region interaction
  onChildStartDrag() {
    if (!this.simulation) return

    // reheat
    this.simulation.alpha(1)
    this.simulation.restart()
  }

  moved() {
    super.moved()

    this.children.forEach(child => {
      child.moved()
    })
  }
  //#endregion
}

export 