import { ArrowDown } from "lucide-react";
import styles from "./home.module.css";
import motion from "./hero-motion.module.css";

type Skill = { name: string; match: boolean };

const profileSkills: Skill[] = [
  { name: "TypeScript", match: true },
  { name: "React", match: true },
  { name: "Java", match: true },
  { name: "Python", match: false },
];

const exampleJobs = [
  {
    initial: "N",
    tone: styles.tone0,
    title: "Frontend Developer",
    company: "Northline Studio",
    location: "Montréal · Hybrid",
    skills: [
      { name: "React", match: true },
      { name: "TypeScript", match: true },
    ] satisfies Skill[],
    motion: "job-first",
  },
  {
    initial: "F",
    tone: styles.tone1,
    title: "Software Developer",
    company: "Fieldwork Labs",
    location: "Remote",
    skills: [
      { name: "Java", match: true },
      { name: "SQL", match: false },
    ] satisfies Skill[],
    motion: "job-second",
  },
];

/**
 * The first thing visitors see: what CareerConnect is, two clear next steps,
 * and an illustrative profile connected to the opportunities it fits. All
 * people, companies and postings here are fictional and labelled as such.
 */
export default function HomeHero() {
  return (
    <section className={styles.heroBand} aria-labelledby="hero-heading">
      <div className={`${styles.hero} ${motion.hero}`}>
        <div className={styles.heroCopy}>
          <p className={styles.heroLabel} data-hero-motion="title">
            Job search · Applications · Profiles
          </p>

          <h1
            id="hero-heading"
            className={styles.headline}
            data-hero-motion="title"
          >
            Your talent.
            <br />
            <span>New possibilities.</span>
          </h1>

          <p className={styles.description} data-hero-motion="description">
            Showcase your skills, explore opportunities, and keep your next
            move organized. Hiring? Get to know the people behind the
            applications.
          </p>

          <div className={styles.actions} data-hero-motion="actions">
            <a
              href="#job-seekers"
              className={styles.primaryAction}
              data-hero-button="primary"
            >
              Find opportunities
              <ArrowDown size={18} aria-hidden="true" />
            </a>

            <a
              href="#recruiters"
              className={styles.secondaryAction}
              data-hero-button="secondary"
            >
              Find talent
              <ArrowDown size={18} aria-hidden="true" />
            </a>
          </div>

          <p className={styles.actionHint} data-hero-motion="hint">
            Explore what CareerConnect can do for you.
          </p>
        </div>

        <figure className={styles.showcase}>
          <article
            className={styles.profileCard}
            aria-labelledby="example-profile-name"
            data-hero-motion="profile"
          >
            <div className={styles.person}>
              <div className={styles.avatar} aria-hidden="true">
                AL
              </div>

              <div>
                <h2 id="example-profile-name" className={styles.profileName}>
                  Alex Laurent
                </h2>
                <p className={styles.profileRole}>
                  Software developer · Montréal
                </p>
              </div>
            </div>

            <ul className={styles.skills} aria-label="Example skills">
              {profileSkills.map((skill) => (
                <li key={skill.name} data-match={skill.match}>
                  {skill.name}
                </li>
              ))}
            </ul>

            <div className={styles.project}>
              <p className={styles.eyebrow}>Featured project</p>
              <h3 className={styles.projectName}>Community garden planner</h3>
              <p className={styles.projectDescription}>
                A shared space to plan planting schedules and coordinate
                volunteers.
              </p>
            </div>
          </article>

          <ul
            className={styles.opportunities}
            aria-label="Illustrative opportunities"
          >
            {exampleJobs.map((job) => (
              <li key={job.company} data-hero-motion={job.motion}>
                <article className={styles.jobCard}>
                  <div
                    className={`${styles.companyMark} ${job.tone}`}
                    aria-hidden="true"
                  >
                    {job.initial}
                  </div>

                  <div>
                    <h3 className={styles.jobTitle}>{job.title}</h3>
                    <p className={styles.jobDetails}>
                      {job.company} · {job.location}
                    </p>

                    <ul className={styles.jobSkills} aria-label="Skills wanted">
                      {job.skills.map((skill) => (
                        <li key={skill.name} data-match={skill.match}>
                          {skill.name}
                          {skill.match ? (
                            <span className={styles.srOnly}>
                              , also on the profile
                            </span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                </article>
              </li>
            ))}
          </ul>

          <figcaption className={styles.exampleLabel} data-hero-motion="caption">
            Illustrative profile and opportunities · fictional person and
            companies. Highlighted skills appear in both.
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
