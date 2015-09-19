'use strict';
console.time('t')

var spritesmith = require('spritesmith'),
	fs = require('fs'),
	path = require('path'),
	cssparse = require('css'),
	traverse = require('./traverse');


var options = {
	src: 'dest/css/origin.css',
	dest: 'dest/css/dest.css',
	destImg: 'dest/images/',
	uriImg: '../images/',
	prevTag: 'sprite-',
	retina: true,
	padding: 10
};


fs.readFile(options.src, 'utf8', function(err, file) {
	var ast = cssparse.parse(file);

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
		},
		leave: function(node, parent) {}
	});

	// 提取 url，分组1为url，分组2为精灵图标记，分组三为精灵图名称
	var urlReg = /(?:url\(['"]?([\w\W]+?)(?:\?(__)?([\w\W]+?))?['"]?\))/,
		basePath = path.join(__dirname, path.dirname(options.src)),
		sprites = {},
		spritesUrl = {},
		u, tag, i, l;

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

	function buildSprite(tag, src) {
		spritesmith({
			src: src,
			padding: options.padding
		}, function handleResult(err, result) {
			var spriteSet = sprites[tag],
				spriteUrl = spritesUrl[tag],
				coordinates = result.coordinates,
				properties = result.properties,
				pow = options.retina ? 2 : 1,
				colorReg = /#\w{3,6}|rgba?\(.+?\)/,
				ceil = Math.ceil,
				color, i, offsetX, offsetY;

			// 修改 AST
			for (i = 0; i < spriteSet.length; i++) {
				color = colorReg.exec(spriteSet[i].node.value);
				color = color ? color[0] + ' ' : '';
				offsetX = -ceil(coordinates[spriteUrl[i]].x / pow) + 'px';
				offsetY = -ceil(coordinates[spriteUrl[i]].y / pow) + 'px';
				spriteSet[i].node.value = color + 'url(' + options.uriImg + options.prevTag + tag + '.png) ' + offsetX + ' ' + offsetY;

				spriteSet[i].parent.push({
					type: 'declaration',
					property: 'background-size',
					value: ceil(properties.width / pow) + 'px ' + ceil(properties.height / pow) + 'px'
				});
			}

			fs.writeFile(path.join(__dirname, options.destImg, options.prevTag + tag + '.png'), result.image, 'binary');

			// @TODO 添加多任务管理，只创建一次 css
			fs.writeFile(path.join(__dirname, options.dest), cssparse.stringify(ast), function(err) {
				if (err) {
					throw err;
				}
			});

			if (++TNT === spriteUrl.length) {
				console.timeEnd('t');
			}

		});
	}

	var TNT = 0;
	for (i in spritesUrl) {
		buildSprite(i, spritesUrl[i]);
	}

});