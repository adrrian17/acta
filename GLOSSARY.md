# acta

acta is a personal knowledge system for a single person: notes first, with search, relations, tasks and agent memory layered on top.

## Language

**Owner**: The one person an acta instance belongs to. Every piece of content in the instance is theirs. _Avoid_: User, member, account, author

**Instance**: One deployment of acta, holding the content of exactly one Owner. _Avoid_: Workspace, tenant, team

## Notes

**Note**: A single untitled block of Markdown written by the Owner. The content is the whole note; there is no separate title. _Avoid_: Memo, post, entry, document

**Tag**: A `#label` written inside a Note's content. A `/` makes it hierarchical (`#work/project` is a child of `#work`). A Note's tags are exactly the ones in its text, and a Tag is always lowercase: `#Ideas` and `#ideas` are the same Tag. _Avoid_: Label, category, folder

**Timeline**: The default view: every Note that is neither archived nor trashed, newest first. _Avoid_: Feed, inbox, home

**Archived**: The state of a Note taken out of the Timeline but kept indefinitely. _Avoid_: Hidden, stored

**Trashed**: The state of a Note or Task waiting for permanent deletion. It can be restored until it is purged. _Avoid_: Deleted, removed

**Pinned**: A flag that keeps a Note at the top of the Timeline. Only Timeline Notes can be pinned. _Avoid_: Starred, favorite

## Tasks

**Task**: A standalone to-do item owned by the Owner. A Task has no relation to any Note and belongs to no project. _Avoid_: Todo, ticket, issue, action item

**Open**: The state of a Task still to be done. _Avoid_: Pending, active, todo

**Done**: The state of a Task the Owner has finished. It is kept indefinitely and is read-only until reopened. _Avoid_: Completed, closed, checked

**Due date**: The optional calendar day by which a Task should be done. A day only, with no time or time zone. _Avoid_: Deadline, due time, reminder
