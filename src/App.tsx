import { useState, useCallback } from 'react'
import { ReactFlow, Background, Controls, Handle, Position, addEdge, useNodesState, useEdgesState, type Connection, type NodeProps, type Node } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Sparkles, RotateCcw, Play, Check, Box } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'

type GelNode = Node<{ label: string }, 'gel'>
function MaterialNode({ data }: NodeProps<GelNode>) {
  const [amount, setAmount] = useState<number | readonly number[]>(62)
  return <Card className="w-56"><Handle type="target" position={Position.Left} /><CardHeader><CardTitle>{data.label}</CardTitle><CardDescription>Drag the header to move</CardDescription></CardHeader><CardContent className="space-y-3"><Input className="nodrag" aria-label={`${data.label} name`} defaultValue={data.label} /><Slider className="nodrag nopan nowheel" aria-label={`${data.label} intensity`} value={amount} onValueChange={setAmount} /><label className="nodrag flex items-center gap-2"><Checkbox defaultChecked /> Enabled</label></CardContent><Handle type="source" position={Position.Right} /></Card>
}
const nodeTypes = { gel: MaterialNode }
const initialNodes: GelNode[] = [{ id: '1', type: 'gel', position: { x: 40, y: 60 }, data: { label: 'Gel material' } }, { id: '2', type: 'gel', position: { x: 360, y: 170 }, data: { label: 'Gloss output' } }]
const initialEdges = [{ id: '1-2', source: '1', target: '2', animated: true }]
export default function App() {
  const [intensity, setIntensity] = useState<number | readonly number[]>(64)
  const [saved, setSaved] = useState(false)
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  const onConnect = useCallback((connection: Connection) => setEdges(es => addEdge(connection, es)), [setEdges])
  return <main className="mx-auto max-w-7xl px-5 py-8 md:px-10 md:py-12">
    <header className="mb-12 flex items-center justify-between gap-4"><span className="flex items-center gap-3 font-semibold"><span className="brand-orb"><Box className="size-5" /></span>nodeart <span className="text-xs font-normal tracking-widest opacity-60">/ GEL LAB</span></span><span className="hidden text-xs tracking-widest sm:block">REACT · TAILWIND 4 · BASE UI</span></header>
    <div className="mb-10 max-w-2xl"><p className="mb-3 text-xs font-semibold tracking-[.24em]">TACTILE BY DESIGN</p><h1 className="mb-4 text-5xl font-semibold tracking-tight md:text-7xl">A little more<br /><span className="text-[#346988]">touchable.</span></h1><p className="max-w-lg text-base leading-relaxed text-[#35566c]">Glossy gel. Soft light. Satisfying little interactions. A component playground for your next node-based idea.</p></div>
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <div className="space-y-6"><Card><CardHeader><CardTitle className="flex items-center gap-2"><Sparkles className="size-4" /> The gel collection</CardTitle><CardDescription>Press, slide, and play.</CardDescription></CardHeader><CardContent className="space-y-6">
        <div className="flex flex-wrap gap-3"><Button onClick={() => setSaved(s => !s)}>{saved ? <Check /> : <Play />}{saved ? 'Applied' : 'Apply gel'}</Button><Button variant="secondary">Neutral</Button><Button variant="destructive">Danger</Button><Button disabled>Disabled</Button></div><p role="status" className="text-xs">{saved ? 'Gel material applied.' : 'Ready to experiment.'}</p>
        <div className="space-y-2"><label htmlFor="material-name" className="text-xs font-semibold">Material name</label><Input id="material-name" placeholder="Give your gel a name…" /></div>
        <div className="space-y-3"><div className="flex justify-between text-xs font-semibold"><span id="gloss-label">Gloss intensity</span><output>{Array.isArray(intensity) ? intensity[0] : intensity}%</output></div><Slider aria-labelledby="gloss-label" aria-label="Gloss intensity" value={intensity} onValueChange={setIntensity} /><p className="text-xs text-[#35566c]">Grab the thumb. It squishes.</p></div>
        <label className="flex items-center gap-3"><Checkbox defaultChecked /><span>Keep the highlights</span></label>
        <fieldset><legend className="mb-3 text-xs font-semibold">Surface finish</legend><RadioGroup defaultValue="glass" className="flex gap-5" aria-label="Surface finish">{['glass', 'satin'].map(f => <label key={f} className="flex items-center gap-2 capitalize"><RadioGroupItem value={f} />{f}</label>)}</RadioGroup></fieldset>
      </CardContent></Card><p className="px-1 text-xs leading-relaxed text-[#46657d]">Structure in Tailwind. Surface in CSS.<br />Gradient math adapted from your source.css.</p></div>
      <Card><CardHeader className="flex flex-wrap items-center justify-between gap-3"><div><CardTitle>Material graph</CardTitle><CardDescription>Connect handles. Adjust controls. Make it yours.</CardDescription></div><Button variant="secondary" size="sm" onClick={() => { setNodes(initialNodes); setEdges(initialEdges) }}><RotateCcw />Reset</Button></CardHeader><CardContent><div className="graph h-[490px] overflow-hidden rounded-xl border border-[#46657d]/40"><ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} nodeTypes={nodeTypes} fitView minZoom={0.4}><Background color="#7498b4" gap={20} /><Controls /></ReactFlow></div></CardContent></Card>
    </div><footer className="mt-10 flex justify-between border-t border-[#46657d]/25 pt-5 text-xs text-[#46657d]"><span>01 / A study in glossy interfaces</span><a href="https://ui.shadcn.com/docs" target="_blank" rel="noreferrer">Built with shadcn/ui ↗</a></footer>
  </main>
}
