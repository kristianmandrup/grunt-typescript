module.exports = function(grunt){

    var fs = require("fs"),
        path = require("path"),
        cp = require("child_process"),
        Q = require("q");

    grunt.initConfig({
        typescript: {
            simple: {
                src: ["test/fixtures/simple.ts"]
            },
            dest:{
                src:"test/fixtures/dest.ts",
                dest: "test/temp/dest"
            },
            basePath:{
                src:"test/fixtures/basepath.ts",
                dest: "test/temp/basepath",
                options: {
                    basePath: "test/fixtures"
                }
            },
            declaration:{
              src:"test/fixtures/declaration.ts",
              options:{
                    declaration: true
                }
            },
            sourcemap:{
                src:"test/fixtures/sourcemap.ts",
                options:{
                    sourceMap:true
                }
            },
            "sourcemap dest":{
                src:"test/fixtures/sourcemap.ts",
                dest:"test/temp/sourcemap/",
                options:{
                    basePath: "test/fixtures/",
                    sourceMap:true
                }
            },
            es5:{
                src:"test/fixtures/es5.ts",
                options:{
                    target:"ES5"
                }
            },
            amd:{
                src:"test/fixtures/amd.ts",
                options:{
                    module:"amd"
                }
            },
            commonjs:{
                src:"test/fixtures/commonjs.ts",
                options:{
                    module:"commonjs"
                }
            },
            single:{
                src: "test/fixtures/single/**/*.ts",
                dest: "test/temp/single.js",
                options: {
                    declaration: true,
                    sourceMap: true
                }
            },
            "comment default": {
                src: "test/fixtures/comments.ts",
                dest: "test/temp/comments.js"
            },
            "comment remove true": {
                src: "test/fixtures/comments.ts",
                dest: "test/temp/comments_true.js",
                options: {
                    removeComments: true
                }
            },
            "comment remove false": {
                src: "test/fixtures/comments.ts",
                dest: "test/temp/comments_false.js",
                options: {
                    removeComments: false
                }
            },
            "references": {
                src: "test/fixtures/ref.ts",
                options: {
                    noLib: true,
                    references: ["core", "test/libs/**/*.d.ts"]
                }
            },
            "noLib safe": {
                src: "test/fixtures/noLib.ts",
                options: {
                    noLib: true,
                    references: ["dom"]
                }
            },
            "noLib": grunt.option("error") ? {
                src: "test/fixtures/noLib.ts",
                options: {
                    noLib: true
                }
            } : {},
            "noLibCore": grunt.option("error") ? {
                src: "test/fixtures/noLib.ts",
                options: {
                    noLib: true,
                    references: "core"
                }
            } : {},
            "errorTypecheck": grunt.option("error") ? {
                src: "test/fixtures/error-typecheck.ts",
                options: {
                    ignoreError: false
                }
            } : {},
            "errorSyntax": grunt.option("error") ? {
                src: "test/fixtures/error-syntax.ts",
                options: {
                    ignoreError: true
                }
            } : {},
            simpleWatch: grunt.option("watch") ? {
                src: "test/watch/simple/target/**/*.ts",
                options: {
                    watch: {
                        before: ["watchBeforeTask"],
                        after: ["watchAfterTask"],
                        atBegin: true
                    }
                }
            } : {},
            singleWatch: grunt.option("watch") ? {
                src: "test/watch/single/target/**/*.ts",
                dest: "test/watch/single/target/result.js",
                options: {
                    watch: {
                        before: ["watchBeforeTask"],
                        after: ["watchAfterTask"],
                        atBegin: true
                    }
                }
            } : {},
            multiWatch: grunt.option("watch") ? {
                src: "test/watch/multi/target/**/*.ts",
                options: {
                    watch: {
                        path:["test/watch/multi/target/target1","test/watch/multi/target/target2"]
                    }
                }
            } : {}
        },
        nodeunit:{
            tests:["test/test.js", "test/errorTest.js"]
            //tests:["test/errorTest.js"]
            //tests:["test/watchTest.js"]
        },
        clean: {
            test: [
                "test/fixtures/**/*.js",
                "test/fixtures/**/*.js.map",
                "test/fixtures/**/*.d.ts",
                "test/temp/**/*.*",
                "test/temp"
            ],
            expect: "test/expected"
        },
        switchv: {
            "1.3.0": {
                options: {version: "1.3.0"}
            },
            "1.4.0": {
                options:{version: "1.4.0"}
            }
        }
    });

    function tsc(tsfile, option){
        var command = "node " + path.resolve(path.dirname(require.resolve("typescript")), "tsc ");
        var optArray = Object.keys(option || {}).reduce(function(res, key){
            res.push(key);
            if(option[key]){
                res.push(option[key]);
            }
            return res;
        }, [])

        return Q.Promise(function(resolve, reject){
            var childProcess = cp.exec(command + " " + tsfile + " " + optArray.join(" "), {});
            childProcess.stdout.on('data', function (d) { grunt.log.writeln(d); });
            childProcess.stderr.on('data', function (d) { grunt.log.error(d); });

            childProcess.on('exit', function(code) {
                if (code !== 0) {
                    reject();
                }
                resolve();
            });
        });
    }

    function getTestTsTasks(){
        var results = [];
        results.push("clean:test");

        var tsConfig = grunt.config.getRaw("typescript");
        for(var p in tsConfig){
            if(!tsConfig.hasOwnProperty(p)){
                continue;
            }
            results.push("typescript:" + p);
        }
        results.push("nodeunit");
        return results;
    }

    grunt.loadTasks("tasks");
    grunt.loadNpmTasks("grunt-contrib-nodeunit");
    grunt.loadNpmTasks("grunt-contrib-clean");

    grunt.registerTask("egen", "Generate test expected files", function(){
        var done = this.async(),
            start = Date.now(),
            execTsc = function(title, command){
                start = Date.now();
                return tsc(command).then(function(){
                    grunt.log.writeln(title + "(" + (Date.now() - start) + "ms)" );
                });
            }

        execTsc("Simple", "test/fixtures/simple.ts").then(function(){
            grunt.file.copy("test/fixtures/simple.js", "test/expected/simple.js");
            return execTsc("Dest", "test/fixtures/dest.ts --outDir test/expected");
        }).then(function(){
            return execTsc("BasePath", "test/fixtures/basepath.ts --outDir test/expected");
        }).then(function(){
            return execTsc("Declaration", "test/fixtures/declaration.ts --declaration");
        }).then(function(){
            grunt.file.copy("test/fixtures/declaration.js", "test/expected/declaration.js");
            grunt.file.copy("test/fixtures/declaration.d.ts", "test/expected/declaration.d.ts");
            return execTsc("SourceMap", "test/fixtures/sourcemap.ts --sourcemap");
        }).then(function(){
            grunt.file.copy("test/fixtures/sourcemap.js","test/expected/sourcemap.js");
            grunt.file.copy("test/fixtures/sourcemap.js.map", "test/expected/sourcemap.js.map");
            return execTsc("SourceMap Dest", "test/fixtures/sourcemap.ts --outDir test/expected/sourcemap --sourcemap");
        }).then(function(){
            grunt.file.copy("test/fixtures/sourcemap.js","test/expected/sourcemap.js");
            grunt.file.copy("test/fixtures/sourcemap.js.map", "test/expected/sourcemap.js.map");
            return execTsc("ES5", "test/fixtures/es5.ts --target ES5");
        }).then(function(){
            grunt.file.copy("test/fixtures/es5.js", "test/expected/es5.js");
            return execTsc("AMD", "test/fixtures/amd.ts --module amd");
        }).then(function(){
            grunt.file.copy("test/fixtures/amd.js", "test/expected/amd.js");
            return execTsc("CommonJS", "test/fixtures/commonjs.ts --module commonjs");
        }).then(function(){
            grunt.file.copy("test/fixtures/commonjs.js", "test/expected/commonjs.js");
            return execTsc("Single", "test/fixtures/single/dir/single2.ts test/fixtures/single/single1.ts --out test/temp/single.js --sourceMap");
        }).then(function(){
            grunt.file.copy("test/temp/single.js", "test/expected/single.js");
            return execTsc("Comment", "test/fixtures/comments.ts --out test/expected/comments.js");
        }).then(function(){
            return execTsc("Comment true", "test/fixtures/comments.ts --out test/expected/comments_true.js --removeComments");
        }).then(function(){
            return execTsc("Comment false", "test/fixtures/comments.ts --out test/expected/comments_false.js"); //default
        }).then(function(){
            done(true);
        }).catch(function(){
            done(false);
        });
    });

    grunt.registerTask("build", "Build", function(){
        var done = this.async();
        tsc("src/index.ts" + " --noImplicitAny --out tasks/typescript.js").then(function(){
            done(true);
        }).catch(function(){
            done(false);
        });
    });

    grunt.registerTask("watchBeforeTask", function(){
       var done = this.async();
        setTimeout(function(){
            console.log("before");
            done(true);
        },100);
    });

    grunt.registerTask("watchAfterTask", function(){
        var done = this.async();
        setTimeout(function(){
            console.log("after");
            done(true);
        },100);
    });

    grunt.registerMultiTask("switchv", "switch typescript version", function(){
        var version = this.options({}).version,
            targetDir = "lib/" + version,
            moduleDir = "node_modules/typescript/bin";

        grunt.file.expand(moduleDir + "/*.*").forEach(function(fileName){
           grunt.file.delete(fileName);
        });
        grunt.file.expand(targetDir + "/*.*").forEach(function(fileName){
           grunt.file.copy(fileName, moduleDir + "/" + path.basename(fileName));
        });
        grunt.file.copy(targetDir + "/tsc.d.ts", "typings/typescript/tsc.d.ts");
    });

    grunt.registerTask("test", getTestTsTasks());

    grunt.registerTask("setup", ["clean", "sitchv:1.4.0", "egen"]);
};
