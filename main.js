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
    return linter.run();
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
