building
objectIdFor: anObject

	^ objectIds at: anObject ifAbsentPut:
		['@' , UUID new]