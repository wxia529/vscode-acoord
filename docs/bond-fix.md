---
修复方案
1. 数据结构变更 (src/models/structure.ts)
class Structure {
  bonds: Array<[string, string]> = [];
  periodicBondImages: Map<string, [number, number, number]> = new Map();
  // key: bondKey "atomId1-atomId2"
  // value: [ox, oy, oz] 镜像偏移，表示 atom2 相对于 atom1 的哪个镜像
}
---
2. 核心方法变更 (src/models/structure.ts)
2.1 calculateBonds() 方法
当前逻辑：
- 调用 calculatePeriodicBonds() 找到所有键
- 只存储原子对到 bonds
修改后：
- 调用 calculatePeriodicBonds() 找到所有键
- 存储原子对到 bonds
- 同时存储每个键的镜像信息到 periodicBondImages
2.2 calculatePeriodicBonds() 私有方法
当前逻辑：
- 遍历所有原子对
- 搜索27个镜像，找到最近的一个
- 如果距离 < 键长阈值，添加到 bonds
修改后：
- 遍历所有原子对
- 搜索27个镜像，找到最近的一个
- 如果距离 < 键长阈值：
  - 添加原子对到 bonds
  - 同时记录镜像偏移到 periodicBondImages
2.3 getPeriodicBonds() 方法（关键变更）
当前逻辑：
getPeriodicBonds() {
  for (const [id1, id2] of this.bonds) {
    // 重新搜索27个镜像，找最近的
    // 问题：拖动原子后镜像会变！
  }
}
修改后：
getPeriodicBonds() {
  for (const [id1, id2] of this.bonds) {
    const bondKey = Structure.bondKey(id1, id2);
    const storedImage = this.periodicBondImages.get(bondKey);
    
    if (storedImage) {
      // 使用存储的镜像（不重新计算）
      image = storedImage;
    } else {
      // 兼容旧数据：没有存储镜像时回退到计算
      image = findClosestImage(atom1, atom2);
    }
  }
}
---
### 3. 数据一致性变更 (`src/models/structure.ts`)
#### 3.1 `addBond(atomId1, atomId2)` 方法
**当前逻辑：**
- 规范化键对
- 检查是否已存在
- 添加到 `bonds`
**修改后：**
- 规范化键对
- 检查是否已存在
- 添加到 `bonds`
- **如果是周期性系统：**
  - **计算最近镜像**
  - **存储到 `periodicBondImages`**
#### 3.2 `removeBond(atomId1, atomId2)` 方法
**当前逻辑：**
- 从 `bonds` 中删除
**修改后：**
- 从 `bonds` 中删除
- **从 `periodicBondImages` 中删除对应条目**
#### 3.3 `clearBonds()` 方法
**当前逻辑：**
- `this.bonds = []`
**修改后：**
- `this.bonds = []`
- **`this.periodicBondImages.clear()`**
#### 3.4 `removeAtom(atomId)` 方法
**当前逻辑：**
- 从 `atoms` 中删除原子
- 从 `atomIndex` 中删除
- 过滤掉包含该原子的键
**修改后：**
- 从 `atoms` 中删除原子
- 从 `atomIndex` 中删除
- 过滤掉包含该原子的键
- **从 `periodicBondImages` 中删除相关条目**
---
4. 持久化变更 (src/models/structure.ts)
4.1 clone() 方法
修改后：
clone(): Structure {
  const cloned = new Structure(this.name, this.isCrystal);
  // ... 复制 atoms ...
  cloned.bonds = this.bonds.map(([a, b]) => [a, b]);
  cloned.periodicBondImages = new Map(this.periodicBondImages); // 新增
  // ... 复制其他字段 ...
}
4.2 toJSON() 方法
修改后：
toJSON() {
  return {
    // ... 其他字段 ...
    bonds: this.bonds,
    periodicBondImages: Array.from(this.periodicBondImages.entries()), // 新增
  };
}
4.3 fromJSON() 静态方法
修改后：
static fromJSON(data): Structure {
  // ... 其他字段 ...
  s.bonds = data.bonds ?? [];
  
  // 新增：恢复 periodicBondImages
  if (data.periodicBondImages) {
    s.periodicBondImages = new Map(data.periodicBondImages);
  }
  // 兼容旧数据：如果没有 periodicBondImages，保持为空 Map
}
---
### 5. 序列化器变更（可选优化）
**文件：** `src/io/parsers/*.ts`
**考虑：** 是否需要在 `.acoord` 格式中存储 `periodicBondImages`？
- **选项 A：** 只依赖 `bonds`，加载后镜像为空，第一次渲染时回退计算
- **选项 B：** 在 `.acoord` 格式中存储镜像信息（更精确）
**建议：** 选项 A，保持简单。因为：
- `periodicBondImages` 是计算结果，可以从 `bonds` 重新生成
- 第一次渲染时回退计算，之后镜像就固定了
---
6. 单元测试 (src/test/unit/models/structure.test.mts)
需要新增的测试用例：
6.1 基础功能测试
describe('periodicBondImages', () => {
  it('calculateBonds() sets periodicBondImages for crystal structures', () => {
    // 创建周期性结构
    // 调用 calculateBonds()
    // 验证 periodicBondImages 被正确填充
  });
  
  it('getPeriodicBonds() uses stored images instead of recalculating', () => {
    // 创建周期性结构，计算键
    // 拖动原子到晶格外
    // 验证 getPeriodicBonds() 仍返回原来的镜像
  });
  
  it('stored images are preserved after atom movement', () => {
    // 创建周期性结构，计算键
    // 移动原子
    // 验证 periodicBondImages 未改变
  });
});
6.2 手动操作测试
describe('manual bond operations', () => {
  it('addBond() calculates and stores image for periodic systems', () => {
    // 周期性系统中手动添加键
    // 验证 periodicBondImages 被设置
  });
  
  it('removeBond() removes from periodicBondImages', () => {
    // 添加键，然后删除
    // 验证 periodicBondImages 同步删除
  });
  
  it('clearBonds() clears periodicBondImages', () => {
    // 计算键，然后清空
    // 验证 periodicBondImages 被清空
  });
  
  it('removeAtom() removes related bond images', () => {
    // 添加原子和键，然后删除原子
    // 验证相关的 periodicBondImages 条目被删除
  });
});
6.3 持久化测试
describe('serialization', () => {
  it('clone() copies periodicBondImages', () => {
    // 创建结构，计算键
    // clone()
    // 验证 periodicBondImages 被正确复制
  });
  
  it('toJSON/fromJSON preserves periodicBondImages', () => {
    // 创建结构，计算键
    // toJSON() → fromJSON()
    // 验证 periodicBondImages 被保留
  });
  
  it('fromJSON() handles old data without periodicBondImages', () => {
    // 加载只有 bonds 没有 periodicBondImages 的旧数据
    // 验证不会崩溃，getPeriodicBonds() 回退计算
  });
});
6.4 边界情况测试
describe('edge cases', () => {
  it('getPeriodicBonds() falls back to calculation when image not stored', () => {
    // 创建结构，手动设置 bonds 但不设置 periodicBondImages
    // 验证 getPeriodicBonds() 可以回退计算
  });
  
  it('works correctly for non-periodic structures', () => {
    // 非周期性结构中，periodicBondImages 应该为空
    // getBonds() 应该正常工作
  });
});
---
## 实现步骤
### 阶段 1：核心逻辑（必须）
1. ✅ 在 `Structure` 类中添加 `periodicBondImages` 字段
2. ✅ 修改 `calculatePeriodicBonds()` 存储镜像信息
3. ✅ 修改 `getPeriodicBonds()` 使用存储的镜像
4. ✅ 修改 `calculateBonds()` 清空 `periodicBondImages`
### 阶段 2：数据一致性（必须）
5. ✅ 修改 `addBond()` 计算并存储镜像
6. ✅ 修改 `removeBond()` 同步删除镜像
7. ✅ 修改 `clearBonds()` 清空镜像
8. ✅ 修改 `removeAtom()` 删除相关镜像
### 阶段 3：持久化（必须）
9. ✅ 修改 `clone()` 复制镜像
10. ✅ 修改 `toJSON()` 序列化镜像
11. ✅ 修改 `fromJSON()` 反序列化镜像
### 阶段 4：测试（必须）
12. ✅ 编写单元测试验证所有功能
### 阶段 5：集成测试（推荐）
13. ✅ 手动测试周期性系统拖动原子
14. ✅ 验证文件保存/加载后镜像保持正确