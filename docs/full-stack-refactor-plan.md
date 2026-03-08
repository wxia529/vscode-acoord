# ACoord 全栈重构设计方案

**版本**: v2.0  
**日期**: 2026-03-08  
**状态**: 设计完成，待实施  
**影响范围**: Extension（后端）、Webview（前端）、文件格式、UI/UX、用户交互

---

## 目录

### 第一部分：Atom Property & DisplaySettings 重构

- [1. 背景与问题](#1-背景与问题)
- [2. 设计目标](#2-设计目标)
- [3. 核心设计理念](#3-核心设计理念)
- [4. 架构对比](#4-架构对比)
- [5. 数据模型设计](#5-数据模型设计)
- [6. 用户交互流程](#6-用户交互流程)
- [7. 消息协议设计](#7-消息协议设计)
- [8. 文件格式设计](#8-文件格式设计)

### 第二部分：前端交互与 UI 重构

- [9. 前端操作逻辑优化](#9-前端操作逻辑优化)
- [10. UI 布局重设计（Photoshop 风格）](#10-ui-布局重设计photoshop-风格)
- [11. 右键菜单实现](#11-右键菜单实现)
- [12. 快捷键系统](#12-快捷键系统)

### 第三部分：实施与验证

- [13. 代码审查结果](#13-代码审查结果)
- [14. 可行性分析](#14-可行性分析)
- [15. 实施计划](#15-实施计划)
- [16. 测试策略](#16-测试策略)
- [17. 迁移策略](#17-迁移策略)
- [18. 风险评估](#18-风险评估)
- [19. 关键决策记录](#19-关键决策记录)

---

# 第一部分：Atom Property & DisplaySettings 重构

---

## 1. 背景与问题

### 1.1 当前架构的混乱

#### 问题 1：职责分裂

**Radius 计算被分裂到两端**：

- **Extension 端** (`renderMessageBuilder.ts:180-181`):
  ```typescript
  const baseRadius = info?.covalentRadius || 0.3;
  const radius = Math.max(baseRadius * 0.35, 0.1);  // 硬编码缩放
  ```
  
- **Webview 端** (`renderer.ts:414-431`):
  ```typescript
  function getConfiguredAtomRadius(atom, baseAtomsById) {
    if (displayStore.atomSizeUseDefaultSettings !== false) return fallbackRadius;
    const atomOverride = displayStore.atomSizeByAtom?.[baseId];
    // ... 又重新应用覆盖逻辑
  }
  ```

**后果**：Extension 计算的 radius 被 Webview 覆盖，白白计算。

---

#### 问题 2：颜色处理不一致

**Atom 颜色**：Extension 完整计算优先级  
**Bond 颜色**：在 Extension 端已经计算好 `color1/color2`  
**Webview**：直接使用 Extension 发来的颜色，但 `atomColorByElement` 字段无效

**后果**：Atom 和 Bond 的处理流程不一致，displayStore 中的 `atomColorByElement` 成为死代码。

---

#### 问题 3：WireAtom 混淆"原始属性"与"计算值"

```typescript
export interface WireAtom {
  color: string;    // 必需，但不知道是"用户指定"还是"系统计算"
  radius: number;   // 必需，但不知道来源
}
```

**后果**：
- 无法区分用户在 .acoord 中指定的"固定颜色"和系统计算的"默认颜色"
- 用户修改 colorScheme 后，会覆盖所有原子颜色，无法保留用户特殊需求
- 未来 .acoord 格式无法保存"用户定义"元数据

---

#### 问题 4：DisplaySettings 覆盖机制重复且不一致

当前有 3 种不同的覆盖机制：

- `atomSizeByAtom`: 按原子 ID 覆盖半径
- `atomSizeByElement`: 按元素覆盖半径
- `atomColorByElement`: 按元素覆盖颜色（Webview 端无效）

**后果**：
- 同样都是"按元素"，半径和颜色的覆盖机制却不同
- 数据冗余，同步困难
- 新开发者难以理解

---

#### 问题 5：优先级系统缺乏文档

**Color 优先级**（Extension 端）：
1. `atom.color`
2. `settings.atomColorByElement[element]`
3. `colorScheme.colors[element]`
4. `ELEMENT_DATA[element].color`
5. `'#C0C0C0'`

**Radius 优先级**（Webview 端）：
1. `displayStore.atomSizeByAtom[atomId]`
2. `displayStore.atomSizeByElement[element]`
3. `displayStore.atomSizeGlobal`
4. Extension 发送的 `atom.radius`

**后果**：两套不同的优先级规则，缺乏一致性，无法回答"如果我设置了 atom.color，又修改了 colorScheme，会发生什么？"

---

### 1.2 对未来扩展的影响

#### 问题：.acoord 文件格式无法扩展

未来 .acoord 格式需要：
- 保存用户指定的"固定颜色"（不受 colorScheme 影响）
- 保存原子标签（label）
- 保存选择性动力学（selective dynamics）
- 保存自定义半径

但当前架构：
- WireAtom 的 color/radius 是"计算后的值"，无法追溯来源
- 没有区分"用户定义属性"和"系统计算属性"的机制

**后果**：
- 保存 .acoord 时，无法恢复用户指定的颜色/半径
- 加载 .acoord 后，会丢失所有"用户指定"的元数据

---

### 1.3 对多前端支持的影响

#### 问题：Webview 承担了过多计算逻辑

当前 Webview：
- 保存 displayStore 副本
- 执行 radius 覆盖计算
- 无法独立于 Extension 工作

**后果**：如果未来要支持 Jupyter、Web 应用等其他前端，需要重复实现这些计算逻辑。

---

## 2. 设计目标

### 2.1 核心目标

1. **职责清晰**：Extension 完全负责计算，Webview 只负责渲染
2. **数据明确**：Atom 始终有明确的 color/radius，不依赖运行时计算
3. **优先级统一**：所有属性的计算遵循统一的优先级规则
4. **用户交互直观**：DisplaySettings 是"当前画笔"，选中 → 应用 → 完成
5. **可扩展性强**：支持多种前端（Webview/Jupyter/其他）

---

### 2.2 非目标

- 不支持"动态颜色"（原子颜色随 colorScheme 自动变化）
- 不支持"锁定/解锁"概念（太复杂，类似 Photoshop 没有这个概念）
- 不保存 DisplaySettings 到 .acoord 文件（这是全局用户偏好）

---

## 3. 核心设计理念

### 3.1 类比：Photoshop 的画笔模式

```
Photoshop / Figma / Sketch:
  前景色: #FF0000        ← 当前画笔颜色
  选区: [选中区域]
  操作: 点击"填充" → 选区应用前景色

ACoord:
  DisplaySettings: { colorScheme: "jmol", radiusScale: 1.0 }  ← 当前原子画笔
  选中原子: [atom1, atom2, atom3]
  操作: 点击"应用样式" → 选中原子应用 DisplaySettings
```

### 3.2 核心原则

```
每个原子都有明确的 color 和 radius（必需字段）
DisplaySettings 是"当前画笔"，不自动应用到现有原子
Atom 的 color/radius 是文件特定数据，不随 DisplaySettings 自动变化
用户需要手动"应用"才会更新 Atom 的属性
```

### 3.3 数据分离

```
结构数据（保存在 .acoord）：
  - atoms: [{ element, position, color, radius }]  ← 原子当前状态
  - unitCell: { a, b, c, alpha, beta, gamma }
  - bonds: [{ atomId1, atomId2 }]

用户偏好（全局，不保存到 .acoord）：
  - DisplaySettings: currentColorScheme, backgroundColor, showAxes, ...
```

**理由**：
- 类似 VS Code 的主题设置：所有文件共享同一个主题，不随文件切换而变化
- DisplaySettings 是"显示偏好"，应该全局一致
- Atom 的 color/radius 是"结构数据"，应该保存在文件中

---

## 4. 架构对比

### 4.1 当前架构（混乱）

```
┌─────────────────────────────────────────────────────────────────┐
│                        Extension Host                            │
│                                                                  │
│  Parsers (XYZ/POSCAR)                                           │
│   ↓                                                              │
│  Atom { element, position, color?, radius? }  ← 混淆：可选字段   │
│   ↓                                                              │
│  RenderMessageBuilder:                                           │
│   - computeColor(atom, settings)     ← 计算颜色                 │
│   - radius = covalent * 0.35         ← 魔法数字                 │
│   ↓                                                              │
│  WireAtom { color, radius }  ← 传递计算值                       │
│                                                                  │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                         Webview                                  │
│                                                                  │
│  displayStore {                                                  │
│    atomSizeByAtom: {...}      ← 覆盖机制1                       │
│    atomSizeByElement: {...}   ← 覆盖机制2                       │
│    atomColorByElement: {...}  ← 覆盖机制3（无效！）              │
│  }                                                               │
│   ↓                                                              │
│  renderer:                                                       │
│   - radius = getConfiguredAtomRadius()  ← 又计算一遍！           │
│   - color = atom.color                 ← 直接用                 │
│                                                                  │
│  ❌ 问题：                                                        │
│    - radius 被计算两次                                           │
│    - color 的覆盖机制无效                                         │
│    - Atom 不知道属性来源                                          │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 目标架构（清晰）

```
┌─────────────────────────────────────────────────────────────────┐
│                        Extension Host                            │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Parsers (XYZ/POSCAR/CIF/.acoord)                         │   │
│  │  - 解析原子位置                                           │   │
│  │  - 计算 color (JMol)                                      │   │
│  │  - 计算 radius (covalent)                                 │   │
│  └──────────────────────────────────────────────────────────┘   │
│   ↓                                                              │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Atom {                                                    │   │
│  │   element: "C",                                           │   │
│  │   position: [x, y, z],                                    │   │
│  │   color: "#909090",       ← 必需，始终有值                 │   │
│  │   radius: 0.76,           ← 必需，始终有值                 │   │
│  │ }                                                         │   │
│  └──────────────────────────────────────────────────────────┘   │
│   ↓                                                              │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ DisplayConfigService (独占)                               │   │
│  │  - DisplaySettings: {                                     │   │
│  │      currentColorScheme: "jmol",                          │   │
│  │      currentRadiusScale: 1.0,                             │   │
│  │    }                                                      │   │
│  │  - applyToAtoms(atomIds) → 更新 Atom.color/radius        │   │
│  └──────────────────────────────────────────────────────────┘   │
│   ↓                                                              │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ RenderMessageBuilder                                      │   │
│  │  - 直接使用 atom.color/radius                             │   │
│  │  - 无任何计算逻辑                                          │   │
│  └──────────────────────────────────────────────────────────┘   │
│   ↓                                                              │
│  WireAtom { color: "#909090", radius: 0.76 }                    │
│                                                                  │
└───────────────────────────────┬─────────────────────────────────┘
                                │ postMessage
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│              Webview / Jupyter / 其他前端                        │
│                                                                  │
│  职责：                                                          │
│    ✅ 接收 WireAtom                                              │
│    ✅ 渲染（使用 atom.color/radius）                              │
│    ✅ 发送用户操作消息                                            │
│                                                                  │
│  不负责：                                                         │
│    ❌ 计算颜色/半径                                               │
│    ❌ 管理 DisplaySettings                                       │
│    ❌ 覆盖逻辑                                                    │
│                                                                  │
│  ✅ 优势：完全纯粹，易于扩展到其他前端                             │
└─────────────────────────────────────────────────────────────────┘
```

### 4.3 关键改进点

| 方面 | 当前架构 | 目标架构 |
|------|---------|---------|
| Atom 字段 | color/radius 可选 | color/radius 必需，始终有值 |
| 计算逻辑 | Extension + Webview 都计算 | Extension 独占 |
| DisplaySettings | 两端都有副本 | Extension 独占 |
| 切换颜色方案 | 自动应用到所有原子 | 仅更新设置，不自动应用 |
| 用户修改原子 | 无法保留特殊需求 | 明确保存到 Atom.color/radius |
| 多前端支持 | Webview 耦合计算逻辑 | 前端完全解耦 |

---

## 5. 数据模型设计

### 5.1 Atom 模型

**文件**：`src/models/atom.ts`

```typescript
export class Atom {
  // === 核心数据（必需） ===
  id: string;
  element: string;
  x: number;
  y: number;
  z: number;
  
  // === 当前样式（必需，不再是可选） ===
  color: string;      // 当前颜色，始终有值
  radius: number;     // 当前半径，始终有值
  
  // === 元数据（可选） ===
  label?: string;
  
  // === 动力学属性（可选） ===
  fixed: boolean = false;
  selectiveDynamics?: [boolean, boolean, boolean];
  
  // === 临时状态（不保存） ===
  selected: boolean = false;
  
  constructor(
    element: string,
    x: number,
    y: number,
    z: number,
    id?: string,
    options?: {
      color?: string;
      radius?: number;
      label?: string;
      fixed?: boolean;
      selectiveDynamics?: [boolean, boolean, boolean];
    }
  ) {
    this.element = element;
    this.x = x;
    this.y = y;
    this.z = z;
    this.id = id || `atom_${crypto.randomUUID()}`;
    
    // 必需字段：如果未提供，使用默认值
    this.color = options?.color || '#C0C0C0';
    this.radius = options?.radius || 1.5;
    
    this.label = options?.label;
    this.fixed = options?.fixed ?? false;
    this.selectiveDynamics = options?.selectiveDynamics;
  }
}
```

**关键变化**：
- ✅ `color` 和 `radius` 改为必需字段
- ✅ 构造函数添加 `color` 和 `radius` 参数
- ✅ 如果未提供，使用默认值
- ❌ 移除 `userDefinedColor`、`userDefinedRadius`、`colorSource` 等复杂字段

---

### 5.2 WireAtom 协议

**文件**：`src/shared/protocol.ts`

```typescript
export interface WireAtom {
  id: string;
  element: string;
  position: [number, number, number];
  
  // === 当前样式（必需） ===
  color: string;      // 当前颜色
  radius: number;     // 当前半径
  
  // === 元数据（可选） ===
  label?: string;
  
  // === 状态标志 ===
  selected?: boolean;
  selectable?: boolean;
  fixed?: boolean;
  selectiveDynamics?: [boolean, boolean, boolean];
}
```

**关键变化**：
- ✅ 保持 `color` 和 `radius` 为必需字段
- ✅ 这些是 Atom 的当前值，Extension 已经计算好
- ❌ 不区分"用户定义"和"系统计算"（太复杂）

---

### 5.3 DisplaySettings

**文件**：`src/shared/protocol.ts`

```typescript
export interface WireDisplaySettings {
  // === 当前"画笔"配置 ===
  currentColorScheme?: string;                      // 当前颜色方案
  currentRadiusScale?: number;                      // 当前半径缩放
  currentColorByElement?: Record<string, string>;   // 当前元素颜色覆盖
  currentRadiusByElement?: Record<string, number>;  // 当前元素半径覆盖
  
  // === 全局渲染设置 ===
  backgroundColor?: string;
  showAxes?: boolean;
  unitCellColor?: string;
  unitCellThickness?: number;
  unitCellLineStyle?: 'solid' | 'dashed';
  bondThicknessScale?: number;
  viewZoom?: number;
  scaleAtomsWithLattice?: boolean;
  projectionMode?: 'orthographic' | 'perspective';
  
  // === 光照设置 ===
  lightingEnabled?: boolean;
  ambientIntensity?: number;
  ambientColor?: string;
  shininess?: number;
  keyLight?: WireLightConfig;
  fillLight?: WireLightConfig;
  rimLight?: WireLightConfig;
  
  // === 移除的字段 ===
  // ❌ atomSizeByAtom - 改用 Atom.color/radius
  // ❌ atomSizeUseDefaultSettings - 语义模糊
  // ❌ atomSizeGlobal - 合并到 currentRadiusScale
  // ❌ atomSizeScale - 重命名为 currentRadiusScale
  // ❌ atomColorByElement - 重命名为 currentColorByElement
  // ❌ atomSizeByElement - 重命名为 currentRadiusByElement
  // ❌ atomColorSchemeId - 重命名为 currentColorScheme
}
```

**关键变化**：
- ✅ 重命名字段以强调"当前画笔"概念
- ✅ 移除冗余字段
- ✅ Extension 独占，Webview 不保存副本

---

### 5.4 Atom 生命周期图示

```
┌─────────────────────────────────────────────────────────────────┐
│                      Atom 的完整生命周期                          │
└─────────────────────────────────────────────────────────────────┘

【阶段1：创建】
    │
    ├─ XYZ/POSCAR 解析
    │   └─ Extension:
    │       atom = new Atom("C", 0, 0, 0)
    │       atom.color = JMOL["C"] = "#909090"
    │       atom.radius = covalent["C"] * 1.0 = 0.76
    │
    ├─ .acoord 解析
    │   └─ Extension:
    │       atom = new Atom("C", 0, 0, 0)
    │       atom.color = file.color = "#FF0000"
    │       atom.radius = file.radius = 1.0
    │
    └─ 用户添加新原子
        └─ Extension:
            atom = new Atom("C", x, y, z)
            atom.color = DisplaySettings.currentColorScheme["C"]
            atom.radius = covalent["C"] * DisplaySettings.currentRadiusScale

【阶段2：修改】
    │
    ├─ 用户手动修改单个原子
    │   └─ Webview → Extension:
    │       setAtomColor(atomId, "#00FF00")
    │       atom.color = "#00FF00"
    │
    ├─ 批量应用 DisplaySettings
    │   └─ Webview → Extension:
    │       applyDisplaySettings([atomId1, atomId2])
    │       atom1.color = DisplaySettings.currentColorScheme["C"]
    │       atom1.radius = covalent["C"] * DisplaySettings.currentRadiusScale
    │
    └─ 用户切换颜色方案（不影响现有原子）
        └─ Extension:
            DisplaySettings.currentColorScheme = "cpk"
            // ❌ 不修改 atom.color
            // ✅ 仅更新设置

【阶段3：渲染】
    │
    └─ Extension → Webview:
        RenderMessage {
          atoms: [{ color: "#909090", radius: 0.76 }]
        }
        Webview 直接使用，无任何计算

【阶段4：保存】
    │
    └─ Extension 序列化:
        .acoord 文件:
          { atoms: [{ color: "#909090", radius: 0.76 }] }
        
        // ❌ 不保存 DisplaySettings
```

---

## 6. 用户交互流程

### 6.1 场景A：打开 XYZ 文件

```
用户操作：File → Open → water.xyz
    │
    ▼
┌─────────────────────────────────────────────┐
│ Extension: XYZParser.parse()                │
│  - 读取原子位置                              │
│  - 计算 color: JMOL["O"] = "#FF0D0D"       │
│  - 计算 radius: 0.66 * 1.0 = 0.66          │
│  - atom = { element: "O", color, radius }  │
└─────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────┐
│ Extension: RenderMessageBuilder             │
│  - WireAtom { color: "#FF0D0D", radius: 0.66 } │
│  - 无计算逻辑                               │
└─────────────────────────────────────────────┘
    │
    ▼ postMessage
┌─────────────────────────────────────────────┐
│ Webview: renderer.renderStructure()         │
│  - 直接使用 atom.color/radius               │
│  - 渲染完成                                 │
└─────────────────────────────────────────────┘
```

---

### 6.2 场景B：切换颜色方案

```
用户操作：切换颜色方案 JMol → CPK
    │
    ▼
┌─────────────────────────────────────────────┐
│ Webview → Extension:                        │
│  setColorScheme("cpk")                      │
└─────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────┐
│ Extension: DisplayConfigService             │
│  - DisplaySettings.currentColorScheme = "cpk" │
│  - ❌ 不修改任何 Atom.color                 │
└─────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────┐
│ Webview UI:                                 │
│  ┌─────────────────────────────────────┐   │
│  │ 已切换到 CPK 颜色方案                │   │
│  │                                     │   │
│  │ [应用到选中 (0)]                    │   │
│  │ [应用到所有原子 (50)]               │   │
│  └─────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

**关键点**：
- ✅ 切换颜色方案只更新 DisplaySettings
- ✅ 不自动修改任何 Atom.color
- ✅ 用户需要手动"应用"才会更新

---

### 6.3 场景C：应用到选中原子

```
用户操作：选中 10 个原子 → 点击"应用到选中"
    │
    ▼
┌─────────────────────────────────────────────┐
│ Webview → Extension:                        │
│  applyDisplaySettings([atomId1, ..., atomId10]) │
└─────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────┐
│ Extension: DisplayConfigService.applyToAtoms() │
│  for atom in selectedAtoms:                 │
│    atom.color = CPK[atom.element]          │
│    atom.radius = covalent * scale          │
└─────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────┐
│ Extension: RenderMessageBuilder             │
│  - 使用新的 atom.color/radius               │
│  - 发送 RenderMessage                       │
└─────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────┐
│ Webview: 重新渲染                           │
│  - 10 个原子的颜色已更新                     │
└─────────────────────────────────────────────┘
```

---

## 7. 消息协议设计

### 7.1 Webview → Extension 消息

#### 7.1.1 原子操作

```typescript
// 设置单个原子的颜色
export interface SetAtomColorMessage {
  command: 'setAtomColor';
  atomIds: string[];
  color: string;  // CSS hex color: "#RRGGBB"
}

// 设置单个原子的半径
export interface SetAtomRadiusMessage {
  command: 'setAtomRadius';
  atomIds: string[];
  radius: number;  // Angstroms
}

// 批量应用 DisplaySettings 到选中的原子
export interface ApplyDisplaySettingsMessage {
  command: 'applyDisplaySettings';
  atomIds: string[];
}
```

#### 7.1.2 DisplaySettings 操作

```typescript
// 切换颜色方案（不修改原子）
export interface SetColorSchemeMessage {
  command: 'setColorScheme';
  schemeId: string;
}

// 更新 DisplaySettings
export interface UpdateDisplaySettingsMessage {
  command: 'updateDisplaySettings';
  settings: Partial<WireDisplaySettings>;
}
```

---

### 7.2 Extension → Webview 消息

#### 7.2.1 渲染消息

```typescript
export interface RenderMessage {
  command: 'render';
  data: WireRenderData;
  displaySettings?: WireDisplaySettings;  // 当前 DisplaySettings
}
```

#### 7.2.2 确认消息

```typescript
// 颜色方案已切换（但原子未变）
export interface ColorSchemeChangedMessage {
  command: 'colorSchemeChanged';
  schemeId: string;
}

// 指定原子的属性已更新
export interface AtomsUpdatedMessage {
  command: 'atomsUpdated';
  atomIds: string[];
}
```

---

## 8. 文件格式设计

### 8.1 .acoord 文件格式规范

**文件扩展名**: `.acoord`  
**格式**: JSON  
**版本**: 1.0

---

### 8.2 文件结构

```typescript
interface ACoordFile {
  version: "1.0";
  atoms: ACoordAtom[];
  unitCell?: ACoordUnitCell;
  bonds?: ACoordBond[];
}

interface ACoordAtom {
  id: string;
  element: string;
  x: number;
  y: number;
  z: number;
  color: string;      // CSS hex color: "#RRGGBB" - rendered as-is
  radius: number;     // Render radius in Angstroms - used directly for display
  label?: string;
  fixed?: boolean;
  selectiveDynamics?: [boolean, boolean, boolean];
}

// Radius semantics:
// - .acoord radius values are used directly for rendering (no scaling applied)
// - Users can specify any value (e.g., covalent radius 0.76 for carbon)
// - If omitted, defaults to covalent radius * 0.35 for visual aesthetics
// - This gives users full control over atom appearance

interface ACoordUnitCell {
  a: number;
  b: number;
  c: number;
  alpha: number;
  beta: number;
  gamma: number;
}

interface ACoordBond {
  atomId1: string;
  atomId2: string;
}
```

---

### 8.3 文件示例

#### 8.3.1 分子结构（无晶胞）

```json
{
  "version": "1.0",
  "atoms": [
    {
      "id": "atom_abc123",
      "element": "O",
      "x": 0.0,
      "y": 0.0,
      "z": 0.1173,
      "color": "#FF0D0D",
      "radius": 0.66
    },
    {
      "id": "atom_def456",
      "element": "H",
      "x": 0.0,
      "y": 0.7572,
      "z": -0.4692,
      "color": "#FFFFFF",
      "radius": 0.31
    }
  ],
  "bonds": [
    { "atomId1": "atom_abc123", "atomId2": "atom_def456" }
  ]
}
```

---

### 8.4 保存策略

```
保存内容：
  ✅ 原子数据：element, position, color, radius, label
  ✅ 晶胞参数：unitCell
  ✅ 键：bonds

不保存内容：
  ❌ DisplaySettings（全局用户偏好）
  ❌ 光源设置（全局用户偏好）
  ❌ 临时状态（selected）
```

**理由**：
- DisplaySettings 是"显示偏好"，应该全局一致
- 类似 VS Code 的主题设置：所有文件共享同一个主题
- 用户切换 DisplaySettings 时，不应该影响文件中的原子颜色

---

# 第二部分：前端交互与 UI 重构

---

## 9. 前端操作逻辑优化

### 9.1 操作对比

```
┌─────────────────────────────────────────────────────────────────┐
│                      操作逻辑改进对比                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  改进前                          改进后                         │
│  ────────                        ────────                       │
│                                                                 │
│  框选:                           框选:                          │
│    Shift+拖拽                      直接拖拽空白区域             │
│    (与拖拽冲突)                      [仅原子 ▼] 下拉菜单        │
│                                    → 无组合键，无冲突           │
│                                                                 │
│  移动原子:                       移动原子:                       │
│    Shift+点击已选中              Shift+Alt+拖拽                  │
│    (逻辑混乱)                      → 组合键明确，无歧义         │
│                                                                 │
│  添加原子:                       添加原子:                       │
│    面板输入坐标                  键入 "C" + 点击空白处           │
│    (流程繁琐)                    或工具栏下拉 + 点击             │
│                                    或右键菜单                    │
│                                    → 3种方式，更直观             │
│                                                                 │
│  删除:                          删除:                           │
│    仅按钮                         Delete 键                      │
│                                    或工具栏按钮                  │
│                                    或右键菜单                    │
│                                    → 3种方式，更灵活             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 9.2 交互流程

#### 9.2.1 选择操作

```
点击原子         → 选择/取消选择
Ctrl+点击        → 多选
拖拽空白区域     → 框选

框选模式（顶部下拉菜单）：
  - 仅原子
  - 仅键
  - 原子和键
```

#### 9.2.2 移动操作

```
Shift+Alt+拖拽原子     → 移动单个原子
Shift+Alt+拖拽选中组   → 移动选中组

（无需专门工具，组合键即可）
```

#### 9.2.3 添加原子操作

```
方式1：键入元素符号 + 点击
  用户输入: "C" 或 "c"
  → 进入"添加 C 原子"模式
  → 点击空白处添加 C 原子
  → Esc 或点击原子取消

方式2：顶部工具栏下拉菜单
  工具栏: [添加原子: C ▼]
  → 下拉选择元素
  → 选择后自动进入添加模式，点击空白处添加

方式3：右键菜单
  右键空白处 → 添加原子 → 选择元素
```

#### 9.2.4 删除操作

```
方式1：键盘快捷键
  Delete / Backspace → 删除选中的原子/键

方式2：顶部工具栏按钮
  [删除] 按钮 → 删除选中的原子/键

方式3：右键菜单
  右键原子/键 → 删除
```

---

## 10. UI 布局重设计（Photoshop 风格）

### 10.1 整体布局

```
┌─────────────────────────────────────────────────────────────────────┐
│  顶部工具栏                                                         │
│  [添加原子: C ▼] [删除] │ 框选: [仅原子 ▼] │ 颜色: [JMol ▼]        │
├───┬─────────────────────────────────────────────────┬───────────────┤
│   │                                                 │               │
│ 左│                                                 │ ▼ Properties  │
│ 侧│                                                 │   [属性面板]  │
│ 工│                                                 │ ▼ Structure   │
│ 具│                                                 │   [结构信息]  │
│ 栏│              3D 画布                            │ ▼ Atom List   │
│   │                                                 │   [原子列表]  │
│ [V]│                                                 │ ▶ Measurements│
│ [M]│                                                 │   [测量]      │
│ [B]│                                                 │ ▼ Lattice     │
│ [A]│                                                 │   [晶胞]      │
│ [D]│                                                 │ ▼ Display     │
│   │                                                 │   [显示]      │
│   │                                                 │ ▼ Colors      │
│   │                                                 │   [颜色]      │
│   │                                                 │ ▼ Size&Style  │
│   │                                                 │   [大小样式]  │
│   │                                                 │ ▶ Lighting    │
│   │                                                 │ ▶ Trajectory  │
├───┴─────────────────────────────────────────────────┴───────────────┤
│  底部状态栏                                                         │
│  选择模式 | 已选中: 0 | 移动: Shift+Alt+拖拽 | 添加原子: 键入元素   │
└─────────────────────────────────────────────────────────────────────┘
```

---

### 10.2 左侧工具栏

```
┌───┐
│ V │ ← 选择工具（默认）
├───┤   • 点击选择
│ M │   • Ctrl+点击多选
├───┤   • 拖拽框选
│ B │
├───┤ ← 移动工具
│ A │   • 拖拽移动原子
├───┤   • Shift+Alt+拖拽（全局）
│ D │
├───┤ ← 框选工具
│   │   • 画矩形框选
├───┤   • 可选目标（原子/键）
│   │
├───┤ ← 添加原子工具
│   │   • 点击空白处添加
├───┤   • 工具栏选择元素
│   │
├───┤ ← 删除工具
│   │   • 点击删除原子/键
└───┘   • 或 Delete 键

快捷键：
  V - 选择工具
  M - 移动工具
  B - 框选工具
  A - 添加原子
  D - 删除工具
  Esc - 返回选择工具
```

---

### 10.3 右侧面板（10个可折叠面板）

#### 面板1: Properties（智能属性面板）

```
┌─────────────────────────────────┐
│ Properties                    ▼ │
├─────────────────────────────────┤
│ [状态：无选择]                  │
│   点击原子或键查看属性           │
│   [添加原子]                    │
│                                 │
│ [状态：选中1个原子]              │
│   Element: [C ▼]  [更改]        │
│   Position:                     │
│     X: [0.0] Y: [0.0] Z: [0.0]  │
│   Color: [●] #909090            │
│   Radius: [0.76 Å]              │
│   [应用到所有同类元素]           │
│                                 │
│ [状态：选中1个键]                │
│   Bond: C(1) - C(2)             │
│   Length: 1.54 Å                │
│   [设置键长] [删除键]           │
│                                 │
│ [状态：选中多个(10)]             │
│   Selected: 10 atoms            │
│   Elements: C(5), H(5)          │
│   [删除选中] [批量修改]         │
└─────────────────────────────────┘
```

#### 面板2-10: 简化描述

- **Structure** - 结构信息（化学式、原子数、分子量）
- **Atom List** - 原子列表（分组、筛选、搜索）
- **Measurements** - 测量（键长、键角）
- **Lattice** - 晶胞（参数、超胞）
- **Display** - 显示（背景、坐标轴、投影）
- **Colors** - 颜色（颜色方案、元素覆盖）
- **Size & Style** - 大小和样式（原子、键、晶胞）
- **Lighting** - 光照（环境光、主光、补光）
- **Trajectory** - 轨迹（播放控制）

---

## 11. 右键菜单实现

### 11.1 实现架构

```
用户右键点击
    │
    ▼
Webview 监听 contextmenu 事件
    │
    ├─→ event.preventDefault() (阻止浏览器默认菜单)
    │
    ▼
检测点击目标
    │
    ├─→ 点击原子？ → 显示原子菜单
    ├─→ 点击键？   → 显示键菜单
    └─→ 点击空白？ → 显示通用菜单
    │
    ▼
显示自定义菜单 (HTML/CSS)
    │
    ▼
用户点击菜单项
    │
    ▼
Webview 发送 postMessage 到 Extension
    │
    ▼
Extension 处理消息 (现有处理器)
    │
    ▼
Extension 返回 RenderMessage
    │
    ▼
Webview 更新渲染
```

### 11.2 菜单内容

```
右键点击原子：
┌─────────────────────┐
│ 删除原子             │ → deleteAtom
│ 更改元素          ▶ │ → 子菜单
│ ─────────────────── │
│ 复制                 │ → copyAtoms
│ 粘贴                 │ → pasteSelection
│ ─────────────────── │
│ 设置颜色...          │ → 颜色选择器
│ 设置半径...          │ → 输入框
└─────────────────────┘

右键点击键：
┌─────────────────────┐
│ 删除键               │ → deleteBond
│ 设置键长...          │ → 输入框
│ ─────────────────── │
│ 创建新键...          │ → createBond
└─────────────────────┘

右键点击空白处：
┌─────────────────────┐
│ 添加原子          ▶ │ → 子菜单 (C, H, O, N...)
│ ─────────────────── │
│ 撤销                 │ → undo
│ 重做                 │ → redo
│ ─────────────────── │
│ 全选                 │ → selectAll
│ 取消选择             │ → clearSelection
│ ─────────────────── │
│ 保存                 │ → saveStructure
│ 导出图片             │ → saveRenderedImage
└─────────────────────┘
```

### 11.3 Extension 端状态

```
✅ 已存在的消息处理器（无需修改）：
  - addAtom (添加原子)
  - deleteAtom / deleteAtoms (删除原子)
  - changeAtoms (更改元素)
  - undo / redo (撤销/重做)
  - copyAtoms / pasteSelection (复制/粘贴)
  - deleteBond / createBond (删除/创建键)
  - setAtomColor (设置颜色)
  - setAtomRadius (设置半径) - 需新增

⚠️ 需新增消息处理器：
  - setAtomRadius
  - setAtomFixed
  - setAtomSelectiveDynamics
```

---

## 12. 快捷键系统

```
工具切换：
  V - 选择工具
  M - 移动工具
  B - 框选工具
  A - 添加原子工具
  D - 删除工具
  Esc - 返回选择工具 / 取消当前操作

选择操作：
  点击 - 选择
  Ctrl+点击 - 多选
  Ctrl+A - 全选
  Ctrl+I - 反选

编辑操作：
  Delete / Backspace - 删除选中
  Ctrl+Z - 撤销
  Ctrl+Y / Ctrl+Shift+Z - 重做
  Ctrl+C - 复制
  Ctrl+V - 粘贴

添加原子：
  键入元素符号 - 进入添加模式
```

---

# 第三部分：实施与验证

---

## 13. 代码审查结果

### 13.1 前端代码审查

| 模块 | 当前状态 | 重构难度 | 关键发现 |
|------|---------|---------|---------|
| **选择逻辑** | ✅ 完整 | 简单 | 支持 单选/多选/框选，raycaster 命中检测 |
| **框选实现** | ✅ 完整 | 简单 | 屏幕坐标投影判断，CSS 元素可视化 |
| **拖拽逻辑** | ✅ 完整 | 中等 | 支持 单原子/组拖拽，drag plane + lerp 平滑 |
| **右键菜单** | ❌ 缺失 | 中等 | 需从零实现 |
| **状态管理** | ✅ 良好 | 简单 | 已拆分为 8 个独立 store |
| **UI 布局** | ✅ 灵活 | 简单 | Tab 导航，易于扩展 |

**风险点**：
- 选中颜色硬编码 `#f6d55c`，需参数化
- `interaction.ts` 文件 344 行，职责混杂
- 修饰键逻辑分散在多处

**建议**：
- 参数化选中样式（颜色、缩放因子）
- 拆分 `interaction.ts` 为多个模块

---

### 13.2 后端代码审查

| 消息类型 | 功能 | 状态 |
|---------|------|------|
| `AddAtomMessage` | 添加原子 | ✅ 已存在 |
| `DeleteAtomMessage` | 删除原子 | ✅ 已存在 |
| `MoveAtomMessage` | 移动原子 | ✅ 已存在 |
| `ChangeAtomsMessage` | 更改元素 | ✅ 已存在 |
| `SetAtomColorMessage` | 设置颜色 | ✅ 已存在 |
| `SetAtomRadiusMessage` | 设置半径 | ❌ **需新增** |
| `SetAtomFixedMessage` | 设置固定 | ❌ **需新增** |
| `ApplyDisplaySettingsMessage` | 应用样式 | ❌ **需新增** |

**结论**：后端需要新增 3 个消息处理器，其余已完备。

---

## 14. 可行性分析

### 14.1 技术可行性

| 维度 | 评分 | 说明 |
|------|------|------|
| 前端选择逻辑 | ★★★★☆ | 完整，支持 单选/多选/框选，扩展点清晰 |
| 框选复杂度 | ★★★☆☆ | 实现清晰但与拖拽逻辑耦合 |
| 拖拽复杂度 | ★★★☆☆ | 组拖拽逻辑复杂，需独立测试 |
| 状态管理 | ★★★★★ | 领域分离良好，可直接扩展 |
| 右键菜单 | ★☆☆☆☆ | 完全缺失，需从零实现 |
| UI 灵活性 | ★★★★☆ | Tab 导航 + Panel 结构易于扩展 |
| 后端消息机制 | ★★★★★ | 扩展性优秀，易于添加新消息 |

**结论**：✅ **技术完全可行**，主要工作是前端 UI 重构和右键菜单实现。

---

### 14.2 工作量评估

| 阶段 | 工作内容 | 预估时间 |
|------|---------|---------|
| **Phase 1** | 后端 Atom 模型 + 解析器 + 新消息 | 6 小时 |
| **Phase 2** | 后端 RenderMessageBuilder 简化 + 测试 | 2 小时 |
| **Phase 3** | 前端交互逻辑优化 | 10 小时 |
| **Phase 4** | 前端 UI 重组 + 右键菜单 | 14 小时 |
| **Phase 5** | 前端工具栏 + 状态栏 | 7 小时 |
| **Phase 6** | 测试 + 文档 | 15 小时 |
| **总计** | - | **54 小时** |

---

## 15. 实施计划

### 15.1 阶段划分

```
Phase 1: 后端基础 (6h)
  ├─ Atom 模型重构（color/radius 必需字段）
  ├─ 解析器修改（11个文件）
  ├─ 新增消息类型（3个）
  └─ DisplaySettings 重命名 + 迁移脚本

Phase 2: 后端简化 (2h)
  ├─ RenderMessageBuilder 删除计算逻辑
  └─ 单元测试（Atom/解析器）

Phase 3: 前端交互 (10h)
  ├─ 简化选择逻辑（直接拖拽框选）
  ├─ 实现 Shift+Alt 拖拽移动
  ├─ 实现键入元素添加原子
  └─ 框选模式下拉菜单

Phase 4: 前端 UI (14h)
  ├─ 实现右键菜单组件
  ├─ 集成右键菜单到交互
  ├─ 重组右侧面板（10个）
  └─ 实现 Properties 智能面板

Phase 5: 前端工具栏 (7h)
  ├─ 实现顶部工具栏
  ├─ 实现左侧工具栏（可选）
  └─ 优化状态栏提示

Phase 6: 测试与文档 (15h)
  ├─ 单元测试
  ├─ 集成测试
  ├─ 回归测试
  └─ 文档更新
```

---

## 16. 测试策略

### 16.1 单元测试

```typescript
// Atom 模型测试
describe('Atom model', () => {
  it('should have default color/radius if not provided', () => {
    const atom = new Atom('C', 0, 0, 0);
    expect(atom.color).toBe('#C0C0C0');
    expect(atom.radius).toBe(1.5);
  });
});

// 解析器测试
describe('XYZParser with color/radius', () => {
  it('should set atom color from JMol scheme', () => {
    const parser = new XYZParser();
    const [structure] = parser.parse('2\n\nC 0 0 0\nH 1 0 0');
    expect(structure.atoms[0].color).toBe('#909090');  // JMol C
  });
});
```

### 16.2 集成测试

- 端到端消息流测试
- 右键菜单功能测试
- UI 交互流程测试

### 16.3 回归测试

- 所有现有文件格式兼容性
- DisplaySettings 迁移测试
- 性能基准测试

---

## 17. 迁移策略

### 17.1 Atom 模型迁移

**策略**：构造函数提供默认值（向后兼容）

```typescript
// 无需迁移现有数据
const atom = new Atom('C', 0, 0, 0);  // 自动使用默认值
```

---

### 17.2 DisplaySettings 迁移

**迁移脚本**：

```typescript
export const v4ToV5: Migration = {
  fromVersion: 4,
  toVersion: 5,
  migrate: async (config: DisplayConfig): Promise<DisplayConfig> => {
    const settings = { ...config.settings };
    
    return {
      ...config,
      settings: {
        ...settings,
        currentColorScheme: settings.atomColorSchemeId,
        currentRadiusScale: settings.atomSizeScale,
        // ... 其他字段重命名
      },
      schemaVersion: 5,
    };
  },
};
```

---

## 18. 风险评估

### 18.1 技术风险

| 风险 | 等级 | 缓解措施 |
|------|------|---------|
| Atom 模型变更导致解析失败 | 低 | 构造函数提供默认值 |
| DisplaySettings 迁移失败 | 中 | 备份机制 + 回滚功能 |
| Webview 兼容性问题 | 低 | 完整的集成测试 |
| 右键菜单性能问题 | 低 | 复用 DOM 元素 |

---

### 18.2 用户体验风险

| 风险 | 等级 | 缓解措施 |
|------|------|---------|
| 用户习惯改变 | 中 | 详细文档 + UI 提示 |
| atomSizeByAtom 数据丢失 | 高 | 备份文件 + 提示消息 |
| .acoord 格式不兼容旧版本 | 中 | 文档说明 + 版本检查 |

---

## 19. 关键决策记录

### 决策1：实施顺序

**已确认**：Phase 1-2（后端）→ Phase 3-4（前端交互+UI）→ Phase 5-6（工具栏+测试）

**理由**：后端稳定后再改前端，风险可控

---

### 决策2：.acoord 文件格式

**已确认**：
- ✅ 不保存 DisplaySettings
- ✅ 保存 Atom 的 color/radius
- ⏰ 在 Phase 7 单独实现（+8小时）

---

### 决策3：UI 重组范围

**已确认**：
- ✅ 右侧改为 10 个可折叠面板
- ⏰ 面板拖拽排序功能延迟到后续版本

---

### 决策4：左工具栏实现

**已确认**：
- ✅ 实现左侧工具栏（Phase 5.2，+2小时）
- ✅ 工具：选择/移动/框选/添加/删除

---

## 总结

本设计文档整合了 Atom Property 重构、前端交互优化、UI 重构三个部分，提供了完整的实施路线图。

**核心改进**：
- ✅ 职责清晰：Extension 负责计算，Webview 只渲染
- ✅ 操作简化：组合键从 5 种减少到 2 种
- ✅ UI 专业：Photoshop 风格布局
- ✅ 功能完备：右键菜单、快捷键系统
- ✅ 可扩展：支持多前端、新文件格式

**预期收益**：
- 用户体验大幅提升
- 代码架构更清晰
- 为未来功能扩展打好基础

---

**文档版本**: v2.0  
**最后更新**: 2026-03-08  
**作者**: opencode & user
