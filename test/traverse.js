'use strict';
function Traverse(ast, options) {
	this.enter = options.enter;
	this.leave = options.leave;
	this.isKill = false;
	this.sign = {
		next: 'NEXT',
		stop: 'STOP',
		skip: 'SKIP',
		remove: 'REMOVE'
	};
	this.check(ast, null, null);
}

var fn = Traverse.prototype,
	ignoreType = /position/;

/**
 * 遍历对象或数组
 */
fn.walker = function(node) {
	var k = Object.keys(node),
		len = k.length,
		item, ret, i;

	if(this.isKill) {
		return;
	}

	for (i = 0; i < len; i++) {
		item = node[k[i]];
		if (!ignoreType.test(k[i]) && item && typeof item === 'object') {
			ret = this.check(item, node, k[i]);
			if(ret === this.sign.stop) {
				this.isKill = true;
				break;
			} else if(ret === this.sign.skip) {
				break;
			}
		}
	}
};

/**
 * 检查对象，并触发回调函数，同时提供 parent 和 node 参数
 */
fn.check = function(node, parent, key) {
	// 调用 enter 函数
	var ret = this.enterFn(node, parent);

	if (ret === this.sign.skip) {
		ret = this.leaveFn(node, parent);

	} else if(ret === this.sign.stop) {
		this.isKill = true;

	} else if(ret === this.sign.remove) {
		if(isArray(parent)) {
			parent.splice(key, 1);
		} else {
			delete parent[key];
		}

	} else {
		this.walker(node);
		ret = this.leaveFn(node, parent);
	}
	return ret;
};

/**
 * 封装参数 enter
 */
fn.enterFn = function(node, parent) {
	if (typeof this.enter === 'function') {
		return this.enter.call(this, node, parent);
	}
};

/**
 * 封装参数 leave
 */
fn.leaveFn = function(node, parent) {
	if (typeof this.leave === 'function') {
		return this.leave.call(this, node, parent);
	}
};

function isArray(obj) {
	return Object.prototype.toString.call(obj).indexOf('Array') !== -1;
}

function init(ast, enter, leave) {
	return new Traverse(ast, enter, leave);
}

module.exports = init;