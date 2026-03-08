# 鼠标交互重构计划

## 一、变更概述

### 1.1 目标

| 项目 | 内容 |
|------|------|
| 移除模式 | Move、Box |
| 保留模式 | Select、Add、Delete |
| 新增交互 | Shift+右键拖动=自由旋转选中原子，Shift+Alt+右键拖动=移动选中原子 |
| 右键菜单 | 右键点击（松开时未移动）触发 |
| 相机控制 | 右键拖动空白区域=旋转相机视角 |

### 1.2 交互行为对照表

| 场景 | 当前行为 | 重构后行为 |
|------|----------|------------|
| Select模式，左键点击原子 | 选择原子 | 不变 |
| Select模式，左键拖动空白区域 | 开始框选 | 不变 |
| Select模式，右键点击 | 显示右键菜单 | 显示右键菜单（松开时未移动） |
| Select模式，右键拖动空白区域 | 无操作（被菜单阻止） | **相机旋转** |
| 有选中原子，Shift+右键拖动 | 无操作 | **自由旋转选中原子** |
| 有选中原子，Shift+Alt+右键拖动 | 无操作 | **移动选中原子** |
| Move模式(M) | 点击拖动移动原子 | 移除模式 |
| Box模式(B) | 拖动框选 | 移除模式，Select模式直接框选 |
| Shift+Alt+左键拖动 | 任意模式下移动原子 | 移除 |

---

## 二、背景：当前代码结构分析

### 2.1 现有交互模式

**文件**: `media/webview/src/state.ts:204`

```typescript
export type ToolType = 'select' | 'move' | 'box' | 'add' | 'delete';
```

**当前行为**:

| 模式 | 快捷键 | 触发位置 | 行为 |
|------|--------|----------|------|
| `select` | V | `interaction.ts:512` | 点击选择原子，拖动空白区域开始框选 |
| `move` | M | `interaction.ts:517` | 点击原子并拖动移动位置 |
| `box` | B | `interaction.ts:522` | 拖动创建选择框 |
| `add` | A | `interaction.ts:526` | 点击添加新原子 |
| `delete` | D | `interaction.ts:531` | 点击删除原子/键 |

### 2.2 现有鼠标事件处理流程

**文件**: `media/webview/src/interaction.ts`

```
pointerdown (L135-279)
├── 光照选择器拖动 (L137-143)
├── Add模式：点击添加原子 (L147-188)
├── 点击原子处理 (L203-240)
│   ├── Delete模式：删除原子 (L207-213)
│   ├── Move模式或Shift+Alt：开始拖动 (L215-236)
│   └── Select模式：选择原子 (L238)
├── 点击键处理 (L243-259)
│   ├── Delete模式：删除键 (L249-254)
│   └── 选择键 (L256)
└── Box/Select模式：开始框选 (L262-278)

pointermove (L281-371)
├── 光照拖动 (L282-285)
├── 开始拖动检测（超过阈值）(L291-306)
├── 原子拖动更新 (L308-355)
└── 框选框更新 (L358-370)

pointerup/pointerleave/pointercancel (L373-449)
├── 结束拖动 (L382-390)
└── 完成框选 (L392-440)
```

### 2.3 现有右键菜单

**文件**: `media/webview/src/components/contextMenu.ts:721-806`

```typescript
canvas.addEventListener('contextmenu', (event: MouseEvent) => {
  event.preventDefault();
  // 射线检测
  // 显示对应菜单
});
```

**问题**: `contextmenu` 事件在松开右键时触发，无法区分"点击显示菜单"和"拖动操作"。

---

## 三、详细变更清单

### 3.1 `media/webview/src/state.ts`

#### 变更1: 修改 ToolType

**位置**: L204

```typescript
// 当前
export type ToolType = 'select' | 'move' | 'box' | 'add' | 'delete';

// 变更后
export type ToolType = 'select' | 'add' | 'delete';
```

#### 变更2: InteractionState 新增字段

**位置**: L206-219

```typescript
// 当前
export interface InteractionState {
  isDragging: boolean;
  dragAtomId: string | null;
  lastDragWorld: { x: number; y: number; z: number } | null;
  dragPlaneNormal: { x: number; y: number; z: number } | null;
  rotationAxis: string;
  rotationInProgress: boolean;
  groupMoveActive: boolean;
  renderAtomOffsets: Record<string, [number, number, number]>;
  shouldFitCamera: boolean;
  addingAtomElement: string | null;
  boxSelectionMode: BoxSelectionMode;
  currentTool: ToolType;
}

// 变更后
export interface InteractionState {
  // 保留现有字段
  isDragging: boolean;
  dragAtomId: string | null;
  lastDragWorld: { x: number; y: number; z: number } | null;
  dragPlaneNormal: { x: number; y: number; z: number } | null;
  rotationAxis: string;           // 保留，用于旋转面板
  rotationInProgress: boolean;    // 保留
  groupMoveActive: boolean;       // 保留
  renderAtomOffsets: Record<string, [number, number, number]>;
  shouldFitCamera: boolean;
  addingAtomElement: string | null;
  boxSelectionMode: BoxSelectionMode;  // 保留，Select模式框选时使用
  currentTool: ToolType;
  
  // 新增：右键拖动状态
  rightDragType: 'none' | 'camera' | 'rotate' | 'move';
  rightDragStart: { x: number; y: number } | null;
  rightDragMoved: boolean;
  rightDragRotationBase: { id: string; pos: [number, number, number] }[] | null;
}

// 初始值更新
export const interactionStore: InteractionState = {
  // ... 现有初始值 ...
  rightDragType: 'none',
  rightDragStart: null,
  rightDragMoved: false,
  rightDragRotationBase: null,
};
```

---

### 3.2 `media/webview/index.html`

**位置**: L62-67

```html
<!-- 当前 -->
<div id="left-toolbar">
  <button class="tool-btn active" data-tool="select" title="Select (V)">V</button>
  <button class="tool-btn" data-tool="move" title="Move (Shift+Alt+drag)">M</button>
  <button class="tool-btn" data-tool="box" title="Box Select (B)">B</button>
  <button class="tool-btn" data-tool="add" title="Add Atom (A)">A</button>
  <button class="tool-btn" data-tool="delete" title="Delete (D)">D</button>
</div>

<!-- 变更后 -->
<div id="left-toolbar">
  <button class="tool-btn active" data-tool="select" title="Select (V)">V</button>
  <button class="tool-btn" data-tool="add" title="Add Atom (A)">A</button>
  <button class="tool-btn" data-tool="delete" title="Delete (D)">D</button>
</div>
```

---

### 3.3 `src/shared/protocol.ts`

#### 新增 RotateGroupMessage

**位置**: 在 MoveGroupMessage 之后（约 L338）

```typescript
export interface RotateGroupMessage {
  command: 'rotateGroup';
  atomIds: string[];
  pivot: [number, number, number];
  axis: [number, number, number];
  angle: number;
  preview?: boolean;
}
```

#### 更新 WebviewToExtensionMessage 联合类型

**位置**: L507

```typescript
export type WebviewToExtensionMessage =
  | GetStateMessage
  | SetTrajectoryFrameMessage
  | BeginDragMessage
  | EndDragMessage
  // ... 其他消息 ...
  | MoveGroupMessage
  | RotateGroupMessage      // 新增
  | SetAtomsPositionsMessage
  // ... 其他消息 ...
```

---

### 3.4 `media/webview/src/interaction.ts`

这是核心变更文件，需要大幅重构。

#### 3.4.1 新增常量

**位置**: 文件顶部常量区（约 L27 后）

```typescript
const RIGHT_DRAG_THRESHOLD = 4;        // 右键拖动判定阈值（像素）
const ROTATION_SENSITIVITY = 0.005;   // 旋转灵敏度（弧度/像素）
```

#### 3.4.2 新增辅助函数

**位置**: 在 init 函数之前

```typescript
function getSelectedCentroid(): Vector3 | null {
  const ids = selectionStore.selectedAtomIds;
  if (!ids || ids.length === 0) return null;
  
  let cx = 0, cy = 0, cz = 0, count = 0;
  for (const id of ids) {
    const mesh = renderer.getAtomMeshes().get(id);
    if (mesh) {
      cx += mesh.position.x;
      cy += mesh.position.y;
      cz += mesh.position.z;
      count++;
    }
  }
  if (count === 0) return null;
  return new Vector3(cx / count, cy / count, cz / count);
}

function captureRightDragRotationBase(): { id: string; pos: [number, number, number] }[] {
  const ids = selectionStore.selectedAtomIds;
  const base: { id: string; pos: [number, number, number] }[] = [];
  for (const id of ids) {
    const mesh = renderer.getAtomMeshes().get(id);
    if (mesh) {
      base.push({
        id,
        pos: [mesh.position.x, mesh.position.y, mesh.position.z],
      });
    }
  }
  return base;
}
```

#### 3.4.3 修改 setTool 函数

**位置**: L68-93

```typescript
// 变更后
function setTool(tool: ToolType, canvas: HTMLCanvasElement, handlers: InteractionHandlers): void {
  interactionStore.currentTool = tool;
  updateToolButtons();
  updateStatusBar(true);
  
  if (tool === 'add') {
    if (!interactionStore.addingAtomElement) {
      interactionStore.addingAtomElement = 'C';
      canvas.style.cursor = 'crosshair';
      handlers.onSetStatus('Adding C atoms - Click to place, Esc to cancel');
    }
  } else if (interactionStore.addingAtomElement) {
    interactionStore.addingAtomElement = null;
    canvas.style.cursor = 'default';
  }
  
  // 移除 move、box 的光标设置
  if (tool === 'delete') {
    canvas.style.cursor = 'not-allowed';
  } else {
    canvas.style.cursor = 'default';
  }
}
```

#### 3.4.4 重构 pointerdown 事件处理

**位置**: L135-279

核心逻辑流程:

```
右键按下(button === 2)
    ↓
记录按下位置
检查是否有选中原子
    ↓
┌─ 无修饰键 ──────────────────────────┐
│  不阻止 OrbitControls                │
│  用户可以拖动旋转相机                │
│  rightDragType = 'camera'            │
└──────────────────────────────────────┘
    ↓
┌─ Shift（无Alt）+ 有选中原子 ─────────┐
│  禁用 OrbitControls                  │
│  准备旋转原子                         │
│  rightDragType = 'rotate'            │
└──────────────────────────────────────┘
    ↓
┌─ Shift+Alt + 有选中原子 ─────────────┐
│  禁用 OrbitControls                  │
│  准备移动原子                         │
│  rightDragType = 'move'              │
└──────────────────────────────────────┘
```

代码变更要点:

1. 在 pointerdown 开头添加右键处理逻辑
2. 移除左键点击原子时的 Move 模式判断（L215-236）
3. 移除 Box 模式判断，只保留 Select 模式框选（L262）

#### 3.4.5 重构 pointermove 事件处理

**位置**: L281-371

核心逻辑:

```
右键移动(buttons & 2)
    ↓
计算移动距离
如果超过阈值 → rightDragMoved = true
    ↓
根据 rightDragType 执行:
├── 'camera' → OrbitControls 自动处理
├── 'rotate' → 调用 handleRightDragRotation
└── 'move' → 调用 handleRightDragMove
```

#### 3.4.6 新增右键处理函数

```typescript
function handleRightDragRotation(
  dx: number,
  dy: number,
): void {
  const base = interactionStore.rightDragRotationBase;
  if (!base || base.length === 0) return;
  
  const pivot = getSelectedCentroid();
  if (!pivot) return;
  
  const angle = Math.sqrt(dx * dx + dy * dy) * ROTATION_SENSITIVITY;
  
  const camera = renderer.getCamera();
  const axis = new Vector3(-dy, dx, 0).normalize();
  const cameraMatrix = new Matrix4().extractRotation(camera.matrixWorld);
  axis.applyMatrix4(cameraMatrix);
  
  const updated: { id: string; x: number; y: number; z: number }[] = [];
  const _point = new Vector3();
  const _offset = new Vector3();
  
  for (const entry of base) {
    _point.set(entry.pos[0], entry.pos[1], entry.pos[2]);
    _offset.subVectors(_point, pivot);
    _offset.applyAxisAngle(axis, angle);
    _point.copy(pivot).add(_offset);
    
    renderer.updateAtomPosition(entry.id, _point);
    updated.push({ id: entry.id, x: _point.x, y: _point.y, z: _point.z });
  }
  
  // 发送消息
  vscode.postMessage({
    command: 'setAtomsPositions',
    atomPositions: updated,
    preview: true,
  });
}

function handleRightDragMove(event: PointerEvent, canvas: HTMLCanvasElement): void {
  // 类似现有的拖动逻辑，但用于右键移动
}
```

#### 3.4.7 重构 endDrag 函数

**位置**: L373-445

核心逻辑:

```
右键松开(button === 2)
    ↓
如果 rightDragMoved === false:
    显示右键菜单
否则:
    提交变更（调用 onEndDrag）
    ↓
重置状态:
├── rightDragType = 'none'
├── rightDragStart = null
├── rightDragMoved = false
└── rightDragRotationBase = null
```

#### 3.4.8 修改键盘事件处理

**位置**: L508-535

移除 M 和 B 快捷键:

```typescript
if (letter === 'V') {
  setTool('select', canvas, handlers);
  event.preventDefault();
  return;
}
// 移除: if (letter === 'M') { setTool('move', canvas, handlers); ... }
// 移除: if (letter === 'B') { setTool('box', canvas, handlers); ... }
if (letter === 'A' && !interactionStore.addingAtomElement) {
  setTool('add', canvas, handlers);
  event.preventDefault();
  return;
}
```

---

### 3.5 `media/webview/src/components/contextMenu.ts`

#### 重构 setupContextMenu

**位置**: L721-806

```typescript
export function setupContextMenu(
  canvas: HTMLCanvasElement,
  handlers: ContextMenuHandlers,
): void {
  canvas.addEventListener('contextmenu', (event: MouseEvent) => {
    event.preventDefault();  // 只阻止浏览器默认菜单
  });
}
```

#### 新增 showContextMenuAt 函数

```typescript
export function showContextMenuAt(
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number,
  handlers: ContextMenuHandlers,
): void {
  // 原来的 contextmenu 事件处理逻辑移到这里
  // 射线检测 + 显示对应菜单
}
```

---

### 3.6 `src/services/atomEditService.ts`

#### 新增 rotateGroup 方法

**位置**: 在 moveGroup 方法后（约 L152）

```typescript
rotateGroup(
  atomIds: string[],
  pivot: [number, number, number],
  axis: [number, number, number],
  angle: number,
  preview: boolean = false
): void {
  if (atomIds.length === 0) return;

  if (!this.trajectoryManager.isEditing) {
    this.trajectoryManager.beginEdit();
  }
  const editStructure = this.trajectoryManager.activeStructure;
  
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const [ax, ay, az] = axis;
  const [px, py, pz] = pivot;
  
  for (const id of atomIds) {
    const atom = editStructure.getAtom(id);
    if (!atom) continue;
    
    const vx = atom.x - px;
    const vy = atom.y - py;
    const vz = atom.z - pz;
    
    const dot = vx * ax + vy * ay + vz * az;
    const newX = vx * cos + (ay * vz - az * vy) * sin + ax * dot * (1 - cos);
    const newY = vy * cos + (az * vx - ax * vz) * sin + ay * dot * (1 - cos);
    const newZ = vz * cos + (ax * vy - ay * vx) * sin + az * dot * (1 - cos);
    
    atom.setPosition(newX + px, newY + py, newZ + pz);
  }
  
  this.renderer.setStructure(editStructure);
  if (!preview) {
    this.trajectoryManager.commitEdit();
  }
}
```

---

### 3.7 `src/services/messageRouter.ts`

#### 注册 rotateGroup 处理器

**位置**: 在 moveGroup 注册后（约 L197）

```typescript
this.registerTyped('rotateGroup', (message) => {
  this.atomEditService.rotateGroup(
    message.atomIds,
    message.pivot,
    message.axis,
    message.angle,
    message.preview
  );
  return true;
});
```

---

## 四、代码变更位置汇总

| 文件 | 变更类型 | 关键位置 | 变更内容 |
|------|----------|----------|----------|
| `media/webview/src/state.ts` | 修改 | L204 | ToolType 移除 'move' \| 'box' |
| `media/webview/src/state.ts` | 新增 | L206-219 | InteractionState 新增 4 个字段 |
| `media/webview/index.html` | 删除 | L63-64 | 移除 Move/Box 按钮 |
| `src/shared/protocol.ts` | 新增 | L338 后 | RotateGroupMessage 接口 |
| `src/shared/protocol.ts` | 修改 | L507 | WebviewToExtensionMessage 联合类型 |
| `media/webview/src/interaction.ts` | 大幅重构 | L68-93 | setTool 函数 |
| `media/webview/src/interaction.ts` | 新增 | L27 后 | 常量定义 |
| `media/webview/src/interaction.ts` | 新增 | L135 前 | 辅助函数 |
| `media/webview/src/interaction.ts` | 重构 | L135-279 | pointerdown 事件 |
| `media/webview/src/interaction.ts` | 重构 | L281-371 | pointermove 事件 |
| `media/webview/src/interaction.ts` | 重构 | L373-445 | endDrag 函数 |
| `media/webview/src/interaction.ts` | 修改 | L508-535 | 键盘快捷键 |
| `media/webview/src/components/contextMenu.ts` | 重构 | L721-806 | setupContextMenu 和新增 showContextMenuAt |
| `src/services/atomEditService.ts` | 新增 | L152 后 | rotateGroup 方法 |
| `src/services/messageRouter.ts` | 新增 | L197 后 | rotateGroup 注册 |

---

## 五、实现步骤

### Phase 1: 基础设施（无依赖）

1. **修改 `state.ts`**
   - [ ] 修改 `ToolType` 类型定义
   - [ ] 在 `InteractionState` 中新增字段
   - [ ] 更新 `interactionStore` 初始值

2. **修改 `protocol.ts`**
   - [ ] 新增 `RotateGroupMessage` 接口
   - [ ] 更新 `WebviewToExtensionMessage` 联合类型

3. **修改 `index.html`**
   - [ ] 移除 Move 和 Box 按钮

### Phase 2: Extension 端服务（依赖 Phase 1）

4. **修改 `atomEditService.ts`**
   - [ ] 新增 `rotateGroup` 方法

5. **修改 `messageRouter.ts`**
   - [ ] 注册 `rotateGroup` 消息处理器

### Phase 3: Webview 端交互（依赖 Phase 1）

6. **修改 `contextMenu.ts`**
   - [ ] 重构 `setupContextMenu` 只阻止默认菜单
   - [ ] 新增 `showContextMenuAt` 导出函数

7. **修改 `interaction.ts`**
   - [ ] 新增常量
   - [ ] 新增辅助函数
   - [ ] 重构 `setTool` 函数
   - [ ] 重构 `pointerdown` 事件处理
   - [ ] 重构 `pointermove` 事件处理
   - [ ] 重构 `endDrag` 函数
   - [ ] 修改键盘快捷键处理

### Phase 4: 测试与验证

8. **编译验证**
   - [ ] `npm run compile` 确保无类型错误
   - [ ] `npm run lint` 确保无 lint 错误

9. **功能测试**
   - [ ] Select 模式左键选择/框选
   - [ ] 右键旋转相机
   - [ ] Shift+右键旋转原子
   - [ ] Shift+Alt+右键移动原子
   - [ ] 右键菜单显示

---

## 六、风险点与注意事项

### 6.1 右键拖动与菜单冲突

- 必须在 `pointerup` 时判断 `rightDragMoved`
- 阈值设为 4 像素，与左键拖动一致

### 6.2 OrbitControls 状态管理

- 相机旋转时不能禁用 controls
- 原子旋转/移动时必须禁用 controls
- 注意在 `pointerup` 时恢复

### 6.3 旋转灵敏度

- `ROTATION_SENSITIVITY = 0.005` 弧度/像素
- 可根据实际测试调整

### 6.4 撤销/重做

- 旋转操作使用 `setAtomsPositions` 消息
- `preview: true` 时避免频繁 undo 快照
- 最终提交时 `preview: false` 创建 undo 快照

### 6.5 性能考虑

- 自由旋转时实时更新所有原子位置
- 使用 `renderer.updateAtomPosition` 进行增量渲染
- 避免在 `pointermove` 中频繁发送消息

---

## 七、测试清单

| 测试场景 | 预期结果 | 通过 |
|----------|----------|------|
| Select模式，左键点击原子 | 原子被选中 | [ ] |
| Select模式，Ctrl+左键点击原子 | 添加到选择 | [ ] |
| Select模式，左键拖动空白区域 | 开始框选 | [ ] |
| Select模式，右键点击 | 显示右键菜单 | [ ] |
| Select模式，右键拖动空白区域 | 相机旋转 | [ ] |
| 有选中原子，Shift+右键拖动 | 原子旋转 | [ ] |
| 有选中原子，Shift+Alt+右键拖动 | 原子移动 | [ ] |
| 有选中原子，Shift+右键点击 | 显示右键菜单（不旋转） | [ ] |
| Delete模式，左键点击原子 | 删除原子 | [ ] |
| Add模式，左键点击空白区域 | 添加原子 | [ ] |
| 按 V 键 | 切换到 Select 模式 | [ ] |
| 按 M 键 | 无操作（已移除） | [ ] |
| 按 B 键 | 无操作（已移除） | [ ] |
| 按 A 键 | 切换到 Add 模式 | [ ] |
| 按 D 键 | 切换到 Delete 模式 | [ ] |

---

## 八、后续优化建议

1. **旋转中心可视化**: 可以在旋转时显示质心标记
2. **旋转轴指示器**: 显示当前旋转轴方向
3. **吸附功能**: 旋转时吸附到特定角度（如 15° 倍数）
4. **键盘辅助**: 按住特定键切换旋转轴
5. **触摸屏支持**: 为触摸设备设计类似的交互
