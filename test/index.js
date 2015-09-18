'use strict';
console.time('t')
var spritesmith = require('spritesmith'),
	fs = require('fs'),
	path = require('path'),
	cssparse = require('css'),
	traverse = require('./traverse');

// var sprites = ['1.png', '2.png', '3.png'];
// spritesmith({
// 	src: sprites,
// 	padding: 10
// }, function handleResult(err, result) {
// 	// console.log(result.image); // Binary string representation of image
// 	fs.writeFileSync(__dirname + '/alt-diagonal.png', result.image, 'binary');
// 	console.log(result.coordinates); // Object mapping filename to {x, y, width, height} of image
// 	console.log(result.properties); // Object with metadata about spritesheet {width, height}
// });



// console.log(obj);
var options = {
	src: 'style.css',
	dest: 'dest.css',
	retina: true,
	padding: 10
}


fs.readFile(options.src, 'utf8', function(err, file) {
	var ast = cssparse.parse(file);

	// 遍历节点
	var cache = [];
	traverse(ast, {
		enter: function(node, parent) {
			if(node.property && node.property.indexOf('background') > -1) {
				cache.push({
					node: node,
					parent: parent
				});
			}
		},
		leave: function(node, parent) {
		}
	});

	// 提取 url，分组1为url，分组2为精灵图标记，分组三为精灵图名称
	var urlReg = /(?:url\(['"]?([\w\W]+?)(?:\?(__)?([\w\W]+?))?['"]?\))/,
		sprites = {}, spritesUrl = {}, u, tag, i, l;

	// 过滤获取的节点
	for(i=0; i<cache.length; i++) {
		u = urlReg.exec(cache[i].node.value);
		tag = null;

		if(u) {
			if(u[2]) {
				tag = u[3];
				if(!sprites[tag]) {
					sprites[tag] = [];
				}
				if(!spritesUrl[tag]) {
					spritesUrl[tag] = [];
				}

				sprites[tag].push(cache[i]);
				spritesUrl[tag].push(path.join(__dirname, u[1]));
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
				color, i;

			console.log(spriteSet)
			for(i=0; i<spriteSet.length; i++) {
				color = colorReg.exec(spriteSet[i].node.value);
				color = color ? color[0] + ' ' : '';
				spriteSet[i].node.value = color + 'url(' + tag + '.png) ' + ceil(coordinates[spriteUrl[i]].x / pow) + 'px ' + ceil(coordinates[spriteUrl[i]].y / pow) + 'px';
				spriteSet[i].parent.push({
					type: 'declaration',
					property: 'background-size',
					value: ceil(properties.width / pow) + 'px ' + ceil(properties.height / pow) + 'px'
				});
			}

			fs.writeFile(path.join(__dirname, tag + '.png'), result.image, 'binary');

			// @TODO 添加多任务管理，只创建一次 css
			fs.writeFile(path.join(__dirname, options.dest), cssparse.stringify(ast), function(err){
				if(err) {
					throw err;
				}
			});

			if(++TNT === spriteUrl.length) {

			console.timeEnd('t');
			}

		});
	}

	var TNT = 0;
	for(i in spritesUrl) {
		buildSprite(i, spritesUrl[i]);
	}

});