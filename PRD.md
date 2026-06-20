# PRD — ToDo Organize (Family Task & Calendar PWA)

## Objetivo

PWA mobile-first para gestão de tarefas e agenda familiar compartilhada. Simples de usar e preencher, com acesso rápido para todos os membros adultos da família.

---

## Usuários e Grupos Familiares

- **Somente adultos** — login via Google (social auth Gmail)
- **Grupo familiar:** identificado por um ID único — o primeiro membro cria o grupo e compartilha o link/código; os demais entram usando esse código
- Não há perfis infantis neste sistema

---

## Visibilidade de itens

Toda tarefa e todo evento tem um campo de **visibilidade**, definido na criação:

| Visibilidade | Quem vê |
|---|---|
| **Público** | Todos os membros do grupo familiar |
| **Privado** | Apenas quem criou |

---

## Módulo 1 — To-Do

### Campos de uma tarefa

| Campo | Obrigatoriedade |
|---|---|
| **Atividade** (título + descrição) | Obrigatório |
| **Visibilidade** (público / privado) | Obrigatório |
| **Categoria** | Obrigatório |
| **Prioridade** (alta / média / baixa) | Obrigatório |
| **Status** | Obrigatório (padrão: *To Do*) |
| **Responsáveis** (1 ou mais membros) | Condicional — veja regra abaixo |
| **Data limite** | Condicional — veja regra abaixo |
| **Checklist** (subtarefas com responsável próprio) | Opcional |

### Regras de status

| Status | Pré-requisitos |
|---|---|
| **To Do** | Nenhum extra |
| **In Progress** | Exige data limite + pelo menos 1 responsável |
| **On Hold** | Nenhum extra (data não obrigatória) |
| **Done** | Exige data limite + pelo menos 1 responsável |

### Responsáveis e subtarefas

- Uma tarefa pode ter **múltiplos responsáveis**
- Cada item do checklist pode ter seu próprio responsável (membro do grupo)
- Qualquer membro pode editar qualquer campo de qualquer tarefa

### Histórico de alterações de data

- Toda alteração no campo "data limite" gera um registro: data anterior → data nova + quem alterou + quando
- No front: ícone discreto ao lado do campo de data → clique abre popup/drawer com o histórico

### Categorias

Pré-definidas: **Casa, Filho, Casal, Compras, Saúde, Exercícios, Estudos, Alimentação**

Regras:
- Qualquer membro pode criar novas categorias
- Pode renomear uma categoria existente
- **Não pode excluir** categoria que esteja em uso por alguma tarefa
- Pode mesclar (mover tarefas de uma categoria para outra antes de excluir)

### Estados de uma tarefa

```
[To Do] ──── data + responsável ────▶ [In Progress] ──▶ [Done]
   │                                        │
   └──────────────────────────────────▶ [On Hold]
                                            │
                                       [Histórico]  ◀── Done
```

- Tarefas **sem data + responsável** ficam apenas no backlog
- Tarefas **com data + responsável** aparecem também no calendário
- Tarefas **Done** vão para aba Histórico

---

## Módulo 2 — Calendário

### Fontes de entradas

1. Tarefas com data + responsável (oriundas do To-Do)
2. Eventos criados diretamente no calendário

### Campos de um evento

| Campo | Obrigatoriedade |
|---|---|
| **Atividade** (título + descrição) | Obrigatório |
| **Visibilidade** (público / privado) | Obrigatório |
| **Data** | Obrigatório |
| **Horário de início** | Obrigatório |
| **Horário de fim** | Obrigatório |
| **Participantes** (membros do grupo) | Opcional |
| **Repetição** (diária / semanal / mensal / anual) | Opcional |
| **Lembrete** (X min/horas antes) | Opcional |

> Eventos ocorrem dentro de um único dia — não há suporte a eventos multidia no MVP.

### Visualizações

Mês · Semana · Dia · Agenda — usuário alterna livremente

---

## Navegação (Bottom Nav)

`[To-do]` · `[Calendário]` · `[Perfil]`

---

## Modelo de dados

```
family_groups           — id, name, invite_code, created_by, created_at
profiles                — id, user_id, family_group_id, name, avatar_url, created_at
categories              — id, family_group_id, name, color, created_at
tasks                   — id, family_group_id, creator_id, title, description,
                          visibility, category_id, priority, status, due_date, created_at
task_assignees          — task_id, profile_id
task_checklist_items    — id, task_id, text, checked, assignee_id
task_date_history       — id, task_id, changed_by, old_date, new_date, changed_at
calendar_events         — id, family_group_id, creator_id, title, description,
                          visibility, date, start_time, end_time, recurrence,
                          reminder_minutes, created_at
event_participants      — event_id, profile_id
```

---

## Stack Técnica

- **Framework:** Next.js 14
- **Backend / Auth:** Supabase (projeto separado do MyBiblio)
- **Auth social:** Google OAuth via Supabase Auth
- **Padrão de código:** Server page → Client component
- **UI:** Tailwind CSS, mobile-first, bottom nav

---

## Roadmap

| Fase | Escopo |
|---|---|
| **MVP** | Auth Google, grupos familiares, to-do completo, calendário, push notifications |
| **V2** | Google Calendar sync, analytics, filtros avançados |
| **V3** | App nativo (Capacitor/Expo), Apple Calendar |

---

## Fora do MVP

- Perfis infantis
- Comentários em tarefas
- Exportação / importação
- Integração com Google Calendar / Apple Calendar
- Analytics / estatísticas
