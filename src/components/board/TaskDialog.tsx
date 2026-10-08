import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api, PRIORITIES, TASK_STATUSES, type MemberDto, type Priority, type TaskDto, type TaskStatus } from "@/lib/api";
import { formatDateTime, priorityLabel, statusLabel } from "@/lib/format";
import { canDeleteComment, canDeleteTask } from "@/lib/permissions";
import { commentsQuery, onError, qk } from "@/lib/queries";
import { useWorkspace } from "@/components/app/workspace-context";
import { UserAvatar } from "@/components/app/bits";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  projectId: string;
  task: TaskDto | null;
  defaultStatus: TaskStatus;
  members: MemberDto[];
}

export function TaskDialog({ open, onOpenChange, projectId, task, defaultStatus, members }: Props) {
  const { workspace, user } = useWorkspace();
  const ws = workspace.id;
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<TaskStatus>(defaultStatus);
  const [priority, setPriority] = useState<Priority>("MEDIUM");
  const [assigneeId, setAssigneeId] = useState<string>("none");
  const [dueDate, setDueDate] = useState("");
  const [titleError, setTitleError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle(task?.title ?? "");
    setDescription(task?.description ?? "");
    setStatus(task?.status ?? defaultStatus);
    setPriority(task?.priority ?? "MEDIUM");
    setAssigneeId(task?.assigneeId ?? "none");
    setDueDate(task?.dueDate ?? "");
    setTitleError(null);
  }, [open, task, defaultStatus]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: qk.tasks(ws, projectId) });
    qc.invalidateQueries({ queryKey: qk.projects(ws) });
  };

  const save = useMutation({
    mutationFn: () => {
      const body = { title, description, status, priority, assigneeId: assigneeId === "none" ? null : assigneeId, dueDate: dueDate || null };
      return task ? api.tasks.update(ws, task.id, body) : api.tasks.create(ws, projectId, body);
    },
    onSuccess: (t) => { invalidate(); toast.success(task ? `Updated ${t.key}` : `Created ${t.key}`); onOpenChange(false); },
    onError,
  });
  const remove = useMutation({
    mutationFn: () => api.tasks.remove(ws, task!.id),
    onSuccess: () => { invalidate(); toast.success("Task deleted"); onOpenChange(false); },
    onError,
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { setTitleError("Title is required"); return; }
    if (title.length > 200) { setTitleError("Keep the title under 200 characters"); return; }
    save.mutate();
  };

  const mayDelete = task && canDeleteTask(workspace.role, task.createdById === user.id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <form onSubmit={submit} noValidate>
          <DialogHeader>
            <DialogTitle>{task ? <><span className="font-mono text-sm text-muted-foreground">{task.key}</span> Edit task</> : "New task"}</DialogTitle>
            <DialogDescription>{task ? `Last updated ${formatDateTime(task.updatedAt)}` : "Add a task to this project's board."}</DialogDescription>
          </DialogHeader>
          <div className="my-5 grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="task-title">Title</Label>
              <Input id="task-title" value={title} onChange={(e) => setTitle(e.target.value)} aria-invalid={!!titleError} aria-describedby={titleError ? "task-title-err" : undefined} autoFocus />
              {titleError && <p id="task-title-err" className="text-xs text-destructive">{titleError}</p>}
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="task-desc">Description</Label>
              <Textarea id="task-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={5000} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="task-status">Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as TaskStatus)}>
                <SelectTrigger id="task-status"><SelectValue /></SelectTrigger>
                <SelectContent>{TASK_STATUSES.map((s) => <SelectItem key={s} value={s}>{statusLabel[s]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="task-priority">Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                <SelectTrigger id="task-priority"><SelectValue /></SelectTrigger>
                <SelectContent>{PRIORITIES.map((p) => <SelectItem key={p} value={p}>{priorityLabel[p]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="task-assignee">Assignee</Label>
              <Select value={assigneeId} onValueChange={setAssigneeId}>
                <SelectTrigger id="task-assignee"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned</SelectItem>
                  {members.map((m) => <SelectItem key={m.userId} value={m.userId}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="task-due">Due date</Label>
              <Input id="task-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            {mayDelete ? (
              <Button type="button" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => remove.mutate()} disabled={remove.isPending}>
                <Trash2 className="size-4" /> Delete
              </Button>
            ) : <span />}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving…" : task ? "Save changes" : "Create task"}</Button>
            </div>
          </DialogFooter>
        </form>
        {task && <Comments taskId={task.id} projectId={projectId} />}
      </DialogContent>
    </Dialog>
  );
}

function Comments({ taskId, projectId }: { taskId: string; projectId: string }) {
  const { workspace, user } = useWorkspace();
  const ws = workspace.id;
  const qc = useQueryClient();
  const comments = useQuery(commentsQuery(ws, taskId));
  const [body, setBody] = useState("");
  const refresh = () => {
    qc.invalidateQueries({ queryKey: qk.comments(ws, taskId) });
    qc.invalidateQueries({ queryKey: qk.tasks(ws, projectId) });
  };
  const add = useMutation({ mutationFn: () => api.comments.create(ws, taskId, { body }), onSuccess: () => { setBody(""); refresh(); }, onError });
  const del = useMutation({ mutationFn: (id: string) => api.comments.remove(ws, id), onSuccess: refresh, onError });

  return (
    <section aria-labelledby="comments-h" className="border-t pt-5">
      <h3 id="comments-h" className="mb-3 text-sm font-semibold">Comments</h3>
      {comments.isLoading && <p className="text-sm text-muted-foreground">Loading comments…</p>}
      {comments.isError && <p className="text-sm text-destructive">Couldn't load comments.</p>}
      {comments.data?.length === 0 && <p className="text-sm text-muted-foreground">No comments yet.</p>}
      <ul className="space-y-4">
        {comments.data?.map((c) => (
          <li key={c.id} className="flex gap-3">
            <UserAvatar name={c.author.name} id={c.author.id} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground"><span className="font-medium text-foreground">{c.author.name}</span> · {formatDateTime(c.createdAt)}</p>
              <p className="mt-0.5 whitespace-pre-wrap text-sm">{c.body}</p>
            </div>
            {canDeleteComment(workspace.role, c.author.id === user.id) && (
              <button onClick={() => del.mutate(c.id)} aria-label="Delete comment" className="self-start rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive">
                <Trash2 className="size-3.5" />
              </button>
            )}
          </li>
        ))}
      </ul>
      <form className="mt-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (body.trim()) add.mutate(); }}>
        <Label htmlFor="new-comment" className="sr-only">Add a comment</Label>
        <Textarea id="new-comment" rows={2} placeholder="Add a comment…" value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && body.trim()) { e.preventDefault(); add.mutate(); } }} />
        <Button type="submit" variant="secondary" disabled={!body.trim() || add.isPending} className="self-end">Post</Button>
      </form>
    </section>
  );
}
