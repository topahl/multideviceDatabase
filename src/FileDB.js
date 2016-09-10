// TODO insertOrUpdate method
// TODO migrate to Dropbox APIv2, as v1 was deprecated end of July, 2016

class FileDB {

	constructor(apiKey) {
		this.apiKey = apiKey;
		this.allTables = {};
		FileDB.file = File;
		this.client = null;
	}

	/**
	 * initializes authentication to Dropbox API, and trigggers
	 * loading of tables from Dropbox directory.
	 */
	setupDropbox(callback) {
		var promise = new Promise((resolve, reject) => {
			this.client = new Dropbox.Client({
				"key": this.apiKey
			});

			this.client.authenticate(null, (error) => {
				if (!!error) {
					throw error;
				}
				this.loadTables(resolve, reject);
			});
		});

		promise
			.then((value) => {
				console.debug("[setupDropbox] all promises resolved, calling callback function");
				callback();
			})
			.catch((error) => {
				console.error("[setupDropbox] Error on authentication or table initialization.", error);
			});
	}

	/**
	 * Simple data table query. Deprecated in localstoragedb,
	 * use queryAll instead consistently.
	 * @deprecated
	 */
	query(tableName, query, sort, start, limit) {
		if (!query) query = null;
		if (!sort) sort = null;
		if (!start) start = null;
		if (!limit) limit = null;

		return this.allTables[tableName].query(query, sort, start, limit);
	}

	/**
	 * Simple data table query.
	 */
	queryAll(tableName, params) {
		if (!params) {
			return this.query(tableName);
		} else {
			return this.query(tableName,
				params.hasOwnProperty('query') ? params.query : null,
				params.hasOwnProperty('sort') ? params.sort : null,
				params.hasOwnProperty('start') ? params.start : null,
				params.hasOwnProperty('limit') ? params.limit : null
			);
		}
	}

	/**
	 * Update rows affected by query.
	 */
	update(tableName, query, updateFunction) {
    if(!query) query = null;
    if(typeof updateFunction !== "function") {
      console.warn("updateFunction is empty, but required.")
      return [];
    }

		var result = this.allTables[tableName].update(query, updateFunction);
    console.debug("[FileDB.update] result of update:", result);
    return result;
	}

	/**
	 * Returns number of rows for given table.
	 */
	rowCount(tableName) {
		return this.query(tableName).length;
	}

	/**
	 * Creates a new table with given name and fields.
	 */
	createTable(tableName, fields) {
		return this.allTables[tableName] = new Table(tableName, fields, this.client);
	}

	/**
	 * Creates a new table with given name, and fills in
	 * given data as initial data set.
	 */
	createTableWithData(tableName, data) {
		if (typeof data !== 'object' || !data.length || data.length < 1) {
			error("Data supplied isn't in object form. Example: [{k:v,k:v},{k:v,k:v} ..]");
		}

		var fields = Object.keys(data[0]);
		this.createTable(tableName, fields);

		for (var i = 0; i < data.length; i++) {
			this.insert(tableName, data[i]);
		}
		return this.query(tableName);
	}

	/**
	 * Insert data row into given table.
	 */
	insert(tableName, data) {
		return this.allTables[tableName].insert(data);
	}

	/**
	 * @returns Array with all fields for given table.
	 */
	tableFields(tableName) {
		return this.allTables[tableName].getTableFields();
	}

	/**
	 * Returns true if database was just created
	 * with initialization of this instance.
	 */
	isNew() {
		return Object.keys(this.allTables).length === 0;
	}

	/**
	 * Load table data from Dropbox directory into
	 * local memory, preparing the database for operations.
	 */
	loadTables(resolve, reject) {
		this.client.readdir("/", (error, files) => {
			if (!!error) {
				reject(error);
			}

			var file, promises = [];

			for (file of files) {
				// files beginning with _ are containing data,
				// tables do not have prefix - we need the tables here
				if (file[0] === "_") {
					continue;
				}

				// add a promise for this file to promises list
				console.debug("[loadTables] add promise for file", file);
				promises.push(
					new Promise((_resolve, _reject) => {
						this.allTables[file] = new Table(file, false, this.client, _resolve, _reject);
					})
				);
			}

			// wait for all files to be loaded successfully
			Promise.all(promises)
				.then((values) => {
					console.debug("[loadTables] all files loaded successfully, values:", values);
					resolve(values);
				})
				.catch((error) => {
					console.debug("[loadTables] failed loading at least one file, error of failed promise:", error);
					reject(error);
				});
		});
	}
}
