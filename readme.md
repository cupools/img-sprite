## 需求
针对之前页面重构的方式，我对于一个精灵图处理工具的设想是这样的：

1. 像 FIS 一般，通过在 css 文件中背景图片添加标识，直接产出精灵图和新的 css 文件（不要问我为什么不用 FIS...）
1. 能够根据标识产出多个精灵图
1. 不依赖 Less 等 CSS 预处理器
1. 兼容 Retina
1. Base64 内联图片（todo）
1. 使用要简单，简单，简单

<!-- more -->

## 使用
### 处理一个 css 文件

``` javascript
var sprite = require('img-sprite');

sprite({
	src: ['test/css/one.css'],
	dest: 'test/css/dest.css',
	output: 'test/images'
});
```
![css 文件](/images/img-sprite/00.png)

![精灵图](/images/img-sprite/01.png)

### 处理多个 css 文件

``` javascript
var sprite = require('img-sprite');

sprite({
	src: ['test/css/one.css', 'test/css/two.css'],
	dest: 'test/css',
	output: 'test/images',
	retina: false,
	prefix: 'sp-',
	imgPath: '/public/images/'
	algorithm: 'top-down'
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
```

## 参数
|参数|说明|默认|
|---|---|---|---|---|
|src|css 文件路径，必须 {Array}|无|
|dest|css 产出路径，当仅处理一个 css 文件时可指定文件名 {String}|当前目录|
|output|精灵图产出路径 {String}|当前目录|
|retina|是否产出 @2x 图片 {Boolean}|true|
|padding|精灵图中图片间距 {Number}|10|
|prefix|精灵图前缀；当产出 css 文件与指定 css 的目录一致时，为 css 文件添加该前缀 {String}|'sprite-'|
|imgPath|css 文件中的图片路径 {String}|'../images/'|
|algorithm|图片排序算法 [top-down, left-right, diagonal, alt-diagonal, binary-tree]|'binary-tree'|
|media|媒体查询条件|only screen and (-webkit-min-device-pixel-ratio: 1.5)|




## 实现
img-sprite 基于 [spritesmith](https://github.com/Ensighten/spritesmith) 和 [css](https://github.com/reworkcss/css) 实现。spritesmith 解决了图片合并、坐标计算这几个关键的问题，css 解决了图片路径替换、样式补充的问题。然后我做得东西就比较简单了。根据几个需求点简单列举一下

#### 1. 像 FIS 一般，直接从 css 文件中通过标记提取图片路径处理并产出精灵图和新的 css 文件

通过 css-parse 构建出 css 文件对应的 AST（抽象语法树），递归遍历 AST 根据标识得到需要被合并的图片的路径，之后交给 spritemith 处理产出精灵图，再根据 spritemith 返回的 map 将精灵图的路径、图片大小、图片位置调整 AST，产出新的 css 文件即可

#### 2. 能够根据标识产出多个精灵图
通过 `icon.png?__xxx` 标记图片，通过 `xxx` 决定图片应该被合并到哪一个精灵图

``` javascript
// 提取 url，分组1为url，分组2为精灵图标记，分组3为精灵图名称
var urlReg = /(?:url\(['"]?([\w\W]+?)(?:\?(__)?([\w\W]+?))?['"]?\))/,

```

#### 3. 不依赖 Less 等 CSS 预处理器
跟平时一样写代码，在完成之后一次构建处理即可

#### 4. 兼容 Retina
之前尝试过其他自动雪碧图工具，比较不舒服的一个地方是对 Retina 的兼容。img-sprite 对 Retina 的处理是产出两套精灵图，并在 css 文件底部插入 media。默认以 @2x 的切图合并精灵图，然后依赖 [GM](http://www.graphicsmagick.org/) 缩小图片产出 @1x 的精灵图。

#### 5. Base64 内联图片（todo）
还没做这一块，目前的设想是通过 `icon.png?__inline` 标记

#### 6. 使用要简单，简单，简单
配置比较简单，需要目标 css 路径（src），产出 css 路径（dest），精灵图产出路径（output）三个参数。如果 src 是数组，那么 dest 指定路径并产出多个 css 文件；如果 src 是一个文件，那么 dest 可以指定产出 css 的路径和文件名。依赖 GM 应该是最麻烦的地方吧，还好 windows 下的安装不麻烦

## 其他问题
1. 没有 GM 以外的选择吗  
    尝试了 node Jimp，缩小图片效果不理想。暂时不支持在 img-sprite 中配置其他的位图引擎
    
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
