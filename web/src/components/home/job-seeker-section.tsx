import Link from "next/link";
import { ArrowRight } from "lucide-react";
import styles from "./home.module.css";

export default function JobSeekerSection() {
  return (
    <section
      id="job-seekers"
      className={styles.candidateSection}
      aria-labelledby="job-seekers-heading"
      tabIndex={-1}
    >
      <div className={styles.candidateGrid}>
        <div className={styles.candidateCopy}>
          <p className={styles.sectionLabel}>For job seekers</p>

          <h2
            id="job-seekers-heading"
            className={styles.sectionHeading}
          >
            More than a résumé.
            <br />
            <span>A fuller picture of you.</span>
          </h2>

          <p className={styles.sectionDescription}>
            Bring your skills, experience, and projects together in one
            profile. Explore opportunities and keep track of your
            applications.
          </p>

          <div className={styles.sectionCta}>
            <Link
              href="/auth/signup"
              className={styles.primaryAction}
              aria-describedby="candidate-signup-note"
            >
              Build your profile
              <ArrowRight size={18} aria-hidden="true" />
            </Link>

            <p
              id="candidate-signup-note"
              className={styles.signupNote}
            >
              Create an account to get started.
            </p>
          </div>
        </div>

        <figure className={styles.candidateDemo}>
          <article
            className={styles.expandedProfile}
            aria-labelledby="candidate-example-name"
          >
            <div className={styles.profileCover} aria-hidden="true" />

            <div className={styles.expandedProfileBody}>
              <div className={styles.expandedIdentity}>
                <div className={styles.expandedAvatar} aria-hidden="true">
                  AL
                </div>

                <div className={styles.expandedIdentityText}>
                  <h3
                    id="candidate-example-name"
                    className={styles.profileName}
                  >
                    Alex Laurent
                  </h3>
                  <p className={styles.profileRole}>
                    Software developer · Montréal
                  </p>
                </div>
              </div>

              <p className={styles.candidateBio}>
                I enjoy building thoughtful web applications and turning
                everyday problems into useful tools.
              </p>

              <div className={styles.profilePart}>
                <h4 className={styles.profilePartLabel}>Skills</h4>
                <ul className={styles.expandedSkills}>
                  {["TypeScript", "React", "Java"].map((skill) => (
                    <li key={skill}>{skill}</li>
                  ))}
                </ul>
              </div>

              <div className={styles.profilePart}>
                <h4 className={styles.profilePartLabel}>Experience</h4>
                <p className={styles.profileEntryTitle}>
                  Web Development Intern
                </p>
                <p className={styles.profileEntryDetail}>
                  Mapleworks Studio · Summer 2026
                </p>
              </div>

              <div className={styles.profilePart}>
                <h4 className={styles.profilePartLabel}>Featured project</h4>

                <div className={styles.expandedProject}>
                  <p className={styles.profileEntryTitle}>
                    Community garden planner
                  </p>
                  <p className={styles.profileEntryDetail}>
                    A shared space to plan planting schedules and
                    coordinate volunteers.
                  </p>
                </div>
              </div>
            </div>
          </article>

          <figcaption className={styles.candidateCaption}>
            Illustrative profile · fictional person, experience and project
          </figcaption>
        </figure>
      </div>
    </section>
  );
}