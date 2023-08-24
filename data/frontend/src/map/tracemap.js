
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

export class HierarchicalEntityBuilder extends EntityBuilder {
  allFieldEntities = new Map()
  objectEntities = new Map()
  classEntities = new Map()
  classCategoryEntities = new Map()
  packageEntities = new Map()
  traceEntity = null

  build(traceMap) {
    collect(this.trace.classes).each($class => {
      this.getClassEntity($class)
    })
    collect(this.trace.objects).each(object => {
      this.getObjectEntity(object)

      const maxFields = 20
      collect(object.fields).take(maxFields).each((field, name) => {
        this.getFieldEntities(name, field, object)
      })
    })

    const traceEntity = this.getTraceEntity()
    traceEntity.sortAllChildren()
    return traceEntity.build(traceMap)
  }

  getFieldEntities(name, field, object) {
    let fieldEntities = this.allFieldEntities.get(field)
    if (fieldEntities) return fieldEntities

    const objectEntity = this.getObjectEntity(object)
    this.buildFieldEntities(name, field, objectEntity)
    this.allFieldEntities.set(field, fieldEntities)
    return fieldEntities
  }

  getObjectEntity(object) {
    let objectEntity = this.objectEntities.get(object)
    if (objectEntity) return objectEntity

    objectEntity = new ObjectEntity(object)
    this.getClassEntity(object.class).addChild(objectEntity)
    this.objectEntities.set(object, objectEntity)
    return objectEntity
  }

  getClassEntity($class) {
    let classEntity = this.classEntities.get($class)
    if (classEntity) return classEntity

    classEntity = new ClassEntity($class)
    this.getClassCategoryEntity($class.category).addChild(classEntity)
    this.classEntities.set($class, classEntity)
    return classEntity
  }

  getClassCategoryEntity(category) {
    let classCategoryEntity = this.classCategoryEntities.get(category)
    if (classCategoryEntity) return classCategoryEntity

    classCategoryEntity = new ClassCategoryEntity(category)
    this.getPackageEntity(category.package).addChild(classCategoryEntity)
    this.classCategoryEntities.set(category, classCategoryEntity)
    return classCategoryEntity
  }

  getPackageEntity($package) {
    let packageEntity = this.packageEntities.get($package)
    if (packageEntity) return packageEntity

    packageEntity = new PackageEntity($package)
    this.getTraceEntity().addChild(packageEntity)
    this.packageEntities.set($package, packageEntity)
    return packageEntity
  }

  getTraceEntity() {
    if (this.traceEntity) return this.traceEntity

    this.traceEntity = new TraceEntity(this.trace)
    return this.traceEntity
  }
}

export class FlatFDGEntityBuilder extends EntityBuilder {
  excludedObjectNames = []
  excludedClassNames = [
    'Boolean', 'True', 'False',
    'UndefinedObject',
    'SmallInteger', 'LargePositiveInteger', 'LargeNegativeInteger', 'SmallFloat64',
    'FullBlockClosure', 'CompiledBlock', 'CompiledMethod', 'CompiledMethodTrailer',
    'Association',
    'Array', 'OrderedCollection',
    'Point', 'Rectangle'
  ]
  excludeClasses = true
  /** all values may be a factor, a function, or undefined */
  forceWeights = {
	  'references': 1,
	  'organization': {
      /** will be applied to all organization forces */
      'force': .005,
      'sameClass': 2,
      'sameHierarchy': 1,
      'sameCategory': .01,
      'samePackage': .001
	  },
	  'communication': 0.0001
	}

  build(traceMap) {
    const objectEntities = this.trace.objects
      .filter(object => this.shouldShowObject(object))
      .map(object => this.buildObjectEntity(object))
    const traceEntity = new TraceEntity(this.trace)
    objectEntities.forEach(objectEntity => traceEntity.addChild(objectEntity))
    traceEntity.sortAllChildren()
    this.addConnections(objectEntities)

    const plane = traceEntity.build(traceMap)

    traceEntity.layoutFDG(traceMap, this.computeForces.bind(this))

    return plane
  }

  shouldShowObject(object) {
    if (this.excludedClassNames.includes(object.class.name)) return false
    if (this.excludedObjectNames.includes(object.name)) return false
    if (this.excludeClasses && object.class.name.endsWith(' class')) return false

    return true
  }

  buildObjectEntity(object) {
    const entity = new ObjectEntity(object)
    this.buildAllFieldEntities(object, entity)
    return entity
  }

  addConnections(objectEntities) {
    objectEntities.forEach((objectEntity, index) => {
      objectEntities.forEach((otherObjectEntity, otherIndex) => {
        collect(objectEntity.object.fields).each((field, name) => {
          if (field === otherObjectEntity.object) {
            objectEntity.addConnection(name, otherObjectEntity, 1)
          }
        })
      })
    })
  }

  computeForces(objectEntities, addForce) {
    const force = (forceWeight, $default) => forceWeight === undefined
      ? force($default)
      : forceWeight instanceof Function
        ? (value) => forceWeight(value ?? 1)
        : (value) => (value ?? 1) * forceWeight

    // references
    if (this.forceWeights['references']) {
      const referenceForce = force(this.forceWeights['references'])
      objectEntities.forEach(objectEntity => {
        const object = objectEntity.object
        objectEntities.forEach(otherObjectEntity => {
          const otherObject = otherObjectEntity.object
          const referenceCount = collect(object.fields).filter(field => field === otherObject).count()
          if (referenceCount > 0) {
            addForce(objectEntity, otherObjectEntity, referenceForce(referenceCount))
          }
        })
      })
    }

    // organization
    if (this.forceWeights['organization']) {
      const organizationForce = force(this.forceWeights['organization']['force'], 1)
      const sameClassForce = force(this.forceWeights['organization']['sameClass'])
      const sameHierarchyForce = force(this.forceWeights['organization']['sameHierarchy'])
      const sameCategoryForce = force(this.forceWeights['organization']['sameCategory'])
      const samePackageForce = force(this.forceWeights['organization']['samePackage'])

      objectEntities.forEach(objectEntity => {
        const object = objectEntity.object
        objectEntities.forEach(otherObjectEntity => {
          const otherObject = otherObjectEntity.object
          let force = 0

          if (sameClassForce) {
            if (object.class === otherObject.class) {
              force += sameClassForce()
            }
          }

          if (sameCategoryForce) {
            if (object.class.category === otherObject.class.category) {
              force += sameCategoryForce()
            }
          }

          if (sameHierarchyForce) {
            if (object.class.category === otherObject.class.category) { // optimization
              // TODO HACK: regex-specific! implement common superclasses force instead.
              const isRegexAST = /^Rxs[A-Z]/.test(object.class.name)
              const otherIsRegexAST = /^Rxs[A-Z]/.test(otherObject.class.name)
              if (isRegexAST && otherIsRegexAST) {
                force += sameHierarchyForce()
              }

              const isRegexNFA = /^Rxm[A-Z]/.test(object.class.name)
              const otherIsRegexNFA = /^Rxm[A-Z]/.test(otherObject.class.name)
              if (isRegexNFA && otherIsRegexNFA) {
                force += sameHierarchyForce()
              }
            }
          }

          if (samePackageForce) {
            if (object.class.category.package === otherObject.class.category.package) {
              force += samePackageForce()
            }
          }

          if (force > 0) {
            addForce(objectEntity, otherObjectEntity, organizationForce(force))
          }
        })
      })
    }

    // communication
    if (this.forceWeights['communication']) {
      const communicationForce = force(this.forceWeights['communication'])
      const visitFrame = (frame) => {
        const senderEntity = objectEntities.find(objectEntity => objectEntity.object === frame.receiver)
        frame.children.forEach(childFrame => {
          const receiverEntity = objectEntities.find(objectEntity => objectEntity.object === childFrame.receiver)
          if (senderEntity != null && receiverEntity != null) {
            addForce(senderEntity, receiverEntity, communicationForce())
          }
          visitFrame(childFrame)
        })
      }
      visitFrame(this.trace.rootFrame)
    }
  }
}

export 