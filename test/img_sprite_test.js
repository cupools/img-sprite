'use strict';

var assert = require('assert'),
    images = require('images'),
    fs = require('fs-extra');

var sprite = require('../index');
sprite.extend.log = function() {};

before(function() {
    fs.emptyDirSync('test/tmp');
    fs.copySync('test/fixtures/single.html', 'test/tmp/single/single.html');
    fs.copySync('test/fixtures/multi.html', 'test/tmp/multi/multi.html');
});

describe('output css and image', function() {
    it('should be equal when single css', function(done) {
        sprite({
            src: 'test/fixtures/css/main.css',
            dest: 'test/tmp/single/css/dest.css',
            output: 'test/tmp/single/images',
            imgPath: '../images/',
            doneFn: function() {
                assert.equal(fs.readFileSync('test/tmp/single/css/dest.css', 'utf8'), fs.readFileSync('test/expected/single/css/dest.css', 'utf8'));
                assert.equal(images('test/tmp/single/images/sprite-jerry.png').size().width, images('test/expected/single/images/sprite-jerry.png').size().width);
                assert.equal(images('test/tmp/single/images/sprite-jerry@2x.png').size().width, images('test/expected/single/images/sprite-jerry@2x.png').size().width);
                assert.equal(images('test/tmp/single/images/sprite-tom.png').size().width, images('test/expected/single/images/sprite-tom.png').size().width);
                assert.equal(images('test/tmp/single/images/sprite-tom@2x.png').size().width, images('test/expected/single/images/sprite-tom@2x.png').size().width);
                done();
            }
        }, true);
    });

    it('should be equal when multiple css', function(done) {
        sprite({
            src: ['test/fixtures/css/one.css', 'test/fixtures/css/two.css'],
            dest: 'test/tmp/multi',
            output: 'test/tmp/multi',
            imgPath: './',
            retina: false,
            doneFn: function() {
                assert.equal(fs.readFileSync('test/tmp/multi/one.css', 'utf8'), fs.readFileSync('test/expected/multi/one.css', 'utf8'));
                assert.equal(fs.readFileSync('test/tmp/multi/two.css', 'utf8'), fs.readFileSync('test/expected/multi/two.css', 'utf8'));
                assert.equal(images('test/tmp/multi/sprite-jerry.png').size().width, images('test/expected/multi/sprite-jerry.png').size().width);
                assert.equal(images('test/tmp/multi/sprite-tom.png').size().width, images('test/expected/multi/sprite-tom.png').size().width);
                done();
            }
        });
    });
});
