writing
storeJsonInFileNamed: fileName

	| json |
	json := self buildJson.
	FileStream newFileNamed: fileName do: [:stream |
		json jsonWriteOn: stream].