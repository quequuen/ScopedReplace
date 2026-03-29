import * as vscode from "vscode";

let currentQuickPick: vscode.QuickPick<vscode.QuickPickItem> | undefined;

// 앱 설치할 때 버튼 만드는 단계(등록)
export function activate(context: vscode.ExtensionContext) {
  console.log("activate...");

  let prevHandler: (() => void) | undefined;

  if (currentQuickPick) {
    currentQuickPick.dispose();
    currentQuickPick = undefined;
  }

  const matchDecoration = vscode.window.createTextEditorDecorationType({
    backgroundColor: "rgba(0,162,255,0.25)",
  });

  const currentDecoration = vscode.window.createTextEditorDecorationType({
    backgroundColor: "rgba(0, 255, 4, 0.25)",
  });

  context.subscriptions.push(
    vscode.commands.registerCommand("scopedReplace.prevMatch", () => {
      prevHandler?.();
    }),
  );

  // 버튼 등록과 클릭했을 때 동작(실제 동작)
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
      quickPick.placeholder = "Find (Enter: Next, Shift+Enter: Previous)";
      quickPick.ignoreFocusOut = true;
      currentQuickPick = quickPick;

      prevHandler = movePrev;

      // 옵션 상태 플래그
      // 정규식 입력
      let regexEnabled = false;
      // 대소문자 구분
      let caseSensitive = false;
      // 완전 일치
      let wholeWord = false;

      // 버튼
      const regexBtn: vscode.QuickInputButton = {
        iconPath: new vscode.ThemeIcon("regex"),
        tooltip: "Regex",
      };

      const caseBtn: vscode.QuickInputButton = {
        iconPath: new vscode.ThemeIcon("case-sensitive"),
        tooltip: "Case Sensitive",
      };

      const wordBtn: vscode.QuickInputButton = {
        iconPath: new vscode.ThemeIcon("whole-word"),
        tooltip: "Whole Word",
      };

      const replaceBtn: vscode.QuickInputButton = {
        iconPath: new vscode.ThemeIcon("replace"),
        tooltip: "Replace Current",
      };

      const replaceAllBtn: vscode.QuickInputButton = {
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

      updateSearch(quickPick.value);
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

      // 버튼 눌렀을 때 토글 ui 생성
      function createToggleButton(
        enabled: boolean,
        icon: string,
        tooltip: string,
      ): vscode.QuickInputButton {
        return {
          iconPath: new vscode.ThemeIcon(
            icon,
            enabled ? new vscode.ThemeColor("button.background") : undefined,
          ),
          tooltip: tooltip, // 상태 제거
        };
      }

      quickPick.onDidTriggerButton((button) => {
        if (button.tooltip === "Regex") {
          regexEnabled = !regexEnabled;
        }

        if (button.tooltip === "Case") {
          caseSensitive = !caseSensitive;
        }

        if (button.tooltip === "Word") {
          wholeWord = !wholeWord;
        }

        if (button.tooltip === "Replace Current") {
          replaceCurrent();
        }

        if (button.tooltip === "Replace All") {
          replaceAll();
        }

        refreshButtons();
        updateSearch(quickPick.value);
      });

      // 생성된 토글 ui로 refresh
      function refreshButtons() {
        const newRegexBtn = createToggleButton(regexEnabled, "regex", "Regex");
        const newCaseBtn = createToggleButton(
          caseSensitive,
          "case-sensitive",
          "Case",
        );
        const newWordBtn = createToggleButton(wholeWord, "whole-word", "Word");

        quickPick.buttons = [
          newRegexBtn,
          newCaseBtn,
          newWordBtn,
          replaceBtn,
          replaceAllBtn,
        ];
      }

      quickPick.onDidHide(() => {
        editor.setDecorations(matchDecoration, []);
        editor.setDecorations(currentDecoration, []);
        quickPick.dispose();
        currentQuickPick = undefined;
      });

      quickPick.show();
    },
  );

  context.subscriptions.push(disposable);
}
