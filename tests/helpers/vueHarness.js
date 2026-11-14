import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { compileScript, parse } from '@vue/compiler-sfc'
import { createRenderer, h } from 'vue'
async function urlComponente(file, entorno) {
  const absoluto = path.resolve(file)
  const { descriptor } = parse(fs.readFileSync(absoluto,'utf8'),{filename:absoluto})
  const script = compileScript(descriptor,{id:file,inlineTemplate:true,templateOptions:{compilerOptions:{hoistStatic:false}}})
  const destinos = new Map()
  for (const match of script.content.matchAll(/from\s+(['"])([^'"]+)\1/g)) {
    const spec = match[2]
    const local = spec.startsWith('@/') ? path.resolve('src',spec.slice(2)) : spec.startsWith('.') ? path.resolve(path.dirname(absoluto),spec) : null
    destinos.set(spec, local ? (spec.endsWith('.vue') ? await urlComponente(local, entorno) : pathToFileURL(local+(path.extname(spec)?'':'.js')).href) : import.meta.resolve(spec))
  }
  const content=entorno===undefined?script.content:script.content.replaceAll('import.meta.env',JSON.stringify(entorno))
  const code = content.replace(/from\s+(['"])([^'"]+)\1/g, (_, q, spec) => `from ${JSON.stringify(destinos.get(spec))}`)
  return `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
}
export async function cargarComponente(file, entorno) { return (await import(await urlComponente(file, entorno))).default }
globalThis.Document ??= class Document {}
globalThis.ShadowRoot ??= class ShadowRoot {}
globalThis.document ??= Object.assign(new globalThis.Document(), { activeElement: null })
function nodo(tag,text='') { return {tag,text,children:[],props:{},parent:null,get options(){return this.children.filter(n=>n.tag==='option')},tagName:tag.toUpperCase(),style:{},getRootNode(){return globalThis.document},addEventListener(){},removeEventListener(){},setAttribute(){},removeAttribute(){}} }
const renderer = createRenderer({
  createElement:tag=>nodo(tag),createText:text=>nodo('#text',text),createComment:text=>nodo('#comment',text),
  setText:(n,t)=>{n.text=t},setElementText:(n,t)=>{n.text=t;n.children=[]},
  patchProp:(n,k,prev,next)=>{n.props[k]=next;n[k]=next},
  insert(n,parent,anchor=null){ if(n.parent){const i=n.parent.children.indexOf(n);if(i>=0)n.parent.children.splice(i,1)} n.parent=parent;const i=anchor?parent.children.indexOf(anchor):-1;if(i<0)parent.children.push(n);else parent.children.splice(i,0,n) },
  remove(n){const i=n.parent?.children.indexOf(n);if(i>=0)n.parent.children.splice(i,1);n.parent=null},
  parentNode:n=>n.parent,nextSibling:n=>n.parent?.children[n.parent.children.indexOf(n)+1]??null,
})
export function montar(Component,props) {const root=nodo('root');const app=renderer.createApp({render:()=>h(Component,props)});app.mount(root);return {root,unmount:()=>app.unmount()}}
export function buscar(root,predicado){return [root,...root.children.flatMap(n=>buscar(n,predicado))].filter(predicado)}
export function texto(n){return n.text+n.children.map(texto).join('')}
