var util = require('./util');
var ts = require('typescript');
var _path = require('path'),
  _fs = require('fs');

function prepareWatch(opt, files) {
  var after = [],
    before = [],
    val = opt.watch,
    getDirNames = function (files) {
      return files.map(function (file) {
        if (_fs.existsSync(file)) {
          if (_fs.statSync(file).isDirectory()) {
            return file;
          }
        } else {
          if (!_path.extname(file)) {
            return file;
          }
        }
        return util.normalizePath(_path.resolve(_path.dirname(file)));
      });
    },
    extractPath = function (files) {
      var dirNames = getDirNames(files),
        result = dirNames.reduce(function (prev, curr) {
          if (!prev) {
            return curr;
          }
          var left = util.normalizePath(_path.relative(prev, curr)),
            right = util.normalizePath(_path.relative(curr, prev)),
            match = left.match(/^(\.\.(\/)?)+/);
          if (match) {
            return util.normalizePath(_path.resolve(prev, match[0]));
          }
          match = right.match(/^(\.\.(\/)?)+/);
          if (match) {
            return util.normalizePath(_path.resolve(curr, match[0]));
          }
          return prev;
        }, undefined);
      if (result) {
        return [result];
      }
    };
  if (!val) {
    return undefined;
  }
  if (util.isStr(val) || util.isArray(val)) {
    return {
      path: util.isStr(val) ? [val] : val,
      after: [],
      before: [],
      atBegin: false
    };
  }
  if (util.isBool(val) && !!val) {
    return {
      path: extractPath(files),
      after: [],
      before: [],
      atBegin: false
    };
  }
  if (!val.path) {
    val.path = extractPath(files);
    if (!val.path) {
      //util.writeWarn('Can't auto detect watch directory. Please place one or more files or set the path option.');
      return undefined;
    }
  }
  if (val.after && !util.isArray(val.after)) {
    after.push(val.after);
  } else if (util.isArray(val.after)) {
    after = val.after;
  }
  if (val.before && !util.isArray(val.before)) {
    before.push(val.before);
  } else if (util.isArray(val.before)) {
    before = val.before;
  }
  return {
    path: val.path,
    after: after,
    before: before,
    atBegin: !!val.atBegin
  };
}

function checkBasePath(opt) {
  if (util.isUndef(opt.basePath)) {
    return;
  }
  var result = '';
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
    'However, keepDirectoryHierachy option would not be available long.');
  return result;
}

function prepareTarget(opt) {
  var result = undefined /* ES3 */ ;
  if (opt.target) {
    var temp = (opt.target + '').toLowerCase();
    if (temp === 'es3') {
      result = 0 /* ES3 */ ;
    } else if (temp == 'es5') {
      result = 1 /* ES5 */ ;
    } else if (temp == 'es6') {
      result = 2 /* ES6 */ ;
    }
  }
  return result;
}

function prepareModule(opt) {
  var result = undefined /* None */ ;
  if (opt.module) {
    var temp = (opt.module + '').toLowerCase();
    if (temp === 'commonjs' || temp === 'node') {
      result = 1 /* CommonJS */ ;
    } else if (temp === 'amd') {
      result = 2 /* AMD */ ;
    } else if (temp === 'system') {
      result = 4 /* System */ ;
    } else if (temp === 'umd') {
      result = 3 /* UMD */ ;
    }
  }
  return result;
}

function prepareNewLine(opt) {
  var result = undefined;
  if (opt.newLine) {
    var temp = (opt.newLine + '').toLowerCase();
    if (temp === 'crlf') {
      result = 0 /* CarriageReturnLineFeed */ ;
    } else if (temp === 'lf') {
      result = 1 /* LineFeed */ ;
    }
  }
  return result;
}

function boolOrUndef(source, key, def) {
  var result = util.isUndef(source[key]) ? undefined : !!source[key];
  if (util.isUndef(result) && !util.isUndef(def)) {
    result = def;
  }
  return result;
}

function prepareGenerateTsConfig(opt) {
  var result = false;
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

function prepareUseTsConfig(opt) {
  var result = false;
  if (!opt.useTsConfig) {
    return false;
  }
  if (util.isBool(opt.useTsConfig)) {
    return opt.useTsConfig && 'tsconfig.json';
  }
  if (util.isStr(opt.useTsConfig)) {
    return opt.useTsConfig + '';
  }
  return result;
}

function prepareJsx(opt) {
  var jsx = (opt.jsx + '').toLowerCase();
  return jsx === 'react' ? 2 /* React */ :
    jsx === 'preserve' ? 1 /* Preserve */ : undefined;
}

function prepareModuleResolution(opt) {
  var mr = (opt.moduleResolution + '').toLowerCase();
  return mr === 'node' ? 2 /* NodeJs */ : undefined;
}

function createGruntOption(source, grunt, gruntFile, logger) {
  var dest = util.normalizePath(gruntFile.dest || ''),
    singleFile = !!dest && _path.extname(dest) === '.js',
    targetVersion = prepareTarget(source),
    basePath = checkBasePath(source),
    rootDir = util.isStr(source.rootDir) ? source.rootDir : undefined,
    keepDirectoryHierarchy = boolOrUndef(source, 'keepDirectoryHierarchy');

  function getTargetFiles() {
    return (gruntFile.orig.src && grunt.file.expand(gruntFile.orig.src)) || [];
  }

  function getReferences() {
    var target, binPath = util.getBinDir();
    if (!source.references) {
      return [];
    }
    if (util.isStr(source.references)) {
      target = [source.references];
    }
    if (util.isArray(source.references)) {
      target = source.references.concat();
    }
    if (!target) {
      return [];
    }
    target = target.map(function (item) {
      if (item === 'lib.core.d.ts' || item === 'core') {
        return util.combinePaths(binPath, targetVersion === 2 /* ES6 */ ? 'lib.core.es6.d.ts' : 'lib.core.d.ts');
      }
      if (item === 'lib.dom.d.ts' || item === 'dom') {
        return util.combinePaths(binPath, 'lib.dom.d.ts');
      }
      if (item === 'lib.scriptHost.d.ts' || item === 'scriptHost') {
        return util.combinePaths(binPath, 'lib.scriptHost.d.ts');
      }
      if (item === 'lib.webworker.d.ts' || item === 'webworker') {
        return util.combinePaths(binPath, 'lib.webworker.d.ts');
      }
      return item;
    });
    return grunt.file.expand(target);
  }
  if (keepDirectoryHierarchy) {
    rootDir = undefined;
  } else {
    basePath = undefined;
  }
  var result = {
    targetFiles: getTargetFiles,
    dest: dest,
    singleFile: singleFile,
    basePath: basePath,
    keepDirectoryHierarchy: keepDirectoryHierarchy,
    watch: prepareWatch(source, getTargetFiles()),
    references: getReferences,
    generateTsConfig: prepareGenerateTsConfig(source),
    useTsConfig: prepareUseTsConfig(source),
    tsOptions: {
      removeComments: boolOrUndef(source, 'removeComments'),
      sourceMap: boolOrUndef(source, 'sourceMap'),
      declaration: boolOrUndef(source, 'declaration'),
      out: singleFile ? dest : undefined,
      outDir: singleFile ? undefined : keepDirectoryHierarchy ? undefined : dest,
      noLib: boolOrUndef(source, 'noLib'),
      noImplicitAny: boolOrUndef(source, 'noImplicitAny'),
      noResolve: boolOrUndef(source, 'noResolve'),
      target: targetVersion,
      rootDir: rootDir,
      module: prepareModule(source),
      preserveConstEnums: boolOrUndef(source, 'preserveConstEnums'),
      noEmitOnError: boolOrUndef(source, 'noEmitOnError'),
      suppressImplicitAnyIndexErrors: boolOrUndef(source, 'suppressImplicitAnyIndexErrors'),
      experimentalDecorators: boolOrUndef(source, 'experimentalDecorators'),
      emitDecoratorMetadata: boolOrUndef(source, 'emitDecoratorMetadata'),
      newLine: prepareNewLine(source),
      inlineSourceMap: boolOrUndef(source, 'inlineSourceMap'),
      inlineSources: boolOrUndef(source, 'inlineSources'),
      noEmitHelpers: boolOrUndef(source, 'noEmitHelpers'),
      jsx: prepareJsx(source),
      moduleResolution: prepareModuleResolution(source),
      allowJs: boolOrUndef(source, 'allowJs')
    }
  };
  logger.verbose('--option');
  logger.verbose(JSON.stringify(result, null, '  '));
  return result;
}
exports.createGruntOption = createGruntOption;
