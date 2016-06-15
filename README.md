# xsslint

[<img src="https://travis-ci.org/jenseng/xsslint.svg" />](http://travis-ci.org/jenseng/xsslint)

Find potential XSS vulnerabilities in your ~~jquery spaghetti~~ beautiful
code, e.g.

```javascript
$('h2').html("Hello <i>" + unsafeVar + "</i>")
```

By default, xsslint evaluates any jQuery function/method calls that accept
html content (`$`, `.html`, `.append`, etc.) as well as any string
concatenation with html-y literals, but it can be easily customized to
suit your needs.

# installation

```bash
npm install xsslint
```

# usage

xsslint's API is simple; it accepts a filename and returns an array of
warning objects for that file. To lint your whole codebase, you'll want a
little bit of glue code like so:

```javascript
var glob = require("glob");
var XSSLint = require("xsslint");
var files = glob.sync("path/to/files/**/*.js");
files.forEach(function(file) {
  var warnings = XSSLint.run(file);
  warnings.forEach(function(warning) {
    console.error(file + ":" + warning.line + ": possibly XSS-able `" + warning.method + "` call");
  });
});
```

This will print out a bunch of warnings like:

```
foo.js:123: possibly XSS-able `html()` call
```

## and then?

Given a list of warnings, you'll want to evaluate each one, and then:

1. If it's an actual problem, fix it.
2. If it's a false positive, flag it as such, e.g.
   * Set your own global [`XSSLint.configure`](https://github.com/jenseng/xsslint/blob/931bd637/main.js#L20) to match your conventions.
     For example, if you prefix jQuery object variables with a `$`, and
     you have an html-escaping function called `htmlEscape`, you'd want:

     ```javascript
      XSSLint.configure({
        "jqueryObject.identifier": /^\$/,
        "safeString.function":     "htmlEscape"
     });
     ```
   * Set your own file-specific config overrides via comment, e.g.

     ```javascript
      // xsslint jqueryObject.property jQ
      // xsslint safeString.property /Html$/
     ```

   See the [default configuration](https://github.com/jenseng/xsslint/blob/931bd637/main.js#L20) to get an idea what kinds of things
   can be set, or check out this [real world usage](https://github.com/instructure/canvas-lms/commit/70cdc92bdb992e5c207d62dcdc0224e117c2fac0).


# real world example

Running xsslint on [canvas-lms](https://github.com/instructure/canvas-lms)
with some [custom configuration](https://github.com/instructure/canvas-lms/blob/70cdc92bdb992e5c207d62dcdc0224e117c2fac0/script/xsslint.js#L6)
uncovered [8 cross-site scripting vulnerabilities](https://github.com/instructure/canvas-lms/compare/37a97e7e2fb07959272894f552e96605e4060087...426fc9b1e88743f2a162f20f2785660637573731).
It also identified [dozens of potentially problematic areas](https://github.com/instructure/canvas-lms/commit/70cdc92bdb992e5c207d62dcdc0224e117c2fac0).

# license

Copyright (c) 2015 Jon Jensen, released under the MIT license
