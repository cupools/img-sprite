'use strict';

var spritesmith = require('spritesmith'),
    GM = require('gm'),
    fs = require('fs'),
    path = require('path'),
    cssparse = require('css'),
    EventProxy = require('eventproxy'),
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
 */
function Sprite(options) {
    this.options = options;
    this.sprites = {}; // 根据精灵图标志，存储节点引用
    this.spritesUrl = {}; // 储存每个节点背景图片的路径
    this.astSet = {}; // 储存每个css文件的ast
    this.ep = new EventProxy();
    this.main();
}

var fn = Sprite.prototype;

/**
 * 函数入口，提供异步任务调用和管理
 */
fn.main = function() {
    var that = this,
        ep = that.ep,
        cssFiles = that.options.src;

    // 通过 css 文件创建、遍历 AST，并提取图片标识
    cssFiles.forEach(function(filepath) {
        that.calculate(filepath);
    });

    // 提取图片标识后，创建精灵图
    ep.after('calculate', cssFiles.length, function() {
        for (var i in that.spritesUrl) {
            that.buildImage(i, that.spritesUrl[i]);
        }

        // retina 情况下创建包括@2x和@1x图片
        ep.after('buildImg', Object.keys(that.spritesUrl).length * (that.options.retina ? 2 : 1), function() {
            ep.emit('imgDone');
        });

    });

    // 精灵图创建完成后，产出 css 文件
    ep.on('imgDone', function() {
        that.buildCss();
    });

    // css 文件产出完成
    ep.after('buildCss', cssFiles.length, function() {
        ep.emit('cssDone');
    });

    ep.all('cssDone', 'imgDone', function() {
        that.sprites = null;
        that.spritesUrl = null;
        that.astSet = null;

        // grunt 异步任务管理
        if (that.options.doneFn) {
            that.options.doneFn();
        }

        that.log('sprites done', 'tip');
    });

};

/**
 * 通过 css 文件创建、遍历 AST，并提取图片标志，为之后创建精灵图准备
 * @param {String} cssFile css 文件的绝对路径
 */
fn.calculate = function(cssFile) {
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
            u, tag, i;

        // 过滤获取的节点
        for (i = 0; i < cache.length; i++) {
            u = urlReg.exec(cache[i].node.value);
            tag = null;

            if (u && u[2]) {
                tag = u[3];
                if (!sprites[tag]) {
                    sprites[tag] = [];
                }
                if (!spritesUrl[tag]) {
                    spritesUrl[tag] = [];
                }

                sprites[tag].push(cache[i]);
                spritesUrl[tag].push(path.join(basePath, u[1]));

            } else {
                cache.splice(i--, 1);
            }
        }

        // 储存 css 文件内合适的节点
        that.astSet[cssFile].nodes = cache.slice(0);

        that.ep.emit('calculate');
    });
};


/**
 * 根据精灵图标志和图片地址数组，创建精灵图
 * @param tag {String} 精灵图标志，也是生成精灵图的文件名
 * @param imgFiles {Array} 图片地址数组
 */
fn.buildImage = function(tag, imgFiles) {
    // 图片排重
    var arr = _unique(imgFiles),
        that = this,
        options = that.options;

    spritesmith({
        src: arr,
        algorithm: options.algorithm,
        padding: options.padding
    }, function handleResult(err, result) {
        if (err) {
            throw err;
        }

        var spriteSet = that.sprites[tag],
            spriteUrl = that.spritesUrl[tag],
            coordinates = result.coordinates,
            properties = result.properties,
            pow = options.retina ? 2 : 1,
            colorReg = /#\w{3,6}|rgba?\(.+?\)/,
            resetBgReg = /background-[size|image|position]/,
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

        fs.writeFile(output, result.image, 'binary', function(err) {
            if (err) {
                throw err;
            }
            // 产出精灵图片后，根据需要缩小图片大小，产出@1x图片
            if (that.options.retina) {
                var imgPath = output.replace('@2x', '');

                GM(output)
                    .resize(ceil(properties.width / pow), ceil(properties.height / pow))
                    .noProfile()
                    .write(imgPath, function(err) {
                        if(err) {
                            throw err;
                        }
                        that.ep.emit('buildImg');
                        that.log(imgPath);
                    });
            }
        });

        that.ep.emit('buildImg');
        that.log(output);
    });
};

/**
 * 创建 css 文件，在创建精灵图之后执行
 */
fn.buildCss = function() {
    var dest = this.options.dest,
        that = this;

    this.options.src.forEach(function(filepath) {
        var output = dest,
            basename = path.basename(filepath);

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

                media.rules.push({
                    'type': 'rule',
                    'selectors': item.parent._selectors,
                    'declarations': [{
                        'type': 'declaration',
                        'property': 'background',
                        'value': bgUrl.replace(/(\.png)/, '@2x$1')
                    }, bgSizeNode]
                });
            });

            that.astSet[filepath].ast.stylesheet.rules.push(media);

        }

        fs.writeFile(output, cssparse.stringify(that.astSet[filepath].ast), function(err) {
            if (err) {
                throw err;
            }
            that.log(output);
            that.ep.emit('buildCss');
        });
    });

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


module.exports.build = function(options) {
    return new Sprite(options);
};
