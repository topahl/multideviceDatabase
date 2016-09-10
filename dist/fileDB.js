"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var File = function () {
	function File(fileName, client) {
		_classCallCheck(this, File);

		this.fileName = fileName;
		this.syncing = false;
		this.syncingAddedData = null;
		this.timeExtension = 0;
		this.timeLastRead = 0;
		this.fileStats = null;
		this.dataObject = {};
		this.client = client;
	}

	_createClass(File, [{
		key: "query",
		value: function query(param) {
			return this.toDataArray(this.queryHelper(param));
		}
	}, {
		key: "queryHelper",
		value: function queryHelper(param) {
			if (typeof param === "function") {
				return this.queryByFunction(param);
			} else if (param == null) {
				return this.dataObject;
			} else {
				return this.queryByValue(param);
			}
		}
	}, {
		key: "remove",
		value: function remove(param) {
			var key, result;
			this.scheduleSync();
			result = this.queryHelper(param);
			for (key in result) {
				if (!result.hasOwnProperty(key)) continue;
				delete this.dataObject[key];
			}

			return this.query(param);
		}
	}, {
		key: "update",
		value: function update(param, values) {
			var field, id, newRow, result, row, updateData;
			result = this.queryHelper(param);

			for (id in result) {
				if (!result.hasOwnProperty(id)) continue;
				row = result[id];
				newRow = this.clone(row);

				for (field in values) {
					if (!values.hasOwnProperty(field)) continue;
					updateData = values[field];
					newRow[field] = updateData;
				}
				this.remove(this.dataObject[id]);
				this.insert(newRow);
			}

			return this.query(param);
		}
	}, {
		key: "updateByFunction",
		value: function updateByFunction(query, updateFunction) {
			var result = this.queryHelper(query);

			console.debug("[File.updateByFunction] affected rows: ", this.toDataArray(result).length);

			for (id in result) {
				if (!result.hasOwnProperty(id)) continue;
				var row = result[id];
				var newRow = updateFunction(this.clone(row));
				this.remove(this.dataObject[id]);
				this.insert(newRow);
			}

			return this.query(query);
		}
	}, {
		key: "insert",
		value: function insert(data) {
			this.scheduleSync();
			var nid = this.getNextId();

			return this.dataObject[nid] = data;
		}
	}, {
		key: "queryByFunction",
		value: function queryByFunction(func) {
			var id, ref, result, row;
			result = {};
			ref = this.dataObject;

			//    console.debug('queryByFunction,  func:', func);

			for (id in ref) {
				if (!ref.hasOwnProperty(id)) continue;
				row = ref[id];
				if (func(this.clone(row)) === true) {
					result[id] = this.clone(row);
				}
			}

			return result;
		}
	}, {
		key: "queryByValue",
		value: function queryByValue(params) {
			var field, found, id, ref, result, row;
			result = {};
			ref = this.dataObject;

			//    console.debug('queryByValue,  params:', params);

			for (id in ref) {
				if (!ref.hasOwnProperty(id)) continue;
				row = ref[id];
				found = null;

				for (field in params) {
					if (!params.hasOwnProperty(field)) continue;
					if (row[field] === params[field]) {
						if (found === null) {
							// first call, set found to true;
							found = true;
						} else {
							// since all conditions must be true,
							// chain with previously found conditions
							// for this row
							found = found && true;
						}
					} else {
						found = false;
					}
				}

				if (!!found) {
					result[id] = this.clone(row);
				}
			}

			return result;
		}
	}, {
		key: "getNextId",
		value: function getNextId() {
			var increment, time;
			time = new Date().getTime();
			this.timeExtension++;
			increment = this.timeExtension % 1000;
			if (increment < 10) {
				return time + "00" + increment;
			} else if (increment < 100) {
				return time + "0" + increment;
			} else {
				return "" + time + increment;
			}
		}
	}, {
		key: "scheduleSync",
		value: function scheduleSync() {
			var _this = this;

			if (!this.syncing) {
				this.syncing = true;
				return setTimeout(function () {
					_this.sync();
				}, 0);
			}
		}
	}, {
		key: "sync",
		value: function sync() {
			var _this2 = this;

			console.debug("[File.sync] start sync", "fileStats:", this.fileStats);
			var oldVersionTag, time, promise;
			this.syncing = false;
			time = new Date().getTime();
			oldVersionTag = "0";

			if (this.fileStats != null) {
				oldVersionTag = this.fileStats.versionTag;
			}

			this.readStat().then(function (value) {
				console.debug("[File.sync] after readStat", oldVersionTag, _this2.fileStats.versionTag);
				if (oldVersionTag !== _this2.fileStats.versionTag) {
					// if there are changes on server side,
					// they need to be merged with local changes
					var oldData = _this2.clone(_this2.dataObject);
					console.debug("[File.sync] version tags do differ");
					_this2.readFile().then(function (data) {
						console.debug("[File.sync] after readFile");
						_this2.dataObject = _this2.merge(oldData, _this2.dataObject);
						_this2.timeLastRead = time;
						_this2.writeFile();
					});
				} else {
					// versions are identical, file can be overridden without loss
					_this2.timeLastRead = time;
					_this2.writeFile();
				}
			});
		}
	}, {
		key: "getVersionTag",
		value: function getVersionTag() {
			return this.fileStats.versionTag;
		}
	}, {
		key: "getSize",
		value: function getSize() {
			var syncingLength;
			syncingLength = 0;
			if (this.syncingAddedData != null) {
				syncingLength = JSON.stringify(this.syncingAddedData).length;
			}

			return JSON.stringify(this.dataObject).length + syncingLength;
		}
	}, {
		key: "getName",
		value: function getName() {
			return this.fileName;
		}
	}, {
		key: "getData",
		value: function getData() {
			return this.clone(this.dataObject);
		}
	}, {
		key: "getDataArray",
		value: function getDataArray() {
			return this.toDataArray(this.dataObject);
		}
	}, {
		key: "toDataArray",
		value: function toDataArray(object) {
			var array, key;
			array = [];
			for (key in object) {
				array.push(object[key]);
			}
			return this.clone(array);
		}

		/**
   * reads file contents into local variable representation.
   * Returns promise to listen on.
   */

	}, {
		key: "readFile",
		value: function readFile() {
			var _this3 = this;

			return new Promise(function (resolve, reject) {
				_this3.client.readFile(_this3.fileName, function (err, data, stats) {
					if (_this3.error(err)) {
						_this3.dataObject = JSON.parse(data);
						_this3.fileStats = stats;
						resolve(_this3.dataObject);
					}
				});
			});
		}

		/**
   * writes local data representation into file.
   * Returns promise to listen on.
   */

	}, {
		key: "writeFile",
		value: function writeFile() {
			var _this4 = this;

			return new Promise(function (resolve, reject) {
				_this4.client.writeFile(_this4.fileName, JSON.stringify(_this4.dataObject), function (err, stats) {
					if (_this4.error(err)) {
						_this4.fileStats = stats;
						resolve(stats);
					}
				});
			});
		}
	}, {
		key: "readStat",
		value: function readStat() {
			var _this5 = this;

			return new Promise(function (resolve, reject) {
				_this5.client.stat(_this5.fileName, function (err, stats) {
					if (_this5.error(err)) {
						console.debug("[readStat] stats:", stats);
						_this5.fileStats = stats;
						resolve(stats);
					}
				});
			});
		}
	}, {
		key: "error",
		value: function error(err) {
			var result;
			result = true;
			if (err != null) {
				switch (err.status) {
					case 404:
						result = false;
						console.log("File not found - creating new file");
						this.writeFile();
						break;
					case 503:
						result = false;
						console.log("Too many requests - try again in 1000ms");
						setTimeout(this.sync, 1000);
						break;
					default:
						console.error(err);
						result = false;
				}
			}

			return result;
		}
	}, {
		key: "merge",
		value: function merge(objA, objB) {
			var key, objMerged, time;
			console.log("MERGING");
			objMerged = {};
			time = 0;

			for (key in objB) {
				if (!objB.hasOwnProperty(key)) continue;

				if (objA[key] != null) {
					objMerged[key] = objB[key];
				}

				if (objA[key] == null) {
					time = parseInt(key.slice(0, 13));

					if (time > this.timeLastRead) {
						objMerged[key] = objA[key];
					}
				}
			}

			return objMerged;
		}

		/**
   * Helper function to create a clone of given object.
   */

	}, {
		key: "clone",
		value: function clone(obj) {
			var str = JSON.stringify(obj);
			return JSON.parse(str);
			// results in NaN and undefined values:
			/*var new_obj = {};
   	for(var key in obj) {
   		if( obj.hasOwnProperty(key) ) {
   			new_obj[key] = obj[key];
   		}
   	}
   	return new_obj;*/
			s;
		}
	}, {
		key: "call",
		value: function call(func) {
			return typeof func === "function" ? func() : void 0;
		}
	}]);

	return File;
}();
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Table = function () {

	/**
  * init Table.
  * @param create If Table is new and shall be created, expects Array of Table fields (not 'true'!)
  */
	function Table(tableName, create, client, promiseResolve, promiseReject) {
		var _this = this;

		_classCallCheck(this, Table);

		create = create || false;
		promiseResolve = promiseResolve || false;
		promiseReject = promiseReject || false;
		var file, tableFile;

		this.tableFileData = {};
		this.dataFileObjects = [];
		this.data = [];
		this.client = client;
		this.tableName = tableName; // TODO debug
		tableFile = new File(tableName, client);

		if (create) {
			var promise = tableFile.readFile();
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
			tableFile.insert(this.data[0]);
			this.tableFileData = this.data[0];

			promise.then(function (data) {
				if (promiseResolve) {
					promiseResolve(file.getName());
				}
			});
		} else {
			tableFile.readFile().then(function (data) {
				var df, f, results;
				_this.data = tableFile.getDataArray();
				_this.tableFileData = _this.data[0];
				var promises = [];

				var _iteratorNormalCompletion = true;
				var _didIteratorError = false;
				var _iteratorError = undefined;

				try {
					for (var _iterator = _this.tableFileData.dataFiles[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
						df = _step.value;

						f = new File(df, _this.client);
						_this.dataFileObjects.push(f);
						promises.push(f.readFile());
					}
				} catch (err) {
					_didIteratorError = true;
					_iteratorError = err;
				} finally {
					try {
						if (!_iteratorNormalCompletion && _iterator.return) {
							_iterator.return();
						}
					} finally {
						if (_didIteratorError) {
							throw _iteratorError;
						}
					}
				}

				Promise.all(promises).then(function (values) {
					if (promiseResolve) {
						console.debug("[Table.constructor] successfully loaded files for", tableName, values);
						promiseResolve(values);
					}
				}).catch(function (error) {
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


	_createClass(Table, [{
		key: "getTableFields",
		value: function getTableFields() {
			return this.tableFileData.fields;
		}
	}, {
		key: "updateTableData",
		value: function updateTableData() {
			var dataFile, dfo;
			dataFiles = [];

			var _iteratorNormalCompletion2 = true;
			var _didIteratorError2 = false;
			var _iteratorError2 = undefined;

			try {
				for (var _iterator2 = this.dataFileObjects[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
					dfo = _step2.value;

					dataFiles.push(dfo.getName());
				}
			} catch (err) {
				_didIteratorError2 = true;
				_iteratorError2 = err;
			} finally {
				try {
					if (!_iteratorNormalCompletion2 && _iterator2.return) {
						_iterator2.return();
					}
				} finally {
					if (_didIteratorError2) {
						throw _iteratorError2;
					}
				}
			}

			return tableFile.update(void 0, {
				'dataFiles': dataFiles
			});
		}
	}, {
		key: "insert",
		value: function insert(insertData) {
			var df = this.dataFileObjects[this.dataFileObjects.length - 1];

			if (df.getSize() > this.tableFileData.maxSize) {
				df = createNewDatafile();
				this.dataFileObjects.push(df);
				this.tableFileData.dataFiles.push(df.getName());
				this.updateTableData();
			}

			return df.insert(insertData);
		}
	}, {
		key: "query",
		value: function query(_query, sort, start, limit) {
			var dfo, result, s;
			if (!_query) {
				_query = null;
			}
			if (!sort) {
				sort = null;
			}

			result = [];
			var _iteratorNormalCompletion3 = true;
			var _didIteratorError3 = false;
			var _iteratorError3 = undefined;

			try {
				for (var _iterator3 = this.dataFileObjects[Symbol.iterator](), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
					dfo = _step3.value;

					result = result.concat(dfo.query(_query));
				}

				// there are sorting params
			} catch (err) {
				_didIteratorError3 = true;
				_iteratorError3 = err;
			} finally {
				try {
					if (!_iteratorNormalCompletion3 && _iterator3.return) {
						_iterator3.return();
					}
				} finally {
					if (_didIteratorError3) {
						throw _iteratorError3;
					}
				}
			}

			if (sort != null && sort instanceof Array) {
				var _iteratorNormalCompletion4 = true;
				var _didIteratorError4 = false;
				var _iteratorError4 = undefined;

				try {
					for (var _iterator4 = sort[Symbol.iterator](), _step4; !(_iteratorNormalCompletion4 = (_step4 = _iterator4.next()).done); _iteratorNormalCompletion4 = true) {
						s = _step4.value;

						result.sort(this.sortResults(s[0], s.length > 1 ? s[1] : null));
					}
				} catch (err) {
					_didIteratorError4 = true;
					_iteratorError4 = err;
				} finally {
					try {
						if (!_iteratorNormalCompletion4 && _iterator4.return) {
							_iterator4.return();
						}
					} finally {
						if (_didIteratorError4) {
							throw _iteratorError4;
						}
					}
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
	}, {
		key: "update",
		value: function update(query, updateFunction) {
			var result = [];

			var _iteratorNormalCompletion5 = true;
			var _didIteratorError5 = false;
			var _iteratorError5 = undefined;

			try {
				for (var _iterator5 = this.dataFileObjects[Symbol.iterator](), _step5; !(_iteratorNormalCompletion5 = (_step5 = _iterator5.next()).done); _iteratorNormalCompletion5 = true) {
					dfo = _step5.value;

					result = result.concat(dfo.updateByFunction(query, updateFunction));
				}
			} catch (err) {
				_didIteratorError5 = true;
				_iteratorError5 = err;
			} finally {
				try {
					if (!_iteratorNormalCompletion5 && _iterator5.return) {
						_iterator5.return();
					}
				} finally {
					if (_didIteratorError5) {
						throw _iteratorError5;
					}
				}
			}

			return result;
		}
	}, {
		key: "createNewDatafile",
		value: function createNewDatafile() {
			var file, name;
			name = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
				var r, v;
				r = Math.random() * 16 | 0;
				v = c === 'x' ? r : r & 0x3 | 0x8;
				return v.toString(16);
			});

			file = new File("_" + name, this.client);
			file.readFile();
			// TODO check if we need to wait for file reading here
			return file;
		}
	}, {
		key: "sortResults",
		value: function sortResults(field, order) {
			if (!order) {
				order = null;
			}

			return function (x, y) {
				// case insensitive comparison for string values
				var v1 = typeof x[field] === "string" ? x[field].toLowerCase() : x[field],
				    v2 = typeof y[field] === "string" ? y[field].toLowerCase() : y[field];

				if (order === "DESC") {
					return v1 == v2 ? 0 : v1 < v2 ? 1 : -1;
				} else {
					return v1 == v2 ? 0 : v1 > v2 ? 1 : -1;
				}
			};
		}
	}, {
		key: "call",
		value: function call(func) {
			return typeof func === "function" ? func() : void 0;
		}
	}]);

	return Table;
}();
"use strict";

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

// TODO insertOrUpdate method
// TODO migrate to Dropbox APIv2, as v1 was deprecated end of July, 2016

var FileDB = function () {
	function FileDB(apiKey) {
		_classCallCheck(this, FileDB);

		this.apiKey = apiKey;
		this.allTables = {};
		FileDB.file = File;
		this.client = null;
	}

	/**
  * initializes authentication to Dropbox API, and trigggers
  * loading of tables from Dropbox directory.
  */


	_createClass(FileDB, [{
		key: "setupDropbox",
		value: function setupDropbox(callback) {
			var _this = this;

			var promise = new Promise(function (resolve, reject) {
				_this.client = new Dropbox.Client({
					"key": _this.apiKey
				});

				_this.client.authenticate(null, function (error) {
					if (!!error) {
						throw error;
					}
					_this.loadTables(resolve, reject);
				});
			});

			promise.then(function (value) {
				console.debug("[setupDropbox] all promises resolved, calling callback function");
				callback();
			}).catch(function (error) {
				console.error("[setupDropbox] Error on authentication or table initialization.", error);
			});
		}

		/**
   * Simple data table query. Deprecated in localstoragedb,
   * use queryAll instead consistently.
   * @deprecated
   */

	}, {
		key: "query",
		value: function query(tableName, _query, sort, start, limit) {
			if (!_query) _query = null;
			if (!sort) sort = null;
			if (!start) start = null;
			if (!limit) limit = null;

			return this.allTables[tableName].query(_query, sort, start, limit);
		}

		/**
   * Simple data table query.
   */

	}, {
		key: "queryAll",
		value: function queryAll(tableName, params) {
			if (!params) {
				return this.query(tableName);
			} else {
				return this.query(tableName, params.hasOwnProperty('query') ? params.query : null, params.hasOwnProperty('sort') ? params.sort : null, params.hasOwnProperty('start') ? params.start : null, params.hasOwnProperty('limit') ? params.limit : null);
			}
		}

		/**
   * Update rows affected by query.
   */

	}, {
		key: "update",
		value: function update(tableName, query, updateFunction) {
			if (!query) query = null;
			if (typeof updateFunction !== "function") {
				console.warn("updateFunction is empty, but required.");
				return [];
			}

			var result = this.allTables[tableName].update(query, updateFunction);
			console.debug("[FileDB.update] result of update:", result);
			return result;
		}

		/**
   * Returns number of rows for given table.
   */

	}, {
		key: "rowCount",
		value: function rowCount(tableName) {
			return this.query(tableName).length;
		}

		/**
   * Creates a new table with given name and fields.
   */

	}, {
		key: "createTable",
		value: function createTable(tableName, fields) {
			return this.allTables[tableName] = new Table(tableName, fields, this.client);
		}

		/**
   * Creates a new table with given name, and fills in
   * given data as initial data set.
   */

	}, {
		key: "createTableWithData",
		value: function createTableWithData(tableName, data) {
			if ((typeof data === "undefined" ? "undefined" : _typeof(data)) !== 'object' || !data.length || data.length < 1) {
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

	}, {
		key: "insert",
		value: function insert(tableName, data) {
			return this.allTables[tableName].insert(data);
		}

		/**
   * @returns Array with all fields for given table.
   */

	}, {
		key: "tableFields",
		value: function tableFields(tableName) {
			return this.allTables[tableName].getTableFields();
		}

		/**
   * Returns true if database was just created
   * with initialization of this instance.
   */

	}, {
		key: "isNew",
		value: function isNew() {
			return Object.keys(this.allTables).length === 0;
		}

		/**
   * Load table data from Dropbox directory into
   * local memory, preparing the database for operations.
   */

	}, {
		key: "loadTables",
		value: function loadTables(resolve, reject) {
			var _this2 = this;

			this.client.readdir("/", function (error, files) {
				if (!!error) {
					reject(error);
				}

				var file,
				    promises = [];

				var _iteratorNormalCompletion = true;
				var _didIteratorError = false;
				var _iteratorError = undefined;

				try {
					for (var _iterator = files[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
						file = _step.value;

						// files beginning with _ are containing data,
						// tables do not have prefix - we need the tables here
						if (file[0] === "_") {
							continue;
						}

						// add a promise for this file to promises list
						console.debug("[loadTables] add promise for file", file);
						promises.push(new Promise(function (_resolve, _reject) {
							_this2.allTables[file] = new Table(file, false, _this2.client, _resolve, _reject);
						}));
					}

					// wait for all files to be loaded successfully
				} catch (err) {
					_didIteratorError = true;
					_iteratorError = err;
				} finally {
					try {
						if (!_iteratorNormalCompletion && _iterator.return) {
							_iterator.return();
						}
					} finally {
						if (_didIteratorError) {
							throw _iteratorError;
						}
					}
				}

				Promise.all(promises).then(function (values) {
					console.debug("[loadTables] all files loaded successfully, values:", values);
					resolve(values);
				}).catch(function (error) {
					console.debug("[loadTables] failed loading at least one file, error of failed promise:", error);
					reject(error);
				});
			});
		}
	}]);

	return FileDB;
}();