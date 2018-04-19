class File {

	constructor(fileName, client) {
		this.fileName = fileName;
		this.syncing = false;
		this.syncingAddedData = null;
		this.timeExtension = 0;
		this.timeLastRead = 0;
		this.fileStats = null;
		this.dataObject = {};
		this.client = client;
	}

	query(param) {
		return this.toDataArray(this.queryHelper(param));
	}

	queryHelper(param) {
		if (typeof param === "function") {
			return this.queryByFunction(param);
		} else if (param == null) {
			return this.dataObject;
		} else {
			return this.queryByValue(param);
		}
	}

	remove(param) {
		var key, result;
		this.scheduleSync();
		result = this.queryHelper(param);
		for (key in result) {
			if (!result.hasOwnProperty(key)) continue;
			delete this.dataObject[key];
		}

		return this.query(param);
	}

	update(param, values) {
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

	updateByFunction(query, updateFunction) {
		var result = this.queryHelper(query);

		for (id in result) {
			if (!result.hasOwnProperty(id)) continue;
			var row = result[id];
			var newRow = updateFunction(this.clone(row));
			this.remove(this.dataObject[id]);
			this.insert(newRow);
		}

		return this.query(query);
	}

	insert(data) {
		this.scheduleSync();
		var nid = this.getNextId();

		return this.dataObject[nid] = data;
	}

	queryByFunction(func) {
		var id, ref, result, row;
		result = {};
		ref = this.dataObject;

		for (id in ref) {
			if (!ref.hasOwnProperty(id)) continue;
			row = ref[id];
			if (func(this.clone(row)) === true) {
				result[id] = this.clone(row);
			}
		}

		return result;
	}

	queryByValue(params) {
		var field, found, id, ref, result, row;
		result = {};
		ref = this.dataObject;

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

	getNextId() {
		var increment, time;
		time = (new Date()).getTime();
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

	scheduleSync() {
		if (!this.syncing) {
			this.syncing = true;
			return setTimeout(() => {
				this.sync()
			}, 0);
		}
	}

	sync() {
		var oldVersionTag, time, promise;
		this.syncing = false;
		time = (new Date()).getTime();
		oldVersionTag = "0";

		if (this.fileStats != null) {
			oldVersionTag = this.fileStats.rev;
		}

		this.readStat()
			.then((value) => {
				if (oldVersionTag !== this.fileStats.rev) {
					// if there are changes on server side,
					// they need to be merged with local changes
					var oldData = this.clone(this.dataObject);
					this.readFile()
						.then((data) => {
							this.dataObject = this.merge(oldData, this.dataObject);
							this.timeLastRead = time;
							this.writeFile();
						});
				} else {
					// versions are identical, file can be overridden without loss
					this.timeLastRead = time;
					this.writeFile();
				}
			});
	}

	getVersionTag() {
		return this.fileStats.rev;
	}

	getSize() {
		var syncingLength;
		syncingLength = 0;
		if (this.syncingAddedData != null) {
			syncingLength = JSON.stringify(this.syncingAddedData).length;
		}

		return JSON.stringify(this.dataObject).length + syncingLength;
	}

	getName() {
		return this.fileName;
	}

	getData() {
		return this.clone(this.dataObject);
	}

	getDataArray() {
		return this.toDataArray(this.dataObject);
	}

	toDataArray(object) {
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
	readFile() {
		return new Promise((resolve, reject) => {
			this.client.filesDownload({
					path: '/' + this.fileName
				})
				.then(response => {
					this.fileStats = response;

					// read file contents using FileReader
					var blob = response.fileBlob;
					var reader = new FileReader();
					reader.addEventListener('loadend', () => {
						this.dataObject = JSON.parse(reader.result);
						resolve(this.dataObject);
					});
					reader.readAsText(blob);
				})
				.catch(error => {
					this.error(error);
				});
		});
	}

	/**
	 * writes local data representation into file.
	 * Returns promise to listen on.
	 */
	writeFile() {
		return new Promise((resolve, reject) => {

			this.client.filesUpload({
					path: '/' + this.fileName,
					contents: JSON.stringify(this.dataObject),
					mode: 'overwrite',
					// mute: true // no desktop notification on sync
				})
				.then(response => {
					this.fileStats = response;
					resolve(response);
				})
				.catch(error => {
					this.error(error);
				});
		});
	}

	readStat() {
		return new Promise((resolve, reject) => {
			this.client.filesGetMetadata({
					path: '/' + this.fileName
				})
				.then(response => {
					this.fileStats = response;
					resolve(response);
				})
				.catch(error => {
					this.error(error);
				});
		});
	}

	error(err) {
		var result;
		result = true;
		if (err != null) {
			switch (err.status) {
				case 409:
					result = false;
					console.info('File not found - creating new file');
					this.writeFile();
					break;
				default:
					console.error(err);
					result = false;
			}
		}

		return result;
	}

	merge(objA, objB) {
		var key, objMerged, time;
		console.info('Merging files');
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
	clone(obj) {
		var str = JSON.stringify(obj);
		return JSON.parse(str);
	}

	call(func) {
		return typeof func === "function" ? func() : void 0;
	}
}