import * as vscode from "vscode";
import { window, commands, ExtensionContext } from "vscode";
import { HelloWorldPanel } from "./panels/HelloWorldPanel";

export function activate(context: ExtensionContext) {
  // Create the show hello world command
  const showHelloWorldCommand = commands.registerCommand("hello-world.showHelloWorld", () => {
    const activeEditor = window.activeTextEditor;

    if (activeEditor) {
      const document = activeEditor.document;
      const text = document.getText();

      HelloWorldPanel.render(context.extensionUri, text);
    }
  });

  // Add command to the extension context
  context.subscriptions.push(showHelloWorldCommand);
}
