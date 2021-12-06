var assert = require("chai").assert;
var Linter = require("../linter");
var Config = require("../config");
var XSSLint = require("../main");

function lint(source) {
  var linter = new Linter(source, XSSLint.config)
  return linter.run();
}

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

  describe("multiple arguments", function() {
    it("should check all of them", function() {
      assert.lengthOf(lint("foo.html('ok', 'ok')"), 0);
      assert.lengthOf(lint("foo.html('ok', 'ok', notOk)"), 1);
    });
  });

  describe("arrays", function() {
    it("should check each element", function() {
      assert.lengthOf(lint("foo.html(['ok', 'ok'])"), 0);
      assert.lengthOf(lint("foo.html(['ok', 'ok', notOk])"), 1);
    });
  });

  describe("logical expressions", function() {
    it("should check both sides", function() {
      assert.lengthOf(lint("foo.html('foo' || 'bar')"), 0);
      assert.lengthOf(lint("foo.html('foo' || 'bar')"), 0);
      assert.lengthOf(lint("foo.html(foo || 'bar')"), 1);
      assert.lengthOf(lint("foo.html('foo' || bar)"), 1);
    });
  });

  describe("ternary expressions", function() {
    it("should check both possibilities", function() {
      assert.lengthOf(lint("foo.html(orly ? 'foo' : 'bar')"), 0);
      assert.lengthOf(lint("foo.html(orly ? foo : 'bar')"), 1);
      assert.lengthOf(lint("foo.html(orly ? 'foo' : bar)"), 1);
    });
  });

  describe("assignment expressions", function() {
    it("should check the right hand side", function() {
      assert.lengthOf(lint("foo.html(foo = 'bar')"), 0);
      assert.lengthOf(lint("foo.html(foo = bar)"), 1);
    });
  });

  describe("strings", function() {
    describe("literals", function() {
      it("should be ok", function() {
        assert.lengthOf(lint("foo.html('ohai')"), 0);
        assert.lengthOf(lint("foo.html(123)"), 0);
        assert.lengthOf(lint("foo.html(true)"), 0);
      });
    });

    describe("concatenation", function() {
      it("should accept safe strings", function() {
        assert.lengthOf(lint("foo.html('ohai ' + 'you')"), 0);
        assert.lengthOf(lint("foo.html('<b>so bold</b>')"), 0);
      });

      it("should reject unsafe strings", function() {
        assert.lengthOf(lint("foo.html('ohai ' + unsafe)"), 1);
        assert.lengthOf(lint("foo.html('<b>ohai</b> ' + unsafe)"), 1);
      });

      it("should reject unsafe strings as part of a standalone html snippet", function() {
        assert.lengthOf(lint("var foo = '<b>' + unsafe + '</b>'"), 1);
        assert.lengthOf(lint("var foo = '<b>' + ' ' + unsafe + ' ' + '</b>'"), 1);
        assert.lengthOf(lint("var foo =  unsafe + ' ' + '<img>'"), 1);
        assert.lengthOf(lint("var foo = '<img>' + ' ' + unsafe"), 1);
        assert.lengthOf(lint("var foo = '<img>' + (' ' + unsafe)"), 1);
      });
    });
  });

  describe("template literals", function() {
    it("should accept safe template literals", function() {
      assert.lengthOf(lint("foo.html(`ohai`)"), 0);
      assert.lengthOf(lint("foo.html(`<b>so bold</b>`)"), 0);
      assert.lengthOf(lint("foo.html(`ohai ${'you'}`)"), 0);
    });

    it("should reject unsafe template literals", function() {
      assert.lengthOf(lint("foo.html(`ohai ${unsafe}`)"), 1);
      assert.lengthOf(lint("foo.html(`<b>ohai</b> ${unsafe}`)"), 1);
      assert.lengthOf(lint("foo.html(opaqueTag`ohai`)"), 1);
    });

    it("should reject unsafe template literals as part of a standalone html snippet", function() {
      assert.lengthOf(lint("var foo = `<b>${unsafe}</b>`"), 1);
      assert.lengthOf(lint("var foo = `${unsafe} <img>`"), 1);
      assert.lengthOf(lint("var foo = `<img> ${unsafe}`"), 1);
    });
  });

  describe('allow import/export', function () {
    it('should allow import statements', function () {
        assert.lengthOf(lint("import jQuery from 'jQuery'"), 0);
    });

    it('should allow export statements', function () {
        assert.lengthOf(lint("export function a() { return 'a'; }"), 0);
    });
  });

  describe("jQuery objects", function() {
    it("should be ok", function() {
      assert.lengthOf(lint("foo.html($('div'))"), 0);
    });

    it("should evaluate method chains", function() {
      assert.lengthOf(lint("foo.html($('div').clone().hide())"), 0);
      assert.lengthOf(lint("foo.html(unknown.clone().hide())"), 1);
    });
  });

  describe("$()", function() {
    it("should allow functions", function() {
      assert.lengthOf(lint("$(function(){})"), 0);
      assert.lengthOf(lint("$(()=>{})"), 0);
    });

    it("should allow things that look safe", function() {
      assert.lengthOf(lint("$(template)"), 0);
      assert.lengthOf(lint("$(template())"), 0);
      assert.lengthOf(lint("$(this)"), 0);
      assert.lengthOf(lint("$(this.el)"), 0);
    });

    it("should check for html-y concatenation/templates", function() {
      assert.lengthOf(lint("$('<b>' + unknown + '</b>')"), 1);
      assert.lengthOf(lint("$(`<b>${unsafe}</b>`)"), 1);
    });

    it("should allow selector-y concatenation/templates", function() {
      assert.lengthOf(lint("$('.foo_' + unknown)"), 0);
      assert.lengthOf(lint("$(selectorPrefix + unknown)"), 0);
      assert.lengthOf(lint("$(`#foo_${id}`)"), 0);
    });

    it("should validate the html attribute", function() {
      assert.lengthOf(lint("$('<div />', {html: 'ohai'})"), 0);
      assert.lengthOf(lint("$('<div />', {html: unsafe})"), 1);
    });
  });
});
