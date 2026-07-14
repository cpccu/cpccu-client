import { Sparkles } from "lucide-react";
import { EmptyState, SectionCard } from "./SectionCard";

export function SkillsSection({ skillGroups, editMode, onAddSkill, onRemoveSkill, newSkill, setNewSkill }) {
  return (
    <SectionCard title="Skills" icon={Sparkles} id="skills">
      {skillGroups.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="No skills listed yet"
          description="Skills will appear here once this member adds them to their profile."
        />
      ) : (
        <div className="flex flex-col gap-5">
          {skillGroups.map((group) => (
            <div key={group.category} className="rounded-lg border border-border p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  {group.category}
                </h3>
                <span className="rounded-full bg-accent px-2.5 py-1 text-[11px] font-bold text-accent-foreground">
                  {group.level}
                </span>
              </div>
              <ul className="flex flex-wrap gap-2">
                {group.skills.map((skill) => (
                  <li
                    key={skill}
                    className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:border-primary/40 hover:bg-accent hover:text-accent-foreground"
                  >
                    {skill}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {editMode && (
        <div className="mt-6 pt-6 border-t border-border flex flex-col gap-3">
          <input
            value={newSkill.skillName}
            onChange={(e) => setNewSkill({ ...newSkill, skillName: e.target.value })}
            placeholder="Skill name (e.g., React)"
            className="w-full px-4 py-2 bg-muted border border-border rounded-xl text-sm outline-none focus:border-blue-400 transition-colors"
          />
          <input
            value={newSkill.experience}
            onChange={(e) => setNewSkill({ ...newSkill, experience: e.target.value })}
            placeholder="Experience (e.g., 2+ years)"
            className="w-full px-4 py-2 bg-muted border border-border rounded-xl text-sm outline-none focus:border-blue-400 transition-colors"
          />
          <button
            onClick={onAddSkill}
            className="w-full px-4 py-2 bg-primary text-white rounded-xl font-bold hover:bg-primary/90 transition-colors"
          >
            + Add Skill
          </button>
        </div>
      )}
    </SectionCard>
  );
}
