var Config = require("./config");
var Linter = require("./linter");
var fs = require("fs");

XSSLint = {
  config: new Config,

  configure: function(properties) {
    for (key in properties)
      this.config.set(key, properties[key]);
  },

  run: function(file) {
    var source = fs.readFileSync(file);
    var linter = new Linter(source, this.config);
    var warnings = linter.run();
    for (var i = 0, len = warnings.length; i < len; i++) {
      var warning = warnings[i];
      console.log(file + ":" + warning.line + ": possibly XSS-able `" + warning.method + "()` call");
    }
  }
};

XSSLint.configure({
  "xssable.function":           ["$", "jQuery"],
  "xssable.method":             ["append", "prepend", "html", "$", "before", "after"],
  "xssable.receiver.whitelist": [],
  "jqueryObject.identifier":    [],
  "jqueryObject.property":      ["el"],
  "jqueryObject.function":      ["$"],
  "jqueryObject.method":        [],
  "safeString.identifier":      [],
  "safeString.property":        ["length"],
  "safeString.function":        [],
  "safeString.method":          ["html"]
});

module.exports = XSSLint;
