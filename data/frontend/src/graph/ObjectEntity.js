
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

export 