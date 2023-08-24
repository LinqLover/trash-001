
  constructor(receiver, message, $arguments, answer, startTime, endTime, children) {
    this.receiver = receiver
    this.message = message
    this.arguments = $arguments
    this.answer = answer
    this.startTime = startTime
    this.endTime = endTime // TODO: document whether inclusive or exclusive
    this.children = children
  }

  allFrames() {
    return [this, ...this.children.flatMap(child => child.allFrames())]
  }

  get name() {
    return this.toString()
  }

  toString() {
    return `${this.receiver.class.name}>>${this.message}`
  }
}

export 