<!--
  AG Grid によるテーブル表示コンポーネント。
  編集モード対応: セル編集・コンテキストメニュー・Undo/Redo のセル反映。
  dirtyCells に含まれるセルは背景色で強調表示する。
-->
<script lang="ts">
  import ContextMenu from "$lib/components/ContextMenu.svelte";
  import type { EditOp, ParsedFile } from "$lib/types";
  import {
    AllCommunityModule,
    colorSchemeDark,
    createGrid,
    themeQuartz,
    type CellValueChangedEvent,
    type ColDef,
    type GridApi,
    type GridOptions,
  } from "ag-grid-community";
  import { untrack } from "svelte";

  interface Props {
    file: ParsedFile;
    rows: string[][];
    searchQuery?: string;
    mode: "view" | "edit";
    dirtyCells: Set<string>;
    lastGridOp: { version: number; op: EditOp } | null;
    onCellEdit: (op: EditOp) => void;
    onAddRow: (rowIndex: number, position: "above" | "below") => void;
    onDeleteRow: (rowIndex: number) => void;
  }
  let {
    file,
    rows,
    searchQuery = "",
    mode,
    dirtyCells,
    lastGridOp,
    onCellEdit,
    onAddRow,
    onDeleteRow,
  }: Props = $props();

  let gridContainer: HTMLDivElement;
  let gridApi: GridApi | undefined;

  /** cellStyle クロージャから参照するための可変参照 */
  let dirtyCellsRef: Set<string> = new Set();

  /** コンテキストメニューの状態 */
  let contextMenu = $state<{ x: number; y: number; rowIndex: number } | null>(
    null,
  );

  /** headers 配列から AG Grid の ColDef[] を生成する。 */
  function buildColDefs(headers: string[], editable: boolean): ColDef[] {
    return headers.map((header, index) => ({
      headerName: header,
      field: String(index),
      resizable: true,
      sortable: true,
      filter: true,
      editable,
    }));
  }

  /** rows を AG Grid の rowData に変換。_rowIndex でオリジナル行を特定可能。 */
  function buildRowData(data: string[][]): Record<string, string | number>[] {
    return data.map((row, rowIndex) => {
      const obj: Record<string, string | number> = { _rowIndex: rowIndex };
      row.forEach((value, colIndex) => {
        obj[String(colIndex)] = value;
      });
      return obj;
    });
  }

  /** プロジェクトのダークテーマに合わせた AG Grid カスタムテーマ */
  const customTheme = themeQuartz.withPart(colorSchemeDark).withParams({
    backgroundColor: "transparent",
    headerBackgroundColor: "rgba(40, 40, 40, 0.95)",
    foregroundColor: "#e0e0e0",
    borderColor: "rgba(255, 255, 255, 0.08)",
    headerFontWeight: 600,
    fontSize: 13,
    fontFamily: "system-ui, -apple-system, sans-serif",
    rowHoverColor: "rgba(55, 55, 55, 0.95)",
    selectedRowBackgroundColor: "rgba(122, 162, 247, 0.15)",
    accentColor: "#7aa2f7",
  });

  /** セル値変更時のハンドラ */
  function handleCellValueChanged(event: CellValueChangedEvent) {
    const rowIndex = event.data._rowIndex as number;
    const colIndex = Number(event.colDef.field);
    const oldValue = String(event.oldValue ?? "");
    const newValue = String(event.newValue ?? "");
    if (oldValue === newValue) return;

    onCellEdit({
      type: "cell",
      rowIndex,
      colIndex,
      oldValue,
      newValue,
    });
  }

  /** 右クリックでコンテキストメニューを表示（編集モードのみ） */
  function handleContextMenu(e: MouseEvent) {
    if (mode !== "edit") return;

    const target = e.target as HTMLElement;
    const rowEl = target.closest<HTMLElement>("[row-index]");
    if (!rowEl) return;

    e.preventDefault();

    const rowNode = gridApi?.getDisplayedRowAtIndex(
      Number(rowEl.getAttribute("row-index")),
    );
    if (!rowNode?.data) return;

    contextMenu = {
      x: e.clientX,
      y: e.clientY,
      rowIndex: rowNode.data._rowIndex as number,
    };
  }

  /** AG Grid を初期化。mode の変更で再作成する。タブ切り替えは親の {#key} で処理。 */
  $effect(() => {
    const isEditable = mode === "edit";

    untrack(() => {
      if (!gridContainer) return;

      const gridOptions: GridOptions = {
        theme: customTheme,
        columnDefs: buildColDefs(file.headers, isEditable),
        rowData: buildRowData(rows),
        defaultColDef: {
          flex: 1,
          minWidth: 100,
          floatingFilter: true,
          cellStyle: (params) => {
            const key = `${params.data?._rowIndex}:${params.colDef?.field}`;
            if (dirtyCellsRef.has(key)) {
              return { backgroundColor: "rgba(224, 160, 80, 0.12)" };
            }
            return null;
          },
        },
        animateRows: false,
        suppressCellFocus: !isEditable,
        quickFilterText: searchQuery,
        onCellValueChanged: handleCellValueChanged,
      };

      dirtyCellsRef = dirtyCells;
      gridApi = createGrid(gridContainer, gridOptions, {
        modules: [AllCommunityModule],
      });
    });

    return () => {
      gridApi?.destroy();
      gridApi = undefined;
    };
  });

  /** searchQuery の変更を AG Grid に反映 */
  $effect(() => {
    gridApi?.setGridOption("quickFilterText", searchQuery);
  });

  /** 操作に応じた差分更新。applyTransaction で行追加・削除、セルは直接更新。 */
  let prevOpVersion = -1;
  $effect(() => {
    const pending = lastGridOp;
    if (!pending) return;
    if (pending.version === prevOpVersion) return;
    if (prevOpVersion === -1) {
      prevOpVersion = pending.version;
      return;
    }
    prevOpVersion = pending.version;
    untrack(() => {
      if (!gridApi) return;
      const { op } = pending;
      switch (op.type) {
        case "addRow": {
          // 挿入位置以降の _rowIndex を +1
          gridApi.forEachNode((node) => {
            const idx = node.data._rowIndex as number;
            if (idx >= op.rowIndex) node.data._rowIndex = idx + 1;
          });
          const newRow: Record<string, string | number> = {
            _rowIndex: op.rowIndex,
          };
          op.row.forEach((val, i) => {
            newRow[String(i)] = val;
          });
          gridApi.applyTransaction({ add: [newRow], addIndex: op.rowIndex });
          break;
        }
        case "deleteRow": {
          // 削除対象を探して除去し、後続の _rowIndex を -1
          let target: Record<string, string | number> | null = null;
          gridApi.forEachNode((node) => {
            if (node.data._rowIndex === op.rowIndex) target = node.data;
          });
          if (target) gridApi.applyTransaction({ remove: [target] });
          gridApi.forEachNode((node) => {
            const idx = node.data._rowIndex as number;
            if (idx > op.rowIndex) node.data._rowIndex = idx - 1;
          });
          break;
        }
        case "cell": {
          // セル値を直接更新
          gridApi.forEachNode((node) => {
            if (node.data._rowIndex === op.rowIndex) {
              node.data[String(op.colIndex)] = op.newValue;
            }
          });
          break;
        }
      }
      dirtyCellsRef = dirtyCells;
      gridApi.refreshCells({ force: true });
    });
  });
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="grid-wrapper"
  bind:this={gridContainer}
  oncontextmenu={handleContextMenu}
></div>

{#if contextMenu}
  <ContextMenu
    x={contextMenu.x}
    y={contextMenu.y}
    onAddAbove={() => {
      if (contextMenu) onAddRow(contextMenu.rowIndex, "above");
      contextMenu = null;
    }}
    onAddBelow={() => {
      if (contextMenu) onAddRow(contextMenu.rowIndex, "below");
      contextMenu = null;
    }}
    onDelete={() => {
      if (contextMenu) onDeleteRow(contextMenu.rowIndex);
      contextMenu = null;
    }}
    onClose={() => (contextMenu = null)}
  />
{/if}

<style>
  .grid-wrapper {
    flex: 1;
    width: 100%;
    height: 100%;
    min-height: 0;
  }
</style>
