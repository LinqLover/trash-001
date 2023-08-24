
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

export 