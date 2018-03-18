import * as ts from 'typescript'
import * as util from '../util'
import * as gts from '../task'
import {
  makeOpts,
  createResult
} from './tsconf'

export function createGruntOption(source: any, grunt: IGrunt, gruntFile: grunt.file.IFilesConfig, logger: gts.Logger): gts.CompilerOptions {
  let opts: any = makeOpts(gruntFile, source)
  let {
    targetVersion
  } = opts

  function getTargetFiles(): string[] {
    return <string[]>grunt.file.expand(<string[]>gruntFile.orig.src);
  }


  function getReferences(): string[] {
    let target: string[] = [],
      binPath = util.getBinDir();

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
    target = target.map((item) => {
      if (item === 'lib.core.d.ts' || item === 'core') {
        return util.combinePaths(binPath,
          targetVersion === ts.ScriptTarget.ES2015 ? 'lib.core.es6.d.ts' : 'lib.core.d.ts');
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

  opts.source = source
  opts = {
    ...opts,
    getTargetFiles,
    getReferences
  }

  const result: gts.CompilerOptions = createResult(opts)

  logger.verbose('--option');
  logger.verbose(JSON.stringify(result, null, '  '));

  return result;
}
