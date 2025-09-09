import { useCallback, useMemo, useRef, useState } from 'react'
import './App.css'

function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return ''
  const sizes = ['B','KB','MB','GB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), sizes.length - 1)
  const value = bytes / Math.pow(1024, i)
  return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${sizes[i]}`
}

function App() {
  const [file, setFile] = useState(null)
  const [status, setStatus] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isDirectSigning, setIsDirectSigning] = useState(false)
  const [publicUrl, setPublicUrl] = useState('')
  const [signerName, setSignerName] = useState('')
  const [signerQueue, setSignerQueue] = useState([])
  const [signedUrl, setSignedUrl] = useState('')
  const inputRef = useRef(null)

  const canUpload = useMemo(() => !!file && !isUploading, [file, isUploading])
  const canDirectSign = useMemo(() => !!file && !!signerName.trim() && !isDirectSigning, [file, signerName, isDirectSigning])
  const canDownload = useMemo(() => !!signedUrl, [signedUrl])
  const canSignAll = useMemo(() => !!file && signerQueue.length > 0 && !isDirectSigning, [file, signerQueue, isDirectSigning])

  const openUploaded = useCallback(() => {
    if (!publicUrl) return
    const backendBase = 'http://127.0.0.1:3000'
    window.open(`${backendBase}${publicUrl}`, '_blank', 'noopener,noreferrer')
  }, [publicUrl])

  const openSigned = useCallback(() => {
    if (!signedUrl) return
    window.open(signedUrl, '_blank', 'noopener,noreferrer')
  }, [signedUrl])

  const onPickClick = useCallback(() => {
    inputRef.current?.click()
  }, [])

  const onFileChange = useCallback((e) => {
    const selected = e.target.files?.[0] || null
    setFile(selected)
    setStatus(selected ? `Ready to upload ${selected.name}` : '')
    if (signedUrl) {
      URL.revokeObjectURL(signedUrl)
      setSignedUrl('')
    }
  }, [signedUrl])

  const onDragOver = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const onDragLeave = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const onDrop = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    const dropped = e.dataTransfer.files?.[0]
    if (dropped) {
      setFile(dropped)
      setStatus(`Ready to upload ${dropped.name}`)
      if (signedUrl) {
        URL.revokeObjectURL(signedUrl)
        setSignedUrl('')
      }
    }
  }, [signedUrl])

  const uploadToPublic = useCallback(async () => {
    if (!file) return
    setIsUploading(true)
    setStatus('Uploading to public...')
    setPublicUrl('')
    try {
      const formData = new FormData()
      formData.append('document', file)
      const res = await fetch('/api/docs/upload-public', { method: 'POST', body: formData })
      if (!res.ok) throw new Error('Public upload failed')
      const data = await res.json()
      setPublicUrl(data.url)
      setStatus('Uploaded to public directory')
    } catch (e) {
      setStatus('Error uploading to public')
    } finally {
      setIsUploading(false)
    }
  }, [file])

  const signDirect = useCallback(async () => {
    if (!file || !signerName.trim()) return
    setIsDirectSigning(true)
    setStatus('Signing (direct)...')
    if (signedUrl) {
      URL.revokeObjectURL(signedUrl)
      setSignedUrl('')
    }
    try {
      const formData = new FormData()
      formData.append('document', file)
      formData.append('signerName', signerName.trim())
      const res = await fetch('/api/docs/sign-direct', { method: 'POST', body: formData })
      if (!res.ok) throw new Error('Direct sign failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      setSignedUrl(url)
      setStatus('Signed • Ready to download')
    } catch (e) {
      setStatus('Error signing (direct)')
    } finally {
      setIsDirectSigning(false)
    }
  }, [file, signerName, signedUrl])

  const signAll = useCallback(async () => {
    if (!file || signerQueue.length === 0) return
    setIsDirectSigning(true)
    setStatus('Signing all...')
    if (signedUrl) {
      URL.revokeObjectURL(signedUrl)
      setSignedUrl('')
    }
    try {
      const form = new FormData()
      const inputFile = file instanceof File ? file : new File([file], 'input.pdf', { type: 'application/pdf' })
      form.append('document', inputFile)
      form.append('signerNames', JSON.stringify(signerQueue))
      // Place labels at bottom-left with safe margins
      form.append('position', 'bottom-left')
      form.append('marginX', '16')
      form.append('marginY', '36')
      const res = await fetch('/api/docs/sign-direct-multi', { method: 'POST', body: form })
      if (!res.ok) throw new Error('Multi-sign failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      setSignedUrl(url)
      setStatus('Signed by all • Ready to download')
    } catch (e) {
      setStatus('Error during multi-sign')
    } finally {
      setIsDirectSigning(false)
    }
  }, [file, signerQueue, signedUrl])

  const downloadSigned = useCallback(() => {
    if (!signedUrl || !file) return
    const a = document.createElement('a')
    a.href = signedUrl
    const name = file.name.replace(/\.pdf$/i, '')
    a.download = `${name}.signed.pdf`
    document.body.appendChild(a)
    a.click()
    a.remove()
  }, [signedUrl, file])

  const useSignedAsInput = useCallback(async () => {
    if (!signedUrl) return
    const resp = await fetch(signedUrl)
    const blob = await resp.blob()
    const newName = (file?.name || 'document').replace(/\.pdf$/i, '') + '.signed.pdf'
    const nextFile = new File([blob], newName, { type: 'application/pdf' })
    setFile(nextFile)
    setStatus('Using signed PDF as new input')
  }, [signedUrl, file])

  const addSigner = useCallback(() => {
    const n = signerName.trim()
    if (!n) return
    setSignerQueue((prev) => [...prev, n])
    setSignerName('')
  }, [signerName])

  const removeSigner = useCallback((idx) => {
    setSignerQueue((prev) => prev.filter((_, i) => i !== idx))
  }, [])

  const resetAll = useCallback(() => {
    setFile(null)
    setStatus('')
    setPublicUrl('')
    setSignerName('')
    setSignerQueue([])
    if (signedUrl) {
      URL.revokeObjectURL(signedUrl)
      setSignedUrl('')
    }
    if (inputRef.current) inputRef.current.value = ''
  }, [signedUrl])

  return (
    <div className="min-h-screen bg-[#0b1020] text-white selection:bg-indigo-600/40">
      <div className="absolute inset-0 -z-10 opacity-30 [background:radial-gradient(1000px_600px_at_30%_-10%,#4f46e5_0%,transparent_70%),radial-gradient(800px_400px_at_90%_10%,#9333ea_0%,transparent_70%)]" />

      <header className="border-b border-white/10 backdrop-blur sticky top-0 z-10 bg-[#0b1020]/60">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-fuchsia-500" />
            <h1 className="text-lg font-semibold tracking-tight">Signature Studio</h1>
          </div>
          <nav className="text-sm text-white/70">Dark · Responsive</nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <section className="lg:col-span-2">
            <div
              className={[
                'rounded-2xl border border-white/10 p-6 md:p-8 bg-white/5 backdrop-blur transition-all',
                isDragging ? 'ring-2 ring-indigo-400/60 scale-[1.01]' : 'hover;border-white/20'
              ].join(' ')}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
            >
              <div className="flex flex-col items-center justify-center text-center gap-4">
                <div className="h-16 w-16 rounded-xl bg-indigo-500/20 grid place-items-center">
                  <div className="h-8 w-8 rounded-md bg-indigo-500" />
                </div>
                <div>
                  <h2 className="text-xl md:text-2xl font-semibold">Upload your PDF</h2>
                  <p className="text-white/70 mt-1">Drag & drop a file here, or choose from your device.</p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <button
                    onClick={onPickClick}
                    className="px-4 py-2 rounded-lg !bg-indigo-600 hover:!bg-indigo-500 active:!bg-indigo-700 transition-colors"
                  >
                    Choose file
                  </button>
                  <button
                    onClick={uploadToPublic}
                    disabled={!canUpload}
                    className={`px-4 py-2 rounded-lg transition-colors ${canUpload ? '!bg-emerald-600 hover:!bg-emerald-500 active:!bg-emerald-700' : '!bg-emerald-900/40 text-white/50 cursor-not-allowed'}`}
                  >
                    {isUploading ? 'Uploading…' : 'Upload (Public)'}
                  </button>
                  <button
                    onClick={resetAll}
                    className="px-4 py-2 rounded-lg !bg-white/10 hover:!bg-white/15"
                  >
                    Reset
                  </button>
                </div>
                <input ref={inputRef} type="file" accept="application/pdf" className="hidden" onChange={onFileChange} />

                {file && (
                  <div className="w-full mt-4 rounded-xl border border-white/10 bg-black/20 p-4 text-left animate-fade-in">
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{file.name}</p>
                        <p className="text-sm text-white/60">{formatBytes(file.size)}</p>
                      </div>
                      <span className="shrink-0 text-xs rounded-full bg-white/10 px-2 py-1">PDF</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>

          <aside className="space-y-6">
            <div className="rounded-2xl border border-white/10 p-6 bg-white/5 backdrop-blur">
              <h3 className="font-semibold text-lg">Signature details</h3>
              <div className="mt-3 grid gap-3">
                <div className="flex items-center gap-3">
                  <label className="w-32 text-sm text-white/70">Signer name</label>
                  <input value={signerName} onChange={(e) => setSignerName(e.target.value)} className="flex-1 rounded-lg bg-black/30 border border-white/10 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500/50" placeholder="e.g. John Doe" />
                  <button
                    onClick={addSigner}
                    className="px-3 py-2 rounded-lg !bg-indigo-600 hover:!bg-indigo-500"
                  >
                    Add
                  </button>
                  <button
                    onClick={signAll}
                    disabled={!canSignAll}
                    className={`px-4 py-2 rounded-lg transition-colors ${canSignAll ? '!bg-amber-600 hover:!bg-amber-500 active:!bg-amber-700' : '!bg-amber-900/40 text-white/50 cursor-not-allowed'}`}
                  >
                    Sign All
                  </button>
                  <button
                    onClick={downloadSigned}
                    disabled={!canDownload}
                    className={`px-4 py-2 rounded-lg transition-colors ${canDownload ? '!bg-sky-600 hover:!bg-sky-500 active:!bg-sky-700' : '!bg-sky-900/40 text-white/50 cursor-not-allowed'}`}
                  >
                    Download
                  </button>
                </div>
                {signerQueue.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {signerQueue.map((n, idx) => (
                      <span key={`${n}-${idx}`} className="inline-flex items-center gap-2 px-2 py-1 rounded-full bg-white/10 text-sm">
                        {n}
                        <button onClick={() => removeSigner(idx)} className="text-white/70 hover:text-white !bg-gray-700 !rounded-full !px-3">×</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 p-6 bg-white/5 backdrop-blur">
              <h3 className="font-semibold text-lg">Status</h3>
              <p className="text-white/80 mt-2">{status || 'Idle'}</p>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={openUploaded}
                  disabled={!publicUrl}
                  className={`text-left !bg-gray-800 rounded-xl border p-4 transition-colors ${publicUrl ? 'border-white/20 hover:bg-white/10' : 'border-white/10 text-white/50 cursor-not-allowed'}`}
                >
                  <div className="font-semibold">Uploaded PDF</div>
                  <div className="text-sm break-all mt-1">{publicUrl || 'Not available'}</div>
                </button>
                <button
                  onClick={openSigned}
                  disabled={!signedUrl}
                  className={`text-left !bg-gray-800 rounded-xl border p-4 transition-colors ${signedUrl ? 'bg-gray-800 border-white/20 hover:!bg-white/10' : 'bg-gray-800 border-white/10 text-white/50 cursor-not-allowed'}`}
                >
                  <div className="font-semibold">Signed PDF</div>
                  <div className="text-sm break-all mt-1">{signedUrl ? 'Ready to preview' : 'Not available'}</div>
                </button>
              </div>
            </div>
          </aside>
        </div>
      </main>

      <footer className="max-w-5xl mx-auto px-4 py-8 text-sm text-white/60">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          <span>© {new Date().getFullYear()} Signature Studio</span>
          <span className="text-white/50">Built with React + Tailwind</span>
        </div>
      </footer>
    </div>
  )
}

export default App
