
  focusStates = []

  static color = 0xbbbbbb
  static opacity = .5
  static hoverOpacity = 1

  constructor(source, target, strength) {
    this.source = source
    this.target = target
    this.strength = strength
  }

  //#region building
  build() {
    const anySource = Array.isArray(this.source) ? this.source[0] : this.source
    const lineGeometry = new THREE.BufferGeometry().setFromPoints([
      anySource.object3d.position,
      this.target.object3d.position
    ])

    const lineMaterial = new THREE.LineBasicMaterial({
      transparent: true,
      linewidth: this.strength
    })
    this.line = new THREE.Line(lineGeometry, lineMaterial)
    this.line.castShadow = true
    this.line.receiveShadow = true

    const coneGeometry = new THREE.ConeGeometry(this.strength, 2)
    //coneGeometry.radialSegments = 4
    coneGeometry.rotateX(Math.PI / 2);
    const coneMaterial = new THREE.MeshBasicMaterial({
      transparent: true,
      color: this.constructor.color
    })

    this.chevronCones = []
    const maxChevronCount = 10
    for (let i = 0; i < maxChevronCount; i++) {
      const cone = new THREE.Mesh(
        coneGeometry,
        coneMaterial
      )
      // FOR LATER: make shadow transparent (https://github.com/mrdoob/three.js/issues/10600)
      cone.castShadow = true
      cone.receiveShadow = true
      this.chevronCones.push(cone)
      this.line.add(cone)
    }

    this.updateDisplayState()
    this.updatePosition()

    return this.line
  }

  updatePosition() {
    const closestSource = Array.isArray(this.source)
      ? // find closest source to target
        collect(this.source).sortBy(source => {
          const sourcePosition = this.line.worldToLocal(source.object3d.getWorldPosition(new THREE.Vector3()))
          return sourcePosition.distanceTo(this.target.object3d.position)
        }).first()
      : this.source
    let sourcePosition = this.line.worldToLocal(closestSource.object3d.getWorldPosition(new THREE.Vector3()))
    if (this.sourceAbsoluteY != null) {
      sourcePosition.y = this.sourceAbsoluteY
    }
    let targetPosition = this.target.object3d.position
    if (this.targetAbsoluteY != null) {
      targetPosition = targetPosition.clone()
      targetPosition.y = this.targetAbsoluteY
    }

    const lineGeometry = this.line.geometry
    lineGeometry.attributes.position.array[0] = sourcePosition.x
    lineGeometry.attributes.position.array[1] = sourcePosition.y
    lineGeometry.attributes.position.array[2] = sourcePosition.z
    lineGeometry.attributes.position.array[3] = targetPosition.x
    lineGeometry.attributes.position.array[4] = targetPosition.y
    lineGeometry.attributes.position.array[5] = targetPosition.z
    lineGeometry.attributes.position.needsUpdate = true

    const length = targetPosition.distanceTo(sourcePosition)
    const dynamicChevronCount = Math.min(length / 8, this.chevronCones.length)
    this.chevronCones.forEach((cone, i) => {
      cone.visible = i < dynamicChevronCount
      if (!cone.visible) return
      cone.position.copy(sourcePosition)
      cone.position.lerp(targetPosition, (i + 1) / (dynamicChevronCount + 1))
      cone.lookAt(targetPosition)
    })
  }
  //#endregion

  //#region dynamic state
  setFocusState(state, bool) {
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

  updateDisplayState() {
    if (this.focusStates.includes('hoverEntity')) {
      this.line.material.opacity = this.constructor.hoverOpacity
      this.chevronCones.forEach(head => head.material.opacity = this.constructor.hoverOpacity)
    } else {
      this.line.material.opacity = this.constructor.opacity
      this.chevronCones.forEach(head => head.material.opacity = this.constructor.opacity)
    }
  }
  //#endregion
}
