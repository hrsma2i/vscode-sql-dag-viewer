import { window, commands, ExtensionContext } from "vscode";
import { PreviewPanel } from "./panels/PreviewPanel";

export function activate(context: ExtensionContext) {
  const previewDAGCommand = commands.registerCommand("sql-dag-viewer.previewDAG", () => {
    const activeEditor = window.activeTextEditor;

    if (activeEditor) {
      const document = activeEditor.document;
      const text = document.getText();

      PreviewPanel.render(context.extensionUri, text);
    }
  });

  // Add command to the extension context
  context.subscriptions.push(previewDAGCommand);
}
