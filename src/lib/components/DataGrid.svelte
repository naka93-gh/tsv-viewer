<!--
  AG Grid によるテーブル表示コンポーネント。
  ParsedFile を受け取り、ヘッダー → カラム定義、行データ → rowData に変換して描画する。
-->
<script lang="ts">
  import type { ParsedFile } from "$lib/types";
  import {
    AllCommunityModule,
    colorSchemeDark,
    createGrid,
    themeQuartz,
    type ColDef,
    type GridApi,
    type GridOptions,
  } from "ag-grid-community";

  interface Props {
    file: ParsedFile;
    searchQuery?: string;
  }
  let { file, searchQuery = "" }: Props = $props();

  let gridContainer: HTMLDivElement;
  let gridApi: GridApi | undefined;

  /** headers 配列から AG Grid の ColDef[] を生成する。field にはインデックスを使用。 */
  function buildColDefs(headers: string[]): ColDef[] {
    return headers.map((header, index) => ({
      headerName: header,
      field: String(index),
      resizable: true,
      sortable: true,
      filter: true,
    }));
  }

  /** rows（文字列の二次元配列）を AG Grid の rowData 形式（オブジェクト配列）に変換する。 */
  function buildRowData(rows: string[][]): Record<string, string>[] {
    return rows.map((row) => {
      const obj: Record<string, string> = {};
      row.forEach((value, index) => {
        obj[String(index)] = value;
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

  /** コンポーネントマウント時に AG Grid を初期化し、アンマウント時に破棄する。 */
  $effect(() => {
    if (!gridContainer) return;

    const gridOptions: GridOptions = {
      theme: customTheme,
      columnDefs: buildColDefs(file.headers),
      rowData: buildRowData(file.rows),
      defaultColDef: {
        flex: 1,
        minWidth: 100,
        floatingFilter: true,
      },
      animateRows: false,
      suppressCellFocus: true,
      quickFilterText: searchQuery,
    };

    gridApi = createGrid(gridContainer, gridOptions, {
      modules: [AllCommunityModule],
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
</script>

<div class="grid-wrapper" bind:this={gridContainer}></div>

<style>
  .grid-wrapper {
    flex: 1;
    width: 100%;
    height: 100%;
    min-height: 0;
  }
</style>
