function FileDB(app_key) {
		//"use strict";
		var client;
		var join_counter = 0;
		var all_tables={};

		this.setupDropbox = function (callback) {
				client = new Dropbox.Client({
						key: app_key
				});
				client.authenticate(null, function (err) {
						if (err){
								console.err(err);
						}
						else {
								loadTables(callback);
						}
				});
		};

		this.query = query;
		function query(table_name,query_string,sort){
				return all_tables[table_name].query(query_string,sort);
		}

		this.queryAll = function(table_name,params){
			return this.query(table_name,
				params.hasOwnProperty('query') ? params.query : null,
				params.hasOwnProperty('sort') ? params.sort : null);
		}

		this.rowCount = function(table_name){
			return query(table_name).lenth;
		}

		this.createTable=createTable;
		function createTable(table_name){
				all_tables[table_name]= new Table(table_name,true);
		}

		this.createTableWithData = function(table_name,data){
				createTable(table_name);
				var i;
				for(i=0;i<data.length;i+=1){
						insert(table_name,data[i]);
				}
		};

		this.insert=insert;
		function insert(table_name,data){
				all_tables[table_name].insert(data);
		}

		function loadTables(callback){
				client.readdir("/",function(err,files){
						join_counter++;
						for (var i = 0; i < files.length; i++) {
								if(files[i][0]!=="_"){
										join_counter++;
										all_tables[files[i]]= new Table(files[i],false,function(){
												join(callback);
										});
								}
						}
						join(callback);
				});
		}

		this.isNew = function(){
				return Object.keys(all_tables).length===0;
		}

		function clone(obj) {
				var str = JSON.stringify(obj);
				var new_obj = JSON.parse(str);
				return new_obj;
		}

		function join(callback){
				join_counter--;
				if(join_counter===0){
						setTimeout(callback,0);
				}
		}

		function call(func) {
				if (typeof func === "function") {
						func();
				}
		}

		this.Table=Table;
		function Table(table_name,create,callback_on_load) {
				var table_file = new File(table_name);
				var table_file_data = {};
				var data_file_objects = [];

				var data  = [];
				if(create){
						table_file.readFile();
						//Create new Table
						data[0] = {};
						data[0].maxSize = 62500; //62500 bytes = 50kB
						data[0].data_files = [];
						var file = createNewDatafile();
						data_file_objects.push(file);
						data[0].data_files.push(file.getName());
						table_file.insert(data[0]);
						table_file_data = data[0];
						call(callback_on_load);
				}
				else{
						table_file.readFile(function () {
								data = table_file.getDataArray();
								table_file_data = data[0];
								var i;
								for (i = 0; i < table_file_data.data_files.length; i+=1) {
										data_file_objects.push(new File(table_file_data.data_files[i]));
										data_file_objects[i].readFile(callback_on_load);
								}
						});
				}
				function updateTableData() {
						var data_file = [];
						for (var i = 0; i < data_file_objects.length; i++) {
								data_file.push(data_file_objects[i].getName());
						};
						table_file.update(undefined,{'data_files':data_file});
				}

				this.insert = function (insert_data) {
						var df = data_file_objects[data_file_objects.length - 1];
						if (df.getSize() > table_file_data.maxSize) {
								df = createNewDatafile();
								data_file_objects.push(df);
								table_file_data.data_files.push(df.getName());
								updateTableData();
						}
						df.insert(insert_data);
				};




				function createNewDatafile() {
						var name = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
								var r = Math.random() * 16 | 0,
										v = c == 'x' ? r : (r & 0x3 | 0x8);
								return v.toString(16);
						});
						var file = new File("_"+name);
						file.readFile();
						return file;
				}

				this.query = function(query_string, sort){
						var result = [];
						for (var i = 0; i < data_file_objects.length; i++) {
								result = result.concat(data_file_objects[i].query(query_string));
						};
				  		if(sort && sort instanceof Array){
							for(var i=0; i<sort.length; i++) {
								result.sort(sort_results(sort[i][0], sort[i].length > 1 ? sort[i][1] : null));
							}
						}
						return result;
				}
                
                function sort_results(field, order){
					return function(x, y) {
                  	// case insensitive comparison for string values
                  		var v1 = typeof(x[field]) === "string" ? x[field].toLowerCase() : x[field],
                      	v2 = typeof(y[field]) === "string" ? y[field].toLowerCase() : y[field];

                  		if(order === "DESC") {
                      		return v1 == v2 ? 0 : (v1 < v2 ? 1 : -1);
                  		} else {
                      		return v1 == v2 ? 0 : (v1 > v2 ? 1 : -1);
                  		}
              		};
                }
		  
		};

		this.File = File;
		function File(file_name) {
				var syncing = false;
				var syncing_added_data = {};

				var time_extension = 0;
				var time_last_read = 0;

				var file_stats;
				var data_object = {};

				this.query = function (param) {
						return toDataArray(query(param));
				};

				function query(param) {
						if (typeof param == 'function') {
								return queryByFunction(param);
						}
						if (typeof param == 'undefined'|| param == null) {
								return data_object;
						}
						return queryByValue(param);
				}

				this.remove = remove;

				function remove(param) {
						schedule_sync();
						var result = query(param);
						for (key in result) {
								delete data_object[key];
						}
				};

				this.update = function (param, value) {
						var result = query(param);
						var data;
						for (key in result) {
								data = clone(result[key]);
								for (field in value) {
										data[field] = value[field];
								}
								remove(data_object[key]);
								insert(data);
						}
				};

				function queryByFunction(func) {
						var result = {};
						for (key in data_object) {
								if (func(clone(data_object[key]))){
										result[key] = data_object[key];
								}
						}
						return result;
				}

				function queryByValue(params) {
						var result = {};
						var found;
						for (key in data_object) {
								found = false;
								for (field in params) {
										if (data_object[key][field] === params[field]) {
												found = true;
										}
								}
								if (found) {
										result[key] = data_object[key];
								}
						}
						return result;
				}

				function getNextId() {
						var time = (new Date())
								.getTime() + "";
						time_extension++;
						var increment = time_extension % 1000;
						if (increment < 100){
								if(increment < 10){
										return time + '00' + increment;
								}
								return time + '0' + increment;
						}
						return time + increment;
				}

				function schedule_sync() {
						if (!syncing) {
								syncing = true;
								//schedule a sync right after all code was executed
								setTimeout(sync,0);
						}
				}

				this.insert = insert;

				function insert(data) {
						schedule_sync();
						data_object[getNextId()] = data;
				}

				function sync(){
						syncing = false;
						var time = (new Date())
								.getTime();
						var old_versionTag = "0";
						if(file_stats){
							old_versionTag = file_stats.versionTag;
						}
						readStat(function () {
								//New version Online -> Merge needed
								if (old_versionTag !== file_stats.versionTag) {
										//Read new Fileversion and merge them together
										var old_data = clone(data_object);
										readFile(function () {
												data_object = merge(old_data, data_object);
												time_last_read = time;
												writeFile();
										});
								} else {
										//upload the new Data
										time_last_read = time;
										writeFile();
								}
						});
				}

				this.getVersionTag = function () {
						return file_stats.versionTag;
				};

				this.getSize = function () {
						var syncing_length = 0;
						if(syncing_added_data){
								syncing_length = JSON.stringify(syncing_added_data).length;
						}
						return JSON.stringify(data_object).length + syncing_length;
				};

				this.getName = function () {
						return file_name;
				};

				this.getData = function () {
						return clone(data_object);
				};

				this.getDataArray = getDataArray;

				function getDataArray() {
						return toDataArray(data_object);
				}

				function toDataArray(object) {
						var array = [];
						for (key in object) {
								array.push(object[key]);
						}
						return clone(array);
				}

				this.readFile = readFile;
				function readFile(callback) {
						client.readFile(file_name, function (err, data, stats) {
								if(error(err,callback)){
										data_object = JSON.parse(data);
										file_stats = stats;
										call(callback);
								}
						});
				}

				function writeFile(callback) {
						client.writeFile(file_name, JSON.stringify(data_object), function (err, stats) {
								if(error(err,callback)){
										file_stats = stats;
										call(callback);
								}
						});
				}

				function readStat(callback) {
						client.stat(file_name, function (err, stats) {
								if(error(err,callback)){
										file_stats = stats;
										call(callback);
								}
						});
				}

				function error(err,callback){
						var result = true;
						if(err){
								switch(err.status){
										case 404: //File not Found
												result = false;
												console.log("File not found - creating new file");
												writeFile(callback);
												break;
										case  503: //Too Many Requests
												result = false;
												console.log("Too many requests - try again in 1000ms");
												setTimeout(sync,1000);
												break;
										default:
												console.error(err);
												result = false;

								}
						}
						return result;
				}

				function merge(objA, objB) {
						console.log("MERGING");
						var obj_merged = {};
						var time;
						for (key in objB) {
								//Both have same entry
								if (objA[key]) {
										obj_merged[key] = objB[key];
								}
								//enty only in B
								if (objA[key] === undefined) {
										time = parseInt(key.substring(0, 13));
										if (time > time_last_read) { //Oject was added
												obj_merged[key] = objB[key];
										} //else -> Object was deleted
								}
						}
						for (key in objA) {
								//enty only in A
								if (objA[key] === undefined) {
										time = parseInt(key.substring(0, 13));
										if (time > time_last_read) { //Oject was added
												obj_merged[key] = objA[key];
										} //else -> Object was deleted
								}
						}
						return obj_merged;
				}


		}


}
