// TODO insertOrUpdate method

class FileDB {

	constructor(apiKey) {
		this.apiKey = apiKey;
		this.allTables = {};
		FileDB.file = File;
		this.client = null;
	}

	/**
	 * checks if access token is set, first in localStorage
	 * and then in URL hash (when redirected from Dropbox authentication).
	 * If the token is set via in hash string, save it in localStorage.
	 * 
	 * @returns Access token if found, else null
	 */
	getAccessToken() {

		var accessToken = null;

		// check for access token in localStorage
		if (typeof (Storage) !== 'undefined') {
			var storedToken = localStorage.getItem('ACCESS_TOKEN');
			if (typeof storedToken === 'string') {
				accessToken = storedToken;
			}
		}

		// check if access token is set within query params, and save it
		var locationHash = window.location.hash;
		if (!accessToken && locationHash && locationHash.length > 0) {
			locationHash.substr(1).split('&').forEach(param => {
				var keyValue = param.split('=');
				if (keyValue[0] === 'access_token' && typeof keyValue[1] === 'string') {
					accessToken = keyValue[1];
					localStorage.setItem('ACCESS_TOKEN', accessToken);
				}
			});
		}

		return accessToken;
	}

	/**
	 * checks if user is authenticated, by checking for access token.
	 * 
	 * @returns true if user has access token, else false
	 */
	isAuthenticated() {
		return !!this.getAccessToken();
	}

	/**
	 * initializes authentication to Dropbox API, and trigggers
	 * loading of tables from Dropbox directory.
	 */
	setupDropbox(callback) {
		var promise = new Promise((resolve, reject) => {

			// Dropbox API v2 requires more manual work for authentication.
			// The following checks if an authentication token is already available
			// and if available, uses it for authentication. Otherwise, use
			// the app id to authenticate the user, after redirect parse the
			// access token from window.location.hash string, and save it
			// in localStorage for reuse on next re-visit.  

			var accessToken = this.getAccessToken();

			// access token is available, using it for authentication
			if (accessToken) {

				this.client = new window.Dropbox({
					accessToken
				});
				this.loadTables(resolve, reject);

			} else {

				// no access token set, authenticate using client id
				this.client = new window.Dropbox({
					clientId: this.apiKey
				});

				// set redirect to return back to the same URL
				var authUrl = this.client.getAuthenticationUrl(window.location);
				window.location.href = authUrl;
			}
		});

		promise
			.then(value => {
				callback();
			})
			.catch(error => {
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
		if (!query) query = null;
		if (typeof updateFunction !== "function") {
			console.warn("updateFunction is empty, but required.")
			return [];
		}

		var result = this.allTables[tableName].update(query, updateFunction);
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
		this.client.filesListFolder({
				path: ''
			})
			.then(response => {

				var file, promises = [];

				for (file of response.entries) {
					// files beginning with _ are containing data,
					// tables do not have prefix - we need the tables here
					if (file.name[0] === '_') {
						continue;
					}

					// add a promise for this file to promises list
					promises.push(
						new Promise((_resolve, _reject) => {
							this.allTables[file.name] = new Table(file.name, false, this.client, _resolve, _reject);
						})
					);
				}

				// wait for all files to be loaded successfully
				Promise.all(promises)
					.then(values => {
						console.info("[loadTables] all files loaded successfully");
						resolve(values);
					})
					.catch(error => {
						console.debug("[loadTables] failed loading at least one file, error of failed promise:", error);
						reject(error);
					});
			})
			.catch(error => {
				reject(error);
			})
	}
}