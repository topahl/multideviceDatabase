class Table {

	/**
	 * init Table.
	 * @param create If Table is new and shall be created, expects Array of Table fields (not 'true'!)
	 */
	constructor(tableName, create, client, promiseResolve, promiseReject) {
		create = create || false;
		promiseResolve = promiseResolve || false;
		promiseReject = promiseReject || false;
		var file;

		this.tableFileData = {};
		this.dataFileObjects = [];
		this.data = [];
		this.client = client;
		this.tableFile = new File(tableName, client);

		if (create) {
			var promise = this.tableFile.readFile();
			this.data[0] = {
				maxSize: 62500, // 62500 bytes = 50kB
				dataFiles: []
			};
			// add table fields to table metadata
			if (typeof create === "Array") {
				this.data[0].fields = create;
			}
			file = this.createNewDatafile();
			this.dataFileObjects.push(file);
			this.data[0].dataFiles.push(file.getName());
			this.tableFile.insert(this.data[0]);
			this.tableFileData = this.data[0];

			promise.then((data) => {
				if (promiseResolve) {
					promiseResolve(file.getName());
				}
			});
		} else {
			this.tableFile.readFile()
				.then((data) => {
					var df, f, results;
					this.data = this.tableFile.getDataArray();
					this.tableFileData = this.data[0];
					var promises = [];

					for (df of this.tableFileData.dataFiles) {
						f = new File(df, this.client);
						this.dataFileObjects.push(f);
						promises.push(f.readFile());
					}

					Promise.all(promises)
						.then((values) => {
							if (promiseResolve) {
								promiseResolve(values);
							}
						})
						.catch((error) => {
							console.error("[Table.constructor] error when loading file:", error);
							if (promiseReject) {
								promiseReject(f.getName());
							}
						});
				});
		}
	}

	/**
	 * @returns Array with table field names as Strings.
	 */
	getTableFields() {
		return this.tableFileData.fields;
	}

	updateTableData() {
		var dataFile, dfo;
		dataFiles = [];

		for (dfo of this.dataFileObjects) {
			dataFiles.push(dfo.getName());
		}

		return this.tableFile.update(void 0, {
			'dataFiles': dataFiles
		});
	}

	insert(insertData) {
		var df = this.dataFileObjects[this.dataFileObjects.length - 1];

		if (df.getSize() > this.tableFileData.maxSize) {
			df = this.createNewDatafile();
			this.dataFileObjects.push(df);
			this.tableFileData.dataFiles.push(df.getName());
			this.updateTableData();
		}

		return df.insert(insertData);
	}

	query(query, sort, start, limit) {
		var dfo, result, s;
		if (!query) {
			query = null;
		}
		if (!sort) {
			sort = null;
		}

		result = [];
		for (dfo of this.dataFileObjects) {
			result = result.concat(dfo.query(query));
		}

		// there are sorting params
		if (sort != null && sort instanceof Array) {
			for (s of sort) {
				result.sort(this.sortResults(s[0], s.length > 1 ? s[1] : null));
			}
		}

		// limit and offset
		start = start && typeof start === "number" ? start : null;
		limit = limit && typeof limit === "number" ? limit : null;

		if (start && limit) {
			result = result.slice(start, start + limit);
		} else if (start) {
			result = result.slice(start);
		} else if (limit) {
			result = result.slice(start, limit);
		}

		return result;
	}

	update(query, updateFunction) {
		var result = [];

		for (dfo of this.dataFileObjects) {
			result = result.concat(dfo.updateByFunction(query, updateFunction));
		}

		return result;
	}

	createNewDatafile() {
		var file, name;
		name = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
			var r, v;
			r = Math.random() * 16 | 0;
			v = c === 'x' ? r : r & 0x3 | 0x8;
			return v.toString(16);
		});

		file = new File('_' + name, this.client);
		file.readFile();
		// TODO check if we need to wait for file reading here
		return file;
	}

	sortResults(field, order) {
		if (!order) {
			order = null;
		}

		return function (x, y) {
			// case insensitive comparison for string values
			var v1 = typeof (x[field]) === "string" ? x[field].toLowerCase() : x[field],
				v2 = typeof (y[field]) === "string" ? y[field].toLowerCase() : y[field];

			if (order === "DESC") {
				return v1 == v2 ? 0 : (v1 < v2 ? 1 : -1);
			} else {
				return v1 == v2 ? 0 : (v1 > v2 ? 1 : -1);
			}
		};
	}

	call(func) {
		return typeof func === "function" ? func() : void 0;
	}
}