class FileDB
	constructor: (@apiKey) ->
		@allTables = {}

	joinCounter = 0
	@file = File

	client = null

	setupDropbox: (callback) ->
		client = new Dropbox.Client(
				"key": @apiKey
			)
		client.authenticate(null,(error)=>
			throw error if error?
			@loadTables(callback)
		)

	query: (tableName, queryString = null, sortArray = null) ->
		@allTables[tableName].query(queryString,sortArray)

	queryAll: (tableName, {argQuery = null, argSort = null}={argQuery : null, argSort : null}) ->
		@query(tableName, argQuery, argSort)

	rowCount: (tableName) ->
		@query(tableName).length

	createTable: (tableName) ->
		@allTables[tableName] = new Table(tableName,true)

	createTableWithData: (tableName, data) ->
		@createTable(tableName)
		@insert(tableName,d) for d in data
		@query(tableName)

	insert: (tableName, data) ->
		@allTables[tableName].insert(data)

	isNew: ->
		Object.keys(@allTables).length is 0

	loadTables : (callback) ->
		client.readdir("/",(error,files)=>
			joinCounter++
			for file in files when file[0] isnt "_"
				joinCounter++
				@allTables[file] = new Table(file,false, ->
					join(callback)
				)
			join(callback)
		)

	clone= (obj) ->
		str = JSON.stringify(obj)
		new_obj = JSON.parse(str)

	join= (callback) ->
		joinCounter--
		setTimeout(callback,0) if joinCounter is 0

	call= (func) ->
		func?()

	class Table

		constructor: (tableName,create = false,callbackOnLoad) ->
			@tableFileData = {}
			@dataFileObjects = []
			@data = []

			tableFile = new File(tableName)
			if create
				tableFile.readFile();
				@data[0] = {}
				@data[0].maxSize = 62500 #62500 bytes = 50kB
				@data[0].dataFiles = []
				file = @createNewDatafile();
				@dataFileObjects.push(file)
				@data[0].dataFiles.push(file.getName())
				tableFile.insert(@data[0])
				@tableFileData = @data[0]
				call(callbackOnLoad);
			else
				tableFile.readFile(=>
					@data = tableFile.getDataArray();
					@tableFileData = @data[0]
					for df in @tableFileData.data_files
						f = new File(df)
						@dataFileObjects.push(f)
						f.readFile(callbackOnLoad);
				)
		updateTableData: ->
			dataFile=[]
			dataFile.push(dfo.getName()) for dfo in @dataFileObjects
			tableFile.update(undefined,'data_files': dataFiles)

		insert: (insertData) ->
			df = @dataFileObjects[@dataFileObjects.length - 1 ]
			if df.getSize() > @tableFileData.maxSize
				df = createNewDatafile()
				@dataFileObjects.push(df)
				@tableFileData.dataFiles.push(df.getName())
				@updateTableData()
			df.insert(insertData)

		query: (queryString=null, sort=null) ->
			result = []
			for dfo in @dataFileObjects
				result = result.concat(dfo.query(queryString))
			if(sort? instanceof Array)
				for s in sort
					result.sort(sortResults(s[0],s[1]))
			result

		createNewDatafile: ->
			name = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) =>
				r = Math.random() * 16 | 0
				v = if c is 'x' then r else (r & 0x3|0x8)
				v.toString(16)
			)
			file = new File("_#{name}")
			file.readFile();
			file
		sortResults: (field, order=null) ->
			(x,y)=>
				a = x[field]
				b = y[field]
				if a typeof "string" then a = a.toLowerCase()
				if b typeof "string" then b = b.toLowerCase()
				if order is "DESC"
					if a == b then 0 else if a < b then 1 else -1;
				else
					if a == b then 0 else if a > b then 1 else -1;

	class File


		constructor: (@fileName) ->
			@syncing = false
			@syncingAddedData = null
			@timeExtension = 0
			@timeLastRead = 0
			@fileStats = null
			@dataObject = {}

		query: (param) ->
			@toDataArray(query(param))

		query= (param) ->
			if typeof param is "function" then queryByFunction(param)
			else if not param? then @dataObject
			else queryByValue(param)

		remove: (param) ->
			@scheduleSync()
			result = query(param)
			delete @dataObject[key] for own key of result
			this.query(param)

		update: (param, values) ->
			result = query(param)
			for own id, row of result
				newRow = clone(row)
				newRow[field] = updateData for own field, updateData of values
				@remove(@dataObject[id])
				@insert(newRow)
			this.query(param)

		insert: (data) ->
			@scheduleSync()
			nid = @getNextId()
			@dataObject[nid] = data

		queryByFunction= (func) ->
			result= {}
			for own id, row of @dataObject
				result[id] = row if func(clone(row)) is true
			result

		queryByValue= (params) ->
			result = {}
			for own id, row of @dataObject
				found=false
				for own field, entry of params
					if row[field] is entry found = true
					else found = false
				result[id] = clone(row) if found
			result

		getNextId: ->
			time = (new Date()).getTime()
			@timeExtension++
			increment = @timeExtension % 1000
			if increment < 10  then "#{time}00#{increment}"
			else if increment < 100 then "#{time}0#{increment}"
			else "#{time}#{increment}"

		scheduleSync: ->
			if not @syncing
				@syncing = true
				setTimeout(@sync,0)

		sync: =>
			@syncing = false;
			time = (new Date()).getTime()
			oldVersionTag = "0"
			if @fileStats?
				oldVersionTag = @fileStats.versionTag
			@readStat(=>
				if oldVersionTag isnt @fileStats.versionTag
					oldData = clone(@dataObject)
					@readFile(=>
						@dataObject = @merge(oldData,@dataObject)
						@timeLastRead = time
						@writeFile()
					)

			)

		getVersionTag: ->
			@fileStats.versionTag

		getSize: ->
			syncingLength = 0
			if @syncingAddedData? then syncingLength = JSON.stringify(@syncingAddedData).length;
			JSON.stringify(@dataObject).length + syncingLength;

		getName: ->
			@fileName

		getData: ->
			clone(@dataObject)

		getDataArray: ->
			@toDataArray(@dataObject)

		toDataArray: (object) ->
			array = []
			for key of object
				array.push(object[key])
			clone(array)


		readFile: (callback) ->
			client.readFile(@fileName,(err,data,stats)=>
				if @error(err,callback)
					@dataObject = JSON.parse(data)
					@fileStats=stats
					call(callback)
			)

		writeFile: (callback) ->
			client.writeFile(@fileName, JSON.stringify(@dataObject), (err, stats)=>
				if @error(err,callback)
					file_stats = stats
					call(callback)
			)


		readStat: (callback) ->
			client.stat(@fileName, (err, stats)=>
				if @error(err,callback)
					@fileStats = stats
					call(callback)
			)

		error: (err,callback) ->
			result = true
			if err?
				switch err.status
					when 404  #File not Found
						result = false
						console.log("File not found - creating new file")
						@writeFile(callback)
					when 503  #Too Many Requests
						result = false
						console.log("Too many requests - try again in 1000ms")
						setTimeout(@sync,1000)
					else
						console.error(err)
						result = false
			result

		merge: (objA, objB) ->
			console.log("MERGING")
			objMerged = {}
			time = 0
			for own key of objB
				#Both have same entry
				if objA[key]?
					objMerged[key] = objB[key]
				#enty only in B
				if !objA[key]?
					time = parseInt(key[0..12])
					if time > @timeLastRead then objMerged[key] = objA[key]
			objMerged
