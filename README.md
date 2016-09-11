# JS Database Layer for Dropbox File API
Adds a simple database layer, based on the API by knadh/localStorageDB, with SQL-like capabilities to query JSON-based data.
It stores the data directly in Dropbox for given app key. The authentication and token storage process is completely handled by the library, using the Dropbox API.
Currently it still uses Dropbox Datastores API v1, which was deprecated back in July, 2016. A migration to APIv2 is planned.

## API
The API methods are based on the capabilities provided in localStorageDB project:
https://github.com/knadh/localStorageDB
Anyway, not all API methods from localStorageDB are implemented in this project, but most functionality needed for productive use is available.
Also, the `commit()` method was dropped, data will be directly synchronized after every write operation.

## Usage

### Initialize database
This will initialize the connection to Dropbox, handle the authentication redirect, and after successful login redirect back to the application.
```js
var appKey = 'your_dropbox_app_key';
var db = new FileDB(appKey);
```

### Use database
After authentication, the database methods can be used on the library object, mostly as defined in localStorageDB.
```js
// example: query products that are out of stock
var order = db.queryAll('products', {
  query: { stock: 0 }
});
```
