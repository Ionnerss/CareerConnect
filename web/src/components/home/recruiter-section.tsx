import type { CSSProperties } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import styles from "./home.module.css";
import { Reveal } from "./home-motion";

const requiredSkills = ["React", "TypeScript", "Node.js"];

/**
 * Mirrors what the recruiter applicants page really shows today: each
 * applicant's skill match against the posting ("N of M skills", what is
 * missing), listed best match first. People and the posting are fictional.
 */
const applicants = [
  {
    id: "alex",
    initials: "AL",
    name: "Alex Laurent",
    detail: "Software developer · Montréal",
    percent: 67,
    matched: 2,
    missing: ["Node.js"],
    avatar: styles.tone0,
  },
  {
    id: "sam",
    initials: "SK",
    name: "Sam Kim",
    detail: "Frontend developer · Ottawa",
    percent: 33,
    matched: 1,
    missing: ["TypeScript", "Node.js"],
    avatar: styles.tone2,
  },
];

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
          <Reveal>
            <p className={styles.sectionLabel}>For recruiters</p>

            <h2 id="recruiters-heading" className={styles.sectionHeading}>
              Meet the person
              <br />
              <span>behind the application.</span>
            </h2>

            <p className={styles.sectionDescription}>
              See who applied to each of your postings, with their application
              status and how closely their skills match what you asked for.
              The best matches come first.
            </p>

            <div className={styles.sectionCta}>
              <Link
                href="/auth/signup?as=recruiter"
                className={styles.primaryAction}
                aria-describedby="recruiter-signup-note"
              >
                Recruiter sign up
                <ArrowRight size={18} aria-hidden="true" />
              </Link>

              <p id="recruiter-signup-note" className={styles.signupNote}>
                Use your Concordia email. Already registered?{" "}
                <Link href="/auth/login?as=recruiter">Recruiter log in</Link>
              </p>
            </div>
          </Reveal>
        </div>

        <figure className={styles.recruiterDemo}>
          <Reveal delay={120}>
            <div
              className={styles.applicantWindow}
              role="group"
              aria-label="Illustrative recruiter applicant view"
            >
              <div className={styles.postingHeader}>
                <p className={styles.profilePartLabel}>Job posting</p>
                <h3 className={styles.postingTitle}>Frontend Developer</h3>
                <p className={styles.profileEntryDetail}>
                  Northline Studio · Montréal · Hybrid
                </p>

                <ul
                  className={styles.requiredSkills}
                  aria-label="Required skills"
                >
                  {requiredSkills.map((skill) => (
                    <li key={skill}>{skill}</li>
                  ))}
                </ul>
              </div>

              <div className={styles.applicantList}>
                <p className={styles.profilePartLabel}>
                  Applicants · best match first
                </p>

                <ul className={styles.applicantItems}>
                  {applicants.map((applicant) => (
                    <li key={applicant.id}>
                      <article
                        className={styles.applicantRow}
                        aria-labelledby={`recruiter-example-${applicant.id}`}
                      >
                        <div
                          className={`${styles.applicantAvatar} ${applicant.avatar}`}
                          aria-hidden="true"
                        >
                          {applicant.initials}
                        </div>

                        <div>
                          <div className={styles.applicantTop}>
                            <h4
                              id={`recruiter-example-${applicant.id}`}
                              className={styles.applicantName}
                            >
                              {applicant.name}
                            </h4>
                            <span className={styles.applicantPercent}>
                              {applicant.percent}%
                              <span className={styles.srOnly}> skill match</span>
                            </span>
                          </div>

                          <p className={styles.applicantDetail}>
                            {applicant.detail}
                          </p>

                          <div className={styles.matchBar} aria-hidden="true">
                            <span
                              style={
                                { "--match": `${applicant.percent}%` } as CSSProperties
                              }
                            />
                          </div>

                          <p className={styles.applicantMatchNote}>
                            {applicant.matched} of {requiredSkills.length}{" "}
                            skills · Missing: {applicant.missing.join(", ")}
                          </p>
                        </div>
                      </article>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Reveal>

          <figcaption className={styles.candidateCaption}>
            Illustrative view · fictional posting and applicants
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
