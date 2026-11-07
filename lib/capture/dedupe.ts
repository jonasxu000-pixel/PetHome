// Stable 64-bit perceptual hash. Repeated samples remain in the timeline;
// the server cache saves model calls without dropping evidence of stillness.
export function frameHash(canvas:HTMLCanvasElement):string {
  const small=document.createElement('canvas');small.width=9;small.height=8;
  const ctx=small.getContext('2d');if(!ctx)throw new Error('浏览器无法读取视频画面。');
  ctx.drawImage(canvas,0,0,9,8);
  const {data}=ctx.getImageData(0,0,9,8);
  let hash=0n;
  for(let y=0;y<8;y++)for(let x=0;x<8;x++) {
    const left=(y*9+x)*4,right=left+4;
    const a=data[left]*0.299+data[left+1]*0.587+data[left+2]*0.114;
    const b=data[right]*0.299+data[right+1]*0.587+data[right+2]*0.114;
    hash=(hash<<1n)|(a>b?1n:0n);
  }
  return 'dhash:'+hash.toString(16).padStart(16,'0');
}
