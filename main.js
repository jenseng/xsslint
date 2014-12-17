var Config = require("./config");
var Linter = require("./linter");

XSSLint = {
  config: new Config,

  configure: function(properties) {
    for (key in properties)
      this.config.set(key, properties[key]);
  },

  run: function(file) {
    var linter = new Linter(file, this.config);
    linter.run();
  }
};

XSSLint.configure({
  xssables:                  "append prepend html",
  "jqueryObject.identifier": null,
  "jqueryObject.property":   "el",
  "jqueryObject.function":   "$",
  "jqueryObject.method":     null,
  "safeString.identifier":   null,
  "safeString.property":     null,
  "safeString.function":     null,
  "safeString.method":       null
});

module.exports = XSSLint;
