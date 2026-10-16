CREATE TABLE users (
 id UUID PRIMARY KEY, created_at TIMESTAMP WITH TIME ZONE NOT NULL,
 name VARCHAR(255) NOT NULL, email VARCHAR(255) NOT NULL UNIQUE,
 password_hash VARCHAR(255) NOT NULL, email_verified BOOLEAN NOT NULL
);
CREATE TABLE workspaces (
 id UUID PRIMARY KEY, created_at TIMESTAMP WITH TIME ZONE NOT NULL,
 name VARCHAR(255) NOT NULL, slug VARCHAR(255) NOT NULL UNIQUE
);
CREATE TABLE memberships (
 id UUID PRIMARY KEY, created_at TIMESTAMP WITH TIME ZONE NOT NULL,
 workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 user_id UUID NOT NULL REFERENCES users(id), role VARCHAR(255) NOT NULL CHECK(role IN ('OWNER','ADMIN','MEMBER')),
 UNIQUE(workspace_id,user_id)
);
CREATE INDEX memberships_user ON memberships(user_id);
CREATE TABLE projects (
 id UUID PRIMARY KEY, created_at TIMESTAMP WITH TIME ZONE NOT NULL,
 workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 project_key VARCHAR(255) NOT NULL, name VARCHAR(255) NOT NULL, description VARCHAR(5000) NOT NULL,
 color_index INTEGER NOT NULL, next_number BIGINT NOT NULL,
 UNIQUE(workspace_id,project_key), UNIQUE(id,workspace_id)
);
CREATE TABLE tasks (
 id UUID PRIMARY KEY, created_at TIMESTAMP WITH TIME ZONE NOT NULL,
 workspace_id UUID NOT NULL, project_id UUID NOT NULL,
 task_key VARCHAR(255) NOT NULL, title VARCHAR(255) NOT NULL, description VARCHAR(5000) NOT NULL,
 status VARCHAR(255) NOT NULL CHECK(status IN ('TODO','IN_PROGRESS','IN_REVIEW','DONE')),
 priority VARCHAR(255) NOT NULL CHECK(priority IN ('LOW','MEDIUM','HIGH','URGENT')),
 assignee_id UUID REFERENCES users(id), created_by_id UUID NOT NULL REFERENCES users(id),
 due_date DATE, position DOUBLE PRECISION NOT NULL, updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
 FOREIGN KEY(project_id,workspace_id) REFERENCES projects(id,workspace_id) ON DELETE CASCADE,
 UNIQUE(project_id,task_key), UNIQUE(id,workspace_id)
);
CREATE INDEX tasks_workspace_project ON tasks(workspace_id,project_id);
CREATE TABLE comments (
 id UUID PRIMARY KEY, created_at TIMESTAMP WITH TIME ZONE NOT NULL,
 workspace_id UUID NOT NULL, task_id UUID NOT NULL, author_id UUID NOT NULL REFERENCES users(id), body VARCHAR(2000) NOT NULL,
 FOREIGN KEY(task_id,workspace_id) REFERENCES tasks(id,workspace_id) ON DELETE CASCADE
);
CREATE INDEX comments_task ON comments(task_id);
CREATE TABLE sessions (
 id UUID PRIMARY KEY, created_at TIMESTAMP WITH TIME ZONE NOT NULL,
 user_id UUID NOT NULL REFERENCES users(id), user_agent VARCHAR(1000) NOT NULL, ip_address VARCHAR(255) NOT NULL,
 last_used_at TIMESTAMP WITH TIME ZONE NOT NULL, expires_at TIMESTAMP WITH TIME ZONE NOT NULL, revoked_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX sessions_user ON sessions(user_id);
CREATE TABLE refresh_tokens (
 id UUID PRIMARY KEY, created_at TIMESTAMP WITH TIME ZONE NOT NULL,
 session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE, hash VARCHAR(255) NOT NULL UNIQUE,
 expires_at TIMESTAMP WITH TIME ZONE NOT NULL, used_at TIMESTAMP WITH TIME ZONE, replaced_by UUID REFERENCES refresh_tokens(id)
);
CREATE TABLE email_tokens (
 id UUID PRIMARY KEY, created_at TIMESTAMP WITH TIME ZONE NOT NULL,
 user_id UUID NOT NULL REFERENCES users(id), hash VARCHAR(255) NOT NULL UNIQUE, purpose VARCHAR(255) NOT NULL,
 expires_at TIMESTAMP WITH TIME ZONE NOT NULL, used_at TIMESTAMP WITH TIME ZONE
);
