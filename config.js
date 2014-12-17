function Config(properties) {
  this.properties = properties ? deepCopy(properties) : {};
}

Config.prototype.set = function(key, value) {
  if (key[key.length - 1] === "!") {
    key = key.slice(0, -1);
    delete this.properties[key];
  }
  var values = value || [];
  if (typeof values === "string")
    values = values.split(/\s+/);
  values = values.map(normalizeSetting);
  this.properties[key] = (this.properties[key] || []).concat(values);
};

Config.prototype.copy = function() {
  return new Config(this.properties)
};

function normalizeSetting(setting) {
  setting = normalizeSettingPart(setting);
  if (setting instanceof Array)
    return {receiver: setting[0], identifier: setting[1]}
  else
    return {identifier: setting};
}

function normalizeSettingPart(setting) {
  if (setting instanceof RegExp)
    return setting;
  if (setting[0] === "/")
    return new RegExp(setting.slice(1, -1));
  if (setting.indexOf(".") >= 0)
    return setting.split(".").map(normalizeSettingPart);
  return setting;
}

function deepCopy(object) {
  if (typeof object === "string" || object instanceof RegExp) {
    return object;
  }
  else if (object instanceof Array) {
    return object.map(deepCopy);
  }
  else if (! (object instanceof RegExp)) {
    var result = {};
    for (var key in object)
      result[key] = deepCopy(object[key]);
    return result;
  }
}

module.exports = Config;
