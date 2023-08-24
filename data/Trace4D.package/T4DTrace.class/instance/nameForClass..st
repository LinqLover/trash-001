building
nameForClass: aClass

	^ classNames at: aClass ifAbsentPut:
		[aClass name]