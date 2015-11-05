## 需求
针对之前页面重构的方式，我对于一个精灵图处理工具的设想是这样的：

1. 像 FIS 一般，通过在 css 文件中背景图片添加标识合并精灵图。**跟平时一样写样式，仅在打包阶段产出精灵图和新的 css 文件**。不关心是否使用 SASS 等
1. 能够根据标识产出多个精灵图
1. 不依赖 Less 等 CSS 预处理器
1. 兼容 Retina，并自动插入媒体查询代码
1. Base64 内联图片，通过 `?__inline` 标识
1. 使用要简单，简单，简单，**不依赖于 GM 等图像处理库**
1. 设计稿每次导出 @2x 的图片即可，由工具产出 @1x 的图片

<!-- more -->

## 使用
### 安装
``` bash
npm install img-sprite --save
```

### 处理一个 css 文件
#### main.js
``` javascript
var sprite = require('img-sprite');

sprite({
	src: 'test/css/main.css',
	dest: 'test/css/dest.css',
	output: 'test/images'
});
```
#### main.css

``` css
.icon0 {
  width: 128px;
  height: 128px;
  background: url(../images/0.png?__tom) no-repeat;
  background-size: 128px 128px;
}
.icon1 {
  width: 128px;
  height: 128px;
  color: #ccc;
  background: url(../images/1.png?__tom) no-repeat;
  background-size: 128px 128px;
}
.icon2 {
  width: 50px;
  height: 50px;
  color: #ccc;
  background: url(../images/2.png?__inline) no-repeat;
  background-size: 50px 50px;
}

```

![css 文件](https://github.com/cupools/img-sprite/blob/master/docs/00.png)

![精灵图](https://github.com/cupools/img-sprite/blob/master/docs/01.png)

### 处理多个 css 文件

``` javascript
var sprite = require('img-sprite');

sprite({
	src: ['test/css/one.css', 'test/css/two.css'],
	dest: 'test/css',
	output: 'test/images',
	retina: false,
	prefix: 'sp-',
	imgPath: '/public/images/',
	algorithm: 'top-down',
	sizeLimit: 10*1024
});
```
### 命令行使用
``` bash
$ bin/sprite -h
Options:
  -s, --src     css file input path                          [string] [required]
  -d, --dest    css file output path                         [string] [required]
  -o, --output  images output path                                      [string]
  -r, --retina  retina or not, default to true         				   [boolean]
  --padding     padding between images, default to 10                   [string]
  --prefix      add before images filename, default to "sprite-"        [string]
  --imgPath     images path, default to "../images/"                    [string]
  --algorithm   list algorithm, default to "binary-tree"                [string]
  --sizeLimit   size limit for inline images, default to 5000           [string]
```

## 参数
### src
- 类型：Array
- 说明：css 文件路径，必须
- 默认：无

### dest
- 类型：String
- 说明：css 产出路径，当仅处理一个 css 文件时可指定文件名
- 默认：当前目录

### output
- 类型：String
- 说明：精灵图产出路径
- 默认：当前目录

### retina
- 类型：Boolean
- 说明：是否产出 @2x 图片
- 默认：true

### padding
- 类型：Number
- 说明：精灵图中图片间距
- 默认：10

### prefix
- 类型：String
- 说明：精灵图前缀；当产出 css 文件与指定 css 的目录一致时，为 css 文件添加该前缀
- 默认：'sprite-'

### imgPath
- 类型：String
- 说明：css 文件中的图片路径
- 默认：'../images/'

### algorithm
- 类型：String
- 说明：图片排序算法
- 可选：top-down, left-right, diagonal, alt-diagonal, binary-tree
- 默认：'binary-tree'

### media
- 类型：String
- 说明：媒体查询条件
- 默认：only screen and (-webkit-min-device-pixel-ratio: 1.5)

### sizeLimit
- 类型：Number
- 说明：内联图片大小限制
- 默认：5000

## 实现
img-sprite 基于 [spritesmith](https://github.com/Ensighten/spritesmith) 和 [css](https://github.com/reworkcss/css) 实现。spritesmith 解决了图片合并、坐标计算这几个关键的问题，css 解决了图片路径替换、样式补充的问题。然后我做得东西就比较简单了。根据几个需求点简单列举一下

#### 1. 像 FIS 一般，直接从 css 文件中通过标记提取图片路径处理并产出精灵图和新的 css 文件

通过 css-parse 构建出 css 文件对应的 AST（抽象语法树），递归遍历 AST 根据标识得到需要被合并的图片的路径，之后交给 spritemith 处理产出精灵图，再根据 spritemith 返回的 map 将精灵图的路径、图片大小、图片位置调整到 AST，产出新的 css 文件即可

#### 2. 能够根据标识产出多个精灵图
通过 `icon.png?__xxx` 标记图片，通过 `xxx` 决定图片应该被合并到哪一个精灵图

``` javascript
// 提取 url，分组1为url，分组2为精灵图标记，分组3为精灵图名称
var urlReg = /(?:url\(['"]?([\w\W]+?)(?:\?(__)?([\w\W]+?))?['"]?\))/,

```

#### 3. 不依赖 Less 等 CSS 预处理器
跟平时一样写代码，在完成之后一次构建处理即可。当然平时用预处理器更方便了

#### 4. 兼容 Retina
之前尝试过其他自动雪碧图工具，比较不舒服的一个地方是对 Retina 的兼容。img-sprite 对 Retina 的处理是产出两套精灵图，并在 css 文件底部插入 media。默认以 @2x 的切图合并精灵图，然后依赖 [GM](http://www.graphicsmagick.org/) 缩小图片产出 @1x 的精灵图。

#### 5. Base64 内联图片
通过 `icon.png?__inline` 标记即可

#### 6. 使用要简单，简单，简单
从 `v0.3.0` 开始使用 [images](https://github.com/zhangyuanwei/node-images)，不需要安装 GM 等图形处理库。配置比较简单，需要目标 css 路径（src），产出 css 路径（dest），精灵图产出路径（output）三个参数。如果 src 有多个文件，那么 dest 指定路径并产出多个 css 文件；如果 src 只有一个文件，那么 dest 可以指定产出 css 的路径和文件名。推荐配合 CSS 预处理器更方便地写样式

#### 7. 设计稿每次导出 @2x 的图片即可，由工具产出 @1x 的图片
移动端设计稿导出原始大小图片即可，img-sprite 基于 @2x 的精灵图再产出 @1x 的精灵图，并在 css 文件底部自动插入 media

## 其他问题
1. 不依赖 GM 等图形处理库  
    img-sprite 从 `v0.3.0` 开始使用 [images](https://github.com/zhangyuanwei/node-images) 替代了 spritesmith 默认的位图引擎，解决了 windows 平台下产出精灵图可能出现噪点的情况，缩短了产出图片的耗时。同时不再依赖 GM，再也不需要折腾啦！产出图片的质量也比较出色，感谢作者~
    
    此外尝试了 node Jimp，缩小图片效果不理想；尝试了 [phantomjs](http://phantomjs.org/) 作为位图引擎，但发现在 window 和 osx 下速度大幅慢于其他引擎，故不采用。暂时不支持在 img-sprite 中配置其他的位图引擎

1. 对其他样式的影响  
    调整 AST 的过程中会将做这样的处理，删除 background 有关的样式并插入新的值。保留背景颜色，不支持同时定义多个背景图片
    
    ``` javascript
    var colorReg = /#\w{3,6}|rgba?\(.+?\)/,
        resetBgReg = /background-[size|image|position]/,
    ...
    // 设置 background 样式
    spriteSet[i].node.value = color + 'url(' + options.imgPath + basename + ') ' + offsetX + ' ' + offsetY;
    ...
    // 插入 background-size
    spriteSet[i].parent.push({
        type: 'declaration',
        property: 'background-size',
        value: ceil(properties.width / pow) + 'px ' + ceil(properties.height / pow) + 'px'
        });
    ``` 

1. 缺点  
	- 目前仅支持处理 .png
	- 写样式的时候建议元素的宽高和背景图的宽高一致，其他情况下精灵图不方便处理
	- 不支持背景图 repeat
	- 暂不支持多个背景图
	- 仅支持处理 .css。实际上推荐使用 SASS 等写样式，在产出 css 文件后交给 img-sprite 做进一步精灵图合并处理即可

## 更新日志
- 0.3.2：
	- 修复 `background-image` 抛出异常的情况
	- 修复 `?__inline` 被插入到 media 中的情况
	- 完善日志
- 0.3.0：
	- 使用 [images](https://github.com/zhangyuanwei/node-images) 替代了 spritesmith 默认的位图引擎，解决了 windows 平台下产出精灵图可能出现噪点的情况，同时不再依赖 GM
- 0.2.0：
	- 支持通过`?__inline`内联图片
	- 使用 [fs-extra](https://github.com/jprichardson/node-fs-extra) 操作文件，支持创建多层目录
	- 添加对不存在的图片路径的过滤
	- 允许重写 log 方法
	- 尝试添加单元测试用例
- 0.1.2：修复非 retina 情况下图片命名 @2x 的情况
- 0.1.0：基本功能