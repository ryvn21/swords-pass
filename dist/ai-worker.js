import {planMove} from './ai.js';
self.onmessage=({data})=>{try{self.postMessage({id:data.id,plan:planMove(data)});}catch(error){self.postMessage({id:data.id,error:String(error)});}};
