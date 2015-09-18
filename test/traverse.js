function Traverse(ast, options) {
	this.enter = options.enter;
	this.leave = options.leave;
	this.sign = {
		next: 'NEXT',
		stop: 'STOP',
		skip: 'SKIP',
		remove: 'REMOVE'
	}
	this.check(ast);
}

var fn = Traverse.prototype,
	ignoreType = /comment|position/;

/**
 * 遍历对象
 */
fn.walker = function(node) {
	var k = Object.keys(node),
		len = k.length,
		item, i;

	for (i = 0; i < len; i++) {
		item = node[k[i]];
		if (!ignoreType.test(k[i]) && item && typeof item === 'object') {
			this.check(item, node, k[i]);
		}
	}
};

/**
 * 检查对象，并触发回调函数，同时提供 parent 和 node 参数
 */
fn.check = function(node, parent, key) {
	var ret;
	parent = parent || null;

	// 调用 enter
	if (this.enterFn(node, parent)) {
		this.walker(node);
	}
	this.leave && this.leave(node, parent);
};

/**
 * 封装参数 enter
 * @TODO 添加分支重载，减少函数调用
 */
fn.enterFn = function(node, parent) {
	var ret = this.sign.next;
	if (typeof this.enter === 'function') {
		ret = this.enter.call(this, node, parent) || ret;
	}
	return ret;
};

/**
 * 封装参数 leave
 */
fn.leaveFn = function(node, parent) {
	var ret = null;
	if (typeof this.leave === 'function') {
		ret = this.leave(node, parent);
	}
	return ret;
};

function isArray(obj) {
	return Object.prototype.toString.call(obj).indexOf('Array') !== -1;
}

function init(ast, enter, leave) {
	return new Traverse(ast, enter, leave);
}

module.exports = init;