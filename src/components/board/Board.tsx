import { CalendarDays, MessageSquare, Plus } from "lucide-react";
import { useMemo, useState, type DragEvent, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { TASK_STATUSES, type MemberDto, type TaskDto, type TaskStatus } from "@/lib/api";
import { formatDue, statusLabel, todayISO } from "@/lib/format";
import { useMoveTask } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { StatusDot, PriorityBadge, UserAvatar } from "@/components/app/bits";

interface Props {
  ws: string;
  projectId: string;
  tasks: TaskDto[];
  members: MemberDto[];
  onOpen: (t: TaskDto) => void;
  onCreate: (s: TaskStatus) => void;
}

export function Board({ ws, projectId, tasks, members, onOpen, onCreate }: Props) {
  const move = useMoveTask(ws, projectId);
  const [dragOver, setDragOver] = useState<TaskStatus | null>(null);
  const [announce, setAnnounce] = useState("");
  const byId = useMemo(() => new Map(members.map((m) => [m.userId, m])), [members]);
  const today = todayISO();

  const columns = TASK_STATUSES.map((s) => ({ status: s, items: tasks.filter((t) => t.status === s).sort((a, b) => a.position - b.position) }));

  const moveTo = (t: TaskDto, status: TaskStatus) => {
    if (t.status === status) return;
    const position = Math.max(-1, ...tasks.filter((x) => x.status === status).map((x) => x.position)) + 1;
    move.mutate({ id: t.id, status, position });
    setAnnounce(`${t.key} moved to ${statusLabel[status]}`);
  };

  const onKey = (e: KeyboardEvent, t: TaskDto) => {
    const i = TASK_STATUSES.indexOf(t.status);
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(t); }
    else if (e.shiftKey && e.key === "ArrowRight" && i < 3) { e.preventDefault(); moveTo(t, TASK_STATUSES[i + 1]!); }
    else if (e.shiftKey && e.key === "ArrowLeft" && i > 0) { e.preventDefault(); moveTo(t, TASK_STATUSES[i - 1]!); }
  };

  const drop = (e: DragEvent, status: TaskStatus) => {
    e.preventDefault();
    setDragOver(null);
    const t = tasks.find((x) => x.id === e.dataTransfer.getData("text/task-id"));
    if (t) moveTo(t, status);
  };

  return (
    <>
      <p className="sr-only" aria-live="polite">{announce}</p>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {columns.map(({ status, items }) => (
          <section
            key={status}
            aria-labelledby={`col-${status}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(status); }}
            onDragLeave={() => setDragOver((s) => (s === status ? null : s))}
            onDrop={(e) => drop(e, status)}
            className={cn("flex min-h-48 flex-col rounded-lg bg-column p-3 transition-shadow", dragOver === status && "ring-2 ring-primary/50")}
          >
            <header className="mb-3 flex items-center gap-2 px-1">
              <StatusDot status={status} />
              <h2 id={`col-${status}`} className="text-sm font-semibold">{statusLabel[status]}</h2>
              <span className="text-xs text-muted-foreground">{items.length}</span>
              <Button variant="ghost" size="icon" className="ml-auto size-7" onClick={() => onCreate(status)} aria-label={`Add task to ${statusLabel[status]}`}>
                <Plus className="size-4" />
              </Button>
            </header>
            <ul className="flex flex-1 flex-col gap-2" aria-label={`${statusLabel[status]} tasks`}>
              {items.map((t) => {
                const a = t.assigneeId ? byId.get(t.assigneeId) : undefined;
                const overdue = t.dueDate && t.dueDate < today && t.status !== "DONE";
                return (
                  <li key={t.id}>
                    <div
                      role="button"
                      tabIndex={0}
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData("text/task-id", t.id)}
                      onClick={() => onOpen(t)}
                      onKeyDown={(e) => onKey(e, t)}
                      aria-label={`${t.key}: ${t.title}. ${statusLabel[t.status]}. Press Enter to edit, Shift+Arrow keys to move.`}
                      className="group cursor-pointer rounded-md border bg-card p-3 shadow-xs outline-none transition hover:border-primary/40 hover:shadow-sm focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <div className="mb-1.5 flex items-center justify-between gap-2">
                        <span className="font-mono text-[11px] text-muted-foreground">{t.key}</span>
                        <PriorityBadge priority={t.priority} />
                      </div>
                      <p className={cn("text-sm font-medium leading-snug", t.status === "DONE" && "text-muted-foreground line-through decoration-muted-foreground/40")}>{t.title}</p>
                      <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                        {t.dueDate && (
                          <span className={cn("inline-flex items-center gap-1", overdue && "font-medium text-destructive")}>
                            <CalendarDays className="size-3.5" aria-hidden />
                            {overdue ? "Overdue · " : ""}{formatDue(t.dueDate)}
                          </span>
                        )}
                        {t.commentCount > 0 && (
                          <span className="inline-flex items-center gap-1" aria-label={`${t.commentCount} comments`}>
                            <MessageSquare className="size-3.5" aria-hidden /> {t.commentCount}
                          </span>
                        )}
                        <span className="ml-auto">
                          {a ? <span title={a.name}><UserAvatar name={a.name} id={a.userId} size="sm" /></span> : <span className="text-[11px]">Unassigned</span>}
                        </span>
                      </div>
                    </div>
                  </li>
                );
              })}
              {items.length === 0 && (
                <li className="flex flex-1 items-center justify-center rounded-md border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
                  Drop tasks here
                </li>
              )}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
