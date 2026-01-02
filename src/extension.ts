import { isUndefined } from 'util';
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
	// when deleting a lot of text, this does not fire.. this is due to the fact that i'm checking text.length and not range...
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
	console.log(`snapshot for ${key}, count=${timeline.length}`);
}


/* 
	Make Snapshot when:
	1. Idle for n ms
	2. After new-line AND idle for m < n seconds
	3. Something is pasted ( cannot get a "paste" event, so probably should be a hack)
	4. Saving
*/