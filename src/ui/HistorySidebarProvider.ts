import * as vscode from 'vscode';
import { SnapshotStore } from '../store/SnapshotStore';

export class HistorySidebarProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'history-scroller-sidebar';
    private view?: vscode.WebviewView;
    private currentDocUri: vscode.Uri | undefined;

    constructor(private store: SnapshotStore) {}

    resolveWebviewView(webviewView: vscode.WebviewView) {
        this.view = webviewView;
        this.view.webview.options = {enableScripts: true};
        this.store.onChange(() => this.update());

        vscode.window.onDidChangeActiveTextEditor(() => this.update());
        
        webviewView.webview.onDidReceiveMessage(msg => {
            if (msg.type === 'preview') {
                this.update();
                const src = vscode.window.activeTextEditor?.document.uri.toString();
                if (!src) return;
                const uri = vscode.Uri.parse(`history://preview?index=${msg.index}&doc=${src}`);
                vscode.workspace.openTextDocument(uri).then(doc =>
                    vscode.window.showTextDocument(doc, {
                        viewColumn: vscode.ViewColumn.Beside,
                        preview: true,
                        preserveFocus: true,}));
                    }

            else if(msg.type === 'apply_snapshot'){
                console.log("apply");
            }
                });
    }

    private update(){
        if(!this.view)return;
        this.currentDocUri = vscode.window.activeTextEditor?.document.uri;
        this.view.webview.html = this.render();
    }

    private render(): string {
        const size = this.store.size(this.currentDocUri!);
        const max = Math.max(size - 1, 0);
        const disabled = size === 0 ? 'disabled' : '';

        return `
        <!DOCTYPE html>
        <html>
        <body>
            <h3>History Timeline</h3>
            <input id="slider" type="range" min="0" max="${max}" value="${max}" ${disabled} />
            <button id="apply_btn"> Apply </button>
            <script>
                const vscode = acquireVsCodeApi();
                const slider = document.getElementById('slider');
                slider.oninput = () => {
                    vscode.postMessage({
                    type: 'preview',
                    index: Number(slider.value)
                    });
                };


                const btn = document.getElementById('apply_btn');
                btn.onclick = () => {
                    vscode.postMessage({
                    type: 'apply_snapshot'
                    });
                };
            </script>
        </body>
        </html>`;
    }
}
