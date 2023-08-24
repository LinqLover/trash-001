}

BoxGeometryExtension.copyWith = (boxGeometry, width, height, depth) => {
    const oldGroups = boxGeometry.groups
    const newGeometry = new BoxGeometry(width, height, depth)
    newGeometry.groups = oldGroups
    return newGeometry
}
