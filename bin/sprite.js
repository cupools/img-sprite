// #!/usr/bin/env node
'use strict';
var argv = require('yargs')
    .option('s', {
        alias: 'src',
        demand: true,
        describe: 'css file input path',
        type: 'string'
    })
    .option('d', {
        alias: 'dest',
        demand: true,
        describe: 'css file output path',
        type: 'string'
    })
    .option('o', {
        alias: 'destImg',
        demand: false,
        describe: 'output image path',
        type: 'string'
    })
    .option('r', {
        alias: 'retina',
        demand: false,
        default: true,
        describe: 'retina or not, default to true',
        type: 'boolean'
    })
    .option('padding', {
        demand: false,
        describe: 'padding between images, default to 10',
        type: 'string'
    })
    .option('prevTag', {
        demand: false,
        describe: 'add before images\' filename, default to "sprite-"',
        type: 'string'
    })
    .option('imgPath', {
        demand: false,
        describe: 'images path, default to "../images/"',
        type: 'string'
    })
    .option('algorithm', {
        demand: false,
        describe: 'list algorithm, default to "binary-tree"',
        type: 'string'
    })
    .argv;

var args = {
    src: argv.s.split(','),
    dest: argv.d,
    destImg: argv.o,
    imgPath: argv.imgPath,
    prevTag: argv.prevTag,
    retina: argv.retina,
    algorithm: argv.algorithm,
    padding: argv.padding
}

var sprite = require('../lib/sprite'),
    path = require('path');

var options = {
    src: ['test/dest/css/origin.css', 'test/dest/css/two.css'],
    dest: 'test/dest/css',
    destImg: 'test/dest/images/',
    imgPath: '../images/',
    prevTag: 'sprite-',
    retina: true,
    algorithm: 'binary-tree',
    padding: 10
};

extend(options, args);

// 修正路径
options.dest = options.dest.replace(/\/[^\/]*?$/, function(str) {
    if(str.indexOf('.') > -1 && options.src.length > 1) {
        return '/';

    } else if(str === '/' || str.indexOf('.') > -1) {
        return str;

    } else {
        return str + '/';
    }
});

sprite.build(options);

function extend(origin) {
    var args = Array.prototype.slice.call(arguments, 1),
        obj, key, i;
    for (i = 0; i < args.length; i++) {
        obj = args[i];
        for (key in obj) {
            if (obj[key] != null) {
                origin[key] = obj[key];
            }
        }
    }
    return origin;
}