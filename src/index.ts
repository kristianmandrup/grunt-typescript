import * as gts from './modules/task';
import * as Promise from 'bluebird';
import * as compiler from './modules/compiler';

function startup(grunt: IGrunt) {

  grunt.registerMultiTask('typescript', 'Compile typescript to javascript.', function () {
    const that: grunt.task.IMultiTask<{ src: string; }> = this
    const done = that.async()
    const promises = that.files.map((gruntFile) => {
      let task = new gts.Task(grunt, that.options({}), gruntFile)
      return compiler.execute(task);
    });

    Promise.all(promises).then(() => {
      done()
    }).catch(() => {
      done(false);
    });
  });
}

export = startup
