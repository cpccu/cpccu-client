import Link from "next/link";
import { ExternalLink, FolderGit2 } from "lucide-react";
import { GithubIcon } from "./BrandIcons";
import { EmptyState, SectionCard } from "./SectionCard";

export function ProjectsSection({ projects }) {
  return (
    <SectionCard title="Projects" icon={FolderGit2} id="projects">
      {projects.length === 0 ? (
        <EmptyState
          icon={FolderGit2}
          title="No projects yet"
          description="Projects this member builds and shares will be showcased here."
        />
      ) : (
        <ul className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {projects.map((project) => (
            <li
              key={project.id}
              className="group flex flex-col rounded-lg border border-border bg-card p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
            >
              <h3 className="text-sm font-bold text-foreground">{project.name}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground text-pretty">
                {project.description}
              </p>
              <ul className="mt-4 flex flex-wrap gap-1.5" aria-label="Technologies used">
                {project.technologies.map((tech) => (
                  <li
                    key={tech}
                    className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground"
                  >
                    {tech}
                  </li>
                ))}
              </ul>
              <div className="mt-auto flex items-center gap-2 pt-5">
                {project.repoUrl && (
                  <Link
                    href={project.repoUrl}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-bold text-foreground transition-colors hover:bg-muted"
                  >
                    <GithubIcon className="size-3.5" aria-hidden="true" />
                    Repository
                    <span className="sr-only">for {project.name}</span>
                  </Link>
                )}
                {project.liveUrl && (
                  <Link
                    href={project.liveUrl}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    <ExternalLink className="size-3.5" aria-hidden="true" />
                    Live Demo
                    <span className="sr-only">of {project.name}</span>
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
