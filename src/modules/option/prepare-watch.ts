import * as util from '../util'
import * as gts from '../task'
const _path: NodeJS.Path = require('path')
const _fs: NodeJS.FileSystem = require('fs')

export function prepareWatch(opt: any, files: string[]): gts.WatchOptions | undefined {
  let after: string[] = [],
    before: string[] = [],
    val: any = opt.watch,
    getDirNames = (files: string[]): string[] => {
      return files.map<string>(file => {
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
    extractPath = (files: string[]): string[] => {
      const dirNames: string[] = getDirNames(files)
      const result = dirNames.reduce<string>((prev, curr) => {
        if (!prev) {
          return curr;
        }
        let left = util.normalizePath(_path.relative(prev, curr)),
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
      }, '');
      return result ? [result] : []
    };

  if (!val) {
    return
  }
  if (util.isStr(val) || util.isArray(val)) {
    return {
      path: util.isStr(val) ? [<string>val] : <string[]>val,
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
    }
  }
  if (!val.path) {
    val.path = extractPath(files);
    if (!val.path) {
      //util.writeWarn('Can't auto detect watch directory. Please place one or more files or set the path option.');
      return undefined;
    }
  }
  if (val.after && !util.isArray(val.after)) {
    after.push(<string>val.after);
  } else if (util.isArray(val.after)) {
    after = val.after;
  }

  if (val.before && !util.isArray(val.before)) {
    before.push(<string>val.before);
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
