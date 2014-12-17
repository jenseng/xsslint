var esprima    = require("esprima");
var estraverse = require("estraverse");
var fs         = require("fs");

function identifierMatches(string, pattern) {
  if (!pattern) {
    return true;
  } else if (pattern instanceof RegExp) {
    if (string.match(pattern))
      return true;
  } else if (pattern === string) {
    return true;
  }
  return false;
}

function propertyMatches(receiver, property, pattern) {
  return identifierMatches(receiver, pattern.receiver) &&
         identifierMatches(property, pattern.identifier)
}

function Linter(file, defaults) {
  this.file = file;
  this.ast = esprima.parse(fs.readFileSync(file), {loc: true, comment: true});
  this.setOverrides(defaults);
}

Linter.prototype.setOverrides = function(defaults) {
  var config = defaults.copy();

  this.ast.comments.forEach(function(comment) {
    comment.value.split(/\n/).forEach(function(line) {
      line = line.trim().split(/\s+/);
      if (line[0] !== "xsslint") return;
      config.set(line[1], line.slice(2).join(" "));
    });
  });
  this.config = config;
}

Linter.prototype.run = function() {
  estraverse.traverse(this.ast, {
    enter: function(node) {
      if (node.type === "CallExpression")
        this.processCall(node);
    }.bind(this)
  });
};

Linter.prototype.processCall = function(node) {
  var callee = node.callee;
  var receiver = callee.object;
  var method = callee.property;

  if (this.isXssableCall(callee, receiver, method) && !this.isSafeExpression(node.arguments[0])) {
    var line = receiver.loc.start.line;
    receiver = receiver.name;
    method = method.name;
    console.log(this.file + ":" + line + ": possibly XSS-able " + method + " call");
  }
};

Linter.prototype.isXssableCall = function(node, receiver, method) {
  return node.type === "MemberExpression" &&
    !node.computed &&
    method.type === "Identifier" &&
    this.config.properties.xssables.some(function(xssable) {
      return identifierMatches(method.name, xssable.identifier);
    })
};

Linter.prototype.isSafeExpression = function(node) {
  if (!node) return true;
  if (this.isSafeString(node)) return true;
  if (this.isJQueryObject(node)) return true;
  return false;
};

Linter.prototype.isSafeString = function(node) {
  if (node.type === "Literal") return true;
  if (this.isSafeIdentifier(node, "safeString")) return true;
  if (this.isSafeProperty(node, "safeString")) return true;
  if (this.isSafeFunction(node, "safeString")) return true;
  if (this.isSafeMethod(node, "safeString")) return true;
  if (this.isSafeStringConcatenation(node)) return true;
  return false;
};

Linter.prototype.isSafeIdentifier = function(node, type, suffix) {
  if (node.type !== "Identifier") return false;
  suffix = suffix || ".identifier"
  var patterns = this.config.properties[type + suffix] || [];
  var identifier = node.name;

  for (var i = 0, len = patterns.length; i < len; i++) {
    if (identifierMatches(identifier, patterns[i].identifier))
      return true;
  };
  return false;
};

Linter.prototype.isSafeProperty = function(node, type, suffix) {
  if (node.type !== "MemberExpression") return false;
  suffix = suffix || ".property"
  var patterns = this.config.properties[type + suffix] || [];
  var receiver = node.object.name;
  var property = node.property.name;

  for (var i = 0, len = patterns.length; i < len; i++) {
    if (propertyMatches(receiver, property, patterns[i]))
      return true;
  };
  return false;
};

Linter.prototype.isSafeFunction = function(node, type) {
  if (node.type !== "CallExpression") return false;
  return this.isSafeIdentifier(node.callee, type, ".function")
};

Linter.prototype.isSafeMethod = function(node, type) {
  if (node.type !== "CallExpression") return false;
  return this.isSafeProperty(node.callee, type, ".method");
};

Linter.prototype.isSafeStringConcatenation = function(node) {
  if (node.type !== "BinaryExpression") return false;
  if (node.operator !== "+") return false;
  if (!this.isSafeString(node.left)) return false;
  if (!this.isSafeString(node.right)) return false;
  return true;
};

Linter.prototype.isJQueryObject = function(node) {
  if (this.isSafeIdentifier(node, "jqueryObject")) return true;
  if (this.isSafeProperty(node, "jqueryObject")) return true;
  if (this.isSafeFunction(node, "jqueryObject")) return true;
  if (this.isSafeMethod(node, "jqueryObject")) return true;
  if (this.isSafeCallChain(node)) return true;
  return false;
};

Linter.prototype.isSafeCallChain = function(node) {
  if (node.type === "CallExpression" && node.callee.type === "MemberExpression" && this.isJQueryObject(node.callee.object))
    return true;
  return false;
};

module.exports = Linter;
