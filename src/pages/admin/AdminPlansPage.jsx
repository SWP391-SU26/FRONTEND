import {
  Check, Crown, Edit3, Layers3, Loader2, Plus, RefreshCw, Trash2, X,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { ConfirmModal } from '../../components/ui.jsx'
import { AdminPageHeader } from '../../layouts/AdminLayout.jsx'
import {
  createAdminPlan, deleteAdminPlan, getAdminPlans, updateAdminPlan,
} from '../../services/paymentService.js'

const emptyForm = {
  planCode: '', displayName: '', priceVnd: '0', durationDays: '', maxFileMb: '10',
  maxDocuments: '10', maxStorageMb: '100', maxPersonalWorkspaces: '1', benefitsText: '', isActive: true,
}

export default function AdminPlansPage() {
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [editor, setEditor] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setPlans(await getAdminPlans())
    } catch (requestError) {
      setError(requestError.message || 'Could not load subscription plans.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(load, 0)
    return () => window.clearTimeout(timer)
  }, [load])

  function openCreate() {
    setEditor({ mode: 'create', planId: '', form: { ...emptyForm }, error: '' })
  }

  function openEdit(plan) {
    setEditor({ mode: 'edit', planId: plan.planId, form: toForm(plan), error: '' })
  }

  function updateField(name, value) {
    setEditor((current) => ({ ...current, error: '', form: { ...current.form, [name]: value } }))
  }

  async function save(event) {
    event.preventDefault()
    const validation = validate(editor.form)
    if (validation) {
      setEditor((current) => ({ ...current, error: validation }))
      return
    }
    setBusy(true)
    try {
      const payload = toPayload(editor.form)
      if (editor.mode === 'create') await createAdminPlan(payload)
      else await updateAdminPlan(editor.planId, payload)
      setNotice(editor.mode === 'create' ? 'Plan created.' : 'Plan updated.')
      setEditor(null)
      await load()
    } catch (requestError) {
      setEditor((current) => ({ ...current, error: requestError.message || 'Could not save this plan.' }))
    } finally {
      setBusy(false)
    }
  }

  async function confirmDelete() {
    if (!deleting) return
    setBusy(true)
    try {
      const result = await deleteAdminPlan(deleting.planId)
      setNotice(result.message || (result.deactivated ? 'Plan deactivated.' : 'Plan deleted.'))
      setDeleting(null)
      await load()
    } catch (requestError) {
      setError(requestError.message || 'Could not delete this plan.')
      setDeleting(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <AdminPageHeader
        actions={<><button className="flex h-10 items-center gap-2 rounded-xl border border-border bg-white px-4 text-sm font-black text-slate-700 hover:bg-teal-50" onClick={load} type="button"><RefreshCw size={16} />Refresh</button><button className="flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-black text-white hover:bg-teal-800" onClick={openCreate} type="button"><Plus size={16} />New plan</button></>}
        description="Create pricing tiers, edit quotas, and deactivate plans without breaking historical payments."
        icon={Layers3}
        title="Subscription plans"
      />

      {notice ? <div className="mb-4 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800"><span className="flex items-center gap-2"><Check size={16} />{notice}</span><button aria-label="Dismiss notice" onClick={() => setNotice('')} type="button"><X size={16} /></button></div> : null}
      {error ? <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div> : null}

      <section className="notebook-panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] border-collapse text-left text-sm">
            <thead className="bg-slate-50 text-xs font-black uppercase tracking-wide text-slate-500">
              <tr><th className="px-4 py-3">Plan</th><th className="px-4 py-3">Price / duration</th><th className="px-4 py-3">Per file</th><th className="px-4 py-3">Storage</th><th className="px-4 py-3">Workspaces</th><th className="px-4 py-3">Status</th><th className="w-28 px-3 py-3"><span className="sr-only">Actions</span></th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {loading ? <tr><td className="px-4 py-16 text-center font-bold text-slate-500" colSpan="7"><Loader2 className="mr-2 inline animate-spin" size={17} />Loading plans...</td></tr> : null}
              {!loading && !plans.length ? <tr><td className="px-4 py-16 text-center font-bold text-slate-500" colSpan="7">No plans configured.</td></tr> : null}
              {!loading && plans.map((plan) => (
                <tr className="hover:bg-slate-50" key={plan.planId}>
                  <td className="px-4 py-4"><div className="flex items-center gap-3"><span className={`grid size-9 place-items-center rounded-xl ${plan.priceVnd > 0 ? 'bg-teal-50 text-teal-700' : 'bg-slate-100 text-slate-500'}`}><Crown size={17} /></span><div><p className="font-black text-slate-900">{plan.displayName}</p><p className="text-xs font-bold text-slate-400">{plan.planCode}</p></div></div></td>
                  <td className="px-4 py-4"><p className="font-black text-slate-900">{formatVnd(plan.priceVnd)}</p><p className="text-xs font-semibold text-slate-500">{plan.durationDays ? `${plan.durationDays} days` : 'No expiry'}</p></td>
                  <td className="px-4 py-4 font-bold text-slate-700">{formatMb(plan.maxFileBytes)}</td>
                  <td className="px-4 py-4 font-bold text-slate-700">{formatMb(plan.maxStorageBytes)}</td>
                  <td className="px-4 py-4 font-bold text-slate-700">{plan.maxPersonalWorkspaces}</td>
                  <td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-black ${plan.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{plan.isActive ? 'ACTIVE' : 'INACTIVE'}</span></td>
                  <td className="px-3 py-4"><div className="flex gap-1"><button aria-label={`Edit ${plan.planCode}`} className="grid size-9 place-items-center rounded-lg text-slate-500 hover:bg-teal-50 hover:text-teal-700" onClick={() => openEdit(plan)} type="button"><Edit3 size={16} /></button><button aria-label={`Delete ${plan.planCode}`} className="grid size-9 place-items-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30" disabled={plan.planCode === 'FREE'} onClick={() => setDeleting(plan)} type="button"><Trash2 size={16} /></button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {editor ? <PlanEditor busy={busy} editor={editor} onClose={() => !busy && setEditor(null)} onSave={save} onUpdate={updateField} /> : null}
      {deleting ? <ConfirmModal actionLabel="Delete plan" busy={busy} onCancel={() => setDeleting(null)} onConfirm={confirmDelete} title={`Delete ${deleting.planCode}?`}>If this plan is referenced by payments or subscriptions, it will be deactivated instead of physically deleted.</ConfirmModal> : null}
    </>
  )
}

function PlanEditor({ busy, editor, onClose, onSave, onUpdate }) {
  const form = editor.form
  const isFree = form.planCode === 'FREE'
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/40" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <form className="h-full w-full max-w-2xl overflow-y-auto bg-white p-6 shadow-2xl sm:p-8" onSubmit={onSave}>
        <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-teal-700">Plan configuration</p><h2 className="mt-2 text-2xl font-black text-slate-950">{editor.mode === 'create' ? 'Create plan' : `Edit ${form.planCode}`}</h2></div><button aria-label="Close editor" className="grid size-10 place-items-center rounded-xl hover:bg-slate-100" disabled={busy} onClick={onClose} type="button"><X size={19} /></button></div>
        {editor.error ? <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{editor.error}</div> : null}

        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <Field label="Plan code"><input className="control uppercase" disabled={editor.mode === 'edit'} maxLength="20" onChange={(event) => onUpdate('planCode', event.target.value.toUpperCase())} required value={form.planCode} /></Field>
          <Field label="Display name"><input className="control" maxLength="100" onChange={(event) => onUpdate('displayName', event.target.value)} required value={form.displayName} /></Field>
          <Field hint="VND" label="Price"><input className="control" disabled={isFree} min="0" onChange={(event) => onUpdate('priceVnd', event.target.value)} required step="1000" type="number" value={form.priceVnd} /></Field>
          <Field hint="Leave blank only for a free plan" label="Duration (days)"><input className="control" disabled={isFree} min="1" onChange={(event) => onUpdate('durationDays', event.target.value)} type="number" value={form.durationDays} /></Field>
          <Field hint="MB" label="Maximum file size"><input className="control" min="1" onChange={(event) => onUpdate('maxFileMb', event.target.value)} required type="number" value={form.maxFileMb} /></Field>
          <Field hint="MB" label="Total storage"><input className="control" min="1" onChange={(event) => onUpdate('maxStorageMb', event.target.value)} required type="number" value={form.maxStorageMb} /></Field>
          <Field label="Personal workspaces"><input className="control" min="1" onChange={(event) => onUpdate('maxPersonalWorkspaces', event.target.value)} required type="number" value={form.maxPersonalWorkspaces} /></Field>
        </div>

        <Field className="mt-5" hint="One benefit per line" label="Benefits"><textarea className="control min-h-32 resize-y" onChange={(event) => onUpdate('benefitsText', event.target.value)} value={form.benefitsText} /></Field>
        <label className="mt-5 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4"><input checked={form.isActive} className="size-4 accent-teal-700" disabled={isFree} onChange={(event) => onUpdate('isActive', event.target.checked)} type="checkbox" /><span><strong className="block text-sm text-slate-900">Active plan</strong><span className="text-xs font-semibold text-slate-500">Inactive plans remain in history but cannot be purchased.</span></span></label>

        <div className="mt-8 flex justify-end gap-3"><button className="h-11 rounded-xl border border-slate-200 px-5 text-sm font-black text-slate-700" disabled={busy} onClick={onClose} type="button">Cancel</button><button className="flex h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-black text-white disabled:opacity-60" disabled={busy} type="submit">{busy ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}{editor.mode === 'create' ? 'Create plan' : 'Save changes'}</button></div>
      </form>
    </div>
  )
}

function Field({ children, className = '', hint, label }) { return <label className={`block text-sm font-black text-slate-700 ${className}`}><span className="flex items-center justify-between gap-3"><span>{label}</span>{hint ? <span className="text-[11px] font-semibold text-slate-400">{hint}</span> : null}</span><span className="mt-2 block">{children}</span></label> }
function toForm(plan) { return { planCode: plan.planCode, displayName: plan.displayName, priceVnd: String(plan.priceVnd), durationDays: plan.durationDays ? String(plan.durationDays) : '', maxFileMb: String(bytesToMb(plan.maxFileBytes)), maxDocuments: String(plan.maxDocuments), maxStorageMb: String(bytesToMb(plan.maxStorageBytes)), maxPersonalWorkspaces: String(plan.maxPersonalWorkspaces), benefitsText: (plan.benefits || []).join('\n'), isActive: Boolean(plan.isActive) } }
function toPayload(form) { return { planCode: form.planCode.trim().toUpperCase(), displayName: form.displayName.trim(), priceVnd: Number(form.priceVnd), durationDays: form.durationDays ? Number(form.durationDays) : null, maxFileBytes: Math.round(Number(form.maxFileMb) * 1024 * 1024), maxDocuments: Number(form.maxDocuments), maxStorageBytes: Math.round(Number(form.maxStorageMb) * 1024 * 1024), maxPersonalWorkspaces: Number(form.maxPersonalWorkspaces), benefits: form.benefitsText.split(/\r?\n/).map((item) => item.trim()).filter(Boolean), isActive: form.isActive } }
function validate(form) { if (!/^[A-Z0-9_-]{2,20}$/.test(form.planCode.trim())) return 'Plan code must contain 2–20 letters, numbers, underscores, or hyphens.'; if (!form.displayName.trim()) return 'Display name is required.'; const price = Number(form.priceVnd); const duration = Number(form.durationDays); if (!Number.isFinite(price) || price < 0) return 'Price must be zero or greater.'; if (price > 0 && (!Number.isInteger(duration) || duration < 1)) return 'Paid plans require a positive duration.'; if (price === 0 && form.durationDays) return 'Free plans must not expire.'; const fileMb = Number(form.maxFileMb); const storageMb = Number(form.maxStorageMb); if (fileMb <= 0 || storageMb < fileMb) return 'Storage must be at least as large as the per-file limit.'; if (Number(form.maxPersonalWorkspaces) < 1) return 'Workspace limits must be positive.'; return '' }
function bytesToMb(value) { return Math.round(Number(value || 0) / 1024 / 1024) }
function formatMb(value) { return `${bytesToMb(value)} MB` }
function formatVnd(value) { return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(Number(value || 0)) }
