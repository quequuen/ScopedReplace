import * as vscode from "vscode";

export function activate(context: vscode.ExtensionContext) {
  const smartFind = vscode.commands.registerCommand(
    "scopedReplace.smartFind",
    () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;

      const hasSelection = !editor.selection.isEmpty;

      vscode.commands.executeCommand("actions.find", {
        findInSelection: hasSelection,
      });
    },
  );

  context.subscriptions.push(smartFind);
}

export function deactivate() {}
