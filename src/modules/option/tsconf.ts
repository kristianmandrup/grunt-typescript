import * as ts from 'typescript'
import * as util from '../util'
let _path: NodeJS.Path = require('path')
import {
  prepareWatch
} from './prepare-watch'

export function makeOpts(config: any, source: any) {
  const dest = util.normalizePath(config.dest || '')
  const singleFile = !!dest && _path.extname(dest) === '.js'
  const targetVersion = prepareTarget(source)
  let basePath = checkBasePath(source)
  let rootDir = util.isStr(source.rootDir) ? source.rootDir : undefined
  const keepDirectoryHierarchy = boolOrUndef(source, 'keepDirectoryHierarchy')

  if (keepDirectoryHierarchy) {
    rootDir = undefined;
  } else {
    basePath = undefined;
  }

  return {
    dest,
    singleFile,
    targetVersion,
    basePath,
    rootDir,
    keepDirectoryHierarchy
  }
}

export function createResult(opts: any) {
  const {
    source,
    getTargetFiles,
    basePath,
    dest,
    singleFile,
    keepDirectoryHierarchy,
    getReferences
  } = opts
  const tsOptions = createTsOptions(opts)

  return {
    targetFiles: getTargetFiles,
    dest: dest,
    singleFile: singleFile,
    basePath: basePath,
    keepDirectoryHierarchy: keepDirectoryHierarchy,
    watch: prepareWatch(source, getTargetFiles()),
    references: getReferences,
    generateTsConfig: prepareGenerateTsConfig(source),
    tsOptions
  };
}


export function createTsOptions(opts: any) {
  const {
    source,
    dest,
    singleFile,
    targetVersion,
    rootDir,
    keepDirectoryHierarchy
  } = opts

  return {
    removeComments: boolOrUndef(source, 'removeComments'),
    sourceMap: boolOrUndef(source, 'sourceMap'),
    declaration: boolOrUndef(source, 'declaration'),
    out: singleFile ? dest : undefined,
    outDir: singleFile ? undefined :
      keepDirectoryHierarchy ? undefined : dest,
    noLib: boolOrUndef(source, 'noLib'),
    noImplicitAny: boolOrUndef(source, 'noImplicitAny'),
    noResolve: boolOrUndef(source, 'noResolve'),
    target: targetVersion,
    rootDir: rootDir,
    module: prepareModule(source),
    preserveConstEnums: boolOrUndef(source, 'preserveConstEnums'),
    noEmitOnError: boolOrUndef(source, 'noEmitOnError', true),
    suppressImplicitAnyIndexErrors: boolOrUndef(source, 'suppressImplicitAnyIndexErrors'),
    experimentalDecorators: boolOrUndef(source, 'experimentalDecorators'),
    emitDecoratorMetadata: boolOrUndef(source, 'emitDecoratorMetadata'),
    newLine: prepareNewLine(source),
    inlineSourceMap: boolOrUndef(source, 'inlineSourceMap'),
    inlineSources: boolOrUndef(source, 'inlineSources'),
    noEmitHelpers: boolOrUndef(source, 'noEmitHelpers'),
    jsx: prepareJsx(source),
    experimentalAsyncFunctions: boolOrUndef(source, 'experimentalAsyncFunctions')
  }
}

export function prepareTarget(opt: any): ts.ScriptTarget {
  let result: ts.ScriptTarget = ts.ScriptTarget.ES3;
  if (opt.target) {
    let temp = (opt.target + '').toLowerCase();
    if (temp === 'es3') {
      result = ts.ScriptTarget.ES3;
    } else if (temp == 'es5') {
      result = ts.ScriptTarget.ES5;
    } else if (temp == 'es6' || temp == 'es2015') {
      result = ts.ScriptTarget.ES2015;
    } else if (temp == 'es2016') {
      result = ts.ScriptTarget.ES2016;
    } else if (temp == 'es2017') {
      result = ts.ScriptTarget.ES2017;
    } else if (temp == 'es2018') {
      result = ts.ScriptTarget.ES2018;
    }
  }
  return result;
}

export function prepareModule(opt: any): ts.ModuleKind {
  let result: ts.ModuleKind = ts.ModuleKind.None;
  if (opt.module) {
    let temp = (opt.module + '').toLowerCase();
    if (temp === 'commonjs' || temp === 'node') {
      result = ts.ModuleKind.CommonJS;
    } else if (temp === 'amd') {
      result = ts.ModuleKind.AMD;
    } else if (temp === 'system') {
      result = ts.ModuleKind.System;
    } else if (temp === 'umd') {
      result = ts.ModuleKind.UMD;
    }
  }
  return result;
}

export function prepareNewLine(opt: any): ts.NewLineKind | undefined {
  let result: ts.NewLineKind = ts.NewLineKind.LineFeed
  if (opt.newLine) {
    let temp = (opt.newLine + '').toLowerCase();
    if (temp === 'crlf') {
      result = ts.NewLineKind.CarriageReturnLineFeed;
    } else if (temp === 'lf') {
      result = ts.NewLineKind.LineFeed;
    }
  }
  return result;
}

export function boolOrUndef(source: any, key: string, def?: boolean): boolean {
  let result = util.isUndef(source[key]) ? false : !!source[key];
  if (util.isUndef(result) && !util.isUndef(def)) {
    result = def || false
  }
  return result;
}

export function prepareGenerateTsConfig(opt: any): boolean | string {
  let result = false;
  if (!opt.generateTsConfig) {
    return false;
  }
  if (util.isBool(opt.generateTsConfig)) {
    return !!opt.generateTsConfig;
  }
  if (util.isStr(opt.generateTsConfig)) {
    return opt.generateTsConfig + '';
  }
  return result;
}

export function prepareJsx(opt: any): ts.JsxEmit | undefined {
  let jsx = (opt.jsx + '').toLowerCase();
  return jsx === 'react' ? ts.JsxEmit.React :
    jsx === 'preserve' ? ts.JsxEmit.Preserve : undefined;
}

function checkBasePath(opt: any): string | undefined {

  if (util.isUndef(opt.basePath)) {
    return;
  }

  let result: string = '';

  if (util.isStr(opt.basePath)) {
    result = opt.basePath;
  }
  if (!result) {
    return undefined;
  }

  result = util.normalizePath(result);
  if (result.lastIndexOf('/') !== result.length - 1) {
    result = result + '/';
  }

  util.writeWarn('BasePath option has been deprecated. Method for determining an output directory has been changed in the same way as the TSC. ' +
    'Please re-set output directory with the new rootDir option or use keepDirectoryHierachy option. ' +
    'However, keepDirectoryHierachy option would not be available long.')
  return result;
}
