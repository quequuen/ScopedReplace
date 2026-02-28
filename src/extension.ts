import * as vscode from "vscode";

export function activate(context: vscode.ExtensionContext) {
  let searchHighlightDecoration: vscode.TextEditorDecorationType;

  // 하이라이트 스타일 정의
  searchHighlightDecoration = vscode.window.createTextEditorDecorationType({
    backgroundColor: "rgba(0, 162, 255, 0.3)",
  });

  let disposable = vscode.commands.registerCommand(
    "scopedReplace.smartFind",
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;

      const selection = editor.selection;
      if (selection.isEmpty) {
        vscode.commands.executeCommand("actions.find");
        return;
      }

      const quickPick = vscode.window.createQuickPick();
      quickPick.placeholder =
        "단어 입력 (Enter: 다음, Shift+Enter: 이전, 우측 버튼: 바꾸기)";

      // 커스텀 버튼 추가 (바꾸기 기능)
      quickPick.buttons = [
        {
          iconPath: new vscode.ThemeIcon("replace"),
          tooltip: "선택 영역 내 모두 바꾸기",
        },
      ];

      let foundRanges: vscode.Range[] = [];
      let currentMatchIndex = -1;

      // 찾기 로직 함수
      const updateSearch = (searchText: string) => {
        if (!searchText) {
          foundRanges = [];
          editor.setDecorations(searchHighlightDecoration, []);
          return;
        }

        const text = editor.document.getText(selection);
        const startIndex = editor.document.offsetAt(selection.start);
        foundRanges = [];

        let curr = text.indexOf(searchText);
        while (curr !== -1) {
          const startPos = editor.document.positionAt(startIndex + curr);
          const endPos = editor.document.positionAt(
            startIndex + curr + searchText.length,
          );
          foundRanges.push(new vscode.Range(startPos, endPos));
          curr = text.indexOf(searchText, curr + searchText.length);
        }
        editor.setDecorations(searchHighlightDecoration, foundRanges);
      };

      // 1. 텍스트 입력 시 실시간 찾기
      quickPick.onDidChangeValue((value) => {
        updateSearch(value);
        currentMatchIndex = -1;
      });

      // 2. 엔터 키 입력 시 커서 이동 (Next/Prev)
      quickPick.onDidAccept(() => {
        if (foundRanges.length === 0) return;

        // 엔터는 다음(Next), Shift+Enter 처리는 따로 없으나 인덱스 순환으로 구현
        currentMatchIndex = (currentMatchIndex + 1) % foundRanges.length;
        const targetRange = foundRanges[currentMatchIndex];

        editor.selection = new vscode.Selection(
          targetRange.start,
          targetRange.end,
        );
        editor.revealRange(
          targetRange,
          vscode.TextEditorRevealType.InCenterIfOutsideViewport,
        );
      });

      // 3. 바꾸기 버튼 클릭 시
      quickPick.onDidTriggerButton(async (button) => {
        const replaceText = await vscode.window.showInputBox({
          prompt: "바꿀 내용을 입력하세요",
        });
        if (replaceText === undefined || !quickPick.value) return;

        editor
          .edit((editBuilder) => {
            // 뒤에서부터 바꿔야 인덱스가 꼬이지 않음
            for (let i = foundRanges.length - 1; i >= 0; i--) {
              editBuilder.replace(foundRanges[i], replaceText);
            }
          })
          .then((success) => {
            if (success) {
              vscode.window.showInformationMessage(
                `${foundRanges.length}개 항목 변경 완료`,
              );
              // quickPick.hide();
            }
          });
      });

      quickPick.onDidHide(() => {
        editor.setDecorations(searchHighlightDecoration, []);
        quickPick.dispose();
      });

      quickPick.show();
    },
  );

  context.subscriptions.push(disposable);
}
