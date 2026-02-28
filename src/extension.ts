import * as vscode from "vscode";

export function activate(context: vscode.ExtensionContext) {
  let disposable = vscode.commands.registerCommand(
    "scopedReplace.smartFind",
    () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;

      const selection = editor.selection;

      // 1. 영역이 선택되어 있지 않으면 그냥 기본 찾기 실행
      if (selection.isEmpty) {
        vscode.commands.executeCommand("actions.find");
        return;
      }

      // 2. 선택 영역이 있다면 QuickPick(입력창) 생성
      const quickPick = vscode.window.createQuickPick();
      quickPick.placeholder = "선택 영역 내에서 검색할 단어를 입력하세요...";

      // 입력창에 글자를 칠 때마다 실행되는 이벤트
      quickPick.onDidChangeValue((searchText) => {
        if (!searchText) {
          editor.setDecorations(searchHighlightDecoration, []); // 글자 지우면 하이라이트 제거
          return;
        }

        const text = editor.document.getText(selection); // 선택 영역 텍스트만 가져오기
        const startIndex = editor.document.offsetAt(selection.start);
        const ranges: vscode.Range[] = [];

        // 선택 영역 내에서 검색어 위치 찾기 (단순 텍스트 검색 예시)
        let curr = text.indexOf(searchText);
        while (curr !== -1) {
          const startPos = editor.document.positionAt(startIndex + curr);
          const endPos = editor.document.positionAt(
            startIndex + curr + searchText.length,
          );
          ranges.push(new vscode.Range(startPos, endPos));
          curr = text.indexOf(searchText, curr + searchText.length);
        }

        // 검색된 단어들에 노란색 하이라이트 뿌리기
        editor.setDecorations(searchHighlightDecoration, ranges);
      });

      // ESC 누르거나 창 닫으면 하이라이트 제거
      quickPick.onDidHide(() => {
        editor.setDecorations(searchHighlightDecoration, []);
        quickPick.dispose();
      });

      quickPick.show();
    },
  );

  context.subscriptions.push(disposable);
}

// 검색 결과 하이라이트 스타일 정의 (노란색 배경)
const searchHighlightDecoration = vscode.window.createTextEditorDecorationType({
  backgroundColor: "rgba(255, 255, 0, 0.3)",
  border: "1px solid yellow",
  overviewRulerColor: "yellow",
  overviewRulerLane: vscode.OverviewRulerLane.Right,
});

export function deactivate() {}
