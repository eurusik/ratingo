import type { TaskFrontmatter } from './task.schema';

export interface TaskDefinition {
  name: string;
  frontmatter: TaskFrontmatter;
  body: string;
}
