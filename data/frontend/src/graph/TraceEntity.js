
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

export 