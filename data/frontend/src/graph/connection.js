
  parent = null
  focusStates = []
  connections = []
  hoveredEntities = []

  //#region accessors
  get object3d() {
    return this.cuboid
  }

  get path() {
    return (this.parent?.path ?? []).concat([this])
  }

  get root() {
    return this.parent?.root ?? this
  }

  get width() {
    return this.object3d.geometry.parameters.width
  }

  get depth() {
    return this.object3d.geometry.parameters.depth
  }

  get height() {
    return this.object3d.geometry.parameters.height
  }

  get description() {
    return `${this.name}`
  }

  sortAllChildren() {
    // do nothing
  }

  allEntities(predicate = null) {
    return predicate == null || predicate(this)
      ? [this]
      : []
  }

  allObjectEntities() {
    return this.allEntities(entity => entity instanceof ObjectEntity)
  }
  //#endregion

  //#region building
  build(traceMap, options = {}) {
    this.buildObject3d(traceMap, options)
    this.cuboid.entity = this

    if (!(options.deferLabels ?? false)) {
      this.buildAllLabels()
    }

    if (this.wantsDrag()) {
      traceMap.registerDraggable(this.cuboid)
    }
    return this.cuboid
  }

  buildAllLabels() {
    this.buildLabel()
    this.updateDisplayState()
  }

  buildObject3d(traceMap, options = {}) {
    const cuboidGeometry = this.buildCuboidGeometry(traceMap)
    this.cuboid = new THREE.Mesh(cuboidGeometry)
    this.cuboid.castShadow = true
    this.cuboid.receiveShadow = true

    this.baseMaterial = new THREE.MeshStandardMaterial({
      roughness: 0.75,
      metalness: 0,
      flatShading: true,
      transparent: true
    })
    this.topMaterial = new THREE.MeshStandardMaterial({
      roughness: 0.75,
      metalness: 0,
      flatShading: true,
      transparent: true
    })
    this.sideMaterial = new THREE.MeshStandardMaterial({
      roughness: 0.75,
      metalness: 0,
      flatShading: true,
      transparent: true
    })
    this.cuboid.material = [this.baseMaterial, this.topMaterial, this.sideMaterial]

    cuboidGeometry.clearGroups()
    cuboidGeometry.addGroup(0, Infinity, 0)  // base (global)
    cuboidGeometry.addGroup(0, 6, 2)  // side 1 (right)
    cuboidGeometry.addGroup(6, 6, 2)  // side 2 (left)
    cuboidGeometry.addGroup(12, 6, 1)  // top
    cuboidGeometry.addGroup(24, 6, 2)  // side 3 (front)
    cuboidGeometry.addGroup(30, 6, 2)  // side 4 (back)
  }

  buildCuboidGeometry(traceMap) {
    return new THREE.BoxGeometry(30, 30, 10)
  }

  buildLabel() {
    // TODO: could truncate with knowledge of concrete text width
    const maxTextLength = 24
    const text = this.name?.length > maxTextLength
      ? this.name?.substring(0, maxTextLength - 1) + '…'
      : this.name

    this.topMaterial.map = this.buildLabelTexture(text, {
      allSides: true,
      align: 'center'
    })
    this.topMaterial.needsUpdate = true
    this.sideMaterial.map = this.buildLabelTexture(text, {
      allSides: false,
      align: 'center',
      ratioOrientation: 'side'
    })
    this.sideMaterial.needsUpdate = true
  }

  buildLabelTexture(text, options = {}) {
    const resolution = options.resolution ?? 128 /* 32 */
    const ratioOrientation = options.ratioOrientation ?? 'top'
    const ratio = ratioOrientation === 'top'
      ? this.object3d.geometry.parameters.width / this.object3d.geometry.parameters.depth
      : this.object3d.geometry.parameters.width / this.object3d.geometry.parameters.height
    const dynamicWidth = resolution * ratio
    const dynamicHeight = resolution

    const canvas = document.createElement('canvas')
    canvas.width = dynamicWidth * 2
    canvas.height = dynamicHeight * 2
    const context = canvas.getContext('2d')

    const color = options.color ?? 'transparent'
    context.fillStyle = typeof color === 'number'
      ? `#${color.toString(16).padStart(6, '0')}`
      : color
    context.fillRect(0, 0, canvas.width, canvas.height)

    if (text) {
      const textColor = options.textColor ?? '#000000'
      const fontScale = options.fontScale ?? 1
      const allSides = options.allSides ?? false
      const align = options.align ?? 'left'
      const margin = options.margin ?? 0

      context.fillStyle = textColor
      const fontSize = 360 * fontScale * resolution / 1024 // TODO: do not hardcode
      context.font = `bolder ${fontSize}px Comic Sans MS`
      const textWidth = context.measureText(text).width

      let offsetY = canvas.height * margin
      offsetY += .75 * fontSize
      let offsetX = canvas.width * margin
      if (allSides) {
        offsetX = offsetY
      }
      let maxUsableWidth = canvas.width
      maxUsableWidth -= offsetX * 2
      let maxUsableHeight = canvas.height
      maxUsableHeight -= offsetY * 2
      const actualTextWidth = Math.min(textWidth, maxUsableWidth)
      const actualTextHeight = Math.min(textWidth, maxUsableHeight)
      context.translate(offsetX, 0)

      const maxSideIndex = allSides ? 4 : 1
      for (let i = 0; i < maxSideIndex; i++) {
        const vertical = i % 2
        const x = align === 'center'
          ? ((!vertical ? maxUsableWidth : maxUsableHeight) - (!vertical ? actualTextWidth : actualTextHeight)) / 2
          : (!vertical ? offsetX : offsetY)
        context.fillText(text, x, offsetY, !vertical ? maxUsableWidth : maxUsableHeight)
        if (vertical) {
          context.translate(dynamicHeight * 2 - offsetX, offsetY)
        } else {
          context.translate(dynamicWidth * 2 - offsetY, offsetX)
        }
        context.rotate(Math.PI / 2)
      }
    }

    const texture = new THREE.CanvasTexture(canvas)
    texture.needsUpdate = true
    return texture
  }

  addConnection(fieldName, otherEntity, strength) {
    let fieldEntities = this.children.filter(child => child.name === fieldName)
    if (!fieldEntities.length) fieldEntities = this
    return this.parent.addChildConnection(fieldEntities, otherEntity, strength)
  }

  moveTo(x, y, z) {
    this.object3d.position.set(x, y, z)

    this.moved()
  }
  //#endregion

  //#region dynamic state
  setFocusState(state, bool = true) {
    if (!bool) return this.unsetFocusState(state)

    if (this.focusStates.includes(state)) return
    this.focusStates.push(state)
    this.updateDisplayState()
  }

  unsetFocusState(state) {
    if (!this.focusStates.includes(state)) return
    this.focusStates.splice(this.focusStates.indexOf(state), 1)
    this.updateDisplayState()
  }

  setGlowState(state, fraction = 1) {
    if (!fraction) return this.unsetGlowState(state)

    if (this.glowFractions?.[state] === fraction) return

    this.glowFractions ??= {}
    this.glowFractions[state] = fraction
    this.updateDisplayState()
  }

  unsetGlowState(state) {
    if (!this.glowFractions?.[state]) return

    delete this.glowFractions?.[state]
    this.updateDisplayState()
  }

  getGlowFraction(state) {
    return this.glowFractions?.[state] ?? 0
  }

  updateDisplayState() {
    if (this.baseMaterial) {
      let color = this.constructor.colors[
        collect(['drag', 'hover']).intersect(this.focusStates).first() ?? 'default'
      ]
      let color3d = null

      if (this.glowFractions) {
        collect(this.glowFractions).each((fraction, state) => {
          let glowColor = this.constructor.glowColors[state]
          if (!glowColor) return

          if (!color) color = color3d.getHSL()
          else if (!color3d) color3d = new THREE.Color().setHSL(color.h, color.s, color.l)
          glowColor = {...color, ...glowColor}
          let lerpColor = new THREE.Color().setHSL(glowColor.h, glowColor.s, glowColor.l)
          //color3d = lerpColor.lerpHSL(color3d, 1 - fraction)
          color3d = lerpColor.lerp(color3d, 1 - fraction) // for our current set of colors, this looks better
          color = null
        })
      }
      if (!color3d) color3d = new THREE.Color().setHSL(color.h, color.s, color.l)
      this.baseMaterial.color = color3d
      this.baseMaterial.needsUpdate = true
    }

    this.connections.forEach(connection => {
      connection.setFocusState('hoverEntity', this.focusStates.includes('hover') || this.focusStates.includes('drag'))
    })
  }

  addHoveredEntity(entity) {
    this.hoveredEntities.push(entity)

    if (this.hoveredEntities.length) {
      this.setFocusState('hover')
    }
  }

  removeHoveredEntity(entity) {
    const index = this.hoveredEntities.indexOf(entity)
    if (index === -1) return
    this.hoveredEntities.splice(index, 1)

    if (!this.hoveredEntities.length) {
      this.unsetFocusState('hover')
    }
  }
  //#endregion

  //#region interaction
  wantsClick(event) {
    return true
  }

  wantsDrag(event) {
    return true
  }

  onHoverStart(event) {
    this.addHoveredEntity(this)
  }

  onHoverEnd(event) {
    this.removeHoveredEntity(this)
  }

  onClick(event) {
    window.selectedEntity = this
    console.log(this.object ?? this.organization ?? this)

    alert(this.description)
  }

  onDragStart(event) {
    this.object3d.positionBeforeDrag = this.object3d.position.clone()
  }

  onDragEnd(event) {
    this.unsetFocusState('drag')
    delete this.object3d.positionBeforeDrag
  }

  onDrag(event) {
    {
      // actual drag start
      this.setFocusState('drag')
      this.root.onChildStartDrag?.(this)
    }

    if (!this.constrainDrag(event)) return

    this.moved()

    if (this.d3Node) {
      this.d3Node.x = /* this.d3Node.fx = */ this.object3d.position.x
      this.d3Node.y = /* this.d3Node.fy = */ this.object3d.position.z
    }
  }

  constrainDrag(event) {
    if (!this.wantsDrag(event)) {
      this.object3d.position.copy(this.object3d.positionBeforeDrag)
      return false
    }

    if (!this.object3d.positionBeforeDrag) {
      console.warn('no positionBeforeDrag', this)
      return false
    }

    this.object3d.position.y = this.object3d.positionBeforeDrag.y

    const otherObjects = event.target.getObjects().filter(draggable => draggable !== event.object)
    const threshold = 0.1 // avoid sticking to parent
    const thisBox = Box3Extension.setFromObject(null, this.object3d, false).expandByScalar(-threshold)
    const hasCollision = otherObjects.some(otherObject => {
      const otherBox = Box3Extension.setFromObject(null, otherObject, false).expandByScalar(-threshold)
      return thisBox.intersectsBox(otherBox)
    })

    if (hasCollision) {
      this.object3d.position.copy(this.object3d.positionBeforeDrag)
      // TODO: move as close as possible to the other object
      return false
    }

    // constrain to parent
    const absWidth = (this.parent.width - this.width) / 2
    const absDepth = (this.parent.depth - this.depth) / 2
    this.object3d.position.x = Math.max(-absWidth, Math.min(absWidth, this.object3d.position.x))
    this.object3d.position.z = Math.max(-absDepth, Math.min(absDepth, this.object3d.position.z))

    this.object3d.positionBeforeDrag = this.object3d.position.clone()
    return true
  }

  moved() {
    this.connections.forEach(connection => {
      connection.updatePosition()
    })
  }
  //#endregion
}

export class OrganizationEntity extends Entity {
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

export class TraceEntity extends OrganizationEntity {
  static planeMaterial = new THREE.MeshStandardMaterial({
    color: 0x777777
  })

  constructor(trace) {
    super(trace)
  }

  //#region accessors
  get object3d() {
    return this.plane
  }

  get depth() {
    return this.plane.geometry.parameters.height // because of rotation
  }
  //#endregion

  //#region building
  build(traceMap, options = {}) {
    const planeGeometry = new THREE.PlaneGeometry(100, 100)
    planeGeometry.rotateX(-Math.PI / 2)
    this.plane = new THREE.Mesh(planeGeometry, this.constructor.planeMaterial)
    this.plane.entity = this
    this.plane.receiveShadow = true

    this.buildChildren(traceMap, { deferLabels: true, ...options })
    this.layoutChildren()

    if (!(options.deferLabels ?? false)) {
      this.buildAllLabels()
    }

    this.buildChildConnections(traceMap)

    return this.plane
  }

  buildLabel() {
    // No label.
  }
  //#endregion

  //#region layout
  get height() {
    return 0
  }

  adoptSize(width, depth) {
    this.plane.geometry = new THREE.PlaneGeometry(width, depth).rotateX(-Math.PI / 2)
  }
  //#endregion

  //#region dynamic state
  updateDisplayState() {
    // No dynamic display state.
  }

  //#region interaction
  wantsClick(event) {
    return false
  }

  wantsDrag(event) {
    return false
  }

  onHoverStart(event) {
    // do nothing
  }

  onHoverEnd(event) {
    // do nothing
  }
  //#endregion
}

export class PackageEntity extends OrganizationEntity {
  static colors = {
    default: { h: 0, s: 1, l: 0.13 },
    hover: { h: 0, s: 1, l: 0.16 },
    drag: { h: 0, s: 1, l: 0.19 }
  }

  constructor($package) {
    super($package)
  }
}

export class ClassCategoryEntity extends OrganizationEntity {
  static colors = {
    default: { h: 0.083, s: 1, l: 0.13 },
    hover: { h: 0.083, s: 1, l: 0.16 },
    drag: { h: 0.083, s: 1, l: 0.19 }
  }

  constructor(category) {
    super(category)
  }
}

export class ClassEntity extends OrganizationEntity {
  static colors = {
    default: { h: 0.167, s: 1, l: 0.13 },
    hover: { h: 0.167, s: 1, l: 0.16 },
    drag: { h: 0.167, s: 1, l: 0.19 }
  }

  constructor($class) {
    super($class)
  }
}

export class ObjectEntity extends OrganizationEntity {
  static colors = {
    default: { h: 0.333, s: 1, l: 0.13 },
    hover: { h: 0.333, s: 1, l: 0.16 },
    drag: { h: 0.333, s: 1, l: 0.19 }
  }
  static glowColors = {
    active: { h: 0 }
  }

  static headerHeight = 3.5
  static fieldHeight = 3
  static gridLayoutOptions = {
    resizeMode: 'spaceFill',
    groupBy: 'side',
    groupExtract: 'side',
    margin: {
      absolute: 0
    },
    offset: {
      top: this.headerHeight
    },
    idealCellRatio: 2
  }

  constructor(object) {
    super(object)
  }

  //#region accessors
  get object() {
    return this.organization
  }

  get description() {
    let description = super.description
    if (this.object) {
      description += `\n${this.object.class.category.name}`
      if (this.object.fields) {
        description += `\n`
        description += `\n${collect(this.object.fields).map((value, name) => `${name}: ${TraceObject.valueToString(value)}`).join('\n')}`
      }
    }
    return description
  }

  get height() {
    function soleOrDefault(collection, $default = null) {
      if (collection.isEmpty()) {
        return $default
      }
      if (collection.count() !== 1) {
        throw new Error('collection does not contain exactly one element')
      }
      return collection.first()
    }

    const numberOfRows = soleOrDefault(collect(this.layoutChildrenOnGridQuery(
      'gridCountV',
      {
        childObjects: collect(this.object.fields).keys().all(),
        ...this.constructor.gridLayoutOptions
      }
    )).values().unique(), 0)

    return this.constructor.headerHeight + this.constructor.fieldHeight * numberOfRows
  }
  //#endregion

  //#region building
  buildCuboidGeometry(traceMap) {
    return new THREE.BoxGeometry(10, this.height, 10)
  }

  addConnection(fieldName, otherEntity, strength) {
    const connection = super.addConnection(fieldName, otherEntity, strength)
    if (connection.source === this) {
      connection.sourceAbsoluteY = this.constructor.headerHeight / 2
    }
    connection.targetAbsoluteY = this.constructor.headerHeight / 2
    return connection
  }
  //#endregion

  //#region layout
  layoutChildren() {
    this.layoutChildrenOnGrid(this.constructor.gridLayoutOptions)
  }
  //#endregion
}

export class FieldEntity extends Entity {
  static colors = {
    default: { h: 0, s: 0, l: 0.25 },
    hover: { h: 0, s: 0, l: 0.5 },
    drag: { h: 0, s: 0, l: 0.75 }
  }

  static opacity = 0.5

  static sideMaterials = undefined

  constructor(name, value) {
    super()
    this.name = name
    this.value = value
  }

  /** A twin entity that holds all shared resources. If this is not null, the receiver will only work as a shallow copy of the primary with regard to these resources. Memory optimization. */
  primary = null
  /** Twin entities that have a common display state. */
  twins = []

  //#region accessors
  get description() {
    return `${this.name}: ${TraceObject.valueToString(this.value)}`
  }
  //#endregion

  //#region building
  buildObject3d(traceMap, options = {}) {
    const cuboidGeometry = new THREE.BoxGeometry(10, .1, 2.5)
    this.cuboid = new THREE.Mesh(cuboidGeometry)

    if (this.primary) {
      this.cuboid.material = this.primary.cuboid.material
    } else {
      if (!(options.deferLabels ?? false)) {
        this.buildAllLabels()
      }

      this.baseMaterial = new THREE.MeshStandardMaterial({
        roughness: 0.75,
        metalness: 0,
        flatShading: true,
        transparent: true,
        opacity: this.constructor.opacity
      })
      this.topMaterial = new THREE.MeshStandardMaterial({
        roughness: 0.75,
        metalness: 0,
        flatShading: true,
        transparent: true
      })
      if (this.constructor.sideMaterial === undefined) {
        this.constructor.sideMaterial = new THREE.MeshStandardMaterial({
          roughness: 0.75,
          metalness: 0,
          flatShading: true,
          transparent: true
        })
        const texture = this.buildLabelTexture(null)
        this.constructor.sideMaterial.map = texture
        this.constructor.sideMaterial.needsUpdate = true
      }

      this.cuboid.material = [this.baseMaterial, this.topMaterial, this.constructor.sideMaterial]
    }

    cuboidGeometry.clearGroups()
    cuboidGeometry.addGroup(0, Infinity, 0)  // base (global)
    cuboidGeometry.addGroup(0, 6, 2)  // side 1 (right)
    cuboidGeometry.addGroup(6, 6, 2)  // side 2 (left)
    cuboidGeometry.addGroup(12, 6, 1)  // top
    cuboidGeometry.addGroup(24, 6, 2)  // side 3 (front)
    cuboidGeometry.addGroup(30, 6, 2)  // side 4 (back)

    this.cuboid.castShadow = true
    this.cuboid.receiveShadow = true
  }

  buildLabel() {
    if (this.primary) return

    const maxTextLength = 24
    const fullText = `${this.name}: ${TraceObject.valueToString(this.value)}`
    const text = fullText.length > maxTextLength
      ? fullText.substring(0, maxTextLength - 1) + '…'
      : fullText

    this.topMaterial.map = this.buildLabelTexture(text, {
      align: 'left',
      fontScale: 2.5,
      margin: 0.01,
      ratioOrientation: 'top'
    })
    this.topMaterial.needsUpdate = true
  }
  //#endregion

  //#region layout
  adoptSize(width, depth) {
    this.cuboid.geometry = BoxGeometryExtension.copyWith(this.cuboid.geometry, width, this.height, depth)
  }
  //#endregion

  //#region dynamic state
  setFocusState(state, bool) {
    if (!this.primary) return super.setFocusState(state, bool)
    return this.primary.setFocusState(state, bool)
  }

  unsetFocusState(state) {
    if (!this.primary) return super.unsetFocusState(state)
    return this.primary.unsetFocusState(state)
  }

  setGlowState(state, bool) {
    if (!this.primary) return super.setGlowState(state, bool)
    return this.primary.setGlowState(state, bool)
  }

  unsetGlowState(state) {
    if (!this.primary) return super.unsetGlowState(state)
    return this.primary.unsetGlowState(state)
  }

  getGlowFraction(state) {
    if (!this.primary) return super.getGlowFraction(state)
    return this.primary.getGlowFraction(state)
  }
  //#endregion

  //#region interaction
  wantsDrag(event) {
    return false
  }

  onHoverStart(event) {
    super.onHoverStart(event)

    this.parent?.addHoveredEntity(this)
    this.twins.forEach(twin => twin.addHoveredEntity(twin))
  }

  onHoverEnd(event) {
    super.onHoverEnd(event)

    this.parent?.removeHoveredEntity(this)
    this.twins.forEach(twin => twin.removeHoveredEntity(twin))
  }
  //#endregion
}

export 