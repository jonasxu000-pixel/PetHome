const state=globalThis as typeof globalThis&{__petHomeVisionLimit?:{startedAt:number;count:number}};
// Shared process ceiling cannot be bypassed by changing client-supplied headers.
export function takeVisionSlot(now=Date.now()):boolean {
  let current=state.__petHomeVisionLimit;
  if(!current||now-current.startedAt>=60000){current={startedAt:now,count:0};state.__petHomeVisionLimit=current;}
  if(current.count>=30)return false;
  current.count++;return true;
}
