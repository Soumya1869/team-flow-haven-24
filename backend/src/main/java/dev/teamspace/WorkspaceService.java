package dev.teamspace;

import com.fasterxml.jackson.databind.JsonNode;
import dev.teamspace.Contracts.*;
import dev.teamspace.Model.*;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.*;
import java.util.*;

@Service
@Transactional
public class WorkspaceService {
    private final Store db; private final AuthService auth;
    public WorkspaceService(Store db,AuthService auth) { this.db=db; this.auth=auth; }
    private record Access(UUID user,Role role) {}
    Access access(Jwt token,UUID ws,Role min) {
        UUID user=auth.actor(token).id();
        // Serialize workspace mutations, including last-owner changes and assignment/removal races.
        db.lock(Workspace.class,ws);
        var m=membership(ws,user);
        if(m==null) throw new ApiException(403,"NOT_A_MEMBER","You are not a member of this workspace");
        if(m.role.ordinal()<min.ordinal()) throw ApiException.forbidden();
        return new Access(user,m.role);
    }
    Membership membership(UUID ws,UUID user) { return db.one(Membership.class,"from Membership where workspaceId=?1 and userId=?2",ws,user); }
    long count(String query,Object... args) { return db.one(Long.class,query,args); }
    WorkspaceDto workspaceDto(Workspace w,Role r) { return new WorkspaceDto(w.id,w.name,w.slug,r,count("select count(m) from Membership m where workspaceId=?1",w.id)); }
    MemberDto memberDto(Membership m) { var u=db.get(User.class,m.userId); return new MemberDto(u.id,u.name,u.email,m.role,m.createdAt); }
    ProjectDto projectDto(Project p) {
        return new ProjectDto(p.id,p.workspaceId,p.key,p.name,p.description,p.colorIndex,
            count("select count(t) from Task t where projectId=?1",p.id),count("select count(t) from Task t where projectId=?1 and status=?2",p.id,Status.DONE),p.createdAt);
    }
    TaskDto taskDto(Task t) {
        return new TaskDto(t.id,t.projectId,t.key,t.title,t.description,t.status,t.priority,t.assigneeId,t.createdById,t.dueDate,t.position,
            count("select count(c) from TaskComment c where taskId=?1",t.id),t.createdAt,t.updatedAt);
    }
    CommentDto commentDto(Comment c) { var u=db.get(User.class,c.authorId); return new CommentDto(c.id,c.taskId,new Author(u.id,u.name),c.body,c.createdAt); }
    Project project(UUID ws,UUID id) { var p=db.one(Project.class,"from Project where workspaceId=?1 and id=?2",ws,id); if(p==null) throw ApiException.missing(); return p; }
    Task task(UUID ws,UUID id) { var t=db.one(Task.class,"from Task where workspaceId=?1 and id=?2",ws,id); if(t==null) throw ApiException.missing(); return t; }
    void assignee(UUID ws,UUID id) { if(id!=null && membership(ws,id)==null) throw new ApiException(400,"INVALID_ASSIGNEE","Assignee must belong to this workspace"); }
    public List<WorkspaceDto> workspaces(Jwt token) {
        var user=auth.actor(token).id();
        return db.list(Membership.class,"from Membership where userId=?1 order by createdAt",user).stream()
            .map(m -> workspaceDto(db.get(Workspace.class,m.workspaceId),m.role)).toList();
    }
    public WorkspaceDto createWorkspace(Jwt token,Name body) {
        UUID user=auth.actor(token).id(); var w=new Workspace(); w.name=body.name().trim();
        w.slug=w.name.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+","-")+"-"+w.id; db.save(w);
        var m=new Membership(); m.workspaceId=w.id; m.userId=user; m.role=Role.OWNER; db.save(m); return workspaceDto(w,m.role);
    }
    public List<MemberDto> members(Jwt token,UUID ws) { access(token,ws,Role.MEMBER); return db.list(Membership.class,"from Membership where workspaceId=?1 order by createdAt",ws).stream().map(this::memberDto).toList(); }
    void assign(Role actor,Role current,Role next) {
        if(actor!=Role.OWNER && !(actor==Role.ADMIN && next==Role.MEMBER && (current==null || current==Role.MEMBER))) throw ApiException.forbidden();
    }
    void lastOwner(UUID ws,Membership m) {
        if(m.role==Role.OWNER && count("select count(m) from Membership m where workspaceId=?1 and role=?2",ws,Role.OWNER)<=1)
            throw new ApiException(409,"LAST_OWNER","A workspace must retain at least one owner");
    }
    public MemberDto addMember(Jwt token,UUID ws,AddMember body) {
        var a=access(token,ws,Role.ADMIN); assign(a.role,null,body.role());
        var u=auth.findEmail(body.email()); if(u==null) throw new ApiException(404,"USER_NOT_FOUND","User must register before being added");
        if(membership(ws,u.id)!=null) throw new ApiException(409,"ALREADY_MEMBER","User is already a member");
        var m=new Membership(); m.workspaceId=ws; m.userId=u.id; m.role=body.role(); db.save(m); return memberDto(m);
    }
    public MemberDto role(Jwt token,UUID ws,UUID user,ChangeRole body) {
        var a=access(token,ws,Role.ADMIN); var m=membership(ws,user); if(m==null) throw ApiException.missing();
        assign(a.role,m.role,body.role()); if(body.role()!=Role.OWNER) lastOwner(ws,m); m.role=body.role(); return memberDto(m);
    }
    public void removeMember(Jwt token,UUID ws,UUID user) {
        var a=access(token,ws,Role.MEMBER); var m=membership(ws,user); if(m==null) throw ApiException.missing();
        if(!a.user.equals(user) && a.role!=Role.OWNER && !(a.role==Role.ADMIN && m.role==Role.MEMBER)) throw ApiException.forbidden();
        lastOwner(ws,m);
        db.list(Task.class,"from Task where workspaceId=?1 and assigneeId=?2",ws,user).forEach(t -> { t.assigneeId=null; t.updatedAt=Instant.now(); });
        db.delete(m);
    }
    public List<ProjectDto> projects(Jwt token,UUID ws) { access(token,ws,Role.MEMBER); return db.list(Project.class,"from Project where workspaceId=?1 order by createdAt",ws).stream().map(this::projectDto).toList(); }
    public ProjectDto createProject(Jwt token,UUID ws,NewProject body) {
        access(token,ws,Role.ADMIN);
        if(db.one(Project.class,"from Project where workspaceId=?1 and key=?2",ws,body.key())!=null) throw new ApiException(409,"PROJECT_KEY_EXISTS","Project key is already in use");
        var p=new Project(); p.workspaceId=ws; p.key=body.key(); p.name=body.name().trim(); p.description=body.description(); db.save(p); return projectDto(p);
    }
    public void removeProject(Jwt token,UUID ws,UUID id) { access(token,ws,Role.ADMIN); db.delete(project(ws,id)); }
    public List<TaskDto> tasks(Jwt token,UUID ws,UUID project,String q,String assigneeId,Priority priority,Status status) {
        access(token,ws,Role.MEMBER); project(ws,project);
        UUID assignee=null;
        if(assigneeId!=null && !assigneeId.isBlank() && !assigneeId.equals("unassigned")) {
            try { assignee=UUID.fromString(assigneeId); } catch(IllegalArgumentException e) { throw new ApiException(400,"VALIDATION_ERROR","Invalid assignee id"); }
        }
        final UUID selected=assignee;
        return db.list(Task.class,"from Task where workspaceId=?1 and projectId=?2 order by position, createdAt",ws,project).stream()
            .filter(t -> q==null || (t.title+" "+t.key).toLowerCase(Locale.ROOT).contains(q.toLowerCase(Locale.ROOT)))
            .filter(t -> assigneeId==null || assigneeId.isBlank() || (assigneeId.equals("unassigned")? t.assigneeId==null:Objects.equals(selected,t.assigneeId)))
            .filter(t -> priority==null || t.priority==priority).filter(t -> status==null || t.status==status).map(this::taskDto).toList();
    }
    public TaskDto createTask(Jwt token,UUID ws,UUID project,NewTask body) {
        var a=access(token,ws,Role.MEMBER); var p=project(ws,project); assignee(ws,body.assigneeId());
        var t=new Task(); t.workspaceId=ws; t.projectId=p.id; t.key=p.key+"-"+(p.nextNumber++);
        t.title=body.title().trim(); t.description=Objects.toString(body.description(),""); t.status=body.status()==null?Status.TODO:body.status();
        t.priority=body.priority(); t.assigneeId=body.assigneeId(); t.createdById=a.user; t.dueDate=body.dueDate(); t.position=p.nextNumber*1024.0;
        db.save(t); return taskDto(t);
    }
    // PATCH must distinguish omitted fields from explicit null (clear assignee/due date).
    public TaskDto updateTask(Jwt token,UUID ws,UUID id,JsonNode body) {
        access(token,ws,Role.MEMBER); var t=task(ws,id);
        if(!body.isObject()) throw new ApiException(400,"VALIDATION_ERROR","Expected a JSON object");
        Set<String> allowed=Set.of("title","description","status","priority","assigneeId","dueDate");
        body.fieldNames().forEachRemaining(k -> { if(!allowed.contains(k)) throw new ApiException(400,"VALIDATION_ERROR","Unknown task field: "+k); });
        try {
            if(body.has("title")) t.title=text(body,"title",200,true).trim();
            if(body.has("description")) t.description=text(body,"description",5000,false);
            if(body.has("status")) t.status=Status.valueOf(text(body,"status",30,true));
            if(body.has("priority")) t.priority=Priority.valueOf(text(body,"priority",30,true));
            if(body.has("assigneeId")) { t.assigneeId=body.get("assigneeId").isNull()?null:UUID.fromString(text(body,"assigneeId",36,true)); assignee(ws,t.assigneeId); }
            if(body.has("dueDate")) t.dueDate=body.get("dueDate").isNull()?null:LocalDate.parse(text(body,"dueDate",10,true));
        } catch(IllegalArgumentException | java.time.format.DateTimeParseException e) { throw new ApiException(400,"VALIDATION_ERROR","Invalid task field value"); }
        t.updatedAt=Instant.now(); return taskDto(t);
    }
    String text(JsonNode body,String key,int max,boolean required) {
        var v=body.get(key); if(!v.isTextual() || v.asText().length()>max || (required && v.asText().isBlank()))
            throw new ApiException(400,"VALIDATION_ERROR","Invalid "+key);
        return v.asText();
    }
    public TaskDto move(Jwt token,UUID ws,UUID id,Move body) {
        access(token,ws,Role.MEMBER); var t=task(ws,id);
        if(!Double.isFinite(body.position())) throw new ApiException(400,"VALIDATION_ERROR","Position must be finite");
        t.status=body.status(); t.position=body.position(); t.updatedAt=Instant.now(); return taskDto(t);
    }
    public void removeTask(Jwt token,UUID ws,UUID id) {
        var a=access(token,ws,Role.MEMBER); var t=task(ws,id);
        if(a.role==Role.MEMBER && !t.createdById.equals(a.user)) throw ApiException.forbidden(); db.delete(t);
    }
    public List<CommentDto> comments(Jwt token,UUID ws,UUID task) {
        access(token,ws,Role.MEMBER); task(ws,task);
        return db.list(Comment.class,"from TaskComment where workspaceId=?1 and taskId=?2 order by createdAt",ws,task).stream().map(this::commentDto).toList();
    }
    public CommentDto comment(Jwt token,UUID ws,UUID task,NewComment body) {
        var a=access(token,ws,Role.MEMBER); task(ws,task);
        var c=new Comment(); c.workspaceId=ws; c.taskId=task; c.authorId=a.user; c.body=body.body().trim(); db.save(c); return commentDto(c);
    }
    public void removeComment(Jwt token,UUID ws,UUID id) {
        var a=access(token,ws,Role.MEMBER); var c=db.one(Comment.class,"from TaskComment where workspaceId=?1 and id=?2",ws,id);
        if(c==null) throw ApiException.missing(); if(a.role==Role.MEMBER && !c.authorId.equals(a.user)) throw ApiException.forbidden(); db.delete(c);
    }
}
