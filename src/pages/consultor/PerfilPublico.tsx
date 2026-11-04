import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ExternalLink, Loader2, MapPin, Upload } from 'lucide-react'
import { supabase, mensagemErro } from '@/lib/supabase'
import { usePerfil } from '@/auth/AuthProvider'
import { useConsultores } from '@/data/queries'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/form'
import { HotBadge, TemperaturaBadge, TopBadge } from '@/components/ui/badges'
import { Avatar, Card } from '@/components/painel/comum'
import { Carregando, ErroBox, useToast } from '@/components/ui/feedback'
import { useMeuConsultor } from './dados'

const ESPECIALIDADES = ['PME', 'Famílias', 'Adesão', 'Obstetrícia', 'Seniores', 'MEI', 'Coparticipação', 'Motoristas', 'PF', 'Municipal', 'Comércio']

export function PerfilPublico() {
  const p = usePerfil()
  const qc = useQueryClient()
  const toast = useToast()
  const me = useMeuConsultor()
  const ranking = useConsultores()
  const arquivo = useRef<HTMLInputElement>(null)
  const [f, setF] = useState({ nome: '', cidade: '', bio: '', esp: [] as string[], foto: '', publicado: true })

  useEffect(() => {
    if (me.data)
      setF({
        nome: me.data.nome_exibicao,
        cidade: me.data.cidade ?? '',
        bio: me.data.bio ?? '',
        esp: me.data.especialidades ?? [],
        foto: me.data.foto_url ?? '',
        publicado: me.data.publicado,
      })
  }, [me.data])

  const salvar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('consultores')
        .update({ nome_exibicao: f.nome.trim(), cidade: f.cidade.trim(), bio: f.bio.trim(), especialidades: f.esp, foto_url: f.foto || null, publicado: f.publicado })
        .eq('id', p.id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['con', 'me'] })
      qc.invalidateQueries({ queryKey: ['consultores'] })
      toast(f.publicado ? 'Perfil salvo e publicado na vitrine.' : 'Perfil salvo (oculto da vitrine).')
    },
    onError: (e) => toast(mensagemErro(e), 'erro'),
  })

  const enviarFoto = useMutation({
    mutationFn: async (file: File) => {
      if (file.size > 3 * 1024 * 1024) throw new Error('A foto pode ter no máximo 3 MB.')
      const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
      const path = `${p.id}/foto-${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('avatars').upload(path, file, { contentType: file.type, upsert: true })
      if (error) throw error
      return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl
    },
    onSuccess: (url) => {
      setF((x) => ({ ...x, foto: url }))
      toast('Foto enviada. Clique em "Salvar e publicar" para aplicar.')
    },
    onError: (e) => toast(mensagemErro(e), 'erro'),
  })

  if (me.isLoading) return <Carregando />
  if (me.error) return <ErroBox erro={me.error} onRetry={() => me.refetch()} />
  const c = me.data!
  const eu = ranking.data?.find((x) => x.id === p.id)
  const vagas = Math.max(0, c.max_indicadores - c.ocupacao)
  const conv = c.leads_total ? Math.round((c.vendas * 100) / c.leads_total) : 0
  const valido = f.nome.trim().length >= 3 && f.cidade.trim().length >= 2

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="m-0 text-[26px] font-extrabold tracking-[-0.035em] sm:text-[28px]">Meu perfil público</h1>
        <Link to={`/consultores/${p.id}`} target="_blank" className="flex items-center gap-1.5 text-[13px] font-bold text-verde-700">
          Ver na vitrine <ExternalLink size={15} />
        </Link>
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(300px,1fr)]">
        <Card className="flex flex-col gap-[18px] rounded-[20px] p-6">
          <div className="flex items-center gap-4">
            <Avatar nome={f.nome || 'Consultor'} foto={f.foto} size={80} rounded="xl" />
            <div className="flex flex-col gap-1.5">
              <input ref={arquivo} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => e.target.files?.[0] && enviarFoto.mutate(e.target.files[0])} />
              <Button variant="outline" size="sm" className="h-[38px] text-[13px]" disabled={enviarFoto.isPending} onClick={() => arquivo.current?.click()}>
                {enviarFoto.isPending ? <Loader2 size={17} className="animate-spin" /> : <Upload size={17} />}
                Trocar foto
              </Button>
              <span className="text-[12px] text-ink-400">JPG, PNG ou WebP, até 3 MB, mínimo 400×400</span>
            </div>
          </div>
          <Field label="Nome de exibição" value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} maxLength={60} />
          <Field label="Cidade" value={f.cidade} onChange={(e) => setF({ ...f, cidade: e.target.value })} placeholder="Campinas, SP" maxLength={60} />
          <label className="flex flex-col gap-1.5 text-[13px] font-bold">
            <span className="flex justify-between">
              Bio curta<span className="font-semibold text-ink-400">{f.bio.length}/120</span>
            </span>
            <textarea
              value={f.bio}
              maxLength={120}
              rows={3}
              onChange={(e) => setF({ ...f, bio: e.target.value })}
              className="resize-y rounded-[12px] border border-ink-200 px-3.5 py-3 text-[15px] font-medium outline-none focus:border-verde-500 focus:ring-[3px] focus:ring-verde-500/20"
            />
          </label>
          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-bold">Especialidades</span>
            <div className="flex flex-wrap gap-1.5">
              {ESPECIALIDADES.map((e) => {
                const on = f.esp.includes(e)
                return (
                  <button
                    key={e}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setF({ ...f, esp: on ? f.esp.filter((x) => x !== e) : [...f.esp, e] })}
                    className={cn('cursor-pointer rounded-full border px-3 py-[7px] text-[13px] font-bold', on ? 'border-verde-600 bg-verde-50 text-verde-900' : 'border-ink-200 bg-white')}
                  >
                    {e}
                  </button>
                )
              })}
            </div>
          </div>
          <label className="flex cursor-pointer items-center gap-2.5 text-[14px] font-semibold">
            <input type="checkbox" checked={f.publicado} onChange={(e) => setF({ ...f, publicado: e.target.checked })} className="size-[18px] accent-verde-600" />
            Aparecer na vitrine pública de consultores
          </label>
          <Button variant="primary" size="md" className="self-start font-extrabold" disabled={!valido || salvar.isPending} onClick={() => salvar.mutate()}>
            {salvar.isPending && <Loader2 size={18} className="animate-spin" />}
            Salvar e publicar
          </Button>
        </Card>

        <div className="sticky top-6 flex flex-col gap-2.5">
          <span className="text-[12px] font-bold uppercase tracking-[.06em] text-ink-600">Prévia na vitrine</span>
          <div className={cn('flex flex-col gap-3.5 rounded-[20px] border border-ink-200 bg-white p-5 shadow-lg', !f.publicado && 'opacity-60')}>
            <div className="flex items-center gap-3.5">
              <div className="relative">
                <Avatar nome={f.nome || 'Consultor'} foto={f.foto} size={56} />
                {eu && <span className="absolute -bottom-1 -right-1.5 flex h-[22px] items-center rounded-full border-2 border-white bg-ink-950 px-1.5 text-[11px] font-extrabold text-white">#{eu.rank}</span>}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[16px] font-extrabold">{f.nome || 'Seu nome'}</div>
                <div className="flex items-center gap-1 text-[13px] text-ink-600">
                  <MapPin size={14} />
                  {f.cidade || 'Sua cidade'}
                </div>
              </div>
            </div>
            <div className="flex min-h-[22px] flex-wrap gap-1.5">
              <TemperaturaBadge valor={c.temperatura} />
              {eu?.hot && <HotBadge />}
              {eu?.top && <TopBadge />}
            </div>
            <p className="m-0 text-[14px] leading-[1.5] text-ink-600">{f.bio || 'Sua bio aparece aqui.'}</p>
            <div className="flex flex-wrap gap-1.5">
              {f.esp.map((t) => (
                <span key={t} className="rounded-lg border border-ink-200 bg-ink-50 px-2.5 py-1 text-[12px] font-semibold">
                  {t}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-[12px] bg-ink-50 px-3 py-2.5">
                <div className="text-[20px] font-extrabold">{conv}%</div>
                <div className="text-[12px] text-ink-600">conversão</div>
              </div>
              <div className="rounded-[12px] bg-ink-50 px-3 py-2.5">
                <div className="text-[20px] font-extrabold">{c.vendas}</div>
                <div className="text-[12px] text-ink-600">vendas</div>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between text-[12px] font-semibold">
                <span className="text-ink-600">Vagas</span>
                <span>
                  {c.ocupacao}/{c.max_indicadores} indicadores<span className="text-verde-700"> · {vagas ? `${vagas} vagas` : 'Lotado'}</span>
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-ink-100">
                <div className="h-full bg-verde-600" style={{ width: `${Math.round((c.ocupacao / c.max_indicadores) * 100)}%` }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
