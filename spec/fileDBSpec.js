describe("Connectivity", function() {

    var db;

    beforeEach(function() {
        db = new FileDB(APP_KEY);
    });

    it("should be available", function() {
        expect(db).toBeDefined();
    });

    it("should connect to Dropbox", function(done) {
        db.setupDropbox(function() {
            expect(true).toBe(true);
            done();
        });
    });

});

describe("Tables", function() {

    var db;

    var tablename = 'test';
    var columns = ['a', 'b'];
    var testdata = {
        a: 100,
        b: "abc"
    };

    beforeAll(function(done) {
        db = new FileDB(APP_KEY);
        db.setupDropbox(done);
    });

    it("should create a new table", function() {
        db.createTable(tablename, columns);

        expect(db.query(tablename, null)).toEqual([]);
    });

    it("should insert properly", function() {
        db.insert(tablename, testdata);

        expect(db.rowCount(tablename)).toEqual(1);
        expect(db.query(tablename, null)[0]).toEqual(testdata);
        expect(db.queryAll(tablename, {})[0]).toEqual(testdata);
        expect(db.query(tablename, {
            a: "5"
        }).length).toEqual(0);
    });
})
