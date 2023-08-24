
  constructor(objects, classes, rootFrame) {
    this.objects = objects
    this.classes = classes
    this.rootFrame = rootFrame
  }

  createCursor() {
    return new TraceCursor(this)
  }

  maxStackDepth() {
    let maxDepth = 0
    this.createCursor().step(undefined, {
      visitFrame: (_frame, cursor) => maxDepth = Math.max(maxDepth, cursor.currentStack.length)
    })
    return maxDepth
  }
}

export 