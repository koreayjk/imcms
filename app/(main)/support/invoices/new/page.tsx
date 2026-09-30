import { redirect } from 'next/navigation'
import { getCmsContext } from '@/lib/cms'
import InvoiceForm from '@/components/cms/InvoiceForm'

export default async function NewInvoicePage() {
  const { supabase, isSuper } = await getCmsContext()
  if (!isSuper) redirect('/support/invoices')
  const { data: outlets } = await supabase.from('outlets').select('id, name').order('created_at')
  return (
    <div className="mx-auto max-w-[900px] px-8 py-10">
      <h1 className="mb-6 text-[22px] font-extrabold tracking-tight">청구서 발행</h1>
      <InvoiceForm outlets={outlets ?? []} />
    </div>
  )
}
