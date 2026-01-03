import * as vscode from 'vscode'
import { SnapshotStore } from '../store/SnapshotStore';

export class HistoryDocumentProvider implements vscode.TextDocumentContentProvider{
    
    constructor(private store: SnapshotStore) {}
    
    provideTextDocumentContent(uri: vscode.Uri): string {
        const params = new URLSearchParams(uri.query);
        if(!params.has('index') || !params.has('doc')) return '';
        
        const index = Number(params.get('index'));
        if (Number.isNaN(index)) return '';

        const doc = params.get('doc');
        if (!doc) return '';

        const snapshot = this.store.getByIndex(index, vscode.Uri.parse(doc));

        return snapshot?.text ?? '';
}
    
}