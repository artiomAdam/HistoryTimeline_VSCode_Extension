import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {

	vscode.window.showInformationMessage('Activated!');

	console.log('Congratulations, your extension "history-scroller" is now active!');
	let lastVersionSeen: number | null = null;
	const changeHandler = vscode.workspace.onDidChangeTextDocument( handleDocumentChange );
	context.subscriptions.push(changeHandler);
}

export function deactivate() {}


let idleTimer: ReturnType<typeof setTimeout> | null = null;
const IDLE_MS = 2000;

function handleDocumentChange(e: vscode.TextDocumentChangeEvent){
	const doc = e.document;
	if(idleTimer){
		clearTimeout(idleTimer);
	}
	idleTimer = setTimeout(() => {
		makeSnapshot(doc);
	}, IDLE_MS);
}

const timeLines = new Map<string, string[]>();
function makeSnapshot(doc: vscode.TextDocument){
	const key = doc.uri.toString();
	const timeline = timeLines.get(key) ?? [];
	const text = doc.getText();

	timeline.push(text);
	timeLines.set(key, timeline);
	console.log(`snapshot for ${key}, count=${timeline.length}`);
}
/* 
	Make Snapshot when:
	1. Idle for n ms
	2. After new-line AND idle for m < n seconds
	3. Something is pasted ( cannot get a "paste" event, so probably should be a hack)
	4. Saving
*/