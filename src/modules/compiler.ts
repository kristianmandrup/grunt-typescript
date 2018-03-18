import * as ts from 'typescript';
import * as gts from './task';
import * as util from './util';
import * as watche from './watcher';
import * as Promise from 'bluebird';

let _os: NodeJS.OS = require('os');

export function execute(task: gts.Task): Promise<any> {

  const options = task.getOptions()
  const promise = new Promise<any>((resolve, reject) => {
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

function watch(task: gts.Task): void {
  const options = task.getOptions()
  const watchOpt: any = options.watch || {}
  const watchPath = watchOpt.path
  const startCompile = (files: string[] = []) => {
    return runTask(task, watchOpt.before).then(() => {
      if (!recompile(task, files)) {
        task.getHost().reset(files);
      }
      return runTask(task, watchOpt.after);
    }).then(function () {
      writeWatching(watchPath);
    });
  }
  const watcher = watche.createWatcher(watchPath, (files, done) => {
    try {
      startCompile(Object.keys(files))
    } catch (err) {

    }
    done()
  });

  if (watchOpt.atBegin) {
    try {
      startCompile()
    } catch (err) {
    }
    watcher.start();
  } else {
    watcher.start();
  }
}

function writeWatching(watchPath: string[]): void {
  util.write('');
  util.write('Watching... ' + watchPath);
}

function recompile(task: gts.Task, updateFiles: string[] = []): boolean {

  task.verbose('--task.recompile');

  task.getHost().reset(updateFiles);
  return compile(task);
}

function runTask(task: gts.Task, tasks: string[]): Promise<any> {

  let grunt = task.getGrunt();

  task.verbose('--task.runTask');

  return asyncEach<string>(tasks, (taskName: string, index: number, next: () => void) => {

    task.verbose('  external task start: ' + taskName);

    let flags = grunt.option.flags().map(f => !!f ? f + '' : '');

    grunt.util.spawn({
      cmd: taskName,
      grunt: true,
      args: [taskName].concat(flags),
      opts: { stdio: 'inherit' }
    }, (err, result, code) => {

      task.verbose('external task end: ' + task);

      next();
    });
  });
}

function asyncEach<T>(items: T[], callback: (item: T, index: number, next: () => void) => void): Promise<any> {
  return new Promise<any>((resolve, reject) => {
    let length = items.length,
      exec = (i: number) => {
        if (length <= i) {
          resolve(undefined);
          return;
        }
        let item = items[i];
        callback(item, i, () => {
          i = i + 1;
          exec(i);
        });
      };
    exec(0);
  });
}

function compile(task: gts.Task): boolean {

  let start = Date.now(),
    options = task.getOptions(),
    host = task.getHost(),
    targetFiles = getTargetFiles(options);

  task.verbose('- write tsconfig.json');
  writeTsConfig(options, targetFiles, task);

  task.verbose('- create program');

  let program = ts.createProgram(targetFiles, options.tsOptions, host);
  let diagnostics = program.getSyntacticDiagnostics();

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
  let emitOutput = program.emit();
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

function getTargetFiles(options: gts.CompilerOptions): string[] {

  let codeFiles = options.targetFiles(),
    libFiles: string[] = options.references();

  return libFiles.concat(codeFiles);
}

function reportDiagnostic(diagnostic: ts.Diagnostic, isWarn = false) {
  let output = '',
    newLine = _os.EOL;

  if (diagnostic.file) {
    var loc = ts.getLineAndCharacterOfPosition(diagnostic.file, diagnostic.start || 0);

    output += `${diagnostic.file.fileName}(${loc.line + 1},${loc.character + 1}): `;
  }

  var category = ts.DiagnosticCategory[diagnostic.category].toLowerCase();
  output += `${category} TS${diagnostic.code}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, newLine)}${newLine}`;

  if (isWarn) {
    util.writeWarn(output);
  } else {
    util.writeError(output);
  }
}

function reportDiagnostics(diagnostics: ReadonlyArray<ts.Diagnostic>, isWarn = false) {
  for (let d of diagnostics) {
    reportDiagnostic(d, isWarn);
  }
}


function writeTsConfig(options: gts.CompilerOptions, targetFiles: string[], logger: gts.Logger): void {

  if (!options.generateTsConfig) {
    return;
  }

  let outputDir = util.getCurrentDirectory();

  if (typeof options.generateTsConfig === 'string') {
    outputDir = util.abs(options.generateTsConfig.toString());
  }

  let outputFile = util.combinePaths(outputDir, 'tsconfig.json');

  logger.verbose(`  dir: ${outputDir}, file: ${outputFile}`);

  let tsOpts = options.tsOptions;

  function targetVersion(optsTarget: ts.ScriptTarget = ts.ScriptTarget.ES2015): string {
    if (optsTarget === ts.ScriptTarget.ES3) return 'es3'
    if (optsTarget === ts.ScriptTarget.ES5) return 'es5'
    if (optsTarget === ts.ScriptTarget.ES2015) return 'es2015'
    if (optsTarget === ts.ScriptTarget.ES2016) return 'es2016'
    if (optsTarget === ts.ScriptTarget.ES2017) return 'es2017'
    if (optsTarget === ts.ScriptTarget.ES2018) return 'es2018'
    if (optsTarget === ts.ScriptTarget.ESNext) return 'esnext'
    return 'es5'
  }
  let config = {
    compilerOptions: {
      removeComments: tsOpts.removeComments,
      sourceMap: tsOpts.sourceMap,
      declaration: tsOpts.declaration,
      out: tsOpts.out,
      outDir: tsOpts.outDir,
      noLib: tsOpts.noLib,
      noImplicitAny: tsOpts.noImplicitAny,
      noResolve: tsOpts.noResolve,
      target: targetVersion(tsOpts.target),
      rootDir: tsOpts.rootDir,
      module: tsOpts.module === ts.ModuleKind.AMD ? 'amd' :
        tsOpts.module === ts.ModuleKind.CommonJS ? 'commonjs' :
          tsOpts.module === ts.ModuleKind.System ? 'system' :
            tsOpts.module === ts.ModuleKind.UMD ? 'umd' : undefined,
      preserveConstEnums: tsOpts.preserveConstEnums,
      noEmitOnError: tsOpts.noEmitOnError,
      suppressImplicitAnyIndexErrors: tsOpts.suppressImplicitAnyIndexErrors,
      emitDecoratorMetadata: tsOpts.emitDecoratorMetadata,
      newLine: tsOpts.newLine === ts.NewLineKind.CarriageReturnLineFeed ? 'crlf' :
        tsOpts.newLine === ts.NewLineKind.LineFeed ? 'lf' : undefined,
      inlineSourceMap: tsOpts.inlineSourceMap,
      inlineSources: tsOpts.inlineSources,
      noEmitHelper: tsOpts.noEmitHelpers
    },
    files: targetFiles.map(targetFile => util.normalizePath(util.relativePath(outputDir, targetFile)))
  };

  util.createDirectoryRecurse(outputDir);
  util.writeFile(outputFile, JSON.stringify(config, null, '    '));

  util.writeInfo(`tsconfig.json generated: ${outputFile}`);
}
