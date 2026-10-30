import fs from 'node:fs'
import path from 'node:path'

// Single local Node process only. NOT a cloud/global distributed storage implementation.
export function openQuizStore(filename) {
  fs.mkdirSync(path.dirname(filename), {recursive:true})
  const lock=filename+'.lock'
  if(fs.existsSync(lock)) {
    const owner=Number(fs.readFileSync(lock,'utf8'))
    if(!Number.isSafeInteger(owner)||owner<=0)throw Error('store_locked')
    try{process.kill(owner,0);throw Error('store_locked')}catch(e){if(e.code!=='ESRCH')throw Error('store_locked')}
    fs.unlinkSync(lock)
  }
  fs.writeFileSync(lock,String(process.pid),{flag:'wx',mode:0o600})
  let data,poisoned=false,closed=false
  try{
    data=fs.existsSync(filename)?JSON.parse(fs.readFileSync(filename,'utf8')):
      {version:1,totalCalls:0,totalReservedMicro:0,day:'',dailyCalls:0,reservedMicro:0,recent:[],parties:{}}
    if(data.version!==1||!Number.isSafeInteger(data.totalCalls)||data.totalCalls<0||
      !Number.isSafeInteger(data.totalReservedMicro)||data.totalReservedMicro<0||
      !Number.isSafeInteger(data.dailyCalls)||data.dailyCalls<0||!Number.isSafeInteger(data.reservedMicro)||data.reservedMicro<0||
      !Array.isArray(data.recent)||!data.parties||typeof data.parties!=='object')throw Error('invalid_store')
  }catch{fs.unlinkSync(lock);throw Error('invalid_store')}
  const clone=v=>structuredClone(v)
  return {
    read(){if(poisoned||closed)throw Error('store_unavailable');return clone(data)},
    write(change){
      if(poisoned||closed)throw Error('store_unavailable')
      const next=clone(data),result=change(next),temp=filename+'.tmp'
      try{
        const fd=fs.openSync(temp,'w',0o600)
        try{fs.writeFileSync(fd,JSON.stringify(next));fs.fsyncSync(fd)}finally{fs.closeSync(fd)}
        // Windows antivirus/indexing can briefly lock the destination. Retry only the
        // atomic file replacement, never the model request or the budget reservation.
        for(let attempt=0;;attempt++){
          try{fs.renameSync(temp,filename);break}
          catch(error){if(attempt>=3||!['EPERM','EACCES','EBUSY'].includes(error.code))throw error
            Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,15)}
        }
        data=next
      }catch{poisoned=true;throw Error('store_unavailable')}
      return clone(result)
    },
    close(){if(!closed){closed=true;fs.unlinkSync(lock)}}
  }
}
