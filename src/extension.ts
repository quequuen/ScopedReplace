import * as vscode from "vscode";

export function activate(context: vscode.ExtensionContext) {
  console.log("Smart Find Activated!");
  const smartFind = vscode.commands.registerCommand(
    "scopedReplace.smartFind",
    () => {
      console.log("🔥: Smart Find Executed");

      const editor = vscode.window.activeTextEditor;

      if (!editor) {
        return;
      }

      const selection = editor.selection;

      if (!selection.isEmpty) {
        console.log("👉: Find in Selection");
        vscode.commands.executeCommand("editor.actions.findWithSelection");
      } else {
        console.log("👉: Normal Find");
        vscode.commands.executeCommand("actions.find");
      }
    },
  );

  context.subscriptions.push(smartFind);
}

export function deactivate() {}
