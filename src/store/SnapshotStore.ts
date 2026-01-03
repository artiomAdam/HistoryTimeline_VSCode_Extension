import { Uri } from 'vscode';
import { Snapshot } from '../model/Snapshot';

export class SnapshotStore{
    private snapshots = new Map<string, Snapshot[]>();
    private listeners: (() => void)[] = [];
    private readonly MAX_SNAPSHOTS = 200;

    onChange(listener: () => void){
        this.listeners.push(listener);
        listener();
    }

    private notify(){
        for(const listener of this.listeners) listener();
    }

    add(text: string, uri: Uri) {
        const timeline = this.snapshots.get(uri.toString()) ?? [];

        const snapshot: Snapshot = {
            timestamp: Date.now(),
            text,
        };
        timeline.push(snapshot);
        if(timeline.length > this.MAX_SNAPSHOTS) timeline.shift();

        this.snapshots.set(uri.toString(), timeline);
        this.notify();
        return snapshot;
    }

    getByIndex(index: number, uri: Uri) : Snapshot | undefined {
        // console.log("uris in the dict: ");
        // for(const uriKey of this.snapshots.keys()){
        //     console.log(uriKey.toString());
        // }
        // console.log("current uri: ", uri.toString());
        
        const timeline = this.snapshots.get(uri.toString());
        return timeline?.[index];
    }

    getAll(uri: Uri): readonly Snapshot[]{
        return this.snapshots.get(uri.toString()) ?? [];
    }

    clear(uri: Uri) {
        this.snapshots.set(uri.toString(),[]);
        this.notify();
    }

    size(uri: Uri): number {
        return this.snapshots.get(uri.toString())?.length ?? 0;
    }
}