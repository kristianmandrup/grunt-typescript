var ts = require('typescript');
var util = require('./util');
var watche = require('./watcher');
var Promise = require('bluebird');
var _os = require('os');
var path = require('path');

function execute(task) {
  var host = task.getHost(),
    options = task.getOptions(),
    promise = new Promise(function (resolve, reject) {
      if (options.watch) {
        watch(task);
      } else {
        try {
          if (compile(task)) {
            resolve(undefined);
          } else {
            reject(false);
          }
        } catch (e) {
          reject(false);
        }
      }
    });
  return promise;
}
exports.execute = execute;

function watch(task) {
  var options = task.getOptions(),
    watchOpt = options.watch,
    watchPath = watchOpt.path,
    targetPaths = {},
    startCompile = function (files) {
      return runTask(task, watchOpt.before).then(function () {
        if (!recompile(task, files)) {
          //失敗だった場合はリセット
          task.getHost().reset(files);
        }
        return runTask(task, watchOpt.after);
      }).then(function () {
        writeWatching(watchPath);
      });
    },
    watcher = watche.createWatcher(watchPath, function (files, done) {
      startCompile(Object.keys(files)).finally(function () {
        done();
      });
    });
  if (watchOpt.atBegin) {
    startCompile().finally(function () {
      watcher.start();
    });
  } else {
    watcher.start();
  }
}

function writeWatching(watchPath) {
  util.write('');
  util.write('Watching... ' + watchPath);
}

function recompile(task, updateFiles) {
  if (updateFiles === void 0) {
    updateFiles = [];
  }
  task.verbose('--task.recompile');
  task.getHost().reset(updateFiles);
  return compile(task);
}

function runTask(task, tasks) {
  var grunt = task.getGrunt();
  task.verbose('--task.runTask');
  return asyncEach(tasks, function (taskName, index, next) {
    task.verbose('  external task start: ' + taskName);
    var flags = grunt.option.flags().map(function (f) {
      return !!f ? f + '' : '';
    });
    grunt.util.spawn({
      cmd: undefined,
      grunt: true,
      args: [taskName].concat(flags),
      opts: {
        stdio: 'inherit'
      }
    }, function (err, result, code) {
      task.verbose('external task end: ' + task);
      next();
    });
  });
}

function asyncEach(items, callback) {
  return new Promise(function (resolve, reject) {
    var length = items.length,
      exec = function (i) {
        if (length <= i) {
          resolve(undefined);
          return;
        }
        var item = items[i];
        callback(item, i, function () {
          i = i + 1;
          exec(i);
        });
      };
    exec(0);
  });
}

function clean(obj) {
  Object.getOwnPropertyNames(obj).forEach(function (prop) {
    if (typeof (obj[prop]) === 'undefined') {
      delete obj[prop];
    }
  });
  return obj;
}

function compile(task) {
  var start = Date.now(),
    options = task.getOptions(),
    host = task.getHost(),
    targetFiles = getTargetFiles(options);
  task.verbose('- write tsconfig.json');
  writeTsConfig(options, targetFiles, task);
  if (options.useTsConfig) {
    task.verbose('- parsing tsconfig.json');
    var json = task.getGrunt().file.readJSON(options.useTsConfig);
    var parsedOpts = ts.parseJsonConfigFileContent(json, ts.sys, path.dirname(options.useTsConfig), clean(options.tsOptions));
    options.tsOptions = parsedOpts.options;
    targetFiles = parsedOpts.fileNames;
  }
  task.verbose('- create program');
  var program = ts.createProgram(targetFiles, options.tsOptions, host);
  var diagnostics = program.getSyntacticDiagnostics();
  reportDiagnostics(diagnostics);
  if (diagnostics.length) {
    return false;
  }
  if (diagnostics.length === 0) {
    diagnostics = program.getGlobalDiagnostics();
    reportDiagnostics(diagnostics);
    if (diagnostics.length === 0) {
      diagnostics = program.getSemanticDiagnostics();
      reportDiagnostics(diagnostics);
    }
  }
  if (diagnostics.length) {
    return false;
  }
  if (options.tsOptions.noEmit) {
    host.writeResult(Date.now() - start);
    return true;
  }
  task.verbose('- emit');
  var emitOutput = program.emit();
  reportDiagnostics(emitOutput.diagnostics);
  if (emitOutput.diagnostics.length) {
    return false;
  }
  if (emitOutput.emitSkipped) {
    task.verbose('  emit skipped');
  }
  host.writeResult(Date.now() - start);
  return true;
}

function getTargetFiles(options) {
  var codeFiles = options.targetFiles(),
    libFiles = options.references();
  return libFiles.concat(codeFiles);
}

function reportDiagnostic(diagnostic, isWarn) {
  if (isWarn === void 0) {
    isWarn = false;
  }
  var output = '',
    newLine = _os.EOL;
  if (diagnostic.file) {
    var loc = ts.getLineAndCharacterOfPosition(diagnostic.file, diagnostic.start);
    output += diagnostic.file.fileName + '(' + (loc.line + 1) + ',' + (loc.character + 1) + '): ';
  }
  var category = ts.DiagnosticCategory[diagnostic.category].toLowerCase();
  output += category + ' TS' + diagnostic.code + ': ' + ts.flattenDiagnosticMessageText(diagnostic.messageText, newLine) + newLine;
  if (isWarn) {
    util.writeWarn(output);
  } else {
    util.writeError(output);
  }
}

function reportDiagnostics(diagnostics, isWarn) {
  if (isWarn === void 0) {
    isWarn = false;
  }
  for (var _i = 0; _i < diagnostics.length; _i++) {
    var d = diagnostics[_i];
    reportDiagnostic(d, isWarn);
  }
}

function writeTsConfig(options, targetFiles, logger) {
  if (!options.generateTsConfig) {
    return;
  }
  var outputDir = util.getCurrentDirectory();
  if (typeof options.generateTsConfig === 'string') {
    outputDir = util.abs(options.generateTsConfig.toString());
  }
  var outputFile = util.combinePaths(outputDir, 'tsconfig.json');
  logger.verbose('  dir: ' + outputDir + ', file: ' + outputFile);
  var tsOpts = options.tsOptions;
  var config = {
    compilerOptions: {
      removeComments: tsOpts.removeComments,
      sourceMap: tsOpts.sourceMap,
      declaration: tsOpts.declaration,
      out: tsOpts.out,
      outDir: tsOpts.outDir,
      noLib: tsOpts.noLib,
      noImplicitAny: tsOpts.noImplicitAny,
      noResolve: tsOpts.noResolve,
      target: tsOpts.target === 0 /* ES3 */ ? 'es3' : tsOpts.target === 1 /* ES5 */ ? 'es5' : tsOpts.target === 2 /* ES6 */ ? 'es6' : undefined,
      rootDir: tsOpts.rootDir,
      module: tsOpts.module === 2 /* AMD */ ? 'amd' : tsOpts.module === 1 /* CommonJS */ ? 'commonjs' : tsOpts.module === 4 /* System */ ? 'system' : tsOpts.module === 3 /* UMD */ ? 'umd' : undefined,
      preserveConstEnums: tsOpts.preserveConstEnums,
      noEmitOnError: tsOpts.noEmitOnError,
      suppressImplicitAnyIndexErrors: tsOpts.suppressImplicitAnyIndexErrors,
      emitDecoratorMetadata: tsOpts.emitDecoratorMetadata,
      newLine: tsOpts.newLine === 0 /* CarriageReturnLineFeed */ ? 'crlf' : tsOpts.newLine === 1 /* LineFeed */ ? 'lf' : undefined,
      inlineSourceMap: tsOpts.inlineSourceMap,
      inlineSources: tsOpts.inlineSources,
      noEmitHelper: tsOpts.noEmitHelpers
    },
    files: targetFiles.map(function (targetFile) {
      return util.normalizePath(util.relativePath(outputDir, targetFile));
    })
  };
  util.createDirectoryRecurse(outputDir);
  util.writeFile(outputFile, JSON.stringify(config, null, '    '));
  util.writeInfo('tsconfig.json generated: ' + outputFile);
}
