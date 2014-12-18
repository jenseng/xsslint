# xsslint

Find potential vulneribilities in your ~~jquery spaghetti~~ beautiful code,
e.g.

```javascript
$('h2').html("Hello <i>" + unsafeVar + "</i>")
```

# installation

```bash
npm install xsslint
```

# usage

```javascript
var glob = require("glob");
var XSSLint = require("xsslint");
var files = glob.sync("path/to/files/**/*.js");
files.forEach(function(file) {
  XSSLint.run(file);
});
```

This will give you a bunch of warnings like:

```
foo.js:123: possibly XSS-able `html()` call
```

Evaluate each one, and either:

1. Fix it, if it's an actual problem
2. If it's a false positive, flag it as such, i.e.
   * Set your own global [`XSSLint.configure`](https://github.com/jenseng/xsslint/blob/dcf6ff7f/main.js#L18) to match your conventions.
     For example, if you prefix JQuery object variables with a `$`, and
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

   See the [default configuration](https://github.com/jenseng/xsslint/blob/dcf6ff7f/main.js#L18) to get an idea what kinds of things
   can be set.
