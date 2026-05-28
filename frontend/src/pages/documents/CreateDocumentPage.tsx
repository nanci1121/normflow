import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Save } from 'lucide-react'
import { createDocument } from '@/api/documents'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Select } from '@/components/ui/Select'
import { Card } from '@/components/ui/Card'
import { useAuth } from '@/contexts/AuthContext'

const CATEGORIES = [
  'Manual de calidad',
  'Procedimiento',
  'Instrucción de trabajo',
  'Registro',
  'Política',
  'Plan',
  'Informe',
] as const

export function CreateDocumentPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()

  const [code, setCode] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [content, setContent] = useState('')
  const [tagsInput, setTagsInput] = useState('')
  const [visibility, setVisibility] = useState<'internal' | 'restricted'>('internal')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const mutation = useMutation({
    mutationFn: () =>
      createDocument({
        code,
        title,
        description,
        category,
        standardTags: tagsInput
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        ownerId: user!.id,
        visibility,
        content,
        createdBy: user!.id,
      }),
    onSuccess: (doc) => {
      queryClient.invalidateQueries({ queryKey: ['documents'] })
      navigate(`/documents/${doc.id}`)
    },
    onError: (err: Error) => {
      setErrors({ form: err.message })
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})

    const newErrors: Record<string, string> = {}
    if (!code.trim()) newErrors.code = 'El código es obligatorio'
    if (!title.trim()) newErrors.title = 'El título es obligatorio'
    if (!description.trim()) newErrors.description = 'La descripción es obligatoria'
    if (!category) newErrors.category = 'Selecciona una categoría'
    if (!content.trim()) newErrors.content = 'El contenido es obligatorio'

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    mutation.mutate()
  }

  return (
    <div className="page-transition mx-auto max-w-3xl p-4 sm:p-8">
      <div className="mb-8">
        <button
          onClick={() => navigate(-1)}
          className="mb-4 flex items-center gap-1 text-sm text-gray-500 transition-colors hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Nuevo documento</h1>
        <p className="mt-1 text-sm text-gray-500">
          Crea un nuevo documento en el sistema de gestión documental
        </p>
      </div>

      {errors.form && (
        <div className="mb-6 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-200 text-xs font-bold text-red-700">!</span>
          {errors.form}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <h2 className="mb-4 text-sm font-semibold text-gray-900">Información general</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Código del documento"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              error={errors.code}
              placeholder="Ej: QA-MAN-001"
            />
            <Select
              label="Categoría"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              options={CATEGORIES.map((c) => ({ value: c, label: c }))}
              placeholder="Seleccionar categoría"
              error={errors.category}
            />
          </div>
          <div className="mt-4">
            <Input
              label="Título"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              error={errors.title}
              placeholder="Título descriptivo del documento"
            />
          </div>
          <div className="mt-4">
            <Textarea
              label="Descripción"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              error={errors.description}
              placeholder="Breve descripción del propósito del documento"
              rows={2}
            />
          </div>
          <div className="mt-4">
            <Input
              label="Tags (separados por coma)"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="Ej: calidad, iso-9001, procedimiento"
            />
          </div>
          <div className="mt-4">
            <Select
              label="Visibilidad"
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as 'internal' | 'restricted')}
              options={[
                { value: 'internal', label: 'Interno — visible para todos' },
                { value: 'restricted', label: 'Restringido — solo owner y admin' },
              ]}
            />
          </div>
        </Card>

        <Card>
          <h2 className="mb-4 text-sm font-semibold text-gray-900">Contenido (versión inicial)</h2>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            error={errors.content}
            placeholder="Escribe aquí el contenido del documento..."
            rows={12}
          />
        </Card>

        <div className="flex items-center justify-end gap-3">
          <Button type="button" variant="ghost" onClick={() => navigate(-1)}>
            Cancelar
          </Button>
          <Button type="submit" isLoading={mutation.isPending}>
            <Save className="h-4 w-4" />
            Crear documento
          </Button>
        </div>
      </form>
    </div>
  )
}
