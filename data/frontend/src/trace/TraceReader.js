
  constructor(traceData) {
    this.traceData = traceData
  }

  objects = {}
  classes = {}
  classCategories = {}
  packages = {}

  static readTrace(traceData) {
    return new this(traceData).getTrace()
  }

  static async readTraceFromLocalFile(localFile) {
    const fileReader = new FileReader()
    fileReader.readAsText(localFile)
    const result = await new Promise((resolve, reject) => {
      fileReader.onload = () => resolve(fileReader.result)
      fileReader.onerror = () => reject(fileReader.error)
    })
    const traceData = JSON.parse(result)
    return this.readTrace(traceData)
  }

  static async readTraceFromServerFile(serverFile) {
    const response = await fetch(serverFile)
    if (!response.ok) throw new Error(`Failed to load trace: ${response.status} ${response.statusText}`)
    const traceData = await response.json()
    return this.readTrace(traceData)
  }

  getTrace() {
    const objects = this.getObjects(this.traceData.objects)
    const classes = this.getClasses(this.traceData.classes)
    const rootFrame = this.getFrame(this.traceData.trace)
    return new Trace(objects, classes, rootFrame)
  }

  getObjects(objectDatas) {
    return collect(objectDatas).map((objectData, objectID) =>
      this.getObject(objectID, objectData)
    ).values().all()
  }

  getObject(objectID, objectData = undefined) {
    let object = this.objects[objectID]
    if (object == null) {
      object = new TraceObject()
      this.objects[objectID] = object
    }

    if (objectData === undefined) return object

    object.name = objectData.name
    object.class = this.getClass(objectData.class)
    object.fields = collect(objectData.fields).map((fieldData) =>
      this.getStringOrObject(fieldData)
    ).all()
    object.fieldHistories = this.getFieldHistories(objectData.historicFields)

    return object
  }

  getClass(className, classData = undefined) {
    let $class = this.classes[className]
    if ($class == null) {
      $class = new TraceClass()
      this.classes[className] = $class
    }

    if (classData === undefined) return $class

    $class.name = className
    $class.category = this.getClassCategory(classData.category, classData.package)

    return $class
  }

  getClassCategory(categoryName, packageName) {
    let category = this.classCategories[categoryName]
    if (category != null) return category

    const $package = this.getPackage(packageName)
    category = new TraceClassCategory(categoryName, $package)
    this.classCategories[categoryName] = category
    return category
  }

  getPackage(packageName) {
    let $package = this.packages[packageName]
    if ($package != null) return $package

    $package = new TracePackage(packageName)
    this.packages[packageName] = $package
    return $package
  }

  getClasses(classesData) {
    return collect(classesData).map((classData, className) =>
      this.getClass(className, classData)
    ).all()
  }

  getFieldHistories(fieldHistoryDatas) {
    return collect(fieldHistoryDatas).map((fieldHistoryData, fieldName) =>
      this.getFieldHistory(fieldHistoryData)
    ).all()
  }

  getFieldHistory(fieldHistoryData) {
    if (fieldHistoryData == null) return null

    const times = fieldHistoryData.times
    const values = fieldHistoryData.values.map(valueData => this.getStringOrObject(valueData))
    return new TraceFieldHistory(times, values)
  }

  getStringOrObject(stringOrID) {
    if (stringOrID[0] !== '@') {
      if (stringOrID[0] === '\\') {
        return stringOrID.substring(1)
      }
      return stringOrID
    }

    return this.getObject(stringOrID)
  }

  getFrame(frameData) {
    const receiver = this.getObject(frameData.receiver)
    const message = frameData.message
    const $arguments = frameData.arguments.map(argumentData => this.getStringOrObject(argumentData))
    const answer = frameData.answer != null ? this.getStringOrObject(frameData.answer) : null
    const startTime = frameData.startTime
    const endTime = frameData.endTime
    const children = frameData.children.map(childFrameData => this.getFrame(childFrameData))
    return new TraceFrame(receiver, message, $arguments, answer, startTime, endTime, children)
  }
}

export 