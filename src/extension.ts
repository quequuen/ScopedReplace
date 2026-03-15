import * as vscode from "vscode";

export function activate(context: vscode.ExtensionContext) {
  console.log("activate...");
  const matchDecoration = vscode.window.createTextEditorDecorationType({
    backgroundColor: "rgba(0,162,255,0.25)",
  });

  const currentDecoration = vscode.window.createTextEditorDecorationType({
    backgroundColor: "rgba(0, 255, 4, 0.5)",
  });

  const disposable = vscode.commands.registerCommand(
    "scopedReplace.smartFind",
    async () => {
      const editor = vscode.window.activeTextEditor!;
      if (!editor) return;

      const selection = editor.selection;

      if (selection.isEmpty) {
        vscode.commands.executeCommand("actions.find");
        return;
      }

      const quickPick = vscode.window.createQuickPick();
      quickPick.title = "ScopedReplace";
      quickPick.placeholder = "검색어 입력 (Enter: next, Shift+Enter: prev)";
      quickPick.ignoreFocusOut = true;

      // 옵션 상태 플래그
      // 정규식 입력
      let regexEnabled = false;
      // 대소문자 구분
      let caseSensitive = false;
      // 완전 일치
      let wholeWord = false;

      // 버튼
      const regexBtn = {
        iconPath: new vscode.ThemeIcon("regex"),
        tooltip: "Regex",
      };

      const caseBtn = {
        iconPath: new vscode.ThemeIcon("case-sensitive"),
        tooltip: "Case Sensitive",
      };

      const wordBtn = {
        iconPath: new vscode.ThemeIcon("whole-word"),
        tooltip: "Whole Word",
      };

      const replaceBtn = {
        iconPath: new vscode.ThemeIcon("replace"),
        tooltip: "Replace Current",
      };

      const replaceAllBtn = {
        iconPath: new vscode.ThemeIcon("replace-all"),
        tooltip: "Replace All",
      };

      quickPick.buttons = [
        regexBtn,
        caseBtn,
        wordBtn,
        replaceBtn,
        replaceAllBtn,
      ];

      let foundRanges: vscode.Range[] = [];
      let currentMatchIndex = -1;

      function buildRegex(searchText: string): RegExp | null {
        console.log("buildRegex...");

        if (!searchText) return null;

        try {
          let pattern = searchText;

          // 정규식 아닐 때 해당 조건으로 검색
          if (!regexEnabled) {
            pattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          }

          if (wholeWord) {
            pattern = `\\b${pattern}\\b`;
          }

          const flags = caseSensitive ? "g" : "gi";

          return new RegExp(pattern, flags);
        } catch {
          return null;
        }
      }

      function renderDecorations() {
        editor.setDecorations(matchDecoration, foundRanges);

        if (currentMatchIndex >= 0) {
          editor.setDecorations(currentDecoration, [
            foundRanges[currentMatchIndex],
          ]);
        } else {
          editor.setDecorations(currentDecoration, []);
        }

        quickPick.title = `ScopedReplace    ${currentMatchIndex + 1}/${foundRanges.length} matches`;
      }

      function updateSearch(searchText: string) {
        console.log("updateSearch...", searchText);
        const regex = buildRegex(searchText);

        if (!regex) {
          foundRanges = [];
          renderDecorations();
          return;
        }

        const text = editor.document.getText(selection);
        const startOffset = editor.document.offsetAt(selection.start);

        foundRanges = [];

        let match;

        while ((match = regex.exec(text)) !== null) {
          if (match.index === regex.lastIndex) {
            regex.lastIndex++;
          }

          const start = editor.document.positionAt(startOffset + match.index);
          const end = editor.document.positionAt(
            startOffset + match.index + match[0].length,
          );

          foundRanges.push(new vscode.Range(start, end));
        }

        currentMatchIndex = -1;

        renderDecorations();
      }

      function moveNext() {
        if (foundRanges.length === 0) return;

        currentMatchIndex = (currentMatchIndex + 1) % foundRanges.length;

        const range = foundRanges[currentMatchIndex];

        editor.selection = new vscode.Selection(range.start, range.end);

        editor.revealRange(
          range,
          vscode.TextEditorRevealType.InCenterIfOutsideViewport,
        );

        renderDecorations();
      }

      function movePrev() {
        if (foundRanges.length === 0) return;

        currentMatchIndex =
          (currentMatchIndex - 1 + foundRanges.length) % foundRanges.length;

        const range = foundRanges[currentMatchIndex];

        editor.selection = new vscode.Selection(range.start, range.end);

        editor.revealRange(
          range,
          vscode.TextEditorRevealType.InCenterIfOutsideViewport,
        );

        renderDecorations();
      }

      let timer: NodeJS.Timeout;

      quickPick.onDidChangeValue((value) => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          updateSearch(value);
        }, 120);
      });

      quickPick.onDidAccept(() => {
        moveNext();
      });

      vscode.commands.registerCommand("scopedReplace.prevMatch", movePrev);

      quickPick.onDidTriggerButton(async (button) => {
        if (button === regexBtn) {
          regexEnabled = !regexEnabled;
          updateSearch(quickPick.value);
        }

        if (button === caseBtn) {
          caseSensitive = !caseSensitive;
          updateSearch(quickPick.value);
        }

        if (button === wordBtn) {
          wholeWord = !wholeWord;
          updateSearch(quickPick.value);
        }

        if (button === replaceBtn) {
          if (currentMatchIndex < 0) return;

          const replaceText = await vscode.window.showInputBox({
            prompt: "바꿀 내용",
          });

          if (!replaceText) return;

          await editor.edit((editBuilder) => {
            editBuilder.replace(foundRanges[currentMatchIndex], replaceText);
          });

          updateSearch(quickPick.value);
        }

        if (button === replaceAllBtn) {
          const replaceText = await vscode.window.showInputBox({
            prompt: "바꿀 내용",
          });

          if (!replaceText) return;

          await editor.edit((editBuilder) => {
            for (let i = foundRanges.length - 1; i >= 0; i--) {
              editBuilder.replace(foundRanges[i], replaceText);
            }
          });

          vscode.window.showInformationMessage(
            `${foundRanges.length}개 항목 변경 완료`,
          );

          updateSearch(quickPick.value);
        }
      });

      quickPick.onDidHide(() => {
        editor.setDecorations(matchDecoration, []);
        editor.setDecorations(currentDecoration, []);
        quickPick.dispose();
      });

      quickPick.show();
    },
  );

  context.subscriptions.push(disposable);
}
