let timer;
self.onmessage=({data})=>{clearInterval(timer);if(data==='start')timer=setInterval(()=>self.postMessage('tick'),25);};
