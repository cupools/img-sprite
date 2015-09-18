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


fs.readFile('style.css', 'utf8', function(err, file) {
	var ast = cssparse.parse(file);

	// 遍历节点
	var cache = [], sprites = [], bgColors = [], i, l;
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

	// 提取 url
	var urlReg = /(?:url\(['"]?([\w\W]+?)['"]?\))/,
		colorReg = /#(\w{3,6})/;

	for(i=0; i<cache.length; i++) {
		var u = urlReg.exec(cache[i].node.value),
			c = colorReg.exec(cache[i].node.value);

		if(u) {
			sprites.push(path.join(__dirname, u[1]));
			bgColors.push(c ? c[1] : '');
		}
	}

	spritesmith({
		src: sprites,
		padding: 10
	}, function handleResult(err, result) {
		fs.writeFileSync(__dirname + '/alt-diagonal.png', result.image, 'binary');
		var coordinates = result.coordinates,
			properties = result.properties;

		for(var i=0; i<cache.length; i++) {
			cache[i].node.value = 'url(\'alt-diagonal.png\')';
			cache[i].parent.push({
				type: 'declaration',
				property: 'background-size',
				value: properties.width + 'px ' + properties.height + 'px'
			}, {
				type: 'declaration',
				property: 'background-position',
				value: coordinates[sprites[i]].x + 'px ' + coordinates[sprites[i]].y + 'px'
			});
		}
		console.timeEnd('t')

		console.log(cssparse.stringify(ast));
	});

});