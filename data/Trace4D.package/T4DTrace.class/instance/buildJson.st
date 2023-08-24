building
buildJson

	| trace objects classes |
	objectIds := PluggableDictionary
		hashBlock: [:a | a perform: #identityHash]
		equalBlock: [:a :b | a tdbIdentical: b].
	classNames := Dictionary new.
	
	trace := self buildTrace.
	objects := self buildObjects.
	classes := self buildClasses.
	
	^ self makeContainer
		objects: objects;
		classes: classes;
		trace: trace;
		yourself