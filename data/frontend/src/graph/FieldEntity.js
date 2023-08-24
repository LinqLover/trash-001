
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