import * as vscode from 'vscode';
import { SnapshotStore } from './store/SnapshotStore';
import { EditRecorder } from './recorder/EditRecorder';
import { HistoryDocumentProvider } from './ui/HistoryDocumentProvider';
import { HistorySidebarProvider } from './ui/HistorySidebarProvider';

export function activate(context: vscode.ExtensionContext){
    console.log('extension activated');

    const store = new SnapshotStore();
    const recorder = new EditRecorder(store);

    recorder.start();
    console.log('recorder started');

    const provider = new HistoryDocumentProvider(store);
    context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider('history', provider));
    console.log('provider registered');

    const sidebarProvider = new HistorySidebarProvider(store);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            HistorySidebarProvider.viewType,
            sidebarProvider
        )
    );

}

export function deactivate() {}

