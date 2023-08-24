building
buildClasses

	| classes |
	classes := self makeContainer.
	classNames keysAndValuesDo: [:class :name |
		classes at: name put:
			(self makeContainer
				category: class category;
				package: (class packageInfo ifNotNil: [:package | package name]);
				yourself)].
	^ classes