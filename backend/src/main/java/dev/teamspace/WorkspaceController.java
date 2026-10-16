package dev.teamspace;

import dev.teamspace.Contracts.*;
import dev.teamspace.Model.*;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
@RequestMapping("/api/workspaces")
public class WorkspaceController {
    private final WorkspaceService service;
    public WorkspaceController(WorkspaceService service) { this.service=service; }
    @GetMapping List<WorkspaceDto> workspaces(@AuthenticationPrincipal Jwt t) { return service.workspaces(t); }
    @PostMapping @ResponseStatus(HttpStatus.CREATED) WorkspaceDto create(@AuthenticationPrincipal Jwt t,@Valid @RequestBody Name b) { return service.createWorkspace(t,b); }
    @GetMapping("/{ws}/members") List<MemberDto> members(@AuthenticationPrincipal Jwt t,@PathVariable UUID ws) { return service.members(t,ws); }
    @PostMapping("/{ws}/members") @ResponseStatus(HttpStatus.CREATED) MemberDto member(@AuthenticationPrincipal Jwt t,@PathVariable UUID ws,@Valid @RequestBody AddMember b) { return service.addMember(t,ws,b); }
    @PatchMapping("/{ws}/members/{id}") MemberDto role(@AuthenticationPrincipal Jwt t,@PathVariable UUID ws,@PathVariable UUID id,@Valid @RequestBody ChangeRole b) { return service.role(t,ws,id,b); }
    @DeleteMapping("/{ws}/members/{id}") @ResponseStatus(HttpStatus.NO_CONTENT) void removeMember(@AuthenticationPrincipal Jwt t,@PathVariable UUID ws,@PathVariable UUID id) { service.removeMember(t,ws,id); }
    @GetMapping("/{ws}/projects") List<ProjectDto> projects(@AuthenticationPrincipal Jwt t,@PathVariable UUID ws) { return service.projects(t,ws); }
    @PostMapping("/{ws}/projects") @ResponseStatus(HttpStatus.CREATED) ProjectDto project(@AuthenticationPrincipal Jwt t,@PathVariable UUID ws,@Valid @RequestBody NewProject b) { return service.createProject(t,ws,b); }
    @DeleteMapping("/{ws}/projects/{id}") @ResponseStatus(HttpStatus.NO_CONTENT) void removeProject(@AuthenticationPrincipal Jwt t,@PathVariable UUID ws,@PathVariable UUID id) { service.removeProject(t,ws,id); }
    @GetMapping("/{ws}/projects/{id}/tasks") List<TaskDto> tasks(@AuthenticationPrincipal Jwt t,@PathVariable UUID ws,@PathVariable UUID id,
        @RequestParam(required=false) String q,@RequestParam(required=false) String assigneeId,@RequestParam(required=false) Priority priority,@RequestParam(required=false) Status status) { return service.tasks(t,ws,id,q,assigneeId,priority,status); }
    @PostMapping("/{ws}/projects/{id}/tasks") @ResponseStatus(HttpStatus.CREATED) TaskDto task(@AuthenticationPrincipal Jwt t,@PathVariable UUID ws,@PathVariable UUID id,@Valid @RequestBody NewTask b) { return service.createTask(t,ws,id,b); }
    @PatchMapping("/{ws}/tasks/{id}") TaskDto update(@AuthenticationPrincipal Jwt t,@PathVariable UUID ws,@PathVariable UUID id,@RequestBody JsonNode b) { return service.updateTask(t,ws,id,b); }
    @PostMapping("/{ws}/tasks/{id}/move") TaskDto move(@AuthenticationPrincipal Jwt t,@PathVariable UUID ws,@PathVariable UUID id,@Valid @RequestBody Move b) { return service.move(t,ws,id,b); }
    @DeleteMapping("/{ws}/tasks/{id}") @ResponseStatus(HttpStatus.NO_CONTENT) void removeTask(@AuthenticationPrincipal Jwt t,@PathVariable UUID ws,@PathVariable UUID id) { service.removeTask(t,ws,id); }
    @GetMapping("/{ws}/tasks/{id}/comments") List<CommentDto> comments(@AuthenticationPrincipal Jwt t,@PathVariable UUID ws,@PathVariable UUID id) { return service.comments(t,ws,id); }
    @PostMapping("/{ws}/tasks/{id}/comments") @ResponseStatus(HttpStatus.CREATED) CommentDto comment(@AuthenticationPrincipal Jwt t,@PathVariable UUID ws,@PathVariable UUID id,@Valid @RequestBody NewComment b) { return service.comment(t,ws,id,b); }
    @DeleteMapping("/{ws}/comments/{id}") @ResponseStatus(HttpStatus.NO_CONTENT) void removeComment(@AuthenticationPrincipal Jwt t,@PathVariable UUID ws,@PathVariable UUID id) { service.removeComment(t,ws,id); }
}
