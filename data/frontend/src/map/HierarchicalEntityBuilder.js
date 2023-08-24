
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

export 