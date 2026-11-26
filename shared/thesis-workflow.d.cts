export function workflowView(store: Record<string,any[]>,code:string): any;
export function applyWorkflow(store:Record<string,any[]>,code:string,actor:{manager:boolean;name:string},input:any):any;

export function councilConflict(store:Record<string,any[]>,code:string,names:string[]):boolean;
