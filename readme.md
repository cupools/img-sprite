## 技术要点

- CSS 文件中提取出图片地址（done）
- 根据图片地址，使用 spritemith 合并图片，并得到坐标（done）
- 将 CSS 中的图片地址、大小替换为精灵图，并添加坐标（done）

### 其他细节
- 提取颜色，区分十六进制和 rgb（done）
- Base64 标记
- 自动生成图片大小，即常规精灵图工具的简化

### 其他
- 每增加一个图片，需要耗时差不多 60ms，由 spritemith 决定

## 遍历 AST 树
- 遍历所有对象节点，包括数组
- 提供 enter 和 leave 调用
- 基本数据类型不需要查看

--


- 对象执行 enter 和 leave
    - next：没什么用
    - skip：不检查当前 node 的子节点
    - stop：停止遍历
    - remove：移除当前 node
- 基本数据不做处理
- 数组需要遍历，递归每个对象

### 其他
- 通过规则进一步指定无需裁剪的分支，如 decoration、 rule