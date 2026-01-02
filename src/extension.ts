import { isUndefined } from 'util';
import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {

	vscode.window.showInformationMessage('Activated!');

	console.log('Congratulations, your extension "history-scroller" is now active!');
	let lastVersionSeen: number | null = null;
	const changeHandler = vscode.workspace.onDidChangeTextDocument( handleDocumentChange );
	const saveHandler = vscode.workspace.onDidSaveTextDocument(doc => {
		makeSnapshot(doc);
		console.log(" -> save event ");
	});
	context.subscriptions.push(changeHandler);



sidebarProvider = new HistoryViewProvider(context.extensionUri);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('history-scroller-sidebar', sidebarProvider)
    );

    context.subscriptions.push(
        vscode.workspace.registerTextDocumentContentProvider('history-scroller', myProvider)
    );
}

export function deactivate() {}


const myProvider = new (class implements vscode.TextDocumentContentProvider {
    onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>();
    onDidChange = this.onDidChangeEmitter.event;

    provideTextDocumentContent(uri: vscode.Uri): string {
        const docUri = uri.query; 
        const index = parseInt(uri.fragment);
        const timeline = timeLines.get(docUri) ?? [];
        return timeline[index] ?? "No snapshot found.";
    }
})();

let sidebarProvider: HistoryViewProvider;

class HistoryViewProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;
    constructor(private readonly _extensionUri: vscode.Uri) {}

    resolveWebviewView(webviewView: vscode.WebviewView) {
        this._view = webviewView;
        webviewView.webview.options = { enableScripts: true };

        webviewView.webview.html = `
            <html>
                <body style="padding: 10px;">
                    <input type="range" id="slider" min="0" max="0" value="0" style="width:100%">
                    <div id="label" style="margin-top: 10px;">Type to create snapshots...</div>
                    <script>
                        const vscode = acquireVsCodeApi();
                        const slider = document.getElementById('slider');
                        const label = document.getElementById('label');

                        window.addEventListener('message', event => {
                            slider.max = event.data.max;
                            slider.value = event.data.max; // Move slider to newest
                            label.innerText = "Snapshot: " + (parseInt(event.data.max) + 1);
                        });

                        slider.oninput = () => {
                            label.innerText = "Viewing Snapshot: " + (parseInt(slider.value) + 1);
                            vscode.postMessage({ type: 'slide', value: slider.value });
                        };
                    </script>
                </body>
            </html>
        `;

        webviewView.webview.onDidReceiveMessage(data => {
            if (data.type === 'slide') this.showSnapshot(data.value);
        });
    }

    private async showSnapshot(index: number) {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor) return;

        const uri = activeEditor.document.uri.toString();
        const virtualUri = vscode.Uri.parse(`history-scroller:History?${uri}#${index}`);
        
        myProvider.onDidChangeEmitter.fire(virtualUri);
        
        const doc = await vscode.workspace.openTextDocument(virtualUri);
        await vscode.window.showTextDocument(doc, {
            viewColumn: vscode.ViewColumn.Beside,
            preserveFocus: true,
            preview: true 
        });
    }

    public updateMax(max: number) {
        this._view?.webview.postMessage({ max });
    }
}

let idleTimer: ReturnType<typeof setTimeout> | null = null;
const IDLE_MS = 2000;
const NEWLINE_IDLE_MS = 500;
const MAX_SNAPSHOTS = 200;
const PASTE_CHARS_THRESHOLD = 2; // technically an undo/redo operation would also trigger a change with potentially more then a single character, 
                                 // also  there is a world where a single character is pasted.
								 // when there's something in the api that lets you know when a paste occured, probably change this...

function handleDocumentChange(e: vscode.TextDocumentChangeEvent){
	const doc = e.document;
	const change = e.contentChanges[0];
	if(!change) return;
	//console.log(change.text);

	// potentially pasted text:
	// when deleting a lot of text, this does not fire.. this is due to the fact that i'm checking text.length and not range.
	// checking range makes it feel wonky though, so i'd rather check text length, it adheres more to finding specifically paste events
	if(change.text.length > PASTE_CHARS_THRESHOLD){
		makeSnapshot(doc);
		console.log(" -> paste event")
		return;
	}

	// after newline short timeout:
	if(change.text.includes('\n')){
		snapshotOnIdleTimer(doc, NEWLINE_IDLE_MS);
		console.log(" -> newline idle event ");
		return;
	}


	// regular timeout
	snapshotOnIdleTimer(doc);
	console.log(" -> regular timeout event ");
}

function snapshotOnIdleTimer(doc: vscode.TextDocument, delay = IDLE_MS){
	if(idleTimer){
		clearTimeout(idleTimer);
	}
	idleTimer = setTimeout(() => {
		makeSnapshot(doc);
	}, delay);
}

function hashString(s: string): number {
	let hash = 5381;
	for (let i = 0; i < s.length; i++) {
		hash = ((hash << 5) + hash) + s.charCodeAt(i); // hash * 33 + c
		hash |= 0; // force 32-bit
	}

	return hash;
}

const timeLines = new Map<string, string[]>();
let previousSnapshotHashes = new Map<string, number>();

function makeSnapshot(doc: vscode.TextDocument){
	const key = doc.uri.toString();

	const text = doc.getText();

	// ignore if nothing changed
	const lastHash = previousSnapshotHashes.get(key);
	const hash = hashString(text);
	if(hash === lastHash) return;
	previousSnapshotHashes.set(key, hash);



	// push to timeline and remove the oldest snapshot
	const timeline = timeLines.get(key) ?? [];
	timeline.push(text);

	if (timeline.length > MAX_SNAPSHOTS) {
		timeline.shift();
	}

	timeLines.set(key, timeline);
	if (sidebarProvider) {
        sidebarProvider.updateMax(timeline.length - 1);
    }
	console.log(`snapshot for ${key}, count=${timeline.length}`);
}


/* 
	Make Snapshot when:
	1. Idle for n ms
	2. After new-line AND idle for m < n seconds
	3. Something is pasted ( cannot get a "paste" event, so probably should be a hack)
	4. Saving
*/