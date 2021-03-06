var ts = require('typescript');
var util = require('./util');
var _path = require('path'),
  _fs = require('fs'),
  _os = require('os'),
  existingDirectories = {};

function createSourceFile(fileName, text, languageVersion) {
  if (text !== undefined) {
    var result = ts.createSourceFile(fileName, text, languageVersion);
    result.mtime = _fs.statSync(fileName).mtime.getTime();
    return result;
  }
}

function directoryExists(directoryPath) {
  if (util.hasProperty(existingDirectories, directoryPath)) {
    return true;
  }
  //TODO:
  if (util.directoryExists(directoryPath)) {
    existingDirectories[directoryPath] = true;
    return true;
  }
  return false;
}

function ensureDirectoriesExist(directoryPath) {
  if (directoryPath.length > util.getRootLength(directoryPath) && !directoryExists(directoryPath)) {
    var parentDirectory = util.getDirectoryPath(directoryPath);
    ensureDirectoriesExist(parentDirectory);
    //TODO:
    util.createDirectory(directoryPath);
  }
}

function prepareOutputDir(fileName, options) {
  if (options.singleFile || !options.dest) {
    return fileName;
  }
  var currentPath = util.getCurrentDirectory(),
    relativePath = util.normalizePath(_path.relative(currentPath, fileName)),
    basePath = options.basePath;
  if (basePath) {
    if (relativePath.substr(0, basePath.length) !== basePath) {
      throw new Error(fileName + ' is not started basePath');
    }
    relativePath = relativePath.substr(basePath.length);
  }
  return util.normalizePath(_path.resolve(currentPath, options.dest, relativePath));
}

function prepareSourcePath(sourceFileName, preparedFileName, contents, options) {
  if (options.singleFile || !options.dest) {
    return contents;
  }
  if (sourceFileName === preparedFileName) {
    return contents;
  }
  if (!(/\.js\.map$/.test(sourceFileName))) {
    return contents;
  }
  var mapData = JSON.parse(contents),
    source = mapData.sources[0];
  mapData.sources.length = 0;
  var relative = _path.relative(_path.dirname(preparedFileName), sourceFileName);
  mapData.sources.push(util.normalizePath(_path.join(_path.dirname(relative), source)));
  return JSON.stringify(mapData);
}

function getNewLineChar(options) {
  var optValue = options.tsOptions.newLine;
  if (optValue === 0 /* CarriageReturnLineFeed */ ) {
    return '\r\n';
  } else if (optValue === 1 /* LineFeed */ ) {
    return '\n';
  }
  return _os.EOL;
}

function createHost(grunt, options, logger) {
  var platform = _os.platform(),
    // win32\win64 are case insensitive platforms, MacOS (darwin) by default is also case insensitive
    useCaseSensitiveFileNames = platform !== 'win32' && platform !== 'win64' && platform !== 'darwin',
    sourceFileCache = {},
    newSourceFiles = [],
    outputFiles = [];

  function getCanonicalFileName(fileName) {
    // if underlying system can distinguish between two files whose names differs only in cases then file name already in canonical form.
    // otherwise use toLowerCase as a canonical form.
    return useCaseSensitiveFileNames ? fileName : fileName.toLowerCase();
  }

  function getSourceFile(fileName, languageVersion, onError) {
    logger.verbose('--host.getSourceFile: ' + fileName);
    var fullName = util.abs(fileName),
      text = '';
    if (fullName in sourceFileCache) {
      var chechedSourceFile = sourceFileCache[fullName],
        newMtime = _fs.statSync(fullName).mtime.getTime();
      if (chechedSourceFile.mtime !== newMtime) {
        delete sourceFileCache[fullName];
      } else {
        logger.verbose('  cached');
        return sourceFileCache[fullName];
      }
    }
    if (!util.dirOrFileExists(fileName)) {
      return;
    }
    try {
      text = util.readFile(fileName, options.tsOptions.charset);
    } catch (e) {
      if (onError) {
        onError(e.message);
      }
      text = '';
    }
    var result = createSourceFile(fileName, text, languageVersion);
    if (result) {
      logger.verbose('  readed');
      sourceFileCache[fullName] = result;
    }
    return result;
  }

  function writeFile(fileName, data, writeByteOrderMark, onError) {
    logger.verbose('--host.writeFile: ' + fileName);
    var fullName = util.abs(fileName);
    //        if(!options.singleFile && options.watch && !options.tsOptions.noEmit && newSourceFiles.length){
    //            return;
    //        }
    //watch の時に新しいファイルだけ出力をしたいが、判定できないためコメントアウト
    //        if(!options.singleFile){
    //            let tsFile = fullName.replace(/\.js\.map$/, '.ts').replace(/\.js$/, '.ts');
    //            if(!(tsFile in newSourceFiles)){
    //                tsFile = fullName.replace(/\.d\.ts$/, '.ts');
    //                if(!(tsFile in newSourceFiles)) {
    //                    logger.verbose('  canceled');
    //                    return;
    //                }
    //            }
    //        }
    //出力先ディレクトリのパスに変換
    if (!!options.keepDirectoryHierarchy) {
      try {
        var newFileName = prepareOutputDir(fileName, options);
        //map ファイルの参照先パスを変換
        var targetData = prepareSourcePath(fileName, newFileName, data, options);
        logger.verbose('  change file path: ' + fileName + ' -> ' + newFileName);
        fileName = newFileName;
        data = targetData;
        fullName = util.abs(fileName);
      } catch (e) {
        console.log(e);
      }
    }
    try {
      ensureDirectoriesExist(util.getDirectoryPath(util.normalizePath(fullName)));
      //TODO:
      util.writeFile(fullName, data, writeByteOrderMark);
      outputFiles.push(fullName);
      logger.verbose('  write file: ' + fullName);
    } catch (e) {
      if (onError)
        onError(e.message);
    }
  }

  function writeResult(ms) {
    var result = {
        js: [],
        m: [],
        d: [],
        other: []
      },
      resultMessage, pluralizeFile = function (n) {
        return (n + ' file') + ((n === 1) ? '' : 's');
      };
    outputFiles.forEach(function (item) {
      if (/\.js$/.test(item))
        result.js.push(item);
      else if (/\.js\.map$/.test(item))
        result.m.push(item);
      else if (/\.d\.ts$/.test(item))
        result.d.push(item);
      else
        result.other.push(item);
    });
    resultMessage = 'js: ' + pluralizeFile(result.js.length) +
      ', map: ' + pluralizeFile(result.m.length) +
      ', declaration: ' + pluralizeFile(result.d.length) +
      ' (' + ms + 'ms)';
    if (options.singleFile) {
      if (result.js.length > 0) {
        util.write('File ' + (result.js[0])['cyan'] + ' created.');
      }
      util.write(resultMessage);
    } else {
      util.write(pluralizeFile(outputFiles.length)['cyan'] + ' created. ' + resultMessage);
    }
  }

  function reset(fileNames) {
    if (util.isUndef(fileNames)) {
      sourceFileCache = {};
    }
    if (util.isArray(fileNames)) {
      fileNames.forEach(function (f) {
        var fullName = util.abs(f);
        if (fullName in sourceFileCache) {
          delete sourceFileCache[fullName];
        }
      });
    }
    outputFiles.length = 0;
    newSourceFiles = [];
  }
  var newLineChar = getNewLineChar(options);
  return {
    getSourceFile: getSourceFile,
    getDefaultLibFileName: function (options) {
      logger.verbose('bin dir = ' + util.getBinDir());
      return util.combinePaths(util.getBinDir(), options.target === 2 /* ES6 */ ? 'lib.es6.d.ts' : 'lib.d.ts');
    },
    writeFile: writeFile,
    getCurrentDirectory: function () {
      return util.getCurrentDirectory();
    },
    useCaseSensitiveFileNames: function () {
      return useCaseSensitiveFileNames;
    },
    getCanonicalFileName: getCanonicalFileName,
    getNewLine: function () {
      return newLineChar;
    },
    fileExists: function (path) {
      return util.fileExists(path);
    },
    readFile: function (fileName) {
      return util.readFile(fileName);
    },
    writeResult: writeResult,
    reset: reset
  };
}
exports.createHost = createHost;
