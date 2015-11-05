/**
 * spritesmith 的位图引擎，基于 images，参考 gmssmith
 * https://github.com/twolfson/gmsmith
 */

'use strict';

var images = require('images'),
    async = require('async'),
    engine = {};

function Canvas(width, height) {
    this.canvas = images(width, height);
}

Canvas.prototype = {
    addImage: function(img, x, y) {
        this.canvas.draw(images(img.file), x, y);
    },
    'export': function(options, cb) {
        var canvas = this.canvas;
        process.nextTick(function() {
            cb(null, canvas.encode('png'));
        });
    }
};

function createCanvas(width, height, cb) {
    var canvas = new Canvas(width, height);
    process.nextTick(function() {
        cb(null, canvas);
    });
}

function createImage(file, cb) {
    var img = images(file),
        size = img.size();

    cb(null, {
        width: size.width,
        height: size.height,
        file: file
    });
}

function createImages(files, callback) {
    async.mapLimit(files, 1, createImage, callback);
}

engine.Canvas = Canvas;
engine.createCanvas = createCanvas;
engine.createImages = createImages;

module.exports = engine;
