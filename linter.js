var esprima    = require("esprima");
var estraverse = require("estraverse");
var fs         = require("fs");

function identifierMatches(string, pattern) {
  if (!pattern) {
    return true;
  } else if (pattern instanceof RegExp) {
    return string.match(pattern);
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
  var method = callee.property || callee;
  method = method.name;

  if (!this.isXssableCall(node)) return;
  if (node.arguments.every(this.isSafeExpression.bind(this, method))) return;

  var line = callee.loc.start.line;
  console.log(this.file + ":" + line + ": possibly XSS-able " + method + " call");
};

Linter.prototype.isXssableCall = function(node) {
  if (this.isXssableFunction(node)) return true;
  if (this.isXssableMethod(node)) return true;
  return false;
};

Linter.prototype.isXssableFunction = function(node) {
  return this.functionMatches(node, "xssable");
};

Linter.prototype.isXssableMethod = function(node) {
  return this.methodMatches(node, "xssable") &&
         !this.identifierMatches(node.callee.object, "xssable", ".whitelist");
};

Linter.prototype.isSafeExpression = function(method, node) {
  if (!node) return true;
  if (this.isSafeString(node)) return true;
  if (this.isJQueryObject(node)) return true;
  // TODO: make this configurable somehow
  if (method === "$") {
    if (this.isSelectorExpression(node)) return true;
  }
  return false;
};

Linter.prototype.isSelectorExpression = function(node) {
  var acceptableTypes = ["MemberExpression", "Identifier", "CallExpression", "ThisExpression", "FunctionExpression", "ObjectExpression", "ArrayExpression"];
  if (acceptableTypes.indexOf(node.type) >= 0) return true;

  if (node.type === "BinaryExpression" || node.type === "AssignmentExpression" || node.type === "LogicalExpression") {
    if (this.isSelectorExpression(node.left)) return true;
    if (node.left.type === "Literal" && node.left.value[0] !== "<") return true;
  }

  return false;
};

Linter.prototype.isSafeString = function(node) {
  if (node.type === "Literal") return true;
  if (this.identifierMatches(node, "safeString")) return true;
  if (this.propertyMatches(node, "safeString")) return true;
  if (this.functionMatches(node, "safeString")) return true;
  if (this.methodMatches(node, "safeString")) return true;
  if (this.isSafeStringConcatenation(node)) return true;
  return false;
};

Linter.prototype.identifierMatches = function(node, type, suffix) {
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

Linter.prototype.propertyMatches = function(node, type, suffix) {
  if (node.type !== "MemberExpression") return false;
  suffix = suffix || ".property"
  var patterns = this.config.properties[type + suffix] || [];
  var receiver = node.object.name;
  var property = node.property.name;
  if (!property) return false;

  for (var i = 0, len = patterns.length; i < len; i++) {
    if (propertyMatches(receiver, property, patterns[i]))
      return true;
  };
  return false;
};

Linter.prototype.functionMatches = function(node, type) {
  if (node.type !== "CallExpression") return false;
  return this.identifierMatches(node.callee, type, ".function")
};

Linter.prototype.methodMatches = function(node, type) {
  if (node.type !== "CallExpression") return false;
  return this.propertyMatches(node.callee, type, ".method");
};

Linter.prototype.isSafeStringConcatenation = function(node) {
  if (node.type !== "BinaryExpression") return false;
  if (node.operator !== "+") return false;
  if (!this.isSafeString(node.left)) return false;
  if (!this.isSafeString(node.right)) return false;
  return true;
};

Linter.prototype.isJQueryObject = function(node) {
  if (this.identifierMatches(node, "jqueryObject")) return true;
  if (this.propertyMatches(node, "jqueryObject")) return true;
  if (this.functionMatches(node, "jqueryObject")) return true;
  if (this.methodMatches(node, "jqueryObject")) return true;
  if (this.isSafeCallChain(node)) return true;
  return false;
};

Linter.prototype.isSafeCallChain = function(node) {
  if (node.type === "CallExpression" && node.callee.type === "MemberExpression" && this.isJQueryObject(node.callee.object))
    return true;
  return false;
};

module.exports = Linter;
