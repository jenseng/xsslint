var assert = require("chai").assert;
var Linter = require("../linter");
var Config = require("../config");

describe("Linter", function() {
  describe("comment directives", function() {
    it("should be evaluated", function() {
      var linter = new Linter("//xsslint safeString.identifier foo /bar/");
      assert.deepEqual(
        linter.config.properties["safeString.identifier"],
        [{identifier: "foo"}, {identifier: /bar/}]
      );
    });

    it("should augment existing settings", function() {
      var config = new Config;
      config.set("safeString.identifier", "foo");
      var linter = new Linter("//xsslint safeString.identifier bar", config);
      assert.deepEqual(
        linter.config.properties["safeString.identifier"],
        [{identifier: "foo"}, {identifier: "bar"}]
      );
    });

    it("should replace existing settings if set with a !", function() {
      var config = new Config;
      config.set("!safeString.identifier", "foo");
      var linter = new Linter("//xsslint safeString.identifier bar", config);
      assert.deepEqual(
        linter.config.properties["safeString.identifier"],
        [{identifier: "bar"}]
      );
    });
  });
});
