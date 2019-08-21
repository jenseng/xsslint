var parse      = require("@babel/parser").parse;
var traverse   = require("@babel/traverse").default;
var Config     = require("./config");

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

function isHtmly(node) {
  return (node.type === "StringLiteral" && node.value.match(/<[a-zA-Z]/)) ||
         (node.type === "TemplateElement" && node.value.raw.match(/<[a-zA-Z]/));
}

function Linter(sourceOrAst, defaults) {
  if (typeof sourceOrAst === "string") {
    this.ast = parse(sourceOrAst, {plugins: ["jsx", "classProperties", "objectRestSpread"]});
  } else {
    this.ast = sourceOrAst;
  }
  this.setOverrides(defaults || new Config);

  this.isSafeString = this.isSafeString.bind(this);
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
};

Linter.prototype.run = function() {
  this.warnings = [];
  traverse(this.ast, {
    enter: function(node) {
      node = node.node;
      if (node.type === "CallExpression")
        this.processCall(node);
      else if (node.type === "BinaryExpression" && node.operator === "+")
        this.processConcatenation(node);
      else if (node.type === "TemplateLiteral")
        this.processTemplateLiteral(node);
    }.bind(this)
  });
  return this.warnings;
};

Linter.prototype.processCall = function(node) {
  var callee = node.callee;
  var method = callee.property || callee;
  method = method.name;

  if (!this.isXssableCall(node)) return;
  if (node.arguments.every(this.isSafeExpression.bind(this, method))) return;

  var line = callee.loc.start.line;
  this.warnings.push({line: line, method: method + "()"});
};

Linter.prototype.processConcatenation = function(node) {
  if (node.__alreadyFlaggedUnsafe) return;
  var components = this.flattenConcatenation(node);
  if (!components.some(isHtmly)) return;
  if (components.every(this.isSafeString)) return;

  // consume the nodes so we don't process nested stuff again
  node.left = null;
  node.right = null;

  var line = node.loc.start.line;
  this.warnings.push({line: line, method: "+"});
};

Linter.prototype.processTemplateLiteral = function(node) {
  if (node.__alreadyFlaggedUnsafe) return;
  if (!node.expressions.length) return;
  if (!node.quasis.some(isHtmly)) return;
  if (node.expressions.every(this.isSafeString)) return;

  var line = node.loc.start.line;
  this.warnings.push({line: line, method: "`"});
}

Linter.prototype.flattenConcatenation = function(node) {
  var result
  if (node.left.type === "BinaryExpression" && node.left.operator === "+")
    result = this.flattenConcatenation(node.left);
  else
    result = [node.left];
  if (node.right.type === "BinaryExpression" && node.right.operator === "+")
    result = result.concat(this.flattenConcatenation(node.right))
  else
    result.push(node.right);
  return result;
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
         !this.identifierMatches(node.callee.object, "xssable", ".receiver.whitelist") &&
         !this.propertyMatches(node.callee.object, "xssable", ".receiver.whitelist");
};

Linter.prototype.isSafeExpression = function(method, node) {
  if (!node) return true;
  if (this.isSafeArrayExpression(method, node)) return true;
  if (this.isSafeLogicalExpression(method, node)) return true;
  if (this.isSafeAssignmentExpression(method, node)) return true;
  if (this.isSafeConditionalExpression(method, node)) return true;

  if (this.isSafeString(node)) return true;
  if (this.isJQueryObject(node)) return true;
  // TODO: make this configurable somehow
  if (method === "$" || method === "jQuery") {
    if (this.isSafeJqueryExpression(node)) return true;
  }
  return false;
};

Linter.prototype.isSafeArrayExpression = function(method, node) {
  return node.type === "ArrayExpression" &&
    node.elements.every(this.isSafeExpression.bind(this, method));
}

Linter.prototype.isSafeLogicalExpression = function(method, node) {
  return node.type === "LogicalExpression" &&
    this.isSafeExpression(method, node.left) &&
    this.isSafeExpression(method, node.right);
};

Linter.prototype.isSafeAssignmentExpression = function(method, node) {
  return node.type === "AssignmentExpression" &&
    this.isSafeExpression(method, node.right);
};

Linter.prototype.isSafeConditionalExpression = function(method, node) {
  return node.type === "ConditionalExpression" &&
    this.isSafeExpression(method, node.consequent) &&
    this.isSafeExpression(method, node.alternate);
};

Linter.prototype.isSafeJqueryExpression = function(node) {
  switch (node.type) {
    case "ObjectExpression":
      var htmlOption = node.properties.filter(function(prop){
        return prop.key.name === "html";
      })[0];
      if (htmlOption) return this.isSafeExpression("html", htmlOption.value);
    case "FunctionExpression":
    case "ArrowFunctionExpression":
    case "MemberExpression":
    case "Identifier":
    case "CallExpression":
    case "ThisExpression":
      return true;
    case "BinaryExpression":
    case "TemplateLiteral":
      // might not be safe, but if it's a selector it doesn't matter, so un-mark it
      // if it's unsafe htmly stuff, we'll pick it up elsewhere
      node.__alreadyFlaggedUnsafe = false;
      return true;
  }
  return false;
};

Linter.prototype.isSafeString = function(node) {
  if (node.type === "RegExpLiteral") return true;
  if (node.type === "NullLiteral") return true;
  if (node.type === "StringLiteral") return true;
  if (node.type === "BooleanLiteral") return true;
  if (node.type === "NumericLiteral") return true;
  if (this.identifierMatches(node, "safeString")) return true;
  if (this.propertyMatches(node, "safeString")) return true;
  if (this.functionMatches(node, "safeString")) return true;
  if (this.methodMatches(node, "safeString")) return true;
  if (this.isSafeStringConcatenation(node)) return true;
  if (this.isSafeTemplateLiteral(node)) return true;
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

  if (this.isSafeString(node.left) && this.isSafeString(node.right)) return true;

  node.__alreadyFlaggedUnsafe = true;
  return false;
};

Linter.prototype.isSafeTemplateLiteral = function(node) {
  if (node.type !== "TemplateLiteral") return false;

  if (node.expressions.every(this.isSafeString)) return true;

  node.__alreadyFlaggedUnsafe = true;
  return false;
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
