export function modelJsonText(raw:string):string {
  let text=raw.trim();
  if(text.startsWith('<think>')) {
    const end=text.indexOf('</think>');
    if(end<0)return '';
    text=text.slice(end+'</think>'.length).trim();
  }
  return text.replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
}
