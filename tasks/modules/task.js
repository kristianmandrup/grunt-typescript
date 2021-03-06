var option = require('./option');
var host = require('./host');

function prepareStackTrace(error, structuredStackTrace) {
  var lines = [];
  for (var _i = 0; _i < structuredStackTrace.length; _i++) {
    var trace = structuredStackTrace[_i];
    lines.push((trace.getMethodName() || trace.getFunctionName() || '<anonymous>') + '[L' + trace.getLineNumber() + '] ');
  }
  return lines;
  //
  //   structuredStackTrace[0];
  //  console.log(structuredStackTrace);
  //
  //
  //
  //  return {
  //    // method name
  //    name: trace.getMethodName() || trace.getFunctionName() || '<anonymous>',
  //    // file name
  //    file: trace.getFileName(),
  //    // line number
  //    line: trace.getLineNumber(),
  //    // column number
  //    column: trace.getColumnNumber()
  //  };
}

function getTrace(caller) {
  var err = Error,
    original = err.prepareStackTrace,
    error = {};
  err.captureStackTrace(error, caller || getTrace);
  err.prepareStackTrace = prepareStackTrace;
  var stack = error.stack;
  err.prepareStackTrace = original;
  return stack;
}
var Task = (function () {
  function Task(_grunt, _source, _gruntFile) {
    this._grunt = _grunt;
    this._source = _source;
    this._gruntFile = _gruntFile;
    this._initTime = 0;
    this._initTime = Date.now();
  }
  Task.prototype.getGrunt = function () {
    return this._grunt;
  };
  Task.prototype.getOptions = function () {
    if (!this._options) {
      this._options = option.createGruntOption(this._source, this._grunt, this._gruntFile, this);
    }
    return this._options;
  };
  Task.prototype.getHost = function () {
    if (!this._host) {
      this._host = host.createHost(this._grunt, this.getOptions(), this);
    }
    return this._host;
  };
  Task.prototype.verbose = function (message, stack) {
    this._grunt.verbose.writeln((message + ' [' + (Date.now() - this._initTime) + 'ms]').grey);
    if (stack) {
      this._grunt.verbose.writeln(getTrace().join('\n').grey);
    }
  };
  return Task;
})();
exports.Task = Task;
