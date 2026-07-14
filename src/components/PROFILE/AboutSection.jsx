import { UserRound } from "lucide-react";
import { EmptyState, SectionCard } from "./SectionCard";

export function AboutSection({ member }) {
  const hasContent = member.bio || member.interests?.length > 0 || member.careerGoals;

  return (
    <SectionCard title="About" icon={UserRound} id="about">
      {!hasContent ? (
        <EmptyState
          icon={UserRound}
          title="No bio added yet"
          description="This member hasn't written their biography yet. Check back soon."
        />
      ) : (
        <div className="flex flex-col gap-7">
          {member.bio && (
            <p className="text-sm leading-7 text-muted-foreground text-pretty md:text-[15px] md:leading-8">
              {member.bio}
            </p>
          )}

          {member.interests?.length > 0 && (
            <div>
              <h3 className="mb-2.5 flex items-center gap-2 text-sm font-bold text-foreground">
                <span className="text-primary" aria-hidden="true">❤</span>
                Interests
              </h3>
              <ul className="flex flex-wrap gap-2">
                {member.interests.map((interest) => (
                  <li
                    key={interest}
                    className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground"
                  >
                    {interest}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {member.careerGoals && (
            <div>
              <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-foreground">
                <span className="text-primary" aria-hidden="true">🧭</span>
                Career Goals
              </h3>
              <p className="text-sm leading-7 text-muted-foreground text-pretty md:leading-8">
                {member.careerGoals}
              </p>
            </div>
          )}
        </div>
      )}
    </SectionCard>
  );
}
