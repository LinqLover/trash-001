
  name
  class
  fields
  fieldHistories

  static valueToString(value) {
    if (value instanceof TraceObject) return value.name
    return value.toString()
  }
}

export 