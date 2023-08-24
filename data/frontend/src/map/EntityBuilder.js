
  static forStyle(style = undefined) {
    if (style == undefined) return this.forStyle('flatFDG')

    switch (style) {
      case 'hierarchical': return HierarchicalEntityBuilder
      case 'flatFDG': return FlatFDGEntityBuilder
    }
    throw new Error(`Unknown style: ${style}`)
  }

  static newForStyle(style, trace = undefined) {
    return new (this.forStyle(style))(trace)
  }

  constructor(trace) {
    this.trace = trace
  }

  buildAllFieldEntities(object, parentEntity) {
    let fields = collect(object.fields)
    const maxFields = 20
    fields = fields.take(maxFields)
    return fields.map((field, name) => {
      return this.buildFieldEntities(name, field, parentEntity)
    })
  }

  buildFieldEntities(name, field, parentEntity) {
    let primary = null
    const fieldEntities = ['front', 'left', 'back', 'right'].map(direction => {
      const fieldEntity = new FieldEntity(name, field)
      fieldEntity.side = direction
      if (primary === null) {
        primary = fieldEntity
      } else {
        fieldEntity.primary = primary
      }
      parentEntity.addChild(fieldEntity)
      return fieldEntity
    })
    fieldEntities.forEach(fieldEntity => {
      fieldEntity.twins = fieldEntities.filter(otherFieldEntity => otherFieldEntity !== fieldEntity)
    })
    return fieldEntities
  }
}

export 