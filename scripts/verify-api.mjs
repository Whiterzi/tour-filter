import assert from 'node:assert/strict';
import {createServer} from 'vite';

const server=await createServer({configFile:false,cacheDir:'node_modules/.vite-tests',optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true},appType:'custom'});
const origin='https://whiterzi.github.io';
const env={ALLOWED_ORIGINS:origin};
const originalFetch=globalThis.fetch;
try {
 const {handleRequest}=await server.ssrLoadModule('/api/worker.ts');
 const {defaults}=await server.ssrLoadModule('/lib/tours/model.ts');
 const {normalizeApiBase,fetchTourPage}=await server.ssrLoadModule('/lib/tours/api-client.ts');
 const req=(body,options={})=>new Request('https://api.example.org/api/search',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...options.headers},body:JSON.stringify(body)});
 let calls=0;
 globalThis.fetch=async()=>{calls++;throw new Error('No upstream request expected');};
 let r=await handleRequest(new Request('https://api.example.org/api/search',{method:'OPTIONS',headers:{Origin:origin,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'content-type'}}),env);
 assert.equal(r.status,204);assert.equal(r.headers.get('Access-Control-Allow-Origin'),origin);assert.equal(r.headers.get('Access-Control-Allow-Credentials'),null);
 r=await handleRequest(req({}, {headers:{Origin:'https://other.example.org'}}),env);
 assert.equal(r.status,403);assert.equal(r.headers.get('Access-Control-Allow-Origin'),null);
 r=await handleRequest(new Request('https://api.example.org/api/search',{method:'OPTIONS',headers:{Origin:origin,'Access-Control-Request-Method':'DELETE'}}),env);
 assert.equal(r.status,403);
 assert.equal((await handleRequest(new Request('https://api.example.org/missing'),env)).status,404);
 assert.equal((await handleRequest(new Request('https://api.example.org/health'),env)).status,200);
 assert.equal((await handleRequest(new Request('https://api.example.org/api/search'),env)).status,405);
 assert.equal((await handleRequest(req({}, {headers:{'Content-Type':'text/plain'}}),env)).status,415);
 assert.equal((await handleRequest(req({pad:'x'.repeat(9000)}),env)).status,413);
 assert.equal((await handleRequest(req({query:defaults,provider:'https://other.example.org'}),env)).status,400);
 assert.equal((await handleRequest(req({query:defaults,provider:'lion',page:0}),env)).status,400);
 assert.equal((await handleRequest(req({query:defaults,provider:'star'}),env)).status,400);
 assert.equal(calls,0);
 globalThis.fetch=async(url,options)=>{
  calls++;
  assert.equal(url,'https://travel.liontravel.com/search/singlegrouplistinfojson');
  assert.equal(JSON.parse(options.body).Page,1);
  return Response.json({Count:0,TotalCount:0,TotalPage:0,SingleGroupList:[]});
 };
 r=await handleRequest(req({query:defaults,provider:'lion',page:1}),env);
 assert.equal(r.status,200);assert.equal(r.headers.get('Access-Control-Allow-Origin'),origin);
 assert.equal((await r.json()).provider,'lion');assert.equal(calls,1);
 globalThis.fetch=async()=>{throw new Error('temporary upstream failure');};
 r=await handleRequest(req({query:{...defaults,budget:25998},provider:'lion'}),env);
 assert.equal(r.status,502);assert.equal(r.headers.get('Access-Control-Allow-Origin'),origin);
 assert.equal((await r.json()).error,'temporary upstream failure');
 for(const url of ['',undefined,'http://remote.example.org','https://user:pass@example.org','https://example.org/?secret=x','https://example.org/#x'])assert.throws(()=>normalizeApiBase(url));
 assert.equal(normalizeApiBase('https://api.example.org/tours/'),'https://api.example.org/tours');
 assert.equal(normalizeApiBase('http://127.0.0.1:8787/'),'http://127.0.0.1:8787');
 const signal=new AbortController().signal;
 globalThis.fetch=async(url,options)=>{
  assert.equal(url,'https://api.example.org/api/search');assert.equal(options.credentials,'omit');assert.equal(options.signal,signal);
  return Response.json({provider:'cola',tours:[],scanned:0,next:null,fetchedAt:''});
 };
 assert.equal((await fetchTourPage('https://api.example.org','cola',defaults,1,signal)).provider,'cola');
 globalThis.fetch=async()=>new Response('<html>Gateway error</html>',{status:502,headers:{'Content-Type':'text/html'}});
 await assert.rejects(()=>fetchTourPage('https://api.example.org','cola',defaults,1,signal),/查詢服務暫時無法連線/);
 console.log('PASS: Pages-to-API requests, CORS preflight/errors, provider allowlist, request bounds and upstream failures.');
} finally { globalThis.fetch=originalFetch;await server.close(); }
