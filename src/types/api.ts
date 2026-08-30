export type Language='hi'|'en'; export type Config={token:string;sessionId:string};
export type Source={title:string;source:string;version:string;domain?:string};
export type Turn={response_type:string;content:Record<string,unknown>;correlation_id?:string;intent?:string|null;selected_agent?:string|null;safety_status?:string;latency?:number};
export type Document={documentId:string;title:string;domain:string;language:string;version:string;status:string;updatedAt:string};
