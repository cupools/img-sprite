var sprite = require('./lib/sprite'),
    path = require('path');

function init(args) {
    var options = {
        src: [],
        dest: './',
        output: './',
        imgPath: '../images/',
        prefix: 'sprite-',
        retina: true,
        algorithm: 'binary-tree',
        padding: 10,
        media： 'only screen and (-webkit-min-device-pixel-ratio: 1.5)'
    };

    extend(options, args);

    // 修正 css 产出路径
    options.src = options.src.slice(0);
    options.dest = options.dest.replace(/\/[^\/]*?$/, function(str) {
        if (str.indexOf('.') > -1 && options.src.length > 1) {
            return '/';

        } else if (str === '/' || str.indexOf('.') > -1) {
            return str;

        } else {
            return str + '/';
        }
    });

    sprite.build(options);

}

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

module.exports = init;