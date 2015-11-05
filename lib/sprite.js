'use strict';

var spritesmith = require('spritesmith'),
    images = require('images'),
    fs = require('fs-extra'),
    path = require('path'),
    cssparse = require('css'),
    async = require('async'),
    traverse = require('./traverse');

/**
 * 根据 CSS 文件提取图片并导出精灵图和替换路径
 * @param {Object} options 配置项
 *  - {Array} src css文件路径
 *  - {String} dest css输出路径
 *  - {String} destImg 精灵图输出路径
 *  - {String} imgPath 替换之后的图片路径
 *  - {String} prefix 输出的精灵图的文件名前缀
 *  - {Boolean} retina 适应retina
 *  - {String} algorithm 排序算法，包括 [top-down, left-right, diagonal, alt-diagonal, binary-tree]
 *  - {Number} padding 图片间距
 *  - {String} media 媒体查询条件
 *  - {Number} sizeLimit 内联图片大小限制
 */
function Sprite(options) {
    this.options = options;
    this.sprites = {}; // 根据精灵图标志，存储节点引用
    this.spritesUrl = {}; // 储存每个节点背景图片的路径
    this.astSet = {}; // 储存每个css文件的ast
}

var fn = Sprite.prototype;

/**
 * 函数入口，提供异步任务调用和管理
 */
fn.run = function() {
    var that = this,
        cssFiles = that.options.src;

    async.series({
        // 通过 css 文件创建、遍历 AST，并提取图片标识
        calculate: function(callback) {
            async.each(cssFiles, that.proxy(that.calculate), function(err) {
                callback(null);
            });
        },
        // 提取图片标识后，创建精灵图
        buildImg: function(callback) {
            var tags = Object.keys(that.spritesUrl);
            async.each(tags, that.proxy(that.buildImage), function(err) {
                callback(null);
            });
        },
        // 精灵图创建完成后，产出 css 文件
        buildCss: function(callback) {
            async.each(that.options.src, that.proxy(that.buildCss), function(err) {
                callback(null);
            });
        }
    }, function(err, callback) {
        if(err) {
            throw err;
        }

        that.sprites = null;
        that.spritesUrl = null;
        that.astSet = null;

        that.log('sprites done', 'tip');

        // grunt 异步任务管理
        if (that.options.doneFn) {
            that.options.doneFn();
        }
    });

};

/**
 * 通过 css 文件创建、遍历 AST，并提取图片标志，为之后创建精灵图准备
 * @param {String} cssFile css 文件的绝对路径
 */
fn.calculate = function(cssFile, done) {
    var that = this;

    fs.readFile(cssFile, 'utf8', function(err, file) {
        if (err) {
            throw err;
        }

        that.astSet[cssFile] = {
            ast: null,
            nodes: []
        };

        var ast = that.astSet[cssFile].ast = cssparse.parse(file);

        // 遍历节点
        var cache = [],
            retina = that.options.retina;

        traverse(ast, {
            enter: function(node, parent) {
                if (node.property && node.property.indexOf('background') > -1) {
                    cache.push({
                        node: node,
                        parent: parent
                    });
                }

                // 保存选择器的引用，允许 retina 配置下插入 media 片段
                if (retina && node.selectors && node.declarations) {
                    node.declarations._selectors = node.selectors;
                }
            }
        });

        // 提取 url，分组1为url，分组2为精灵图标记，分组3为精灵图名称
        var urlReg = /(?:url\(['"]?([\w\W]+?)(?:\?(__)?([\w\W]+?))?['"]?\))/,
            basePath = path.dirname(cssFile),
            sprites = that.sprites,
            spritesUrl = that.spritesUrl,
            u, tag, i, abpath;

        // 过滤获取的节点
        for (i = 0; i < cache.length; i++) {
            u = urlReg.exec(cache[i].node.value);
            tag = null;

            if (u && u[2]) {
                // 图片绝对路径
                abpath = path.join(basePath, u[1]);

                // 过滤不存在的图片
                if(fs.existsSync(abpath)) {
                    tag = u[3];
                    if (!sprites[tag]) {
                        sprites[tag] = [];
                    }
                    if (!spritesUrl[tag]) {
                        spritesUrl[tag] = [];
                    }

                    sprites[tag].push(cache[i]);
                    spritesUrl[tag].push(abpath);

                } else {
                    cache.splice(i--, 1);
                    that.log(abpath, 'unexist');
                }

            } else {
                cache.splice(i--, 1);
            }
        }

        // 储存 css 文件内合适的节点
        that.astSet[cssFile].nodes = cache.slice(0);

        done();
    });
};


/**
 * 根据精灵图标志和图片地址数组，创建精灵图
 * @param {String} tag 精灵图标志，也是生成精灵图的文件名
 */
fn.buildImage = function(tag, done) {
    var imgFiles = this.spritesUrl[tag],
        arr = _unique(imgFiles), // 图片排重
        that = this,
        options = that.options;

    var colorReg = /#\w{3,6}|rgba?\(.+?\)/,
        resetBgReg = /background-[size|image|position]/;

    if(tag === 'inline') {
        // 处理内联图片
        var spriteSet = that.sprites[tag],
            spriteUrl = that.spritesUrl[tag],
            i, stat, encode;

        // 修改 AST
        for (i = 0; i < spriteSet.length; i++) {
            // 修改 background 样式
            stat = fs.statSync(spriteUrl[i]);

            if(stat.size < that.options.sizeLimit) {
                encode = 'data:image/' + path.extname(spriteUrl[i]).slice(1) + ';base64,' + fs.readFileSync(spriteUrl[i], {encoding: 'base64'});
                spriteSet[i].node.value = spriteSet[i].node.value.replace(/(url\s?\(['"]?)([\w\W]+?)(['"]?\))/, '$1' + encode + '$3');
                that.log(spriteUrl[i], 'inline');

            } else {
                that.log(spriteUrl[i], 'oversize');
            }

        }

        done();
    } else {
        // 处理精灵图
        spritesmith({
            src: arr,
            algorithm: options.algorithm,
            padding: options.padding,
            engine: require('./engine/imagessmith')
        }, function handleResult(err, result) {
            if (err) {
                throw err;
            }

            var spriteSet = that.sprites[tag],
                spriteUrl = that.spritesUrl[tag],
                coordinates = result.coordinates,
                properties = result.properties,
                pow = options.retina ? 2 : 1,
                ceil = Math.ceil,
                color, i, offsetX, offsetY;

            var basename = options.prefix + tag + '.png';

            // 修改 AST
            for (i = 0; i < spriteSet.length; i++) {
                color = colorReg.exec(spriteSet[i].node.value);
                color = color ? color[0] + ' ' : '';
                offsetX = -ceil(coordinates[spriteUrl[i]].x / pow) + 'px';
                offsetY = -ceil(coordinates[spriteUrl[i]].y / pow) + 'px';

                // 修改 background 样式
                // 修复 background-image 抛出异常的情况
                spriteSet[i].node.property = 'background';
                spriteSet[i].node.value = color + 'url(' + options.imgPath + basename + ') ' + offsetX + ' ' + offsetY + ' no-repeat';

                // 删除 background 有关样式
                traverse(spriteSet[i].parent, {
                    enter: function(node) {
                        if (node.property && (resetBgReg.exec(node.property))) {
                            return this.sign.remove;
                        }
                    }
                });

                // 插入 background-size
                spriteSet[i].parent.push({
                    type: 'declaration',
                    property: 'background-size',
                    value: ceil(properties.width / pow) + 'px ' + ceil(properties.height / pow) + 'px'
                });
            }

            var output = path.join(options.output, basename);

            if(that.options.retina) {
                output = output.replace(/(\.png)/, '@2x$1');
            }

            fs.outputFile(output, result.image, 'binary', function(err) {
                if (err) {
                    throw err;
                }
                that.log(output);

                // 产出精灵图片后，根据需要缩小图片大小，产出@1x图片
                if (that.options.retina) {
                    var imgPath = output.replace('@2x', '');

                    images(output)
                        .resize(ceil(properties.width / pow), ceil(properties.height / pow))
                        .save(imgPath);

                    that.log(imgPath);
                    done();
                } else {
                    done();
                }
            });
        });
    }

};

/**
 * 创建 css 文件，在创建精灵图之后执行
 * @param {String} filepath css 文件路径
 */
fn.buildCss = function(filepath, done) {
    var dest = this.options.dest,
        output = dest,
        basename = path.basename(filepath),
        that = this;

    // 修正文件名，避免覆盖源文件
    if (output.indexOf('.') > -1) {
        // do nothing
    } else if (path.dirname(filepath) + '/' === output) {
        output = path.join(output, (that.options.prefix ? that.options.prefix : 'sprite-') + basename);
    } else {
        output = path.join(output, basename);
    }

    // 插入媒体查询代码
    if (that.options.retina) {
        var media = {
            'type': 'media',
            'media': that.options.media,
            'rules': []
        };

        var nodes = that.astSet[filepath].nodes;

        nodes.forEach(function(item) {
            var bgSizeNode, bgUrl,
                bgReg = /background(-image)?/;

            traverse(item.parent, {
                enter: function(node) {
                    if (node.property === 'background-size') {
                        bgSizeNode = node;
                    } else if (node.property && bgReg.test(node.property)) {
                        bgUrl = node.value;
                    }
                }
            });

            if(bgUrl && bgUrl.indexOf('data:image') === -1 && bgUrl.indexOf('?__inline') === -1) {
                media.rules.push({
                    'type': 'rule',
                    'selectors': item.parent._selectors,
                    'declarations': [{
                        'type': 'declaration',
                        'property': 'background',
                        'value': bgUrl.replace(/(\.png)/, '@2x$1')
                    }, bgSizeNode]
                });
            }

        });

        that.astSet[filepath].ast.stylesheet.rules.push(media);

    }

    fs.outputFile(output, cssparse.stringify(that.astSet[filepath].ast), function(err) {
        if (err) {
            throw err;
        }
        that.log(output);
        done();
    });

};

fn.proxy = function(fn) {
    var context = this;
    return function() {
        fn.apply(context, arguments);
    };
};

fn.log = function(msg, type) {
    console.log('  [' + (type ? type : 'add') + ']: ' + msg);
};

function _unique(arr) {
    var dic = {},
        ret;

    ret = arr.filter(function(item) {
        if (!dic[item]) {
            dic[item] = true;
            return true;
        } else {
            return false;
        }
    });

    dic = null;
    return ret;
}

module.exports = Sprite;
