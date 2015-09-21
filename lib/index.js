'use strict';
console.time('t');

var spritesmith = require('spritesmith'),
	fs = require('fs'),
	path = require('path'),
	cssparse = require('css'),
	eventproxy = require('eventproxy'),
	traverse = require('./traverse');

// var options = {
// 	src: 'test/dest/css/origin.css',
// 	dest: 'test/dest/css/dest.css',
// 	destImg: 'test/dest/images/',
// 	imgPath: '../images/',
// 	prevTag: 'sprite-',
// 	retina: true,
// 	algorithm: 'binary-tree',
// 	padding: 10
// };

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
function build(options) {
	fs.readFile(options.src, 'utf8', function(err, file) {
		if(err) {
			throw err;
		}

		var ast = cssparse.parse(file),
			cwd = process.cwd();

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
			basePath = path.join(cwd, path.dirname(options.src)),
			sprites = {},
			spritesUrl = {},
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

		var syncCount = 0;
		for (i in spritesUrl) {
			buildSprite(i, spritesUrl[i]);
		}

		/**
		 * 根据精灵图标志和图片地址数组，创建精灵图
		 * @param tag {String} 精灵图标志，也是生成精灵图的文件名
		 * @param src {Array} 图片地址数组
		 */
		function buildSprite(tag, src) {
			spritesmith({
				src: src,
				algorithm: options.algorithm,
				padding: options.padding
			}, function handleResult(err, result) {
				if(err) {
					throw err;
				}
				
				var spriteSet = sprites[tag],
					spriteUrl = spritesUrl[tag],
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

				fs.writeFile(path.join(cwd, options.destImg, options.prevTag + tag + '.png'), result.image, 'binary');

				if (++syncCount === spriteUrl.length) {
					// 创建 css 文件
					fs.writeFile(path.join(cwd, options.dest), cssparse.stringify(ast), function(err) {
						if (err) {
							throw err;
						}
					});
					console.timeEnd('t');
				}

			});
		}
	});
}

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

module.exports.build = build;