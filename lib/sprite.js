'use strict';
console.time('t');

var spritesmith = require('spritesmith'),
	fs = require('fs'),
	path = require('path'),
	cssparse = require('css'),
	EventProxy = require('eventproxy'),
	traverse = require('./traverse');

/**
 * 根据 CSS 文件提取图片并导出精灵图和替换路径
 * @param {Object} options 配置项
 *  - {String} src css文件路径
 *  - {String} dest css输出路径
 *  - {String} destImg 精灵图输出路径
 *  - {String} imgPath 替换之后的图片路径
 *  - {String} prevTag 输出的精灵图的文件名前缀
 *  - {Boolean} retina 适应retina
 *  - {String} algorithm 排序算法，包括 [top-down, left-right, diagonal, alt-diagonal, binary-tree]
 *  - {Number} padding 图片间距
 */
function Sprite(options) {
	this.options = options;
	this.sprites = {};
	this.spritesUrl = {};
	this.astSet = {};
	this.ep = new EventProxy();
	this.main();
}

var fn = Sprite.prototype;

/**
 * 根据精灵图标志和图片地址数组，创建精灵图
 * @param tag {String} 精灵图标志，也是生成精灵图的文件名
 * @param imgFiles {Array} 图片地址数组
 */
fn.buildImage = function(tag, imgFiles) {
	var that = this,
		options = that.options;

	spritesmith({
		src: imgFiles,
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

		// 修改 AST
		for (i = 0; i < spriteSet.length; i++) {
			color = colorReg.exec(spriteSet[i].node.value);
			color = color ? color[0] + ' ' : '';
			offsetX = -ceil(coordinates[spriteUrl[i]].x / pow) + 'px';
			offsetY = -ceil(coordinates[spriteUrl[i]].y / pow) + 'px';
			spriteSet[i].node.value = color + 'url(' + options.imgPath + options.prevTag + tag + '.png) ' + offsetX + ' ' + offsetY;

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

		var output = path.join(options.destImg, options.prevTag + tag + '.png');

		fs.writeFile(output, result.image, 'binary', function(err) {
			if (err) {
				throw err;
			}
		});
		log(output);
		that.ep.emit('writeImg');
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
		if (that.options.src.length < 2) {
			// do nothing
		} else if (path.dirname(filepath) + '/' === output) {
			output = path.join(output, that.options.prevTag + basename);
		} else {
			output = path.join(output, basename);
		}

		fs.writeFile(output, cssparse.stringify(that.astSet[filepath]), function(err) {
			if (err) {
				throw err;
			}
			log(output);
			that.ep.emit('writeCss');
		});
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

		var ast = that.astSet[cssFile] = cssparse.parse(file);

		// 遍历节点
		var cache = [];
		traverse(ast, {
			enter: function(node, parent) {
				if (node.property && node.property.indexOf('background') > -1) {
					cache.push({
						node: node,
						parent: parent
					});
				}
			}
		});

		// 提取 url，分组1为url，分组2为精灵图标记，分组三为精灵图名称
		var urlReg = /(?:url\(['"]?([\w\W]+?)(?:\?(__)?([\w\W]+?))?['"]?\))/,
			basePath = path.dirname(cssFile),
			sprites = that.sprites,
			spritesUrl = that.spritesUrl,
			u, tag, i;

		// 过滤获取的节点
		for (i = 0; i < cache.length; i++) {
			u = urlReg.exec(cache[i].node.value);
			tag = null;

			if (u) {
				if (u[2]) {
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
		}

		that.ep.emit('readCss');
	});
};

/**
 * 函数入口，提供异步任务调用和管理
 */
fn.main = function() {
	var that = this,
		ep = that.ep,
		cssFiles = that.options.src;

	cssFiles.forEach(function(filepath) {
		that.calculate(filepath);
	});

	ep.after('readCss', cssFiles.length, function() {
		var imagesCount = 0;
		for (var i in that.spritesUrl) {
			that.buildImage(i, that.spritesUrl[i]);
			imagesCount++;
		}

		ep.after('writeImg', imagesCount, function() {
			that.buildCss();
			ep.emit('imgDone');
		});
	});

	ep.after('writeCss', cssFiles.length, function() {
		ep.emit('cssDone');
	});

	ep.all('cssDone', 'imgDone', function() {
		that.sprites = null;
		that.spritesUrl = null;
		that.astSet = null;
		// grunt 异步任务管理
		if(that.options.doneFn) {
			that.options.doneFn();
		}
		console.log('[tip]: sprites done');
	});

};

function _extend(origin) {
	var args = Array.prototype.slice.call(arguments, 1);
	for (var i = 0; i > args; i++) {
		for (var k in args[i]) {
			if (origin[k] !== undefined) {
				origin[k] = args[i][k];
			}
		}
	}
}

function log(msg) {
	console.log('[add]: ' + msg);
}

module.exports.build = function(options) {
	return new Sprite(options);
};