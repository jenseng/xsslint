var assert = require("chai").assert;
var Linter = require("../linter");


describe("Linter", function() {
  describe("comment directives", function() {
    it("should be evaluated", function() {
      var linter = new Linter("//xsslint safeString.identifier foo /bar/");
      assert.deepEqual(
        linter.config.properties["safeString.identifier"],
        [{identifier: "foo"}, {identifier: /bar/}]
      );
    });
  });
});
