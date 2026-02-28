<!--
  AG Grid によるテーブル表示コンポーネント。
  閲覧モード: Infinite Row Model（Rust 側でソート・フィルタ・ページング）
  編集モード: Client-Side Row Model（セル編集・コンテキストメニュー・Undo/Redo）
-->
<script lang="ts">
  import { getRows } from "$lib/commands";
  import ContextMenu from "$lib/components/ContextMenu.svelte";
  import type { EditOp, FileMetadata, FilterItem, SortItem } from "$lib/types";
  import {
    AllCommunityModule,
    colorSchemeDark,
    createGrid,
    themeQuartz,
    type CellValueChangedEvent,
    type ColDef,
    type GridApi,
    type GridOptions,
    type IDatasource,
    type IGetRowsParams,
  } from "ag-grid-community";
  import { untrack } from "svelte";

  interface Props {
    fileMeta: FileMetadata;
    /** 編集モード時のみ非 null */
    rows: string[][] | null;
    searchQuery?: string;
    mode: "view" | "edit";
    dirtyCells: Set<string>;
    lastGridOp: { version: number; op: EditOp } | null;
    onCellEdit: (op: EditOp) => void;
    onAddRow: (rowIndex: number, position: "above" | "below") => void;
    onDeleteRow: (rowIndex: number) => void;
  }
  let {
    fileMeta,
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

  /** rows を AG Grid の rowData に変換（編集モード用）。_rowIndex でオリジナル行を特定。 */
  function buildEditRowData(
    data: string[][],
  ): Record<string, string | number>[] {
    return data.map((row, rowIndex) => {
      const obj: Record<string, string | number> = { _rowIndex: rowIndex };
      row.forEach((value, colIndex) => {
        obj[String(colIndex)] = value;
      });
      return obj;
    });
  }

  /** rows を AG Grid の rowData に変換（閲覧モード用）。 */
  function buildViewRowData(data: string[][]): Record<string, string>[] {
    return data.map((row) => {
      const obj: Record<string, string> = {};
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

  /** Infinite Row Model 用 datasource を生成 */
  function createDatasource(filePath: string): IDatasource {
    return {
      getRows(params: IGetRowsParams) {
        const sortModel: SortItem[] = params.sortModel.map((s) => ({
          colId: s.colId,
          sort: s.sort as "asc" | "desc",
        }));

        const filterModel: Record<string, FilterItem> = {};
        for (const [key, val] of Object.entries(
          params.filterModel as Record<string, Record<string, unknown>>,
        )) {
          if (
            val &&
            typeof val.type === "string" &&
            typeof val.filter === "string"
          ) {
            filterModel[key] = {
              filterType: (val.filterType as string) ?? "text",
              type: val.type,
              filter: val.filter,
            };
          }
        }

        getRows(
          filePath,
          params.startRow,
          params.endRow,
          sortModel,
          filterModel,
          searchQuery,
        )
          .then((result) => {
            params.successCallback(
              buildViewRowData(result.rows),
              result.last_row,
            );
          })
          .catch(() => {
            params.failCallback();
          });
      },
    };
  }

  /** AG Grid を初期化。mode の変更で再作成する。タブ切り替えは親の {#key} で処理。 */
  $effect(() => {
    const isEditable = mode === "edit";

    untrack(() => {
      if (!gridContainer) return;

      if (isEditable && rows) {
        // 編集モード: Client-Side Row Model
        const gridOptions: GridOptions = {
          theme: customTheme,
          columnDefs: buildColDefs(fileMeta.headers, true),
          rowData: buildEditRowData(rows),
          defaultColDef: {
            flex: 1,
            minWidth: 100,
            floatingFilter: true,
            cellStyle: (params) => {
              const key = `${params.data?._rowIndex}:${params.colDef?.field}`;
              if (dirtyCells.has(key)) {
                return { backgroundColor: "rgba(224, 160, 80, 0.12)" };
              }
              return null;
            },
          },
          animateRows: false,
          suppressCellFocus: false,
          quickFilterText: searchQuery,
          onCellValueChanged: handleCellValueChanged,
        };

        gridApi = createGrid(gridContainer, gridOptions, {
          modules: [AllCommunityModule],
        });
      } else {
        // 閲覧モード: Infinite Row Model
        const gridOptions: GridOptions = {
          theme: customTheme,
          columnDefs: buildColDefs(fileMeta.headers, false),
          rowModelType: "infinite",
          datasource: createDatasource(fileMeta.path),
          cacheBlockSize: 200,
          maxBlocksInCache: 20,
          defaultColDef: {
            flex: 1,
            minWidth: 100,
            floatingFilter: true,
          },
          animateRows: false,
          suppressCellFocus: true,
        };

        gridApi = createGrid(gridContainer, gridOptions, {
          modules: [AllCommunityModule],
        });
      }
    });

    return () => {
      gridApi?.destroy();
      gridApi = undefined;
    };
  });

  /** dirtyCells の変更を AG Grid に反映（編集モードのみ） */
  $effect(() => {
    void dirtyCells;
    if (mode === "edit") {
      gridApi?.redrawRows();
    }
  });

  /** searchQuery の変更を AG Grid に反映 */
  $effect(() => {
    void searchQuery;
    if (!gridApi) return;
    if (mode === "edit") {
      gridApi.setGridOption("quickFilterText", searchQuery);
    } else {
      // 閲覧モード: datasource を再設定してキャッシュを破棄
      gridApi.purgeInfiniteCache();
    }
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
      if (!gridApi || mode !== "edit") return;
      const { op } = pending;
      switch (op.type) {
        case "addRow": {
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
          gridApi.forEachNode((node) => {
            if (node.data._rowIndex === op.rowIndex) {
              node.data[String(op.colIndex)] = op.newValue;
            }
          });
          break;
        }
      }
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
