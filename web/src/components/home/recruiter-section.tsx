import Link from "next/link";
import { ArrowRight } from "lucide-react";
import styles from "./home.module.css";

export default function RecruiterSection() {
  return (
    <section
      id="recruiters"
      className={styles.recruiterSection}
      aria-labelledby="recruiters-heading"
      tabIndex={-1}
    >
      <div className={styles.recruiterGrid}>
        <div className={styles.recruiterCopy}>
          <p className={styles.sectionLabel}>For recruiters</p>

          <h2
            id="recruiters-heading"
            className={styles.sectionHeading}
          >
            Meet the person
            <br />
            <span>behind the application.</span>
          </h2>

          <p className={styles.sectionDescription}>
            Explore applicants’ skills, experience, and projects.
            Bring their work into focus as you consider your next hire.
          </p>

          <div className={styles.sectionCta}>
            <Link
              href="/auth/signup"
              className={styles.primaryAction}
              aria-describedby="recruiter-signup-note"
            >
              Find your next hire
              <ArrowRight size={18} aria-hidden="true" />
            </Link>

            <p
              id="recruiter-signup-note"
              className={styles.signupNote}
            >
              Create an account to get started.
            </p>
          </div>
        </div>

        <figure className={styles.recruiterDemo}>
          <div
            className={styles.applicantWindow}
            role="group"
            aria-label="Illustrative recruiter applicant view"
          >
            <div className={styles.postingHeader}>
              <p className={styles.profilePartLabel}>Job posting</p>
              <h3 className={styles.postingTitle}>
                Frontend Developer
              </h3>
              <p className={styles.profileEntryDetail}>
                Northline Studio · Montréal · Hybrid
              </p>
            </div>

            <div className={styles.applicantList}>
              <p className={styles.profilePartLabel}>Applicants</p>

              <ul className={styles.applicantItems}>
                <li>
                  <article
                    className={styles.expandedApplicant}
                    aria-labelledby="recruiter-example-alex"
                  >
                    <div className={styles.applicantIdentity}>
                      <div
                        className={styles.applicantAvatar}
                        aria-hidden="true"
                      >
                        AL
                      </div>

                      <div>
                        <h4
                          id="recruiter-example-alex"
                          className={styles.applicantName}
                        >
                          Alex Laurent
                        </h4>
                        <p className={styles.applicantDetail}>
                          Software developer · Montréal
                        </p>
                      </div>
                    </div>

                    <div className={styles.applicantSummary}>
                      <h5 className={styles.profilePartLabel}>
                        Skills
                      </h5>

                      <ul
                        className={styles.applicantSkills}
                        aria-label="Alex’s example skills"
                      >
                        {["TypeScript", "React", "Java"].map((skill) => (
                          <li key={skill}>{skill}</li>
                        ))}
                      </ul>

                      <h5 className={styles.profilePartLabel}>
                        Experience
                      </h5>
                      <p className={styles.profileEntryTitle}>
                        Web Development Intern
                      </p>
                      <p className={styles.applicantDetail}>
                        Mapleworks Studio · Summer 2026
                      </p>

                      <div className={styles.applicantProject}>
                        <h5 className={styles.profilePartLabel}>
                          Featured project
                        </h5>
                        <p className={styles.profileEntryTitle}>
                          Community garden planner
                        </p>
                        <p className={styles.applicantDetail}>
                          A shared space to plan planting schedules and
                          coordinate volunteers.
                        </p>
                      </div>
                    </div>
                  </article>
                </li>

                <li>
                  <article
                    className={styles.compactApplicant}
                    aria-labelledby="recruiter-example-sam"
                  >
                    <div
                      className={styles.neutralApplicantAvatar}
                      aria-hidden="true"
                    >
                      SK
                    </div>

                    <div>
                      <h4
                        id="recruiter-example-sam"
                        className={styles.applicantName}
                      >
                        Sam Kim
                      </h4>
                      <p className={styles.applicantDetail}>
                        Frontend developer · Ottawa
                      </p>
                    </div>
                  </article>
                </li>
              </ul>
            </div>
          </div>

          <figcaption className={styles.candidateCaption}>
            Illustrative view · fictional posting and applicants
          </figcaption>
        </figure>
      </div>
    </section>
  );
}