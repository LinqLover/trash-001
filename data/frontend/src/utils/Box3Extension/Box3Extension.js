}

Box3Extension.setFromObject = (box3, object, traverse = true) => {
  if (!box3) box3 = new Box3();

  // if including children then return the normal method
  if (traverse) return box3.setFromObject(object);

  // if NOT including children use the modified method
  box3.makeEmpty();
  return Box3Extension.expandByObject(box3, object, traverse);
};

Box3Extension.expandByObject = (box3, object) => {
  const _box = new Box3();

  object.updateWorldMatrix(false, false);

  const geometry = object.geometry;

  if (geometry !== undefined) {
    if (geometry.boundingBox === null) {
      geometry.computeBoundingBox();
    }

    _box.copy(geometry.boundingBox);
    _box.applyMatrix4(object.matrixWorld);
    box3.union(_box);
  }

  return box3;
};

export default Box3Extension;
