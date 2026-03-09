interface ElementData {
  symbol: string;
  number: number;
  row: number;
  col: number;
}

const MAIN_TABLE_DATA: ElementData[] = [
  { number: 1, symbol: 'H', row: 0, col: 0 },
  { number: 2, symbol: 'He', row: 0, col: 17 },
  { number: 3, symbol: 'Li', row: 1, col: 0 },
  { number: 4, symbol: 'Be', row: 1, col: 1 },
  { number: 5, symbol: 'B', row: 1, col: 12 },
  { number: 6, symbol: 'C', row: 1, col: 13 },
  { number: 7, symbol: 'N', row: 1, col: 14 },
  { number: 8, symbol: 'O', row: 1, col: 15 },
  { number: 9, symbol: 'F', row: 1, col: 16 },
  { number: 10, symbol: 'Ne', row: 1, col: 17 },
  { number: 11, symbol: 'Na', row: 2, col: 0 },
  { number: 12, symbol: 'Mg', row: 2, col: 1 },
  { number: 13, symbol: 'Al', row: 2, col: 12 },
  { number: 14, symbol: 'Si', row: 2, col: 13 },
  { number: 15, symbol: 'P', row: 2, col: 14 },
  { number: 16, symbol: 'S', row: 2, col: 15 },
  { number: 17, symbol: 'Cl', row: 2, col: 16 },
  { number: 18, symbol: 'Ar', row: 2, col: 17 },
  { number: 19, symbol: 'K', row: 3, col: 0 },
  { number: 20, symbol: 'Ca', row: 3, col: 1 },
  { number: 21, symbol: 'Sc', row: 3, col: 2 },
  { number: 22, symbol: 'Ti', row: 3, col: 3 },
  { number: 23, symbol: 'V', row: 3, col: 4 },
  { number: 24, symbol: 'Cr', row: 3, col: 5 },
  { number: 25, symbol: 'Mn', row: 3, col: 6 },
  { number: 26, symbol: 'Fe', row: 3, col: 7 },
  { number: 27, symbol: 'Co', row: 3, col: 8 },
  { number: 28, symbol: 'Ni', row: 3, col: 9 },
  { number: 29, symbol: 'Cu', row: 3, col: 10 },
  { number: 30, symbol: 'Zn', row: 3, col: 11 },
  { number: 31, symbol: 'Ga', row: 3, col: 12 },
  { number: 32, symbol: 'Ge', row: 3, col: 13 },
  { number: 33, symbol: 'As', row: 3, col: 14 },
  { number: 34, symbol: 'Se', row: 3, col: 15 },
  { number: 35, symbol: 'Br', row: 3, col: 16 },
  { number: 36, symbol: 'Kr', row: 3, col: 17 },
  { number: 37, symbol: 'Rb', row: 4, col: 0 },
  { number: 38, symbol: 'Sr', row: 4, col: 1 },
  { number: 39, symbol: 'Y', row: 4, col: 2 },
  { number: 40, symbol: 'Zr', row: 4, col: 3 },
  { number: 41, symbol: 'Nb', row: 4, col: 4 },
  { number: 42, symbol: 'Mo', row: 4, col: 5 },
  { number: 43, symbol: 'Tc', row: 4, col: 6 },
  { number: 44, symbol: 'Ru', row: 4, col: 7 },
  { number: 45, symbol: 'Rh', row: 4, col: 8 },
  { number: 46, symbol: 'Pd', row: 4, col: 9 },
  { number: 47, symbol: 'Ag', row: 4, col: 10 },
  { number: 48, symbol: 'Cd', row: 4, col: 11 },
  { number: 49, symbol: 'In', row: 4, col: 12 },
  { number: 50, symbol: 'Sn', row: 4, col: 13 },
  { number: 51, symbol: 'Sb', row: 4, col: 14 },
  { number: 52, symbol: 'Te', row: 4, col: 15 },
  { number: 53, symbol: 'I', row: 4, col: 16 },
  { number: 54, symbol: 'Xe', row: 4, col: 17 },
  { number: 55, symbol: 'Cs', row: 5, col: 0 },
  { number: 56, symbol: 'Ba', row: 5, col: 1 },
  { number: 72, symbol: 'Hf', row: 5, col: 3 },
  { number: 73, symbol: 'Ta', row: 5, col: 4 },
  { number: 74, symbol: 'W', row: 5, col: 5 },
  { number: 75, symbol: 'Re', row: 5, col: 6 },
  { number: 76, symbol: 'Os', row: 5, col: 7 },
  { number: 77, symbol: 'Ir', row: 5, col: 8 },
  { number: 78, symbol: 'Pt', row: 5, col: 9 },
  { number: 79, symbol: 'Au', row: 5, col: 10 },
  { number: 80, symbol: 'Hg', row: 5, col: 11 },
  { number: 81, symbol: 'Tl', row: 5, col: 12 },
  { number: 82, symbol: 'Pb', row: 5, col: 13 },
  { number: 83, symbol: 'Bi', row: 5, col: 14 },
  { number: 84, symbol: 'Po', row: 5, col: 15 },
  { number: 85, symbol: 'At', row: 5, col: 16 },
  { number: 86, symbol: 'Rn', row: 5, col: 17 },
  { number: 87, symbol: 'Fr', row: 6, col: 0 },
  { number: 88, symbol: 'Ra', row: 6, col: 1 },
  { number: 104, symbol: 'Rf', row: 6, col: 3 },
  { number: 105, symbol: 'Db', row: 6, col: 4 },
  { number: 106, symbol: 'Sg', row: 6, col: 5 },
  { number: 107, symbol: 'Bh', row: 6, col: 6 },
  { number: 108, symbol: 'Hs', row: 6, col: 7 },
  { number: 109, symbol: 'Mt', row: 6, col: 8 },
  { number: 110, symbol: 'Ds', row: 6, col: 9 },
  { number: 111, symbol: 'Rg', row: 6, col: 10 },
  { number: 112, symbol: 'Cn', row: 6, col: 11 },
  { number: 113, symbol: 'Nh', row: 6, col: 12 },
  { number: 114, symbol: 'Fl', row: 6, col: 13 },
  { number: 115, symbol: 'Mc', row: 6, col: 14 },
  { number: 116, symbol: 'Lv', row: 6, col: 15 },
  { number: 117, symbol: 'Ts', row: 6, col: 16 },
  { number: 118, symbol: 'Og', row: 6, col: 17 },
];

const LANTHANIDES: ElementData[] = [
  { number: 57, symbol: 'La', row: 0, col: 0 },
  { number: 58, symbol: 'Ce', row: 0, col: 1 },
  { number: 59, symbol: 'Pr', row: 0, col: 2 },
  { number: 60, symbol: 'Nd', row: 0, col: 3 },
  { number: 61, symbol: 'Pm', row: 0, col: 4 },
  { number: 62, symbol: 'Sm', row: 0, col: 5 },
  { number: 63, symbol: 'Eu', row: 0, col: 6 },
  { number: 64, symbol: 'Gd', row: 0, col: 7 },
  { number: 65, symbol: 'Tb', row: 0, col: 8 },
  { number: 66, symbol: 'Dy', row: 0, col: 9 },
  { number: 67, symbol: 'Ho', row: 0, col: 10 },
  { number: 68, symbol: 'Er', row: 0, col: 11 },
  { number: 69, symbol: 'Tm', row: 0, col: 12 },
  { number: 70, symbol: 'Yb', row: 0, col: 13 },
  { number: 71, symbol: 'Lu', row: 0, col: 14 },
];

const ACTINIDES: ElementData[] = [
  { number: 89, symbol: 'Ac', row: 0, col: 0 },
  { number: 90, symbol: 'Th', row: 0, col: 1 },
  { number: 91, symbol: 'Pa', row: 0, col: 2 },
  { number: 92, symbol: 'U', row: 0, col: 3 },
  { number: 93, symbol: 'Np', row: 0, col: 4 },
  { number: 94, symbol: 'Pu', row: 0, col: 5 },
  { number: 95, symbol: 'Am', row: 0, col: 6 },
  { number: 96, symbol: 'Cm', row: 0, col: 7 },
  { number: 97, symbol: 'Bk', row: 0, col: 8 },
  { number: 98, symbol: 'Cf', row: 0, col: 9 },
  { number: 99, symbol: 'Es', row: 0, col: 10 },
  { number: 100, symbol: 'Fm', row: 0, col: 11 },
  { number: 101, symbol: 'Md', row: 0, col: 12 },
  { number: 102, symbol: 'No', row: 0, col: 13 },
  { number: 103, symbol: 'Lr', row: 0, col: 14 },
];

const MAIN_ROWS = 7;
const MAIN_COLS = 18;
const LANTHANIDE_COLS = 15;
const ACTINIDE_COLS = 15;

const OVERLAY_STYLE = `
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  z-index: 10002;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const DIALOG_STYLE = `
  background: #1e1e1e;
  border: 1px solid #454545;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
`;

const TITLE_STYLE = `
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 12px;
  color: #cccccc;
  font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
`;

const TABLE_STYLE = `
  border-collapse: collapse;
  font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
`;

const CELL_STYLE = `
  width: 36px;
  height: 36px;
  text-align: center;
  vertical-align: middle;
  cursor: pointer;
  border: 1px solid #3c3c3c;
  position: relative;
  background: #2d2d2d;
`;

const CELL_HOVER_STYLE = `
  border-color: #094771;
  background: #3c3c3c;
`;

const PLACEHOLDER_STYLE = `
  width: 36px;
  height: 36px;
  border: 1px solid #3c3c3c;
  background: #252526;
  text-align: center;
  vertical-align: middle;
  font-size: 10px;
  color: #808080;
`;

const ELEMENT_SYMBOL_STYLE = `
  font-size: 14px;
  font-weight: 500;
  color: #cccccc;
`;

const ELEMENT_NUMBER_STYLE = `
  font-size: 9px;
  color: #808080;
  position: absolute;
  top: 2px;
  left: 3px;
`;

const LABEL_STYLE = `
  font-size: 11px;
  color: #808080;
  text-align: right;
  padding-right: 8px;
  vertical-align: middle;
  width: 24px;
`;

export function showElementPickerDialog(onSelect: (element: string | null) => void): void {
  const existingOverlay = document.getElementById('element-picker-overlay');
  if (existingOverlay) {
    existingOverlay.remove();
  }

  const overlay = document.createElement('div');
  overlay.id = 'element-picker-overlay';
  overlay.style.cssText = OVERLAY_STYLE;

  const dialog = document.createElement('div');
  dialog.style.cssText = DIALOG_STYLE;

  const title = document.createElement('div');
  title.textContent = 'Select Element';
  title.style.cssText = TITLE_STYLE;
  dialog.appendChild(title);

  const allCells: HTMLTableCellElement[] = [];
  const allSymbols: string[] = [];

  const createCell = (element: ElementData): HTMLTableCellElement => {
    const td = document.createElement('td');
    td.style.cssText = CELL_STYLE;
    td.tabIndex = 0;

    const numberSpan = document.createElement('span');
    numberSpan.textContent = String(element.number);
    numberSpan.style.cssText = ELEMENT_NUMBER_STYLE;
    td.appendChild(numberSpan);

    const symbolSpan = document.createElement('span');
    symbolSpan.textContent = element.symbol;
    symbolSpan.style.cssText = ELEMENT_SYMBOL_STYLE;
    td.appendChild(symbolSpan);

    allCells.push(td);
    allSymbols.push(element.symbol);

    td.addEventListener('mouseenter', () => {
      td.style.cssText = CELL_STYLE + CELL_HOVER_STYLE;
    });
    td.addEventListener('mouseleave', () => {
      td.style.cssText = CELL_STYLE;
    });
    td.addEventListener('click', (e) => {
      e.stopPropagation();
      overlay.remove();
      onSelect(element.symbol);
    });

    return td;
  };

  const mainTable = document.createElement('table');
  mainTable.style.cssText = TABLE_STYLE;

  for (let row = 0; row < MAIN_ROWS; row++) {
    const tr = document.createElement('tr');
    for (let col = 0; col < MAIN_COLS; col++) {
      const element = MAIN_TABLE_DATA.find(e => e.row === row && e.col === col);
      if (element) {
        tr.appendChild(createCell(element));
      } else if (row === 5 && col === 2) {
        const td = document.createElement('td');
        td.style.cssText = PLACEHOLDER_STYLE;
        td.textContent = '57-71';
        tr.appendChild(td);
      } else if (row === 6 && col === 2) {
        const td = document.createElement('td');
        td.style.cssText = PLACEHOLDER_STYLE;
        td.textContent = '89-103';
        tr.appendChild(td);
      } else {
        const td = document.createElement('td');
        td.style.background = 'transparent';
        td.style.border = 'none';
        tr.appendChild(td);
      }
    }
    mainTable.appendChild(tr);
  }

  dialog.appendChild(mainTable);

  const spacer = document.createElement('div');
  spacer.style.height = '8px';
  dialog.appendChild(spacer);

  const lanthanideRow = document.createElement('table');
  lanthanideRow.style.cssText = TABLE_STYLE;
  const lanthanideTr = document.createElement('tr');

  const lanthanideLabel = document.createElement('td');
  lanthanideLabel.style.cssText = LABEL_STYLE;
  lanthanideLabel.textContent = '*';
  lanthanideTr.appendChild(lanthanideLabel);

  for (let col = 0; col < LANTHANIDE_COLS; col++) {
    const element = LANTHANIDES.find(e => e.col === col);
    if (element) {
      lanthanideTr.appendChild(createCell(element));
    }
  }
  lanthanideRow.appendChild(lanthanideTr);
  dialog.appendChild(lanthanideRow);

  const actinideRow = document.createElement('table');
  actinideRow.style.cssText = TABLE_STYLE;
  const actinideTr = document.createElement('tr');

  const actinideLabel = document.createElement('td');
  actinideLabel.style.cssText = LABEL_STYLE;
  actinideLabel.textContent = '**';
  actinideTr.appendChild(actinideLabel);

  for (let col = 0; col < ACTINIDE_COLS; col++) {
    const element = ACTINIDES.find(e => e.col === col);
    if (element) {
      actinideTr.appendChild(createCell(element));
    }
  }
  actinideRow.appendChild(actinideTr);
  dialog.appendChild(actinideRow);

  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  let focusedIndex = -1;

  const focusCell = (index: number) => {
    if (focusedIndex >= 0 && focusedIndex < allCells.length) {
      allCells[focusedIndex].style.cssText = CELL_STYLE;
    }
    focusedIndex = index;
    if (focusedIndex >= 0 && focusedIndex < allCells.length) {
      allCells[focusedIndex].style.cssText = CELL_STYLE + CELL_HOVER_STYLE;
      allCells[focusedIndex].focus();
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      overlay.remove();
      onSelect(null);
      return;
    }
    if (e.key === 'Enter' && focusedIndex >= 0) {
      overlay.remove();
      onSelect(allSymbols[focusedIndex]);
      return;
    }

    let newIndex = focusedIndex;
    if (e.key === 'ArrowRight') {
      newIndex = focusedIndex < allCells.length - 1 ? focusedIndex + 1 : 0;
    } else if (e.key === 'ArrowLeft') {
      newIndex = focusedIndex > 0 ? focusedIndex - 1 : allCells.length - 1;
    } else if (e.key === 'ArrowDown') {
      newIndex = focusedIndex < allCells.length - MAIN_COLS ? focusedIndex + MAIN_COLS : focusedIndex;
    } else if (e.key === 'ArrowUp') {
      newIndex = focusedIndex >= MAIN_COLS ? focusedIndex - MAIN_COLS : focusedIndex;
    }

    if (newIndex !== focusedIndex) {
      e.preventDefault();
      focusCell(newIndex);
    }
  };

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.remove();
      onSelect(null);
    }
  });

  document.addEventListener('keydown', handleKeyDown);
  overlay.addEventListener('remove', () => {
    document.removeEventListener('keydown', handleKeyDown);
  });

  if (allCells.length > 0) {
    focusCell(0);
  }
}
