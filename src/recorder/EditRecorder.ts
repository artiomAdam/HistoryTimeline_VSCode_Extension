import * as vscode from 'vscode';
import { SnapshotStore } from '../store/SnapshotStore';

export class EditRecorder{
    private disposables: vscode.Disposable[] = [];

    private timer? : ReturnType<typeof setTimeout>;
    private currentDelay = Infinity;
    private lastSnapshotText?: string;

    private readonly PASTE_RANGE_THRESHOLD : number = 2; // more then this amount of char change at once should trigger a snapshot
    private readonly ENTER_TIMEOUT_MS: number = 500; // wait this much after pressing newline until snapshot
    private readonly IDLE_TIMEOUT_MS: number = 2000; // wait this much of idle time before snapshot

    constructor(private store: SnapshotStore) {}
    
    start(){
        this.disposables.push(
            vscode.workspace.onDidChangeTextDocument(e => this.onChange(e)),
            vscode.workspace.onDidSaveTextDocument(doc => this.saveSnapshot(doc)),
            vscode.window.onDidChangeActiveTextEditor(editor => {
                this.reset();
                if(editor){
                    this.saveSnapshot(editor.document);
                }}),
        );

        // if extension loads when editor window is already open
        const editor = vscode.window.activeTextEditor;
        if(editor) this.saveSnapshot(editor.document);
    }

    private onChange(e : vscode.TextDocumentChangeEvent){
        const doc = e.document;
        const scheme = doc.uri.scheme;
        if(scheme !== 'file' && scheme !== 'untitled') return;


        let charsChanged = 0;
        let enterPressed = false;
        for(const c of e.contentChanges){
            charsChanged += Math.abs(c.text.length - c.rangeLength);
            if(c.text.includes('\n')) enterPressed = true;
        }
        
        // looking for immediate large change, happens on paste, large undo, large remove and shit like that...
        if(charsChanged >= this.PASTE_RANGE_THRESHOLD){
            this.saveSnapshot(doc);
            return;
        }

        // enter pressed - small delay
        if(enterPressed){
            this.scheduleSnapshot(this.ENTER_TIMEOUT_MS, doc);
            return;
        }

        /// or large delay otherwise
        this.scheduleSnapshot(this.IDLE_TIMEOUT_MS, doc);

        // TODO: on save - snapshot immedietly
        


    }

    private scheduleSnapshot(delayMs: number, doc: vscode.TextDocument){
        if(delayMs >= this.currentDelay) return;
        this.currentDelay = delayMs;
        if(this.timer) clearTimeout(this.timer);
        this.timer = setTimeout(() => {
                this.saveSnapshot(doc);
        }, delayMs);
    }

    private saveSnapshot(doc: vscode.TextDocument){
        if(!doc) return;
        const text = doc.getText();
        if(text === this.lastSnapshotText) return;
        this.lastSnapshotText = text;
        this.reset();


        this.store.add(doc.getText(), doc.uri);
        //console.log("snapped");
    }

    private reset(){
        if(this.timer) clearTimeout(this.timer);
        this.timer = undefined;
        this.currentDelay = Infinity;
    }

    dispose(){
        this.disposables.forEach(d => d.dispose);
    }
}